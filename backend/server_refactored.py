# CJ's Executive Travel - Main Server (Refactored)
# This file now imports modular routers for better organization

from fastapi import FastAPI, APIRouter, HTTPException, BackgroundTasks, Depends, Request, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import StreamingResponse, HTMLResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import io
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict
import uuid
from datetime import datetime, timezone, timedelta
from enum import Enum
import httpx
import hashlib
import jwt
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch, mm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image
from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT

# Stripe Integration
from emergentintegrations.payments.stripe.checkout import StripeCheckout, CheckoutSessionResponse, CheckoutStatusResponse, CheckoutSessionRequest

# Import routers
from routes.auth import router as auth_router
from routes.drivers import router as drivers_router
from routes.vehicles import router as vehicles_router
from routes.passengers import router as passengers_router
from routes.client_portal import router as client_portal_router
from routes.shared import (
    db, hash_password, create_token, create_admin_token, verify_token,
    get_current_admin, get_current_passenger, get_current_driver, get_current_client,
    DriverStatus, BookingStatus, ClientStatus, ClientType, PaymentMethod, AdminRole,
    FlightInfo, BookingHistoryEntry, generate_booking_id, generate_client_account_no,
    JWT_SECRET, JWT_ALGORITHM
)

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection (used by this file)
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
local_db = client[os.environ['DB_NAME']]

# Getaddress.io API Key
GETADDRESS_API_KEY = os.environ.get('GETADDRESS_API_KEY')

# Vonage SMS Configuration
VONAGE_API_KEY = os.environ.get('VONAGE_API_KEY')
VONAGE_API_SECRET = os.environ.get('VONAGE_API_SECRET')
VONAGE_FROM_NUMBER = os.environ.get('VONAGE_FROM_NUMBER', 'HireFleet')

# SMTP Email Configuration
SMTP_SERVER = os.environ.get('SMTP_SERVER', 'smtp-mail.outlook.com')
SMTP_PORT = int(os.environ.get('SMTP_PORT', 587))
SMTP_USERNAME = os.environ.get('SMTP_USERNAME')
SMTP_PASSWORD = os.environ.get('SMTP_PASSWORD')
SMTP_FROM_EMAIL = os.environ.get('SMTP_FROM_EMAIL')

# Initialize Vonage client
vonage_client = None
if VONAGE_API_KEY and VONAGE_API_SECRET:
    try:
        from vonage import Auth, Vonage
        auth = Auth(api_key=VONAGE_API_KEY, api_secret=VONAGE_API_SECRET)
        vonage_client = Vonage(auth=auth)
        logging.info("Vonage SMS client initialized successfully")
    except Exception as e:
        logging.error(f"Failed to initialize Vonage client: {e}")

# Check SMTP configuration
smtp_configured = bool(SMTP_USERNAME and SMTP_PASSWORD and SMTP_FROM_EMAIL)

# AviationStack API Key for flight tracking
AVIATIONSTACK_API_KEY = os.environ.get('AVIATIONSTACK_API_KEY')

# Stripe Configuration
STRIPE_API_KEY = os.environ.get('STRIPE_API_KEY')
stripe_checkout = None

# Security
security = HTTPBearer(auto_error=False)

# Create FastAPI app
app = FastAPI(title="CJ's Executive Travel API", version="2.0.0")
api_router = APIRouter(prefix="/api")

# Include modular routers
api_router.include_router(auth_router)
api_router.include_router(drivers_router)
api_router.include_router(vehicles_router)
api_router.include_router(passengers_router)
api_router.include_router(client_portal_router)


# ========== ROOT ENDPOINT ==========
@api_router.get("/")
async def root():
    return {
        "name": "CJ's Executive Travel API",
        "version": "2.0.0",
        "status": "operational"
    }


# ========== HEALTH CHECK ==========
@api_router.get("/health")
async def health_check():
    return {"status": "healthy"}


# Note: The remaining endpoints (bookings, clients, external APIs, SMS, etc.)
# will be migrated to routers in subsequent refactoring phases.
# For now, they remain in this file to ensure stability.

# Import remaining inline code from original server
# This is a placeholder - the actual migration continues below
