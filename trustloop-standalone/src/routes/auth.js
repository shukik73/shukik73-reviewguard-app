const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const { pool } = require('../config/database');

// Validation rules
const registerValidation = [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('businessName').trim().notEmpty().withMessage('Business name is required'),
];

const loginValidation = [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
];

// GET /auth/login
router.get('/login', (req, res) => {
  if (req.session.userId) {
    return res.redirect('/dashboard');
  }
  res.render('auth/login', { error: null });
});

// POST /auth/login
router.post('/login', loginValidation, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.render('auth/login', { error: 'Invalid email or password' });
  }

  const { email, password } = req.body;

  try {
    const result = await pool.query(
      'SELECT id, email, password_hash, business_name FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.render('auth/login', { error: 'Invalid email or password' });
    }

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      return res.render('auth/login', { error: 'Invalid email or password' });
    }

    req.session.userId = user.id;
    req.session.userEmail = user.email;
    req.session.businessName = user.business_name;

    res.redirect('/dashboard');
  } catch (error) {
    console.error('Login error:', error);
    res.render('auth/login', { error: 'An error occurred. Please try again.' });
  }
});

// GET /auth/register
router.get('/register', (req, res) => {
  if (req.session.userId) {
    return res.redirect('/dashboard');
  }
  res.render('auth/register', { error: null, values: {} });
});

// POST /auth/register
router.post('/register', registerValidation, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.render('auth/register', {
      error: errors.array()[0].msg,
      values: req.body
    });
  }

  const { email, password, businessName, googleReviewLink, supportEmail, supportPhone } = req.body;

  try {
    // Check if email already exists
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.render('auth/register', {
        error: 'An account with this email already exists',
        values: req.body
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create user
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, business_name, google_review_link, support_email, support_phone)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, email, business_name`,
      [email, passwordHash, businessName, googleReviewLink || null, supportEmail || null, supportPhone || null]
    );

    const user = result.rows[0];

    req.session.userId = user.id;
    req.session.userEmail = user.email;
    req.session.businessName = user.business_name;

    res.redirect('/dashboard');
  } catch (error) {
    console.error('Registration error:', error);
    res.render('auth/register', {
      error: 'An error occurred. Please try again.',
      values: req.body
    });
  }
});

// POST /auth/logout
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
    }
    res.redirect('/');
  });
});

// GET /auth/logout (convenience route)
router.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
    }
    res.redirect('/');
  });
});

module.exports = router;
