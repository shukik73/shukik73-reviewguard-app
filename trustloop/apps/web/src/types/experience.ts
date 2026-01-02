/**
 * Experience Widget Types
 *
 * Note: These types ensure FTC compliance by requiring
 * google link visibility tracking at the type level.
 */

export type SentimentChoice = 'positive' | 'negative';

export type ExperienceStep =
  | 'sentiment'     // Initial binary choice
  | 'positive_flow' // Thank you + Google link
  | 'negative_flow' // Resolution options + Google link (always visible)
  | 'feedback'      // Internal feedback form
  | 'success';      // Confirmation screen

export interface ExperienceFlowState {
  step: ExperienceStep;
  sentiment: SentimentChoice | null;
  feedbackText: string;
  isSubmitting: boolean;
  error: string | null;
  // Compliance tracking - these help prove we never "hide" Google
  googleLinkShown: boolean;   // Should always be true after sentiment
  googleLinkClicked: boolean;
  supportContacted: boolean;
}

export interface ExperienceFlowConfig {
  businessName: string;
  googleReviewUrl: string;
  supportEmail?: string;
  supportPhone?: string;
  logoUrl?: string;
  journeyToken: string;
}

export interface ExperienceFlowActions {
  selectSentiment: (sentiment: SentimentChoice) => void;
  updateFeedback: (text: string) => void;
  submitFeedback: () => Promise<void>;
  trackGoogleClick: () => void;
  trackSupportContact: () => void;
  reset: () => void;
}
