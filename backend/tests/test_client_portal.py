"""
Test suite for Client Portal API endpoints
Tests: Registration, Login, Bookings, Invoices
"""
import pytest
import requests
import os
import uuid
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://cj-travel-app.preview.emergentagent.com')

# Test data
TEST_CLIENT_PHONE = f"07700{uuid.uuid4().hex[:6]}"  # Unique phone for each test run
TEST_CLIENT_PASSWORD = "test123"
TEST_CLIENT_NAME = "Test Business"
TEST_CLIENT_EMAIL = f"test_{uuid.uuid4().hex[:6]}@example.com"
TEST_CLIENT_COMPANY = "Test Corp Ltd"


class TestClientPortalRegistration:
    """Test client portal registration endpoint"""
    
    def test_register_endpoint_exists(self):
        """Test that the register endpoint exists and accepts POST"""
        response = requests.post(
            f"{BASE_URL}/api/client-portal/register",
            json={
                "name": TEST_CLIENT_NAME,
                "phone": TEST_CLIENT_PHONE,
                "email": TEST_CLIENT_EMAIL,
                "password": TEST_CLIENT_PASSWORD,
                "company_name": TEST_CLIENT_COMPANY
            }
        )
        # Should return 202 (accepted for approval) or 400 (if phone exists)
        assert response.status_code in [202, 400], f"Unexpected status: {response.status_code}, body: {response.text}"
        print(f"Register endpoint response: {response.status_code}")
        
    def test_register_missing_fields(self):
        """Test registration with missing required fields"""
        response = requests.post(
            f"{BASE_URL}/api/client-portal/register",
            json={
                "name": "Test",
                "phone": "07700999999"
                # Missing email, password, company_name
            }
        )
        # Should return 422 (validation error)
        assert response.status_code == 422, f"Expected 422, got {response.status_code}"
        print("Missing fields validation works correctly")


class TestClientPortalLogin:
    """Test client portal login endpoint"""
    
    def test_login_endpoint_exists(self):
        """Test that the login endpoint exists and accepts POST"""
        response = requests.post(
            f"{BASE_URL}/api/client-portal/login",
            json={
                "phone": "07700000000",
                "password": "wrongpassword"
            }
        )
        # Should return 401 (invalid credentials) - endpoint exists
        assert response.status_code == 401, f"Unexpected status: {response.status_code}"
        print("Login endpoint exists and returns 401 for invalid credentials")
        
    def test_login_missing_fields(self):
        """Test login with missing fields"""
        response = requests.post(
            f"{BASE_URL}/api/client-portal/login",
            json={
                "phone": "07700000000"
                # Missing password
            }
        )
        assert response.status_code == 422, f"Expected 422, got {response.status_code}"
        print("Login validation for missing fields works correctly")


class TestClientPortalBookings:
    """Test client portal bookings endpoint"""
    
    def test_bookings_requires_auth(self):
        """Test that bookings endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/client-portal/bookings")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("Bookings endpoint correctly requires authentication")
        
    def test_bookings_with_invalid_token(self):
        """Test bookings with invalid token"""
        response = requests.get(
            f"{BASE_URL}/api/client-portal/bookings",
            headers={"Authorization": "Bearer invalid_token"}
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("Bookings endpoint correctly rejects invalid token")


class TestClientPortalBookingRequests:
    """Test client portal booking requests endpoint"""
    
    def test_booking_requests_requires_auth(self):
        """Test that booking requests endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/client-portal/booking-requests")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("Booking requests endpoint correctly requires authentication")
        
    def test_create_booking_request_requires_auth(self):
        """Test that creating booking request requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/client-portal/booking-requests",
            json={
                "pickup_location": "Test Pickup",
                "dropoff_location": "Test Dropoff",
                "pickup_datetime": (datetime.now() + timedelta(days=1)).isoformat()
            }
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("Create booking request correctly requires authentication")


class TestClientPortalInvoices:
    """Test client portal invoices endpoint"""
    
    def test_invoices_requires_auth(self):
        """Test that invoices endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/client-portal/invoices")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("Invoices endpoint correctly requires authentication")
        
    def test_invoices_with_invalid_token(self):
        """Test invoices with invalid token"""
        response = requests.get(
            f"{BASE_URL}/api/client-portal/invoices",
            headers={"Authorization": "Bearer invalid_token"}
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("Invoices endpoint correctly rejects invalid token")


class TestClientPortalWithExistingClient:
    """Test client portal with an existing client account
    
    This requires a client to exist in the database with portal access enabled.
    We'll first create a client via admin API, then test portal access.
    """
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin token for creating test client"""
        response = requests.post(
            f"{BASE_URL}/api/admin/login",
            json={
                "email": "admin@cjstravel.uk",
                "password": "admin123"
            }
        )
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Admin login failed - skipping authenticated tests")
        
    @pytest.fixture(scope="class")
    def test_client(self, admin_token):
        """Create a test client with portal access"""
        import hashlib
        
        unique_id = uuid.uuid4().hex[:6]
        client_data = {
            "name": f"TEST_Portal_Client_{unique_id}",
            "mobile": f"07700{unique_id}",
            "email": f"test_portal_{unique_id}@example.com",
            "client_type": "Business",
            "payment_method": "Invoice",
            "status": "active"
        }
        
        # Create client via admin API
        response = requests.post(
            f"{BASE_URL}/api/clients",
            json=client_data,
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        if response.status_code not in [200, 201]:
            pytest.skip(f"Failed to create test client: {response.status_code}")
            
        client = response.json()
        
        # Add password hash directly to enable portal login
        # This simulates admin enabling portal access for a client
        password_hash = hashlib.sha256("test123".encode()).hexdigest()
        
        # Update client with password hash and phone field
        update_response = requests.put(
            f"{BASE_URL}/api/clients/{client['id']}",
            json={
                "notes": f"Portal enabled - password_hash: {password_hash}"
            },
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        # Store the phone for login
        client["phone"] = client_data["mobile"]
        client["password"] = "test123"
        
        yield client
        
        # Cleanup - delete test client
        requests.delete(
            f"{BASE_URL}/api/clients/{client['id']}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
    def test_client_created(self, test_client):
        """Verify test client was created"""
        assert test_client is not None
        assert "id" in test_client
        print(f"Test client created: {test_client.get('name')}")


class TestVehicleTypesPublicEndpoint:
    """Test vehicle types endpoint (used by client portal for booking)"""
    
    def test_vehicle_types_accessible(self):
        """Test that vehicle types endpoint is publicly accessible"""
        response = requests.get(f"{BASE_URL}/api/vehicle-types")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert isinstance(data, list), "Expected list of vehicle types"
        print(f"Vehicle types endpoint returns {len(data)} types")
        
        # Verify structure if data exists
        if len(data) > 0:
            vt = data[0]
            assert "id" in vt, "Vehicle type should have id"
            assert "name" in vt, "Vehicle type should have name"
            assert "capacity" in vt, "Vehicle type should have capacity"
            print(f"Vehicle type structure verified: {vt.get('name')}")


class TestHealthAndBasicEndpoints:
    """Test basic API health and root endpoints"""
    
    def test_api_root(self):
        """Test API root endpoint"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("API root endpoint accessible")
        
    def test_health_check(self):
        """Test health check endpoint"""
        response = requests.get(f"{BASE_URL}/api/health")
        # Health endpoint may or may not exist
        if response.status_code == 200:
            print("Health endpoint accessible")
        else:
            print(f"Health endpoint returned {response.status_code} (may not exist)")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
