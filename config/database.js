import pg from 'pg';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

export async function initializeDatabase() {
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
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      phone VARCHAR(50) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, phone)
    );

    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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
    CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages(user_id);
    CREATE INDEX IF NOT EXISTS idx_messages_customer_id ON messages(customer_id);
    CREATE INDEX IF NOT EXISTS idx_customers_user_id ON customers(user_id);
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
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_event_logs_email ON event_logs(email);
    CREATE INDEX IF NOT EXISTS idx_event_logs_type ON event_logs(event_type);
    CREATE INDEX IF NOT EXISTS idx_event_logs_created ON event_logs(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_user_sessions_expire ON user_sessions(expire);
    CREATE INDEX IF NOT EXISTS idx_sms_optouts_phone ON sms_optouts(phone);
    CREATE INDEX IF NOT EXISTS idx_user_settings_email ON user_settings(user_email);
    CREATE INDEX IF NOT EXISTS idx_internal_feedback_user ON internal_feedback(user_email);
    CREATE INDEX IF NOT EXISTS idx_internal_feedback_created ON internal_feedback(created_at DESC);
  `);

  await pool.query(`
    DO $$ 
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='user_id') THEN
        ALTER TABLE customers ADD COLUMN user_id INTEGER NOT NULL DEFAULT 1 REFERENCES users(id) ON DELETE CASCADE;
        ALTER TABLE customers ADD CONSTRAINT customers_user_id_phone_unique UNIQUE(user_id, phone);
      END IF;
      
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='messages' AND column_name='user_id') THEN
        ALTER TABLE messages ADD COLUMN user_id INTEGER NOT NULL DEFAULT 1 REFERENCES users(id) ON DELETE CASCADE;
        CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages(user_id);
      END IF;
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
      
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='messages' AND column_name='follow_up_sent_at') THEN
        ALTER TABLE messages ADD COLUMN follow_up_sent_at TIMESTAMP;
      END IF;
      
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='messages' AND column_name='follow_up_due_at') THEN
        ALTER TABLE messages ADD COLUMN follow_up_due_at TIMESTAMP;
      END IF;
      
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='messages' AND column_name='follow_up_message_id') THEN
        ALTER TABLE messages ADD COLUMN follow_up_message_id INTEGER REFERENCES messages(id);
      END IF;
      
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='messages' AND column_name='user_email') THEN
        ALTER TABLE messages ADD COLUMN user_email VARCHAR(255) REFERENCES users(company_email);
      END IF;
      
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='messages' AND column_name='feedback_token') THEN
        ALTER TABLE messages ADD COLUMN feedback_token TEXT UNIQUE;
      END IF;
      
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='messages' AND column_name='feedback_rating') THEN
        ALTER TABLE messages ADD COLUMN feedback_rating INTEGER CHECK (feedback_rating BETWEEN 1 AND 5);
      END IF;
      
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='messages' AND column_name='feedback_collected_at') THEN
        ALTER TABLE messages ADD COLUMN feedback_collected_at TIMESTAMP;
      END IF;
      
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='messages' AND column_name='sms_consent_confirmed') THEN
        ALTER TABLE messages ADD COLUMN sms_consent_confirmed BOOLEAN DEFAULT NULL;
      END IF;
    END $$;
  `);

  console.log('✅ Database initialized');
}
