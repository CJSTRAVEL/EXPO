"""
Test suite for Admin Passenger Management feature
Tests: GET /api/admin/passengers, PUT /api/admin/passengers/{id}/block, 
       PUT /api/admin/passengers/{id}/unblock, DELETE /api/admin/passengers/{id}
       POST /api/passenger/login (blocked passenger check)
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test data prefix for cleanup
TEST_PREFIX = "TEST_ADMIN_PASSENGER_"


class TestAdminPassengerManagement:
    """Test admin passenger management endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test data"""
        self.test_phone = f"+447700{uuid.uuid4().hex[:6]}"
        self.test_password = "testpass123"
        self.test_name = f"{TEST_PREFIX}User"
        self.created_passenger_id = None
        yield
        # Cleanup: Delete test passenger if created
        if self.created_passenger_id:
            try:
                requests.delete(f"{BASE_URL}/api/admin/passengers/{self.created_passenger_id}")
            except:
                pass
    
    def test_01_get_all_passengers(self):
        """Test GET /api/admin/passengers - List all passengers"""
        response = requests.get(f"{BASE_URL}/api/admin/passengers")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        # Check structure of passenger objects
        if len(data) > 0:
            passenger = data[0]
            assert "id" in passenger, "Passenger should have 'id'"
            assert "name" in passenger, "Passenger should have 'name'"
            assert "phone" in passenger, "Passenger should have 'phone'"
            assert "created_at" in passenger, "Passenger should have 'created_at'"
            assert "booking_count" in passenger, "Passenger should have 'booking_count'"
            # password_hash should NOT be exposed
            assert "password_hash" not in passenger, "password_hash should not be exposed"
        
        print(f"✓ GET /api/admin/passengers returned {len(data)} passengers")
    
    def test_02_create_test_passenger(self):
        """Create a test passenger for subsequent tests"""
        # First register a passenger via the passenger register endpoint
        response = requests.post(f"{BASE_URL}/api/passenger/register", json={
            "name": self.test_name,
            "phone": self.test_phone,
            "password": self.test_password,
            "email": "testadmin@example.com"
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "id" in data, "Response should contain passenger id"
        self.created_passenger_id = data["id"]
        
        print(f"✓ Created test passenger with ID: {self.created_passenger_id}")
        return self.created_passenger_id
    
    def test_03_passenger_login_success(self):
        """Test that a normal passenger can login"""
        # First create a passenger
        passenger_id = self.test_02_create_test_passenger()
        
        # Try to login
        response = requests.post(f"{BASE_URL}/api/passenger/login", json={
            "phone": self.test_phone,
            "password": self.test_password
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "token" in data, "Response should contain token"
        assert data["name"] == self.test_name, "Name should match"
        
        print(f"✓ Passenger login successful")
    
    def test_04_block_passenger(self):
        """Test PUT /api/admin/passengers/{id}/block - Block a passenger"""
        # First create a passenger
        passenger_id = self.test_02_create_test_passenger()
        
        # Block the passenger
        response = requests.put(f"{BASE_URL}/api/admin/passengers/{passenger_id}/block")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "message" in data, "Response should contain message"
        assert "blocked" in data["message"].lower(), "Message should mention blocked"
        
        print(f"✓ Passenger {passenger_id} blocked successfully")
        return passenger_id
    
    def test_05_blocked_passenger_cannot_login(self):
        """Test that a blocked passenger cannot login"""
        # Create and block a passenger
        passenger_id = self.test_04_block_passenger()
        
        # Try to login - should fail with 403
        response = requests.post(f"{BASE_URL}/api/passenger/login", json={
            "phone": self.test_phone,
            "password": self.test_password
        })
        
        assert response.status_code == 403, f"Expected 403 for blocked passenger, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "blocked" in data.get("detail", "").lower(), "Error message should mention blocked"
        
        print(f"✓ Blocked passenger correctly denied login (403)")
    
    def test_06_unblock_passenger(self):
        """Test PUT /api/admin/passengers/{id}/unblock - Unblock a passenger"""
        # Create and block a passenger first
        passenger_id = self.test_04_block_passenger()
        
        # Unblock the passenger
        response = requests.put(f"{BASE_URL}/api/admin/passengers/{passenger_id}/unblock")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "message" in data, "Response should contain message"
        assert "unblocked" in data["message"].lower(), "Message should mention unblocked"
        
        print(f"✓ Passenger {passenger_id} unblocked successfully")
        return passenger_id
    
    def test_07_unblocked_passenger_can_login(self):
        """Test that an unblocked passenger can login again"""
        # Create, block, then unblock a passenger
        passenger_id = self.test_06_unblock_passenger()
        
        # Try to login - should succeed
        response = requests.post(f"{BASE_URL}/api/passenger/login", json={
            "phone": self.test_phone,
            "password": self.test_password
        })
        
        assert response.status_code == 200, f"Expected 200 for unblocked passenger, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "token" in data, "Response should contain token"
        
        print(f"✓ Unblocked passenger can login successfully")
    
    def test_08_delete_passenger(self):
        """Test DELETE /api/admin/passengers/{id} - Delete a passenger"""
        # First create a passenger
        passenger_id = self.test_02_create_test_passenger()
        
        # Delete the passenger
        response = requests.delete(f"{BASE_URL}/api/admin/passengers/{passenger_id}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "message" in data, "Response should contain message"
        assert "deleted" in data["message"].lower(), "Message should mention deleted"
        
        # Clear the ID so cleanup doesn't try to delete again
        self.created_passenger_id = None
        
        print(f"✓ Passenger {passenger_id} deleted successfully")
        return passenger_id
    
    def test_09_deleted_passenger_cannot_login(self):
        """Test that a deleted passenger cannot login"""
        # Create and delete a passenger
        passenger_id = self.test_08_delete_passenger()
        
        # Try to login - should fail with 401
        response = requests.post(f"{BASE_URL}/api/passenger/login", json={
            "phone": self.test_phone,
            "password": self.test_password
        })
        
        assert response.status_code == 401, f"Expected 401 for deleted passenger, got {response.status_code}: {response.text}"
        
        print(f"✓ Deleted passenger correctly denied login (401)")
    
    def test_10_block_nonexistent_passenger(self):
        """Test blocking a non-existent passenger returns 404"""
        fake_id = str(uuid.uuid4())
        response = requests.put(f"{BASE_URL}/api/admin/passengers/{fake_id}/block")
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        
        print(f"✓ Block non-existent passenger returns 404")
    
    def test_11_unblock_nonexistent_passenger(self):
        """Test unblocking a non-existent passenger returns 404"""
        fake_id = str(uuid.uuid4())
        response = requests.put(f"{BASE_URL}/api/admin/passengers/{fake_id}/unblock")
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        
        print(f"✓ Unblock non-existent passenger returns 404")
    
    def test_12_delete_nonexistent_passenger(self):
        """Test deleting a non-existent passenger returns 404"""
        fake_id = str(uuid.uuid4())
        response = requests.delete(f"{BASE_URL}/api/admin/passengers/{fake_id}")
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        
        print(f"✓ Delete non-existent passenger returns 404")
    
    def test_13_passenger_appears_in_list_after_creation(self):
        """Test that a newly created passenger appears in the admin list"""
        # Create a passenger
        passenger_id = self.test_02_create_test_passenger()
        
        # Get all passengers
        response = requests.get(f"{BASE_URL}/api/admin/passengers")
        assert response.status_code == 200
        
        data = response.json()
        passenger_ids = [p["id"] for p in data]
        
        assert passenger_id in passenger_ids, "Newly created passenger should appear in list"
        
        # Find the passenger and check is_blocked is not set
        passenger = next((p for p in data if p["id"] == passenger_id), None)
        assert passenger is not None
        assert passenger.get("is_blocked", False) == False, "New passenger should not be blocked"
        
        print(f"✓ New passenger appears in admin list")
    
    def test_14_blocked_status_visible_in_list(self):
        """Test that blocked status is visible in the passenger list"""
        # Create and block a passenger
        passenger_id = self.test_04_block_passenger()
        
        # Get all passengers
        response = requests.get(f"{BASE_URL}/api/admin/passengers")
        assert response.status_code == 200
        
        data = response.json()
        
        # Find the blocked passenger
        passenger = next((p for p in data if p["id"] == passenger_id), None)
        assert passenger is not None, "Passenger should be in list"
        assert passenger.get("is_blocked") == True, "Passenger should show as blocked"
        
        print(f"✓ Blocked status visible in passenger list")


class TestPassengerLoginValidation:
    """Test passenger login validation"""
    
    def test_login_invalid_phone(self):
        """Test login with invalid phone number"""
        response = requests.post(f"{BASE_URL}/api/passenger/login", json={
            "phone": "+447000000000",
            "password": "wrongpassword"
        })
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print(f"✓ Invalid phone returns 401")
    
    def test_login_missing_fields(self):
        """Test login with missing fields"""
        response = requests.post(f"{BASE_URL}/api/passenger/login", json={
            "phone": "+447000000000"
        })
        
        assert response.status_code == 422, f"Expected 422, got {response.status_code}"
        print(f"✓ Missing password returns 422")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
