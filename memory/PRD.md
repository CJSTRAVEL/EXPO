# CJ's Executive Travel - Product Requirements Document

## Original Problem Statement
Build a private hire booking application named "CJ's Executive Travel" with:
- A dispatch system for admins
- A portal for passengers and corporate clients
- A mobile app for drivers

## Current Architecture
```
/app/
├── backend/           # FastAPI backend
│   ├── routes/        # Modular API routes
│   │   ├── client_portal.py  # Client portal endpoints
│   │   ├── clients.py        # Admin client/invoice management
│   │   └── shared.py         # Shared utilities
│   └── server.py      # Main server (needs refactoring)
├── driver-app/        # React Native Expo app
│   └── src/screens/   # App screens
└── frontend/          # React frontend
    └── src/pages/     # Admin & portal pages
```

## What's Been Implemented

### January 2026
- **Invoice Delete & Past Jobs** (VERIFIED): Delete invoice option, bookings move to Past Jobs when invoice paid, restore on delete
- **Invoice Journey Selection** (VERIFIED): Checkbox selection when generating invoices + remove journey from Invoice Manager edit
- **Invoice Template Redesign** (VERIFIED): Gold/black color scheme, company logo embedded, fixed layout (no overlap)
- **Invoice Template Unification** (VERIFIED): Professional PDF template now used across both Admin and Client Portal downloads
- **VAT System**: VAT options (20%, No VAT, Exempt) added to client details and integrated into invoices
- **Invoice Manager**: Full admin page for viewing, searching, editing all invoices
- **Driver App Fixes**: Swipe-to-confirm bug fixed, logout rule implemented, UI redesign, "in-progress" bar linked
- **Booking Logic Fixes**: `client_id` and `quoted_fare` now correctly transferred from requests to bookings
- **Bug Fixes**: Client detail updates, driver assignment filtering, calendar icon bug in portal

## Key Features
- Multi-portal system (Admin, Client, Passenger)
- Real-time booking management
- Invoice generation with VAT support
- Driver mobile app with job flow
- SMS notifications via Vonage
- Flight tracking integration
- Stripe payment integration

## Database Schema (Key Collections)
- **bookings**: Core booking data with client_id, fare, status
- **clients**: Company details with vat_rate, vat_number, payment_terms
- **invoices**: Generated invoices with subtotal, vat_amount, vat_rate, total
- **booking_requests**: Portal booking requests pending approval
- **drivers**: Driver profiles and assignments

## API Endpoints (Recent)
- `GET /api/invoices` - Admin: Get all invoices
- `PUT /api/invoices/{id}` - Admin: Update invoice
- `GET /api/invoices/{id}/download` - Admin: Download PDF
- `GET /api/client-portal/invoices/{id}/download` - Client: Download PDF

## Prioritized Backlog

### P0 (Critical)
- ✅ Invoice Template Fix - VERIFIED WORKING

### P1 (High Priority)
- SMS Templates: Add vehicle details to driver notifications
- Driver App APK: User testing for new build (c3855133...)

### P2 (Medium Priority)
- Export bookings to CSV
- Driver availability calendar
- Email invoice PDF directly to clients
- Online invoice payment via Stripe
- Refactor server.py (move remaining endpoints)
- Refactor large frontend components

## 3rd Party Integrations
- Google Maps Platform
- FlightRadar24 API
- Stripe (payments)
- Vonage (SMS)
- Mailgun (SMTP)
- Expo EAS (app builds)
- Getaddress.io (UK addresses)

## Test Credentials
- **Admin**: admin@cjstravel.uk / admin123
- **Driver**: john.driver@cjstravel.uk / password123
- **Passenger**: test.passenger@email.com / password123
- **Corporate**: chrisnewhouse@live.co.uk / Newhouse@1

## Known Technical Debt
- `server.py` is monolithic - needs endpoint migration to router files
- `ActiveRideScreen.js` is large - needs component breakdown
- Shared booking dialog logic duplicated in ClientPortal and PassengerPortal
