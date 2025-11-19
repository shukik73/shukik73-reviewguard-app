export const getMessages = (pool) => async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT m.id, m.customer_name, m.customer_phone, m.message_type, m.review_link, m.additional_info, 
              m.photo_path, m.sent_at, m.review_status, m.review_link_clicked_at, m.review_received_at, 
              m.follow_up_sent_at, c.name as customer_name_db, c.phone as customer_phone_db
       FROM messages m
       LEFT JOIN customers c ON m.customer_id = c.id
       ORDER BY m.sent_at DESC
       LIMIT 100`
    );
    res.json({ success: true, messages: result.rows });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getCustomers = (pool) => async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.*, COUNT(m.id) as message_count, MAX(m.sent_at) as last_message_at
       FROM customers c
       LEFT JOIN messages m ON c.id = m.customer_id
       GROUP BY c.id
       ORDER BY c.updated_at DESC`
    );
    res.json({ success: true, customers: result.rows });
  } catch (error) {
    console.error('Error fetching customers:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getStats = (pool) => async (req, res) => {
  try {
    const totalMessages = await pool.query('SELECT COUNT(*) as count FROM messages');
    const totalCustomers = await pool.query('SELECT COUNT(*) as count FROM customers');
    
    const todayMessages = await pool.query(
      "SELECT COUNT(*) as count FROM messages WHERE sent_at >= CURRENT_DATE"
    );
    
    const weekMessages = await pool.query(
      "SELECT COUNT(*) as count FROM messages WHERE sent_at >= CURRENT_DATE - INTERVAL '7 days'"
    );
    
    const messagesByType = await pool.query(
      `SELECT message_type, COUNT(*) as count 
       FROM messages 
       GROUP BY message_type`
    );

    const recentMessages = await pool.query(
      `SELECT customer_name, message_type, sent_at 
       FROM messages 
       ORDER BY sent_at DESC 
       LIMIT 5`
    );
    
    const reviewStats = await pool.query(
      `SELECT review_status, COUNT(*) as count
       FROM messages
       WHERE message_type = 'review'
         AND review_status IS NOT NULL
       GROUP BY review_status`
    );

    const needsFollowUp = await pool.query(
      `SELECT COUNT(*) as count
       FROM messages
       WHERE message_type = 'review'
         AND review_status = 'pending'
         AND review_link_clicked_at IS NULL
         AND follow_up_sent_at IS NULL
         AND follow_up_due_at <= CURRENT_TIMESTAMP`
    );

    res.json({
      success: true,
      stats: {
        totalMessages: parseInt(totalMessages.rows[0].count),
        totalCustomers: parseInt(totalCustomers.rows[0].count),
        todayMessages: parseInt(todayMessages.rows[0].count),
        weekMessages: parseInt(weekMessages.rows[0].count),
        messagesByType: messagesByType.rows,
        recentMessages: recentMessages.rows,
        reviewStats: reviewStats.rows,
        needsFollowUp: parseInt(needsFollowUp.rows[0].count)
      }
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};
