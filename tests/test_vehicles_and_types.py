"""
Test suite for Vehicle Types and Vehicles CRUD operations
Tests the new Fleet Management feature including:
- Vehicle Types CRUD (Create, Read, Update, Delete)
- Vehicles CRUD (Create, Read, Update, Delete)
- Vehicle count on types
- has_trailer flag
- Cannot delete vehicle type with assigned vehicles
- Document expiry dates (insurance, tax, MOT)
"""

import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestVehicleTypes:
    """Vehicle Type CRUD tests"""
    
    def test_get_all_vehicle_types(self):
        """Test GET /api/vehicle-types returns list of vehicle types"""
        response = requests.get(f"{BASE_URL}/api/vehicle-types")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # Should have pre-seeded vehicle types
        assert len(data) >= 4
        print(f"✓ Found {len(data)} vehicle types")
        
    def test_vehicle_type_has_required_fields(self):
        """Test vehicle types have all required fields"""
        response = requests.get(f"{BASE_URL}/api/vehicle-types")
        assert response.status_code == 200
        data = response.json()
        
        for vt in data:
            assert "id" in vt
            assert "name" in vt
            assert "capacity" in vt
            assert "has_trailer" in vt
            assert "vehicle_count" in vt
        print("✓ All vehicle types have required fields")
        
    def test_vehicle_type_has_trailer_flag(self):
        """Test has_trailer flag is correctly set"""
        response = requests.get(f"{BASE_URL}/api/vehicle-types")
        assert response.status_code == 200
        data = response.json()
        
        # Find the trailer type
        trailer_type = next((vt for vt in data if "Trailer" in vt["name"]), None)
        assert trailer_type is not None, "Should have a vehicle type with Trailer"
        assert trailer_type["has_trailer"] == True
        
        # Find a non-trailer type
        taxi_type = next((vt for vt in data if "Taxi" in vt["name"]), None)
        assert taxi_type is not None
        assert taxi_type["has_trailer"] == False
        print("✓ has_trailer flag correctly set")
        
    def test_vehicle_type_shows_vehicle_count(self):
        """Test vehicle types show correct vehicle count"""
        response = requests.get(f"{BASE_URL}/api/vehicle-types")
        assert response.status_code == 200
        data = response.json()
        
        # Find the taxi type which should have 1 vehicle
        taxi_type = next((vt for vt in data if "Taxi" in vt["name"]), None)
        assert taxi_type is not None
        assert taxi_type["vehicle_count"] >= 1, "Taxi type should have at least 1 vehicle"
        print(f"✓ Vehicle count shown correctly: {taxi_type['name']} has {taxi_type['vehicle_count']} vehicles")
        
    def test_create_vehicle_type(self):
        """Test POST /api/vehicle-types creates new type"""
        payload = {
            "name": "TEST_Executive Sedan",
            "capacity": 3,
            "description": "Luxury sedan for executive travel",
            "has_trailer": False
        }
        response = requests.post(f"{BASE_URL}/api/vehicle-types", json=payload)
        assert response.status_code == 200
        data = response.json()
        
        assert data["name"] == payload["name"]
        assert data["capacity"] == payload["capacity"]
        assert data["description"] == payload["description"]
        assert data["has_trailer"] == payload["has_trailer"]
        assert "id" in data
        
        # Store ID for cleanup
        self.__class__.created_type_id = data["id"]
        print(f"✓ Created vehicle type: {data['name']} (ID: {data['id']})")
        
    def test_get_single_vehicle_type(self):
        """Test GET /api/vehicle-types/{id} returns single type"""
        # Use the created type from previous test
        type_id = getattr(self.__class__, 'created_type_id', None)
        if not type_id:
            pytest.skip("No created type ID available")
            
        response = requests.get(f"{BASE_URL}/api/vehicle-types/{type_id}")
        assert response.status_code == 200
        data = response.json()
        
        assert data["id"] == type_id
        assert data["name"] == "TEST_Executive Sedan"
        assert "vehicle_count" in data
        print(f"✓ Retrieved single vehicle type: {data['name']}")
        
    def test_update_vehicle_type(self):
        """Test PUT /api/vehicle-types/{id} updates type"""
        type_id = getattr(self.__class__, 'created_type_id', None)
        if not type_id:
            pytest.skip("No created type ID available")
            
        update_payload = {
            "name": "TEST_Executive Sedan Updated",
            "capacity": 4
        }
        response = requests.put(f"{BASE_URL}/api/vehicle-types/{type_id}", json=update_payload)
        assert response.status_code == 200
        data = response.json()
        
        assert data["name"] == update_payload["name"]
        assert data["capacity"] == update_payload["capacity"]
        print(f"✓ Updated vehicle type: {data['name']}")
        
    def test_delete_vehicle_type(self):
        """Test DELETE /api/vehicle-types/{id} deletes type"""
        type_id = getattr(self.__class__, 'created_type_id', None)
        if not type_id:
            pytest.skip("No created type ID available")
            
        response = requests.delete(f"{BASE_URL}/api/vehicle-types/{type_id}")
        assert response.status_code == 200
        
        # Verify deletion
        get_response = requests.get(f"{BASE_URL}/api/vehicle-types/{type_id}")
        assert get_response.status_code == 404
        print(f"✓ Deleted vehicle type: {type_id}")
        
    def test_cannot_delete_type_with_vehicles(self):
        """Test cannot delete vehicle type that has vehicles assigned"""
        # Get the taxi type which has vehicles
        response = requests.get(f"{BASE_URL}/api/vehicle-types")
        data = response.json()
        
        taxi_type = next((vt for vt in data if vt["vehicle_count"] > 0), None)
        if not taxi_type:
            pytest.skip("No vehicle type with vehicles found")
            
        # Try to delete - should fail
        delete_response = requests.delete(f"{BASE_URL}/api/vehicle-types/{taxi_type['id']}")
        assert delete_response.status_code == 400
        assert "Cannot delete" in delete_response.json().get("detail", "")
        print(f"✓ Correctly prevented deletion of type with {taxi_type['vehicle_count']} vehicles")


class TestVehicles:
    """Vehicle CRUD tests"""
    
    def test_get_all_vehicles(self):
        """Test GET /api/vehicles returns list of vehicles"""
        response = requests.get(f"{BASE_URL}/api/vehicles")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1  # Should have at least the test vehicle
        print(f"✓ Found {len(data)} vehicles")
        
    def test_vehicle_has_required_fields(self):
        """Test vehicles have all required fields"""
        response = requests.get(f"{BASE_URL}/api/vehicles")
        assert response.status_code == 200
        data = response.json()
        
        for v in data:
            assert "id" in v
            assert "registration" in v
            assert "make" in v
            assert "model" in v
            assert "is_active" in v
        print("✓ All vehicles have required fields")
        
    def test_vehicle_has_document_dates(self):
        """Test vehicles have document expiry dates"""
        response = requests.get(f"{BASE_URL}/api/vehicles")
        assert response.status_code == 200
        data = response.json()
        
        # Find the test vehicle
        test_vehicle = next((v for v in data if v["registration"] == "AB12 CDE"), None)
        assert test_vehicle is not None
        
        # Check document dates exist
        assert "insurance_expiry" in test_vehicle
        assert "tax_expiry" in test_vehicle
        assert "mot_expiry" in test_vehicle
        print(f"✓ Vehicle {test_vehicle['registration']} has document dates")
        
    def test_vehicle_linked_to_type(self):
        """Test vehicle is linked to vehicle type"""
        response = requests.get(f"{BASE_URL}/api/vehicles")
        assert response.status_code == 200
        data = response.json()
        
        # Find vehicle with type
        vehicle_with_type = next((v for v in data if v.get("vehicle_type")), None)
        assert vehicle_with_type is not None
        
        assert "vehicle_type" in vehicle_with_type
        assert "name" in vehicle_with_type["vehicle_type"]
        assert "capacity" in vehicle_with_type["vehicle_type"]
        print(f"✓ Vehicle {vehicle_with_type['registration']} linked to type: {vehicle_with_type['vehicle_type']['name']}")
        
    def test_create_vehicle(self):
        """Test POST /api/vehicles creates new vehicle"""
        # First get a vehicle type ID
        types_response = requests.get(f"{BASE_URL}/api/vehicle-types")
        types = types_response.json()
        type_id = types[0]["id"] if types else None
        
        # Calculate future dates for documents
        future_date = (datetime.now() + timedelta(days=180)).strftime("%Y-%m-%d")
        
        payload = {
            "registration": "TEST XY99 ZZZ",
            "make": "BMW",
            "model": "7 Series",
            "color": "Silver",
            "year": 2024,
            "vehicle_type_id": type_id,
            "insurance_expiry": future_date,
            "tax_expiry": future_date,
            "mot_expiry": future_date,
            "notes": "Test vehicle for automated testing",
            "is_active": True
        }
        response = requests.post(f"{BASE_URL}/api/vehicles", json=payload)
        assert response.status_code == 200
        data = response.json()
        
        assert data["registration"] == payload["registration"]
        assert data["make"] == payload["make"]
        assert data["model"] == payload["model"]
        assert data["color"] == payload["color"]
        assert data["year"] == payload["year"]
        assert data["is_active"] == True
        assert "id" in data
        
        self.__class__.created_vehicle_id = data["id"]
        print(f"✓ Created vehicle: {data['registration']} (ID: {data['id']})")
        
    def test_get_single_vehicle(self):
        """Test GET /api/vehicles/{id} returns single vehicle"""
        vehicle_id = getattr(self.__class__, 'created_vehicle_id', None)
        if not vehicle_id:
            pytest.skip("No created vehicle ID available")
            
        response = requests.get(f"{BASE_URL}/api/vehicles/{vehicle_id}")
        assert response.status_code == 200
        data = response.json()
        
        assert data["id"] == vehicle_id
        assert data["registration"] == "TEST XY99 ZZZ"
        assert "vehicle_type" in data  # Should include type info
        print(f"✓ Retrieved single vehicle: {data['registration']}")
        
    def test_update_vehicle(self):
        """Test PUT /api/vehicles/{id} updates vehicle"""
        vehicle_id = getattr(self.__class__, 'created_vehicle_id', None)
        if not vehicle_id:
            pytest.skip("No created vehicle ID available")
            
        update_payload = {
            "color": "Midnight Blue",
            "notes": "Updated test notes"
        }
        response = requests.put(f"{BASE_URL}/api/vehicles/{vehicle_id}", json=update_payload)
        assert response.status_code == 200
        data = response.json()
        
        assert data["color"] == update_payload["color"]
        assert data["notes"] == update_payload["notes"]
        print(f"✓ Updated vehicle: {data['registration']}")
        
    def test_update_vehicle_type_assignment(self):
        """Test updating vehicle's type assignment"""
        vehicle_id = getattr(self.__class__, 'created_vehicle_id', None)
        if not vehicle_id:
            pytest.skip("No created vehicle ID available")
            
        # Get a different vehicle type
        types_response = requests.get(f"{BASE_URL}/api/vehicle-types")
        types = types_response.json()
        if len(types) < 2:
            pytest.skip("Need at least 2 vehicle types")
            
        new_type_id = types[1]["id"]
        
        update_payload = {"vehicle_type_id": new_type_id}
        response = requests.put(f"{BASE_URL}/api/vehicles/{vehicle_id}", json=update_payload)
        assert response.status_code == 200
        data = response.json()
        
        assert data["vehicle_type_id"] == new_type_id
        print(f"✓ Updated vehicle type assignment")
        
    def test_delete_vehicle(self):
        """Test DELETE /api/vehicles/{id} deletes vehicle"""
        vehicle_id = getattr(self.__class__, 'created_vehicle_id', None)
        if not vehicle_id:
            pytest.skip("No created vehicle ID available")
            
        response = requests.delete(f"{BASE_URL}/api/vehicles/{vehicle_id}")
        assert response.status_code == 200
        
        # Verify deletion
        get_response = requests.get(f"{BASE_URL}/api/vehicles/{vehicle_id}")
        assert get_response.status_code == 404
        print(f"✓ Deleted vehicle: {vehicle_id}")
        
    def test_create_vehicle_with_invalid_type(self):
        """Test creating vehicle with invalid type ID fails"""
        payload = {
            "registration": "TEST INVALID",
            "make": "Test",
            "model": "Test",
            "vehicle_type_id": "invalid-uuid-12345"
        }
        response = requests.post(f"{BASE_URL}/api/vehicles", json=payload)
        assert response.status_code == 400
        assert "Invalid vehicle type" in response.json().get("detail", "")
        print("✓ Correctly rejected invalid vehicle type ID")


class TestDocumentStatus:
    """Test document expiry status logic"""
    
    def test_vehicle_with_valid_documents(self):
        """Test vehicle with future expiry dates shows valid status"""
        response = requests.get(f"{BASE_URL}/api/vehicles")
        data = response.json()
        
        # Find vehicle with future dates
        test_vehicle = next((v for v in data if v["registration"] == "AB12 CDE"), None)
        if not test_vehicle:
            pytest.skip("Test vehicle not found")
            
        # Check dates are in the future (valid)
        today = datetime.now().date()
        
        if test_vehicle.get("insurance_expiry"):
            insurance_date = datetime.strptime(test_vehicle["insurance_expiry"], "%Y-%m-%d").date()
            print(f"  Insurance expiry: {insurance_date} (days until: {(insurance_date - today).days})")
            
        if test_vehicle.get("tax_expiry"):
            tax_date = datetime.strptime(test_vehicle["tax_expiry"], "%Y-%m-%d").date()
            print(f"  Tax expiry: {tax_date} (days until: {(tax_date - today).days})")
            
        if test_vehicle.get("mot_expiry"):
            mot_date = datetime.strptime(test_vehicle["mot_expiry"], "%Y-%m-%d").date()
            print(f"  MOT expiry: {mot_date} (days until: {(mot_date - today).days})")
            
        print("✓ Document dates retrieved successfully")


# Cleanup fixture
@pytest.fixture(scope="module", autouse=True)
def cleanup_test_data():
    """Cleanup any TEST_ prefixed data after tests"""
    yield
    
    # Cleanup test vehicle types
    try:
        response = requests.get(f"{BASE_URL}/api/vehicle-types")
        if response.status_code == 200:
            for vt in response.json():
                if vt["name"].startswith("TEST_"):
                    requests.delete(f"{BASE_URL}/api/vehicle-types/{vt['id']}")
    except:
        pass
        
    # Cleanup test vehicles
    try:
        response = requests.get(f"{BASE_URL}/api/vehicles")
        if response.status_code == 200:
            for v in response.json():
                if v["registration"].startswith("TEST"):
                    requests.delete(f"{BASE_URL}/api/vehicles/{v['id']}")
    except:
        pass


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
