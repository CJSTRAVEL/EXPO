"""
Email templates for CJ's Executive Travel
"""

import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import logging
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Base template wrapper
def get_base_template(content: str) -> str:
    return f"""
    <!DOCTYPE html>
    <html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="X-UA-Compatible" content="IE=edge">
        <meta name="x-apple-disable-message-reformatting">
        <meta name="format-detection" content="telephone=no,address=no,email=no,date=no,url=no">
        <title>CJ's Executive Travel</title>
        <!--[if mso]>
        <noscript>
            <xml>
                <o:OfficeDocumentSettings>
                    <o:PixelsPerInch>96</o:PixelsPerInch>
                </o:OfficeDocumentSettings>
            </xml>
        </noscript>
        <![endif]-->
        <style type="text/css">
            body, table, td, a {{ -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }}
            table, td {{ mso-table-lspace: 0pt; mso-table-rspace: 0pt; }}
            img {{ -ms-interpolation-mode: bicubic; }}
            img {{ border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }}
            table {{ border-collapse: collapse !important; }}
            body {{ height: 100% !important; margin: 0 !important; padding: 0 !important; width: 100% !important; }}
            a[x-apple-data-detectors] {{ color: inherit !important; text-decoration: none !important; font-size: inherit !important; font-family: inherit !important; font-weight: inherit !important; line-height: inherit !important; }}
            @media only screen and (max-width: 620px) {{
                .email-container {{ width: 100% !important; }}
            }}
        </style>
    </head>
    <body style="margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; background-color: #f5f5f5; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f5f5f5;">
            <tr>
                <td align="center" style="padding: 20px 10px;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" class="email-container" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                        <!-- Header -->
                        <tr>
                            <td style="background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%); padding: 30px; text-align: center;">
                                <img src="https://customer-assets.emergentagent.com/job_c2bf04a6-1cc1-4dad-86ae-c96a52a9ec62/artifacts/t13g8907_Logo%20With%20Border.png" alt="CJ's Executive Travel" width="80" height="80" style="width: 80px; height: 80px; margin-bottom: 15px; display: block; margin-left: auto; margin-right: auto;">
                                <h1 style="color: #D4A853; margin: 0; font-size: 24px; font-weight: bold; font-family: Arial, Helvetica, sans-serif;">CJ's Executive Travel</h1>
                                <p style="color: #888888; margin: 5px 0 0 0; font-size: 14px; font-family: Arial, Helvetica, sans-serif;">Executive Chauffeur Services</p>
                            </td>
                        </tr>
                        
                        <!-- Content -->
                        <tr>
                            <td style="padding: 30px; font-family: Arial, Helvetica, sans-serif;">
                                {content}
                            </td>
                        </tr>
                        
                        <!-- Footer -->
                        <tr>
                            <td style="background-color: #1a1a1a; padding: 25px; text-align: center;">
                                <p style="color: #D4A853; margin: 0 0 10px 0; font-size: 14px; font-weight: bold; font-family: Arial, Helvetica, sans-serif;">CJ's Executive Travel Limited</p>
                                <p style="color: #888888; margin: 0 0 5px 0; font-size: 12px; font-family: Arial, Helvetica, sans-serif;">Premium Chauffeur & Executive Travel Services</p>
                                <p style="color: #888888; margin: 0 0 5px 0; font-size: 12px; font-family: Arial, Helvetica, sans-serif;">County Durham, United Kingdom</p>
                                <p style="color: #888888; margin: 0 0 15px 0; font-size: 12px; font-family: Arial, Helvetica, sans-serif;">
                                    <a href="mailto:bookings@cjstravel.uk" style="color: #D4A853; text-decoration: none;">bookings@cjstravel.uk</a>
                                </p>
                                <p style="color: #666666; margin: 0; font-size: 11px; font-family: Arial, Helvetica, sans-serif;">
                                    This email was sent from our automated booking system.<br>
                                    If you did not expect this email, please contact us.
                                </p>
                                <p style="color: #555555; margin: 15px 0 0 0; font-size: 11px; font-family: Arial, Helvetica, sans-serif;">
                                    &copy; 2026 CJ's Executive Travel Limited. All rights reserved.
                                </p>
                            </td>
                        </tr>
                    </table>
                    
                    <!-- Post-footer notice -->
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" class="email-container">
                        <tr>
                            <td style="padding: 20px; text-align: center;">
                                <p style="color: #999999; font-size: 11px; margin: 0; font-family: Arial, Helvetica, sans-serif;">
                                    If this email landed in your Junk/Spam folder, please mark it as "Not Spam"<br>
                                    to ensure you receive important booking updates.
                                </p>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>
    """


# ==================== PASSENGER PORTAL TEMPLATES ====================

def get_passenger_account_created_template(name: str) -> str:
    content = f"""
        <h2 style="color: #1a1a1a; margin: 0 0 20px 0; font-size: 22px;">Welcome to CJ's Executive Travel!</h2>
        
        <p style="color: #333333; font-size: 16px; line-height: 1.6;">Dear {name},</p>
        
        <p style="color: #555555; font-size: 15px; line-height: 1.6;">
            Thank you for creating your passenger account with CJ's Executive Travel. We're delighted to have you on board!
        </p>
        
        <div style="background: linear-gradient(135deg, #D4A853 0%, #c49843 100%); border-radius: 8px; padding: 20px; margin: 25px 0; text-align: center;">
            <p style="color: #1a1a1a; margin: 0; font-size: 16px; font-weight: bold;">Your account is now active!</p>
            <p style="color: #333333; margin: 10px 0 0 0; font-size: 14px;">You can now book executive travel services through our portal.</p>
        </div>
        
        <p style="color: #555555; font-size: 15px; line-height: 1.6;">With your new account, you can:</p>
        
        <ul style="color: #555555; font-size: 14px; line-height: 1.8; padding-left: 20px;">
            <li>Book chauffeur services online</li>
            <li>View and manage your bookings</li>
            <li>Track your journey history</li>
            <li>Access exclusive member benefits</li>
        </ul>
        
        <p style="color: #555555; font-size: 15px; line-height: 1.6; margin-top: 25px;">
            If you have any questions or need assistance, our team is here to help.
        </p>
        
        <p style="color: #333333; font-size: 15px; line-height: 1.6; margin-top: 30px;">
            Kind regards,<br>
            <strong style="color: #D4A853;">The CJ's Executive Travel Team</strong>
        </p>
    """
    return get_base_template(content)


def get_passenger_request_submitted_template(name: str, booking_details: dict) -> str:
    pickup = booking_details.get('pickup_location', 'TBC')
    dropoff = booking_details.get('dropoff_location', 'TBC')
    date = booking_details.get('date', 'TBC')
    time = booking_details.get('time', 'TBC')
    passengers = booking_details.get('passengers', 1)
    vehicle = booking_details.get('vehicle_type', 'Standard')
    
    content = f"""
        <h2 style="color: #1a1a1a; margin: 0 0 20px 0; font-size: 22px;">Booking Request Received</h2>
        
        <p style="color: #333333; font-size: 16px; line-height: 1.6;">Dear {name},</p>
        
        <p style="color: #555555; font-size: 15px; line-height: 1.6;">
            Thank you for your booking request. We have received your request and our team is reviewing it now.
        </p>
        
        <div style="background-color: #f8f9fa; border-left: 4px solid #D4A853; border-radius: 4px; padding: 20px; margin: 25px 0;">
            <h3 style="color: #1a1a1a; margin: 0 0 15px 0; font-size: 16px;">Booking Details</h3>
            <table style="width: 100%; font-size: 14px; color: #555555;">
                <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #e0e0e0;"><strong>Date:</strong></td>
                    <td style="padding: 8px 0; border-bottom: 1px solid #e0e0e0;">{date}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #e0e0e0;"><strong>Time:</strong></td>
                    <td style="padding: 8px 0; border-bottom: 1px solid #e0e0e0;">{time}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #e0e0e0;"><strong>Pickup:</strong></td>
                    <td style="padding: 8px 0; border-bottom: 1px solid #e0e0e0;">{pickup}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #e0e0e0;"><strong>Drop-off:</strong></td>
                    <td style="padding: 8px 0; border-bottom: 1px solid #e0e0e0;">{dropoff}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #e0e0e0;"><strong>Passengers:</strong></td>
                    <td style="padding: 8px 0; border-bottom: 1px solid #e0e0e0;">{passengers}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0;"><strong>Vehicle:</strong></td>
                    <td style="padding: 8px 0;">{vehicle}</td>
                </tr>
            </table>
        </div>
        
        <div style="background-color: #fff8e6; border-radius: 8px; padding: 15px; margin: 20px 0;">
            <p style="color: #856404; margin: 0; font-size: 14px;">
                <strong>What happens next?</strong><br>
                We will review your request and send you a confirmation email with the final fare and booking details shortly.
            </p>
        </div>
        
        <p style="color: #333333; font-size: 15px; line-height: 1.6; margin-top: 30px;">
            Kind regards,<br>
            <strong style="color: #D4A853;">The CJ's Executive Travel Team</strong>
        </p>
    """
    return get_base_template(content)


def get_passenger_request_accepted_template(name: str, booking_details: dict) -> str:
    booking_id = booking_details.get('booking_id', 'N/A')
    pickup = booking_details.get('pickup_location', 'TBC')
    dropoff = booking_details.get('dropoff_location', 'TBC')
    date = booking_details.get('date', 'TBC')
    time = booking_details.get('time', 'TBC')
    fare = booking_details.get('fare', 'TBC')
    driver = booking_details.get('driver_name', 'To be assigned')
    vehicle = booking_details.get('vehicle_type', 'Standard')
    
    content = f"""
        <h2 style="color: #1a1a1a; margin: 0 0 20px 0; font-size: 22px;">Booking Confirmed! ✓</h2>
        
        <p style="color: #333333; font-size: 16px; line-height: 1.6;">Dear {name},</p>
        
        <p style="color: #555555; font-size: 15px; line-height: 1.6;">
            Great news! Your booking request has been <strong style="color: #28a745;">accepted and confirmed</strong>.
        </p>
        
        <div style="background: linear-gradient(135deg, #28a745 0%, #20863b 100%); border-radius: 8px; padding: 20px; margin: 25px 0; text-align: center;">
            <p style="color: #ffffff; margin: 0; font-size: 14px;">BOOKING REFERENCE</p>
            <p style="color: #ffffff; margin: 10px 0 0 0; font-size: 28px; font-weight: bold; letter-spacing: 2px;">{booking_id}</p>
        </div>
        
        <div style="background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin: 25px 0;">
            <h3 style="color: #1a1a1a; margin: 0 0 15px 0; font-size: 16px;">Your Journey Details</h3>
            <table style="width: 100%; font-size: 14px; color: #555555;">
                <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #e0e0e0; width: 35%;"><strong>Date:</strong></td>
                    <td style="padding: 8px 0; border-bottom: 1px solid #e0e0e0;">{date}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #e0e0e0;"><strong>Pickup Time:</strong></td>
                    <td style="padding: 8px 0; border-bottom: 1px solid #e0e0e0;">{time}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #e0e0e0;"><strong>Pickup Location:</strong></td>
                    <td style="padding: 8px 0; border-bottom: 1px solid #e0e0e0;">{pickup}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #e0e0e0;"><strong>Drop-off Location:</strong></td>
                    <td style="padding: 8px 0; border-bottom: 1px solid #e0e0e0;">{dropoff}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #e0e0e0;"><strong>Vehicle:</strong></td>
                    <td style="padding: 8px 0; border-bottom: 1px solid #e0e0e0;">{vehicle}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #e0e0e0;"><strong>Driver:</strong></td>
                    <td style="padding: 8px 0; border-bottom: 1px solid #e0e0e0;">{driver}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0;"><strong>Fare:</strong></td>
                    <td style="padding: 8px 0; font-size: 18px; color: #D4A853; font-weight: bold;">£{fare}</td>
                </tr>
            </table>
        </div>
        
        <div style="background-color: #e8f5e9; border-radius: 8px; padding: 15px; margin: 20px 0;">
            <p style="color: #2e7d32; margin: 0; font-size: 14px;">
                <strong>Important:</strong> Please be ready at the pickup location 5 minutes before the scheduled time. Your driver will contact you upon arrival.
            </p>
        </div>
        
        <p style="color: #333333; font-size: 15px; line-height: 1.6; margin-top: 30px;">
            Thank you for choosing CJ's Executive Travel.<br><br>
            Kind regards,<br>
            <strong style="color: #D4A853;">The CJ's Executive Travel Team</strong>
        </p>
    """
    return get_base_template(content)


def get_passenger_request_rejected_template(name: str, reason: str = None) -> str:
    reason_text = reason if reason else "Unfortunately, we are unable to accommodate your request at this time due to availability constraints."
    
    content = f"""
        <h2 style="color: #1a1a1a; margin: 0 0 20px 0; font-size: 22px;">Booking Request Update</h2>
        
        <p style="color: #333333; font-size: 16px; line-height: 1.6;">Dear {name},</p>
        
        <p style="color: #555555; font-size: 15px; line-height: 1.6;">
            Thank you for your recent booking request with CJ's Executive Travel.
        </p>
        
        <div style="background-color: #fff3f3; border-left: 4px solid #dc3545; border-radius: 4px; padding: 20px; margin: 25px 0;">
            <p style="color: #721c24; margin: 0; font-size: 15px;">
                <strong>We regret to inform you that we are unable to confirm your booking.</strong>
            </p>
            <p style="color: #856404; margin: 15px 0 0 0; font-size: 14px;">
                <strong>Reason:</strong> {reason_text}
            </p>
        </div>
        
        <p style="color: #555555; font-size: 15px; line-height: 1.6;">
            We sincerely apologize for any inconvenience this may cause. We would be happy to assist you with an alternative date or time if that would be helpful.
        </p>
        
        <div style="background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin: 25px 0; text-align: center;">
            <p style="color: #555555; margin: 0 0 10px 0; font-size: 14px;">Need to make a new booking?</p>
            <p style="color: #333333; margin: 0; font-size: 14px;">
                Please visit our portal or contact us directly and we'll do our best to accommodate your needs.
            </p>
        </div>
        
        <p style="color: #333333; font-size: 15px; line-height: 1.6; margin-top: 30px;">
            We appreciate your understanding and hope to serve you in the future.<br><br>
            Kind regards,<br>
            <strong style="color: #D4A853;">The CJ's Executive Travel Team</strong>
        </p>
    """
    return get_base_template(content)


# ==================== CORPORATE PORTAL TEMPLATES ====================

def get_corporate_account_created_template(contact_name: str, company_name: str, account_no: str = None) -> str:
    account_section = ""
    if account_no:
        account_section = f"""
        <div style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); border-radius: 8px; padding: 20px; margin: 25px 0; text-align: center;">
            <p style="color: #ffffff; margin: 0; font-size: 14px;">YOUR ACCOUNT NUMBER</p>
            <p style="color: #ffffff; margin: 10px 0 0 0; font-size: 28px; font-weight: bold; letter-spacing: 2px;">{account_no}</p>
        </div>
        """
    else:
        account_section = """
        <div style="background-color: #fff8e6; border-radius: 8px; padding: 20px; margin: 25px 0; text-align: center;">
            <p style="color: #856404; margin: 0; font-size: 14px;">
                <strong>Account Pending Approval</strong><br>
                Your account is being reviewed by our team. We will notify you once it's approved.
            </p>
        </div>
        """
    
    content = f"""
        <h2 style="color: #1a1a1a; margin: 0 0 20px 0; font-size: 22px;">Welcome to CJ's Executive Travel!</h2>
        
        <p style="color: #333333; font-size: 16px; line-height: 1.6;">Dear {contact_name},</p>
        
        <p style="color: #555555; font-size: 15px; line-height: 1.6;">
            Thank you for registering <strong>{company_name}</strong> with CJ's Executive Travel Corporate Services. 
            We're pleased to welcome you as a corporate partner!
        </p>
        
        {account_section}
        
        <p style="color: #555555; font-size: 15px; line-height: 1.6;">As a corporate client, you have access to:</p>
        
        <ul style="color: #555555; font-size: 14px; line-height: 1.8; padding-left: 20px;">
            <li>Priority booking for executive travel</li>
            <li>Dedicated account management</li>
            <li>Monthly invoicing options</li>
            <li>Detailed journey reports and analytics</li>
            <li>Multiple user access for your team</li>
        </ul>
        
        <p style="color: #555555; font-size: 15px; line-height: 1.6; margin-top: 25px;">
            If you have any questions about your account or our services, please don't hesitate to contact us.
        </p>
        
        <p style="color: #333333; font-size: 15px; line-height: 1.6; margin-top: 30px;">
            Kind regards,<br>
            <strong style="color: #D4A853;">The CJ's Executive Travel Team</strong>
        </p>
    """
    return get_base_template(content)


def get_corporate_request_submitted_template(contact_name: str, company_name: str, booking_details: dict) -> str:
    pickup = booking_details.get('pickup_location', 'TBC')
    dropoff = booking_details.get('dropoff_location', 'TBC')
    date = booking_details.get('date', 'TBC')
    time = booking_details.get('time', 'TBC')
    passenger_name = booking_details.get('passenger_name', 'TBC')
    vehicle = booking_details.get('vehicle_type', 'Standard')
    
    content = f"""
        <h2 style="color: #1a1a1a; margin: 0 0 20px 0; font-size: 22px;">Booking Request Received</h2>
        
        <p style="color: #333333; font-size: 16px; line-height: 1.6;">Dear {contact_name},</p>
        
        <p style="color: #555555; font-size: 15px; line-height: 1.6;">
            We have received a booking request from <strong>{company_name}</strong>. Our team is reviewing it now.
        </p>
        
        <div style="background-color: #f0f7ff; border-left: 4px solid #3b82f6; border-radius: 4px; padding: 20px; margin: 25px 0;">
            <h3 style="color: #1a1a1a; margin: 0 0 15px 0; font-size: 16px;">Booking Details</h3>
            <table style="width: 100%; font-size: 14px; color: #555555;">
                <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #d0e3ff;"><strong>Passenger:</strong></td>
                    <td style="padding: 8px 0; border-bottom: 1px solid #d0e3ff;">{passenger_name}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #d0e3ff;"><strong>Date:</strong></td>
                    <td style="padding: 8px 0; border-bottom: 1px solid #d0e3ff;">{date}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #d0e3ff;"><strong>Time:</strong></td>
                    <td style="padding: 8px 0; border-bottom: 1px solid #d0e3ff;">{time}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #d0e3ff;"><strong>Pickup:</strong></td>
                    <td style="padding: 8px 0; border-bottom: 1px solid #d0e3ff;">{pickup}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #d0e3ff;"><strong>Drop-off:</strong></td>
                    <td style="padding: 8px 0; border-bottom: 1px solid #d0e3ff;">{dropoff}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0;"><strong>Vehicle:</strong></td>
                    <td style="padding: 8px 0;">{vehicle}</td>
                </tr>
            </table>
        </div>
        
        <div style="background-color: #fff8e6; border-radius: 8px; padding: 15px; margin: 20px 0;">
            <p style="color: #856404; margin: 0; font-size: 14px;">
                <strong>What happens next?</strong><br>
                We will confirm availability and send you a booking confirmation with the final details shortly.
            </p>
        </div>
        
        <p style="color: #333333; font-size: 15px; line-height: 1.6; margin-top: 30px;">
            Kind regards,<br>
            <strong style="color: #D4A853;">The CJ's Executive Travel Team</strong>
        </p>
    """
    return get_base_template(content)


def get_corporate_request_accepted_template(contact_name: str, company_name: str, booking_details: dict) -> str:
    booking_id = booking_details.get('booking_id', 'N/A')
    pickup = booking_details.get('pickup_location', 'TBC')
    dropoff = booking_details.get('dropoff_location', 'TBC')
    date = booking_details.get('date', 'TBC')
    time = booking_details.get('time', 'TBC')
    fare = booking_details.get('fare', 'TBC')
    passenger_name = booking_details.get('passenger_name', 'TBC')
    driver = booking_details.get('driver_name', 'To be assigned')
    vehicle = booking_details.get('vehicle_type', 'Standard')
    
    content = f"""
        <h2 style="color: #1a1a1a; margin: 0 0 20px 0; font-size: 22px;">Booking Confirmed! ✓</h2>
        
        <p style="color: #333333; font-size: 16px; line-height: 1.6;">Dear {contact_name},</p>
        
        <p style="color: #555555; font-size: 15px; line-height: 1.6;">
            Great news! The booking request for <strong>{company_name}</strong> has been <strong style="color: #28a745;">confirmed</strong>.
        </p>
        
        <div style="background: linear-gradient(135deg, #28a745 0%, #20863b 100%); border-radius: 8px; padding: 20px; margin: 25px 0; text-align: center;">
            <p style="color: #ffffff; margin: 0; font-size: 14px;">BOOKING REFERENCE</p>
            <p style="color: #ffffff; margin: 10px 0 0 0; font-size: 28px; font-weight: bold; letter-spacing: 2px;">{booking_id}</p>
        </div>
        
        <div style="background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin: 25px 0;">
            <h3 style="color: #1a1a1a; margin: 0 0 15px 0; font-size: 16px;">Journey Details</h3>
            <table style="width: 100%; font-size: 14px; color: #555555;">
                <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #e0e0e0; width: 35%;"><strong>Passenger:</strong></td>
                    <td style="padding: 8px 0; border-bottom: 1px solid #e0e0e0;">{passenger_name}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #e0e0e0;"><strong>Date:</strong></td>
                    <td style="padding: 8px 0; border-bottom: 1px solid #e0e0e0;">{date}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #e0e0e0;"><strong>Pickup Time:</strong></td>
                    <td style="padding: 8px 0; border-bottom: 1px solid #e0e0e0;">{time}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #e0e0e0;"><strong>Pickup Location:</strong></td>
                    <td style="padding: 8px 0; border-bottom: 1px solid #e0e0e0;">{pickup}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #e0e0e0;"><strong>Drop-off Location:</strong></td>
                    <td style="padding: 8px 0; border-bottom: 1px solid #e0e0e0;">{dropoff}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #e0e0e0;"><strong>Vehicle:</strong></td>
                    <td style="padding: 8px 0; border-bottom: 1px solid #e0e0e0;">{vehicle}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #e0e0e0;"><strong>Driver:</strong></td>
                    <td style="padding: 8px 0; border-bottom: 1px solid #e0e0e0;">{driver}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0;"><strong>Fare:</strong></td>
                    <td style="padding: 8px 0; font-size: 18px; color: #D4A853; font-weight: bold;">£{fare}</td>
                </tr>
            </table>
        </div>
        
        <div style="background-color: #e8f5e9; border-radius: 8px; padding: 15px; margin: 20px 0;">
            <p style="color: #2e7d32; margin: 0; font-size: 14px;">
                <strong>Note:</strong> This journey will be added to your monthly invoice. The passenger should be ready at the pickup location 5 minutes before the scheduled time.
            </p>
        </div>
        
        <p style="color: #333333; font-size: 15px; line-height: 1.6; margin-top: 30px;">
            Thank you for choosing CJ's Executive Travel.<br><br>
            Kind regards,<br>
            <strong style="color: #D4A853;">The CJ's Executive Travel Team</strong>
        </p>
    """
    return get_base_template(content)


def get_corporate_request_rejected_template(contact_name: str, company_name: str, reason: str = None) -> str:
    reason_text = reason if reason else "Unfortunately, we are unable to accommodate this request at this time due to availability constraints."
    
    content = f"""
        <h2 style="color: #1a1a1a; margin: 0 0 20px 0; font-size: 22px;">Booking Request Update</h2>
        
        <p style="color: #333333; font-size: 16px; line-height: 1.6;">Dear {contact_name},</p>
        
        <p style="color: #555555; font-size: 15px; line-height: 1.6;">
            Thank you for the recent booking request from <strong>{company_name}</strong>.
        </p>
        
        <div style="background-color: #fff3f3; border-left: 4px solid #dc3545; border-radius: 4px; padding: 20px; margin: 25px 0;">
            <p style="color: #721c24; margin: 0; font-size: 15px;">
                <strong>We regret to inform you that we are unable to confirm this booking.</strong>
            </p>
            <p style="color: #856404; margin: 15px 0 0 0; font-size: 14px;">
                <strong>Reason:</strong> {reason_text}
            </p>
        </div>
        
        <p style="color: #555555; font-size: 15px; line-height: 1.6;">
            We sincerely apologize for any inconvenience. Please contact us if you would like to arrange an alternative booking or discuss your requirements.
        </p>
        
        <div style="background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin: 25px 0; text-align: center;">
            <p style="color: #555555; margin: 0 0 10px 0; font-size: 14px;">Need to make a new booking?</p>
            <p style="color: #333333; margin: 0; font-size: 14px;">
                Please visit the corporate portal or contact your account manager.
            </p>
        </div>
        
        <p style="color: #333333; font-size: 15px; line-height: 1.6; margin-top: 30px;">
            We value your partnership and look forward to serving {company_name} again soon.<br><br>
            Kind regards,<br>
            <strong style="color: #D4A853;">The CJ's Executive Travel Team</strong>
        </p>
    """
    return get_base_template(content)


# ==================== EMAIL SENDING FUNCTION ====================

import re
import uuid as uuid_module
from email.utils import formatdate, make_msgid

def strip_html_to_text(html: str) -> str:
    """Convert HTML to plain text for multipart emails"""
    # Remove style and script tags
    text = re.sub(r'<style[^>]*>.*?</style>', '', html, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r'<script[^>]*>.*?</script>', '', text, flags=re.DOTALL | re.IGNORECASE)
    # Replace common HTML entities
    text = text.replace('&nbsp;', ' ')
    text = text.replace('&amp;', '&')
    text = text.replace('&lt;', '<')
    text = text.replace('&gt;', '>')
    text = text.replace('&pound;', '£')
    text = text.replace('&#163;', '£')
    # Replace breaks and paragraphs with newlines
    text = re.sub(r'<br\s*/?>', '\n', text, flags=re.IGNORECASE)
    text = re.sub(r'</p>', '\n\n', text, flags=re.IGNORECASE)
    text = re.sub(r'</div>', '\n', text, flags=re.IGNORECASE)
    text = re.sub(r'</tr>', '\n', text, flags=re.IGNORECASE)
    text = re.sub(r'</li>', '\n', text, flags=re.IGNORECASE)
    # Remove all remaining HTML tags
    text = re.sub(r'<[^>]+>', '', text)
    # Clean up whitespace
    text = re.sub(r'\n\s*\n', '\n\n', text)
    text = re.sub(r' +', ' ', text)
    return text.strip()

def send_email(to_email: str, subject: str, html_content: str) -> bool:
    """Send an email using SMTP configuration with spam-reducing best practices"""
    try:
        smtp_server = os.environ.get('SMTP_SERVER')
        smtp_port = int(os.environ.get('SMTP_PORT', 587))
        smtp_username = os.environ.get('SMTP_USERNAME')
        smtp_password = os.environ.get('SMTP_PASSWORD')
        smtp_from = os.environ.get('SMTP_FROM_EMAIL', smtp_username)
        reply_to = os.environ.get('SMTP_REPLY_TO', 'bookings@cjstravel.uk')
        
        if not all([smtp_server, smtp_username, smtp_password]):
            logging.warning(f"SMTP not configured, cannot send email to {to_email}")
            return False
        
        # Create multipart message with both plain text and HTML (helps avoid spam filters)
        msg = MIMEMultipart('alternative')
        
        # Essential headers
        msg['Subject'] = subject
        msg['From'] = f"CJ's Executive Travel <{smtp_from}>"
        msg['To'] = to_email
        msg['Reply-To'] = reply_to
        
        # Additional headers to improve deliverability
        msg['Message-ID'] = make_msgid(domain='cjstravel.uk')
        msg['Date'] = formatdate(localtime=True)
        msg['X-Mailer'] = 'CJs Executive Travel Booking System'
        msg['X-Priority'] = '3'  # Normal priority
        msg['Precedence'] = 'bulk'
        
        # MIME headers
        msg['MIME-Version'] = '1.0'
        
        # Generate plain text version from HTML (spam filters prefer multipart)
        plain_text = strip_html_to_text(html_content)
        
        # Add plain text footer
        plain_text += "\n\n---\nCJ's Executive Travel Limited\nPremium Chauffeur & Executive Travel Services\nEmail: bookings@cjstravel.uk\n\nThis is an automated message from our booking system."
        
        # Attach both versions - plain text first, then HTML
        # Email clients will display HTML if available, plain text otherwise
        text_part = MIMEText(plain_text, 'plain', 'utf-8')
        html_part = MIMEText(html_content, 'html', 'utf-8')
        
        msg.attach(text_part)
        msg.attach(html_part)
        
        with smtplib.SMTP(smtp_server, smtp_port, timeout=30) as server:
            server.starttls()
            server.login(smtp_username, smtp_password)
            server.sendmail(smtp_from, to_email, msg.as_string())
        
        logging.info(f"Email sent successfully to {to_email}: {subject}")
        return True
        
    except Exception as e:
        logging.error(f"Failed to send email to {to_email}: {str(e)}")
        return False


# ==================== CONVENIENCE FUNCTIONS ====================

def send_passenger_welcome_email(email: str, name: str) -> bool:
    """Send welcome email to new passenger"""
    if not email:
        return False
    html = get_passenger_account_created_template(name)
    return send_email(email, "Welcome to CJ's Executive Travel!", html)


def send_passenger_request_submitted_email(email: str, name: str, booking_details: dict) -> bool:
    """Send booking request submitted email to passenger"""
    if not email:
        return False
    html = get_passenger_request_submitted_template(name, booking_details)
    return send_email(email, "Booking Request Received - CJ's Executive Travel", html)


def send_passenger_request_accepted_email(email: str, name: str, booking_details: dict) -> bool:
    """Send booking confirmed email to passenger"""
    if not email:
        return False
    html = get_passenger_request_accepted_template(name, booking_details)
    return send_email(email, f"Booking Confirmed #{booking_details.get('booking_id', '')} - CJ's Executive Travel", html)


def send_passenger_request_rejected_email(email: str, name: str, reason: str = None) -> bool:
    """Send booking rejected email to passenger"""
    if not email:
        return False
    html = get_passenger_request_rejected_template(name, reason)
    return send_email(email, "Booking Request Update - CJ's Executive Travel", html)


def send_corporate_welcome_email(email: str, contact_name: str, company_name: str, account_no: str = None) -> bool:
    """Send welcome email to new corporate client"""
    if not email:
        return False
    html = get_corporate_account_created_template(contact_name, company_name, account_no)
    return send_email(email, "Welcome to CJ's Executive Travel - Corporate Account", html)


def send_corporate_request_submitted_email(email: str, contact_name: str, company_name: str, booking_details: dict) -> bool:
    """Send booking request submitted email to corporate client"""
    if not email:
        return False
    html = get_corporate_request_submitted_template(contact_name, company_name, booking_details)
    return send_email(email, "Booking Request Received - CJ's Executive Travel", html)


def send_corporate_request_accepted_email(email: str, contact_name: str, company_name: str, booking_details: dict) -> bool:
    """Send booking confirmed email to corporate client"""
    if not email:
        return False
    html = get_corporate_request_accepted_template(contact_name, company_name, booking_details)
    return send_email(email, f"Booking Confirmed #{booking_details.get('booking_id', '')} - CJ's Executive Travel", html)


def send_corporate_request_rejected_email(email: str, contact_name: str, company_name: str, reason: str = None) -> bool:
    """Send booking rejected email to corporate client"""
    if not email:
        return False
    html = get_corporate_request_rejected_template(contact_name, company_name, reason)
    return send_email(email, "Booking Request Update - CJ's Executive Travel", html)
