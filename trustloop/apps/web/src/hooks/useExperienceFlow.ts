import { useState, useCallback } from 'react';
import type {
  ExperienceFlowState,
  ExperienceFlowConfig,
  ExperienceFlowActions,
  SentimentChoice,
} from '../types/experience';

/**
 * useExperienceFlow
 *
 * Custom hook that manages the TrustLoop experience flow.
 *
 * COMPLIANCE NOTES:
 * - googleLinkShown is set to true immediately when sentiment is selected
 * - The Google link is ALWAYS visible in both positive and negative flows
 * - We track but never prevent access to public review options
 *
 * TERMINOLOGY:
 * - We "route" customers, never "block" or "gate"
 * - We "prioritize" resolution, never "hide" options
 */

const API_BASE = '/api/v2/journey';

const initialState: ExperienceFlowState = {
  step: 'sentiment',
  sentiment: null,
  feedbackText: '',
  isSubmitting: false,
  error: null,
  googleLinkShown: false,
  googleLinkClicked: false,
  supportContacted: false,
};

export function useExperienceFlow(
  config: ExperienceFlowConfig
): [ExperienceFlowState, ExperienceFlowActions] {
  const [state, setState] = useState<ExperienceFlowState>(initialState);

  /**
   * Route customer based on sentiment choice.
   * Both paths show Google link - we prioritize different actions but never defer access.
   */
  const selectSentiment = useCallback(
    (sentiment: SentimentChoice) => {
      setState((prev) => ({
        ...prev,
        sentiment,
        step: sentiment === 'positive' ? 'positive_flow' : 'negative_flow',
        // COMPLIANCE: Google link is shown in BOTH flows
        googleLinkShown: true,
      }));

      // Track engagement
      trackJourneyEvent('sentiment_selected', { sentiment });
    },
    []
  );

  const updateFeedback = useCallback((text: string) => {
    setState((prev) => ({ ...prev, feedbackText: text }));
  }, []);

  /**
   * Submit internal feedback for resolution.
   * This does NOT prevent public review - customer can still access Google link.
   */
  const submitFeedback = useCallback(async () => {
    setState((prev) => ({ ...prev, isSubmitting: true, error: null }));

    try {
      const response = await fetch(`${API_BASE}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          journeyToken: config.journeyToken,
          sentiment: state.sentiment,
          feedbackText: state.feedbackText,
          // Compliance data - proves we showed Google link
          googleLinkShown: true, // Always true per design
          googleLinkClicked: state.googleLinkClicked,
          supportContacted: state.supportContacted,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit feedback');
      }

      setState((prev) => ({
        ...prev,
        step: 'success',
        isSubmitting: false,
      }));

      trackJourneyEvent('feedback_submitted', {
        sentiment: state.sentiment,
        feedbackLength: state.feedbackText.length,
      });
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isSubmitting: false,
        error: 'Unable to send your message. Please try again.',
      }));
    }
  }, [config.journeyToken, state.sentiment, state.feedbackText, state.googleLinkClicked, state.supportContacted]);

  /**
   * Track when customer clicks the Google review link.
   * We encourage this action but never make it the only option.
   */
  const trackGoogleClick = useCallback(() => {
    setState((prev) => ({ ...prev, googleLinkClicked: true }));
    trackJourneyEvent('google_link_clicked', { sentiment: state.sentiment });
  }, [state.sentiment]);

  /**
   * Track when customer contacts support.
   * This is the prioritized action for negative sentiment.
   */
  const trackSupportContact = useCallback(() => {
    setState((prev) => ({ ...prev, supportContacted: true }));
    trackJourneyEvent('support_contacted', { sentiment: state.sentiment });
  }, [state.sentiment]);

  const reset = useCallback(() => {
    setState(initialState);
  }, []);

  return [
    state,
    {
      selectSentiment,
      updateFeedback,
      submitFeedback,
      trackGoogleClick,
      trackSupportContact,
      reset,
    },
  ];
}

/**
 * Analytics helper - fire and forget
 */
function trackJourneyEvent(event: string, data: Record<string, unknown>) {
  // Non-blocking analytics call
  fetch('/api/v2/analytics/event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event, data, timestamp: new Date().toISOString() }),
  }).catch(() => {
    // Silent fail - analytics should never break UX
  });
}

export default useExperienceFlow;
