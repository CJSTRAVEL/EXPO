# CJ's Executive Travel - Product Requirements Document

## Original Problem Statement
Build a private hire booking application for CJ's Executive Travel with features for managing bookings, drivers, clients, passengers, and integrations for payments, maps, flight data, and communications.

## Core Requirements
- Dispatch system for booking management
- Customer-facing passenger portal
- Client portal for business customers (with invoices)
- Driver mobile app
- Fleet management
- Admin authentication
- Integrations: Stripe, Google Maps, AviationStack, SMS/Email

## What's Been Implemented

### Session: January 22, 2026 (Latest)

#### Client Portal with Invoices Feature
1. **Shared Customer Login Page** (`/customer-login`)
   - Unified login/register page for both passengers and business clients
   - Toggle between "Passenger" (gold theme) and "Business Client" (blue theme)
   - Register form shows company name field for business clients
   - Client registration creates pending request for admin approval

2. **Client Portal** (`/client-portal`)
   - Four tabs: Confirmed Bookings, Pending Requests, Invoices, History
   - Invoice stats dashboard (Total, Paid, Unpaid, Outstanding amounts)
   - New Booking request dialog with all fields
   - Invoice list with view details and download PDF buttons
   - Dark theme consistent with dispatch system

3. **Backend Endpoints**
   - `POST /api/client-portal/register` - Register new client (pending approval)
   - `POST /api/client-portal/login` - Login with phone/password
   - `GET /api/client-portal/bookings` - Get client's bookings
   - `GET /api/client-portal/booking-requests` - Get pending requests
   - `POST /api/client-portal/booking-requests` - Submit new booking request
   - `GET /api/client-portal/invoices` - Get client's invoices
   - `GET /api/client-portal/invoices/{id}/download` - Download invoice PDF

### Session: January 21, 2026

#### Booking History & Audit Log Feature
1. **History Tab in Booking View**
   - Added "Details" and "History" tabs to the Booking Details modal
   - History tab displays timeline of all booking changes with timestamps
   - Shows who made each change (user name + type badge)
   - Displays action icons for different event types

2. **Created By Info**
   - Shows "Created by [User Name]" in the Details tab
   - Backend stores `created_by_id` and `created_by_name` for audit trail

3. **Flight Lookup in Edit Form**
   - Added Flight Information section to the Edit Booking modal
   - Auto-populates pickup location and booking time from flight data

### Previous Session Features
1. **New Booking Page Enhancements**
   - Flight information lookup moved to popup modal
   - Return flight lookup popup modal
   - Auto-population of pickup location/time from flight data
   - Dark theme styling (#D4A853, #1a1a1a, #252525)

2. **Contract Work Page Parity**
   - Driver assignment/unassignment
   - Status change functionality

## Architecture
```
/app/
├── backend/
│   └── server.py         # FastAPI backend (~5000 lines - needs refactoring)
├── driver-app/           # React Native/Expo mobile app
└── frontend/
    ├── src/
    │   ├── components/
    │   │   ├── AddressAutocomplete.jsx
    │   │   └── ui/                      # Shadcn components
    │   ├── context/
    │   │   └── AuthContext.jsx
    │   ├── pages/
    │   │   ├── BookingsPage.jsx         # History tab, flight lookup
    │   │   ├── NewBookingPage.jsx       # Flight modal, dark theme
    │   │   ├── CustomerLogin.jsx        # NEW: Shared login/register
    │   │   ├── ClientPortal.jsx         # NEW: Client portal with invoices
    │   │   └── ...
    │   └── App.js
    └── ...
```

## Prioritized Backlog

### P0 (Critical)
- [COMPLETED] Booking History & Audit Log Feature
- Driver App Verification (user needs to build and test via Expo)

### P1 (High)
- Forgot Password / SMS verification for passenger portal
- Driver App menu functionality (hamburger menu, logo menu)
- Refactor `server.py` into APIRouter modules (urgent technical debt - 4300+ lines)

### P2 (Medium)
- Refactor large frontend components (BookingsPage 2700+ lines, NewBookingPage 1500+ lines)
- Export bookings to CSV
- Driver availability calendar
- Email invoice PDFs directly to clients

## Key API Endpoints
- Admin Auth: `POST /api/auth/login`, `GET /api/admin/me`
- Fleet: `GET/POST /api/vehicle-types`, `GET/POST /api/vehicles`
- Flights: `GET /api/flight/{flight_number}`
- Bookings: `GET/POST /api/bookings`, `PUT /api/bookings/{id}`, `POST /api/bookings/{id}/assign/{driver_id}`, `POST /api/bookings/{id}/unassign`

## Database Schema Updates

### bookings collection (updated)
- `created_by_id`: String - ID of user who created the booking
- `created_by_name`: String - Name of user who created the booking  
- `history`: Array of history entries: `[{timestamp, action, user_id, user_name, user_type, details, changes}]`

## Test Credentials
- Dispatch System: `admin@cjstravel.uk` / `admin123`
- Passenger Portal: Register via UI
- Driver App: `john.driver@cjstravel.uk` / `password123`

## Third-Party Integrations
- AviationStack API (flight lookups)
- Stripe (payments)
- Google Maps Platform (mapping, autocomplete)
- Vonage, Mailgun (communications)
