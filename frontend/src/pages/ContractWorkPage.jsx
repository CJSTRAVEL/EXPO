import { useEffect, useState } from "react";
import axios from "axios";
import { Building2, Plus, Calendar, MapPin, User, Clock, Loader2, Search, X, FileText, CreditCard, MoreHorizontal, Edit, Trash2, CheckCircle, UserCheck, MessageSquare, Plane, ArrowLeftRight } from "lucide-react";
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
import { cn } from "@/lib/utils";
import AddressAutocomplete from "@/components/AddressAutocomplete";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const ContractWorkPage = () => {
  const [clients, setClients] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [editingBooking, setEditingBooking] = useState(null);
  const [viewBooking, setViewBooking] = useState(null);
  const [deleteBooking, setDeleteBooking] = useState(null);
  const [saving, setSaving] = useState(false);
  
  // Search and filter states
  const [searchText, setSearchText] = useState("");
  const [filterClient, setFilterClient] = useState("all");
  const [filterDate, setFilterDate] = useState(null);
  const [filterDriver, setFilterDriver] = useState("all");
  const [dateOpen, setDateOpen] = useState(false);

  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    customer_phone: "",
    passenger_count: 1,
    luggage_count: 0,
    pickup_location: "",
    dropoff_location: "",
    additional_stops: [],
    booking_datetime: new Date(),
    notes: "",
    fare: "",
    driver_id: "",
    client_id: "",
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
  });
  const [showFlightInfo, setShowFlightInfo] = useState(false);
  const [returnDateOpen, setReturnDateOpen] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [clientsRes, bookingsRes, driversRes] = await Promise.all([
        axios.get(`${API}/clients`),
        axios.get(`${API}/bookings`),
        axios.get(`${API}/drivers`),
      ]);
      
      // Only show active clients
      const activeClients = clientsRes.data.filter(c => c.status === "active");
      setClients(activeClients);
      
      // Only show bookings linked to clients (contract work)
      const contractBookings = bookingsRes.data.filter(b => b.client_id);
      setBookings(contractBookings);
      
      setDrivers(driversRes.data);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
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
      const flightInfo = booking.flight_info || {};
      setFormData({
        first_name: firstName,
        last_name: lastName,
        customer_phone: booking.customer_phone || "",
        passenger_count: booking.passenger_count || 1,
        luggage_count: booking.luggage_count || 0,
        pickup_location: booking.pickup_location || "",
        dropoff_location: booking.dropoff_location || "",
        additional_stops: booking.additional_stops || [],
        booking_datetime: new Date(booking.booking_datetime),
        notes: booking.notes || "",
        fare: booking.fare || "",
        driver_id: booking.driver_id || "",
        client_id: booking.client_id || "",
        flight_number: flightInfo.flight_number || "",
        airline: flightInfo.airline || "",
        flight_type: flightInfo.flight_type || "",
        terminal: flightInfo.terminal || "",
        create_return: false,
        return_pickup_location: "",
        return_dropoff_location: "",
        return_datetime: null,
      });
      setShowFlightInfo(!!flightInfo.flight_number);
    } else {
      setEditingBooking(null);
      // Pre-select client if filtered
      const preselectedClient = filterClient !== "all" ? clients.find(c => c.id === filterClient) : null;
      setFormData({
        first_name: "",
        last_name: "",
        customer_phone: preselectedClient?.mobile || "",
        passenger_count: 1,
        luggage_count: 0,
        pickup_location: preselectedClient?.address ? 
          `${preselectedClient.address}, ${preselectedClient.town_city || ''} ${preselectedClient.post_code || ''}`.trim() : "",
        dropoff_location: "",
        additional_stops: [],
        booking_datetime: new Date(),
        notes: "",
        fare: "",
        driver_id: "",
        client_id: preselectedClient?.id || "",
        flight_number: "",
        airline: "",
        flight_type: "",
        terminal: "",
        create_return: false,
        return_pickup_location: "",
        return_dropoff_location: "",
        return_datetime: null,
      });
      setShowFlightInfo(false);
    }
    setShowBookingForm(true);
  };

  const handleClientSelectInForm = (clientId) => {
    const client = clients.find(c => c.id === clientId);
    if (client) {
      setFormData({
        ...formData,
        client_id: clientId,
        customer_phone: formData.customer_phone || client.mobile || "",
        pickup_location: formData.pickup_location || (client.address ? 
          `${client.address}, ${client.town_city || ''} ${client.post_code || ''}`.trim() : ""),
      });
    } else {
      setFormData({ ...formData, client_id: clientId });
    }
  };

  const handleSaveBooking = async () => {
    if (!formData.client_id) {
      toast.error("Please select a client");
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
        passenger_count: parseInt(formData.passenger_count) || 1,
        luggage_count: parseInt(formData.luggage_count) || 0,
        pickup_location: formData.pickup_location,
        dropoff_location: formData.dropoff_location,
        additional_stops: formData.additional_stops.length > 0 ? formData.additional_stops : null,
        fare: parseFloat(formData.fare) || 0,
        booking_datetime: formData.booking_datetime.toISOString(),
        notes: formData.notes,
        driver_id: formData.driver_id || null,
        client_id: formData.client_id,
        flight_info: flight_info,
        // Return booking fields (only for new bookings)
        create_return: !editingBooking && formData.create_return,
        return_pickup_location: !editingBooking && formData.create_return 
          ? formData.return_pickup_location 
          : null,
        return_dropoff_location: !editingBooking && formData.create_return 
          ? formData.return_dropoff_location 
          : null,
        return_datetime: !editingBooking && formData.create_return && formData.return_datetime 
          ? formData.return_datetime.toISOString() 
          : null,
      };

      if (editingBooking) {
        await axios.put(`${API}/bookings/${editingBooking.id}`, payload);
        toast.success("Booking updated successfully");
      } else {
        await axios.post(`${API}/bookings`, payload);
        toast.success("Contract booking created successfully");
      }
      
      setShowBookingForm(false);
      setViewBooking(null);
      fetchData();
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
      setViewBooking(null);
      fetchData();
    } catch (error) {
      toast.error("Failed to delete booking");
    } finally {
      setSaving(false);
    }
  };

  const clearFilters = () => {
    setSearchText("");
    setFilterClient("all");
    setFilterDate(null);
    setFilterDriver("all");
  };

  const getClientName = (clientId) => {
    const client = clients.find(c => c.id === clientId);
    return client ? client.name : "Unknown";
  };

  const getClientAccountNo = (clientId) => {
    const client = clients.find(c => c.id === clientId);
    return client ? client.account_no : "";
  };

  const getDriverName = (driverId) => {
    const driver = drivers.find(d => d.id === driverId);
    return driver ? driver.name : "Unassigned";
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'border-l-green-500 bg-green-50/30';
      case 'in_progress': return 'border-l-purple-500 bg-purple-50/30';
      case 'assigned': return 'border-l-blue-500 bg-blue-50/30';
      case 'cancelled': return 'border-l-red-500 bg-red-50/30';
      default: return 'border-l-yellow-500 bg-yellow-50/30';
    }
  };

  const getStatusBadgeColor = (status) => {
    switch (status) {
      case "completed": return "bg-green-100 text-green-700";
      case "assigned": return "bg-blue-100 text-blue-700";
      case "in_progress": return "bg-purple-100 text-purple-700";
      case "cancelled": return "bg-red-100 text-red-700";
      default: return "bg-amber-100 text-amber-700";
    }
  };

  // Filter bookings
  const filteredBookings = bookings.filter(booking => {
    // Client filter
    if (filterClient !== "all" && booking.client_id !== filterClient) {
      return false;
    }
    
    // Text search
    if (searchText) {
      const search = searchText.toLowerCase();
      const fullName = booking.customer_name || `${booking.first_name || ''} ${booking.last_name || ''}`.trim();
      const clientName = getClientName(booking.client_id);
      const matchesName = fullName.toLowerCase().includes(search);
      const matchesPhone = booking.customer_phone?.toLowerCase().includes(search);
      const matchesBookingId = booking.booking_id?.toLowerCase().includes(search);
      const matchesPickup = booking.pickup_location?.toLowerCase().includes(search);
      const matchesDropoff = booking.dropoff_location?.toLowerCase().includes(search);
      const matchesClient = clientName.toLowerCase().includes(search);
      
      if (!matchesName && !matchesPhone && !matchesBookingId && !matchesPickup && !matchesDropoff && !matchesClient) {
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
    if (filterDriver !== "all") {
      if (filterDriver === "unassigned" && booking.driver_id) {
        return false;
      }
      if (filterDriver !== "unassigned" && booking.driver_id !== filterDriver) {
        return false;
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

  // Sort dates descending
  const sortedDates = Object.keys(groupedBookings).sort((a, b) => new Date(b) - new Date(a));

  // Sort bookings within each date by time
  sortedDates.forEach(date => {
    groupedBookings[date].sort((a, b) => 
      new Date(a.booking_datetime) - new Date(b.booking_datetime)
    );
  });

  const hasActiveFilters = searchText || filterClient !== "all" || filterDate || filterDriver !== "all";

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div data-testid="contract-work-page">
      <header className="page-header flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <FileText className="w-6 h-6 text-primary" />
            Contract Work
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Account-based bookings linked to clients</p>
        </div>
        <Button onClick={() => handleOpenForm()} className="btn-animate" data-testid="new-contract-booking-btn">
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
              placeholder="Search by name, phone, booking ID, client, or address..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="pl-10 bg-white"
              data-testid="search-input"
            />
          </div>
          
          {/* Client Filter */}
          <Select value={filterClient} onValueChange={setFilterClient}>
            <SelectTrigger className="w-[200px] bg-white" data-testid="filter-client-select">
              <Building2 className="w-4 h-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Filter by client" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Clients</SelectItem>
              {clients.map((client) => (
                <SelectItem key={client.id} value={client.id}>
                  {client.account_no} - {client.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
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
            <span>Showing {filteredBookings.length} of {bookings.length} contract bookings</span>
            {filterClient !== "all" && (
              <Badge variant="secondary" className="gap-1">
                <Building2 className="w-3 h-3" />
                {getClientName(filterClient)}
                <button onClick={() => setFilterClient("all")} className="ml-1 hover:text-foreground">
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            )}
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
            <FileText className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No contract bookings yet</h3>
            <p className="text-muted-foreground mb-4">Create your first contract booking linked to a client</p>
            <Button onClick={() => handleOpenForm()} data-testid="add-first-contract-btn">
              <Plus className="w-4 h-4 mr-2" />
              New Contract Booking
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
                  {groupedBookings[date].map((booking) => {
                    const customerName = booking.customer_name || `${booking.first_name || ''} ${booking.last_name || ''}`.trim();
                    
                    return (
                      <div
                        key={booking.id}
                        className={`bg-white rounded-lg border-l-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer ${getStatusColor(booking.status)}`}
                        data-testid={`contract-booking-${booking.id}`}
                        onClick={() => setViewBooking(booking)}
                      >
                        <div className="p-4">
                          <div className="grid grid-cols-12 gap-4 items-center">
                            {/* Time & Booking ID */}
                            <div className="col-span-2 lg:col-span-1">
                              <p className="text-lg font-bold text-slate-800">
                                {format(new Date(booking.booking_datetime), "HH:mm")}
                              </p>
                              <p className="text-xs font-mono text-primary font-semibold">
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
                                  <p className="text-sm font-medium text-slate-800 truncate">{customerName}</p>
                                  <p className="text-xs text-muted-foreground truncate">{booking.customer_phone}</p>
                                </div>
                              </div>
                            </div>

                            {/* Client Account */}
                            <div className="col-span-2 lg:col-span-2">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                                  <Building2 className="w-4 h-4 text-amber-600" />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-slate-800 truncate">{getClientName(booking.client_id)}</p>
                                  <p className="text-xs text-amber-600 font-mono">{getClientAccountNo(booking.client_id)}</p>
                                </div>
                              </div>
                            </div>

                            {/* Driver & Status */}
                            <div className="col-span-2 lg:col-span-2">
                              <div className="flex items-center gap-2">
                                {booking.driver_id ? (
                                  <>
                                    <UserCheck className="w-4 h-4 text-blue-600" />
                                    <span className="text-sm text-slate-700 truncate">{getDriverName(booking.driver_id)}</span>
                                  </>
                                ) : (
                                  <span className="text-sm text-muted-foreground">Unassigned</span>
                                )}
                              </div>
                              <Badge className={`mt-1 ${getStatusBadgeColor(booking.status)}`}>
                                {booking.status}
                              </Badge>
                            </div>

                            {/* Fare & Actions */}
                            <div className="col-span-12 lg:col-span-1 flex items-center justify-between lg:justify-end gap-2">
                              <p className="text-lg font-bold text-primary">
                                £{(booking.fare || 0).toFixed(2)}
                              </p>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                  <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <MoreHorizontal className="w-4 h-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleOpenForm(booking); }}>
                                    <Edit className="w-4 h-4 mr-2" />
                                    Edit Booking
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem 
                                    onClick={(e) => { e.stopPropagation(); setDeleteBooking(booking); }}
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
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* View Booking Modal */}
      <Dialog open={!!viewBooking} onOpenChange={() => setViewBooking(null)}>
        <DialogContent className="sm:max-w-[500px]" data-testid="view-contract-booking-modal">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span>Booking {viewBooking?.booking_id}</span>
              <Badge className={getStatusBadgeColor(viewBooking?.status)}>{viewBooking?.status}</Badge>
            </DialogTitle>
          </DialogHeader>
          
          {viewBooking && (
            <div className="space-y-4">
              {/* Client Info */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-amber-600" />
                  <span className="font-medium">{getClientName(viewBooking.client_id)}</span>
                  <Badge variant="outline" className="text-xs">{getClientAccountNo(viewBooking.client_id)}</Badge>
                </div>
                <p className="text-xs text-amber-700 mt-1">Payment on Account</p>
              </div>

              {/* Customer Info */}
              <div className="bg-slate-50 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-slate-600 mb-3">Passenger</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Name</p>
                    <p className="font-medium">{viewBooking.customer_name || `${viewBooking.first_name || ''} ${viewBooking.last_name || ''}`.trim()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Phone</p>
                    <p className="font-medium">{viewBooking.customer_phone}</p>
                  </div>
                </div>
              </div>

              {/* Journey Details */}
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="flex flex-col items-center">
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    <div className="w-0.5 h-8 bg-slate-300"></div>
                    {viewBooking.additional_stops && viewBooking.additional_stops.length > 0 && (
                      viewBooking.additional_stops.map((_, idx) => (
                        <div key={idx} className="flex flex-col items-center">
                          <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                          <div className="w-0.5 h-8 bg-slate-300"></div>
                        </div>
                      ))
                    )}
                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  </div>
                  <div className="flex-1 space-y-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Pickup</p>
                      <p className="text-sm">{viewBooking.pickup_location}</p>
                    </div>
                    {viewBooking.additional_stops && viewBooking.additional_stops.map((stop, idx) => (
                      <div key={idx}>
                        <p className="text-xs text-amber-600">Stop {idx + 1}</p>
                        <p className="text-sm">{stop}</p>
                      </div>
                    ))}
                    <div>
                      <p className="text-xs text-muted-foreground">Drop-off</p>
                      <p className="text-sm">{viewBooking.dropoff_location}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Flight Information */}
              {viewBooking.flight_info && (viewBooking.flight_info.flight_number || viewBooking.flight_info.airline) && (
                <div className="bg-purple-50 rounded-lg p-3">
                  <h4 className="text-xs font-semibold text-purple-700 mb-2 flex items-center gap-1">
                    <Plane className="w-3 h-3" />
                    Flight Info
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {viewBooking.flight_info.flight_number && (
                      <div>
                        <p className="text-xs text-muted-foreground">Flight</p>
                        <p className="font-medium">{viewBooking.flight_info.flight_number}</p>
                      </div>
                    )}
                    {viewBooking.flight_info.airline && (
                      <div>
                        <p className="text-xs text-muted-foreground">Airline</p>
                        <p className="font-medium">{viewBooking.flight_info.airline}</p>
                      </div>
                    )}
                    {viewBooking.flight_info.flight_type && (
                      <div>
                        <p className="text-xs text-muted-foreground">Type</p>
                        <p className="font-medium capitalize">{viewBooking.flight_info.flight_type}</p>
                      </div>
                    )}
                    {viewBooking.flight_info.terminal && (
                      <div>
                        <p className="text-xs text-muted-foreground">Terminal</p>
                        <p className="font-medium">{viewBooking.flight_info.terminal}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Linked Booking (Return Journey) */}
              {(viewBooking.linked_booking_id || viewBooking.is_return) && (
                <div className="bg-slate-100 rounded-lg p-3">
                  <h4 className="text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                    <ArrowLeftRight className="w-3 h-3" />
                    {viewBooking.is_return ? "Return Journey" : "Linked Return"}
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    {viewBooking.is_return 
                      ? "This is a return journey"
                      : "A return booking exists for this journey"}
                  </p>
                </div>
              )}

              {/* Date, Driver, Fare */}
              <div className="grid grid-cols-3 gap-4 pt-2 border-t">
                <div>
                  <p className="text-xs text-muted-foreground">Date & Time</p>
                  <p className="font-medium">{format(new Date(viewBooking.booking_datetime), "dd/MM/yyyy HH:mm")}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Driver</p>
                  <p className="font-medium">{getDriverName(viewBooking.driver_id)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Fare</p>
                  <p className="font-bold text-primary text-lg">£{(viewBooking.fare || 0).toFixed(2)}</p>
                </div>
              </div>

              {viewBooking.notes && (
                <div className="pt-2 border-t">
                  <p className="text-xs text-muted-foreground">Notes</p>
                  <p className="text-sm">{viewBooking.notes}</p>
                </div>
              )}
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewBooking(null)}>Close</Button>
            <Button onClick={() => { handleOpenForm(viewBooking); }}>
              <Edit className="w-4 h-4 mr-2" />
              Edit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New/Edit Booking Modal */}
      <Dialog open={showBookingForm} onOpenChange={setShowBookingForm}>
        <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto" data-testid="contract-booking-form">
          <DialogHeader>
            <DialogTitle>
              {editingBooking ? "Edit Contract Booking" : "New Contract Booking"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Client Selection */}
            <div className="space-y-2">
              <Label>Client Account *</Label>
              <Select
                value={formData.client_id || ""}
                onValueChange={handleClientSelectInForm}
              >
                <SelectTrigger data-testid="form-client-select">
                  <SelectValue placeholder="Select a client..." />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-primary" />
                        {client.account_no} - {client.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formData.client_id && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 text-xs text-amber-700">
                  <CreditCard className="w-3 h-3 inline mr-1" />
                  This booking will be added to the client&apos;s account for invoicing
                </div>
              )}
            </div>

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

            {/* PAX and Cases */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>PAX (Passengers)</Label>
                <Input
                  type="number"
                  min="1"
                  max="20"
                  value={formData.passenger_count}
                  onChange={(e) => setFormData({ ...formData, passenger_count: e.target.value })}
                  placeholder="1"
                  data-testid="contract-pax"
                />
              </div>
              <div className="space-y-2">
                <Label>Cases (Luggage)</Label>
                <Input
                  type="number"
                  min="0"
                  max="20"
                  value={formData.luggage_count}
                  onChange={(e) => setFormData({ ...formData, luggage_count: e.target.value })}
                  placeholder="0"
                  data-testid="contract-cases"
                />
              </div>
            </div>

            {/* Locations */}
            <div className="space-y-2">
              <Label>Pickup Location *</Label>
              <AddressAutocomplete
                value={formData.pickup_location}
                onChange={(value) => setFormData({ ...formData, pickup_location: value })}
                placeholder="Start typing address..."
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
                  data-testid="contract-add-stop-btn"
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
                        data-testid={`contract-stop-${index}-input`}
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
                      data-testid={`contract-remove-stop-${index}-btn`}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))
              )}
            </div>

            <div className="space-y-2">
              <Label>Final Drop-off Location *</Label>
              <AddressAutocomplete
                value={formData.dropoff_location}
                onChange={(value) => setFormData({ ...formData, dropoff_location: value })}
                placeholder="Start typing address..."
              />
            </div>

            {/* Flight Information Toggle */}
            <div className="space-y-3 border rounded-lg p-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showFlightInfo}
                  onChange={(e) => setShowFlightInfo(e.target.checked)}
                  className="rounded"
                  data-testid="contract-flight-info-toggle"
                />
                <span className="text-sm font-medium">Airport Transfer / Flight Info</span>
              </label>
              
              {showFlightInfo && (
                <div className="space-y-3 pt-2 border-t">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Flight Number</Label>
                      <Input
                        value={formData.flight_number}
                        onChange={(e) => setFormData({ ...formData, flight_number: e.target.value.toUpperCase() })}
                        placeholder="BA123"
                        data-testid="contract-flight-number"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Airline</Label>
                      <Input
                        value={formData.airline}
                        onChange={(e) => setFormData({ ...formData, airline: e.target.value })}
                        placeholder="British Airways"
                        data-testid="contract-airline"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Flight Type</Label>
                      <Select
                        value={formData.flight_type || ""}
                        onValueChange={(value) => setFormData({ ...formData, flight_type: value })}
                      >
                        <SelectTrigger data-testid="contract-flight-type">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="arrival">Arrival (Pickup)</SelectItem>
                          <SelectItem value="departure">Departure (Drop-off)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Terminal</Label>
                      <Input
                        value={formData.terminal}
                        onChange={(e) => setFormData({ ...formData, terminal: e.target.value })}
                        placeholder="Terminal 5"
                        data-testid="contract-terminal"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Date/Time and Fare */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date & Time *</Label>
                <Popover open={dateOpen} onOpenChange={setDateOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                      <Calendar className="w-4 h-4 mr-2" />
                      {format(formData.booking_datetime, "dd/MM/yy HH:mm")}
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

            {/* Return Booking Option (only for new bookings) */}
            {!editingBooking && (
              <div className="space-y-3 border-2 border-amber-300 rounded-lg p-3 bg-amber-50/50">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.create_return}
                    onChange={(e) => {
                      const isChecked = e.target.checked;
                      setFormData({ 
                        ...formData, 
                        create_return: isChecked,
                        return_pickup_location: isChecked ? formData.dropoff_location : "",
                        return_dropoff_location: isChecked ? formData.pickup_location : "",
                        return_datetime: isChecked ? new Date(formData.booking_datetime.getTime() + 3600000 * 3) : null
                      });
                    }}
                    className="rounded"
                    data-testid="contract-create-return-toggle"
                  />
                  <span className="text-sm font-semibold text-amber-800">Create Return Journey</span>
                </label>
                
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
                        data-testid="contract-return-pickup-input"
                      />
                    </div>

                    {/* Return Dropoff Location */}
                    <div className="space-y-2">
                      <Label className="text-amber-800">Return Dropoff Location</Label>
                      <AddressAutocomplete
                        value={formData.return_dropoff_location}
                        onChange={(value) => setFormData({ ...formData, return_dropoff_location: value })}
                        placeholder="Where to drop off on return..."
                        data-testid="contract-return-dropoff-input"
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
                            data-testid="contract-return-datetime-btn"
                          >
                            <Clock className="mr-2 h-4 w-4 text-amber-600" />
                            {formData.return_datetime 
                              ? format(formData.return_datetime, "dd/MM/yy 'at' HH:mm") 
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
                              data-testid="contract-return-time-input"
                            />
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>

                    <p className="text-xs text-amber-700 bg-amber-100 rounded p-2">
                      ↩️ A separate return booking will be created for the same passenger
                    </p>
                  </div>
                )}
              </div>
            )}

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
              This will remove it from the client&apos;s account.
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
