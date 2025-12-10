import axios from 'axios';

export async function getRecentTickets(req, res) {
  try {
    const apiKey = process.env.REPAIRDESK_API_KEY;
    
    if (!apiKey) {
      return res.status(500).json({ 
        success: false, 
        error: 'RepairDesk API key not configured' 
      });
    }

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const fromDate = sevenDaysAgo.toISOString().split('T')[0];

    const response = await axios.get('https://api.repairdesk.co/api/web/v1/tickets', {
      params: {
        api_key: apiKey,
        from_date: fromDate
      },
      timeout: 10000
    });

    const tickets = response.data?.data || response.data || [];
    
    const cleanTickets = (Array.isArray(tickets) ? tickets : []).map(ticket => ({
      id: ticket.id || ticket.ticket_id,
      customer_name: ticket.customer?.name || ticket.customer_name || 'Unknown',
      customer_phone: ticket.customer?.phone || ticket.customer_phone || '',
      device_name: ticket.device?.name || ticket.device_name || ticket.device || 'Unknown Device',
      status: ticket.status || ticket.ticket_status || 'Unknown',
      created_at: ticket.created_at || ticket.date_created || null
    }));

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
