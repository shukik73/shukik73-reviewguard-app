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
import { sendWelcomeEmail, sendQuotaWarningEmail, sendPaymentFailedEmail } from './lib/resend.js';

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

    CREATE INDEX IF NOT EXISTS idx_event_logs_email ON event_logs(email);
    CREATE INDEX IF NOT EXISTS idx_event_logs_type ON event_logs(event_type);
    CREATE INDEX IF NOT EXISTS idx_event_logs_created ON event_logs(created_at DESC);
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
      
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='subscriptions' AND column_name='user_id') THEN
        ALTER TABLE subscriptions ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
      END IF;
      
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='messages' AND column_name='user_id') THEN
        ALTER TABLE messages ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
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
    maxAge: 30 * 24 * 60 * 60 * 1000
  }
}));

app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

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

app.post('/api/send-review-request', upload.single('photo'), async (req, res) => {
  try {
    const { customerName, customerPhone, messageType, googleReviewLink, additionalInfo, userEmail } = req.body;

    if (!customerName || !customerPhone) {
      return res.status(400).json({ 
        success: false, 
        error: 'Customer name and phone number are required' 
      });
    }

    if (!userEmail || !userEmail.includes('@')) {
      return res.status(400).json({
        success: false,
        error: 'A valid email address is required to send SMS. Please enter your email in the Billing tab.',
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

    const client = await getTwilioClient();
    const fromNumber = await getTwilioFromPhoneNumber();
    
    const reviewToken = messageType === 'review' ? crypto.randomBytes(3).toString('hex') : null;
    const appHost = process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : `${req.protocol}://${req.get('host')}`;
    const trackedReviewLink = reviewToken && googleReviewLink ? `${appHost}/r/${reviewToken}` : googleReviewLink;

    let message;
    
    if (messageType === 'ready') {
      message = `Hi ${customerName}! Great news - your device is ready for pickup at Techy Miramar! 🎉`;
      
      if (additionalInfo) {
        message += ` ${additionalInfo}`;
      }
      
      message += ` We're open and ready to see you. Thank you for choosing us!`;
    } else {
      message = `Hi ${customerName}! Thank you for choosing Techy Miramar for your repair. We hope you're satisfied with the work we did.`;
      
      if (additionalInfo) {
        message += ` ${additionalInfo}`;
      }
      
      message += ` Could you take a moment to leave us a Google review? ${trackedReviewLink || 'Your feedback means a lot to us!'} Thank you! 🙏`;
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
        'INSERT INTO messages (customer_id, customer_name, customer_phone, message_type, review_link, additional_info, photo_path, twilio_sid, review_link_token, follow_up_due_at, review_status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)',
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
          messageType === 'review' ? 'pending' : null
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
