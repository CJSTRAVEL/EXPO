# Chat Routes
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from datetime import datetime, timezone
import uuid

from .shared import db, get_current_driver

router = APIRouter(tags=["Chat"])


class ChatMessage(BaseModel):
    booking_id: str
    message: str
    sender_type: str = "driver"


@router.post("/driver/chat/send")
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


@router.get("/driver/chat/{booking_id}")
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


@router.post("/dispatch/chat/send")
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


@router.get("/dispatch/chat/{booking_id}")
async def get_dispatch_chat(booking_id: str):
    """Get chat messages for dispatch view"""
    messages = await db.chat_messages.find(
        {"booking_id": booking_id},
        {"_id": 0}
    ).sort("created_at", 1).to_list(100)
    
    return messages
