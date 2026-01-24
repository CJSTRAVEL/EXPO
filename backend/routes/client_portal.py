# Client Portal Routes
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone, timedelta
import uuid
import jwt
import io
import os
import logging

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer

from .shared import (
    db, hash_password, get_current_client, JWT_SECRET, JWT_ALGORITHM
)

router = APIRouter(tags=["Client Portal"])


# ========== MODELS ==========
class ClientPortalRegister(BaseModel):
    name: str
    phone: str
    email: Optional[str] = None
    password: str
    company_name: Optional[str] = None

class ClientPortalLogin(BaseModel):
    phone: Optional[str] = None
    email: Optional[str] = None
    password: str

class ClientPortalResponse(BaseModel):
    id: str
    name: str
    phone: str
    email: Optional[str] = None
    company_name: Optional[str] = None
    account_no: Optional[str] = None
    token: str

class ClientBookingRequestCreate(BaseModel):
    pickup_location: str
    dropoff_location: str
    pickup_datetime: str
    passenger_count: int = 1
    luggage_count: int = 0
    vehicle_type_id: Optional[str] = None
    vehicle_type_name: Optional[str] = None
    notes: Optional[str] = None
    flight_number: Optional[str] = None
    quoted_fare: Optional[float] = None  # Estimated fare from portal
    distance_miles: Optional[float] = None
    duration_minutes: Optional[int] = None


# ========== AUTHENTICATION ==========
@router.post("/client-portal/register", response_model=ClientPortalResponse)
async def register_client_portal(data: ClientPortalRegister):
    """Register for client portal access (creates pending request)"""
    # Build query conditions
    or_conditions = []
    if data.phone:
        or_conditions.append({"phone": data.phone})
        or_conditions.append({"mobile": data.phone})
    if data.email:
        or_conditions.append({"email": data.email})
        or_conditions.append({"contact_email": data.email})
    
    existing = None
    if or_conditions:
        existing = await db.clients.find_one({"$or": or_conditions})
    
    if existing:
        if existing.get("password_hash"):
            raise HTTPException(status_code=400, detail="Account already exists. Please login.")
        else:
            # Existing client without password - set up portal access
            await db.clients.update_one(
                {"id": existing["id"]},
                {"$set": {"password_hash": hash_password(data.password)}}
            )
            token = jwt.encode({
                "client_id": existing["id"],
                "phone": existing.get("phone") or existing.get("mobile"),
                "exp": datetime.now(timezone.utc) + timedelta(days=30)
            }, JWT_SECRET, algorithm=JWT_ALGORITHM)
            
            return ClientPortalResponse(
                id=existing["id"],
                name=existing.get("contact_name") or existing.get("name", ""),
                phone=existing.get("phone") or existing.get("mobile"),
                email=existing.get("email") or existing.get("contact_email"),
                company_name=existing.get("name"),
                account_no=existing.get("account_no"),
                token=token
            )
    
    # New registration - create pending request
    request_data = {
        "id": str(uuid.uuid4()),
        "name": data.name,
        "phone": data.phone,
        "email": data.email,
        "company_name": data.company_name,
        "password_hash": hash_password(data.password),
        "status": "pending",
        "account_type": "client",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.booking_requests.insert_one(request_data)
    
    token = jwt.encode({
        "client_id": request_data["id"],
        "phone": data.phone,
        "pending": True,
        "exp": datetime.now(timezone.utc) + timedelta(days=30)
    }, JWT_SECRET, algorithm=JWT_ALGORITHM)
    
    return ClientPortalResponse(
        id=request_data["id"],
        name=data.name,
        phone=data.phone,
        email=data.email,
        company_name=data.company_name,
        token=token
    )


@router.post("/client-portal/login", response_model=ClientPortalResponse)
async def login_client_portal(data: ClientPortalLogin):
    """Login to client portal using email or phone"""
    client = None
    
    # Try to find by email first
    if data.email:
        client = await db.clients.find_one({"email": data.email}, {"_id": 0})
        if not client:
            # Also check contact_email
            client = await db.clients.find_one({"contact_email": data.email}, {"_id": 0})
    
    # Try to find by phone if not found by email
    if not client and data.phone:
        client = await db.clients.find_one({"phone": data.phone}, {"_id": 0})
        if not client:
            # Also check mobile
            client = await db.clients.find_one({"mobile": data.phone}, {"_id": 0})
    
    if not client:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not client.get("password_hash"):
        raise HTTPException(status_code=401, detail="Account not set up for portal access. Please contact us to set up your account.")
    
    if client["password_hash"] != hash_password(data.password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = jwt.encode({
        "client_id": client["id"],
        "phone": client.get("phone") or client.get("mobile"),
        "exp": datetime.now(timezone.utc) + timedelta(days=30)
    }, JWT_SECRET, algorithm=JWT_ALGORITHM)
    
    return ClientPortalResponse(
        id=client["id"],
        name=client.get("contact_name") or client.get("name", ""),
        phone=client.get("phone") or client.get("mobile", ""),
        email=client.get("email") or client.get("contact_email"),
        company_name=client.get("name"),
        account_no=client.get("account_no"),
        token=token
    )


# ========== CLIENT PORTAL DATA ==========
@router.get("/client-portal/bookings")
async def get_client_portal_bookings(client: dict = Depends(get_current_client)):
    """Get all bookings for the logged-in client"""
    bookings = await db.bookings.find(
        {"client_id": client["id"]},
        {"_id": 0}
    ).sort("booking_datetime", -1).to_list(100)
    
    return bookings


@router.post("/client-portal/booking-requests")
async def create_client_booking_request(request: ClientBookingRequestCreate, client: dict = Depends(get_current_client)):
    """Create a new booking request from client portal"""
    booking_request = {
        "id": str(uuid.uuid4()),
        "client_id": client["id"],
        "client_name": client.get("name"),
        "passenger_name": client.get("contact_name") or client.get("name"),
        "passenger_phone": client.get("phone") or client.get("mobile"),
        "passenger_email": client.get("email") or client.get("contact_email"),
        "pickup_location": request.pickup_location,
        "dropoff_location": request.dropoff_location,
        "pickup_datetime": request.pickup_datetime,
        "passenger_count": request.passenger_count,
        "luggage_count": request.luggage_count,
        "vehicle_type_id": request.vehicle_type_id,
        "vehicle_type_name": request.vehicle_type_name,
        "notes": request.notes,
        "flight_number": request.flight_number,
        "quoted_fare": request.quoted_fare,
        "distance_miles": request.distance_miles,
        "duration_minutes": request.duration_minutes,
        "status": "pending",
        "account_type": "client",
        "booking_source": "portal",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.booking_requests.insert_one(booking_request)
    booking_request.pop("_id", None)
    
    return booking_request


@router.get("/client-portal/booking-requests")
async def get_client_booking_requests(client: dict = Depends(get_current_client)):
    """Get client's booking requests"""
    requests = await db.booking_requests.find(
        {"client_id": client["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    return requests


# ========== INVOICES ==========
@router.get("/client-portal/invoices")
async def get_client_invoices(client: dict = Depends(get_current_client)):
    """Get all invoices for the logged-in client"""
    invoices = await db.invoices.find(
        {"client_id": client["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    return invoices


@router.get("/client-portal/invoices/{invoice_id}")
async def get_client_invoice_details(invoice_id: str, client: dict = Depends(get_current_client)):
    """Get specific invoice details"""
    invoice = await db.invoices.find_one(
        {"id": invoice_id, "client_id": client["id"]},
        {"_id": 0}
    )
    
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    return invoice


@router.get("/client-portal/invoices/{invoice_id}/download")
async def download_client_invoice(invoice_id: str, client: dict = Depends(get_current_client)):
    """Download PDF invoice"""
    invoice = await db.invoices.find_one(
        {"id": invoice_id, "client_id": client["id"]},
        {"_id": 0}
    )
    
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    client_data = await db.clients.find_one({"id": client["id"]}, {"_id": 0})
    
    query = {"client_id": client["id"]}
    if invoice.get("start_date") or invoice.get("end_date"):
        date_query = {}
        if invoice.get("start_date"):
            date_query["$gte"] = invoice["start_date"]
        if invoice.get("end_date"):
            date_query["$lte"] = invoice["end_date"] + "T23:59:59"
        if date_query:
            query["booking_datetime"] = date_query
    
    bookings = await db.bookings.find(query, {"_id": 0}).sort("booking_datetime", 1).to_list(1000)
    
    subtotal = sum(b.get('fare', 0) or 0 for b in bookings)
    vat_rate = 0.20
    vat_amount = subtotal * vat_rate
    total = subtotal + vat_amount
    
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, leftMargin=30, rightMargin=30, topMargin=30, bottomMargin=30)
    elements = []
    styles = getSampleStyleSheet()
    
    company_name_style = ParagraphStyle('company_name', parent=styles['Normal'], fontSize=11, textColor=colors.black, spaceAfter=2)
    
    invoice_box_data = [
        ['DATE:', invoice.get("created_at", "")[:10] if invoice.get("created_at") else datetime.now().strftime('%Y-%m-%d')],
        ['REFERENCE:', invoice.get("invoice_ref", "")],
        ['ACCOUNT:', client_data.get('account_no', '') if client_data else ''],
    ]
    invoice_box = Table(invoice_box_data, colWidths=[70, 80])
    invoice_box.setStyle(TableStyle([
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('TEXTCOLOR', (0, 0), (0, -1), colors.grey),
        ('ALIGN', (0, 0), (0, -1), 'RIGHT'),
        ('ALIGN', (1, 0), (1, -1), 'LEFT'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    
    header_data = [
        [Paragraph("<b>CJ's Executive Travel Limited</b>", company_name_style), invoice_box],
    ]
    header_table = Table(header_data, colWidths=[350, 150])
    elements.append(header_table)
    elements.append(Spacer(1, 30))
    
    elements.append(Paragraph("<b>INVOICE</b>", ParagraphStyle('title', parent=styles['Heading1'], fontSize=24, alignment=1)))
    elements.append(Spacer(1, 20))
    
    if bookings:
        table_data = [['Date', 'Reference', 'Journey', 'Amount']]
        for b in bookings:
            date_str = b.get('booking_datetime', '')[:10] if b.get('booking_datetime') else ''
            journey = f"{b.get('pickup_location', '')[:30]} → {b.get('dropoff_location', '')[:30]}"
            table_data.append([
                date_str,
                b.get('booking_id', ''),
                journey,
                f"£{b.get('fare', 0):.2f}" if b.get('fare') else "£0.00"
            ])
        
        t = Table(table_data, colWidths=[70, 70, 250, 70])
        t.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1a1a1a')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('ALIGN', (-1, 0), (-1, -1), 'RIGHT'),
        ]))
        elements.append(t)
        elements.append(Spacer(1, 20))
    
    totals_data = [
        ['Subtotal:', f'£{subtotal:.2f}'],
        ['VAT (20%):', f'£{vat_amount:.2f}'],
        ['Total:', f'£{total:.2f}'],
    ]
    totals_table = Table(totals_data, colWidths=[100, 70])
    totals_table.setStyle(TableStyle([
        ('ALIGN', (0, 0), (-1, -1), 'RIGHT'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('FONTNAME', (0, 2), (-1, 2), 'Helvetica-Bold'),
    ]))
    elements.append(totals_table)
    
    doc.build(elements)
    buffer.seek(0)
    
    filename = f"{invoice.get('invoice_ref', 'invoice')}.pdf"
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


# ========== PASSWORD RESET ==========
class PasswordResetRequest(BaseModel):
    phone: Optional[str] = None
    email: Optional[str] = None
    method: str = "sms"
    account_type: str

class PasswordResetVerify(BaseModel):
    identifier: str
    code: str
    new_password: str
    account_type: str
    method: str = "sms"


@router.post("/password-reset/request")
async def request_password_reset(data: PasswordResetRequest):
    """Request a password reset code via SMS or Email"""
    import random
    
    identifier = None
    account = None
    
    if data.method == "email" and data.email:
        email = data.email.strip().lower()
        identifier = email
        
        if data.account_type == "passenger":
            account = await db.passengers.find_one({"email": {"$regex": f"^{email}$", "$options": "i"}})
        else:
            account = await db.clients.find_one({
                "$or": [
                    {"email": {"$regex": f"^{email}$", "$options": "i"}},
                    {"contact_email": {"$regex": f"^{email}$", "$options": "i"}}
                ]
            })
    else:
        phone = (data.phone or "").strip()
        if phone.startswith('0'):
            phone_normalized = '+44' + phone[1:]
        elif not phone.startswith('+'):
            phone_normalized = '+44' + phone
        else:
            phone_normalized = phone
        identifier = phone_normalized
        
        if data.account_type == "passenger":
            account = await db.passengers.find_one({
                "$or": [
                    {"phone": phone},
                    {"phone": phone_normalized},
                    {"phone": "0" + phone_normalized[3:] if phone_normalized.startswith("+44") else phone}
                ]
            })
        else:
            account = await db.clients.find_one({
                "$or": [
                    {"phone": phone},
                    {"phone": phone_normalized},
                    {"mobile": phone},
                    {"mobile": phone_normalized}
                ]
            })
    
    if not account:
        return {"message": f"If an account exists, a reset code will be sent via {data.method.upper()}"}
    
    reset_code = str(random.randint(100000, 999999))
    
    await db.password_resets.update_one(
        {"identifier": identifier, "account_type": data.account_type, "method": data.method},
        {
            "$set": {
                "identifier": identifier,
                "account_type": data.account_type,
                "method": data.method,
                "code": reset_code,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=15)).isoformat(),
                "used": False
            }
        },
        upsert=True
    )
    
    # Import and use notification services would go here
    # For now, log the code
    logging.info(f"Password reset code for {identifier}: {reset_code}")
    
    return {"message": f"If an account exists, a reset code will be sent via {data.method.upper()}"}


@router.post("/password-reset/verify")
async def verify_password_reset(data: PasswordResetVerify):
    """Verify reset code and set new password"""
    identifier = data.identifier.strip()
    
    if data.method == "sms":
        if identifier.startswith('0'):
            identifier = '+44' + identifier[1:]
        elif not identifier.startswith('+') and '@' not in identifier:
            identifier = '+44' + identifier
    else:
        identifier = identifier.lower()
    
    reset_request = await db.password_resets.find_one({
        "identifier": identifier,
        "account_type": data.account_type,
        "method": data.method,
        "code": data.code,
        "used": False
    })
    
    if not reset_request and data.method == "sms":
        reset_request = await db.password_resets.find_one({
            "phone": identifier,
            "account_type": data.account_type,
            "code": data.code,
            "used": False
        })
    
    if not reset_request:
        raise HTTPException(status_code=400, detail="Invalid or expired reset code")
    
    expires_at = datetime.fromisoformat(reset_request["expires_at"].replace("Z", "+00:00"))
    if datetime.now(timezone.utc) > expires_at:
        raise HTTPException(status_code=400, detail="Reset code has expired")
    
    await db.password_resets.update_one(
        {"_id": reset_request["_id"]},
        {"$set": {"used": True}}
    )
    
    new_password_hash = hash_password(data.new_password)
    
    if data.account_type == "passenger":
        if data.method == "email":
            result = await db.passengers.update_one(
                {"email": {"$regex": f"^{identifier}$", "$options": "i"}},
                {"$set": {"password_hash": new_password_hash}}
            )
        else:
            result = await db.passengers.update_one(
                {"$or": [
                    {"phone": identifier},
                    {"phone": "0" + identifier[3:] if identifier.startswith("+44") else identifier}
                ]},
                {"$set": {"password_hash": new_password_hash}}
            )
    else:
        if data.method == "email":
            result = await db.clients.update_one(
                {"$or": [
                    {"email": {"$regex": f"^{identifier}$", "$options": "i"}},
                    {"contact_email": {"$regex": f"^{identifier}$", "$options": "i"}}
                ]},
                {"$set": {"password_hash": new_password_hash}}
            )
        else:
            result = await db.clients.update_one(
                {"$or": [
                    {"phone": identifier},
                    {"mobile": identifier},
                    {"phone": "0" + identifier[3:] if identifier.startswith("+44") else identifier}
                ]},
                {"$set": {"password_hash": new_password_hash}}
            )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Account not found")
    
    return {"message": "Password reset successfully. You can now login with your new password."}
