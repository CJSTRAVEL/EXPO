# External API Routes (Google Maps, Postcode, Flight Tracking)
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone, timedelta
import httpx
import logging
import os

from .shared import db

router = APIRouter(tags=["External APIs"])

# API Keys
GOOGLE_MAPS_API_KEY = os.environ.get('GOOGLE_MAPS_API_KEY')
GETADDRESS_API_KEY = os.environ.get('GETADDRESS_API_KEY', 'TI2GnnxHJU2hsaILMSOQjQ49750')
AVIATIONSTACK_API_KEY = os.environ.get('AVIATIONSTACK_API_KEY')


class FlightInfoResponse(BaseModel):
    flight_number: Optional[str] = None
    airline: Optional[str] = None
    airline_iata: Optional[str] = None
    departure_airport: Optional[str] = None
    departure_iata: Optional[str] = None
    arrival_airport: Optional[str] = None
    arrival_iata: Optional[str] = None
    departure_scheduled: Optional[str] = None
    departure_actual: Optional[str] = None
    arrival_scheduled: Optional[str] = None
    arrival_actual: Optional[str] = None
    departure_terminal: Optional[str] = None
    arrival_terminal: Optional[str] = None
    departure_gate: Optional[str] = None
    arrival_gate: Optional[str] = None
    flight_status: Optional[str] = None
    flight_date: Optional[str] = None
    error: Optional[str] = None


@router.get("/directions")
async def get_directions(origin: str, destination: str):
    """Get directions and distance between two locations using Google Maps Directions API"""
    if not GOOGLE_MAPS_API_KEY:
        return {"success": False, "error": "Google Maps API not configured"}
    
    try:
        async with httpx.AsyncClient() as http_client:
            response = await http_client.get(
                "https://maps.googleapis.com/maps/api/directions/json",
                params={
                    "origin": origin,
                    "destination": destination,
                    "key": GOOGLE_MAPS_API_KEY,
                    "units": "imperial",
                    "region": "uk"
                },
                timeout=10.0
            )
            
            if response.status_code == 200:
                data = response.json()
                
                if data.get("status") != "OK":
                    return {
                        "success": False,
                        "error": data.get("status", "Unknown error"),
                        "message": data.get("error_message", "Could not calculate route")
                    }
                
                route = data.get("routes", [{}])[0]
                leg = route.get("legs", [{}])[0]
                
                distance_meters = leg.get("distance", {}).get("value", 0)
                distance_miles = round(distance_meters / 1609.34, 1)
                
                duration_seconds = leg.get("duration", {}).get("value", 0)
                duration_minutes = round(duration_seconds / 60)
                
                if duration_minutes >= 60:
                    hours = duration_minutes // 60
                    mins = duration_minutes % 60
                    duration_text = f"{hours}h {mins}m" if mins > 0 else f"{hours}h"
                else:
                    duration_text = f"{duration_minutes} mins"
                
                return {
                    "success": True,
                    "distance": {
                        "miles": distance_miles,
                        "text": f"{distance_miles} miles",
                        "meters": distance_meters
                    },
                    "duration": {
                        "minutes": duration_minutes,
                        "text": duration_text,
                        "seconds": duration_seconds
                    },
                    "start_address": leg.get("start_address", origin),
                    "end_address": leg.get("end_address", destination),
                    "summary": route.get("summary", ""),
                    "polyline": route.get("overview_polyline", {}).get("points", ""),
                    "start_location": leg.get("start_location", {}),
                    "end_location": leg.get("end_location", {})
                }
            else:
                return {
                    "success": False,
                    "error": "API request failed",
                    "message": f"Status code: {response.status_code}"
                }
                
    except Exception as e:
        logging.error(f"Directions API error: {e}")
        return {"success": False, "error": "Exception", "message": str(e)}


@router.get("/postcode/{postcode}")
async def lookup_postcode(postcode: str):
    """Lookup addresses for a UK postcode using Getaddress.io autocomplete API"""
    clean_postcode = postcode.replace(" ", "").upper()
    
    try:
        async with httpx.AsyncClient() as http_client:
            response = await http_client.get(
                f"https://api.getaddress.io/autocomplete/{clean_postcode}",
                params={"api-key": GETADDRESS_API_KEY},
                timeout=10.0
            )
            
            if response.status_code == 200:
                data = response.json()
                suggestions = data.get("suggestions", [])
                
                if not suggestions:
                    return {"postcode": postcode, "addresses": []}
                
                addresses = []
                for suggestion in suggestions:
                    full_address = suggestion.get("address", "")
                    parts = full_address.split(", ")
                    
                    addresses.append({
                        "line_1": parts[0] if len(parts) > 0 else "",
                        "line_2": parts[1] if len(parts) > 1 else "",
                        "town_or_city": parts[2] if len(parts) > 2 else "",
                        "county": parts[3] if len(parts) > 3 else "",
                        "postcode": parts[4] if len(parts) > 4 else clean_postcode,
                        "full_address": full_address
                    })
                
                formatted_postcode = clean_postcode
                if len(clean_postcode) > 3:
                    formatted_postcode = clean_postcode[:-3] + " " + clean_postcode[-3:]
                
                return {"postcode": formatted_postcode, "addresses": addresses}
            elif response.status_code == 404:
                return {"postcode": postcode, "addresses": [], "error": "Postcode not found"}
            else:
                logging.error(f"Getaddress.io error: {response.status_code} - {response.text}")
                return {"postcode": postcode, "addresses": [], "error": "Lookup failed"}
                
    except Exception as e:
        logging.error(f"Postcode lookup error: {e}")
        return {"postcode": postcode, "addresses": [], "error": str(e)}


@router.get("/flight/{flight_number}")
async def lookup_flight(flight_number: str):
    """Look up live flight data from AviationStack API"""
    if not AVIATIONSTACK_API_KEY:
        return {"error": "Flight tracking not configured"}
    
    flight_number = flight_number.strip().upper().replace(" ", "")
    
    # Check cache first
    cached = await db.flight_cache.find_one({
        "flight_number": flight_number,
        "cached_at": {"$gte": datetime.now(timezone.utc) - timedelta(minutes=30)}
    })
    
    if cached:
        logging.info(f"Flight {flight_number} found in cache")
        del cached["_id"]
        del cached["cached_at"]
        cached["is_cached"] = True
        return cached
    
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(
                "http://api.aviationstack.com/v1/flights",
                params={
                    "access_key": AVIATIONSTACK_API_KEY,
                    "flight_iata": flight_number,
                    "limit": 1
                }
            )
            
            if response.status_code != 200:
                logging.error(f"AviationStack API error: {response.status_code}")
                return {"error": "Flight lookup failed", "flight_number": flight_number}
            
            data = response.json()
            
            if data.get("error"):
                logging.error(f"AviationStack error: {data['error']}")
                return {"error": data["error"].get("message", "API error"), "flight_number": flight_number}
            
            if not data.get("data") or len(data["data"]) == 0:
                return {"error": "Flight not found", "flight_number": flight_number}
            
            flight = data["data"][0]
            
            result = {
                "flight_number": flight.get("flight", {}).get("iata", flight_number),
                "airline": flight.get("airline", {}).get("name"),
                "airline_iata": flight.get("airline", {}).get("iata"),
                "departure_airport": flight.get("departure", {}).get("airport"),
                "departure_iata": flight.get("departure", {}).get("iata"),
                "arrival_airport": flight.get("arrival", {}).get("airport"),
                "arrival_iata": flight.get("arrival", {}).get("iata"),
                "departure_scheduled": flight.get("departure", {}).get("scheduled"),
                "departure_actual": flight.get("departure", {}).get("actual"),
                "departure_estimated": flight.get("departure", {}).get("estimated"),
                "arrival_scheduled": flight.get("arrival", {}).get("scheduled"),
                "arrival_actual": flight.get("arrival", {}).get("actual"),
                "arrival_estimated": flight.get("arrival", {}).get("estimated"),
                "departure_terminal": flight.get("departure", {}).get("terminal"),
                "arrival_terminal": flight.get("arrival", {}).get("terminal"),
                "departure_gate": flight.get("departure", {}).get("gate"),
                "arrival_gate": flight.get("arrival", {}).get("gate"),
                "flight_status": flight.get("flight_status"),
                "flight_date": flight.get("flight_date"),
                "is_cached": False
            }
            
            # Cache the result
            cache_doc = {**result, "cached_at": datetime.now(timezone.utc)}
            await db.flight_cache.update_one(
                {"flight_number": flight_number},
                {"$set": cache_doc},
                upsert=True
            )
            
            logging.info(f"Flight {flight_number} fetched from API: {result.get('flight_status')}")
            return result
            
    except httpx.TimeoutException:
        logging.error(f"Flight lookup timeout for {flight_number}")
        return {"error": "Flight lookup timed out", "flight_number": flight_number}
    except Exception as e:
        logging.error(f"Flight lookup error: {e}")
        return {"error": str(e), "flight_number": flight_number}
