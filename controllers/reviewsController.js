import fetch from 'node-fetch';

export const ingestReview = (pool) => async (req, res) => {
  try {
    const n8nSecret = req.headers['x-n8n-secret'];
    const expectedSecret = process.env.N8N_WEBHOOK_SECRET;
    
    if (!expectedSecret) {
      console.error('[REVIEWS] N8N_WEBHOOK_SECRET not configured');
      return res.status(500).json({ success: false, error: 'Webhook secret not configured' });
    }
    
    if (n8nSecret !== expectedSecret) {
      console.log('[REVIEWS] Invalid webhook secret attempt');
      return res.status(401).json({ success: false, error: 'Invalid webhook secret' });
    }
    
    const { 
      review_id, 
      reviewer_name, 
      star_rating, 
      comment, 
      ai_reply_draft, 
      review_date,
      user_email 
    } = req.body;
    
    if (!review_id || !reviewer_name || !star_rating || !user_email) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: review_id, reviewer_name, star_rating, user_email' 
      });
    }
    
    const userResult = await pool.query(
      'SELECT id FROM users WHERE company_email = $1',
      [user_email]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    const userId = userResult.rows[0].id;
    
    const result = await pool.query(
      `INSERT INTO google_reviews 
        (user_id, review_id, reviewer_name, star_rating, comment, ai_reply_draft, review_date, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
       ON CONFLICT (user_id, review_id) 
       DO UPDATE SET 
         reviewer_name = EXCLUDED.reviewer_name,
         star_rating = EXCLUDED.star_rating,
         comment = EXCLUDED.comment,
         ai_reply_draft = COALESCE(EXCLUDED.ai_reply_draft, google_reviews.ai_reply_draft),
         review_date = EXCLUDED.review_date,
         updated_at = CURRENT_TIMESTAMP
       RETURNING id, status`,
      [userId, review_id, reviewer_name, star_rating, comment || '', ai_reply_draft || '', review_date || new Date()]
    );
    
    console.log(`[REVIEWS] Ingested review from ${reviewer_name} (${star_rating} stars) for user ${user_email}`);
    
    res.json({ 
      success: true, 
      message: 'Review ingested successfully',
      review: result.rows[0]
    });
    
  } catch (error) {
    console.error('[REVIEWS] Error ingesting review:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getReviews = (pool) => async (req, res) => {
  try {
    const userEmail = req.session.userEmail;
    if (!userEmail) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }
    
    const userResult = await pool.query('SELECT id FROM users WHERE company_email = $1', [userEmail]);
    if (userResult.rows.length === 0) {
      return res.status(401).json({ success: false, error: 'User not found' });
    }
    const userId = userResult.rows[0].id;
    
    const statusFilter = req.query.status || 'pending';
    
    let query = `
      SELECT id, review_id, reviewer_name, star_rating, comment, ai_reply_draft, 
             status, review_date, posted_reply, posted_at, created_at
      FROM google_reviews 
      WHERE user_id = $1
    `;
    const params = [userId];
    
    if (statusFilter !== 'all') {
      query += ` AND status = $2`;
      params.push(statusFilter);
    }
    
    query += ` ORDER BY review_date DESC LIMIT 100`;
    
    const result = await pool.query(query, params);
    
    res.json({ success: true, reviews: result.rows });
    
  } catch (error) {
    console.error('[REVIEWS] Error fetching reviews:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

export const updateReviewDraft = (pool) => async (req, res) => {
  try {
    const userEmail = req.session.userEmail;
    if (!userEmail) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }
    
    const userResult = await pool.query('SELECT id FROM users WHERE company_email = $1', [userEmail]);
    if (userResult.rows.length === 0) {
      return res.status(401).json({ success: false, error: 'User not found' });
    }
    const userId = userResult.rows[0].id;
    
    const { reviewId, ai_reply_draft } = req.body;
    
    if (!reviewId) {
      return res.status(400).json({ success: false, error: 'Missing reviewId' });
    }
    
    await pool.query(
      `UPDATE google_reviews 
       SET ai_reply_draft = $1, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2 AND user_id = $3`,
      [ai_reply_draft, reviewId, userId]
    );
    
    res.json({ success: true, message: 'Draft updated' });
    
  } catch (error) {
    console.error('[REVIEWS] Error updating draft:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

export const postReply = (pool) => async (req, res) => {
  try {
    const userEmail = req.session.userEmail;
    if (!userEmail) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }
    
    const userResult = await pool.query('SELECT id FROM users WHERE company_email = $1', [userEmail]);
    if (userResult.rows.length === 0) {
      return res.status(401).json({ success: false, error: 'User not found' });
    }
    const userId = userResult.rows[0].id;
    
    const { reviewId, replyText } = req.body;
    
    if (!reviewId || !replyText) {
      return res.status(400).json({ success: false, error: 'Missing reviewId or replyText' });
    }
    
    const reviewResult = await pool.query(
      `SELECT id, review_id, reviewer_name FROM google_reviews WHERE id = $1 AND user_id = $2`,
      [reviewId, userId]
    );
    
    if (reviewResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Review not found' });
    }
    
    const review = reviewResult.rows[0];
    
    const n8nWebhookUrl = process.env.N8N_POST_REPLY_WEBHOOK;
    
    if (n8nWebhookUrl) {
      try {
        const response = await fetch(n8nWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            review_id: review.review_id,
            reviewer_name: review.reviewer_name,
            reply_text: replyText,
            user_email: userEmail
          })
        });
        
        if (!response.ok) {
          console.error('[REVIEWS] n8n webhook failed:', response.status);
        }
      } catch (webhookError) {
        console.error('[REVIEWS] Error calling n8n webhook:', webhookError);
      }
    }
    
    await pool.query(
      `UPDATE google_reviews 
       SET status = 'posted', posted_reply = $1, posted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2 AND user_id = $3`,
      [replyText, reviewId, userId]
    );
    
    console.log(`[REVIEWS] Reply posted for review ${reviewId} by user ${userEmail}`);
    
    res.json({ success: true, message: 'Reply posted successfully' });
    
  } catch (error) {
    console.error('[REVIEWS] Error posting reply:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

export const ignoreReview = (pool) => async (req, res) => {
  try {
    const userEmail = req.session.userEmail;
    if (!userEmail) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }
    
    const userResult = await pool.query('SELECT id FROM users WHERE company_email = $1', [userEmail]);
    if (userResult.rows.length === 0) {
      return res.status(401).json({ success: false, error: 'User not found' });
    }
    const userId = userResult.rows[0].id;
    
    const { reviewId } = req.body;
    
    if (!reviewId) {
      return res.status(400).json({ success: false, error: 'Missing reviewId' });
    }
    
    await pool.query(
      `UPDATE google_reviews 
       SET status = 'ignored', updated_at = CURRENT_TIMESTAMP 
       WHERE id = $1 AND user_id = $2`,
      [reviewId, userId]
    );
    
    console.log(`[REVIEWS] Review ${reviewId} ignored by user ${userEmail}`);
    
    res.json({ success: true, message: 'Review ignored' });
    
  } catch (error) {
    console.error('[REVIEWS] Error ignoring review:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getReviewStats = (pool) => async (req, res) => {
  try {
    const userEmail = req.session.userEmail;
    if (!userEmail) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }
    
    const userResult = await pool.query('SELECT id FROM users WHERE company_email = $1', [userEmail]);
    if (userResult.rows.length === 0) {
      return res.status(401).json({ success: false, error: 'User not found' });
    }
    const userId = userResult.rows[0].id;
    
    const stats = await pool.query(`
      SELECT 
        COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
        COUNT(*) FILTER (WHERE status = 'posted') as posted_count,
        COUNT(*) FILTER (WHERE status = 'ignored') as ignored_count,
        COUNT(*) as total_count,
        ROUND(AVG(star_rating), 1) as avg_rating
      FROM google_reviews 
      WHERE user_id = $1
    `, [userId]);
    
    res.json({ success: true, stats: stats.rows[0] });
    
  } catch (error) {
    console.error('[REVIEWS] Error fetching stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};
