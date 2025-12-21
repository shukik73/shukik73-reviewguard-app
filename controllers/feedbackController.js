import { sendEmail } from '../lib/resend.js';

export const submitInternalFeedback = (pool) => async (req, res) => {
  try {
    console.log('[INTERNAL FEEDBACK] Received Payload:', req.body);
    
    const { feedbackToken, rating, feedbackText } = req.body;

    console.log(`[INTERNAL FEEDBACK] Received Token: ${feedbackToken}, Rating: ${rating}, Feedback: ${feedbackText}`);

    if (!feedbackToken || !rating) {
      return res.status(400).json({ 
        success: false, 
        error: 'Feedback token and rating are required' 
      });
    }

    // Validate rating is 1-3 (low ratings only for internal feedback)
    const ratingNum = parseInt(rating);
    if (ratingNum < 1 || ratingNum > 3) {
      return res.status(400).json({ 
        success: false, 
        error: 'Internal feedback is only for ratings 1-3. Use public review endpoint for higher ratings.' 
      });
    }

    // First try to find by tracking_token in customers table (new flow)
    const customerResult = await pool.query(
      `SELECT c.id, c.name, c.phone, c.user_id, u.company_email as user_email
       FROM customers c
       LEFT JOIN users u ON c.user_id = u.id
       WHERE c.tracking_token = $1`,
      [feedbackToken]
    );

    if (customerResult.rows.length > 0) {
      const customer = customerResult.rows[0];
      console.log(`[INTERNAL FEEDBACK] Found customer by tracking_token: ${customer.name}`);
      
      if (!customer.user_id) {
        return res.status(500).json({ 
          success: false, 
          error: 'Unable to process feedback due to data integrity issue.' 
        });
      }

      // Save internal feedback with customer data
      await pool.query(
        `INSERT INTO internal_feedback 
         (customer_name, customer_phone, rating, feedback_text, user_email, user_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [customer.name, customer.phone, ratingNum, feedbackText || '', customer.user_email, customer.user_id]
      );

      console.log(`[INTERNAL FEEDBACK] ✅ Saved feedback for customer ${customer.name}`);
      return res.json({ 
        success: true, 
        message: 'Thank you for your feedback. We\'ll use this to improve!' 
      });
    }

    // Fallback: Get the message details (including user_id) from legacy token
    const messageResult = await pool.query(
      `SELECT id, customer_name, customer_phone, user_email, user_id 
       FROM messages 
       WHERE feedback_token = $1`,
      [feedbackToken]
    );

    console.log(`[INTERNAL FEEDBACK] Token lookup result: ${messageResult.rows.length} rows found`);

    if (messageResult.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Invalid feedback token' 
      });
    }

    const message = messageResult.rows[0];

    console.log(`[INTERNAL FEEDBACK] 🔍 Message Data Retrieved:`, {
      messageId: message.id,
      userId: message.user_id,
      customerName: message.customer_name,
      userEmail: message.user_email
    });

    // CRITICAL: Guard against NULL user_id to prevent orphaned feedback
    if (!message.user_id) {
      console.error(`[INTERNAL FEEDBACK] ❌ CRITICAL: Message ${message.id} has NULL user_id. Cannot save feedback.`);
      console.error(`[INTERNAL FEEDBACK] This indicates the original message was created without user_id - data integrity issue!`);
      return res.status(500).json({ 
        success: false, 
        error: 'Unable to process feedback due to data integrity issue. Please contact support.' 
      });
    }

    console.log(`[INTERNAL FEEDBACK] ✓ Linking Feedback to User ID: ${message.user_id}`);

    // Save internal feedback with user_id
    const insertResult = await pool.query(
      `INSERT INTO internal_feedback 
       (message_id, customer_name, customer_phone, rating, feedback_text, user_email, user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, user_id`,
      [
        message.id,
        message.customer_name,
        message.customer_phone,
        ratingNum,
        feedbackText || null,
        message.user_email,
        message.user_id
      ]
    );

    console.log(`[INTERNAL FEEDBACK] ✅ Feedback saved successfully:`, {
      feedbackId: insertResult.rows[0].id,
      linkedToUserId: insertResult.rows[0].user_id,
      rating: ratingNum
    });

    // Update message feedback info
    await pool.query(
      `UPDATE messages 
       SET feedback_rating = $1, feedback_collected_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [ratingNum, message.id]
    );

    // Send email to business owner
    if (message.user_email) {
      const emailSubject = `⚠️ Low Rating Alert: ${ratingNum} stars from ${message.customer_name}`;
      const emailBody = `
        <h2>Internal Feedback Received</h2>
        <p><strong>Customer:</strong> ${message.customer_name}</p>
        <p><strong>Phone:</strong> ${message.customer_phone}</p>
        <p><strong>Rating:</strong> ${ratingNum} out of 5 stars</p>
        ${feedbackText ? `<p><strong>Feedback:</strong></p><p>${feedbackText}</p>` : ''}
        <p><em>This customer was routed to internal feedback instead of posting a public review.</em></p>
      `;

      await sendEmail(message.user_email, emailSubject, emailBody).catch(err => 
        console.error('Failed to send low rating alert email:', err)
      );
    }

    res.json({ 
      success: true, 
      message: 'Thank you for your feedback. We\'ll use this to improve!' 
    });

  } catch (error) {
    console.error('Error submitting internal feedback:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
};

export const submitPublicReview = (pool) => async (req, res) => {
  try {
    const { feedbackToken, rating } = req.body;

    console.log(`[DEBUG] submitPublicReview - Token received: ${feedbackToken}`);

    if (!feedbackToken || !rating) {
      return res.status(400).json({ 
        success: false, 
        error: 'Feedback token and rating are required' 
      });
    }

    const ratingNum = parseInt(rating);
    
    if (ratingNum < 4 || ratingNum > 5) {
      return res.status(400).json({ 
        success: false, 
        error: 'Public reviews are only for ratings 4-5. Use internal feedback endpoint for lower ratings.' 
      });
    }

    // First try to find by tracking_token in customers table (new flow)
    let customerResult = await pool.query(
      `SELECT c.id, c.name, c.user_id, s.google_review_link 
       FROM customers c
       LEFT JOIN users u ON c.user_id = u.id
       LEFT JOIN subscriptions s ON u.company_email = s.email
       WHERE c.tracking_token = $1`,
      [feedbackToken]
    );

    if (customerResult.rows.length > 0) {
      // New tracking token flow - just log and return success (redirect already happened)
      console.log(`[PUBLIC REVIEW] Customer ${customerResult.rows[0].name} rated ${ratingNum} stars`);
      return res.json({ 
        success: true, 
        message: 'Rating recorded',
        reviewLink: customerResult.rows[0].google_review_link
      });
    }

    // Fallback: try legacy feedback_token in messages table
    const result = await pool.query(
      `SELECT m.id, m.user_email, s.google_review_link 
       FROM messages m
       LEFT JOIN subscriptions s ON s.email = m.user_email
       WHERE m.feedback_token = $1`,
      [feedbackToken]
    );

    if (result.rows.length === 0) {
      console.log(`[DEBUG] Token not found in customers or messages table: ${feedbackToken}`);
      return res.status(404).json({ 
        success: false, 
        error: 'Invalid feedback token' 
      });
    }

    const { id: messageId, google_review_link } = result.rows[0];

    // Update message feedback info
    await pool.query(
      `UPDATE messages 
       SET feedback_rating = $1, feedback_collected_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [ratingNum, messageId]
    );

    res.json({ 
      success: true, 
      reviewLink: google_review_link
    });

  } catch (error) {
    console.error('Error submitting public review:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
};

export const getFeedback = (pool) => async (req, res) => {
  try {
    const userId = req.user?.id;
    const userEmail = req.user?.email;

    if (!userId) {
      console.log(`[GET FEEDBACK] ❌ Authentication failed - no userId found`);
      console.log(`[GET FEEDBACK DEBUG] req.user:`, req.user);
      console.log(`[GET FEEDBACK DEBUG] req.session:`, req.session);
      return res.status(401).json({ 
        success: false, 
        error: 'Not authenticated' 
      });
    }

    console.log(`[GET FEEDBACK] ✓ Authenticated - Fetching feedback for user_id: ${userId}`);

    // Get all feedback for this user (strict tenant filtering - SECURITY MAINTAINED)
    // Exclude 'ignored' feedback (blocked/spam) - keep read items visible with status
    const result = await pool.query(
      `SELECT id, message_id, customer_name, customer_phone, rating, feedback_text, created_at, status, sms_sent_at, called_at, is_read, feedback_status, assigned_to, resolved_at
       FROM internal_feedback
       WHERE user_id = $1 AND (status IS NULL OR status != 'ignored')
       ORDER BY created_at DESC`,
      [userId]
    );

    // DIAGNOSTIC LOGGING - Safe orphan detection without exposing data
    const totalCount = await pool.query('SELECT COUNT(*) as count FROM internal_feedback');
    const orphanCount = await pool.query('SELECT COUNT(*) as count FROM internal_feedback WHERE user_id IS NULL');
    
    console.log(`[GET FEEDBACK] 📊 DIAGNOSTIC SUMMARY:`);
    console.log(`  - Requesting User ID: ${userId}`);
    console.log(`  - Feedback for this user: ${result.rows.length}`);
    console.log(`  - Total feedback in DB: ${totalCount.rows[0].count}`);
    console.log(`  - Orphaned feedback (NULL user_id): ${orphanCount.rows[0].count}`);
    
    if (result.rows.length === 0 && totalCount.rows[0].count > 0) {
      console.log(`[GET FEEDBACK] ⚠️  User has NO feedback but ${totalCount.rows[0].count} records exist in DB`);
      if (parseInt(orphanCount.rows[0].count) > 0) {
        console.log(`[GET FEEDBACK] 🔍 FOUND ORPHANED DATA: ${orphanCount.rows[0].count} feedback records have NULL user_id`);
      }
    }

    res.json({ 
      success: true, 
      feedback: result.rows 
    });

  } catch (error) {
    console.error('Error fetching feedback:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
};

export const trackLinkClick = (pool) => async (req, res) => {
  try {
    const { token } = req.body;

    console.log(`[TRACK LINK CLICK] Received token: ${token}`);

    if (!token) {
      return res.status(400).json({ 
        success: false, 
        error: 'Token is required' 
      });
    }

    // Update the message to mark link as clicked
    const result = await pool.query(
      `UPDATE messages 
       SET review_status = 'link_clicked', 
           review_link_clicked_at = CURRENT_TIMESTAMP
       WHERE feedback_token = $1
       RETURNING id, customer_name, review_status`,
      [token]
    );

    if (result.rows.length === 0) {
      console.log(`[TRACK LINK CLICK] No message found for token: ${token}`);
      return res.status(404).json({ 
        success: false, 
        error: 'Invalid token' 
      });
    }

    const message = result.rows[0];
    console.log(`[TRACK LINK CLICK] ✅ Marked message ${message.id} as clicked for ${message.customer_name}`);

    res.json({ 
      success: true,
      message: 'Link click tracked successfully'
    });

  } catch (error) {
    console.error('Error tracking link click:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
};

export const markFeedbackAsRead = (pool) => async (req, res) => {
  try {
    const { feedbackId } = req.body;
    const userId = req.user?.id;

    if (!userId || !feedbackId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Feedback ID and authentication required' 
      });
    }

    console.log(`[MARK FEEDBACK READ] User ${userId} marking feedback ${feedbackId} as read`);

    // Update only if feedback belongs to this user (multi-tenant security)
    const result = await pool.query(
      `UPDATE internal_feedback
       SET status = 'read'
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [feedbackId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Feedback not found or access denied' 
      });
    }

    console.log(`[MARK FEEDBACK READ] Successfully marked feedback ${feedbackId} as read`);

    res.json({ 
      success: true, 
      message: 'Feedback marked as read' 
    });

  } catch (error) {
    console.error('Error marking feedback as read:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
};

export const blockFeedback = (pool) => async (req, res) => {
  try {
    const { feedbackId } = req.body;
    const userId = req.user?.id;

    if (!userId || !feedbackId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Feedback ID and authentication required' 
      });
    }

    console.log(`[BLOCK FEEDBACK] User ${userId} blocking feedback ${feedbackId}`);

    const result = await pool.query(
      `UPDATE internal_feedback
       SET status = 'ignored'
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [feedbackId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Feedback not found or access denied' 
      });
    }

    console.log(`[BLOCK FEEDBACK] Successfully marked feedback ${feedbackId} as ignored`);

    res.json({ 
      success: true, 
      message: 'Feedback marked as ignored' 
    });

  } catch (error) {
    console.error('Error blocking feedback:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
};

export const markSmsSent = (pool) => async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId || !id) {
      return res.status(400).json({ 
        success: false, 
        error: 'Feedback ID and authentication required' 
      });
    }

    console.log(`[MARK SMS SENT] User ${userId} marking feedback ${id} as SMS sent`);

    const result = await pool.query(
      `UPDATE internal_feedback
       SET sms_sent_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND user_id = $2
       RETURNING id, sms_sent_at`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Feedback not found or access denied' 
      });
    }

    console.log(`[MARK SMS SENT] Successfully marked feedback ${id} as SMS sent at ${result.rows[0].sms_sent_at}`);

    res.json({ 
      success: true, 
      message: 'SMS sent status recorded',
      sms_sent_at: result.rows[0].sms_sent_at
    });

  } catch (error) {
    console.error('Error marking SMS sent:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
};

export const markCalled = (pool) => async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId || !id) {
      return res.status(400).json({ 
        success: false, 
        error: 'Feedback ID and authentication required' 
      });
    }

    console.log(`[MARK CALLED] User ${userId} marking feedback ${id} as called`);

    const result = await pool.query(
      `UPDATE internal_feedback
       SET called_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND user_id = $2
       RETURNING id, called_at`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Feedback not found or access denied' 
      });
    }

    console.log(`[MARK CALLED] Successfully marked feedback ${id} as called at ${result.rows[0].called_at}`);

    res.json({ 
      success: true, 
      message: 'Call status recorded',
      called_at: result.rows[0].called_at
    });

  } catch (error) {
    console.error('Error marking called:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
};

export const markAsRead = (pool) => async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId || !id) {
      return res.status(400).json({ 
        success: false, 
        error: 'Feedback ID and authentication required' 
      });
    }

    console.log(`[MARK AS READ] User ${userId} marking feedback ${id} as read`);

    const result = await pool.query(
      `UPDATE internal_feedback
       SET is_read = TRUE, status = 'read'
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Feedback not found or access denied' 
      });
    }

    console.log(`[MARK AS READ] Successfully marked feedback ${id} as read`);

    res.json({ 
      success: true, 
      message: 'Feedback marked as read'
    });

  } catch (error) {
    console.error('Error marking as read:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
};

export const getCustomerInfoByToken = (pool) => async (req, res) => {
  try {
    const { token } = req.params;
    
    if (!token) {
      return res.status(400).json({ success: false, error: 'Token is required' });
    }
    
    const result = await pool.query(
      `SELECT c.id, c.name, c.phone, s.google_review_link, us.business_name
       FROM customers c
       LEFT JOIN users u ON c.user_id = u.id
       LEFT JOIN subscriptions s ON u.company_email = s.email
       LEFT JOIN user_settings us ON u.company_email = us.user_email
       WHERE c.tracking_token = $1`,
      [token]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Invalid or expired link' });
    }
    
    const customer = result.rows[0];
    
    res.json({
      success: true,
      customerName: customer.name,
      businessName: customer.business_name || 'Our Store',
      googleReviewLink: customer.google_review_link
    });
  } catch (error) {
    console.error('Error getting customer info by token:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

export const updateFeedbackStatus = (pool) => async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    
    const validStatuses = ['new', 'in_progress', 'resolved'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status' });
    }
    
    const result = await pool.query(
      `UPDATE internal_feedback 
       SET feedback_status = $1, is_read = $2
       WHERE id = $3 AND user_id = $4
       RETURNING id`,
      [status, status === 'resolved', id, userId]
    );
    
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Feedback not found' });
    }
    
    res.json({ success: true, status });
  } catch (error) {
    console.error('Error updating feedback status:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

export const assignFeedback = (pool) => async (req, res) => {
  try {
    const { id } = req.params;
    const { assignedTo } = req.body;
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    
    const result = await pool.query(
      `UPDATE internal_feedback 
       SET assigned_to = $1, feedback_status = CASE WHEN feedback_status IS NULL OR feedback_status = 'new' THEN 'in_progress' ELSE feedback_status END
       WHERE id = $2 AND user_id = $3
       RETURNING id, feedback_status`,
      [assignedTo, id, userId]
    );
    
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Feedback not found' });
    }
    
    res.json({ success: true, assignedTo, status: result.rows[0].feedback_status });
  } catch (error) {
    console.error('Error assigning feedback:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

export const getGroupedFeedback = (pool) => async (req, res) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    
    const result = await pool.query(
      `SELECT id, message_id, customer_name, customer_phone, rating, feedback_text, created_at, status, sms_sent_at, called_at, is_read, feedback_status, assigned_to, resolved_at
       FROM internal_feedback
       WHERE user_id = $1 AND (status IS NULL OR status != 'ignored')
       ORDER BY created_at DESC`,
      [userId]
    );
    
    // Group by customer phone
    const grouped = {};
    for (const fb of result.rows) {
      const phone = fb.customer_phone;
      if (!grouped[phone]) {
        grouped[phone] = {
          customer_name: fb.customer_name,
          customer_phone: phone,
          feedback: [],
          total_count: 0,
          avg_rating: 0,
          unread_count: 0,
          latest_feedback: null
        };
      }
      grouped[phone].feedback.push(fb);
      grouped[phone].total_count++;
      if (!fb.is_read && fb.feedback_status !== 'resolved') {
        grouped[phone].unread_count++;
      }
    }
    
    // Calculate averages and set latest
    for (const phone in grouped) {
      const customer = grouped[phone];
      customer.avg_rating = (customer.feedback.reduce((sum, f) => sum + f.rating, 0) / customer.total_count).toFixed(1);
      customer.latest_feedback = customer.feedback[0];
    }
    
    res.json({ 
      success: true, 
      grouped: Object.values(grouped)
    });
  } catch (error) {
    console.error('Error fetching grouped feedback:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};
