import { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { MapPin, Clock, User, Phone, Car, FileText, CheckCircle, Navigation, Circle, AlertCircle, RefreshCw, Info, Shield } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const GOOGLE_MAPS_API_KEY = "AIzaSyBSL4bF8eGeiABUOK0GM8UoWBzqtUVfMIs";

// Uber-style Live Tracking Header
const TrackingHeader = ({ status, bookingDatetime, driverInfo, etaMinutes }) => {
  const bookingTime = new Date(bookingDatetime);
  
  const getStatusInfo = () => {
    switch (status) {
      case 'pending':
        return {
          title: 'Finding your driver...',
          subtitle: 'We\'re assigning the best driver for you',
          progress: [false, false, false, false],
          showEta: false
        };
      case 'assigned':
        return {
          title: 'Driver assigned',
          subtitle: `Pickup at ${format(bookingTime, 'h:mm a')}`,
          progress: [true, false, false, false],
          showEta: true
        };
      case 'in_progress':
        return {
          title: 'Heading your way...',
          subtitle: `Estimated arrival ${format(bookingTime, 'h:mm a')}`,
          progress: [true, true, true, false],
          showEta: true
        };
      case 'completed':
        return {
          title: 'Journey completed',
          subtitle: 'Thank you for travelling with us!',
          progress: [true, true, true, true],
          showEta: false
        };
      case 'cancelled':
        return {
          title: 'Booking cancelled',
          subtitle: 'This booking has been cancelled',
          progress: [false, false, false, false],
          showEta: false
        };
      default:
        return {
          title: 'Tracking your journey',
          subtitle: 'Please wait...',
          progress: [false, false, false, false],
          showEta: false
        };
    }
  };

  const info = getStatusInfo();
  
  // Calculate latest arrival time (5 mins after ETA)
  const latestArrival = new Date(bookingTime.getTime() + 5 * 60000);

  return (
    <div className="bg-white border-b">
      <div className="p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">{info.title}</h1>
        <p className="text-lg text-gray-600">{info.subtitle}</p>
        
        {/* Progress Bar */}
        <div className="flex gap-1 mt-4 mb-3">
          {info.progress.map((completed, idx) => (
            <div 
              key={idx} 
              className={`flex-1 h-1.5 rounded-full transition-colors ${
                completed ? 'bg-green-500' : 'bg-gray-200'
              }`}
            />
          ))}
        </div>
        
        {info.showEta && (
          <div className="flex items-center gap-2 text-gray-500 text-sm">
            <span>Latest arrival by {format(latestArrival, 'h:mm a')}</span>
            <Info className="w-4 h-4" />
          </div>
        )}
      </div>
    </div>
  );
};

// Uber-style Map with Car Icon and Route Line
const LiveTrackingMap = ({ bookingId, pickupLocation, dropoffLocation, status, driverInfo, onEtaUpdate }) => {
  const [driverLocation, setDriverLocation] = useState(null);
  const [routePolyline, setRoutePolyline] = useState(null);
  const [etaMinutes, setEtaMinutes] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchDriverLocation = useCallback(async () => {
    try {
      setIsRefreshing(true);
      const response = await axios.get(`${API}/tracking/${bookingId}/driver-location`);
      if (response.data.has_driver && response.data.location) {
        const loc = response.data.location;
        const normalizedLocation = {
          lat: loc.lat || loc.latitude,
          lng: loc.lng || loc.longitude,
          updated_at: loc.updated_at
        };
        setDriverLocation(normalizedLocation);
        setLastUpdated(new Date());
        
        // Set route polyline and ETA from backend
        if (response.data.route_polyline) {
          setRoutePolyline(response.data.route_polyline);
        }
        if (response.data.eta_minutes) {
          setEtaMinutes(response.data.eta_minutes);
          if (onEtaUpdate) onEtaUpdate(response.data.eta_minutes);
        }
      }
    } catch (err) {
      console.error("Error fetching driver location:", err);
    } finally {
      setIsRefreshing(false);
    }
  }, [bookingId, onEtaUpdate]);

  useEffect(() => {
    if (status === 'assigned' || status === 'in_progress') {
      fetchDriverLocation();
      const interval = setInterval(fetchDriverLocation, 10000);
      return () => clearInterval(interval);
    }
  }, [status, fetchDriverLocation]);

  // Render Uber-style map with route line
  if (driverLocation && driverLocation.lat && driverLocation.lng) {
    const driverLat = driverLocation.lat;
    const driverLng = driverLocation.lng;
    
    // CJ's Executive Travel logo as driver icon
    const logoIconUrl = 'https://customer-assets.emergentagent.com/job_cj-travel-app/artifacts/r7l3b1ck_Logo%20With%20Border.png';
    
    // Build static map URL with sleek black route line
    let staticMapUrl = `https://maps.googleapis.com/maps/api/staticmap?size=640x320&scale=2&maptype=roadmap`;
    
    // Add custom map styling for cleaner look (hide POIs, simplify)
    staticMapUrl += `&style=feature:poi%7Cvisibility:off`;
    staticMapUrl += `&style=feature:transit%7Cvisibility:off`;
    
    // Add the route polyline if available (black line)
    if (routePolyline) {
      staticMapUrl += `&path=color:0x000000ff%7Cweight:5%7Cenc:${routePolyline}`;
    }
    
    // Add driver marker with CJ's logo
    staticMapUrl += `&markers=anchor:center%7Cicon:${encodeURIComponent(logoIconUrl)}%7C${driverLat},${driverLng}`;
    
    // Add pickup marker (green dot for destination)
    staticMapUrl += `&markers=color:0x22c55e%7Csize:mid%7Clabel:P%7C${encodeURIComponent(pickupLocation)}`;
    
    staticMapUrl += `&key=${GOOGLE_MAPS_API_KEY}`;

    return (
      <div className="relative bg-gray-50">
        {/* Map Container */}
        <div className="relative h-72">
          <img
            src={staticMapUrl}
            alt="Live Driver Location"
            className="w-full h-full object-cover"
          />
          
          {/* ETA Bubble - Uber style */}
          {etaMinutes && (
            <div className="absolute top-4 left-4 bg-black text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
              <Car className="w-4 h-4" />
              <span className="text-sm font-bold">{etaMinutes} min</span>
            </div>
          )}
          
          {/* Refresh button */}
          <button 
            onClick={fetchDriverLocation}
            disabled={isRefreshing}
            className="absolute top-4 right-4 bg-white p-2.5 rounded-full shadow-lg hover:bg-gray-50 transition-colors border border-gray-200"
          >
            <RefreshCw className={`w-4 h-4 text-gray-700 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
          
          {/* Bottom gradient overlay */}
          <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-white to-transparent" />
        </div>
      </div>
    );
  }

  // Fallback - show pickup location only
  const staticMapUrl = `https://maps.googleapis.com/maps/api/staticmap?size=640x320&scale=2&maptype=roadmap&style=feature:poi%7Cvisibility:off&center=${encodeURIComponent(pickupLocation)}&zoom=14&markers=color:0x000000%7Csize:small%7C${encodeURIComponent(pickupLocation)}&key=${GOOGLE_MAPS_API_KEY}`;

  return (
    <div className="relative bg-gray-50">
      <div className="relative h-72">
        <img
          src={staticMapUrl}
          alt="Pickup Location"
          className="w-full h-full object-cover"
        />
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-white to-transparent" />
      </div>
    </div>
  );
};

// Uber-style Driver Card
const DriverCard = ({ driver }) => {
  if (!driver) return null;

  // Mask registration to show only last 4 characters
  const maskedReg = driver.vehicle_registration 
    ? `***${driver.vehicle_registration.slice(-4)}`
    : null;

  // Vehicle image based on type or default white sedan
  const getVehicleImage = () => {
    const type = (driver.vehicle_type || '').toLowerCase();
    if (type.includes('mpv') || type.includes('van')) {
      return 'https://www.uber-assets.com/image/upload/f_auto,q_auto:eco,c_fill,w_956,h_537/v1569012872/assets/4e/51a168-54d0-4a28-ae4f-e7ce8f948cc4/original/Final_Black.png';
    }
    if (type.includes('exec') || type.includes('luxury')) {
      return 'https://www.uber-assets.com/image/upload/f_auto,q_auto:eco,c_fill,w_956,h_537/v1555367310/assets/30/51e602-10bb-4e65-b122-e394d80a9c47/original/Final_Black.png';
    }
    // Default sedan
    return 'https://www.uber-assets.com/image/upload/f_auto,q_auto:eco,c_fill,w_956,h_537/v1555367538/assets/31/ad21d7-595c-42e8-ac53-53966b4a5fee/original/Final_Black.png';
  };

  return (
    <div className="bg-white border-t p-4">
      <div className="flex items-center gap-4">
        {/* Vehicle Image */}
        <div className="w-20 h-14 flex-shrink-0">
          <img 
            src={getVehicleImage()}
            alt={driver.vehicle_type || 'Vehicle'}
            className="w-full h-full object-contain"
            onError={(e) => {
              e.target.style.display = 'none';
            }}
          />
        </div>
        
        {/* Driver Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-green-600" />
            <span className="font-semibold text-gray-900">{driver.name}</span>
            {maskedReg && (
              <>
                <span className="text-gray-400">•</span>
                <span className="text-gray-600">{maskedReg}</span>
              </>
            )}
          </div>
          <p className="text-gray-500 text-sm truncate">
            {[driver.vehicle_colour, driver.vehicle_make, driver.vehicle_model].filter(Boolean).join(' ') || driver.vehicle_type || 'Executive Vehicle'}
          </p>
        </div>
        
        {/* Call Button */}
        {driver.phone && (
          <a 
            href={`tel:${driver.phone}`}
            className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
          >
            <Phone className="w-5 h-5 text-gray-700" />
          </a>
        )}
      </div>
    </div>
  );
};

// Journey Details Section
const JourneyDetails = ({ booking }) => {
  return (
    <div className="bg-white p-4 space-y-4">
      <h3 className="font-semibold text-gray-900">Journey Details</h3>
      
      <div className="space-y-3">
        {/* Pickup */}
        <div className="flex items-start gap-3">
          <div className="w-3 h-3 rounded-full bg-black mt-1.5 flex-shrink-0" />
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Pickup</p>
            <p className="text-gray-900">{booking.pickup_location}</p>
          </div>
        </div>
        
        {/* Dropoff */}
        <div className="flex items-start gap-3">
          <div className="w-3 h-3 rounded-sm bg-black mt-1.5 flex-shrink-0" />
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Drop-off</p>
            <p className="text-gray-900">{booking.dropoff_location}</p>
          </div>
        </div>
      </div>
      
      {/* Stats */}
      {(booking.distance_miles || booking.duration_minutes) && (
        <div className="flex items-center gap-6 pt-3 border-t">
          {booking.distance_miles && (
            <div>
              <p className="text-lg font-semibold text-gray-900">{booking.distance_miles} miles</p>
              <p className="text-xs text-gray-500">Distance</p>
            </div>
          )}
          {booking.duration_minutes && (
            <div>
              <p className="text-lg font-semibold text-gray-900">
                {booking.duration_minutes >= 60 
                  ? `${Math.floor(booking.duration_minutes / 60)}h ${booking.duration_minutes % 60}m`
                  : `${booking.duration_minutes} mins`
                }
              </p>
              <p className="text-xs text-gray-500">Est. Duration</p>
            </div>
          )}
        </div>
      )}
      
      {/* Date/Time */}
      <div className="pt-3 border-t">
        <p className="text-xs text-gray-500 uppercase tracking-wide">Scheduled</p>
        <p className="text-gray-900">
          {format(new Date(booking.booking_datetime), "EEEE, MMMM d 'at' h:mm a")}
        </p>
      </div>
      
      {/* Fare */}
      {booking.fare && (
        <div className="pt-3 border-t flex items-center justify-between">
          <span className="text-gray-500">Estimated Fare</span>
          <span className="text-xl font-bold text-gray-900">£{booking.fare.toFixed(2)}</span>
        </div>
      )}
    </div>
  );
};

const BookingDetails = () => {
  const { bookingId } = useParams();
  const [booking, setBooking] = useState(null);
  const [driver, setDriver] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    document.title = "CJ's Executive Travel - Track Your Journey";
    
    const setMetaTag = (property, content) => {
      let meta = document.querySelector(`meta[property="${property}"]`);
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute('property', property);
        document.head.appendChild(meta);
      }
      meta.setAttribute('content', content);
    };
    
    setMetaTag('og:title', "CJ's Executive Travel - Track Your Journey");
    setMetaTag('og:description', 'Track your driver in real-time.');
    setMetaTag('og:type', 'website');
    setMetaTag('og:url', window.location.href);
    
    return () => {
      document.title = "Emergent | Fullstack App";
    };
  }, []);

  const fetchBooking = async () => {
    try {
      const response = await axios.get(`${API}/bookings/${bookingId}`);
      setBooking(response.data);
      
      if (response.data.driver_id) {
        const driverRes = await axios.get(`${API}/drivers/${response.data.driver_id}`);
        setDriver(driverRes.data);
      }
    } catch (err) {
      setError("Booking not found");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (bookingId) {
      fetchBooking();
      const interval = setInterval(fetchBooking, 30000);
      return () => clearInterval(interval);
    }
  }, [bookingId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-pulse text-gray-500">Loading...</div>
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-sm p-6 text-center max-w-sm mx-4">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Booking Not Found</h2>
          <p className="text-gray-500">The booking you're looking for doesn't exist.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100" data-testid="booking-details-page">
      <div className="max-w-lg mx-auto bg-white min-h-screen shadow-sm">
        {/* Header */}
        <div className="bg-white">
          {/* Logo Bar */}
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <img 
              src="https://customer-assets.emergentagent.com/job_c2bf04a6-1cc1-4dad-86ae-c96a52a9ec62/artifacts/t13g8907_Logo%20With%20Border.png" 
              alt="CJ's Executive Travel" 
              className="h-10 object-contain"
            />
            <a href="tel:+447383185260" className="text-sm text-gray-600 flex items-center gap-1">
              <Phone className="w-4 h-4" />
              Help
            </a>
          </div>
          
          {/* Tracking Header */}
          <TrackingHeader 
            status={booking.status} 
            bookingDatetime={booking.booking_datetime}
            driverInfo={driver}
          />
        </div>

        {/* Map Section */}
        <LiveTrackingMap 
          bookingId={bookingId}
          pickupLocation={booking.pickup_location}
          dropoffLocation={booking.dropoff_location}
          status={booking.status}
          driverInfo={driver}
        />

        {/* Driver Card */}
        {driver && <DriverCard driver={driver} />}

        {/* Journey Details */}
        <div className="border-t">
          <JourneyDetails booking={booking} />
        </div>

        {/* Footer */}
        <div className="bg-gray-50 border-t p-4 text-center text-sm text-gray-500">
          <p>Powered by <strong>CJ's Executive Travel</strong></p>
          <div className="flex items-center justify-center gap-1 mt-1">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-xs">Live updates every 10 seconds</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BookingDetails;
