import { useEffect, useState } from "react";
import axios from "axios";
import { User, Phone, MapPin, Calendar, Clock, Search, ChevronRight, MessageSquare, X, Shield, ShieldOff, Trash2, Loader2, AlertTriangle, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-slate-800 truncate">{passenger.name}</h3>
            {passenger.hasPortalAccount && (
              <Badge variant="outline" className={`text-xs ${passenger.isBlocked ? 'bg-red-100 text-red-700 border-red-200' : 'bg-blue-100 text-blue-700 border-blue-200'}`}>
                {passenger.isBlocked ? 'Blocked' : 'Portal'}
              </Badge>
            )}
          </div>
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

const PassengerDetailModal = ({ passenger, bookings, onClose, onBlock, onUnblock, onDelete, actionLoading }) => {
  if (!passenger) return null;

  const passengerBookings = bookings.filter(b => b.customer_phone === passenger.phone);

  return (
    <Dialog open={!!passenger} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-hidden flex flex-col" data-testid="passenger-detail-modal">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold">{passenger.name}</h2>
                {passenger.hasPortalAccount && (
                  <Badge variant="outline" className={`text-xs ${passenger.isBlocked ? 'bg-red-100 text-red-700 border-red-200' : 'bg-blue-100 text-blue-700 border-blue-200'}`}>
                    {passenger.isBlocked ? 'Blocked' : 'Portal Account'}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground font-normal flex items-center gap-1">
                <Phone className="w-3 h-3" />
                {passenger.phone}
              </p>
            </div>
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

        {/* Portal Account Actions */}
        {passenger.hasPortalAccount && (
          <div className="py-4 border-b">
            <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Portal Account Actions
            </h3>
            <div className="flex items-center gap-2">
              {passenger.isBlocked ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onUnblock(passenger)}
                  disabled={actionLoading === passenger.portalAccountId}
                  className="border-green-500/50 text-green-600 hover:bg-green-50"
                  data-testid="unblock-passenger-btn"
                >
                  {actionLoading === passenger.portalAccountId ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-1" />
                  ) : (
                    <ShieldOff className="w-4 h-4 mr-1" />
                  )}
                  Unblock Account
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onBlock(passenger)}
                  disabled={actionLoading === passenger.portalAccountId}
                  className="border-yellow-500/50 text-yellow-600 hover:bg-yellow-50"
                  data-testid="block-passenger-btn"
                >
                  {actionLoading === passenger.portalAccountId ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-1" />
                  ) : (
                    <Shield className="w-4 h-4 mr-1" />
                  )}
                  Block Account
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => onDelete(passenger)}
                disabled={actionLoading === passenger.portalAccountId}
                className="border-red-500/50 text-red-600 hover:bg-red-50"
                data-testid="delete-passenger-btn"
              >
                {actionLoading === passenger.portalAccountId ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-1" />
                ) : (
                  <Trash2 className="w-4 h-4 mr-1" />
                )}
                Delete Account
              </Button>
            </div>
            {passenger.isBlocked && (
              <p className="text-xs text-red-600 mt-2 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                This passenger cannot log in to the portal
              </p>
            )}
          </div>
        )}

        {!passenger.hasPortalAccount && (
          <div className="py-4 border-b">
            <div className="flex items-center gap-2 text-slate-500">
              <UserX className="w-4 h-4" />
              <span className="text-sm">No portal account registered</span>
            </div>
          </div>
        )}

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

const DeleteConfirmDialog = ({ passenger, onClose, onConfirm, loading }) => {
  if (!passenger) return null;

  return (
    <Dialog open={!!passenger} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[400px]" data-testid="delete-confirm-modal">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="w-5 h-5" />
            Delete Portal Account
          </DialogTitle>
        </DialogHeader>
        
        <div className="py-4">
          <p className="text-slate-700">
            Are you sure you want to permanently delete <strong>{passenger.name}</strong>'s portal account?
          </p>
          <p className="text-sm text-slate-500 mt-2">
            This action cannot be undone. The passenger will no longer be able to log in to the portal.
          </p>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Trash2 className="w-4 h-4 mr-2" />
            )}
            Delete Account
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const PassengersPage = () => {
  const [bookings, setBookings] = useState([]);
  const [portalAccounts, setPortalAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState("");
  const [selectedPassenger, setSelectedPassenger] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);

  const fetchData = async () => {
    try {
      const [bookingsRes, accountsRes] = await Promise.all([
        axios.get(`${API}/bookings`),
        axios.get(`${API}/admin/passengers`).catch(() => ({ data: [] }))
      ]);
      setBookings(bookingsRes.data);
      setPortalAccounts(accountsRes.data || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load passengers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Create a map of portal accounts by phone for quick lookup
  const portalAccountsByPhone = portalAccounts.reduce((acc, account) => {
    // Normalize phone number for matching
    let phone = account.phone;
    // Store both formats for matching
    if (phone.startsWith("+44")) {
      acc[phone] = account;
      acc["0" + phone.slice(3)] = account;
    } else if (phone.startsWith("0")) {
      acc[phone] = account;
      acc["+44" + phone.slice(1)] = account;
    } else {
      acc[phone] = account;
    }
    return acc;
  }, {});

  // Aggregate bookings by passenger (phone number)
  const passengers = bookings.reduce((acc, booking) => {
    const phone = booking.customer_phone;
    if (!phone) return acc;
    
    const customerName = booking.customer_name || `${booking.first_name || ''} ${booking.last_name || ''}`.trim();
    if (!acc[phone]) {
      const portalAccount = portalAccountsByPhone[phone];
      acc[phone] = {
        name: customerName,
        phone: phone,
        totalBookings: 0,
        totalFare: 0,
        totalMiles: 0,
        lastBooking: null,
        hasPortalAccount: !!portalAccount,
        portalAccountId: portalAccount?.id || null,
        isBlocked: portalAccount?.is_blocked || false,
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

  const handleBlock = async (passenger) => {
    if (!passenger.portalAccountId) return;
    
    setActionLoading(passenger.portalAccountId);
    try {
      await axios.put(`${API}/admin/passengers/${passenger.portalAccountId}/block`);
      toast.success(`${passenger.name} has been blocked`);
      await fetchData();
      // Update selected passenger
      setSelectedPassenger(prev => prev ? { ...prev, isBlocked: true } : null);
    } catch (error) {
      toast.error("Failed to block passenger");
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnblock = async (passenger) => {
    if (!passenger.portalAccountId) return;
    
    setActionLoading(passenger.portalAccountId);
    try {
      await axios.put(`${API}/admin/passengers/${passenger.portalAccountId}/unblock`);
      toast.success(`${passenger.name} has been unblocked`);
      await fetchData();
      // Update selected passenger
      setSelectedPassenger(prev => prev ? { ...prev, isBlocked: false } : null);
    } catch (error) {
      toast.error("Failed to unblock passenger");
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm?.portalAccountId) return;
    
    setActionLoading(deleteConfirm.portalAccountId);
    try {
      await axios.delete(`${API}/admin/passengers/${deleteConfirm.portalAccountId}`);
      toast.success(`${deleteConfirm.name}'s portal account has been deleted`);
      setDeleteConfirm(null);
      setSelectedPassenger(null);
      await fetchData();
    } catch (error) {
      toast.error("Failed to delete passenger account");
    } finally {
      setActionLoading(null);
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
    <div data-testid="passengers-page">
      <header className="page-header flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Passengers</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {passengerList.length} passengers • {bookings.length} total bookings • {portalAccounts.length} portal accounts
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
        onBlock={handleBlock}
        onUnblock={handleUnblock}
        onDelete={(p) => setDeleteConfirm(p)}
        actionLoading={actionLoading}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmDialog
        passenger={deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={handleDeleteConfirm}
        loading={actionLoading === deleteConfirm?.portalAccountId}
      />
    </div>
  );
};

export default PassengersPage;
