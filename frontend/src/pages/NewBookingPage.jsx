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
    <div className="flex items-center justify-center gap-1 text-xs text-gray-400 mb-1">
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
  });

  // Notification toggles
  const [notifications, setNotifications] = useState({
    sms: true,
    email: true,
  });

  // UI state
  const [dateOpen, setDateOpen] = useState(false);
  const [returnDateOpen, setReturnDateOpen] = useState(false);
  const [flightModalOpen, setFlightModalOpen] = useState(false);
  const [loadingFlight, setLoadingFlight] = useState(false);
  const [flightData, setFlightData] = useState(null);
  const [flightSearchNumber, setFlightSearchNumber] = useState("");

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [driversRes, clientsRes, passengersRes] = await Promise.all([
          axios.get(`${API}/drivers`),
          axios.get(`${API}/clients`),
          axios.get(`${API}/admin/passengers`).catch(() => ({ data: [] }))
        ]);
        setDrivers(driversRes.data);
        setClients(clientsRes.data);
        setPassengers(passengersRes.data || []);
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };
    fetchData();
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
    });
    setRouteInfo(null);
    setFlightData(null);
    setShowFlightInfo(false);
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
    <div className="h-[calc(100vh-64px)] bg-slate-100 overflow-hidden" data-testid="new-booking-page">
      {/* Header */}
      <div className="bg-[#1a3a5c] text-white px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center">
            <MapPin className="w-4 h-4 text-white" />
          </div>
          <h1 className="text-lg font-bold">New Booking</h1>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-300">
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
                <Label className="text-xs text-slate-500">Account</Label>
                <Select
                  value={formData.client_id || "none"}
                  onValueChange={(value) => setFormData({ ...formData, client_id: value === "none" ? "" : value })}
                >
                  <SelectTrigger className="h-9 bg-white" data-testid="booking-account-select">
                    <SelectValue placeholder="Select account..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Account (Direct)</SelectItem>
                    {clients.filter(c => c.status === "active").map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.account_no} - {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-500">First Name *</Label>
                <Input
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  placeholder="John"
                  className="h-9"
                  data-testid="booking-first-name"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-500">Last Name</Label>
                <Input
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  placeholder="Smith"
                  className="h-9"
                  data-testid="booking-last-name"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-500 flex items-center gap-1">
                  <Phone className="w-3 h-3" /> Mobile *
                </Label>
                <Input
                  value={formData.customer_phone}
                  onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })}
                  placeholder="+44 7700 900123"
                  className="h-9"
                  data-testid="booking-phone"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-500 flex items-center gap-1">
                  <Mail className="w-3 h-3" /> Email
                </Label>
                <Input
                  type="email"
                  value={formData.customer_email}
                  onChange={(e) => setFormData({ ...formData, customer_email: e.target.value })}
                  placeholder="john@example.com"
                  className="h-9"
                  data-testid="booking-email"
                />
              </div>
            </div>
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
                className="h-7 text-xs gap-1"
              >
                <Plus className="w-3 h-3" /> Add Stop
              </Button>
            }
          >
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-500 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-500"></span> Pickup *
              </Label>
              <AddressAutocomplete
                value={formData.pickup_location}
                onChange={(value) => setFormData(prev => ({ ...prev, pickup_location: value }))}
                placeholder="Enter pickup address..."
                data-testid="booking-pickup"
              />
            </div>

            {/* Additional Stops */}
            {formData.additional_stops.map((stop, index) => (
              <div key={index} className="space-y-1.5">
                <Label className="text-xs text-slate-500 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span> Via {index + 1}
                </Label>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <AddressAutocomplete
                      value={stop}
                      onChange={(value) => updateStop(index, value)}
                      placeholder={`Stop ${index + 1}...`}
                    />
                  </div>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="icon"
                    onClick={() => removeStop(index)}
                    className="h-9 w-9 text-red-500 hover:text-red-700 hover:bg-red-50"
                  >
                    <Minus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}

            <div className="space-y-1.5">
              <Label className="text-xs text-slate-500 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-red-500"></span> Drop-off *
              </Label>
              <AddressAutocomplete
                value={formData.dropoff_location}
                onChange={(value) => setFormData(prev => ({ ...prev, dropoff_location: value }))}
                placeholder="Enter drop-off address..."
                data-testid="booking-dropoff"
              />
            </div>
          </Section>

          {/* WHEN Section */}
          <Section icon={Calendar} title="Schedule">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-500">Date</Label>
                <Popover open={dateOpen} onOpenChange={setDateOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full h-9 justify-start text-left font-normal"
                      data-testid="booking-date-btn"
                    >
                      <Calendar className="mr-2 h-4 w-4 text-slate-400" />
                      {format(formData.booking_datetime, "dd/MM/yyyy")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
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
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-500">Time</Label>
                <Input
                  type="time"
                  value={format(formData.booking_datetime, "HH:mm")}
                  onChange={(e) => {
                    const [hours, minutes] = e.target.value.split(':');
                    const newDate = new Date(formData.booking_datetime);
                    newDate.setHours(parseInt(hours), parseInt(minutes));
                    setFormData({ ...formData, booking_datetime: newDate });
                  }}
                  className="h-9"
                  data-testid="booking-time"
                />
              </div>
            </div>

            {/* Return Journey Toggle */}
            <div className="pt-2 border-t border-slate-100">
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
                  className="rounded border-slate-300"
                  data-testid="booking-return-toggle"
                />
                <span className="text-sm font-medium text-slate-700 flex items-center gap-1">
                  <ArrowLeftRight className="w-4 h-4 text-amber-600" />
                  Create Return Journey
                </span>
              </label>
            </div>

            {formData.create_return && (
              <div className="bg-amber-50 rounded-lg p-4 space-y-4 border border-amber-200">
                <div className="bg-amber-100 -mx-4 -mt-4 px-4 py-2 border-b border-amber-200">
                  <span className="text-sm font-bold text-amber-800 uppercase tracking-wide">Return Journey Details</span>
                </div>

                {/* Return Pickup Location */}
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-amber-900">Return Pickup Location</Label>
                  <AddressAutocomplete
                    value={formData.return_pickup_location}
                    onChange={(value) => setFormData(prev => ({ ...prev, return_pickup_location: value }))}
                    placeholder="Where to pick up for return..."
                  />
                </div>

                {/* Return Stops */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-1 h-8 bg-amber-400 rounded"></div>
                      <div>
                        <Label className="text-sm font-medium text-amber-900">Return Stops (in order)</Label>
                        {formData.return_additional_stops.length === 0 && (
                          <p className="text-xs text-amber-600 italic">No intermediate stops - direct return</p>
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
                      className="h-7 text-xs gap-1 text-amber-700 border-amber-300 hover:bg-amber-100"
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
                        className="h-9 w-9 text-red-500 hover:text-red-700 hover:bg-red-50"
                      >
                        <Minus className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>

                {/* Return Final Drop-off */}
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-amber-900">Return Final Drop-off</Label>
                  <AddressAutocomplete
                    value={formData.return_dropoff_location}
                    onChange={(value) => setFormData(prev => ({ ...prev, return_dropoff_location: value }))}
                    placeholder="Where to drop off on return..."
                  />
                </div>

                {/* Return Date & Time */}
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-amber-900">Return Date & Time</Label>
                  <div className="flex gap-2">
                    <Popover open={returnDateOpen} onOpenChange={setReturnDateOpen}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="flex-1 h-9 justify-start text-left font-normal bg-white">
                          <Clock className="mr-2 h-4 w-4 text-amber-600" />
                          {formData.return_datetime 
                            ? format(formData.return_datetime, "MMMM do, yyyy 'at' h:mm a")
                            : "Select date & time"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
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
                      className="w-24 h-9 bg-white"
                    />
                  </div>
                </div>

                {/* Return Airport Transfer */}
                <div className="pt-2 border-t border-amber-200">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.return_is_airport_transfer || false}
                      onChange={(e) => setFormData(prev => ({ 
                        ...prev, 
                        return_is_airport_transfer: e.target.checked 
                      }))}
                      className="rounded border-amber-300"
                    />
                    <span className="text-sm text-amber-800 flex items-center gap-1">
                      <Plane className="w-4 h-4" /> Return Airport Transfer
                    </span>
                  </label>
                </div>

                {/* Info Banner */}
                <div className="bg-amber-100 rounded-md p-3 flex items-start gap-2">
                  <div className="w-5 h-5 bg-blue-500 rounded flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-white text-xs font-bold">i</span>
                  </div>
                  <p className="text-sm text-amber-800">
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
                <Label className="text-xs text-slate-500">Vehicle Type</Label>
                <Select
                  value={formData.vehicle_type || "saloon"}
                  onValueChange={(value) => setFormData({ ...formData, vehicle_type: value })}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select vehicle" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="saloon">Executive Saloon</SelectItem>
                    <SelectItem value="estate">Estate</SelectItem>
                    <SelectItem value="mpv">MPV (6 Seater)</SelectItem>
                    <SelectItem value="minibus">Minibus (8 Seater)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-500">Select Driver</Label>
                <Select
                  value={formData.driver_id || "none"}
                  onValueChange={(value) => setFormData({ ...formData, driver_id: value === "none" ? "" : value })}
                >
                  <SelectTrigger className="h-9" data-testid="booking-driver-select">
                    <SelectValue placeholder="Select driver" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unassigned</SelectItem>
                    {drivers.filter(d => d.status === "available").map((driver) => (
                      <SelectItem key={driver.id} value={driver.id}>
                        {driver.name} - {driver.vehicle_type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-500 flex items-center gap-1">
                  <Users className="w-3 h-3" /> PAX (Passengers)
                </Label>
                <Input
                  type="number"
                  min="1"
                  max="8"
                  value={formData.passenger_count}
                  onChange={(e) => setFormData({ ...formData, passenger_count: e.target.value })}
                  className="h-9"
                  data-testid="booking-pax"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-500 flex items-center gap-1">
                  <Briefcase className="w-3 h-3" /> Cases (Luggage)
                </Label>
                <Input
                  type="number"
                  min="0"
                  max="10"
                  value={formData.luggage_count}
                  onChange={(e) => setFormData({ ...formData, luggage_count: e.target.value })}
                  className="h-9"
                  data-testid="booking-cases"
                />
              </div>
            </div>
          </Section>

          {/* Payment Section */}
          <Section icon={CreditCard} title="Payment & Pricing">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-500">Payment Method</Label>
                <Select
                  value={formData.payment_method}
                  onValueChange={(value) => setFormData({ ...formData, payment_method: value })}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="card">Card (In-Person)</SelectItem>
                    <SelectItem value="stripe">Card (Online - Stripe)</SelectItem>
                    <SelectItem value="account">Account</SelectItem>
                    <SelectItem value="invoice">Invoice</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-500">Fare (£)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.fare}
                  onChange={(e) => setFormData({ ...formData, fare: e.target.value })}
                  placeholder="Auto"
                  className="h-9"
                  data-testid="booking-fare"
                />
              </div>
            </div>

            {/* Stripe Payment Info */}
            {formData.payment_method === "stripe" && (
              <div className="bg-purple-50 rounded-lg p-3 border border-purple-200">
                <div className="flex items-center gap-2 text-purple-700 mb-2">
                  <CreditCard className="w-4 h-4" />
                  <span className="text-sm font-medium">Online Card Payment</span>
                </div>
                <p className="text-xs text-purple-600">
                  After saving the booking, a secure Stripe payment link will be generated. 
                  {formData.customer_email ? " A payment link can be sent to the customer's email." : " Add customer email to send payment link."}
                </p>
                {formData.fare && parseFloat(formData.fare) > 0 && (
                  <div className="mt-2 pt-2 border-t border-purple-200">
                    <span className="text-sm text-purple-800 font-semibold">
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
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Passenger</div>
            {formData.first_name || formData.customer_phone ? (
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#1a3a5c] flex items-center justify-center text-white font-bold">
                    {formData.first_name ? formData.first_name[0].toUpperCase() : "?"}
                  </div>
                  <div>
                    <div className="font-medium text-slate-800">
                      {formData.first_name} {formData.last_name}
                    </div>
                    <div className="text-xs text-slate-500">{formData.customer_phone}</div>
                  </div>
                </div>
                {formData.customer_email && (
                  <div className="text-xs text-slate-500 flex items-center gap-1">
                    <Mail className="w-3 h-3" /> {formData.customer_email}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-6 text-slate-400">
                <User className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No passenger selected</p>
              </div>
            )}
          </div>

          {/* Additional Info Section */}
          <Section icon={FileText} title="Additional Info">
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-500">Driver Notes</Label>
              <Textarea
                value={formData.driver_notes}
                onChange={(e) => setFormData({ ...formData, driver_notes: e.target.value })}
                placeholder="Special instructions for driver..."
                rows={2}
                className="resize-none text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-slate-500">Notifications</Label>
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

            {/* Flight Info Toggle */}
            <div className="pt-2 border-t border-slate-100">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showFlightInfo}
                  onChange={(e) => setShowFlightInfo(e.target.checked)}
                  className="rounded border-slate-300"
                />
                <span className="text-sm text-slate-600 flex items-center gap-1">
                  <Plane className="w-4 h-4" /> Flight Info
                </span>
              </label>
            </div>

            {showFlightInfo && (
              <div className="bg-purple-50 rounded-lg p-3 space-y-3 border border-purple-200">
                <div className="flex gap-2">
                  <Input
                    value={formData.flight_number}
                    onChange={(e) => setFormData({ ...formData, flight_number: e.target.value.toUpperCase() })}
                    placeholder="BA123"
                    className="h-9 flex-1"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={handleFlightLookup}
                    disabled={loadingFlight}
                    className="h-9"
                  >
                    {loadingFlight ? <Loader2 className="w-4 h-4 animate-spin" /> : "Lookup"}
                  </Button>
                </div>
                {flightData && (
                  <div className="text-xs text-purple-700 bg-purple-100 rounded p-2">
                    <strong>{flightData.airline}</strong> - {flightData.flight_status?.toUpperCase()}
                    {flightData.arrival_terminal && <span className="ml-2">Terminal {flightData.arrival_terminal}</span>}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    value={formData.airline}
                    onChange={(e) => setFormData({ ...formData, airline: e.target.value })}
                    placeholder="Airline"
                    className="h-8 text-xs"
                  />
                  <Input
                    value={formData.terminal}
                    onChange={(e) => setFormData({ ...formData, terminal: e.target.value })}
                    placeholder="Terminal"
                    className="h-8 text-xs"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs text-slate-500">Internal Notes</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Office notes (not shown to driver)..."
                rows={2}
                className="resize-none text-sm"
                data-testid="booking-notes"
              />
            </div>
          </Section>

          {/* Booking Quote */}
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Booking Quote</div>
            {routeInfo ? (
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-600">Distance</span>
                  <span className="font-bold text-slate-800">{routeInfo.distance.text}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-600">Duration</span>
                  <span className="font-bold text-slate-800">{routeInfo.duration.text}</span>
                </div>
                {formData.fare && (
                  <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                    <span className="text-sm text-slate-600">Fare</span>
                    <span className="text-xl font-bold text-green-600">£{parseFloat(formData.fare).toFixed(2)}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-4 text-slate-400">
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
          <div className="flex-1 bg-slate-200 rounded-lg overflow-hidden border border-slate-300 min-h-[300px] relative">
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
              <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-[#1a3a5c]" />
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleReset}
              className="flex-1 h-11 gap-2"
              data-testid="booking-reset-btn"
            >
              <RotateCcw className="w-4 h-4" />
              Reset
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={saving}
              className="flex-[2] h-11 gap-2 bg-green-600 hover:bg-green-700"
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
