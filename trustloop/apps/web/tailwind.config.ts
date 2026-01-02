import type { Config } from 'tailwindcss';

/**
 * TrustLoop Design System - Tailwind Configuration
 *
 * Design Philosophy: "Institutional Trust"
 * - Enterprise SaaS aesthetic (similar to Stripe/Linear)
 * - Clean, professional, confidence-inspiring
 * - Deep Teal primary for trust and reliability
 * - Clean white/slate backgrounds for clarity
 *
 * NOT: Security/police vibes, aggressive colors, or consumer app playfulness
 */

const config: Config = {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      // =======================================================================
      // COLORS
      // =======================================================================
      colors: {
        // Primary: Deep Teal - Trust, reliability, professionalism
        primary: {
          50: '#f0fdfa',
          100: '#ccfbf1',
          200: '#99f6e4',
          300: '#5eead4',
          400: '#2dd4bf',
          500: '#14b8a6',
          600: '#0d9488',
          700: '#0f766e', // Main primary
          800: '#115e59',
          900: '#134e4a',
          950: '#042f2e',
        },
        // Secondary: Navy Blue - Authority, stability
        secondary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e3a8a', // Main secondary
          900: '#1e3a8a',
          950: '#172554',
        },
        // Accent: Indigo - Premium, resolution
        accent: {
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
          950: '#1e1b4b',
        },
        // Success: Emerald - Positive outcomes, resolution
        success: {
          50: '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
          800: '#065f46',
          900: '#064e3b',
          950: '#022c22',
        },
        // Warning: Amber - Attention needed
        warning: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
          950: '#451a03',
        },
        // Error: Rose - Issues that need attention
        error: {
          50: '#fff1f2',
          100: '#ffe4e6',
          200: '#fecdd3',
          300: '#fda4af',
          400: '#fb7185',
          500: '#f43f5e',
          600: '#e11d48',
          700: '#be123c',
          800: '#9f1239',
          900: '#881337',
          950: '#4c0519',
        },
      },

      // =======================================================================
      // FONTS
      // =======================================================================
      fontFamily: {
        sans: [
          'Inter',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
        mono: [
          'JetBrains Mono',
          'Fira Code',
          'Monaco',
          'Consolas',
          'Liberation Mono',
          'Courier New',
          'monospace',
        ],
      },

      // =======================================================================
      // TYPOGRAPHY
      // =======================================================================
      fontSize: {
        'xs': ['0.75rem', { lineHeight: '1rem' }],
        'sm': ['0.875rem', { lineHeight: '1.25rem' }],
        'base': ['1rem', { lineHeight: '1.5rem' }],
        'lg': ['1.125rem', { lineHeight: '1.75rem' }],
        'xl': ['1.25rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.5rem', { lineHeight: '2rem' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
        '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
        '5xl': ['3rem', { lineHeight: '1.16' }],
      },

      // =======================================================================
      // SPACING & SIZING
      // =======================================================================
      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
        '88': '22rem',
        '128': '32rem',
      },

      // =======================================================================
      // SHADOWS
      // =======================================================================
      boxShadow: {
        'soft': '0 2px 8px -2px rgba(0, 0, 0, 0.05), 0 4px 16px -4px rgba(0, 0, 0, 0.05)',
        'medium': '0 4px 12px -4px rgba(0, 0, 0, 0.08), 0 8px 24px -8px rgba(0, 0, 0, 0.08)',
        'strong': '0 8px 24px -8px rgba(0, 0, 0, 0.12), 0 16px 48px -16px rgba(0, 0, 0, 0.12)',
        'card': '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)',
        'button': '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        'focus-ring': '0 0 0 3px rgba(15, 118, 110, 0.15)',
      },

      // =======================================================================
      // BORDER RADIUS
      // =======================================================================
      borderRadius: {
        'xl': '1rem',
        '2xl': '1.5rem',
        '3xl': '2rem',
      },

      // =======================================================================
      // ANIMATIONS
      // =======================================================================
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
        'spin-slow': 'spin 3s linear infinite',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
      },

      // =======================================================================
      // TRANSITIONS
      // =======================================================================
      transitionDuration: {
        '250': '250ms',
        '350': '350ms',
      },
      transitionTimingFunction: {
        'smooth': 'cubic-bezier(0.4, 0, 0.2, 1)',
        'bounce': 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
      },
    },
  },
  plugins: [
    // Custom plugin for component styles
    function({ addComponents, theme }: { addComponents: Function; theme: Function }) {
      addComponents({
        // Button base styles
        '.btn': {
          padding: `${theme('spacing.3')} ${theme('spacing.6')}`,
          borderRadius: theme('borderRadius.xl'),
          fontWeight: theme('fontWeight.semibold'),
          fontSize: theme('fontSize.base[0]'),
          lineHeight: theme('fontSize.base[1].lineHeight'),
          transition: 'all 200ms ease',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: theme('spacing.2'),
          '&:focus': {
            outline: 'none',
            boxShadow: theme('boxShadow.focus-ring'),
          },
        },
        '.btn-primary': {
          backgroundColor: theme('colors.primary.700'),
          color: theme('colors.white'),
          '&:hover': {
            backgroundColor: theme('colors.primary.800'),
          },
        },
        '.btn-secondary': {
          backgroundColor: theme('colors.white'),
          color: theme('colors.slate.700'),
          border: `2px solid ${theme('colors.slate.200')}`,
          '&:hover': {
            backgroundColor: theme('colors.slate.50'),
            borderColor: theme('colors.slate.300'),
          },
        },
        // Card styles
        '.card': {
          backgroundColor: theme('colors.white'),
          borderRadius: theme('borderRadius.2xl'),
          boxShadow: theme('boxShadow.card'),
          border: `1px solid ${theme('colors.slate.200')}`,
        },
        // Input styles
        '.input': {
          width: '100%',
          padding: `${theme('spacing.3')} ${theme('spacing.4')}`,
          borderRadius: theme('borderRadius.xl'),
          border: `2px solid ${theme('colors.slate.200')}`,
          fontSize: theme('fontSize.base[0]'),
          transition: 'all 150ms ease',
          '&:focus': {
            outline: 'none',
            borderColor: theme('colors.primary.500'),
            boxShadow: theme('boxShadow.focus-ring'),
          },
          '&::placeholder': {
            color: theme('colors.slate.400'),
          },
        },
      });
    },
  ],
};

export default config;
