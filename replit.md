# Overview

This Node.js web application is an SMS Manager designed for repair service businesses. Its primary goal is to enhance customer engagement and operational efficiency by streamlining communication through SMS/MMS, managing customer data, tracking message history, and providing analytics. Key features include OCR-powered data extraction from repair orders, intelligent review tracking with automated follow-ups, persistent PostgreSQL storage, and a modern, tabbed UI. The project aims to integrate customer management, automate review collection, and offer valuable analytical insights.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Application Structure

A single-page web application using an Express.js backend and a PostgreSQL database, functioning as a comprehensive business tool for SMS messaging, history tracking, and customer relationship management.

## Backend Architecture

The application follows a clean **Model-View-Controller (MVC)** architecture with modular components:
- **`server.js`**: Minimal bootstrap for imports, middleware, and route mounting.
- **`config/database.js`**: Handles database connection and schema initialization.
- **`utils/twilio.js`**: Manages Twilio credentials, client initialization, and phone validation.
- **`utils/multerConfig.js`**: Configures Multer for file uploads (disk for photos, memory for OCR).
- **`controllers`**: Contains domain-specific business logic (auth, SMS/reviews, data, OCR, billing, settings, feedback).
- **`routes`**: Defines API endpoints and maps them to controller functions.
- **`middleware`**: Includes shared utilities like authentication (`requireAuth.js`) and rate limiting (`rateLimiter.js`).
- **Security**: Robust startup validation for essential environment variables (`DATABASE_URL`, `SESSION_SECRET`). Phone numbers are normalized to E.164 format.

### Key Features and Technical Implementations:

-   **Phone Number Validation**: Normalizes phone numbers to E.164 format, handling international prefixes and auto-adding US country codes.
-   **OCR Text Extraction**: Integrates **Google Cloud Vision API** for professional-grade text extraction from repair order photos (customer name, phone, device, repair issue). Uses Sharp for image preprocessing and smart parsing for keyword-based extraction.
-   **Review Tracking & Follow-up**: A hybrid system tracks review link clicks, monitors review status, automatically flags customers for follow-up, and provides dashboard analytics with bulk follow-up options.
-   **User Authentication**: Production-ready, multi-tenant authentication with secure sign-up, bcrypt password hashing, PostgreSQL-backed sessions with CSRF protection, and email-based password reset.
-   **Subscription Billing**: **Stripe Subscription Billing** integration with transaction-based, race-condition-free SMS quota enforcement. Supports trial accounts and tiered plans, using Stripe webhooks for status updates and PostgreSQL row-level locking for atomic quota management.
-   **AI-Powered Review Reply Assistant**: Utilizes OpenAI (gpt-4o-mini via Replit AI Integrations) to generate SEO-optimized Google Review responses based on "10 Golden Rules." Includes server-side validation for compliance (e.g., mandatory device mentions for positive reviews).
-   **Telegram Autopilot Review Loop**: Integrates a Telegram bot for real-time review approval workflow. New Google reviews and AI-generated replies are sent to a designated Telegram chat for instant approval, allowing users to post to Google with a simple 'YES' command.
-   **Security Layer**: Implements Helmet.js with a Content Security Policy (CSP) and `express-rate-limit` middleware to protect API endpoints (e.g., 5 requests/hour for SMS sending, 100 requests/15 mins for general APIs).
-   **SMS Opt-Out Compliance**: Full TCPA/CAN-SPAM compliance with automatic STOP/START keyword handling via Twilio webhook, maintaining an `sms_optouts` database table and checking opt-out status before sending messages.

## Communication Layer

-   **Twilio SMS/MMS**: Integrated for sending review requests and notifications. Utilizes the Twilio SDK with secure Replit Connector integration, supporting both SMS and MMS with photo attachments. All messages include "Reply STOP to opt out" for compliance.

## Frontend Architecture

A static HTML/CSS/JavaScript frontend with a modern, purple gradient design and a tabbed interface:
-   **Send SMS**: Main interface for sending messages, featuring an OCR section, message type dropdown, customer details input (OCR/database auto-fill), Google review link auto-population, and photo upload with preview.
-   **Dashboard**: Displays real-time analytics (messages, customers, activity).
-   **History**: Chronological log of sent messages with search/filter and CSV export.
-   **Customers**: Lists customer contact info, message counts, search/filter, and a "Load Customer" button.

**UI/UX Decisions**: Emphasizes real-time validation, notifications, responsiveness, dynamic adaptation, one-click customer selection, automatic data refresh, drag-and-drop file upload, smart template generation, searchable tables, automatic form reset, and a mandatory TCPA consent checkbox.

**Feedback Landing Page (`/feedback.html`)**: A mobile-optimized, standalone 5-star rating page.
-   **Google TOS-Compliant Routing**: 4-5 star ratings are directed to leave a Google Review. 1-3 star ratings are routed to an internal feedback form, with a compliant "Or post a public review" link. Internal feedback is stored in `internal_feedback` table and alerts business owners.
-   **TCPA Consent Protection**: A prominent, amber-highlighted checkbox confirms customer SMS consent, disabling the send button until checked. Consent status is tracked in the `sms_consent_confirmed` column of the `messages` table.

## System Design Choices

-   **Google TOS-Compliant Feedback Routing**: Ensures adherence to Google's policies by routing high ratings to public reviews and low ratings to internal feedback, with an option for public posting from the internal form.
-   **TCPA Consent Protection**: Mandates explicit user consent before sending SMS messages, enforced by a UI checkbox and tracked in the database for audit.

# External Dependencies

## APIs and Services

-   **Twilio Communications API**: For SMS and MMS messaging.
-   **Google Cloud Vision API**: For OCR text extraction.
-   **Stripe**: For subscription billing and payment processing.
-   **Resend**: For sending automated emails (e.g., welcome, password resets).

## Runtime Dependencies

-   **express**: Web application framework.
-   **body-parser**: Request body parsing middleware.
-   **cors**: Enables Cross-Origin Resource Sharing.
-   **twilio**: Twilio SDK.
-   **pg**: PostgreSQL client.
-   **multer**: For `multipart/form-data` handling.
-   **sharp**: Image processing for OCR preprocessing.
-   **axios**: Promise-based HTTP client.
-   **bcrypt**: Password hashing.
-   **express-session**: Session management.
-   **connect-pg-simple**: PostgreSQL session store.
-   **helmet**: Security headers.
-   **express-rate-limit**: Rate limiting middleware.

## Database Layer

-   **PostgreSQL Database**: Replit-managed Neon instance.
-   **Schema**: Includes tables for `customers`, `messages`, `subscriptions`, `users`, `user_sessions`, `auth_tokens`, `sms_optouts`, `user_settings`, and `internal_feedback`, with defined relationships and indexes.
-   **Key Tables**: `internal_feedback` (customer feedback), `messages` (includes `sms_consent_confirmed` for TCPA).
-   **Features**: Auto-saves customer data, maintains message history, tracks subscription quotas with transaction-based enforcement, stores internal feedback, and automatically initializes tables.

## File Storage

-   **File System Storage**: Local disk storage in `/uploads` for photos, served statically. Photo paths are stored in the database.