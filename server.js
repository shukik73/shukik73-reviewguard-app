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

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function initializeDatabase() {
  await pool.query(`
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

    CREATE INDEX IF NOT EXISTS idx_messages_sent_at ON messages(sent_at DESC);
    CREATE INDEX IF NOT EXISTS idx_messages_customer_id ON messages(customer_id);
    CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
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

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
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
    const { customerName, customerPhone, messageType, googleReviewLink, additionalInfo } = req.body;

    if (!customerName || !customerPhone) {
      return res.status(400).json({ 
        success: false, 
        error: 'Customer name and phone number are required' 
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

    const client = await getTwilioClient();
    const fromNumber = await getTwilioFromPhoneNumber();
    
    const reviewToken = messageType === 'review' ? crypto.randomBytes(16).toString('hex') : null;
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

    const result = await client.messages.create(messageOptions);

    console.log('SMS sent successfully:', result.sid);

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
