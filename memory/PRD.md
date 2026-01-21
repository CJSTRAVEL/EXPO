# CJ's Executive Travel - Product Requirements Document

## Original Problem Statement
Build a private hire booking application for CJ's Executive Travel with features for managing bookings, drivers, clients, passengers, and integrations for payments, maps, flight data, and communications.

## Core Requirements
- Dispatch system for booking management
- Customer-facing passenger portal
- Driver mobile app
- Fleet management
- Admin authentication
- Integrations: Stripe, Google Maps, AviationStack, SMS/Email

## What's Been Implemented

### Session: January 21, 2026 (Latest)

#### Booking History & Audit Log Feature
1. **History Tab in Booking View**
   - Added "Details" and "History" tabs to the Booking Details modal
   - History tab displays timeline of all booking changes with timestamps
   - Shows who made each change (user name + type badge)
   - Displays action icons for different event types (created, updated, driver assigned/unassigned, status changed)
   - Shows field-level changes with old/new values for updates
   - Timeline-style UI with connection line and event dots

2. **Created By Info**
   - Shows "Created by [User Name]" in the Details tab
   - Displays creation timestamp alongside creator info
   - Backend stores `created_by_id` and `created_by_name` for audit trail

3. **Flight Lookup in Edit Form**
   - Added Flight Information section to the Edit Booking modal
   - "Lookup Flight" button opens the same popup modal as New Booking page
   - Auto-populates pickup location and booking time from flight data
   - Shows current flight info if already saved
   - Purple-themed styling to match existing UI

4. **Backend History Logging**
   - All booking endpoints (create, update, assign, unassign, status change) now log to history
   - History entries include: timestamp, action, user_id, user_name, user_type, details, and changes object

### Previous Session Features
1. **New Booking Page Enhancements**
   - Flight information lookup moved to popup modal
   - Return flight lookup popup modal
   - Auto-population of pickup location/time from flight data
   - Dark theme styling (#D4A853, #1a1a1a, #252525)

2. **Contract Work Page Parity**
   - Driver assignment/unassignment
   - Status change functionality
   - Clickable driver names for quick reassignment

3. **UI Updates**
   - New company logo across all pages
   - Vehicle type badges with color-coding on booking cards
   - Journey duration displayed instead of price

## Architecture
```
/app/
├── backend/
│   └── server.py         # FastAPI backend (~4300 lines - needs refactoring)
├── driver-app/           # React Native/Expo mobile app
└── frontend/
    ├── src/
    │   ├── components/
    │   │   ├── AddressAutocomplete.jsx
    │   │   └── ui/                      # Shadcn components (incl. tabs)
    │   ├── context/
    │   │   └── AuthContext.jsx
    │   ├── pages/
    │   │   ├── BookingsPage.jsx         # Updated: History tab, flight lookup in edit form
    │   │   ├── NewBookingPage.jsx       # Updated: Flight modal, dark theme
    │   │   ├── ContractWorkPage.jsx     # Updated: Driver assignment, status change
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
