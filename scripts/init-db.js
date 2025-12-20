#!/usr/bin/env node

import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function runMigrations() {
  console.log('🚀 Starting database migrations...\n');

  try {
    console.log('[MIGRATION] Creating core tables...');
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
        phone VARCHAR(50) NOT NULL,
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
    console.log('[MIGRATION] ✅ Core tables created');

    console.log('[MIGRATION] Creating subscription and session tables...');
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

      CREATE TABLE IF NOT EXISTS sms_optouts (
        id SERIAL PRIMARY KEY,
        phone VARCHAR(50) NOT NULL UNIQUE,
        opted_out_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        reason VARCHAR(100) DEFAULT 'STOP'
      );

      CREATE TABLE IF NOT EXISTS user_settings (
        id SERIAL PRIMARY KEY,
        user_email VARCHAR(255) UNIQUE NOT NULL REFERENCES users(company_email) ON DELETE CASCADE,
        business_name VARCHAR(255),
        sms_template TEXT DEFAULT 'Hi {name}, thanks for visiting {business}! Please review us here: {link}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS internal_feedback (
        id SERIAL PRIMARY KEY,
        message_id INTEGER REFERENCES messages(id),
        customer_name VARCHAR(255) NOT NULL,
        customer_phone VARCHAR(50) NOT NULL,
        rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
        feedback_text TEXT,
        user_email VARCHAR(255) REFERENCES users(company_email),
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        status VARCHAR(20) DEFAULT 'unread',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS google_reviews (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        review_id VARCHAR(255) NOT NULL,
        reviewer_name VARCHAR(255) NOT NULL,
        star_rating INTEGER NOT NULL CHECK (star_rating BETWEEN 1 AND 5),
        comment TEXT,
        ai_reply_draft TEXT,
        status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'posted', 'ignored')),
        review_date TIMESTAMP,
        posted_reply TEXT,
        posted_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, review_id)
      );

      CREATE INDEX IF NOT EXISTS idx_google_reviews_user_id ON google_reviews(user_id);
      CREATE INDEX IF NOT EXISTS idx_google_reviews_status ON google_reviews(status);
      CREATE INDEX IF NOT EXISTS idx_google_reviews_review_date ON google_reviews(review_date DESC);

      CREATE INDEX IF NOT EXISTS idx_event_logs_email ON event_logs(email);
      CREATE INDEX IF NOT EXISTS idx_event_logs_type ON event_logs(event_type);
      CREATE INDEX IF NOT EXISTS idx_event_logs_created ON event_logs(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_user_sessions_expire ON user_sessions(expire);
      CREATE INDEX IF NOT EXISTS idx_sms_optouts_phone ON sms_optouts(phone);
      CREATE INDEX IF NOT EXISTS idx_user_settings_email ON user_settings(user_email);
      CREATE INDEX IF NOT EXISTS idx_internal_feedback_user ON internal_feedback(user_email);
      CREATE INDEX IF NOT EXISTS idx_internal_feedback_user_id ON internal_feedback(user_id);
      CREATE INDEX IF NOT EXISTS idx_internal_feedback_created ON internal_feedback(created_at DESC);
    `);
    console.log('[MIGRATION] ✅ Subscription and session tables created');

    console.log('[MIGRATION] Adding multi-tenant columns to customers table...');
    try {
      await pool.query(`
        ALTER TABLE customers 
        ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE
      `);
    } catch (e) {}

    try {
      await pool.query(`
        ALTER TABLE customers 
        DROP CONSTRAINT IF EXISTS customers_phone_key CASCADE
      `);
    } catch (e) {}

    try {
      await pool.query(`
        ALTER TABLE customers 
        ADD CONSTRAINT customers_user_id_phone_unique UNIQUE(user_id, phone)
      `);
    } catch (e) {}
    console.log('[MIGRATION] ✅ Customers table updated');

    console.log('[MIGRATION] Adding Smart Follow-up columns to customers table...');
    try {
      await pool.query(`
        ALTER TABLE customers 
        ADD COLUMN IF NOT EXISTS link_clicked BOOLEAN DEFAULT FALSE
      `);
    } catch (e) {}

    try {
      await pool.query(`
        ALTER TABLE customers 
        ADD COLUMN IF NOT EXISTS follow_up_sent BOOLEAN DEFAULT FALSE
      `);
    } catch (e) {}

    try {
      await pool.query(`
        ALTER TABLE customers 
        ADD COLUMN IF NOT EXISTS last_sms_sent_at TIMESTAMP
      `);
    } catch (e) {}

    try {
      await pool.query(`
        ALTER TABLE customers 
        ADD COLUMN IF NOT EXISTS tracking_token TEXT UNIQUE
      `);
    } catch (e) {}

    try {
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_customers_link_clicked ON customers(link_clicked)`);
    } catch (e) {}
    try {
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_customers_follow_up_sent ON customers(follow_up_sent)`);
    } catch (e) {}
    try {
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_customers_tracking_token ON customers(tracking_token)`);
    } catch (e) {}
    console.log('[MIGRATION] ✅ Smart Follow-up columns added to customers table');

    console.log('[MIGRATION] Adding columns to messages table...');
    try {
      await pool.query(`
        ALTER TABLE messages 
        ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE
      `);
    } catch (e) {}

    try {
      await pool.query(`
        ALTER TABLE messages ADD COLUMN IF NOT EXISTS review_status VARCHAR(20) DEFAULT 'pending'
      `);
    } catch (e) {}

    try {
      await pool.query(`
        ALTER TABLE messages ADD COLUMN IF NOT EXISTS review_link_token TEXT UNIQUE
      `);
    } catch (e) {}

    try {
      await pool.query(`
        ALTER TABLE messages ADD COLUMN IF NOT EXISTS review_link_clicked_at TIMESTAMP
      `);
    } catch (e) {}

    try {
      await pool.query(`
        ALTER TABLE messages ADD COLUMN IF NOT EXISTS review_received_at TIMESTAMP
      `);
    } catch (e) {}

    try {
      await pool.query(`
        ALTER TABLE messages ADD COLUMN IF NOT EXISTS follow_up_sent_at TIMESTAMP
      `);
    } catch (e) {}

    try {
      await pool.query(`
        ALTER TABLE messages ADD COLUMN IF NOT EXISTS follow_up_due_at TIMESTAMP
      `);
    } catch (e) {}

    try {
      await pool.query(`
        ALTER TABLE messages ADD COLUMN IF NOT EXISTS follow_up_message_id INTEGER REFERENCES messages(id)
      `);
    } catch (e) {}

    try {
      await pool.query(`
        ALTER TABLE messages ADD COLUMN IF NOT EXISTS user_email VARCHAR(255) REFERENCES users(company_email)
      `);
    } catch (e) {}

    try {
      await pool.query(`
        ALTER TABLE messages ADD COLUMN IF NOT EXISTS feedback_token TEXT UNIQUE
      `);
    } catch (e) {}

    try {
      await pool.query(`
        ALTER TABLE messages ADD COLUMN IF NOT EXISTS feedback_rating INTEGER CHECK (feedback_rating BETWEEN 1 AND 5)
      `);
    } catch (e) {}

    try {
      await pool.query(`
        ALTER TABLE messages ADD COLUMN IF NOT EXISTS feedback_collected_at TIMESTAMP
      `);
    } catch (e) {}

    try {
      await pool.query(`
        ALTER TABLE messages ADD COLUMN IF NOT EXISTS sms_consent_confirmed BOOLEAN DEFAULT NULL
      `);
    } catch (e) {}

    try {
      await pool.query(`
        ALTER TABLE messages ADD COLUMN IF NOT EXISTS campaign_id VARCHAR(100)
      `);
    } catch (e) {}

    try {
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages(user_id)`);
    } catch (e) {}

    try {
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_messages_campaign_id ON messages(campaign_id)`);
    } catch (e) {}
    console.log('[MIGRATION] ✅ Messages table updated');

    console.log('[MIGRATION] Running multi-tenant isolation migration...');
    try {
      await pool.query(`ALTER TABLE customers ALTER COLUMN user_id DROP DEFAULT`);
      await pool.query(`ALTER TABLE messages ALTER COLUMN user_id DROP DEFAULT`);
      
      console.log('[MIGRATION] Backfilling user_id in messages table...');
      const messagesResult = await pool.query(`
        UPDATE messages 
        SET user_id = (SELECT id FROM users WHERE company_email = messages.user_email LIMIT 1) 
        WHERE user_id IS NULL OR user_id = 1
      `);
      console.log(`[MIGRATION] Updated ${messagesResult.rowCount} messages rows`);
      
      console.log('[MIGRATION] Backfilling user_id in customers table...');
      const customersResult = await pool.query(`
        UPDATE customers 
        SET user_id = (
          SELECT m.user_id FROM messages m 
          WHERE m.customer_id = customers.id 
          AND m.user_id IS NOT NULL 
          LIMIT 1
        ) 
        WHERE (user_id IS NULL OR user_id = 1)
        AND EXISTS (
          SELECT 1 FROM messages m 
          WHERE m.customer_id = customers.id 
          AND m.user_id IS NOT NULL
        )
      `);
      console.log(`[MIGRATION] Updated ${customersResult.rowCount} customers rows`);
      
      console.log('[MIGRATION] Backfilling user_id in internal_feedback table...');
      const feedbackResult = await pool.query(`
        UPDATE internal_feedback 
        SET user_id = (SELECT id FROM users WHERE company_email = internal_feedback.user_email LIMIT 1) 
        WHERE user_id IS NULL
      `);
      console.log(`[MIGRATION] Updated ${feedbackResult.rowCount} internal_feedback rows`);
      
      console.log('[MIGRATION] Auditing for orphaned rows...');
      
      const orphanedMessages = await pool.query(`SELECT id, customer_phone FROM messages WHERE user_id IS NULL`);
      if (orphanedMessages.rowCount > 0) {
        console.warn(`[MIGRATION] ⚠️ Found ${orphanedMessages.rowCount} orphaned messages rows (no user_id):`);
        orphanedMessages.rows.forEach(row => {
          console.warn(`  - Message ID ${row.id}: ${row.customer_phone}`);
        });
      }
      
      const orphanedCustomers = await pool.query(`SELECT id, phone, name FROM customers WHERE user_id IS NULL`);
      if (orphanedCustomers.rowCount > 0) {
        console.warn(`[MIGRATION] ⚠️ Found ${orphanedCustomers.rowCount} orphaned customers rows (no user_id):`);
        orphanedCustomers.rows.forEach(row => {
          console.warn(`  - Customer ID ${row.id}: ${row.name} (${row.phone})`);
        });
      }
      
      const orphanedFeedback = await pool.query(`SELECT id, customer_name, rating FROM internal_feedback WHERE user_id IS NULL`);
      if (orphanedFeedback.rowCount > 0) {
        console.warn(`[MIGRATION] ⚠️ Found ${orphanedFeedback.rowCount} orphaned feedback rows (no user_id):`);
        orphanedFeedback.rows.forEach(row => {
          console.warn(`  - Feedback ID ${row.id}: ${row.customer_name} (${row.rating} stars)`);
        });
      }
      
      const totalOrphans = orphanedMessages.rowCount + orphanedCustomers.rowCount + orphanedFeedback.rowCount;
      
      if (totalOrphans === 0) {
        console.log('[MIGRATION] ✅ All rows have user_id. Enforcing NOT NULL constraints...');
        
        try {
          await pool.query(`ALTER TABLE messages ALTER COLUMN user_id SET NOT NULL`);
          console.log('[MIGRATION] ✅ messages.user_id set to NOT NULL');
        } catch (e) {
          console.log(`[MIGRATION] messages.user_id already NOT NULL: ${e.message}`);
        }
        
        try {
          await pool.query(`ALTER TABLE customers ALTER COLUMN user_id SET NOT NULL`);
          console.log('[MIGRATION] ✅ customers.user_id set to NOT NULL');
        } catch (e) {
          console.log(`[MIGRATION] customers.user_id already NOT NULL: ${e.message}`);
        }
        
        try {
          await pool.query(`ALTER TABLE internal_feedback ALTER COLUMN user_id SET NOT NULL`);
          console.log('[MIGRATION] ✅ internal_feedback.user_id set to NOT NULL');
        } catch (e) {
          console.log(`[MIGRATION] internal_feedback.user_id already NOT NULL: ${e.message}`);
        }
      } else {
        console.warn(`[MIGRATION] ⚠️ SKIPPING NOT NULL enforcement: ${totalOrphans} orphaned rows need manual remediation`);
        console.warn('[MIGRATION] ⚠️ Please review orphaned rows above and assign them to correct tenants');
      }
      
      console.log('[MIGRATION] ✅ Multi-tenant isolation migration complete');
    } catch (e) {
      console.error('[MIGRATION] Warning: Multi-tenant migration may have already run:', e.message);
    }

    console.log('[MIGRATION] Creating Telegram tables...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS telegram_configs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        bot_token TEXT NOT NULL,
        chat_id VARCHAR(100) NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id)
      );
      
      CREATE INDEX IF NOT EXISTS idx_telegram_configs_user_id ON telegram_configs(user_id);
    `);
    console.log('[MIGRATION] ✅ Telegram configs table created');

    console.log('[MIGRATION] Creating pending reviews table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS pending_reviews (
        id SERIAL PRIMARY KEY,
        customer_name VARCHAR(255) NOT NULL,
        star_rating INTEGER NOT NULL CHECK (star_rating BETWEEN 1 AND 5),
        review_text TEXT NOT NULL,
        ai_proposed_reply TEXT NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    try {
      await pool.query(`
        ALTER TABLE pending_reviews 
        ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE
      `);
    } catch (e) {}

    try {
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_pending_reviews_user_id ON pending_reviews(user_id)`);
    } catch (e) {}
    try {
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_pending_reviews_status ON pending_reviews(status)`);
    } catch (e) {}
    try {
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_pending_reviews_created ON pending_reviews(created_at DESC)`);
    } catch (e) {}
    console.log('[MIGRATION] ✅ Pending reviews table created');

    console.log('\n✅ All database migrations completed successfully!');
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigrations();
