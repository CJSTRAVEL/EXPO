# Vehicle Routes
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timezone
import uuid

from .shared import db

router = APIRouter(tags=["Vehicles"])


# ========== MODELS ==========
class VehicleTypeBase(BaseModel):
    name: str
    description: Optional[str] = None
    capacity: int
    luggage_capacity: Optional[int] = None
    base_rate: Optional[float] = None

class VehicleTypeCreate(VehicleTypeBase):
    pass

class VehicleTypeUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    capacity: Optional[int] = None
    luggage_capacity: Optional[int] = None
    base_rate: Optional[float] = None

class VehicleType(VehicleTypeBase):
    id: str
    created_at: str


class VehicleBase(BaseModel):
    registration: str
    make: str
    model: str
    year: Optional[int] = None
    color: Optional[str] = None
    vehicle_type_id: Optional[str] = None
    vehicle_type_name: Optional[str] = None
    mot_expiry: Optional[str] = None
    insurance_expiry: Optional[str] = None
    tax_expiry: Optional[str] = None
    status: str = "active"
    notes: Optional[str] = None

class VehicleCreate(VehicleBase):
    pass

class VehicleUpdate(BaseModel):
    registration: Optional[str] = None
    make: Optional[str] = None
    model: Optional[str] = None
    year: Optional[int] = None
    color: Optional[str] = None
    vehicle_type_id: Optional[str] = None
    vehicle_type_name: Optional[str] = None
    mot_expiry: Optional[str] = None
    insurance_expiry: Optional[str] = None
    tax_expiry: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None

class Vehicle(VehicleBase):
    id: str
    created_at: str


# ========== VEHICLE TYPE ENDPOINTS ==========
@router.post("/vehicle-types", response_model=VehicleType)
async def create_vehicle_type(vehicle_type: VehicleTypeCreate):
    vt_dict = vehicle_type.model_dump()
    vt_dict["id"] = str(uuid.uuid4())
    vt_dict["created_at"] = datetime.now(timezone.utc).isoformat()
    await db.vehicle_types.insert_one(vt_dict)
    vt_dict.pop("_id", None)
    return vt_dict


@router.get("/vehicle-types")
async def get_vehicle_types():
    vehicle_types = await db.vehicle_types.find({}, {"_id": 0}).to_list(100)
    for vt in vehicle_types:
        if "capacity" not in vt:
            vt["capacity"] = 4
    return vehicle_types


@router.get("/vehicle-types/{vehicle_type_id}")
async def get_vehicle_type(vehicle_type_id: str):
    vt = await db.vehicle_types.find_one({"id": vehicle_type_id}, {"_id": 0})
    if not vt:
        raise HTTPException(status_code=404, detail="Vehicle type not found")
    return vt


@router.put("/vehicle-types/{vehicle_type_id}")
async def update_vehicle_type(vehicle_type_id: str, vt_update: VehicleTypeUpdate):
    update_data = {k: v for k, v in vt_update.model_dump().items() if v is not None}
    if update_data:
        await db.vehicle_types.update_one({"id": vehicle_type_id}, {"$set": update_data})
    
    vt = await db.vehicle_types.find_one({"id": vehicle_type_id}, {"_id": 0})
    if not vt:
        raise HTTPException(status_code=404, detail="Vehicle type not found")
    return vt


@router.delete("/vehicle-types/{vehicle_type_id}")
async def delete_vehicle_type(vehicle_type_id: str):
    vehicles_using = await db.vehicles.count_documents({"vehicle_type_id": vehicle_type_id})
    if vehicles_using > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete: {vehicles_using} vehicles are using this type"
        )
    
    result = await db.vehicle_types.delete_one({"id": vehicle_type_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Vehicle type not found")
    return {"message": "Vehicle type deleted"}


# ========== VEHICLE ENDPOINTS ==========
@router.post("/vehicles", response_model=Vehicle)
async def create_vehicle(vehicle: VehicleCreate):
    vehicle_dict = vehicle.model_dump()
    vehicle_dict["id"] = str(uuid.uuid4())
    vehicle_dict["created_at"] = datetime.now(timezone.utc).isoformat()
    
    if vehicle_dict.get("vehicle_type_id"):
        vt = await db.vehicle_types.find_one({"id": vehicle_dict["vehicle_type_id"]})
        if vt:
            vehicle_dict["vehicle_type_name"] = vt.get("name")
    
    await db.vehicles.insert_one(vehicle_dict)
    vehicle_dict.pop("_id", None)
    return vehicle_dict


@router.get("/vehicles")
async def get_vehicles():
    vehicles = await db.vehicles.find({}, {"_id": 0}).to_list(1000)
    
    for vehicle in vehicles:
        if vehicle.get("vehicle_type_id"):
            vt = await db.vehicle_types.find_one({"id": vehicle["vehicle_type_id"]}, {"_id": 0})
            if vt:
                vehicle["vehicle_type"] = vt
    
    return vehicles


@router.get("/vehicles/{vehicle_id}")
async def get_vehicle(vehicle_id: str):
    vehicle = await db.vehicles.find_one({"id": vehicle_id}, {"_id": 0})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    if vehicle.get("vehicle_type_id"):
        vt = await db.vehicle_types.find_one({"id": vehicle["vehicle_type_id"]}, {"_id": 0})
        if vt:
            vehicle["vehicle_type"] = vt
    
    return vehicle


@router.put("/vehicles/{vehicle_id}")
async def update_vehicle(vehicle_id: str, vehicle_update: VehicleUpdate):
    update_data = {k: v for k, v in vehicle_update.model_dump().items() if v is not None}
    
    if update_data.get("vehicle_type_id"):
        vt = await db.vehicle_types.find_one({"id": update_data["vehicle_type_id"]})
        if vt:
            update_data["vehicle_type_name"] = vt.get("name")
    
    if update_data:
        await db.vehicles.update_one({"id": vehicle_id}, {"$set": update_data})
    
    vehicle = await db.vehicles.find_one({"id": vehicle_id}, {"_id": 0})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    return vehicle


@router.delete("/vehicles/{vehicle_id}")
async def delete_vehicle(vehicle_id: str):
    result = await db.vehicles.delete_one({"id": vehicle_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    return {"message": "Vehicle deleted"}
