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
      await axios.post(`${API}/passenger/booking-requests`, {
        ...requestForm,
        pickup_datetime: requestForm.pickup_datetime.toISOString(),
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success("Booking request submitted! We'll confirm shortly.");
      setShowRequestForm(false);
      setRequestForm({
        pickup_location: "",
        dropoff_location: "",
        pickup_datetime: new Date(),
        notes: "",
        flight_number: "",
      });
      fetchBookings(token);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to submit request");
    } finally {
      setSubmitting(false);
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
      <Dialog open={showRequestForm} onOpenChange={setShowRequestForm}>
        <DialogContent className="max-w-md" data-testid="request-form-modal">
          <DialogHeader>
            <DialogTitle>Request a Booking</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Pickup Location */}
            <div className="space-y-2">
              <Label htmlFor="pickup">Pickup Location *</Label>
              <Input
                id="pickup"
                value={requestForm.pickup_location}
                onChange={(e) => setRequestForm({ ...requestForm, pickup_location: e.target.value })}
                placeholder="Enter pickup address..."
                data-testid="request-pickup-input"
              />
            </div>

            {/* Dropoff Location */}
            <div className="space-y-2">
              <Label htmlFor="dropoff">Drop-off Location *</Label>
              <Input
                id="dropoff"
                value={requestForm.dropoff_location}
                onChange={(e) => setRequestForm({ ...requestForm, dropoff_location: e.target.value })}
                placeholder="Enter drop-off address..."
                data-testid="request-dropoff-input"
              />
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
                      ? format(requestForm.pickup_datetime, "PPP 'at' p") 
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

            {/* Flight Number (optional) */}
            <div className="space-y-2">
              <Label htmlFor="flight" className="flex items-center gap-2">
                <Plane className="w-4 h-4" />
                Flight Number (optional)
              </Label>
              <Input
                id="flight"
                value={requestForm.flight_number}
                onChange={(e) => setRequestForm({ ...requestForm, flight_number: e.target.value.toUpperCase() })}
                placeholder="e.g., BA123"
                data-testid="request-flight-input"
              />
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Additional Notes</Label>
              <Textarea
                id="notes"
                value={requestForm.notes}
                onChange={(e) => setRequestForm({ ...requestForm, notes: e.target.value })}
                placeholder="Any special requirements..."
                rows={3}
                data-testid="request-notes-input"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRequestForm(false)}>
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
