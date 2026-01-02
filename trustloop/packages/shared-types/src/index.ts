/**
 * TrustLoop Shared Types
 *
 * TERMINOLOGY STANDARDS:
 * - DEFER (not "block"): Postpone action due to business rules
 * - ROUTE (not "gate"): Direct customer to appropriate flow
 * - PRIORITIZE (not "hide"): Emphasize certain actions over others
 */

// =============================================================================
// CUSTOMER TYPES
// =============================================================================

export type CRMStatus = 'Active' | 'Dispute' | 'Late_Payment' | 'Closed' | 'VIP';

export interface Customer {
  id: string;
  email?: string;
  phone?: string;
  name: string;
  crm_status: CRMStatus;
  last_invite_date: Date | null;
  total_transactions: number;
  lifetime_value: number;
  risk_signals: RiskSignals;
  created_at: Date;
  updated_at: Date;
}

export interface RiskSignals {
  has_open_dispute: boolean;
  has_late_payment: boolean;
  complaint_history_count: number;
  chargeback_history: boolean;
  sentiment_trend: 'positive' | 'neutral' | 'negative' | 'unknown';
}

// =============================================================================
// JOURNEY TYPES
// =============================================================================

export type JourneyState =
  | 'INVITED'           // Initial SMS/email sent
  | 'ENGAGED'           // Customer opened the link
  | 'SENTIMENT_POSITIVE'// Customer indicated positive experience
  | 'SENTIMENT_NEGATIVE'// Customer indicated issue
  | 'VENTING'           // Customer is providing feedback
  | 'RESOLVED'          // Issue was resolved internally
  | 'REVIEWED_PUBLIC'   // Customer left public review
  | 'REVIVAL_READY';    // Eligible for re-engagement

export interface CustomerJourney {
  journey_id: string;
  customer_id: string;
  current_state: JourneyState;
  deferral_count: number;
  risk_signals: RiskSignals;
  sentiment?: 'positive' | 'negative';
  feedback_text?: string;
  resolution_notes?: string;
  google_link_shown: boolean;  // Compliance tracking - must always be true
  google_link_clicked: boolean;
  support_contacted: boolean;
  created_at: Date;
  updated_at: Date;
  resolved_at?: Date;
}

// =============================================================================
// ELIGIBILITY TYPES
// =============================================================================

export type InviteAction =
  | { action: 'PROCEED'; reason?: never }
  | { action: 'DEFER'; reason: DeferralReason };

export type DeferralReason =
  | 'Operational_Risk_Flag'    // Dispute or payment issue
  | 'Recently_Contacted'       // Fatigue rule
  | 'VIP_Manual_Review'        // High-value customer needs approval
  | 'Cooling_Off_Period'       // Post-resolution waiting period
  | 'Opt_Out';                 // Customer opted out

export interface EligibilityCheckResult {
  eligible: boolean;
  action: InviteAction;
  customer_id: string;
  checked_at: Date;
  rules_applied: string[];
}

// =============================================================================
// EXPERIENCE WIDGET TYPES
// =============================================================================

export type SentimentChoice = 'positive' | 'negative';

export type ExperienceStep =
  | 'sentiment'     // Initial binary choice
  | 'positive_flow' // Thank you + Google link
  | 'negative_flow' // Resolution options + Google link (secondary)
  | 'feedback'      // Internal feedback form
  | 'success';      // Confirmation screen

export interface ExperienceFlowState {
  step: ExperienceStep;
  sentiment: SentimentChoice | null;
  feedbackText: string;
  isSubmitting: boolean;
  error: string | null;
  googleLinkClicked: boolean;
  supportContacted: boolean;
}

export interface ExperienceFlowConfig {
  businessName: string;
  googleReviewUrl: string;
  supportEmail?: string;
  supportPhone?: string;
  logoUrl?: string;
  primaryColor?: string;
}

// =============================================================================
// API TYPES
// =============================================================================

export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

export interface FeedbackSubmission {
  journeyId: string;
  sentiment: SentimentChoice;
  feedbackText?: string;
  googleLinkShown: boolean;  // Compliance: always true
  googleLinkClicked: boolean;
  supportContacted: boolean;
}

export interface FeedbackResponse {
  success: boolean;
  journey_id: string;
  state: JourneyState;
  message: string;
}
