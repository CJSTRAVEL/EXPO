import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { MapPin, Clock, User, Phone, Car, FileText, CheckCircle, Navigation, Circle, AlertCircle, RefreshCw, Info, Shield, Calendar, ArrowRight, Mail } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format, differenceInDays, differenceInHours } from "date-fns";
import { GoogleMap, useJsApiLoader, Marker, DirectionsRenderer } from "@react-google-maps/api";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;

// Google Maps libraries to load
const libraries = ["places", "geometry"];

// Map container style
const mapContainerStyle = {
  width: '100%',
  height: '100%'
};

// Default map options for a clean, modern look
const mapOptions = {
  disableDefaultUI: false,
  zoomControl: true,
  mapTypeControl: false,
  streetViewControl: false,
  fullscreenControl: true,
  styles: [
    { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
    { featureType: "transit", elementType: "labels", stylers: [{ visibility: "off" }] }
  ]
};

// Calculate days until journey
const getDaysUntilJourney = (bookingDatetime) => {
  const now = new Date();
  const journeyDate = new Date(bookingDatetime);
  const days = differenceInDays(journeyDate, now);
  const hours = differenceInHours(journeyDate, now) % 24;
  
  if (days < 0) return null; // Journey in past
  if (days === 0) {
    if (hours <= 0) return "Your journey is starting soon!";
    return `Your journey is in ${hours} hour${hours !== 1 ? 's' : ''}`;
  }
  if (days === 1) return "Not long now, 1 day until your journey";
  return `Not long now, ${days} days until your journey`;
};

// Uber-style Live Tracking Header
const TrackingHeader = ({ status, bookingDatetime, driverInfo, etaMinutes, driverStatus, returnBooking }) => {
  const bookingTime = new Date(bookingDatetime);
  const daysUntil = getDaysUntilJourney(bookingDatetime);
  
  const getStatusInfo = () => {
    // Check if driver has a specific status (on_route, arrived, etc.)
    const isDriverOnRoute = driverStatus === 'on_route' || driverStatus === 'on-route';
    const isDriverArrived = driverStatus === 'arrived' || driverStatus === 'at_pickup';
    
    switch (status) {
      case 'pending':
        return {
          title: 'Booking Confirmed',
          subtitle: daysUntil || `Pickup scheduled for ${format(bookingTime, 'EEE, d MMM yyyy')} at ${format(bookingTime, 'h:mm a')}`,
          progress: [true, false, false, false],
          showEta: false,
          showCountdown: true
        };
      case 'assigned':
        if (isDriverArrived) {
          return {
            title: 'Driver Arrived',
            subtitle: 'Your driver is waiting at the pickup location',
            progress: [true, true, true, false],
            showEta: false,
            showCountdown: false
          };
        }
        if (isDriverOnRoute) {
          return {
            title: 'Driver On Route',
            subtitle: etaMinutes ? `Arriving in approximately ${etaMinutes} minutes` : 'Your driver is on the way',
            progress: [true, true, false, false],
            showEta: true,
            showCountdown: false
          };
        }
        return {
          title: 'Driver Assigned',
          subtitle: daysUntil || `Pickup at ${format(bookingTime, 'h:mm a')} on ${format(bookingTime, 'EEE, d MMM')}`,
          progress: [true, true, false, false],
          showEta: false,
          showCountdown: true
        };
      case 'in_progress':
        return {
          title: 'Journey In Progress',
          subtitle: 'Enjoy your ride!',
          progress: [true, true, true, false],
          showEta: false,
          showCountdown: false
        };
      case 'completed':
        return {
          title: 'Journey Completed',
          subtitle: 'Thank you for travelling with us!',
          progress: [true, true, true, true],
          showEta: false,
          showCountdown: false
        };
      case 'cancelled':
        return {
          title: 'Booking Cancelled',
          subtitle: 'This booking has been cancelled',
          progress: [false, false, false, false],
          showEta: false,
          showCountdown: false
        };
      default:
        return {
          title: 'Booking Confirmed',
          subtitle: daysUntil || 'Your journey details are below',
          progress: [true, false, false, false],
          showEta: false,
          showCountdown: true
        };
    }
  };

  const info = getStatusInfo();
  
  // Calculate latest arrival time (5 mins after ETA)
  const latestArrival = new Date(bookingTime.getTime() + 5 * 60000);

  return (
    <div className="bg-white border-b">
      <div className="p-6">
        <div className="flex items-center gap-3 mb-2">
          {status === 'pending' || (status === 'assigned' && !driverStatus) ? (
            <CheckCircle className="w-8 h-8 text-green-500" />
          ) : driverStatus === 'arrived' || driverStatus === 'at_pickup' ? (
            <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
              <Car className="w-5 h-5 text-white" />
            </div>
          ) : driverStatus === 'on_route' || driverStatus === 'on-route' ? (
            <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center animate-pulse">
              <Navigation className="w-5 h-5 text-white" />
            </div>
          ) : null}
          <h1 className="text-2xl font-bold text-gray-900">{info.title}</h1>
        </div>
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
        
        {info.showEta && etaMinutes && (
          <div className="flex items-center gap-2 text-gray-500 text-sm">
            <Clock className="w-4 h-4" />
            <span>ETA: {etaMinutes} minutes</span>
          </div>
        )}
        
        {/* Return Booking Info */}
        {returnBooking && (
          <div className="mt-4 p-3 bg-amber-50 rounded-lg border border-amber-200">
            <div className="flex items-center gap-2 text-amber-800 font-medium mb-2">
              <ArrowRight className="w-4 h-4" />
              <span>Return Journey</span>
            </div>
            <p className="text-sm text-amber-700">
              {format(new Date(returnBooking.booking_datetime), 'EEE, d MMM yyyy')} at {format(new Date(returnBooking.booking_datetime), 'h:mm a')}
            </p>
            <p className="text-xs text-amber-600 mt-1">
              {returnBooking.pickup_location} → {returnBooking.dropoff_location}
            </p>
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

  // Load Google Maps
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries
  });

  const mapRef = useRef(null);
  const [directions, setDirections] = useState(null);
  const [pickupCoords, setPickupCoords] = useState(null);
  const [dropoffCoords, setDropoffCoords] = useState(null);

  // Geocode addresses to get coordinates
  useEffect(() => {
    if (!isLoaded || !window.google) return;

    const geocoder = new window.google.maps.Geocoder();

    // Geocode pickup
    if (pickupLocation) {
      geocoder.geocode({ address: pickupLocation }, (results, status) => {
        if (status === 'OK' && results[0]) {
          setPickupCoords({
            lat: results[0].geometry.location.lat(),
            lng: results[0].geometry.location.lng()
          });
        }
      });
    }

    // Geocode dropoff
    if (dropoffLocation) {
      geocoder.geocode({ address: dropoffLocation }, (results, status) => {
        if (status === 'OK' && results[0]) {
          setDropoffCoords({
            lat: results[0].geometry.location.lat(),
            lng: results[0].geometry.location.lng()
          });
        }
      });
    }
  }, [isLoaded, pickupLocation, dropoffLocation]);

  // Get directions between pickup and dropoff
  useEffect(() => {
    if (!isLoaded || !window.google || !pickupCoords || !dropoffCoords) return;

    const directionsService = new window.google.maps.DirectionsService();
    
    directionsService.route(
      {
        origin: pickupCoords,
        destination: dropoffCoords,
        travelMode: window.google.maps.TravelMode.DRIVING
      },
      (result, status) => {
        if (status === 'OK') {
          setDirections(result);
        }
      }
    );
  }, [isLoaded, pickupCoords, dropoffCoords]);

  // Fit map to show all markers
  const onMapLoad = useCallback((map) => {
    mapRef.current = map;
    
    // Fit bounds when we have coordinates
    if (pickupCoords || dropoffCoords || driverLocation) {
      const bounds = new window.google.maps.LatLngBounds();
      
      if (pickupCoords) bounds.extend(pickupCoords);
      if (dropoffCoords) bounds.extend(dropoffCoords);
      if (driverLocation?.lat && driverLocation?.lng) {
        bounds.extend({ lat: driverLocation.lat, lng: driverLocation.lng });
      }
      
      map.fitBounds(bounds, { padding: 50 });
    }
  }, [pickupCoords, dropoffCoords, driverLocation]);

  // Update bounds when driver location changes
  useEffect(() => {
    if (mapRef.current && (pickupCoords || dropoffCoords || driverLocation)) {
      const bounds = new window.google.maps.LatLngBounds();
      
      if (pickupCoords) bounds.extend(pickupCoords);
      if (dropoffCoords) bounds.extend(dropoffCoords);
      if (driverLocation?.lat && driverLocation?.lng) {
        bounds.extend({ lat: driverLocation.lat, lng: driverLocation.lng });
      }
      
      mapRef.current.fitBounds(bounds, { padding: 50 });
    }
  }, [pickupCoords, dropoffCoords, driverLocation]);

  // Loading state
  if (loadError) {
    return (
      <div className="h-80 md:h-96 bg-gray-100 flex items-center justify-center">
        <p className="text-gray-500">Error loading map</p>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="h-80 md:h-96 bg-gray-100 flex items-center justify-center">
        <div className="animate-pulse text-gray-500">Loading map...</div>
      </div>
    );
  }

  // Default center (UK)
  const defaultCenter = pickupCoords || { lat: 54.5, lng: -1.5 };

  return (
    <div className="relative bg-gray-50">
      {/* Interactive Map Container */}
      <div className="relative h-80 md:h-96">
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          center={defaultCenter}
          zoom={12}
          onLoad={onMapLoad}
          options={mapOptions}
        >
          {/* Driver Marker */}
          {driverLocation?.lat && driverLocation?.lng && (
            <Marker
              position={{ lat: driverLocation.lat, lng: driverLocation.lng }}
              icon={{
                url: 'data:image/svg+xml,' + encodeURIComponent(`
                  <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
                    <circle cx="20" cy="20" r="18" fill="#1a3a5c" stroke="white" stroke-width="3"/>
                    <text x="20" y="26" text-anchor="middle" fill="white" font-size="16" font-weight="bold">D</text>
                  </svg>
                `),
                scaledSize: new window.google.maps.Size(40, 40),
                anchor: new window.google.maps.Point(20, 20)
              }}
              title="Driver Location"
            />
          )}

          {/* Pickup Marker */}
          {pickupCoords && (
            <Marker
              position={pickupCoords}
              icon={{
                url: 'data:image/svg+xml,' + encodeURIComponent(`
                  <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
                    <circle cx="20" cy="20" r="18" fill="#22c55e" stroke="white" stroke-width="3"/>
                    <text x="20" y="26" text-anchor="middle" fill="white" font-size="16" font-weight="bold">P</text>
                  </svg>
                `),
                scaledSize: new window.google.maps.Size(40, 40),
                anchor: new window.google.maps.Point(20, 20)
              }}
              title={`Pickup: ${pickupLocation}`}
            />
          )}

          {/* Dropoff Marker */}
          {dropoffCoords && (
            <Marker
              position={dropoffCoords}
              icon={{
                url: 'data:image/svg+xml,' + encodeURIComponent(`
                  <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
                    <circle cx="20" cy="20" r="18" fill="#ef4444" stroke="white" stroke-width="3"/>
                    <text x="20" y="26" text-anchor="middle" fill="white" font-size="16" font-weight="bold">D</text>
                  </svg>
                `),
                scaledSize: new window.google.maps.Size(40, 40),
                anchor: new window.google.maps.Point(20, 20)
              }}
              title={`Dropoff: ${dropoffLocation}`}
            />
          )}

          {/* Route Line */}
          {directions && (
            <DirectionsRenderer
              directions={directions}
              options={{
                suppressMarkers: true,
                polylineOptions: {
                  strokeColor: '#1a3a5c',
                  strokeWeight: 5,
                  strokeOpacity: 0.8
                }
              }}
            />
          )}
        </GoogleMap>
        
        {/* ETA Bubble - Uber style */}
        {etaMinutes && (
          <div className="absolute top-4 left-4 bg-black text-white px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2 z-10">
            <Car className="w-5 h-5" />
            <span className="text-base font-bold">{etaMinutes} min</span>
          </div>
        )}
        
        {/* Refresh button */}
        <button 
          onClick={fetchDriverLocation}
          disabled={isRefreshing}
          className="absolute top-4 right-4 bg-white p-3 rounded-full shadow-lg hover:bg-gray-50 transition-colors border border-gray-200 z-10"
        >
          <RefreshCw className={`w-5 h-5 text-gray-700 ${isRefreshing ? 'animate-spin' : ''}`} />
        </button>

        {/* Legend */}
        <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm px-3 py-2 rounded-lg shadow-md text-xs z-10">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span>Pickup</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <span>Dropoff</span>
            </div>
            {driverLocation?.lat && (
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-[#1a3a5c]"></div>
                <span>Driver</span>
              </div>
            )}
          </div>
        </div>
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
      
      {/* Contact Information */}
      {(booking.customer_phone || booking.customer_email) && (
        <div className="pt-3 border-t">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Contact</p>
          <div className="flex flex-wrap gap-2">
            {booking.customer_phone && (
              <a 
                href={`tel:${booking.customer_phone}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-full text-sm text-gray-700 transition-colors"
              >
                <Phone className="w-3.5 h-3.5" />
                {booking.customer_phone}
              </a>
            )}
            {booking.customer_email && (
              <a 
                href={`mailto:${booking.customer_email}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-full text-sm text-gray-700 transition-colors"
              >
                <Mail className="w-3.5 h-3.5" />
                {booking.customer_email}
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const BookingDetails = () => {
  const { bookingId } = useParams();
  const [booking, setBooking] = useState(null);
  const [driver, setDriver] = useState(null);
  const [returnBooking, setReturnBooking] = useState(null);
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
      
      // Fetch driver if assigned (with separate error handling)
      if (response.data.driver_id) {
        try {
          const driverRes = await axios.get(`${API}/drivers/${response.data.driver_id}`);
          setDriver(driverRes.data);
        } catch (driverErr) {
          console.log('Driver not found or error fetching driver');
          setDriver(null);
        }
      }
      
      // Fetch linked return booking if exists
      if (response.data.linked_booking_id) {
        try {
          const returnRes = await axios.get(`${API}/bookings/${response.data.linked_booking_id}`);
          setReturnBooking(returnRes.data);
        } catch (e) {
          console.log('Return booking not found');
        }
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
            <a href="tel:+441917221223" className="text-sm text-gray-600 flex items-center gap-1">
              <Phone className="w-4 h-4" />
              Help
            </a>
          </div>
          
          {/* Tracking Header */}
          <TrackingHeader 
            status={booking.status} 
            bookingDatetime={booking.booking_datetime}
            driverInfo={driver}
            driverStatus={driver?.shift_status}
            returnBooking={returnBooking}
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
