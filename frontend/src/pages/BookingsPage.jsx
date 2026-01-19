import { useEffect, useState } from "react";
import axios from "axios";
import { Plus, Edit, Trash2, MapPin, Clock, User, UserCheck, MoreHorizontal, MessageSquare, MessageSquareX } from "lucide-react";
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
import { Calendar } from "@/components/ui/calendar";
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
    customer_name: "",
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
      setFormData({
        ...booking,
        booking_datetime: new Date(booking.booking_datetime),
        fare: booking.fare || "",
        driver_id: booking.driver_id || "",
      });
    } else {
      setFormData({
        customer_name: "",
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
                <Label htmlFor="customer_name">Customer Name</Label>
                <Input
                  id="customer_name"
                  value={formData.customer_name}
                  onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                  placeholder="John Doe"
                  required
                  data-testid="booking-customer-name-input"
                />
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
                    <Calendar
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
                    value={formData.driver_id}
                    onValueChange={(value) => setFormData({ ...formData, driver_id: value })}
                  >
                    <SelectTrigger data-testid="booking-driver-select">
                      <SelectValue placeholder="Select driver" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">No driver</SelectItem>
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

const AssignDriverDialog = ({ booking, drivers, onAssign, onClose }) => {
  const [selectedDriver, setSelectedDriver] = useState("");

  const availableDrivers = drivers.filter(d => d.status === 'available');

  const handleAssign = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (selectedDriver && booking) {
      onAssign(booking.id, selectedDriver);
    }
  };

  return (
    <Dialog open={!!booking} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[400px] z-[100]" data-testid="assign-driver-modal">
        <DialogHeader>
          <DialogTitle>Assign Driver</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <p className="text-sm text-muted-foreground mb-4">
            Assign a driver to booking for {booking?.customer_name}
          </p>
          {availableDrivers.length === 0 ? (
            <p className="text-sm text-destructive">No available drivers at the moment.</p>
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
        </div>
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
        ) : (
          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/50">
                  <TableHead className="font-semibold">Customer</TableHead>
                  <TableHead className="font-semibold">Route</TableHead>
                  <TableHead className="font-semibold">Miles</TableHead>
                  <TableHead className="font-semibold">Date & Time</TableHead>
                  <TableHead className="font-semibold">Driver</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                  <TableHead className="font-semibold text-right">Fare</TableHead>
                  <TableHead className="w-[60px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bookings.map((booking) => (
                  <TableRow 
                    key={booking.id} 
                    className="table-row-hover"
                    data-testid={`booking-row-${booking.id}`}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm">{booking.customer_name}</p>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger>
                                  {booking.sms_sent ? (
                                    <MessageSquare className="w-3.5 h-3.5 text-green-600" data-testid={`sms-sent-${booking.id}`} />
                                  ) : (
                                    <MessageSquareX className="w-3.5 h-3.5 text-muted-foreground" data-testid={`sms-pending-${booking.id}`} />
                                  )}
                                </TooltipTrigger>
                                <TooltipContent>
                                  {booking.sms_sent ? "SMS confirmation sent" : "SMS not sent"}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                          <p className="text-xs text-muted-foreground">{booking.customer_phone}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="max-w-[200px]">
                        <p className="text-sm truncate">{booking.pickup_location}</p>
                        <p className="text-xs text-muted-foreground truncate">→ {booking.dropoff_location}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {booking.distance_miles ? (
                        <div className="text-center">
                          <p className="text-sm font-semibold text-blue-600">{booking.distance_miles}</p>
                          <p className="text-xs text-muted-foreground">
                            {booking.duration_minutes ? `${Math.floor(booking.duration_minutes / 60)}h ${booking.duration_minutes % 60}m` : ''}
                          </p>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="w-4 h-4 text-muted-foreground" />
                        {format(new Date(booking.booking_datetime), "MMM d, h:mm a")}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{getDriverName(booking.driver_id)}</span>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(booking.status)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {booking.fare ? `£${booking.fare.toFixed(2)}` : '-'}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8" data-testid={`booking-actions-${booking.id}`}>
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
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
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

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
