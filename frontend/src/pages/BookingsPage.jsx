import { useEffect, useState } from "react";
import axios from "axios";
import { Plus, Edit, Trash2, MapPin, Clock, User, UserCheck, MoreHorizontal, MessageSquare, MessageSquareX, Loader2, Search, X, Calendar } from "lucide-react";
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
import { toast } from "sonner";
import { format } from "date-fns";
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

const BookingForm = ({ booking, drivers, onSave, onClose, isOpen }) => {
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    customer_phone: "",
    pickup_location: "",
    dropoff_location: "",
    booking_datetime: new Date(),
    notes: "",
    fare: "",
    status: "pending",
    driver_id: "",
  });
  const [saving, setSaving] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const [routeInfo, setRouteInfo] = useState(null);
  const [loadingRoute, setLoadingRoute] = useState(false);

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
      setFormData({
        ...booking,
        first_name: firstName,
        last_name: lastName,
        booking_datetime: new Date(booking.booking_datetime),
        fare: booking.fare || "",
        driver_id: booking.driver_id || "",
      });
    } else {
      setFormData({
        first_name: "",
        last_name: "",
        customer_phone: "",
        pickup_location: "",
        dropoff_location: "",
        booking_datetime: new Date(),
        notes: "",
        fare: "",
        status: "pending",
        driver_id: "",
      });
      setRouteInfo(null);
    }
  }, [booking]);

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
      const payload = {
        ...formData,
        booking_datetime: formData.booking_datetime.toISOString(),
        fare: formData.fare ? parseFloat(formData.fare) : null,
        distance_miles: routeInfo?.distance?.miles || null,
        duration_minutes: routeInfo?.duration?.minutes || null,
      };
      if (!payload.driver_id) delete payload.driver_id;
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
              <Label htmlFor="pickup_location">Pickup Location</Label>
              <AddressAutocomplete
                id="pickup_location"
                value={formData.pickup_location}
                onChange={(value) => setFormData({ ...formData, pickup_location: value })}
                placeholder="Start typing address..."
                data-testid="booking-pickup-input"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dropoff_location">Dropoff Location</Label>
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
                      {drivers.filter(d => d.status === 'available' || d.id === formData.driver_id).map((driver) => (
                        <SelectItem key={driver.id} value={driver.id}>
                          {driver.name} ({driver.vehicle_type})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
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
    </Dialog>
  );
};

const VEHICLE_TYPES = ["Sedan", "SUV", "MPV", "Executive", "Estate"];

const AssignDriverDialog = ({ booking, drivers, onAssign, onClose, onDriverAdded }) => {
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

  const availableDrivers = drivers.filter(d => d.status === 'available');

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
              {availableDrivers.length === 0 ? (
                <p className="text-sm text-destructive mb-3">No available drivers at the moment.</p>
              ) : (
                <Select value={selectedDriver} onValueChange={setSelectedDriver}>
                  <SelectTrigger data-testid="assign-driver-select">
                    <SelectValue placeholder="Select a driver" />
                  </SelectTrigger>
                  <SelectContent className="z-[110]">
                    {availableDrivers.map((driver) => (
                      <SelectItem key={driver.id} value={driver.id}>
                        <div className="flex items-center gap-2">
                          <UserCheck className="w-4 h-4" />
                          {driver.name} - {driver.vehicle_type} ({driver.vehicle_number})
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              
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

const BookingViewDialog = ({ booking, driver, onClose, onEdit, onAssignDriver, onRefresh }) => {
  const [sendingSms, setSendingSms] = useState(false);
  
  if (!booking) return null;

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
        <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto pr-2">
          {/* Customer Info */}
          <div className="bg-slate-50 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-slate-600 mb-3">Customer Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Name</p>
                <p className="font-medium">{booking.customer_name}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Phone</p>
                <p className="font-medium">{booking.customer_phone}</p>
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
        </div>
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
  const [bookings, setBookings] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [deleteBooking, setDeleteBooking] = useState(null);
  const [assignBooking, setAssignBooking] = useState(null);
  const [viewBooking, setViewBooking] = useState(null);
  
  // Search and filter states
  const [searchText, setSearchText] = useState("");
  const [filterDate, setFilterDate] = useState(null);
  const [filterDriver, setFilterDriver] = useState("all");
  const [showFilters, setShowFilters] = useState(false);

  const fetchData = async () => {
    try {
      const [bookingsRes, driversRes] = await Promise.all([
        axios.get(`${API}/bookings`),
        axios.get(`${API}/drivers`),
      ]);
      setBookings(bookingsRes.data);
      setDrivers(driversRes.data);
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
      await axios.post(`${API}/bookings/${bookingId}/assign/${driverId}`);
      toast.success("Driver assigned successfully");
      fetchData();
      setAssignBooking(null);
    } catch (error) {
      toast.error("Failed to assign driver");
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

  // Filter bookings based on search criteria
  const filteredBookings = bookings.filter(booking => {
    // Text search (customer name, phone, booking ID)
    if (searchText) {
      const search = searchText.toLowerCase();
      const matchesName = booking.customer_name?.toLowerCase().includes(search);
      const matchesPhone = booking.customer_phone?.toLowerCase().includes(search);
      const matchesBookingId = booking.booking_id?.toLowerCase().includes(search);
      const matchesPickup = booking.pickup_location?.toLowerCase().includes(search);
      const matchesDropoff = booking.dropoff_location?.toLowerCase().includes(search);
      
      if (!matchesName && !matchesPhone && !matchesBookingId && !matchesPickup && !matchesDropoff) {
        return false;
      }
    }
    
    // Date filter
    if (filterDate) {
      const bookingDate = format(new Date(booking.booking_datetime), "yyyy-MM-dd");
      const selectedDate = format(filterDate, "yyyy-MM-dd");
      if (bookingDate !== selectedDate) {
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

  // Sort dates and bookings within each date by time
  const sortedDates = Object.keys(groupedBookings).sort((a, b) => new Date(a) - new Date(b));
  sortedDates.forEach(date => {
    groupedBookings[date].sort((a, b) => new Date(a.booking_datetime) - new Date(b.booking_datetime));
  });

  // Clear all filters
  const clearFilters = () => {
    setSearchText("");
    setFilterDate(null);
    setFilterDriver("all");
  };

  const hasActiveFilters = searchText || filterDate || (filterDriver && filterDriver !== "all");

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
        <Button onClick={handleAdd} className="btn-animate" data-testid="add-booking-btn">
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
              <Button variant="outline" className={cn("w-[180px] justify-start text-left font-normal bg-white", !filterDate && "text-muted-foreground")}>
                <Calendar className="mr-2 h-4 w-4" />
                {filterDate ? format(filterDate, "dd/MM/yyyy") : "Filter by date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 z-50" align="start">
              <CalendarComponent
                mode="single"
                selected={filterDate}
                onSelect={setFilterDate}
                initialFocus
              />
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
        {hasActiveFilters && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Showing {filteredBookings.length} of {bookings.length} bookings</span>
            {filterDate && (
              <Badge variant="secondary" className="gap-1">
                {format(filterDate, "dd/MM/yyyy")}
                <button onClick={() => setFilterDate(null)} className="ml-1 hover:text-foreground">
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
        )}
      </div>

      <div className="page-content">
        {bookings.length === 0 ? (
          <div className="text-center py-16">
            <MapPin className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No bookings yet</h3>
            <p className="text-muted-foreground mb-4">Create your first booking to get started</p>
            <Button onClick={handleAdd} data-testid="add-first-booking-btn">
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
          <div className="space-y-6">
            {sortedDates.map((date) => (
              <div key={date} className="space-y-3">
                {/* Date Header */}
                <div className="sticky top-0 z-10 bg-slate-100 rounded-lg px-4 py-2 shadow-sm">
                  <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide">
                    {format(new Date(date), "EEEE dd/MM/yyyy")}
                  </h2>
                </div>
                
                {/* Bookings for this date */}
                <div className="space-y-2">
                  {groupedBookings[date].map((booking) => (
                    <div
                      key={booking.id}
                      className={`bg-white rounded-lg border-l-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer ${getStatusColor(booking.status)}`}
                      data-testid={`booking-row-${booking.id}`}
                      onClick={() => setViewBooking(booking)}
                    >
                      <div className="p-4">
                        <div className="grid grid-cols-12 gap-4 items-center">
                          {/* Time & Booking ID */}
                          <div className="col-span-2 lg:col-span-1">
                            <p className="text-lg font-bold text-slate-800">
                              {format(new Date(booking.booking_datetime), "HH:mm")}
                            </p>
                            <p className="text-xs font-mono text-primary font-semibold" data-testid={`booking-id-${booking.id}`}>
                              {booking.booking_id || '-'}
                            </p>
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
                                <p className="text-sm font-medium text-slate-800 truncate">{booking.customer_name}</p>
                                <p className="text-xs text-muted-foreground truncate">{booking.customer_phone}</p>
                              </div>
                            </div>
                          </div>

                          {/* Driver */}
                          <div className="col-span-2 lg:col-span-2" onClick={(e) => e.stopPropagation()}>
                            {booking.driver_id ? (
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                                  <UserCheck className="w-4 h-4 text-blue-600" />
                                </div>
                                <span className="text-sm font-medium text-slate-700 truncate">{getDriverName(booking.driver_id)}</span>
                              </div>
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
                            {booking.distance_miles && (
                              <span className="text-xs text-slate-500 hidden lg:inline">
                                {booking.distance_miles} mi
                              </span>
                            )}
                            {booking.fare && (
                              <span className="text-sm font-semibold text-green-600">
                                £{booking.fare.toFixed(2)}
                              </span>
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
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <BookingViewDialog
        booking={viewBooking}
        driver={viewBooking ? drivers.find(d => d.id === viewBooking.driver_id) : null}
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
        onAssign={handleAssignDriver}
        onClose={() => setAssignBooking(null)}
        onDriverAdded={fetchData}
      />

      <AlertDialog open={!!deleteBooking} onOpenChange={() => setDeleteBooking(null)}>
        <AlertDialogContent data-testid="delete-booking-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Booking</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this booking for {deleteBooking?.customer_name}? This action cannot be undone.
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
