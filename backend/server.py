from fastapi import FastAPI, APIRouter, HTTPException, BackgroundTasks, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import StreamingResponse, HTMLResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import io
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
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

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# JWT Secret Key
JWT_SECRET = os.environ.get('JWT_SECRET', 'cjs-executive-travel-secret-key-2026')
JWT_ALGORITHM = "HS256"

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Getaddress.io API Key
GETADDRESS_API_KEY = os.environ.get('GETADDRESS_API_KEY', 'Xl-6H0F3wUiAL_iNCL-_Qw49750')

# Vonage SMS Configuration
VONAGE_API_KEY = os.environ.get('VONAGE_API_KEY')
VONAGE_API_SECRET = os.environ.get('VONAGE_API_SECRET')
VONAGE_FROM_NUMBER = os.environ.get('VONAGE_FROM_NUMBER', 'HireFleet')

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

def verify_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

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

class BookingStatus(str, Enum):
    PENDING = "pending"
    ASSIGNED = "assigned"
    IN_PROGRESS = "in_progress"
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
    vehicle_type: str
    vehicle_number: str
    status: DriverStatus = DriverStatus.AVAILABLE

class DriverCreate(DriverBase):
    pass

class DriverUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    vehicle_type: Optional[str] = None
    vehicle_number: Optional[str] = None
    status: Optional[DriverStatus] = None

class Driver(DriverBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Booking Models
class BookingBase(BaseModel):
    first_name: str
    last_name: str
    customer_phone: str
    pickup_location: str
    dropoff_location: str
    booking_datetime: datetime
    notes: Optional[str] = None
    fare: Optional[float] = None
    client_id: Optional[str] = None  # Link to client account for invoicing

class BookingCreate(BookingBase):
    distance_miles: Optional[float] = None
    duration_minutes: Optional[int] = None

class BookingUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    customer_phone: Optional[str] = None
    pickup_location: Optional[str] = None
    dropoff_location: Optional[str] = None
    booking_datetime: Optional[datetime] = None
    notes: Optional[str] = None
    fare: Optional[float] = None
    status: Optional[BookingStatus] = None
    driver_id: Optional[str] = None
    distance_miles: Optional[float] = None
    duration_minutes: Optional[int] = None
    client_id: Optional[str] = None

# Response model that supports both old (customer_name) and new (first_name/last_name) formats
class BookingResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    booking_id: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    customer_name: Optional[str] = None  # For backward compatibility
    customer_phone: str
    pickup_location: str
    dropoff_location: str
    booking_datetime: datetime
    notes: Optional[str] = None
    fare: Optional[float] = None
    status: BookingStatus = BookingStatus.PENDING
    driver_id: Optional[str] = None
    created_at: datetime
    sms_sent: Optional[bool] = False
    distance_miles: Optional[float] = None
    duration_minutes: Optional[int] = None
    client_id: Optional[str] = None

class Booking(BookingBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    booking_id: Optional[str] = None  # Readable booking ID like CJ-001
    status: BookingStatus = BookingStatus.PENDING
    driver_id: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    sms_sent: Optional[bool] = False
    distance_miles: Optional[float] = None
    duration_minutes: Optional[int] = None
    customer_name: Optional[str] = None  # Computed from first_name + last_name

# Passenger Authentication Models
class PassengerRegister(BaseModel):
    name: str
    phone: str
    password: str

class PassengerLogin(BaseModel):
    phone: str
    password: str

class Passenger(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    phone: str
    password_hash: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class PassengerResponse(BaseModel):
    id: str
    name: str
    phone: str
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

# Google Maps API Key
GOOGLE_MAPS_API_KEY = "AIzaSyBSL4bF8eGeiABUOK0GM8UoWBzqtUVfMIs"

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
                    "summary": route.get("summary", "")
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

# ========== DRIVER ENDPOINTS ==========
@api_router.post("/drivers", response_model=Driver)
async def create_driver(driver: DriverCreate):
    driver_obj = Driver(**driver.model_dump())
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
        
        # Generate booking details link - use short URL if available
        app_url = os.environ.get('APP_URL', 'https://booking-master-14.preview.emergentagent.com')
        if short_booking_id:
            booking_link = f"{app_url}/b/{short_booking_id}"
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
        token=token
    )

@api_router.get("/passenger/me")
async def get_passenger_profile(passenger: dict = Depends(get_current_passenger)):
    """Get current passenger profile"""
    return {
        "id": passenger['id'],
        "name": passenger['name'],
        "phone": passenger['phone']
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
    
    booking_obj = Booking(**booking.model_dump())
    booking_obj.booking_id = readable_booking_id
    
    doc = booking_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    doc['booking_datetime'] = doc['booking_datetime'].isoformat()
    doc['sms_sent'] = False
    # Store full customer_name for backward compatibility
    doc['customer_name'] = f"{booking.first_name} {booking.last_name}"
    await db.bookings.insert_one(doc)
    
    # Send SMS in background with journey details and short booking ID
    full_name = f"{booking.first_name} {booking.last_name}"
    background_tasks.add_task(
        send_sms_and_update_booking,
        booking_obj.id,
        booking.customer_phone,
        full_name,
        booking.pickup_location,
        booking.dropoff_location,
        doc.get('distance_miles'),
        doc.get('duration_minutes'),
        doc['booking_datetime'],
        readable_booking_id  # Pass the short booking ID
    )
    
    # Return response with customer_name included
    response_data = booking_obj.model_dump()
    response_data['customer_name'] = doc['customer_name']
    return response_data

async def send_sms_and_update_booking(booking_id: str, phone: str, name: str,
                                       pickup: str = None, dropoff: str = None,
                                       distance_miles: float = None, duration_minutes: int = None,
                                       booking_datetime: str = None, short_booking_id: str = None):
    """Background task to send SMS and update booking record"""
    success, message = send_booking_sms(
        phone, name, booking_id, 
        pickup, dropoff, 
        distance_miles, duration_minutes, 
        booking_datetime,
        short_booking_id  # Use short URL
    )
    await db.bookings.update_one(
        {"id": booking_id},
        {"$set": {"sms_sent": success, "sms_message": message}}
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
@app.get("/b/{short_id}", response_class=HTMLResponse)
async def booking_preview_page(short_id: str):
    """
    Server-Side Rendered booking preview page with Open Graph meta tags.
    This allows SMS apps and social media to show rich link previews.
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
    <meta property="og:url" content="{app_url}/b/{short_id}">
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
    
    if update_data:
        await db.bookings.update_one({"id": booking_id}, {"$set": update_data})
    
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
    
    await db.bookings.update_one(
        {"id": booking_id},
        {"$set": {"driver_id": driver_id, "status": BookingStatus.ASSIGNED}}
    )
    await db.drivers.update_one({"id": driver_id}, {"$set": {"status": DriverStatus.BUSY}})
    
    updated = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if isinstance(updated.get('created_at'), str):
        updated['created_at'] = datetime.fromisoformat(updated['created_at'])
    if isinstance(updated.get('booking_datetime'), str):
        updated['booking_datetime'] = datetime.fromisoformat(updated['booking_datetime'])
    return updated

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

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
