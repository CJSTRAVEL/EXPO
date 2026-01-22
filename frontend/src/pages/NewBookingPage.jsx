import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { 
  User, MapPin, Calendar, Car, CreditCard, FileText, 
  Plus, Minus, Save, RotateCcw, Check, Clock, Navigation,
  Phone, Mail, Users, Briefcase, Plane, ArrowLeftRight,
  MessageSquare, Bell, Loader2, ChevronRight, X, Search
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import AddressAutocomplete from "@/components/AddressAutocomplete";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Section Header Component - Dark Theme
const SectionHeader = ({ icon: Icon, title, actions }) => (
  <div className="flex items-center justify-between px-4 py-3 bg-[#1a1a1a] border-b border-[#2d2d2d]">
    <div className="flex items-center gap-2">
      <Icon className="w-4 h-4 text-[#D4A853]" />
      <span className="text-sm font-bold text-white uppercase tracking-wide">{title}</span>
    </div>
    {actions && <div className="flex items-center gap-2">{actions}</div>}
  </div>
);

// Section Container Component - Dark Theme
const Section = ({ icon, title, actions, children, className = "" }) => (
  <div className={cn("bg-[#252525] rounded-lg border border-[#3d3d3d] shadow-lg overflow-hidden", className)}>
    <SectionHeader icon={icon} title={title} actions={actions} />
    <div className="p-4 space-y-4">
      {children}
    </div>
  </div>
);

// Notification Badge Component - Dark Theme
const NotificationBadge = ({ label, active, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border",
      active 
        ? "bg-[#D4A853]/20 text-[#D4A853] border-[#D4A853]/50 shadow-sm" 
        : "bg-[#1a1a1a] text-gray-400 border-[#3d3d3d] hover:bg-[#2d2d2d]"
    )}
  >
    {active && <Check className="w-3 h-3" />}
    {label}
  </button>
);

// Info Card for Map overlay - Dark Theme
const InfoCard = ({ label, value, icon: Icon }) => (
  <div className="bg-[#252525] rounded-lg border border-[#3d3d3d] p-3 text-center min-w-[100px]">
    <div className="flex items-center justify-center gap-1 text-xs text-gray-300 mb-1">
      {Icon && <Icon className="w-3 h-3" />}
      {label}
    </div>
    <div className="text-lg font-bold text-white">{value || "--"}</div>
  </div>
);

const NewBookingPage = () => {
  const navigate = useNavigate();
  const [drivers, setDrivers] = useState([]);
  const [clients, setClients] = useState([]);
  const [passengers, setPassengers] = useState([]);
  const [saving, setSaving] = useState(false);
  const [routeInfo, setRouteInfo] = useState(null);
  const [loadingRoute, setLoadingRoute] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    // Who
    first_name: "",
    last_name: "",
    customer_phone: "",
    customer_email: "",
    client_id: "",
    // Where
    pickup_location: "",
    dropoff_location: "",
    additional_stops: [],
    // When
    booking_datetime: new Date(),
    // What
    passenger_count: 1,
    luggage_count: 0,
    driver_id: "",
    vehicle_type: "",
    // Payment
    fare: "",
    payment_method: "cash",
    // Additional
    notes: "",
    driver_notes: "",
    // Flight info
    flight_number: "",
    airline: "",
    flight_type: "",
    terminal: "",
    // Return booking
    create_return: false,
    return_pickup_location: "",
    return_additional_stops: [],
    return_dropoff_location: "",
    return_datetime: null,
    // Return flight info
    return_flight_number: "",
    return_airline: "",
    return_terminal: "",
  });

  // Notification toggles
  const [notifications, setNotifications] = useState({
    sms: true,
    email: true,
  });

  // Vehicle types from database
  const [vehicleTypes, setVehicleTypes] = useState([]);

  // UI state
  const [dateOpen, setDateOpen] = useState(false);
  const [returnDateOpen, setReturnDateOpen] = useState(false);
  const [flightModalOpen, setFlightModalOpen] = useState(false);
  const [returnFlightModalOpen, setReturnFlightModalOpen] = useState(false);
  const [loadingFlight, setLoadingFlight] = useState(false);
  const [loadingReturnFlight, setLoadingReturnFlight] = useState(false);
  const [flightData, setFlightData] = useState(null);
  const [returnFlightData, setReturnFlightData] = useState(null);
  const [flightSearchNumber, setFlightSearchNumber] = useState("");
  const [returnFlightSearchNumber, setReturnFlightSearchNumber] = useState("");
  
  // Passenger search state
  const [passengerSearch, setPassengerSearch] = useState({ query: "", field: null });
  const [matchedPassengers, setMatchedPassengers] = useState([]);
  const [showPassengerPopup, setShowPassengerPopup] = useState(false);
  const [selectedPassengerBookings, setSelectedPassengerBookings] = useState([]);
  const [loadingPassengerHistory, setLoadingPassengerHistory] = useState(false);

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [driversRes, clientsRes, passengersRes, vehicleTypesRes] = await Promise.all([
          axios.get(`${API}/drivers`),
          axios.get(`${API}/clients`),
          axios.get(`${API}/admin/passengers`).catch(() => ({ data: [] })),
          axios.get(`${API}/vehicle-types`).catch(() => ({ data: [] }))
        ]);
        setDrivers(driversRes.data);
        setClients(clientsRes.data);
        setPassengers(passengersRes.data || []);
        setVehicleTypes(vehicleTypesRes.data || []);
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };
    fetchData();
    
    // Close passenger popup when clicking outside
    const handleClickOutside = (e) => {
      if (!e.target.closest('[data-testid="booking-first-name"]') && 
          !e.target.closest('[data-testid="booking-phone"]') &&
          !e.target.closest('.passenger-popup')) {
        setShowPassengerPopup(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // Calculate route when pickup/dropoff changes
  useEffect(() => {
    const calculateRoute = async () => {
      if (formData.pickup_location && formData.dropoff_location && 
          formData.pickup_location.length > 5 && formData.dropoff_location.length > 5) {
        setLoadingRoute(true);
        try {
          const response = await axios.get(`${API}/directions`, {
            params: {
              origin: formData.pickup_location,
              destination: formData.dropoff_location
            }
          });
          if (response.data.success) {
            setRouteInfo(response.data);
          } else {
            setRouteInfo(null);
          }
        } catch (error) {
          console.error("Error calculating route:", error);
          setRouteInfo(null);
        } finally {
          setLoadingRoute(false);
        }
      } else {
        setRouteInfo(null);
      }
    };

    const debounce = setTimeout(calculateRoute, 800);
    return () => clearTimeout(debounce);
  }, [formData.pickup_location, formData.dropoff_location]);

  // Passenger search - find matching passengers when typing name or phone
  const searchPassengers = useCallback((query, field) => {
    if (!query || query.length < 2) {
      setMatchedPassengers([]);
      setShowPassengerPopup(false);
      return;
    }
    
    const queryLower = query.toLowerCase().trim();
    const matches = passengers.filter(p => {
      if (field === 'name') {
        const fullName = `${p.first_name || ''} ${p.last_name || ''}`.toLowerCase();
        return fullName.includes(queryLower) || 
               (p.first_name && p.first_name.toLowerCase().includes(queryLower)) ||
               (p.last_name && p.last_name.toLowerCase().includes(queryLower));
      } else if (field === 'phone') {
        const phone = (p.phone || p.customer_phone || '').replace(/\s+/g, '');
        return phone.includes(query.replace(/\s+/g, ''));
      }
      return false;
    }).slice(0, 5);
    
    setMatchedPassengers(matches);
    setShowPassengerPopup(matches.length > 0);
    setPassengerSearch({ query, field });
  }, [passengers]);

  // Fetch passenger's booking history
  const fetchPassengerHistory = async (passenger) => {
    setLoadingPassengerHistory(true);
    try {
      // Search bookings by phone number or email
      const phone = passenger.phone || passenger.customer_phone;
      const response = await axios.get(`${API}/bookings`, {
        params: { search: phone, limit: 10 }
      });
      const bookings = response.data.filter(b => 
        b.customer_phone === phone || 
        b.customer_email === passenger.email
      ).slice(0, 5);
      setSelectedPassengerBookings(bookings);
    } catch (error) {
      console.error("Error fetching passenger history:", error);
      setSelectedPassengerBookings([]);
    } finally {
      setLoadingPassengerHistory(false);
    }
  };

  // Select a passenger and show their history
  const handleSelectPassenger = async (passenger) => {
    setShowPassengerPopup(false);
    await fetchPassengerHistory(passenger);
    
    // Auto-fill basic details (NOT date/time or flight data)
    setFormData(prev => ({
      ...prev,
      first_name: passenger.first_name || prev.first_name,
      last_name: passenger.last_name || prev.last_name,
      customer_phone: passenger.phone || passenger.customer_phone || prev.customer_phone,
      customer_email: passenger.email || passenger.customer_email || prev.customer_email,
    }));
  };

  // Use previous booking details (excluding date/time and flight)
  const usePreviousBookingDetails = (booking) => {
    setFormData(prev => ({
      ...prev,
      // Customer details
      first_name: booking.first_name || prev.first_name,
      last_name: booking.last_name || prev.last_name,
      customer_phone: booking.customer_phone || prev.customer_phone,
      customer_email: booking.customer_email || prev.customer_email,
      // Journey details
      pickup_location: booking.pickup_location || prev.pickup_location,
      dropoff_location: booking.dropoff_location || prev.dropoff_location,
      additional_stops: booking.additional_stops || [],
      // Vehicle & passengers
      passenger_count: booking.passenger_count || prev.passenger_count,
      luggage_count: booking.luggage_count || prev.luggage_count,
      vehicle_type: booking.vehicle_type || prev.vehicle_type,
      // Payment
      fare: booking.fare ? String(booking.fare) : prev.fare,
      payment_method: booking.payment_method || prev.payment_method,
      // Notes
      notes: booking.notes || prev.notes,
      driver_notes: booking.driver_notes || prev.driver_notes,
      // Client
      client_id: booking.client_id || prev.client_id,
      // DO NOT copy: booking_datetime, flight_number, airline, terminal, flight_type
    }));
    setSelectedPassengerBookings([]);
    toast.success("Previous booking details applied!");
  };

  // Flight lookup - auto-populates pickup location and time
  const handleFlightLookup = async () => {
    const searchNum = flightSearchNumber || formData.flight_number;
    if (!searchNum) {
      toast.error("Please enter a flight number");
      return;
    }
    setLoadingFlight(true);
    try {
      const flightNum = searchNum.trim().toUpperCase().replace(/\s+/g, '');
      const response = await axios.get(`${API}/flight/${flightNum}`);
      const data = response.data;
      if (data.error) {
        toast.error(data.error);
      } else {
        setFlightData(data);
        
        // Build airport address from flight data
        let airportAddress = "";
        if (data.arrival_airport) {
          airportAddress = data.arrival_airport;
          if (data.arrival_terminal) {
            airportAddress = `Terminal ${data.arrival_terminal}, ${airportAddress}`;
          }
        }
        
        // Parse landing time and set booking datetime
        let newBookingDatetime = formData.booking_datetime;
        if (data.arrival_scheduled || data.arrival_estimated) {
          const landingTimeStr = data.arrival_estimated || data.arrival_scheduled;
          const landingTime = new Date(landingTimeStr);
          if (!isNaN(landingTime.getTime())) {
            newBookingDatetime = landingTime;
          }
        }
        
        setFormData(prev => ({
          ...prev,
          flight_number: flightNum,
          airline: data.airline || prev.airline,
          terminal: data.arrival_terminal || data.departure_terminal || prev.terminal,
          flight_type: data.arrival_airport ? "arrival" : "departure",
          // Auto-set pickup location to arrival airport
          pickup_location: airportAddress || prev.pickup_location,
          // Auto-set booking time to landing time
          booking_datetime: newBookingDatetime,
        }));
        
        toast.success("Flight data loaded! Pickup location and time updated.");
      }
    } catch (error) {
      toast.error("Flight lookup failed");
    } finally {
      setLoadingFlight(false);
    }
  };

  // Return flight lookup - auto-populates return pickup location and time
  const handleReturnFlightLookup = async () => {
    const searchNum = returnFlightSearchNumber || formData.return_flight_number;
    if (!searchNum) {
      toast.error("Please enter a return flight number");
      return;
    }
    setLoadingReturnFlight(true);
    try {
      const flightNum = searchNum.trim().toUpperCase().replace(/\s+/g, '');
      const response = await axios.get(`${API}/flight/${flightNum}`);
      const data = response.data;
      if (data.error) {
        toast.error(data.error);
      } else {
        setReturnFlightData(data);
        
        // Build airport address from flight data
        let airportAddress = "";
        if (data.arrival_airport) {
          airportAddress = data.arrival_airport;
          if (data.arrival_terminal) {
            airportAddress = `Terminal ${data.arrival_terminal}, ${airportAddress}`;
          }
        }
        
        // Parse landing time and set return datetime
        let newReturnDatetime = formData.return_datetime || new Date();
        if (data.arrival_scheduled || data.arrival_estimated) {
          const landingTimeStr = data.arrival_estimated || data.arrival_scheduled;
          const landingTime = new Date(landingTimeStr);
          if (!isNaN(landingTime.getTime())) {
            newReturnDatetime = landingTime;
          }
        }
        
        setFormData(prev => ({
          ...prev,
          return_flight_number: flightNum,
          return_airline: data.airline || prev.return_airline,
          return_terminal: data.arrival_terminal || data.departure_terminal || prev.return_terminal,
          // Auto-set return pickup location to arrival airport
          return_pickup_location: airportAddress || prev.return_pickup_location,
          // Auto-set return time to landing time
          return_datetime: newReturnDatetime,
        }));
        
        toast.success("Return flight data loaded! Pickup location and time updated.");
      }
    } catch (error) {
      toast.error("Return flight lookup failed");
    } finally {
      setLoadingReturnFlight(false);
    }
  };

  // Handle form submission
  const handleSubmit = async () => {
    if (!formData.first_name || !formData.customer_phone) {
      toast.error("Please enter passenger name and phone");
      return;
    }
    if (!formData.pickup_location || !formData.dropoff_location) {
      toast.error("Please enter pickup and drop-off locations");
      return;
    }

    // Validate fare if Stripe payment is selected
    if (formData.payment_method === "stripe") {
      if (!formData.fare || parseFloat(formData.fare) <= 0) {
        toast.error("Please enter a fare amount for card payment");
        return;
      }
    }

    setSaving(true);
    try {
      let flight_info = null;
      if (formData.flight_number || formData.airline) {
        flight_info = {
          flight_number: formData.flight_number || null,
          airline: formData.airline || null,
          flight_type: formData.flight_type || null,
          terminal: formData.terminal || null,
        };
      }

      const payload = {
        first_name: formData.first_name,
        last_name: formData.last_name,
        customer_phone: formData.customer_phone,
        customer_email: formData.customer_email || null,
        passenger_count: parseInt(formData.passenger_count) || 1,
        luggage_count: parseInt(formData.luggage_count) || 0,
        pickup_location: formData.pickup_location,
        dropoff_location: formData.dropoff_location,
        additional_stops: formData.additional_stops.length > 0 ? formData.additional_stops : null,
        booking_datetime: formData.booking_datetime.toISOString(),
        notes: formData.notes,
        fare: formData.fare ? parseFloat(formData.fare) : null,
        status: "pending",
        payment_method: formData.payment_method,
        driver_id: formData.driver_id || null,
        client_id: formData.client_id || null,
        flight_info: flight_info,
        distance_miles: routeInfo?.distance?.miles || null,
        duration_minutes: routeInfo?.duration?.minutes || null,
        create_return: formData.create_return,
        return_pickup_location: formData.create_return ? formData.return_pickup_location : null,
        return_additional_stops: formData.create_return && formData.return_additional_stops?.length > 0 
          ? formData.return_additional_stops : null,
        return_dropoff_location: formData.create_return ? formData.return_dropoff_location : null,
        return_datetime: formData.create_return && formData.return_datetime 
          ? formData.return_datetime.toISOString() : null,
      };

      const response = await axios.post(`${API}/bookings`, payload);
      const bookingId = response.data.id;
      
      // If Stripe payment selected, create checkout session and redirect
      if (formData.payment_method === "stripe" && formData.fare) {
        try {
          const paymentResponse = await axios.post(`${API}/payments/create-checkout`, {
            booking_id: bookingId,
            amount: parseFloat(formData.fare),
            origin_url: window.location.origin,
            customer_email: formData.customer_email,
            customer_name: `${formData.first_name} ${formData.last_name}`.trim()
          });
          
          if (paymentResponse.data.checkout_url) {
            toast.success(`Booking ${response.data.booking_id} created! Redirecting to payment...`);
            window.location.href = paymentResponse.data.checkout_url;
            return;
          }
        } catch (paymentError) {
          console.error("Payment error:", paymentError);
          toast.error("Booking created but payment link failed. You can retry payment from the bookings page.");
        }
      }
      
      toast.success(`Booking ${response.data.booking_id} created successfully!`);
      navigate("/bookings");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to create booking");
    } finally {
      setSaving(false);
    }
  };

  // Reset form
  const handleReset = () => {
    setFormData({
      first_name: "",
      last_name: "",
      customer_phone: "",
      customer_email: "",
      client_id: "",
      pickup_location: "",
      dropoff_location: "",
      additional_stops: [],
      booking_datetime: new Date(),
      passenger_count: 1,
      luggage_count: 0,
      driver_id: "",
      vehicle_type: "",
      fare: "",
      payment_method: "cash",
      notes: "",
      driver_notes: "",
      flight_number: "",
      airline: "",
      flight_type: "",
      terminal: "",
      create_return: false,
      return_pickup_location: "",
      return_additional_stops: [],
      return_dropoff_location: "",
      return_datetime: null,
      return_flight_number: "",
      return_airline: "",
      return_terminal: "",
    });
    setRouteInfo(null);
    setFlightData(null);
    setReturnFlightData(null);
    setFlightSearchNumber("");
    setReturnFlightSearchNumber("");
    toast.info("Form reset");
  };

  // Add/remove stops
  const addStop = () => {
    setFormData(prev => ({
      ...prev,
      additional_stops: [...prev.additional_stops, ""]
    }));
  };

  const removeStop = (index) => {
    setFormData(prev => ({
      ...prev,
      additional_stops: prev.additional_stops.filter((_, i) => i !== index)
    }));
  };

  const updateStop = (index, value) => {
    setFormData(prev => ({
      ...prev,
      additional_stops: prev.additional_stops.map((stop, i) => i === index ? value : stop)
    }));
  };

  // Google Maps embed URL
  const getMapUrl = () => {
    if (formData.pickup_location && formData.dropoff_location) {
      const origin = encodeURIComponent(formData.pickup_location);
      const dest = encodeURIComponent(formData.dropoff_location);
      return `https://www.google.com/maps/embed/v1/directions?key=AIzaSyBSL4bF8eGeiABUOK0GM8UoWBzqtUVfMIs&origin=${origin}&destination=${dest}&mode=driving`;
    }
    // Default map centered on UK
    return `https://www.google.com/maps/embed/v1/view?key=AIzaSyBSL4bF8eGeiABUOK0GM8UoWBzqtUVfMIs&center=54.5,-1.5&zoom=8`;
  };

  return (
    <div className="h-[calc(100vh-64px)] bg-[#121212] overflow-hidden" data-testid="new-booking-page">
      {/* Flight Lookup Modal */}
      <Dialog open={flightModalOpen} onOpenChange={setFlightModalOpen}>
        <DialogContent className="bg-[#1a1a1a] border-[#3d3d3d] text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[#D4A853]">
              <Plane className="w-5 h-5" />
              Flight Information Lookup
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-gray-300">Flight Number</Label>
              <div className="flex gap-2">
                <Input
                  value={flightSearchNumber}
                  onChange={(e) => setFlightSearchNumber(e.target.value.toUpperCase())}
                  placeholder="e.g. BA123, EZY456"
                  className="flex-1 bg-[#252525] border-[#3d3d3d] text-white placeholder:text-gray-500"
                  data-testid="flight-number-input"
                  onKeyDown={(e) => e.key === 'Enter' && handleFlightLookup()}
                />
                <Button
                  onClick={handleFlightLookup}
                  disabled={loadingFlight || !flightSearchNumber}
                  className="bg-[#D4A853] hover:bg-[#c49743] text-black"
                  data-testid="flight-lookup-btn"
                >
                  {loadingFlight ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                </Button>
              </div>
              <p className="text-xs text-gray-500">Enter the flight number to auto-fill pickup location and time</p>
            </div>
            
            {/* Flight Results */}
            {flightData && (
              <div className="bg-[#252525] rounded-lg border border-[#D4A853]/30 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-[#D4A853]/20 flex items-center justify-center">
                    <Plane className="w-4 h-4 text-[#D4A853]" />
                  </div>
                  <div>
                    <div className="font-semibold text-white">{flightData.airline}</div>
                    <div className="text-xs text-gray-300">{flightData.flight_number}</div>
                  </div>
                  <Badge className={cn(
                    "ml-auto",
                    flightData.flight_status === "landed" ? "bg-green-500/20 text-green-400 border-green-500/30" :
                    flightData.flight_status === "active" ? "bg-blue-500/20 text-blue-400 border-blue-500/30" :
                    "bg-gray-500/20 text-gray-400 border-gray-500/30"
                  )}>
                    {flightData.flight_status?.toUpperCase() || "SCHEDULED"}
                  </Badge>
                </div>
                
                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[#3d3d3d]">
                  <div>
                    <div className="text-xs text-gray-500">Arrival Airport</div>
                    <div className="text-sm text-white font-medium">{flightData.arrival_airport || "N/A"}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Terminal</div>
                    <div className="text-sm text-white font-medium">{flightData.arrival_terminal || "N/A"}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Scheduled Arrival</div>
                    <div className="text-sm text-white font-medium">
                      {flightData.arrival_scheduled ? format(new Date(flightData.arrival_scheduled), "dd/MM HH:mm") : "N/A"}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Estimated Arrival</div>
                    <div className="text-sm text-[#D4A853] font-medium">
                      {flightData.arrival_estimated ? format(new Date(flightData.arrival_estimated), "dd/MM HH:mm") : "N/A"}
                    </div>
                  </div>
                </div>
                
                <div className="bg-[#D4A853]/10 rounded-md p-3 mt-2">
                  <div className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-[#D4A853] mt-0.5" />
                    <div className="text-xs text-[#D4A853]">
                      <strong>Auto-Applied:</strong> Pickup location set to {flightData.arrival_airport || "airport"} 
                      {flightData.arrival_terminal && ` (Terminal ${flightData.arrival_terminal})`}. 
                      Pickup time set to landing time.
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Current Flight Info Display */}
            {formData.flight_number && !flightData && (
              <div className="bg-[#252525] rounded-lg border border-[#3d3d3d] p-3">
                <div className="text-xs text-gray-500 mb-1">Currently Saved</div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="border-[#D4A853]/50 text-[#D4A853]">
                    {formData.flight_number}
                  </Badge>
                  {formData.airline && <span className="text-sm text-gray-300">{formData.airline}</span>}
                  {formData.terminal && <span className="text-xs text-gray-500">Terminal {formData.terminal}</span>}
                </div>
              </div>
            )}
          </div>
          
          <DialogFooter className="border-t border-[#3d3d3d] pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setFlightSearchNumber("");
                setFlightData(null);
                setFormData(prev => ({ ...prev, flight_number: "", airline: "", terminal: "", flight_type: "" }));
              }}
              className="border-[#3d3d3d] text-gray-300 hover:bg-[#2d2d2d]"
            >
              Clear Flight Info
            </Button>
            <Button
              onClick={() => setFlightModalOpen(false)}
              className="bg-[#D4A853] hover:bg-[#c49743] text-black"
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Return Flight Lookup Modal */}
      <Dialog open={returnFlightModalOpen} onOpenChange={setReturnFlightModalOpen}>
        <DialogContent className="bg-[#1a1a1a] border-[#3d3d3d] text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[#D4A853]">
              <Plane className="w-5 h-5" />
              Return Flight Information
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-gray-300">Return Flight Number</Label>
              <div className="flex gap-2">
                <Input
                  value={returnFlightSearchNumber}
                  onChange={(e) => setReturnFlightSearchNumber(e.target.value.toUpperCase())}
                  placeholder="e.g. BA123, EZY456"
                  className="flex-1 bg-[#252525] border-[#3d3d3d] text-white placeholder:text-gray-500"
                  data-testid="return-flight-number-input"
                  onKeyDown={(e) => e.key === 'Enter' && handleReturnFlightLookup()}
                />
                <Button
                  onClick={handleReturnFlightLookup}
                  disabled={loadingReturnFlight || !returnFlightSearchNumber}
                  className="bg-[#D4A853] hover:bg-[#c49743] text-black"
                  data-testid="return-flight-lookup-btn"
                >
                  {loadingReturnFlight ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                </Button>
              </div>
              <p className="text-xs text-gray-500">Enter the return flight number to auto-fill pickup location and time</p>
            </div>
            
            {/* Return Flight Results */}
            {returnFlightData && (
              <div className="bg-[#252525] rounded-lg border border-[#D4A853]/30 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-[#D4A853]/20 flex items-center justify-center">
                    <Plane className="w-4 h-4 text-[#D4A853]" />
                  </div>
                  <div>
                    <div className="font-semibold text-white">{returnFlightData.airline}</div>
                    <div className="text-xs text-gray-300">{returnFlightData.flight_number}</div>
                  </div>
                  <Badge className={cn(
                    "ml-auto",
                    returnFlightData.flight_status === "landed" ? "bg-green-500/20 text-green-400 border-green-500/30" :
                    returnFlightData.flight_status === "active" ? "bg-blue-500/20 text-blue-400 border-blue-500/30" :
                    "bg-gray-500/20 text-gray-400 border-gray-500/30"
                  )}>
                    {returnFlightData.flight_status?.toUpperCase() || "SCHEDULED"}
                  </Badge>
                </div>
                
                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[#3d3d3d]">
                  <div>
                    <div className="text-xs text-gray-500">Arrival Airport</div>
                    <div className="text-sm text-white font-medium">{returnFlightData.arrival_airport || "N/A"}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Terminal</div>
                    <div className="text-sm text-white font-medium">{returnFlightData.arrival_terminal || "N/A"}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Scheduled Arrival</div>
                    <div className="text-sm text-white font-medium">
                      {returnFlightData.arrival_scheduled ? format(new Date(returnFlightData.arrival_scheduled), "dd/MM HH:mm") : "N/A"}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Estimated Arrival</div>
                    <div className="text-sm text-[#D4A853] font-medium">
                      {returnFlightData.arrival_estimated ? format(new Date(returnFlightData.arrival_estimated), "dd/MM HH:mm") : "N/A"}
                    </div>
                  </div>
                </div>
                
                <div className="bg-[#D4A853]/10 rounded-md p-3 mt-2">
                  <div className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-[#D4A853] mt-0.5" />
                    <div className="text-xs text-[#D4A853]">
                      <strong>Auto-Applied:</strong> Return pickup set to {returnFlightData.arrival_airport || "airport"} 
                      {returnFlightData.arrival_terminal && ` (Terminal ${returnFlightData.arrival_terminal})`}. 
                      Return time set to landing time.
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Current Return Flight Info Display */}
            {formData.return_flight_number && !returnFlightData && (
              <div className="bg-[#252525] rounded-lg border border-[#3d3d3d] p-3">
                <div className="text-xs text-gray-500 mb-1">Currently Saved</div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="border-[#D4A853]/50 text-[#D4A853]">
                    {formData.return_flight_number}
                  </Badge>
                  {formData.return_airline && <span className="text-sm text-gray-300">{formData.return_airline}</span>}
                  {formData.return_terminal && <span className="text-xs text-gray-500">Terminal {formData.return_terminal}</span>}
                </div>
              </div>
            )}
          </div>
          
          <DialogFooter className="border-t border-[#3d3d3d] pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setReturnFlightSearchNumber("");
                setReturnFlightData(null);
                setFormData(prev => ({ ...prev, return_flight_number: "", return_airline: "", return_terminal: "" }));
              }}
              className="border-[#3d3d3d] text-gray-300 hover:bg-[#2d2d2d]"
            >
              Clear Flight Info
            </Button>
            <Button
              onClick={() => setReturnFlightModalOpen(false)}
              className="bg-[#D4A853] hover:bg-[#c49743] text-black"
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Header */}
      <div className="bg-[#1a1a1a] text-white px-6 py-3 flex items-center justify-between border-b border-[#2d2d2d]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[#D4A853] rounded-full flex items-center justify-center">
            <MapPin className="w-4 h-4 text-black" />
          </div>
          <h1 className="text-lg font-bold">New Booking</h1>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Clock className="w-4 h-4" />
          <span>{format(new Date(), "dd/MM/yyyy HH:mm")}</span>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 p-4 h-[calc(100%-56px)] overflow-hidden">
        
        {/* LEFT COLUMN - Primary Input Form */}
        <div className="col-span-12 lg:col-span-5 space-y-4 overflow-y-auto pr-2">
          
          {/* WHO Section */}
          <Section icon={User} title="Passenger Details">
            {/* Client/Account Selection */}
            {clients.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs text-gray-300">Account</Label>
                <Select
                  value={formData.client_id || "none"}
                  onValueChange={(value) => setFormData({ ...formData, client_id: value === "none" ? "" : value })}
                >
                  <SelectTrigger className="h-9 bg-[#1a1a1a] border-[#3d3d3d] text-white" data-testid="booking-account-select">
                    <SelectValue placeholder="Select account..." />
                  </SelectTrigger>
                  <SelectContent className="bg-[#252525] border-[#3d3d3d]">
                    <SelectItem value="none" className="text-white">No Account (Direct)</SelectItem>
                    {clients.filter(c => c.status === "active").map((client) => (
                      <SelectItem key={client.id} value={client.id} className="text-white">
                        {client.account_no} - {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 relative">
                <Label className="text-xs text-gray-300">First Name *</Label>
                <Input
                  value={formData.first_name}
                  onChange={(e) => {
                    setFormData({ ...formData, first_name: e.target.value });
                    searchPassengers(e.target.value, 'name');
                  }}
                  onFocus={() => formData.first_name && searchPassengers(formData.first_name, 'name')}
                  placeholder="John"
                  className="h-9 bg-[#1a1a1a] border-[#3d3d3d] text-white placeholder:text-gray-500"
                  data-testid="booking-first-name"
                />
                {/* Passenger Search Popup */}
                {showPassengerPopup && passengerSearch.field === 'name' && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-[#252525] border border-[#D4A853]/50 rounded-lg shadow-xl overflow-hidden">
                    <div className="px-3 py-2 bg-[#1a1a1a] border-b border-[#3d3d3d]">
                      <span className="text-xs text-[#D4A853] font-medium">Matching Passengers</span>
                    </div>
                    {matchedPassengers.map((p, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSelectPassenger(p)}
                        className="w-full px-3 py-2 text-left hover:bg-[#D4A853]/20 transition-colors flex items-center gap-2 border-b border-[#3d3d3d] last:border-0"
                      >
                        <div className="w-8 h-8 rounded-full bg-[#D4A853]/20 flex items-center justify-center">
                          <User className="w-4 h-4 text-[#D4A853]" />
                        </div>
                        <div>
                          <div className="text-sm text-white font-medium">{p.first_name} {p.last_name}</div>
                          <div className="text-xs text-gray-300">{p.phone || p.customer_phone}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-gray-300">Last Name</Label>
                <Input
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  placeholder="Smith"
                  className="h-9 bg-[#1a1a1a] border-[#3d3d3d] text-white placeholder:text-gray-500"
                  data-testid="booking-last-name"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 relative">
                <Label className="text-xs text-gray-300 flex items-center gap-1">
                  <Phone className="w-3 h-3" /> Mobile *
                </Label>
                <Input
                  value={formData.customer_phone}
                  onChange={(e) => {
                    setFormData({ ...formData, customer_phone: e.target.value });
                    searchPassengers(e.target.value, 'phone');
                  }}
                  onFocus={() => formData.customer_phone && searchPassengers(formData.customer_phone, 'phone')}
                  placeholder="+44 7700 900123"
                  className="h-9 bg-[#1a1a1a] border-[#3d3d3d] text-white placeholder:text-gray-500"
                  data-testid="booking-phone"
                />
                {/* Passenger Search Popup for Phone */}
                {showPassengerPopup && passengerSearch.field === 'phone' && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-[#252525] border border-[#D4A853]/50 rounded-lg shadow-xl overflow-hidden">
                    <div className="px-3 py-2 bg-[#1a1a1a] border-b border-[#3d3d3d]">
                      <span className="text-xs text-[#D4A853] font-medium">Matching Passengers</span>
                    </div>
                    {matchedPassengers.map((p, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSelectPassenger(p)}
                        className="w-full px-3 py-2 text-left hover:bg-[#D4A853]/20 transition-colors flex items-center gap-2 border-b border-[#3d3d3d] last:border-0"
                      >
                        <div className="w-8 h-8 rounded-full bg-[#D4A853]/20 flex items-center justify-center">
                          <User className="w-4 h-4 text-[#D4A853]" />
                        </div>
                        <div>
                          <div className="text-sm text-white font-medium">{p.first_name} {p.last_name}</div>
                          <div className="text-xs text-gray-300">{p.phone || p.customer_phone}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-gray-300 flex items-center gap-1">
                  <Mail className="w-3 h-3" /> Email
                </Label>
                <Input
                  type="email"
                  value={formData.customer_email}
                  onChange={(e) => setFormData({ ...formData, customer_email: e.target.value })}
                  placeholder="john@example.com"
                  className="h-9 bg-[#1a1a1a] border-[#3d3d3d] text-white placeholder:text-gray-500"
                  data-testid="booking-email"
                />
              </div>
            </div>

            {/* Previous Bookings Popup */}
            {selectedPassengerBookings.length > 0 && (
              <div className="bg-[#1a1a1a] border border-[#D4A853]/50 rounded-lg overflow-hidden">
                <div className="px-3 py-2 bg-[#D4A853]/20 border-b border-[#D4A853]/30 flex items-center justify-between">
                  <span className="text-sm text-[#D4A853] font-medium">Previous Journeys</span>
                  <button 
                    onClick={() => setSelectedPassengerBookings([])}
                    className="text-gray-400 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="max-h-48 overflow-y-auto">
                  {loadingPassengerHistory ? (
                    <div className="p-4 text-center text-gray-400">
                      <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                    </div>
                  ) : (
                    selectedPassengerBookings.map((booking, idx) => (
                      <div key={idx} className="p-3 border-b border-[#3d3d3d] last:border-0 hover:bg-[#252525]">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="text-xs text-gray-300 mb-1">
                              {format(new Date(booking.booking_datetime), "dd/MM/yyyy HH:mm")}
                            </div>
                            <div className="flex items-center gap-1 text-xs mb-1">
                              <span className="w-2 h-2 rounded-full bg-green-500"></span>
                              <span className="text-white truncate">{booking.pickup_location}</span>
                            </div>
                            <div className="flex items-center gap-1 text-xs">
                              <span className="w-2 h-2 rounded-full bg-red-500"></span>
                              <span className="text-white truncate">{booking.dropoff_location}</span>
                            </div>
                            {booking.fare && (
                              <div className="text-xs text-[#D4A853] mt-1">£{booking.fare.toFixed(2)}</div>
                            )}
                          </div>
                          <Button
                            size="sm"
                            onClick={() => usePreviousBookingDetails(booking)}
                            className="h-7 text-xs bg-[#D4A853] hover:bg-[#c49743] text-black"
                          >
                            Use Details
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </Section>

          {/* WHERE Section */}
          <Section 
            icon={MapPin} 
            title="Journey"
            actions={
              <Button 
                type="button" 
                variant="outline" 
                size="sm" 
                onClick={addStop}
                className="h-7 text-xs gap-1 border-[#3d3d3d] text-gray-300 hover:bg-[#2d2d2d]"
              >
                <Plus className="w-3 h-3" /> Add Stop
              </Button>
            }
          >
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-300 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-500"></span> Pickup *
              </Label>
              <AddressAutocomplete
                value={formData.pickup_location}
                onChange={(value) => setFormData(prev => ({ ...prev, pickup_location: value }))}
                placeholder="Enter pickup address..."
                className="bg-[#1a1a1a] border-[#3d3d3d] text-white placeholder:text-gray-500"
                data-testid="booking-pickup"
              />
            </div>

            {/* Additional Stops */}
            {formData.additional_stops.map((stop, index) => (
              <div key={index} className="space-y-1.5">
                <Label className="text-xs text-gray-300 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-[#D4A853]"></span> Via {index + 1}
                </Label>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <AddressAutocomplete
                      value={stop}
                      onChange={(value) => updateStop(index, value)}
                      placeholder={`Stop ${index + 1}...`}
                      className="bg-[#1a1a1a] border-[#3d3d3d] text-white placeholder:text-gray-500"
                    />
                  </div>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="icon"
                    onClick={() => removeStop(index)}
                    className="h-9 w-9 text-red-400 border-[#3d3d3d] hover:text-red-300 hover:bg-red-500/10"
                  >
                    <Minus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}

            <div className="space-y-1.5">
              <Label className="text-xs text-gray-300 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-red-500"></span> Drop-off *
              </Label>
              <AddressAutocomplete
                value={formData.dropoff_location}
                onChange={(value) => setFormData(prev => ({ ...prev, dropoff_location: value }))}
                placeholder="Enter drop-off address..."
                className="bg-[#1a1a1a] border-[#3d3d3d] text-white placeholder:text-gray-500"
                data-testid="booking-dropoff"
              />
            </div>
          </Section>

          {/* WHEN Section */}
          <Section icon={Calendar} title="Schedule">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-gray-300">Date</Label>
                <Popover open={dateOpen} onOpenChange={setDateOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full h-9 justify-start text-left font-normal bg-[#1a1a1a] border-[#3d3d3d] text-white hover:bg-[#2d2d2d]"
                      data-testid="booking-date-btn"
                    >
                      <Calendar className="mr-2 h-4 w-4 text-[#D4A853]" />
                      {format(formData.booking_datetime, "dd/MM/yyyy")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-white border-[#3d3d3d]" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={formData.booking_datetime}
                      onSelect={(date) => {
                        if (date) {
                          const current = formData.booking_datetime;
                          date.setHours(current.getHours(), current.getMinutes());
                          setFormData({ ...formData, booking_datetime: date });
                          setDateOpen(false);
                        }
                      }}
                      initialFocus
                      className="bg-white text-black"
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-gray-300">Time</Label>
                <Input
                  type="time"
                  value={format(formData.booking_datetime, "HH:mm")}
                  onChange={(e) => {
                    const [hours, minutes] = e.target.value.split(':');
                    const newDate = new Date(formData.booking_datetime);
                    newDate.setHours(parseInt(hours), parseInt(minutes));
                    setFormData({ ...formData, booking_datetime: newDate });
                  }}
                  className="h-9 bg-[#1a1a1a] border-[#3d3d3d] text-white"
                  data-testid="booking-time"
                />
              </div>
            </div>

            {/* Return Journey Toggle */}
            <div className="pt-2 border-t border-[#3d3d3d]">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.create_return}
                  onChange={(e) => {
                    const isChecked = e.target.checked;
                    setFormData(prev => ({ 
                      ...prev, 
                      create_return: isChecked,
                      return_pickup_location: isChecked ? prev.dropoff_location : "",
                      return_dropoff_location: isChecked ? prev.pickup_location : "",
                      return_additional_stops: [],
                      return_datetime: isChecked ? new Date(prev.booking_datetime.getTime() + 3600000 * 3) : null
                    }));
                  }}
                  className="rounded border-[#3d3d3d] bg-[#1a1a1a]"
                  data-testid="booking-return-toggle"
                />
                <span className="text-sm font-medium text-gray-300 flex items-center gap-1">
                  <ArrowLeftRight className="w-4 h-4 text-[#D4A853]" />
                  Create Return Journey
                </span>
              </label>
            </div>

            {formData.create_return && (
              <div className="bg-[#D4A853]/10 rounded-lg p-4 space-y-4 border border-[#D4A853]/30">
                <div className="bg-[#D4A853]/20 -mx-4 -mt-4 px-4 py-2 border-b border-[#D4A853]/30">
                  <span className="text-sm font-bold text-[#D4A853] uppercase tracking-wide">Return Journey Details</span>
                </div>

                {/* Return Pickup Location */}
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-[#D4A853]">Return Pickup Location</Label>
                  <AddressAutocomplete
                    value={formData.return_pickup_location}
                    onChange={(value) => setFormData(prev => ({ ...prev, return_pickup_location: value }))}
                    placeholder="Where to pick up for return..."
                    className="bg-[#1a1a1a] border-[#3d3d3d] text-white placeholder:text-gray-500"
                  />
                </div>

                {/* Return Stops */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-1 h-8 bg-[#D4A853] rounded"></div>
                      <div>
                        <Label className="text-sm font-medium text-[#D4A853]">Return Stops (in order)</Label>
                        {formData.return_additional_stops.length === 0 && (
                          <p className="text-xs text-[#D4A853]/70 italic">No intermediate stops - direct return</p>
                        )}
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setFormData(prev => ({
                        ...prev,
                        return_additional_stops: [...prev.return_additional_stops, ""]
                      }))}
                      className="h-7 text-xs gap-1 text-[#D4A853] border-[#D4A853]/50 hover:bg-[#D4A853]/20"
                    >
                      <Plus className="w-3 h-3" /> Add Stop
                    </Button>
                  </div>
                  
                  {formData.return_additional_stops.map((stop, index) => (
                    <div key={index} className="flex gap-2 ml-3">
                      <div className="flex-1">
                        <AddressAutocomplete
                          value={stop}
                          onChange={(value) => setFormData(prev => ({
                            ...prev,
                            return_additional_stops: prev.return_additional_stops.map((s, i) => i === index ? value : s)
                          }))}
                          placeholder={`Return stop ${index + 1}...`}
                          className="bg-[#1a1a1a] border-[#3d3d3d] text-white placeholder:text-gray-500"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => setFormData(prev => ({
                          ...prev,
                          return_additional_stops: prev.return_additional_stops.filter((_, i) => i !== index)
                        }))}
                        className="h-9 w-9 text-red-400 border-[#3d3d3d] hover:text-red-300 hover:bg-red-500/10"
                      >
                        <Minus className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>

                {/* Return Final Drop-off */}
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-[#D4A853]">Return Final Drop-off</Label>
                  <AddressAutocomplete
                    value={formData.return_dropoff_location}
                    onChange={(value) => setFormData(prev => ({ ...prev, return_dropoff_location: value }))}
                    placeholder="Where to drop off on return..."
                    className="bg-[#1a1a1a] border-[#3d3d3d] text-white placeholder:text-gray-500"
                  />
                </div>

                {/* Return Date & Time */}
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-[#D4A853]">Return Date & Time</Label>
                  <div className="flex gap-2">
                    <Popover open={returnDateOpen} onOpenChange={setReturnDateOpen}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="flex-1 h-9 justify-start text-left font-normal bg-[#1a1a1a] border-[#3d3d3d] text-white hover:bg-[#2d2d2d]">
                          <Clock className="mr-2 h-4 w-4 text-[#D4A853]" />
                          {formData.return_datetime 
                            ? format(formData.return_datetime, "MMMM do, yyyy 'at' h:mm a")
                            : "Select date & time"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 bg-white border-[#3d3d3d]" align="start">
                        <CalendarComponent
                          mode="single"
                          selected={formData.return_datetime}
                          onSelect={(date) => {
                            if (date) {
                              const current = formData.return_datetime || new Date();
                              date.setHours(current.getHours(), current.getMinutes());
                              setFormData(prev => ({ ...prev, return_datetime: date }));
                              setReturnDateOpen(false);
                            }
                          }}
                          disabled={(date) => date < formData.booking_datetime}
                          className="bg-white text-black"
                        />
                      </PopoverContent>
                    </Popover>
                    <Input
                      type="time"
                      value={formData.return_datetime ? format(formData.return_datetime, "HH:mm") : "12:00"}
                      onChange={(e) => {
                        const [hours, minutes] = e.target.value.split(':');
                        const newDate = new Date(formData.return_datetime || formData.booking_datetime);
                        newDate.setHours(parseInt(hours), parseInt(minutes));
                        setFormData(prev => ({ ...prev, return_datetime: newDate }));
                      }}
                      className="w-24 h-9 bg-[#1a1a1a] border-[#3d3d3d] text-white"
                    />
                  </div>
                </div>

                {/* Return Flight Info */}
                <div className="pt-2 border-t border-[#D4A853]/30 space-y-2">
                  <Label className="text-sm font-medium text-[#D4A853]">Return Flight Information</Label>
                  {formData.return_flight_number ? (
                    <div className="bg-[#1a1a1a] rounded-lg p-3 border border-[#3d3d3d]">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Plane className="w-4 h-4 text-[#D4A853]" />
                          <span className="text-sm font-medium text-white">{formData.return_flight_number}</span>
                          {formData.return_airline && <span className="text-xs text-gray-300">({formData.return_airline})</span>}
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setReturnFlightModalOpen(true)}
                          className="h-7 text-xs text-[#D4A853] hover:bg-[#D4A853]/20"
                        >
                          Edit
                        </Button>
                      </div>
                      {formData.return_terminal && (
                        <div className="text-xs text-gray-300 mt-1">Terminal {formData.return_terminal}</div>
                      )}
                    </div>
                  ) : (
                    <Button
                      onClick={() => setReturnFlightModalOpen(true)}
                      variant="outline"
                      className="w-full justify-start gap-2 h-9 border-[#3d3d3d] text-[#D4A853] hover:bg-[#D4A853]/20"
                      data-testid="open-return-flight-modal-btn"
                    >
                      <Plane className="w-4 h-4" />
                      Add Return Flight Information
                    </Button>
                  )}
                </div>

                {/* Info Banner */}
                <div className="bg-[#1a1a1a] rounded-md p-3 flex items-start gap-2 border border-[#3d3d3d]">
                  <div className="w-5 h-5 bg-[#D4A853] rounded flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-black text-xs font-bold">i</span>
                  </div>
                  <p className="text-sm text-gray-300">
                    A separate return booking will be created for the same passenger
                  </p>
                </div>
              </div>
            )}
          </Section>

          {/* WHAT Section */}
          <Section icon={Car} title="Vehicle & Driver">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-gray-300">Vehicle Type</Label>
                <Select
                  value={formData.vehicle_type || ""}
                  onValueChange={(value) => setFormData({ ...formData, vehicle_type: value })}
                >
                  <SelectTrigger className="h-9 bg-[#1a1a1a] border-[#3d3d3d] text-white">
                    <SelectValue placeholder="Select vehicle type" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#252525] border-[#3d3d3d] text-white">
                    {vehicleTypes.length > 0 ? (
                      vehicleTypes.map((vt) => (
                        <SelectItem key={vt.id} value={vt.id} className="text-white focus:bg-[#3d3d3d] focus:text-white">
                          <div className="flex items-center gap-2">
                            <span className="text-white">{vt.name}</span>
                            <span className="text-xs text-gray-300">({vt.capacity} seats)</span>
                          </div>
                        </SelectItem>
                      ))
                    ) : (
                      <>
                        <SelectItem value="saloon" className="text-white focus:bg-[#3d3d3d] focus:text-white">Executive Saloon</SelectItem>
                        <SelectItem value="estate" className="text-white focus:bg-[#3d3d3d] focus:text-white">Estate</SelectItem>
                        <SelectItem value="mpv" className="text-white focus:bg-[#3d3d3d] focus:text-white">MPV (6 Seater)</SelectItem>
                        <SelectItem value="minibus" className="text-white focus:bg-[#3d3d3d] focus:text-white">Minibus (8 Seater)</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-gray-300">Select Driver</Label>
                <Select
                  value={formData.driver_id || "none"}
                  onValueChange={(value) => setFormData({ ...formData, driver_id: value === "none" ? "" : value })}
                >
                  <SelectTrigger className="h-9 bg-[#1a1a1a] border-[#3d3d3d] text-white" data-testid="booking-driver-select">
                    <SelectValue placeholder="Select driver" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#252525] border-[#3d3d3d] text-white">
                    <SelectItem value="none" className="text-white focus:bg-[#3d3d3d] focus:text-white">Unassigned</SelectItem>
                    {drivers.filter(d => d.status === "available").map((driver) => (
                      <SelectItem key={driver.id} value={driver.id} className="text-white focus:bg-[#3d3d3d] focus:text-white">
                        {driver.name} - {driver.vehicle_type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-gray-300 flex items-center gap-1">
                  <Users className="w-3 h-3" /> PAX (Passengers)
                </Label>
                <Input
                  type="number"
                  min="1"
                  max="8"
                  value={formData.passenger_count}
                  onChange={(e) => setFormData({ ...formData, passenger_count: e.target.value })}
                  className="h-9 bg-[#1a1a1a] border-[#3d3d3d] text-white"
                  data-testid="booking-pax"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-gray-300 flex items-center gap-1">
                  <Briefcase className="w-3 h-3" /> Cases (Luggage)
                </Label>
                <Input
                  type="number"
                  min="0"
                  max="10"
                  value={formData.luggage_count}
                  onChange={(e) => setFormData({ ...formData, luggage_count: e.target.value })}
                  className="h-9 bg-[#1a1a1a] border-[#3d3d3d] text-white"
                  data-testid="booking-cases"
                />
              </div>
            </div>
          </Section>

          {/* Payment Section */}
          <Section icon={CreditCard} title="Payment & Pricing">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-gray-300">Payment Method</Label>
                <Select
                  value={formData.payment_method}
                  onValueChange={(value) => setFormData({ ...formData, payment_method: value })}
                >
                  <SelectTrigger className="h-9 bg-[#1a1a1a] border-[#3d3d3d] text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#252525] border-[#3d3d3d] text-white">
                    <SelectItem value="cash" className="text-white focus:bg-[#3d3d3d] focus:text-white">Cash</SelectItem>
                    <SelectItem value="card" className="text-white focus:bg-[#3d3d3d] focus:text-white">Card (In-Person)</SelectItem>
                    <SelectItem value="stripe" className="text-white focus:bg-[#3d3d3d] focus:text-white">Card (Online - Stripe)</SelectItem>
                    <SelectItem value="account" className="text-white focus:bg-[#3d3d3d] focus:text-white">Account</SelectItem>
                    <SelectItem value="invoice" className="text-white focus:bg-[#3d3d3d] focus:text-white">Invoice</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-gray-300">Fare (£)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.fare}
                  onChange={(e) => setFormData({ ...formData, fare: e.target.value })}
                  placeholder="Auto"
                  className="h-9 bg-[#1a1a1a] border-[#3d3d3d] text-white placeholder:text-gray-500"
                  data-testid="booking-fare"
                />
              </div>
            </div>

            {/* Stripe Payment Info */}
            {formData.payment_method === "stripe" && (
              <div className="bg-[#D4A853]/10 rounded-lg p-3 border border-[#D4A853]/30">
                <div className="flex items-center gap-2 text-[#D4A853] mb-2">
                  <CreditCard className="w-4 h-4" />
                  <span className="text-sm font-medium">Online Card Payment</span>
                </div>
                <p className="text-xs text-gray-300">
                  After saving the booking, a secure Stripe payment link will be generated. 
                  {formData.customer_email ? " A payment link can be sent to the customer's email." : " Add customer email to send payment link."}
                </p>
                {formData.fare && parseFloat(formData.fare) > 0 && (
                  <div className="mt-2 pt-2 border-t border-[#D4A853]/30">
                    <span className="text-sm text-[#D4A853] font-semibold">
                      Amount to charge: £{parseFloat(formData.fare).toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
            )}
          </Section>
        </div>

        {/* CENTER COLUMN - Context & Extras */}
        <div className="col-span-12 lg:col-span-3 space-y-4 overflow-y-auto">
          
          {/* Passenger Preview Card */}
          <div className="bg-[#252525] rounded-lg border border-[#3d3d3d] shadow-lg p-4">
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Passenger</div>
            {formData.first_name || formData.customer_phone ? (
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#D4A853] flex items-center justify-center text-black font-bold">
                    {formData.first_name ? formData.first_name[0].toUpperCase() : "?"}
                  </div>
                  <div>
                    <div className="font-medium text-white">
                      {formData.first_name} {formData.last_name}
                    </div>
                    <div className="text-xs text-gray-300">{formData.customer_phone}</div>
                  </div>
                </div>
                {formData.customer_email && (
                  <div className="text-xs text-gray-300 flex items-center gap-1">
                    <Mail className="w-3 h-3" /> {formData.customer_email}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-6 text-gray-500">
                <User className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No passenger selected</p>
              </div>
            )}
          </div>

          {/* Additional Info Section */}
          <Section icon={FileText} title="Additional Info">
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-300">Driver Notes</Label>
              <Textarea
                value={formData.driver_notes}
                onChange={(e) => setFormData({ ...formData, driver_notes: e.target.value })}
                placeholder="Special instructions for driver..."
                rows={2}
                className="resize-none text-sm bg-[#1a1a1a] border-[#3d3d3d] text-white placeholder:text-gray-500"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-gray-300">Notifications</Label>
              <div className="flex flex-wrap gap-2">
                <NotificationBadge 
                  label="Text Confirmation" 
                  active={notifications.sms}
                  onClick={() => setNotifications(prev => ({ ...prev, sms: !prev.sms }))}
                />
                <NotificationBadge 
                  label="Email Confirmation" 
                  active={notifications.email}
                  onClick={() => setNotifications(prev => ({ ...prev, email: !prev.email }))}
                />
              </div>
            </div>

            {/* Flight Info Section */}
            <div className="space-y-2">
              <Label className="text-xs text-gray-300">Flight Information</Label>
              {formData.flight_number ? (
                <div className="bg-[#D4A853]/10 rounded-lg p-3 border border-[#D4A853]/30">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Plane className="w-4 h-4 text-[#D4A853]" />
                      <span className="text-sm font-medium text-[#D4A853]">{formData.flight_number}</span>
                      {formData.airline && <span className="text-xs text-gray-300">({formData.airline})</span>}
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setFlightModalOpen(true)}
                      className="h-7 text-xs text-[#D4A853] hover:bg-[#D4A853]/20"
                    >
                      Edit
                    </Button>
                  </div>
                  {formData.terminal && (
                    <div className="text-xs text-gray-300 mt-1">Terminal {formData.terminal}</div>
                  )}
                </div>
              ) : (
                <Button
                  onClick={() => setFlightModalOpen(true)}
                  variant="outline"
                  className="w-full justify-start gap-2 h-9 border-[#3d3d3d] text-gray-300 hover:bg-[#2d2d2d] hover:text-[#D4A853]"
                  data-testid="open-flight-modal-btn"
                >
                  <Plane className="w-4 h-4" />
                  Add Flight Information
                </Button>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-gray-300">Internal Notes</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Office notes (not shown to driver)..."
                rows={2}
                className="resize-none text-sm bg-[#1a1a1a] border-[#3d3d3d] text-white placeholder:text-gray-500"
                data-testid="booking-notes"
              />
            </div>
          </Section>

          {/* Booking Quote */}
          <div className="bg-[#252525] rounded-lg border border-[#3d3d3d] shadow-lg p-4">
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Booking Quote</div>
            {routeInfo ? (
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400">Distance</span>
                  <span className="font-bold text-white">{routeInfo.distance.text}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400">Duration</span>
                  <span className="font-bold text-white">{routeInfo.duration.text}</span>
                </div>
                {formData.fare && (
                  <div className="flex justify-between items-center pt-2 border-t border-[#3d3d3d]">
                    <span className="text-sm text-gray-400">Fare</span>
                    <span className="text-xl font-bold text-[#D4A853]">£{parseFloat(formData.fare).toFixed(2)}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-4 text-gray-500">
                <Navigation className="w-6 h-6 mx-auto mb-2 opacity-50" />
                <p className="text-xs">Enter pickup and drop-off to get journey quote</p>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN - Map & Actions */}
        <div className="col-span-12 lg:col-span-4 flex flex-col gap-4">
          
          {/* Info Cards Row */}
          <div className="grid grid-cols-3 gap-2">
            <InfoCard label="ETA" value={routeInfo ? format(formData.booking_datetime, "HH:mm") : "--"} icon={Clock} />
            <InfoCard label="Duration" value={routeInfo?.duration?.text || "--"} icon={Navigation} />
            <InfoCard label="Distance" value={routeInfo?.distance?.text || "--"} icon={MapPin} />
          </div>

          {/* Map */}
          <div className="flex-1 bg-[#1a1a1a] rounded-lg overflow-hidden border border-[#3d3d3d] min-h-[300px] relative">
            <iframe
              src={getMapUrl()}
              className="w-full h-full min-h-[300px]"
              style={{ border: 0 }}
              allowFullScreen=""
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="Route Map"
            />
            {loadingRoute && (
              <div className="absolute inset-0 bg-[#1a1a1a]/80 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-[#D4A853]" />
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleReset}
              className="flex-1 h-11 gap-2 border-[#3d3d3d] text-gray-300 hover:bg-[#2d2d2d]"
              data-testid="booking-reset-btn"
            >
              <RotateCcw className="w-4 h-4" />
              Reset
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={saving}
              className="flex-[2] h-11 gap-2 bg-[#D4A853] hover:bg-[#c49743] text-black font-semibold"
              data-testid="booking-save-btn"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {saving ? "Saving..." : "Save Booking"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NewBookingPage;
