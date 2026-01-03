-- TrustLoop Database Schema
-- FTC-Compliant Customer Experience Resolution Engine

-- Users table (business owners)
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  business_name VARCHAR(255) NOT NULL,
  google_review_link TEXT,
  support_email VARCHAR(255),
  support_phone VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Customers table (people being invited for feedback)
CREATE TABLE IF NOT EXISTS customers (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  tracking_token VARCHAR(64) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Customer Journey table (FTC-compliant tracking)
-- CRITICAL: google_link_shown must be TRUE for any terminal state
CREATE TABLE IF NOT EXISTS customer_journeys (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,

  -- Journey states: INVITED, SENTIMENT_POSITIVE, SENTIMENT_NEGATIVE,
  --                 RESOLUTION_OFFERED, RESOLUTION_ACCEPTED, COMPLETED
  current_state VARCHAR(50) NOT NULL DEFAULT 'INVITED',

  -- Binary sentiment (not star rating - FTC compliant)
  sentiment VARCHAR(20), -- 'positive' or 'negative'

  -- FTC Compliance: Google link visibility tracking
  google_link_shown BOOLEAN NOT NULL DEFAULT TRUE,
  google_link_clicked BOOLEAN DEFAULT FALSE,
  google_link_click_count INTEGER DEFAULT 0,

  -- Resolution tracking
  resolution_offered BOOLEAN DEFAULT FALSE,
  resolution_accepted BOOLEAN DEFAULT FALSE,
  resolution_notes TEXT,

  -- Timestamps
  invited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  sentiment_recorded_at TIMESTAMP,
  resolution_offered_at TIMESTAMP,
  completed_at TIMESTAMP,

  -- FTC COMPLIANCE CONSTRAINT:
  -- Google link must be shown for any state beyond initial invite
  CONSTRAINT ftc_google_link_visible
    CHECK ((current_state = 'INVITED') OR (google_link_shown = TRUE))
);

-- Smart DND (Do Not Disturb) table
-- Defers invites based on business rules - never blocks
CREATE TABLE IF NOT EXISTS smart_dnd (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
  reason VARCHAR(100) NOT NULL, -- 'recent_negative', 'frequency_limit', 'manual_pause'
  deferred_until TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- DND can be overridden by customer action
  overridden BOOLEAN DEFAULT FALSE,
  overridden_at TIMESTAMP
);

-- Invite history (for frequency limiting)
CREATE TABLE IF NOT EXISTS invite_history (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
  sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  channel VARCHAR(20) NOT NULL, -- 'email', 'sms'
  status VARCHAR(20) NOT NULL DEFAULT 'sent' -- 'sent', 'opened', 'completed'
);

-- Session table (for express-session with connect-pg-simple)
CREATE TABLE IF NOT EXISTS session (
  sid VARCHAR NOT NULL COLLATE "default",
  sess JSON NOT NULL,
  expire TIMESTAMP(6) NOT NULL,
  PRIMARY KEY (sid)
);
CREATE INDEX IF NOT EXISTS IDX_session_expire ON session (expire);

-- Analytics views (for dashboard)
CREATE OR REPLACE VIEW journey_analytics AS
SELECT
  u.id as user_id,
  u.business_name,
  COUNT(cj.id) as total_journeys,
  COUNT(CASE WHEN cj.sentiment = 'positive' THEN 1 END) as positive_count,
  COUNT(CASE WHEN cj.sentiment = 'negative' THEN 1 END) as negative_count,
  COUNT(CASE WHEN cj.google_link_clicked = TRUE THEN 1 END) as google_clicks,
  COUNT(CASE WHEN cj.resolution_accepted = TRUE THEN 1 END) as resolutions_accepted
FROM users u
LEFT JOIN customers c ON u.id = c.user_id
LEFT JOIN customer_journeys cj ON c.id = cj.customer_id
GROUP BY u.id, u.business_name;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_customers_user_id ON customers(user_id);
CREATE INDEX IF NOT EXISTS idx_customers_token ON customers(tracking_token);
CREATE INDEX IF NOT EXISTS idx_journeys_customer_id ON customer_journeys(customer_id);
CREATE INDEX IF NOT EXISTS idx_journeys_state ON customer_journeys(current_state);
CREATE INDEX IF NOT EXISTS idx_dnd_customer_id ON smart_dnd(customer_id);
CREATE INDEX IF NOT EXISTS idx_dnd_deferred_until ON smart_dnd(deferred_until);
