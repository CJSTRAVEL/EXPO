# CJ's Executive Travel - Product Requirements Document

## Changelog
- **2025-01-24**: Fixed walkaround submission bug - `AuthContext` was not exposing `token` to `useAuth()` hook, causing API auth to fail with `Bearer undefined`

## Project Overview
A private hire booking application with three main components:
1. **Admin Dispatch System** - Web-based portal for managing bookings, drivers, vehicles, and fares
2. **Passenger Portal** - Customer-facing booking interface
3. **Driver Mobile App** - React Native app for drivers to manage their shifts and jobs

## Core Features

### Admin Portal
- Dashboard with live GPS tracking
- Booking management (create, edit, assign drivers)
- Driver management (profiles, documents, expiry tracking)
- Vehicle management (types, individual vehicles)
- Client/Corporate account management
- Fare management system:
  - **Zone-based fares** with prices per vehicle type
  - Mile-based pricing configuration
  - Fare calculator
- SMS/Email notification templates
- Invoice generation

### Passenger Portal
- Phone-based login/registration
- Booking creation with address autocomplete
- View booking history
- Flight tracking integration

### Driver App
- Biometric login support
- Shift management (start/stop)
- Vehicle selection with exclusivity
- Job list with today/upcoming/past
- Active ride screen with progressive stops
- Document expiry notifications
- Admin chat

## Technical Stack
- **Backend**: FastAPI, MongoDB, Motor
- **Frontend**: React, TailwindCSS, Shadcn/UI
- **Driver App**: React Native, Expo
- **APIs**: Google Maps, FlightRadar24, Vonage SMS, Mailgun, Stripe

## What's Been Implemented

### Session: Jan 23, 2026

#### Driver App Fixes (P0)
- [x] Fixed document notifications endpoint - was returning `[]` instead of `{"notifications": [...], "count": N}`
- [x] Fixed AuthContext profile handling - `checkAuth` and `refreshProfile` now properly extract driver data from `{driver: {...}, vehicle: ...}` response
- [x] **Fixed vehicle selection crash** - The `/api/driver/select-vehicle` endpoint in `routes/drivers.py` was expecting `vehicle_id` as a query parameter but the app sends it in the request body. Updated to use Pydantic model.
- [x] New APK built: https://expo.dev/artifacts/eas/7dMBktRWTW1famyTdsBnwA.apk
- [x] Created test bookings (CJ-003, CJ-004) for driver app testing

#### Fare System Enhancement (P1)
- [x] Updated fare zone model to support **prices per vehicle type** instead of single fixed fare
- [x] Backend: Modified `FareZone` and `FareZoneUpdate` models with `vehicle_fares: Dict[str, float]`
- [x] Frontend: Updated zone dialog with vehicle-specific price inputs
- [x] Zone table now displays fares per vehicle type (e.g., "Taxi: £25.00", "8 Minibus: £45.00")
- [x] Legacy `fixed_fare` field supported for backward compatibility
- [x] **Auto-fare calculation in New Booking Page** - fare is automatically populated when:
  - Drop-off location matches a zone (by postcode or area name)
  - Vehicle type is selected
  - Shows toast notification: "Fare auto-set from [Zone Name]: £XX.XX"

#### Walkaround Certificates Page (NEW)
- [x] Created new admin page at `/admin/walkaround-certificates`
- [x] **Filters**: Search by certificate #/vehicle/driver, filter by vehicle, driver, date range
- [x] **Table view**: Shows certificate #, date/time, vehicle, driver, type, status, actions
- [x] **PDF Viewer**: View certificates in a modal dialog with embedded PDF viewer
- [x] **Download PDF**: Download certificate as PDF file
- [x] Backend: Enhanced `/api/walkaround-checks` endpoint with date range and search filters

### Previous Sessions
- Booking page: 14-day default view, date range filter with presets
- New/Edit booking: `deposit_paid`, `deposit_date`, `booking_source` fields
- Driver app: End shift bug fix, invisible car icon fix, offline validation
- ActiveRideScreen rewritten with progressive stops, notes, pricing

## Pending/In Progress

### P0 - Critical
- [ ] User to verify driver app login works with new APK

### P1 - High Priority
- [ ] Integrate fare zones into booking form for automatic price calculation
- [ ] SMS templates based on assigned vehicle type
- [ ] Backend logic to auto-set `booking_source` to 'portal' for portal bookings

### P2 - Medium Priority
- [ ] Refactor `server.py` modularization (ongoing)
- [ ] Refactor large frontend components (`NewBookingPage.jsx`, `BookingsPage.jsx`)
- [ ] Export bookings to CSV
- [ ] Driver availability calendar
- [ ] Email invoice PDF to clients
- [ ] Online invoice payment via Stripe

## API Endpoints

### Fare Settings
- `GET /api/settings/fare-zones` - List all fare zones
- `POST /api/settings/fare-zones` - Create zone with vehicle_fares
- `PUT /api/settings/fare-zones/{id}` - Update zone
- `DELETE /api/settings/fare-zones/{id}` - Delete zone
- `GET /api/settings/mile-rates` - Get mile-based pricing
- `PUT /api/settings/mile-rates` - Update mile rates
- `POST /api/settings/calculate-fare` - Calculate fare (supports vehicle_type_id)

### Driver App
- `POST /api/driver/login` - Driver authentication
- `GET /api/driver/profile` - Returns `{driver: {...}, vehicle: ...}`
- `GET /api/driver/document-notifications` - Returns `{notifications: [...], count: N}`
- `GET /api/driver/bookings` - Returns `{today: [], upcoming: [], past: []}`

## Data Models

### FareZone
```python
{
  "id": "uuid",
  "name": "Zone Name",
  "zone_type": "dropoff|pickup|both",
  "postcodes": ["NE1", "NE13"],
  "areas": ["Newcastle Airport"],
  "vehicle_fares": {
    "vehicle_type_id_1": 25.00,
    "vehicle_type_id_2": 45.00
  },
  "boundary": [{"lat": 54.77, "lng": -1.57}, ...],
  "description": "Optional notes",
  "created_at": "ISO timestamp"
}
```

## Credentials
- **Admin**: admin@cjstravel.uk / admin123
- **Driver**: john.driver@cjstravel.uk / password123
- **Expo**: chris@cjstravel.uk / Newhouse@1
