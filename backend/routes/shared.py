# Shared dependencies, models, and utilities
from fastapi import HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field
from typing import List, Optional, Dict
from enum import Enum
from datetime import datetime, timezone, timedelta
from motor.motor_asyncio import AsyncIOMotorClient
import os
import hashlib
import jwt
import logging
from pathlib import Path
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / '.env')

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET')
JWT_ALGORITHM = "HS256"

# MongoDB connection
mongo_url = os.environ.get('MONGO_URL')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'cjbooking')]

# Security
security = HTTPBearer(auto_error=False)

# ========== HELPER FUNCTIONS ==========
def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

def create_token(user_id: str, phone: str) -> str:
    payload = {
        "sub": user_id,
        "phone": phone,
        "exp": datetime.now(timezone.utc) + timedelta(days=30)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def create_admin_token(user_id: str, email: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "type": "admin",
        "exp": datetime.now(timezone.utc) + timedelta(days=7)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def verify_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# ========== DEPENDENCY FUNCTIONS ==========
async def get_current_admin(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = verify_token(credentials.credentials)
    if payload.get("type") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return payload

async def get_current_passenger(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = verify_token(credentials.credentials)
    passenger_id = payload.get("sub")
    if not passenger_id:
        raise HTTPException(status_code=401, detail="Invalid token")
    passenger = await db.passengers.find_one({"id": passenger_id}, {"_id": 0})
    if not passenger:
        raise HTTPException(status_code=404, detail="Passenger not found")
    return passenger

async def get_current_driver(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = verify_token(credentials.credentials)
    driver_id = payload.get("sub")
    if not driver_id:
        raise HTTPException(status_code=401, detail="Invalid token")
    driver = await db.drivers.find_one({"id": driver_id}, {"_id": 0})
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")
    return driver

async def get_current_client(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        client_id = payload.get("client_id")
        if not client_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        client = await db.clients.find_one({"id": client_id}, {"_id": 0})
        if not client:
            raise HTTPException(status_code=404, detail="Client not found")
        return client
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# ========== ENUMS ==========
class DriverStatus(str, Enum):
    AVAILABLE = "available"
    BUSY = "busy"
    OFFLINE = "offline"
    ON_JOB = "on_job"
    ON_BREAK = "on_break"

class BookingStatus(str, Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    ASSIGNED = "assigned"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"

class ClientStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"

class ClientType(str, Enum):
    BUSINESS = "business"
    PRIVATE = "private"
    CORPORATE = "corporate"
    SCHOOL = "school"
    COUNCIL = "council"
    INVOICE = "Invoice"

class PaymentMethod(str, Enum):
    CASH = "cash"
    CARD = "card"
    ACCOUNT = "account"

class AdminRole(str, Enum):
    SUPER_ADMIN = "super_admin"
    ADMIN = "admin"
    OPERATOR = "operator"

# ========== SHARED MODELS ==========
class AdminUserBase(BaseModel):
    email: str
    name: str
    role: AdminRole = AdminRole.OPERATOR
    is_active: bool = True

class AdminUserCreate(AdminUserBase):
    password: str

class AdminUser(AdminUserBase):
    id: str
    created_at: str

class AdminLoginRequest(BaseModel):
    email: str
    password: str

class AdminLoginResponse(BaseModel):
    token: str
    user: AdminUser

class FlightInfo(BaseModel):
    flight_number: Optional[str] = None
    arrival_airport: Optional[str] = None
    arrival_terminal: Optional[str] = None
    scheduled_arrival: Optional[str] = None
    estimated_arrival: Optional[str] = None
    flight_status: Optional[str] = None

class BookingHistoryEntry(BaseModel):
    timestamp: str
    action: str
    user_id: Optional[str] = None
    user_name: Optional[str] = None
    user_type: Optional[str] = None
    details: Optional[str] = None
    changes: Optional[Dict] = None

# ========== UTILITY FUNCTIONS ==========
async def generate_booking_id():
    """Generate a unique booking ID in format CJ-XXX"""
    counter = await db.counters.find_one_and_update(
        {"_id": "booking_id"},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=True
    )
    return f"CJ-{str(counter['seq']).zfill(3)}"

async def generate_client_account_no():
    """Generate unique client account number"""
    counter = await db.counters.find_one_and_update(
        {"_id": "client_account"},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=True
    )
    return f"CJ{str(counter['seq']).zfill(4)}"
