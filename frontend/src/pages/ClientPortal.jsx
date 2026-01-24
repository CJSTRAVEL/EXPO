import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { format, isValid, parseISO, setHours, setMinutes } from "date-fns";
import {
  MapPin, Calendar as CalendarIcon, Clock, User, Phone, Mail, LogOut,
  Building2, Plus, History, FileText, Loader2, CheckCircle,
  XCircle, Clock3, Car, Users, Briefcase, ChevronRight,
  Download, Receipt, Eye, CreditCard, Banknote, Plane, Search,
  ArrowLeftRight, X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { toast } from "sonner";
import AddressAutocomplete from "@/components/AddressAutocomplete";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Safe date formatting helper
const safeFormatDate = (dateValue, formatStr, fallback = '-') => {
  if (!dateValue) return fallback;
  try {
    const date = typeof dateValue === 'string' ? parseISO(dateValue) : new Date(dateValue);
    if (!isValid(date)) return fallback;
    return format(date, formatStr);
  } catch {
    return fallback;
  }
};

const ClientPortal = () => {
  const navigate = useNavigate();
  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("bookings");
  const [bookings, setBookings] = useState([]);
  const [requests, setRequests] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [vehicleTypes, setVehicleTypes] = useState([]);
  const [showNewBooking, setShowNewBooking] = useState(false);
  const [showInvoiceDetails, setShowInvoiceDetails] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [downloadingInvoice, setDownloadingInvoice] = useState(null);
  const [loadingFlight, setLoadingFlight] = useState(false);
  const [flightData, setFlightData] = useState(null);
  const [flightError, setFlightError] = useState(null);
  const [loadingReturnFlight, setLoadingReturnFlight] = useState(false);
  const [returnFlightData, setReturnFlightData] = useState(null);
  const [returnFlightError, setReturnFlightError] = useState(null);
  
  // Fare calculation state
  const [fareZones, setFareZones] = useState([]);
  const [mileRates, setMileRates] = useState(null);
  const [estimatedFare, setEstimatedFare] = useState(null);
  const [calculatingFare, setCalculatingFare] = useState(false);
  const [routeInfo, setRouteInfo] = useState(null);

  const [newBooking, setNewBooking] = useState({
    pickup_location: "",
    dropoff_location: "",
    pickup_datetime: "",
    passenger_count: 1,
    luggage_count: 0,
    vehicle_type_id: "",
    vehicle_type_name: "",
    notes: "",
    flight_number: "",
    additional_stops: [],
    create_return: false,
    return_pickup_location: "",
    return_additional_stops: [],
    return_dropoff_location: "",
    return_datetime: "",
    return_flight_number: "",
  });

  // Vehicle selector state
  const [showVehicleSelector, setShowVehicleSelector] = useState(false);

  const getAuthHeaders = () => {
    const token = localStorage.getItem("clientToken");
    return { Authorization: `Bearer ${token}` };
  };

  const fetchData = useCallback(async () => {
    const token = localStorage.getItem("clientToken");
    if (!token) {
      navigate("/customer-login");
      return;
    }

    // Get client info to fetch client-specific fare settings
    const clientInfo = localStorage.getItem("clientInfo");
    const clientData = clientInfo ? JSON.parse(clientInfo) : null;

    try {
      const [bookingsRes, requestsRes, invoicesRes, vehicleTypesRes, zonesRes, ratesRes, clientFaresRes] = await Promise.all([
        axios.get(`${API}/client-portal/bookings`, { headers: getAuthHeaders() }),
        axios.get(`${API}/client-portal/booking-requests`, { headers: getAuthHeaders() }),
        axios.get(`${API}/client-portal/invoices`, { headers: getAuthHeaders() }).catch(() => ({ data: [] })),
        axios.get(`${API}/vehicle-types`).catch(() => ({ data: [] })),
        axios.get(`${API}/settings/fare-zones`).catch(() => ({ data: [] })),
        axios.get(`${API}/settings/mile-rates`).catch(() => ({ data: null })),
        clientData?.id ? axios.get(`${API}/clients/${clientData.id}/fare-settings`).catch(() => ({ data: null })) : Promise.resolve({ data: null }),
      ]);

      setBookings(bookingsRes.data);
      setRequests(requestsRes.data);
      setInvoices(invoicesRes.data);
      setVehicleTypes(vehicleTypesRes.data);
      
      // Use client-specific fare settings if available, otherwise use global
      const clientFares = clientFaresRes.data;
      if (clientFares?.use_custom_fares && clientFares.custom_fare_zones?.length > 0) {
        setFareZones(clientFares.custom_fare_zones);
      } else {
        setFareZones(zonesRes.data || []);
      }
      
      if (clientFares?.use_custom_fares && clientFares.custom_mile_rates) {
        setMileRates(clientFares.custom_mile_rates);
      } else {
        setMileRates(ratesRes.data);
      }
    } catch (error) {
      if (error.response?.status === 401) {
        localStorage.removeItem("clientToken");
        localStorage.removeItem("clientInfo");
        navigate("/customer-login");
      }
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    const clientInfo = localStorage.getItem("clientInfo");
    if (clientInfo) {
      setClient(JSON.parse(clientInfo));
    }
    fetchData();
  }, [fetchData]);

  // Calculate route when locations change
  useEffect(() => {
    const calculateRoute = async () => {
      if (!newBooking.pickup_location || !newBooking.dropoff_location ||
          newBooking.pickup_location.length < 5 || newBooking.dropoff_location.length < 5) {
        setRouteInfo(null);
        return;
      }

      try {
        const response = await axios.get(`${API}/directions`, {
          params: {
            origin: newBooking.pickup_location,
            destination: newBooking.dropoff_location
          }
        });
        if (response.data.success) {
          setRouteInfo(response.data);
        }
      } catch (error) {
        console.error("Error calculating route:", error);
      }
    };

    const debounce = setTimeout(calculateRoute, 800);
    return () => clearTimeout(debounce);
  }, [newBooking.pickup_location, newBooking.dropoff_location]);

  // Calculate fare when vehicle type, route, or return option changes
  useEffect(() => {
    const calculateFare = () => {
      if (!newBooking.dropoff_location || !newBooking.vehicle_type_id) {
        setEstimatedFare(null);
        return;
      }

      setCalculatingFare(true);
      const dropoff = newBooking.dropoff_location.toLowerCase();
      const isReturn = newBooking.create_return;
      let calculatedFare = null;

      // Check zone-based fares first
      for (const zone of fareZones) {
        if (zone.zone_type !== 'dropoff' && zone.zone_type !== 'both') continue;
        
        let zoneMatches = false;
        
        // Check postcodes
        for (const postcode of (zone.postcodes || [])) {
          if (dropoff.includes(postcode.toLowerCase())) {
            zoneMatches = true;
            break;
          }
        }
        
        // Check areas
        if (!zoneMatches) {
          for (const area of (zone.areas || [])) {
            if (dropoff.includes(area.toLowerCase())) {
              zoneMatches = true;
              break;
            }
          }
        }
        
        if (zoneMatches) {
          const vehicleFares = zone.vehicle_fares || {};
          calculatedFare = vehicleFares[newBooking.vehicle_type_id] || zone.fixed_fare;
          break;
        }
      }

      // If no zone match, calculate based on mileage
      if (!calculatedFare && routeInfo && mileRates) {
        let distanceMiles = 0;
        if (routeInfo.distance) {
          if (typeof routeInfo.distance === 'number') {
            distanceMiles = routeInfo.distance;
          } else if (routeInfo.distance.miles) {
            distanceMiles = parseFloat(routeInfo.distance.miles) || 0;
          } else if (routeInfo.distance.value) {
            distanceMiles = (parseFloat(routeInfo.distance.value) || 0) / 1609.34;
          } else if (routeInfo.distance.text) {
            const match = routeInfo.distance.text.match(/[\d.]+/);
            if (match) distanceMiles = parseFloat(match[0]) || 0;
          }
        }
        
        if (distanceMiles > 0) {
          const vehicleRates = mileRates.vehicle_rates?.[newBooking.vehicle_type_id];
          const baseFare = parseFloat(vehicleRates?.base_fare ?? mileRates.base_fare) || 0;
          const pricePerMile = parseFloat(vehicleRates?.price_per_mile ?? mileRates.price_per_mile) || 0;
          const minimumFare = parseFloat(vehicleRates?.minimum_fare ?? mileRates.minimum_fare) || 0;
          
          calculatedFare = baseFare + (distanceMiles * pricePerMile);
          if (minimumFare && calculatedFare < minimumFare) {
            calculatedFare = minimumFare;
          }
        }
      }

      // Apply return multiplier
      if (calculatedFare && isReturn) {
        calculatedFare = calculatedFare * 2;
      }

      setEstimatedFare(calculatedFare);
      setCalculatingFare(false);
    };

    const debounce = setTimeout(calculateFare, 300);
    return () => clearTimeout(debounce);
  }, [newBooking.vehicle_type_id, newBooking.dropoff_location, newBooking.create_return, routeInfo, fareZones, mileRates]);

  const handleLogout = () => {
    localStorage.removeItem("clientToken");
    localStorage.removeItem("clientInfo");
    navigate("/customer-login");
  };

  const handleSubmitBooking = async () => {
    if (!newBooking.pickup_location || !newBooking.dropoff_location || !newBooking.pickup_datetime) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (!newBooking.vehicle_type_id) {
      toast.error("Please select a vehicle");
      return;
    }

    // Validate return journey fields if enabled
    if (newBooking.create_return) {
      if (!newBooking.return_pickup_location || !newBooking.return_dropoff_location || !newBooking.return_datetime) {
        toast.error("Please fill in all return journey fields");
        return;
      }
    }

    setSubmitting(true);
    try {
      // Include quoted fare and route info in the request
      const bookingData = {
        ...newBooking,
        quoted_fare: estimatedFare || null,
        distance_miles: routeInfo?.distance?.miles || null,
        duration_minutes: routeInfo?.duration?.minutes || null,
      };
      
      await axios.post(`${API}/client-portal/booking-requests`, bookingData, {
        headers: getAuthHeaders(),
      });
      toast.success(newBooking.create_return ? "Booking requests submitted (outbound + return)!" : "Booking request submitted! We'll confirm shortly.");
      setShowNewBooking(false);
      setNewBooking({
        pickup_location: "",
        dropoff_location: "",
        pickup_datetime: "",
        passenger_count: 1,
        luggage_count: 0,
        vehicle_type_id: "",
        vehicle_type_name: "",
        notes: "",
        flight_number: "",
        additional_stops: [],
        create_return: false,
        return_pickup_location: "",
        return_additional_stops: [],
        return_dropoff_location: "",
        return_datetime: "",
        return_flight_number: "",
      });
      setFlightData(null);
      setReturnFlightData(null);
      setEstimatedFare(null);
      setRouteInfo(null);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to submit booking");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadInvoice = async (invoice) => {
    setDownloadingInvoice(invoice.id);
    try {
      const response = await axios.get(
        `${API}/client-portal/invoices/${invoice.id}/download`,
        {
          headers: getAuthHeaders(),
          responseType: 'blob'
        }
      );
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${invoice.invoice_ref || 'invoice'}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success("Invoice downloaded successfully");
    } catch (error) {
      toast.error("Failed to download invoice");
    } finally {
      setDownloadingInvoice(null);
    }
  };

  const handleFlightLookup = async () => {
    const flightNumber = newBooking.flight_number;
    if (!flightNumber) {
      toast.error("Please enter a flight number");
      return;
    }

    setLoadingFlight(true);
    setFlightError(null);

    try {
      const response = await axios.get(`${API}/flight-lookup`, {
        params: { flight_number: flightNumber }
      });
      
      const flightInfo = response.data;
      
      if (flightInfo.error) {
        setFlightError(flightInfo.error);
        if (flightInfo.hint) {
          toast.error(`${flightInfo.error}. ${flightInfo.hint}`);
        } else {
          toast.error(flightInfo.error);
        }
        return;
      }
      
      // For arrival, set pickup 30 mins after landing
      let pickupDateTime = newBooking.pickup_datetime;
      const arrivalTime = flightInfo.arrival_scheduled || flightInfo.arrival_estimated;
      if (arrivalTime) {
        const arrivalDate = new Date(arrivalTime);
        arrivalDate.setMinutes(arrivalDate.getMinutes() + 30);
        pickupDateTime = arrivalDate.toISOString().slice(0, 16);
      }
      
      // Determine pickup location based on arrival airport
      let pickupLocation = newBooking.pickup_location;
      if (flightInfo.arrival_airport) {
        pickupLocation = flightInfo.arrival_airport;
        if (flightInfo.arrival_terminal) {
          pickupLocation += ` Terminal ${flightInfo.arrival_terminal}`;
        }
      }
      
      setNewBooking(prev => ({
        ...prev,
        pickup_location: pickupLocation || prev.pickup_location,
        pickup_datetime: pickupDateTime || prev.pickup_datetime
      }));
      setFlightData(flightInfo);
      
      toast.success("Flight data loaded!");
    } catch (err) {
      const errorMsg = "Flight not found or API error";
      setFlightError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setLoadingFlight(false);
    }
  };

  const handleReturnFlightLookup = async () => {
    const flightNumber = newBooking.return_flight_number;
    if (!flightNumber) {
      toast.error("Please enter a return flight number");
      return;
    }

    setLoadingReturnFlight(true);
    setReturnFlightError(null);

    try {
      const response = await axios.get(`${API}/flight-lookup`, {
        params: { flight_number: flightNumber }
      });
      
      const flightInfo = response.data;
      
      if (flightInfo.error) {
        setReturnFlightError(flightInfo.error);
        if (flightInfo.hint) {
          toast.error(`${flightInfo.error}. ${flightInfo.hint}`);
        } else {
          toast.error(flightInfo.error);
        }
        return;
      }
      
      // For departure, set pickup 3 hours before departure
      let returnDateTime = newBooking.return_datetime;
      const departureTime = flightInfo.departure_scheduled || flightInfo.departure_estimated;
      if (departureTime) {
        const departureDate = new Date(departureTime);
        departureDate.setHours(departureDate.getHours() - 3);
        returnDateTime = departureDate.toISOString().slice(0, 16);
      }
      
      // Determine dropoff location based on departure airport
      let returnDropoff = newBooking.return_dropoff_location;
      if (flightInfo.departure_airport) {
        returnDropoff = flightInfo.departure_airport;
        if (flightInfo.departure_terminal) {
          returnDropoff += ` Terminal ${flightInfo.departure_terminal}`;
        }
      }
      
      setNewBooking(prev => ({
        ...prev,
        return_dropoff_location: returnDropoff || prev.return_dropoff_location,
        return_datetime: returnDateTime || prev.return_datetime
      }));
      setReturnFlightData(flightInfo);
      
      toast.success("Return flight data loaded!");
    } catch (err) {
      const errorMsg = "Flight not found or API error";
      setReturnFlightError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setLoadingReturnFlight(false);
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      pending: "bg-yellow-500/20 text-yellow-700 border-yellow-500/30",
      approved: "bg-green-500/20 text-green-700 border-green-500/30",
      confirmed: "bg-green-500/20 text-green-700 border-green-500/30",
      assigned: "bg-[#D4A853]/20 text-[#9a7a3a] border-[#D4A853]/30",
      completed: "bg-gray-500/20 text-gray-600 border-gray-500/30",
      cancelled: "bg-red-500/20 text-red-700 border-red-500/30",
      rejected: "bg-red-500/20 text-red-700 border-red-500/30",
      paid: "bg-green-500/20 text-green-700 border-green-500/30",
      unpaid: "bg-red-500/20 text-red-700 border-red-500/30",
      overdue: "bg-orange-500/20 text-orange-700 border-orange-500/30",
    };
    const icons = {
      pending: Clock3,
      approved: CheckCircle,
      confirmed: CheckCircle,
      assigned: Car,
      completed: CheckCircle,
      cancelled: XCircle,
      rejected: XCircle,
      paid: CheckCircle,
      unpaid: Clock3,
      overdue: XCircle,
    };
    const Icon = icons[status] || Clock3;
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${styles[status] || styles.pending}`}>
        <Icon className="w-3 h-3" />
        {status?.charAt(0).toUpperCase() + status?.slice(1)}
      </span>
    );
  };

  // Calculate invoice stats
  const invoiceStats = {
    total: invoices.length,
    paid: invoices.filter(i => i.status === 'paid').length,
    unpaid: invoices.filter(i => i.status !== 'paid').length,
    totalAmount: invoices.reduce((sum, i) => sum + (i.total || 0), 0),
    outstandingAmount: invoices.filter(i => i.status !== 'paid').reduce((sum, i) => sum + (i.total || 0), 0),
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f5f5f5]">
        <Loader2 className="w-8 h-8 animate-spin text-[#D4A853]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f5f5]">
      {/* Header */}
      <header className="bg-[#1a1a1a] shadow-lg sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <img
                src="https://customer-assets.emergentagent.com/job_c2bf04a6-1cc1-4dad-86ae-c96a52a9ec62/artifacts/t13g8907_Logo%20With%20Border.png"
                alt="CJ's Executive Travel"
                className="w-12 h-12 object-contain"
              />
              <div>
                <h1 className="text-xl font-bold text-white">Client Portal</h1>
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <Building2 className="w-3.5 h-3.5" />
                  {client?.company_name || client?.name}
                  {client?.account_no && (
                    <span className="text-[#D4A853] ml-1">({client.account_no})</span>
                  )}
                </div>
                {client?.email && (
                  <div className="flex items-center gap-1 text-sm text-gray-400 mt-0.5">
                    <Mail className="w-3.5 h-3.5" />
                    {client.email}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Button
                onClick={() => setShowNewBooking(true)}
                className="bg-[#D4A853] text-[#1a1a1a] hover:bg-[#c49843] font-semibold"
                data-testid="new-booking-btn"
              >
                <Plus className="w-4 h-4 mr-2" />
                New Booking
              </Button>
              <Button
                variant="ghost"
                onClick={handleLogout}
                className="text-white hover:bg-white/10"
                data-testid="logout-btn"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-[#1a1a1a]/90 border-b border-[#D4A853]/20">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-1">
            {[
              { id: "bookings", label: "Confirmed Bookings", icon: Car },
              { id: "requests", label: "Pending Requests", icon: Clock3 },
              { id: "invoices", label: "Invoices", icon: Receipt },
              { id: "history", label: "History", icon: History },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
                  activeTab === tab.id
                    ? "text-[#D4A853] border-[#D4A853]"
                    : "text-gray-400 border-transparent hover:text-white hover:border-gray-600"
                }`}
                data-testid={`tab-${tab.id}`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
                {tab.id === "invoices" && invoiceStats.unpaid > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 text-xs bg-red-500 text-white rounded-full">
                    {invoiceStats.unpaid}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Confirmed Bookings */}
        {activeTab === "bookings" && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
              <Car className="w-5 h-5 text-[#D4A853]" />
              Confirmed Bookings
            </h2>
            {bookings.filter(b => !['completed', 'cancelled'].includes(b.status)).length === 0 ? (
              <div className="text-center py-12 bg-white rounded-xl border border-slate-200 shadow-sm">
                <Car className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                <p className="text-slate-600">No confirmed bookings yet</p>
                <Button
                  onClick={() => setShowNewBooking(true)}
                  className="mt-4 bg-[#D4A853] text-[#1a1a1a] hover:bg-[#c49843] font-semibold"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Request a Booking
                </Button>
              </div>
            ) : (
              <div className="grid gap-4">
                {bookings
                  .filter(b => !['completed', 'cancelled'].includes(b.status))
                  .map((booking) => (
                    <div
                      key={booking.id}
                      className="bg-white rounded-xl border border-slate-200 p-4 hover:border-[#D4A853]/50 transition-colors shadow-sm"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-slate-800 font-semibold">{booking.booking_id}</span>
                            {getStatusBadge(booking.status)}
                          </div>
                          <div className="flex items-center gap-4 mt-1 text-sm text-slate-500">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5" />
                              {safeFormatDate(booking.booking_datetime, "dd MMM yyyy")}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              {safeFormatDate(booking.booking_datetime, "HH:mm")}
                            </span>
                          </div>
                        </div>
                        {booking.fare && (
                          <span className="text-xl font-bold text-[#D4A853]">
                            £{booking.fare.toFixed(2)}
                          </span>
                        )}
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-start gap-2">
                          <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5" />
                          <span className="text-slate-700 text-sm">{booking.pickup_location}</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <div className="w-2 h-2 rounded-full bg-red-500 mt-1.5" />
                          <span className="text-slate-700 text-sm">{booking.dropoff_location}</span>
                        </div>
                      </div>
                      {booking.driver_name && (
                        <div className="mt-3 pt-3 border-t border-slate-200 flex items-center gap-2 text-sm text-slate-500">
                          <User className="w-4 h-4" />
                          Driver: <span className="text-slate-800">{booking.driver_name}</span>
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {/* Pending Requests */}
        {activeTab === "requests" && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
              <Clock3 className="w-5 h-5 text-amber-500" />
              Pending Requests
            </h2>
            {requests.filter(r => r.status === 'pending').length === 0 ? (
              <div className="text-center py-12 bg-white rounded-xl border border-slate-200 shadow-sm">
                <Clock3 className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                <p className="text-slate-600">No pending requests</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {requests
                  .filter(r => r.status === 'pending')
                  .map((request) => (
                    <div
                      key={request.id}
                      className="bg-amber-50 rounded-xl border border-amber-200 p-4"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          {getStatusBadge(request.status)}
                          <div className="flex items-center gap-4 mt-2 text-sm text-slate-500">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5" />
                              {safeFormatDate(request.pickup_datetime, "dd MMM yyyy HH:mm")}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-start gap-2">
                          <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5" />
                          <span className="text-slate-700 text-sm">{request.pickup_location}</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <div className="w-2 h-2 rounded-full bg-red-500 mt-1.5" />
                          <span className="text-slate-700 text-sm">{request.dropoff_location}</span>
                        </div>
                      </div>
                      <p className="text-xs text-slate-500 mt-3">
                        Submitted {safeFormatDate(request.created_at, "dd MMM yyyy 'at' HH:mm")}
                      </p>
                    </div>
                  ))}
              </div>
            )}

            {/* Rejected Requests */}
            {requests.filter(r => r.status === 'rejected').length > 0 && (
              <div className="mt-8">
                <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2 mb-4">
                  <XCircle className="w-5 h-5 text-red-500" />
                  Rejected Requests
                </h2>
                <div className="grid gap-4">
                  {requests
                    .filter(r => r.status === 'rejected')
                    .map((request) => (
                      <div
                        key={request.id}
                        className="bg-red-50 rounded-xl border border-red-200 p-4"
                        data-testid={`rejected-request-${request.id}`}
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            {getStatusBadge(request.status)}
                            <div className="flex items-center gap-4 mt-2 text-sm text-slate-500">
                              <span className="flex items-center gap-1">
                                <CalendarIcon className="w-3.5 h-3.5" />
                                {safeFormatDate(request.pickup_datetime, "dd MMM yyyy HH:mm")}
                              </span>
                            </div>
                          </div>
                          <XCircle className="w-6 h-6 text-red-500" />
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-start gap-2">
                            <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5" />
                            <span className="text-slate-700 text-sm">{request.pickup_location}</span>
                          </div>
                          <div className="flex items-start gap-2">
                            <div className="w-2 h-2 rounded-full bg-red-500 mt-1.5" />
                            <span className="text-slate-700 text-sm">{request.dropoff_location}</span>
                          </div>
                        </div>
                        
                        {/* Rejection Reason */}
                        <div className="mt-4 p-3 bg-red-100 rounded-lg border border-red-200">
                          <p className="text-xs font-semibold text-red-700 uppercase mb-1">Reason for Decline</p>
                          <p className="text-sm text-red-800">
                            {request.admin_notes || "We were unable to accommodate this request. Please contact us for alternatives."}
                          </p>
                        </div>
                        
                        <p className="text-xs text-slate-500 mt-3">
                          Submitted {safeFormatDate(request.created_at, "dd MMM yyyy 'at' HH:mm")}
                        </p>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Invoices */}
        {activeTab === "invoices" && (
          <div className="space-y-6">
            {/* Invoice Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-[#D4A853]/20">
                    <Receipt className="w-5 h-5 text-[#D4A853]" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-800">{invoiceStats.total}</p>
                    <p className="text-xs text-slate-500">Total Invoices</p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-500/20">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-800">{invoiceStats.paid}</p>
                    <p className="text-xs text-slate-500">Paid</p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-red-500/20">
                    <Clock3 className="w-5 h-5 text-red-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-800">{invoiceStats.unpaid}</p>
                    <p className="text-xs text-slate-500">Unpaid</p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-500/20">
                    <Banknote className="w-5 h-5 text-amber-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-800">£{invoiceStats.outstandingAmount.toFixed(2)}</p>
                    <p className="text-xs text-slate-500">Outstanding</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Invoice List */}
            <div>
              <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2 mb-4">
                <Receipt className="w-5 h-5 text-[#D4A853]" />
                Your Invoices
              </h2>
              {invoices.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-xl border border-slate-200 shadow-sm">
                  <Receipt className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                  <p className="text-slate-600">No invoices yet</p>
                  <p className="text-sm text-slate-500 mt-2">
                    Invoices will appear here after your bookings are completed
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {invoices.map((invoice) => (
                    <div
                      key={invoice.id}
                      className="bg-white rounded-xl border border-slate-200 p-4 hover:border-[#D4A853]/50 transition-colors shadow-sm"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="p-3 rounded-lg bg-[#D4A853]/10">
                            <FileText className="w-6 h-6 text-[#D4A853]" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-slate-800 font-semibold">{invoice.invoice_ref}</span>
                              {getStatusBadge(invoice.status || 'unpaid')}
                            </div>
                            <div className="flex items-center gap-4 mt-1 text-sm text-slate-500">
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3.5 h-3.5" />
                                {safeFormatDate(invoice.created_at, "dd MMM yyyy", 'N/A')}
                              </span>
                              {invoice.due_date && (
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3.5 h-3.5" />
                                  Due: {safeFormatDate(invoice.due_date, "dd MMM yyyy")}
                                </span>
                              )}
                              <span>{invoice.journey_count || 0} journeys</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-xl font-bold text-slate-800">
                              £{(invoice.total || 0).toFixed(2)}
                            </p>
                            {invoice.vat_amount && (
                              <p className="text-xs text-slate-500">
                                Inc. VAT £{invoice.vat_amount.toFixed(2)}
                              </p>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setShowInvoiceDetails(invoice)}
                              className="text-slate-500 hover:text-slate-800"
                              data-testid={`view-invoice-${invoice.id}`}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDownloadInvoice(invoice)}
                              disabled={downloadingInvoice === invoice.id}
                              className="text-[#D4A853] hover:text-[#c49843]"
                              data-testid={`download-invoice-${invoice.id}`}
                            >
                              {downloadingInvoice === invoice.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Download className="w-4 h-4" />
                              )}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* History */}
        {activeTab === "history" && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
              <History className="w-5 h-5 text-slate-500" />
              Booking History
            </h2>
            {bookings.filter(b => ['completed', 'cancelled'].includes(b.status)).length === 0 ? (
              <div className="text-center py-12 bg-white rounded-xl border border-slate-200 shadow-sm">
                <History className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                <p className="text-slate-600">No booking history</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {bookings
                  .filter(b => ['completed', 'cancelled'].includes(b.status))
                  .map((booking) => (
                    <div
                      key={booking.id}
                      className="bg-white/70 rounded-xl border border-slate-200 p-4 shadow-sm"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-slate-700 font-semibold">{booking.booking_id}</span>
                            {getStatusBadge(booking.status)}
                          </div>
                          <div className="text-sm text-slate-500 mt-1">
                            {safeFormatDate(booking.booking_datetime, "dd MMM yyyy 'at' HH:mm")}
                          </div>
                        </div>
                        {booking.fare && (
                          <span className="text-lg font-bold text-slate-500">
                            £{booking.fare.toFixed(2)}
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-slate-600">
                        {booking.pickup_location} → {booking.dropoff_location}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* New Booking Dialog */}
      {/* New Booking Request Dialog */}
      <Dialog open={showNewBooking} onOpenChange={setShowNewBooking}>
        <DialogContent 
          className="bg-[#1a1a1a] border-[#D4A853]/30 text-white max-w-lg max-h-[90vh] overflow-y-auto" 
          data-testid="request-form-modal"
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[#D4A853]">
              <Plus className="w-5 h-5" />
              Request a Booking
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Pickup Location */}
            <div className="space-y-2">
              <Label className="text-gray-300">Pickup Location *</Label>
              <AddressAutocomplete
                value={newBooking.pickup_location}
                onChange={(value) => setNewBooking({ ...newBooking, pickup_location: value })}
                placeholder="Start typing address..."
                data-testid="request-pickup-input"
                className="bg-[#2d2d2d] border-[#3d3d3d] text-white"
              />
            </div>

            {/* Additional Stops */}
            <div className="space-y-2 pl-4 border-l-2 border-[#D4A853]/50">
              <div className="flex items-center justify-between">
                <Label className="text-[#D4A853] text-sm">Stops (in order)</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setNewBooking({ 
                    ...newBooking, 
                    additional_stops: [...newBooking.additional_stops, ""] 
                  })}
                  className="h-7 text-xs border-[#D4A853]/30 text-[#D4A853] hover:bg-[#D4A853]/10"
                  data-testid="request-add-stop-btn"
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Add Stop
                </Button>
              </div>
              {newBooking.additional_stops.length === 0 ? (
                <p className="text-xs text-gray-500 italic">No intermediate stops - direct journey</p>
              ) : (
                newBooking.additional_stops.map((stop, index) => (
                  <div key={index} className="flex gap-2 items-center">
                    <span className="text-xs font-semibold text-[#D4A853] w-6">{index + 1}.</span>
                    <div className="flex-1">
                      <AddressAutocomplete
                        value={stop}
                        onChange={(value) => {
                          const newStops = [...newBooking.additional_stops];
                          newStops[index] = value;
                          setNewBooking({ ...newBooking, additional_stops: newStops });
                        }}
                        placeholder={`Stop ${index + 1} address...`}
                        data-testid={`request-stop-${index}-input`}
                        className="bg-[#2d2d2d] border-[#3d3d3d] text-white"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                      onClick={() => {
                        const newStops = newBooking.additional_stops.filter((_, i) => i !== index);
                        setNewBooking({ ...newBooking, additional_stops: newStops });
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
              <Label className="text-gray-300">Final Drop-off Location *</Label>
              <AddressAutocomplete
                value={newBooking.dropoff_location}
                onChange={(value) => setNewBooking({ ...newBooking, dropoff_location: value })}
                placeholder="Start typing address..."
                data-testid="request-dropoff-input"
                className="bg-[#2d2d2d] border-[#3d3d3d] text-white"
              />
            </div>

            {/* Vehicle Type Selection */}
            <div className="space-y-2">
              <Label className="text-gray-300">Select Vehicle *</Label>
              <Button
                type="button"
                variant="outline"
                className={`w-full justify-between h-auto py-3 ${
                  newBooking.vehicle_type_id 
                    ? 'bg-[#D4A853]/10 border-[#D4A853]/50 text-[#D4A853]' 
                    : 'bg-[#2d2d2d] border-[#3d3d3d] text-gray-400'
                }`}
                onClick={() => setShowVehicleSelector(true)}
                data-testid="select-vehicle-btn"
              >
                <span className="flex items-center gap-2">
                  <Car className="w-4 h-4" />
                  {newBooking.vehicle_type_name || "Choose your vehicle"}
                </span>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>

            {/* Date/Time and PAX */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-gray-300">Pickup Date *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={`w-full justify-start text-left font-normal bg-[#2d2d2d] border-[#3d3d3d] text-white hover:bg-[#3d3d3d] ${
                        !newBooking.pickup_datetime && "text-gray-500"
                      }`}
                      data-testid="request-date-picker"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {newBooking.pickup_datetime 
                        ? format(new Date(newBooking.pickup_datetime), "EEE, dd MMM yyyy")
                        : "Select date"
                      }
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-[#2d2d2d] border-[#3d3d3d]" align="start">
                    <Calendar
                      mode="single"
                      selected={newBooking.pickup_datetime ? new Date(newBooking.pickup_datetime) : undefined}
                      onSelect={(date) => {
                        if (date) {
                          // Preserve existing time or default to 09:00
                          const existingDate = newBooking.pickup_datetime ? new Date(newBooking.pickup_datetime) : null;
                          const hours = existingDate ? existingDate.getHours() : 9;
                          const minutes = existingDate ? existingDate.getMinutes() : 0;
                          const newDate = setMinutes(setHours(date, hours), minutes);
                          setNewBooking({ ...newBooking, pickup_datetime: newDate.toISOString() });
                        }
                      }}
                      disabled={(date) => date < new Date(new Date().setHours(0,0,0,0))}
                      className="bg-[#2d2d2d] text-white"
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label className="text-gray-300">Pickup Time *</Label>
                <Select
                  value={newBooking.pickup_datetime 
                    ? format(new Date(newBooking.pickup_datetime), "HH:mm")
                    : ""
                  }
                  onValueChange={(time) => {
                    const [hours, minutes] = time.split(":").map(Number);
                    const date = newBooking.pickup_datetime 
                      ? new Date(newBooking.pickup_datetime) 
                      : new Date();
                    const newDate = setMinutes(setHours(date, hours), minutes);
                    setNewBooking({ ...newBooking, pickup_datetime: newDate.toISOString() });
                  }}
                >
                  <SelectTrigger className="bg-[#2d2d2d] border-[#3d3d3d] text-white" data-testid="request-time-picker">
                    <SelectValue placeholder="Select time">
                      {newBooking.pickup_datetime 
                        ? format(new Date(newBooking.pickup_datetime), "HH:mm")
                        : "Select time"
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="bg-[#2d2d2d] border-[#3d3d3d] text-white max-h-[200px]">
                    {Array.from({ length: 48 }, (_, i) => {
                      const hours = Math.floor(i / 2);
                      const minutes = (i % 2) * 30;
                      const time = `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
                      return (
                        <SelectItem key={time} value={time} className="text-white hover:bg-[#3d3d3d]">
                          {time}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Passengers */}
            <div className="space-y-2">
              <Label className="text-gray-300">Number of Passengers</Label>
              <div className="relative">
                <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <Input
                  type="number"
                  min="1"
                  max="50"
                  value={newBooking.passenger_count}
                  onChange={(e) => setNewBooking({ ...newBooking, passenger_count: parseInt(e.target.value) || 1 })}
                  className="pl-10 bg-[#2d2d2d] border-[#3d3d3d] text-white"
                  data-testid="request-pax-input"
                />
              </div>
            </div>

            {/* Flight Number */}
            <div className="space-y-2">
              <Label className="text-gray-300 flex items-center gap-2">
                <Plane className="w-4 h-4" />
                Flight Number (optional)
              </Label>
              <div className="flex gap-2">
                <Input
                  value={newBooking.flight_number}
                  onChange={(e) => setNewBooking({ ...newBooking, flight_number: e.target.value.toUpperCase() })}
                  placeholder="e.g. BA1234"
                  className="bg-[#2d2d2d] border-[#3d3d3d] text-white uppercase"
                  data-testid="request-flight-input"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleFlightLookup}
                  disabled={!newBooking.flight_number || loadingFlight}
                  className="border-[#3d3d3d] text-gray-300 hover:bg-[#3d3d3d]"
                >
                  {loadingFlight ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                </Button>
              </div>
              {flightError && (
                <p className="text-xs text-red-400">{flightError}</p>
              )}
            </div>

            {/* Flight Info Display */}
            {flightData && (
              <div className="bg-[#D4A853]/10 border border-[#D4A853]/30 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-[#D4A853]">{flightData.flight_number}</span>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    flightData.flight_status === 'landed' ? 'bg-green-500/20 text-green-400' :
                    flightData.flight_status === 'active' ? 'bg-[#D4A853]/20 text-[#D4A853]' :
                    flightData.flight_status === 'scheduled' ? 'bg-gray-500/20 text-gray-400' :
                    flightData.flight_status === 'cancelled' ? 'bg-red-500/20 text-red-400' :
                    'bg-gray-500/20 text-gray-400'
                  }`}>
                    {flightData.flight_status?.toUpperCase() || 'UNKNOWN'}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <div>
                    <p className="text-gray-500 text-xs">From</p>
                    <p className="font-medium text-white">{flightData.departure_airport}</p>
                  </div>
                  <Plane className="w-4 h-4 text-[#D4A853]" />
                  <div>
                    <p className="text-gray-500 text-xs">To</p>
                    <p className="font-medium text-white">{flightData.arrival_airport}</p>
                  </div>
                </div>
                {flightData.arrival_scheduled && (
                  <p className="text-xs text-gray-400">
                    <span className="font-medium">Arrival:</span> {new Date(flightData.arrival_scheduled).toLocaleString()}
                    {flightData.arrival_terminal && ` - Terminal ${flightData.arrival_terminal}`}
                  </p>
                )}
              </div>
            )}

            {/* Return Journey Toggle */}
            <div className="bg-[#D4A853]/10 border border-[#D4A853]/30 rounded-lg p-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newBooking.create_return}
                  onChange={(e) => {
                    const isChecked = e.target.checked;
                    setNewBooking({
                      ...newBooking,
                      create_return: isChecked,
                      return_pickup_location: isChecked ? newBooking.dropoff_location : "",
                      return_dropoff_location: isChecked ? newBooking.pickup_location : "",
                      return_additional_stops: [],
                      return_datetime: "",
                      return_flight_number: ""
                    });
                    setReturnFlightData(null);
                  }}
                  className="rounded border-[#D4A853]"
                  data-testid="create-return-toggle"
                />
                <span className="text-sm font-semibold text-[#D4A853] flex items-center gap-2">
                  <ArrowLeftRight className="w-4 h-4" />
                  Create Return Journey
                </span>
              </label>
              
              {newBooking.create_return && (
                <div className="mt-4 pt-4 border-t border-[#D4A853]/30 space-y-4">
                  <div className="bg-[#D4A853]/20 rounded px-2 py-1">
                    <p className="text-xs font-semibold text-[#D4A853]">RETURN JOURNEY DETAILS</p>
                  </div>
                  
                  {/* Return Pickup */}
                  <div className="space-y-2">
                    <Label className="text-gray-300">Return Pickup</Label>
                    <AddressAutocomplete
                      value={newBooking.return_pickup_location}
                      onChange={(value) => setNewBooking({ ...newBooking, return_pickup_location: value })}
                      placeholder="Return pickup address..."
                      className="bg-[#2d2d2d] border-[#3d3d3d] text-white"
                    />
                  </div>

                  {/* Return Dropoff */}
                  <div className="space-y-2">
                    <Label className="text-gray-300">Return Drop-off</Label>
                    <AddressAutocomplete
                      value={newBooking.return_dropoff_location}
                      onChange={(value) => setNewBooking({ ...newBooking, return_dropoff_location: value })}
                      placeholder="Return drop-off address..."
                      className="bg-[#2d2d2d] border-[#3d3d3d] text-white"
                    />
                  </div>

                  {/* Return DateTime */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-gray-300">Return Date</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={`w-full justify-start text-left font-normal bg-[#2d2d2d] border-[#3d3d3d] text-white hover:bg-[#3d3d3d] ${
                              !newBooking.return_datetime && "text-gray-500"
                            }`}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {newBooking.return_datetime 
                              ? format(new Date(newBooking.return_datetime), "EEE, dd MMM")
                              : "Select date"
                            }
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 bg-[#2d2d2d] border-[#3d3d3d]" align="start">
                          <Calendar
                            mode="single"
                            selected={newBooking.return_datetime ? new Date(newBooking.return_datetime) : undefined}
                            onSelect={(date) => {
                              if (date) {
                                const existingDate = newBooking.return_datetime ? new Date(newBooking.return_datetime) : null;
                                const hours = existingDate ? existingDate.getHours() : 17;
                                const minutes = existingDate ? existingDate.getMinutes() : 0;
                                const newDate = setMinutes(setHours(date, hours), minutes);
                                setNewBooking({ ...newBooking, return_datetime: newDate.toISOString() });
                              }
                            }}
                            disabled={(date) => date < new Date(new Date().setHours(0,0,0,0))}
                            className="bg-[#2d2d2d] text-white"
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-gray-300">Return Time</Label>
                      <Select
                        value={newBooking.return_datetime 
                          ? format(new Date(newBooking.return_datetime), "HH:mm")
                          : ""
                        }
                        onValueChange={(time) => {
                          const [hours, minutes] = time.split(":").map(Number);
                          const date = newBooking.return_datetime 
                            ? new Date(newBooking.return_datetime) 
                            : new Date();
                          const newDate = setMinutes(setHours(date, hours), minutes);
                          setNewBooking({ ...newBooking, return_datetime: newDate.toISOString() });
                        }}
                      >
                        <SelectTrigger className="bg-[#2d2d2d] border-[#3d3d3d] text-white">
                          <SelectValue placeholder="Time">
                            {newBooking.return_datetime 
                              ? format(new Date(newBooking.return_datetime), "HH:mm")
                              : "Select time"
                            }
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent className="bg-[#2d2d2d] border-[#3d3d3d] text-white max-h-[200px]">
                          {Array.from({ length: 48 }, (_, i) => {
                            const hours = Math.floor(i / 2);
                            const minutes = (i % 2) * 30;
                            const time = `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
                            return (
                              <SelectItem key={time} value={time} className="text-white hover:bg-[#3d3d3d]">
                                {time}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label className="text-gray-300">Additional Notes</Label>
              <Textarea
                value={newBooking.notes}
                onChange={(e) => setNewBooking({ ...newBooking, notes: e.target.value })}
                placeholder="Any special requirements..."
                className="bg-[#2d2d2d] border-[#3d3d3d] text-white resize-none"
                rows={3}
                data-testid="request-notes-input"
              />
            </div>

            {/* Estimated Fare Display */}
            {(estimatedFare || calculatingFare || routeInfo || (newBooking.vehicle_type_id && newBooking.dropoff_location)) && (
              <div className="bg-gradient-to-br from-[#1a1a1a] to-[#2d2d2d] rounded-xl p-4 border border-[#D4A853]/30 shadow-lg" data-testid="fare-estimate-card">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-[#D4A853] uppercase tracking-wide flex items-center gap-2">
                    <Car className="w-4 h-4" />
                    Estimated Fare
                  </h4>
                  {calculatingFare && (
                    <Loader2 className="w-4 h-4 animate-spin text-[#D4A853]" />
                  )}
                </div>
                
                <div className="text-center py-2">
                  {calculatingFare ? (
                    <p className="text-gray-400 text-sm">Calculating...</p>
                  ) : estimatedFare ? (
                    <div>
                      <p className="text-4xl font-bold text-white">
                        £{estimatedFare.toFixed(2)}
                      </p>
                      {newBooking.create_return && (
                        <p className="text-xs text-[#D4A853] mt-1">Includes return journey</p>
                      )}
                    </div>
                  ) : (
                    <div>
                      <p className="text-gray-400 text-sm">Fare will be calculated based on your route</p>
                      <p className="text-xs text-gray-500 mt-1">Contact us for a custom quote</p>
                    </div>
                  )}
                </div>

                {routeInfo && (
                  <div className="flex items-center justify-center gap-4 mt-3 pt-3 border-t border-[#D4A853]/20">
                    {routeInfo.distance && (
                      <div className="text-center">
                        <p className="text-lg font-semibold text-white">
                          {routeInfo.distance.miles?.toFixed(1) || routeInfo.distance.text}
                        </p>
                        <p className="text-xs text-gray-400">miles</p>
                      </div>
                    )}
                    {routeInfo.duration && (
                      <div className="text-center">
                        <p className="text-lg font-semibold text-white">
                          {routeInfo.duration.text || `${routeInfo.duration.minutes} mins`}
                        </p>
                        <p className="text-xs text-gray-400">est. duration</p>
                      </div>
                    )}
                  </div>
                )}

                <p className="text-xs text-gray-500 text-center mt-3">
                  * Final fare confirmed upon booking approval
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setNewBooking({
                  pickup_location: "",
                  dropoff_location: "",
                  pickup_datetime: "",
                  passenger_count: 1,
                  luggage_count: 0,
                  vehicle_type_id: "",
                  vehicle_type_name: "",
                  notes: "",
                  flight_number: "",
                  additional_stops: [],
                  create_return: false,
                  return_pickup_location: "",
                  return_additional_stops: [],
                  return_dropoff_location: "",
                  return_datetime: "",
                  return_flight_number: "",
                });
                setFlightData(null);
                setReturnFlightData(null);
                setEstimatedFare(null);
                setRouteInfo(null);
                setShowNewBooking(false);
              }}
              className="border-[#3d3d3d] text-gray-300 hover:bg-[#2d2d2d]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmitBooking}
              disabled={submitting || !newBooking.pickup_location || !newBooking.dropoff_location || !newBooking.vehicle_type_id}
              className="bg-[#D4A853] text-[#1a1a1a] hover:bg-[#c49843] font-semibold"
              data-testid="submit-booking-btn"
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

      {/* Vehicle Selector Modal */}
      <Dialog open={showVehicleSelector} onOpenChange={setShowVehicleSelector}>
        <DialogContent className="bg-[#1a1a1a] border-blue-500/30 text-white max-w-2xl max-h-[80vh] overflow-y-auto" data-testid="vehicle-selector-modal">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-blue-400">
              <Car className="w-5 h-5" />
              Select Your Vehicle
            </DialogTitle>
          </DialogHeader>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
            {vehicleTypes.map((vt) => (
              <div
                key={vt.id}
                onClick={() => {
                  setNewBooking({
                    ...newBooking,
                    vehicle_type_id: vt.id,
                    vehicle_type_name: `${vt.name} (${vt.capacity} seats)`
                  });
                  setShowVehicleSelector(false);
                }}
                className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                  newBooking.vehicle_type_id === vt.id
                    ? 'border-blue-500 bg-blue-500/10'
                    : 'border-[#3d3d3d] hover:border-blue-500/50 bg-[#2d2d2d]'
                }`}
                data-testid={`vehicle-card-${vt.id}`}
              >
                {vt.image_url && (
                  <img 
                    src={vt.image_url} 
                    alt={vt.name}
                    className="w-full h-32 object-cover rounded-lg mb-3"
                  />
                )}
                <h3 className="font-semibold text-white">{vt.name}</h3>
                <p className="text-sm text-gray-400">Max {vt.capacity} passengers</p>
                {vt.features && (
                  <p className="text-xs text-gray-500 mt-1">{vt.features}</p>
                )}
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowVehicleSelector(false)}
              className="border-[#3d3d3d] text-gray-300 hover:bg-[#2d2d2d]"
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invoice Details Dialog */}
      <Dialog open={!!showInvoiceDetails} onOpenChange={() => setShowInvoiceDetails(null)}>
        <DialogContent className="bg-[#1a1a1a] border-blue-500/30 text-white max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-400" />
              Invoice {showInvoiceDetails?.invoice_ref}
            </DialogTitle>
          </DialogHeader>
          {showInvoiceDetails && (
            <div className="space-y-6">
              {/* Invoice Header */}
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm text-gray-400">Invoice Date</p>
                  <p className="text-white font-medium">
                    {safeFormatDate(showInvoiceDetails.created_at, "dd MMM yyyy", 'N/A')}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-400">Status</p>
                  {getStatusBadge(showInvoiceDetails.status || 'unpaid')}
                </div>
              </div>

              {/* Period */}
              {(showInvoiceDetails.start_date || showInvoiceDetails.end_date) && (
                <div className="bg-[#2d2d2d] rounded-lg p-4">
                  <p className="text-sm text-gray-400 mb-1">Billing Period</p>
                  <p className="text-white">
                    {safeFormatDate(showInvoiceDetails.start_date, "dd MMM yyyy")}
                    {' - '}
                    {safeFormatDate(showInvoiceDetails.end_date, "dd MMM yyyy")}
                  </p>
                </div>
              )}

              {/* Summary */}
              <div className="bg-[#2d2d2d] rounded-lg p-4 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Journeys</span>
                  <span className="text-white">{showInvoiceDetails.journey_count || 0}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Subtotal</span>
                  <span className="text-white">£{(showInvoiceDetails.subtotal || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">VAT (20%)</span>
                  <span className="text-white">£{(showInvoiceDetails.vat_amount || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold border-t border-[#3d3d3d] pt-3">
                  <span className="text-white">Total</span>
                  <span className="text-blue-400">£{(showInvoiceDetails.total || 0).toFixed(2)}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <Button
                  onClick={() => handleDownloadInvoice(showInvoiceDetails)}
                  disabled={downloadingInvoice === showInvoiceDetails.id}
                  className="flex-1 bg-blue-500 hover:bg-blue-600 text-white"
                >
                  {downloadingInvoice === showInvoiceDetails.id ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Downloading...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 mr-2" />
                      Download PDF
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowInvoiceDetails(null)}
                  className="border-[#3d3d3d] text-gray-300 hover:bg-[#2d2d2d]"
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ClientPortal;
