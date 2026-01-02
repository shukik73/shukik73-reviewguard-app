/**
 * Customer Types for TrustLoop API
 *
 * TERMINOLOGY STANDARDS:
 * - DEFER: Postpone invite due to business rules (never "block")
 * - ROUTE: Direct to appropriate flow (never "gate")
 * - PRIORITIZE: Emphasize actions (never "hide")
 */

export type CRMStatus =
  | 'Active'
  | 'Dispute'
  | 'Late_Payment'
  | 'Closed'
  | 'VIP'
  | 'Churned';

export interface Customer {
  id: string;
  email?: string;
  phone?: string;
  name: string;
  crm_status: CRMStatus;
  last_invite_date: Date | null;
  total_transactions: number;
  lifetime_value: number;
  created_at: Date;
  updated_at: Date;
}

export interface RiskSignals {
  has_open_dispute: boolean;
  has_late_payment: boolean;
  complaint_history_count: number;
  chargeback_history: boolean;
  sentiment_trend: 'positive' | 'neutral' | 'negative' | 'unknown';
  last_negative_interaction?: Date;
}

export interface CustomerWithRisk extends Customer {
  risk_signals: RiskSignals;
}

// =============================================================================
// INVITE ELIGIBILITY TYPES
// =============================================================================

/**
 * InviteAction represents the decision to proceed or defer an invite.
 * NOTE: We "defer" invites, we never "block" them.
 */
export type InviteAction =
  | { action: 'PROCEED'; reason?: never }
  | { action: 'DEFER'; reason: DeferralReason };

/**
 * Reasons for deferring an invite.
 * Each reason should be actionable and reversible.
 */
export type DeferralReason =
  | 'Operational_Risk_Flag'    // Customer has dispute or payment issue
  | 'Recently_Contacted'       // Fatigue rule - contacted within window
  | 'VIP_Manual_Review'        // High-value customer needs approval
  | 'Cooling_Off_Period'       // Post-resolution waiting period
  | 'Opt_Out'                  // Customer explicitly opted out
  | 'High_Complaint_History'   // Too many past complaints
  | 'Active_Support_Ticket';   // Has unresolved support issue

export interface EligibilityCheckResult {
  eligible: boolean;
  action: InviteAction;
  customer_id: string;
  checked_at: Date;
  rules_applied: string[];
  next_eligible_date?: Date;
  recommended_channel?: 'sms' | 'email' | 'none';
}

// =============================================================================
// ELIGIBILITY RULE TYPES
// =============================================================================

export interface EligibilityRule {
  name: string;
  description: string;
  priority: number;  // Lower = higher priority
  check: (customer: CustomerWithRisk) => InviteAction | null;
}

export interface EligibilityConfig {
  fatigue_window_days: number;       // Default: 30
  cooling_off_days: number;          // Default: 7
  max_complaint_threshold: number;   // Default: 3
  vip_threshold_ltv: number;         // Default: 1000
  enable_vip_review: boolean;        // Default: false
}

export const DEFAULT_ELIGIBILITY_CONFIG: EligibilityConfig = {
  fatigue_window_days: 30,
  cooling_off_days: 7,
  max_complaint_threshold: 3,
  vip_threshold_ltv: 1000,
  enable_vip_review: false,
};
