# CJ's Executive Travel - Product Requirements Document

## Original Problem Statement
Build a private hire booking application named "CJ's Executive Travel" including:
- A dispatch system for admins
- A portal for passengers and corporate clients
- A mobile app for drivers

## User Personas
1. **Admin/Dispatcher** - Manages bookings, drivers, vehicles, clients, invoices
2. **Passenger** - Books travel services via portal
3. **Corporate Client** - Books travel for employees, receives invoices
4. **Driver** - Receives jobs, navigates, updates status via mobile app

## Core Requirements

### Bookings & Quotes
- ✅ Booking creation with all required fields
- ✅ Auto-calculate fares
- ✅ Passenger lookup and Google address autocomplete
- ✅ Repeat booking feature
- ✅ Traffic light scheduling system
- ✅ Deposit tracking (`deposit_paid`, `booking_source`)
- ✅ Flight tracking integration

### Fleet Scheduling
- ✅ Timeline view of all vehicles for a given day
- ✅ Auto-scheduling and drag-and-drop
- ✅ Driver assignment
- ✅ Conflict validation

### Portals (Client/Passenger)
- ✅ Fare estimation
- ✅ Booking requests and status tracking
- ✅ Live GPS tracking for passengers
- ✅ Mobile responsive design

### Admin Portal
- ✅ Client fare management
- ✅ Password reset functionality
- ✅ Passenger user management
- ✅ Driver management (with photos and documents)
- ✅ Vehicle management (with dynamic document fields)
- ✅ Dashboard widgets for document expiry
- ✅ Invoice management system
- ✅ Scheduled reminders (evening bookings, unallocated)

### Driver App
- ✅ Multi-stage swipe-based job flow
- ✅ Push notifications
- ✅ Job history
- ✅ Chat with dispatch
- ✅ Walkaround checks
- ⏳ iOS version (pending)

### Notifications
- ✅ WhatsApp notifications with SMS fallback
- ✅ Email notifications (booking confirmation, status updates)
- ✅ White background email theme (consistent branding)

### Invoicing
- ✅ Invoice management system
- ✅ PDF generation
- ✅ Client invoice viewing

## Tech Stack
- **Frontend**: React with Tailwind CSS, Shadcn/UI
- **Backend**: FastAPI (Python)
- **Database**: MongoDB
- **Driver App**: React Native (Expo)
- **Integrations**: Twilio (WhatsApp/SMS), Google Maps, MailerSend (SMTP), Vonage (SMS fallback)

## What's Been Implemented
- Full dispatch system with bookings, quotes, scheduling
- Passenger and Corporate portals
- Driver mobile app (Android)
- Invoice management
- WhatsApp/SMS notifications
- Email notifications with white theme
- Document expiry tracking
- Scheduled admin reminders

## Pending Items

### P0 (Critical)
- None

### P1 (High Priority)
- Twilio WhatsApp number correction in deployment
- Driver App APK rebuild for testing fixes
- Server.py refactoring into modular routes

### P2 (Medium Priority)
- iOS Driver App build
- WhatsApp auto-reply feature
- WhatsApp inbox UI

### Future/Backlog
- Repeat booking group management
- Export bookings to CSV
- Driver availability calendar
- Email invoice PDF directly
- Online invoice payment via Stripe
- Improve email deliverability (DNS records)

## Environment Variables Required
- MONGO_URL, DB_NAME
- JWT_SECRET
- GOOGLE_MAPS_API_KEY
- TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_NUMBER
- TWILIO_WHATSAPP_ENABLED
- VONAGE_API_KEY, VONAGE_API_SECRET
- SMTP_SERVER, SMTP_PORT, SMTP_USERNAME, SMTP_PASSWORD, SMTP_FROM_EMAIL
- STRIPE_API_KEY
- GETADDRESS_API_KEY
- FLIGHTRADAR24_API_KEY, AVIATIONSTACK_API_KEY

## Test Credentials
- **Dispatch Admin**: admin@cjstravel.uk / admin123
- **Driver App**: john.driver@cjstravel.uk / password123
- **Expo Login**: chris@cjstravel.uk / Newhouse@1
