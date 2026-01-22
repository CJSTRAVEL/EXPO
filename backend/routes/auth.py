# Admin Authentication Routes
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
import uuid

from .shared import (
    db, hash_password, create_admin_token, get_current_admin,
    AdminUserBase, AdminUserCreate, AdminUser, AdminLoginRequest, AdminLoginResponse, AdminRole
)

router = APIRouter(prefix="/auth", tags=["Authentication"])


class AdminUserUpdate(BaseModel):
    email: Optional[str] = None
    name: Optional[str] = None
    role: Optional[AdminRole] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None


@router.post("/login")
async def admin_login(data: AdminLoginRequest):
    """Admin user login"""
    user = await db.admin_users.find_one({"email": data.email}, {"_id": 0})
    
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    if not user.get("is_active", True):
        raise HTTPException(status_code=401, detail="Account is disabled")
    
    password_hash = hash_password(data.password)
    if user.get("password_hash") != password_hash:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    token = create_admin_token(user["id"], user["email"], user.get("role", "operator"))
    
    return AdminLoginResponse(
        token=token,
        user=AdminUser(
            id=user["id"],
            email=user["email"],
            name=user["name"],
            role=user.get("role", "operator"),
            is_active=user.get("is_active", True),
            created_at=user.get("created_at", "")
        )
    )


@router.get("/me")
async def get_current_user(admin: dict = Depends(get_current_admin)):
    """Get current admin user profile"""
    user = await db.admin_users.find_one({"id": admin["sub"]}, {"_id": 0, "password_hash": 0})
    return user


@router.put("/profile")
async def update_profile(update_data: AdminUserUpdate, admin: dict = Depends(get_current_admin)):
    """Update current admin user profile"""
    user = await db.admin_users.find_one({"id": admin["sub"]})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    update_dict = {}
    if update_data.email:
        update_dict["email"] = update_data.email
    if update_data.name:
        update_dict["name"] = update_data.name
    if update_data.password:
        update_dict["password_hash"] = hash_password(update_data.password)
    
    if update_dict:
        await db.admin_users.update_one(
            {"id": admin["sub"]},
            {"$set": update_dict}
        )
    
    updated_user = await db.admin_users.find_one({"id": admin["sub"]}, {"_id": 0, "password_hash": 0})
    return updated_user


@router.get("/users")
async def get_admin_users(admin: dict = Depends(get_current_admin)):
    """Get all admin users (super_admin only)"""
    if admin.get("role") != "super_admin":
        raise HTTPException(status_code=403, detail="Super admin access required")
    users = await db.admin_users.find({}, {"_id": 0, "password_hash": 0}).to_list(100)
    return users


@router.post("/users")
async def create_admin_user(user_data: AdminUserCreate, admin: dict = Depends(get_current_admin)):
    """Create new admin user (super_admin only)"""
    if admin.get("role") != "super_admin":
        raise HTTPException(status_code=403, detail="Super admin access required")
    
    existing = await db.admin_users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already exists")
    
    user_dict = {
        "id": str(uuid.uuid4()),
        "email": user_data.email,
        "name": user_data.name,
        "role": user_data.role.value if user_data.role else "operator",
        "is_active": user_data.is_active,
        "password_hash": hash_password(user_data.password),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.admin_users.insert_one(user_dict)
    del user_dict["password_hash"]
    user_dict.pop("_id", None)
    return user_dict


@router.put("/users/{user_id}")
async def update_admin_user(user_id: str, user_data: AdminUserUpdate, admin: dict = Depends(get_current_admin)):
    """Update admin user (super_admin only)"""
    if admin.get("role") != "super_admin":
        raise HTTPException(status_code=403, detail="Super admin access required")
    
    user = await db.admin_users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    update_dict = {}
    if user_data.email:
        update_dict["email"] = user_data.email
    if user_data.name:
        update_dict["name"] = user_data.name
    if user_data.role:
        update_dict["role"] = user_data.role.value
    if user_data.is_active is not None:
        update_dict["is_active"] = user_data.is_active
    if user_data.password:
        update_dict["password_hash"] = hash_password(user_data.password)
    
    if update_dict:
        await db.admin_users.update_one({"id": user_id}, {"$set": update_dict})
    
    updated_user = await db.admin_users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    return updated_user


@router.delete("/users/{user_id}")
async def delete_admin_user(user_id: str, admin: dict = Depends(get_current_admin)):
    """Delete admin user (super_admin only)"""
    if admin.get("role") != "super_admin":
        raise HTTPException(status_code=403, detail="Super admin access required")
    
    if admin["sub"] == user_id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    
    result = await db.admin_users.delete_one({"id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"message": "User deleted"}
