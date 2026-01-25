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
import { ArrowLeft, Plus, X, Save, MapPin, User, Phone, Mail, Car, Calendar, Clock, RotateCcw, Loader2, Building2 } from "lucide-react";
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
                <div className="space-y-2">
                  <Label htmlFor="customer_first_name">First Name *</Label>
                  <Input
                    id="customer_first_name"
                    value={formData.customer_first_name}
                    onChange={(e) => handleChange("customer_first_name", e.target.value)}
                    placeholder="John"
                    data-testid="quote-first-name"
                  />
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
              <div className="space-y-2">
                <Label htmlFor="customer_phone" className="flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  Phone Number *
                </Label>
                <Input
                  id="customer_phone"
                  value={formData.customer_phone}
                  onChange={(e) => handleChange("customer_phone", e.target.value)}
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
                  <Input
                    id="pickup_location"
                    value={formData.pickup_location}
                    onChange={(e) => handleChange("pickup_location", e.target.value)}
                    placeholder="Enter pickup address"
                    data-testid="quote-pickup"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dropoff_location">Drop Off Location *</Label>
                  <Input
                    id="dropoff_location"
                    value={formData.dropoff_location}
                    onChange={(e) => handleChange("dropoff_location", e.target.value)}
                    placeholder="Enter drop off address"
                    data-testid="quote-dropoff"
                  />
                </div>
              </div>

              {/* Additional Stops */}
              <div className="space-y-2">
                <Label>Additional Stops (Optional)</Label>
                <div className="flex gap-2">
                  <Input
                    value={newStop}
                    onChange={(e) => setNewStop(e.target.value)}
                    placeholder="Add a stop"
                    onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addStop())}
                  />
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
                  <div className="space-y-2 pl-6">
                    <Label htmlFor="return_datetime">Return Date & Time</Label>
                    <Input
                      id="return_datetime"
                      type="datetime-local"
                      value={formData.return_datetime}
                      onChange={(e) => handleChange("return_datetime", e.target.value)}
                      data-testid="quote-return-datetime"
                    />
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
