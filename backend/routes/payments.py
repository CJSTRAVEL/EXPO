# Stripe Payment Routes
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
import uuid
import os
import logging

from emergentintegrations.payments.stripe.checkout import StripeCheckout, CheckoutSessionRequest

from .shared import db

router = APIRouter(tags=["Payments"])

STRIPE_API_KEY = os.environ.get('STRIPE_API_KEY')
stripe_checkout = None


class PaymentRequest(BaseModel):
    booking_id: str
    amount: float
    origin_url: str
    customer_email: Optional[str] = None
    customer_name: Optional[str] = None


@router.post("/payments/create-checkout")
async def create_payment_checkout(request: Request, payment_request: PaymentRequest):
    """Create a Stripe checkout session for a booking payment"""
    global stripe_checkout
    
    if not STRIPE_API_KEY:
        raise HTTPException(status_code=500, detail="Stripe is not configured")
    
    try:
        host_url = str(request.base_url).rstrip('/')
        webhook_url = f"{host_url}/api/webhook/stripe"
        stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
        
        booking = await db.bookings.find_one({"id": payment_request.booking_id})
        if not booking:
            raise HTTPException(status_code=404, detail="Booking not found")
        
        origin = payment_request.origin_url.rstrip('/')
        success_url = f"{origin}/bookings?payment=success&session_id={{CHECKOUT_SESSION_ID}}"
        cancel_url = f"{origin}/bookings?payment=cancelled"
        
        checkout_request = CheckoutSessionRequest(
            amount=float(payment_request.amount),
            currency="gbp",
            success_url=success_url,
            cancel_url=cancel_url,
            metadata={
                "booking_id": payment_request.booking_id,
                "customer_name": payment_request.customer_name or booking.get('customer_name', ''),
                "customer_email": payment_request.customer_email or booking.get('customer_email', ''),
            }
        )
        
        session = await stripe_checkout.create_checkout_session(checkout_request)
        
        payment_transaction = {
            "id": str(uuid.uuid4()),
            "session_id": session.session_id,
            "booking_id": payment_request.booking_id,
            "amount": payment_request.amount,
            "currency": "gbp",
            "customer_name": payment_request.customer_name or booking.get('customer_name', ''),
            "customer_email": payment_request.customer_email or booking.get('customer_email', ''),
            "payment_status": "pending",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.payment_transactions.insert_one(payment_transaction)
        
        logging.info(f"Created Stripe checkout session {session.session_id} for booking {payment_request.booking_id}")
        
        return {
            "checkout_url": session.url,
            "session_id": session.session_id
        }
    except Exception as e:
        logging.error(f"Error creating checkout session: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/payments/status/{session_id}")
async def get_payment_status(request: Request, session_id: str):
    """Get the status of a payment session"""
    global stripe_checkout
    
    if not STRIPE_API_KEY:
        raise HTTPException(status_code=500, detail="Stripe is not configured")
    
    try:
        host_url = str(request.base_url).rstrip('/')
        webhook_url = f"{host_url}/api/webhook/stripe"
        stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
        
        status = await stripe_checkout.get_checkout_status(session_id)
        
        update_data = {
            "payment_status": status.payment_status,
            "status": status.status,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        transaction = await db.payment_transactions.find_one({"session_id": session_id})
        if transaction:
            await db.payment_transactions.update_one(
                {"session_id": session_id},
                {"$set": update_data}
            )
            
            if status.payment_status == "paid":
                await db.bookings.update_one(
                    {"id": transaction["booking_id"]},
                    {"$set": {
                        "payment_status": "paid",
                        "payment_session_id": session_id,
                        "payment_date": datetime.now(timezone.utc).isoformat()
                    }}
                )
                logging.info(f"Payment successful for booking {transaction['booking_id']}")
        
        return {
            "status": status.status,
            "payment_status": status.payment_status,
            "amount_total": status.amount_total,
            "currency": status.currency,
            "metadata": status.metadata
        }
    except Exception as e:
        logging.error(f"Error getting payment status: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    """Handle Stripe webhook events"""
    global stripe_checkout
    
    if not STRIPE_API_KEY:
        raise HTTPException(status_code=500, detail="Stripe is not configured")
    
    try:
        host_url = str(request.base_url).rstrip('/')
        webhook_url = f"{host_url}/api/webhook/stripe"
        stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
        
        payload = await request.body()
        
        # Process the webhook
        event_type = (await request.json()).get("type", "")
        
        if event_type == "checkout.session.completed":
            session = (await request.json()).get("data", {}).get("object", {})
            session_id = session.get("id")
            
            if session_id:
                transaction = await db.payment_transactions.find_one({"session_id": session_id})
                if transaction:
                    await db.payment_transactions.update_one(
                        {"session_id": session_id},
                        {"$set": {
                            "payment_status": "paid",
                            "updated_at": datetime.now(timezone.utc).isoformat()
                        }}
                    )
                    
                    await db.bookings.update_one(
                        {"id": transaction["booking_id"]},
                        {"$set": {
                            "payment_status": "paid",
                            "payment_session_id": session_id,
                            "payment_date": datetime.now(timezone.utc).isoformat()
                        }}
                    )
                    
                    logging.info(f"Webhook: Payment successful for booking {transaction['booking_id']}")
        
        return {"status": "received"}
    except Exception as e:
        logging.error(f"Webhook error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
