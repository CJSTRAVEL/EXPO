from fastapi import FastAPI, APIRouter, HTTPException, BackgroundTasks, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import StreamingResponse, HTMLResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import io
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict
import uuid
from datetime import datetime, timezone, timedelta
from enum import Enum
import httpx
import hashlib
import jwt
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch, mm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image
from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT

# Stripe Integration
from emergentintegrations.payments.stripe.checkout import StripeCheckout, CheckoutSessionResponse, CheckoutStatusResponse, CheckoutSessionRequest

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# JWT Secret Key
JWT_SECRET = os.environ.get('JWT_SECRET')
if not JWT_SECRET:
    raise ValueError("JWT_SECRET environment variable is required")
JWT_ALGORITHM = "HS256"

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Getaddress.io API Key
GETADDRESS_API_KEY = os.environ.get('GETADDRESS_API_KEY')

# Vonage SMS Configuration
VONAGE_API_KEY = os.environ.get('VONAGE_API_KEY')
VONAGE_API_SECRET = os.environ.get('VONAGE_API_SECRET')
VONAGE_FROM_NUMBER = os.environ.get('VONAGE_FROM_NUMBER', 'HireFleet')

# SMTP Email Configuration
SMTP_SERVER = os.environ.get('SMTP_SERVER', 'smtp-mail.outlook.com')
SMTP_PORT = int(os.environ.get('SMTP_PORT', 587))
SMTP_USERNAME = os.environ.get('SMTP_USERNAME')
SMTP_PASSWORD = os.environ.get('SMTP_PASSWORD')
SMTP_FROM_EMAIL = os.environ.get('SMTP_FROM_EMAIL')

# Initialize Vonage client
vonage_client = None
if VONAGE_API_KEY and VONAGE_API_SECRET:
    try:
        from vonage import Auth, Vonage
        auth = Auth(api_key=VONAGE_API_KEY, api_secret=VONAGE_API_SECRET)
        vonage_client = Vonage(auth=auth)
        logging.info("Vonage SMS client initialized successfully")
    except Exception as e:
        logging.error(f"Failed to initialize Vonage client: {e}")

# Check SMTP configuration
smtp_configured = bool(SMTP_USERNAME and SMTP_PASSWORD and SMTP_FROM_EMAIL)
if smtp_configured:
    logging.info("SMTP email configured successfully")
else:
    logging.warning("SMTP email not configured - email notifications disabled")

# AviationStack API Key for flight tracking
AVIATIONSTACK_API_KEY = os.environ.get('AVIATIONSTACK_API_KEY')

# Stripe Configuration
STRIPE_API_KEY = os.environ.get('STRIPE_API_KEY')
stripe_checkout = None

# Security
security = HTTPBearer(auto_error=False)

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

def create_token(passenger_id: str, phone: str) -> str:
    payload = {
        "sub": passenger_id,
        "phone": phone,
        "exp": datetime.now(timezone.utc) + timedelta(days=30)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def create_admin_token(user_id: str, email: str, role: str) -> str:
    """Create JWT token for admin users"""
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

async def get_current_admin(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Get current admin user from token"""
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = verify_token(credentials.credentials)
    if payload.get("type") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    user = await db.admin_users.find_one({"id": payload["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user

async def get_current_passenger(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = verify_token(credentials.credentials)
    passenger = await db.passengers.find_one({"id": payload["sub"]}, {"_id": 0})
    if not passenger:
        raise HTTPException(status_code=401, detail="Passenger not found")
    return passenger

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Enums
class DriverStatus(str, Enum):
    AVAILABLE = "available"
    BUSY = "busy"
    OFFLINE = "offline"
    BREAK = "break"
    ON_JOB = "on_job"

class BookingStatus(str, Enum):
    PENDING = "pending"
    ASSIGNED = "assigned"
    IN_PROGRESS = "in_progress"
    ON_WAY = "on_way"
    COMPLETED = "completed"
    CANCELLED = "cancelled"

class ClientStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"

class ClientType(str, Enum):
    BUSINESS = "Business"
    CONTRACT = "Contract Account"
    CORPORATE = "Corporate"
    SCHOOL = "School"
    HOSPITAL = "Hospital"
    INDIVIDUAL = "Individual"

class PaymentMethod(str, Enum):
    CASH = "Cash"
    INVOICE = "Invoice"
    CARD = "Card"
    ACCOUNT = "Account"

class AdminRole(str, Enum):
    SUPER_ADMIN = "super_admin"
    ADMIN = "admin"
    DISPATCHER = "dispatcher"

# ========== ADMIN USER MODELS ==========
class AdminUserBase(BaseModel):
    email: str
    name: str
    role: AdminRole = AdminRole.DISPATCHER
    is_active: bool = True

class AdminUserCreate(AdminUserBase):
    password: str

class AdminUserUpdate(BaseModel):
    email: Optional[str] = None
    name: Optional[str] = None
    role: Optional[AdminRole] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None

class AdminUser(AdminUserBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    password_hash: str = ""
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    last_login: Optional[datetime] = None

class AdminLoginRequest(BaseModel):
    email: str
    password: str

class AdminLoginResponse(BaseModel):
    token: str
    user: dict

# Client Models
class ClientBase(BaseModel):
    name: str
    mobile: str
    email: str
    client_type: ClientType = ClientType.BUSINESS
    payment_method: PaymentMethod = PaymentMethod.INVOICE
    status: ClientStatus = ClientStatus.ACTIVE
    start_date: Optional[str] = None
    address: Optional[str] = None
    town_city: Optional[str] = None
    post_code: Optional[str] = None
    country: Optional[str] = "United Kingdom"
    notes: Optional[str] = None

class ClientCreate(ClientBase):
    pass

class ClientUpdate(BaseModel):
    name: Optional[str] = None
    mobile: Optional[str] = None
    email: Optional[str] = None
    client_type: Optional[ClientType] = None
    payment_method: Optional[PaymentMethod] = None
    status: Optional[ClientStatus] = None
    start_date: Optional[str] = None
    address: Optional[str] = None
    town_city: Optional[str] = None
    post_code: Optional[str] = None
    country: Optional[str] = None
    notes: Optional[str] = None

class Client(ClientBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    account_no: str = ""  # Auto-generated like E001, E002
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Driver Models
class DriverBase(BaseModel):
    name: str
    phone: str
    email: Optional[str] = None
    driver_types: List[str] = ["taxi"]  # Can be ["taxi"], ["psv"], or ["taxi", "psv"]
    # Taxi driver documents
    taxi_licence_expiry: Optional[str] = None
    dbs_expiry: Optional[str] = None
    school_badge_expiry: Optional[str] = None
    driving_licence_expiry: Optional[str] = None
    medical_due: Optional[str] = None
    # PSV driver documents
    cpc_expiry: Optional[str] = None
    tacho_card_expiry: Optional[str] = None

class DriverCreate(DriverBase):
    password: Optional[str] = None  # For mobile app login

class DriverUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    driver_types: Optional[List[str]] = None
    password: Optional[str] = None
    # Taxi driver documents
    taxi_licence_expiry: Optional[str] = None
    dbs_expiry: Optional[str] = None
    school_badge_expiry: Optional[str] = None
    driving_licence_expiry: Optional[str] = None
    medical_due: Optional[str] = None
    # PSV driver documents
    cpc_expiry: Optional[str] = None
    tacho_card_expiry: Optional[str] = None
    # These come from driver app
    vehicle_type: Optional[str] = None
    vehicle_number: Optional[str] = None
    status: Optional[DriverStatus] = None

class Driver(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    phone: str
    email: Optional[str] = None
    driver_types: List[str] = ["taxi"]
    # Documents
    taxi_licence_expiry: Optional[str] = None
    dbs_expiry: Optional[str] = None
    school_badge_expiry: Optional[str] = None
    driving_licence_expiry: Optional[str] = None
    medical_due: Optional[str] = None
    cpc_expiry: Optional[str] = None
    tacho_card_expiry: Optional[str] = None
    # From driver app
    vehicle_type: Optional[str] = None
    vehicle_number: Optional[str] = None
    status: DriverStatus = DriverStatus.OFFLINE
    password_hash: Optional[str] = None
    current_location: Optional[dict] = None  # {lat, lng, updated_at}
    is_online: bool = False
    on_break: bool = False
    selected_vehicle_id: Optional[str] = None
    push_token: Optional[str] = None  # For push notifications
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Driver Login Model
class DriverLogin(BaseModel):
    email: str
    password: str

# Driver Location Update
class DriverLocationUpdate(BaseModel):
    latitude: float
    longitude: float

# Driver Status Update  
class DriverAppStatus(BaseModel):
    is_online: Optional[bool] = None
    on_break: Optional[bool] = None
    selected_vehicle_id: Optional[str] = None
    push_token: Optional[str] = None

# Flight Information Model
class FlightInfo(BaseModel):
    flight_number: Optional[str] = None
    airline: Optional[str] = None
    flight_type: Optional[str] = None  # "arrival" or "departure"
    terminal: Optional[str] = None
    scheduled_time: Optional[str] = None  # Flight scheduled time

# Booking Models
class BookingBase(BaseModel):
    first_name: str
    last_name: str
    customer_phone: str
    customer_email: Optional[str] = None
    pickup_location: str
    dropoff_location: str
    additional_stops: Optional[List[str]] = None  # Multiple drop-off locations
    booking_datetime: datetime
    notes: Optional[str] = None
    fare: Optional[float] = None
    client_id: Optional[str] = None  # Link to client account for invoicing
    flight_info: Optional[FlightInfo] = None  # Flight tracking info
    is_return: Optional[bool] = False  # Is this a return leg
    linked_booking_id: Optional[str] = None  # Link to original/return booking
    vehicle_type: Optional[str] = None  # Vehicle type ID
    passenger_count: Optional[int] = 1
    luggage_count: Optional[int] = 0

class BookingHistoryEntry(BaseModel):
    timestamp: datetime
    action: str  # created, updated, status_changed, driver_assigned, driver_unassigned
    user_id: Optional[str] = None
    user_name: Optional[str] = None
    user_type: str = "admin"  # admin, driver, system
    changes: Optional[dict] = None
    details: Optional[str] = None

class BookingCreate(BookingBase):
    distance_miles: Optional[float] = None
    duration_minutes: Optional[int] = None
    create_return: Optional[bool] = False  # Create a return booking
    return_pickup_location: Optional[str] = None  # Custom return pickup
    return_dropoff_location: Optional[str] = None  # Custom return dropoff
    return_datetime: Optional[datetime] = None  # Return date/time
    return_flight_info: Optional[FlightInfo] = None  # Flight info for return journey

class BookingUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    customer_phone: Optional[str] = None
    pickup_location: Optional[str] = None
    dropoff_location: Optional[str] = None
    additional_stops: Optional[List[str]] = None
    booking_datetime: Optional[datetime] = None
    notes: Optional[str] = None
    fare: Optional[float] = None
    status: Optional[BookingStatus] = None
    driver_id: Optional[str] = None
    distance_miles: Optional[float] = None
    duration_minutes: Optional[int] = None
    client_id: Optional[str] = None
    flight_info: Optional[FlightInfo] = None
    is_return: Optional[bool] = None
    linked_booking_id: Optional[str] = None
    customer_email: Optional[str] = None
    vehicle_type: Optional[str] = None
    passenger_count: Optional[int] = None
    luggage_count: Optional[int] = None

# Response model that supports both old (customer_name) and new (first_name/last_name) formats
class BookingResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    booking_id: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    customer_name: Optional[str] = None  # For backward compatibility
    customer_phone: str
    customer_email: Optional[str] = None
    pickup_location: str
    dropoff_location: str
    additional_stops: Optional[List[str]] = None
    booking_datetime: datetime
    notes: Optional[str] = None
    fare: Optional[float] = None
    status: BookingStatus = BookingStatus.PENDING
    driver_id: Optional[str] = None
    created_at: datetime
    sms_sent: Optional[bool] = False
    email_sent: Optional[bool] = False
    distance_miles: Optional[float] = None
    duration_minutes: Optional[int] = None
    client_id: Optional[str] = None
    flight_info: Optional[dict] = None
    is_return: Optional[bool] = False
    linked_booking_id: Optional[str] = None
    vehicle_type: Optional[str] = None
    passenger_count: Optional[int] = 1
    luggage_count: Optional[int] = 0
    created_by_id: Optional[str] = None
    created_by_name: Optional[str] = None
    history: Optional[List[dict]] = None

class Booking(BookingBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    booking_id: Optional[str] = None  # Readable booking ID like CJ-001
    status: BookingStatus = BookingStatus.PENDING
    driver_id: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    sms_sent: Optional[bool] = False
    email_sent: Optional[bool] = False
    distance_miles: Optional[float] = None
    duration_minutes: Optional[int] = None
    customer_name: Optional[str] = None  # Computed from first_name + last_name

# Passenger Authentication Models
class PassengerRegister(BaseModel):
    name: str
    phone: str
    email: Optional[str] = None
    password: str

class PassengerLogin(BaseModel):
    phone: str
    password: str

class Passenger(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    phone: str
    email: Optional[str] = None
    password_hash: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class PassengerResponse(BaseModel):
    id: str
    name: str
    phone: str
    email: Optional[str] = None
    token: str

async def generate_booking_id():
    """Generate a sequential booking ID like CJ-001, CJ-002, etc."""
    # Find the highest booking number
    latest = await db.bookings.find_one(
        {"booking_id": {"$exists": True, "$ne": None}},
        sort=[("booking_id", -1)]
    )
    
    if latest and latest.get("booking_id"):
        try:
            # Extract number from CJ-XXX format
            current_num = int(latest["booking_id"].split("-")[1])
            next_num = current_num + 1
        except (ValueError, IndexError):
            next_num = 1
    else:
        next_num = 1
    
    return f"CJ-{next_num:03d}"

# Root endpoint
@api_router.get("/")
async def root():
    return {"message": "Private Hire Booking API"}

# Google Maps API Key (from environment variable)
GOOGLE_MAPS_API_KEY = os.environ.get('GOOGLE_MAPS_API_KEY')

# ========== DIRECTIONS/DISTANCE ENDPOINT ==========
@api_router.get("/directions")
async def get_directions(origin: str, destination: str):
    """Get directions and distance between two locations using Google Maps Directions API"""
    try:
        async with httpx.AsyncClient() as http_client:
            response = await http_client.get(
                "https://maps.googleapis.com/maps/api/directions/json",
                params={
                    "origin": origin,
                    "destination": destination,
                    "key": GOOGLE_MAPS_API_KEY,
                    "units": "imperial",  # For miles
                    "region": "uk"
                },
                timeout=10.0
            )
            
            if response.status_code == 200:
                data = response.json()
                
                if data.get("status") != "OK":
                    return {
                        "success": False,
                        "error": data.get("status", "Unknown error"),
                        "message": data.get("error_message", "Could not calculate route")
                    }
                
                route = data.get("routes", [{}])[0]
                leg = route.get("legs", [{}])[0]
                
                # Get distance in miles
                distance_meters = leg.get("distance", {}).get("value", 0)
                distance_miles = round(distance_meters / 1609.34, 1)
                
                # Get duration
                duration_seconds = leg.get("duration", {}).get("value", 0)
                duration_minutes = round(duration_seconds / 60)
                
                # Format duration
                if duration_minutes >= 60:
                    hours = duration_minutes // 60
                    mins = duration_minutes % 60
                    duration_text = f"{hours}h {mins}m" if mins > 0 else f"{hours}h"
                else:
                    duration_text = f"{duration_minutes} mins"
                
                return {
                    "success": True,
                    "distance": {
                        "miles": distance_miles,
                        "text": f"{distance_miles} miles",
                        "meters": distance_meters
                    },
                    "duration": {
                        "minutes": duration_minutes,
                        "text": duration_text,
                        "seconds": duration_seconds
                    },
                    "start_address": leg.get("start_address", origin),
                    "end_address": leg.get("end_address", destination),
                    "summary": route.get("summary", ""),
                    "polyline": route.get("overview_polyline", {}).get("points", ""),
                    "start_location": leg.get("start_location", {}),
                    "end_location": leg.get("end_location", {})
                }
            else:
                return {
                    "success": False,
                    "error": "API request failed",
                    "message": f"Status code: {response.status_code}"
                }
                
    except Exception as e:
        logging.error(f"Directions API error: {e}")
        return {
            "success": False,
            "error": "Exception",
            "message": str(e)
        }

# ========== POSTCODE LOOKUP ENDPOINT ==========
@api_router.get("/postcode/{postcode}")
async def lookup_postcode(postcode: str):
    """Lookup addresses for a UK postcode using Getaddress.io autocomplete API"""
    clean_postcode = postcode.replace(" ", "").upper()
    
    try:
        async with httpx.AsyncClient() as http_client:
            # Use Getaddress.io autocomplete endpoint
            response = await http_client.get(
                f"https://api.getaddress.io/autocomplete/{clean_postcode}",
                params={"api-key": "TI2GnnxHJU2hsaILMSOQjQ49750"},
                timeout=10.0
            )
            
            if response.status_code == 200:
                data = response.json()
                suggestions = data.get("suggestions", [])
                
                if not suggestions:
                    return {"postcode": postcode, "addresses": []}
                
                # Format addresses from autocomplete response
                addresses = []
                for suggestion in suggestions:
                    full_address = suggestion.get("address", "")
                    parts = full_address.split(", ")
                    
                    addresses.append({
                        "line_1": parts[0] if len(parts) > 0 else "",
                        "line_2": parts[1] if len(parts) > 1 else "",
                        "town_or_city": parts[2] if len(parts) > 2 else "",
                        "county": parts[3] if len(parts) > 3 else "",
                        "postcode": parts[4] if len(parts) > 4 else clean_postcode,
                        "full_address": full_address
                    })
                
                # Format postcode properly
                formatted_postcode = clean_postcode
                if len(clean_postcode) > 3:
                    formatted_postcode = clean_postcode[:-3] + " " + clean_postcode[-3:]
                
                return {
                    "postcode": formatted_postcode,
                    "addresses": addresses
                }
            elif response.status_code == 404:
                return {"postcode": postcode, "addresses": [], "error": "Postcode not found"}
            else:
                logging.error(f"Getaddress.io error: {response.status_code} - {response.text}")
                return {"postcode": postcode, "addresses": [], "error": "Lookup failed"}
                
    except Exception as e:
        logging.error(f"Postcode lookup error: {e}")
        return {"postcode": postcode, "addresses": [], "error": str(e)}

# ========== FLIGHT TRACKING ENDPOINT ==========
class FlightInfoResponse(BaseModel):
    flight_number: Optional[str] = None
    airline: Optional[str] = None
    airline_iata: Optional[str] = None
    departure_airport: Optional[str] = None
    departure_iata: Optional[str] = None
    arrival_airport: Optional[str] = None
    arrival_iata: Optional[str] = None
    departure_scheduled: Optional[str] = None
    departure_actual: Optional[str] = None
    arrival_scheduled: Optional[str] = None
    arrival_actual: Optional[str] = None
    departure_terminal: Optional[str] = None
    arrival_terminal: Optional[str] = None
    departure_gate: Optional[str] = None
    arrival_gate: Optional[str] = None
    flight_status: Optional[str] = None
    flight_date: Optional[str] = None
    error: Optional[str] = None

@api_router.get("/flight/{flight_number}")
async def lookup_flight(flight_number: str):
    """Look up live flight data from AviationStack API"""
    if not AVIATIONSTACK_API_KEY:
        return {"error": "Flight tracking not configured"}
    
    # Clean flight number (remove spaces, uppercase)
    flight_number = flight_number.strip().upper().replace(" ", "")
    
    # Check cache first (store in MongoDB for 30 mins)
    cached = await db.flight_cache.find_one({
        "flight_number": flight_number,
        "cached_at": {"$gte": datetime.now(timezone.utc) - timedelta(minutes=30)}
    })
    
    if cached:
        logging.info(f"Flight {flight_number} found in cache")
        del cached["_id"]
        del cached["cached_at"]
        cached["is_cached"] = True
        return cached
    
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(
                "http://api.aviationstack.com/v1/flights",
                params={
                    "access_key": AVIATIONSTACK_API_KEY,
                    "flight_iata": flight_number,
                    "limit": 1
                }
            )
            
            if response.status_code != 200:
                logging.error(f"AviationStack API error: {response.status_code}")
                return {"error": "Flight lookup failed", "flight_number": flight_number}
            
            data = response.json()
            
            if data.get("error"):
                logging.error(f"AviationStack error: {data['error']}")
                return {"error": data["error"].get("message", "API error"), "flight_number": flight_number}
            
            if not data.get("data") or len(data["data"]) == 0:
                return {"error": "Flight not found", "flight_number": flight_number}
            
            flight = data["data"][0]
            
            # Parse the response
            result = {
                "flight_number": flight.get("flight", {}).get("iata", flight_number),
                "airline": flight.get("airline", {}).get("name"),
                "airline_iata": flight.get("airline", {}).get("iata"),
                "departure_airport": flight.get("departure", {}).get("airport"),
                "departure_iata": flight.get("departure", {}).get("iata"),
                "arrival_airport": flight.get("arrival", {}).get("airport"),
                "arrival_iata": flight.get("arrival", {}).get("iata"),
                "departure_scheduled": flight.get("departure", {}).get("scheduled"),
                "departure_actual": flight.get("departure", {}).get("actual"),
                "departure_estimated": flight.get("departure", {}).get("estimated"),
                "arrival_scheduled": flight.get("arrival", {}).get("scheduled"),
                "arrival_actual": flight.get("arrival", {}).get("actual"),
                "arrival_estimated": flight.get("arrival", {}).get("estimated"),
                "departure_terminal": flight.get("departure", {}).get("terminal"),
                "arrival_terminal": flight.get("arrival", {}).get("terminal"),
                "departure_gate": flight.get("departure", {}).get("gate"),
                "arrival_gate": flight.get("arrival", {}).get("gate"),
                "flight_status": flight.get("flight_status"),
                "flight_date": flight.get("flight_date"),
                "is_cached": False
            }
            
            # Cache the result
            cache_doc = {**result, "cached_at": datetime.now(timezone.utc)}
            await db.flight_cache.update_one(
                {"flight_number": flight_number},
                {"$set": cache_doc},
                upsert=True
            )
            
            logging.info(f"Flight {flight_number} fetched from API: {result.get('flight_status')}")
            return result
            
    except httpx.TimeoutException:
        logging.error(f"Flight lookup timeout for {flight_number}")
        return {"error": "Flight lookup timed out", "flight_number": flight_number}
    except Exception as e:
        logging.error(f"Flight lookup error: {e}")
        return {"error": str(e), "flight_number": flight_number}

# ========== DRIVER ENDPOINTS ==========
@api_router.post("/drivers", response_model=Driver)
async def create_driver(driver: DriverCreate):
    driver_dict = driver.model_dump()
    
    # Handle password if provided
    password = driver_dict.pop('password', None)
    if password:
        driver_dict['password_hash'] = hashlib.sha256(password.encode()).hexdigest()
    
    # Normalize email
    if driver_dict.get('email'):
        driver_dict['email'] = driver_dict['email'].lower()
    
    driver_obj = Driver(**driver_dict)
    doc = driver_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.drivers.insert_one(doc)
    return driver_obj

@api_router.get("/drivers", response_model=List[Driver])
async def get_drivers():
    drivers = await db.drivers.find({}, {"_id": 0}).to_list(1000)
    for driver in drivers:
        if isinstance(driver.get('created_at'), str):
            driver['created_at'] = datetime.fromisoformat(driver['created_at'])
    return drivers

@api_router.get("/drivers/{driver_id}", response_model=Driver)
async def get_driver(driver_id: str):
    driver = await db.drivers.find_one({"id": driver_id}, {"_id": 0})
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")
    if isinstance(driver.get('created_at'), str):
        driver['created_at'] = datetime.fromisoformat(driver['created_at'])
    return driver

@api_router.put("/drivers/{driver_id}", response_model=Driver)
async def update_driver(driver_id: str, driver_update: DriverUpdate):
    existing = await db.drivers.find_one({"id": driver_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Driver not found")
    
    update_data = {k: v for k, v in driver_update.model_dump().items() if v is not None}
    
    # Hash password if provided
    if 'password' in update_data and update_data['password']:
        update_data['password_hash'] = hashlib.sha256(update_data['password'].encode()).hexdigest()
        del update_data['password']
    
    if update_data:
        await db.drivers.update_one({"id": driver_id}, {"$set": update_data})
    
    updated = await db.drivers.find_one({"id": driver_id}, {"_id": 0})
    if isinstance(updated.get('created_at'), str):
        updated['created_at'] = datetime.fromisoformat(updated['created_at'])
    return updated

@api_router.delete("/drivers/{driver_id}")
async def delete_driver(driver_id: str):
    result = await db.drivers.delete_one({"id": driver_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Driver not found")
    return {"message": "Driver deleted successfully"}

# ========== VEHICLE TYPE MODELS ==========
class VehicleTypeBase(BaseModel):
    name: str  # e.g. "CJ's Taxi", "CJ's 8 Minibus"
    capacity: int  # Number of passengers
    description: Optional[str] = None
    has_trailer: bool = False
    photo_url: Optional[str] = None  # Photo/image URL

class VehicleTypeCreate(VehicleTypeBase):
    pass

class VehicleTypeUpdate(BaseModel):
    name: Optional[str] = None
    capacity: Optional[int] = None
    description: Optional[str] = None
    has_trailer: Optional[bool] = None
    photo_url: Optional[str] = None

class VehicleType(VehicleTypeBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# ========== VEHICLE MODELS ==========
class VehicleBase(BaseModel):
    registration: str  # e.g. "AB12 CDE"
    make: str  # e.g. "Mercedes"
    model: str  # e.g. "V-Class"
    color: Optional[str] = None
    year: Optional[int] = None
    vehicle_type_id: Optional[str] = None  # Links to VehicleType
    photo_url: Optional[str] = None  # Photo/image URL
    # Document dates
    insurance_expiry: Optional[str] = None  # Date string
    tax_expiry: Optional[str] = None  # Date string (road tax)
    dcc_test_date_1: Optional[str] = None  # DCC Test Date 1
    dcc_test_date_2: Optional[str] = None  # DCC Test Date 2
    # Additional info
    notes: Optional[str] = None
    is_active: bool = True

class VehicleCreate(VehicleBase):
    pass

class VehicleUpdate(BaseModel):
    registration: Optional[str] = None
    make: Optional[str] = None
    model: Optional[str] = None
    color: Optional[str] = None
    year: Optional[int] = None
    vehicle_type_id: Optional[str] = None
    photo_url: Optional[str] = None
    insurance_expiry: Optional[str] = None
    tax_expiry: Optional[str] = None
    dcc_test_date_1: Optional[str] = None
    dcc_test_date_2: Optional[str] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None

class Vehicle(VehicleBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# ========== VEHICLE TYPE ENDPOINTS ==========
@api_router.post("/vehicle-types", response_model=VehicleType)
async def create_vehicle_type(vehicle_type: VehicleTypeCreate):
    vt_obj = VehicleType(**vehicle_type.model_dump())
    doc = vt_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.vehicle_types.insert_one(doc)
    return vt_obj

@api_router.get("/vehicle-types")
async def get_vehicle_types():
    vehicle_types = await db.vehicle_types.find({}, {"_id": 0}).to_list(1000)
    for vt in vehicle_types:
        if isinstance(vt.get('created_at'), str):
            vt['created_at'] = datetime.fromisoformat(vt['created_at'])
        # Count vehicles in this type
        vt['vehicle_count'] = await db.vehicles.count_documents({"vehicle_type_id": vt['id']})
    return vehicle_types

@api_router.get("/vehicle-types/{vehicle_type_id}")
async def get_vehicle_type(vehicle_type_id: str):
    vt = await db.vehicle_types.find_one({"id": vehicle_type_id}, {"_id": 0})
    if not vt:
        raise HTTPException(status_code=404, detail="Vehicle type not found")
    if isinstance(vt.get('created_at'), str):
        vt['created_at'] = datetime.fromisoformat(vt['created_at'])
    vt['vehicle_count'] = await db.vehicles.count_documents({"vehicle_type_id": vehicle_type_id})
    return vt

@api_router.put("/vehicle-types/{vehicle_type_id}")
async def update_vehicle_type(vehicle_type_id: str, vt_update: VehicleTypeUpdate):
    existing = await db.vehicle_types.find_one({"id": vehicle_type_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Vehicle type not found")
    
    update_data = {k: v for k, v in vt_update.model_dump().items() if v is not None}
    if update_data:
        await db.vehicle_types.update_one({"id": vehicle_type_id}, {"$set": update_data})
    
    updated = await db.vehicle_types.find_one({"id": vehicle_type_id}, {"_id": 0})
    if isinstance(updated.get('created_at'), str):
        updated['created_at'] = datetime.fromisoformat(updated['created_at'])
    return updated

@api_router.delete("/vehicle-types/{vehicle_type_id}")
async def delete_vehicle_type(vehicle_type_id: str):
    # Check if any vehicles use this type
    vehicle_count = await db.vehicles.count_documents({"vehicle_type_id": vehicle_type_id})
    if vehicle_count > 0:
        raise HTTPException(status_code=400, detail=f"Cannot delete: {vehicle_count} vehicles use this type")
    
    result = await db.vehicle_types.delete_one({"id": vehicle_type_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Vehicle type not found")
    return {"message": "Vehicle type deleted successfully"}

# ========== VEHICLE ENDPOINTS ==========
@api_router.post("/vehicles", response_model=Vehicle)
async def create_vehicle(vehicle: VehicleCreate):
    # Validate vehicle_type_id if provided
    if vehicle.vehicle_type_id:
        vt = await db.vehicle_types.find_one({"id": vehicle.vehicle_type_id})
        if not vt:
            raise HTTPException(status_code=400, detail="Invalid vehicle type")
    
    vehicle_obj = Vehicle(**vehicle.model_dump())
    doc = vehicle_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.vehicles.insert_one(doc)
    return vehicle_obj

@api_router.get("/vehicles")
async def get_vehicles():
    vehicles = await db.vehicles.find({}, {"_id": 0}).to_list(1000)
    # Get all vehicle types for lookup
    vehicle_types = await db.vehicle_types.find({}, {"_id": 0}).to_list(1000)
    vt_lookup = {vt['id']: vt for vt in vehicle_types}
    
    for v in vehicles:
        if isinstance(v.get('created_at'), str):
            v['created_at'] = datetime.fromisoformat(v['created_at'])
        # Add vehicle type info
        if v.get('vehicle_type_id') and v['vehicle_type_id'] in vt_lookup:
            v['vehicle_type'] = vt_lookup[v['vehicle_type_id']]
    return vehicles

@api_router.get("/vehicles/{vehicle_id}")
async def get_vehicle(vehicle_id: str):
    vehicle = await db.vehicles.find_one({"id": vehicle_id}, {"_id": 0})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    if isinstance(vehicle.get('created_at'), str):
        vehicle['created_at'] = datetime.fromisoformat(vehicle['created_at'])
    # Add vehicle type info
    if vehicle.get('vehicle_type_id'):
        vt = await db.vehicle_types.find_one({"id": vehicle['vehicle_type_id']}, {"_id": 0})
        if vt:
            vehicle['vehicle_type'] = vt
    return vehicle

@api_router.put("/vehicles/{vehicle_id}")
async def update_vehicle(vehicle_id: str, vehicle_update: VehicleUpdate):
    existing = await db.vehicles.find_one({"id": vehicle_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    update_data = {k: v for k, v in vehicle_update.model_dump().items() if v is not None}
    
    # Validate vehicle_type_id if being updated
    if 'vehicle_type_id' in update_data and update_data['vehicle_type_id']:
        vt = await db.vehicle_types.find_one({"id": update_data['vehicle_type_id']})
        if not vt:
            raise HTTPException(status_code=400, detail="Invalid vehicle type")
    
    if update_data:
        await db.vehicles.update_one({"id": vehicle_id}, {"$set": update_data})
    
    updated = await db.vehicles.find_one({"id": vehicle_id}, {"_id": 0})
    if isinstance(updated.get('created_at'), str):
        updated['created_at'] = datetime.fromisoformat(updated['created_at'])
    return updated

@api_router.delete("/vehicles/{vehicle_id}")
async def delete_vehicle(vehicle_id: str):
    result = await db.vehicles.delete_one({"id": vehicle_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    return {"message": "Vehicle deleted successfully"}

# ========== CLIENT ENDPOINTS ==========
async def generate_client_account_no():
    """Generate sequential client account number like E001, E002, etc."""
    # Find the highest existing account number
    clients = await db.clients.find({}, {"account_no": 1}).to_list(1000)
    max_num = 0
    for client in clients:
        account_no = client.get('account_no', '')
        if account_no and account_no.startswith('E'):
            try:
                num = int(account_no[1:])
                if num > max_num:
                    max_num = num
            except ValueError:
                pass
    return f"E{str(max_num + 1).zfill(3)}"

@api_router.get("/clients")
async def get_clients():
    """Get all clients with their booking counts"""
    clients = await db.clients.find({}, {"_id": 0}).to_list(1000)
    for client in clients:
        if isinstance(client.get('created_at'), str):
            client['created_at'] = datetime.fromisoformat(client['created_at'])
        # Count bookings for this client
        booking_count = await db.bookings.count_documents({"client_id": client['id']})
        client['booking_count'] = booking_count
        # Calculate total invoice amount
        pipeline = [
            {"$match": {"client_id": client['id']}},
            {"$group": {"_id": None, "total": {"$sum": "$fare"}}}
        ]
        result = await db.bookings.aggregate(pipeline).to_list(1)
        client['total_invoice'] = result[0]['total'] if result else 0
    return clients

@api_router.get("/clients/{client_id}")
async def get_client(client_id: str):
    """Get a specific client by ID"""
    client = await db.clients.find_one({"id": client_id}, {"_id": 0})
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    if isinstance(client.get('created_at'), str):
        client['created_at'] = datetime.fromisoformat(client['created_at'])
    # Get booking count and total
    client['booking_count'] = await db.bookings.count_documents({"client_id": client_id})
    pipeline = [
        {"$match": {"client_id": client_id}},
        {"$group": {"_id": None, "total": {"$sum": "$fare"}}}
    ]
    result = await db.bookings.aggregate(pipeline).to_list(1)
    client['total_invoice'] = result[0]['total'] if result else 0
    return client

@api_router.get("/clients/{client_id}/bookings")
async def get_client_bookings(client_id: str):
    """Get all bookings for a specific client"""
    client = await db.clients.find_one({"id": client_id}, {"_id": 0})
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    bookings = await db.bookings.find({"client_id": client_id}, {"_id": 0}).to_list(1000)
    for booking in bookings:
        if isinstance(booking.get('created_at'), str):
            booking['created_at'] = datetime.fromisoformat(booking['created_at'])
        if isinstance(booking.get('booking_datetime'), str):
            booking['booking_datetime'] = datetime.fromisoformat(booking['booking_datetime'])
    return bookings

@api_router.post("/clients")
async def create_client(client: ClientCreate):
    """Create a new client"""
    # Generate account number
    account_no = await generate_client_account_no()
    
    client_obj = Client(**client.model_dump())
    client_obj.account_no = account_no
    
    doc = client_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.clients.insert_one(doc)
    
    return client_obj

@api_router.put("/clients/{client_id}")
async def update_client(client_id: str, client_update: ClientUpdate):
    """Update a client"""
    existing = await db.clients.find_one({"id": client_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Client not found")
    
    update_data = {k: v for k, v in client_update.model_dump().items() if v is not None}
    if update_data:
        await db.clients.update_one({"id": client_id}, {"$set": update_data})
    
    updated = await db.clients.find_one({"id": client_id}, {"_id": 0})
    if isinstance(updated.get('created_at'), str):
        updated['created_at'] = datetime.fromisoformat(updated['created_at'])
    return updated

@api_router.delete("/clients/{client_id}")
async def delete_client(client_id: str):
    """Delete a client"""
    result = await db.clients.delete_one({"id": client_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Client not found")
    return {"message": "Client deleted successfully"}

@api_router.get("/clients/{client_id}/invoice/preview")
async def get_invoice_preview(client_id: str, start_date: str = None, end_date: str = None):
    """Get bookings preview for invoice generation"""
    client = await db.clients.find_one({"id": client_id}, {"_id": 0})
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    
    # Build query for bookings
    query = {"client_id": client_id}
    if start_date or end_date:
        date_query = {}
        if start_date:
            date_query["$gte"] = start_date
        if end_date:
            date_query["$lte"] = end_date + "T23:59:59"
        if date_query:
            query["booking_datetime"] = date_query
    
    # Get bookings
    bookings = await db.bookings.find(query, {"_id": 0}).sort("booking_datetime", 1).to_list(1000)
    
    # Convert datetime strings for JSON serialization
    for booking in bookings:
        if isinstance(booking.get('created_at'), str):
            booking['created_at'] = booking['created_at']
        if isinstance(booking.get('booking_datetime'), str):
            booking['booking_datetime'] = booking['booking_datetime']
    
    return bookings

class InvoiceRequest(BaseModel):
    custom_prices: Optional[dict] = None

@api_router.post("/clients/{client_id}/invoice")
async def generate_client_invoice(client_id: str, request: InvoiceRequest = None, start_date: str = None, end_date: str = None):
    """Generate PDF invoice for a client's bookings within a date range - styled like CJ's Executive Travel format"""
    # Get client details
    client = await db.clients.find_one({"id": client_id}, {"_id": 0})
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    
    # Build query for bookings
    query = {"client_id": client_id}
    if start_date or end_date:
        date_query = {}
        if start_date:
            date_query["$gte"] = start_date
        if end_date:
            date_query["$lte"] = end_date + "T23:59:59"
        if date_query:
            query["booking_datetime"] = date_query
    
    # Get bookings
    bookings = await db.bookings.find(query, {"_id": 0}).sort("booking_datetime", 1).to_list(1000)
    
    # Apply custom prices if provided
    custom_prices = request.custom_prices if request else None
    if custom_prices:
        for booking in bookings:
            if booking['id'] in custom_prices:
                booking['fare'] = custom_prices[booking['id']]
    
    # Calculate totals
    subtotal = sum(b.get('fare', 0) or 0 for b in bookings)
    vat_rate = 0.20  # 20% VAT
    vat_amount = subtotal * vat_rate
    total = subtotal + vat_amount
    journey_count = len(bookings)
    
    # Generate invoice reference
    invoice_count = await db.clients.count_documents({}) + 1
    invoice_ref = f"INV{str(invoice_count).zfill(6)}"
    tax_date = datetime.now().strftime('%b %d, %Y')
    payment_due = (datetime.now() + timedelta(days=30)).strftime('%d/%m/%Y')
    
    # Create PDF
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=40, leftMargin=40, topMargin=40, bottomMargin=40)
    
    # Define colors
    dark_blue = colors.HexColor('#1a365d')
    light_gray = colors.HexColor('#f8f9fa')
    border_gray = colors.HexColor('#dee2e6')
    text_dark = colors.HexColor('#212529')
    
    # Styles
    styles = getSampleStyleSheet()
    company_name_style = ParagraphStyle('CompanyName', parent=styles['Heading1'], fontSize=18, textColor=dark_blue, spaceAfter=2)
    company_info_style = ParagraphStyle('CompanyInfo', parent=styles['Normal'], fontSize=9, textColor=text_dark, leading=12)
    section_header_style = ParagraphStyle('SectionHeader', parent=styles['Heading2'], fontSize=12, textColor=dark_blue, spaceBefore=15, spaceAfter=10)
    normal_style = ParagraphStyle('NormalText', parent=styles['Normal'], fontSize=9, textColor=text_dark, leading=12)
    bold_style = ParagraphStyle('BoldText', parent=styles['Normal'], fontSize=9, textColor=text_dark, leading=12, fontName='Helvetica-Bold')
    small_style = ParagraphStyle('SmallText', parent=styles['Normal'], fontSize=8, textColor=colors.grey, leading=10)
    
    elements = []
    
    # ========== HEADER SECTION ==========
    # Company info on left, invoice details on right
    header_data = [
        [
            # Left side - Company info
            Paragraph("<b>CJ's Executive Travel Limited</b>", company_name_style),
            # Right side - Invoice box
            ''
        ],
        [
            Paragraph("Professional Private Hire Services<br/>County Durham, United Kingdom<br/>Phone: 07806 794824<br/>Email: info@cjsexecutivetravel.co.uk", company_info_style),
            ''
        ]
    ]
    
    # Invoice details box
    invoice_box_data = [
        ['ACCOUNT NO:', client.get('account_no', 'N/A')],
        ['REFERENCE:', invoice_ref],
        ['TAX DATE:', tax_date],
    ]
    invoice_box = Table(invoice_box_data, colWidths=[70, 80])
    invoice_box.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), light_gray),
        ('BOX', (0, 0), (-1, -1), 1, border_gray),
        ('GRID', (0, 0), (-1, -1), 0.5, border_gray),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 8),
        ('TEXTCOLOR', (0, 0), (-1, -1), text_dark),
        ('ALIGN', (0, 0), (0, -1), 'LEFT'),
        ('ALIGN', (1, 0), (1, -1), 'LEFT'),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
    ]))
    
    header_table = Table([
        [Paragraph("<b>CJ's Executive Travel Limited</b>", company_name_style), invoice_box],
        [Paragraph("Professional Private Hire Services<br/>County Durham, United Kingdom<br/>Phone: 07806 794824<br/>Email: info@cjsexecutivetravel.co.uk", company_info_style), ''],
    ], colWidths=[350, 160])
    header_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('ALIGN', (1, 0), (1, 0), 'RIGHT'),
    ]))
    elements.append(header_table)
    elements.append(Spacer(1, 20))
    
    # ========== FOR THE ATTENTION OF ==========
    elements.append(Paragraph("<b>For the attention of:</b>", bold_style))
    client_address = f"{client.get('name', 'N/A')}"
    if client.get('address'):
        client_address += f"<br/>{client.get('address')}"
    if client.get('town_city') or client.get('post_code'):
        client_address += f"<br/>{client.get('town_city', '')} {client.get('post_code', '')}"
    elements.append(Paragraph(client_address, normal_style))
    elements.append(Spacer(1, 20))
    
    # ========== INVOICE SUMMARY ==========
    elements.append(Paragraph("<b>INVOICE SUMMARY</b>", section_header_style))
    
    summary_data = [
        ['Journeys', f'{journey_count} Journeys'],
        ['Subtotal', f'£{subtotal:,.2f}'],
        ['VAT @ 20%', f'£{vat_amount:,.2f}'],
        ['Total', f'£{total:,.2f}'],
        ['Payment', '-£0.00'],
    ]
    summary_table = Table(summary_data, colWidths=[100, 100])
    summary_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), light_gray),
        ('BOX', (0, 0), (-1, -1), 1, border_gray),
        ('GRID', (0, 0), (-1, -1), 0.5, border_gray),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTNAME', (0, 3), (-1, 3), 'Helvetica-Bold'),  # Total row bold
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('TEXTCOLOR', (0, 0), (-1, -1), text_dark),
        ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
    ]))
    elements.append(summary_table)
    elements.append(Spacer(1, 15))
    
    # ========== TERMS AND BANK DETAILS ==========
    elements.append(Paragraph(f"<b>Terms</b> 30 days. Payment due by {payment_due}.", normal_style))
    elements.append(Spacer(1, 10))
    
    bank_details = """<b>Bank Details:</b><br/>
    Bank Name: Starling Bank<br/>
    Account No: 15222155<br/>
    Sort Code: 60-83-71"""
    elements.append(Paragraph(bank_details, small_style))
    elements.append(Spacer(1, 25))
    
    # ========== JOURNEYS TABLE ==========
    elements.append(Paragraph("<b>JOURNEYS</b>", section_header_style))
    
    if bookings:
        # Table header
        journeys_header = ['Item', 'Date/Time', 'Booker/Passenger', 'Journey Details', 'Cost', 'Total']
        journeys_data = [journeys_header]
        
        for idx, booking in enumerate(bookings, 1):
            # Format date and time
            booking_dt = booking.get('booking_datetime', '')
            date_str = ''
            time_str = ''
            if isinstance(booking_dt, str):
                try:
                    dt = datetime.fromisoformat(booking_dt.replace('Z', '+00:00'))
                    date_str = dt.strftime('%d/%m/%Y')
                    time_str = dt.strftime('%H:%M')
                except:
                    date_str = booking_dt[:10] if len(booking_dt) >= 10 else ''
            
            # Get customer name
            customer_name = booking.get('customer_name') or f"{booking.get('first_name', '')} {booking.get('last_name', '')}".strip()
            booker_passenger = f"{client.get('account_no', '')}\n{customer_name}"
            
            # Journey details with P: and D: format
            pickup = booking.get('pickup_location', '') or ''
            dropoff = booking.get('dropoff_location', '') or ''
            journey_details = f"P: {pickup[:50]}{'...' if len(pickup) > 50 else ''}\nD: {dropoff[:50]}{'...' if len(dropoff) > 50 else ''}"
            
            fare = booking.get('fare') or 0
            booking_id = booking.get('booking_id', f'#{idx}')
            
            journeys_data.append([
                Paragraph(f"<b>{booking_id}</b>", ParagraphStyle('Item', fontSize=8, fontName='Helvetica-Bold')),
                Paragraph(f"{date_str}<br/>{time_str}", ParagraphStyle('DateTime', fontSize=8, leading=10)),
                Paragraph(booker_passenger.replace('\n', '<br/>'), ParagraphStyle('Booker', fontSize=8, leading=10)),
                Paragraph(journey_details.replace('\n', '<br/>'), ParagraphStyle('Journey', fontSize=8, leading=10)),
                Paragraph(f"£{fare:.2f}", ParagraphStyle('Cost', fontSize=8, alignment=TA_RIGHT)),
                Paragraph(f"£{fare:.2f}", ParagraphStyle('Total', fontSize=8, alignment=TA_RIGHT, fontName='Helvetica-Bold')),
            ])
        
        # Add totals row
        journeys_data.append([
            '', '', '', 
            Paragraph('<b>TOTAL</b>', ParagraphStyle('TotalLabel', fontSize=9, alignment=TA_RIGHT, fontName='Helvetica-Bold')),
            '',
            Paragraph(f'<b>£{subtotal:.2f}</b>', ParagraphStyle('TotalValue', fontSize=9, alignment=TA_RIGHT, fontName='Helvetica-Bold'))
        ])
        
        col_widths = [55, 55, 80, 180, 50, 55]
        journeys_table = Table(journeys_data, colWidths=col_widths, repeatRows=1)
        journeys_table.setStyle(TableStyle([
            # Header styling
            ('BACKGROUND', (0, 0), (-1, 0), dark_blue),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 9),
            ('TOPPADDING', (0, 0), (-1, 0), 8),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
            ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
            
            # Body styling
            ('FONTSIZE', (0, 1), (-1, -1), 8),
            ('TEXTCOLOR', (0, 1), (-1, -1), text_dark),
            ('VALIGN', (0, 1), (-1, -1), 'TOP'),
            ('TOPPADDING', (0, 1), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 1), (-1, -1), 6),
            ('LEFTPADDING', (0, 0), (-1, -1), 4),
            ('RIGHTPADDING', (0, 0), (-1, -1), 4),
            
            # Alternating row colors
            ('ROWBACKGROUNDS', (0, 1), (-1, -2), [colors.white, light_gray]),
            
            # Grid
            ('GRID', (0, 0), (-1, -2), 0.5, border_gray),
            
            # Total row
            ('LINEABOVE', (0, -1), (-1, -1), 1, dark_blue),
            ('BACKGROUND', (0, -1), (-1, -1), light_gray),
            ('TOPPADDING', (0, -1), (-1, -1), 8),
            ('BOTTOMPADDING', (0, -1), (-1, -1), 8),
            
            # Align cost columns right
            ('ALIGN', (4, 1), (5, -1), 'RIGHT'),
        ]))
        
        elements.append(journeys_table)
    else:
        elements.append(Paragraph("No journeys found for the selected period.", normal_style))
    
    elements.append(Spacer(1, 30))
    
    # ========== FOOTER ==========
    footer_text = f"""<b>CJ's Executive Travel Limited</b><br/>
    Thank you for your business. For queries contact info@cjsexecutivetravel.co.uk"""
    footer_style = ParagraphStyle('Footer', parent=styles['Normal'], fontSize=8, alignment=TA_CENTER, textColor=colors.grey, leading=12)
    elements.append(Paragraph(footer_text, footer_style))
    
    # Build PDF
    doc.build(elements)
    buffer.seek(0)
    
    # Return as downloadable PDF
    filename = f"{client.get('account_no', 'invoice')}_{datetime.now().strftime('%b_%Y')}.pdf"
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

# ========== SMS HELPER FUNCTION ==========
def send_booking_sms(customer_phone: str, customer_name: str, booking_id: str, 
                     pickup: str = None, dropoff: str = None, 
                     distance_miles: float = None, duration_minutes: int = None,
                     booking_datetime: str = None, short_booking_id: str = None):
    """Send SMS confirmation for new booking"""
    if not vonage_client:
        logging.warning("Vonage client not initialized, skipping SMS")
        return False, "SMS service not configured"
    
    try:
        from vonage_sms import SmsMessage
        
        # Format phone number (ensure it has country code)
        phone = customer_phone.strip()
        if not phone.startswith('+'):
            # Assume UK number if no country code
            if phone.startswith('0'):
                phone = '+44' + phone[1:]
            else:
                phone = '+44' + phone
        
        # Generate booking details link - use SSR preview URL for proper link previews
        app_url = os.environ.get('APP_URL', 'https://travel-dispatch.preview.emergentagent.com')
        if short_booking_id:
            # Use the SSR preview endpoint which has proper OG meta tags
            booking_link = f"{app_url}/api/preview/{short_booking_id}"
        else:
            booking_link = f"{app_url}/booking/{booking_id}"
        
        message_text = (
            f"Hello {customer_name}, Your booking is confirmed.\n\n"
            f"{booking_link}\n\n"
            f"Please open the link to check your details.\n\n"
            f"Thank You CJ's Executive Travel Limited."
        )
        
        response = vonage_client.sms.send(
            SmsMessage(
                to=phone,
                from_=VONAGE_FROM_NUMBER,
                text=message_text
            )
        )
        
        if response.messages[0].status == "0":
            logging.info(f"SMS sent successfully to {phone}")
            return True, "SMS sent"
        else:
            logging.error(f"SMS failed: {response.messages[0].error_text}")
            return False, response.messages[0].error_text
            
    except Exception as e:
        logging.error(f"SMS error: {str(e)}")
        return False, str(e)


# ========== SMS TEMPLATE FUNCTIONS ==========
async def get_sms_template(template_type: str):
    """Get SMS template from database or return default"""
    template = await db.sms_templates.find_one({"type": template_type})
    
    defaults = {
        "driver_on_route": "Hello {customer_name}, Your driver is on their way!\n\nFollow the link for details and updates:\n{booking_link}",
        "driver_arrived": "Your vehicle has arrived! {vehicle_make} {vehicle_model} - {vehicle_registration}\n\nCheck where the vehicle is:\n{booking_link}",
        "booking_review": "Hi {customer_name}, we hope you had a great journey with CJ's Executive Travel!\n\nWe'd love to hear your feedback:\n{review_link}\n\nThank you for choosing us!",
        "booking_confirmation": "Hello {customer_name}, Your booking is confirmed.\n\n{booking_link}\n\nPlease open the link to check your details.\n\nThank You CJ's Executive Travel Limited.",
        "passenger_portal_welcome": "Welcome to CJ's Executive Travel! Your account has been created.\n\nLogin to your portal: {portal_link}\n\nThank you for choosing us!",
        "passenger_booking_confirmed": "Hello {customer_name}, Your booking has been confirmed!\n\nPickup: {pickup_address}\nDate/Time: {booking_datetime}\n\nView details: {booking_link}"
    }
    
    if template and template.get("content"):
        return template.get("content")
    return defaults.get(template_type, "")

async def send_templated_sms(phone: str, template_type: str, variables: dict):
    """Send SMS using a template with variable substitution"""
    if not vonage_client:
        logging.warning("Vonage client not initialized, skipping SMS")
        return False, "SMS service not configured"
    
    try:
        from vonage_sms import SmsMessage
        
        # Get template
        template = await get_sms_template(template_type)
        if not template:
            return False, f"Template '{template_type}' not found"
        
        # Substitute variables
        message_text = template
        for key, value in variables.items():
            message_text = message_text.replace("{" + key + "}", str(value) if value else "")
        
        # Format phone number
        phone = phone.strip()
        if not phone.startswith('+'):
            if phone.startswith('0'):
                phone = '+44' + phone[1:]
            else:
                phone = '+44' + phone
        
        response = vonage_client.sms.send(
            SmsMessage(
                to=phone,
                from_=VONAGE_FROM_NUMBER,
                text=message_text
            )
        )
        
        if response.messages[0].status == "0":
            logging.info(f"Templated SMS ({template_type}) sent to {phone}")
            return True, "SMS sent"
        else:
            logging.error(f"SMS failed: {response.messages[0].error_text}")
            return False, response.messages[0].error_text
            
    except Exception as e:
        logging.error(f"SMS error: {str(e)}")
        return False, str(e)


def send_booking_email(customer_email: str, customer_name: str, booking_id: str,
                       pickup: str = None, dropoff: str = None,
                       booking_datetime: str = None, short_booking_id: str = None,
                       status: str = None, driver_name: str = None,
                       customer_phone: str = None, vehicle_type: str = None,
                       additional_stops: list = None):
    """Send email confirmation for booking"""
    if not smtp_configured:
        logging.warning("SMTP not configured, skipping email")
        return False, "Email service not configured"
    
    if not customer_email:
        logging.warning("No email address provided, skipping email")
        return False, "No email address provided"
    
    try:
        # Generate booking details link - use SSR preview URL (same as SMS) for proper link previews
        app_url = os.environ.get('APP_URL', 'https://travel-dispatch.preview.emergentagent.com')
        if short_booking_id:
            # Use the SSR preview endpoint which has proper OG meta tags (same as SMS)
            booking_link = f"{app_url}/api/preview/{short_booking_id}"
        else:
            booking_link = f"{app_url}/booking/{booking_id}"
        
        # Passenger portal link
        portal_link = f"{app_url}/portal"
        
        # Google Maps API Key (from environment variable)
        google_maps_key = os.environ.get('GOOGLE_MAPS_API_KEY', '')
        
        # Company logo URL
        logo_url = "https://customer-assets.emergentagent.com/job_30ae4b98-ebfc-45ee-a35f-fc60498c61c6/artifacts/i2qqz1kf_Logo%20Background.png"
        
        # Format datetime for display
        formatted_datetime = ""
        if booking_datetime:
            try:
                dt = datetime.fromisoformat(booking_datetime.replace('Z', '+00:00'))
                formatted_datetime = dt.strftime("%d/%m/%Y %H:%M")
            except:
                formatted_datetime = str(booking_datetime)
        
        # Determine email subject
        if status == "driver_assigned" and driver_name:
            subject = f"Driver Assigned - CJ's Executive Travel Booking"
        elif status == "confirmed":
            subject = f"Booking Confirmed - CJ's Executive Travel"
        elif status == "completed":
            subject = f"Journey Completed - CJ's Executive Travel"
        elif status == "cancelled":
            subject = f"Booking Cancelled - CJ's Executive Travel"
        else:
            subject = f"Booking Confirmation email from CJs Executive Travel Limited"
        
        # Build via stops HTML and waypoints for map
        via_stops_html = ""
        map_waypoints = ""
        if additional_stops and len(additional_stops) > 0:
            waypoint_list = []
            for i, stop in enumerate(additional_stops):
                if stop:
                    via_stops_html += f'''
                    <tr>
                        <td style="padding: 8px 0; color: #666; font-weight: bold; vertical-align: top; width: 100px;">Via {i+1}</td>
                        <td style="padding: 8px 0; color: #333;">{stop}</td>
                    </tr>'''
                    waypoint_list.append(stop)
            if waypoint_list:
                map_waypoints = "&waypoints=" + "|".join([f"via:{w}" for w in waypoint_list])
        
        # Build Google Static Map URL with directions
        from urllib.parse import quote
        pickup_encoded = quote(pickup or "")
        dropoff_encoded = quote(dropoff or "")
        
        # Static map with markers and path
        map_url = f"https://maps.googleapis.com/maps/api/staticmap?size=550x200&maptype=roadmap"
        map_url += f"&markers=color:green%7Clabel:A%7C{pickup_encoded}"
        map_url += f"&markers=color:red%7Clabel:B%7C{dropoff_encoded}"
        map_url += f"&path=color:0x1a3a5c%7Cweight:4%7C{pickup_encoded}%7C{dropoff_encoded}"
        map_url += f"&key={google_maps_key}"
        
        # Google Maps directions link
        directions_url = f"https://www.google.com/maps/dir/?api=1&origin={pickup_encoded}&destination={dropoff_encoded}"
        if additional_stops:
            waypoints_encoded = "|".join([quote(s) for s in additional_stops if s])
            if waypoints_encoded:
                directions_url += f"&waypoints={waypoints_encoded}"
        
        # Create HTML email matching the design
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #e8eef3;">
            <!-- Header Banner with Logo -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #1a3a5c;">
                <tr>
                    <td style="padding: 20px; text-align: center;">
                        <img src="{logo_url}" alt="CJ's Executive Travel" style="height: 60px; width: auto;" />
                    </td>
                </tr>
                <tr>
                    <td style="padding: 0 15px 15px 15px; text-align: center; color: #d4af37; font-size: 14px;">
                        Booking Confirmation email from CJs Executive Travel Limited
                    </td>
                </tr>
            </table>
            
            <!-- Main Container -->
            <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 700px; margin: 0 auto; background-color: #ffffff;">
                <!-- Navigation -->
                <tr>
                    <td style="padding: 15px 0; border-bottom: 1px solid #eee;">
                        <table width="100%" cellpadding="0" cellspacing="0">
                            <tr>
                                <td style="text-align: center;">
                                    <a href="https://cjstravel.uk/" style="color: #333; text-decoration: none; padding: 0 12px; font-size: 13px;">Home</a>
                                    <a href="https://cjstravel.uk/testimonials" style="color: #333; text-decoration: none; padding: 0 12px; font-size: 13px;">Reviews</a>
                                    <a href="{portal_link}" style="color: #1a3a5c; text-decoration: none; padding: 0 12px; font-size: 13px; font-weight: bold;">My Bookings</a>
                                    <a href="https://cjstravel.uk/about" style="color: #333; text-decoration: none; padding: 0 12px; font-size: 13px;">About</a>
                                    <a href="https://cjstravel.uk/contact-us" style="color: #333; text-decoration: none; padding: 0 12px; font-size: 13px;">Contact</a>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
                
                <!-- Thank You Message -->
                <tr>
                    <td style="padding: 25px 40px; text-align: center; background-color: #f8f9fa;">
                        <p style="margin: 0; color: #333; font-size: 16px;">
                            Thanks for booking with CJs Executive Travel Limited.
                        </p>
                        <p style="margin: 10px 0 0 0; color: #666; font-size: 14px;">
                            Need help? Call us on: <a href="tel:+441917221223" style="color: #1a3a5c; text-decoration: none; font-weight: bold;">+44 191 722 1223</a>
                        </p>
                    </td>
                </tr>
                
                <!-- Google Map Section -->
                <tr>
                    <td style="padding: 20px 40px 0 40px;">
                        <a href="{directions_url}" target="_blank" style="display: block; text-decoration: none;">
                            <img src="{map_url}" alt="Journey Route Map" style="width: 100%; max-width: 100%; border-radius: 10px; border: 1px solid #ddd;" />
                        </a>
                        <p style="margin: 8px 0 0 0; text-align: center;">
                            <a href="{directions_url}" target="_blank" style="color: #1a3a5c; font-size: 12px; text-decoration: none;">
                                📍 Click to view directions in Google Maps
                            </a>
                        </p>
                    </td>
                </tr>
                
                <!-- Journey Details Section -->
                <tr>
                    <td style="padding: 25px 40px;">
                        <h2 style="margin: 0 0 15px 0; color: #1a3a5c; font-size: 18px; font-weight: bold; border-bottom: 2px solid #d4af37; padding-bottom: 8px;">Journey Details</h2>
                        
                        <table width="100%" cellpadding="0" cellspacing="0" style="font-size: 14px;">
                            <tr>
                                <td style="padding: 10px 0; color: #666; font-weight: bold; vertical-align: top; width: 100px;">Date & Time</td>
                                <td style="padding: 10px 0; color: #333;">{formatted_datetime}</td>
                            </tr>
                            <tr>
                                <td style="padding: 10px 0; color: #666; font-weight: bold; vertical-align: top;">
                                    <span style="color: #22c55e;">●</span> Pickup
                                </td>
                                <td style="padding: 10px 0; color: #333;">{pickup or 'N/A'}</td>
                            </tr>
                            {via_stops_html}
                            <tr>
                                <td style="padding: 10px 0; color: #666; font-weight: bold; vertical-align: top;">
                                    <span style="color: #ef4444;">●</span> Drop-off
                                </td>
                                <td style="padding: 10px 0; color: #333;">{dropoff or 'N/A'}</td>
                            </tr>
                        </table>
                    </td>
                </tr>
                
                <!-- Booking Details Section -->
                <tr>
                    <td style="padding: 0 40px 25px 40px;">
                        <div style="background-color: #f8f9fa; border-radius: 10px; padding: 20px; border-left: 4px solid #1a3a5c;">
                            <h2 style="margin: 0 0 15px 0; color: #1a3a5c; font-size: 16px; font-weight: bold;">Booking Details</h2>
                            <table width="100%" cellpadding="0" cellspacing="0" style="font-size: 14px;">
                                <tr>
                                    <td style="padding: 6px 0; color: #666; width: 140px;">Booking Ref:</td>
                                    <td style="padding: 6px 0; color: #333; font-weight: bold;">{short_booking_id or booking_id[:8]}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 6px 0; color: #666;">Passenger:</td>
                                    <td style="padding: 6px 0; color: #333;">{customer_name}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 6px 0; color: #666;">Passenger Mobile:</td>
                                    <td style="padding: 6px 0; color: #333;">{customer_phone or 'N/A'}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 6px 0; color: #666;">Vehicle Type:</td>
                                    <td style="padding: 6px 0; color: #333;">{vehicle_type or "Executive Saloon"}</td>
                                </tr>
                                {f'<tr><td style="padding: 6px 0; color: #666;">Driver:</td><td style="padding: 6px 0; color: #333; font-weight: bold;">{driver_name}</td></tr>' if driver_name else ''}
                            </table>
                        </div>
                    </td>
                </tr>
                
                <!-- CTA Buttons -->
                <tr>
                    <td style="padding: 0 40px 30px 40px; text-align: center;">
                        <a href="{booking_link}" style="display: inline-block; background-color: #1a3a5c; color: #ffffff; padding: 14px 35px; text-decoration: none; border-radius: 25px; font-size: 14px; font-weight: bold; margin: 5px;">
                            🚗 Live Journey Tracking
                        </a>
                        <a href="{portal_link}" style="display: inline-block; background-color: #d4af37; color: #1a3a5c; padding: 14px 35px; text-decoration: none; border-radius: 25px; font-size: 14px; font-weight: bold; margin: 5px;">
                            👤 My Passenger Portal
                        </a>
                    </td>
                </tr>
                
                <!-- Footer -->
                <tr>
                    <td style="padding: 30px 40px; background-color: #f8f9fa; border-top: 1px solid #eee;">
                        <p style="margin: 0; color: #888; font-size: 11px; text-align: center; line-height: 1.6;">
                            This is an automated email confirmation from CJs Executive Travel Limited. This email is sent from an unattended mailbox so please do not reply. If any of the above information is incorrect, please contact us immediately on +44 191 722 1223.
                        </p>
                        <p style="margin: 15px 0 0 0; color: #888; font-size: 11px; text-align: center;">
                            CJs Executive Travel Limited | Unit 5, Peterlee, County Durham, SR8 2HY | <a href="https://cjstravel.uk" style="color: #1a3a5c;">cjstravel.uk</a>
                        </p>
                    </td>
                </tr>
            </table>
        </body>
        </html>
        """
        
        # Plain text version
        text_content = f"""
Booking Confirmation from CJs Executive Travel Limited

Thanks for booking with CJs Executive Travel Limited.
Need help? Call us on: +44 7383 185260

JOURNEY DETAILS
---------------
Booking Ref: {short_booking_id or booking_id[:8]}
Date & Time: {formatted_datetime}
Pickup: {pickup or 'N/A'}
{chr(10).join([f'Via: {stop}' for stop in (additional_stops or []) if stop])}
Drop-off: {dropoff or 'N/A'}

View directions: {directions_url}

BOOKING DETAILS
---------------
Passenger: {customer_name}
Passenger Mobile: {customer_phone or 'N/A'}
Vehicle Type: {vehicle_type or 'Executive Saloon'}
{"Driver: " + driver_name if driver_name else ""}

Track your journey: {booking_link}
Access your bookings: {portal_link}

This is an automated email from CJs Executive Travel Limited.
If any information is incorrect, please contact us on +44 191 722 1223.

CJs Executive Travel Limited | Unit 5, Peterlee, County Durham, SR8 2HY | cjstravel.uk
        """
        
        # Create message
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From'] = f"CJ's Executive Travel <{SMTP_FROM_EMAIL}>"
        msg['To'] = customer_email
        
        # Attach both plain text and HTML versions
        part1 = MIMEText(text_content, 'plain')
        part2 = MIMEText(html_content, 'html')
        msg.attach(part1)
        msg.attach(part2)
        
        # Send email
        with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USERNAME, SMTP_PASSWORD)
            server.sendmail(SMTP_FROM_EMAIL, customer_email, msg.as_string())
        
        logging.info(f"Email sent successfully to {customer_email}")
        return True, "Email sent"
        
    except Exception as e:
        logging.error(f"Email error: {str(e)}")
        return False, str(e)


# ========== PASSENGER AUTHENTICATION ENDPOINTS ==========
@api_router.post("/passenger/register", response_model=PassengerResponse)
async def register_passenger(data: PassengerRegister):
    """Register a new passenger account"""
    # Normalize phone number
    phone = data.phone.strip().replace(" ", "")
    if phone.startswith("0"):
        phone = "+44" + phone[1:]
    elif not phone.startswith("+"):
        phone = "+44" + phone
    
    # Check if phone already registered
    existing = await db.passengers.find_one({"phone": phone})
    if existing:
        raise HTTPException(status_code=400, detail="Phone number already registered")
    
    # Create passenger
    passenger = Passenger(
        name=data.name,
        phone=phone,
        email=data.email,
        password_hash=hash_password(data.password)
    )
    
    doc = passenger.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.passengers.insert_one(doc)
    
    token = create_token(passenger.id, phone)
    
    return PassengerResponse(
        id=passenger.id,
        name=passenger.name,
        phone=phone,
        email=data.email,
        token=token
    )

@api_router.post("/passenger/login", response_model=PassengerResponse)
async def login_passenger(data: PassengerLogin):
    """Login a passenger"""
    # Normalize phone number
    phone = data.phone.strip().replace(" ", "")
    if phone.startswith("0"):
        phone = "+44" + phone[1:]
    elif not phone.startswith("+"):
        phone = "+44" + phone
    
    # Find passenger
    passenger = await db.passengers.find_one({"phone": phone}, {"_id": 0})
    if not passenger:
        raise HTTPException(status_code=401, detail="Invalid phone number or password")
    
    # Verify password
    if passenger['password_hash'] != hash_password(data.password):
        raise HTTPException(status_code=401, detail="Invalid phone number or password")
    
    token = create_token(passenger['id'], phone)
    
    return PassengerResponse(
        id=passenger['id'],
        name=passenger['name'],
        phone=phone,
        email=passenger.get('email'),
        token=token
    )

@api_router.get("/passenger/me")
async def get_passenger_profile(passenger: dict = Depends(get_current_passenger)):
    """Get current passenger profile"""
    return {
        "id": passenger['id'],
        "name": passenger['name'],
        "phone": passenger['phone'],
        "email": passenger.get('email')
    }

@api_router.get("/passenger/bookings")
async def get_passenger_bookings(passenger: dict = Depends(get_current_passenger)):
    """Get all bookings for the logged-in passenger"""
    phone = passenger['phone']
    
    # Also check for phone variations (with/without +44, with 0)
    phone_variations = [phone]
    if phone.startswith("+44"):
        phone_variations.append("0" + phone[3:])
        phone_variations.append(phone[3:])
    
    bookings = await db.bookings.find(
        {"customer_phone": {"$in": phone_variations}},
        {"_id": 0}
    ).sort("booking_datetime", -1).to_list(100)
    
    # Convert datetime strings back to datetime objects
    for booking in bookings:
        if isinstance(booking.get('created_at'), str):
            booking['created_at'] = datetime.fromisoformat(booking['created_at'])
        if isinstance(booking.get('booking_datetime'), str):
            booking['booking_datetime'] = datetime.fromisoformat(booking['booking_datetime'])
    
    return bookings

# ========== BOOKING REQUESTS ENDPOINTS ==========
class BookingRequestCreate(BaseModel):
    pickup_location: str
    dropoff_location: str
    pickup_datetime: datetime
    notes: Optional[str] = None
    flight_number: Optional[str] = None
    additional_stops: Optional[List[str]] = None
    passenger_count: Optional[int] = 1
    luggage_count: Optional[int] = 0
    customer_email: Optional[str] = None
    flight_info: Optional[FlightInfo] = None
    create_return: Optional[bool] = False
    return_pickup_location: Optional[str] = None
    return_additional_stops: Optional[List[str]] = None
    return_dropoff_location: Optional[str] = None
    return_datetime: Optional[datetime] = None
    return_flight_info: Optional[FlightInfo] = None

class BookingRequest(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    passenger_id: str
    passenger_name: str
    passenger_phone: str
    passenger_email: Optional[str] = None
    pickup_location: str
    dropoff_location: str
    additional_stops: Optional[List[str]] = None
    pickup_datetime: datetime
    passenger_count: Optional[int] = 1
    luggage_count: Optional[int] = 0
    notes: Optional[str] = None
    flight_number: Optional[str] = None
    flight_info: Optional[dict] = None
    create_return: Optional[bool] = False
    return_pickup_location: Optional[str] = None
    return_additional_stops: Optional[List[str]] = None
    return_dropoff_location: Optional[str] = None
    return_datetime: Optional[datetime] = None
    return_flight_info: Optional[dict] = None
    status: str = "pending"  # pending, approved, rejected
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    admin_notes: Optional[str] = None

@api_router.post("/passenger/booking-requests")
async def create_booking_request(request: BookingRequestCreate, passenger: dict = Depends(get_current_passenger)):
    """Submit a new booking request"""
    booking_request = BookingRequest(
        passenger_id=passenger['id'],
        passenger_name=passenger['name'],
        passenger_phone=passenger['phone'],
        passenger_email=request.customer_email or passenger.get('email'),
        pickup_location=request.pickup_location,
        dropoff_location=request.dropoff_location,
        additional_stops=request.additional_stops,
        pickup_datetime=request.pickup_datetime,
        passenger_count=request.passenger_count or 1,
        luggage_count=request.luggage_count or 0,
        notes=request.notes,
        flight_number=request.flight_number.upper() if request.flight_number else None,
        flight_info=request.flight_info.model_dump() if request.flight_info else None,
        create_return=request.create_return,
        return_pickup_location=request.return_pickup_location,
        return_additional_stops=request.return_additional_stops,
        return_dropoff_location=request.return_dropoff_location,
        return_datetime=request.return_datetime,
        return_flight_info=request.return_flight_info.model_dump() if request.return_flight_info else None,
    )
    
    doc = booking_request.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    doc['pickup_datetime'] = doc['pickup_datetime'].isoformat()
    if doc.get('return_datetime'):
        doc['return_datetime'] = doc['return_datetime'].isoformat()
    
    await db.booking_requests.insert_one(doc)
    
    logging.info(f"New booking request from {passenger['name']}: {request.pickup_location} -> {request.dropoff_location}")
    
    return {"message": "Booking request submitted", "id": booking_request.id}

@api_router.get("/passenger/booking-requests")
async def get_passenger_booking_requests(passenger: dict = Depends(get_current_passenger)):
    """Get all booking requests for the logged-in passenger"""
    requests = await db.booking_requests.find(
        {"passenger_id": passenger['id']},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    return requests

@api_router.get("/admin/booking-requests")
async def get_all_booking_requests():
    """Get all booking requests (admin only)"""
    requests = await db.booking_requests.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return requests

@api_router.put("/admin/booking-requests/{request_id}/approve")
async def approve_booking_request(request_id: str):
    """Approve a booking request and create the actual booking"""
    request_doc = await db.booking_requests.find_one({"id": request_id}, {"_id": 0})
    if not request_doc:
        raise HTTPException(status_code=404, detail="Request not found")
    
    if request_doc['status'] != 'pending':
        raise HTTPException(status_code=400, detail="Request already processed")
    
    # Generate booking ID
    readable_id = await generate_booking_id()
    
    # Create the booking
    booking = Booking(
        first_name=request_doc['passenger_name'].split()[0] if request_doc['passenger_name'] else "",
        last_name=" ".join(request_doc['passenger_name'].split()[1:]) if request_doc['passenger_name'] and len(request_doc['passenger_name'].split()) > 1 else "",
        customer_phone=request_doc['passenger_phone'],
        pickup_location=request_doc['pickup_location'],
        dropoff_location=request_doc['dropoff_location'],
        booking_datetime=datetime.fromisoformat(request_doc['pickup_datetime']) if isinstance(request_doc['pickup_datetime'], str) else request_doc['pickup_datetime'],
        notes=request_doc.get('notes', ''),
        flight_info=FlightInfo(flight_number=request_doc['flight_number']) if request_doc.get('flight_number') else None,
    )
    booking.booking_id = readable_id
    
    doc = booking.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    doc['booking_datetime'] = doc['booking_datetime'].isoformat()
    doc['sms_sent'] = False
    doc['customer_name'] = request_doc['passenger_name']
    
    await db.bookings.insert_one(doc)
    
    # Update request status
    await db.booking_requests.update_one(
        {"id": request_id},
        {"$set": {"status": "approved", "booking_id": readable_id}}
    )
    
    logging.info(f"Booking request {request_id} approved, created booking {readable_id}")
    
    return {"message": "Booking created", "booking_id": readable_id}

@api_router.put("/admin/booking-requests/{request_id}/reject")
async def reject_booking_request(request_id: str, admin_notes: str = ""):
    """Reject a booking request"""
    result = await db.booking_requests.update_one(
        {"id": request_id, "status": "pending"},
        {"$set": {"status": "rejected", "admin_notes": admin_notes}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Request not found or already processed")
    
    return {"message": "Request rejected"}

# ========== ADMIN PASSENGER MANAGEMENT ENDPOINTS ==========
@api_router.get("/admin/passengers")
async def get_all_passengers():
    """Get all registered passenger accounts (admin only)"""
    passengers = await db.passengers.find({}, {"_id": 0, "password_hash": 0}).to_list(1000)
    
    # Add booking count for each passenger
    for passenger in passengers:
        phone = passenger['phone']
        phone_variations = [phone]
        if phone.startswith("+44"):
            phone_variations.append("0" + phone[3:])
            phone_variations.append(phone[3:])
        
        count = await db.bookings.count_documents({"customer_phone": {"$in": phone_variations}})
        passenger['booking_count'] = count
    
    return passengers

@api_router.put("/admin/passengers/{passenger_id}/password")
async def update_passenger_password(passenger_id: str, data: dict):
    """Update a passenger's password (admin only)"""
    passenger = await db.passengers.find_one({"id": passenger_id})
    if not passenger:
        raise HTTPException(status_code=404, detail="Passenger not found")
    
    new_password = data.get('password')
    if not new_password or len(new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    
    await db.passengers.update_one(
        {"id": passenger_id},
        {"$set": {"password_hash": hash_password(new_password)}}
    )
    
    return {"message": "Password updated successfully"}

@api_router.delete("/admin/passengers/{passenger_id}")
async def delete_passenger(passenger_id: str):
    """Delete a passenger account (admin only)"""
    result = await db.passengers.delete_one({"id": passenger_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Passenger not found")
    
    return {"message": "Passenger account deleted successfully"}

@api_router.post("/admin/passengers")
async def create_passenger_admin(data: PassengerRegister):
    """Create a new passenger account (admin only)"""
    # Normalize phone number
    phone = data.phone.strip().replace(" ", "")
    if phone.startswith("0"):
        phone = "+44" + phone[1:]
    elif not phone.startswith("+"):
        phone = "+44" + phone
    
    # Check if phone already registered
    existing = await db.passengers.find_one({"phone": phone})
    if existing:
        raise HTTPException(status_code=400, detail="Phone number already registered")
    
    # Create passenger
    passenger = Passenger(
        name=data.name,
        phone=phone,
        password_hash=hash_password(data.password)
    )
    
    doc = passenger.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.passengers.insert_one(doc)
    
    return {"message": "Passenger account created successfully", "id": passenger.id}

# ========== BOOKING ENDPOINTS ==========
@api_router.post("/bookings", response_model=BookingResponse)
async def create_booking(booking: BookingCreate, background_tasks: BackgroundTasks):
    # Generate readable booking ID
    readable_booking_id = await generate_booking_id()
    
    # Extract return booking info before creating main booking
    create_return = booking.create_return
    return_datetime = booking.return_datetime
    
    # Create the booking object (exclude return-specific fields)
    booking_data = booking.model_dump(exclude={'create_return', 'return_datetime'})
    booking_obj = Booking(**booking_data)
    booking_obj.booking_id = readable_booking_id
    
    doc = booking_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    doc['booking_datetime'] = doc['booking_datetime'].isoformat()
    doc['sms_sent'] = False
    doc['email_sent'] = False
    # Store full customer_name for backward compatibility
    doc['customer_name'] = f"{booking.first_name} {booking.last_name}"
    # Convert flight_info to dict if present
    if doc.get('flight_info'):
        doc['flight_info'] = doc['flight_info'] if isinstance(doc['flight_info'], dict) else doc['flight_info'].model_dump() if hasattr(doc['flight_info'], 'model_dump') else doc['flight_info']
    
    # Add created_by info (will be set by admin auth in future)
    doc['created_by_id'] = None
    doc['created_by_name'] = "System"
    
    # Initialize history with creation entry
    doc['history'] = [{
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "action": "created",
        "user_id": None,
        "user_name": "System",
        "user_type": "admin",
        "details": f"Booking {readable_booking_id} created"
    }]
    
    await db.bookings.insert_one(doc)
    
    # If return booking requested, create it
    return_booking_id = None
    if create_return and return_datetime:
        return_readable_id = await generate_booking_id()
        
        # Use custom return locations if provided, otherwise swap pickup/dropoff
        return_pickup = booking.return_pickup_location or booking.dropoff_location
        return_dropoff = booking.return_dropoff_location or booking.pickup_location
        
        return_booking = Booking(
            first_name=booking.first_name,
            last_name=booking.last_name,
            customer_phone=booking.customer_phone,
            pickup_location=return_pickup,
            dropoff_location=return_dropoff,
            additional_stops=None,  # Return journey has no intermediate stops
            booking_datetime=return_datetime,
            notes=f"Return journey - {booking.notes}" if booking.notes else "Return journey",
            fare=booking.fare,
            client_id=booking.client_id,
            flight_info=booking.return_flight_info,  # Add return flight info
            is_return=True,
            linked_booking_id=booking_obj.id,
        )
        return_booking.booking_id = return_readable_id
        
        return_doc = return_booking.model_dump()
        return_doc['created_at'] = return_doc['created_at'].isoformat()
        return_doc['booking_datetime'] = return_doc['booking_datetime'].isoformat()
        return_doc['sms_sent'] = False
        return_doc['customer_name'] = f"{booking.first_name} {booking.last_name}"
        # Convert return flight_info to dict if present
        if return_doc.get('flight_info'):
            return_doc['flight_info'] = return_doc['flight_info'] if isinstance(return_doc['flight_info'], dict) else return_doc['flight_info'].model_dump() if hasattr(return_doc['flight_info'], 'model_dump') else return_doc['flight_info']
        
        await db.bookings.insert_one(return_doc)
        return_booking_id = return_booking.id
        
        # Update original booking with link to return
        await db.bookings.update_one(
            {"id": booking_obj.id},
            {"$set": {"linked_booking_id": return_booking_id}}
        )
        doc['linked_booking_id'] = return_booking_id
    
    # Send SMS and Email in background with journey details and short booking ID
    full_name = f"{booking.first_name} {booking.last_name}"
    background_tasks.add_task(
        send_notifications_and_update_booking,
        booking_obj.id,
        booking.customer_phone,
        getattr(booking, 'customer_email', None),
        full_name,
        booking.pickup_location,
        booking.dropoff_location,
        doc.get('distance_miles'),
        doc.get('duration_minutes'),
        doc['booking_datetime'],
        readable_booking_id,  # Pass the short booking ID
        None,  # status
        None,  # driver_name
        booking.customer_phone,  # customer_phone
        None,  # vehicle_type
        booking.additional_stops  # additional_stops
    )
    
    # Return response with customer_name included
    response_data = booking_obj.model_dump()
    response_data['customer_name'] = doc['customer_name']
    response_data['linked_booking_id'] = return_booking_id
    return response_data

async def send_notifications_and_update_booking(booking_id: str, phone: str, email: str, name: str,
                                       pickup: str = None, dropoff: str = None,
                                       distance_miles: float = None, duration_minutes: int = None,
                                       booking_datetime: str = None, short_booking_id: str = None,
                                       status: str = None, driver_name: str = None,
                                       customer_phone: str = None, vehicle_type: str = None,
                                       additional_stops: list = None):
    """Background task to send SMS and email, then update booking record"""
    # Send SMS
    sms_success, sms_message = send_booking_sms(
        phone, name, booking_id, 
        pickup, dropoff, 
        distance_miles, duration_minutes, 
        booking_datetime,
        short_booking_id
    )
    
    # Send Email
    email_success, email_message = send_booking_email(
        email, name, booking_id,
        pickup, dropoff,
        booking_datetime, short_booking_id,
        status, driver_name,
        customer_phone or phone, vehicle_type,
        additional_stops
    )
    
    await db.bookings.update_one(
        {"id": booking_id},
        {"$set": {
            "sms_sent": sms_success, 
            "sms_message": sms_message,
            "email_sent": email_success,
            "email_message": email_message
        }}
    )

@api_router.get("/bookings", response_model=List[BookingResponse])
async def get_bookings():
    bookings = await db.bookings.find({}, {"_id": 0}).to_list(1000)
    for booking in bookings:
        if isinstance(booking.get('created_at'), str):
            booking['created_at'] = datetime.fromisoformat(booking['created_at'])
        if isinstance(booking.get('booking_datetime'), str):
            booking['booking_datetime'] = datetime.fromisoformat(booking['booking_datetime'])
    return bookings

@api_router.get("/bookings/{booking_id}", response_model=BookingResponse)
async def get_booking(booking_id: str):
    booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if isinstance(booking.get('created_at'), str):
        booking['created_at'] = datetime.fromisoformat(booking['created_at'])
    if isinstance(booking.get('booking_datetime'), str):
        booking['booking_datetime'] = datetime.fromisoformat(booking['booking_datetime'])
    return booking

@api_router.get("/b/{short_id}", response_model=BookingResponse)
async def get_booking_by_short_id(short_id: str):
    """Get booking by short ID (e.g., CJ-001) for short URL support"""
    # Try to find by booking_id field (CJ-001 format)
    booking = await db.bookings.find_one({"booking_id": short_id.upper()}, {"_id": 0})
    if not booking:
        # Also try lowercase
        booking = await db.bookings.find_one({"booking_id": short_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if isinstance(booking.get('created_at'), str):
        booking['created_at'] = datetime.fromisoformat(booking['created_at'])
    if isinstance(booking.get('booking_datetime'), str):
        booking['booking_datetime'] = datetime.fromisoformat(booking['booking_datetime'])
    return booking

# SSR endpoint for booking preview - serves HTML with Open Graph meta tags
# This endpoint is accessed via /api/preview/{short_id} for link previews
@api_router.get("/preview/{short_id}", response_class=HTMLResponse)
async def booking_preview_page(short_id: str):
    """
    Server-Side Rendered booking preview page with Open Graph meta tags.
    This allows SMS apps and social media to show rich link previews.
    Access via: /api/preview/CJ-001
    """
    # Get the booking
    booking = await db.bookings.find_one({"booking_id": short_id.upper()}, {"_id": 0})
    if not booking:
        booking = await db.bookings.find_one({"booking_id": short_id}, {"_id": 0})
    
    if not booking:
        # Return a simple 404 page
        return HTMLResponse(content="""
        <!DOCTYPE html>
        <html>
        <head>
            <title>Booking Not Found - CJ's Executive Travel</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
        </head>
        <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
            <h1>Booking Not Found</h1>
            <p>Sorry, we couldn't find this booking.</p>
        </body>
        </html>
        """, status_code=404)
    
    # Get app URL for redirect
    app_url = os.environ.get('APP_URL', 'https://booking-master-14.onrender.com')
    full_booking_url = f"{app_url}/booking/{booking['id']}"
    
    # Format booking details for preview
    customer_name = booking.get('customer_name') or f"{booking.get('first_name', '')} {booking.get('last_name', '')}".strip()
    booking_id = booking.get('booking_id', short_id.upper())
    pickup = booking.get('pickup_location', 'Pickup location')
    dropoff = booking.get('dropoff_location', 'Destination')
    
    # Format date/time
    booking_dt = booking.get('booking_datetime', '')
    formatted_datetime = ''
    if isinstance(booking_dt, str):
        try:
            dt = datetime.fromisoformat(booking_dt.replace('Z', '+00:00'))
            formatted_datetime = dt.strftime('%d %B %Y at %H:%M')
        except:
            formatted_datetime = booking_dt
    elif isinstance(booking_dt, datetime):
        formatted_datetime = booking_dt.strftime('%d %B %Y at %H:%M')
    
    # Truncate for description
    pickup_short = pickup[:50] + '...' if len(pickup) > 50 else pickup
    dropoff_short = dropoff[:50] + '...' if len(dropoff) > 50 else dropoff
    
    # Build meta description
    description = f"Booking {booking_id} for {customer_name}. {pickup_short} → {dropoff_short}. {formatted_datetime}"
    title = f"CJ's Executive Travel - Booking {booking_id}"
    
    # Return HTML with OG tags and auto-redirect
    html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title}</title>
    
    <!-- Open Graph Meta Tags for Link Previews -->
    <meta property="og:title" content="{title}">
    <meta property="og:description" content="{description}">
    <meta property="og:type" content="website">
    <meta property="og:url" content="{app_url}/api/preview/{short_id}">
    <meta property="og:site_name" content="CJ's Executive Travel">
    
    <!-- Twitter Card Meta Tags -->
    <meta name="twitter:card" content="summary">
    <meta name="twitter:title" content="{title}">
    <meta name="twitter:description" content="{description}">
    
    <!-- Standard Meta Tags -->
    <meta name="description" content="{description}">
    
    <!-- Auto-redirect to full booking page after brief delay -->
    <meta http-equiv="refresh" content="0; url={full_booking_url}">
    
    <style>
        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            background: linear-gradient(135deg, #1a365d 0%, #2d3748 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }}
        .card {{
            background: white;
            border-radius: 16px;
            padding: 40px;
            max-width: 500px;
            width: 100%;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            text-align: center;
        }}
        .logo {{
            font-size: 24px;
            font-weight: bold;
            color: #1a365d;
            margin-bottom: 8px;
        }}
        .tagline {{
            color: #718096;
            font-size: 14px;
            margin-bottom: 30px;
        }}
        .booking-id {{
            background: #edf2f7;
            color: #1a365d;
            padding: 8px 20px;
            border-radius: 20px;
            font-weight: bold;
            display: inline-block;
            margin-bottom: 25px;
        }}
        .detail {{
            text-align: left;
            padding: 15px;
            background: #f7fafc;
            border-radius: 10px;
            margin-bottom: 15px;
        }}
        .detail-label {{
            font-size: 12px;
            color: #718096;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 5px;
        }}
        .detail-value {{
            color: #2d3748;
            font-size: 15px;
        }}
        .loading {{
            margin-top: 25px;
            color: #718096;
            font-size: 14px;
        }}
        .spinner {{
            display: inline-block;
            width: 20px;
            height: 20px;
            border: 2px solid #e2e8f0;
            border-top-color: #1a365d;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin-right: 10px;
            vertical-align: middle;
        }}
        @keyframes spin {{
            to {{ transform: rotate(360deg); }}
        }}
        .link {{
            margin-top: 20px;
        }}
        .link a {{
            color: #1a365d;
            text-decoration: none;
            font-weight: 500;
        }}
        .link a:hover {{
            text-decoration: underline;
        }}
    </style>
</head>
<body>
    <div class="card">
        <div class="logo">CJ's Executive Travel</div>
        <div class="tagline">Professional Private Hire Services</div>
        
        <div class="booking-id">Booking {booking_id}</div>
        
        <div class="detail">
            <div class="detail-label">Passenger</div>
            <div class="detail-value">{customer_name}</div>
        </div>
        
        <div class="detail">
            <div class="detail-label">Pickup</div>
            <div class="detail-value">{pickup_short}</div>
        </div>
        
        <div class="detail">
            <div class="detail-label">Drop-off</div>
            <div class="detail-value">{dropoff_short}</div>
        </div>
        
        <div class="detail">
            <div class="detail-label">Date & Time</div>
            <div class="detail-value">{formatted_datetime}</div>
        </div>
        
        <div class="loading">
            <span class="spinner"></span>
            Loading full booking details...
        </div>
        
        <div class="link">
            <a href="{full_booking_url}">Click here if not redirected</a>
        </div>
    </div>
    
    <script>
        // JavaScript redirect as backup
        window.location.href = "{full_booking_url}";
    </script>
</body>
</html>"""
    
    return HTMLResponse(content=html_content)

# Privacy Policy and Terms for Driver App
@api_router.get("/driver-app/privacy", response_class=HTMLResponse)
async def driver_app_privacy():
    """Privacy Policy for CJ's Driver App"""
    html_content = """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Privacy Policy - CJ's Driver App</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1e293b; background: #f8fafc; }
        .container { max-width: 800px; margin: 0 auto; padding: 40px 20px; }
        header { background: #1a3a5c; color: white; padding: 30px 20px; text-align: center; }
        h1 { font-size: 28px; margin-bottom: 10px; }
        .subtitle { opacity: 0.8; }
        .content { background: white; padding: 40px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); margin-top: -20px; }
        h2 { font-size: 20px; color: #1a3a5c; margin: 30px 0 15px; padding-bottom: 8px; border-bottom: 2px solid #e2e8f0; }
        h2:first-of-type { margin-top: 0; }
        p, li { margin-bottom: 12px; color: #475569; }
        ul { padding-left: 24px; }
        .updated { text-align: center; color: #64748b; font-size: 14px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; }
        footer { text-align: center; padding: 30px; color: #64748b; font-size: 14px; }
    </style>
</head>
<body>
    <header><h1>Privacy Policy</h1><p class="subtitle">CJ's Driver App</p></header>
    <div class="container"><div class="content">
        <h2>1. Introduction</h2>
        <p>CJ's Executive Travel Limited operates the CJ's Driver mobile application. This Privacy Policy explains how we collect, use, and safeguard your information.</p>
        <h2>2. Information We Collect</h2>
        <ul>
            <li><strong>Account Information:</strong> Name, email, phone number, login credentials</li>
            <li><strong>Location Data:</strong> Real-time GPS location when online</li>
            <li><strong>Device Information:</strong> Device type, OS, push notification tokens</li>
            <li><strong>Usage Data:</strong> Booking history, earnings, chat messages</li>
        </ul>
        <h2>3. How We Use Your Information</h2>
        <ul>
            <li>Authenticate your identity and provide App access</li>
            <li>Assign bookings and manage dispatch operations</li>
            <li>Share your location with dispatch for operational efficiency</li>
            <li>Send push notifications for new bookings</li>
            <li>Calculate and display your earnings</li>
        </ul>
        <h2>4. Location Data</h2>
        <p>Location is collected when you are "Online". Stop sharing by going "Offline" or logging out.</p>
        <h2>5. Data Security</h2>
        <p>We use encrypted transmission (HTTPS/TLS) and secure authentication.</p>
        <h2>6. Contact Us</h2>
        <p>Email: privacy@cjstravel.uk | Phone: +44 191 722 1223</p>
        <p class="updated">Last Updated: January 2026</p>
    </div></div>
    <footer>&copy; 2026 CJ's Executive Travel Limited</footer>
</body>
</html>"""
    return HTMLResponse(content=html_content)

@api_router.get("/driver-app/terms", response_class=HTMLResponse)
async def driver_app_terms():
    """Terms of Service for CJ's Driver App"""
    html_content = """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Terms of Service - CJ's Driver App</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1e293b; background: #f8fafc; }
        .container { max-width: 800px; margin: 0 auto; padding: 40px 20px; }
        header { background: #1a3a5c; color: white; padding: 30px 20px; text-align: center; }
        h1 { font-size: 28px; margin-bottom: 10px; }
        .subtitle { opacity: 0.8; }
        .content { background: white; padding: 40px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); margin-top: -20px; }
        h2 { font-size: 20px; color: #1a3a5c; margin: 30px 0 15px; padding-bottom: 8px; border-bottom: 2px solid #e2e8f0; }
        h2:first-of-type { margin-top: 0; }
        p, li { margin-bottom: 12px; color: #475569; }
        ul { padding-left: 24px; }
        .updated { text-align: center; color: #64748b; font-size: 14px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; }
        footer { text-align: center; padding: 30px; color: #64748b; font-size: 14px; }
    </style>
</head>
<body>
    <header><h1>Terms of Service</h1><p class="subtitle">CJ's Driver App</p></header>
    <div class="container"><div class="content">
        <h2>1. Acceptance</h2>
        <p>By using the CJ's Driver App, you agree to these Terms of Service.</p>
        <h2>2. Eligibility</h2>
        <ul>
            <li>Be at least 18 years old</li>
            <li>Be an authorized CJ's Executive Travel driver</li>
            <li>Hold valid licenses for private hire driving</li>
        </ul>
        <h2>3. Account Security</h2>
        <p>You are responsible for maintaining the confidentiality of your login credentials.</p>
        <h2>4. Permitted Use</h2>
        <p>The App is for managing bookings, navigation, dispatch communication, and earnings tracking.</p>
        <h2>5. Prohibited Conduct</h2>
        <ul>
            <li>Sharing your account credentials</li>
            <li>Using the App while driving (except hands-free)</li>
            <li>Falsifying location or status information</li>
        </ul>
        <h2>6. Location Services</h2>
        <p>You consent to location collection when online for dispatch operations.</p>
        <h2>7. Booking Obligations</h2>
        <p>When accepting bookings, you commit to completing them professionally.</p>
        <h2>8. Governing Law</h2>
        <p>These Terms are governed by the laws of England and Wales.</p>
        <h2>9. Contact</h2>
        <p>Email: legal@cjstravel.uk | Phone: +44 191 722 1223</p>
        <p class="updated">Last Updated: January 2026</p>
    </div></div>
    <footer>&copy; 2026 CJ's Executive Travel Limited</footer>
</body>
</html>"""
    return HTMLResponse(content=html_content)

@api_router.put("/bookings/{booking_id}", response_model=BookingResponse)
async def update_booking(booking_id: str, booking_update: BookingUpdate):
    existing = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    update_data = {k: v for k, v in booking_update.model_dump().items() if v is not None}
    if 'booking_datetime' in update_data and isinstance(update_data['booking_datetime'], datetime):
        update_data['booking_datetime'] = update_data['booking_datetime'].isoformat()
    
    # Update customer_name if first_name or last_name changed
    if 'first_name' in update_data or 'last_name' in update_data:
        first = update_data.get('first_name') or existing.get('first_name') or ''
        last = update_data.get('last_name') or existing.get('last_name') or ''
        update_data['customer_name'] = f"{first} {last}".strip()
    
    # Track changes for history
    changes = {}
    for key, new_value in update_data.items():
        old_value = existing.get(key)
        if old_value != new_value:
            changes[key] = {"old": old_value, "new": new_value}
    
    if update_data:
        # Add history entry for the edit
        history_entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "action": "updated",
            "user_id": None,
            "user_name": "Admin",
            "user_type": "admin",
            "changes": changes,
            "details": f"Booking updated: {', '.join(changes.keys())}" if changes else "Booking updated"
        }
        await db.bookings.update_one(
            {"id": booking_id}, 
            {
                "$set": update_data,
                "$push": {"history": history_entry}
            }
        )
    
    updated = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if isinstance(updated.get('created_at'), str):
        updated['created_at'] = datetime.fromisoformat(updated['created_at'])
    if isinstance(updated.get('booking_datetime'), str):
        updated['booking_datetime'] = datetime.fromisoformat(updated['booking_datetime'])
    return updated

@api_router.delete("/bookings/{booking_id}")
async def delete_booking(booking_id: str):
    result = await db.bookings.delete_one({"id": booking_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Booking not found")
    return {"message": "Booking deleted successfully"}

@api_router.post("/bookings/{booking_id}/assign/{driver_id}", response_model=BookingResponse)
async def assign_driver_to_booking(booking_id: str, driver_id: str):
    booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    driver = await db.drivers.find_one({"id": driver_id}, {"_id": 0})
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")
    
    # Add history entry
    history_entry = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "action": "driver_assigned",
        "user_id": None,
        "user_name": "Admin",
        "user_type": "admin",
        "details": f"Driver {driver.get('name', 'Unknown')} assigned"
    }
    
    await db.bookings.update_one(
        {"id": booking_id},
        {
            "$set": {"driver_id": driver_id, "status": BookingStatus.ASSIGNED},
            "$push": {"history": history_entry}
        }
    )
    await db.drivers.update_one({"id": driver_id}, {"$set": {"status": DriverStatus.BUSY}})
    
    # Send push notification to driver if they have a push token
    if driver.get("push_token"):
        await send_driver_push_notification(
            driver["push_token"],
            "New Booking Assigned",
            f"Pickup: {booking.get('pickup_location', 'N/A')[:50]}",
            {"type": "new_booking", "booking_id": booking_id}
        )
    
    updated = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if isinstance(updated.get('created_at'), str):
        updated['created_at'] = datetime.fromisoformat(updated['created_at'])
    if isinstance(updated.get('booking_datetime'), str):
        updated['booking_datetime'] = datetime.fromisoformat(updated['booking_datetime'])
    return updated

@api_router.post("/bookings/{booking_id}/unassign", response_model=BookingResponse)
async def unassign_driver_from_booking(booking_id: str):
    """Unassign driver from a booking"""
    booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # Get driver name for history
    driver_name = "Unknown"
    if booking.get("driver_id"):
        driver = await db.drivers.find_one({"id": booking["driver_id"]}, {"_id": 0})
        if driver:
            driver_name = driver.get("name", "Unknown")
        await db.drivers.update_one(
            {"id": booking["driver_id"]},
            {"$set": {"status": DriverStatus.AVAILABLE}}
        )
    
    # Add history entry
    history_entry = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "action": "driver_unassigned",
        "user_id": None,
        "user_name": "Admin",
        "user_type": "admin",
        "details": f"Driver {driver_name} unassigned"
    }
    
    await db.bookings.update_one(
        {"id": booking_id},
        {
            "$set": {"driver_id": None, "status": BookingStatus.PENDING},
            "$push": {"history": history_entry}
        }
    )
    
    updated = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if isinstance(updated.get('created_at'), str):
        updated['created_at'] = datetime.fromisoformat(updated['created_at'])
    if isinstance(updated.get('booking_datetime'), str):
        updated['booking_datetime'] = datetime.fromisoformat(updated['booking_datetime'])
    return updated

# Send push notification to driver via Expo
async def send_driver_push_notification(push_token: str, title: str, body: str, data: dict = None):
    """Send push notification to driver's mobile app via Expo Push Service"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://exp.host/--/api/v2/push/send",
                json={
                    "to": push_token,
                    "title": title,
                    "body": body,
                    "data": data or {},
                    "sound": "default",
                    "priority": "high",
                    "channelId": "bookings",
                },
                headers={"Content-Type": "application/json"}
            )
            logging.info(f"Push notification sent to {push_token[:20]}...: {response.status_code}")
            return response.status_code == 200
    except Exception as e:
        logging.error(f"Error sending push notification: {e}")
        return False

@api_router.post("/bookings/{booking_id}/resend-sms")
async def resend_booking_sms(booking_id: str):
    """Resend SMS confirmation for a booking"""
    booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # Get customer name (support both old and new format)
    customer_name = booking.get('customer_name') or f"{booking.get('first_name', '')} {booking.get('last_name', '')}".strip()
    
    # Send SMS with short booking ID
    success, message = send_booking_sms(
        customer_phone=booking['customer_phone'],
        customer_name=customer_name,
        booking_id=booking_id,
        pickup=booking.get('pickup_location'),
        dropoff=booking.get('dropoff_location'),
        distance_miles=booking.get('distance_miles'),
        duration_minutes=booking.get('duration_minutes'),
        booking_datetime=booking.get('booking_datetime'),
        short_booking_id=booking.get('booking_id')  # Use short URL (CJ-001)
    )
    
    # Update sms_sent status
    await db.bookings.update_one(
        {"id": booking_id},
        {"$set": {"sms_sent": success}}
    )
    
    if success:
        return {"success": True, "message": "SMS confirmation sent successfully"}
    else:
        raise HTTPException(status_code=500, detail=f"Failed to send SMS: {message}")

@api_router.post("/bookings/{booking_id}/resend-email")
async def resend_booking_email(booking_id: str):
    """Resend email confirmation for a booking"""
    booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    if not booking.get('customer_email'):
        raise HTTPException(status_code=400, detail="No email address on file for this booking")
    
    # Get customer name (support both old and new format)
    customer_name = booking.get('customer_name') or f"{booking.get('first_name', '')} {booking.get('last_name', '')}".strip()
    
    # Get driver name if assigned
    driver_name = None
    vehicle_type = None
    if booking.get('driver_id'):
        driver = await db.drivers.find_one({"id": booking['driver_id']})
        if driver:
            driver_name = driver.get('name')
            vehicle_type = driver.get('vehicle_type')
    
    # Send email with short booking ID
    success, message = send_booking_email(
        customer_email=booking['customer_email'],
        customer_name=customer_name,
        booking_id=booking_id,
        pickup=booking.get('pickup_location'),
        dropoff=booking.get('dropoff_location'),
        booking_datetime=booking.get('booking_datetime'),
        short_booking_id=booking.get('booking_id'),
        status=booking.get('status'),
        driver_name=driver_name,
        customer_phone=booking.get('customer_phone'),
        vehicle_type=vehicle_type,
        additional_stops=booking.get('additional_stops')
    )
    
    # Update email_sent status
    await db.bookings.update_one(
        {"id": booking_id},
        {"$set": {"email_sent": success}}
    )
    
    if success:
        return {"success": True, "message": "Email confirmation sent successfully"}
    else:
        raise HTTPException(status_code=500, detail=f"Failed to send email: {message}")

@api_router.post("/bookings/{booking_id}/resend-notifications")
async def resend_all_notifications(booking_id: str):
    """Resend both SMS and email confirmations for a booking"""
    booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    customer_name = booking.get('customer_name') or f"{booking.get('first_name', '')} {booking.get('last_name', '')}".strip()
    
    # Get driver name and vehicle type if assigned
    driver_name = None
    vehicle_type = None
    if booking.get('driver_id'):
        driver = await db.drivers.find_one({"id": booking['driver_id']})
        if driver:
            driver_name = driver.get('name')
            vehicle_type = driver.get('vehicle_type')
    
    results = {"sms": None, "email": None}
    
    # Send SMS
    sms_success, sms_message = send_booking_sms(
        customer_phone=booking['customer_phone'],
        customer_name=customer_name,
        booking_id=booking_id,
        pickup=booking.get('pickup_location'),
        dropoff=booking.get('dropoff_location'),
        distance_miles=booking.get('distance_miles'),
        duration_minutes=booking.get('duration_minutes'),
        booking_datetime=booking.get('booking_datetime'),
        short_booking_id=booking.get('booking_id')
    )
    results['sms'] = {"success": sms_success, "message": sms_message}
    
    # Send Email if email exists
    if booking.get('customer_email'):
        email_success, email_message = send_booking_email(
            customer_email=booking['customer_email'],
            customer_name=customer_name,
            booking_id=booking_id,
            pickup=booking.get('pickup_location'),
            dropoff=booking.get('dropoff_location'),
            booking_datetime=booking.get('booking_datetime'),
            short_booking_id=booking.get('booking_id'),
            status=booking.get('status'),
            driver_name=driver_name,
            customer_phone=booking.get('customer_phone'),
            vehicle_type=vehicle_type,
            additional_stops=booking.get('additional_stops')
        )
        results['email'] = {"success": email_success, "message": email_message}
    else:
        results['email'] = {"success": False, "message": "No email address on file"}
    
    # Update statuses
    await db.bookings.update_one(
        {"id": booking_id},
        {"$set": {
            "sms_sent": sms_success,
            "email_sent": results['email']['success'] if results['email'] else False
        }}
    )
    
    return results

# ========== STATS ENDPOINT ==========
@api_router.get("/stats")
async def get_stats():
    total_bookings = await db.bookings.count_documents({})
    pending_bookings = await db.bookings.count_documents({"status": BookingStatus.PENDING})
    assigned_bookings = await db.bookings.count_documents({"status": BookingStatus.ASSIGNED})
    in_progress_bookings = await db.bookings.count_documents({"status": BookingStatus.IN_PROGRESS})
    completed_bookings = await db.bookings.count_documents({"status": BookingStatus.COMPLETED})
    cancelled_bookings = await db.bookings.count_documents({"status": BookingStatus.CANCELLED})
    
    total_drivers = await db.drivers.count_documents({})
    available_drivers = await db.drivers.count_documents({"status": DriverStatus.AVAILABLE})
    busy_drivers = await db.drivers.count_documents({"status": DriverStatus.BUSY})
    
    # Calculate total fare from completed bookings
    pipeline = [
        {"$match": {"status": BookingStatus.COMPLETED, "fare": {"$exists": True, "$ne": None}}},
        {"$group": {"_id": None, "total": {"$sum": "$fare"}}}
    ]
    fare_result = await db.bookings.aggregate(pipeline).to_list(1)
    total_revenue = fare_result[0]["total"] if fare_result else 0
    
    return {
        "bookings": {
            "total": total_bookings,
            "pending": pending_bookings,
            "assigned": assigned_bookings,
            "in_progress": in_progress_bookings,
            "completed": completed_bookings,
            "cancelled": cancelled_bookings
        },
        "drivers": {
            "total": total_drivers,
            "available": available_drivers,
            "busy": busy_drivers
        },
        "revenue": total_revenue
    }

# ========== DRIVER MOBILE APP ENDPOINTS ==========

# Driver authentication dependency
async def get_current_driver(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Verify driver JWT token"""
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        driver_id = payload.get("driver_id")
        if not driver_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        driver = await db.drivers.find_one({"id": driver_id}, {"_id": 0})
        if not driver:
            raise HTTPException(status_code=401, detail="Driver not found")
        
        return driver
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

@api_router.post("/driver/login")
async def driver_login(login: DriverLogin):
    """Driver login for mobile app"""
    driver = await db.drivers.find_one({"email": login.email.lower()}, {"_id": 0})
    if not driver:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    # Check password
    password_hash = hashlib.sha256(login.password.encode()).hexdigest()
    if driver.get("password_hash") != password_hash:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    # Generate JWT token
    token_data = {
        "driver_id": driver["id"],
        "email": driver["email"],
        "exp": datetime.now(timezone.utc) + timedelta(days=30)
    }
    token = jwt.encode(token_data, JWT_SECRET, algorithm=JWT_ALGORITHM)
    
    # Update driver as online
    await db.drivers.update_one(
        {"id": driver["id"]},
        {"$set": {"is_online": True, "last_login": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {
        "token": token,
        "driver": {
            "id": driver["id"],
            "name": driver["name"],
            "email": driver["email"],
            "phone": driver["phone"],
            "vehicle_type": driver["vehicle_type"],
            "vehicle_number": driver["vehicle_number"],
            "status": driver["status"]
        }
    }

@api_router.get("/driver/profile")
async def get_driver_profile(driver: dict = Depends(get_current_driver)):
    """Get current driver profile"""
    return {
        "id": driver["id"],
        "name": driver["name"],
        "email": driver.get("email"),
        "phone": driver["phone"],
        "vehicle_type": driver["vehicle_type"],
        "vehicle_number": driver["vehicle_number"],
        "status": driver["status"],
        "is_online": driver.get("is_online", False),
        "on_break": driver.get("on_break", False),
        "current_location": driver.get("current_location"),
        # Document expiry dates
        "taxi_licence_expiry": driver.get("taxi_licence_expiry"),
        "dbs_expiry": driver.get("dbs_expiry"),
        "school_badge_expiry": driver.get("school_badge_expiry"),
        "driving_licence_expiry": driver.get("driving_licence_expiry"),
        "cpc_expiry": driver.get("cpc_expiry"),
        "tacho_card_expiry": driver.get("tacho_card_expiry"),
    }

@api_router.put("/driver/status")
async def update_driver_app_status(status_update: DriverAppStatus, driver: dict = Depends(get_current_driver)):
    """Update driver online/break status"""
    update_data = {}
    
    if status_update.is_online is not None:
        update_data["is_online"] = status_update.is_online
        if status_update.is_online:
            update_data["status"] = DriverStatus.AVAILABLE
        else:
            update_data["status"] = DriverStatus.OFFLINE
            # When going offline, release the vehicle
            update_data["selected_vehicle_id"] = None
            # Also update the vehicle to remove the driver assignment
            current_vehicle = driver.get("selected_vehicle_id")
            if current_vehicle:
                await db.vehicles.update_one(
                    {"id": current_vehicle},
                    {"$set": {"current_driver_id": None}}
                )
    
    if status_update.on_break is not None:
        update_data["on_break"] = status_update.on_break
        if status_update.on_break:
            update_data["status"] = DriverStatus.BREAK
    
    if status_update.selected_vehicle_id is not None:
        update_data["selected_vehicle_id"] = status_update.selected_vehicle_id
    
    if status_update.push_token is not None:
        update_data["push_token"] = status_update.push_token
    
    if update_data:
        await db.drivers.update_one({"id": driver["id"]}, {"$set": update_data})
    
    return {"message": "Status updated", "updates": update_data}

class VehicleSelection(BaseModel):
    vehicle_id: str

@api_router.post("/driver/select-vehicle")
async def select_vehicle(selection: VehicleSelection, driver: dict = Depends(get_current_driver)):
    """Select a vehicle for the shift - enforces vehicle exclusivity"""
    vehicle_id = selection.vehicle_id
    
    # Check if vehicle exists
    vehicle = await db.vehicles.find_one({"id": vehicle_id})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    # Check if vehicle is already in use by another online driver
    current_driver_id = vehicle.get("current_driver_id")
    if current_driver_id and current_driver_id != driver["id"]:
        # Check if that driver is actually online
        other_driver = await db.drivers.find_one({"id": current_driver_id})
        if other_driver and other_driver.get("is_online", False):
            raise HTTPException(
                status_code=409, 
                detail=f"Vehicle is currently in use by {other_driver.get('name', 'another driver')}"
            )
    
    # Release any previously selected vehicle by this driver
    previous_vehicle_id = driver.get("selected_vehicle_id")
    if previous_vehicle_id and previous_vehicle_id != vehicle_id:
        await db.vehicles.update_one(
            {"id": previous_vehicle_id},
            {"$set": {"current_driver_id": None}}
        )
    
    # Assign vehicle to driver
    await db.vehicles.update_one(
        {"id": vehicle_id},
        {"$set": {"current_driver_id": driver["id"]}}
    )
    
    # Update driver's selected vehicle
    await db.drivers.update_one(
        {"id": driver["id"]},
        {"$set": {"selected_vehicle_id": vehicle_id}}
    )
    
    return {
        "message": "Vehicle selected successfully",
        "vehicle": {
            "id": vehicle["id"],
            "registration": vehicle.get("registration"),
            "vehicle_type_name": vehicle.get("vehicle_type_name")
        }
    }

@api_router.post("/driver/release-vehicle")
async def release_vehicle(driver: dict = Depends(get_current_driver)):
    """Release the currently selected vehicle"""
    vehicle_id = driver.get("selected_vehicle_id")
    
    if vehicle_id:
        # Clear vehicle assignment
        await db.vehicles.update_one(
            {"id": vehicle_id},
            {"$set": {"current_driver_id": None}}
        )
    
    # Clear driver's vehicle selection
    await db.drivers.update_one(
        {"id": driver["id"]},
        {"$set": {"selected_vehicle_id": None}}
    )
    
    return {"message": "Vehicle released successfully"}

@api_router.get("/driver/available-vehicles")
async def get_available_vehicles(driver: dict = Depends(get_current_driver)):
    """Get list of vehicles with availability status"""
    # Get all vehicles (status can be 'active' or None/missing for older records)
    vehicles = await db.vehicles.find({
        "$or": [
            {"status": "active"},
            {"status": {"$exists": False}},
            {"status": None}
        ]
    }).to_list(100)
    
    result = []
    for v in vehicles:
        current_driver_id = v.get("current_driver_id")
        is_available = True
        in_use_by = None
        
        if current_driver_id:
            if current_driver_id == driver["id"]:
                # This driver has the vehicle
                in_use_by = "you"
            else:
                # Check if other driver is online
                other_driver = await db.drivers.find_one({"id": current_driver_id})
                if other_driver and other_driver.get("is_online", False):
                    is_available = False
                    in_use_by = other_driver.get("name", "Another driver")
        
        result.append({
            "id": v["id"],
            "registration": v.get("registration"),
            "vehicle_type_name": v.get("vehicle_type_name"),
            "make": v.get("make"),
            "model": v.get("model"),
            "color": v.get("color"),
            "is_available": is_available,
            "in_use_by": in_use_by
        })
    
    return result

@api_router.put("/driver/location")
async def update_driver_location(location: DriverLocationUpdate, driver: dict = Depends(get_current_driver)):
    """Update driver's current GPS location"""
    location_data = {
        "lat": location.latitude,
        "lng": location.longitude,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.drivers.update_one(
        {"id": driver["id"]},
        {"$set": {"current_location": location_data}}
    )
    
    return {"message": "Location updated", "location": location_data}

class DriverPasswordChange(BaseModel):
    current_password: str
    new_password: str

@api_router.put("/driver/change-password")
async def change_driver_password(password_data: DriverPasswordChange, driver: dict = Depends(get_current_driver)):
    """Change driver's password"""
    # Verify current password
    if not verify_password(password_data.current_password, driver.get("password_hash", "")):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    
    # Hash new password
    new_hash = hash_password(password_data.new_password)
    
    # Update password
    await db.drivers.update_one(
        {"id": driver["id"]},
        {"$set": {"password_hash": new_hash}}
    )
    
    return {"message": "Password changed successfully"}

@api_router.get("/driver/document-notifications")
async def check_document_notifications(driver: dict = Depends(get_current_driver)):
    """Check for document expiry notifications (60 days and 30 days)"""
    now = datetime.now(timezone.utc)
    notifications = []
    
    doc_fields = [
        ("taxi_licence_expiry", "Taxi Licence"),
        ("dbs_expiry", "DBS Certificate"),
        ("school_badge_expiry", "School Badge"),
        ("driving_licence_expiry", "Driving Licence"),
        ("cpc_expiry", "CPC Certificate"),
        ("tacho_card_expiry", "Tacho Card"),
    ]
    
    for field, name in doc_fields:
        expiry = driver.get(field)
        if expiry:
            try:
                if isinstance(expiry, str):
                    expiry_str = expiry.replace("Z", "+00:00")
                    try:
                        expiry_date = datetime.fromisoformat(expiry_str)
                    except:
                        expiry_date = datetime.fromisoformat(expiry.split("+")[0].split("T")[0] + "T00:00:00")
                        expiry_date = expiry_date.replace(tzinfo=timezone.utc)
                else:
                    expiry_date = expiry
                
                now_aware = now if now.tzinfo else now.replace(tzinfo=timezone.utc)
                expiry_aware = expiry_date if expiry_date.tzinfo else expiry_date.replace(tzinfo=timezone.utc)
                
                days_until = (expiry_aware - now_aware).days
                
                # Check for 60 day and 30 day notifications
                if days_until <= 0:
                    notifications.append({
                        "document": name,
                        "days_until_expiry": days_until,
                        "severity": "expired",
                        "title": f"{name} Expired!",
                        "body": f"Your {name} has expired. Please renew immediately."
                    })
                elif days_until <= 30:
                    notifications.append({
                        "document": name,
                        "days_until_expiry": days_until,
                        "severity": "urgent",
                        "title": f"{name} Expiring Soon!",
                        "body": f"Your {name} expires in {days_until} days. Please renew urgently."
                    })
                elif days_until <= 60:
                    notifications.append({
                        "document": name,
                        "days_until_expiry": days_until,
                        "severity": "warning",
                        "title": f"{name} Expiring",
                        "body": f"Your {name} expires in {days_until} days. Please plan to renew."
                    })
            except Exception as e:
                print(f"Error parsing {field}: {e}")
    
    return {"notifications": notifications, "count": len(notifications)}

@api_router.get("/driver/stats")
async def get_driver_stats(driver: dict = Depends(get_current_driver)):
    """Get driver statistics for dashboard"""
    now = datetime.now(timezone.utc)
    week_start = now - timedelta(days=now.weekday())
    week_start = week_start.replace(hour=0, minute=0, second=0, microsecond=0)
    
    # 24 hour period for shift metrics
    day_start = now - timedelta(hours=24)
    
    # Get weekly bookings
    weekly_bookings = await db.bookings.find({
        "driver_id": driver["id"],
        "status": "completed",
        "booking_datetime": {"$gte": week_start.isoformat()}
    }).to_list(100)
    
    # Get 24hr bookings for shift metrics
    daily_bookings = await db.bookings.find({
        "driver_id": driver["id"],
        "status": "completed",
        "booking_datetime": {"$gte": day_start.isoformat()}
    }).to_list(100)
    
    # Calculate stats
    total_bookings = len(weekly_bookings)
    total_income = sum(b.get("fare", 0) for b in weekly_bookings)
    
    # 24hr stats
    daily_total_bookings = len(daily_bookings)
    daily_income = sum(b.get("fare", 0) for b in daily_bookings)
    
    # Bookings per day of week
    daily_counts = [0] * 7
    for booking in weekly_bookings:
        dt = datetime.fromisoformat(booking["booking_datetime"].replace("Z", "+00:00"))
        day_index = dt.weekday()
        daily_counts[day_index] += 1
    
    # Document expiry information
    documents = []
    doc_fields = [
        ("taxi_licence_expiry", "Taxi Licence"),
        ("dbs_expiry", "DBS Certificate"),
        ("school_badge_expiry", "School Badge"),
        ("driving_licence_expiry", "Driving Licence"),
        ("cpc_expiry", "CPC Certificate"),
        ("tacho_card_expiry", "Tacho Card"),
    ]
    
    for field, name in doc_fields:
        expiry = driver.get(field)
        if expiry:
            try:
                # Handle various date formats
                if isinstance(expiry, str):
                    expiry_str = expiry.replace("Z", "+00:00")
                    # Try parsing with timezone
                    try:
                        expiry_date = datetime.fromisoformat(expiry_str)
                    except:
                        # Try parsing without timezone
                        expiry_date = datetime.fromisoformat(expiry.split("+")[0].split("T")[0] + "T00:00:00")
                        expiry_date = expiry_date.replace(tzinfo=timezone.utc)
                else:
                    expiry_date = expiry
                
                # Make now timezone aware for comparison
                now_aware = now if now.tzinfo else now.replace(tzinfo=timezone.utc)
                expiry_aware = expiry_date if expiry_date.tzinfo else expiry_date.replace(tzinfo=timezone.utc)
                
                days_until = (expiry_aware - now_aware).days
                documents.append({
                    "name": name,
                    "expiry_date": expiry,
                    "days_until_expiry": days_until
                })
            except Exception as e:
                print(f"Error parsing {field}: {e}")
                pass
    
    return {
        "total_bookings": total_bookings,
        "total_income": total_income,
        "weekly_bookings": daily_counts,
        "cash": "-",
        "card": "-",
        "account": "-",
        # 24hr shift metrics
        "shift_24hr": {
            "total_bookings": daily_total_bookings,
            "total_income": daily_income,
            "total_shift_time": "-",
            "active_shift_time": "-",
            "on_job_time": "-",
            "on_break_time": "-"
        },
        # Document expiry info
        "documents": documents
    }

class AdminChatMessage(BaseModel):
    message: str

@api_router.post("/driver/admin-chat")
async def send_admin_chat(chat: AdminChatMessage, driver: dict = Depends(get_current_driver)):
    """Send a message to admin"""
    message_doc = {
        "id": str(uuid.uuid4()),
        "driver_id": driver["id"],
        "driver_name": driver.get("name"),
        "message": chat.message,
        "sender_type": "driver",
        "sender_name": driver.get("name"),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "read": False
    }
    await db.driver_admin_messages.insert_one(message_doc)
    return {"message": "Message sent", "id": message_doc["id"]}

@api_router.get("/driver/admin-chat")
async def get_admin_chat(driver: dict = Depends(get_current_driver)):
    """Get chat messages with admin"""
    messages = await db.driver_admin_messages.find(
        {"driver_id": driver["id"]},
        {"_id": 0}
    ).sort("created_at", 1).to_list(100)
    return messages

@api_router.get("/driver/bookings")
async def get_driver_bookings(driver: dict = Depends(get_current_driver)):
    """Get all bookings assigned to this driver"""
    bookings = await db.bookings.find(
        {"driver_id": driver["id"]},
        {"_id": 0}
    ).sort("booking_datetime", 1).to_list(100)
    
    # Categorize bookings
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1)
    
    today_bookings = []
    upcoming_bookings = []
    past_bookings = []
    
    for booking in bookings:
        booking_dt = datetime.fromisoformat(booking["booking_datetime"].replace("Z", "+00:00"))
        if today_start <= booking_dt < today_end:
            today_bookings.append(booking)
        elif booking_dt >= today_end:
            upcoming_bookings.append(booking)
        else:
            past_bookings.append(booking)
    
    return {
        "today": today_bookings,
        "upcoming": upcoming_bookings,
        "past": past_bookings[-20:] if len(past_bookings) > 20 else past_bookings  # Limit past bookings
    }

@api_router.get("/driver/bookings/pending")
async def get_pending_assignments(driver: dict = Depends(get_current_driver)):
    """Get bookings pending acceptance by this driver"""
    # Get bookings that are assigned but not yet accepted
    bookings = await db.bookings.find(
        {
            "driver_id": driver["id"],
            "status": BookingStatus.ASSIGNED,
            "driver_accepted": {"$ne": True}
        },
        {"_id": 0}
    ).sort("booking_datetime", 1).to_list(50)
    
    return bookings

@api_router.put("/driver/bookings/{booking_id}/accept")
async def accept_booking(booking_id: str, driver: dict = Depends(get_current_driver)):
    """Accept a booking assignment"""
    booking = await db.bookings.find_one({"id": booking_id, "driver_id": driver["id"]})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found or not assigned to you")
    
    await db.bookings.update_one(
        {"id": booking_id},
        {"$set": {
            "driver_accepted": True,
            "driver_accepted_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": "Booking accepted"}

@api_router.put("/driver/bookings/{booking_id}/reject")
async def reject_booking(booking_id: str, reason: Optional[str] = None, driver: dict = Depends(get_current_driver)):
    """Reject a booking assignment"""
    booking = await db.bookings.find_one({"id": booking_id, "driver_id": driver["id"]})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found or not assigned to you")
    
    await db.bookings.update_one(
        {"id": booking_id},
        {"$set": {
            "driver_id": None,
            "driver_rejected": True,
            "driver_rejection_reason": reason,
            "status": BookingStatus.PENDING
        }}
    )
    
    return {"message": "Booking rejected"}

@api_router.put("/driver/bookings/{booking_id}/status")
async def update_booking_status_driver(booking_id: str, status: str, driver: dict = Depends(get_current_driver)):
    """Update booking status from driver app"""
    booking = await db.bookings.find_one({"id": booking_id, "driver_id": driver["id"]})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found or not assigned to you")
    
    valid_statuses = ["on_way", "arrived", "in_progress", "completed"]
    if status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid_statuses}")
    
    update_data = {"status": status}
    
    # Add timestamps for status changes
    if status == "on_way":
        update_data["driver_on_way_at"] = datetime.now(timezone.utc).isoformat()
    elif status == "arrived":
        update_data["driver_arrived_at"] = datetime.now(timezone.utc).isoformat()
    elif status == "in_progress":
        update_data["journey_started_at"] = datetime.now(timezone.utc).isoformat()
    elif status == "completed":
        update_data["completed_at"] = datetime.now(timezone.utc).isoformat()
    
    # Add history entry for driver status change
    history_entry = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "action": "status_changed",
        "user_id": driver["id"],
        "user_name": driver.get("name", "Driver"),
        "user_type": "driver",
        "details": f"Status changed to {status}"
    }
    
    await db.bookings.update_one(
        {"id": booking_id}, 
        {
            "$set": update_data,
            "$push": {"history": history_entry}
        }
    )
    
    # Send notification to passenger if they have an account
    # TODO: Implement push notification to passenger
    
    return {"message": f"Booking status updated to {status}"}

@api_router.post("/driver/bookings/{booking_id}/notify-arrival")
async def notify_passenger_arrival(booking_id: str, driver: dict = Depends(get_current_driver)):
    """Send 'I've arrived' notification to passenger"""
    booking = await db.bookings.find_one({"id": booking_id, "driver_id": driver["id"]}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # Send SMS notification
    customer_phone = booking.get("customer_phone")
    if customer_phone and vonage_client:
        try:
            message = f"Your driver {driver['name']} has arrived at the pickup location. Vehicle: {driver['vehicle_type']} ({driver['vehicle_number']})"
            vonage_client.sms.send(
                vonage.Sms(
                    from_=VONAGE_FROM_NUMBER,
                    to=customer_phone.replace("+", "").replace(" ", ""),
                    text=message
                )
            )
            logging.info(f"Arrival notification sent to {customer_phone}")
        except Exception as e:
            logging.error(f"Failed to send arrival notification: {e}")
    
    # Update booking
    await db.bookings.update_one(
        {"id": booking_id},
        {"$set": {
            "status": "arrived",
            "driver_arrived_at": datetime.now(timezone.utc).isoformat(),
            "arrival_notification_sent": True
        }}
    )
    
    return {"message": "Arrival notification sent"}

@api_router.get("/driver/earnings")
async def get_driver_earnings(driver: dict = Depends(get_current_driver)):
    """Get driver's earnings summary"""
    # Get completed bookings with fare
    pipeline = [
        {"$match": {"driver_id": driver["id"], "status": "completed", "fare": {"$exists": True, "$ne": None}}},
        {"$group": {
            "_id": None,
            "total_earnings": {"$sum": "$fare"},
            "total_trips": {"$sum": 1}
        }}
    ]
    
    result = await db.bookings.aggregate(pipeline).to_list(1)
    total = result[0] if result else {"total_earnings": 0, "total_trips": 0}
    
    # Get today's earnings
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    today_pipeline = [
        {
            "$match": {
                "driver_id": driver["id"],
                "status": "completed",
                "fare": {"$exists": True, "$ne": None},
                "completed_at": {"$gte": today_start.isoformat()}
            }
        },
        {"$group": {
            "_id": None,
            "earnings": {"$sum": "$fare"},
            "trips": {"$sum": 1}
        }}
    ]
    
    today_result = await db.bookings.aggregate(today_pipeline).to_list(1)
    today = today_result[0] if today_result else {"earnings": 0, "trips": 0}
    
    # Get this week's earnings
    week_start = today_start - timedelta(days=today_start.weekday())
    week_pipeline = [
        {
            "$match": {
                "driver_id": driver["id"],
                "status": "completed",
                "fare": {"$exists": True, "$ne": None},
                "completed_at": {"$gte": week_start.isoformat()}
            }
        },
        {"$group": {
            "_id": None,
            "earnings": {"$sum": "$fare"},
            "trips": {"$sum": 1}
        }}
    ]
    
    week_result = await db.bookings.aggregate(week_pipeline).to_list(1)
    week = week_result[0] if week_result else {"earnings": 0, "trips": 0}
    
    return {
        "today": {
            "earnings": today.get("earnings", 0),
            "trips": today.get("trips", 0)
        },
        "this_week": {
            "earnings": week.get("earnings", 0),
            "trips": week.get("trips", 0)
        },
        "all_time": {
            "earnings": total.get("total_earnings", 0),
            "trips": total.get("total_trips", 0)
        }
    }

@api_router.get("/driver/history")
async def get_driver_booking_history(driver: dict = Depends(get_current_driver), limit: int = 50, skip: int = 0):
    """Get driver's booking history"""
    bookings = await db.bookings.find(
        {"driver_id": driver["id"], "status": "completed"},
        {"_id": 0}
    ).sort("completed_at", -1).skip(skip).limit(limit).to_list(limit)
    
    total = await db.bookings.count_documents({"driver_id": driver["id"], "status": "completed"})
    
    return {
        "bookings": bookings,
        "total": total,
        "limit": limit,
        "skip": skip
    }

# ========== CHAT ENDPOINTS ==========

class ChatMessage(BaseModel):
    booking_id: str
    message: str
    sender_type: str  # "driver" or "dispatch"

@api_router.post("/driver/chat/send")
async def send_chat_message(chat: ChatMessage, driver: dict = Depends(get_current_driver)):
    """Send a chat message for a booking"""
    booking = await db.bookings.find_one({"id": chat.booking_id, "driver_id": driver["id"]})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    message_doc = {
        "id": str(uuid.uuid4()),
        "booking_id": chat.booking_id,
        "sender_type": "driver",
        "sender_id": driver["id"],
        "sender_name": driver["name"],
        "message": chat.message,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "read": False
    }
    
    await db.chat_messages.insert_one(message_doc)
    
    return {"message": "Message sent", "id": message_doc["id"]}

@api_router.get("/driver/chat/{booking_id}")
async def get_chat_messages(booking_id: str, driver: dict = Depends(get_current_driver)):
    """Get chat messages for a booking"""
    booking = await db.bookings.find_one({"id": booking_id, "driver_id": driver["id"]})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    messages = await db.chat_messages.find(
        {"booking_id": booking_id},
        {"_id": 0}
    ).sort("created_at", 1).to_list(100)
    
    # Mark messages as read
    await db.chat_messages.update_many(
        {"booking_id": booking_id, "sender_type": "dispatch", "read": False},
        {"$set": {"read": True}}
    )
    
    return messages

# Dispatch-side chat endpoint
@api_router.post("/dispatch/chat/send")
async def send_dispatch_message(chat: ChatMessage):
    """Send a chat message from dispatch"""
    booking = await db.bookings.find_one({"id": chat.booking_id})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    message_doc = {
        "id": str(uuid.uuid4()),
        "booking_id": chat.booking_id,
        "sender_type": "dispatch",
        "sender_id": "dispatch",
        "sender_name": "Dispatch",
        "message": chat.message,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "read": False
    }
    
    await db.chat_messages.insert_one(message_doc)
    
    return {"message": "Message sent", "id": message_doc["id"]}

@api_router.get("/dispatch/chat/{booking_id}")
async def get_dispatch_chat(booking_id: str):
    """Get chat messages for dispatch view"""
    messages = await db.chat_messages.find(
        {"booking_id": booking_id},
        {"_id": 0}
    ).sort("created_at", 1).to_list(100)
    
    return messages

# ========== STRIPE PAYMENT ENDPOINTS ==========

class PaymentRequest(BaseModel):
    booking_id: str
    amount: float
    origin_url: str
    customer_email: Optional[str] = None
    customer_name: Optional[str] = None

class PaymentStatusRequest(BaseModel):
    session_id: str

@api_router.post("/payments/create-checkout")
async def create_payment_checkout(request: Request, payment_request: PaymentRequest):
    """Create a Stripe checkout session for a booking payment"""
    global stripe_checkout
    
    if not STRIPE_API_KEY:
        raise HTTPException(status_code=500, detail="Stripe is not configured")
    
    try:
        # Initialize Stripe checkout if not already done
        host_url = str(request.base_url).rstrip('/')
        webhook_url = f"{host_url}/api/webhook/stripe"
        stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
        
        # Verify the booking exists
        booking = await db.bookings.find_one({"id": payment_request.booking_id})
        if not booking:
            raise HTTPException(status_code=404, detail="Booking not found")
        
        # Build success and cancel URLs
        origin = payment_request.origin_url.rstrip('/')
        success_url = f"{origin}/bookings?payment=success&session_id={{CHECKOUT_SESSION_ID}}"
        cancel_url = f"{origin}/bookings?payment=cancelled"
        
        # Create checkout session
        checkout_request = CheckoutSessionRequest(
            amount=float(payment_request.amount),
            currency="gbp",
            success_url=success_url,
            cancel_url=cancel_url,
            metadata={
                "booking_id": payment_request.booking_id,
                "customer_name": payment_request.customer_name or booking.get('customer_name', ''),
                "customer_email": payment_request.customer_email or booking.get('customer_email', ''),
            }
        )
        
        session: CheckoutSessionResponse = await stripe_checkout.create_checkout_session(checkout_request)
        
        # Create payment transaction record
        payment_transaction = {
            "id": str(uuid.uuid4()),
            "session_id": session.session_id,
            "booking_id": payment_request.booking_id,
            "amount": payment_request.amount,
            "currency": "gbp",
            "customer_name": payment_request.customer_name or booking.get('customer_name', ''),
            "customer_email": payment_request.customer_email or booking.get('customer_email', ''),
            "payment_status": "pending",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.payment_transactions.insert_one(payment_transaction)
        
        logging.info(f"Created Stripe checkout session {session.session_id} for booking {payment_request.booking_id}")
        
        return {
            "checkout_url": session.url,
            "session_id": session.session_id
        }
    except Exception as e:
        logging.error(f"Error creating checkout session: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/payments/status/{session_id}")
async def get_payment_status(request: Request, session_id: str):
    """Get the status of a payment session"""
    global stripe_checkout
    
    if not STRIPE_API_KEY:
        raise HTTPException(status_code=500, detail="Stripe is not configured")
    
    try:
        # Initialize Stripe checkout if not already done
        host_url = str(request.base_url).rstrip('/')
        webhook_url = f"{host_url}/api/webhook/stripe"
        stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
        
        # Get checkout status from Stripe
        status: CheckoutStatusResponse = await stripe_checkout.get_checkout_status(session_id)
        
        # Update payment transaction in database
        update_data = {
            "payment_status": status.payment_status,
            "status": status.status,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        # Find and update the transaction
        transaction = await db.payment_transactions.find_one({"session_id": session_id})
        if transaction:
            await db.payment_transactions.update_one(
                {"session_id": session_id},
                {"$set": update_data}
            )
            
            # If payment successful, update booking payment status
            if status.payment_status == "paid":
                await db.bookings.update_one(
                    {"id": transaction["booking_id"]},
                    {"$set": {
                        "payment_status": "paid",
                        "payment_session_id": session_id,
                        "payment_date": datetime.now(timezone.utc).isoformat()
                    }}
                )
                logging.info(f"Payment successful for booking {transaction['booking_id']}")
        
        return {
            "status": status.status,
            "payment_status": status.payment_status,
            "amount_total": status.amount_total,
            "currency": status.currency,
            "metadata": status.metadata
        }
    except Exception as e:
        logging.error(f"Error getting payment status: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    """Handle Stripe webhook events"""
    global stripe_checkout
    
    if not STRIPE_API_KEY:
        raise HTTPException(status_code=500, detail="Stripe is not configured")
    
    try:
        # Initialize Stripe checkout if not already done
        host_url = str(request.base_url).rstrip('/')
        webhook_url = f"{host_url}/api/webhook/stripe"
        stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
        
        # Get the webhook body and signature
        body = await request.body()
        signature = request.headers.get("Stripe-Signature")
        
        # Handle the webhook
        webhook_response = await stripe_checkout.handle_webhook(body, signature)
        
        logging.info(f"Received Stripe webhook: {webhook_response.event_type} for session {webhook_response.session_id}")
        
        # Update payment transaction if exists
        if webhook_response.session_id:
            transaction = await db.payment_transactions.find_one({"session_id": webhook_response.session_id})
            if transaction:
                await db.payment_transactions.update_one(
                    {"session_id": webhook_response.session_id},
                    {"$set": {
                        "payment_status": webhook_response.payment_status,
                        "event_type": webhook_response.event_type,
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    }}
                )
                
                # Update booking if payment completed
                if webhook_response.payment_status == "paid":
                    await db.bookings.update_one(
                        {"id": transaction["booking_id"]},
                        {"$set": {
                            "payment_status": "paid",
                            "payment_session_id": webhook_response.session_id,
                            "payment_date": datetime.now(timezone.utc).isoformat()
                        }}
                    )
        
        return {"status": "ok"}
    except Exception as e:
        logging.error(f"Error handling Stripe webhook: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ========== ADMIN USER ENDPOINTS ==========
@api_router.post("/auth/login")
async def admin_login(login_request: AdminLoginRequest):
    """Admin user login"""
    email = login_request.email.lower().strip()
    user = await db.admin_users.find_one({"email": email}, {"_id": 0})
    
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    if not user.get("is_active", True):
        raise HTTPException(status_code=401, detail="Account is disabled")
    
    password_hash = hash_password(login_request.password)
    if user.get("password_hash") != password_hash:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    # Update last login
    await db.admin_users.update_one(
        {"id": user["id"]},
        {"$set": {"last_login": datetime.now(timezone.utc).isoformat()}}
    )
    
    # Create token
    token = create_admin_token(user["id"], user["email"], user["role"])
    
    # Return user info without password
    user_response = {k: v for k, v in user.items() if k != "password_hash"}
    
    return {"token": token, "user": user_response}

@api_router.get("/auth/me")
async def get_current_user(current_user: dict = Depends(get_current_admin)):
    """Get current admin user profile"""
    return {k: v for k, v in current_user.items() if k != "password_hash"}

@api_router.put("/auth/profile")
async def update_profile(
    update_data: AdminUserUpdate,
    current_user: dict = Depends(get_current_admin)
):
    """Update current user's profile"""
    updates = {k: v for k, v in update_data.model_dump().items() if v is not None}
    
    # Handle password update
    if "password" in updates and updates["password"]:
        updates["password_hash"] = hash_password(updates["password"])
        del updates["password"]
    
    # Can't change own role unless super_admin
    if "role" in updates and current_user.get("role") != "super_admin":
        del updates["role"]
    
    if updates:
        await db.admin_users.update_one(
            {"id": current_user["id"]},
            {"$set": updates}
        )
    
    updated = await db.admin_users.find_one({"id": current_user["id"]}, {"_id": 0})
    return {k: v for k, v in updated.items() if k != "password_hash"}

@api_router.get("/auth/users")
async def list_admin_users(current_user: dict = Depends(get_current_admin)):
    """List all admin users (admin only)"""
    if current_user.get("role") not in ["super_admin", "admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    users = await db.admin_users.find({}, {"_id": 0, "password_hash": 0}).to_list(1000)
    return users

@api_router.post("/auth/users")
async def create_admin_user(
    user_data: AdminUserCreate,
    current_user: dict = Depends(get_current_admin)
):
    """Create new admin user (super_admin only)"""
    if current_user.get("role") != "super_admin":
        raise HTTPException(status_code=403, detail="Super admin access required")
    
    # Check if email exists
    email = user_data.email.lower().strip()
    existing = await db.admin_users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create user
    user_dict = user_data.model_dump()
    password = user_dict.pop("password")
    user_dict["email"] = email
    user_dict["password_hash"] = hash_password(password)
    
    user_obj = AdminUser(**user_dict)
    doc = user_obj.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    
    await db.admin_users.insert_one(doc)
    
    return {k: v for k, v in doc.items() if k not in ["password_hash", "_id"]}

@api_router.put("/auth/users/{user_id}")
async def update_admin_user(
    user_id: str,
    update_data: AdminUserUpdate,
    current_user: dict = Depends(get_current_admin)
):
    """Update admin user (super_admin only)"""
    if current_user.get("role") != "super_admin":
        raise HTTPException(status_code=403, detail="Super admin access required")
    
    existing = await db.admin_users.find_one({"id": user_id})
    if not existing:
        raise HTTPException(status_code=404, detail="User not found")
    
    updates = {k: v for k, v in update_data.model_dump().items() if v is not None}
    
    # Handle password update
    if "password" in updates and updates["password"]:
        updates["password_hash"] = hash_password(updates["password"])
        del updates["password"]
    
    if updates:
        await db.admin_users.update_one({"id": user_id}, {"$set": updates})
    
    updated = await db.admin_users.find_one({"id": user_id}, {"_id": 0})
    return {k: v for k, v in updated.items() if k != "password_hash"}

@api_router.delete("/auth/users/{user_id}")
async def delete_admin_user(
    user_id: str,
    current_user: dict = Depends(get_current_admin)
):
    """Delete admin user (super_admin only)"""
    if current_user.get("role") != "super_admin":
        raise HTTPException(status_code=403, detail="Super admin access required")
    
    # Can't delete yourself
    if user_id == current_user["id"]:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    
    result = await db.admin_users.delete_one({"id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"message": "User deleted successfully"}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("startup")
async def migrate_booking_ids():
    """Migrate existing bookings to have booking_id if they don't have one"""
    bookings_without_id = await db.bookings.find(
        {"$or": [{"booking_id": {"$exists": False}}, {"booking_id": None}]}
    ).to_list(1000)
    
    if bookings_without_id:
        logger.info(f"Migrating {len(bookings_without_id)} bookings to add booking_id")
        for booking in bookings_without_id:
            new_booking_id = await generate_booking_id()
            await db.bookings.update_one(
                {"id": booking["id"]},
                {"$set": {"booking_id": new_booking_id}}
            )
            logger.info(f"Assigned {new_booking_id} to booking {booking['id']}")

@app.on_event("startup")
async def create_default_admin():
    """Create default admin user if none exists"""
    admin_count = await db.admin_users.count_documents({})
    if admin_count == 0:
        logger.info("Creating default admin user...")
        default_admin = {
            "id": str(uuid.uuid4()),
            "email": "admin@cjstravel.uk",
            "name": "Admin",
            "role": "super_admin",
            "is_active": True,
            "password_hash": hash_password("admin123"),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.admin_users.insert_one(default_admin)
        logger.info(f"Default admin created: admin@cjstravel.uk / admin123")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
