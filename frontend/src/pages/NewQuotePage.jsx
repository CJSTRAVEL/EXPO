import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Plus, X, Save, MapPin, User, Phone, Mail, Car, Calendar, Clock, RotateCcw, Loader2, Building2, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import AddressAutocomplete from "@/components/AddressAutocomplete";

const API = process.env.REACT_APP_BACKEND_URL;

export default function NewQuotePage() {
  const navigate = useNavigate();
  const { quoteId } = useParams();
  const isEditing = !!quoteId;

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [vehicleTypes, setVehicleTypes] = useState([]);
  const [fareZones, setFareZones] = useState([]);
  const [mileRates, setMileRates] = useState(null);
  const [routeInfo, setRouteInfo] = useState(null);
  const [calculatingFare, setCalculatingFare] = useState(false);
  
  // Availability check state
  const [outboundAvailability, setOutboundAvailability] = useState(null);
  const [returnAvailability, setReturnAvailability] = useState(null);
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  
  // Passenger/Client lookup
  const [passengers, setPassengers] = useState([]);
  const [clients, setClients] = useState([]);
  const [matchedContacts, setMatchedContacts] = useState([]);
  const [showContactPopup, setShowContactPopup] = useState(false);
  const searchTimeoutRef = useRef(null);

  // Form state
  const [formData, setFormData] = useState({
    vehicle_type_id: "",
    quote_date: format(new Date(), "yyyy-MM-dd"),
    quote_time: format(new Date(), "HH:mm"),
    pickup_location: "",
    dropoff_location: "",
    additional_stops: [],
    customer_first_name: "",
    customer_last_name: "",
    customer_phone: "",
    customer_email: "",
    return_journey: false,
    return_datetime: "",
    quoted_fare: "",
    notes: "",
  });

  const [newStop, setNewStop] = useState("");

  useEffect(() => {
    fetchVehicleTypes();
    fetchFareSettings();
    fetchPassengersAndClients();
    if (isEditing) {
      fetchQuote();
    }
  }, [quoteId]);
  
  const fetchPassengersAndClients = async () => {
    try {
      const [passengersRes, clientsRes] = await Promise.all([
        axios.get(`${API}/api/admin/passengers`).catch(() => ({ data: [] })),
        axios.get(`${API}/api/clients`)
      ]);
      setPassengers(passengersRes.data || []);
      setClients(clientsRes.data || []);
    } catch (error) {
      console.error("Error fetching contacts:", error);
    }
  };

  // Debounced contact search
  const searchContacts = useCallback((query, field) => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    if (!query || query.length < 2) {
      setMatchedContacts([]);
      setShowContactPopup(false);
      return;
    }
    
    searchTimeoutRef.current = setTimeout(() => {
      const queryLower = query.toLowerCase().trim();
      
      // Search passengers
      const passengerMatches = passengers.filter(p => {
        if (field === 'name') {
          const fullName = (p.name || `${p.first_name || ''} ${p.last_name || ''}`).toLowerCase();
          return fullName.includes(queryLower);
        } else if (field === 'phone') {
          const phone = (p.phone || p.customer_phone || '').replace(/\s+/g, '');
          return phone.includes(query.replace(/\s+/g, ''));
        }
        return false;
      }).map(p => ({ ...p, type: 'passenger' })).slice(0, 5);
      
      // Search clients
      const clientMatches = clients.filter(c => {
        if (field === 'name') {
          const name = (c.name || c.contact_name || '').toLowerCase();
          return name.includes(queryLower);
        } else if (field === 'phone') {
          const phone = (c.phone || c.contact_phone || '').replace(/\s+/g, '');
          return phone.includes(query.replace(/\s+/g, ''));
        }
        return false;
      }).map(c => ({ ...c, type: 'client' })).slice(0, 5);
      
      const allMatches = [...passengerMatches, ...clientMatches].slice(0, 8);
      setMatchedContacts(allMatches);
      setShowContactPopup(allMatches.length > 0);
    }, 500);
  }, [passengers, clients]);

  const selectContact = (contact) => {
    if (contact.type === 'passenger') {
      const nameParts = (contact.name || `${contact.first_name || ''} ${contact.last_name || ''}`).trim().split(' ');
      setFormData(prev => ({
        ...prev,
        customer_first_name: nameParts[0] || '',
        customer_last_name: nameParts.slice(1).join(' ') || '',
        customer_phone: contact.phone || contact.customer_phone || '',
        customer_email: contact.email || ''
      }));
    } else if (contact.type === 'client') {
      const nameParts = (contact.contact_name || contact.name || '').trim().split(' ');
      setFormData(prev => ({
        ...prev,
        customer_first_name: nameParts[0] || '',
        customer_last_name: nameParts.slice(1).join(' ') || '',
        customer_phone: contact.contact_phone || contact.phone || '',
        customer_email: contact.contact_email || contact.email || ''
      }));
    }
    setMatchedContacts([]);
    setShowContactPopup(false);
    toast.success(`${contact.type === 'client' ? 'Client' : 'Passenger'} details loaded`);
  };

  useEffect(() => {
    fetchVehicleTypes();
    fetchFareSettings();
    fetchPassengersAndClients();
    if (isEditing) {
      fetchQuote();
    }
  }, [quoteId]);

  const fetchVehicleTypes = async () => {
    try {
      const response = await axios.get(`${API}/api/vehicle-types`);
      setVehicleTypes(response.data || []);
    } catch (error) {
      console.error("Error fetching vehicle types:", error);
    }
  };

  const fetchFareSettings = async () => {
    try {
      const [zonesRes, ratesRes] = await Promise.all([
        axios.get(`${API}/api/settings/fare-zones`),
        axios.get(`${API}/api/settings/mile-rates`),
      ]);
      setFareZones(zonesRes.data || []);
      setMileRates(ratesRes.data);
    } catch (error) {
      console.error("Error fetching fare settings:", error);
    }
  };

  // Calculate route when locations change
  useEffect(() => {
    const calculateRoute = async () => {
      if (!formData.pickup_location || !formData.dropoff_location ||
          formData.pickup_location.length < 5 || formData.dropoff_location.length < 5) {
        setRouteInfo(null);
        return;
      }

      try {
        const response = await axios.get(`${API}/api/directions`, {
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
      }
    };

    const debounce = setTimeout(calculateRoute, 800);
    return () => clearTimeout(debounce);
  }, [formData.pickup_location, formData.dropoff_location, formData.additional_stops]);

  // Auto-calculate fare when vehicle type, route, or return journey changes
  useEffect(() => {
    const calculateFareFromZones = () => {
      if (!formData.dropoff_location || !formData.vehicle_type_id || fareZones.length === 0) {
        return;
      }

      setCalculatingFare(true);
      const dropoff = formData.dropoff_location.toLowerCase();
      const isReturn = formData.return_journey;
      
      // Find matching zone
      for (const zone of fareZones) {
        if (zone.zone_type !== 'dropoff' && zone.zone_type !== 'both') {
          continue;
        }
        
        let zoneMatches = false;
        
        // Check postcodes
        for (const postcode of (zone.postcodes || [])) {
          const postcodeCheck = postcode.toLowerCase();
          if (dropoff.includes(postcodeCheck)) {
            zoneMatches = true;
            break;
          }
        }
        
        // Check areas
        if (!zoneMatches) {
          for (const area of (zone.areas || [])) {
            const areaCheck = area.toLowerCase();
            if (dropoff.includes(areaCheck)) {
              zoneMatches = true;
              break;
            }
          }
        }
        
        if (zoneMatches) {
          // Get fare for selected vehicle type
          const vehicleFares = zone.vehicle_fares || {};
          let fare = vehicleFares[formData.vehicle_type_id];
          
          if (fare) {
            // Double the fare if return journey is selected
            if (isReturn) {
              fare = fare * 2;
            }
            setFormData(prev => ({ ...prev, quoted_fare: fare.toFixed(2) }));
            setCalculatingFare(false);
            toast.success(`Fare auto-set from "${zone.name}" zone: £${fare.toFixed(2)}${isReturn ? ' (x2)' : ''}`);
            return;
          } else if (zone.fixed_fare) {
            // Legacy support for old fixed_fare field
            let legacyFare = zone.fixed_fare;
            if (isReturn) {
              legacyFare = legacyFare * 2;
            }
            setFormData(prev => ({ ...prev, quoted_fare: legacyFare.toFixed(2) }));
            setCalculatingFare(false);
            toast.success(`Fare auto-set from "${zone.name}" zone: £${legacyFare.toFixed(2)}${isReturn ? ' (x2)' : ''}`);
            return;
          }
        }
      }
      
      // No zone match - try to calculate based on miles if we have route distance
      if (routeInfo && mileRates) {
        // Extract numeric distance from routeInfo
        let distanceMiles = 0;
        if (routeInfo.distance) {
          if (typeof routeInfo.distance === 'number') {
            distanceMiles = routeInfo.distance;
          } else if (routeInfo.distance.miles) {
            distanceMiles = parseFloat(routeInfo.distance.miles) || 0;
          } else if (routeInfo.distance.value) {
            // Google API returns meters, convert to miles
            distanceMiles = (parseFloat(routeInfo.distance.value) || 0) / 1609.34;
          } else if (routeInfo.distance.text) {
            // Try to parse from text like "25.3 mi" or "25.3 miles"
            const match = routeInfo.distance.text.match(/[\d.]+/);
            if (match) {
              distanceMiles = parseFloat(match[0]) || 0;
            }
          }
        }
        
        if (distanceMiles > 0) {
          // Get vehicle-specific rates or use defaults
          const vehicleRates = formData.vehicle_type_id && mileRates.vehicle_rates?.[formData.vehicle_type_id];
          const baseFare = parseFloat(vehicleRates?.base_fare ?? mileRates.base_fare) || 0;
          const pricePerMile = parseFloat(vehicleRates?.price_per_mile ?? mileRates.price_per_mile) || 0;
          const minimumFare = parseFloat(vehicleRates?.minimum_fare ?? mileRates.minimum_fare) || 0;
          
          let fare = baseFare + (distanceMiles * pricePerMile);
          
          // Apply minimum fare
          if (minimumFare && fare < minimumFare) {
            fare = minimumFare;
          }
          
          // Double for return journey
          if (isReturn) {
            fare = fare * 2;
          }
          
          setFormData(prev => ({ ...prev, quoted_fare: fare.toFixed(2) }));
          toast.success(`Fare calculated: £${fare.toFixed(2)} (${distanceMiles.toFixed(1)} miles${isReturn ? ' x2 return' : ''})`);
        }
      }
      
      setCalculatingFare(false);
    };

    // Debounce the calculation
    const debounce = setTimeout(calculateFareFromZones, 500);
    return () => clearTimeout(debounce);
  }, [formData.vehicle_type_id, formData.dropoff_location, formData.return_journey, routeInfo, fareZones, mileRates]);

  // Check schedule availability when journey details change
  useEffect(() => {
    const checkAvailability = async () => {
      // Only check if we have date, time, and vehicle type
      if (!formData.quote_date || !formData.quote_time || !formData.vehicle_type_id) {
        setOutboundAvailability(null);
        return;
      }
      
      setCheckingAvailability(true);
      
      try {
        // Get duration from route info if available
        const durationMinutes = routeInfo?.duration?.value 
          ? Math.ceil(routeInfo.duration.value / 60) 
          : 60;
        
        // Check outbound availability
        const outboundRes = await axios.post(`${API}/api/scheduling/check-availability`, {
          date: formData.quote_date,
          time: formData.quote_time,
          duration_minutes: durationMinutes,
          vehicle_type_id: formData.vehicle_type_id
        });
        setOutboundAvailability(outboundRes.data);
        
        // Check return availability if return journey is enabled
        if (formData.return_journey && formData.return_datetime) {
          const returnDate = formData.return_datetime.split('T')[0];
          const returnTime = formData.return_datetime.split('T')[1];
          
          if (returnDate && returnTime) {
            const returnRes = await axios.post(`${API}/api/scheduling/check-availability`, {
              date: returnDate,
              time: returnTime,
              duration_minutes: durationMinutes,
              vehicle_type_id: formData.vehicle_type_id
            });
            setReturnAvailability(returnRes.data);
          }
        } else {
          setReturnAvailability(null);
        }
      } catch (error) {
        console.error("Error checking availability:", error);
        setOutboundAvailability(null);
        setReturnAvailability(null);
      } finally {
        setCheckingAvailability(false);
      }
    };
    
    // Debounce the check
    const debounce = setTimeout(checkAvailability, 500);
    return () => clearTimeout(debounce);
  }, [formData.quote_date, formData.quote_time, formData.vehicle_type_id, formData.return_journey, formData.return_datetime, routeInfo?.duration?.value]);

  const fetchQuote = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/api/quotes/${quoteId}`);
      const quote = response.data;
      setFormData({
        vehicle_type_id: quote.vehicle_type_id || "",
        quote_date: quote.quote_date ? format(new Date(quote.quote_date), "yyyy-MM-dd") : "",
        quote_time: quote.quote_time || (quote.quote_date ? format(new Date(quote.quote_date), "HH:mm") : ""),
        pickup_location: quote.pickup_location || "",
        dropoff_location: quote.dropoff_location || "",
        additional_stops: quote.additional_stops || [],
        customer_first_name: quote.customer_first_name || "",
        customer_last_name: quote.customer_last_name || "",
        customer_phone: quote.customer_phone || "",
        customer_email: quote.customer_email || "",
        return_journey: quote.return_journey || false,
        return_datetime: quote.return_datetime ? format(new Date(quote.return_datetime), "yyyy-MM-dd'T'HH:mm") : "",
        quoted_fare: quote.quoted_fare || "",
        notes: quote.notes || "",
      });
    } catch (error) {
      console.error("Error fetching quote:", error);
      toast.error("Failed to load quote");
      navigate("/quotes");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const addStop = () => {
    if (newStop.trim()) {
      setFormData((prev) => ({
        ...prev,
        additional_stops: [...prev.additional_stops, newStop.trim()],
      }));
      setNewStop("");
    }
  };

  const removeStop = (index) => {
    setFormData((prev) => ({
      ...prev,
      additional_stops: prev.additional_stops.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    if (!formData.customer_first_name || !formData.customer_last_name) {
      toast.error("Please enter customer name");
      return;
    }
    if (!formData.customer_phone) {
      toast.error("Please enter customer phone number");
      return;
    }
    if (!formData.pickup_location) {
      toast.error("Please enter pickup location");
      return;
    }
    if (!formData.dropoff_location) {
      toast.error("Please enter drop off location");
      return;
    }

    setSaving(true);
    try {
      // Combine date and time
      const quoteDateTime = new Date(`${formData.quote_date}T${formData.quote_time || "00:00"}`);
      
      const payload = {
        ...formData,
        quote_date: quoteDateTime.toISOString(),
        quoted_fare: formData.quoted_fare ? parseFloat(formData.quoted_fare) : null,
        return_datetime: formData.return_journey && formData.return_datetime 
          ? new Date(formData.return_datetime).toISOString() 
          : null,
      };

      if (isEditing) {
        await axios.put(`${API}/api/quotes/${quoteId}`, payload);
        toast.success("Quote updated successfully");
      } else {
        await axios.post(`${API}/api/quotes`, payload);
        toast.success("Quote created successfully");
      }
      
      navigate("/quotes");
    } catch (error) {
      console.error("Error saving quote:", error);
      toast.error(isEditing ? "Failed to update quote" : "Failed to create quote");
    } finally {
      setSaving(false);
    }
  };

  // Availability indicator component
  const AvailabilityIndicator = ({ availability, label, isReturn = false }) => {
    if (!availability) return null;
    
    const getStatusConfig = (status) => {
      switch (status) {
        case 'green':
          return {
            bg: 'bg-green-50 border-green-200',
            icon: <CheckCircle2 className="h-5 w-5 text-green-600" />,
            textColor: 'text-green-700',
            badge: 'bg-green-100 text-green-800'
          };
        case 'amber':
          return {
            bg: 'bg-amber-50 border-amber-200',
            icon: <AlertTriangle className="h-5 w-5 text-amber-600" />,
            textColor: 'text-amber-700',
            badge: 'bg-amber-100 text-amber-800'
          };
        case 'red':
          return {
            bg: 'bg-red-50 border-red-200',
            icon: <XCircle className="h-5 w-5 text-red-600" />,
            textColor: 'text-red-700',
            badge: 'bg-red-100 text-red-800'
          };
        default:
          return {
            bg: 'bg-gray-50 border-gray-200',
            icon: null,
            textColor: 'text-gray-700',
            badge: 'bg-gray-100 text-gray-800'
          };
      }
    };
    
    const config = getStatusConfig(availability.status);
    
    return (
      <div className={`rounded-lg border p-3 ${config.bg}`}>
        <div className="flex items-start gap-3">
          {config.icon}
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className={`font-medium text-sm ${config.textColor}`}>
                {label}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${config.badge}`}>
                {availability.status === 'green' ? 'Available' : availability.status === 'amber' ? 'Limited' : 'Unavailable'}
              </span>
            </div>
            <p className={`text-sm mt-1 ${config.textColor}`}>
              {availability.message}
            </p>
            {availability.status === 'amber' && availability.amber_suggestions?.length > 0 && (
              <div className="mt-2">
                <p className="text-xs text-amber-600 font-medium mb-1">Suggested times:</p>
                <div className="flex flex-wrap gap-1">
                  {availability.amber_suggestions.map((suggestion, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        if (isReturn) {
                          const currentDate = formData.return_datetime?.split('T')[0] || formData.quote_date;
                          handleChange("return_datetime", `${currentDate}T${suggestion.time}`);
                        } else {
                          handleChange("quote_time", suggestion.time);
                        }
                      }}
                      className="text-xs px-2 py-1 rounded bg-amber-200 hover:bg-amber-300 text-amber-800 transition-colors"
                    >
                      {suggestion.time} ({suggestion.offset_minutes > 0 ? '+' : ''}{suggestion.offset_minutes} min)
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="new-quote-page">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/quotes")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {isEditing ? "Edit Quote" : "New Quote"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isEditing ? "Update quote details" : "Create a new quote for a customer"}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Customer Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <User className="h-5 w-5" />
                Customer Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 relative">
                  <Label htmlFor="customer_first_name">First Name *</Label>
                  <Input
                    id="customer_first_name"
                    value={formData.customer_first_name}
                    onChange={(e) => {
                      handleChange("customer_first_name", e.target.value);
                      searchContacts(e.target.value, 'name');
                    }}
                    onFocus={() => formData.customer_first_name && formData.customer_first_name.length >= 2 && searchContacts(formData.customer_first_name, 'name')}
                    placeholder="John"
                    data-testid="quote-first-name"
                  />
                  {/* Contact lookup popup */}
                  {showContactPopup && matchedContacts.length > 0 && (
                    <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-auto">
                      <div className="p-2 bg-slate-50 border-b text-xs text-slate-600 font-medium">
                        Matching Contacts
                      </div>
                      {matchedContacts.map((contact, idx) => (
                        <button
                          key={idx}
                          type="button"
                          className="w-full text-left px-3 py-2 hover:bg-slate-50 border-b last:border-b-0 flex items-center gap-3"
                          onClick={() => selectContact(contact)}
                        >
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            contact.type === 'client' ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'
                          }`}>
                            {contact.type === 'client' ? <Building2 className="w-4 h-4" /> : <User className="w-4 h-4" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">
                              {contact.type === 'client' 
                                ? (contact.contact_name || contact.name) 
                                : (contact.name || `${contact.first_name || ''} ${contact.last_name || ''}`)}
                            </p>
                            <p className="text-xs text-slate-500 truncate">
                              {contact.type === 'client' ? contact.company_name : (contact.phone || contact.customer_phone)}
                            </p>
                          </div>
                          <span className={`text-xs px-2 py-0.5 rounded ${
                            contact.type === 'client' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                          }`}>
                            {contact.type === 'client' ? 'Client' : 'Passenger'}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customer_last_name">Last Name *</Label>
                  <Input
                    id="customer_last_name"
                    value={formData.customer_last_name}
                    onChange={(e) => handleChange("customer_last_name", e.target.value)}
                    placeholder="Smith"
                    data-testid="quote-last-name"
                  />
                </div>
              </div>
              <div className="space-y-2 relative">
                <Label htmlFor="customer_phone" className="flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  Phone Number *
                </Label>
                <Input
                  id="customer_phone"
                  value={formData.customer_phone}
                  onChange={(e) => {
                    handleChange("customer_phone", e.target.value);
                    searchContacts(e.target.value, 'phone');
                  }}
                  onFocus={() => formData.customer_phone && formData.customer_phone.length >= 2 && searchContacts(formData.customer_phone, 'phone')}
                  placeholder="+44 7700 900000"
                  data-testid="quote-phone"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="customer_email" className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Email (Optional)
                </Label>
                <Input
                  id="customer_email"
                  type="email"
                  value={formData.customer_email}
                  onChange={(e) => handleChange("customer_email", e.target.value)}
                  placeholder="john@example.com"
                  data-testid="quote-email"
                />
              </div>
            </CardContent>
          </Card>

          {/* Journey Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Car className="h-5 w-5" />
                Journey Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="vehicle_type_id">Vehicle Type</Label>
                <Select
                  value={formData.vehicle_type_id}
                  onValueChange={(value) => handleChange("vehicle_type_id", value)}
                >
                  <SelectTrigger data-testid="quote-vehicle-type">
                    <SelectValue placeholder="Select vehicle type" />
                  </SelectTrigger>
                  <SelectContent>
                    {vehicleTypes.map((vt) => (
                      <SelectItem key={vt.id} value={vt.id}>
                        {vt.name} ({vt.capacity} passengers)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="quote_date" className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Date *
                  </Label>
                  <Input
                    id="quote_date"
                    type="date"
                    value={formData.quote_date}
                    onChange={(e) => handleChange("quote_date", e.target.value)}
                    data-testid="quote-date"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="quote_time" className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Time *
                  </Label>
                  <Input
                    id="quote_time"
                    type="time"
                    value={formData.quote_time}
                    onChange={(e) => handleChange("quote_time", e.target.value)}
                    data-testid="quote-time"
                  />
                </div>
              </div>
              
              {/* Outbound Availability Indicator */}
              {checkingAvailability ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Checking schedule availability...
                </div>
              ) : (
                <AvailabilityIndicator 
                  availability={outboundAvailability} 
                  label="Outbound Journey" 
                  isReturn={false}
                />
              )}
              
              <div className="space-y-2">
                <Label htmlFor="quoted_fare" className="flex items-center gap-2">
                  Quoted Fare (£)
                  {calculatingFare && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                </Label>
                <div className="relative">
                  <Input
                    id="quoted_fare"
                    type="number"
                    step="0.01"
                    value={formData.quoted_fare}
                    onChange={(e) => handleChange("quoted_fare", e.target.value)}
                    placeholder="0.00"
                    data-testid="quote-fare"
                    className={calculatingFare ? "bg-slate-50" : ""}
                  />
                  {routeInfo?.distance && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Distance: {routeInfo.distance.miles?.toFixed(1)} miles • Duration: {routeInfo.duration?.text}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Route Information */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <MapPin className="h-5 w-5" />
                Route Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="pickup_location">Pickup Location *</Label>
                  <AddressAutocomplete
                    value={formData.pickup_location}
                    onChange={(value) => handleChange("pickup_location", value)}
                    placeholder="Enter pickup address or postcode"
                    data-testid="quote-pickup"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dropoff_location">Drop Off Location *</Label>
                  <AddressAutocomplete
                    value={formData.dropoff_location}
                    onChange={(value) => handleChange("dropoff_location", value)}
                    placeholder="Enter drop off address or postcode"
                    data-testid="quote-dropoff"
                  />
                </div>
              </div>

              {/* Additional Stops */}
              <div className="space-y-2">
                <Label>Additional Stops (Optional)</Label>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <AddressAutocomplete
                      value={newStop}
                      onChange={(value) => setNewStop(value)}
                      placeholder="Add a stop"
                    />
                  </div>
                  <Button type="button" variant="outline" onClick={addStop}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {formData.additional_stops.length > 0 && (
                  <div className="space-y-2 mt-2">
                    {formData.additional_stops.map((stop, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-2 bg-slate-50 p-2 rounded-md"
                      >
                        <span className="text-sm text-muted-foreground">
                          Stop {index + 1}:
                        </span>
                        <span className="flex-1 text-sm">{stop}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeStop(index)}
                        >
                          <X className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Return Journey */}
              <div className="space-y-4 border-t pt-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="return_journey"
                    checked={formData.return_journey}
                    onCheckedChange={(checked) => handleChange("return_journey", checked)}
                    data-testid="quote-return-journey"
                  />
                  <Label htmlFor="return_journey" className="flex items-center gap-2 cursor-pointer">
                    <RotateCcw className="h-4 w-4" />
                    Return Journey Required
                  </Label>
                </div>
                {formData.return_journey && (
                  <div className="space-y-4 pl-6">
                    <div className="space-y-2">
                      <Label htmlFor="return_datetime">Return Date & Time</Label>
                      <Input
                        id="return_datetime"
                        type="datetime-local"
                        value={formData.return_datetime}
                        onChange={(e) => handleChange("return_datetime", e.target.value)}
                        data-testid="quote-return-datetime"
                      />
                    </div>
                    
                    {/* Return Availability Indicator */}
                    {formData.return_datetime && (
                      checkingAvailability ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Checking return availability...
                        </div>
                      ) : (
                        <AvailabilityIndicator 
                          availability={returnAvailability} 
                          label="Return Journey" 
                          isReturn={true}
                        />
                      )
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Notes */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg">Additional Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={formData.notes}
                onChange={(e) => handleChange("notes", e.target.value)}
                placeholder="Any additional information about this quote..."
                rows={3}
                data-testid="quote-notes"
              />
            </CardContent>
          </Card>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate("/quotes")}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={saving}
            className="bg-[#D4A853] hover:bg-[#c49843] text-white"
            data-testid="save-quote-btn"
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                {isEditing ? "Update Quote" : "Create Quote"}
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
