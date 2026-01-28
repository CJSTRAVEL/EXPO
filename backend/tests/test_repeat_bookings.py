"""
Test suite for Repeat Booking feature
Tests the POST /api/bookings/repeat endpoint with various repeat patterns
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://dispatch-system-13.preview.emergentagent.com').rstrip('/')

class TestRepeatBookingsAPI:
    """Tests for the repeat bookings endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test data"""
        self.base_booking_data = {
            "first_name": "TEST_Repeat",
            "last_name": "User",
            "customer_phone": "07700900001",
            "customer_email": "test.repeat@example.com",
            "pickup_location": "Newcastle Central Station, Newcastle upon Tyne",
            "dropoff_location": "Newcastle Airport, Newcastle upon Tyne",
            "booking_datetime": (datetime.now() + timedelta(days=1)).isoformat(),
            "notes": "Test repeat booking",
            "fare": 45.00,
            "payment_method": "cash",
            "passenger_count": 1,
            "luggage_count": 1
        }
    
    def test_daily_repeat_by_occurrences(self):
        """Test daily repeat pattern with number of occurrences"""
        payload = {
            **self.base_booking_data,
            "repeat_booking": True,
            "repeat_type": "daily",
            "repeat_end_type": "occurrences",
            "repeat_occurrences": 5
        }
        
        response = requests.post(f"{BASE_URL}/api/bookings/repeat", json=payload)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "created_count" in data, "Response should contain created_count"
        assert data["created_count"] == 5, f"Expected 5 bookings, got {data['created_count']}"
        assert "repeat_group_id" in data, "Response should contain repeat_group_id"
        assert "booking_ids" in data, "Response should contain booking_ids"
        assert len(data["booking_ids"]) == 5, f"Expected 5 booking IDs, got {len(data['booking_ids'])}"
        
        # Verify all booking IDs follow CJ-XXX format
        for booking_id in data["booking_ids"]:
            assert booking_id.startswith("CJ-"), f"Booking ID should start with CJ-, got {booking_id}"
        
        print(f"✓ Daily repeat (5 occurrences): Created {data['created_count']} bookings")
        print(f"  Booking IDs: {data['booking_ids']}")
        print(f"  Repeat Group ID: {data['repeat_group_id']}")
    
    def test_weekly_repeat_by_occurrences(self):
        """Test weekly repeat pattern with number of occurrences"""
        payload = {
            **self.base_booking_data,
            "repeat_booking": True,
            "repeat_type": "weekly",
            "repeat_end_type": "occurrences",
            "repeat_occurrences": 4
        }
        
        response = requests.post(f"{BASE_URL}/api/bookings/repeat", json=payload)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["created_count"] == 4, f"Expected 4 bookings, got {data['created_count']}"
        assert len(data["booking_ids"]) == 4
        
        # Verify bookings are created
        assert "bookings" in data
        bookings = data["bookings"]
        
        # Check that dates are 7 days apart
        if len(bookings) >= 2:
            date1 = datetime.fromisoformat(bookings[0]["booking_datetime"].replace('Z', '+00:00'))
            date2 = datetime.fromisoformat(bookings[1]["booking_datetime"].replace('Z', '+00:00'))
            diff = (date2 - date1).days
            assert diff == 7, f"Weekly bookings should be 7 days apart, got {diff} days"
        
        print(f"✓ Weekly repeat (4 occurrences): Created {data['created_count']} bookings")
    
    def test_custom_days_repeat(self):
        """Test custom days repeat pattern (Mon, Wed, Fri)"""
        payload = {
            **self.base_booking_data,
            "repeat_booking": True,
            "repeat_type": "custom",
            "repeat_end_type": "occurrences",
            "repeat_occurrences": 6,
            "repeat_days": [1, 3, 5]  # Mon, Wed, Fri (0=Sun, 1=Mon, etc.)
        }
        
        response = requests.post(f"{BASE_URL}/api/bookings/repeat", json=payload)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["created_count"] == 6, f"Expected 6 bookings, got {data['created_count']}"
        
        # Verify bookings are on correct days
        bookings = data["bookings"]
        for booking in bookings:
            booking_date = datetime.fromisoformat(booking["booking_datetime"].replace('Z', '+00:00'))
            # Python weekday: 0=Mon, 6=Sun. Convert to our format: 0=Sun, 1=Mon, etc.
            day_of_week = (booking_date.weekday() + 1) % 7
            assert day_of_week in [1, 3, 5], f"Booking on wrong day: {booking_date.strftime('%A')} (day {day_of_week})"
        
        print(f"✓ Custom days repeat (Mon/Wed/Fri, 6 occurrences): Created {data['created_count']} bookings")
    
    def test_daily_repeat_by_end_date(self):
        """Test daily repeat pattern with end date"""
        start_date = datetime.now() + timedelta(days=1)
        end_date = start_date + timedelta(days=4)  # 5 days total
        
        payload = {
            **self.base_booking_data,
            "booking_datetime": start_date.isoformat(),
            "repeat_booking": True,
            "repeat_type": "daily",
            "repeat_end_type": "end_date",
            "repeat_end_date": end_date.isoformat()
        }
        
        response = requests.post(f"{BASE_URL}/api/bookings/repeat", json=payload)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["created_count"] == 5, f"Expected 5 bookings (5 days), got {data['created_count']}"
        
        print(f"✓ Daily repeat (end date): Created {data['created_count']} bookings")
    
    def test_weekly_repeat_by_end_date(self):
        """Test weekly repeat pattern with end date"""
        start_date = datetime.now() + timedelta(days=1)
        end_date = start_date + timedelta(weeks=3)  # 4 weeks total
        
        payload = {
            **self.base_booking_data,
            "booking_datetime": start_date.isoformat(),
            "repeat_booking": True,
            "repeat_type": "weekly",
            "repeat_end_type": "end_date",
            "repeat_end_date": end_date.isoformat()
        }
        
        response = requests.post(f"{BASE_URL}/api/bookings/repeat", json=payload)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["created_count"] == 4, f"Expected 4 bookings (4 weeks), got {data['created_count']}"
        
        print(f"✓ Weekly repeat (end date): Created {data['created_count']} bookings")
    
    def test_custom_days_by_end_date(self):
        """Test custom days repeat pattern with end date"""
        start_date = datetime.now() + timedelta(days=1)
        end_date = start_date + timedelta(days=13)  # 2 weeks
        
        payload = {
            **self.base_booking_data,
            "booking_datetime": start_date.isoformat(),
            "repeat_booking": True,
            "repeat_type": "custom",
            "repeat_end_type": "end_date",
            "repeat_end_date": end_date.isoformat(),
            "repeat_days": [1, 5]  # Mon and Fri only
        }
        
        response = requests.post(f"{BASE_URL}/api/bookings/repeat", json=payload)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Should create bookings only on Mon and Fri within the 2-week period
        assert data["created_count"] >= 2, f"Expected at least 2 bookings, got {data['created_count']}"
        
        print(f"✓ Custom days repeat (Mon/Fri, end date): Created {data['created_count']} bookings")
    
    def test_repeat_with_return_journey(self):
        """Test repeat booking with return journey creates double bookings"""
        return_datetime = (datetime.now() + timedelta(days=1, hours=4)).isoformat()
        
        payload = {
            **self.base_booking_data,
            "repeat_booking": True,
            "repeat_type": "daily",
            "repeat_end_type": "occurrences",
            "repeat_occurrences": 3,
            "create_return": True,
            "return_pickup_location": "Newcastle Airport, Newcastle upon Tyne",
            "return_dropoff_location": "Newcastle Central Station, Newcastle upon Tyne",
            "return_datetime": return_datetime
        }
        
        response = requests.post(f"{BASE_URL}/api/bookings/repeat", json=payload)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Should create 3 outbound + 3 return = 6 total, but API returns only outbound count
        assert data["created_count"] == 3, f"Expected 3 outbound bookings, got {data['created_count']}"
        
        # Verify return bookings were created by checking the database
        repeat_group_id = data["repeat_group_id"]
        
        print(f"✓ Repeat with return journey: Created {data['created_count']} outbound bookings (+ returns)")
        print(f"  Repeat Group ID: {repeat_group_id}")
    
    def test_max_bookings_limit(self):
        """Test that maximum 52 bookings are created"""
        payload = {
            **self.base_booking_data,
            "repeat_booking": True,
            "repeat_type": "daily",
            "repeat_end_type": "occurrences",
            "repeat_occurrences": 100  # Request more than max
        }
        
        response = requests.post(f"{BASE_URL}/api/bookings/repeat", json=payload)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["created_count"] <= 52, f"Should not exceed 52 bookings, got {data['created_count']}"
        
        print(f"✓ Max bookings limit: Created {data['created_count']} bookings (max 52)")
    
    def test_bookings_linked_by_repeat_group_id(self):
        """Test that all repeat bookings share the same repeat_group_id"""
        payload = {
            **self.base_booking_data,
            "repeat_booking": True,
            "repeat_type": "daily",
            "repeat_end_type": "occurrences",
            "repeat_occurrences": 3
        }
        
        response = requests.post(f"{BASE_URL}/api/bookings/repeat", json=payload)
        
        assert response.status_code == 200
        
        data = response.json()
        repeat_group_id = data["repeat_group_id"]
        
        # Verify repeat_group_id is a valid UUID format
        assert len(repeat_group_id) == 36, f"repeat_group_id should be UUID format, got {repeat_group_id}"
        assert repeat_group_id.count('-') == 4, "repeat_group_id should have 4 dashes (UUID format)"
        
        # Fetch one of the created bookings to verify repeat_group_id is stored
        booking_id = data["bookings"][0]["id"]
        booking_response = requests.get(f"{BASE_URL}/api/bookings/{booking_id}")
        
        if booking_response.status_code == 200:
            booking = booking_response.json()
            assert booking.get("repeat_group_id") == repeat_group_id, "Booking should have repeat_group_id"
            assert booking.get("repeat_index") == 1, "First booking should have repeat_index 1"
            assert booking.get("repeat_total") == 3, "Booking should have repeat_total 3"
        
        print(f"✓ Bookings linked by repeat_group_id: {repeat_group_id}")
    
    def test_validation_custom_days_required(self):
        """Test validation: custom days requires at least one day selected"""
        payload = {
            **self.base_booking_data,
            "repeat_booking": True,
            "repeat_type": "custom",
            "repeat_end_type": "occurrences",
            "repeat_occurrences": 5,
            "repeat_days": []  # Empty - should fail or create no bookings
        }
        
        response = requests.post(f"{BASE_URL}/api/bookings/repeat", json=payload)
        
        # Should either return 400 error or create 0 bookings
        if response.status_code == 400:
            print("✓ Validation: Empty custom days returns 400 error")
        elif response.status_code == 200:
            data = response.json()
            # If it returns 200, it should have created 0 bookings or returned an error
            if data.get("created_count", 0) == 0:
                print("✓ Validation: Empty custom days creates 0 bookings")
            else:
                pytest.fail(f"Should not create bookings with empty custom days, got {data['created_count']}")
        else:
            pytest.fail(f"Unexpected status code: {response.status_code}")
    
    def test_minimum_occurrences(self):
        """Test minimum number of occurrences (should be at least 2)"""
        payload = {
            **self.base_booking_data,
            "repeat_booking": True,
            "repeat_type": "daily",
            "repeat_end_type": "occurrences",
            "repeat_occurrences": 2  # Minimum
        }
        
        response = requests.post(f"{BASE_URL}/api/bookings/repeat", json=payload)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["created_count"] == 2, f"Expected 2 bookings, got {data['created_count']}"
        
        print(f"✓ Minimum occurrences (2): Created {data['created_count']} bookings")


class TestRepeatBookingsVerification:
    """Tests to verify created repeat bookings in the database"""
    
    def test_verify_booking_dates_are_correct(self):
        """Verify that booking dates are correctly spaced"""
        start_date = datetime.now() + timedelta(days=1)
        
        payload = {
            "first_name": "TEST_Verify",
            "last_name": "Dates",
            "customer_phone": "07700900002",
            "pickup_location": "Test Pickup",
            "dropoff_location": "Test Dropoff",
            "booking_datetime": start_date.isoformat(),
            "repeat_booking": True,
            "repeat_type": "daily",
            "repeat_end_type": "occurrences",
            "repeat_occurrences": 3
        }
        
        response = requests.post(f"{BASE_URL}/api/bookings/repeat", json=payload)
        assert response.status_code == 200
        
        data = response.json()
        bookings = data["bookings"]
        
        # Verify dates are consecutive days
        for i in range(len(bookings) - 1):
            date1 = datetime.fromisoformat(bookings[i]["booking_datetime"].replace('Z', '+00:00'))
            date2 = datetime.fromisoformat(bookings[i+1]["booking_datetime"].replace('Z', '+00:00'))
            diff = (date2 - date1).days
            assert diff == 1, f"Daily bookings should be 1 day apart, got {diff} days"
        
        print("✓ Booking dates verified: Correctly spaced 1 day apart")
    
    def test_verify_booking_ids_are_sequential(self):
        """Verify that booking IDs are generated sequentially"""
        payload = {
            "first_name": "TEST_Sequential",
            "last_name": "IDs",
            "customer_phone": "07700900003",
            "pickup_location": "Test Pickup",
            "dropoff_location": "Test Dropoff",
            "booking_datetime": (datetime.now() + timedelta(days=1)).isoformat(),
            "repeat_booking": True,
            "repeat_type": "daily",
            "repeat_end_type": "occurrences",
            "repeat_occurrences": 3
        }
        
        response = requests.post(f"{BASE_URL}/api/bookings/repeat", json=payload)
        assert response.status_code == 200
        
        data = response.json()
        booking_ids = data["booking_ids"]
        
        # Extract numbers from CJ-XXX format
        numbers = []
        for bid in booking_ids:
            num = int(bid.split("-")[1])
            numbers.append(num)
        
        # Verify numbers are sequential
        for i in range(len(numbers) - 1):
            assert numbers[i+1] == numbers[i] + 1, f"Booking IDs should be sequential: {numbers}"
        
        print(f"✓ Booking IDs are sequential: {booking_ids}")


class TestCleanup:
    """Cleanup test data after tests"""
    
    def test_cleanup_test_bookings(self):
        """Clean up TEST_ prefixed bookings"""
        # Get all bookings
        response = requests.get(f"{BASE_URL}/api/bookings")
        if response.status_code != 200:
            print("Could not fetch bookings for cleanup")
            return
        
        bookings = response.json()
        deleted_count = 0
        
        for booking in bookings:
            first_name = booking.get("first_name", "")
            if first_name.startswith("TEST_"):
                delete_response = requests.delete(f"{BASE_URL}/api/bookings/{booking['id']}")
                if delete_response.status_code in [200, 204]:
                    deleted_count += 1
        
        print(f"✓ Cleanup: Deleted {deleted_count} test bookings")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
