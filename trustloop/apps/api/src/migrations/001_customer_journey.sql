-- =============================================================================
-- TrustLoop Customer Journey Schema
-- Version: 1.0.0
-- Date: 2026-01-02
--
-- This schema tracks the customer journey through the TrustLoop resolution
-- engine. It is designed for FTC compliance auditing and analytics.
--
-- COMPLIANCE NOTES:
-- - google_link_shown must always be TRUE after engagement
-- - We track but never prevent access to public review options
-- - All state transitions are logged for audit trail
-- =============================================================================

-- Create ENUM for journey states
CREATE TYPE journey_state AS ENUM (
  'INVITED',           -- Initial SMS/email sent
  'ENGAGED',           -- Customer opened the link
  'SENTIMENT_POSITIVE',-- Customer indicated positive experience
  'SENTIMENT_NEGATIVE',-- Customer indicated issue
  'VENTING',           -- Customer is providing feedback
  'RESOLVED',          -- Issue was resolved internally
  'REVIEWED_PUBLIC',   -- Customer left public review
  'REVIVAL_READY'      -- Eligible for re-engagement
);

-- Create ENUM for deferral reasons
CREATE TYPE deferral_reason AS ENUM (
  'Operational_Risk_Flag',
  'Recently_Contacted',
  'VIP_Manual_Review',
  'Cooling_Off_Period',
  'Opt_Out',
  'High_Complaint_History',
  'Active_Support_Ticket'
);

-- Main customer journey table
CREATE TABLE IF NOT EXISTS customer_journey (
  -- Primary key
  journey_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign key to customers table
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,

  -- Foreign key to user (business owner)
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Current state in the journey
  current_state journey_state NOT NULL DEFAULT 'INVITED',

  -- Deferral tracking
  deferral_count INTEGER NOT NULL DEFAULT 0,
  last_deferral_reason deferral_reason,
  last_deferral_at TIMESTAMP WITH TIME ZONE,
  next_eligible_at TIMESTAMP WITH TIME ZONE,

  -- Risk signals (JSONB for flexibility)
  risk_signals JSONB NOT NULL DEFAULT '{
    "has_open_dispute": false,
    "has_late_payment": false,
    "complaint_history_count": 0,
    "chargeback_history": false,
    "sentiment_trend": "unknown"
  }'::jsonb,

  -- Sentiment tracking
  sentiment VARCHAR(10) CHECK (sentiment IN ('positive', 'negative')),
  feedback_text TEXT,
  feedback_rating INTEGER CHECK (feedback_rating >= 1 AND feedback_rating <= 5),

  -- Resolution tracking
  resolution_notes TEXT,
  resolved_by INTEGER REFERENCES users(id),

  -- FTC Compliance tracking - CRITICAL
  -- google_link_shown MUST be true after engagement
  google_link_shown BOOLEAN NOT NULL DEFAULT FALSE,
  google_link_clicked BOOLEAN NOT NULL DEFAULT FALSE,
  google_link_shown_at TIMESTAMP WITH TIME ZONE,
  google_link_clicked_at TIMESTAMP WITH TIME ZONE,

  -- Support tracking
  support_contacted BOOLEAN NOT NULL DEFAULT FALSE,
  support_contacted_at TIMESTAMP WITH TIME ZONE,
  support_channel VARCHAR(20), -- 'email', 'sms', 'phone', 'chat'

  -- Engagement tracking
  invite_sent_at TIMESTAMP WITH TIME ZONE,
  invite_channel VARCHAR(10), -- 'sms', 'email'
  link_opened_at TIMESTAMP WITH TIME ZONE,
  first_interaction_at TIMESTAMP WITH TIME ZONE,
  last_interaction_at TIMESTAMP WITH TIME ZONE,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP WITH TIME ZONE,

  -- Secure tracking token
  tracking_token VARCHAR(64) UNIQUE NOT NULL
);

-- Indexes for common queries
CREATE INDEX idx_customer_journey_customer_id ON customer_journey(customer_id);
CREATE INDEX idx_customer_journey_user_id ON customer_journey(user_id);
CREATE INDEX idx_customer_journey_state ON customer_journey(current_state);
CREATE INDEX idx_customer_journey_tracking_token ON customer_journey(tracking_token);
CREATE INDEX idx_customer_journey_created_at ON customer_journey(created_at DESC);
CREATE INDEX idx_customer_journey_sentiment ON customer_journey(sentiment) WHERE sentiment IS NOT NULL;

-- Composite index for user dashboard queries
CREATE INDEX idx_customer_journey_user_state_date ON customer_journey(user_id, current_state, created_at DESC);

-- Index for finding journeys needing follow-up
CREATE INDEX idx_customer_journey_followup ON customer_journey(user_id, current_state, last_interaction_at)
  WHERE current_state IN ('SENTIMENT_NEGATIVE', 'VENTING') AND resolved_at IS NULL;

-- =============================================================================
-- STATE TRANSITION AUDIT LOG
-- =============================================================================

CREATE TABLE IF NOT EXISTS journey_state_log (
  log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id UUID NOT NULL REFERENCES customer_journey(journey_id) ON DELETE CASCADE,
  previous_state journey_state,
  new_state journey_state NOT NULL,
  transition_reason TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by INTEGER REFERENCES users(id) -- NULL for system transitions
);

CREATE INDEX idx_journey_state_log_journey_id ON journey_state_log(journey_id);
CREATE INDEX idx_journey_state_log_created_at ON journey_state_log(created_at DESC);

-- =============================================================================
-- DEFERRAL HISTORY
-- =============================================================================

CREATE TABLE IF NOT EXISTS deferral_history (
  deferral_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason deferral_reason NOT NULL,
  rules_applied TEXT[] NOT NULL DEFAULT '{}',
  deferred_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  next_eligible_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_deferral_history_customer_id ON deferral_history(customer_id);
CREATE INDEX idx_deferral_history_deferred_at ON deferral_history(deferred_at DESC);

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_customer_journey_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for auto-updating timestamp
CREATE TRIGGER trigger_customer_journey_updated_at
  BEFORE UPDATE ON customer_journey
  FOR EACH ROW
  EXECUTE FUNCTION update_customer_journey_timestamp();

-- Function to log state transitions
CREATE OR REPLACE FUNCTION log_journey_state_transition()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.current_state IS DISTINCT FROM NEW.current_state THEN
    INSERT INTO journey_state_log (
      journey_id,
      previous_state,
      new_state,
      transition_reason,
      metadata
    ) VALUES (
      NEW.journey_id,
      OLD.current_state,
      NEW.current_state,
      NULL, -- Can be set by application
      jsonb_build_object(
        'sentiment', NEW.sentiment,
        'google_link_shown', NEW.google_link_shown,
        'support_contacted', NEW.support_contacted
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for state transition logging
CREATE TRIGGER trigger_journey_state_log
  AFTER UPDATE ON customer_journey
  FOR EACH ROW
  EXECUTE FUNCTION log_journey_state_transition();

-- =============================================================================
-- COMPLIANCE CHECK CONSTRAINT
-- =============================================================================

-- Ensure google_link_shown is true when customer has engaged
-- This is a soft enforcement - the application should ensure this
ALTER TABLE customer_journey
ADD CONSTRAINT check_google_link_compliance
CHECK (
  -- If customer has engaged (moved past INVITED state), google link should be shown
  (current_state = 'INVITED') OR
  (google_link_shown = TRUE)
);

-- =============================================================================
-- VIEWS FOR ANALYTICS
-- =============================================================================

-- View for resolution funnel metrics
CREATE OR REPLACE VIEW v_resolution_funnel AS
SELECT
  user_id,
  COUNT(*) as total_journeys,
  COUNT(*) FILTER (WHERE current_state = 'INVITED') as invited,
  COUNT(*) FILTER (WHERE current_state IN ('ENGAGED', 'SENTIMENT_POSITIVE', 'SENTIMENT_NEGATIVE', 'VENTING', 'RESOLVED', 'REVIEWED_PUBLIC')) as engaged,
  COUNT(*) FILTER (WHERE sentiment = 'positive') as positive_sentiment,
  COUNT(*) FILTER (WHERE sentiment = 'negative') as negative_sentiment,
  COUNT(*) FILTER (WHERE support_contacted = TRUE) as support_contacts,
  COUNT(*) FILTER (WHERE google_link_clicked = TRUE) as google_clicks,
  COUNT(*) FILTER (WHERE current_state = 'RESOLVED') as resolved,
  COUNT(*) FILTER (WHERE current_state = 'REVIEWED_PUBLIC') as public_reviews,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE current_state = 'RESOLVED') /
    NULLIF(COUNT(*) FILTER (WHERE sentiment = 'negative'), 0),
    2
  ) as resolution_rate,
  DATE_TRUNC('day', created_at) as date
FROM customer_journey
GROUP BY user_id, DATE_TRUNC('day', created_at);

-- =============================================================================
-- SAMPLE DATA FOR TESTING (OPTIONAL)
-- =============================================================================

-- Uncomment to insert sample data
/*
INSERT INTO customer_journey (
  customer_id,
  user_id,
  current_state,
  sentiment,
  google_link_shown,
  google_link_clicked,
  tracking_token,
  invite_channel
) VALUES
  (1, 1, 'SENTIMENT_POSITIVE', 'positive', TRUE, TRUE, 'test-token-1', 'sms'),
  (2, 1, 'VENTING', 'negative', TRUE, FALSE, 'test-token-2', 'sms'),
  (3, 1, 'RESOLVED', 'negative', TRUE, FALSE, 'test-token-3', 'email');
*/
