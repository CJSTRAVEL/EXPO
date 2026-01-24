# Client Management Routes
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timezone, timedelta
import uuid
import io

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image
from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT
import os

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
    vat_rate: Optional[str] = "20"  # "0" (No VAT), "exempt", "20" (20%)

class ClientCreate(ClientBase):
    pass

class ClientUpdate(BaseModel):
    name: Optional[str] = None
    contact_name: Optional[str] = None
    contact_email: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    mobile: Optional[str] = None
    address: Optional[str] = None
    postcode: Optional[str] = None
    post_code: Optional[str] = None
    town_city: Optional[str] = None
    country: Optional[str] = None
    account_type: Optional[ClientType] = None
    client_type: Optional[str] = None
    payment_method: Optional[str] = None
    start_date: Optional[str] = None
    status: Optional[ClientStatus] = None
    payment_terms: Optional[int] = None
    notes: Optional[str] = None
    vat_registered: Optional[bool] = None
    vat_number: Optional[str] = None
    vat_rate: Optional[str] = None  # "0" (No VAT), "exempt", "20" (20%)
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
    """Generate PDF invoice for a client's bookings - matches CJ's Executive Travel template"""
    client = await db.clients.find_one({"id": client_id}, {"_id": 0})
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    
    query = {"client_id": client_id, "status": "completed"}
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
            custom_fare = request.custom_prices[b['id']]
            if custom_fare is not None:
                fare = custom_fare
        # Ensure fare is a number
        fare = float(fare) if fare else 0.0
        subtotal += fare
    
    # Get client's VAT rate setting
    client_vat_rate = client.get('vat_rate', '20')  # Default to 20%
    if client_vat_rate == '0' or client_vat_rate == 'exempt':
        vat_rate = 0.0
        vat_label = "VAT Exempt" if client_vat_rate == 'exempt' else "No VAT (0%)"
    else:
        vat_rate = 0.20
        vat_label = "VAT @ 20%"
    
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
    
    # Get company settings
    company_settings = await db.settings.find_one({"type": "company"}, {"_id": 0}) or {}
    
    # Calculate payment due date (30 days from now)
    payment_terms = client.get('payment_terms', 30)
    due_date = datetime.now() + timedelta(days=payment_terms)
    
    # Create PDF
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, leftMargin=40, rightMargin=40, topMargin=40, bottomMargin=60)
    elements = []
    styles = getSampleStyleSheet()
    
    # Gold and Black color scheme
    header_black = colors.HexColor('#1a1a1a')
    gold_accent = colors.HexColor('#D4AF37')
    header_gold = colors.HexColor('#C9A227')
    
    # Custom styles
    title_style = ParagraphStyle('title', parent=styles['Normal'], fontSize=20, fontName='Helvetica-Bold', textColor=header_black)
    company_style = ParagraphStyle('company', parent=styles['Normal'], fontSize=14, fontName='Helvetica-Bold', textColor=header_black)
    normal_style = ParagraphStyle('normal', parent=styles['Normal'], fontSize=9, leading=12)
    small_style = ParagraphStyle('small', parent=styles['Normal'], fontSize=8, leading=10, textColor=colors.grey)
    label_style = ParagraphStyle('label', parent=styles['Normal'], fontSize=8, textColor=colors.grey)
    value_style = ParagraphStyle('value', parent=styles['Normal'], fontSize=9, fontName='Helvetica-Bold')
    
    # ========== HEADER SECTION WITH LOGO ==========
    logo_path = os.path.join(os.path.dirname(__file__), '..', 'assets', 'logo_border.png')
    try:
        logo = Image(logo_path, width=60, height=60)
    except:
        logo = Spacer(60, 60)
    
    company_info = [
        [Paragraph("<b>CJ's Executive Travel Limited</b>", company_style)],
        [Paragraph("Unit 5 Peterlee SR8 2HY", normal_style)],
        [Paragraph("Phone: +44 1917721223", normal_style)],
        [Paragraph("Email: admin@cjstravel.uk", normal_style)],
        [Paragraph("Web: cjstravel.uk", normal_style)],
    ]
    company_table = Table(company_info, colWidths=[200])
    company_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
        ('TOPPADDING', (0, 0), (-1, -1), 0),
    ]))
    
    # Logo + Company info combined
    logo_company = Table([[logo, company_table]], colWidths=[70, 200])
    logo_company.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (0, 0), 0),
        ('RIGHTPADDING', (0, 0), (0, 0), 10),
    ]))
    
    # Invoice details box on right
    invoice_details = [
        [Paragraph("ACCOUNT NO", label_style), Paragraph(client.get('account_no', ''), value_style)],
        [Paragraph("REFERENCE", label_style), Paragraph(invoice_ref, value_style)],
        [Paragraph("TAX DATE", label_style), Paragraph(datetime.now().strftime('%d/%m/%Y'), value_style)],
    ]
    invoice_box = Table(invoice_details, colWidths=[70, 100])
    invoice_box.setStyle(TableStyle([
        ('ALIGN', (0, 0), (0, -1), 'RIGHT'),
        ('ALIGN', (1, 0), (1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOX', (0, 0), (-1, -1), 1, gold_accent),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E8D5A3')),
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#FDF8E8')),
    ]))
    
    header_data = [[logo_company, invoice_box]]
    header_table = Table(header_data, colWidths=[340, 180])
    header_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))
    elements.append(header_table)
    elements.append(Spacer(1, 20))
    
    # ========== BILLING DETAILS ==========
    billing_info = [
        [Paragraph("<b>For the attention of:</b>", normal_style)],
        [Paragraph(f"<b>{client.get('name', '')}</b>", value_style)],
    ]
    if client.get('contact_name'):
        billing_info.append([Paragraph(client['contact_name'], normal_style)])
    if client.get('address'):
        for line in client['address'].split('\n'):
            billing_info.append([Paragraph(line.strip(), normal_style)])
    if client.get('town_city'):
        billing_info.append([Paragraph(client['town_city'], normal_style)])
    if client.get('post_code') or client.get('postcode'):
        billing_info.append([Paragraph(client.get('post_code') or client.get('postcode', ''), normal_style)])
    if client.get('country'):
        billing_info.append([Paragraph(client['country'], normal_style)])
    
    billing_table = Table(billing_info, colWidths=[300])
    billing_table.setStyle(TableStyle([
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
        ('TOPPADDING', (0, 0), (-1, -1), 0),
    ]))
    elements.append(billing_table)
    elements.append(Spacer(1, 20))
    
    # ========== INVOICE SUMMARY BOX - Gold/Black ==========
    summary_title = Table([[Paragraph("<b>INVOICE SUMMARY</b>", ParagraphStyle('sum_title', fontSize=11, fontName='Helvetica-Bold', textColor=colors.white))]], colWidths=[520])
    summary_title.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), header_black),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.white),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
    ]))
    elements.append(summary_title)
    
    summary_data = [
        [Paragraph(f"<b>Journeys:</b>", normal_style), Paragraph(f"{len(bookings)} Journeys", normal_style), Paragraph(f"Amount: £{subtotal:.2f}", normal_style)],
    ]
    summary_table = Table(summary_data, colWidths=[150, 200, 170])
    summary_table.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 1, gold_accent),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
    ]))
    elements.append(summary_table)
    elements.append(Spacer(1, 10))
    
    # Totals box
    totals_data = [
        [Paragraph("Subtotal:", normal_style), Paragraph(f"£{subtotal:.2f}", value_style)],
        [Paragraph(f"{vat_label}:", normal_style), Paragraph(f"£{vat_amount:.2f}", value_style)],
        [Paragraph("<b>Total:</b>", value_style), Paragraph(f"<b>£{total:.2f}</b>", ParagraphStyle('total', fontSize=12, fontName='Helvetica-Bold'))],
    ]
    totals_table = Table(totals_data, colWidths=[100, 80])
    totals_table.setStyle(TableStyle([
        ('ALIGN', (0, 0), (0, -1), 'RIGHT'),
        ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
        ('BOX', (0, 0), (-1, -1), 1, colors.grey),
        ('LINEABOVE', (0, 2), (-1, 2), 1, colors.black),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 10),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
    ]))
    
    # Right-align totals
    totals_wrapper = Table([[Spacer(1, 1), totals_table]], colWidths=[340, 180])
    elements.append(totals_wrapper)
    elements.append(Spacer(1, 15))
    
    # Payment terms
    terms_data = [
        [Paragraph(f"<b>Payment Terms:</b> {payment_terms} days", normal_style), 
         Paragraph(f"<b>Payment Due:</b> {due_date.strftime('%d/%m/%Y')}", normal_style)],
    ]
    terms_table = Table(terms_data, colWidths=[260, 260])
    elements.append(terms_table)
    elements.append(Spacer(1, 20))
    
    # ========== JOURNEYS TABLE - Gold/Black ==========
    if bookings:
        # Table header
        journey_header = Table([[Paragraph("<b>JOURNEY DETAILS</b>", ParagraphStyle('jh', fontSize=11, fontName='Helvetica-Bold', textColor=colors.white))]], colWidths=[520])
        journey_header.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), header_black),
            ('TEXTCOLOR', (0, 0), (-1, -1), colors.white),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ]))
        elements.append(journey_header)
        
        # Table columns
        table_data = [[
            Paragraph("<b>Item</b>", ParagraphStyle('th', fontSize=8, fontName='Helvetica-Bold')),
            Paragraph("<b>Booker/Passenger</b>", ParagraphStyle('th', fontSize=8, fontName='Helvetica-Bold')),
            Paragraph("<b>Journey/Tariff</b>", ParagraphStyle('th', fontSize=8, fontName='Helvetica-Bold')),
            Paragraph("<b>Cost</b>", ParagraphStyle('th', fontSize=8, fontName='Helvetica-Bold')),
            Paragraph("<b>Tax</b>", ParagraphStyle('th', fontSize=8, fontName='Helvetica-Bold')),
            Paragraph("<b>Total</b>", ParagraphStyle('th', fontSize=8, fontName='Helvetica-Bold')),
        ]]
        
        for idx, b in enumerate(bookings, 1):
            fare = b.get('fare', 0) or 0
            if request and request.custom_prices and b.get('id') in request.custom_prices:
                custom_fare = request.custom_prices[b['id']]
                if custom_fare is not None:
                    fare = custom_fare
            # Ensure fare is a number
            fare = float(fare) if fare else 0.0
            
            tax = fare * vat_rate
            item_total = fare + tax
            
            # Format journey details
            pickup = b.get('pickup_location', '')
            dropoff = b.get('dropoff_location', '')
            journey_text = f"P: {pickup}<br/>D: {dropoff}"
            
            # Add stops if any
            stops = b.get('additional_stops', [])
            if stops:
                for i, stop in enumerate(stops):
                    journey_text = journey_text.replace("D:", f"V{i+1}: {stop}<br/>D:")
            
            # Passenger info
            passenger = f"{b.get('first_name', '')} {b.get('last_name', '')}".strip() or "N/A"
            booking_ref = b.get('booking_id', '')
            
            table_data.append([
                Paragraph(str(idx), small_style),
                Paragraph(f"{booking_ref}<br/>{passenger}", small_style),
                Paragraph(journey_text, small_style),
                Paragraph(f"£{fare:.2f}", small_style),
                Paragraph(f"£{tax:.2f}", small_style),
                Paragraph(f"£{item_total:.2f}", small_style),
            ])
        
        journey_table = Table(table_data, colWidths=[30, 80, 230, 55, 55, 55])
        journey_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#FDF8E8')),
            ('FONTSIZE', (0, 0), (-1, -1), 8),
            ('GRID', (0, 0), (-1, -1), 0.5, gold_accent),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('ALIGN', (3, 0), (-1, -1), 'RIGHT'),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('LEFTPADDING', (0, 0), (-1, -1), 4),
            ('RIGHTPADDING', (0, 0), (-1, -1), 4),
        ]))
        elements.append(journey_table)
        elements.append(Spacer(1, 20))
    
    # ========== FOOTER - BANKING DETAILS - Gold/Black ==========
    bank_title = Table([[Paragraph("<b>BANKING DETAILS</b>", ParagraphStyle('bt', fontSize=10, fontName='Helvetica-Bold', textColor=colors.white))]], colWidths=[520])
    bank_title.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), header_black),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.white),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    elements.append(bank_title)
    
    bank_data = [
        [Paragraph("Bank Name:", label_style), Paragraph("Starling Bank", normal_style),
         Paragraph("Sort Code:", label_style), Paragraph("60-83-71", normal_style)],
        [Paragraph("Account No:", label_style), Paragraph("15222155", normal_style),
         Paragraph("BIC:", label_style), Paragraph("SRLGGB2L", normal_style)],
        [Paragraph("IBAN:", label_style), Paragraph("GB31SRLG60837115222155", normal_style),
         Paragraph("VAT No:", label_style), Paragraph("354626783", normal_style)],
    ]
    bank_table = Table(bank_data, colWidths=[70, 130, 70, 130])
    bank_table.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 1, gold_accent),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E8D5A3')),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#FDF8E8')),
    ]))
    elements.append(bank_table)
    
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
        "vat_rate": client_vat_rate,
        "vat_amount": vat_amount,
        "total": total,
        "journey_count": len(bookings),
        "status": "unpaid",
        "due_date": due_date.isoformat(),
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

class InvoiceUpdate(BaseModel):
    invoice_ref: Optional[str] = None
    subtotal: Optional[float] = None
    vat_rate: Optional[str] = None  # "0", "exempt", "20"
    vat_amount: Optional[float] = None
    total: Optional[float] = None
    status: Optional[str] = None
    notes: Optional[str] = None

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

@router.put("/invoices/{invoice_id}")
async def update_invoice(invoice_id: str, invoice_update: InvoiceUpdate):
    """Update invoice details"""
    invoice = await db.invoices.find_one({"id": invoice_id})
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    update_data = {k: v for k, v in invoice_update.model_dump().items() if v is not None}
    
    # If VAT rate is changed, recalculate amounts
    if "vat_rate" in update_data or "subtotal" in update_data:
        subtotal = update_data.get("subtotal", invoice.get("subtotal", 0))
        vat_rate_str = update_data.get("vat_rate", invoice.get("vat_rate", "20"))
        
        if vat_rate_str == "0" or vat_rate_str == "exempt":
            vat_rate = 0.0
        else:
            vat_rate = 0.20
        
        vat_amount = subtotal * vat_rate
        total = subtotal + vat_amount
        
        update_data["subtotal"] = subtotal
        update_data["vat_amount"] = vat_amount
        update_data["total"] = total
    
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    # If marking as paid, add paid_at timestamp
    if update_data.get("status") == "paid" and invoice.get("status") != "paid":
        update_data["paid_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.invoices.update_one(
        {"id": invoice_id},
        {"$set": update_data}
    )
    
    updated_invoice = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    return updated_invoice

@router.get("/invoices/{invoice_id}/download")
async def download_invoice_pdf(invoice_id: str):
    """Download invoice as PDF"""
    invoice = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    # Get client details
    client = await db.clients.find_one({"id": invoice.get("client_id")}, {"_id": 0})
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    
    # Get bookings for this invoice period
    query = {"client_id": invoice.get("client_id"), "status": "completed"}
    if invoice.get("start_date") or invoice.get("end_date"):
        date_query = {}
        if invoice.get("start_date"):
            date_query["$gte"] = invoice["start_date"]
        if invoice.get("end_date"):
            date_query["$lte"] = invoice["end_date"] + "T23:59:59"
        if date_query:
            query["booking_datetime"] = date_query
    
    bookings = await db.bookings.find(query, {"_id": 0}).sort("booking_datetime", 1).to_list(1000)
    
    # Use stored values from invoice
    subtotal = invoice.get('subtotal', 0) or 0
    vat_amount = invoice.get('vat_amount', 0) or 0
    total = invoice.get('total', 0) or 0
    client_vat_rate = invoice.get('vat_rate', '20')
    
    if client_vat_rate == '0' or client_vat_rate == 'exempt':
        vat_rate = 0.0
        vat_label = "VAT Exempt" if client_vat_rate == 'exempt' else "No VAT (0%)"
    else:
        vat_rate = 0.20
        vat_label = "VAT @ 20%"
    
    # Calculate payment due date
    payment_terms = client.get('payment_terms', 30)
    created_at = invoice.get('created_at', datetime.now(timezone.utc).isoformat())
    if isinstance(created_at, str):
        created_date = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
    else:
        created_date = created_at
    due_date = created_date + timedelta(days=payment_terms)
    
    # Create PDF
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, leftMargin=40, rightMargin=40, topMargin=40, bottomMargin=60)
    elements = []
    styles = getSampleStyleSheet()
    
    # Gold and Black color scheme
    header_black = colors.HexColor('#1a1a1a')
    gold_accent = colors.HexColor('#D4AF37')
    header_gold = colors.HexColor('#C9A227')
    
    company_style = ParagraphStyle('company', parent=styles['Normal'], fontSize=14, fontName='Helvetica-Bold', textColor=header_black)
    normal_style = ParagraphStyle('normal', parent=styles['Normal'], fontSize=9, leading=12)
    small_style = ParagraphStyle('small', parent=styles['Normal'], fontSize=8, leading=10, textColor=colors.grey)
    label_style = ParagraphStyle('label', parent=styles['Normal'], fontSize=8, textColor=colors.grey)
    value_style = ParagraphStyle('value', parent=styles['Normal'], fontSize=9, fontName='Helvetica-Bold')
    
    # Header with Logo
    logo_path = os.path.join(os.path.dirname(__file__), '..', 'assets', 'logo_border.png')
    try:
        logo = Image(logo_path, width=60, height=60)
    except:
        logo = Spacer(60, 60)
    
    company_info = [
        [Paragraph("<b>CJ's Executive Travel Limited</b>", company_style)],
        [Paragraph("Unit 5 Peterlee SR8 2HY", normal_style)],
        [Paragraph("Phone: +44 1917721223", normal_style)],
        [Paragraph("Email: admin@cjstravel.uk", normal_style)],
        [Paragraph("Web: cjstravel.uk", normal_style)],
    ]
    company_table = Table(company_info, colWidths=[200])
    company_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
        ('TOPPADDING', (0, 0), (-1, -1), 0),
    ]))
    
    # Logo + Company info combined
    logo_company = Table([[logo, company_table]], colWidths=[70, 200])
    logo_company.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (0, 0), 0),
        ('RIGHTPADDING', (0, 0), (0, 0), 10),
    ]))
    
    invoice_details = [
        [Paragraph("ACCOUNT NO", label_style), Paragraph(client.get('account_no', ''), value_style)],
        [Paragraph("REFERENCE", label_style), Paragraph(invoice.get('invoice_ref', ''), value_style)],
        [Paragraph("TAX DATE", label_style), Paragraph(created_date.strftime('%d/%m/%Y'), value_style)],
    ]
    invoice_box = Table(invoice_details, colWidths=[70, 100])
    invoice_box.setStyle(TableStyle([
        ('ALIGN', (0, 0), (0, -1), 'RIGHT'),
        ('ALIGN', (1, 0), (1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOX', (0, 0), (-1, -1), 1, gold_accent),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E8D5A3')),
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#FDF8E8')),
    ]))
    
    header_data = [[logo_company, invoice_box]]
    header_table = Table(header_data, colWidths=[340, 180])
    header_table.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP')]))
    elements.append(header_table)
    elements.append(Spacer(1, 20))
    
    # Billing details
    billing_info = [
        [Paragraph("<b>For the attention of:</b>", normal_style)],
        [Paragraph(f"<b>{client.get('name', '')}</b>", value_style)],
    ]
    if client.get('contact_name'):
        billing_info.append([Paragraph(client['contact_name'], normal_style)])
    if client.get('address'):
        for line in client['address'].split('\n'):
            billing_info.append([Paragraph(line.strip(), normal_style)])
    if client.get('town_city'):
        billing_info.append([Paragraph(client['town_city'], normal_style)])
    if client.get('post_code') or client.get('postcode'):
        billing_info.append([Paragraph(client.get('post_code') or client.get('postcode', ''), normal_style)])
    
    billing_table = Table(billing_info, colWidths=[300])
    billing_table.setStyle(TableStyle([
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
        ('TOPPADDING', (0, 0), (-1, -1), 0),
    ]))
    elements.append(billing_table)
    elements.append(Spacer(1, 20))
    
    # Invoice Summary - Gold/Black
    summary_title = Table([[Paragraph("<b>INVOICE SUMMARY</b>", ParagraphStyle('st', fontSize=11, fontName='Helvetica-Bold', textColor=colors.white))]], colWidths=[520])
    summary_title.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), header_black),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
    ]))
    elements.append(summary_title)
    
    summary_data = [[Paragraph(f"<b>Journeys:</b>", normal_style), Paragraph(f"{len(bookings)} Journeys", normal_style), Paragraph(f"Amount: £{subtotal:.2f}", normal_style)]]
    summary_table = Table(summary_data, colWidths=[150, 200, 170])
    summary_table.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 1, gold_accent),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
    ]))
    elements.append(summary_table)
    elements.append(Spacer(1, 10))
    
    # Totals
    totals_data = [
        [Paragraph("Subtotal:", normal_style), Paragraph(f"£{subtotal:.2f}", value_style)],
        [Paragraph(f"{vat_label}:", normal_style), Paragraph(f"£{vat_amount:.2f}", value_style)],
        [Paragraph("<b>Total:</b>", value_style), Paragraph(f"<b>£{total:.2f}</b>", ParagraphStyle('total', fontSize=12, fontName='Helvetica-Bold'))],
    ]
    totals_table = Table(totals_data, colWidths=[100, 80])
    totals_table.setStyle(TableStyle([
        ('ALIGN', (0, 0), (0, -1), 'RIGHT'),
        ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
        ('BOX', (0, 0), (-1, -1), 1, gold_accent),
        ('LINEABOVE', (0, 2), (-1, 2), 1, colors.black),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 10),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
    ]))
    totals_wrapper = Table([[Spacer(1, 1), totals_table]], colWidths=[340, 180])
    elements.append(totals_wrapper)
    elements.append(Spacer(1, 15))
    
    # Payment terms
    terms_data = [[Paragraph(f"<b>Payment Terms:</b> {payment_terms} days", normal_style), 
                   Paragraph(f"<b>Payment Due:</b> {due_date.strftime('%d/%m/%Y')}", normal_style)]]
    terms_table = Table(terms_data, colWidths=[260, 260])
    elements.append(terms_table)
    elements.append(Spacer(1, 20))
    
    # Journeys Table
    if bookings:
        journey_header = Table([[Paragraph("<b>JOURNEY DETAILS</b>", ParagraphStyle('jh', fontSize=11, fontName='Helvetica-Bold', textColor=colors.white))]], colWidths=[520])
        journey_header.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), header_blue),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ]))
        elements.append(journey_header)
        
        table_data = [[
            Paragraph("<b>Item</b>", ParagraphStyle('th', fontSize=8, fontName='Helvetica-Bold')),
            Paragraph("<b>Booker/Passenger</b>", ParagraphStyle('th', fontSize=8, fontName='Helvetica-Bold')),
            Paragraph("<b>Journey/Tariff</b>", ParagraphStyle('th', fontSize=8, fontName='Helvetica-Bold')),
            Paragraph("<b>Cost</b>", ParagraphStyle('th', fontSize=8, fontName='Helvetica-Bold')),
            Paragraph("<b>Tax</b>", ParagraphStyle('th', fontSize=8, fontName='Helvetica-Bold')),
            Paragraph("<b>Total</b>", ParagraphStyle('th', fontSize=8, fontName='Helvetica-Bold')),
        ]]
        
        for idx, b in enumerate(bookings, 1):
            fare = float(b.get('fare', 0) or 0)
            tax = fare * vat_rate
            item_total = fare + tax
            
            pickup = b.get('pickup_location', '')
            dropoff = b.get('dropoff_location', '')
            journey_text = f"P: {pickup}<br/>D: {dropoff}"
            
            passenger = f"{b.get('first_name', '')} {b.get('last_name', '')}".strip() or "N/A"
            booking_ref = b.get('booking_id', '')
            
            table_data.append([
                Paragraph(str(idx), small_style),
                Paragraph(f"{booking_ref}<br/>{passenger}", small_style),
                Paragraph(journey_text, small_style),
                Paragraph(f"£{fare:.2f}", small_style),
                Paragraph(f"£{tax:.2f}", small_style),
                Paragraph(f"£{item_total:.2f}", small_style),
            ])
        
        journey_table = Table(table_data, colWidths=[30, 80, 230, 55, 55, 55])
        journey_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#e9ecef')),
            ('FONTSIZE', (0, 0), (-1, -1), 8),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.lightgrey),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('ALIGN', (3, 0), (-1, -1), 'RIGHT'),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ]))
        elements.append(journey_table)
        elements.append(Spacer(1, 20))
    
    # Banking Details
    bank_title = Table([[Paragraph("<b>BANKING DETAILS</b>", ParagraphStyle('bt', fontSize=10, fontName='Helvetica-Bold', textColor=colors.white))]], colWidths=[520])
    bank_title.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), header_blue),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    elements.append(bank_title)
    
    bank_data = [
        [Paragraph("Bank Name:", label_style), Paragraph("Starling Bank", normal_style),
         Paragraph("Sort Code:", label_style), Paragraph("60-83-71", normal_style)],
        [Paragraph("Account No:", label_style), Paragraph("15222155", normal_style),
         Paragraph("BIC:", label_style), Paragraph("SRLGGB2L", normal_style)],
        [Paragraph("IBAN:", label_style), Paragraph("GB31SRLG60837115222155", normal_style),
         Paragraph("VAT No:", label_style), Paragraph("354626783", normal_style)],
    ]
    bank_table = Table(bank_data, colWidths=[70, 130, 70, 130])
    bank_table.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 1, colors.grey),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.lightgrey),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f8f9fa')),
    ]))
    elements.append(bank_table)
    
    doc.build(elements)
    buffer.seek(0)
    
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={invoice.get('invoice_ref', 'invoice')}.pdf"}
    )

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
