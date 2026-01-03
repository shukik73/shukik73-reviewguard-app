-- TrustLoop Complete Database Schema
-- FTC-Compliant Customer Experience Platform
-- Version 2.0 - Full Featured

-- =====================================================
-- USERS & AUTHENTICATION
-- =====================================================

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) DEFAULT 'owner', -- owner, admin, member
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE businesses (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  logo_url TEXT,
  phone VARCHAR(50),
  email VARCHAR(255),
  website VARCHAR(255),
  address TEXT,
  timezone VARCHAR(50) DEFAULT 'UTC',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE team_members (
  id SERIAL PRIMARY KEY,
  business_id INTEGER REFERENCES businesses(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(20) DEFAULT 'member', -- admin, member, viewer
  invited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  accepted_at TIMESTAMP,
  UNIQUE(business_id, user_id)
);

-- =====================================================
-- LOCATIONS (Multi-location support)
-- =====================================================

CREATE TABLE locations (
  id SERIAL PRIMARY KEY,
  business_id INTEGER REFERENCES businesses(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  address TEXT,
  phone VARCHAR(50),
  google_review_link TEXT,
  google_place_id VARCHAR(255),
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- CUSTOMERS
-- =====================================================

CREATE TABLE customers (
  id SERIAL PRIMARY KEY,
  business_id INTEGER REFERENCES businesses(id) ON DELETE CASCADE,
  location_id INTEGER REFERENCES locations(id) ON DELETE SET NULL,

  -- Contact info
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  email VARCHAR(255),
  phone VARCHAR(50),

  -- Tracking
  tracking_token VARCHAR(64) UNIQUE NOT NULL,
  source VARCHAR(50), -- manual, import, api, campaign

  -- Communication preferences
  sms_opted_in BOOLEAN DEFAULT TRUE,
  email_opted_in BOOLEAN DEFAULT TRUE,
  opted_out_at TIMESTAMP,

  -- Metadata
  tags TEXT[], -- Array of tags for segmentation
  custom_fields JSONB DEFAULT '{}',
  notes TEXT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE customer_imports (
  id SERIAL PRIMARY KEY,
  business_id INTEGER REFERENCES businesses(id) ON DELETE CASCADE,
  filename VARCHAR(255),
  total_rows INTEGER,
  imported_count INTEGER,
  failed_count INTEGER,
  status VARCHAR(20) DEFAULT 'pending', -- pending, processing, completed, failed
  error_log JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP
);

-- =====================================================
-- CAMPAIGNS
-- =====================================================

CREATE TABLE campaigns (
  id SERIAL PRIMARY KEY,
  business_id INTEGER REFERENCES businesses(id) ON DELETE CASCADE,
  location_id INTEGER REFERENCES locations(id) ON DELETE SET NULL,

  -- Campaign details
  name VARCHAR(255) NOT NULL,
  description TEXT,
  type VARCHAR(20) NOT NULL, -- sms, email, both

  -- Targeting
  target_segment JSONB, -- Filter criteria for customers
  target_tags TEXT[],

  -- Content
  sms_template TEXT,
  email_subject VARCHAR(255),
  email_template TEXT,

  -- Scheduling
  status VARCHAR(20) DEFAULT 'draft', -- draft, scheduled, sending, completed, cancelled
  scheduled_at TIMESTAMP,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,

  -- Stats
  total_recipients INTEGER DEFAULT 0,
  sent_count INTEGER DEFAULT 0,
  delivered_count INTEGER DEFAULT 0,
  opened_count INTEGER DEFAULT 0,
  clicked_count INTEGER DEFAULT 0,
  responded_count INTEGER DEFAULT 0,

  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE campaign_recipients (
  id SERIAL PRIMARY KEY,
  campaign_id INTEGER REFERENCES campaigns(id) ON DELETE CASCADE,
  customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,

  -- Delivery status
  channel VARCHAR(10), -- sms, email
  status VARCHAR(20) DEFAULT 'pending', -- pending, sent, delivered, failed, bounced
  sent_at TIMESTAMP,
  delivered_at TIMESTAMP,
  opened_at TIMESTAMP,
  clicked_at TIMESTAMP,

  -- Error tracking
  error_code VARCHAR(50),
  error_message TEXT,

  UNIQUE(campaign_id, customer_id, channel)
);

-- =====================================================
-- SMS
-- =====================================================

CREATE TABLE sms_settings (
  id SERIAL PRIMARY KEY,
  business_id INTEGER REFERENCES businesses(id) ON DELETE CASCADE,
  provider VARCHAR(50) DEFAULT 'twilio', -- twilio, messagebird, etc.
  sender_phone VARCHAR(50),
  sender_name VARCHAR(20), -- For providers that support alphanumeric sender
  api_credentials JSONB, -- Encrypted credentials
  is_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(business_id)
);

CREATE TABLE sms_templates (
  id SERIAL PRIMARY KEY,
  business_id INTEGER REFERENCES businesses(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  content TEXT NOT NULL,
  variables TEXT[], -- Available merge fields
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE sms_messages (
  id SERIAL PRIMARY KEY,
  business_id INTEGER REFERENCES businesses(id) ON DELETE CASCADE,
  customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  campaign_id INTEGER REFERENCES campaigns(id) ON DELETE SET NULL,

  -- Message details
  direction VARCHAR(10) NOT NULL, -- outbound, inbound
  from_number VARCHAR(50),
  to_number VARCHAR(50) NOT NULL,
  content TEXT NOT NULL,

  -- Delivery tracking
  status VARCHAR(20) DEFAULT 'queued', -- queued, sent, delivered, failed, received
  provider_message_id VARCHAR(255),
  sent_at TIMESTAMP,
  delivered_at TIMESTAMP,

  -- Error handling
  error_code VARCHAR(50),
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,

  -- Cost tracking
  segments INTEGER DEFAULT 1,
  cost_credits DECIMAL(10,4),

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- FEEDBACK & REVIEWS (FTC Compliant)
-- =====================================================

CREATE TABLE feedback_requests (
  id SERIAL PRIMARY KEY,
  business_id INTEGER REFERENCES businesses(id) ON DELETE CASCADE,
  customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
  location_id INTEGER REFERENCES locations(id) ON DELETE SET NULL,
  campaign_id INTEGER REFERENCES campaigns(id) ON DELETE SET NULL,

  -- Request details
  token VARCHAR(64) UNIQUE NOT NULL,
  channel VARCHAR(10), -- sms, email, link

  -- Status tracking
  status VARCHAR(20) DEFAULT 'sent', -- sent, opened, responded, expired
  sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  opened_at TIMESTAMP,
  responded_at TIMESTAMP,
  expires_at TIMESTAMP,

  -- FTC Compliance: Track that Google link was shown
  google_link_shown BOOLEAN NOT NULL DEFAULT TRUE,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE feedback_responses (
  id SERIAL PRIMARY KEY,
  feedback_request_id INTEGER REFERENCES feedback_requests(id) ON DELETE CASCADE,
  customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  business_id INTEGER REFERENCES businesses(id) ON DELETE CASCADE,

  -- Binary sentiment (FTC compliant - no star gating)
  sentiment VARCHAR(20) NOT NULL, -- positive, negative

  -- Optional additional feedback
  comment TEXT,

  -- Resolution tracking (for negative feedback)
  resolution_status VARCHAR(20), -- pending, in_progress, resolved, closed
  resolution_notes TEXT,
  resolved_by INTEGER REFERENCES users(id),
  resolved_at TIMESTAMP,

  -- FTC Compliance tracking
  google_link_shown BOOLEAN NOT NULL DEFAULT TRUE,
  google_link_clicked BOOLEAN DEFAULT FALSE,
  google_link_click_count INTEGER DEFAULT 0,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- FTC COMPLIANCE CONSTRAINT
  CONSTRAINT ftc_google_link_always_visible CHECK (google_link_shown = TRUE)
);

CREATE TABLE review_tracking (
  id SERIAL PRIMARY KEY,
  business_id INTEGER REFERENCES businesses(id) ON DELETE CASCADE,
  customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  location_id INTEGER REFERENCES locations(id) ON DELETE SET NULL,
  feedback_response_id INTEGER REFERENCES feedback_responses(id) ON DELETE SET NULL,

  -- Click tracking
  clicked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Review confirmation (optional - if they report back)
  review_confirmed BOOLEAN DEFAULT FALSE,
  review_platform VARCHAR(50), -- google, yelp, facebook, etc.

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- HISTORY / ACTIVITY LOG
-- =====================================================

CREATE TABLE activity_log (
  id SERIAL PRIMARY KEY,
  business_id INTEGER REFERENCES businesses(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,

  -- Activity details
  activity_type VARCHAR(50) NOT NULL,
  -- Types: customer_added, customer_imported, sms_sent, sms_received,
  --        email_sent, campaign_created, campaign_sent, feedback_received,
  --        review_clicked, resolution_started, resolution_completed,
  --        settings_updated, team_member_added, etc.

  description TEXT,
  metadata JSONB DEFAULT '{}',

  -- Related entities
  related_type VARCHAR(50), -- campaign, sms, feedback, etc.
  related_id INTEGER,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- BILLING
-- =====================================================

CREATE TABLE subscription_plans (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  slug VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,

  -- Pricing
  price_monthly DECIMAL(10,2),
  price_yearly DECIMAL(10,2),

  -- Limits
  max_customers INTEGER,
  max_locations INTEGER,
  max_team_members INTEGER,
  max_campaigns_per_month INTEGER,
  sms_credits_included INTEGER DEFAULT 0,

  -- Features
  features JSONB DEFAULT '{}',

  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE subscriptions (
  id SERIAL PRIMARY KEY,
  business_id INTEGER REFERENCES businesses(id) ON DELETE CASCADE,
  plan_id INTEGER REFERENCES subscription_plans(id),

  -- Subscription details
  status VARCHAR(20) DEFAULT 'active', -- active, past_due, cancelled, expired
  billing_cycle VARCHAR(20) DEFAULT 'monthly', -- monthly, yearly

  -- Dates
  current_period_start TIMESTAMP,
  current_period_end TIMESTAMP,
  cancelled_at TIMESTAMP,

  -- Payment provider
  stripe_subscription_id VARCHAR(255),
  stripe_customer_id VARCHAR(255),

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE sms_credits (
  id SERIAL PRIMARY KEY,
  business_id INTEGER REFERENCES businesses(id) ON DELETE CASCADE,

  -- Credit balance
  balance INTEGER DEFAULT 0,

  -- Tracking
  last_purchase_at TIMESTAMP,
  last_used_at TIMESTAMP,

  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE credit_transactions (
  id SERIAL PRIMARY KEY,
  business_id INTEGER REFERENCES businesses(id) ON DELETE CASCADE,

  -- Transaction details
  type VARCHAR(20) NOT NULL, -- purchase, usage, bonus, refund, expiry
  amount INTEGER NOT NULL, -- positive for credit, negative for debit
  balance_after INTEGER NOT NULL,

  description TEXT,

  -- Related entities
  related_type VARCHAR(50), -- sms_message, subscription, purchase
  related_id INTEGER,

  -- Payment info (for purchases)
  payment_amount DECIMAL(10,2),
  payment_currency VARCHAR(3) DEFAULT 'USD',
  stripe_payment_id VARCHAR(255),

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE invoices (
  id SERIAL PRIMARY KEY,
  business_id INTEGER REFERENCES businesses(id) ON DELETE CASCADE,
  subscription_id INTEGER REFERENCES subscriptions(id) ON DELETE SET NULL,

  -- Invoice details
  invoice_number VARCHAR(50) UNIQUE NOT NULL,
  status VARCHAR(20) DEFAULT 'pending', -- pending, paid, failed, refunded

  -- Amounts
  subtotal DECIMAL(10,2),
  tax DECIMAL(10,2) DEFAULT 0,
  total DECIMAL(10,2),
  currency VARCHAR(3) DEFAULT 'USD',

  -- Line items
  line_items JSONB DEFAULT '[]',

  -- Dates
  issued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  due_at TIMESTAMP,
  paid_at TIMESTAMP,

  -- Payment
  stripe_invoice_id VARCHAR(255),
  payment_method JSONB,

  -- PDF
  pdf_url TEXT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE payment_methods (
  id SERIAL PRIMARY KEY,
  business_id INTEGER REFERENCES businesses(id) ON DELETE CASCADE,

  -- Card details (tokenized)
  type VARCHAR(20) NOT NULL, -- card, bank_account
  brand VARCHAR(20), -- visa, mastercard, amex
  last_four VARCHAR(4),
  exp_month INTEGER,
  exp_year INTEGER,

  -- Stripe
  stripe_payment_method_id VARCHAR(255),

  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- SETTINGS
-- =====================================================

CREATE TABLE business_settings (
  id SERIAL PRIMARY KEY,
  business_id INTEGER REFERENCES businesses(id) ON DELETE CASCADE,

  -- Notification preferences
  notify_new_feedback BOOLEAN DEFAULT TRUE,
  notify_negative_feedback BOOLEAN DEFAULT TRUE,
  notify_review_clicks BOOLEAN DEFAULT TRUE,
  notification_email VARCHAR(255),

  -- Feedback widget settings
  widget_primary_color VARCHAR(7) DEFAULT '#0F766E',
  widget_logo_url TEXT,
  widget_custom_css TEXT,

  -- Auto-responses
  auto_respond_positive BOOLEAN DEFAULT FALSE,
  auto_respond_positive_message TEXT,
  auto_respond_negative BOOLEAN DEFAULT FALSE,
  auto_respond_negative_message TEXT,

  -- Follow-up settings
  follow_up_enabled BOOLEAN DEFAULT FALSE,
  follow_up_delay_days INTEGER DEFAULT 3,
  follow_up_template_id INTEGER,

  -- API access
  api_key VARCHAR(64) UNIQUE,
  api_enabled BOOLEAN DEFAULT FALSE,
  webhook_url TEXT,
  webhook_events TEXT[],

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(business_id)
);

CREATE TABLE email_templates (
  id SERIAL PRIMARY KEY,
  business_id INTEGER REFERENCES businesses(id) ON DELETE CASCADE,

  name VARCHAR(100) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  html_content TEXT NOT NULL,
  text_content TEXT,

  type VARCHAR(50), -- feedback_request, follow_up, resolution, welcome
  variables TEXT[],

  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- SESSION (for Express session store)
-- =====================================================

CREATE TABLE session (
  sid VARCHAR NOT NULL COLLATE "default",
  sess JSON NOT NULL,
  expire TIMESTAMP(6) NOT NULL,
  PRIMARY KEY (sid)
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Users & Auth
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_team_members_business ON team_members(business_id);

-- Customers
CREATE INDEX idx_customers_business ON customers(business_id);
CREATE INDEX idx_customers_token ON customers(tracking_token);
CREATE INDEX idx_customers_email ON customers(email);
CREATE INDEX idx_customers_phone ON customers(phone);
CREATE INDEX idx_customers_tags ON customers USING GIN(tags);

-- Campaigns
CREATE INDEX idx_campaigns_business ON campaigns(business_id);
CREATE INDEX idx_campaigns_status ON campaigns(status);
CREATE INDEX idx_campaigns_scheduled ON campaigns(scheduled_at);
CREATE INDEX idx_campaign_recipients_campaign ON campaign_recipients(campaign_id);
CREATE INDEX idx_campaign_recipients_customer ON campaign_recipients(customer_id);

-- SMS
CREATE INDEX idx_sms_business ON sms_messages(business_id);
CREATE INDEX idx_sms_customer ON sms_messages(customer_id);
CREATE INDEX idx_sms_status ON sms_messages(status);
CREATE INDEX idx_sms_created ON sms_messages(created_at);

-- Feedback
CREATE INDEX idx_feedback_requests_business ON feedback_requests(business_id);
CREATE INDEX idx_feedback_requests_customer ON feedback_requests(customer_id);
CREATE INDEX idx_feedback_requests_token ON feedback_requests(token);
CREATE INDEX idx_feedback_responses_business ON feedback_responses(business_id);
CREATE INDEX idx_feedback_responses_sentiment ON feedback_responses(sentiment);
CREATE INDEX idx_feedback_responses_resolution ON feedback_responses(resolution_status);

-- Activity Log
CREATE INDEX idx_activity_business ON activity_log(business_id);
CREATE INDEX idx_activity_customer ON activity_log(customer_id);
CREATE INDEX idx_activity_type ON activity_log(activity_type);
CREATE INDEX idx_activity_created ON activity_log(created_at);

-- Billing
CREATE INDEX idx_subscriptions_business ON subscriptions(business_id);
CREATE INDEX idx_invoices_business ON invoices(business_id);
CREATE INDEX idx_credit_transactions_business ON credit_transactions(business_id);

-- Session
CREATE INDEX idx_session_expire ON session(expire);

-- =====================================================
-- INITIAL DATA
-- =====================================================

-- Default subscription plans
INSERT INTO subscription_plans (name, slug, description, price_monthly, price_yearly, max_customers, max_locations, max_team_members, max_campaigns_per_month, sms_credits_included, features) VALUES
('Free', 'free', 'Get started with TrustLoop', 0, 0, 100, 1, 1, 5, 50, '{"feedback_widget": true, "basic_analytics": true}'),
('Pro', 'pro', 'For growing businesses', 49, 470, 1000, 3, 5, 50, 500, '{"feedback_widget": true, "advanced_analytics": true, "custom_branding": true, "email_support": true}'),
('Business', 'business', 'For larger teams', 149, 1430, 10000, 10, 20, -1, 2000, '{"feedback_widget": true, "advanced_analytics": true, "custom_branding": true, "priority_support": true, "api_access": true, "webhooks": true}');

-- Default SMS template
-- (Will be created per-business on signup)

-- =====================================================
-- VIEWS FOR ANALYTICS
-- =====================================================

CREATE OR REPLACE VIEW business_analytics AS
SELECT
  b.id as business_id,
  b.name as business_name,
  COUNT(DISTINCT c.id) as total_customers,
  COUNT(DISTINCT fr.id) as total_feedback_requests,
  COUNT(DISTINCT frs.id) as total_responses,
  COUNT(CASE WHEN frs.sentiment = 'positive' THEN 1 END) as positive_count,
  COUNT(CASE WHEN frs.sentiment = 'negative' THEN 1 END) as negative_count,
  COUNT(CASE WHEN frs.google_link_clicked = TRUE THEN 1 END) as google_clicks,
  COUNT(CASE WHEN frs.resolution_status = 'resolved' THEN 1 END) as resolutions_completed
FROM businesses b
LEFT JOIN customers c ON b.id = c.business_id
LEFT JOIN feedback_requests fr ON b.id = fr.business_id
LEFT JOIN feedback_responses frs ON fr.id = frs.feedback_request_id
GROUP BY b.id, b.name;

CREATE OR REPLACE VIEW campaign_analytics AS
SELECT
  c.id as campaign_id,
  c.name as campaign_name,
  c.business_id,
  c.status,
  c.scheduled_at,
  c.total_recipients,
  c.sent_count,
  c.delivered_count,
  c.opened_count,
  c.responded_count,
  CASE WHEN c.sent_count > 0
    THEN ROUND((c.delivered_count::DECIMAL / c.sent_count) * 100, 2)
    ELSE 0
  END as delivery_rate,
  CASE WHEN c.delivered_count > 0
    THEN ROUND((c.responded_count::DECIMAL / c.delivered_count) * 100, 2)
    ELSE 0
  END as response_rate
FROM campaigns c;
