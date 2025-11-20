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
- **/controllers**: Business logic organized by domain (auth, SMS/reviews, data, OCR, billing, settings). Each controller exports factory functions that receive dependencies (pool, Twilio helpers) and return route handlers.
- **/routes**: Route definitions that import controllers and create Express routers. Each route file maps HTTP endpoints to controller functions.
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

### Security Layer

**Rate Limiting & Headers**: Production-ready security includes Helmet.js for security headers (XSS protection, HSTS, etc.) and express-rate-limit middleware. SMS sending endpoints are limited to 5 requests per hour per IP to prevent abuse and protect Twilio costs. General API endpoints have a 100 requests per 15 minutes limit. Both limiters return proper 429 status codes with informative error messages.

**SMS Opt-Out Compliance**: Full TCPA/CAN-SPAM compliance with automatic STOP/START keyword handling via Twilio webhook. The system maintains an `sms_optouts` database table tracking opted-out phone numbers. All outbound SMS paths (initial send, feedback follow-up, review reminders) check opt-out status before sending. Customers can opt out by replying STOP, UNSUBSCRIBE, CANCEL, END, or QUIT, and opt back in with START, UNSTOP, or YES. The webhook endpoint (`/api/sms/webhook`) processes form-encoded Twilio payloads and automatically updates the database.

## Communication Layer

Twilio SMS/MMS integration facilitates sending Google Review requests or Device Ready notifications, utilizing the Twilio SDK with secure Replit Connector integration. It supports both plain SMS and MMS with photo attachments, including E.164 validation and error handling. All messages include "Reply STOP to opt out" footer for compliance.

## Frontend Architecture

The static HTML/CSS/JavaScript frontend features a modern, purple gradient design with a tabbed interface:
- **Send SMS:** Main interface for sending messages, including an OCR section with smart template suggestions, message type dropdown, customer details input (OCR/customer database auto-fill), Google review link auto-population, additional message fields, and photo upload with preview.
- **Dashboard:** Displays real-time analytics (total messages, customers, daily/weekly activity, recent messages).
- **History:** Chronological log of all sent messages with type badges, customer info, timestamps, search/filter, and CSV export.
- **Customers:** Lists all customers with contact info, message counts, last contact dates, search/filter, CSV export, and a "Load Customer" button to pre-fill the send form.

**UI/UX Decisions:** The UI provides real-time validation, notifications, responsiveness, dynamic adaptation based on message type, one-click customer selection, automatic data refresh on tab switching, drag-and-drop file upload, smart template generation, searchable history/customers, and automatic form reset.

## System Design Choices

- **Feedback Collection Before Review Link Sending**: A pre-send feedback modal (1-5 stars) appears, sending a Google review link only if the customer rates 4-5 stars. Lower ratings trigger a follow-up message instead, and feedback is logged for internal follow-up.

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
-   **Schema**: Includes `customers`, `messages`, `subscriptions`, `users`, `user_sessions`, and `auth_tokens` tables with foreign key relationships and indexes.
-   **Features**: Auto-saves and updates customer data, maintains complete message history, tracks subscription quotas with transaction-based enforcement, and automatically initializes tables.

## File Storage

-   **File System Storage**: Local disk storage for uploaded photos in the `/uploads` directory, served statically. Photo paths are stored in the database.