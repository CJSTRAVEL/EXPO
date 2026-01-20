import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { User, Phone, Calendar, Clock, MapPin, LogOut, ChevronRight, Plus, Plane, Loader2, X, ArrowLeftRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import AddressAutocomplete from "@/components/AddressAutocomplete";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const getStatusBadge = (status) => {
  const variants = {
    pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
    assigned: "bg-blue-100 text-blue-800 border-blue-200",
    in_progress: "bg-purple-100 text-purple-800 border-purple-200",
    completed: "bg-green-100 text-green-800 border-green-200",
    cancelled: "bg-red-100 text-red-800 border-red-200",
  };
  return (
    <Badge variant="outline" className={`${variants[status] || variants.pending}`}>
      {status?.replace("_", " ").toUpperCase()}
    </Badge>
  );
};

const getStatusColor = (status) => {
  switch (status) {
    case 'completed': return 'border-l-green-500';
    case 'in_progress': return 'border-l-purple-500';
    case 'assigned': return 'border-l-blue-500';
    case 'cancelled': return 'border-l-red-500';
    default: return 'border-l-yellow-500';
  }
};

const BookingDetailModal = ({ booking, onClose }) => {
  if (!booking) return null;

  return (
    <Dialog open={!!booking} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]" data-testid="booking-detail-modal">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Booking Details</span>
            <span className="text-sm font-mono font-semibold text-primary bg-primary/10 px-2 py-1 rounded">
              {booking.booking_id}
            </span>
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* Status */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Status</span>
            {getStatusBadge(booking.status)}
          </div>

          {/* Date & Time */}
          <div className="bg-slate-50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="w-4 h-4 text-primary" />
              <span className="font-medium">
                {format(new Date(booking.booking_datetime), "EEEE, dd MMMM yyyy")}
              </span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="w-4 h-4" />
              <span>{format(new Date(booking.booking_datetime), "HH:mm")}</span>
            </div>
          </div>

          {/* Route */}
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <div className="flex flex-col items-center mt-1">
                <div className="w-3 h-3 rounded-full bg-green-500 border-2 border-white shadow"></div>
                <div className="w-0.5 h-12 bg-slate-300"></div>
                <div className="w-3 h-3 rounded-full bg-red-500 border-2 border-white shadow"></div>
              </div>
              <div className="flex-1">
                <div className="mb-4">
                  <p className="text-xs text-muted-foreground">Pickup</p>
                  <p className="font-medium">{booking.pickup_location}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Drop-off</p>
                  <p className="font-medium">{booking.dropoff_location}</p>
                </div>
              </div>
            </div>
            
            {(booking.distance_miles || booking.duration_minutes) && (
              <div className="flex gap-4 mt-4 pt-3 border-t border-blue-200">
                {booking.distance_miles && (
                  <span className="text-sm text-blue-700">
                    <strong>{booking.distance_miles}</strong> miles
                  </span>
                )}
                {booking.duration_minutes && (
                  <span className="text-sm text-blue-700">
                    <strong>{booking.duration_minutes}</strong> mins
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Fare */}
          {booking.fare && (
            <div className="flex items-center justify-between py-3 border-t">
              <span className="text-muted-foreground">Fare</span>
              <span className="text-xl font-bold text-green-600">£{booking.fare.toFixed(2)}</span>
            </div>
          )}

          {/* Notes */}
          {booking.notes && (
            <div className="bg-amber-50 rounded-lg p-3 border border-amber-200">
              <p className="text-xs text-amber-700 font-medium mb-1">Notes</p>
              <p className="text-sm">{booking.notes}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

const PassengerPortal = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [bookingRequests, setBookingRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const [returnDateOpen, setReturnDateOpen] = useState(false);
  const [showFlightInfo, setShowFlightInfo] = useState(false);
  const [showReturnFlightInfo, setShowReturnFlightInfo] = useState(false);
  const [loadingFlight, setLoadingFlight] = useState(false);
  const [loadingReturnFlight, setLoadingReturnFlight] = useState(false);
  const [flightData, setFlightData] = useState(null);
  const [returnFlightData, setReturnFlightData] = useState(null);
  const [flightError, setFlightError] = useState(null);
  const [returnFlightError, setReturnFlightError] = useState(null);
  const [requestForm, setRequestForm] = useState({
    pickup_location: "",
    dropoff_location: "",
    additional_stops: [],
    pickup_datetime: new Date(),
    passenger_count: 1,
    luggage_count: 0,
    notes: "",
    // Flight info
    flight_number: "",
    airline: "",
    flight_type: "",
    terminal: "",
    // Return booking
    create_return: false,
    return_pickup_location: "",
    return_dropoff_location: "",
    return_datetime: null,
    // Return flight info
    return_flight_number: "",
    return_airline: "",
    return_flight_type: "",
    return_terminal: "",
  });

  useEffect(() => {
    // Check if logged in
    const token = localStorage.getItem("passengerToken");
    const userInfo = localStorage.getItem("passengerInfo");
    
    if (!token || !userInfo) {
      navigate("/login");
      return;
    }

    setUser(JSON.parse(userInfo));
    fetchBookings(token);
  }, [navigate]);

  const fetchBookings = async (token) => {
    try {
      const [bookingsRes, requestsRes] = await Promise.all([
        axios.get(`${API}/passenger/bookings`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API}/passenger/booking-requests`, {
          headers: { Authorization: `Bearer ${token}` }
        }).catch(() => ({ data: [] })) // Handle if endpoint doesn't exist yet
      ]);
      setBookings(bookingsRes.data);
      setBookingRequests(requestsRes.data || []);
    } catch (error) {
      if (error.response?.status === 401) {
        handleLogout();
      } else {
        toast.error("Failed to load bookings");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitRequest = async () => {
    if (!requestForm.pickup_location || !requestForm.dropoff_location) {
      toast.error("Please enter pickup and drop-off locations");
      return;
    }

    setSubmitting(true);
    try {
      const token = localStorage.getItem("passengerToken");
      
      // Build flight_info object if any flight fields are filled
      let flight_info = null;
      if (requestForm.flight_number || requestForm.airline || requestForm.flight_type || requestForm.terminal) {
        flight_info = {
          flight_number: requestForm.flight_number || null,
          airline: requestForm.airline || null,
          flight_type: requestForm.flight_type || null,
          terminal: requestForm.terminal || null,
        };
      }

      // Build return flight_info object
      let return_flight_info = null;
      if (requestForm.create_return && (requestForm.return_flight_number || requestForm.return_airline)) {
        return_flight_info = {
          flight_number: requestForm.return_flight_number || null,
          airline: requestForm.return_airline || null,
          flight_type: requestForm.return_flight_type || null,
          terminal: requestForm.return_terminal || null,
        };
      }

      await axios.post(`${API}/passenger/booking-requests`, {
        pickup_location: requestForm.pickup_location,
        dropoff_location: requestForm.dropoff_location,
        additional_stops: requestForm.additional_stops.length > 0 ? requestForm.additional_stops : null,
        pickup_datetime: requestForm.pickup_datetime.toISOString(),
        passenger_count: parseInt(requestForm.passenger_count) || 1,
        luggage_count: parseInt(requestForm.luggage_count) || 0,
        notes: requestForm.notes,
        flight_number: requestForm.flight_number || null,
        flight_info: flight_info,
        // Return booking fields
        create_return: requestForm.create_return,
        return_pickup_location: requestForm.create_return ? requestForm.return_pickup_location : null,
        return_dropoff_location: requestForm.create_return ? requestForm.return_dropoff_location : null,
        return_datetime: requestForm.create_return && requestForm.return_datetime 
          ? requestForm.return_datetime.toISOString() 
          : null,
        return_flight_info: return_flight_info,
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success("Booking request submitted! We'll confirm shortly.");
      setShowRequestForm(false);
      resetRequestForm();
      fetchBookings(token);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to submit request");
    } finally {
      setSubmitting(false);
    }
  };

  const resetRequestForm = () => {
    setRequestForm({
      pickup_location: "",
      dropoff_location: "",
      additional_stops: [],
      pickup_datetime: new Date(),
      passenger_count: 1,
      luggage_count: 0,
      notes: "",
      flight_number: "",
      airline: "",
      flight_type: "",
      terminal: "",
      create_return: false,
      return_pickup_location: "",
      return_dropoff_location: "",
      return_datetime: null,
      return_flight_number: "",
      return_airline: "",
      return_flight_type: "",
      return_terminal: "",
    });
    setShowFlightInfo(false);
    setShowReturnFlightInfo(false);
    setFlightData(null);
    setReturnFlightData(null);
    setFlightError(null);
    setReturnFlightError(null);
  };

  const handleFlightLookup = async (isReturn = false) => {
    const flightNumber = isReturn ? requestForm.return_flight_number : requestForm.flight_number;
    if (!flightNumber) {
      toast.error("Please enter a flight number");
      return;
    }

    if (isReturn) {
      setLoadingReturnFlight(true);
      setReturnFlightError(null);
    } else {
      setLoadingFlight(true);
      setFlightError(null);
    }

    try {
      const response = await axios.get(`${API}/flight-lookup`, {
        params: { flight_number: flightNumber }
      });
      
      const flightInfo = response.data;
      
      if (isReturn) {
        // For return (departure), set pickup 2 hours before flight
        let departureDateTime = requestForm.return_datetime;
        const departureTime = flightInfo.departure_scheduled;
        if (departureTime) {
          departureDateTime = new Date(new Date(departureTime).getTime() - 2 * 3600000);
        }
        
        // Determine dropoff location based on departure airport
        let dropoffLocation = requestForm.return_dropoff_location;
        if (flightInfo.departure_airport) {
          dropoffLocation = flightInfo.departure_airport;
        }
        
        setRequestForm(prev => ({
          ...prev,
          return_airline: flightInfo.airline || prev.return_airline,
          return_terminal: flightInfo.departure_terminal || prev.return_terminal,
          return_flight_type: "departure",
          return_dropoff_location: dropoffLocation || prev.return_dropoff_location,
          return_datetime: departureDateTime
        }));
        setReturnFlightData(flightInfo);
      } else {
        // For arrival, set pickup 30 mins after landing
        let arrivalDateTime = requestForm.pickup_datetime;
        const arrivalTime = flightInfo.arrival_scheduled || flightInfo.arrival_estimated;
        if (arrivalTime) {
          arrivalDateTime = new Date(new Date(arrivalTime).getTime() + 30 * 60000);
        }
        
        // Determine pickup location based on arrival airport
        let pickupLocation = requestForm.pickup_location;
        if (flightInfo.arrival_airport) {
          pickupLocation = flightInfo.arrival_airport;
          if (flightInfo.arrival_terminal) {
            pickupLocation += ` Terminal ${flightInfo.arrival_terminal}`;
          }
        }
        
        setRequestForm(prev => ({
          ...prev,
          airline: flightInfo.airline || prev.airline,
          terminal: flightInfo.arrival_terminal || prev.terminal,
          flight_type: "arrival",
          pickup_location: pickupLocation || prev.pickup_location,
          pickup_datetime: arrivalDateTime
        }));
        setFlightData(flightInfo);
      }
      
      toast.success("Flight data loaded!");
    } catch (err) {
      const errorMsg = "Flight not found or API error";
      if (isReturn) {
        setReturnFlightError(errorMsg);
      } else {
        setFlightError(errorMsg);
      }
      toast.error(errorMsg);
    } finally {
      if (isReturn) {
        setLoadingReturnFlight(false);
      } else {
        setLoadingFlight(false);
      }
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("passengerToken");
    localStorage.removeItem("passengerInfo");
    navigate("/login");
  };

  // Group bookings by status
  const upcomingBookings = bookings.filter(b => 
    ['pending', 'assigned', 'in_progress'].includes(b.status)
  );
  const pastBookings = bookings.filter(b => 
    ['completed', 'cancelled'].includes(b.status)
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50" data-testid="passenger-portal">
      {/* Header */}
      <header className="bg-white border-b shadow-sm sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img 
              src="https://customer-assets.emergentagent.com/job_30ae4b98-ebfc-45ee-a35f-fc60498c61c6/artifacts/i2qqz1kf_Logo%20Background.png" 
              alt="CJ's Executive Travel" 
              className="w-10 h-10 object-contain"
            />
            <div>
              <h1 className="font-bold text-slate-800">CJ&apos;s Executive Travel</h1>
              <p className="text-xs text-muted-foreground">Passenger Portal</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout} data-testid="logout-btn">
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        {/* Welcome Section */}
        <div className="bg-gradient-to-r from-primary to-primary/80 rounded-xl p-6 text-white mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center">
                <User className="w-7 h-7" />
              </div>
              <div>
                <p className="text-white/80 text-sm">Welcome back,</p>
                <h2 className="text-xl font-bold">{user?.name}</h2>
                <p className="text-white/70 text-sm flex items-center gap-1 mt-1">
                  <Phone className="w-3 h-3" />
                  {user?.phone}
                </p>
              </div>
            </div>
            <Button 
              onClick={() => setShowRequestForm(true)}
              className="bg-white text-primary hover:bg-white/90"
              data-testid="request-booking-btn"
            >
              <Plus className="w-4 h-4 mr-2" />
              Request Booking
            </Button>
          </div>
        </div>

        {/* Pending Booking Requests */}
        {bookingRequests.filter(r => r.status === 'pending').length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-amber-600 uppercase tracking-wide mb-3">
              Pending Requests
            </h3>
            <div className="space-y-3">
              {bookingRequests.filter(r => r.status === 'pending').map((request) => (
                <div
                  key={request.id}
                  className="bg-amber-50 rounded-lg border border-amber-200 p-4"
                  data-testid={`request-card-${request.id}`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300">
                        AWAITING CONFIRMATION
                      </Badge>
                      <p className="font-medium text-slate-800 mt-2">
                        {format(new Date(request.pickup_datetime), "EEE, dd MMM")}
                      </p>
                      <p className="text-lg font-bold">
                        {format(new Date(request.pickup_datetime), "HH:mm")}
                      </p>
                    </div>
                    {request.flight_number && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-600 text-white text-xs font-bold rounded">
                        <Plane className="w-3 h-3" />
                        {request.flight_number}
                      </span>
                    )}
                  </div>
                  
                  <div className="flex items-start gap-2">
                    <div className="flex flex-col items-center mt-1">
                      <div className="w-2 h-2 rounded-full bg-green-500"></div>
                      <div className="w-0.5 h-6 bg-amber-300"></div>
                      <div className="w-2 h-2 rounded-full bg-red-500"></div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-700 truncate">{request.pickup_location}</p>
                      <div className="h-3"></div>
                      <p className="text-sm text-slate-600 truncate">{request.dropoff_location}</p>
                    </div>
                  </div>
                  
                  {request.notes && (
                    <p className="text-xs text-amber-700 mt-3 bg-amber-100 rounded p-2">
                      Note: {request.notes}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-white rounded-lg p-4 border">
            <p className="text-2xl font-bold text-primary">{upcomingBookings.length}</p>
            <p className="text-sm text-muted-foreground">Upcoming Trips</p>
          </div>
          <div className="bg-white rounded-lg p-4 border">
            <p className="text-2xl font-bold text-green-600">{pastBookings.length}</p>
            <p className="text-sm text-muted-foreground">Past Trips</p>
          </div>
        </div>

        {/* Upcoming Bookings */}
        {upcomingBookings.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-3">
              Upcoming Trips
            </h3>
            <div className="space-y-3">
              {upcomingBookings.map((booking) => (
                <div
                  key={booking.id}
                  onClick={() => setSelectedBooking(booking)}
                  className={`bg-white rounded-lg border-l-4 shadow-sm p-4 cursor-pointer hover:shadow-md transition-shadow ${getStatusColor(booking.status)}`}
                  data-testid={`booking-card-${booking.id}`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-xs font-mono text-primary font-semibold">{booking.booking_id}</p>
                      <p className="font-medium text-slate-800">
                        {format(new Date(booking.booking_datetime), "EEE, dd MMM")}
                      </p>
                      <p className="text-lg font-bold">
                        {format(new Date(booking.booking_datetime), "HH:mm")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(booking.status)}
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-2">
                    <div className="flex flex-col items-center mt-1">
                      <div className="w-2 h-2 rounded-full bg-green-500"></div>
                      <div className="w-0.5 h-6 bg-slate-200"></div>
                      <div className="w-2 h-2 rounded-full bg-red-500"></div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-700 truncate">{booking.pickup_location}</p>
                      <div className="h-3"></div>
                      <p className="text-sm text-slate-600 truncate">{booking.dropoff_location}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Past Bookings */}
        {pastBookings.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-3">
              Past Trips
            </h3>
            <div className="space-y-3">
              {pastBookings.map((booking) => (
                <div
                  key={booking.id}
                  onClick={() => setSelectedBooking(booking)}
                  className={`bg-white rounded-lg border-l-4 shadow-sm p-4 cursor-pointer hover:shadow-md transition-shadow opacity-75 ${getStatusColor(booking.status)}`}
                  data-testid={`booking-card-${booking.id}`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-mono text-muted-foreground">{booking.booking_id}</p>
                      <p className="text-sm text-slate-600">
                        {format(new Date(booking.booking_datetime), "EEE, dd MMM yyyy")} at {format(new Date(booking.booking_datetime), "HH:mm")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {booking.fare && (
                        <span className="font-semibold text-green-600">£{booking.fare.toFixed(2)}</span>
                      )}
                      {getStatusBadge(booking.status)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* No Bookings */}
        {bookings.length === 0 && bookingRequests.length === 0 && (
          <div className="text-center py-12">
            <MapPin className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No bookings yet</h3>
            <p className="text-muted-foreground mb-4">Your bookings will appear here once confirmed</p>
            <Button onClick={() => setShowRequestForm(true)} data-testid="request-first-booking-btn">
              <Plus className="w-4 h-4 mr-2" />
              Request Your First Booking
            </Button>
          </div>
        )}
      </main>

      {/* Booking Detail Modal */}
      <BookingDetailModal
        booking={selectedBooking}
        onClose={() => setSelectedBooking(null)}
      />

      {/* Booking Request Form Modal */}
      <Dialog open={showRequestForm} onOpenChange={(open) => { if (!open) resetRequestForm(); setShowRequestForm(open); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" data-testid="request-form-modal">
          <DialogHeader>
            <DialogTitle>Request a Booking</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Pickup Location */}
            <div className="space-y-2">
              <Label htmlFor="pickup">Pickup Location *</Label>
              <AddressAutocomplete
                id="pickup"
                value={requestForm.pickup_location}
                onChange={(value) => setRequestForm({ ...requestForm, pickup_location: value })}
                placeholder="Start typing address..."
                data-testid="request-pickup-input"
              />
            </div>

            {/* Additional Stops */}
            <div className="space-y-2 pl-4 border-l-2 border-amber-300">
              <div className="flex items-center justify-between">
                <Label className="text-amber-700">Stops (in order)</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setRequestForm({ 
                    ...requestForm, 
                    additional_stops: [...requestForm.additional_stops, ""] 
                  })}
                  data-testid="request-add-stop-btn"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Stop
                </Button>
              </div>
              {requestForm.additional_stops.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">No intermediate stops - direct journey</p>
              ) : (
                requestForm.additional_stops.map((stop, index) => (
                  <div key={index} className="flex gap-2 items-center">
                    <span className="text-xs font-semibold text-amber-600 w-6">{index + 1}.</span>
                    <div className="flex-1">
                      <AddressAutocomplete
                        value={stop}
                        onChange={(value) => {
                          const newStops = [...requestForm.additional_stops];
                          newStops[index] = value;
                          setRequestForm({ ...requestForm, additional_stops: newStops });
                        }}
                        placeholder={`Stop ${index + 1} address...`}
                        data-testid={`request-stop-${index}-input`}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 text-destructive hover:text-destructive"
                      onClick={() => {
                        const newStops = requestForm.additional_stops.filter((_, i) => i !== index);
                        setRequestForm({ ...requestForm, additional_stops: newStops });
                      }}
                      data-testid={`request-remove-stop-${index}-btn`}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))
              )}
            </div>

            {/* Dropoff Location */}
            <div className="space-y-2">
              <Label htmlFor="dropoff">Final Drop-off Location *</Label>
              <AddressAutocomplete
                id="dropoff"
                value={requestForm.dropoff_location}
                onChange={(value) => setRequestForm({ ...requestForm, dropoff_location: value })}
                placeholder="Start typing address..."
                data-testid="request-dropoff-input"
              />
            </div>

            {/* PAX and Cases */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>PAX (Passengers)</Label>
                <Input
                  type="number"
                  min="1"
                  max="20"
                  value={requestForm.passenger_count}
                  onChange={(e) => setRequestForm({ ...requestForm, passenger_count: e.target.value })}
                  placeholder="1"
                  data-testid="request-pax-input"
                />
              </div>
              <div className="space-y-2">
                <Label>Cases (Luggage)</Label>
                <Input
                  type="number"
                  min="0"
                  max="20"
                  value={requestForm.luggage_count}
                  onChange={(e) => setRequestForm({ ...requestForm, luggage_count: e.target.value })}
                  placeholder="0"
                  data-testid="request-cases-input"
                />
              </div>
            </div>

            {/* Date & Time */}
            <div className="space-y-2">
              <Label>Pickup Date & Time *</Label>
              <Popover open={dateOpen} onOpenChange={setDateOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !requestForm.pickup_datetime && "text-muted-foreground"
                    )}
                    data-testid="request-datetime-btn"
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    {requestForm.pickup_datetime 
                      ? format(requestForm.pickup_datetime, "dd/MM/yy 'at' HH:mm") 
                      : "Select date & time"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={requestForm.pickup_datetime}
                    onSelect={(date) => {
                      if (date) {
                        const current = requestForm.pickup_datetime;
                        date.setHours(current.getHours(), current.getMinutes());
                        setRequestForm({ ...requestForm, pickup_datetime: date });
                      }
                    }}
                    disabled={(date) => date < new Date()}
                    initialFocus
                  />
                  <div className="p-3 border-t">
                    <Input
                      type="time"
                      value={format(requestForm.pickup_datetime, "HH:mm")}
                      onChange={(e) => {
                        const [hours, minutes] = e.target.value.split(':');
                        const newDate = new Date(requestForm.pickup_datetime);
                        newDate.setHours(parseInt(hours), parseInt(minutes));
                        setRequestForm({ ...requestForm, pickup_datetime: newDate });
                      }}
                      data-testid="request-time-input"
                    />
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {/* Flight Information Toggle */}
            <div className="space-y-3 border rounded-lg p-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showFlightInfo}
                  onChange={(e) => setShowFlightInfo(e.target.checked)}
                  className="rounded"
                  data-testid="request-flight-info-toggle"
                />
                <span className="text-sm font-medium flex items-center gap-2">
                  <Plane className="w-4 h-4" />
                  Airport Transfer / Flight Info
                </span>
              </label>
              
              {showFlightInfo && (
                <div className="space-y-3 pt-2 border-t">
                  {/* Flight Number with Lookup */}
                  <div className="space-y-1">
                    <Label className="text-xs">Flight Number</Label>
                    <div className="flex gap-2">
                      <Input
                        value={requestForm.flight_number}
                        onChange={(e) => setRequestForm({ ...requestForm, flight_number: e.target.value.toUpperCase() })}
                        placeholder="BA123"
                        className="flex-1"
                        data-testid="request-flight-number"
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={loadingFlight || !requestForm.flight_number}
                        onClick={() => handleFlightLookup(false)}
                        data-testid="lookup-flight-btn"
                      >
                        {loadingFlight ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <Plane className="w-4 h-4 mr-1" />
                            Lookup
                          </>
                        )}
                      </Button>
                    </div>
                    {flightError && (
                      <p className="text-xs text-red-500">{flightError}</p>
                    )}
                  </div>

                  {/* Live Flight Data Display */}
                  {flightData && !flightError && (
                    <div className="bg-blue-50 rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-blue-700">
                          ✈️ Live Flight Data {flightData.is_cached && "(cached)"}
                        </span>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                          flightData.flight_status === 'landed' ? 'bg-green-100 text-green-700' :
                          flightData.flight_status === 'active' ? 'bg-blue-100 text-blue-700' :
                          flightData.flight_status === 'scheduled' ? 'bg-gray-100 text-gray-700' :
                          flightData.flight_status === 'cancelled' ? 'bg-red-100 text-red-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {flightData.flight_status?.toUpperCase() || 'UNKNOWN'}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-muted-foreground">From:</span>
                          <p className="font-medium">{flightData.departure_airport}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">To:</span>
                          <p className="font-medium">{flightData.arrival_airport}</p>
                        </div>
                      </div>
                      {flightData.arrival_scheduled && (
                        <div className="text-xs pt-2 border-t border-blue-200">
                          <span className="text-muted-foreground">Arrival:</span>
                          <p className="font-medium">
                            {new Date(flightData.arrival_scheduled).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                            {flightData.arrival_terminal && ` - T${flightData.arrival_terminal}`}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Airline</Label>
                      <Input
                        value={requestForm.airline}
                        onChange={(e) => setRequestForm({ ...requestForm, airline: e.target.value })}
                        placeholder="British Airways"
                        data-testid="request-airline"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Terminal</Label>
                      <Input
                        value={requestForm.terminal}
                        onChange={(e) => setRequestForm({ ...requestForm, terminal: e.target.value })}
                        placeholder="Terminal 5"
                        data-testid="request-terminal"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Flight Type</Label>
                    <Select
                      value={requestForm.flight_type || ""}
                      onValueChange={(value) => setRequestForm({ ...requestForm, flight_type: value })}
                    >
                      <SelectTrigger data-testid="request-flight-type">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="arrival">Arrival (Pickup from Airport)</SelectItem>
                        <SelectItem value="departure">Departure (Drop-off at Airport)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>

            {/* Return Booking Option */}
            <div className="space-y-3 border-2 border-amber-300 rounded-lg p-3 bg-amber-50/50">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={requestForm.create_return}
                  onChange={(e) => {
                    const isChecked = e.target.checked;
                    setRequestForm({ 
                      ...requestForm, 
                      create_return: isChecked,
                      return_pickup_location: isChecked ? requestForm.dropoff_location : "",
                      return_dropoff_location: isChecked ? requestForm.pickup_location : "",
                      return_datetime: isChecked ? new Date(requestForm.pickup_datetime.getTime() + 3600000 * 3) : null
                    });
                  }}
                  className="rounded"
                  data-testid="request-create-return-toggle"
                />
                <span className="text-sm font-semibold text-amber-800 flex items-center gap-2">
                  <ArrowLeftRight className="w-4 h-4" />
                  Create Return Journey
                </span>
              </label>
              
              {requestForm.create_return && (
                <div className="pt-3 border-t border-amber-300 space-y-4">
                  <div className="bg-amber-100 rounded px-2 py-1">
                    <p className="text-xs font-semibold text-amber-800">RETURN JOURNEY DETAILS</p>
                  </div>
                  
                  {/* Return Pickup Location */}
                  <div className="space-y-2">
                    <Label className="text-amber-800">Return Pickup Location</Label>
                    <AddressAutocomplete
                      value={requestForm.return_pickup_location}
                      onChange={(value) => setRequestForm({ ...requestForm, return_pickup_location: value })}
                      placeholder="Where to pick up for return..."
                      data-testid="request-return-pickup-input"
                    />
                  </div>

                  {/* Return Dropoff Location */}
                  <div className="space-y-2">
                    <Label className="text-amber-800">Return Dropoff Location</Label>
                    <AddressAutocomplete
                      value={requestForm.return_dropoff_location}
                      onChange={(value) => setRequestForm({ ...requestForm, return_dropoff_location: value })}
                      placeholder="Where to drop off on return..."
                      data-testid="request-return-dropoff-input"
                    />
                  </div>

                  {/* Return Date & Time */}
                  <div className="space-y-2">
                    <Label className="text-amber-800">Return Date & Time</Label>
                    <Popover open={returnDateOpen} onOpenChange={setReturnDateOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal bg-white border-amber-300",
                            !requestForm.return_datetime && "text-muted-foreground"
                          )}
                          data-testid="request-return-datetime-btn"
                        >
                          <Clock className="mr-2 h-4 w-4 text-amber-600" />
                          {requestForm.return_datetime 
                            ? format(requestForm.return_datetime, "dd/MM/yy 'at' HH:mm") 
                            : "Pick return date & time"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarComponent
                          mode="single"
                          selected={requestForm.return_datetime}
                          onSelect={(date) => {
                            if (date) {
                              const current = requestForm.return_datetime || new Date();
                              date.setHours(current.getHours(), current.getMinutes());
                              setRequestForm({ ...requestForm, return_datetime: date });
                            }
                          }}
                          disabled={(date) => date < new Date()}
                        />
                        <div className="p-3 border-t">
                          <Input
                            type="time"
                            value={requestForm.return_datetime ? format(requestForm.return_datetime, "HH:mm") : "12:00"}
                            onChange={(e) => {
                              const [hours, minutes] = e.target.value.split(':');
                              const newDate = new Date(requestForm.return_datetime || new Date());
                              newDate.setHours(parseInt(hours), parseInt(minutes));
                              setRequestForm({ ...requestForm, return_datetime: newDate });
                            }}
                            data-testid="request-return-time-input"
                          />
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* Return Flight Info Toggle */}
                  <div className="space-y-3 border rounded-lg p-3 bg-white">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showReturnFlightInfo}
                        onChange={(e) => setShowReturnFlightInfo(e.target.checked)}
                        className="rounded"
                        data-testid="request-return-flight-info-toggle"
                      />
                      <span className="text-xs font-medium flex items-center gap-2">
                        <Plane className="w-3 h-3" />
                        Return Flight Info
                      </span>
                    </label>
                    
                    {showReturnFlightInfo && (
                      <div className="space-y-3 pt-2 border-t">
                        <div className="space-y-1">
                          <Label className="text-xs text-amber-800">Return Flight Number</Label>
                          <div className="flex gap-2">
                            <Input
                              value={requestForm.return_flight_number}
                              onChange={(e) => setRequestForm({ ...requestForm, return_flight_number: e.target.value.toUpperCase() })}
                              placeholder="BA456"
                              className="flex-1 bg-white"
                              data-testid="request-return-flight-number"
                            />
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              disabled={loadingReturnFlight || !requestForm.return_flight_number}
                              onClick={() => handleFlightLookup(true)}
                              data-testid="lookup-return-flight-btn"
                            >
                              {loadingReturnFlight ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <>
                                  <Plane className="w-4 h-4 mr-1" />
                                  Lookup
                                </>
                              )}
                            </Button>
                          </div>
                          {returnFlightError && (
                            <p className="text-xs text-red-500">{returnFlightError}</p>
                          )}
                        </div>

                        {/* Live Return Flight Data Display */}
                        {returnFlightData && !returnFlightError && (
                          <div className="bg-blue-50 rounded-lg p-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold text-blue-700">
                                ✈️ Return Flight Data {returnFlightData.is_cached && "(cached)"}
                              </span>
                              <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                                returnFlightData.flight_status === 'landed' ? 'bg-green-100 text-green-700' :
                                returnFlightData.flight_status === 'active' ? 'bg-blue-100 text-blue-700' :
                                returnFlightData.flight_status === 'scheduled' ? 'bg-gray-100 text-gray-700' :
                                returnFlightData.flight_status === 'cancelled' ? 'bg-red-100 text-red-700' :
                                'bg-gray-100 text-gray-700'
                              }`}>
                                {returnFlightData.flight_status?.toUpperCase() || 'UNKNOWN'}
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div>
                                <span className="text-muted-foreground">From:</span>
                                <p className="font-medium">{returnFlightData.departure_airport}</p>
                              </div>
                              <div>
                                <span className="text-muted-foreground">To:</span>
                                <p className="font-medium">{returnFlightData.arrival_airport}</p>
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs text-amber-800">Airline</Label>
                            <Input
                              value={requestForm.return_airline}
                              onChange={(e) => setRequestForm({ ...requestForm, return_airline: e.target.value })}
                              placeholder="British Airways"
                              className="bg-white"
                              data-testid="request-return-airline"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-amber-800">Terminal</Label>
                            <Input
                              value={requestForm.return_terminal}
                              onChange={(e) => setRequestForm({ ...requestForm, return_terminal: e.target.value })}
                              placeholder="Terminal 5"
                              className="bg-white"
                              data-testid="request-return-terminal"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <p className="text-xs text-amber-700 bg-amber-100 rounded p-2">
                    ↩️ A separate return booking request will be submitted
                  </p>
                </div>
              )}
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Additional Notes</Label>
              <Textarea
                id="notes"
                value={requestForm.notes}
                onChange={(e) => setRequestForm({ ...requestForm, notes: e.target.value })}
                placeholder="Any special requirements (luggage, child seats, etc.)..."
                rows={3}
                data-testid="request-notes-input"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { resetRequestForm(); setShowRequestForm(false); }}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmitRequest} 
              disabled={submitting}
              data-testid="submit-request-btn"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Submit Request"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PassengerPortal;
