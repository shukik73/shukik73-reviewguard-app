const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');

// GET /experience/:token - Customer experience widget
// FTC COMPLIANT: Google link is ALWAYS visible
router.get('/:token', async (req, res) => {
  const { token } = req.params;

  try {
    // Fetch customer and business data
    const result = await pool.query(
      `SELECT c.*, u.business_name, u.google_review_link, u.support_email, u.support_phone,
              cj.current_state, cj.sentiment
       FROM customers c
       JOIN users u ON c.user_id = u.id
       LEFT JOIN customer_journeys cj ON c.id = cj.customer_id
       WHERE c.tracking_token = $1`,
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(404).render('error', {
        title: 'Link Expired',
        message: 'This feedback link has expired or is invalid.'
      });
    }

    const data = result.rows[0];

    // Render the experience widget
    res.render('experience/widget', {
      token,
      businessName: data.business_name || 'Our Business',
      googleReviewUrl: data.google_review_link || '#',
      supportEmail: data.support_email,
      supportPhone: data.support_phone,
      currentState: data.current_state,
      sentiment: data.sentiment
    });

  } catch (error) {
    console.error('Experience widget error:', error);
    res.status(500).render('error', {
      title: 'Error',
      message: 'Something went wrong. Please try again.'
    });
  }
});

// POST /experience/:token/sentiment - Record customer sentiment
router.post('/:token/sentiment', async (req, res) => {
  const { token } = req.params;
  const { sentiment } = req.body; // 'positive' or 'negative'

  if (!sentiment || !['positive', 'negative'].includes(sentiment)) {
    return res.status(400).json({ error: 'Invalid sentiment' });
  }

  try {
    // Get customer and journey
    const customerResult = await pool.query(
      `SELECT c.id, cj.id as journey_id
       FROM customers c
       JOIN customer_journeys cj ON c.id = cj.customer_id
       WHERE c.tracking_token = $1`,
      [token]
    );

    if (customerResult.rows.length === 0) {
      return res.status(404).json({ error: 'Invalid token' });
    }

    const { journey_id } = customerResult.rows[0];

    // Update journey with sentiment
    // FTC COMPLIANCE: google_link_shown stays TRUE
    const newState = sentiment === 'positive' ? 'SENTIMENT_POSITIVE' : 'SENTIMENT_NEGATIVE';

    await pool.query(
      `UPDATE customer_journeys
       SET sentiment = $1, current_state = $2, sentiment_recorded_at = NOW(), google_link_shown = TRUE
       WHERE id = $3`,
      [sentiment, newState, journey_id]
    );

    res.json({
      success: true,
      sentiment,
      nextStep: sentiment === 'positive' ? 'review' : 'resolution'
    });

  } catch (error) {
    console.error('Sentiment error:', error);
    res.status(500).json({ error: 'Failed to record sentiment' });
  }
});

// POST /experience/:token/google-click - Track Google review link click
router.post('/:token/google-click', async (req, res) => {
  const { token } = req.params;

  try {
    const result = await pool.query(
      `UPDATE customer_journeys cj
       SET google_link_clicked = TRUE,
           google_link_click_count = google_link_click_count + 1,
           current_state = CASE
             WHEN sentiment = 'positive' THEN 'COMPLETED'
             ELSE current_state
           END,
           completed_at = CASE
             WHEN sentiment = 'positive' THEN NOW()
             ELSE completed_at
           END
       FROM customers c
       WHERE c.id = cj.customer_id AND c.tracking_token = $1
       RETURNING cj.*`,
      [token]
    );

    res.json({ success: true });

  } catch (error) {
    console.error('Google click tracking error:', error);
    res.status(500).json({ error: 'Failed to track click' });
  }
});

// POST /experience/:token/resolution - Customer accepts resolution offer
router.post('/:token/resolution', async (req, res) => {
  const { token } = req.params;
  const { accepted, notes } = req.body;

  try {
    const newState = accepted ? 'RESOLUTION_ACCEPTED' : 'COMPLETED';

    await pool.query(
      `UPDATE customer_journeys cj
       SET resolution_offered = TRUE,
           resolution_accepted = $1,
           resolution_notes = $2,
           resolution_offered_at = NOW(),
           current_state = $3,
           completed_at = CASE WHEN $3 = 'COMPLETED' THEN NOW() ELSE completed_at END
       FROM customers c
       WHERE c.id = cj.customer_id AND c.tracking_token = $4`,
      [accepted, notes || null, newState, token]
    );

    res.json({ success: true, accepted });

  } catch (error) {
    console.error('Resolution error:', error);
    res.status(500).json({ error: 'Failed to process resolution' });
  }
});

module.exports = router;
