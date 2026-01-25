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


@router.get("/dispatch/active-chats")
async def get_active_chats():
    """Get all active chat conversations with unread counts"""
    # Get all unique booking_ids that have chat messages
    pipeline = [
        {"$group": {
            "_id": "$booking_id",
            "last_message": {"$last": "$message"},
            "last_message_at": {"$last": "$created_at"},
            "unread_count": {
                "$sum": {
                    "$cond": [
                        {"$and": [
                            {"$eq": ["$sender_type", "driver"]},
                            {"$eq": ["$read", False]}
                        ]},
                        1,
                        0
                    ]
                }
            }
        }},
        {"$sort": {"last_message_at": -1}},
        {"$limit": 50}
    ]
    
    chat_summaries = await db.chat_messages.aggregate(pipeline).to_list(50)
    
    # Enrich with booking and driver info
    result = []
    for chat in chat_summaries:
        booking_id = chat["_id"]
        booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
        if not booking:
            continue
            
        driver_name = "Unknown Driver"
        if booking.get("driver_id"):
            driver = await db.drivers.find_one({"id": booking["driver_id"]}, {"_id": 0, "name": 1})
            if driver:
                driver_name = driver.get("name", "Unknown Driver")
        
        result.append({
            "booking_id": booking_id,
            "booking_id_short": booking.get("booking_id", booking_id[:8]),
            "driver_name": driver_name,
            "driver_id": booking.get("driver_id"),
            "customer_name": booking.get("customer_name", f"{booking.get('first_name', '')} {booking.get('last_name', '')}".strip()),
            "last_message": chat.get("last_message", ""),
            "last_message_at": chat.get("last_message_at"),
            "unread_count": chat.get("unread_count", 0)
        })
    
    # Sort by unread first, then by last message
    result.sort(key=lambda x: (-x["unread_count"], x.get("last_message_at", "") or ""), reverse=False)
    result.sort(key=lambda x: x["unread_count"], reverse=True)
    
    return result


@router.post("/dispatch/chat/{booking_id}/mark-read")
async def mark_chat_read(booking_id: str):
    """Mark all driver messages in a chat as read"""
    result = await db.chat_messages.update_many(
        {"booking_id": booking_id, "sender_type": "driver", "read": False},
        {"$set": {"read": True}}
    )
    
    return {"marked_read": result.modified_count}

