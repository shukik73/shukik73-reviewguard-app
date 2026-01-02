/**
 * TrustLoop Eligibility Middleware
 *
 * The "Smart DND" (Do Not Disturb) Layer
 *
 * This middleware determines if a customer should receive a review invite
 * based on business rules. It DEFERS invites for operational reasons,
 * it never BLOCKS customers from leaving reviews.
 *
 * TERMINOLOGY:
 * - DEFER: Postpone invite (can be rescheduled)
 * - PROCEED: Send invite now
 * - We never use "block", "gate", or "hide"
 *
 * COMPLIANCE NOTE:
 * This layer only controls OUTBOUND invite timing.
 * Customers can always access public review options when engaged.
 */

import type { Request, Response, NextFunction } from 'express';
import type {
  Customer,
  CustomerWithRisk,
  RiskSignals,
  InviteAction,
  DeferralReason,
  EligibilityCheckResult,
  EligibilityRule,
  EligibilityConfig,
  DEFAULT_ELIGIBILITY_CONFIG,
} from '../types/customer';

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Calculate days since a given date.
 * Returns Infinity if date is null (never contacted).
 */
function daysSince(date: Date | null): number {
  if (!date) return Infinity;
  const now = new Date();
  const diffMs = now.getTime() - new Date(date).getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Calculate when customer will next be eligible.
 */
function calculateNextEligibleDate(
  lastInviteDate: Date | null,
  fatigueWindowDays: number
): Date {
  if (!lastInviteDate) return new Date();
  const nextDate = new Date(lastInviteDate);
  nextDate.setDate(nextDate.getDate() + fatigueWindowDays);
  return nextDate;
}

// =============================================================================
// ELIGIBILITY RULES
// =============================================================================

/**
 * Create eligibility rules based on configuration.
 * Rules are evaluated in priority order (lower number = higher priority).
 */
function createEligibilityRules(config: EligibilityConfig): EligibilityRule[] {
  return [
    // Rule 1: Opt-out check (highest priority)
    {
      name: 'opt_out_check',
      description: 'Customer has opted out of communications',
      priority: 1,
      check: (customer: CustomerWithRisk): InviteAction | null => {
        // This would be checked against an opt-out table in production
        // Placeholder - actual implementation would query database
        return null;
      },
    },

    // Rule 2: Operational Risk - Dispute status
    {
      name: 'dispute_status_check',
      description: 'Customer has an open dispute',
      priority: 2,
      check: (customer: CustomerWithRisk): InviteAction | null => {
        if (customer.crm_status === 'Dispute') {
          return { action: 'DEFER', reason: 'Operational_Risk_Flag' };
        }
        if (customer.risk_signals.has_open_dispute) {
          return { action: 'DEFER', reason: 'Operational_Risk_Flag' };
        }
        return null;
      },
    },

    // Rule 3: Operational Risk - Payment status
    {
      name: 'payment_status_check',
      description: 'Customer has late payment',
      priority: 3,
      check: (customer: CustomerWithRisk): InviteAction | null => {
        if (customer.crm_status === 'Late_Payment') {
          return { action: 'DEFER', reason: 'Operational_Risk_Flag' };
        }
        if (customer.risk_signals.has_late_payment) {
          return { action: 'DEFER', reason: 'Operational_Risk_Flag' };
        }
        return null;
      },
    },

    // Rule 4: Fatigue Rule - Recently contacted
    {
      name: 'fatigue_check',
      description: 'Customer was recently contacted',
      priority: 4,
      check: (customer: CustomerWithRisk): InviteAction | null => {
        const daysSinceLastInvite = daysSince(customer.last_invite_date);
        if (daysSinceLastInvite < config.fatigue_window_days) {
          return { action: 'DEFER', reason: 'Recently_Contacted' };
        }
        return null;
      },
    },

    // Rule 5: High complaint history
    {
      name: 'complaint_history_check',
      description: 'Customer has high complaint history',
      priority: 5,
      check: (customer: CustomerWithRisk): InviteAction | null => {
        if (customer.risk_signals.complaint_history_count >= config.max_complaint_threshold) {
          return { action: 'DEFER', reason: 'High_Complaint_History' };
        }
        return null;
      },
    },

    // Rule 6: Cooling off period after negative sentiment
    {
      name: 'cooling_off_check',
      description: 'Customer recently had negative interaction',
      priority: 6,
      check: (customer: CustomerWithRisk): InviteAction | null => {
        if (customer.risk_signals.last_negative_interaction) {
          const daysSinceNegative = daysSince(customer.risk_signals.last_negative_interaction);
          if (daysSinceNegative < config.cooling_off_days) {
            return { action: 'DEFER', reason: 'Cooling_Off_Period' };
          }
        }
        return null;
      },
    },

    // Rule 7: VIP manual review (optional)
    {
      name: 'vip_review_check',
      description: 'VIP customer requires manual approval',
      priority: 7,
      check: (customer: CustomerWithRisk): InviteAction | null => {
        if (!config.enable_vip_review) return null;

        const isVIP =
          customer.crm_status === 'VIP' ||
          customer.lifetime_value >= config.vip_threshold_ltv;

        if (isVIP) {
          return { action: 'DEFER', reason: 'VIP_Manual_Review' };
        }
        return null;
      },
    },
  ];
}

// =============================================================================
// MAIN ELIGIBILITY CHECK FUNCTION
// =============================================================================

/**
 * Check if a customer is eligible for an invite.
 *
 * This function evaluates all business rules and returns a decision.
 * If no rules trigger a deferral, the customer is eligible.
 *
 * @param customer - The customer to check, including risk signals
 * @param config - Optional configuration overrides
 * @returns EligibilityCheckResult with decision and metadata
 */
export function checkInviteEligibility(
  customer: CustomerWithRisk,
  config: EligibilityConfig = {
    fatigue_window_days: 30,
    cooling_off_days: 7,
    max_complaint_threshold: 3,
    vip_threshold_ltv: 1000,
    enable_vip_review: false,
  }
): EligibilityCheckResult {
  const rules = createEligibilityRules(config);
  const rulesApplied: string[] = [];

  // Sort rules by priority
  const sortedRules = [...rules].sort((a, b) => a.priority - b.priority);

  // Evaluate rules in priority order
  for (const rule of sortedRules) {
    rulesApplied.push(rule.name);
    const result = rule.check(customer);

    if (result && result.action === 'DEFER') {
      return {
        eligible: false,
        action: result,
        customer_id: customer.id,
        checked_at: new Date(),
        rules_applied: rulesApplied,
        next_eligible_date: calculateNextEligibleDate(
          customer.last_invite_date,
          config.fatigue_window_days
        ),
        recommended_channel: 'none',
      };
    }
  }

  // All rules passed - customer is eligible
  return {
    eligible: true,
    action: { action: 'PROCEED' },
    customer_id: customer.id,
    checked_at: new Date(),
    rules_applied: rulesApplied,
    recommended_channel: customer.phone ? 'sms' : 'email',
  };
}

// =============================================================================
// EXPRESS MIDDLEWARE
// =============================================================================

/**
 * Express middleware for eligibility checking.
 *
 * Usage:
 * ```typescript
 * router.post('/api/invites/send',
 *   eligibilityMiddleware(),
 *   sendInviteHandler
 * );
 * ```
 */
export function eligibilityMiddleware(
  config?: Partial<EligibilityConfig>
) {
  const mergedConfig: EligibilityConfig = {
    fatigue_window_days: 30,
    cooling_off_days: 7,
    max_complaint_threshold: 3,
    vip_threshold_ltv: 1000,
    enable_vip_review: false,
    ...config,
  };

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const customerId = req.body.customer_id || req.params.customerId;

      if (!customerId) {
        return res.status(400).json({
          success: false,
          error: 'customer_id is required',
        });
      }

      // In production, fetch customer from database
      // const customer = await fetchCustomerWithRisk(customerId);
      // For now, we expect customer data in request body
      const customer = req.body.customer as CustomerWithRisk;

      if (!customer) {
        return res.status(400).json({
          success: false,
          error: 'Customer data not found',
        });
      }

      const eligibilityResult = checkInviteEligibility(customer, mergedConfig);

      // Attach result to request for downstream handlers
      (req as any).eligibility = eligibilityResult;

      if (!eligibilityResult.eligible) {
        // Invite deferred - return informative response
        return res.status(200).json({
          success: true,
          invite_sent: false,
          deferred: true,
          reason: eligibilityResult.action.reason,
          next_eligible_date: eligibilityResult.next_eligible_date,
          message: getDeferralMessage(eligibilityResult.action.reason as DeferralReason),
        });
      }

      // Customer is eligible - continue to send invite
      next();
    } catch (error) {
      console.error('[ELIGIBILITY] Error checking eligibility:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to check invite eligibility',
      });
    }
  };
}

/**
 * Get human-readable message for deferral reason.
 */
function getDeferralMessage(reason: DeferralReason): string {
  const messages: Record<DeferralReason, string> = {
    Operational_Risk_Flag:
      'Invite deferred: Customer has an open operational issue that should be resolved first.',
    Recently_Contacted:
      'Invite deferred: Customer was recently contacted. Waiting to avoid fatigue.',
    VIP_Manual_Review:
      'Invite deferred: VIP customer requires manual approval before outreach.',
    Cooling_Off_Period:
      'Invite deferred: Customer is in cooling-off period after recent interaction.',
    Opt_Out:
      'Invite deferred: Customer has opted out of communications.',
    High_Complaint_History:
      'Invite deferred: Customer has high complaint history. Consider personal outreach.',
    Active_Support_Ticket:
      'Invite deferred: Customer has an active support ticket. Resolve before inviting.',
  };

  return messages[reason] || 'Invite deferred for business reasons.';
}

// =============================================================================
// BATCH ELIGIBILITY CHECK
// =============================================================================

/**
 * Check eligibility for multiple customers.
 * Useful for campaign planning.
 *
 * @param customers - Array of customers to check
 * @param config - Optional configuration overrides
 * @returns Array of eligibility results with summary stats
 */
export function checkBatchEligibility(
  customers: CustomerWithRisk[],
  config?: Partial<EligibilityConfig>
): {
  results: EligibilityCheckResult[];
  summary: {
    total: number;
    eligible: number;
    deferred: number;
    by_reason: Record<string, number>;
  };
} {
  const mergedConfig: EligibilityConfig = {
    fatigue_window_days: 30,
    cooling_off_days: 7,
    max_complaint_threshold: 3,
    vip_threshold_ltv: 1000,
    enable_vip_review: false,
    ...config,
  };

  const results = customers.map((customer) =>
    checkInviteEligibility(customer, mergedConfig)
  );

  const eligible = results.filter((r) => r.eligible).length;
  const deferred = results.filter((r) => !r.eligible).length;

  const byReason: Record<string, number> = {};
  results
    .filter((r) => !r.eligible && r.action.reason)
    .forEach((r) => {
      const reason = r.action.reason as string;
      byReason[reason] = (byReason[reason] || 0) + 1;
    });

  return {
    results,
    summary: {
      total: customers.length,
      eligible,
      deferred,
      by_reason: byReason,
    },
  };
}

export default {
  checkInviteEligibility,
  eligibilityMiddleware,
  checkBatchEligibility,
};
