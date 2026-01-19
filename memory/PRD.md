# HireFleet - Private Hire Booking Application PRD

## Original Problem Statement
Build a private hire application where you can add bookings and assign them to drivers.

## User Choices/Defaults
- **Driver Info**: Basic (name, phone, vehicle type, vehicle number)
- **Booking Details**: Full (customer name, phone, pickup/dropoff, date/time, status, notes, fare)
- **User Role**: Admin only (simple internal dispatch tool)
- **Authentication**: None required

## User Personas
- **Dispatcher/Admin**: Fleet manager who creates bookings, manages drivers, and assigns trips

## Core Requirements
1. Driver Management (CRUD operations)
2. Booking Management (CRUD operations)
3. Driver Assignment to Bookings
4. Status Tracking (pending, assigned, in_progress, completed, cancelled)
5. Dashboard with stats overview

## Technical Architecture
- **Backend**: FastAPI + MongoDB
- **Frontend**: React + Tailwind CSS + shadcn/ui
- **Database**: MongoDB (drivers, bookings collections)

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

## API Endpoints
- `GET/POST /api/drivers` - List/Create drivers
- `GET/PUT/DELETE /api/drivers/{id}` - Get/Update/Delete driver
- `GET/POST /api/bookings` - List/Create bookings
- `GET/PUT/DELETE /api/bookings/{id}` - Get/Update/Delete booking
- `POST /api/bookings/{booking_id}/assign/{driver_id}` - Assign driver
- `GET /api/stats` - Dashboard statistics

## Prioritized Backlog

### P0 (Critical) - COMPLETED
- [x] Basic CRUD for drivers and bookings
- [x] Driver assignment
- [x] Dashboard overview

### P1 (High Priority) - Future
- [ ] Search/filter bookings by status, date, driver
- [ ] Bulk status updates
- [ ] Driver availability calendar

### P2 (Medium Priority) - Future
- [ ] Export bookings to CSV
- [ ] SMS/Email notifications
- [ ] Customer self-booking portal

## Next Tasks
1. Add search/filter functionality to bookings table
2. Implement bulk status update feature
3. Add driver performance metrics to dashboard
