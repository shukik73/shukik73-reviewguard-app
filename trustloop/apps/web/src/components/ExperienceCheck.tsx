import React from 'react';
import { useExperienceFlow } from '../hooks/useExperienceFlow';
import type { ExperienceFlowConfig } from '../types/experience';

/**
 * ExperienceCheck Component
 *
 * The main TrustLoop widget implementing FTC-compliant "Choice-Preserving Resolution".
 *
 * COMPLIANCE DESIGN:
 * 1. Binary sentiment choice (no star ratings)
 * 2. Both flows ALWAYS show the Google review link
 * 3. Negative flow prioritizes resolution but never defers public review access
 * 4. All customer choices are tracked for audit trail
 *
 * TERMINOLOGY:
 * - We "route" customers to appropriate flows
 * - We "prioritize" resolution actions
 * - We NEVER "block", "gate", or "hide" review options
 */

interface ExperienceCheckProps {
  config: ExperienceFlowConfig;
  className?: string;
}

export function ExperienceCheck({ config, className = '' }: ExperienceCheckProps) {
  const [state, actions] = useExperienceFlow(config);

  return (
    <div className={`trustloop-widget ${className}`}>
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
          {/* Header */}
          <div className="p-6 pb-4 text-center border-b border-slate-100">
            {/* Logo - Trefoil Loop */}
            <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-teal-600 to-teal-700 rounded-xl flex items-center justify-center shadow-lg">
              <TrefoilLoopIcon className="w-10 h-10 text-white" />
            </div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {config.businessName}
            </p>
          </div>

          {/* Content Area */}
          <div className="p-6">
            {state.step === 'sentiment' && (
              <SentimentSelector onSelect={actions.selectSentiment} />
            )}

            {state.step === 'positive_flow' && (
              <PositiveFlow
                googleReviewUrl={config.googleReviewUrl}
                onGoogleClick={actions.trackGoogleClick}
              />
            )}

            {state.step === 'negative_flow' && (
              <NegativeFlow
                googleReviewUrl={config.googleReviewUrl}
                supportEmail={config.supportEmail}
                supportPhone={config.supportPhone}
                feedbackText={state.feedbackText}
                isSubmitting={state.isSubmitting}
                error={state.error}
                onFeedbackChange={actions.updateFeedback}
                onSubmit={actions.submitFeedback}
                onGoogleClick={actions.trackGoogleClick}
                onSupportContact={actions.trackSupportContact}
              />
            )}

            {state.step === 'success' && <SuccessScreen />}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-slate-50 text-center">
            <p className="text-xs text-slate-400">
              Powered by TrustLoop
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// STEP 1: SENTIMENT SELECTOR
// =============================================================================

interface SentimentSelectorProps {
  onSelect: (sentiment: 'positive' | 'negative') => void;
}

function SentimentSelector({ onSelect }: SentimentSelectorProps) {
  return (
    <div className="text-center">
      <h1 className="text-2xl font-bold text-slate-900 mb-2">
        How was your experience?
      </h1>
      <p className="text-slate-600 mb-8">
        Your feedback helps us serve you better
      </p>

      <div className="space-y-3">
        {/* Positive Option */}
        <button
          onClick={() => onSelect('positive')}
          className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-teal-600 to-teal-700 text-white rounded-xl font-semibold text-lg shadow-lg hover:shadow-xl hover:from-teal-700 hover:to-teal-800 transition-all duration-200 transform hover:-translate-y-0.5"
        >
          <ThumbsUpIcon className="w-6 h-6" />
          <span>Great!</span>
        </button>

        {/* Negative Option */}
        <button
          onClick={() => onSelect('negative')}
          className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-white text-slate-700 border-2 border-slate-200 rounded-xl font-semibold text-lg hover:border-slate-300 hover:bg-slate-50 transition-all duration-200"
        >
          <ThumbsDownIcon className="w-6 h-6" />
          <span>I had an issue</span>
        </button>
      </div>
    </div>
  );
}

// =============================================================================
// STEP 2A: POSITIVE FLOW
// =============================================================================

interface PositiveFlowProps {
  googleReviewUrl: string;
  onGoogleClick: () => void;
}

function PositiveFlow({ googleReviewUrl, onGoogleClick }: PositiveFlowProps) {
  const handleGoogleClick = () => {
    onGoogleClick();
    // Small delay for tracking, then redirect
    setTimeout(() => {
      window.location.href = googleReviewUrl;
    }, 100);
  };

  return (
    <div className="text-center animate-fade-in">
      <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center shadow-lg">
        <span className="text-4xl" role="img" aria-label="celebration">
          🎉
        </span>
      </div>

      <h1 className="text-2xl font-bold text-slate-900 mb-2">
        Awesome, thank you!
      </h1>
      <p className="text-slate-600 mb-8">
        Support us by sharing your experience on Google
      </p>

      <a
        href={googleReviewUrl}
        onClick={handleGoogleClick}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center justify-center gap-3 w-full px-6 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-semibold text-lg shadow-lg hover:shadow-xl hover:from-blue-700 hover:to-blue-800 transition-all duration-200"
      >
        <GoogleIcon className="w-6 h-6" />
        <span>Leave a Google Review</span>
      </a>
    </div>
  );
}

// =============================================================================
// STEP 2B: NEGATIVE FLOW (Resolution-First, but NEVER blocking Google)
// =============================================================================

interface NegativeFlowProps {
  googleReviewUrl: string;
  supportEmail?: string;
  supportPhone?: string;
  feedbackText: string;
  isSubmitting: boolean;
  error: string | null;
  onFeedbackChange: (text: string) => void;
  onSubmit: () => void;
  onGoogleClick: () => void;
  onSupportContact: () => void;
}

function NegativeFlow({
  googleReviewUrl,
  supportEmail,
  supportPhone,
  feedbackText,
  isSubmitting,
  error,
  onFeedbackChange,
  onSubmit,
  onGoogleClick,
  onSupportContact,
}: NegativeFlowProps) {
  const handleSupportClick = () => {
    onSupportContact();
    // Route to support channel
    if (supportPhone) {
      window.location.href = `sms:${supportPhone}`;
    } else if (supportEmail) {
      window.location.href = `mailto:${supportEmail}?subject=Customer Support Request`;
    }
  };

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="text-center mb-6">
        <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
          <span className="text-2xl" role="img" aria-label="target">
            🎯
          </span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">
          We want to fix this immediately
        </h1>
        <p className="text-slate-600">
          Tell us what happened and we'll make it right
        </p>
      </div>

      {/* Priority Badge */}
      <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-full text-sm font-semibold mb-4">
        <span role="img" aria-label="crown">👑</span>
        VIP Priority Resolution
      </div>

      {/* Feedback Form */}
      <div className="space-y-4">
        <textarea
          value={feedbackText}
          onChange={(e) => onFeedbackChange(e.target.value)}
          placeholder="Tell us what happened and how we can make it right..."
          className="w-full h-32 px-4 py-3 border-2 border-slate-200 rounded-xl resize-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 focus:outline-none transition-all text-slate-700 placeholder:text-slate-400"
        />

        {error && (
          <p className="text-red-600 text-sm">{error}</p>
        )}

        {/* PRIMARY ACTION: Chat with Support */}
        <button
          onClick={supportPhone || supportEmail ? handleSupportClick : onSubmit}
          disabled={isSubmitting}
          className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-semibold text-lg shadow-lg hover:shadow-xl hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            <span className="animate-spin">⏳</span>
          ) : (
            <ChatIcon className="w-6 h-6" />
          )}
          <span>
            {isSubmitting ? 'Sending...' : 'Chat with Priority Support'}
          </span>
        </button>

        <p className="text-xs text-slate-500 text-center">
          🔒 This goes directly to the owner - not posted publicly
        </p>
      </div>

      {/* SECONDARY ACTION: Google Review Link */}
      {/*
        COMPLIANCE CRITICAL: This link MUST always be visible.
        It is visually deprioritized (smaller, gray) but NEVER hidden.
      */}
      <div className="mt-6 pt-6 border-t border-slate-200">
        <a
          href={googleReviewUrl}
          onClick={onGoogleClick}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-center text-sm text-slate-500 hover:text-slate-700 underline underline-offset-2 transition-colors"
        >
          Or skip and leave public feedback
        </a>
      </div>
    </div>
  );
}

// =============================================================================
// SUCCESS SCREEN
// =============================================================================

function SuccessScreen() {
  return (
    <div className="text-center animate-fade-in">
      <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center shadow-lg">
        <CheckIcon className="w-10 h-10 text-white" />
      </div>

      <h1 className="text-2xl font-bold text-slate-900 mb-2">
        Message Received!
      </h1>
      <p className="text-slate-600">
        Thank you for reaching out. The owner will review your message and get back to you soon.
      </p>
    </div>
  );
}

// =============================================================================
// ICONS
// =============================================================================

function TrefoilLoopIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2a4 4 0 0 1 4 4c0 1.5-.8 2.8-2 3.5" />
      <path d="M12 2a4 4 0 0 0-4 4c0 1.5.8 2.8 2 3.5" />
      <circle cx="12" cy="12" r="2" fill="currentColor" />
      <path d="M12 22a4 4 0 0 1-4-4c0-1.5.8-2.8 2-3.5" />
      <path d="M12 22a4 4 0 0 0 4-4c0-1.5-.8-2.8-2-3.5" />
      <path d="M2 12a4 4 0 0 1 4-4c1.5 0 2.8.8 3.5 2" />
      <path d="M22 12a4 4 0 0 0-4-4c-1.5 0-2.8.8-3.5 2" />
    </svg>
  );
}

function ThumbsUpIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
    </svg>
  );
}

function ThumbsDownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17" />
    </svg>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

function ChatIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export default ExperienceCheck;
