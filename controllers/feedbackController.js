import { sendEmail } from '../lib/resend.js';

export const submitInternalFeedback = (pool) => async (req, res) => {
  try {
    const { feedbackToken, rating, feedbackText } = req.body;

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

    // Get the message details
    const messageResult = await pool.query(
      `SELECT id, customer_name, customer_phone, user_email 
       FROM messages 
       WHERE feedback_token = $1`,
      [feedbackToken]
    );

    if (messageResult.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Invalid feedback token' 
      });
    }

    const message = messageResult.rows[0];

    // Save internal feedback
    await pool.query(
      `INSERT INTO internal_feedback 
       (message_id, customer_name, customer_phone, rating, feedback_text, user_email)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        message.id,
        message.customer_name,
        message.customer_phone,
        ratingNum,
        feedbackText || null,
        message.user_email
      ]
    );

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

    // Get the message and user's Google review link
    const result = await pool.query(
      `SELECT m.id, m.user_email, s.google_review_link 
       FROM messages m
       LEFT JOIN subscriptions s ON s.email = m.user_email
       WHERE m.feedback_token = $1`,
      [feedbackToken]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Invalid feedback token' 
      });
    }

    const { id: messageId, google_review_link } = result.rows[0];
    const reviewLink = google_review_link || 'https://g.page/r/CXmh-C0UxHgqEBM/review';

    // Update message feedback info
    await pool.query(
      `UPDATE messages 
       SET feedback_rating = $1, feedback_collected_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [ratingNum, messageId]
    );

    // Return the Google review link
    res.json({ 
      success: true, 
      reviewLink: reviewLink
    });

  } catch (error) {
    console.error('Error submitting public review:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
};
