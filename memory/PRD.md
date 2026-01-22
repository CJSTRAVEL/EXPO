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

#### Server.py Refactoring (Phase 2 Complete)
Created 10 modular routers in `/app/backend/routes/`:
- `shared.py` - Base infrastructure, dependencies (~200 lines)
- `auth.py` - Admin authentication (~150 lines)
- `drivers.py` - Driver CRUD + mobile app (~400 lines)
- `vehicles.py` - Vehicle CRUD + types (~200 lines)
- `passengers.py` - Passenger portal (~150 lines)
- `client_portal.py` - Client portal + password reset (~400 lines)
- `external.py` - Google Maps, Postcode, Flight API (~250 lines)
- `clients.py` - Client management + invoices (~350 lines)
- `chat.py` - Chat endpoints (~100 lines)
- `payments.py` - Stripe integration (~200 lines)

**Total extracted**: ~2200 lines into clean, testable modules
**Documentation**: `/app/docs/REFACTORING_GUIDE.md`

#### Password Reset with SMS/Email Options
1. **Dual Reset Methods**
   - User can choose SMS or Email for verification code
   - Toggle buttons on forgot password dialog
   - Email sends styled HTML with code via Mailgun
   - SMS sends via Vonage

2. **Backend Endpoints**
   - `POST /api/password-reset/request` - Now accepts `method: "sms" | "email"`
   - `POST /api/password-reset/verify` - Accepts `identifier` (phone or email)

#### Forgot Password Flow
1. **3-Step Wizard**
   - Step 1: Choose SMS or Email, enter contact
   - Step 2: Enter 6-digit verification code
   - Step 3: Set new password
   - Works for both Passengers and Business Clients

2. **Cron Job Documentation**
   - Created `/app/docs/CRON_SETUP.md`
   - Covers Linux cron, Windows Task Scheduler, AWS/GCP schedulers

#### Client Portal with Invoices Feature
1. **Shared Customer Login Page** (`/customer-login`)
   - Unified login/register for Passengers (gold) and Clients (blue)
   - Company name field for business clients
   - Client registration creates pending request

2. **Client Portal** (`/client-portal`)
   - Tabs: Bookings, Pending Requests, Invoices, History
   - Invoice stats dashboard with download PDF

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
