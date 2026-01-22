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
