# Overview

This Node.js web application is an SMS Manager designed for repair service businesses. Its primary goal is to enhance customer engagement and operational efficiency by streamlining communication through SMS/MMS, managing customer data, tracking message history, and providing analytics. Key features include OCR-powered data extraction from repair orders, intelligent review tracking with automated follow-ups, persistent PostgreSQL storage, and a modern, tabbed UI. The project aims to integrate customer management, automate review collection, and offer valuable analytical insights.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Application Structure

A single-page web application using an Express.js backend and a PostgreSQL database, functioning as a comprehensive business tool for SMS messaging, history tracking, and customer relationship management.

## Backend Architecture

The application follows a clean **Model-View-Controller (MVC)** architecture with modular components:
- **`server.js`**: Minimal bootstrap for imports, middleware, and route mounting. No database migrations run on startup.
- **`config/database.js`**: Handles database connection pool only.
- **`scripts/init-db.js`**: Standalone database migration script. Run with `npm run migrate` before first deployment or after schema changes.
- **`utils/twilio.js`**: Manages Twilio credentials, client initialization, and phone validation.
- **`utils/multerConfig.js`**: Configures Multer for file uploads (disk for photos, memory for OCR).
- **`controllers`**: Contains domain-specific business logic (auth, SMS/reviews, data, OCR, billing, settings, feedback).
- **`routes`**: Defines API endpoints and maps them to controller functions.
- **`middleware`**: Includes shared utilities like authentication (`requireAuth.js`) and rate limiting (`rateLimiter.js`).
- **Security**: Robust startup validation for essential environment variables (`DATABASE_URL`, `SESSION_SECRET`). Phone numbers are normalized to E.164 format.

### Database Migrations

Database schema changes are managed separately from application startup for production safety:
- **Migration Script**: `npm run migrate` runs `scripts/init-db.js`
- **Run Before First Deployment**: Execute `npm run migrate` to create all tables
- **Safe for Production**: Migrations use `IF NOT EXISTS` and `ADD COLUMN IF NOT EXISTS` for idempotency
- **Multi-Tenant Backfill**: Automatically handles legacy data migration with user_id assignment

### Key Features and Technical Implementations:

-   **Phone Number Validation**: Normalizes phone numbers to E.164 format, handling international prefixes and auto-adding US country codes.
-   **OCR Text Extraction**: Integrates **Google Cloud Vision API** for professional-grade text extraction from repair order photos (customer name, phone, device, repair issue). Uses Sharp for image preprocessing and smart parsing for keyword-based extraction.
-   **Review Tracking & Follow-up**: A hybrid system tracks review link clicks, monitors review status, automatically flags customers for follow-up, and provides dashboard analytics with bulk follow-up options.
-   **User Authentication**: Production-ready, multi-tenant authentication with secure sign-up, bcrypt password hashing, PostgreSQL-backed sessions with CSRF protection, and email-based password reset.
-   **Multi-Tenant Data Isolation**: Enterprise-grade tenant isolation with automated migration system:
    -   **Staged Migration**: Removes DEFAULT 1 from user_id columns, backfills using FK relationships, audits orphaned rows, and enforces NOT NULL constraints after preflight verification.
    -   **Write Path Protection**: All message, customer, and feedback creation paths explicitly provide user_id with validation guards.
    -   **Database Constraints**: NOT NULL enforced on customers.user_id, messages.user_id, and internal_feedback.user_id to prevent future regressions.
    -   **Authorization Filters**: All read/write operations filter by authenticated user_id to ensure complete data isolation.
    -   **Feedback Inbox**: Multi-tenant internal feedback display with proper user_id filtering and mark-as-read functionality.
-   **Subscription Billing**: **Stripe Subscription Billing** integration with transaction-based, race-condition-free SMS quota enforcement. Supports trial accounts and tiered plans, using Stripe webhooks for status updates and PostgreSQL row-level locking for atomic quota management.
-   **AI-Powered Review Reply Assistant**: Utilizes OpenAI (gpt-4o-mini via Replit AI Integrations) to generate SEO-optimized Google Review responses based on "10 Golden Rules." Includes server-side validation for compliance (e.g., mandatory device mentions for positive reviews).
-   **Telegram Autopilot Review Loop (Multi-Tenant)**: Complete AI-to-Telegram integration for review management with per-user bot support:
    -   **Multi-Tenant Architecture**: Each user configures their own Telegram bot via Settings UI. Bot credentials stored in `telegram_configs` table with user_id FK.
    -   **getBotForUser(userId)**: Helper function that fetches credentials from database and instantiates TelegramBot instances on-demand.
    -   **processIncomingReview()**: Orchestrates AI reply generation, database persistence (with user_id), and Telegram notification using user's own bot.
    -   **pending_reviews Table**: Stores customer reviews, AI-generated replies, approval status, and user_id for tenant isolation.
    -   **Telegram Approval Workflow**: Sends formatted review notifications to user's designated Telegram chat with one-click "YES" approval.
    -   **Settings UI**: POST `/api/settings/telegram` endpoint for saving bot credentials, with connection testing and validation.
    -   **Test Endpoint**: POST `/api/simulate-review` (requires auth) allows browser-based testing of the complete workflow for the authenticated user.
-   **Security Layer**: Implements Helmet.js with a Content Security Policy (CSP) and `express-rate-limit` middleware with Redis-backed storage to protect API endpoints (e.g., 5 requests/hour for SMS sending, 100 requests/15 mins for general APIs). Rate limits persist across server restarts when Redis is configured via `REDIS_URL`. Graceful fallback to in-memory storage if Redis is unavailable.
-   **SMS Opt-Out Compliance**: Full TCPA/CAN-SPAM compliance with automatic STOP/START keyword handling via Twilio webhook, maintaining an `sms_optouts` database table and checking opt-out status before sending messages.

## Communication Layer

-   **Twilio SMS/MMS**: Integrated for sending review requests and notifications. Utilizes the Twilio SDK with secure Replit Connector integration, supporting both SMS and MMS with photo attachments. All messages include "Reply STOP to opt out" for compliance.

## Frontend Architecture

A static HTML/CSS/JavaScript frontend with a modern, professional design featuring a **fixed dark navy sidebar navigation** (#1e293b):

**Layout Structure:**
-   **Fixed Sidebar (w-56)**: Dark navy sidebar with ReviewGuard branding, main menu navigation, system menu, and user profile at bottom with logout button.
-   **Main Content Area**: White background with sticky header showing page title, subtitle, and "+ New Message" button.
-   **Responsive Cards**: Stats cards with hover effects, activity feeds, and Quick Compose panels.

**Main Sections:**
-   **Dashboard**: Stats cards (Total SMS Sent, Total Customers, Sent Today, Sent This Week), Recent Activity feed with time-ago formatting, Quick Compose panel.
-   **Send SMS** (New Customer Onboarding): Drag-and-drop receipt upload with OCR, camera capture, Customer Profile form with device/cost/repair fields, message preview, TCPA consent checkbox.
-   **History**: Message history with filtering (All, Clicked, Reviewed, Needs Follow-up), reminder buttons.
-   **Customers**: Customer database with avatar initials, message counts, "Use in Form" quick-load.
-   **Reviews**: AI Review Reply Assistant with input form and dark-themed response preview.
-   **Billing**: Subscription plan cards (Starter $29/mo, Pro $79/mo) with Stripe checkout.
-   **Feedback**: Internal feedback inbox for 1-3 star ratings with read/unread status.
-   **Settings**: Business settings form and Telegram bot configuration.

**Dynamic Branding:**
-   Business name updates in sidebar (#sidebar-brand) when user logs in or saves settings.
-   Hidden #header-branding element maintained for backward compatibility.
-   User avatar with initials displayed in sidebar footer.

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
-   **OpenAI API**: For AI-powered review reply generation (gpt-4o-mini via Replit AI Integrations).
-   **Telegram Bot API**: For real-time review approval workflow with YES command listener.
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
-   **ioredis**: Redis client for Node.js.
-   **rate-limit-redis**: Redis store for express-rate-limit.

## Database Layer

-   **PostgreSQL Database**: Replit-managed Neon instance.
-   **Schema**: Includes tables for `customers`, `messages`, `subscriptions`, `users`, `user_sessions`, `auth_tokens`, `sms_optouts`, `user_settings`, `internal_feedback`, `pending_reviews`, and `telegram_configs`, with defined relationships and indexes.
-   **Key Tables**: 
    -   `internal_feedback` (customer feedback with user_id for tenant isolation, status column for read tracking)
    -   `messages` (includes `sms_consent_confirmed` for TCPA, user_id NOT NULL for tenant isolation)
    -   `customers` (user_id NOT NULL for tenant isolation, UNIQUE constraint on (user_id, phone))
    -   `pending_reviews` (AI-generated review replies awaiting Telegram approval: id, customer_name, star_rating, review_text, ai_proposed_reply, status, user_id, created_at)
    -   `telegram_configs` (per-user Telegram bot credentials: id, user_id, bot_token, chat_id, is_active, created_at, updated_at)
-   **Multi-Tenant Schema**: All tables use user_id foreign keys with NOT NULL constraints. Migration system automatically backfills legacy data and enforces constraints.
-   **Features**: Auto-saves customer data, maintains message history, tracks subscription quotas with transaction-based enforcement, stores internal feedback with tenant isolation, and automatically initializes tables with migration support.

## File Storage

-   **Cloudinary Cloud Storage**: Photos are uploaded to Cloudinary for cloud-ready, stateless deployment. The `utils/cloudinary.js` configures the Cloudinary v2 client using environment variables (`CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`). Multer uses `CloudinaryStorage` for photo uploads while OCR uploads remain in memory. Photo URLs (secure_url) are stored in the database and used for Twilio MMS.