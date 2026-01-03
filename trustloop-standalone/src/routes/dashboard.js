const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { requireAuth } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

// Apply auth middleware to all dashboard routes
router.use(requireAuth);

// GET /dashboard - Main dashboard
router.get('/', async (req, res) => {
  try {
    // Get user settings
    const userResult = await pool.query(
      'SELECT * FROM users WHERE id = $1',
      [req.session.userId]
    );
    const user = userResult.rows[0];

    // Get analytics
    const analyticsResult = await pool.query(
      'SELECT * FROM journey_analytics WHERE user_id = $1',
      [req.session.userId]
    );
    const analytics = analyticsResult.rows[0] || {
      total_journeys: 0,
      positive_count: 0,
      negative_count: 0,
      google_clicks: 0,
      resolutions_accepted: 0
    };

    // Get recent customers
    const customersResult = await pool.query(
      `SELECT c.*, cj.current_state, cj.sentiment
       FROM customers c
       LEFT JOIN customer_journeys cj ON c.id = cj.customer_id
       WHERE c.user_id = $1
       ORDER BY c.created_at DESC
       LIMIT 10`,
      [req.session.userId]
    );

    res.render('dashboard/index', {
      user,
      analytics,
      customers: customersResult.rows
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).render('error', {
      title: 'Error',
      message: 'Failed to load dashboard'
    });
  }
});

// GET /dashboard/customers - Customer list
router.get('/customers', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.*, cj.current_state, cj.sentiment, cj.google_link_clicked
       FROM customers c
       LEFT JOIN customer_journeys cj ON c.id = cj.customer_id
       WHERE c.user_id = $1
       ORDER BY c.created_at DESC`,
      [req.session.userId]
    );

    res.render('dashboard/customers', {
      customers: result.rows
    });
  } catch (error) {
    console.error('Customers error:', error);
    res.status(500).render('error', {
      title: 'Error',
      message: 'Failed to load customers'
    });
  }
});

// POST /dashboard/customers - Add new customer
router.post('/customers', async (req, res) => {
  const { name, email, phone } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Name is required' });
  }

  try {
    // Generate unique tracking token
    const trackingToken = crypto.randomBytes(32).toString('hex');

    const result = await pool.query(
      `INSERT INTO customers (user_id, name, email, phone, tracking_token)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [req.session.userId, name, email || null, phone || null, trackingToken]
    );

    const customer = result.rows[0];

    // Create initial journey
    await pool.query(
      `INSERT INTO customer_journeys (customer_id, current_state, google_link_shown)
       VALUES ($1, 'INVITED', TRUE)`,
      [customer.id]
    );

    // Generate experience link
    const experienceLink = `${req.protocol}://${req.get('host')}/experience/${trackingToken}`;

    res.json({
      success: true,
      customer,
      experienceLink
    });
  } catch (error) {
    console.error('Add customer error:', error);
    res.status(500).json({ error: 'Failed to add customer' });
  }
});

// GET /dashboard/settings - User settings
router.get('/settings', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM users WHERE id = $1',
      [req.session.userId]
    );

    res.render('dashboard/settings', {
      user: result.rows[0],
      success: req.query.success === '1'
    });
  } catch (error) {
    console.error('Settings error:', error);
    res.status(500).render('error', {
      title: 'Error',
      message: 'Failed to load settings'
    });
  }
});

// POST /dashboard/settings - Update settings
router.post('/settings', async (req, res) => {
  const { businessName, googleReviewLink, supportEmail, supportPhone } = req.body;

  try {
    await pool.query(
      `UPDATE users
       SET business_name = $1, google_review_link = $2, support_email = $3, support_phone = $4, updated_at = NOW()
       WHERE id = $5`,
      [businessName, googleReviewLink || null, supportEmail || null, supportPhone || null, req.session.userId]
    );

    req.session.businessName = businessName;
    res.redirect('/dashboard/settings?success=1');
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).render('error', {
      title: 'Error',
      message: 'Failed to update settings'
    });
  }
});

// GET /dashboard/analytics - Detailed analytics
router.get('/analytics', async (req, res) => {
  try {
    // Get journey stats by state
    const statesResult = await pool.query(
      `SELECT cj.current_state, COUNT(*) as count
       FROM customer_journeys cj
       JOIN customers c ON cj.customer_id = c.id
       WHERE c.user_id = $1
       GROUP BY cj.current_state`,
      [req.session.userId]
    );

    // Get daily journey counts (last 30 days)
    const dailyResult = await pool.query(
      `SELECT DATE(cj.invited_at) as date, COUNT(*) as count
       FROM customer_journeys cj
       JOIN customers c ON cj.customer_id = c.id
       WHERE c.user_id = $1 AND cj.invited_at > NOW() - INTERVAL '30 days'
       GROUP BY DATE(cj.invited_at)
       ORDER BY date`,
      [req.session.userId]
    );

    res.render('dashboard/analytics', {
      stateStats: statesResult.rows,
      dailyStats: dailyResult.rows
    });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).render('error', {
      title: 'Error',
      message: 'Failed to load analytics'
    });
  }
});

module.exports = router;
