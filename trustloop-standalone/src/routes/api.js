const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { requireAuth } = require('../middleware/auth');
const crypto = require('crypto');

// Middleware for API authentication
router.use(requireAuth);

// GET /api/customers - List all customers
router.get('/customers', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.id, c.name, c.email, c.phone, c.tracking_token, c.created_at,
              cj.current_state, cj.sentiment, cj.google_link_clicked, cj.resolution_accepted
       FROM customers c
       LEFT JOIN customer_journeys cj ON c.id = cj.customer_id
       WHERE c.user_id = $1
       ORDER BY c.created_at DESC`,
      [req.session.userId]
    );

    res.json({ customers: result.rows });
  } catch (error) {
    console.error('API customers error:', error);
    res.status(500).json({ error: 'Failed to fetch customers' });
  }
});

// POST /api/customers - Create new customer
router.post('/customers', async (req, res) => {
  const { name, email, phone } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Name is required' });
  }

  try {
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

    const experienceLink = `${req.protocol}://${req.get('host')}/experience/${trackingToken}`;

    res.json({
      customer,
      experienceLink
    });
  } catch (error) {
    console.error('API create customer error:', error);
    res.status(500).json({ error: 'Failed to create customer' });
  }
});

// GET /api/customers/:id - Get customer details
router.get('/customers/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `SELECT c.*, cj.*
       FROM customers c
       LEFT JOIN customer_journeys cj ON c.id = cj.customer_id
       WHERE c.id = $1 AND c.user_id = $2`,
      [id, req.session.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    res.json({ customer: result.rows[0] });
  } catch (error) {
    console.error('API get customer error:', error);
    res.status(500).json({ error: 'Failed to fetch customer' });
  }
});

// DELETE /api/customers/:id - Delete customer
router.delete('/customers/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      'DELETE FROM customers WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, req.session.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('API delete customer error:', error);
    res.status(500).json({ error: 'Failed to delete customer' });
  }
});

// GET /api/analytics - Get analytics data
router.get('/analytics', async (req, res) => {
  try {
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

    res.json({ analytics });
  } catch (error) {
    console.error('API analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// POST /api/bulk-invite - Create multiple customers and generate links
router.post('/bulk-invite', async (req, res) => {
  const { customers } = req.body;

  if (!Array.isArray(customers) || customers.length === 0) {
    return res.status(400).json({ error: 'Customers array is required' });
  }

  if (customers.length > 100) {
    return res.status(400).json({ error: 'Maximum 100 customers per request' });
  }

  const results = [];

  try {
    for (const customer of customers) {
      if (!customer.name) continue;

      const trackingToken = crypto.randomBytes(32).toString('hex');

      const result = await pool.query(
        `INSERT INTO customers (user_id, name, email, phone, tracking_token)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [req.session.userId, customer.name, customer.email || null, customer.phone || null, trackingToken]
      );

      await pool.query(
        `INSERT INTO customer_journeys (customer_id, current_state, google_link_shown)
         VALUES ($1, 'INVITED', TRUE)`,
        [result.rows[0].id]
      );

      results.push({
        ...result.rows[0],
        experienceLink: `${req.protocol}://${req.get('host')}/experience/${trackingToken}`
      });
    }

    res.json({ customers: results, count: results.length });
  } catch (error) {
    console.error('API bulk invite error:', error);
    res.status(500).json({ error: 'Failed to create customers' });
  }
});

module.exports = router;
