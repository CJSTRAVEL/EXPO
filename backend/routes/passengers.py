# Passenger Portal Routes
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone, timedelta
import uuid

from .shared import (
    db, hash_password, create_token, get_current_passenger, JWT_SECRET, JWT_ALGORITHM
)

router = APIRouter(tags=["Passenger Portal"])


# ========== MODELS ==========
class PassengerRegister(BaseModel):
    name: str
    phone: str
    email: Optional[str] = None
    password: str

class PassengerLogin(BaseModel):
    phone: str
    password: str

class PassengerResponse(BaseModel):
    id: str
    name: str
    phone: str
    email: Optional[str] = None
    token: str

class BookingRequestCreate(BaseModel):
    pickup_location: str
    dropoff_location: str
    pickup_datetime: str
    passenger_count: int = 1
    luggage_count: int = 0
    vehicle_type_id: Optional[str] = None
    vehicle_type_name: Optional[str] = None
    notes: Optional[str] = None
    flight_number: Optional[str] = None
    lead_passenger_name: Optional[str] = None
    lead_passenger_phone: Optional[str] = None
    lead_passenger_email: Optional[str] = None


# ========== AUTHENTICATION ==========
@router.post("/passenger/register", response_model=PassengerResponse)
async def register_passenger(data: PassengerRegister):
    """Register a new passenger"""
    existing = await db.passengers.find_one({"phone": data.phone})
    if existing:
        raise HTTPException(status_code=400, detail="Phone number already registered")
    
    passenger = {
        "id": str(uuid.uuid4()),
        "name": data.name,
        "phone": data.phone,
        "email": data.email,
        "password_hash": hash_password(data.password),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.passengers.insert_one(passenger)
    
    token = create_token(passenger["id"], passenger["phone"])
    
    return PassengerResponse(
        id=passenger["id"],
        name=passenger["name"],
        phone=passenger["phone"],
        email=passenger.get("email"),
        token=token
    )


@router.post("/passenger/login", response_model=PassengerResponse)
async def login_passenger(data: PassengerLogin):
    """Login a passenger"""
    passenger = await db.passengers.find_one({"phone": data.phone})
    
    if not passenger:
        raise HTTPException(status_code=401, detail="Invalid phone number or password")
    
    if passenger.get("password_hash") != hash_password(data.password):
        raise HTTPException(status_code=401, detail="Invalid phone number or password")
    
    token = create_token(passenger["id"], passenger["phone"])
    
    return PassengerResponse(
        id=passenger["id"],
        name=passenger["name"],
        phone=passenger["phone"],
        email=passenger.get("email"),
        token=token
    )


@router.get("/passenger/me")
async def get_passenger_profile(passenger: dict = Depends(get_current_passenger)):
    """Get current passenger profile"""
    return {
        "id": passenger["id"],
        "name": passenger["name"],
        "phone": passenger["phone"],
        "email": passenger.get("email")
    }


@router.get("/passenger/bookings")
async def get_passenger_bookings(passenger: dict = Depends(get_current_passenger)):
    """Get passenger's bookings"""
    phone = passenger.get("phone", "")
    phone_variations = [phone]
    if phone.startswith("+44"):
        phone_variations.append("0" + phone[3:])
    elif phone.startswith("0"):
        phone_variations.append("+44" + phone[1:])
    
    bookings = await db.bookings.find(
        {"$or": [
            {"lead_passenger_phone": {"$in": phone_variations}},
            {"passenger_id": passenger["id"]}
        ]},
        {"_id": 0}
    ).sort("booking_datetime", -1).to_list(100)
    
    return bookings


# ========== BOOKING REQUESTS ==========
@router.post("/passenger/booking-requests")
async def create_booking_request(request: BookingRequestCreate, passenger: dict = Depends(get_current_passenger)):
    """Create a new booking request"""
    booking_request = {
        "id": str(uuid.uuid4()),
        "passenger_id": passenger["id"],
        "passenger_name": passenger.get("name"),
        "passenger_phone": passenger.get("phone"),
        "passenger_email": passenger.get("email"),
        "pickup_location": request.pickup_location,
        "dropoff_location": request.dropoff_location,
        "pickup_datetime": request.pickup_datetime,
        "passenger_count": request.passenger_count,
        "luggage_count": request.luggage_count,
        "vehicle_type_id": request.vehicle_type_id,
        "vehicle_type_name": request.vehicle_type_name,
        "notes": request.notes,
        "flight_number": request.flight_number,
        "lead_passenger_name": request.lead_passenger_name or passenger.get("name"),
        "lead_passenger_phone": request.lead_passenger_phone or passenger.get("phone"),
        "lead_passenger_email": request.lead_passenger_email or passenger.get("email"),
        "status": "pending",
        "account_type": "passenger",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.booking_requests.insert_one(booking_request)
    booking_request.pop("_id", None)
    
    return booking_request


@router.get("/passenger/booking-requests")
async def get_passenger_booking_requests(passenger: dict = Depends(get_current_passenger)):
    """Get passenger's booking requests"""
    requests = await db.booking_requests.find(
        {"passenger_id": passenger["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    return requests
