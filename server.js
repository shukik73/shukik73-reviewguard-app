import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import twilio from 'twilio';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import pg from 'pg';
import crypto from 'crypto';
import Stripe from 'stripe';
import bcrypt from 'bcrypt';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import sharp from 'sharp';
import axios from 'axios';
import { sendWelcomeEmail, sendQuotaWarningEmail, sendPaymentFailedEmail, sendPasswordResetEmail } from './lib/resend.js';

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

async function initializeDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      company_name VARCHAR(255) NOT NULL,
      first_name VARCHAR(255) NOT NULL,
      last_name VARCHAR(255) NOT NULL,
      company_email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      billing_address_street VARCHAR(500),
      billing_address_city VARCHAR(100),
      billing_address_state VARCHAR(100),
      billing_address_zip VARCHAR(20),
      billing_address_country VARCHAR(100) DEFAULT 'USA',
      email_verified BOOLEAN DEFAULT FALSE,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS customers (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      phone VARCHAR(50) NOT NULL UNIQUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      customer_id INTEGER REFERENCES customers(id),
      customer_name VARCHAR(255) NOT NULL,
      customer_phone VARCHAR(50) NOT NULL,
      message_type VARCHAR(20) NOT NULL,
      review_link TEXT,
      additional_info TEXT,
      photo_path TEXT,
      sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      status VARCHAR(20) DEFAULT 'sent',
      twilio_sid VARCHAR(100)
    );

    CREATE TABLE IF NOT EXISTS auth_tokens (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      token VARCHAR(255) UNIQUE NOT NULL,
      token_type VARCHAR(50) NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      used BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_users_email ON users(company_email);
    CREATE INDEX IF NOT EXISTS idx_auth_tokens_token ON auth_tokens(token);
    CREATE INDEX IF NOT EXISTS idx_auth_tokens_user ON auth_tokens(user_id);
    CREATE INDEX IF NOT EXISTS idx_messages_sent_at ON messages(sent_at DESC);
    CREATE INDEX IF NOT EXISTS idx_messages_customer_id ON messages(customer_id);
    CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS subscriptions (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      stripe_customer_id VARCHAR(255) UNIQUE,
      stripe_subscription_id VARCHAR(255) UNIQUE,
      subscription_status VARCHAR(50) DEFAULT 'trial',
      plan VARCHAR(50) DEFAULT 'free',
      sms_quota INTEGER DEFAULT 50,
      sms_sent INTEGER DEFAULT 0,
      google_review_link TEXT DEFAULT 'https://g.page/r/CXmh-C0UxHgqEBM/review',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS event_logs (
      id SERIAL PRIMARY KEY,
      event_type VARCHAR(100) NOT NULL,
      event_data JSONB,
      email VARCHAR(255),
      status VARCHAR(50),
      error_message TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS user_sessions (
      sid VARCHAR PRIMARY KEY,
      sess JSON NOT NULL,
      expire TIMESTAMP NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_event_logs_email ON event_logs(email);
    CREATE INDEX IF NOT EXISTS idx_event_logs_type ON event_logs(event_type);
    CREATE INDEX IF NOT EXISTS idx_event_logs_created ON event_logs(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_user_sessions_expire ON user_sessions(expire);
  `);

  await pool.query(`
    DO $$ 
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='messages' AND column_name='review_status') THEN
        ALTER TABLE messages ADD COLUMN review_status VARCHAR(20) DEFAULT 'pending' CHECK (review_status IN ('pending', 'link_clicked', 'reviewed', 'follow_up_sent'));
      END IF;
      
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='messages' AND column_name='review_link_token') THEN
        ALTER TABLE messages ADD COLUMN review_link_token TEXT UNIQUE;
      END IF;
      
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='messages' AND column_name='review_link_clicked_at') THEN
        ALTER TABLE messages ADD COLUMN review_link_clicked_at TIMESTAMP;
      END IF;
      
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='messages' AND column_name='review_received_at') THEN
        ALTER TABLE messages ADD COLUMN review_received_at TIMESTAMP;
      END IF;
      
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='messages' AND column_name='follow_up_due_at') THEN
        ALTER TABLE messages ADD COLUMN follow_up_due_at TIMESTAMP;
      END IF;
      
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='messages' AND column_name='follow_up_sent_at') THEN
        ALTER TABLE messages ADD COLUMN follow_up_sent_at TIMESTAMP;
      END IF;
      
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='messages' AND column_name='follow_up_message_id') THEN
        ALTER TABLE messages ADD COLUMN follow_up_message_id INTEGER REFERENCES messages(id) ON DELETE SET NULL;
      END IF;
      
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='messages' AND column_name='feedback_rating') THEN
        ALTER TABLE messages ADD COLUMN feedback_rating SMALLINT CHECK (feedback_rating >= 1 AND feedback_rating <= 5);
      END IF;
      
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='messages' AND column_name='feedback_collected_at') THEN
        ALTER TABLE messages ADD COLUMN feedback_collected_at TIMESTAMP;
      END IF;
      
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='subscriptions' AND column_name='user_id') THEN
        ALTER TABLE subscriptions ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
      END IF;
      
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='messages' AND column_name='user_id') THEN
        ALTER TABLE messages ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
      END IF;
      
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='subscriptions' AND column_name='google_review_link') THEN
        ALTER TABLE subscriptions ADD COLUMN google_review_link TEXT DEFAULT 'https://g.page/r/CXmh-C0UxHgqEBM/review';
      END IF;
    END $$;
  `);
  
  console.log('✅ Database tables initialized');
}

const app = express();
const PORT = 5000;

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadsDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|gif|pdf/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only images (JPEG, PNG, GIF) and PDFs are allowed'));
    }
  }
});

const ocrUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    // Accept if either extension OR mimetype matches (more lenient for camera uploads)
    if (mimetype || extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files (JPEG, PNG, GIF) are allowed for OCR'));
    }
  }
});

app.use(cors({
  origin: true,
  credentials: true
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const PgSession = connectPgSimple(session);
app.use(session({
  store: new PgSession({
    pool: pool,
    tableName: 'user_sessions'
  }),
  secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'strict',
    maxAge: 30 * 24 * 60 * 60 * 1000
  }
}));

app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ 
      success: false, 
      error: 'Authentication required',
      code: 'AUTH_REQUIRED'
    });
  }
  next();
}

app.post('/api/auth/signup', async (req, res) => {
  try {
    const {
      companyName,
      firstName,
      lastName,
      email,
      password,
      billingStreet,
      billingCity,
      billingState,
      billingZip,
      billingCountry,
      subscriptionOption
    } = req.body;

    if (!companyName || !firstName || !lastName || !email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Company name, first name, last name, email, and password are required'
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 8 characters long'
      });
    }

    const existingUser = await pool.query(
      'SELECT id FROM users WHERE company_email = $1',
      [email.toLowerCase()]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'An account with this email already exists. Please try logging in instead.'
      });
    }

    const existingSubscription = await pool.query(
      'SELECT email FROM subscriptions WHERE email = $1',
      [email.toLowerCase()]
    );

    if (existingSubscription.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'This email is already registered. Please try logging in or use a different email address.'
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    let subscriptionStatus = 'trial';
    let plan = 'free';
    let smsQuota = 50;
    let stripeCustomerId = null;
    let stripeSubscriptionId = null;

    if (subscriptionOption && subscriptionOption !== 'trial') {
      try {
        const customer = await stripe.customers.create({
          email: email.toLowerCase(),
          name: `${firstName} ${lastName}`,
          metadata: {
            company_name: companyName
          },
          address: {
            line1: billingStreet || '',
            city: billingCity || '',
            state: billingState || '',
            postal_code: billingZip || '',
            country: billingCountry || 'US'
          }
        });

        stripeCustomerId = customer.id;

        const priceId = subscriptionOption === 'starter' 
          ? process.env.STRIPE_PRICE_ID_STARTER 
          : process.env.STRIPE_PRICE_ID_PRO;

        const subscription = await stripe.subscriptions.create({
          customer: customer.id,
          items: [{ price: priceId }],
          payment_behavior: 'default_incomplete',
          expand: ['latest_invoice.payment_intent']
        });

        stripeSubscriptionId = subscription.id;
        subscriptionStatus = subscription.status;
        plan = subscriptionOption;
        smsQuota = subscriptionOption === 'starter' ? 500 : 2000;
      } catch (stripeError) {
        console.error('Stripe error during signup:', stripeError);
        return res.status(500).json({
          success: false,
          error: 'Payment setup failed. Please try again or select the free trial option.'
        });
      }
    }

    const client = await pool.connect();
    let user;
    try {
      await client.query('BEGIN');

      const userResult = await client.query(
        `INSERT INTO users (
          company_name, first_name, last_name, company_email, password_hash,
          billing_address_street, billing_address_city, billing_address_state,
          billing_address_zip, billing_address_country
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING id, company_name, first_name, last_name, company_email`,
        [
          companyName, firstName, lastName, email.toLowerCase(), passwordHash,
          billingStreet || null, billingCity || null, billingState || null,
          billingZip || null, billingCountry || 'USA'
        ]
      );

      user = userResult.rows[0];

      await client.query(
        `INSERT INTO subscriptions (
          user_id, email, stripe_customer_id, stripe_subscription_id,
          subscription_status, plan, sms_quota, sms_sent
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 0)`,
        [user.id, email.toLowerCase(), stripeCustomerId, stripeSubscriptionId, subscriptionStatus, plan, smsQuota]
      );

      await client.query('COMMIT');
    } catch (dbError) {
      await client.query('ROLLBACK');
      throw dbError;
    } finally {
      client.release();
    }

    if (subscriptionStatus !== 'trial') {
      try {
        await sendWelcomeEmail(email, firstName, plan);
      } catch (emailError) {
        console.error('Failed to send welcome email:', emailError);
      }
    }

    req.session.userId = user.id;
    req.session.userEmail = user.company_email;
    req.session.companyName = user.company_name;

    res.json({
      success: true,
      user: {
        id: user.id,
        companyName: user.company_name,
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.company_email
      }
    });
  } catch (error) {
    console.error('Signup error:', error);
    
    let errorMessage = 'Failed to create account. Please try again.';
    
    if (error.code === '23505') {
      if (error.constraint === 'users_company_email_key' || error.constraint === 'subscriptions_email_key') {
        errorMessage = 'This email is already registered. Please try logging in or use a different email address.';
      } else {
        errorMessage = 'A record with this information already exists.';
      }
    } else if (error.message && error.message.includes('password')) {
      errorMessage = 'Password requirements not met. Please use at least 8 characters.';
    } else if (error.message) {
      errorMessage = `Signup failed: ${error.message}`;
    }
    
    res.status(500).json({
      success: false,
      error: errorMessage
    });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required'
      });
    }

    const userResult = await pool.query(
      'SELECT id, company_name, first_name, last_name, company_email, password_hash, is_active FROM users WHERE company_email = $1',
      [email.toLowerCase()]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }

    const user = userResult.rows[0];

    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        error: 'This account has been deactivated'
      });
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }

    req.session.userId = user.id;
    req.session.userEmail = user.company_email;
    req.session.companyName = user.company_name;

    res.json({
      success: true,
      user: {
        id: user.id,
        companyName: user.company_name,
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.company_email
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Login failed. Please try again.'
    });
  }
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({
        success: false,
        error: 'Logout failed'
      });
    }
    res.json({ success: true });
  });
});

app.get('/api/auth/session', (req, res) => {
  if (req.session && req.session.userId) {
    res.json({
      authenticated: true,
      user: {
        id: req.session.userId,
        email: req.session.userEmail,
        companyName: req.session.companyName
      }
    });
  } else {
    res.json({ authenticated: false });
  }
});

app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required'
      });
    }

    const userResult = await pool.query(
      'SELECT id, company_name, company_email, is_active FROM users WHERE company_email = $1',
      [email.toLowerCase()]
    );

    if (userResult.rows.length === 0) {
      return res.json({
        success: true,
        message: 'If an account exists with that email, a password reset link has been sent.'
      });
    }

    const user = userResult.rows[0];

    if (!user.is_active) {
      return res.json({
        success: true,
        message: 'If an account exists with that email, a password reset link has been sent.'
      });
    }

    await pool.query(
      'DELETE FROM auth_tokens WHERE user_id = $1 AND token_type = $2',
      [user.id, 'password_reset']
    );

    const resetToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 3600000);

    await pool.query(
      'INSERT INTO auth_tokens (user_id, token, token_type, expires_at) VALUES ($1, $2, $3, $4)',
      [user.id, resetToken, 'password_reset', expiresAt]
    );

    const resetUrl = `${process.env.REPLIT_DEV_DOMAIN || 'http://localhost:5000'}/reset-password.html?token=${resetToken}`;
    console.log(`\n🔑 PASSWORD RESET LINK FOR ${user.company_email}:`);
    console.log(`${resetUrl}`);
    console.log(`This link expires in 1 hour.\n`);

    await sendPasswordResetEmail(user.company_email, resetToken, user.company_name);

    res.json({
      success: true,
      message: 'If an account exists with that email, a password reset link has been sent.'
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process password reset request. Please try again.'
    });
  }
});

app.get('/api/auth/verify-reset-token', async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'Token is required'
      });
    }

    const tokenResult = await pool.query(
      `SELECT t.id, t.user_id, t.expires_at, t.used, u.company_email, u.company_name 
       FROM auth_tokens t
       JOIN users u ON t.user_id = u.id
       WHERE t.token = $1 AND t.token_type = $2`,
      [token, 'password_reset']
    );

    if (tokenResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid password reset token'
      });
    }

    const tokenData = tokenResult.rows[0];

    if (tokenData.used) {
      return res.status(400).json({
        success: false,
        error: 'This password reset link has already been used'
      });
    }

    if (new Date() > new Date(tokenData.expires_at)) {
      return res.status(400).json({
        success: false,
        error: 'This password reset link has expired'
      });
    }

    res.json({
      success: true,
      email: tokenData.company_email,
      companyName: tokenData.company_name
    });
  } catch (error) {
    console.error('Verify reset token error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify reset token'
    });
  }
});

app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({
        success: false,
        error: 'Token and new password are required'
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 8 characters long'
      });
    }

    const tokenResult = await pool.query(
      `SELECT t.id, t.user_id, t.expires_at, t.used 
       FROM auth_tokens t
       WHERE t.token = $1 AND t.token_type = $2`,
      [token, 'password_reset']
    );

    if (tokenResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid password reset token'
      });
    }

    const tokenData = tokenResult.rows[0];

    if (tokenData.used) {
      return res.status(400).json({
        success: false,
        error: 'This password reset link has already been used'
      });
    }

    if (new Date() > new Date(tokenData.expires_at)) {
      return res.status(400).json({
        success: false,
        error: 'This password reset link has expired'
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [passwordHash, tokenData.user_id]
      );

      await client.query(
        'UPDATE auth_tokens SET used = TRUE WHERE id = $1',
        [tokenData.id]
      );

      await client.query('COMMIT');
    } catch (dbError) {
      await client.query('ROLLBACK');
      throw dbError;
    } finally {
      client.release();
    }

    res.json({
      success: true,
      message: 'Password has been reset successfully. You can now log in with your new password.'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reset password. Please try again.'
    });
  }
});

let connectionSettings;

async function getCredentials() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=twilio',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  if (!connectionSettings || (!connectionSettings.settings.account_sid || !connectionSettings.settings.api_key || !connectionSettings.settings.api_key_secret)) {
    throw new Error('Twilio not connected');
  }
  return {
    accountSid: connectionSettings.settings.account_sid,
    apiKey: connectionSettings.settings.api_key,
    apiKeySecret: connectionSettings.settings.api_key_secret,
    phoneNumber: connectionSettings.settings.phone_number
  };
}

async function getTwilioClient() {
  const { accountSid, apiKey, apiKeySecret } = await getCredentials();
  return twilio(apiKey, apiKeySecret, {
    accountSid: accountSid
  });
}

async function getTwilioFromPhoneNumber() {
  const { phoneNumber } = await getCredentials();
  return phoneNumber;
}

function validateAndFormatPhone(phone) {
  const hasInternationalPrefix = phone.trim().startsWith('+') || phone.trim().startsWith('00') || phone.trim().startsWith('011');
  
  let cleaned = phone.replace(/\D/g, '');
  
  if (cleaned.startsWith('00')) {
    cleaned = cleaned.substring(2);
  } else if (cleaned.startsWith('011')) {
    cleaned = cleaned.substring(3);
  }
  
  if (!hasInternationalPrefix && cleaned.length === 10) {
    cleaned = '1' + cleaned;
  }
  
  if (cleaned.length >= 10 && cleaned.length <= 15) {
    return '+' + cleaned;
  }
  
  throw new Error('Invalid phone number format. Please use international format with country code (e.g., +1234567890 or 1234567890 for US)');
}

app.post('/api/send-review-request', requireAuth, upload.single('photo'), async (req, res) => {
  try {
    const { customerName, customerPhone, messageType, additionalInfo, feedbackRating } = req.body;
    const userEmail = req.session.userEmail;
    const feedbackScore = feedbackRating ? parseInt(feedbackRating) : null;

    if (!customerName || !customerPhone) {
      return res.status(400).json({ 
        success: false, 
        error: 'Customer name and phone number are required' 
      });
    }

    if (!userEmail) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required. Please log in again.',
        code: 'EMAIL_REQUIRED'
      });
    }

    let formattedPhone;
    try {
      formattedPhone = validateAndFormatPhone(customerPhone);
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }

    await pool.query(`
      INSERT INTO subscriptions (email, subscription_status, plan, sms_quota, sms_sent)
      VALUES ($1, 'trial', 'free', 50, 0)
      ON CONFLICT (email) DO NOTHING
    `, [userEmail]);

    // Fetch the saved Google Review Link from settings
    const settingsResult = await pool.query(
      'SELECT google_review_link FROM subscriptions WHERE email = $1',
      [userEmail]
    );
    
    const googleReviewLink = settingsResult.rows[0]?.google_review_link || 'https://g.page/r/CXmh-C0UxHgqEBM/review';

    const client = await getTwilioClient();
    const fromNumber = await getTwilioFromPhoneNumber();
    
    const reviewToken = messageType === 'review' ? crypto.randomBytes(3).toString('hex') : null;
    const appHost = process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : `${req.protocol}://${req.get('host')}`;
    const trackedReviewLink = reviewToken && googleReviewLink ? `${appHost}/r/${reviewToken}` : googleReviewLink;

    // Use the additionalInfo as the message body (frontend provides templates)
    let message = additionalInfo || '';
    
    // Add review link for review messages ONLY if:
    // 1. No feedback rating provided (backward compatibility), OR
    // 2. Feedback rating is 4 or 5 stars (positive feedback)
    const shouldSendReviewLink = messageType === 'review' && trackedReviewLink && 
                                  (feedbackScore === null || feedbackScore >= 4);
    
    if (shouldSendReviewLink) {
      message += `\n\n${trackedReviewLink}`;
    } else if (messageType === 'review' && feedbackScore !== null && feedbackScore < 4) {
      // For low ratings (1-3 stars), don't send review link
      // Just send a thank you message
      message = `Hi! Thank you for your feedback. We appreciate you letting us know about your experience. We'll be in touch soon to make things right.`;
    }

    const messageOptions = {
      body: message,
      from: fromNumber,
      to: formattedPhone
    };

    if (req.file) {
      const publicUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
      messageOptions.mediaUrl = [publicUrl];
      console.log('Sending MMS with photo:', publicUrl);
    }

    const pgClient = await pool.connect();
    let result;
    
    try {
      await pgClient.query('BEGIN');
      
      const quotaLock = await pgClient.query(`
        SELECT subscription_status, sms_quota, sms_sent 
        FROM subscriptions 
        WHERE email = $1
        FOR UPDATE
      `, [userEmail]);

      if (quotaLock.rows.length === 0) {
        await pgClient.query('ROLLBACK');
        return res.status(500).json({
          success: false,
          error: 'Failed to check subscription. Please try again.',
          code: 'SUBSCRIPTION_ERROR'
        });
      }

      const { subscription_status, sms_quota, sms_sent } = quotaLock.rows[0];

      if (subscription_status !== 'active' && subscription_status !== 'trial') {
        await pgClient.query('ROLLBACK');
        return res.status(402).json({
          success: false,
          error: 'Your subscription is inactive. Please subscribe in the Billing tab to continue sending SMS.',
          code: 'SUBSCRIPTION_INACTIVE'
        });
      }

      if (sms_sent >= sms_quota) {
        await pgClient.query('ROLLBACK');
        return res.status(402).json({
          success: false,
          error: `You've reached your SMS quota (${sms_sent}/${sms_quota} messages). Please upgrade your plan in the Billing tab.`,
          code: 'QUOTA_EXCEEDED',
          quota: sms_quota,
          used: sms_sent
        });
      }

      await pgClient.query(`
        UPDATE subscriptions 
        SET sms_sent = sms_sent + 1, updated_at = CURRENT_TIMESTAMP 
        WHERE email = $1
      `, [userEmail]);

      result = await client.messages.create(messageOptions);
      
      await pgClient.query('COMMIT');
      
      console.log(`✅ SMS sent successfully: ${result.sid} | Quota: ${sms_sent + 1}/${sms_quota} for ${userEmail}`);
      
    } catch (twilioError) {
      await pgClient.query('ROLLBACK');
      throw twilioError;
    } finally {
      pgClient.release();
    }

    let dbSaved = false;
    try {
      let customerId = null;
      const customerCheck = await pool.query(
        'SELECT id FROM customers WHERE phone = $1',
        [formattedPhone]
      );

      if (customerCheck.rows.length > 0) {
        customerId = customerCheck.rows[0].id;
        await pool.query(
          'UPDATE customers SET name = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
          [customerName, customerId]
        );
      } else {
        const newCustomer = await pool.query(
          'INSERT INTO customers (name, phone) VALUES ($1, $2) RETURNING id',
          [customerName, formattedPhone]
        );
        customerId = newCustomer.rows[0].id;
      }

      const followUpDueAt = messageType === 'review' ? new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) : null;

      await pool.query(
        'INSERT INTO messages (customer_id, customer_name, customer_phone, message_type, review_link, additional_info, photo_path, twilio_sid, review_link_token, follow_up_due_at, review_status, feedback_rating, feedback_collected_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)',
        [
          customerId,
          customerName,
          formattedPhone,
          messageType,
          googleReviewLink || null,
          additionalInfo || null,
          req.file ? req.file.filename : null,
          result.sid,
          reviewToken,
          followUpDueAt,
          messageType === 'review' ? 'pending' : null,
          feedbackScore,
          feedbackScore !== null ? new Date() : null
        ]
      );
      
      dbSaved = true;
    } catch (dbError) {
      console.error('⚠️ Error saving to database (message sent successfully):', dbError);
    }

    res.json({ 
      success: true, 
      message: 'Review request sent successfully!',
      messageSid: result.sid,
      photoAttached: !!req.file,
      dbSaved: dbSaved
    });

  } catch (error) {
    console.error('Error sending SMS:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to send SMS' 
    });
  }
});

app.get('/api/messages', async (req, res) => {
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
});

app.get('/api/customers', async (req, res) => {
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
});

app.get('/api/stats', async (req, res) => {
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
});

app.get('/r/:token', async (req, res) => {
  try {
    const { token } = req.params;
    
    const result = await pool.query(
      'SELECT id, review_link, review_link_clicked_at FROM messages WHERE review_link_token = $1',
      [token]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).send('Invalid review link');
    }
    
    const message = result.rows[0];
    
    if (!message.review_link_clicked_at) {
      await pool.query(
        `UPDATE messages 
         SET review_link_clicked_at = CURRENT_TIMESTAMP, 
             review_status = CASE 
               WHEN review_status = 'reviewed' THEN 'reviewed'
               ELSE 'link_clicked'
             END
         WHERE id = $1`,
        [message.id]
      );
    }
    
    res.redirect(302, message.review_link);
  } catch (error) {
    console.error('Error tracking review link click:', error);
    res.status(500).send('Error processing review link');
  }
});

app.patch('/api/messages/:id/review-status', async (req, res) => {
  try {
    const { id } = req.params;
    
    await pool.query(
      `UPDATE messages 
       SET review_received_at = CURRENT_TIMESTAMP, review_status = 'reviewed'
       WHERE id = $1`,
      [id]
    );
    
    res.json({ success: true, message: 'Review marked as received' });
  } catch (error) {
    console.error('Error updating review status:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/messages/needs-followup', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, customer_name, customer_phone, sent_at, review_link, follow_up_due_at
       FROM messages 
       WHERE message_type = 'review'
         AND review_status = 'pending'
         AND review_link_clicked_at IS NULL
         AND follow_up_sent_at IS NULL
         AND follow_up_due_at <= CURRENT_TIMESTAMP
       ORDER BY sent_at ASC`
    );
    
    res.json({ success: true, messages: result.rows });
  } catch (error) {
    console.error('Error fetching messages needing follow-up:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/follow-ups/send', async (req, res) => {
  try {
    const { messageIds } = req.body;
    
    if (!messageIds || messageIds.length === 0) {
      return res.status(400).json({ success: false, error: 'No message IDs provided' });
    }
    
    const client = await getTwilioClient();
    const fromNumber = await getTwilioFromPhoneNumber();
    const appHost = process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : `${req.protocol}://${req.get('host')}`;
    
    let successCount = 0;
    let errors = [];
    
    for (const messageId of messageIds) {
      try {
        const msgResult = await pool.query(
          'SELECT customer_name, customer_phone, review_link_token FROM messages WHERE id = $1',
          [messageId]
        );
        
        if (msgResult.rows.length === 0) continue;
        
        const { customer_name, customer_phone, review_link_token } = msgResult.rows[0];
        const trackedLink = `${appHost}/r/${review_link_token}`;
        
        const followUpMessage = `Hi ${customer_name}! Just a friendly reminder - we'd really appreciate your feedback on Google. Your review helps us serve you better! ${trackedLink} Thank you! 🙏`;
        
        const result = await client.messages.create({
          body: followUpMessage,
          from: fromNumber,
          to: customer_phone
        });
        
        const newMessageResult = await pool.query(
          `INSERT INTO messages (customer_id, customer_name, customer_phone, message_type, review_link, twilio_sid, follow_up_message_id)
           SELECT customer_id, customer_name, customer_phone, 'review_follow_up', review_link, $1, $2
           FROM messages WHERE id = $3
           RETURNING id`,
          [result.sid, messageId, messageId]
        );
        
        await pool.query(
          `UPDATE messages 
           SET follow_up_sent_at = CURRENT_TIMESTAMP, review_status = 'follow_up_sent'
           WHERE id = $1`,
          [messageId]
        );
        
        successCount++;
      } catch (error) {
        console.error(`Error sending follow-up for message ${messageId}:`, error);
        errors.push({ messageId, error: error.message });
      }
    }
    
    res.json({ 
      success: true, 
      sent: successCount,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('Error sending follow-ups:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/create-checkout-session', async (req, res) => {
  try {
    const { email, planId } = req.body;
    
    if (!email || !planId) {
      return res.status(400).json({ error: 'Email and planId are required' });
    }

    const validPlans = {
      starter: {
        priceId: process.env.STRIPE_PRICE_ID_STARTER || 'price_starter',
        quota: 300,
        name: 'starter'
      },
      pro: {
        priceId: process.env.STRIPE_PRICE_ID_PRO || 'price_pro',
        quota: 1000,
        name: 'pro'
      }
    };

    const plan = validPlans[planId];
    if (!plan) {
      return res.status(400).json({ error: 'Invalid plan ID' });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{
        price: plan.priceId,
        quantity: 1,
      }],
      success_url: `${req.protocol}://${req.get('host')}/?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.protocol}://${req.get('host')}/`,
      customer_email: email,
      metadata: {
        email: email,
        planId: planId,
        smsQuota: plan.quota
      }
    });

    res.json({ url: session.url, sessionId: session.id });
  } catch (error) {
    console.error('Stripe checkout error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/create-portal-session', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const subscription = await pool.query(
      'SELECT stripe_customer_id FROM subscriptions WHERE email = $1',
      [email]
    );

    if (subscription.rows.length === 0 || !subscription.rows[0].stripe_customer_id) {
      return res.status(404).json({ 
        error: 'No subscription found. Please subscribe first.' 
      });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.rows[0].stripe_customer_id,
      return_url: `${req.protocol}://${req.get('host')}/`,
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error('Stripe portal error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/pricing', (req, res) => {
  const plans = {
    starter: {
      id: 'starter',
      name: 'Starter Plan',
      priceId: process.env.STRIPE_PRICE_ID_STARTER || 'price_starter',
      amount: 4900,
      currency: 'usd',
      interval: 'month',
      smsQuota: 300,
      features: [
        '300 SMS per month',
        'Review tracking',
        'Automatic follow-ups',
        'Customer database',
        'OCR text extraction'
      ]
    },
    pro: {
      id: 'pro',
      name: 'Pro Plan',
      priceId: process.env.STRIPE_PRICE_ID_PRO || 'price_pro',
      amount: 9900,
      currency: 'usd',
      interval: 'month',
      smsQuota: 1000,
      features: [
        '1,000 SMS per month',
        'Review tracking',
        'Automatic follow-ups',
        'Customer database',
        'OCR text extraction',
        'Priority support'
      ]
    }
  };
  
  res.json({ plans });
});

app.post('/api/stripe-webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.error('❌ STRIPE_WEBHOOK_SECRET is not configured');
    return res.status(500).send('Webhook secret not configured');
  }
  
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.log(`⚠️ Webhook signature verification failed:`, err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const email = session.customer_email || session.metadata?.email;
        const stripeCustomerId = session.customer;
        const stripeSubscriptionId = session.subscription;
        const planId = session.metadata?.planId || 'starter';
        const smsQuota = parseInt(session.metadata?.smsQuota || '300');

        await pool.query(`
          INSERT INTO subscriptions (email, stripe_customer_id, stripe_subscription_id, subscription_status, plan, sms_quota)
          VALUES ($1, $2, $3, 'active', $4, $5)
          ON CONFLICT (email) 
          DO UPDATE SET 
            stripe_customer_id = $2,
            stripe_subscription_id = $3,
            subscription_status = 'active',
            plan = $4,
            sms_quota = $5,
            updated_at = CURRENT_TIMESTAMP
        `, [email, stripeCustomerId, stripeSubscriptionId, planId, smsQuota]);

        await pool.query(`
          INSERT INTO event_logs (event_type, event_data, email, status)
          VALUES ($1, $2, $3, $4)
        `, ['checkout_completed', event.data.object, email, 'success']);
        
        sendWelcomeEmail(email, planId).catch(err => 
          console.error('Failed to send welcome email:', err)
        );
        
        console.log(`✅ Subscription activated for ${email} - Plan: ${planId}, Quota: ${smsQuota}`);
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const status = subscription.status === 'active' ? 'active' : 'inactive';
        
        await pool.query(`
          UPDATE subscriptions 
          SET subscription_status = $1, updated_at = CURRENT_TIMESTAMP
          WHERE stripe_subscription_id = $2
        `, [status, subscription.id]);

        await pool.query(`
          INSERT INTO event_logs (event_type, event_data, status)
          VALUES ($1, $2, $3)
        `, ['subscription_updated', event.data.object, 'success']);
        
        console.log(`✅ Subscription updated: ${subscription.id} -> ${status}`);
        break;
      }

      case 'customer.subscription.deleted':
      case 'invoice.payment_failed': {
        const subscription = event.data.object;
        const subscriptionId = subscription.id || subscription.subscription;
        
        await pool.query(`
          UPDATE subscriptions 
          SET subscription_status = 'inactive', updated_at = CURRENT_TIMESTAMP
          WHERE stripe_subscription_id = $1
        `, [subscriptionId]);

        await pool.query(`
          INSERT INTO event_logs (event_type, event_data, status)
          VALUES ($1, $2, $3)
        `, [event.type, event.data.object, 'success']);

        if (event.type === 'invoice.payment_failed') {
          const subscriptionData = await pool.query(
            'SELECT email FROM subscriptions WHERE stripe_subscription_id = $1',
            [subscriptionId]
          );
          if (subscriptionData.rows.length > 0) {
            sendPaymentFailedEmail(subscriptionData.rows[0].email).catch(err => 
              console.error('Failed to send payment failed email:', err)
            );
          }
        }
        
        console.log(`✅ Subscription deactivated: ${subscriptionId} - Reason: ${event.type}`);
        break;
      }

      default:
        await pool.query(`
          INSERT INTO event_logs (event_type, event_data, status)
          VALUES ($1, $2, $3)
        `, [event.type, event.data.object, 'unhandled']);
        console.log(`⚠️ Unhandled webhook event: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('❌ Webhook processing error:', error);
    
    await pool.query(`
      INSERT INTO event_logs (event_type, event_data, status, error_message)
      VALUES ($1, $2, $3, $4)
    `, [event.type, event.data?.object || {}, 'error', error.message]);
    
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/subscription-status', async (req, res) => {
  try {
    const { email } = req.query;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const result = await pool.query(
      'SELECT subscription_status, plan, sms_quota, sms_sent FROM subscriptions WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.json({ 
        subscription_status: 'none',
        plan: 'free',
        sms_quota: 50,
        sms_sent: 0,
        usage_percentage: 0,
        warning_level: 'none'
      });
    }

    const { subscription_status, plan, sms_quota, sms_sent } = result.rows[0];
    const usagePercentage = (sms_sent / sms_quota) * 100;
    
    let warningLevel = 'none';
    if (usagePercentage >= 90) {
      warningLevel = 'critical';
    } else if (usagePercentage >= 80) {
      warningLevel = 'high';
    } else if (usagePercentage >= 60) {
      warningLevel = 'medium';
    }

    res.json({
      subscription_status,
      plan,
      sms_quota,
      sms_sent,
      usage_percentage: Math.round(usagePercentage),
      warning_level: warningLevel,
      remaining: sms_quota - sms_sent
    });
  } catch (error) {
    console.error('Error fetching subscription status:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET Settings (Protected)
app.get('/api/settings', requireAuth, async (req, res) => {
  try {
    const userEmail = req.session.userEmail;

    if (!userEmail) {
      return res.status(400).json({ success: false, error: 'User email not found in session' });
    }

    const result = await pool.query(
      'SELECT google_review_link FROM subscriptions WHERE email = $1',
      [userEmail]
    );

    if (result.rows.length === 0) {
      return res.json({ 
        success: true,
        settings: {
          google_review_link: 'https://g.page/r/CXmh-C0UxHgqEBM/review'
        }
      });
    }

    res.json({
      success: true,
      settings: {
        google_review_link: result.rows[0].google_review_link || 'https://g.page/r/CXmh-C0UxHgqEBM/review'
      }
    });
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST Settings (Protected)
app.post('/api/settings', requireAuth, async (req, res) => {
  try {
    const userEmail = req.session.userEmail;
    const { google_review_link } = req.body;

    if (!userEmail) {
      return res.status(400).json({ success: false, error: 'User email not found in session' });
    }

    const result = await pool.query(`
      UPDATE subscriptions 
      SET google_review_link = $1, updated_at = CURRENT_TIMESTAMP
      WHERE email = $2
      RETURNING *
    `, [google_review_link || 'https://g.page/r/CXmh-C0UxHgqEBM/review', userEmail]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Subscription not found. Please set up your subscription first.'
      });
    }

    res.json({
      success: true,
      message: 'Settings saved successfully'
    });
  } catch (error) {
    console.error('Error saving settings:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/ocr/process', ocrUpload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No image file provided'
      });
    }

    const apiKey = process.env.GOOGLE_CLOUD_VISION_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        success: false,
        error: 'OCR service not configured'
      });
    }

    const processedImageBuffer = await sharp(req.file.buffer)
      .resize(2000, 2000, { fit: 'inside', withoutEnlargement: true })
      .normalize()
      .sharpen()
      .grayscale()
      .toBuffer();

    const base64Image = processedImageBuffer.toString('base64');

    const response = await axios.post(
      `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
      {
        requests: [
          {
            image: {
              content: base64Image
            },
            features: [
              {
                type: 'DOCUMENT_TEXT_DETECTION',
                maxResults: 1
              }
            ]
          }
        ]
      }
    );

    if (response.data.responses[0].error) {
      throw new Error(response.data.responses[0].error.message);
    }

    const fullText = response.data.responses[0].fullTextAnnotation?.text || '';
    
    const extractedData = parseOCRText(fullText);

    res.json({
      success: true,
      data: extractedData,
      rawText: fullText
    });

  } catch (error) {
    console.error('OCR processing error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process image',
      details: error.message
    });
  }
});

function parseOCRText(text) {
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  let name = '';
  let phone = '';
  let device = '';
  let repair = '';

  const phoneRegex = /(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}/g;
  const nameKeywords = ['name', 'customer', 'client'];
  
  const deviceModels = ['iphone', 'ipad', 'macbook', 'imac', 'samsung', 'galaxy', 'pixel', 
    'oneplus', 'lg', 'motorola', 'huawei', 'xiaomi', 'oppo', 'hp', 'dell', 'lenovo', 'asus',
    'acer', 'surface', 'thinkpad', 'chromebook', 'laptop', 'desktop', 'tablet', 'watch'];
  
  const repairIssues = ['screen', 'display', 'battery', 'charging', 'port', 'camera', 
    'speaker', 'microphone', 'button', 'water damage', 'motherboard', 'logic board',
    'cracked', 'broken', 'replacement', 'repair', 'glass', 'lcd', 'digitizer', 'back glass'];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lowerLine = line.toLowerCase();

    if (!phone && (lowerLine.includes('mobile') || lowerLine.includes('phone') || lowerLine.includes('tel')) && !lowerLine.includes('imei')) {
      const digits = line.replace(/[^\d]/g, '');
      
      if (digits.length >= 6) {
        let phoneNumber = digits;
        
        if (digits.length < 10) {
          for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
            const nextLine = lines[j];
            if (nextLine.toLowerCase().includes('imei')) continue;
            
            const nextDigits = nextLine.replace(/[^\d]/g, '');
            if (nextDigits.length > 0 && nextDigits.length <= 4) {
              phoneNumber += nextDigits;
              if (phoneNumber.length >= 10) break;
            }
          }
        }
        
        if (phoneNumber.length === 10) {
          phone = '+1' + phoneNumber;
        } else if (phoneNumber.length === 11 && phoneNumber.startsWith('1')) {
          phone = '+' + phoneNumber;
        } else if (phoneNumber.length > 11 && phoneNumber.startsWith('1')) {
          phone = '+' + phoneNumber.substring(0, 11);
        }
      }
    }
    
    if (!phone) {
      const phoneMatches = line.match(phoneRegex);
      if (phoneMatches && phoneMatches.length > 0) {
        let foundPhone = phoneMatches[0].replace(/[^\d]/g, '');
        if (foundPhone.length === 10) {
          phone = '+1' + foundPhone;
        } else if (foundPhone.length === 11 && foundPhone.startsWith('1')) {
          phone = '+' + foundPhone;
        }
      }
    }

    if (!name && nameKeywords.some(keyword => lowerLine.includes(keyword))) {
      const nextLine = lines[i + 1];
      if (nextLine && nextLine.length > 2 && nextLine.length < 100) {
        const words = nextLine.split(/\s+/);
        if (words.length >= 2 && words.length <= 5) {
          const hasUpperCase = words.some(word => /[A-Z]/.test(word));
          if (hasUpperCase) {
            name = nextLine;
          }
        }
      }
    }

    if (!device && deviceModels.some(model => lowerLine.includes(model))) {
      device = line;
    }

    if (!repair) {
      for (const issue of repairIssues) {
        if (lowerLine.includes(issue)) {
          const issueMatch = line.match(new RegExp(`\\b[\\w\\s]*(${issue})[\\w\\s]*\\b`, 'i'));
          if (issueMatch) {
            repair = issueMatch[0].trim();
            break;
          }
        }
      }
    }
  }

  if (!name) {
    for (const line of lines) {
      const words = line.split(/\s+/);
      if (words.length >= 2 && words.length <= 4) {
        const allWordsCapitalized = words.every(word => 
          word.length > 1 && /^[A-Z]/.test(word) && /^[A-Za-z\-']+$/.test(word)
        );
        if (allWordsCapitalized && !phoneRegex.test(line)) {
          name = line;
          break;
        }
      }
    }
  }

  if (!device) {
    const fullText = text.toLowerCase();
    for (const model of deviceModels) {
      const modelRegex = new RegExp(`\\b(${model}[\\s\\w\\d-]*(?:pro|max|plus|ultra|mini|air|se)?(?:\\s*\\d+)?(?:\\s*pro|max|plus)?(?:\\s*max)?)\\b`, 'i');
      const match = fullText.match(modelRegex);
      if (match) {
        const startIndex = fullText.indexOf(match[0]);
        const endIndex = startIndex + match[0].length;
        device = text.substring(startIndex, endIndex).trim();
        break;
      }
    }
  }

  return {
    name: name.trim(),
    phone: phone.trim(),
    device: device.trim(),
    repair: repair.trim()
  };
}

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

async function startServer() {
  try {
    await initializeDatabase();
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`✅ Server running on port ${PORT}`);
      console.log(`🌐 Access the app at http://0.0.0.0:${PORT}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
