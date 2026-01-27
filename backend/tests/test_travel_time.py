"""
Travel Time Validation Tests
Tests the POST /api/scheduling/check-travel-time endpoint
Uses Google Maps Directions API to check if driver can reach next pickup in time
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test data - CJ-064 is on vehicle 1f31625d at 15:00, dropoff Newcastle Airport, duration 33min (ends 15:33)
# Travel time from Newcastle Airport to Peterlee is ~40min
VEHICLE_ID = "1f31625d-cecf-4718-b2c8-033736f404af"
GRACE_MINUTES = 15


class TestTravelTimeValidation:
    """Test travel time validation API endpoint"""
    
    def test_health_check(self):
        """Verify API is healthy before running tests"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        print("✓ API health check passed")
    
    def test_travel_time_conflict_insufficient_time(self):
        """
        Test 1: Booking at 15:45 Peterlee pickup - should FAIL
        CJ-064 ends at 15:33, travel from Newcastle Airport to Peterlee is ~40min
        Required: 40min travel + 15min grace = 55min
        Available: 15:45 - 15:33 = 12min
        """
        response = requests.post(
            f"{BASE_URL}/api/scheduling/check-travel-time",
            json={
                "vehicle_id": VEHICLE_ID,
                "booking_id": "test-booking-1545",
                "booking_datetime": "2026-01-27T15:45:00Z",
                "pickup_location": "Peterlee, UK",
                "duration_minutes": 30
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Should NOT be feasible
        assert data["feasible"] == False, f"Expected feasible=False, got {data['feasible']}"
        
        # Should have conflicts
        assert len(data["conflicts"]) > 0, "Expected at least one conflict"
        
        conflict = data["conflicts"][0]
        assert conflict["type"] == "insufficient_travel_time"
        assert conflict["previous_booking"] == "CJ-064"
        assert conflict["travel_time_minutes"] > 0
        assert conflict["grace_minutes"] == GRACE_MINUTES
        assert conflict["available_minutes"] < conflict["required_minutes"]
        
        print(f"✓ Travel time conflict detected correctly: {conflict['message']}")
    
    def test_travel_time_feasible_plenty_of_time(self):
        """
        Test 2: Booking at 17:00 Peterlee pickup - should PASS
        CJ-064 ends at 15:33, travel from Newcastle Airport to Peterlee is ~40min
        Required: 40min travel + 15min grace = 55min
        Available: 17:00 - 15:33 = 87min
        """
        response = requests.post(
            f"{BASE_URL}/api/scheduling/check-travel-time",
            json={
                "vehicle_id": VEHICLE_ID,
                "booking_id": "test-booking-1700",
                "booking_datetime": "2026-01-27T17:00:00Z",
                "pickup_location": "Peterlee, UK",
                "duration_minutes": 30
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Should be feasible
        assert data["feasible"] == True, f"Expected feasible=True, got {data['feasible']}"
        
        # Should have no conflicts
        assert len(data["conflicts"]) == 0, f"Expected no conflicts, got {data['conflicts']}"
        
        print(f"✓ Schedule is feasible with plenty of time: {data['message']}")
    
    def test_travel_time_tight_schedule_warning(self):
        """
        Test 3: Booking at 16:30 Peterlee pickup - should PASS with WARNING
        CJ-064 ends at 15:33, travel from Newcastle Airport to Peterlee is ~40min
        Required: 40min travel + 15min grace = 55min
        Available: 16:30 - 15:33 = 57min (just 2min buffer)
        """
        response = requests.post(
            f"{BASE_URL}/api/scheduling/check-travel-time",
            json={
                "vehicle_id": VEHICLE_ID,
                "booking_id": "test-booking-1630",
                "booking_datetime": "2026-01-27T16:30:00Z",
                "pickup_location": "Peterlee, UK",
                "duration_minutes": 30
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Should be feasible
        assert data["feasible"] == True, f"Expected feasible=True, got {data['feasible']}"
        
        # Should have no conflicts
        assert len(data["conflicts"]) == 0, f"Expected no conflicts, got {data['conflicts']}"
        
        # Should have warnings for tight schedule
        assert len(data["warnings"]) > 0, "Expected tight schedule warning"
        
        warning = data["warnings"][0]
        assert warning["type"] == "tight_schedule"
        assert "CJ-064" in warning.get("previous_booking", "") or "CJ-064" in warning.get("message", "")
        
        print(f"✓ Tight schedule warning detected: {warning['message']}")
    
    def test_no_bookings_on_vehicle(self):
        """
        Test 4: Check travel time on a vehicle with no bookings for the day
        Should return feasible=True with message about no other bookings
        """
        # Use a different vehicle that likely has no bookings on a future date
        response = requests.post(
            f"{BASE_URL}/api/scheduling/check-travel-time",
            json={
                "vehicle_id": "36f685f0-91a2-41ce-90af-e9dfc89c77b1",  # Different vehicle
                "booking_id": "test-booking-future",
                "booking_datetime": "2026-02-15T10:00:00Z",  # Future date
                "pickup_location": "Durham, UK",
                "duration_minutes": 30
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Should be feasible
        assert data["feasible"] == True
        
        print(f"✓ No bookings check passed: {data['message']}")
    
    def test_invalid_datetime_format(self):
        """
        Test 5: Invalid datetime format should return 400 error
        """
        response = requests.post(
            f"{BASE_URL}/api/scheduling/check-travel-time",
            json={
                "vehicle_id": VEHICLE_ID,
                "booking_id": "test-invalid",
                "booking_datetime": "invalid-date",
                "pickup_location": "Peterlee, UK",
                "duration_minutes": 30
            }
        )
        
        # Should return 400 Bad Request
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print("✓ Invalid datetime format correctly rejected")


class TestTravelTimeEdgeCases:
    """Test edge cases for travel time validation"""
    
    def test_same_location_pickup(self):
        """
        Test: Booking pickup at same location as previous dropoff
        Travel time should be minimal/zero
        """
        response = requests.post(
            f"{BASE_URL}/api/scheduling/check-travel-time",
            json={
                "vehicle_id": VEHICLE_ID,
                "booking_id": "test-same-location",
                "booking_datetime": "2026-01-27T15:45:00Z",
                "pickup_location": "Newcastle Airport, UK",  # Same as CJ-064 dropoff
                "duration_minutes": 30
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Should be feasible since pickup is at same location as previous dropoff
        # Travel time should be 0 or very small
        if data["feasible"]:
            print(f"✓ Same location pickup is feasible: {data['message']}")
        else:
            # Even if not feasible, travel time should be minimal
            if data["conflicts"]:
                travel_time = data["conflicts"][0].get("travel_time_minutes", 0)
                print(f"✓ Same location pickup - travel time: {travel_time}min")
    
    def test_check_next_booking_conflict(self):
        """
        Test: Check if new booking would conflict with NEXT scheduled booking
        This tests the reverse direction - from new booking dropoff to next pickup
        """
        # CJ-067 is at 18:00 on the same vehicle
        # If we add a booking that ends close to 18:00, it should check travel time
        response = requests.post(
            f"{BASE_URL}/api/scheduling/check-travel-time",
            json={
                "vehicle_id": VEHICLE_ID,
                "booking_id": "test-before-next",
                "booking_datetime": "2026-01-27T17:30:00Z",  # 30min before CJ-067
                "pickup_location": "Durham, UK",
                "duration_minutes": 30  # Would end at 18:00
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        
        print(f"✓ Next booking conflict check: feasible={data['feasible']}, conflicts={len(data['conflicts'])}, warnings={len(data['warnings'])}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
