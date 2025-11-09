# Overview

This is a Node.js web application that serves as a Review Request Manager for repair service businesses. The application allows business owners to easily send SMS/MMS review requests to customers via Twilio, with support for photo attachments and personalized messages. It features OCR-powered automatic data extraction from repair orders and a simple, modern web interface for managing customer review requests.

**Date Created**: November 4, 2025  
**Last Updated**: November 9, 2025

# User Preferences

Preferred communication style: Simple, everyday language.

# Recent Changes

## November 9, 2025 (Latest)
- **OCR Auto-Fill Feature**: Upload repair order photo to automatically extract customer name and phone number using Tesseract.js
- **Improved UI**: Changed message type selector from radio buttons to cleaner dropdown menu
- **Smart Text Parsing**: Algorithm detects "Customer Information" sections and phone numbers with international format support
- **Manual Override**: All auto-populated fields remain editable for corrections
- Added dual message type feature: Google Review requests OR Device Ready notifications
- Google review link now auto-populated (https://g.page/r/CXmh-C0UxHgqEBM/review)
- Dynamic UI that adapts based on selected message type
- Different SMS templates for review requests vs pickup notifications

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
- **Purpose**: Send review requests or pickup notifications to customers
- **SDK**: Twilio v5.3.2
- **Authentication**: Uses Replit Connector integration
  - Account SID, API Key, and API Key Secret managed securely
  - Phone number retrieved from connection settings
- **Message Types**:
  - **Google Review Request**: Thank you message with Google review link
  - **Device Ready**: Pickup notification when repair is complete
- **Features**:
  - Plain SMS for text-only messages
  - MMS support for messages with photo attachments
  - E.164 phone number validation
  - Error handling for delivery failures

## OCR Text Extraction

**Tesseract.js Integration**
- **Purpose**: Automatically extract customer name and phone number from repair order photos
- **Technology**: Tesseract.js v5 (client-side OCR via CDN)
- **Processing**: Browser-based text recognition (no server-side API calls required)
- **Text Parsing Algorithm**:
  - Scans for "Customer Information" section headers
  - Regex-based phone number detection with international format support
  - ALL CAPS name detection as fallback heuristic
  - Filters out common false positives (invoice numbers, labels)
- **Phone Number Normalization**:
  - Auto-adds +1 prefix for 10-digit US numbers
  - Handles international formats (+44, +33, etc.)
  - Strips formatting characters (spaces, dashes, parentheses)
- **User Experience**:
  - Real-time processing status feedback
  - Preview of uploaded repair order
  - Display of extracted data before auto-fill
  - Manual editing always available (fields remain editable)
- **Error Handling**: Graceful fallback to manual entry if OCR fails

## Frontend Architecture

**Static HTML/CSS/JavaScript (public/index.html)**
- **Design**: Purple gradient theme with modern UI elements, pink OCR section for visual separation
- **Features**:
  - **OCR Upload Section**: Upload repair order photo for auto-extraction (optional)
  - Message type dropdown selector (Review Request or Device Ready)
  - Customer name and phone number input (required, can be auto-filled)
  - Google review link field (auto-populated, shows for review type only)
  - Additional message field for repair/pickup details (optional)
  - Photo upload with preview for before/after repair images
  - Real-time form validation
  - Success/error notifications
  - Responsive mobile-friendly design
- **User Experience**:
  - OCR section processes repair orders and displays extracted data
  - Dynamic UI adapts based on message type selection
  - Submit button text changes ("Send Review Request" vs "Send Pickup Notification")
  - Helper text updates contextually
  - Drag-and-drop file upload with image preview
  - All auto-filled fields remain editable
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

**OCR Processing**
- tesseract.js: v5 - Client-side OCR for text extraction from images

## Storage

**File System Storage**
- Local disk storage for uploaded photos
- Directory: `/uploads` (auto-created)
- Files served statically at `/uploads/*`
- No database required for current use case

# How to Use

## For Business Owners

### Quick Start with OCR (Recommended)

1. **Upload Repair Order** (Optional but time-saving):
   - Click "Click to upload repair order photo" in the pink section at the top
   - Select a photo of your repair order
   - Wait a few seconds while the app extracts customer info
   - Name and phone number will auto-fill below (you can edit if needed)

2. **Continue with your message** as described below...

### Option 1: Send Google Review Request

1. **Select Message Type**: Choose "🌟 Google Review Request" from dropdown
2. **Fill in Details** (or use OCR auto-fill above):
   - Enter customer's name
   - Enter phone number (with country code for international)
   - Google review link is already filled in: https://g.page/r/CXmh-C0UxHgqEBM/review
   - Add notes about the repair (optional)
   - Upload before/after photo (optional)
3. **Click "Send Review Request"**

**Customer Receives**:
> "Hi [Name]! Thank you for choosing Techy Miramar for your repair. We hope you're satisfied with the work we did. [Your notes]. Could you take a moment to leave us a Google review? [link] Thank you! 🙏"

### Option 2: Send Device Ready Notification

1. **Select Message Type**: Choose "✅ Device Ready for Pickup"
2. **Fill in Details**:
   - Enter customer's name
   - Enter phone number
   - Add pickup instructions or location details (optional)
   - Upload photo of the completed device (optional)
3. **Click "Send Pickup Notification"**

**Customer Receives**:
> "Hi [Name]! Great news - your device is ready for pickup at Techy Miramar! 🎉 [Your pickup instructions]. We're open and ready to see you. Thank you for choosing us!"

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
