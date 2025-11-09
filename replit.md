# Overview

This Node.js web application functions as a comprehensive SMS Manager tailored for repair service businesses. Its primary purpose is to streamline customer communication by enabling business owners to send SMS/MMS messages for review requests or pickup notifications, track message history, manage customer data, and access analytics. Key capabilities include OCR-powered automatic data extraction from repair orders, intelligent review tracking with automatic follow-ups, persistent storage via a PostgreSQL database, and a modern, tabbed user interface for efficient management of all communication aspects. The project aims to provide a complete business tool with analytics, customer management, and automated review collection features to enhance customer engagement and operational efficiency.

# Recent Changes (November 2025)

## Review Tracking & Follow-up System
Implemented a comprehensive hybrid review tracking system that monitors customer engagement and automates follow-up reminders:

**Core Features:**
- **Link Click Tracking**: Every review link is tracked via unique tokens; the app knows when customers click the link
- **Review Status Monitoring**: Four states tracked (Pending, Link Clicked, Reviewed, Follow-up Sent)
- **Automatic Follow-ups**: After 3 days, if a customer hasn't clicked their review link, the system flags them for follow-up
- **Manual Review Confirmation**: "Mark Review Received ✓" button in History tab when reviews appear on Google
- **Dashboard Analytics**: Real-time stats showing pending reviews, links clicked, reviews received, and customers needing follow-up
- **One-Click Bulk Follow-ups**: Send reminder SMS to all customers who need follow-up with a single click

**Technical Implementation:**
- Tracked review links via redirect endpoint (GET /r/:token)
- Database fields: review_status, review_link_token, review_link_clicked_at, review_received_at, follow_up_due_at, follow_up_sent_at
- RESTful API endpoints for status updates and follow-up management
- Idempotent click tracking (won't double-count repeated clicks)

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Application Structure

A single-page web application utilizes an Express.js backend and a PostgreSQL database. It's designed as a complete business tool for SMS messaging, history tracking, and customer relationship management.

## Backend Architecture

The application uses an Express.js REST API (server.js) running on port 5000 with ES6 modules. Key endpoints handle sending messages, retrieving message history, customer data, and analytics. It employs middleware for CORS, body parsing, Multer for file uploads, and static file serving. Database initialization occurs before server startup, creating necessary tables and indexes, and the server exits if the database is unavailable.

### Phone Number Validation

Phone numbers are normalized to the E.164 format for compatibility with Twilio, stripping non-digit characters, handling international prefixes (e.g., +, 00, 011), and auto-adding the US country code for 10-digit numbers.

### File Upload System

Multer handles photo uploads, storing them in the `/uploads` directory with timestamped unique filenames. Files are restricted to 5MB and specific image/PDF types, with server-side validation.

## Communication Layer

Twilio SMS/MMS integration facilitates sending Google Review requests or Device Ready notifications. It uses the Twilio SDK with secure Replit Connector integration for credentials and supports both plain SMS and MMS with photo attachments, including E.164 validation and error handling.

## OCR Text Extraction

Tesseract.js (client-side via CDN) automatically extracts customer information from repair order photos. This browser-based processing includes:

**Extracted Data:**
- Customer name from "Customer Information" section
- Phone number with international format support
- **Device type** from "Service Information" section (e.g., "HP Laptop", "iPhone 14")
- **Repair issue** from "Device Issue" line (e.g., "Motherboard Replacement", "Battery Replacement")

**Smart Template Generation:**
When both device and repair are detected, the app automatically suggests contextual message templates:
- Review Request template: "We completed the [repair] on your [device]. Everything is working perfectly!"
- Pickup Notification template: "Your [device] is ready! We successfully completed the [repair]."
- One-click "Use This" button to apply template to message

**Processing:**
- Scans for "Customer Information" and "Service Information" sections
- Brand-agnostic device extraction (handles "HP", "Apple", "Samsung", etc.)
- Regex-based phone number detection
- Template section only appears when device + repair are found
- All extracted data is editable with graceful fallback if OCR fails

## Frontend Architecture

The static HTML/CSS/JavaScript frontend features a modern, purple gradient design with a tabbed interface:
- **Send SMS:** Main interface for sending messages, including an OCR section with smart template suggestions, message type dropdown (Review Request or Device Ready), customer details input (OCR/customer database auto-fill), Google review link auto-population, optional additional message fields, and photo upload with preview.
- **Dashboard:** Displays real-time analytics (total messages, customers, daily/weekly activity, recent messages).
- **History:** Chronological log of all sent messages with type badges, customer info, timestamps, **search/filter box**, and **CSV export button**.
- **Customers:** Lists all customers with contact info, message counts, last contact dates, **search/filter box**, **CSV export button**, and "Load Customer" button to pre-fill the send form.

**New Features:**
- **Search & Filter**: Real-time search boxes in History and Customers tabs filter by name, phone, or message type
- **CSV Export**: Green export buttons download data as timestamped CSV files for record keeping or use in other tools
- **Smart Templates**: OCR-detected device and repair info automatically generates contextual message suggestions

The UI offers real-time validation, notifications, responsiveness, dynamic adaptation based on message type, one-click customer selection, automatic data refresh on tab switching, drag-and-drop file upload, smart template generation, searchable history/customers, and automatic form reset.

# External Dependencies

## APIs and Services

- **Twilio Communications API**: Used for SMS and MMS messaging, integrated via Replit Connector.

## Runtime Dependencies

- **express**: Web application framework.
- **body-parser**: Request body parsing middleware.
- **cors**: Cross-origin resource sharing.
- **twilio**: Twilio SDK for SMS/MMS.
- **pg**: PostgreSQL client for Node.js.
- **multer**: Multipart form data and file uploads.
- **tesseract.js**: Client-side OCR for text extraction from images.

## Database Layer

- **PostgreSQL Database**: Replit-managed Neon instance, connected via DATABASE_URL.
- **Schema**: Includes `customers` (id, name, phone, created_at, updated_at) and `messages` (id, customer_id, customer_name, customer_phone, message_type, review_link, additional_info, photo_path, sent_at, status, twilio_sid) tables with foreign key relationships and indexes for performance.
- **Features**: Auto-saves and updates customer data, maintains complete message history, and initializes tables automatically on server startup.

## File Storage

- **File System Storage**: Local disk storage for uploaded photos in the `/uploads` directory, served statically. Photo paths are stored in the database.