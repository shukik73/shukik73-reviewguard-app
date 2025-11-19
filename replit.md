# Overview

This Node.js web application is a comprehensive SMS Manager for repair service businesses. Its core purpose is to streamline customer communication by enabling sending SMS/MMS for review requests or pickup notifications, tracking message history, managing customer data, and accessing analytics. Key features include OCR-powered data extraction from repair orders, intelligent review tracking with automated follow-ups, persistent storage via PostgreSQL, and a modern, tabbed UI. The project aims to enhance customer engagement and operational efficiency through integrated customer management, automated review collection, and analytical insights.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Application Structure

A single-page web application built with an Express.js backend and a PostgreSQL database, designed as a complete business tool for SMS messaging, history tracking, and customer relationship management.

## Backend Architecture

The application follows a clean **Model-View-Controller (MVC)** architecture with clear separation of concerns:

- **server.js** (334 lines): Bootstrap logic only - database initialization, Twilio helper functions, session/middleware setup, and route mounting. No business logic.
- **/controllers**: Business logic organized by domain (auth, SMS/reviews, data, OCR, billing, settings). Each controller exports factory functions that receive dependencies (pool, Twilio helpers) and return route handlers.
- **/routes**: Route definitions that import controllers and create Express routers. Each route file maps HTTP endpoints to controller functions.
- **/middleware**: Shared middleware like `requireAuth.js` for authentication enforcement across protected routes.

The refactored architecture reduces the monolithic server.js from 2127 lines to 334 lines (84% reduction), improving maintainability, testability, and code organization. All business logic is now modular and domain-separated. Phone numbers are normalized to E.164 format. File uploads are handled by Multer with both disk storage (photos) and memory storage (OCR), with server-side validation.

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

## Communication Layer

Twilio SMS/MMS integration facilitates sending Google Review requests or Device Ready notifications, utilizing the Twilio SDK with secure Replit Connector integration. It supports both plain SMS and MMS with photo attachments, including E.164 validation and error handling.

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