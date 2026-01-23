# Driver Routes
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timezone, timedelta
import uuid
import jwt

from .shared import (
    db, hash_password, get_current_driver, DriverStatus,
    JWT_SECRET, JWT_ALGORITHM
)

router = APIRouter(tags=["Drivers"])


# ========== MODELS ==========
class DriverBase(BaseModel):
    name: str
    email: str
    phone: str
    license_number: Optional[str] = None
    license_expiry: Optional[str] = None
    license_type: Optional[str] = None
    dbs_number: Optional[str] = None
    dbs_expiry: Optional[str] = None
    national_insurance: Optional[str] = None
    address: Optional[str] = None
    emergency_contact: Optional[str] = None
    emergency_phone: Optional[str] = None
    notes: Optional[str] = None
    taxi_badge_number: Optional[str] = None
    psv_badge_number: Optional[str] = None

class DriverCreate(DriverBase):
    password: str

class DriverUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    license_number: Optional[str] = None
    license_expiry: Optional[str] = None
    license_type: Optional[str] = None
    dbs_number: Optional[str] = None
    dbs_expiry: Optional[str] = None
    national_insurance: Optional[str] = None
    address: Optional[str] = None
    emergency_contact: Optional[str] = None
    emergency_phone: Optional[str] = None
    notes: Optional[str] = None
    taxi_badge_number: Optional[str] = None
    psv_badge_number: Optional[str] = None
    password: Optional[str] = None

class Driver(BaseModel):
    id: str
    name: str
    email: str
    phone: str
    license_number: Optional[str] = None
    license_expiry: Optional[str] = None
    license_type: Optional[str] = None
    dbs_number: Optional[str] = None
    dbs_expiry: Optional[str] = None
    national_insurance: Optional[str] = None
    address: Optional[str] = None
    emergency_contact: Optional[str] = None
    emergency_phone: Optional[str] = None
    notes: Optional[str] = None
    status: DriverStatus = DriverStatus.OFFLINE
    current_vehicle_id: Optional[str] = None
    current_location: Optional[dict] = None
    last_location_update: Optional[str] = None
    created_at: str
    taxi_badge_number: Optional[str] = None
    psv_badge_number: Optional[str] = None


class DriverLogin(BaseModel):
    email: str
    password: str

class DriverLocationUpdate(BaseModel):
    latitude: float
    longitude: float

class DriverAppStatus(BaseModel):
    is_online: Optional[bool] = None
    on_break: Optional[bool] = None
    selected_vehicle_id: Optional[str] = None
    push_token: Optional[str] = None

class DriverPasswordChange(BaseModel):
    current_password: str
    new_password: str


# ========== ADMIN DRIVER CRUD ==========
@router.post("/drivers", response_model=Driver)
async def create_driver(driver: DriverCreate):
    driver_dict = driver.model_dump()
    driver_dict["id"] = str(uuid.uuid4())
    driver_dict["status"] = DriverStatus.OFFLINE.value
    driver_dict["current_vehicle_id"] = None
    driver_dict["current_location"] = None
    driver_dict["last_location_update"] = None
    driver_dict["created_at"] = datetime.now(timezone.utc).isoformat()
    driver_dict["password_hash"] = hash_password(driver_dict.pop("password"))
    
    await db.drivers.insert_one(driver_dict)
    driver_dict.pop("_id", None)
    driver_dict.pop("password_hash", None)
    return driver_dict


@router.get("/drivers", response_model=List[Driver])
async def get_drivers():
    drivers = await db.drivers.find({}, {"_id": 0, "password_hash": 0}).to_list(1000)
    return drivers


@router.get("/drivers/{driver_id}", response_model=Driver)
async def get_driver(driver_id: str):
    driver = await db.drivers.find_one({"id": driver_id}, {"_id": 0, "password_hash": 0})
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")
    return driver


@router.put("/drivers/{driver_id}", response_model=Driver)
async def update_driver(driver_id: str, driver_update: DriverUpdate):
    update_data = {k: v for k, v in driver_update.model_dump().items() if v is not None}
    
    if "password" in update_data:
        update_data["password_hash"] = hash_password(update_data.pop("password"))
    
    if update_data:
        await db.drivers.update_one({"id": driver_id}, {"$set": update_data})
    
    driver = await db.drivers.find_one({"id": driver_id}, {"_id": 0, "password_hash": 0})
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")
    return driver


@router.delete("/drivers/{driver_id}")
async def delete_driver(driver_id: str):
    result = await db.drivers.delete_one({"id": driver_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Driver not found")
    return {"message": "Driver deleted"}


# ========== DRIVER MOBILE APP ENDPOINTS ==========
@router.post("/driver/login")
async def driver_login(login_data: DriverLogin):
    """Driver login for mobile app"""
    driver = await db.drivers.find_one({"email": login_data.email})
    
    if not driver:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    password_hash = hash_password(login_data.password)
    if driver.get("password_hash") != password_hash:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    token = jwt.encode({
        "sub": driver["id"],
        "email": driver["email"],
        "type": "driver",
        "exp": datetime.now(timezone.utc) + timedelta(days=30)
    }, JWT_SECRET, algorithm=JWT_ALGORITHM)
    
    driver.pop("_id", None)
    driver.pop("password_hash", None)
    
    return {"token": token, "driver": driver}


@router.get("/driver/profile")
async def get_driver_profile(driver: dict = Depends(get_current_driver)):
    """Get driver profile with vehicle info"""
    vehicle = None
    if driver.get("current_vehicle_id"):
        vehicle = await db.vehicles.find_one(
            {"id": driver["current_vehicle_id"]},
            {"_id": 0}
        )
    
    driver.pop("password_hash", None)
    return {"driver": driver, "vehicle": vehicle}


@router.put("/driver/status")
async def update_driver_status(status_update: DriverAppStatus, driver: dict = Depends(get_current_driver)):
    """Update driver online/break status"""
    update_data = {}
    
    if status_update.is_online is not None:
        update_data["is_online"] = status_update.is_online
        if status_update.is_online:
            update_data["status"] = DriverStatus.AVAILABLE.value
        else:
            update_data["status"] = DriverStatus.OFFLINE.value
            # When going offline, release the vehicle
            update_data["selected_vehicle_id"] = None
            update_data["current_vehicle_id"] = None
            # Also update the vehicle to remove the driver assignment
            current_vehicle = driver.get("selected_vehicle_id") or driver.get("current_vehicle_id")
            if current_vehicle:
                await db.vehicles.update_one(
                    {"id": current_vehicle},
                    {"$set": {"current_driver_id": None}}
                )
    
    if status_update.on_break is not None:
        update_data["on_break"] = status_update.on_break
        if status_update.on_break:
            update_data["status"] = DriverStatus.BREAK.value
    
    if status_update.selected_vehicle_id is not None:
        update_data["selected_vehicle_id"] = status_update.selected_vehicle_id
        update_data["current_vehicle_id"] = status_update.selected_vehicle_id
    
    if status_update.push_token is not None:
        update_data["push_token"] = status_update.push_token
    
    if update_data:
        await db.drivers.update_one({"id": driver["id"]}, {"$set": update_data})
    
    updated_driver = await db.drivers.find_one({"id": driver["id"]}, {"_id": 0, "password_hash": 0})
    return {"message": "Status updated", "driver": updated_driver}


@router.put("/driver/location")
async def update_driver_location(location: DriverLocationUpdate, driver: dict = Depends(get_current_driver)):
    """Update driver's current location"""
    await db.drivers.update_one(
        {"id": driver["id"]},
        {"$set": {
            "current_location": {
                "latitude": location.latitude,
                "longitude": location.longitude
            },
            "last_location_update": datetime.now(timezone.utc).isoformat()
        }}
    )
    return {"message": "Location updated"}


@router.put("/driver/change-password")
async def change_driver_password(password_data: DriverPasswordChange, driver: dict = Depends(get_current_driver)):
    """Change driver's password"""
    if driver.get("password_hash", "") != hash_password(password_data.current_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    
    new_hash = hash_password(password_data.new_password)
    await db.drivers.update_one(
        {"id": driver["id"]},
        {"$set": {"password_hash": new_hash}}
    )
    
    return {"message": "Password changed successfully"}


@router.post("/driver/select-vehicle")
async def select_vehicle(vehicle_id: str, driver: dict = Depends(get_current_driver)):
    """Select a vehicle for the driver"""
    vehicle = await db.vehicles.find_one({"id": vehicle_id}, {"_id": 0})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    existing = await db.drivers.find_one({
        "current_vehicle_id": vehicle_id,
        "id": {"$ne": driver["id"]}
    })
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Vehicle is already assigned to {existing['name']}"
        )
    
    await db.drivers.update_one(
        {"id": driver["id"]},
        {"$set": {"current_vehicle_id": vehicle_id}}
    )
    
    updated_driver = await db.drivers.find_one({"id": driver["id"]}, {"_id": 0, "password_hash": 0})
    return {"driver": updated_driver, "vehicle": vehicle}


@router.post("/driver/release-vehicle")
async def release_vehicle(driver: dict = Depends(get_current_driver)):
    """Release the currently selected vehicle"""
    await db.drivers.update_one(
        {"id": driver["id"]},
        {"$set": {"current_vehicle_id": None}}
    )
    
    updated_driver = await db.drivers.find_one({"id": driver["id"]}, {"_id": 0, "password_hash": 0})
    return {"driver": updated_driver, "vehicle": None}


@router.get("/driver/available-vehicles")
async def get_available_vehicles(driver: dict = Depends(get_current_driver)):
    """Get all vehicles available for selection"""
    vehicles = await db.vehicles.find({}, {"_id": 0}).to_list(100)
    
    assigned_vehicle_ids = set()
    drivers = await db.drivers.find(
        {"current_vehicle_id": {"$ne": None}},
        {"current_vehicle_id": 1, "name": 1, "id": 1}
    ).to_list(100)
    
    for d in drivers:
        if d.get("current_vehicle_id") and d["id"] != driver["id"]:
            assigned_vehicle_ids.add(d["current_vehicle_id"])
    
    for vehicle in vehicles:
        vehicle["is_available"] = vehicle["id"] not in assigned_vehicle_ids
        if vehicle["id"] in assigned_vehicle_ids:
            assigning_driver = next(
                (d for d in drivers if d.get("current_vehicle_id") == vehicle["id"]),
                None
            )
            vehicle["assigned_to"] = assigning_driver["name"] if assigning_driver else None
    
    return vehicles


@router.get("/driver/stats")
async def get_driver_stats(driver: dict = Depends(get_current_driver)):
    """Get driver statistics"""
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today - timedelta(days=today.weekday())
    month_start = today.replace(day=1)
    
    all_bookings = await db.bookings.find(
        {"driver_id": driver["id"]},
        {"_id": 0}
    ).to_list(1000)
    
    today_bookings = [b for b in all_bookings if b.get("booking_datetime", "").startswith(today.strftime("%Y-%m-%d"))]
    week_bookings = [b for b in all_bookings if b.get("booking_datetime", "") >= week_start.isoformat()]
    month_bookings = [b for b in all_bookings if b.get("booking_datetime", "") >= month_start.isoformat()]
    
    completed_today = len([b for b in today_bookings if b.get("status") == "completed"])
    completed_week = len([b for b in week_bookings if b.get("status") == "completed"])
    completed_month = len([b for b in month_bookings if b.get("status") == "completed"])
    
    return {
        "today": {
            "total": len(today_bookings),
            "completed": completed_today,
            "pending": len([b for b in today_bookings if b.get("status") in ["pending", "confirmed", "assigned"]])
        },
        "week": {
            "total": len(week_bookings),
            "completed": completed_week
        },
        "month": {
            "total": len(month_bookings),
            "completed": completed_month
        },
        "all_time": {
            "total": len(all_bookings),
            "completed": len([b for b in all_bookings if b.get("status") == "completed"])
        }
    }


@router.get("/driver/earnings")
async def get_driver_earnings(driver: dict = Depends(get_current_driver)):
    """Get driver earnings breakdown"""
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today - timedelta(days=today.weekday())
    month_start = today.replace(day=1)
    
    completed_bookings = await db.bookings.find(
        {"driver_id": driver["id"], "status": "completed"},
        {"_id": 0}
    ).to_list(1000)
    
    def calculate_earnings(bookings):
        total = sum(b.get("fare", 0) or 0 for b in bookings)
        return round(total, 2)
    
    today_bookings = [b for b in completed_bookings if b.get("completed_at", "").startswith(today.strftime("%Y-%m-%d"))]
    week_bookings = [b for b in completed_bookings if b.get("completed_at", "") >= week_start.isoformat()]
    month_bookings = [b for b in completed_bookings if b.get("completed_at", "") >= month_start.isoformat()]
    
    return {
        "today": {"amount": calculate_earnings(today_bookings), "jobs": len(today_bookings)},
        "week": {"amount": calculate_earnings(week_bookings), "jobs": len(week_bookings)},
        "month": {"amount": calculate_earnings(month_bookings), "jobs": len(month_bookings)},
        "all_time": {"amount": calculate_earnings(completed_bookings), "jobs": len(completed_bookings)}
    }


@router.get("/driver/history")
async def get_driver_history(driver: dict = Depends(get_current_driver)):
    """Get driver's completed booking history"""
    bookings = await db.bookings.find(
        {"driver_id": driver["id"], "status": "completed"},
        {"_id": 0}
    ).sort("completed_at", -1).to_list(100)
    
    return bookings


@router.get("/driver/document-notifications")
async def check_document_notifications(driver: dict = Depends(get_current_driver)):
    """Check for document expiry notifications"""
    notifications = []
    today = datetime.now(timezone.utc)
    
    docs_to_check = [
        ("license_expiry", "Driving License"),
        ("dbs_expiry", "DBS Certificate")
    ]
    
    for field, doc_name in docs_to_check:
        expiry_str = driver.get(field)
        if expiry_str:
            try:
                expiry_date = datetime.fromisoformat(expiry_str.replace("Z", "+00:00"))
                days_until = (expiry_date - today).days
                
                if days_until <= 0:
                    notifications.append({
                        "type": "expired",
                        "document": doc_name,
                        "message": f"Your {doc_name} has expired",
                        "severity": "critical"
                    })
                elif days_until <= 30:
                    notifications.append({
                        "type": "expiring_soon",
                        "document": doc_name,
                        "message": f"Your {doc_name} expires in {days_until} days",
                        "severity": "warning" if days_until > 7 else "critical"
                    })
            except Exception:
                pass
    
    return notifications
