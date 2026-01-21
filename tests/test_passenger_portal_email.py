"""
Test suite for Passenger Portal Email Field and Google Maps API Key fixes
Tests:
1. Passenger Portal email field in booking request form
2. Booking request submission with customer_email field
3. Admin booking requests endpoint returns new fields (passenger_email, passenger_count, luggage_count, additional_stops)
4. Google Maps API key from environment variable - /api/directions endpoint
"""

import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials from the review request
TEST_PHONE = "+447700900123"
TEST_PASSWORD = "test123"


class TestGoogleMapsAPIKey:
    """Test that Google Maps API key is read from environment variable"""
    
    def test_directions_endpoint_works(self):
        """Verify /api/directions endpoint still works with env variable API key"""
        response = requests.get(
            f"{BASE_URL}/api/directions",
            params={
                "origin": "London, UK",
                "destination": "Manchester, UK"
            }
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        # Verify successful response structure
        assert data.get("success") == True, f"Expected success=True, got {data}"
        assert "distance" in data, "Missing distance in response"
        assert "duration" in data, "Missing duration in response"
        assert data["distance"]["miles"] > 0, "Distance should be positive"
        print(f"✓ Directions API working: {data['distance']['text']} in {data['duration']['text']}")
    
    def test_directions_with_uk_postcodes(self):
        """Test directions with UK postcodes"""
        response = requests.get(
            f"{BASE_URL}/api/directions",
            params={
                "origin": "SW1A 1AA",  # Buckingham Palace
                "destination": "EC1A 1BB"  # Near St Paul's
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True, f"Directions failed: {data}"
        print(f"✓ Postcode directions working: {data['distance']['text']}")


class TestPassengerAuthentication:
    """Test passenger login to get auth token"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token for passenger"""
        # First try to login
        response = requests.post(
            f"{BASE_URL}/api/passenger/login",
            json={
                "phone": TEST_PHONE,
                "password": TEST_PASSWORD
            }
        )
        
        if response.status_code == 200:
            return response.json().get("token")
        
        # If login fails, try to register
        if response.status_code == 401:
            register_response = requests.post(
                f"{BASE_URL}/api/passenger/register",
                json={
                    "name": "Test Passenger",
                    "phone": TEST_PHONE,
                    "email": "test@example.com",
                    "password": TEST_PASSWORD
                }
            )
            
            if register_response.status_code == 200:
                return register_response.json().get("token")
            elif register_response.status_code == 400:
                # Already registered, try login again
                login_retry = requests.post(
                    f"{BASE_URL}/api/passenger/login",
                    json={
                        "phone": TEST_PHONE,
                        "password": TEST_PASSWORD
                    }
                )
                if login_retry.status_code == 200:
                    return login_retry.json().get("token")
        
        pytest.skip("Could not authenticate passenger")
    
    def test_passenger_login(self, auth_token):
        """Verify passenger can login"""
        assert auth_token is not None, "Failed to get auth token"
        print(f"✓ Passenger authenticated successfully")


class TestBookingRequestWithEmail:
    """Test booking request submission with customer_email field"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token for passenger"""
        response = requests.post(
            f"{BASE_URL}/api/passenger/login",
            json={
                "phone": TEST_PHONE,
                "password": TEST_PASSWORD
            }
        )
        
        if response.status_code == 200:
            return response.json().get("token")
        
        # Try to register if login fails
        if response.status_code == 401:
            register_response = requests.post(
                f"{BASE_URL}/api/passenger/register",
                json={
                    "name": "Test Passenger",
                    "phone": TEST_PHONE,
                    "email": "test@example.com",
                    "password": TEST_PASSWORD
                }
            )
            
            if register_response.status_code == 200:
                return register_response.json().get("token")
            elif register_response.status_code == 400:
                # Already registered, try login again
                login_retry = requests.post(
                    f"{BASE_URL}/api/passenger/login",
                    json={
                        "phone": TEST_PHONE,
                        "password": TEST_PASSWORD
                    }
                )
                if login_retry.status_code == 200:
                    return login_retry.json().get("token")
        
        pytest.skip("Could not authenticate passenger")
    
    def test_submit_booking_request_with_email(self, auth_token):
        """Test submitting a booking request with customer_email field"""
        pickup_datetime = (datetime.now() + timedelta(days=1)).isoformat()
        test_email = "testcustomer@example.com"
        
        response = requests.post(
            f"{BASE_URL}/api/passenger/booking-requests",
            json={
                "pickup_location": "123 Test Street, London",
                "dropoff_location": "456 Destination Road, Manchester",
                "pickup_datetime": pickup_datetime,
                "passenger_count": 2,
                "luggage_count": 3,
                "customer_email": test_email,
                "notes": "Test booking with email field",
                "additional_stops": ["789 Via Street, Birmingham"]
            },
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "id" in data, "Response should contain booking request ID"
        print(f"✓ Booking request submitted with email: {data['id']}")
        return data["id"]
    
    def test_submit_booking_request_without_email(self, auth_token):
        """Test submitting a booking request without customer_email (should still work)"""
        pickup_datetime = (datetime.now() + timedelta(days=2)).isoformat()
        
        response = requests.post(
            f"{BASE_URL}/api/passenger/booking-requests",
            json={
                "pickup_location": "Test Pickup Location",
                "dropoff_location": "Test Dropoff Location",
                "pickup_datetime": pickup_datetime,
                "passenger_count": 1,
                "luggage_count": 0,
                "notes": "Test booking without email"
            },
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print(f"✓ Booking request submitted without email (optional field works)")


class TestAdminBookingRequests:
    """Test admin booking requests endpoint returns new fields"""
    
    def test_admin_booking_requests_returns_new_fields(self):
        """Verify admin endpoint returns passenger_email, passenger_count, luggage_count, additional_stops"""
        response = requests.get(f"{BASE_URL}/api/admin/booking-requests")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        # Should return a list
        assert isinstance(data, list), "Expected list of booking requests"
        
        if len(data) > 0:
            # Check first request has the new fields
            request = data[0]
            
            # These fields should exist in the response (may be null)
            expected_fields = [
                "passenger_email",
                "passenger_count", 
                "luggage_count",
                "additional_stops",
                "passenger_name",
                "passenger_phone",
                "pickup_location",
                "dropoff_location",
                "pickup_datetime",
                "status"
            ]
            
            for field in expected_fields:
                assert field in request, f"Missing field '{field}' in booking request response"
            
            print(f"✓ Admin booking requests endpoint returns all new fields")
            print(f"  - passenger_email: {request.get('passenger_email')}")
            print(f"  - passenger_count: {request.get('passenger_count')}")
            print(f"  - luggage_count: {request.get('luggage_count')}")
            print(f"  - additional_stops: {request.get('additional_stops')}")
        else:
            print("⚠ No booking requests found to verify fields (test data may need to be created first)")
    
    def test_booking_request_with_email_appears_in_admin(self):
        """Create a booking request with email and verify it appears in admin endpoint"""
        # First login
        login_response = requests.post(
            f"{BASE_URL}/api/passenger/login",
            json={
                "phone": TEST_PHONE,
                "password": TEST_PASSWORD
            }
        )
        
        if login_response.status_code != 200:
            # Try to register
            register_response = requests.post(
                f"{BASE_URL}/api/passenger/register",
                json={
                    "name": "Test Passenger",
                    "phone": TEST_PHONE,
                    "email": "test@example.com",
                    "password": TEST_PASSWORD
                }
            )
            if register_response.status_code == 200:
                token = register_response.json().get("token")
            else:
                pytest.skip("Could not authenticate")
        else:
            token = login_response.json().get("token")
        
        # Create booking request with specific email
        test_email = f"admin_test_{datetime.now().timestamp()}@example.com"
        pickup_datetime = (datetime.now() + timedelta(days=3)).isoformat()
        
        create_response = requests.post(
            f"{BASE_URL}/api/passenger/booking-requests",
            json={
                "pickup_location": "Admin Test Pickup",
                "dropoff_location": "Admin Test Dropoff",
                "pickup_datetime": pickup_datetime,
                "passenger_count": 4,
                "luggage_count": 2,
                "customer_email": test_email,
                "additional_stops": ["Stop 1", "Stop 2"]
            },
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert create_response.status_code == 200, f"Failed to create booking request: {create_response.text}"
        request_id = create_response.json()["id"]
        
        # Now check admin endpoint
        admin_response = requests.get(f"{BASE_URL}/api/admin/booking-requests")
        assert admin_response.status_code == 200
        
        requests_list = admin_response.json()
        
        # Find our request
        our_request = None
        for req in requests_list:
            if req.get("id") == request_id:
                our_request = req
                break
        
        assert our_request is not None, f"Created request {request_id} not found in admin endpoint"
        
        # Verify the new fields
        assert our_request.get("passenger_email") == test_email, f"Expected email {test_email}, got {our_request.get('passenger_email')}"
        assert our_request.get("passenger_count") == 4, f"Expected passenger_count 4, got {our_request.get('passenger_count')}"
        assert our_request.get("luggage_count") == 2, f"Expected luggage_count 2, got {our_request.get('luggage_count')}"
        assert our_request.get("additional_stops") == ["Stop 1", "Stop 2"], f"Expected additional_stops, got {our_request.get('additional_stops')}"
        
        print(f"✓ Booking request with email verified in admin endpoint")
        print(f"  - ID: {request_id}")
        print(f"  - Email: {our_request.get('passenger_email')}")
        print(f"  - Passengers: {our_request.get('passenger_count')}")
        print(f"  - Luggage: {our_request.get('luggage_count')}")
        print(f"  - Stops: {our_request.get('additional_stops')}")


class TestBookingRequestCreateModel:
    """Test that BookingRequestCreate model accepts all new fields"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token for passenger"""
        response = requests.post(
            f"{BASE_URL}/api/passenger/login",
            json={
                "phone": TEST_PHONE,
                "password": TEST_PASSWORD
            }
        )
        
        if response.status_code == 200:
            return response.json().get("token")
        
        # Try to register if login fails
        register_response = requests.post(
            f"{BASE_URL}/api/passenger/register",
            json={
                "name": "Test Passenger",
                "phone": TEST_PHONE,
                "email": "test@example.com",
                "password": TEST_PASSWORD
            }
        )
        
        if register_response.status_code == 200:
            return register_response.json().get("token")
        
        # Already registered, try login again
        login_retry = requests.post(
            f"{BASE_URL}/api/passenger/login",
            json={
                "phone": TEST_PHONE,
                "password": TEST_PASSWORD
            }
        )
        if login_retry.status_code == 200:
            return login_retry.json().get("token")
        
        pytest.skip("Could not authenticate passenger")
    
    def test_full_booking_request_with_all_fields(self, auth_token):
        """Test booking request with all new fields including return journey"""
        pickup_datetime = (datetime.now() + timedelta(days=5)).isoformat()
        return_datetime = (datetime.now() + timedelta(days=6)).isoformat()
        
        response = requests.post(
            f"{BASE_URL}/api/passenger/booking-requests",
            json={
                "pickup_location": "Full Test Pickup",
                "dropoff_location": "Full Test Dropoff",
                "pickup_datetime": pickup_datetime,
                "passenger_count": 3,
                "luggage_count": 4,
                "customer_email": "fulltest@example.com",
                "notes": "Full test with all fields",
                "additional_stops": ["Via Point 1", "Via Point 2"],
                "flight_number": "BA123",
                "flight_info": {
                    "flight_number": "BA123",
                    "airline": "British Airways",
                    "flight_type": "arrival",
                    "terminal": "Terminal 5"
                },
                "create_return": True,
                "return_pickup_location": "Return Pickup",
                "return_dropoff_location": "Return Dropoff",
                "return_datetime": return_datetime,
                "return_additional_stops": ["Return Via 1"],
                "return_flight_info": {
                    "flight_number": "BA456",
                    "airline": "British Airways",
                    "flight_type": "departure",
                    "terminal": "Terminal 5"
                }
            },
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "id" in data
        print(f"✓ Full booking request with all fields submitted: {data['id']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
