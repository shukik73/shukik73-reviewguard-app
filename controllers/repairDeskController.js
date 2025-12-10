import axios from 'axios';

export async function getRecentTickets(req, res) {
  try {
    const apiKey = process.env.REPAIRDESK_API_KEY;
    
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
