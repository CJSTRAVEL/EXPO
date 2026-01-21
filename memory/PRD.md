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

### Session: January 21, 2026
1. **New Booking Page Enhancements**
   - Flight information lookup moved to popup modal
   - Auto-population of pickup location (airport) and time (landing time) on flight lookup
   - Dark theme styling to match rest of dispatch system
   - Dark theme with gold/amber accents (#D4A853, #1a1a1a, #252525)

2. **Previous Session Completed Features**
   - Fleet Management (Vehicles page with CRUD for vehicle types and vehicles)
   - Admin User Authentication (login system with protected routes)
   - Driver Profile Overhaul (multi-type support: Taxi/PSV with type-specific document fields)
   - UI Redesign (color scheme aligned with cjstravel.uk)
   - Passenger Portal vehicle selection modal

## Architecture
```
/app/
├── backend/
│   └── server.py         # FastAPI backend (>3600 lines - needs refactoring)
├── driver-app/           # React Native/Expo mobile app
└── frontend/
    ├── src/
    │   ├── components/
    │   │   ├── AddressAutocomplete.jsx  # Updated for dark theme support
    │   │   └── ui/                      # Shadcn components
    │   ├── context/
    │   │   └── AuthContext.jsx
    │   ├── pages/
    │   │   ├── NewBookingPage.jsx       # Updated: Flight modal, dark theme
    │   │   ├── AdminLogin.jsx
    │   │   ├── SettingsPage.jsx
    │   │   ├── VehiclesPage.jsx
    │   │   ├── DriversPage.jsx
    │   │   └── PassengerPortal.jsx
    │   └── App.js
    └── ...
```

## Prioritized Backlog

### P0 (Critical)
- [COMPLETED] Flight lookup bug fix
- Driver App Verification (user needs to build and test via Expo)

### P1 (High)
- Forgot Password / SMS verification for passenger portal
- Driver App menu functionality (hamburger menu, logo menu)
- Refactor `server.py` into APIRouter modules (urgent technical debt)

### P2 (Medium)
- Refactor large frontend components (NewBookingPage, PassengerPortal, DriversPage)
- Export bookings to CSV
- Driver availability calendar
- Email invoice PDFs directly to clients

## Key API Endpoints
- Admin Auth: `POST /api/auth/login`, `GET /api/admin/me`
- Fleet: `GET/POST /api/vehicle-types`, `GET/POST /api/vehicles`
- Flights: `GET /api/flight/{flight_number}`
- Bookings: `GET/POST /api/bookings`

## Database Collections
- `admin_users`: Admin user accounts
- `vehicle_types`: Vehicle type definitions
- `vehicles`: Individual vehicle records
- `drivers`: Driver profiles with multi-type support
- `bookings`: Booking records
- `passengers`: Passenger accounts

## Test Credentials
- Dispatch System: `admin@cjstravel.uk` / `admin123`
- Passenger Portal: Register via UI
- Driver App: `john.driver@cjstravel.uk` / `password123`

## Third-Party Integrations
- AviationStack API (flight lookups)
- Stripe (payments)
- Google Maps Platform (mapping, autocomplete)
- Vonage, Mailgun (communications)
