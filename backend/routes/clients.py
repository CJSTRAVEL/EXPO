# Client Management Routes
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timezone
import uuid
import io

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT

from .shared import db, ClientStatus, ClientType, generate_client_account_no

router = APIRouter(tags=["Clients"])


# ========== MODELS ==========
class ClientBase(BaseModel):
    name: str
    contact_name: Optional[str] = None
    contact_email: Optional[str] = None
    phone: Optional[str] = None
    mobile: Optional[str] = None
    address: Optional[str] = None
    postcode: Optional[str] = None
    account_type: Optional[ClientType] = ClientType.BUSINESS
    status: Optional[ClientStatus] = ClientStatus.ACTIVE
    payment_terms: Optional[int] = 30
    notes: Optional[str] = None
    vat_registered: Optional[bool] = False
    vat_number: Optional[str] = None

class ClientCreate(ClientBase):
    pass

class ClientUpdate(BaseModel):
    name: Optional[str] = None
    contact_name: Optional[str] = None
    contact_email: Optional[str] = None
    phone: Optional[str] = None
    mobile: Optional[str] = None
    address: Optional[str] = None
    postcode: Optional[str] = None
    account_type: Optional[ClientType] = None
    status: Optional[ClientStatus] = None
    payment_terms: Optional[int] = None
    notes: Optional[str] = None
    vat_registered: Optional[bool] = None
    vat_number: Optional[str] = None
    # Custom fare settings
    use_custom_fares: Optional[bool] = None
    custom_fare_zones: Optional[List[dict]] = None  # Same structure as global fare zones
    custom_mile_rates: Optional[dict] = None  # Same structure as global mile rates

class Client(ClientBase):
    id: str = ""
    account_no: Optional[str] = None
    created_at: datetime = None
    
    def __init__(self, **data):
        super().__init__(**data)
        if not self.id:
            self.id = str(uuid.uuid4())
        if not self.created_at:
            self.created_at = datetime.now(timezone.utc)

class InvoiceRequest(BaseModel):
    custom_prices: Optional[dict] = None


# ========== ENDPOINTS ==========
@router.get("/clients")
async def get_clients():
    """Get all clients with their booking counts"""
    clients = await db.clients.find({}, {"_id": 0}).to_list(1000)
    for client in clients:
        if isinstance(client.get('created_at'), str):
            client['created_at'] = datetime.fromisoformat(client['created_at'])
        booking_count = await db.bookings.count_documents({"client_id": client['id']})
        client['booking_count'] = booking_count
        pipeline = [
            {"$match": {"client_id": client['id']}},
            {"$group": {"_id": None, "total": {"$sum": "$fare"}}}
        ]
        result = await db.bookings.aggregate(pipeline).to_list(1)
        client['total_invoice'] = result[0]['total'] if result else 0
    return clients


@router.get("/clients/{client_id}")
async def get_client(client_id: str):
    """Get a specific client by ID"""
    client = await db.clients.find_one({"id": client_id}, {"_id": 0})
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    if isinstance(client.get('created_at'), str):
        client['created_at'] = datetime.fromisoformat(client['created_at'])
    client['booking_count'] = await db.bookings.count_documents({"client_id": client_id})
    pipeline = [
        {"$match": {"client_id": client_id}},
        {"$group": {"_id": None, "total": {"$sum": "$fare"}}}
    ]
    result = await db.bookings.aggregate(pipeline).to_list(1)
    client['total_invoice'] = result[0]['total'] if result else 0
    return client


@router.get("/clients/{client_id}/bookings")
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


@router.post("/clients")
async def create_client(client: ClientCreate):
    """Create a new client"""
    account_no = await generate_client_account_no()
    
    client_obj = Client(**client.model_dump())
    client_obj.account_no = account_no
    
    doc = client_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.clients.insert_one(doc)
    
    return client_obj


@router.put("/clients/{client_id}")
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


@router.delete("/clients/{client_id}")
async def delete_client(client_id: str):
    """Delete a client"""
    result = await db.clients.delete_one({"id": client_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Client not found")
    return {"message": "Client deleted successfully"}


# ========== CLIENT FARE SETTINGS ==========
class ClientFareSettings(BaseModel):
    use_custom_fares: bool = False
    custom_fare_zones: Optional[List[dict]] = None
    custom_mile_rates: Optional[dict] = None

@router.get("/clients/{client_id}/fare-settings")
async def get_client_fare_settings(client_id: str):
    """Get fare settings for a specific client"""
    client = await db.clients.find_one({"id": client_id}, {"_id": 0})
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    
    return {
        "use_custom_fares": client.get("use_custom_fares", False),
        "custom_fare_zones": client.get("custom_fare_zones", []),
        "custom_mile_rates": client.get("custom_mile_rates", None)
    }

@router.put("/clients/{client_id}/fare-settings")
async def update_client_fare_settings(client_id: str, settings: ClientFareSettings):
    """Update fare settings for a specific client"""
    client = await db.clients.find_one({"id": client_id}, {"_id": 0})
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    
    update_data = {
        "use_custom_fares": settings.use_custom_fares,
        "custom_fare_zones": settings.custom_fare_zones or [],
        "custom_mile_rates": settings.custom_mile_rates
    }
    
    await db.clients.update_one({"id": client_id}, {"$set": update_data})
    
    return {"message": "Fare settings updated successfully", **update_data}


# ========== PORTAL PASSWORD MANAGEMENT ==========
class PortalPasswordUpdate(BaseModel):
    password: str

@router.put("/clients/{client_id}/portal-password")
async def set_client_portal_password(client_id: str, data: PortalPasswordUpdate):
    """Set or reset a client's portal login password"""
    from .shared import hash_password
    
    client = await db.clients.find_one({"id": client_id}, {"_id": 0})
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    
    if len(data.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    
    password_hash = hash_password(data.password)
    await db.clients.update_one(
        {"id": client_id},
        {"$set": {"password_hash": password_hash}}
    )
    
    return {"message": "Portal password updated successfully"}


@router.get("/clients/{client_id}/invoice/preview")
async def get_invoice_preview(client_id: str, start_date: str = None, end_date: str = None):
    """Get bookings preview for invoice generation"""
    client = await db.clients.find_one({"id": client_id}, {"_id": 0})
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    
    query = {"client_id": client_id}
    if start_date or end_date:
        date_query = {}
        if start_date:
            date_query["$gte"] = start_date
        if end_date:
            date_query["$lte"] = end_date + "T23:59:59"
        if date_query:
            query["booking_datetime"] = date_query
    
    bookings = await db.bookings.find(query, {"_id": 0}).sort("booking_datetime", 1).to_list(1000)
    
    for booking in bookings:
        if isinstance(booking.get('created_at'), str):
            booking['created_at'] = booking['created_at']
        if isinstance(booking.get('booking_datetime'), str):
            booking['booking_datetime'] = booking['booking_datetime']
    
    return bookings


@router.post("/clients/{client_id}/invoice")
async def generate_client_invoice(client_id: str, request: InvoiceRequest = None, start_date: str = None, end_date: str = None):
    """Generate PDF invoice for a client's bookings"""
    client = await db.clients.find_one({"id": client_id}, {"_id": 0})
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    
    query = {"client_id": client_id}
    if start_date or end_date:
        date_query = {}
        if start_date:
            date_query["$gte"] = start_date
        if end_date:
            date_query["$lte"] = end_date + "T23:59:59"
        if date_query:
            query["booking_datetime"] = date_query
    
    bookings = await db.bookings.find(query, {"_id": 0}).sort("booking_datetime", 1).to_list(1000)
    
    # Calculate totals
    subtotal = 0
    for b in bookings:
        fare = b.get('fare', 0) or 0
        if request and request.custom_prices and b.get('id') in request.custom_prices:
            fare = request.custom_prices[b['id']]
        subtotal += fare
    
    vat_rate = 0.20
    vat_amount = subtotal * vat_rate
    total = subtotal + vat_amount
    
    # Generate invoice reference
    counter = await db.counters.find_one_and_update(
        {"_id": "invoice_number"},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=True
    )
    invoice_ref = f"INV-{str(counter['seq']).zfill(5)}"
    
    # Create PDF
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, leftMargin=30, rightMargin=30, topMargin=30, bottomMargin=30)
    elements = []
    styles = getSampleStyleSheet()
    
    # Custom styles
    company_name_style = ParagraphStyle('company_name', parent=styles['Normal'], fontSize=11, textColor=colors.black, spaceAfter=2)
    
    # Header with invoice details
    invoice_box_data = [
        ['DATE:', datetime.now().strftime('%d/%m/%Y')],
        ['REFERENCE:', invoice_ref],
        ['ACCOUNT:', client.get('account_no', '')],
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
    
    # Title
    elements.append(Paragraph("<b>INVOICE</b>", ParagraphStyle('title', parent=styles['Heading1'], fontSize=24, alignment=1)))
    elements.append(Spacer(1, 20))
    
    # Client details
    elements.append(Paragraph(f"<b>Bill To:</b> {client.get('name', '')}", styles['Normal']))
    if client.get('address'):
        elements.append(Paragraph(client['address'], styles['Normal']))
    elements.append(Spacer(1, 20))
    
    # Bookings table
    if bookings:
        table_data = [['Date', 'Reference', 'Journey', 'Amount']]
        for b in bookings:
            date_str = b.get('booking_datetime', '')[:10] if b.get('booking_datetime') else ''
            journey = f"{b.get('pickup_location', '')[:30]} → {b.get('dropoff_location', '')[:30]}"
            fare = b.get('fare', 0) or 0
            if request and request.custom_prices and b.get('id') in request.custom_prices:
                fare = request.custom_prices[b['id']]
            table_data.append([
                date_str,
                b.get('booking_id', ''),
                journey,
                f"£{fare:.2f}"
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
    
    # Totals
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
    
    # Save invoice record
    invoice_record = {
        "id": str(uuid.uuid4()),
        "invoice_ref": invoice_ref,
        "client_id": client_id,
        "start_date": start_date,
        "end_date": end_date,
        "subtotal": subtotal,
        "vat_amount": vat_amount,
        "total": total,
        "journey_count": len(bookings),
        "status": "unpaid",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.invoices.insert_one(invoice_record)
    
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={invoice_ref}.pdf"}
    )



# ========== ADMIN INVOICE MANAGEMENT ==========

class InvoiceStatusUpdate(BaseModel):
    status: str  # "paid", "unpaid", "overdue", "cancelled"

@router.get("/invoices")
async def get_all_invoices():
    """Get all invoices across all clients (admin view)"""
    invoices = await db.invoices.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    
    # Enrich with client names
    client_ids = list(set(inv.get("client_id") for inv in invoices if inv.get("client_id")))
    clients = await db.clients.find({"id": {"$in": client_ids}}, {"_id": 0, "id": 1, "name": 1, "account_no": 1, "email": 1}).to_list(1000)
    client_map = {c["id"]: c for c in clients}
    
    for inv in invoices:
        client = client_map.get(inv.get("client_id"), {})
        inv["client_name"] = client.get("name", "Unknown")
        inv["client_account_no"] = client.get("account_no", "")
        inv["client_email"] = client.get("email", "")
    
    return invoices

@router.get("/invoices/{invoice_id}")
async def get_invoice_details(invoice_id: str):
    """Get detailed invoice information"""
    invoice = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    # Get client details
    client = await db.clients.find_one({"id": invoice.get("client_id")}, {"_id": 0})
    if client:
        invoice["client_name"] = client.get("name", "Unknown")
        invoice["client_account_no"] = client.get("account_no", "")
        invoice["client_email"] = client.get("email", "")
        invoice["client_address"] = client.get("address", "")
    
    # Get bookings for this invoice period
    query = {"client_id": invoice.get("client_id")}
    if invoice.get("start_date") or invoice.get("end_date"):
        date_query = {}
        if invoice.get("start_date"):
            date_query["$gte"] = invoice["start_date"]
        if invoice.get("end_date"):
            date_query["$lte"] = invoice["end_date"] + "T23:59:59"
        if date_query:
            query["booking_datetime"] = date_query
    
    bookings = await db.bookings.find(query, {"_id": 0}).sort("booking_datetime", 1).to_list(1000)
    invoice["bookings"] = bookings
    
    return invoice

@router.put("/invoices/{invoice_id}/status")
async def update_invoice_status(invoice_id: str, status_update: InvoiceStatusUpdate):
    """Update invoice status (paid, unpaid, overdue, cancelled)"""
    invoice = await db.invoices.find_one({"id": invoice_id})
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    valid_statuses = ["paid", "unpaid", "overdue", "cancelled"]
    if status_update.status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid_statuses}")
    
    update_data = {
        "status": status_update.status,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    # If marking as paid, add paid_at timestamp
    if status_update.status == "paid":
        update_data["paid_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.invoices.update_one(
        {"id": invoice_id},
        {"$set": update_data}
    )
    
    return {"message": "Invoice status updated", "status": status_update.status}

@router.delete("/invoices/{invoice_id}")
async def delete_invoice(invoice_id: str):
    """Delete an invoice"""
    result = await db.invoices.delete_one({"id": invoice_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return {"message": "Invoice deleted"}

@router.post("/invoices/{invoice_id}/send-reminder")
async def send_invoice_reminder(invoice_id: str):
    """Send a reminder email to the client for an outstanding invoice"""
    invoice = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    # Get client details
    client = await db.clients.find_one({"id": invoice.get("client_id")}, {"_id": 0})
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    
    client_email = client.get("email") or client.get("contact_email")
    if not client_email:
        raise HTTPException(status_code=400, detail="Client has no email address")
    
    # Get email settings
    email_settings = await db.settings.find_one({"type": "email"}, {"_id": 0})
    if not email_settings:
        raise HTTPException(status_code=400, detail="Email settings not configured")
    
    smtp_host = email_settings.get("smtp_host")
    smtp_port = email_settings.get("smtp_port", 587)
    smtp_user = email_settings.get("smtp_user")
    smtp_password = email_settings.get("smtp_password")
    from_email = email_settings.get("from_email", smtp_user)
    
    if not all([smtp_host, smtp_user, smtp_password]):
        raise HTTPException(status_code=400, detail="Email settings incomplete")
    
    # Build email content
    subject = f"Payment Reminder - Invoice {invoice.get('invoice_ref', 'N/A')}"
    body = f"""Dear {client.get('name', 'Valued Client')},

This is a friendly reminder that invoice {invoice.get('invoice_ref', 'N/A')} remains outstanding.

Invoice Details:
- Reference: {invoice.get('invoice_ref', 'N/A')}
- Date: {invoice.get('created_at', '')[:10] if invoice.get('created_at') else 'N/A'}
- Amount: £{invoice.get('total', 0):.2f}
- Status: {invoice.get('status', 'unpaid').title()}

You can view and download your invoices by logging into our Client Portal.

If you have already made payment, please disregard this reminder.

If you have any questions, please don't hesitate to contact us.

Kind regards,
CJ's Executive Travel
"""
    
    try:
        import smtplib
        from email.mime.text import MIMEText
        from email.mime.multipart import MIMEMultipart
        
        msg = MIMEMultipart()
        msg['From'] = from_email
        msg['To'] = client_email
        msg['Subject'] = subject
        msg.attach(MIMEText(body, 'plain'))
        
        with smtplib.SMTP(smtp_host, smtp_port) as server:
            server.starttls()
            server.login(smtp_user, smtp_password)
            server.send_message(msg)
        
        # Log the reminder
        await db.invoices.update_one(
            {"id": invoice_id},
            {"$push": {"reminders_sent": datetime.now(timezone.utc).isoformat()}}
        )
        
        return {"message": f"Reminder sent to {client_email}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to send email: {str(e)}")
