# Server.py Refactoring Guide

## Overview
The `server.py` file has grown to ~5400 lines with 109 endpoints. This document outlines the modular router structure being implemented.

## New Directory Structure
```
/app/backend/
├── server.py              # Main application (being refactored)
├── routes/
│   ├── __init__.py        # Package exports
│   ├── shared.py          # Shared models, dependencies, utilities
│   ├── auth.py            # Admin authentication (READY)
│   ├── drivers.py         # Driver CRUD + mobile app (READY)
│   ├── vehicles.py        # Vehicle CRUD + types (READY)
│   ├── passengers.py      # Passenger portal (READY)
│   ├── client_portal.py   # Client portal + password reset (READY)
│   ├── bookings.py        # Booking CRUD (TODO)
│   ├── clients.py         # Client CRUD + invoices (TODO)
│   ├── external.py        # Directions, postcode, flight (TODO)
│   ├── templates.py       # SMS/Email templates (TODO)
│   ├── payments.py        # Stripe integration (TODO)
│   └── chat.py            # Chat endpoints (TODO)
└── tests/
```

## Completed Routers

### 1. auth.py (~150 lines)
Endpoints extracted:
- `POST /api/auth/login` - Admin login
- `GET /api/auth/me` - Get current admin
- `PUT /api/auth/profile` - Update profile
- `GET /api/auth/users` - List admin users
- `POST /api/auth/users` - Create admin user
- `PUT /api/auth/users/{id}` - Update admin user
- `DELETE /api/auth/users/{id}` - Delete admin user

### 2. drivers.py (~350 lines)
Endpoints extracted:
- `POST /api/drivers` - Create driver
- `GET /api/drivers` - List drivers
- `GET /api/drivers/{id}` - Get driver
- `PUT /api/drivers/{id}` - Update driver
- `DELETE /api/drivers/{id}` - Delete driver
- `POST /api/driver/login` - Driver app login
- `GET /api/driver/profile` - Get driver profile
- `PUT /api/driver/status` - Update status
- `PUT /api/driver/location` - Update location
- `PUT /api/driver/change-password` - Change password
- `POST /api/driver/select-vehicle` - Select vehicle
- `POST /api/driver/release-vehicle` - Release vehicle
- `GET /api/driver/available-vehicles` - List available vehicles
- `GET /api/driver/stats` - Get statistics
- `GET /api/driver/earnings` - Get earnings
- `GET /api/driver/history` - Get booking history
- `GET /api/driver/document-notifications` - Check expiry

### 3. vehicles.py (~200 lines)
Endpoints extracted:
- `POST /api/vehicle-types` - Create vehicle type
- `GET /api/vehicle-types` - List vehicle types
- `GET /api/vehicle-types/{id}` - Get vehicle type
- `PUT /api/vehicle-types/{id}` - Update vehicle type
- `DELETE /api/vehicle-types/{id}` - Delete vehicle type
- `POST /api/vehicles` - Create vehicle
- `GET /api/vehicles` - List vehicles
- `GET /api/vehicles/{id}` - Get vehicle
- `PUT /api/vehicles/{id}` - Update vehicle
- `DELETE /api/vehicles/{id}` - Delete vehicle

### 4. passengers.py (~150 lines)
Endpoints extracted:
- `POST /api/passenger/register` - Register passenger
- `POST /api/passenger/login` - Login passenger
- `GET /api/passenger/me` - Get profile
- `GET /api/passenger/bookings` - Get bookings
- `POST /api/passenger/booking-requests` - Create booking request
- `GET /api/passenger/booking-requests` - Get booking requests

### 5. client_portal.py (~350 lines)
Endpoints extracted:
- `POST /api/client-portal/register` - Register client
- `POST /api/client-portal/login` - Login client
- `GET /api/client-portal/bookings` - Get client bookings
- `POST /api/client-portal/booking-requests` - Create booking request
- `GET /api/client-portal/booking-requests` - Get booking requests
- `GET /api/client-portal/invoices` - Get invoices
- `GET /api/client-portal/invoices/{id}` - Get invoice details
- `GET /api/client-portal/invoices/{id}/download` - Download PDF
- `POST /api/password-reset/request` - Request reset code
- `POST /api/password-reset/verify` - Verify and reset

## Remaining Endpoints to Extract

### bookings.py (Highest Priority)
~600 lines of booking CRUD, assignment, status updates:
- `/api/bookings` - CRUD
- `/api/bookings/{id}/assign/{driver_id}` - Assign driver
- `/api/bookings/{id}/unassign` - Unassign driver
- `/api/bookings/{id}/resend-sms` - Resend SMS
- `/api/bookings/{id}/resend-email` - Resend email
- `/api/b/{short_id}` - Get by short ID
- `/api/preview/{short_id}` - Booking preview HTML

### clients.py
~400 lines of client management:
- `/api/clients` - CRUD
- `/api/clients/{id}/bookings` - Get client bookings
- `/api/clients/{id}/invoice/preview` - Invoice preview
- `/api/clients/{id}/invoice` - Generate invoice PDF

### external.py
~300 lines of external API integrations:
- `/api/directions` - Google Maps directions
- `/api/postcode/{code}` - Address lookup
- `/api/flight/{number}` - Flight tracking

### templates.py
~200 lines of SMS/Email template management:
- `/api/admin/templates/sms` - SMS templates
- `/api/admin/templates/email` - Email templates
- `/api/admin/templates/sms/test` - Test SMS

### payments.py
~200 lines of Stripe integration:
- `/api/payments/create-checkout` - Create checkout
- `/api/payments/status/{id}` - Check status
- `/api/webhook/stripe` - Stripe webhook

### chat.py
~100 lines of chat functionality:
- `/api/driver/chat/*` - Driver chat
- `/api/dispatch/chat/*` - Dispatch chat

## Integration Steps

To integrate a router into server.py:

```python
# At the top of server.py, add import:
from routes.auth import router as auth_router

# After creating api_router, add:
api_router.include_router(auth_router)
```

## Benefits After Full Migration
- **server.py** reduced from ~5400 lines to ~500 lines
- Each module <400 lines, easier to maintain
- Clear separation of concerns
- Easier testing per module
- Better IDE navigation
- Parallel development possible

## Migration Status
- [x] shared.py - Base utilities
- [x] auth.py - Admin authentication
- [x] drivers.py - Driver management
- [x] vehicles.py - Vehicle management  
- [x] passengers.py - Passenger portal
- [x] client_portal.py - Client portal
- [ ] bookings.py - Booking management
- [ ] clients.py - Client management
- [ ] external.py - External APIs
- [ ] templates.py - Templates
- [ ] payments.py - Payments
- [ ] chat.py - Chat
- [ ] Final integration into server.py
