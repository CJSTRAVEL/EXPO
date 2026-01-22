# Server.py Refactoring Guide - Phase 2 Complete

## Overview
The `server.py` file (~5400 lines, 109 endpoints) has been refactored into modular routers.

## New Directory Structure
```
/app/backend/
├── server.py              # Main application (ready for final integration)
├── routes/
│   ├── __init__.py        # Package exports all routers
│   ├── shared.py          # Shared models, dependencies, utilities (~200 lines)
│   ├── auth.py            # Admin authentication (~150 lines) ✓
│   ├── drivers.py         # Driver CRUD + mobile app (~400 lines) ✓
│   ├── vehicles.py        # Vehicle CRUD + types (~200 lines) ✓
│   ├── passengers.py      # Passenger portal (~150 lines) ✓
│   ├── client_portal.py   # Client portal + password reset (~400 lines) ✓
│   ├── external.py        # Google Maps, Postcode, Flight API (~250 lines) ✓
│   ├── clients.py         # Client management + invoices (~350 lines) ✓
│   ├── chat.py            # Chat endpoints (~100 lines) ✓
│   └── payments.py        # Stripe integration (~200 lines) ✓
└── tests/
```

## All Routers Complete ✓

### 1. shared.py - Base Infrastructure
- Database connection (lazy-loaded)
- JWT configuration
- Helper functions (hash_password, create_token, verify_token)
- Authentication dependencies (get_current_admin, get_current_driver, etc.)
- Enums (DriverStatus, BookingStatus, ClientStatus, etc.)
- Common models (AdminUser, FlightInfo, BookingHistoryEntry)
- Utility functions (generate_booking_id, generate_client_account_no)

### 2. auth.py - Admin Authentication (~150 lines)
- `POST /auth/login` - Admin login
- `GET /auth/me` - Get current admin
- `PUT /auth/profile` - Update profile
- `GET /auth/users` - List admin users
- `POST /auth/users` - Create admin user
- `PUT /auth/users/{id}` - Update admin user
- `DELETE /auth/users/{id}` - Delete admin user

### 3. drivers.py - Driver Management (~400 lines)
- `POST /drivers` - Create driver
- `GET /drivers` - List drivers
- `GET /drivers/{id}` - Get driver
- `PUT /drivers/{id}` - Update driver
- `DELETE /drivers/{id}` - Delete driver
- `POST /driver/login` - Driver app login
- `GET /driver/profile` - Get driver profile
- `PUT /driver/status` - Update status
- `PUT /driver/location` - Update location
- `PUT /driver/change-password` - Change password
- `POST /driver/select-vehicle` - Select vehicle
- `POST /driver/release-vehicle` - Release vehicle
- `GET /driver/available-vehicles` - List available vehicles
- `GET /driver/stats` - Get statistics
- `GET /driver/earnings` - Get earnings
- `GET /driver/history` - Get booking history
- `GET /driver/document-notifications` - Check expiry

### 4. vehicles.py - Vehicle Management (~200 lines)
- `POST /vehicle-types` - Create vehicle type
- `GET /vehicle-types` - List vehicle types
- `GET /vehicle-types/{id}` - Get vehicle type
- `PUT /vehicle-types/{id}` - Update vehicle type
- `DELETE /vehicle-types/{id}` - Delete vehicle type
- `POST /vehicles` - Create vehicle
- `GET /vehicles` - List vehicles
- `GET /vehicles/{id}` - Get vehicle
- `PUT /vehicles/{id}` - Update vehicle
- `DELETE /vehicles/{id}` - Delete vehicle

### 5. passengers.py - Passenger Portal (~150 lines)
- `POST /passenger/register` - Register passenger
- `POST /passenger/login` - Login passenger
- `GET /passenger/me` - Get profile
- `GET /passenger/bookings` - Get bookings
- `POST /passenger/booking-requests` - Create booking request
- `GET /passenger/booking-requests` - Get booking requests

### 6. client_portal.py - Client Portal (~400 lines)
- `POST /client-portal/register` - Register client
- `POST /client-portal/login` - Login client
- `GET /client-portal/bookings` - Get client bookings
- `POST /client-portal/booking-requests` - Create booking request
- `GET /client-portal/booking-requests` - Get booking requests
- `GET /client-portal/invoices` - Get invoices
- `GET /client-portal/invoices/{id}` - Get invoice details
- `GET /client-portal/invoices/{id}/download` - Download PDF
- `POST /password-reset/request` - Request reset code
- `POST /password-reset/verify` - Verify and reset

### 7. external.py - External APIs (~250 lines)
- `GET /directions` - Google Maps directions
- `GET /postcode/{postcode}` - UK address lookup
- `GET /flight/{flight_number}` - Flight tracking

### 8. clients.py - Client Management (~350 lines)
- `GET /clients` - List clients
- `GET /clients/{id}` - Get client
- `GET /clients/{id}/bookings` - Get client bookings
- `POST /clients` - Create client
- `PUT /clients/{id}` - Update client
- `DELETE /clients/{id}` - Delete client
- `GET /clients/{id}/invoice/preview` - Invoice preview
- `POST /clients/{id}/invoice` - Generate PDF invoice

### 9. chat.py - Chat System (~100 lines)
- `POST /driver/chat/send` - Driver send message
- `GET /driver/chat/{booking_id}` - Driver get messages
- `POST /dispatch/chat/send` - Dispatch send message
- `GET /dispatch/chat/{booking_id}` - Dispatch get messages

### 10. payments.py - Stripe Integration (~200 lines)
- `POST /payments/create-checkout` - Create checkout session
- `GET /payments/status/{session_id}` - Get payment status
- `POST /webhook/stripe` - Stripe webhook handler

## Still in server.py (Not Yet Extracted)
The following endpoints remain in server.py and are the largest section:
- **Booking endpoints** (~600 lines) - CRUD, assignment, status, SMS/email
- **Admin endpoints** - Templates, stats, maintenance, booking requests
- **Driver booking endpoints** - Jobs, active ride, status updates

## Integration Instructions

To use the routers in server.py, add after the api_router definition:

```python
# Import routers
from routes import (
    auth_router, drivers_router, vehicles_router, passengers_router,
    client_portal_router, external_router, clients_router, chat_router, payments_router
)

# Include routers
api_router.include_router(auth_router)
api_router.include_router(drivers_router)
api_router.include_router(vehicles_router)
api_router.include_router(passengers_router)
api_router.include_router(client_portal_router)
api_router.include_router(external_router)
api_router.include_router(clients_router)
api_router.include_router(chat_router)
api_router.include_router(payments_router)
```

Then remove the corresponding duplicate endpoints from server.py.

## Benefits After Full Integration
- **server.py** reduced from ~5400 lines to ~2000 lines
- Each module <400 lines, easier to maintain
- Clear separation of concerns
- Easier testing per module
- Better IDE navigation
- Parallel development possible

## Total Lines Extracted
~2200 lines moved to modular routers:
- shared.py: 200 lines
- auth.py: 150 lines
- drivers.py: 400 lines
- vehicles.py: 200 lines
- passengers.py: 150 lines
- client_portal.py: 400 lines
- external.py: 250 lines
- clients.py: 350 lines
- chat.py: 100 lines
- payments.py: 200 lines

## Testing
All routers have been tested for import compatibility:
```bash
cd /app/backend && python -c "from routes import *; print('All routers OK')"
```

## Next Steps
1. Integrate routers into server.py
2. Remove duplicate endpoints from server.py
3. Extract remaining booking endpoints (Phase 3)
4. Run comprehensive regression testing
