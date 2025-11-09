# Overview

This Node.js web application functions as a comprehensive SMS Manager tailored for repair service businesses. Its primary purpose is to streamline customer communication by enabling business owners to send SMS/MMS messages for review requests or pickup notifications, track message history, manage customer data, and access analytics. Key capabilities include OCR-powered automatic data extraction from repair orders, persistent storage via a PostgreSQL database, and a modern, tabbed user interface for efficient management of all communication aspects. The project aims to provide a complete business tool with analytics and customer management features to enhance customer engagement and operational efficiency.

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

Tesseract.js (client-side via CDN) automatically extracts customer names and phone numbers from repair order photos. This browser-based processing includes algorithms to scan for "Customer Information" sections, use regex for phone numbers (supporting international formats), and detect all-caps names as a fallback. Extracted data is previewed and user-editable, with graceful fallback if OCR fails.

## Frontend Architecture

The static HTML/CSS/JavaScript frontend features a modern, purple gradient design with a tabbed interface:
- **Send SMS:** Main interface for sending messages, including an OCR section, message type dropdown (Review Request or Device Ready), customer details input (OCR/customer database auto-fill), Google review link auto-population, optional additional message fields, and photo upload with preview.
- **Dashboard:** Displays real-time analytics (total messages, customers, daily/weekly activity, recent messages).
- **History:** Provides a chronological log of all sent messages with type badges, customer info, and timestamps.
- **Customers:** Lists all customers with contact info, message counts, last contact dates, and a "Load Customer" button to pre-fill the send form.

The UI offers real-time validation, notifications, responsiveness, dynamic adaptation based on message type, one-click customer selection, automatic data refresh on tab switching, drag-and-drop file upload, and automatic form reset.

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