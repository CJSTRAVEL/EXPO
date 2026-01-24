import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Plus, Edit, Trash2, MapPin, Clock, User, UserCheck, UserX, MoreHorizontal, MessageSquare, MessageSquareX, Loader2, Search, X, Calendar, Building2, Plane, ArrowLeftRight, Mail, Car, History, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { format, startOfDay, isToday, isBefore, addDays, startOfMonth, endOfMonth, isWithinInterval } from "date-fns";
import { cn } from "@/lib/utils";
import AddressAutocomplete from "@/components/AddressAutocomplete";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const BOOKING_STATUSES = [
  { value: "pending", label: "Pending" },
  { value: "assigned", label: "Assigned" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

const getStatusBadge = (status) => {
  const styles = {
    pending: "status-pending",
    assigned: "status-assigned",
    in_progress: "status-in_progress",
    completed: "status-completed",
    cancelled: "status-cancelled",
  };
  return (
    <Badge variant="outline" className={`${styles[status]} text-xs font-medium`}>
      {status.replace('_', ' ')}
    </Badge>
  );
};

const BookingForm = ({ booking, drivers, clients, vehicleTypes, onSave, onClose, isOpen }) => {
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    customer_phone: "",
    customer_email: "",
    passenger_count: 1,
    luggage_count: 0,
    pickup_location: "",
    dropoff_location: "",
    additional_stops: [],
    booking_datetime: new Date(),
    notes: "",
    driver_notes: "",
    fare: "",
    deposit_paid: "",
    deposit_date: null,
    booking_source: "",
    status: "pending",
    driver_id: "",
    client_id: "",
    vehicle_type: "",
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
    return_flight_type: "",
    return_terminal: "",
  });

  // Booking source options
  const bookingSources = [
    { value: "phone", label: "Phone Line" },
    { value: "sms", label: "SMS" },
    { value: "whatsapp", label: "WhatsApp" },
    { value: "email", label: "Email" },
    { value: "facebook", label: "Facebook" },
    { value: "mobile", label: "Mobile App" },
    { value: "portal", label: "Customer Portal" },
  ];

  const [saving, setSaving] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const [returnDateOpen, setReturnDateOpen] = useState(false);
  const [routeInfo, setRouteInfo] = useState(null);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [showFlightInfo, setShowFlightInfo] = useState(false);
  const [showReturnFlightInfo, setShowReturnFlightInfo] = useState(false);
  const [loadingFlight, setLoadingFlight] = useState(false);
  const [loadingReturnFlight, setLoadingReturnFlight] = useState(false);
  const [flightData, setFlightData] = useState(null);
  const [returnFlightData, setReturnFlightData] = useState(null);
  const [flightError, setFlightError] = useState(null);
  const [returnFlightError, setReturnFlightError] = useState(null);
  const [flightModalOpen, setFlightModalOpen] = useState(false);
  const [flightSearchNumber, setFlightSearchNumber] = useState("");

  // Flight lookup handler for edit form
  const handleFlightLookup = async () => {
    const searchNum = flightSearchNumber || formData.flight_number;
    if (!searchNum) {
      toast.error("Please enter a flight number");
      return;
    }
    setLoadingFlight(true);
    setFlightError(null);
    try {
      const flightNum = searchNum.trim().toUpperCase().replace(/\s+/g, '');
      const response = await axios.get(`${API}/flight/${flightNum}`);
      const data = response.data;
      if (data.error) {
        setFlightError(data.error);
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
      setFlightError("Flight lookup failed");
      toast.error("Flight lookup failed");
    } finally {
      setLoadingFlight(false);
    }
  };

  useEffect(() => {
    if (booking) {
      // Handle both old (customer_name) and new (first_name/last_name) format
      let firstName = booking.first_name || "";
      let lastName = booking.last_name || "";
      if (!firstName && !lastName && booking.customer_name) {
        const nameParts = booking.customer_name.split(" ");
        firstName = nameParts[0] || "";
        lastName = nameParts.slice(1).join(" ") || "";
      }
      const flightInfo = booking.flight_info || {};
      setFormData({
        ...booking,
        first_name: firstName,
        last_name: lastName,
        booking_datetime: new Date(booking.booking_datetime),
        fare: booking.fare || "",
        deposit_paid: booking.deposit_paid || "",
        deposit_date: booking.deposit_date ? new Date(booking.deposit_date) : null,
        booking_source: booking.booking_source || "",
        driver_notes: booking.driver_notes || "",
        customer_email: booking.customer_email || "",
        passenger_count: booking.passenger_count || 1,
        luggage_count: booking.luggage_count || 0,
        driver_id: booking.driver_id || "",
        client_id: booking.client_id || "",
        vehicle_type: booking.vehicle_type || "",
        additional_stops: booking.additional_stops || [],
        flight_number: flightInfo.flight_number || "",
        airline: flightInfo.airline || "",
        flight_type: flightInfo.flight_type || "",
        terminal: flightInfo.terminal || "",
        create_return: false,
        return_pickup_location: "",
        return_additional_stops: [],
        return_dropoff_location: "",
        return_datetime: null,
        return_flight_number: "",
        return_airline: "",
        return_flight_type: "",
        return_terminal: "",
      });
      setShowFlightInfo(!!flightInfo.flight_number);
      setShowReturnFlightInfo(false);
      setFlightData(null);
      setReturnFlightData(null);
      setFlightError(null);
      setReturnFlightError(null);
    } else {
      setFormData({
        first_name: "",
        last_name: "",
        customer_phone: "",
        customer_email: "",
        passenger_count: 1,
        luggage_count: 0,
        pickup_location: "",
        dropoff_location: "",
        additional_stops: [],
        booking_datetime: new Date(),
        notes: "",
        driver_notes: "",
        fare: "",
        deposit_paid: "",
        deposit_date: null,
        booking_source: "",
        status: "pending",
        driver_id: "",
        client_id: "",
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
        return_flight_type: "",
        return_terminal: "",
      });
      setRouteInfo(null);
      setShowFlightInfo(false);
      setShowReturnFlightInfo(false);
      setFlightData(null);
      setReturnFlightData(null);
      setFlightError(null);
      setReturnFlightError(null);
    }
  }, [booking]);

  // Handle client selection - auto-fill details
  const handleClientSelect = (clientId) => {
    setFormData({ ...formData, client_id: clientId });
    if (clientId && clients) {
      const client = clients.find(c => c.id === clientId);
      if (client) {
        // Optionally auto-fill some fields from client
        // You can customize which fields to populate
      }
    }
  };

  // Calculate route when both pickup and dropoff are set
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      // Build flight_info object if any flight fields are filled
      let flight_info = null;
      if (formData.flight_number || formData.airline || formData.flight_type || formData.terminal) {
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
        driver_notes: formData.driver_notes,
        fare: formData.fare ? parseFloat(formData.fare) : null,
        deposit_paid: formData.deposit_paid ? parseFloat(formData.deposit_paid) : null,
        deposit_date: formData.deposit_date ? formData.deposit_date.toISOString() : null,
        booking_source: formData.booking_source || null,
        status: formData.status,
        driver_id: formData.driver_id || null,
        client_id: formData.client_id || null,
        vehicle_type: formData.vehicle_type || null,
        flight_info: flight_info,
        distance_miles: routeInfo?.distance?.miles || null,
        duration_minutes: routeInfo?.duration?.minutes || null,
        // Return booking fields (only for new bookings)
        create_return: !booking && formData.create_return,
        return_pickup_location: !booking && formData.create_return 
          ? formData.return_pickup_location 
          : null,
        return_additional_stops: !booking && formData.create_return && formData.return_additional_stops?.length > 0
          ? formData.return_additional_stops
          : null,
        return_dropoff_location: !booking && formData.create_return 
          ? formData.return_dropoff_location 
          : null,
        return_datetime: !booking && formData.create_return && formData.return_datetime 
          ? formData.return_datetime.toISOString() 
          : null,
        // Return flight info
        return_flight_info: !booking && formData.create_return && (formData.return_flight_number || formData.return_airline)
          ? {
              flight_number: formData.return_flight_number || null,
              airline: formData.return_airline || null,
              flight_type: formData.return_flight_type || null,
              terminal: formData.return_terminal || null,
            }
          : null,
      };
      if (!payload.driver_id) delete payload.driver_id;
      if (!payload.client_id) delete payload.client_id;
      await onSave(payload);
      onClose();
    } catch (error) {
      console.error("Error saving booking:", error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[550px]" data-testid="booking-form-modal">
        <DialogHeader>
          <DialogTitle>{booking ? "Edit Booking" : "New Booking"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto pr-2">
            {/* Client Selection (for invoicing) */}
            {clients && clients.length > 0 && (
              <div className="space-y-2 pb-3 border-b">
                <Label>Invoice to Client (Optional)</Label>
                <Select
                  value={formData.client_id || "none"}
                  onValueChange={(value) => handleClientSelect(value === "none" ? "" : value)}
                >
                  <SelectTrigger data-testid="booking-client-select">
                    <SelectValue placeholder="Select client for invoicing..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Client (Direct Payment)</SelectItem>
                    {clients.filter(c => c.status === "active").map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.account_no} - {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formData.client_id && (
                  <p className="text-xs text-muted-foreground">
                    This booking will be added to the client&apos;s invoice
                  </p>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="first_name">First Name</Label>
                <Input
                  id="first_name"
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  placeholder="John"
                  required
                  data-testid="booking-first-name-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name">Last Name</Label>
                <Input
                  id="last_name"
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  placeholder="Smith"
                  required
                  data-testid="booking-last-name-input"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="customer_phone">Phone</Label>
              <Input
                id="customer_phone"
                value={formData.customer_phone}
                onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })}
                placeholder="+44 7700 900000"
                required
                data-testid="booking-customer-phone-input"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="customer_email">Email (for confirmation)</Label>
              <Input
                id="customer_email"
                type="email"
                value={formData.customer_email}
                onChange={(e) => setFormData({ ...formData, customer_email: e.target.value })}
                placeholder="customer@example.com"
                data-testid="booking-customer-email-input"
              />
            </div>

            {/* PAX and Cases */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="passenger_count">PAX (Passengers)</Label>
                <Input
                  id="passenger_count"
                  type="number"
                  min="1"
                  max="20"
                  value={formData.passenger_count}
                  onChange={(e) => setFormData({ ...formData, passenger_count: e.target.value })}
                  placeholder="1"
                  data-testid="booking-pax-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="luggage_count">Cases (Luggage)</Label>
                <Input
                  id="luggage_count"
                  type="number"
                  min="0"
                  max="20"
                  value={formData.luggage_count}
                  onChange={(e) => setFormData({ ...formData, luggage_count: e.target.value })}
                  placeholder="0"
                  data-testid="booking-cases-input"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="pickup_location">Pickup Location</Label>
              <AddressAutocomplete
                id="pickup_location"
                value={formData.pickup_location}
                onChange={(value) => setFormData({ ...formData, pickup_location: value })}
                placeholder="Start typing address..."
                data-testid="booking-pickup-input"
              />
            </div>

            {/* Additional Stops (Multi-drop) - Between Pickup and Dropoff */}
            <div className="space-y-2 pl-4 border-l-2 border-amber-300">
              <div className="flex items-center justify-between">
                <Label className="text-amber-700">Stops (in order)</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setFormData({ 
                    ...formData, 
                    additional_stops: [...formData.additional_stops, ""] 
                  })}
                  data-testid="add-stop-btn"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Stop
                </Button>
              </div>
              {formData.additional_stops.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">No intermediate stops - direct journey</p>
              ) : (
                formData.additional_stops.map((stop, index) => (
                  <div key={index} className="flex gap-2 items-center">
                    <span className="text-xs font-semibold text-amber-600 w-6">{index + 1}.</span>
                    <div className="flex-1">
                      <AddressAutocomplete
                        value={stop}
                        onChange={(value) => {
                          const newStops = [...formData.additional_stops];
                          newStops[index] = value;
                          setFormData({ ...formData, additional_stops: newStops });
                        }}
                        placeholder={`Stop ${index + 1} address...`}
                        data-testid={`booking-stop-${index}-input`}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 text-destructive hover:text-destructive"
                      onClick={() => {
                        const newStops = formData.additional_stops.filter((_, i) => i !== index);
                        setFormData({ ...formData, additional_stops: newStops });
                      }}
                      data-testid={`remove-stop-${index}-btn`}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="dropoff_location">Final Dropoff Location</Label>
              <AddressAutocomplete
                id="dropoff_location"
                value={formData.dropoff_location}
                onChange={(value) => setFormData({ ...formData, dropoff_location: value })}
                placeholder="Start typing address..."
                data-testid="booking-dropoff-input"
              />
            </div>

            {/* Route Information Display */}
            {(loadingRoute || routeInfo) && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg" data-testid="route-info">
                {loadingRoute ? (
                  <div className="flex items-center gap-2 text-blue-600">
                    <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm">Calculating route...</span>
                  </div>
                ) : routeInfo && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-blue-800">Journey Details</span>
                      {routeInfo.summary && (
                        <span className="text-xs text-blue-600">via {routeInfo.summary}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="flex items-center gap-2">
                        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                        </svg>
                        <div>
                          <p className="text-lg font-bold text-blue-900">{routeInfo.distance?.miles} miles</p>
                          <p className="text-xs text-blue-600">Distance</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="w-5 h-5 text-blue-600" />
                        <div>
                          <p className="text-lg font-bold text-blue-900">{routeInfo.duration?.text}</p>
                          <p className="text-xs text-blue-600">Est. Duration</p>
                        </div>
                      </div>
                    </div>
                    {/* Route Map */}
                    <div className="rounded-lg overflow-hidden border border-blue-200 mt-2">
                      <img
                        alt="Route Map"
                        width="100%"
                        height="200"
                        style={{ width: '100%', height: '200px', objectFit: 'cover' }}
                        src={`https://maps.googleapis.com/maps/api/staticmap?size=600x200&maptype=roadmap&markers=color:green%7Clabel:A%7C${encodeURIComponent(formData.pickup_location)}&markers=color:red%7Clabel:B%7C${encodeURIComponent(formData.dropoff_location)}&path=color:0x0066ff%7Cweight:4%7C${encodeURIComponent(formData.pickup_location)}%7C${encodeURIComponent(formData.dropoff_location)}&key=AIzaSyBSL4bF8eGeiABUOK0GM8UoWBzqtUVfMIs`}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Date & Time and Fare */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date & Time</Label>
                <Popover open={dateOpen} onOpenChange={setDateOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !formData.booking_datetime && "text-muted-foreground"
                      )}
                      data-testid="booking-datetime-btn"
                    >
                      <Clock className="mr-2 h-4 w-4" />
                      {formData.booking_datetime ? format(formData.booking_datetime, "PPP p") : "Pick a date"}
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
                        }
                      }}
                      initialFocus
                    />
                    <div className="p-3 border-t">
                      <Input
                        type="time"
                        value={format(formData.booking_datetime, "HH:mm")}
                        onChange={(e) => {
                          const [hours, minutes] = e.target.value.split(':');
                          const newDate = new Date(formData.booking_datetime);
                          newDate.setHours(parseInt(hours), parseInt(minutes));
                          setFormData({ ...formData, booking_datetime: newDate });
                        }}
                        data-testid="booking-time-input"
                      />
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label htmlFor="fare">Fare (£)</Label>
                <Input
                  id="fare"
                  type="number"
                  step="0.01"
                  value={formData.fare}
                  onChange={(e) => setFormData({ ...formData, fare: e.target.value })}
                  placeholder="25.00"
                  data-testid="booking-fare-input"
                />
              </div>
            </div>

            {/* Deposit Paid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="deposit_paid">Deposit Paid (£)</Label>
                <Input
                  id="deposit_paid"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.deposit_paid || ""}
                  onChange={(e) => {
                    const value = e.target.value;
                    setFormData({ 
                      ...formData, 
                      deposit_paid: value,
                      // Auto-set deposit date to today if deposit is entered and date not set
                      deposit_date: value && parseFloat(value) > 0 && !formData.deposit_date 
                        ? new Date() 
                        : formData.deposit_date
                    });
                  }}
                  placeholder="0.00"
                  data-testid="booking-deposit-input"
                />
              </div>
              {/* Deposit Date */}
              {formData.deposit_paid && parseFloat(formData.deposit_paid) > 0 && (
                <div className="space-y-2">
                  <Label>Deposit Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !formData.deposit_date && "text-muted-foreground"
                        )}
                        data-testid="deposit-date-picker"
                      >
                        <Calendar className="mr-2 h-4 w-4" />
                        {formData.deposit_date 
                          ? format(formData.deposit_date, "dd/MM/yyyy")
                          : "Select date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={formData.deposit_date}
                        onSelect={(date) => setFormData({ ...formData, deposit_date: date })}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              )}
            </div>

            {/* Balance Due Display */}
            {formData.fare && parseFloat(formData.fare) > 0 && (
              <div className="p-3 rounded-md border bg-muted">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Total Fare:</span>
                  <span className="font-medium">£{parseFloat(formData.fare).toFixed(2)}</span>
                </div>
                {formData.deposit_paid && parseFloat(formData.deposit_paid) > 0 && (
                  <div className="flex justify-between items-center mt-1">
                    <span className="text-muted-foreground">
                      Deposit Paid {formData.deposit_date ? `(${format(formData.deposit_date, "dd/MM/yyyy")})` : ''}:
                    </span>
                    <span className="font-medium text-green-600">-£{parseFloat(formData.deposit_paid).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center mt-2 pt-2 border-t">
                  <span className="font-semibold">Balance Due:</span>
                  <span className="font-bold text-primary text-lg">
                    £{Math.max(0, (parseFloat(formData.fare) || 0) - (parseFloat(formData.deposit_paid) || 0)).toFixed(2)}
                  </span>
                </div>
              </div>
            )}

            {/* Booking Source */}
            <div className="space-y-2">
              <Label htmlFor="booking_source">Booking Source</Label>
              <Select
                value={formData.booking_source || "none"}
                onValueChange={(value) => setFormData({ ...formData, booking_source: value === "none" ? "" : value })}
              >
                <SelectTrigger data-testid="booking-source-select">
                  <SelectValue placeholder="Select source..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not Specified</SelectItem>
                  {bookingSources.map((source) => (
                    <SelectItem key={source.value} value={source.value}>
                      {source.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Return Booking Option (only for new bookings) */}
            {!booking && (
              <div className="space-y-3 border-2 border-amber-300 rounded-lg p-3 bg-amber-50/50">
                {/* Airport Transfer / Flight Info */}
                <div className="space-y-3 pb-3 border-b border-amber-300">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showFlightInfo}
                        onChange={(e) => setShowFlightInfo(e.target.checked)}
                        className="rounded"
                        data-testid="flight-info-toggle"
                      />
                      <span className="font-semibold text-amber-800">
                        <Plane className="w-4 h-4 inline mr-1" />
                        Airport Transfer
                      </span>
                    </Label>
                  </div>
                  
                  {showFlightInfo && (
                    <div className="space-y-3 pt-2">
                      {/* Flight Number with Live Lookup */}
                      <div className="space-y-1">
                        <Label className="text-xs text-amber-800">Flight Number</Label>
                        <div className="flex gap-2">
                          <Input
                            value={formData.flight_number}
                            onChange={(e) => setFormData({ ...formData, flight_number: e.target.value.toUpperCase() })}
                            placeholder="BA123"
                            className="flex-1 bg-white"
                            data-testid="flight-number-input"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={!formData.flight_number || formData.flight_number.length < 3 || loadingFlight}
                            onClick={async () => {
                              if (!formData.flight_number) return;
                              setLoadingFlight(true);
                              setFlightError(null);
                              try {
                                const res = await axios.get(`${API}/flight/${formData.flight_number}`);
                                if (res.data.error) {
                                  setFlightError(res.data.error);
                                } else {
                                  const flightInfo = res.data;
                                  
                                  // Build pickup location from arrival airport
                                  let pickupLocation = "";
                                  if (flightInfo.arrival_airport) {
                                    pickupLocation = flightInfo.arrival_airport;
                                    if (flightInfo.arrival_iata) {
                                      pickupLocation += ` (${flightInfo.arrival_iata})`;
                                    }
                                    if (flightInfo.arrival_terminal) {
                                      pickupLocation += ` Terminal ${flightInfo.arrival_terminal}`;
                                    }
                                  }
                                  
                                  // Parse arrival time for booking datetime
                                  let arrivalDateTime = formData.booking_datetime;
                                  const arrivalTime = flightInfo.arrival_estimated || flightInfo.arrival_scheduled;
                                  if (arrivalTime) {
                                    arrivalDateTime = new Date(arrivalTime);
                                  }
                                  
                                  // Auto-fill flight data including pickup location and time
                                  setFormData(prev => ({
                                    ...prev,
                                    airline: flightInfo.airline || prev.airline,
                                    terminal: flightInfo.arrival_terminal || flightInfo.departure_terminal || prev.terminal,
                                    flight_type: "arrival",
                                    pickup_location: pickupLocation || prev.pickup_location,
                                    booking_datetime: arrivalDateTime
                                  }));
                                  setFlightData(flightInfo);
                                }
                              } catch (err) {
                                setFlightError("Failed to lookup flight");
                              } finally {
                                setLoadingFlight(false);
                              }
                            }}
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
                              flightData.flight_status === 'delayed' ? 'bg-amber-100 text-amber-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {flightData.flight_status?.toUpperCase() || 'UNKNOWN'}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <span className="text-muted-foreground">From:</span>
                              <p className="font-medium">{flightData.departure_airport}</p>
                              <p className="text-muted-foreground">{flightData.departure_iata}</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">To:</span>
                              <p className="font-medium">{flightData.arrival_airport}</p>
                              <p className="text-muted-foreground">{flightData.arrival_iata}</p>
                            </div>
                          </div>
                          {(flightData.departure_scheduled || flightData.arrival_scheduled) && (
                            <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-blue-200">
                              {flightData.departure_scheduled && (
                                <div>
                                  <span className="text-muted-foreground">Departure:</span>
                                  <p className="font-medium">
                                    {new Date(flightData.departure_scheduled).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                    {flightData.departure_terminal && ` - T${flightData.departure_terminal}`}
                                    {flightData.departure_gate && ` Gate ${flightData.departure_gate}`}
                                  </p>
                                </div>
                              )}
                              {flightData.arrival_scheduled && (
                                <div>
                                  <span className="text-muted-foreground">Arrival:</span>
                                  <p className="font-medium">
                                    {new Date(flightData.arrival_scheduled).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                    {flightData.arrival_terminal && ` - T${flightData.arrival_terminal}`}
                                  </p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs text-amber-800">Airline</Label>
                          <Input
                            value={formData.airline}
                            onChange={(e) => setFormData({ ...formData, airline: e.target.value })}
                            placeholder="British Airways"
                            className="bg-white"
                            data-testid="flight-airline-input"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-amber-800">Terminal</Label>
                          <Input
                            value={formData.terminal}
                            onChange={(e) => setFormData({ ...formData, terminal: e.target.value })}
                            placeholder="Terminal 5"
                            className="bg-white"
                            data-testid="flight-terminal-input"
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-amber-800">Flight Type</Label>
                        <Select
                          value={formData.flight_type || ""}
                          onValueChange={(value) => setFormData({ ...formData, flight_type: value })}
                        >
                          <SelectTrigger className="bg-white" data-testid="flight-type-select">
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="arrival">Arrival (Picking up passenger)</SelectItem>
                            <SelectItem value="departure">Departure (Dropping off passenger)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                </div>

                {/* Create Return Journey Checkbox */}
                <Label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.create_return}
                    onChange={(e) => {
                      const isChecked = e.target.checked;
                      setFormData({ 
                        ...formData, 
                        create_return: isChecked,
                        // Default return pickup to original dropoff, and vice versa
                        return_pickup_location: isChecked ? formData.dropoff_location : "",
                        return_additional_stops: [],
                        return_dropoff_location: isChecked ? formData.pickup_location : "",
                        return_datetime: isChecked ? new Date(formData.booking_datetime.getTime() + 3600000 * 3) : null
                      });
                    }}
                    className="rounded"
                    data-testid="create-return-toggle"
                  />
                  <span className="font-semibold text-amber-800">Create Return Journey</span>
                </Label>
                
                {formData.create_return && (
                  <div className="pt-3 border-t border-amber-300 space-y-4">
                    <div className="bg-amber-100 rounded px-2 py-1">
                      <p className="text-xs font-semibold text-amber-800">RETURN JOURNEY DETAILS</p>
                    </div>
                    
                    {/* Return Pickup Location */}
                    <div className="space-y-2">
                      <Label className="text-amber-800">Return Pickup Location</Label>
                      <AddressAutocomplete
                        value={formData.return_pickup_location}
                        onChange={(value) => setFormData({ ...formData, return_pickup_location: value })}
                        placeholder="Where to pick up for return..."
                        data-testid="return-pickup-input"
                      />
                    </div>

                    {/* Return Additional Stops */}
                    <div className="space-y-2 pl-4 border-l-2 border-amber-400">
                      <div className="flex items-center justify-between">
                        <Label className="text-amber-700 text-sm">Return Stops (in order)</Label>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs border-amber-400 text-amber-700 hover:bg-amber-100"
                          onClick={() => setFormData({ 
                            ...formData, 
                            return_additional_stops: [...(formData.return_additional_stops || []), ""] 
                          })}
                          data-testid="add-return-stop-btn"
                        >
                          <Plus className="w-3 h-3 mr-1" />
                          Add Stop
                        </Button>
                      </div>
                      {(!formData.return_additional_stops || formData.return_additional_stops.length === 0) ? (
                        <p className="text-xs text-amber-600 italic">No intermediate stops - direct return</p>
                      ) : (
                        formData.return_additional_stops.map((stop, index) => (
                          <div key={index} className="flex gap-2 items-center">
                            <span className="text-xs font-semibold text-amber-600 w-5">{index + 1}.</span>
                            <div className="flex-1">
                              <AddressAutocomplete
                                value={stop}
                                onChange={(value) => {
                                  const newStops = [...formData.return_additional_stops];
                                  newStops[index] = value;
                                  setFormData({ ...formData, return_additional_stops: newStops });
                                }}
                                placeholder={`Return stop ${index + 1}...`}
                                data-testid={`return-stop-${index}-input`}
                              />
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                              onClick={() => {
                                const newStops = formData.return_additional_stops.filter((_, i) => i !== index);
                                setFormData({ ...formData, return_additional_stops: newStops });
                              }}
                              data-testid={`remove-return-stop-${index}-btn`}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Return Dropoff Location */}
                    <div className="space-y-2">
                      <Label className="text-amber-800">Return Final Drop-off</Label>
                      <AddressAutocomplete
                        value={formData.return_dropoff_location}
                        onChange={(value) => setFormData({ ...formData, return_dropoff_location: value })}
                        placeholder="Where to drop off on return..."
                        data-testid="return-dropoff-input"
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
                              !formData.return_datetime && "text-muted-foreground"
                            )}
                            data-testid="return-datetime-btn"
                          >
                            <Clock className="mr-2 h-4 w-4 text-amber-600" />
                            {formData.return_datetime 
                              ? format(formData.return_datetime, "PPP 'at' p") 
                              : "Pick return date & time"}
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
                                setFormData({ ...formData, return_datetime: date });
                              }
                            }}
                            initialFocus
                          />
                          <div className="p-3 border-t">
                            <Input
                              type="time"
                              value={formData.return_datetime ? format(formData.return_datetime, "HH:mm") : "12:00"}
                              onChange={(e) => {
                                const [hours, minutes] = e.target.value.split(':');
                                const newDate = new Date(formData.return_datetime || new Date());
                                newDate.setHours(parseInt(hours), parseInt(minutes));
                                setFormData({ ...formData, return_datetime: newDate });
                              }}
                              data-testid="return-time-input"
                            />
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>

                    {/* Return Airport Transfer */}
                    <div className="space-y-3 border border-amber-300 rounded-lg p-3 bg-white/50">
                      <Label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={showReturnFlightInfo}
                          onChange={(e) => setShowReturnFlightInfo(e.target.checked)}
                          className="rounded"
                          data-testid="return-flight-info-toggle"
                        />
                        <span className="text-sm font-semibold text-amber-800">
                          <Plane className="w-4 h-4 inline mr-1" />
                          Return Airport Transfer
                        </span>
                      </Label>
                      
                      {showReturnFlightInfo && (
                        <div className="space-y-3 pt-2">
                          {/* Return Flight Number with Live Lookup */}
                          <div className="space-y-1">
                            <Label className="text-xs text-amber-800">Return Flight Number</Label>
                            <div className="flex gap-2">
                              <Input
                                value={formData.return_flight_number}
                                onChange={(e) => setFormData({ ...formData, return_flight_number: e.target.value.toUpperCase() })}
                                placeholder="BA124"
                                className="flex-1 bg-white"
                                data-testid="return-flight-number-input"
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={!formData.return_flight_number || formData.return_flight_number.length < 3 || loadingReturnFlight}
                                onClick={async () => {
                                  if (!formData.return_flight_number) return;
                                  setLoadingReturnFlight(true);
                                  setReturnFlightError(null);
                                  try {
                                    const res = await axios.get(`${API}/flight/${formData.return_flight_number}`);
                                    if (res.data.error) {
                                      setReturnFlightError(res.data.error);
                                    } else {
                                      const flightInfo = res.data;
                                      
                                      // Build dropoff location from departure airport (for return, passenger departs)
                                      let dropoffLocation = "";
                                      if (flightInfo.departure_airport) {
                                        dropoffLocation = flightInfo.departure_airport;
                                        if (flightInfo.departure_iata) {
                                          dropoffLocation += ` (${flightInfo.departure_iata})`;
                                        }
                                        if (flightInfo.departure_terminal) {
                                          dropoffLocation += ` Terminal ${flightInfo.departure_terminal}`;
                                        }
                                      }
                                      
                                      // Parse departure time - need to arrive before flight
                                      let departureDateTime = formData.return_datetime;
                                      const departureTime = flightInfo.departure_scheduled;
                                      if (departureTime) {
                                        // Set pickup 2 hours before flight
                                        departureDateTime = new Date(new Date(departureTime).getTime() - 2 * 3600000);
                                      }
                                      
                                      // Auto-fill return flight data
                                      setFormData(prev => ({
                                        ...prev,
                                        return_airline: flightInfo.airline || prev.return_airline,
                                        return_terminal: flightInfo.departure_terminal || prev.return_terminal,
                                        return_flight_type: "departure",
                                        return_dropoff_location: dropoffLocation || prev.return_dropoff_location,
                                        return_datetime: departureDateTime
                                      }));
                                      setReturnFlightData(flightInfo);
                                    }
                                  } catch (err) {
                                    setReturnFlightError("Failed to lookup flight");
                                  } finally {
                                    setLoadingReturnFlight(false);
                                  }
                                }}
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
                              {returnFlightData.departure_scheduled && (
                                <div className="text-xs pt-2 border-t border-blue-200">
                                  <span className="text-muted-foreground">Departure:</span>
                                  <p className="font-medium">
                                    {new Date(returnFlightData.departure_scheduled).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                    {returnFlightData.departure_terminal && ` - T${returnFlightData.departure_terminal}`}
                                    {returnFlightData.departure_gate && ` Gate ${returnFlightData.departure_gate}`}
                                  </p>
                                </div>
                              )}
                            </div>
                          )}

                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <Label className="text-xs text-amber-800">Airline</Label>
                              <Input
                                value={formData.return_airline}
                                onChange={(e) => setFormData({ ...formData, return_airline: e.target.value })}
                                placeholder="British Airways"
                                className="bg-white"
                                data-testid="return-airline-input"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs text-amber-800">Terminal</Label>
                              <Input
                                value={formData.return_terminal}
                                onChange={(e) => setFormData({ ...formData, return_terminal: e.target.value })}
                                placeholder="Terminal 5"
                                className="bg-white"
                                data-testid="return-terminal-input"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <p className="text-xs text-amber-700 bg-amber-100 rounded p-2">
                      ↩️ A separate return booking will be created for the same passenger
                    </p>
                  </div>
                )}
              </div>
            )}

            {booking && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) => setFormData({ ...formData, status: value })}
                  >
                    <SelectTrigger data-testid="booking-status-select">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      {BOOKING_STATUSES.map((status) => (
                        <SelectItem key={status.value} value={status.value}>
                          {status.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Vehicle Type</Label>
                  <Select
                    value={formData.vehicle_type || "none"}
                    onValueChange={(value) => setFormData({ ...formData, vehicle_type: value === "none" ? "" : value })}
                  >
                    <SelectTrigger data-testid="booking-vehicle-type-select">
                      <SelectValue placeholder="Select vehicle type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Not specified</SelectItem>
                      {vehicleTypes && vehicleTypes.map((vt) => (
                        <SelectItem key={vt.id} value={vt.id}>
                          {vt.name} ({vt.capacity} seats)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Assign Driver</Label>
                  <Select
                    value={formData.driver_id || "none"}
                    onValueChange={(value) => setFormData({ ...formData, driver_id: value === "none" ? "" : value })}
                  >
                    <SelectTrigger data-testid="booking-driver-select">
                      <SelectValue placeholder="Select driver" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No driver</SelectItem>
                      {drivers.filter(d => {
                        // Always include currently assigned driver
                        if (d.id === formData.driver_id) return true;
                        // Include all active drivers (not inactive)
                        if (d.status === 'inactive') return false;
                        // Filter by vehicle type if specified
                        if (formData.vehicle_type) {
                          // Vehicle type might be an ID, look up the name
                          let vehicleTypeName = formData.vehicle_type;
                          if (vehicleTypes && vehicleTypes.length > 0) {
                            const vt = vehicleTypes.find(v => v.id === formData.vehicle_type);
                            if (vt) {
                              vehicleTypeName = vt.name;
                            }
                          }
                          
                          const vType = vehicleTypeName.toLowerCase();
                          const driverTypes = d.driver_types || [];
                          
                          // CJ's 16 Minibus or CJ's 16 with Trailer = PSV
                          if (vType.includes('16')) {
                            return driverTypes.includes('psv');
                          }
                          
                          // CJ's Taxi = Taxi, CJ's 8 Minibus = Taxi
                          if (vType.includes('taxi') || vType.includes('8 minibus') || vType.includes('8minibus')) {
                            return driverTypes.includes('taxi');
                          }
                        }
                        return true;
                      }).map((driver) => (
                        <SelectItem key={driver.id} value={driver.id}>
                          {driver.name} ({driver.vehicle_type || 'N/A'})
                          {driver.driver_types?.length > 0 && ` - ${driver.driver_types.map(t => t.toUpperCase()).join('/')}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Flight Information Section (for editing) */}
            {booking && (
              <div className="space-y-3 border border-purple-200 rounded-lg p-3 bg-purple-50/50">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2 text-purple-800 font-semibold">
                    <Plane className="w-4 h-4" />
                    Flight Information
                  </Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setFlightModalOpen(true)}
                    className="border-purple-300 text-purple-700 hover:bg-purple-100"
                    data-testid="edit-flight-lookup-btn"
                  >
                    <Search className="w-3 h-3 mr-1" />
                    Lookup Flight
                  </Button>
                </div>
                
                {(formData.flight_number || formData.airline) ? (
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    {formData.flight_number && (
                      <div>
                        <Label className="text-xs text-purple-600">Flight Number</Label>
                        <p className="font-medium text-sm">{formData.flight_number}</p>
                      </div>
                    )}
                    {formData.airline && (
                      <div>
                        <Label className="text-xs text-purple-600">Airline</Label>
                        <p className="font-medium text-sm">{formData.airline}</p>
                      </div>
                    )}
                    {formData.terminal && (
                      <div>
                        <Label className="text-xs text-purple-600">Terminal</Label>
                        <p className="font-medium text-sm">{formData.terminal}</p>
                      </div>
                    )}
                    {formData.flight_type && (
                      <div>
                        <Label className="text-xs text-purple-600">Type</Label>
                        <p className="font-medium text-sm capitalize">{formData.flight_type}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-purple-600 italic">No flight information - click &quot;Lookup Flight&quot; to add</p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Any special instructions..."
                rows={3}
                data-testid="booking-notes-input"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving} data-testid="save-booking-btn">
              {saving ? "Saving..." : (booking ? "Update" : "Create Booking")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>

      {/* Flight Lookup Modal for Edit */}
      <Dialog open={flightModalOpen} onOpenChange={setFlightModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-purple-700">
              <Plane className="w-5 h-5" />
              Flight Information Lookup
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Flight Number</Label>
              <div className="flex gap-2">
                <Input
                  value={flightSearchNumber}
                  onChange={(e) => setFlightSearchNumber(e.target.value.toUpperCase())}
                  placeholder="e.g. BA123, EZY456"
                  className="flex-1"
                  data-testid="edit-flight-number-input"
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleFlightLookup())}
                />
                <Button
                  type="button"
                  onClick={handleFlightLookup}
                  disabled={loadingFlight || !flightSearchNumber}
                  data-testid="edit-flight-search-btn"
                >
                  {loadingFlight ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Enter the flight number to auto-fill pickup location and time</p>
              {flightError && <p className="text-xs text-red-500">{flightError}</p>}
            </div>
            
            {/* Flight Results */}
            {flightData && (
              <div className="bg-purple-50 rounded-lg border border-purple-200 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                    <Plane className="w-4 h-4 text-purple-600" />
                  </div>
                  <div>
                    <div className="font-semibold">{flightData.airline}</div>
                    <div className="text-xs text-muted-foreground">{flightData.flight_number}</div>
                  </div>
                  <Badge className={cn(
                    "ml-auto",
                    flightData.flight_status === "landed" ? "bg-green-100 text-green-700 border-green-200" :
                    flightData.flight_status === "active" ? "bg-blue-100 text-blue-700 border-blue-200" :
                    "bg-gray-100 text-gray-700 border-gray-200"
                  )}>
                    {flightData.flight_status?.toUpperCase() || "SCHEDULED"}
                  </Badge>
                </div>
                
                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-purple-200">
                  <div>
                    <div className="text-xs text-muted-foreground">Arrival Airport</div>
                    <div className="text-sm font-medium">{flightData.arrival_airport || "N/A"}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Terminal</div>
                    <div className="text-sm font-medium">{flightData.arrival_terminal || "N/A"}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Scheduled Arrival</div>
                    <div className="text-sm font-medium">
                      {flightData.arrival_scheduled ? format(new Date(flightData.arrival_scheduled), "dd/MM HH:mm") : "N/A"}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Estimated Arrival</div>
                    <div className="text-sm font-medium text-purple-600">
                      {flightData.arrival_estimated ? format(new Date(flightData.arrival_estimated), "dd/MM HH:mm") : "N/A"}
                    </div>
                  </div>
                </div>
                
                <div className="bg-green-50 rounded-md p-3 mt-2 border border-green-200">
                  <div className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-green-600 mt-0.5" />
                    <div className="text-xs text-green-700">
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
              <div className="bg-slate-50 rounded-lg border p-3">
                <div className="text-xs text-muted-foreground mb-1">Currently Saved</div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="border-purple-300 text-purple-700">
                    {formData.flight_number}
                  </Badge>
                  {formData.airline && <span className="text-sm">{formData.airline}</span>}
                  {formData.terminal && <span className="text-xs text-muted-foreground">Terminal {formData.terminal}</span>}
                </div>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setFlightSearchNumber("");
                setFlightData(null);
                setFlightError(null);
                setFormData(prev => ({ ...prev, flight_number: "", airline: "", terminal: "", flight_type: "" }));
              }}
            >
              Clear Flight Info
            </Button>
            <Button
              type="button"
              onClick={() => {
                setFlightModalOpen(false);
                setFlightSearchNumber("");
                setFlightData(null);
                setFlightError(null);
              }}
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
};

const VEHICLE_TYPES = ["Sedan", "SUV", "MPV", "Executive", "Estate"];

const AssignDriverDialog = ({ booking, drivers, vehicleTypes, onAssign, onClose, onDriverAdded }) => {
  const [selectedDriver, setSelectedDriver] = useState("");
  const [showAddDriver, setShowAddDriver] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newDriver, setNewDriver] = useState({
    name: "",
    phone: "",
    vehicle_type: "Sedan",
    vehicle_number: "",
    status: "available",
  });

  // Get vehicle type for the booking to determine driver filtering
  const getBookingVehicleCategory = () => {
    if (!booking?.vehicle_type) return null;
    
    // Vehicle type might be an ID, look up the category directly
    if (vehicleTypes && vehicleTypes.length > 0) {
      const vt = vehicleTypes.find(v => v.id === booking.vehicle_type);
      if (vt && vt.category) {
        return vt.category; // 'taxi', 'psv', or 'both'
      }
    }
    
    // Fallback: determine from name if no category field
    let vehicleTypeName = booking.vehicle_type;
    if (vehicleTypes && vehicleTypes.length > 0) {
      const vt = vehicleTypes.find(v => v.id === booking.vehicle_type);
      if (vt) {
        vehicleTypeName = vt.name;
      }
    }
    
    const vType = vehicleTypeName.toLowerCase();
    
    // CJ's 16 Minibus or CJ's 16 with Trailer = PSV
    if (vType.includes('16')) return 'psv';
    
    // CJ's Taxi = Taxi
    // CJ's 8 Minibus = Taxi (8-seater falls under taxi license)
    if (vType.includes('taxi') || vType.includes('8 minibus') || vType.includes('8minibus')) return 'taxi';
    
    return null; // No specific requirement
  };

  // Get all active drivers - no license filtering, allow all drivers to be assigned
  const getFilteredDrivers = () => {
    // Get all active drivers (any status except explicitly inactive)
    return drivers.filter(d => d.status !== 'inactive');
  };

  const filteredDrivers = getFilteredDrivers();

  const handleAssign = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (selectedDriver && booking) {
      onAssign(booking.id, selectedDriver);
    }
  };

  const handleAddDriver = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const response = await axios.post(`${API}/drivers`, newDriver);
      toast.success("Driver added successfully!");
      setShowAddDriver(false);
      setNewDriver({
        name: "",
        phone: "",
        vehicle_type: "Sedan",
        vehicle_number: "",
        status: "available",
      });
      // Refresh drivers and auto-select the new driver
      if (onDriverAdded) {
        onDriverAdded();
      }
      setSelectedDriver(response.data.id);
    } catch (error) {
      toast.error("Failed to add driver");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!booking} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[450px] z-[100]" data-testid="assign-driver-modal">
        <DialogHeader>
          <DialogTitle>Assign Driver</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <p className="text-sm text-muted-foreground mb-4">
            Assign a driver to booking for {booking?.customer_name || `${booking?.first_name || ''} ${booking?.last_name || ''}`.trim()}
          </p>
          
          {!showAddDriver ? (
            <>
              <Select value={selectedDriver} onValueChange={setSelectedDriver}>
                <SelectTrigger data-testid="assign-driver-select">
                  <SelectValue placeholder="Select a driver" />
                </SelectTrigger>
                <SelectContent className="z-[110]">
                  {booking?.driver_id && (
                    <SelectItem value="unassign">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <UserX className="w-4 h-4" />
                        No Driver (Unassign)
                      </div>
                    </SelectItem>
                  )}
                  {filteredDrivers.length === 0 && !booking?.driver_id ? (
                    <div className="p-2 text-sm text-muted-foreground text-center">
                      No matching drivers available
                    </div>
                  ) : (
                    filteredDrivers.map((driver) => (
                      <SelectItem key={driver.id} value={driver.id}>
                        <div className="flex items-center gap-2">
                          <UserCheck className="w-4 h-4" />
                          {driver.name}
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              
              <button
                type="button"
                onClick={() => setShowAddDriver(true)}
                className="mt-4 text-sm text-primary hover:text-primary/80 hover:underline font-medium flex items-center gap-1"
                data-testid="add-new-driver-link"
              >
                <Plus className="w-4 h-4" />
                Add New Driver
              </button>
            </>
          ) : (
            <form onSubmit={handleAddDriver} className="space-y-4">
              <div className="bg-slate-50 rounded-lg p-4 space-y-3">
                <h4 className="text-sm font-semibold text-slate-700">New Driver Details</h4>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="driver-name" className="text-xs">Name</Label>
                    <Input
                      id="driver-name"
                      value={newDriver.name}
                      onChange={(e) => setNewDriver({ ...newDriver, name: e.target.value })}
                      placeholder="John Smith"
                      required
                      className="h-9"
                      data-testid="new-driver-name"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="driver-phone" className="text-xs">Phone</Label>
                    <Input
                      id="driver-phone"
                      value={newDriver.phone}
                      onChange={(e) => setNewDriver({ ...newDriver, phone: e.target.value })}
                      placeholder="+44 7700 900000"
                      required
                      className="h-9"
                      data-testid="new-driver-phone"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="vehicle-type" className="text-xs">Vehicle Type</Label>
                    <Select
                      value={newDriver.vehicle_type}
                      onValueChange={(value) => setNewDriver({ ...newDriver, vehicle_type: value })}
                    >
                      <SelectTrigger className="h-9" data-testid="new-driver-vehicle-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="z-[120]">
                        {VEHICLE_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>{type}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="vehicle-number" className="text-xs">Vehicle Reg</Label>
                    <Input
                      id="vehicle-number"
                      value={newDriver.vehicle_number}
                      onChange={(e) => setNewDriver({ ...newDriver, vehicle_number: e.target.value })}
                      placeholder="AB12 CDE"
                      required
                      className="h-9"
                      data-testid="new-driver-vehicle-number"
                    />
                  </div>
                </div>
              </div>
              
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAddDriver(false)}
                >
                  Back
                </Button>
                <Button type="submit" size="sm" disabled={saving} data-testid="save-new-driver-btn">
                  {saving ? "Adding..." : "Add Driver"}
                </Button>
              </div>
            </form>
          )}
        </div>
        
        {!showAddDriver && (
          <DialogFooter className="relative z-[100]">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              type="button"
              onClick={handleAssign}
              disabled={!selectedDriver}
              data-testid="confirm-assign-driver-btn"
            >
              Assign Driver
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
};

const BookingViewDialog = ({ booking, driver, vehicleTypes, onClose, onEdit, onAssignDriver, onRefresh }) => {
  const [sendingSms, setSendingSms] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [activeTab, setActiveTab] = useState("details");
  
  if (!booking) return null;

  const getVehicleTypeName = (vehicleTypeId) => {
    if (!vehicleTypeId) return "Not specified";
    const vt = vehicleTypes?.find(v => v.id === vehicleTypeId);
    return vt ? vt.name : vehicleTypeId;
  };

  const getActionIcon = (action) => {
    switch(action) {
      case 'created': return <Plus className="w-3 h-3 text-green-600" />;
      case 'updated': return <Edit className="w-3 h-3 text-blue-600" />;
      case 'driver_assigned': return <UserCheck className="w-3 h-3 text-purple-600" />;
      case 'driver_unassigned': return <UserX className="w-3 h-3 text-orange-600" />;
      case 'status_changed': return <Clock className="w-3 h-3 text-amber-600" />;
      default: return <History className="w-3 h-3 text-gray-600" />;
    }
  };

  const getActionLabel = (action) => {
    switch(action) {
      case 'created': return 'Booking Created';
      case 'updated': return 'Booking Updated';
      case 'driver_assigned': return 'Driver Assigned';
      case 'driver_unassigned': return 'Driver Unassigned';
      case 'status_changed': return 'Status Changed';
      default: return action?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Action';
    }
  };

  // Format field values for history display (translate IDs to names)
  const formatHistoryValue = (field, value) => {
    if (value === null || value === undefined || value === '') return '(empty)';
    
    // Handle vehicle_type field - translate ID to name
    if (field === 'vehicle_type') {
      const vt = vehicleTypes?.find(v => v.id === value);
      return vt ? vt.name : value;
    }
    
    // Handle status field - make it readable
    if (field === 'status') {
      return String(value).replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
    
    // Handle objects (like flight_info)
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    
    return String(value);
  };

  const handleResendSms = async () => {
    setSendingSms(true);
    try {
      await axios.post(`${API}/bookings/${booking.id}/resend-sms`);
      toast.success("SMS confirmation sent successfully!");
      if (onRefresh) onRefresh();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to send SMS");
    } finally {
      setSendingSms(false);
    }
  };

  const handleResendEmail = async () => {
    setSendingEmail(true);
    try {
      await axios.post(`${API}/bookings/${booking.id}/resend-email`);
      toast.success("Email confirmation sent successfully!");
      if (onRefresh) onRefresh();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to send email");
    } finally {
      setSendingEmail(false);
    }
  };
  
  return (
    <Dialog open={!!booking} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[550px]" data-testid="booking-view-modal">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-primary" />
              Booking Details
            </span>
            {booking.booking_id && (
              <span className="text-sm font-mono font-semibold text-primary bg-primary/10 px-2 py-1 rounded" data-testid="view-booking-id">
                {booking.booking_id}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="details" data-testid="details-tab">Details</TabsTrigger>
            <TabsTrigger value="history" data-testid="history-tab" className="flex items-center gap-1">
              <History className="w-3 h-3" />
              History
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="details" className="mt-4">
            <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2">
              {/* Created By Info */}
              {booking.created_by_name && (
                <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-green-600" />
                    <span className="text-xs text-green-700">Created by <strong>{booking.created_by_name}</strong></span>
                    {booking.created_at && (
                      <span className="text-xs text-green-600 ml-auto">
                        {format(new Date(booking.created_at), "dd/MM/yyyy HH:mm")}
                      </span>
                    )}
                  </div>
                </div>
              )}
              
              {/* Customer Info */}
              <div className="bg-slate-50 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-slate-600 mb-3">Customer Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Name</p>
                    <p className="font-medium">{booking.customer_name || `${booking.first_name || ''} ${booking.last_name || ''}`.trim()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Phone</p>
                    <p className="font-medium">{booking.customer_phone}</p>
                  </div>
                </div>
              </div>

          {/* Booking Details - PAX, Cases, Vehicle */}
          <div className="bg-amber-50 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-amber-700 mb-3">Booking Details</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Passengers (PAX)</p>
                <p className="font-medium text-lg">{booking.passenger_count || 1}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Cases (Luggage)</p>
                <p className="font-medium text-lg">{booking.luggage_count || 0}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Vehicle Type</p>
                <p className="font-medium">{getVehicleTypeName(booking.vehicle_type)}</p>
              </div>
            </div>
          </div>

          {/* Journey Info */}
          <div className="bg-blue-50 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-blue-700 mb-3">Journey Details</h3>
            <div className="space-y-3">
              <div className="flex items-start gap-2">
                <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-white text-xs font-bold">A</span>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Pickup</p>
                  <p className="text-sm font-medium">{booking.pickup_location}</p>
                </div>
              </div>
              
              {/* Additional Stops */}
              {booking.additional_stops && booking.additional_stops.length > 0 && (
                booking.additional_stops.map((stop, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <div className="w-6 h-6 rounded-full bg-amber-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-white text-xs font-bold">{index + 1}</span>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Stop {index + 1}</p>
                      <p className="text-sm font-medium">{stop}</p>
                    </div>
                  </div>
                ))
              )}
              
              <div className="flex items-start gap-2">
                <div className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-white text-xs font-bold">B</span>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Dropoff</p>
                  <p className="text-sm font-medium">{booking.dropoff_location}</p>
                </div>
              </div>
              {(booking.distance_miles || booking.duration_minutes) && (
                <div className="flex items-center gap-6 pt-2 border-t border-blue-200">
                  {booking.distance_miles && (
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                      </svg>
                      <span className="text-sm font-semibold text-blue-800">{booking.distance_miles} miles</span>
                    </div>
                  )}
                  {booking.duration_minutes && (
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-blue-600" />
                      <span className="text-sm font-semibold text-blue-800">
                        {booking.duration_minutes >= 60 
                          ? `${Math.floor(booking.duration_minutes / 60)}h ${booking.duration_minutes % 60}m`
                          : `${booking.duration_minutes} mins`}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
            {/* Route Map */}
            <div className="rounded-lg overflow-hidden border border-blue-200 mt-3">
              <img
                alt="Route Map"
                width="100%"
                height="150"
                style={{ width: '100%', height: '150px', objectFit: 'cover' }}
                src={`https://maps.googleapis.com/maps/api/staticmap?size=600x150&maptype=roadmap&markers=color:green%7Clabel:A%7C${encodeURIComponent(booking.pickup_location)}&markers=color:red%7Clabel:B%7C${encodeURIComponent(booking.dropoff_location)}&path=color:0x0066ff%7Cweight:4%7C${encodeURIComponent(booking.pickup_location)}%7C${encodeURIComponent(booking.dropoff_location)}&key=AIzaSyBSL4bF8eGeiABUOK0GM8UoWBzqtUVfMIs`}
              />
            </div>
          </div>

          {/* Flight Information */}
          {booking.flight_info && (booking.flight_info.flight_number || booking.flight_info.airline) && (
            <div className="bg-purple-50 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-purple-700 mb-3 flex items-center gap-2">
                <Plane className="w-4 h-4" />
                Flight Information
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {booking.flight_info.flight_number && (
                  <div>
                    <p className="text-xs text-muted-foreground">Flight Number</p>
                    <p className="font-medium">{booking.flight_info.flight_number}</p>
                  </div>
                )}
                {booking.flight_info.airline && (
                  <div>
                    <p className="text-xs text-muted-foreground">Airline</p>
                    <p className="font-medium">{booking.flight_info.airline}</p>
                  </div>
                )}
                {booking.flight_info.flight_type && (
                  <div>
                    <p className="text-xs text-muted-foreground">Type</p>
                    <p className="font-medium capitalize">{booking.flight_info.flight_type}</p>
                  </div>
                )}
                {booking.flight_info.terminal && (
                  <div>
                    <p className="text-xs text-muted-foreground">Terminal</p>
                    <p className="font-medium">{booking.flight_info.terminal}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Linked Booking (Return Journey) */}
          {(booking.linked_booking_id || booking.is_return) && (
            <div className="bg-amber-50 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-amber-700 mb-2 flex items-center gap-2">
                <ArrowLeftRight className="w-4 h-4" />
                {booking.is_return ? "Return Journey" : "Linked Return Journey"}
              </h3>
              <p className="text-xs text-amber-600">
                {booking.is_return 
                  ? "This is a return journey. The original booking is linked."
                  : "A return booking has been created for this journey."}
              </p>
              {booking.linked_booking_id && (
                <p className="text-xs text-amber-700 mt-1">
                  Linked Booking ID: <span className="font-mono font-semibold">{booking.linked_booking_id}</span>
                </p>
              )}
            </div>
          )}

          {/* Booking Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-50 rounded-lg p-4">
              <p className="text-xs text-muted-foreground">Date & Time</p>
              <p className="font-medium flex items-center gap-2 mt-1">
                <Clock className="w-4 h-4 text-muted-foreground" />
                {format(new Date(booking.booking_datetime), "PPP 'at' p")}
              </p>
            </div>
            <div className="bg-slate-50 rounded-lg p-4">
              <p className="text-xs text-muted-foreground">Fare</p>
              <p className="font-semibold text-lg text-green-600 mt-1">
                {booking.fare ? `£${booking.fare.toFixed(2)}` : 'Not set'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-50 rounded-lg p-4">
              <p className="text-xs text-muted-foreground">Status</p>
              <div className="mt-1">
                {getStatusBadge(booking.status)}
              </div>
            </div>
            <div className="bg-slate-50 rounded-lg p-4">
              <p className="text-xs text-muted-foreground">Assigned Driver</p>
              {driver ? (
                <>
                  <p className="font-medium flex items-center gap-2 mt-1">
                    <UserCheck className="w-4 h-4 text-muted-foreground" />
                    {driver.name}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {driver.vehicle_type} • {driver.vehicle_number}
                  </p>
                </>
              ) : (
                <button
                  onClick={onAssignDriver}
                  className="mt-1 text-sm text-primary hover:text-primary/80 hover:underline font-medium flex items-center gap-1"
                  data-testid="view-assign-driver-link"
                >
                  <Plus className="w-4 h-4" />
                  Assign Driver
                </button>
              )}
            </div>
          </div>

          {booking.notes && (
            <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
              <p className="text-xs text-amber-700 font-medium">Notes</p>
              <p className="text-sm mt-1">{booking.notes}</p>
            </div>
          )}

          {/* SMS Status */}
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              {booking.sms_sent ? (
                <>
                  <MessageSquare className="w-4 h-4 text-green-600" />
                  <span className="text-green-600">SMS confirmation sent</span>
                </>
              ) : (
                <>
                  <MessageSquareX className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground">SMS not sent</span>
                </>
              )}
            </div>
            <button
              onClick={handleResendSms}
              disabled={sendingSms}
              className="text-primary hover:text-primary/80 hover:underline font-medium flex items-center gap-1 disabled:opacity-50"
              data-testid="resend-sms-link"
            >
              {sendingSms ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <MessageSquare className="w-3 h-3" />
                  {booking.sms_sent ? "Resend SMS" : "Send SMS"}
                </>
              )}
            </button>
          </div>

          {/* Email Status */}
          <div className="flex items-center justify-between text-sm bg-slate-50 rounded-lg p-3">
            <div className="flex items-center gap-2">
              {booking.email_sent ? (
                <>
                  <Mail className="w-4 h-4 text-green-600" />
                  <span className="text-green-600">Email confirmation sent</span>
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    {booking.customer_email ? "Email not sent" : "No email on file"}
                  </span>
                </>
              )}
            </div>
            {booking.customer_email && (
              <button
                onClick={handleResendEmail}
                disabled={sendingEmail}
                className="text-primary hover:text-primary/80 hover:underline font-medium flex items-center gap-1 disabled:opacity-50"
                data-testid="resend-email-link"
              >
                {sendingEmail ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail className="w-3 h-3" />
                    {booking.email_sent ? "Resend Email" : "Send Email"}
                  </>
                )}
              </button>
            )}
          </div>
            </div>
          </TabsContent>
          
          <TabsContent value="history" className="mt-4">
            <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-2" data-testid="booking-history-tab">
              {booking.history && booking.history.length > 0 ? (
                <div className="relative">
                  {/* Timeline line */}
                  <div className="absolute left-3 top-2 bottom-2 w-px bg-slate-200" />
                  
                  <div className="space-y-4">
                    {[...booking.history].reverse().map((entry, index) => (
                      <div key={index} className="relative flex gap-3 pl-7">
                        {/* Timeline dot */}
                        <div className="absolute left-0 w-6 h-6 rounded-full bg-white border-2 border-slate-200 flex items-center justify-center">
                          {getActionIcon(entry.action)}
                        </div>
                        
                        <div className="flex-1 bg-slate-50 rounded-lg p-3 border border-slate-100">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-semibold text-sm text-slate-800">
                              {getActionLabel(entry.action)}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {entry.timestamp && format(new Date(entry.timestamp), "dd/MM/yyyy HH:mm")}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                            <User className="w-3 h-3" />
                            <span>by <strong>{entry.user_name || 'System'}</strong></span>
                            {entry.user_type && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                {entry.user_type}
                              </Badge>
                            )}
                          </div>
                          
                          {entry.details && (
                            <p className="text-xs text-slate-600">{entry.details}</p>
                          )}
                          
                          {entry.changes && Object.keys(entry.changes).length > 0 && (
                            <div className="mt-2 pt-2 border-t border-slate-200">
                              <p className="text-xs font-medium text-slate-500 mb-1">Changes:</p>
                              <div className="space-y-1">
                                {Object.entries(entry.changes).map(([field, change]) => (
                                  <div key={field} className="text-xs">
                                    <span className="font-medium text-slate-700">{field.replace(/_/g, ' ')}:</span>
                                    <span className="text-red-500 line-through ml-1">
                                      {formatHistoryValue(field, change.old)}
                                    </span>
                                    <span className="text-slate-400 mx-1">→</span>
                                    <span className="text-green-600">
                                      {formatHistoryValue(field, change.new)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <History className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No history available for this booking</p>
                  <p className="text-xs mt-1">History tracking starts from when this feature was enabled</p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
        
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button type="button" onClick={onEdit} data-testid="edit-from-view-btn">
            <Edit className="w-4 h-4 mr-2" />
            Edit Booking
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const BookingsPage = () => {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [clients, setClients] = useState([]);
  const [vehicleTypes, setVehicleTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [deleteBooking, setDeleteBooking] = useState(null);
  const [assignBooking, setAssignBooking] = useState(null);
  const [viewBooking, setViewBooking] = useState(null);
  
  // Search and filter states
  const [searchText, setSearchText] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState(null);
  const [filterDateTo, setFilterDateTo] = useState(null);
  const [filterDriver, setFilterDriver] = useState("all");
  const [showFilters, setShowFilters] = useState(false);
  const [dateFilterOpen, setDateFilterOpen] = useState(false);

  const fetchData = async () => {
    try {
      const [bookingsRes, driversRes, clientsRes, vehicleTypesRes] = await Promise.all([
        axios.get(`${API}/bookings`),
        axios.get(`${API}/drivers`),
        axios.get(`${API}/clients`),
        axios.get(`${API}/vehicle-types`).catch(() => ({ data: [] })),
      ]);
      // Filter out contract work bookings (those linked to clients)
      const regularBookings = bookingsRes.data.filter(b => !b.client_id);
      setBookings(regularBookings);
      setDrivers(driversRes.data);
      setClients(clientsRes.data);
      setVehicleTypes(vehicleTypesRes.data || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const getDriverName = (driverId) => {
    const driver = drivers.find(d => d.id === driverId);
    return driver ? driver.name : "Unassigned";
  };

  const getVehicleTypeName = (vehicleTypeId) => {
    const vt = vehicleTypes.find(v => v.id === vehicleTypeId);
    return vt ? vt.name : vehicleTypeId || "Not specified";
  };

  const getVehicleTypeColor = (vehicleTypeId) => {
    if (!vehicleTypeId) return "bg-yellow-500 text-white border-yellow-600"; // Not specified
    const vt = vehicleTypes.find(v => v.id === vehicleTypeId);
    if (!vt) return "bg-yellow-500 text-white border-yellow-600";
    
    const name = vt.name.toLowerCase();
    if (name.includes("taxi")) return "bg-blue-500 text-white border-blue-600";
    if (name.includes("8") && name.includes("minibus")) return "bg-green-500 text-white border-green-600";
    if (name.includes("16") && name.includes("trailer")) return "bg-red-500 text-white border-red-600";
    if (name.includes("16") && name.includes("minibus")) return "bg-pink-500 text-white border-pink-600";
    return "bg-slate-500 text-white border-slate-600"; // Default
  };

  const formatDuration = (minutes) => {
    if (!minutes) return null;
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    }
    return `${minutes} mins`;
  };

  const handleSave = async (formData) => {
    try {
      if (selectedBooking) {
        await axios.put(`${API}/bookings/${selectedBooking.id}`, formData);
        toast.success("Booking updated successfully");
      } else {
        await axios.post(`${API}/bookings`, formData);
        toast.success("Booking created! SMS confirmation will be sent to customer.");
      }
      fetchData();
      setShowForm(false);
      setSelectedBooking(null);
    } catch (error) {
      toast.error("Failed to save booking");
      throw error;
    }
  };

  const handleDelete = async () => {
    try {
      await axios.delete(`${API}/bookings/${deleteBooking.id}`);
      toast.success("Booking deleted successfully");
      fetchData();
      setDeleteBooking(null);
    } catch (error) {
      toast.error("Failed to delete booking");
    }
  };

  const handleAssignDriver = async (bookingId, driverId) => {
    try {
      // Handle unassign case
      if (driverId === "unassign") {
        await axios.post(`${API}/bookings/${bookingId}/unassign`);
        toast.success("Driver unassigned successfully");
      } else {
        await axios.post(`${API}/bookings/${bookingId}/assign/${driverId}`);
        toast.success("Driver assigned successfully");
      }
      fetchData();
      setAssignBooking(null);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to update driver assignment");
    }
  };

  const handleEdit = (booking) => {
    setSelectedBooking(booking);
    setShowForm(true);
  };

  const handleAdd = () => {
    setSelectedBooking(null);
    setShowForm(true);
  };

  // Get today's date string for comparisons
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const todayStart = startOfDay(new Date());

  // Check if user is actively searching/filtering (to show past bookings)
  const hasDateFilter = filterDateFrom || filterDateTo;
  const isSearchingPast = searchText || hasDateFilter || (filterDriver && filterDriver !== "all");

  // Filter bookings based on search criteria
  const filteredBookings = bookings.filter(booking => {
    const bookingDate = new Date(booking.booking_datetime);
    const bookingDateStr = format(bookingDate, "yyyy-MM-dd");
    const bookingDateStart = startOfDay(bookingDate);
    
    // Date range filter
    if (hasDateFilter) {
      if (filterDateFrom && filterDateTo) {
        // Both dates set - filter within range
        if (!isWithinInterval(bookingDateStart, { 
          start: startOfDay(filterDateFrom), 
          end: startOfDay(filterDateTo) 
        })) {
          return false;
        }
      } else if (filterDateFrom) {
        // Only from date - show from that date onwards
        if (isBefore(bookingDateStart, startOfDay(filterDateFrom))) {
          return false;
        }
      } else if (filterDateTo) {
        // Only to date - show up to that date
        if (isBefore(startOfDay(filterDateTo), bookingDateStart)) {
          return false;
        }
      }
    } else if (!searchText && (!filterDriver || filterDriver === "all")) {
      // Default view (no filters) - show only 14 days from today
      const fourteenDaysLater = addDays(todayStart, 13);
      if (isBefore(bookingDateStart, todayStart) || isBefore(fourteenDaysLater, bookingDateStart)) {
        return false;
      }
    }
    
    // Text search (customer name, phone, booking ID)
    if (searchText) {
      const search = searchText.toLowerCase();
      const fullName = booking.customer_name || `${booking.first_name || ''} ${booking.last_name || ''}`.trim();
      const matchesName = fullName.toLowerCase().includes(search);
      const matchesPhone = booking.customer_phone?.toLowerCase().includes(search);
      const matchesBookingId = booking.booking_id?.toLowerCase().includes(search);
      const matchesPickup = booking.pickup_location?.toLowerCase().includes(search);
      const matchesDropoff = booking.dropoff_location?.toLowerCase().includes(search);
      
      if (!matchesName && !matchesPhone && !matchesBookingId && !matchesPickup && !matchesDropoff) {
        return false;
      }
    }
    
    // Driver filter
    if (filterDriver && filterDriver !== "all") {
      if (filterDriver === "unassigned") {
        if (booking.driver_id) return false;
      } else {
        if (booking.driver_id !== filterDriver) return false;
      }
    }
    
    return true;
  });

  // Group bookings by date
  const groupedBookings = filteredBookings.reduce((groups, booking) => {
    const date = format(new Date(booking.booking_datetime), "yyyy-MM-dd");
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(booking);
    return groups;
  }, {});

  // Generate all dates for the view
  if (!isSearchingPast) {
    // Default view: show 14 days from today (including today)
    for (let i = 0; i < 14; i++) {
      const dateStr = format(addDays(todayStart, i), "yyyy-MM-dd");
      if (!groupedBookings[dateStr]) {
        groupedBookings[dateStr] = [];
      }
    }
  } else if (hasDateFilter && filterDateFrom && filterDateTo) {
    // Date range: show all days in range
    let currentDate = startOfDay(filterDateFrom);
    const endDate = startOfDay(filterDateTo);
    while (!isBefore(endDate, currentDate)) {
      const dateStr = format(currentDate, "yyyy-MM-dd");
      if (!groupedBookings[dateStr]) {
        groupedBookings[dateStr] = [];
      }
      currentDate = addDays(currentDate, 1);
    }
  }

  // Sort dates and bookings within each date by time
  const sortedDates = Object.keys(groupedBookings).sort((a, b) => new Date(a) - new Date(b));
  sortedDates.forEach(date => {
    groupedBookings[date].sort((a, b) => new Date(a.booking_datetime) - new Date(b.booking_datetime));
  });

  // Helper to find the linked return booking for display
  const getLinkedReturnBooking = (booking) => {
    if (!booking.linked_booking_id || booking.is_return) return null;
    return bookings.find(b => b.id === booking.linked_booking_id && b.is_return);
  };

  // Clear all filters
  const clearFilters = () => {
    setSearchText("");
    setFilterDateFrom(null);
    setFilterDateTo(null);
    setFilterDriver("all");
  };

  // Quick date filter presets
  const setTodayFilter = () => {
    setFilterDateFrom(todayStart);
    setFilterDateTo(todayStart);
    setDateFilterOpen(false);
  };

  const setThisWeekFilter = () => {
    setFilterDateFrom(todayStart);
    setFilterDateTo(addDays(todayStart, 6));
    setDateFilterOpen(false);
  };

  const setThisMonthFilter = () => {
    setFilterDateFrom(startOfMonth(todayStart));
    setFilterDateTo(endOfMonth(todayStart));
    setDateFilterOpen(false);
  };

  const setLastMonthFilter = () => {
    const lastMonthStart = startOfMonth(addDays(startOfMonth(todayStart), -1));
    const lastMonthEnd = endOfMonth(lastMonthStart);
    setFilterDateFrom(lastMonthStart);
    setFilterDateTo(lastMonthEnd);
    setDateFilterOpen(false);
  };

  const hasActiveFilters = searchText || hasDateFilter || (filterDriver && filterDriver !== "all");

  // Format date range display text
  const getDateFilterText = () => {
    if (filterDateFrom && filterDateTo) {
      if (format(filterDateFrom, "yyyy-MM-dd") === format(filterDateTo, "yyyy-MM-dd")) {
        return format(filterDateFrom, "dd/MM/yyyy");
      }
      return `${format(filterDateFrom, "dd/MM")} - ${format(filterDateTo, "dd/MM/yyyy")}`;
    }
    if (filterDateFrom) return `From ${format(filterDateFrom, "dd/MM/yyyy")}`;
    if (filterDateTo) return `Until ${format(filterDateTo, "dd/MM/yyyy")}`;
    return "Filter by date";
  };

  // Get status color for the card border
  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'border-l-green-500 bg-green-50/30';
      case 'in_progress': return 'border-l-purple-500 bg-purple-50/30';
      case 'assigned': return 'border-l-blue-500 bg-blue-50/30';
      case 'cancelled': return 'border-l-red-500 bg-red-50/30';
      default: return 'border-l-yellow-500 bg-yellow-50/30';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div data-testid="bookings-page">
      <header className="page-header flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Bookings</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage customer bookings</p>
        </div>
        <Button onClick={() => navigate('/bookings/new')} className="btn-animate" data-testid="add-booking-btn">
          <Plus className="w-4 h-4 mr-2" />
          New Booking
        </Button>
      </header>

      {/* Search and Filter Bar */}
      <div className="mb-6 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search by name, phone, booking ID, or address..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="pl-10 bg-white"
              data-testid="search-input"
            />
          </div>
          
          {/* Date Filter */}
          <Popover>
            <PopoverTrigger asChild>
              <Button 
                variant="outline" 
                className={cn(
                  "w-[200px] justify-start text-left font-normal bg-white", 
                  !hasDateFilter && "text-muted-foreground"
                )}
                data-testid="date-filter-btn"
              >
                <Calendar className="mr-2 h-4 w-4" />
                {getDateFilterText()}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 z-50" align="start">
              {/* Quick Filter Presets */}
              <div className="p-2 border-b grid grid-cols-2 gap-1">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="justify-start text-xs h-8"
                  onClick={setTodayFilter}
                  data-testid="filter-today"
                >
                  Today
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="justify-start text-xs h-8"
                  onClick={setThisWeekFilter}
                  data-testid="filter-this-week"
                >
                  This Week
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="justify-start text-xs h-8"
                  onClick={setThisMonthFilter}
                  data-testid="filter-this-month"
                >
                  This Month
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="justify-start text-xs h-8"
                  onClick={setLastMonthFilter}
                  data-testid="filter-last-month"
                >
                  Last Month
                </Button>
              </div>
              
              {/* Date Range Labels */}
              <div className="p-2 border-b">
                <div className="flex gap-2 text-xs">
                  <div className="flex-1">
                    <span className="text-muted-foreground">From:</span>
                    <span className="ml-1 font-medium">
                      {filterDateFrom ? format(filterDateFrom, "dd/MM/yyyy") : "Select"}
                    </span>
                  </div>
                  <div className="flex-1">
                    <span className="text-muted-foreground">To:</span>
                    <span className="ml-1 font-medium">
                      {filterDateTo ? format(filterDateTo, "dd/MM/yyyy") : "Select"}
                    </span>
                  </div>
                  {hasDateFilter && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-5 px-1 text-xs text-muted-foreground"
                      onClick={() => {
                        setFilterDateFrom(null);
                        setFilterDateTo(null);
                      }}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              </div>
              
              {/* Calendar for Range Selection */}
              <div className="p-2">
                <CalendarComponent
                  mode="range"
                  selected={{ from: filterDateFrom, to: filterDateTo }}
                  onSelect={(range) => {
                    setFilterDateFrom(range?.from || null);
                    setFilterDateTo(range?.to || null);
                  }}
                  numberOfMonths={1}
                  initialFocus
                />
              </div>
            </PopoverContent>
          </Popover>
          
          {/* Driver Filter */}
          <Select value={filterDriver} onValueChange={setFilterDriver}>
            <SelectTrigger className="w-[180px] bg-white" data-testid="filter-driver-select">
              <SelectValue placeholder="Filter by driver" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Drivers</SelectItem>
              <SelectItem value="unassigned">Unassigned</SelectItem>
              {drivers.map((driver) => (
                <SelectItem key={driver.id} value={driver.id}>
                  {driver.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          {/* Clear Filters Button */}
          {hasActiveFilters && (
            <Button variant="ghost" onClick={clearFilters} className="text-muted-foreground" data-testid="clear-filters-btn">
              <X className="w-4 h-4 mr-1" />
              Clear
            </Button>
          )}
        </div>
        
        {/* Filter Summary */}
        {hasActiveFilters ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Showing {filteredBookings.length} of {bookings.length} bookings</span>
            {hasDateFilter && (
              <Badge variant="secondary" className="gap-1">
                {getDateFilterText()}
                <button onClick={() => { setFilterDateFrom(null); setFilterDateTo(null); }} className="ml-1 hover:text-foreground">
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            )}
            {filterDriver && filterDriver !== "all" && (
              <Badge variant="secondary" className="gap-1">
                {filterDriver === "unassigned" ? "Unassigned" : getDriverName(filterDriver)}
                <button onClick={() => setFilterDriver("all")} className="ml-1 hover:text-foreground">
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <History className="w-3 h-3" />
            <span>Showing next 14 days • Use date filter for past bookings</span>
          </div>
        )}
      </div>

      <div className="page-content">
        {bookings.length === 0 ? (
          <div className="text-center py-16">
            <MapPin className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No bookings yet</h3>
            <p className="text-muted-foreground mb-4">Create your first booking to get started</p>
            <Button onClick={() => navigate('/bookings/new')} data-testid="add-first-booking-btn">
              <Plus className="w-4 h-4 mr-2" />
              New Booking
            </Button>
          </div>
        ) : filteredBookings.length === 0 ? (
          <div className="text-center py-16">
            <Search className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No bookings found</h3>
            <p className="text-muted-foreground mb-4">Try adjusting your search or filters</p>
            <Button variant="outline" onClick={clearFilters} data-testid="clear-search-btn">
              <X className="w-4 h-4 mr-2" />
              Clear Filters
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {sortedDates.map((date) => {
              const dateBookings = groupedBookings[date];
              const isDateToday = date === todayStr;
              const dayName = format(new Date(date), "EEEE");
              
              return (
              <div key={date} className="space-y-2">
                {/* Date Header */}
                <div className={`sticky top-0 z-10 rounded-lg px-4 py-2 shadow-sm ${isDateToday ? 'bg-primary/10' : 'bg-slate-100'}`}>
                  <h2 className={`text-sm font-bold uppercase tracking-wide ${isDateToday ? 'text-primary' : 'text-slate-700'}`}>
                    {isDateToday ? 'Today - ' : ''}{format(new Date(date), "EEEE dd/MM/yyyy")}
                  </h2>
                </div>
                
                {/* No bookings message for empty days */}
                {dateBookings.length === 0 ? (
                  <div className="bg-white rounded-lg border border-dashed border-slate-300 p-6 text-center">
                    <Calendar className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                    <p className="text-slate-500 font-medium">No bookings for {dayName}</p>
                    <Button 
                      variant="link" 
                      className="mt-2 text-primary"
                      onClick={() => navigate('/bookings/new')}
                      data-testid="add-booking-empty-day"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Add a booking
                    </Button>
                  </div>
                ) : (
                  /* Bookings for this date */
                  <div className="space-y-1.5">
                  {dateBookings.map((booking) => {
                    // Skip return bookings as they'll be shown under their parent
                    if (booking.is_return) {
                      // Check if parent is in the same date group - if so, skip (shown with parent)
                      const parentBooking = bookings.find(b => b.id === booking.linked_booking_id);
                      if (parentBooking) {
                        const parentDate = format(new Date(parentBooking.booking_datetime), "yyyy-MM-dd");
                        if (parentDate === date || groupedBookings[parentDate]?.some(b => b.id === parentBooking.id)) {
                          return null; // Will be shown with parent
                        }
                      }
                    }
                    
                    const linkedReturn = getLinkedReturnBooking(booking);
                    const hasReturnJourney = linkedReturn !== null;
                    
                    return (
                      <div key={booking.id} className="space-y-0">
                        {/* Main Booking Card */}
                        <div
                          className={`bg-white rounded-lg ${hasReturnJourney ? 'rounded-b-none' : ''} border-l-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer ${getStatusColor(booking.status)}`}
                          data-testid={`booking-row-${booking.id}`}
                          onClick={() => setViewBooking(booking)}
                        >
                          {/* Outbound Label for linked journeys */}
                          {hasReturnJourney && (
                            <div className="px-3 pt-2 pb-0">
                              <span className="text-xs font-semibold text-blue-600 bg-blue-100 px-2 py-0.5 rounded">
                                OUTBOUND
                              </span>
                            </div>
                          )}
                          <div className="p-3">
                            <div className="grid grid-cols-12 gap-3 items-center">
                              {/* Time & Booking ID */}
                              <div className="col-span-2 lg:col-span-1">
                                <p className="text-lg font-bold text-slate-800">
                                  {format(new Date(booking.booking_datetime), "HH:mm")}
                                </p>
                                <p className="text-xs font-mono text-primary font-semibold" data-testid={`booking-id-${booking.id}`}>
                                  {booking.booking_id || '-'}
                                </p>
                                {/* Flight Badge */}
                                {booking.flight_info?.flight_number && (
                                  <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 bg-purple-600 text-white text-xs font-bold rounded">
                                    <Plane className="w-3 h-3" />
                                    {booking.flight_info.flight_number}
                                  </span>
                                )}
                              </div>

                              {/* Pickup & Dropoff */}
                              <div className="col-span-4 lg:col-span-4">
                                <div className="flex items-start gap-2">
                                  <div className="flex flex-col items-center">
                                    <div className="w-3 h-3 rounded-full bg-green-500 border-2 border-white shadow"></div>
                                    <div className="w-0.5 h-8 bg-slate-300"></div>
                                    <div className="w-3 h-3 rounded-full bg-red-500 border-2 border-white shadow"></div>
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-slate-800 truncate">{booking.pickup_location}</p>
                                    <div className="h-4"></div>
                                    <p className="text-sm text-slate-600 truncate">{booking.dropoff_location}</p>
                                  </div>
                                </div>
                              </div>

                              {/* Customer */}
                              <div className="col-span-2 lg:col-span-2">
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                    <User className="w-4 h-4 text-primary" />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-sm font-medium text-slate-800 truncate">{booking.customer_name || `${booking.first_name || ''} ${booking.last_name || ''}`.trim()}</p>
                                    <p className="text-xs text-muted-foreground truncate">{booking.customer_phone}</p>
                                  </div>
                                </div>
                              </div>

                              {/* Driver */}
                              <div className="col-span-2 lg:col-span-2" onClick={(e) => e.stopPropagation()}>
                                {booking.driver_id ? (
                                  <button
                                    onClick={() => setAssignBooking(booking)}
                                    className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                                    data-testid={`change-driver-${booking.id}`}
                                  >
                                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                                      <UserCheck className="w-4 h-4 text-blue-600" />
                                    </div>
                                    <span className="text-sm font-medium text-primary hover:underline truncate">{getDriverName(booking.driver_id)}</span>
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => setAssignBooking(booking)}
                                    className="text-sm text-primary hover:text-primary/80 hover:underline font-medium flex items-center gap-1"
                                    data-testid={`quick-assign-${booking.id}`}
                                  >
                                    <Plus className="w-4 h-4" />
                                    Assign Driver
                                  </button>
                                )}
                              </div>

                              {/* Status & Actions */}
                              <div className="col-span-2 lg:col-span-3 flex items-center justify-end gap-3">
                                {/* Journey Info (Miles & Duration) */}
                                {(booking.distance_miles || booking.duration_minutes) && (
                                  <div className="hidden lg:flex items-center gap-3 text-xs text-slate-500 mr-2">
                                    {booking.distance_miles && (
                                      <span className="flex items-center gap-1">
                                        <MapPin className="w-3 h-3 text-blue-500" />
                                        {booking.distance_miles} mi
                                      </span>
                                    )}
                                    {booking.duration_minutes && (
                                      <span className="flex items-center gap-1">
                                        <Clock className="w-3 h-3 text-amber-500" />
                                        {formatDuration(booking.duration_minutes)}
                                      </span>
                                    )}
                                  </div>
                                )}
                                {getStatusBadge(booking.status)}
                                <div onClick={(e) => e.stopPropagation()}>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="icon" className="h-8 w-8" data-testid={`booking-actions-${booking.id}`}>
                                        <MoreHorizontal className="w-4 h-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuItem onClick={() => setViewBooking(booking)} data-testid={`view-booking-${booking.id}`}>
                                        <MapPin className="w-4 h-4 mr-2" />
                                        View
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => handleEdit(booking)} data-testid={`edit-booking-${booking.id}`}>
                                        <Edit className="w-4 h-4 mr-2" />
                                        Edit
                                      </DropdownMenuItem>
                                  {booking.status === 'pending' && (
                                    <DropdownMenuItem onClick={() => setAssignBooking(booking)} data-testid={`assign-booking-${booking.id}`}>
                                      <UserCheck className="w-4 h-4 mr-2" />
                                      Assign Driver
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem 
                                    onClick={() => setDeleteBooking(booking)}
                                    className="text-destructive focus:text-destructive"
                                    data-testid={`delete-booking-${booking.id}`}
                                  >
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                        </div>
                      </div>
                      {/* Vehicle Type Footer Bar */}
                      <div className={`px-3 py-1.5 ${linkedReturn ? '' : 'rounded-b-lg'} ${getVehicleTypeColor(booking.vehicle_type)}`}>
                        <div className="flex items-center justify-center gap-2">
                          <Car className="w-4 h-4" />
                          <span className="text-sm font-semibold">
                            {booking.vehicle_type ? getVehicleTypeName(booking.vehicle_type) : 'Vehicle Not Specified'}
                          </span>
                        </div>
                      </div>
                    </div>
                        
                        {/* Return Journey Card - Shown directly under parent */}
                        {linkedReturn && (
                          <div
                            className={`bg-amber-50 rounded-lg rounded-t-none border-l-4 border-t border-amber-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer ${getStatusColor(linkedReturn.status)}`}
                            data-testid={`booking-row-${linkedReturn.id}`}
                            onClick={() => setViewBooking(linkedReturn)}
                          >
                            <div className="px-3 pt-2 pb-0">
                              <span className="text-xs font-semibold text-amber-700 bg-amber-200 px-2 py-0.5 rounded">
                                RETURN
                              </span>
                            </div>
                            <div className="p-3">
                              <div className="grid grid-cols-12 gap-3 items-center">
                                {/* Time & Booking ID */}
                                <div className="col-span-2 lg:col-span-1">
                                  <p className="text-lg font-bold text-slate-800">
                                    {format(new Date(linkedReturn.booking_datetime), "HH:mm")}
                                  </p>
                                  <p className="text-xs font-mono text-amber-700 font-semibold" data-testid={`booking-id-${linkedReturn.id}`}>
                                    {linkedReturn.booking_id || '-'}
                                  </p>
                                  {/* Flight Badge for Return */}
                                  {linkedReturn.flight_info?.flight_number && (
                                    <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 bg-purple-600 text-white text-xs font-bold rounded">
                                      <Plane className="w-3 h-3" />
                                      {linkedReturn.flight_info.flight_number}
                                    </span>
                                  )}
                                </div>

                                {/* Pickup & Dropoff (swapped) */}
                                <div className="col-span-4 lg:col-span-4">
                                  <div className="flex items-start gap-2">
                                    <div className="flex flex-col items-center">
                                      <div className="w-3 h-3 rounded-full bg-amber-500 border-2 border-white shadow"></div>
                                      <div className="w-0.5 h-8 bg-amber-300"></div>
                                      <div className="w-3 h-3 rounded-full bg-green-500 border-2 border-white shadow"></div>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium text-slate-800 truncate">{linkedReturn.pickup_location}</p>
                                      <div className="h-4"></div>
                                      <p className="text-sm text-slate-600 truncate">{linkedReturn.dropoff_location}</p>
                                    </div>
                                  </div>
                                </div>

                                {/* Same Customer */}
                                <div className="col-span-2 lg:col-span-2">
                                  <div className="flex items-center gap-2 opacity-60">
                                    <ArrowLeftRight className="w-4 h-4 text-amber-600" />
                                    <span className="text-sm text-slate-600">Same passenger</span>
                                  </div>
                                </div>

                                {/* Driver */}
                                <div className="col-span-2 lg:col-span-2" onClick={(e) => e.stopPropagation()}>
                                  {linkedReturn.driver_id ? (
                                    <button
                                      onClick={() => setAssignBooking(linkedReturn)}
                                      className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                                      data-testid={`change-driver-return-${linkedReturn.id}`}
                                    >
                                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                                        <UserCheck className="w-4 h-4 text-blue-600" />
                                      </div>
                                      <span className="text-sm font-medium text-primary hover:underline truncate">{getDriverName(linkedReturn.driver_id)}</span>
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => setAssignBooking(linkedReturn)}
                                      className="text-sm text-amber-600 hover:text-amber-700 hover:underline font-medium flex items-center gap-1"
                                      data-testid={`quick-assign-${linkedReturn.id}`}
                                    >
                                      <Plus className="w-4 h-4" />
                                      Assign Driver
                                    </button>
                                  )}
                                </div>

                                {/* Status & Actions */}
                                <div className="col-span-2 lg:col-span-3 flex items-center justify-end gap-3">
                                  {/* Journey Info (Miles & Duration) for Return */}
                                  {(linkedReturn.distance_miles || linkedReturn.duration_minutes) && (
                                    <div className="hidden lg:flex items-center gap-3 text-xs text-slate-500 mr-2">
                                      {linkedReturn.distance_miles && (
                                        <span className="flex items-center gap-1">
                                          <MapPin className="w-3 h-3 text-blue-500" />
                                          {linkedReturn.distance_miles} mi
                                        </span>
                                      )}
                                      {linkedReturn.duration_minutes && (
                                        <span className="flex items-center gap-1">
                                          <Clock className="w-3 h-3 text-amber-500" />
                                          {formatDuration(linkedReturn.duration_minutes)}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                  {linkedReturn.fare && (
                                    <span className="text-sm font-semibold text-green-600">
                                      £{linkedReturn.fare.toFixed(2)}
                                    </span>
                                  )}
                                  {getStatusBadge(linkedReturn.status)}
                                  <div onClick={(e) => e.stopPropagation()}>
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8" data-testid={`booking-actions-${linkedReturn.id}`}>
                                          <MoreHorizontal className="w-4 h-4" />
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={() => setViewBooking(linkedReturn)}>
                                          <MapPin className="w-4 h-4 mr-2" />
                                          View Return
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleEdit(linkedReturn)}>
                                          <Edit className="w-4 h-4 mr-2" />
                                          Edit Return
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem 
                                          onClick={() => setDeleteBooking(linkedReturn)}
                                          className="text-destructive focus:text-destructive"
                                        >
                                          <Trash2 className="w-4 h-4 mr-2" />
                                          Delete Return
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </div>
                                </div>
                              </div>
                            </div>
                            {/* Vehicle Type Footer Bar for Return */}
                            <div className={`px-3 py-1.5 rounded-b-lg ${getVehicleTypeColor(linkedReturn.vehicle_type)}`}>
                              <div className="flex items-center justify-center gap-2">
                                <Car className="w-4 h-4" />
                                <span className="text-sm font-semibold">
                                  {linkedReturn.vehicle_type ? getVehicleTypeName(linkedReturn.vehicle_type) : 'Vehicle Not Specified'}
                                </span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  </div>
                )}
              </div>
              );
            })}
          </div>
        )}
      </div>

      <BookingViewDialog
        booking={viewBooking}
        driver={viewBooking ? drivers.find(d => d.id === viewBooking.driver_id) : null}
        vehicleTypes={vehicleTypes}
        onClose={() => setViewBooking(null)}
        onEdit={() => {
          setSelectedBooking(viewBooking);
          setViewBooking(null);
          setShowForm(true);
        }}
        onAssignDriver={() => {
          setAssignBooking(viewBooking);
          setViewBooking(null);
        }}
        onRefresh={fetchData}
      />

      <BookingForm
        booking={selectedBooking}
        drivers={drivers}
        clients={clients}
        vehicleTypes={vehicleTypes}
        isOpen={showForm}
        onSave={handleSave}
        onClose={() => {
          setShowForm(false);
          setSelectedBooking(null);
        }}
      />

      <AssignDriverDialog
        booking={assignBooking}
        drivers={drivers}
        vehicleTypes={vehicleTypes}
        onAssign={handleAssignDriver}
        onClose={() => setAssignBooking(null)}
        onDriverAdded={fetchData}
      />

      <AlertDialog open={!!deleteBooking} onOpenChange={() => setDeleteBooking(null)}>
        <AlertDialogContent data-testid="delete-booking-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Booking</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this booking for {deleteBooking?.customer_name || `${deleteBooking?.first_name || ''} ${deleteBooking?.last_name || ''}`.trim()}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" data-testid="confirm-delete-booking-btn">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default BookingsPage;
