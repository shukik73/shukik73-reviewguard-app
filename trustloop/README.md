# TrustLoop - FTC-Compliant Resolution Engine

## Project Structure

```
trustloop/
├── apps/
│   ├── web/                          # React (Vite) Frontend
│   │   ├── src/
│   │   │   ├── components/           # UI Components
│   │   │   │   ├── ExperienceCheck.tsx
│   │   │   │   ├── SentimentSelector.tsx
│   │   │   │   ├── ResolutionFlow.tsx
│   │   │   │   └── GoogleReviewPrompt.tsx
│   │   │   ├── hooks/                # Custom React Hooks
│   │   │   │   ├── useExperienceFlow.ts
│   │   │   │   └── useJourneyTracking.ts
│   │   │   ├── lib/                  # Utilities
│   │   │   │   └── analytics.ts
│   │   │   ├── types/                # TypeScript Types
│   │   │   │   └── experience.ts
│   │   │   └── styles/               # Tailwind CSS
│   │   │       └── globals.css
│   │   ├── tailwind.config.ts
│   │   ├── vite.config.ts
│   │   └── package.json
│   │
│   └── api/                          # Node.js Backend
│       ├── src/
│       │   ├── routes/
│       │   │   └── journey.ts
│       │   ├── middleware/
│       │   │   └── eligibility.ts    # Smart DND Layer
│       │   ├── services/
│       │   │   └── journeyService.ts
│       │   └── types/
│       │       └── customer.ts
│       └── package.json
│
├── packages/
│   ├── shared-types/                 # Shared TypeScript Types
│   │   └── src/
│   │       └── index.ts
│   └── ui/                           # Shared UI Components
│       └── src/
│           └── index.ts
│
└── README.md
```

## Core Principles

### FTC Compliance: Choice-Preserving Resolution

**BANNED Patterns (Review Gating):**
- `if (rating < 4) { hideGoogleLink(); }` ❌
- Blocking negative reviewers from public platforms ❌
- Conditional display of review links based on sentiment ❌

**REQUIRED Patterns (Resolution Engine):**
- Binary sentiment collection (no star ratings) ✅
- All customers can always access public review options ✅
- UX hierarchy guides but never blocks ✅
- Secondary action (Google link) always visible ✅

### Terminology Standards

| BANNED | USE INSTEAD |
|--------|-------------|
| Block | Defer |
| Gate | Route |
| Hide | Prioritize |
| Filter (for reviews) | Triage |

## Quick Start

```bash
# Install dependencies
pnpm install

# Start development
pnpm dev

# Run tests
pnpm test
```

## Architecture Decision Records

### ADR-001: Binary Sentiment vs Star Ratings
**Decision:** Use binary sentiment ("Great!" / "I had an issue") instead of 5-star ratings.
**Rationale:**
- Clearer user intent
- Avoids "gating" perception
- Faster interaction
- Better conversion to resolution

### ADR-002: Always-Visible Public Review Option
**Decision:** The Google review link must always be visible and accessible.
**Rationale:** FTC compliance requires that all customers have equal access to public review platforms regardless of sentiment.
