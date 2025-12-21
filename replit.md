# Overview

This Node.js web application is an SMS Manager for repair service businesses, aiming to enhance customer engagement and operational efficiency. It provides SMS/MMS communication, customer data management, message history tracking, and analytics. Key features include OCR-powered data extraction from repair orders, intelligent review tracking with automated follow-ups, persistent PostgreSQL storage, and a modern, tabbed UI. The project integrates customer management, automates review collection, and offers valuable analytical insights.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Application Structure

A single-page web application utilizing an Express.js backend and a PostgreSQL database, serving as a comprehensive business tool for SMS messaging, history tracking, and customer relationship management.

## Backend Architecture

The application follows an **MVC (Model-View-Controller)** architecture with modular components:
-   **Core**: `server.js` for bootstrap, `config/database.js` for DB connection, and `scripts/init-db.js` for standalone database migrations.
-   **Utilities**: `utils/twilio.js` for Twilio integration, `utils/multerConfig.js` for file uploads.
-   **Logic**: `controllers` for business logic, `routes` for API endpoints, and `middleware` for shared functionalities like authentication and rate limiting.
-   **Security**: Robust environment variable validation, phone number normalization to E.164.
-   **Database Migrations**: Managed via `npm run migrate` for idempotence and production safety, supporting multi-tenant backfill.

### Key Features and Technical Implementations:

-   **Phone Number Validation**: Normalizes phone numbers to E.164 format.
-   **OCR Text Extraction**: Uses **Google Cloud Vision API** for extracting data from repair order photos, with image preprocessing via Sharp.
-   **Review Tracking & Smart Follow-up**: Token-based system for tracking review link clicks, sending automated follow-ups, and managing "Needs Follow-up" customers.
-   **User Authentication**: Production-ready, multi-tenant authentication with secure sign-up, bcrypt, PostgreSQL-backed sessions, and CSRF protection.
-   **Multi-Tenant Data Isolation**: Enterprise-grade tenant isolation enforced through `user_id` foreign keys, automated migration, write path protection, database constraints, and authorization filters.
-   **Subscription Billing**: **Stripe Subscription Billing** integration with transaction-based SMS quota enforcement, supporting trials and tiered plans, using Stripe webhooks and PostgreSQL row-level locking.
-   **AI-Powered Review Reply Assistant**: Utilizes OpenAI (gpt-4o-mini via Replit AI Integrations) to generate SEO-optimized Google Review responses, with server-side validation.
-   **Google Reviews Management**: Full review management dashboard with n8n webhook ingestion (`POST /api/reviews/ingest`), pending/posted/ignored status tracking, editable AI draft replies, and outbound webhook to post replies. Protected by `x-n8n-secret` header validation.
-   **Telegram Autopilot Review Loop (Multi-Tenant)**: AI-to-Telegram integration for review management. Each user configures their own bot for notifications and approval workflows via a `pending_reviews` table and Telegram approval mechanism.
-   **Security Layer**: Implements Helmet.js with CSP, `express-rate-limit` with Redis-backed storage for API protection.
-   **SMS Opt-Out Compliance**: Full TCPA/CAN-SPAM compliance with automatic STOP/START keyword handling via Twilio webhooks and an `sms_optouts` database table.

## Communication Layer

-   **Twilio SMS/MMS**: Integrated for sending review requests and notifications, supporting both SMS and MMS with photo attachments and opt-out compliance.

## Frontend Architecture

A static HTML/CSS/JavaScript frontend with a modern, professional design, featuring a fixed dark navy sidebar navigation.

**Layout Structure:**
-   **Fixed Sidebar**: Dark navy with branding, main menu, system menu, and user profile.
-   **Main Content Area**: White background with sticky header.
-   **Responsive Cards**: Stats, activity feeds, and Quick Compose panels.

**Main Sections**: Dashboard, Send SMS (with OCR), History, Customers, Reviews (AI Assistant), Billing, Feedback, and Settings (including Telegram bot config).

**Feedback Inbox Features** (Updated Dec 2025):
-   **Stats Bar**: Unread count chip, average rating display, sort dropdown (Newest/Oldest/Rating).
-   **Status Tabs**: All/Unread/In Progress/Resolved client-side filtering.
-   **Compact Cards**: Customer name, star rating, relative time, feedback quote, status indicators (🔴 Needs attention / 🟡 Moderate), date, technician assignment.
-   **Action Buttons**: Call (📞), SMS Apology (💬), Mark as Read (✓), Block (🚫).
-   **Customer History Grouping**: Expandable "⏱ X messages from this customer" showing previous feedback with [Unanswered]/[Handled] status and technician info.
-   **Action Tracking**: sms_sent_at, called_at, is_read columns track user actions on each feedback item.

**UI/UX Decisions**: Emphasizes real-time validation, notifications, responsiveness, dynamic adaptation, one-click customer selection, automatic data refresh, drag-and-drop file upload, searchable tables, and a mandatory TCPA consent checkbox.

**Progressive Web App (PWA)**:
-   **Installable**: Manifest and Service Worker for offline capability and faster loading.
-   **Mobile-First**: Optimized viewport and Apple-specific meta tags for iOS.

**Direct Google Review Flow**: Simplified, 100% Google-compliant review collection.
-   **No Gating**: The `/r/:token` tracking link redirects customers directly to Google Reviews (no star rating screen).
-   **Fallback Page**: `/thank-you.html` displayed when Google Review link is not configured.
-   **TCPA Consent Protection**: Explicit SMS consent tracked in the `messages` table.

## System Design Choices

-   **100% Google TOS Compliant**: Direct redirect to Google Reviews without any rating gating screen.
-   **TCPA Consent Protection**: Mandates explicit user consent for SMS, enforced via UI and database tracking.

# External Dependencies

## APIs and Services

-   **Twilio Communications API**: For SMS and MMS.
-   **Google Cloud Vision API**: For OCR text extraction.
-   **OpenAI API**: For AI-powered review reply generation (via Replit AI Integrations).
-   **Telegram Bot API**: For review approval workflow.
-   **Stripe**: For subscription billing and payment processing.
-   **Resend**: For automated email delivery.

## Runtime Dependencies

-   **express**: Web framework.
-   **body-parser**: Request body parsing.
-   **cors**: Cross-Origin Resource Sharing.
-   **twilio**: Twilio SDK.
-   **pg**: PostgreSQL client.
-   **multer**: `multipart/form-data` handling.
-   **sharp**: Image processing.
-   **axios**: HTTP client.
-   **bcrypt**: Password hashing.
-   **express-session**: Session management.
-   **connect-pg-simple**: PostgreSQL session store.
-   **helmet**: Security headers.
-   **express-rate-limit**: Rate limiting middleware.
-   **ioredis**: Redis client.
-   **rate-limit-redis**: Redis store for rate limiting.

## Database Layer

-   **PostgreSQL Database**: Replit-managed Neon instance.
-   **Schema**: Includes tables for `customers`, `messages`, `subscriptions`, `users`, `user_sessions`, `auth_tokens`, `sms_optouts`, `user_settings`, `internal_feedback`, `pending_reviews`, `telegram_configs`, and `google_reviews`.
-   **Multi-Tenant Schema**: All relevant tables utilize `user_id` foreign keys with `NOT NULL` constraints, supported by an automated migration system for backfilling and enforcement.

## File Storage

-   **Cloudinary Cloud Storage**: For photo uploads, integrated with Multer for efficient storage and retrieval. Photo URLs are stored in the database for MMS.