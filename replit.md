# Overview

This Node.js web application is a comprehensive SMS Manager for repair service businesses. Its core purpose is to streamline customer communication by enabling sending SMS/MMS for review requests or pickup notifications, tracking message history, managing customer data, and accessing analytics. Key features include OCR-powered data extraction from repair orders, intelligent review tracking with automated follow-ups, persistent storage via PostgreSQL, and a modern, tabbed UI. The project aims to enhance customer engagement and operational efficiency through integrated customer management, automated review collection, and analytical insights.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Application Structure

A single-page web application built with an Express.js backend and a PostgreSQL database, designed as a complete business tool for SMS messaging, history tracking, and customer relationship management.

## Backend Architecture

The application follows a clean **Model-View-Controller (MVC)** architecture with clear separation of concerns:

- **server.js** (94 lines): Ultra-minimal bootstrap - imports, middleware setup, and route mounting only. No business logic, no configuration.
- **/config/database.js**: Database connection pool and schema initialization logic. Exports `pool` and `initializeDatabase()`.
- **/utils/twilio.js**: Twilio credential fetching, client initialization, and phone validation utilities. Exports `getCredentials()`, `getTwilioClient()`, `getTwilioFromPhoneNumber()`, and `validateAndFormatPhone()`.
- **/utils/multerConfig.js**: Multer file upload configuration for both disk storage (photos) and memory storage (OCR).
- **/controllers**: Business logic organized by domain (auth, SMS/reviews, data, OCR, billing, settings, feedback). Each controller exports factory functions that receive dependencies (pool, Twilio helpers) and return route handlers.
- **/routes**: Route definitions that import controllers and create Express routers. Each route file maps HTTP endpoints to controller functions.
- **/controllers/feedbackController.js**: Handles customer feedback submission with two endpoints: `/api/feedback/internal` for 1-3 star ratings (stores in `internal_feedback` table and emails business owner) and `/api/feedback/public` for 4-5 star ratings (redirects to Google Review link).
- **/middleware**: Shared middleware like `requireAuth.js` for authentication enforcement and `rateLimiter.js` for rate limiting.

The refactored architecture reduces server.js from 2127 lines to 94 lines (96% reduction), with complete modularization of database, Twilio, and file upload logic. All business logic is domain-separated. **Security**: SESSION_SECRET has no fallback - the app performs startup validation and immediately exits with clear error messages if DATABASE_URL or SESSION_SECRET are missing. Phone numbers are normalized to E.164 format.

### Phone Number Validation

Phone numbers are normalized to the E.164 format, stripping non-digit characters, handling international prefixes, and auto-adding the US country code for 10-digit numbers.

### OCR Text Extraction

**Google Cloud Vision API Integration** provides professional-grade OCR for reliable text extraction from repair order photos. It extracts customer name, phone number (E.164), device type, and repair issue. Smart template generation suggests contextual messages based on extracted device and repair information. Processing involves a backend OCR endpoint (`/api/ocr/process`) with in-memory image processing using Sharp for preprocessing, Google Cloud Vision for detection, and smart parsing for keyword-based extraction.

### Review Tracking & Follow-up System

A hybrid system tracks review link clicks via unique tokens and monitors review status (Pending, Link Clicked, Reviewed, Follow-up Sent). It automatically flags customers for follow-up after 3 days if no click, allows manual confirmation of received reviews, and provides dashboard analytics with one-click bulk follow-ups.

### User Authentication

A production-ready user authentication system supports multi-tenancy with personalized branding. It includes secure sign-up with company branding, bcrypt password hashing, PostgreSQL-backed session management with CSRF protection, transaction-safe signup, and automated welcome emails. A secure, email-based password reset flow with crypto-secure, one-time-use tokens is also implemented.

### Subscription Billing

Stripe Subscription Billing is integrated with transaction-based, race-condition-free SMS quota enforcement. This includes trial accounts (50 SMS), tiered subscription plans (Starter: 500 SMS, Pro: 2000 SMS) via Stripe Checkout, email-based tracking, and Stripe webhooks for subscription status updates. Quota enforcement uses PostgreSQL row-level locking to prevent concurrent quota bypass and ensures atomic quota reservation with rollback on failure.

### AI-Powered Review Reply Assistant

An OpenAI-powered system generates SEO-optimized Google Review responses following "10 Golden Rules" with server-side enforcement. The system uses gpt-4o-mini via Replit AI Integrations (no API key required, billed to credits).

**The 10 Golden Rules:**

**For Positive Reviews (4-5 stars):**
1. **Device Rule (Mandatory)**: If customer mentions a device (iPhone, iPad, laptop, etc.), the reply MUST mention that exact device. Server-side validation automatically detects devices in reviews and rejects AI responses that fail to mention them.
2. **Cross-Sell**: Occasionally mention other services (laptops, iPads, phones).
3. **Location**: Include "Techy Miramar" or "here in Miramar".
4. **Gratitude**: Thank customer by name.
5. **Natural Tone**: Warm and genuine, not robotic.
6. **Specificity**: Reference specific details from review.
7. **Brevity**: 2-3 sentences max.
8. **Professionalism**: Friendly yet professional.
9. **Future Focus**: Invite them back.
10. **Compliance**: Follow Google's review response policies.

**For Negative Reviews (1-3 stars):**
All SEO rules are disabled. Focus on sincere apology, acknowledging frustration, taking responsibility, and directing to support@techymiramar.com. No device mentions, cross-selling, or keywords.

**Implementation:**
- `/controllers/aiController.js`: OpenAI chat completions with dual system prompts (positive vs negative).
- `extractDeviceMentions()`: Server-side regex extraction of device keywords from review text.
- `validateDeviceRuleCompliance()`: Post-generation validation that rejects responses missing required device mentions.
- `/api/generate-reply`: POST endpoint accepting `{ customerName, starRating, reviewText }`.
- Frontend: "AI Reviews" tab with form inputs, "Generate AI Reply" button, and "Copy to Clipboard" functionality.

**Error Handling:** Network errors return 503 with retry message. Validation failures return 500 with user-friendly error. Development mode includes detailed error messages.

### Telegram Autopilot Review Loop

A Telegram bot integration enables real-time review approval workflow via mobile messaging. The system sends new Google reviews with AI-generated replies to a designated Telegram chat for instant approval.

**Architecture:**
- `/controllers/telegramController.js`: Bot initialization in polling mode, message handler, and review approval workflow
- `initializeTelegramBot()`: Called on server startup, initializes bot if TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID are set
- `sendReviewForApproval(reviewData, aiReply)`: Formats and sends review approval request to Telegram
- Message listener: Responds to 'YES' (case-insensitive) for approval, redirects other messages to dashboard

**Workflow:**
1. New Google review arrives (future automation)
2. AI generates SEO-optimized reply following 10 Golden Rules
3. System sends formatted message to Telegram: "🌟 New Google Review! From: [Name] ([Stars] ⭐) Review: [Text] / 🤖 AI Proposed Reply: [Reply] / Reply 'YES' to post this to Google."
4. User replies 'YES' → Bot responds "✅ Reply Posted! (Mock Mode)" and logs "Posting to Google API..."
5. Other replies → Bot responds "❌ Edit mode not supported yet. Please log in to Dashboard."

**API Endpoints:**
- `POST /api/test-telegram`: Test endpoint sends mock 5-star iPhone review with AI reply to Telegram

**Environment Variables:**
- `TELEGRAM_BOT_TOKEN`: Bot token from @BotFather (required)
- `TELEGRAM_CHAT_ID`: Your Telegram chat ID (required)

**Security:** Bot gracefully handles missing secrets with clear warning messages. No hardcoded credentials.

### Security Layer

**Rate Limiting & Headers**: Production-ready security includes Helmet.js with a properly configured Content Security Policy (CSP) allowing necessary resources like Stripe.js, Tailwind CDN, and jQuery while blocking unsafe inline scripts by default. Express-rate-limit middleware protects endpoints: SMS sending endpoints are limited to 5 requests per hour per IP to prevent abuse and protect Twilio costs. General API endpoints have a 100 requests per 15 minutes limit. Both limiters return proper 429 status codes with informative error messages.

**SMS Opt-Out Compliance**: Full TCPA/CAN-SPAM compliance with automatic STOP/START keyword handling via Twilio webhook. The system maintains an `sms_optouts` database table tracking opted-out phone numbers. All outbound SMS paths (initial send, feedback follow-up, review reminders) check opt-out status before sending. Customers can opt out by replying STOP, UNSUBSCRIBE, CANCEL, END, or QUIT, and opt back in with START, UNSTOP, or YES. The webhook endpoint (`/api/sms/webhook`) processes form-encoded Twilio payloads and automatically updates the database.

## Communication Layer

Twilio SMS/MMS integration facilitates sending Google Review requests or Device Ready notifications, utilizing the Twilio SDK with secure Replit Connector integration. It supports both plain SMS and MMS with photo attachments, including E.164 validation and error handling. All messages include "Reply STOP to opt out" footer for compliance.

## Frontend Architecture

The static HTML/CSS/JavaScript frontend features a modern, purple gradient design with a tabbed interface:
- **Send SMS:** Main interface for sending messages, including an OCR section with smart template suggestions, message type dropdown, customer details input (OCR/customer database auto-fill), Google review link auto-population, additional message fields, and photo upload with preview.
- **Dashboard:** Displays real-time analytics (total messages, customers, daily/weekly activity, recent messages).
- **History:** Chronological log of all sent messages with type badges, customer info, timestamps, search/filter, and CSV export.
- **Customers:** Lists all customers with contact info, message counts, last contact dates, search/filter, CSV export, and a "Load Customer" button to pre-fill the send form.

**UI/UX Decisions:** The UI provides real-time validation, notifications, responsiveness, dynamic adaptation based on message type, one-click customer selection, automatic data refresh on tab switching, drag-and-drop file upload, smart template generation, searchable history/customers, automatic form reset, and a mandatory TCPA consent checkbox that enables/disables the send button.

**Feedback Landing Page (`/feedback.html`)**: A mobile-optimized, standalone page where customers rate their experience with a 5-star interface. The page implements Google TOS-compliant routing: 4-5 star ratings show a celebration screen with a prominent "Leave a Google Review" button, while 1-3 star ratings display an internal feedback form with a text area for improvement suggestions and a secondary "Or post a public review" link for compliance.

## System Design Choices

- **Google TOS-Compliant Feedback Routing**: Customer feedback collection uses a two-tier routing system to comply with Google's Terms of Service. When customers click the feedback link, they rate their experience 1-5 stars. High ratings (4-5 stars) are immediately directed to leave a Google Review. Low ratings (1-3 stars) are routed to an internal feedback form where they can provide improvement suggestions. Critically, the internal feedback screen includes an "Or post a public review" link to ensure compliance with Google's policy against incentivizing positive reviews. All feedback is stored in the `internal_feedback` table, and business owners receive email alerts for low ratings.

- **TCPA Consent Protection**: Before sending any SMS, users must check a required consent checkbox confirming that the customer has consented to receive SMS updates. This checkbox is prominently displayed in an amber-highlighted box on the Send SMS form. The send button is disabled until the checkbox is checked. The consent status is tracked in the `sms_consent_confirmed` column of the `messages` table, providing an audit trail for regulatory compliance.

# External Dependencies

## APIs and Services

-   **Twilio Communications API**: For SMS and MMS messaging.
-   **Google Cloud Vision API**: For professional OCR text extraction from images.
-   **Stripe**: For subscription billing and payment processing.
-   **Resend**: For sending automated emails (e.g., welcome emails, password resets).

## Runtime Dependencies

-   **express**: Web application framework.
-   **body-parser**: Middleware for parsing request bodies.
-   **cors**: Enables Cross-Origin Resource Sharing.
-   **twilio**: Twilio SDK.
-   **pg**: PostgreSQL client for Node.js.
-   **multer**: Middleware for handling `multipart/form-data` (file uploads).
-   **sharp**: Image processing library for OCR preprocessing.
-   **axios**: Promise-based HTTP client for API calls.
-   **bcrypt**: For password hashing.
-   **express-session**: Session management middleware.
-   **connect-pg-simple**: PostgreSQL session store.

## Database Layer

-   **PostgreSQL Database**: Replit-managed Neon instance, connected via `DATABASE_URL`.
-   **Schema**: Includes `customers`, `messages`, `subscriptions`, `users`, `user_sessions`, `auth_tokens`, `sms_optouts`, `user_settings`, and `internal_feedback` tables with foreign key relationships and indexes.
-   **Key Tables**:
    -   `internal_feedback`: Stores customer feedback for 1-3 star ratings with message_id, customer details, rating, feedback text, and user_email for multi-tenant support.
    -   `messages`: Includes `sms_consent_confirmed` boolean column to track TCPA compliance for each sent message.
-   **Features**: Auto-saves and updates customer data, maintains complete message history, tracks subscription quotas with transaction-based enforcement, stores internal feedback with email notifications, and automatically initializes tables.

## File Storage

-   **File System Storage**: Local disk storage for uploaded photos in the `/uploads` directory, served statically. Photo paths are stored in the database.