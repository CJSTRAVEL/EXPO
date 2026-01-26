import requests
import sys
import json
from datetime import datetime, timezone
from typing import Dict, Any

class PrivateHireAPITester:
    def __init__(self, base_url="https://cjs-exec-travel.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.created_drivers = []
        self.created_bookings = []

    def run_test(self, name: str, method: str, endpoint: str, expected_status: int, data: Dict[Any, Any] = None) -> tuple:
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=10)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json() if response.text else {}
                    return True, response_data
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                print(f"   Response: {response.text[:200]}...")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_root_endpoint(self):
        """Test the root API endpoint"""
        return self.run_test("Root API Endpoint", "GET", "", 200)

    def test_stats_endpoint(self):
        """Test the stats endpoint"""
        success, response = self.run_test("Stats Endpoint", "GET", "stats", 200)
        if success:
            required_keys = ['bookings', 'drivers', 'revenue']
            for key in required_keys:
                if key not in response:
                    print(f"❌ Missing key '{key}' in stats response")
                    return False
            print(f"   Stats: {json.dumps(response, indent=2)}")
        return success

    def test_create_driver(self):
        """Test creating a new driver"""
        driver_data = {
            "name": "John Smith",
            "phone": "+44 7700 900001",
            "vehicle_type": "Sedan",
            "vehicle_number": "AB12 CDE",
            "status": "available"
        }
        success, response = self.run_test("Create Driver", "POST", "drivers", 200, driver_data)
        if success and 'id' in response:
            self.created_drivers.append(response['id'])
            print(f"   Created driver ID: {response['id']}")
        return success

    def test_get_drivers(self):
        """Test getting all drivers"""
        success, response = self.run_test("Get All Drivers", "GET", "drivers", 200)
        if success:
            print(f"   Found {len(response)} drivers")
        return success

    def test_get_driver_by_id(self):
        """Test getting a specific driver by ID"""
        if not self.created_drivers:
            print("⚠️  No drivers created yet, skipping individual driver test")
            return True
        
        driver_id = self.created_drivers[0]
        success, response = self.run_test("Get Driver by ID", "GET", f"drivers/{driver_id}", 200)
        if success:
            print(f"   Retrieved driver: {response.get('name', 'Unknown')}")
        return success

    def test_update_driver(self):
        """Test updating a driver"""
        if not self.created_drivers:
            print("⚠️  No drivers created yet, skipping driver update test")
            return True
        
        driver_id = self.created_drivers[0]
        update_data = {
            "name": "John Smith Updated",
            "status": "busy"
        }
        success, response = self.run_test("Update Driver", "PUT", f"drivers/{driver_id}", 200, update_data)
        if success:
            print(f"   Updated driver: {response.get('name', 'Unknown')}")
        return success

    def test_create_booking(self):
        """Test creating a new booking"""
        booking_data = {
            "customer_name": "Jane Doe",
            "customer_phone": "+44 7700 900002",
            "pickup_location": "123 Main St, London",
            "dropoff_location": "456 High St, London",
            "booking_datetime": datetime.now(timezone.utc).isoformat(),
            "notes": "Test booking",
            "fare": 25.50
        }
        success, response = self.run_test("Create Booking", "POST", "bookings", 200, booking_data)
        if success and 'id' in response:
            self.created_bookings.append(response['id'])
            print(f"   Created booking ID: {response['id']}")
        return success

    def test_get_bookings(self):
        """Test getting all bookings"""
        success, response = self.run_test("Get All Bookings", "GET", "bookings", 200)
        if success:
            print(f"   Found {len(response)} bookings")
        return success

    def test_get_booking_by_id(self):
        """Test getting a specific booking by ID"""
        if not self.created_bookings:
            print("⚠️  No bookings created yet, skipping individual booking test")
            return True
        
        booking_id = self.created_bookings[0]
        success, response = self.run_test("Get Booking by ID", "GET", f"bookings/{booking_id}", 200)
        if success:
            print(f"   Retrieved booking for: {response.get('customer_name', 'Unknown')}")
        return success

    def test_update_booking(self):
        """Test updating a booking"""
        if not self.created_bookings:
            print("⚠️  No bookings created yet, skipping booking update test")
            return True
        
        booking_id = self.created_bookings[0]
        update_data = {
            "customer_name": "Jane Doe Updated",
            "fare": 30.00
        }
        success, response = self.run_test("Update Booking", "PUT", f"bookings/{booking_id}", 200, update_data)
        if success:
            print(f"   Updated booking for: {response.get('customer_name', 'Unknown')}")
        return success

    def test_assign_driver_to_booking(self):
        """Test assigning a driver to a booking"""
        if not self.created_drivers or not self.created_bookings:
            print("⚠️  Need both drivers and bookings for assignment test, skipping")
            return True
        
        booking_id = self.created_bookings[0]
        driver_id = self.created_drivers[0]
        success, response = self.run_test(
            "Assign Driver to Booking", 
            "POST", 
            f"bookings/{booking_id}/assign/{driver_id}", 
            200
        )
        if success:
            print(f"   Assigned driver {driver_id} to booking {booking_id}")
            print(f"   Booking status: {response.get('status', 'Unknown')}")
        return success

    def test_delete_booking(self):
        """Test deleting a booking"""
        if not self.created_bookings:
            print("⚠️  No bookings created yet, skipping booking deletion test")
            return True
        
        booking_id = self.created_bookings.pop()  # Remove from list
        success, response = self.run_test("Delete Booking", "DELETE", f"bookings/{booking_id}", 200)
        return success

    def test_delete_driver(self):
        """Test deleting a driver"""
        if not self.created_drivers:
            print("⚠️  No drivers created yet, skipping driver deletion test")
            return True
        
        driver_id = self.created_drivers.pop()  # Remove from list
        success, response = self.run_test("Delete Driver", "DELETE", f"drivers/{driver_id}", 200)
        return success

    def test_error_cases(self):
        """Test error handling"""
        print("\n🔍 Testing Error Cases...")
        
        # Test 404 for non-existent driver
        success1, _ = self.run_test("Get Non-existent Driver", "GET", "drivers/non-existent-id", 404)
        
        # Test 404 for non-existent booking
        success2, _ = self.run_test("Get Non-existent Booking", "GET", "bookings/non-existent-id", 404)
        
        # Test invalid data for driver creation
        invalid_driver = {"name": ""}  # Missing required fields
        success3, _ = self.run_test("Create Invalid Driver", "POST", "drivers", 422, invalid_driver)
        
        return success1 and success2 and success3

    def run_all_tests(self):
        """Run all API tests"""
        print("🚀 Starting Private Hire API Tests...")
        print(f"   Base URL: {self.base_url}")
        
        # Test basic endpoints
        self.test_root_endpoint()
        self.test_stats_endpoint()
        
        # Test driver operations
        self.test_create_driver()
        self.test_get_drivers()
        self.test_get_driver_by_id()
        self.test_update_driver()
        
        # Test booking operations
        self.test_create_booking()
        self.test_get_bookings()
        self.test_get_booking_by_id()
        self.test_update_booking()
        
        # Test driver assignment
        self.test_assign_driver_to_booking()
        
        # Test deletion (do this last)
        self.test_delete_booking()
        self.test_delete_driver()
        
        # Test error cases
        self.test_error_cases()
        
        # Print final results
        print(f"\n📊 Test Results:")
        print(f"   Tests Run: {self.tests_run}")
        print(f"   Tests Passed: {self.tests_passed}")
        print(f"   Success Rate: {(self.tests_passed/self.tests_run)*100:.1f}%")
        
        return self.tests_passed == self.tests_run

def main():
    tester = PrivateHireAPITester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())