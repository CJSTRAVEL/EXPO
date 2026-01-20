import { useEffect, useState } from "react";
import axios from "axios";
import { Building2, Plus, Calendar, MapPin, User, Phone, Clock, Loader2, Search, X, FileText, CreditCard, MoreHorizontal, Edit, Trash2, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { toast } from "sonner";
import { format } from "date-fns";
import AddressAutocomplete from "@/components/AddressAutocomplete";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const ContractWorkPage = () => {
  const [clients, setClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [clientBookings, setClientBookings] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [editingBooking, setEditingBooking] = useState(null);
  const [deleteBooking, setDeleteBooking] = useState(null);
  const [saving, setSaving] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [dateOpen, setDateOpen] = useState(false);

  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    customer_phone: "",
    pickup_location: "",
    dropoff_location: "",
    booking_datetime: new Date(),
    notes: "",
    fare: "",
    driver_id: "",
  });

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (selectedClient) {
      fetchClientBookings(selectedClient.id);
    }
  }, [selectedClient]);

  const fetchInitialData = async () => {
    try {
      const [clientsRes, driversRes] = await Promise.all([
        axios.get(`${API}/clients`),
        axios.get(`${API}/drivers`),
      ]);
      // Only show active clients
      const activeClients = clientsRes.data.filter(c => c.status === "active");
      setClients(activeClients);
      setDrivers(driversRes.data);
      
      // Auto-select first client if available
      if (activeClients.length > 0) {
        setSelectedClient(activeClients[0]);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const fetchClientBookings = async (clientId) => {
    setLoadingBookings(true);
    try {
      const response = await axios.get(`${API}/clients/${clientId}/bookings`);
      // Sort by date descending
      const sorted = response.data.sort((a, b) => 
        new Date(b.booking_datetime) - new Date(a.booking_datetime)
      );
      setClientBookings(sorted);
    } catch (error) {
      console.error("Error fetching client bookings:", error);
      setClientBookings([]);
    } finally {
      setLoadingBookings(false);
    }
  };

  const handleOpenForm = (booking = null) => {
    if (booking) {
      setEditingBooking(booking);
      let firstName = booking.first_name || "";
      let lastName = booking.last_name || "";
      if (!firstName && !lastName && booking.customer_name) {
        const nameParts = booking.customer_name.split(" ");
        firstName = nameParts[0] || "";
        lastName = nameParts.slice(1).join(" ") || "";
      }
      setFormData({
        first_name: firstName,
        last_name: lastName,
        customer_phone: booking.customer_phone || "",
        pickup_location: booking.pickup_location || "",
        dropoff_location: booking.dropoff_location || "",
        booking_datetime: new Date(booking.booking_datetime),
        notes: booking.notes || "",
        fare: booking.fare || "",
        driver_id: booking.driver_id || "",
      });
    } else {
      setEditingBooking(null);
      setFormData({
        first_name: "",
        last_name: "",
        customer_phone: selectedClient?.mobile || "",
        pickup_location: selectedClient?.address ? 
          `${selectedClient.address}, ${selectedClient.town_city || ''} ${selectedClient.post_code || ''}`.trim() : "",
        dropoff_location: "",
        booking_datetime: new Date(),
        notes: "",
        fare: "",
        driver_id: "",
      });
    }
    setShowBookingForm(true);
  };

  const handleSaveBooking = async () => {
    if (!selectedClient) {
      toast.error("Please select a client first");
      return;
    }
    if (!formData.first_name || !formData.last_name || !formData.customer_phone) {
      toast.error("Please fill in passenger details");
      return;
    }
    if (!formData.pickup_location || !formData.dropoff_location) {
      toast.error("Please enter pickup and drop-off locations");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...formData,
        fare: parseFloat(formData.fare) || 0,
        booking_datetime: formData.booking_datetime.toISOString(),
        client_id: selectedClient.id, // Always link to client
        driver_id: formData.driver_id || null,
      };

      if (editingBooking) {
        await axios.put(`${API}/bookings/${editingBooking.id}`, payload);
        toast.success("Booking updated successfully");
      } else {
        await axios.post(`${API}/bookings`, payload);
        toast.success("Contract booking created successfully");
      }
      
      setShowBookingForm(false);
      fetchClientBookings(selectedClient.id);
      // Refresh client data to update totals
      const clientsRes = await axios.get(`${API}/clients`);
      const activeClients = clientsRes.data.filter(c => c.status === "active");
      setClients(activeClients);
      const updatedClient = activeClients.find(c => c.id === selectedClient.id);
      if (updatedClient) setSelectedClient(updatedClient);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to save booking");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBooking = async () => {
    if (!deleteBooking) return;
    
    setSaving(true);
    try {
      await axios.delete(`${API}/bookings/${deleteBooking.id}`);
      toast.success("Booking deleted successfully");
      setDeleteBooking(null);
      fetchClientBookings(selectedClient.id);
    } catch (error) {
      toast.error("Failed to delete booking");
    } finally {
      setSaving(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "completed": return "bg-green-100 text-green-700";
      case "assigned": return "bg-blue-100 text-blue-700";
      case "in_progress": return "bg-purple-100 text-purple-700";
      case "cancelled": return "bg-red-100 text-red-700";
      default: return "bg-amber-100 text-amber-700";
    }
  };

  const getDriverName = (driverId) => {
    const driver = drivers.find(d => d.id === driverId);
    return driver ? driver.name : "Unassigned";
  };

  // Filter clients by search
  const filteredClients = clients.filter(client => {
    if (!searchText) return true;
    const search = searchText.toLowerCase();
    return (
      client.name?.toLowerCase().includes(search) ||
      client.account_no?.toLowerCase().includes(search)
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div data-testid="contract-work-page" className="flex h-[calc(100vh-2rem)]">
      {/* Left Panel - Client Selection */}
      <div className="w-[320px] border-r bg-white flex flex-col">
        <div className="p-4 border-b">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Contract Work
          </h1>
          <p className="text-sm text-muted-foreground">Account-based bookings</p>
        </div>

        {/* Client Search */}
        <div className="p-4 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search clients..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="pl-10"
              data-testid="client-search"
            />
            {searchText && (
              <button
                onClick={() => setSearchText("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Client List */}
        <div className="flex-1 overflow-y-auto">
          {filteredClients.length === 0 ? (
            <div className="text-center py-12 px-4">
              <Building2 className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground text-sm">
                {searchText ? "No clients found" : "No active clients"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Add clients in the Clients page first
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {filteredClients.map((client) => (
                <div
                  key={client.id}
                  onClick={() => setSelectedClient(client)}
                  className={`p-4 cursor-pointer transition-colors hover:bg-slate-50 ${
                    selectedClient?.id === client.id ? "bg-blue-50 border-l-4 border-l-primary" : ""
                  }`}
                  data-testid={`client-select-${client.id}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Building2 className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-800 truncate">{client.name}</p>
                      <p className="text-xs text-muted-foreground">{client.account_no}</p>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {client.booking_count || 0} bookings
                    </span>
                    <span className="font-medium text-primary">
                      £{(client.total_invoice || 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Client Bookings */}
      <div className="flex-1 bg-slate-50 flex flex-col overflow-hidden">
        {selectedClient ? (
          <>
            {/* Client Header */}
            <div className="bg-white border-b p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Building2 className="w-7 h-7 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">{selectedClient.name}</h2>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <span>{selectedClient.account_no}</span>
                      <span>•</span>
                      <span>{selectedClient.client_type}</span>
                      <span>•</span>
                      <Badge variant="outline" className="text-xs">
                        <CreditCard className="w-3 h-3 mr-1" />
                        {selectedClient.payment_method}
                      </Badge>
                    </div>
                  </div>
                </div>
                <Button onClick={() => handleOpenForm()} data-testid="new-contract-booking-btn">
                  <Plus className="w-4 h-4 mr-2" />
                  New Booking
                </Button>
              </div>

              {/* Client Stats */}
              <div className="grid grid-cols-3 gap-4 mt-4">
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Total Bookings</p>
                  <p className="text-2xl font-bold">{selectedClient.booking_count || 0}</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Account Balance</p>
                  <p className="text-2xl font-bold text-primary">£{(selectedClient.total_invoice || 0).toFixed(2)}</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Contact</p>
                  <p className="text-sm font-medium truncate">{selectedClient.mobile}</p>
                </div>
              </div>
            </div>

            {/* Bookings List */}
            <div className="flex-1 overflow-y-auto p-4">
              <h3 className="text-sm font-semibold text-slate-600 mb-3">
                Contract Bookings ({clientBookings.length})
              </h3>
              
              {loadingBookings ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : clientBookings.length === 0 ? (
                <div className="bg-white rounded-xl border p-8 text-center">
                  <Calendar className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
                  <p className="text-muted-foreground">No bookings for this client yet</p>
                  <Button onClick={() => handleOpenForm()} className="mt-4" variant="outline">
                    <Plus className="w-4 h-4 mr-2" />
                    Create First Booking
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {clientBookings.map((booking) => {
                    const customerName = booking.customer_name || 
                      `${booking.first_name || ''} ${booking.last_name || ''}`.trim();
                    const bookingDate = new Date(booking.booking_datetime);
                    
                    return (
                      <div
                        key={booking.id}
                        className="bg-white rounded-xl border p-4 hover:shadow-md transition-shadow"
                        data-testid={`contract-booking-${booking.id}`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3">
                            <div className="text-center min-w-[50px]">
                              <p className="text-2xl font-bold text-primary">
                                {format(bookingDate, 'dd')}
                              </p>
                              <p className="text-xs text-muted-foreground uppercase">
                                {format(bookingDate, 'MMM')}
                              </p>
                            </div>
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-semibold">{booking.booking_id}</span>
                                <Badge className={getStatusColor(booking.status)}>
                                  {booking.status}
                                </Badge>
                              </div>
                              <p className="text-sm text-slate-700 flex items-center gap-1">
                                <User className="w-3 h-3" />
                                {customerName}
                              </p>
                              <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                                <p className="flex items-center gap-1">
                                  <MapPin className="w-3 h-3 text-green-500" />
                                  {booking.pickup_location?.substring(0, 40)}...
                                </p>
                                <p className="flex items-center gap-1">
                                  <MapPin className="w-3 h-3 text-red-500" />
                                  {booking.dropoff_location?.substring(0, 40)}...
                                </p>
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold text-primary">
                              £{(booking.fare || 0).toFixed(2)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {format(bookingDate, 'HH:mm')}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {getDriverName(booking.driver_id)}
                            </p>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="mt-1">
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleOpenForm(booking)}>
                                  <Edit className="w-4 h-4 mr-2" />
                                  Edit Booking
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  onClick={() => setDeleteBooking(booking)}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Delete Booking
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Building2 className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
              <p className="text-lg font-medium text-muted-foreground">Select a Client</p>
              <p className="text-sm text-muted-foreground">Choose a client from the list to manage their contract bookings</p>
            </div>
          </div>
        )}
      </div>

      {/* New/Edit Booking Modal */}
      <Dialog open={showBookingForm} onOpenChange={setShowBookingForm}>
        <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto" data-testid="contract-booking-form">
          <DialogHeader>
            <DialogTitle>
              {editingBooking ? "Edit Contract Booking" : "New Contract Booking"}
            </DialogTitle>
            {selectedClient && (
              <div className="flex items-center gap-2 mt-2 p-2 bg-primary/5 rounded-lg">
                <Building2 className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">{selectedClient.name}</span>
                <Badge variant="outline" className="text-xs">{selectedClient.account_no}</Badge>
              </div>
            )}
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Passenger Details */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>First Name *</Label>
                <Input
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  placeholder="John"
                  data-testid="contract-first-name"
                />
              </div>
              <div className="space-y-2">
                <Label>Last Name *</Label>
                <Input
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  placeholder="Smith"
                  data-testid="contract-last-name"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Phone *</Label>
              <Input
                value={formData.customer_phone}
                onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })}
                placeholder="07700 900000"
                data-testid="contract-phone"
              />
            </div>

            {/* Locations */}
            <div className="space-y-2">
              <Label>Pickup Location *</Label>
              <AddressAutocomplete
                value={formData.pickup_location}
                onChange={(value) => setFormData({ ...formData, pickup_location: value })}
                placeholder="Start typing address..."
                data-testid="contract-pickup"
              />
            </div>

            <div className="space-y-2">
              <Label>Drop-off Location *</Label>
              <AddressAutocomplete
                value={formData.dropoff_location}
                onChange={(value) => setFormData({ ...formData, dropoff_location: value })}
                placeholder="Start typing address..."
                data-testid="contract-dropoff"
              />
            </div>

            {/* Date/Time and Fare */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date & Time *</Label>
                <Popover open={dateOpen} onOpenChange={setDateOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                      <Calendar className="w-4 h-4 mr-2" />
                      {format(formData.booking_datetime, "PPP HH:mm")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={formData.booking_datetime}
                      onSelect={(date) => {
                        if (date) {
                          const newDate = new Date(date);
                          newDate.setHours(formData.booking_datetime.getHours());
                          newDate.setMinutes(formData.booking_datetime.getMinutes());
                          setFormData({ ...formData, booking_datetime: newDate });
                        }
                      }}
                    />
                    <div className="p-3 border-t">
                      <Input
                        type="time"
                        value={format(formData.booking_datetime, "HH:mm")}
                        onChange={(e) => {
                          const [hours, minutes] = e.target.value.split(":");
                          const newDate = new Date(formData.booking_datetime);
                          newDate.setHours(parseInt(hours), parseInt(minutes));
                          setFormData({ ...formData, booking_datetime: newDate });
                        }}
                      />
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>Fare (£)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.fare}
                  onChange={(e) => setFormData({ ...formData, fare: e.target.value })}
                  placeholder="0.00"
                  data-testid="contract-fare"
                />
              </div>
            </div>

            {/* Driver Assignment */}
            <div className="space-y-2">
              <Label>Assign Driver</Label>
              <Select
                value={formData.driver_id || "unassigned"}
                onValueChange={(value) => setFormData({ ...formData, driver_id: value === "unassigned" ? "" : value })}
              >
                <SelectTrigger data-testid="contract-driver-select">
                  <SelectValue placeholder="Select driver..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {drivers.filter(d => d.status === "available" || d.id === formData.driver_id).map((driver) => (
                    <SelectItem key={driver.id} value={driver.id}>
                      {driver.name} - {driver.vehicle_type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Any special instructions..."
                rows={3}
                data-testid="contract-notes"
              />
            </div>

            {/* Payment Info */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <div className="flex items-center gap-2 text-amber-800">
                <CreditCard className="w-4 h-4" />
                <span className="text-sm font-medium">Payment on Account</span>
              </div>
              <p className="text-xs text-amber-700 mt-1">
                This booking will be added to {selectedClient?.name}'s account for invoicing
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBookingForm(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveBooking} disabled={saving} data-testid="save-contract-booking-btn">
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : editingBooking ? (
                "Update Booking"
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Create Booking
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteBooking} onOpenChange={() => setDeleteBooking(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Booking</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete booking {deleteBooking?.booking_id}? 
              This will remove it from the client's account.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteBooking}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {saving ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ContractWorkPage;
