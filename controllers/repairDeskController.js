import axios from 'axios';
import { pool } from '../config/database.js';

export async function getRecentTickets(req, res) {
  try {
    const apiKey = process.env.REPAIRDESK_API_KEY;
    const userId = req.user?.id || req.session?.userId;
    
    console.log('[RepairDesk] User ID:', userId);
    
    if (!apiKey) {
      throw new Error('Missing API Key in Secrets');
    }

    const url = `https://api.repairdesk.co/api/web/v1/tickets?api_key=${apiKey}&limit=20`;
    
    console.log('[RepairDesk] Fetching from:', url.replace(apiKey, '****'));
    
    const response = await axios.get(url, { timeout: 10000 });

    const ticketData = response.data?.data?.ticketData || [];
    
    console.log('[RepairDesk] Tickets found:', ticketData.length);
    
    if (ticketData.length > 0) {
      console.log('[RepairDesk] Raw Ticket Data:', JSON.stringify(ticketData[0], null, 2));
    }
    
    let cleanTickets = ticketData.map(ticket => {
      const summary = ticket.summary || {};
      const customer = summary.customer || {};
      const devices = ticket.devices || [];
      const firstDevice = devices[0] || {};
      
      const deviceName = firstDevice.device?.name || firstDevice.name || 'Unknown Device';
      const deviceStatus = firstDevice.status?.name || 'Open';
      const repairCollected = summary.repair_collected ? true : false;
      
      let displayStatus = deviceStatus;
      if (repairCollected) {
        displayStatus = 'Collected';
      }
      
      return {
        id: summary.order_id || summary.id,
        customer_name: customer.fullName || customer.firstName || 'Unknown',
        customer_phone: customer.mobile || customer.phone || '',
        device_name: deviceName,
        status: displayStatus,
        repair_collected: repairCollected,
        created_at: summary.created_date ? new Date(summary.created_date * 1000).toISOString() : null
      };
    });

    const phoneNumbers = cleanTickets.map(t => t.customer_phone.replace(/\D/g, '').slice(-10)).filter(p => p.length === 10);
    
    let smsHistory = {};
    if (phoneNumbers.length > 0 && userId) {
      console.log('[RepairDesk] Looking up SMS history for userId:', userId);
      const smsResult = await pool.query(`
        SELECT DISTINCT ON (RIGHT(REGEXP_REPLACE(customer_phone, '[^0-9]', '', 'g'), 10))
          RIGHT(REGEXP_REPLACE(customer_phone, '[^0-9]', '', 'g'), 10) as phone_last10,
          sent_at,
          message_type
        FROM messages
        WHERE user_id = $1
        ORDER BY RIGHT(REGEXP_REPLACE(customer_phone, '[^0-9]', '', 'g'), 10), sent_at DESC
      `, [userId]);
      
      console.log('[RepairDesk] SMS history found:', smsResult.rows.length, 'records');
      smsResult.rows.forEach(row => {
        smsHistory[row.phone_last10] = {
          sent_at: row.sent_at,
          message_type: row.message_type
        };
      });
      console.log('[RepairDesk] SMS history phones:', Object.keys(smsHistory));
    } else {
      console.log('[RepairDesk] Skipping SMS lookup - phoneNumbers:', phoneNumbers.length, 'userId:', userId);
    }
    
    cleanTickets = cleanTickets.map(ticket => {
      const phoneLast10 = ticket.customer_phone.replace(/\D/g, '').slice(-10);
      const sms = smsHistory[phoneLast10];
      return {
        ...ticket,
        sms_sent_at: sms?.sent_at || null,
        sms_message_type: sms?.message_type || null
      };
    });

    cleanTickets.sort((a, b) => {
      const dateA = a.created_at ? new Date(a.created_at) : new Date(0);
      const dateB = b.created_at ? new Date(b.created_at) : new Date(0);
      return dateB - dateA;
    });

    console.log('[RepairDesk] Returning', cleanTickets.length, 'tickets');

    res.json({ 
      success: true, 
      tickets: cleanTickets,
      count: cleanTickets.length
    });

  } catch (error) {
    console.error('[RepairDesk] API Error:', error.message);
    
    if (error.response?.status === 401) {
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid RepairDesk API key' 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch tickets from RepairDesk',
      details: error.message
    });
  }
}

export async function checkSmsHistory(req, res) {
  try {
    const userId = req.user?.id || req.session?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const phone = req.params.phone.replace(/\D/g, '');
    const phoneLast10 = phone.slice(-10);
    
    if (phoneLast10.length < 10) {
      return res.json({ hasSms: false });
    }
    
    const result = await pool.query(`
      SELECT sent_at, message_type 
      FROM messages 
      WHERE user_id = $1 
        AND RIGHT(REGEXP_REPLACE(customer_phone, '[^0-9]', '', 'g'), 10) = $2
      ORDER BY sent_at DESC
      LIMIT 1
    `, [userId, phoneLast10]);
    
    if (result.rows.length > 0) {
      res.json({
        hasSms: true,
        lastSentAt: result.rows[0].sent_at,
        messageType: result.rows[0].message_type
      });
    } else {
      res.json({ hasSms: false });
    }
  } catch (error) {
    console.error('Check SMS history error:', error);
    res.status(500).json({ error: 'Failed to check SMS history' });
  }
}
