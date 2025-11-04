# Overview

This is a Node.js web application that serves as a Review Request Manager for repair service businesses. The application allows business owners to easily send SMS/MMS review requests to customers via Twilio, with support for photo attachments and personalized messages. It features a simple, modern web interface for managing customer review requests.

**Date Created**: November 4, 2025  
**Last Updated**: November 4, 2025

# User Preferences

Preferred communication style: Simple, everyday language.

# Recent Changes

## November 4, 2025
- Complete rebuild of application focused on SMS review requests
- Implemented Twilio SMS/MMS integration for sending review requests
- Added photo upload capability with Multer (before/after repair photos)
- Built robust international phone number validation supporting E.164 format
- Created modern, gradient-based UI with form validation
- Removed legacy OpenAI integration (not needed for current use case)
- Configured single workflow for Express server on port 5000

# System Architecture

## Application Structure

**Single-page web application with Express.js backend**
- **Purpose**: Enable repair businesses to quickly send Google review requests via SMS
- **Solution**: Express.js server with static HTML frontend
- **Rationale**: Simple, focused tool that doesn't require complex frameworks or databases

## Backend Architecture

**Express.js REST API (server.js)**
- **Technology**: Express v5.1.0 with ES6 module syntax
- **Port**: 5000 (bound to 0.0.0.0)
- **Key Endpoints**:
  - `POST /api/send-review-request` - Sends SMS/MMS review request via Twilio
  - `GET /api/health` - Health check endpoint
  - `GET /` - Serves main application interface
- **Middleware Stack**:
  - CORS enabled for cross-origin requests
  - Body-parser for JSON and URL-encoded data
  - Multer for multipart form data and file uploads
  - Static file serving for public assets and uploaded files

## Phone Number Validation

**International E.164 Format Normalization**
- **Purpose**: Ensure all phone numbers work with Twilio's API
- **Features**:
  - Strips all non-digit characters (spaces, dashes, parentheses)
  - Handles international dial prefixes: +, 00, 011
  - Auto-adds US country code (1) for bare 10-digit numbers
  - Validates length between 10-15 digits per E.164 standard
- **Supported Formats**:
  - US: 1234567890 → +11234567890
  - US with +: +1 234-567-8900 → +11234567890
  - UK with 00: 00 44 20 7123 4567 → +442071234567
  - International with +: +44 20 7123 4567 → +442071234567
  - US dialing abroad: 011 44 20 7123 4567 → +442071234567

## File Upload System

**Multer-based photo handling**
- **Storage**: Disk storage in `/uploads` directory
- **File Restrictions**:
  - Maximum size: 5MB
  - Allowed types: JPEG, PNG, GIF, PDF
  - MIME type and extension validation
- **Naming**: Timestamped unique filenames to prevent collisions
- **Use Case**: Before/after repair photos attached to SMS as MMS
- **Security**: Server-side validation of file types and sizes

## Communication Layer

**Twilio SMS/MMS Integration**
- **Purpose**: Send review request messages to customers
- **SDK**: Twilio v5.3.2
- **Authentication**: Uses Replit Connector integration
  - Account SID, API Key, and API Key Secret managed securely
  - Phone number retrieved from connection settings
- **Features**:
  - Plain SMS for text-only messages
  - MMS support for messages with photo attachments
  - E.164 phone number validation
  - Error handling for delivery failures

## Frontend Architecture

**Static HTML/CSS/JavaScript (public/index.html)**
- **Design**: Purple gradient theme with modern UI elements
- **Features**:
  - Customer name and phone number input (required)
  - Google review link field (optional)
  - Additional message field for repair details (optional)
  - Photo upload with preview
  - Real-time form validation
  - Success/error notifications
  - Responsive mobile-friendly design
- **User Experience**:
  - Drag-and-drop file upload
  - Image preview before sending
  - Clear helper text for all fields
  - Automatic form reset after successful send

# External Dependencies

## APIs and Services

**Twilio Communications API**
- **Service**: SMS and MMS messaging platform
- **Purpose**: Deliver review request messages to customers
- **Integration**: Replit Connector (connection:conn_twilio_01K98CB68735HY4F2701R6HPHE)
- **Configuration**: Managed through Replit's secure connector system

## Runtime Dependencies

**Core Framework**
- express: Latest - Web application framework
- body-parser: Latest - Request body parsing middleware
- cors: Latest - Cross-origin resource sharing
- twilio: Latest - Twilio SDK for SMS/MMS

**File Handling**
- multer: Latest - Multipart form data and file uploads

## Storage

**File System Storage**
- Local disk storage for uploaded photos
- Directory: `/uploads` (auto-created)
- Files served statically at `/uploads/*`
- No database required for current use case

# How to Use

## For Business Owners

1. **Get your Google Review Link**:
   - Log into Google Business Profile
   - Click "Ask for reviews"
   - Copy the review link

2. **Send Review Request**:
   - Enter customer's name
   - Enter phone number (with country code for international)
   - Paste Google review link (optional but recommended)
   - Add notes about the repair (optional)
   - Upload before/after photo (optional)
   - Click "Send Review Request"

3. **Customer Receives**:
   - SMS message thanking them for the service
   - Request to leave a Google review
   - Direct link to review page
   - Photo of completed repair (if uploaded)

## Phone Number Tips

- **US Numbers**: Just enter 10 digits (e.g., 2125551234) or with country code (+12125551234)
- **International**: Always include country code (e.g., +44 20 7123 4567 for UK)
- **Formatting**: Spaces, dashes, and parentheses are automatically removed

# Future Enhancements

Potential features to consider:
- Customer database to track review requests
- Scheduling review requests for specific times
- Template messages for different repair types
- Analytics on review request success rates
- Follow-up reminder automation
- Multiple photo attachments per request
