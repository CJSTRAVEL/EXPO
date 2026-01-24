import { useEffect, useState } from "react";
import axios from "axios";
import { User, Phone, MapPin, Calendar, Clock, Search, ChevronRight, MessageSquare, X, Pencil, Mail, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { format } from "date-fns";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const getStatusBadge = (status) => {
  const variants = {
    pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
    assigned: "bg-blue-100 text-blue-800 border-blue-200",
    in_progress: "bg-purple-100 text-purple-800 border-purple-200",
    completed: "bg-green-100 text-green-800 border-green-200",
    cancelled: "bg-red-100 text-red-800 border-red-200",
  };
  return (
    <Badge variant="outline" className={`${variants[status] || variants.pending} text-xs`}>
      {status?.replace("_", " ").toUpperCase()}
    </Badge>
  );
};

const PassengerCard = ({ passenger, onClick }) => {
  return (
    <div 
      className="bg-white rounded-lg border shadow-sm hover:shadow-md transition-all cursor-pointer p-4"
      onClick={onClick}
      data-testid={`passenger-card-${passenger.phone}`}
    >
      <div className="flex items-center gap-4">
        {/* Avatar */}
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
          <User className="w-6 h-6 text-primary" />
        </div>
        
        {/* Info */}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-slate-800 truncate">{passenger.name}</h3>
          <p className="text-sm text-muted-foreground flex items-center gap-1">
            <Phone className="w-3 h-3" />
            {passenger.phone}
          </p>
        </div>
        
        {/* Stats */}
        <div className="flex items-center gap-4 text-right">
          <div>
            <p className="text-lg font-bold text-primary">{passenger.totalBookings}</p>
            <p className="text-xs text-muted-foreground">Bookings</p>
          </div>
          <div>
            <p className="text-lg font-bold text-green-600">£{passenger.totalFare.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">Total Fare</p>
          </div>
          <ChevronRight className="w-5 h-5 text-muted-foreground" />
        </div>
      </div>
    </div>
  );
};

const PassengerDetailModal = ({ passenger, bookings, onClose, onEdit }) => {
  if (!passenger) return null;

  const passengerBookings = bookings.filter(b => b.customer_phone === passenger.phone);

  return (
    <Dialog open={!!passenger} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-hidden flex flex-col" data-testid="passenger-detail-modal">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">{passenger.name}</h2>
                <p className="text-sm text-muted-foreground font-normal flex items-center gap-1">
                  <Phone className="w-3 h-3" />
                  {passenger.phone}
                </p>
              </div>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => onEdit(passenger)}
              data-testid="edit-passenger-btn"
            >
              <Pencil className="w-4 h-4 mr-1" />
              Edit
            </Button>
          </DialogTitle>
        </DialogHeader>
        
        {/* Stats Summary */}
        <div className="grid grid-cols-3 gap-4 py-4 border-b">
          <div className="text-center">
            <p className="text-2xl font-bold text-primary">{passenger.totalBookings}</p>
            <p className="text-xs text-muted-foreground">Total Bookings</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-green-600">£{passenger.totalFare.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">Total Spent</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-blue-600">{passenger.totalMiles.toFixed(1)}</p>
            <p className="text-xs text-muted-foreground">Total Miles</p>
          </div>
        </div>

        {/* Booking History */}
        <div className="flex-1 overflow-y-auto">
          <h3 className="text-sm font-semibold text-slate-700 mb-3 sticky top-0 bg-white py-2">
            Booking History
          </h3>
          <div className="space-y-3">
            {passengerBookings.map((booking) => (
              <div 
                key={booking.id} 
                className="bg-slate-50 rounded-lg p-3 border"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-mono font-semibold text-primary">
                      {booking.booking_id}
                    </span>
                    {getStatusBadge(booking.status)}
                  </div>
                  <span className="text-sm font-semibold text-green-600">
                    {booking.fare ? `£${booking.fare.toFixed(2)}` : '-'}
                  </span>
                </div>
                
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                  <Calendar className="w-3.5 h-3.5" />
                  {format(new Date(booking.booking_datetime), "EEE, dd MMM yyyy")}
                  <Clock className="w-3.5 h-3.5 ml-2" />
                  {format(new Date(booking.booking_datetime), "HH:mm")}
                </div>
                
                <div className="flex items-start gap-2">
                  <div className="flex flex-col items-center mt-1">
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    <div className="w-0.5 h-6 bg-slate-300"></div>
                    <div className="w-2 h-2 rounded-full bg-red-500"></div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-700 truncate">{booking.pickup_location}</p>
                    <div className="h-3"></div>
                    <p className="text-sm text-slate-600 truncate">{booking.dropoff_location}</p>
                  </div>
                </div>
                
                {booking.distance_miles && (
                  <p className="text-xs text-muted-foreground mt-2">
                    {booking.distance_miles} miles • {booking.duration_minutes} mins
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const PassengersPage = () => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState("");
  const [selectedPassenger, setSelectedPassenger] = useState(null);
  const [editingPassenger, setEditingPassenger] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    phone: "",
    email: "",
  });

  const fetchBookings = async () => {
    try {
      const response = await axios.get(`${API}/bookings`);
      setBookings(response.data);
    } catch (error) {
      console.error("Error fetching bookings:", error);
      toast.error("Failed to load passengers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  const handleEditPassenger = (passenger) => {
    setEditingPassenger(passenger);
    setEditForm({
      name: passenger.name || "",
      phone: passenger.phone || "",
      email: passenger.email || "",
    });
    setSelectedPassenger(null);
    setShowEditModal(true);
  };

  const handleSavePassenger = async () => {
    if (!editingPassenger) return;
    
    setSaving(true);
    try {
      // Update all bookings with this phone number
      await axios.put(`${API}/passengers/update`, {
        original_phone: editingPassenger.phone,
        name: editForm.name,
        phone: editForm.phone,
        email: editForm.email,
      });
      
      toast.success("Passenger profile updated successfully");
      setShowEditModal(false);
      setEditingPassenger(null);
      // Refresh bookings to show updated info
      fetchBookings();
    } catch (error) {
      console.error("Error updating passenger:", error);
      toast.error(error.response?.data?.detail || "Failed to update passenger");
    } finally {
      setSaving(false);
    }
  };

  // Aggregate bookings by passenger (phone number)
  const passengers = bookings.reduce((acc, booking) => {
    const phone = booking.customer_phone;
    const customerName = booking.customer_name || `${booking.first_name || ''} ${booking.last_name || ''}`.trim();
    if (!acc[phone]) {
      acc[phone] = {
        name: customerName,
        phone: phone,
        totalBookings: 0,
        totalFare: 0,
        totalMiles: 0,
        lastBooking: null,
      };
    }
    acc[phone].totalBookings += 1;
    acc[phone].totalFare += booking.fare || 0;
    acc[phone].totalMiles += booking.distance_miles || 0;
    
    // Update name if this booking has a different name (use most recent)
    const bookingDate = new Date(booking.booking_datetime);
    if (!acc[phone].lastBooking || bookingDate > new Date(acc[phone].lastBooking)) {
      acc[phone].lastBooking = booking.booking_datetime;
      acc[phone].name = customerName;
    }
    
    return acc;
  }, {});

  // Convert to array and sort by total bookings
  const passengerList = Object.values(passengers).sort((a, b) => b.totalBookings - a.totalBookings);

  // Filter passengers based on search
  const filteredPassengers = passengerList.filter(passenger => {
    if (!searchText) return true;
    const search = searchText.toLowerCase();
    return (
      passenger.name.toLowerCase().includes(search) ||
      passenger.phone.toLowerCase().includes(search)
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div data-testid="passengers-page">
      <header className="page-header flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Passengers</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {passengerList.length} passengers • {bookings.length} total bookings
          </p>
        </div>
      </header>

      {/* Search Bar */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search by name or phone..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="pl-10 bg-white"
            data-testid="passenger-search-input"
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
        {searchText && (
          <p className="text-sm text-muted-foreground mt-2">
            Showing {filteredPassengers.length} of {passengerList.length} passengers
          </p>
        )}
      </div>

      {/* Passengers List */}
      <div className="page-content">
        {passengerList.length === 0 ? (
          <div className="text-center py-16">
            <User className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No passengers yet</h3>
            <p className="text-muted-foreground">Passengers will appear here once you create bookings</p>
          </div>
        ) : filteredPassengers.length === 0 ? (
          <div className="text-center py-16">
            <Search className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No passengers found</h3>
            <p className="text-muted-foreground mb-4">Try a different search term</p>
            <Button variant="outline" onClick={() => setSearchText("")}>
              Clear Search
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredPassengers.map((passenger) => (
              <PassengerCard
                key={passenger.phone}
                passenger={passenger}
                onClick={() => setSelectedPassenger(passenger)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Passenger Detail Modal */}
      <PassengerDetailModal
        passenger={selectedPassenger}
        bookings={bookings}
        onClose={() => setSelectedPassenger(null)}
        onEdit={handleEditPassenger}
      />

      {/* Edit Passenger Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="sm:max-w-[450px]" data-testid="edit-passenger-modal">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-5 h-5 text-primary" />
              Edit Passenger Profile
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Full Name</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="edit-name"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="pl-10"
                  placeholder="Enter passenger name"
                  data-testid="edit-passenger-name"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-phone">Phone Number</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="edit-phone"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  className="pl-10"
                  placeholder="+44 7123 456789"
                  data-testid="edit-passenger-phone"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Changing the phone number will update all associated bookings
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="edit-email"
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="pl-10"
                  placeholder="passenger@email.com"
                  data-testid="edit-passenger-email"
                />
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditModal(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSavePassenger} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PassengersPage;
