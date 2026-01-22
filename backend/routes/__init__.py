# Routes package initialization
from .shared import (
    db, security, hash_password, create_token, create_admin_token, verify_token,
    get_current_admin, get_current_passenger, get_current_driver, get_current_client,
    DriverStatus, BookingStatus, ClientStatus, ClientType, PaymentMethod, AdminRole,
    AdminUserBase, AdminUserCreate, AdminUser, AdminLoginRequest, AdminLoginResponse,
    FlightInfo, BookingHistoryEntry, generate_booking_id, generate_client_account_no,
    JWT_SECRET, JWT_ALGORITHM
)

# Import all routers
from .auth import router as auth_router
from .drivers import router as drivers_router
from .vehicles import router as vehicles_router
from .passengers import router as passengers_router
from .client_portal import router as client_portal_router
from .external import router as external_router
from .clients import router as clients_router
from .chat import router as chat_router
from .payments import router as payments_router
