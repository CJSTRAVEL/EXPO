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

### January 2026 (Latest)
- **Fleet Scheduling Page** (VERIFIED - Jan 27): Dedicated scheduling page at `/scheduling` for vehicle allocation
  - **Working Hours View (6am-8pm)**: Focused timeline showing business hours
  - **Full 24h Timeline Page** (`/scheduling/full`): Complete daily view for overnight/early jobs
  - **Zoom Controls**: Adjustable timeline scale (50%-200%)
  - **Color Coded Bookings**: Purple=Contract, Green=Airport, Indigo=Corporate, Blue=Standard
  - **Driver Assignment Per Vehicle**: Dropdown to assign driver to vehicle for the day
  - **Vehicle Display Names**: Shows friendly names like "CJ's Taxi 1", "CJ's Taxi 2" instead of registration
  - **Drag & Drop** (VERIFIED - Jan 27): Drag bookings between vehicles to reassign - persists to database
  - Timeline view with all vehicles grouped by type
  - Unassigned bookings section for the selected date
  - Vehicle allocation dialog with dropdown selection
  - Date navigation (previous/next day, calendar picker, today button)
  - Click-to-allocate on empty vehicle timeline slots
  - **Auto-Schedule Feature** (VERIFIED): One-click intelligent booking assignment
    - **CONTRACT WORK PRIORITY 1**: Contract jobs assigned first with preferred vehicle
    - Suggests alternative vehicles if preferred is unavailable
    - PSV jobs only assigned to PSV vehicles
    - Taxi jobs with >6 passengers can use PSV vehicles
    - 15-minute buffer enforced between jobs
    - Bin packing optimization to minimize vehicles used
    - Shows results summary with contract vs regular assignments
  - **Timeline Summary Panel** (VERIFIED): Overview of scheduled jobs
    - Shows total bookings, vehicles used, unassigned count
    - Vehicle breakdown with clickable booking references
  - **View Booking Popup** (VERIFIED): Detailed booking information modal
    - Customer details (name, passengers, phone, email)
    - Journey details (date/time, pickup, stops, dropoff)
    - Vehicle type and fare
    - Assigned vehicle status
    - Quick "Allocate Vehicle" action for unassigned bookings
- **Contract Work Enhancements** (VERIFIED - Jan 27):
  - Preferred Vehicle selection in contract booking form
  - Vehicle conflict checking with 15-minute buffer
  - Alternative vehicle suggestions when conflict detected
  - "Add to schedule immediately" option
- **WhatsApp Notifications via Twilio** (VERIFIED): Template-based messaging with SMS fallback
  - Integration with Twilio API for WhatsApp delivery
  - Backend proxy for Google Places autocomplete (secure API key handling)
  - Root `/health` endpoint for Kubernetes deployment
- **Repeat Booking Feature** (VERIFIED): Create recurring bookings on New Booking page and Contract Work page
  - Daily, Weekly, or Custom Days repeat patterns
  - End by number of occurrences (2-52) or end date
  - Bookings linked via `repeat_group_id` field
  - Backend endpoint: `POST /api/bookings/repeat`
  - Test suite: `/app/backend/tests/test_repeat_bookings.py`
- **SMS Templates with Vehicle Details** (VERIFIED): Added vehicle colour, make, model, registration to driver_on_route and driver_arrived SMS
- **Invoice Delete & Past Jobs** (VERIFIED): Delete invoice option, bookings move to Past Jobs when invoice paid, restore on delete
- **Invoice Journey Selection** (VERIFIED): Checkbox selection when generating invoices + remove journey from Invoice Manager edit
- **Invoice Template Redesign** (VERIFIED): Gold/black color scheme, company logo embedded, fixed layout (no overlap)
- **Invoice Template Unification** (VERIFIED): Professional PDF template now used across both Admin and Client Portal downloads
- **VAT System**: VAT options (20%, No VAT, Exempt) added to client details and integrated into invoices
- **Invoice Manager**: Full admin page for viewing, searching, editing all invoices
- **Driver App Fixes**: Swipe-to-confirm bug fixed, logout rule implemented, UI redesign, "in-progress" bar linked
- **Booking Logic Fixes**: `client_id` and `quoted_fare` now correctly transferred from requests to bookings
- **Bug Fixes**: Client detail updates, driver assignment filtering, calendar icon bug in portal
- **Driver App New Build** (PENDING USER VERIFICATION): Production AAB build `ab3bb23f-2cd6-45db-b9d3-f4d096d6692b` ready for Play Store upload

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
- ✅ Repeat Booking Feature - VERIFIED WORKING
- ✅ Fleet Scheduling Drag & Drop - VERIFIED WORKING (Jan 27)
- ✅ Driver Assignment Dropdown - VERIFIED WORKING (Jan 27)
- ✅ Contract Work Vehicle Preference - VERIFIED WORKING (Jan 27)
- ✅ Auto-Allocation on Time Conflict - VERIFIED WORKING (Jan 27)
  - When scheduling creates a time conflict, system automatically finds next available vehicle of same type
  - Works on both drag-drop and manual allocation
  - Shows informative toast: "Time conflict on [Vehicle] - auto-assigned to [Next Available]"
  - Falls back to error if no alternative vehicle available
- ✅ Travel Time Validation - VERIFIED WORKING (Jan 27)
  - Uses Google Maps Directions API to calculate actual travel time between jobs
  - Validates driver can reach next pickup location in time
  - Includes 15-minute grace period between jobs
  - Shows warnings for tight schedules (within 10 min of required time)
  - Auto-allocates to alternative vehicle if travel time conflict exists
  - API: POST /api/scheduling/check-travel-time

### P1 (High Priority)
- ✅ SMS Templates: Vehicle details added - VERIFIED WORKING
- Driver App APK: User testing for new build (ab3bb23f...) - PENDING USER ACTION
- iOS Driver App Build - NOT STARTED (requires credential setup)

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
