"""
Test suite for new booking features:
- Multiple drop-off locations (additional stops)
- Return booking creation
- Flight information tracking
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestMultiStopBookings:
    """Test additional stops (multi-drop) functionality"""
    
    def test_create_booking_with_additional_stops(self):
        """Create a booking with multiple additional stops"""
        booking_data = {
            "first_name": "TEST_MultiStop",
            "last_name": "User",
            "customer_phone": "+44 7700 900100",
            "pickup_location": "Newcastle Airport",
            "dropoff_location": "Durham City Centre",
            "additional_stops": ["Gateshead Metro Centre", "Chester-le-Street"],
            "booking_datetime": (datetime.now() + timedelta(days=2)).isoformat(),
            "fare": 55.0,
            "notes": "Multi-stop test booking"
        }
        
        response = requests.post(f"{BASE_URL}/api/bookings", json=booking_data)
        assert response.status_code == 200, f"Failed to create booking: {response.text}"
        
        data = response.json()
        assert data.get("first_name") == "TEST_MultiStop"
        assert data.get("additional_stops") is not None
        assert len(data.get("additional_stops", [])) == 2
        assert "Gateshead Metro Centre" in data["additional_stops"]
        assert "Chester-le-Street" in data["additional_stops"]
        
        # Store booking ID for cleanup
        self.created_booking_id = data.get("id")
        print(f"Created booking with additional stops: {data.get('booking_id')}")
        
        # Verify by GET
        get_response = requests.get(f"{BASE_URL}/api/bookings/{data['id']}")
        assert get_response.status_code == 200
        fetched = get_response.json()
        assert fetched.get("additional_stops") == ["Gateshead Metro Centre", "Chester-le-Street"]
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/bookings/{data['id']}")
    
    def test_existing_booking_cj009_has_additional_stops(self):
        """Verify CJ-009 test booking has additional stops"""
        response = requests.get(f"{BASE_URL}/api/bookings")
        assert response.status_code == 200
        
        bookings = response.json()
        cj009 = next((b for b in bookings if b.get("booking_id") == "CJ-009"), None)
        
        assert cj009 is not None, "CJ-009 booking not found"
        assert cj009.get("additional_stops") is not None, "CJ-009 should have additional stops"
        assert len(cj009.get("additional_stops", [])) == 2, "CJ-009 should have 2 additional stops"
        assert "Buckingham Palace" in cj009["additional_stops"]
        assert "Westminster Abbey" in cj009["additional_stops"]
        print(f"CJ-009 additional stops verified: {cj009['additional_stops']}")


class TestReturnBookings:
    """Test return booking creation functionality"""
    
    def test_create_booking_with_return(self):
        """Create a booking with return journey option
        
        Return journey logic:
        - If there are additional stops, return pickup = last additional stop
        - Return dropoff = original pickup
        - Reversed stops include original dropoff + reversed remaining stops
        """
        booking_datetime = datetime.now() + timedelta(days=3)
        return_datetime = booking_datetime + timedelta(hours=4)
        
        booking_data = {
            "first_name": "TEST_Return",
            "last_name": "Journey",
            "customer_phone": "+44 7700 900200",
            "pickup_location": "Peterlee Bus Station",
            "dropoff_location": "Sunderland Royal Hospital",
            "additional_stops": ["Seaham Town Centre"],
            "booking_datetime": booking_datetime.isoformat(),
            "fare": 35.0,
            "notes": "Return journey test",
            "create_return": True,
            "return_datetime": return_datetime.isoformat()
        }
        
        response = requests.post(f"{BASE_URL}/api/bookings", json=booking_data)
        assert response.status_code == 200, f"Failed to create booking: {response.text}"
        
        main_booking = response.json()
        assert main_booking.get("first_name") == "TEST_Return"
        assert main_booking.get("linked_booking_id") is not None, "Main booking should have linked_booking_id"
        
        main_id = main_booking.get("id")
        return_id = main_booking.get("linked_booking_id")
        
        print(f"Created main booking: {main_booking.get('booking_id')}")
        print(f"Linked return booking ID: {return_id}")
        
        # Verify return booking was created
        return_response = requests.get(f"{BASE_URL}/api/bookings/{return_id}")
        assert return_response.status_code == 200, "Return booking should exist"
        
        return_booking = return_response.json()
        assert return_booking.get("is_return") == True, "Return booking should have is_return=True"
        assert return_booking.get("linked_booking_id") == main_id, "Return should link back to main"
        
        # Verify return journey logic:
        # With stops: return pickup = last stop (Seaham Town Centre)
        # Return dropoff = original pickup (Peterlee Bus Station)
        assert return_booking.get("pickup_location") == "Seaham Town Centre", "Return pickup should be last additional stop"
        assert return_booking.get("dropoff_location") == "Peterlee Bus Station", "Return dropoff should be original pickup"
        
        # With 1 stop, reversed_stops is empty (None) because:
        # reversed_stops = [dropoff] + reversed(stops[:-1]) if len(stops) > 1 else []
        # With 1 stop: len(stops) = 1, so reversed_stops = [] = None
        assert return_booking.get("additional_stops") is None or return_booking.get("additional_stops") == [], \
            f"Return stops should be empty with 1 original stop, got: {return_booking.get('additional_stops')}"
        
        print(f"Return booking verified: {return_booking.get('booking_id')}")
        
        # Cleanup both bookings
        requests.delete(f"{BASE_URL}/api/bookings/{main_id}")
        requests.delete(f"{BASE_URL}/api/bookings/{return_id}")
    
    def test_existing_linked_bookings_cj009_cj010(self):
        """Verify CJ-009 and CJ-010 are properly linked"""
        response = requests.get(f"{BASE_URL}/api/bookings")
        assert response.status_code == 200
        
        bookings = response.json()
        cj009 = next((b for b in bookings if b.get("booking_id") == "CJ-009"), None)
        cj010 = next((b for b in bookings if b.get("booking_id") == "CJ-010"), None)
        
        assert cj009 is not None, "CJ-009 not found"
        assert cj010 is not None, "CJ-010 not found"
        
        # Verify linking
        assert cj009.get("linked_booking_id") == cj010.get("id"), "CJ-009 should link to CJ-010"
        assert cj010.get("linked_booking_id") == cj009.get("id"), "CJ-010 should link to CJ-009"
        assert cj010.get("is_return") == True, "CJ-010 should be marked as return"
        assert cj009.get("is_return") == False, "CJ-009 should not be marked as return"
        
        # Verify locations are swapped
        # CJ-009: Heathrow -> Downing Street (with stops: Buckingham Palace, Westminster Abbey)
        # CJ-010: Westminster Abbey -> Heathrow (with stops: Downing Street, Buckingham Palace)
        assert "Heathrow" in cj009.get("pickup_location", ""), "CJ-009 pickup should be Heathrow"
        assert "Downing Street" in cj009.get("dropoff_location", ""), "CJ-009 dropoff should be Downing Street"
        
        # Return should have last stop as pickup (Westminster Abbey)
        assert "Westminster Abbey" in cj010.get("pickup_location", ""), "CJ-010 pickup should be Westminster Abbey (last stop)"
        assert "Heathrow" in cj010.get("dropoff_location", ""), "CJ-010 dropoff should be Heathrow"
        
        print("CJ-009 and CJ-010 linking verified successfully")


class TestFlightInfo:
    """Test flight information tracking functionality"""
    
    def test_create_booking_with_flight_info(self):
        """Create a booking with flight information"""
        booking_data = {
            "first_name": "TEST_Flight",
            "last_name": "Passenger",
            "customer_phone": "+44 7700 900300",
            "pickup_location": "Manchester Airport Terminal 2",
            "dropoff_location": "Leeds City Centre",
            "booking_datetime": (datetime.now() + timedelta(days=4)).isoformat(),
            "fare": 85.0,
            "notes": "Flight info test",
            "flight_info": {
                "flight_number": "EZY456",
                "airline": "EasyJet",
                "flight_type": "arrival",
                "terminal": "Terminal 2"
            }
        }
        
        response = requests.post(f"{BASE_URL}/api/bookings", json=booking_data)
        assert response.status_code == 200, f"Failed to create booking: {response.text}"
        
        data = response.json()
        assert data.get("flight_info") is not None, "Booking should have flight_info"
        
        flight_info = data.get("flight_info", {})
        assert flight_info.get("flight_number") == "EZY456"
        assert flight_info.get("airline") == "EasyJet"
        assert flight_info.get("flight_type") == "arrival"
        assert flight_info.get("terminal") == "Terminal 2"
        
        print(f"Created booking with flight info: {data.get('booking_id')}")
        
        # Verify by GET
        get_response = requests.get(f"{BASE_URL}/api/bookings/{data['id']}")
        assert get_response.status_code == 200
        fetched = get_response.json()
        assert fetched.get("flight_info", {}).get("flight_number") == "EZY456"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/bookings/{data['id']}")
    
    def test_existing_booking_cj009_has_flight_info(self):
        """Verify CJ-009 has flight information"""
        response = requests.get(f"{BASE_URL}/api/bookings")
        assert response.status_code == 200
        
        bookings = response.json()
        cj009 = next((b for b in bookings if b.get("booking_id") == "CJ-009"), None)
        
        assert cj009 is not None, "CJ-009 not found"
        assert cj009.get("flight_info") is not None, "CJ-009 should have flight_info"
        
        flight_info = cj009.get("flight_info", {})
        assert flight_info.get("flight_number") == "BA123", "Flight number should be BA123"
        assert flight_info.get("airline") == "British Airways", "Airline should be British Airways"
        assert flight_info.get("flight_type") == "arrival", "Flight type should be arrival"
        assert flight_info.get("terminal") == "Terminal 5", "Terminal should be Terminal 5"
        
        print(f"CJ-009 flight info verified: {flight_info}")


class TestUpdateBookingWithNewFields:
    """Test updating bookings with new fields"""
    
    def test_update_booking_additional_stops(self):
        """Update a booking's additional stops"""
        # First create a booking
        booking_data = {
            "first_name": "TEST_Update",
            "last_name": "Stops",
            "customer_phone": "+44 7700 900400",
            "pickup_location": "Start Location",
            "dropoff_location": "End Location",
            "booking_datetime": (datetime.now() + timedelta(days=5)).isoformat(),
            "fare": 40.0
        }
        
        create_response = requests.post(f"{BASE_URL}/api/bookings", json=booking_data)
        assert create_response.status_code == 200
        booking_id = create_response.json().get("id")
        
        # Update with additional stops
        update_data = {
            "additional_stops": ["Stop A", "Stop B", "Stop C"]
        }
        
        update_response = requests.put(f"{BASE_URL}/api/bookings/{booking_id}", json=update_data)
        assert update_response.status_code == 200
        
        updated = update_response.json()
        assert updated.get("additional_stops") == ["Stop A", "Stop B", "Stop C"]
        
        print(f"Updated booking with additional stops: {updated.get('booking_id')}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/bookings/{booking_id}")
    
    def test_update_booking_flight_info(self):
        """Update a booking's flight information"""
        # First create a booking
        booking_data = {
            "first_name": "TEST_Update",
            "last_name": "Flight",
            "customer_phone": "+44 7700 900500",
            "pickup_location": "Airport",
            "dropoff_location": "Hotel",
            "booking_datetime": (datetime.now() + timedelta(days=6)).isoformat(),
            "fare": 50.0
        }
        
        create_response = requests.post(f"{BASE_URL}/api/bookings", json=booking_data)
        assert create_response.status_code == 200
        booking_id = create_response.json().get("id")
        
        # Update with flight info
        update_data = {
            "flight_info": {
                "flight_number": "RYR789",
                "airline": "Ryanair",
                "flight_type": "departure",
                "terminal": "Terminal 1"
            }
        }
        
        update_response = requests.put(f"{BASE_URL}/api/bookings/{booking_id}", json=update_data)
        assert update_response.status_code == 200
        
        updated = update_response.json()
        assert updated.get("flight_info", {}).get("flight_number") == "RYR789"
        assert updated.get("flight_info", {}).get("airline") == "Ryanair"
        
        print(f"Updated booking with flight info: {updated.get('booking_id')}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/bookings/{booking_id}")


class TestContractWorkWithNewFeatures:
    """Test contract work (client-linked bookings) with new features"""
    
    def test_create_contract_booking_with_all_features(self):
        """Create a contract booking with stops, flight info, and return"""
        # Get a client ID first
        clients_response = requests.get(f"{BASE_URL}/api/clients")
        assert clients_response.status_code == 200
        clients = clients_response.json()
        
        if not clients:
            pytest.skip("No clients available for contract work test")
        
        client_id = clients[0].get("id")
        booking_datetime = datetime.now() + timedelta(days=7)
        return_datetime = booking_datetime + timedelta(hours=5)
        
        booking_data = {
            "first_name": "TEST_Contract",
            "last_name": "Full",
            "customer_phone": "+44 7700 900600",
            "pickup_location": "Client Office",
            "dropoff_location": "Conference Centre",
            "additional_stops": ["Train Station", "Hotel"],
            "booking_datetime": booking_datetime.isoformat(),
            "fare": 75.0,
            "client_id": client_id,
            "flight_info": {
                "flight_number": "BA999",
                "airline": "British Airways",
                "flight_type": "arrival",
                "terminal": "Terminal 3"
            },
            "create_return": True,
            "return_datetime": return_datetime.isoformat()
        }
        
        response = requests.post(f"{BASE_URL}/api/bookings", json=booking_data)
        assert response.status_code == 200, f"Failed to create contract booking: {response.text}"
        
        main_booking = response.json()
        assert main_booking.get("client_id") == client_id, "Should be linked to client"
        assert main_booking.get("additional_stops") is not None
        assert main_booking.get("flight_info") is not None
        assert main_booking.get("linked_booking_id") is not None
        
        main_id = main_booking.get("id")
        return_id = main_booking.get("linked_booking_id")
        
        # Verify return booking also has client_id
        return_response = requests.get(f"{BASE_URL}/api/bookings/{return_id}")
        assert return_response.status_code == 200
        return_booking = return_response.json()
        assert return_booking.get("client_id") == client_id, "Return should also be linked to client"
        
        print(f"Contract booking with all features created: {main_booking.get('booking_id')}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/bookings/{main_id}")
        requests.delete(f"{BASE_URL}/api/bookings/{return_id}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
