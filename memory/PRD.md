# CJ's Executive Travel - Private Hire Booking Application PRD

## Original Problem Statement
Build a private hire application where you can add bookings and assign them to drivers. Key features include SMS confirmations, public booking tracking links, Google Maps address autocomplete with UK postcode support, and route calculation.

## User Choices/Defaults
- **Driver Info**: Basic (name, phone, vehicle type, vehicle number)
- **Booking Details**: Full (customer name, phone, pickup/dropoff, date/time, status, notes, fare, distance, duration)
- **User Role**: Admin only (simple internal dispatch tool)
- **Authentication**: None required
- **SMS Notifications**: Vonage integration with "CJs Travel" sender ID
- **Address Lookup**: Google Maps + Getaddress.io for UK postcodes
- **Route Calculation**: Google Maps Directions API

## User Personas
- **Dispatcher/Admin**: Fleet manager who creates bookings, manages drivers, and assigns trips
- **Customer**: Receives SMS with tracking link to view booking status

## Core Requirements
1. Driver Management (CRUD operations)
2. Booking Management (CRUD operations)
3. Driver Assignment to Bookings
4. Status Tracking (pending, assigned, in_progress, completed, cancelled)
5. Dashboard with stats overview
6. SMS Confirmations to customers with tracking links
7. Public booking tracking page with live map
8. Address autocomplete with UK postcode support
9. Route mileage and duration calculation

## Technical Architecture
- **Backend**: FastAPI + MongoDB + Vonage SMS + Google Maps API + Getaddress.io
- **Frontend**: React + Tailwind CSS + shadcn/ui
- **Database**: MongoDB (drivers, bookings collections)
- **SMS Provider**: Vonage (sender ID: "CJs Travel")
- **Mapping**: Google Maps (Places, Directions, Static Maps, Embed API)
- **Address Lookup**: Getaddress.io for UK postcodes
- **Email Provider**: Mailgun SMTP for booking confirmations

## What's Been Implemented (January 2026)
- ✅ Dashboard with stats (Total Bookings, Active Drivers, In Progress, Revenue)
- ✅ Recent Bookings feed on dashboard
- ✅ Status Overview panel
- ✅ Drivers page with card grid layout
- ✅ Driver CRUD (create, read, update, delete)
- ✅ Bookings page with data table
- ✅ Booking CRUD (create, read, update, delete)
- ✅ Assign driver to booking functionality
- ✅ Status badges with color coding
- ✅ Calendar/date picker for booking datetime
- ✅ Toast notifications for user feedback
- ✅ Responsive sidebar navigation
- ✅ **SMS Confirmations** - Auto-send SMS when booking created (via Vonage)
- ✅ SMS status indicator in bookings table
- ✅ **Public Booking Page** - Customer-facing tracking with live map
- ✅ **Address Autocomplete** - Google Maps + Getaddress.io for UK postcodes
- ✅ **Route Calculation** - Mileage and duration display in booking form
- ✅ **Company Rebranding** - CJ's Executive Travel logo and name
- ✅ **Edit Booking Bug Fix** (Jan 19, 2026) - Fixed Select.Item empty value crash
- ✅ **View Booking Feature** (Jan 19, 2026) - Click row to view booking details with map, fare, status, driver info
- ✅ **Quick Assign Driver Link** (Jan 19, 2026) - Driver column shows clickable "Assign Driver" link for unassigned bookings
- ✅ **Quick Add Driver from Assign Modal** (Jan 19, 2026) - "+ Add New Driver" link in assign modal allows creating drivers without leaving bookings page
- ✅ **Assign Driver from View Modal** (Jan 19, 2026) - "+ Assign Driver" link in view booking modal under "Assigned Driver" section
- ✅ **Booking ID System** (Jan 19, 2026) - Auto-generated sequential booking IDs (CJ-001, CJ-002, etc.) displayed in table and view modal
- ✅ **Date-Grouped Booking Layout** (Jan 19, 2026) - Bookings page redesigned with bookings grouped by date, card-based layout with time, route visualization, and status colors
- ✅ **Search & Filter** (Jan 19, 2026) - Full search/filter functionality on bookings page (text, date, driver)
- ✅ **Resend SMS** (Jan 19, 2026) - Resend SMS confirmation link in booking view
- ✅ **Short URL System** (Jan 19, 2026) - Clean short URLs for SMS links (/b/CJ-001)
- ✅ **Open Graph Meta Tags** (Jan 19, 2026) - Added OG tags to public booking page for link previews
- ✅ **Passengers Page** (Jan 19, 2026) - Customer contact list with booking history
- ✅ **Passenger Authentication** (Jan 19, 2026) - JWT-based login system for customers
- ✅ **Passenger Portal** (Jan 19, 2026) - Customer-facing portal for viewing own bookings
- ✅ **Passenger Portal Admin** (Jan 20, 2026) - Admin page to manage passenger accounts (view, change password, delete)
- ✅ **Create User Feature** (Jan 20, 2026) - Admins can manually create passenger accounts from the admin page
- ✅ **GPS Live Dashboard** (Jan 19, 2026) - Embedded GPS tracking map from gpslive.co.uk
- ✅ **Split Customer Name** (Jan 20, 2026) - New booking form now has separate First Name and Last Name fields (backward compatible with existing bookings)
- ✅ **Clients Page** (Jan 20, 2026) - B2B client account management with auto-generated account numbers (E001, E002...), client types, payment methods, and invoice tracking
- ✅ **Booking-Client Integration** (Jan 20, 2026) - Bookings can be linked to clients for invoicing purposes
- ✅ **Generate Invoice PDF** (Jan 20, 2026) - Download professional PDF invoices for clients with customizable date range, quick select options (This Month, Last Month, All Time), and full booking details
- ✅ **Contract Work Page** (Jan 20, 2026) - Dedicated page for client-linked bookings, separate from main bookings page
- ✅ **SMS Link Preview Fix** (Jan 20, 2026) - Server-side rendered preview page with Open Graph meta tags for proper link previews
- ✅ **Multi-Stop Bookings** (Jan 20, 2026) - Support for multiple drop-off locations (additional stops) on bookings
- ✅ **Return Journey Creation** (Jan 20, 2026) - Option to automatically create a return booking with pickup/dropoff swapped
- ✅ **Flight Information** (Jan 20, 2026) - Track flight details (flight number, airline, type, terminal) for airport transfers
- ✅ **Live Flight Tracking** (Jan 20, 2026) - AviationStack API integration for real-time flight data lookup with auto-fill
- ✅ **Passenger Booking Requests** (Jan 20, 2026) - Passengers can request bookings from their portal
- ✅ **Dedicated Requests Page** (Jan 20, 2026) - Separate admin page for managing passenger booking requests with approve/reject functionality
- ✅ **Request Notification Badge** (Jan 20, 2026) - Sidebar shows pending request count badge with auto-refresh
- ✅ **Enhanced Portal Request Form** (Jan 20, 2026) - Passenger booking request form now matches admin booking form with address autocomplete, multi-stop, return journey, and full flight info with live lookup
- ✅ **PAX and Cases Fields** (Jan 20, 2026) - Added passenger count (PAX) and luggage count (Cases) fields to all booking forms (Bookings, Contract Work, Passenger Portal)
- ✅ **Return Journey Multi-Stop** (Jan 20, 2026) - Added multiple drop-off locations (additional stops) support to return journey section in all booking forms
- ✅ **Email Confirmations** (Jan 20, 2026) - Added SMTP email notifications alongside SMS. Beautiful HTML emails sent for booking confirmations, driver assignments, status updates. Includes resend-email and resend-notifications endpoints.
- ✅ **Passenger Email Field in Portal** (Jan 21, 2026) - Added email field to passenger portal booking request form for email confirmations
- ✅ **Google Maps API Key Security Fix** (Jan 21, 2026) - Moved hardcoded API key to environment variable (backend/.env)
- ✅ **Fleet Management - Vehicles Page** (Jan 21, 2026) - New Vehicles page with:
  - Vehicle Types CRUD - Create categories like "CJ's Taxi" (4 pax), "CJ's 8 Minibus", "CJ's 16 Minibus", "CJ's 16 with Trailer"
  - Vehicles CRUD - Add individual vehicles with registration, make, model, color, year
  - Document tracking - Insurance, Road Tax, DCC Test Date 1 & 2 expiry dates with status badges (Valid/Expiring/Expired)
  - Photo URLs - Both vehicle types and vehicles support photo images
  - Vehicle type linking - Assign vehicles to types, shows vehicle count per type
  - Has Trailer flag - Special badge for vehicles with attached luggage trailers
  - Search & Filter - Filter by type, status (active/inactive/expiring docs), search by registration/make/model
  - Delete protection - Cannot delete vehicle types that have assigned vehicles

- ✅ **Admin User Authentication** (Jan 21, 2026) - User login and account system for dispatch:
  - Admin login page at /admin/login with professional dark theme
  - JWT-based authentication with 7-day token expiry
  - Protected routes - all dispatch pages require authentication
  - Role-based access: Super Admin, Admin, Dispatcher
  - User profile editing and password change
  - User Management (Super Admin only) - Create, edit, disable, delete users
  - Default admin created on first startup: admin@cjstravel.uk / admin123
  - Logout functionality with token cleanup

## API Endpoints
- `GET/POST /api/drivers` - List/Create drivers
- `GET/PUT/DELETE /api/drivers/{id}` - Get/Update/Delete driver
- `GET/POST /api/bookings` - List/Create bookings (POST triggers SMS)
- `GET/PUT/DELETE /api/bookings/{id}` - Get/Update/Delete booking
- `POST /api/bookings/{booking_id}/assign/{driver_id}` - Assign driver
- `GET /api/stats` - Dashboard statistics
- `GET /api/postcode/{postcode}` - UK postcode lookup (proxy to Getaddress.io)
- `GET /api/directions` - Route calculation (proxy to Google Maps)
- `GET /api/bookings/by-short-id/{short_id}` - Get booking by short ID (CJ-001)
- `POST /api/bookings/{booking_id}/resend-sms` - Resend SMS confirmation
- `POST /api/bookings/{booking_id}/resend-email` - Resend email confirmation
- `POST /api/passenger/register` - Register new passenger account
- `POST /api/passenger/login` - Passenger login
- `GET /api/passenger/bookings` - Get authenticated passenger's bookings
- `GET /api/admin/passengers` - Get all passengers (admin)
- `POST /api/admin/passengers` - Create passenger (admin)
- `PUT /api/admin/passengers/{id}/password` - Change passenger password (admin)
- `DELETE /api/admin/passengers/{id}` - Delete passenger (admin)
- `GET/POST /api/clients` - List/Create clients
- `GET/PUT/DELETE /api/clients/{id}` - Get/Update/Delete client
- `GET /api/clients/{id}/bookings` - Get client's bookings
- `GET /api/flight-lookup` - Live flight data lookup (AviationStack API)
- `GET /api/admin/booking-requests` - List all booking requests
- `POST /api/passenger/booking-requests` - Create booking request (passenger portal)
- `PUT /api/admin/booking-requests/{id}/approve` - Approve request and create booking
- `PUT /api/admin/booking-requests/{id}/reject` - Reject booking request
- `POST /api/payments/create-checkout` - Create Stripe checkout session
- `GET /api/payments/status/{session_id}` - Get payment status
- `GET/POST /api/vehicle-types` - List/Create vehicle types
- `GET/PUT/DELETE /api/vehicle-types/{id}` - Get/Update/Delete vehicle type
- `GET/POST /api/vehicles` - List/Create vehicles
- `GET/PUT/DELETE /api/vehicles/{id}` - Get/Update/Delete vehicle
- `POST /api/auth/login` - Admin user login
- `GET /api/auth/me` - Get current admin user profile
- `PUT /api/auth/profile` - Update current user's profile
- `GET /api/auth/users` - List all admin users (admin only)
- `POST /api/auth/users` - Create new admin user (super_admin only)
- `PUT /api/auth/users/{id}` - Update admin user (super_admin only)
- `DELETE /api/auth/users/{id}` - Delete admin user (super_admin only)

### Driver Mobile App API Endpoints
- `POST /api/driver/login` - Driver authentication
- `GET /api/driver/profile` - Get driver profile
- `PUT /api/driver/status` - Update online/break status
- `PUT /api/driver/location` - Update GPS location
- `GET /api/driver/bookings` - Get assigned bookings (today/upcoming/past)
- `GET /api/driver/bookings/pending` - Get pending assignment requests
- `PUT /api/driver/bookings/{id}/accept` - Accept booking
- `PUT /api/driver/bookings/{id}/reject` - Reject booking
- `PUT /api/driver/bookings/{id}/status` - Update booking status
- `POST /api/driver/bookings/{id}/notify-arrival` - Send arrival SMS
- `GET /api/driver/earnings` - Get earnings summary
- `GET /api/driver/history` - Get booking history
- `POST /api/driver/chat/send` - Send chat message
- `GET /api/driver/chat/{booking_id}` - Get chat messages

## Driver Mobile App (React Native / Expo)
**Location:** `/app/driver-app/`
**Expo Project:** @cjsexecutivetravel/cjs-driver
**Project ID:** c2c6287f-c151-494a-bbe7-8b1bd62daeec

### Features
- ✅ Email + password authentication
- ✅ Dashboard with online/offline toggle, break mode
- ✅ Active job card on dashboard (shows current trip)
- ✅ Today's jobs preview on dashboard
- ✅ View assigned bookings (today, upcoming, past)
- ✅ Detailed job view with full route, customer info, timeline
- ✅ Accept/reject booking assignments
- ✅ Update booking status (On Way → Arrived → In Progress → Completed)
- ✅ Status progress timeline on job detail
- ✅ One-tap navigation (opens Google/Apple Maps)
- ✅ In-app map navigation with route preview
- ✅ Live GPS tracking (shares location with dispatch)
- ✅ Background location tracking service
- ✅ Push notifications for new bookings
- ✅ One-tap call/text to passenger
- ✅ "I've arrived" notification to passenger
- ✅ Chat with dispatch
- ✅ Earnings summary (today/weekly/all-time)
- ✅ Booking history with pagination

### Test Driver Account
- Email: `john.driver@cjstravel.uk`
- Password: `password123`

### Building for App Stores
```bash
cd /app/driver-app
export EXPO_TOKEN="your-expo-token"
eas build --platform android --profile preview   # APK for testing
eas build --platform android --profile production  # Google Play AAB
eas build --platform ios --profile production       # App Store
```

## Prioritized Backlog

### P0 (Critical) - COMPLETED
- [x] Basic CRUD for drivers and bookings
- [x] Driver assignment
- [x] Dashboard overview
- [x] SMS confirmation on new booking
- [x] Edit booking functionality (bug fixed Jan 19, 2026)
- [x] Search/filter bookings by status, date, driver (Jan 19, 2026)
- [x] Passenger portal with auth system (Jan 19-20, 2026)
- [x] Admin page for passenger account management (Jan 20, 2026)

### P1 (High Priority) - In Progress
- [x] SMS link preview fix (completed Jan 20, 2026 - SSR endpoint with OG tags)
- [x] Allow passengers to request new bookings from portal (completed Jan 20, 2026)
- [x] Dedicated Requests page for admin (completed Jan 20, 2026)
- [x] Email field for passenger booking requests (completed Jan 21, 2026)
- [x] Driver mobile app EAS configuration (completed Jan 21, 2026)
- [x] Enhanced driver app with job detail screen, timeline, active job display (completed Jan 21, 2026)
- [ ] Forgot password / SMS verification for passenger portal

### P2 (Medium Priority) - Future
- [ ] Build and deploy driver app to Google Play/App Store
- [ ] Bulk status updates
- [ ] Driver availability calendar
- [ ] Export bookings to CSV
- [ ] SMS notifications for driver assignment
- [ ] Push notifications for booking status changes
- [ ] Email invoice PDF directly to clients

## Refactoring Notes
- `server.py` is a monolith (~1700+ lines) - should be split using FastAPI APIRouter (routes/bookings.py, routes/passengers.py, etc.)
- `BookingsPage.jsx` is large (~710 lines) - consider decomposing into smaller components
- `AddressAutocomplete.jsx` has complex dual-service logic - could be simplified
- Email HTML template is hardcoded in server.py - should be extracted to separate template files (Jinja2)

## Database Schema
- **drivers**: `{id, name, phone, vehicle_type, vehicle_number, status}`
- **bookings**: `{id, booking_id, first_name, last_name, customer_name, customer_phone, customer_email, passenger_count, luggage_count, pickup_address, dropoff_address, additional_stops[], client_id, flight_info{flight_number, airline, flight_type, terminal}, is_return, linked_booking_id, sms_sent, email_sent, ...}`
- **passengers**: `{id, phone, name, email, password_hash, created_at}` - Portal user accounts
- **clients**: `{id, account_no, name, mobile, email, client_type, payment_method, status, start_date, address, town_city, post_code, country, notes}` - B2B client accounts
- **booking_requests**: `{id, passenger_id, passenger_name, passenger_phone, passenger_email, pickup_location, dropoff_location, additional_stops[], pickup_datetime, passenger_count, luggage_count, flight_number, flight_info, create_return, return_*, notes, status, admin_notes, created_at}` - Passenger booking requests
- **vehicle_types**: `{id, name, capacity, description, has_trailer, photo_url, created_at}` - Vehicle categories (e.g., CJ's Taxi, CJ's 8 Minibus)
- **vehicles**: `{id, registration, make, model, color, year, vehicle_type_id, photo_url, insurance_expiry, tax_expiry, dcc_test_date_1, dcc_test_date_2, notes, is_active, created_at}` - Individual fleet vehicles
- **admin_users**: `{id, email, name, role, is_active, password_hash, created_at, last_login}` - Dispatch system admin users

## Known Issues
- None currently - SMS Link Preview has been fixed with SSR endpoint

## Next Tasks
1. Test driver mobile app build (user verification pending - save to GitHub and trigger EAS preview build)
2. Implement driver app menu functionality (hamburger menu, logo menu button)
3. Implement forgot password with SMS verification for passenger portal
4. Link vehicles to drivers (assign vehicle to driver)
5. Consider refactoring server.py into separate route files as it has grown significantly
6. Add email invoice PDF directly to clients feature
7. Implement driver availability calendar
