from fastapi import FastAPI, APIRouter, HTTPException, BackgroundTasks, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
from enum import Enum
import httpx
import hashlib
import jwt

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
    customer_name: str
    customer_phone: str
    pickup_location: str
    dropoff_location: str
    booking_datetime: datetime
    notes: Optional[str] = None
    fare: Optional[float] = None

class BookingCreate(BookingBase):
    distance_miles: Optional[float] = None
    duration_minutes: Optional[int] = None

class BookingUpdate(BaseModel):
    customer_name: Optional[str] = None
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
        app_url = os.environ.get('APP_URL', 'https://cabmanage-1.preview.emergentagent.com')
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

# ========== BOOKING ENDPOINTS ==========
@api_router.post("/bookings", response_model=Booking)
async def create_booking(booking: BookingCreate, background_tasks: BackgroundTasks):
    # Generate readable booking ID
    readable_booking_id = await generate_booking_id()
    
    booking_obj = Booking(**booking.model_dump())
    booking_obj.booking_id = readable_booking_id
    
    doc = booking_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    doc['booking_datetime'] = doc['booking_datetime'].isoformat()
    doc['sms_sent'] = False
    await db.bookings.insert_one(doc)
    
    # Send SMS in background with journey details and short booking ID
    background_tasks.add_task(
        send_sms_and_update_booking,
        booking_obj.id,
        booking.customer_phone,
        booking.customer_name,
        booking.pickup_location,
        booking.dropoff_location,
        doc.get('distance_miles'),
        doc.get('duration_minutes'),
        doc['booking_datetime'],
        readable_booking_id  # Pass the short booking ID
    )
    
    return booking_obj

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

@api_router.get("/bookings", response_model=List[Booking])
async def get_bookings():
    bookings = await db.bookings.find({}, {"_id": 0}).to_list(1000)
    for booking in bookings:
        if isinstance(booking.get('created_at'), str):
            booking['created_at'] = datetime.fromisoformat(booking['created_at'])
        if isinstance(booking.get('booking_datetime'), str):
            booking['booking_datetime'] = datetime.fromisoformat(booking['booking_datetime'])
    return bookings

@api_router.get("/bookings/{booking_id}", response_model=Booking)
async def get_booking(booking_id: str):
    booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if isinstance(booking.get('created_at'), str):
        booking['created_at'] = datetime.fromisoformat(booking['created_at'])
    if isinstance(booking.get('booking_datetime'), str):
        booking['booking_datetime'] = datetime.fromisoformat(booking['booking_datetime'])
    return booking

@api_router.get("/b/{short_id}", response_model=Booking)
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

@api_router.put("/bookings/{booking_id}", response_model=Booking)
async def update_booking(booking_id: str, booking_update: BookingUpdate):
    existing = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    update_data = {k: v for k, v in booking_update.model_dump().items() if v is not None}
    if 'booking_datetime' in update_data and isinstance(update_data['booking_datetime'], datetime):
        update_data['booking_datetime'] = update_data['booking_datetime'].isoformat()
    
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

@api_router.post("/bookings/{booking_id}/assign/{driver_id}", response_model=Booking)
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
    
    # Send SMS with short booking ID
    success, message = send_booking_sms(
        customer_phone=booking['customer_phone'],
        customer_name=booking['customer_name'],
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
