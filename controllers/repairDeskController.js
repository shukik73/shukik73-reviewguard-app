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

    console.log('[RepairDesk] Raw API response keys:', Object.keys(response.data || {}));
    console.log('[RepairDesk] data field type:', typeof response.data?.data);
    console.log('[RepairDesk] data field keys:', response.data?.data ? Object.keys(response.data.data) : 'N/A');
    console.log('[RepairDesk] Full data structure:', JSON.stringify(response.data, null, 2).substring(0, 1000));
    
    const rawData = response.data?.data;
    const tickets = rawData?.tickets || rawData?.data || (Array.isArray(rawData) ? rawData : []);
    
    console.log('[RepairDesk] Tickets found:', Array.isArray(tickets) ? tickets.length : 'not an array');
    
    if (Array.isArray(tickets) && tickets.length > 0) {
      console.log('[RepairDesk] Sample ticket keys:', Object.keys(tickets[0]));
    }
    
    let cleanTickets = (Array.isArray(tickets) ? tickets : []).map(ticket => ({
      id: ticket.id || ticket.ticket_id || ticket.ticket_number,
      customer_name: ticket.customer?.name || ticket.customer_name || ticket.name || 'Unknown',
      customer_phone: ticket.customer?.phone || ticket.customer_phone || ticket.phone || '',
      device_name: ticket.device?.name || ticket.device_name || ticket.device || ticket.model || 'Unknown Device',
      status: ticket.status || ticket.ticket_status || 'Unknown',
      created_at: ticket.created_at || ticket.date_created || ticket.createdAt || null
    }));

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
    console.error('[RepairDesk] Full error:', error.response?.data || error);
    
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
