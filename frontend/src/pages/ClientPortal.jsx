import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { format } from "date-fns";
import {
  MapPin, Calendar, Clock, User, Phone, Mail, LogOut,
  Building2, Plus, History, FileText, Loader2, CheckCircle,
  XCircle, Clock3, Car, Users, Briefcase, ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const ClientPortal = () => {
  const navigate = useNavigate();
  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("bookings");
  const [bookings, setBookings] = useState([]);
  const [requests, setRequests] = useState([]);
  const [vehicleTypes, setVehicleTypes] = useState([]);
  const [showNewBooking, setShowNewBooking] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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
  });

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

    try {
      const [bookingsRes, requestsRes, vehicleTypesRes] = await Promise.all([
        axios.get(`${API}/client-portal/bookings`, { headers: getAuthHeaders() }),
        axios.get(`${API}/client-portal/booking-requests`, { headers: getAuthHeaders() }),
        axios.get(`${API}/vehicle-types`).catch(() => ({ data: [] })),
      ]);

      setBookings(bookingsRes.data);
      setRequests(requestsRes.data);
      setVehicleTypes(vehicleTypesRes.data);
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

  const handleLogout = () => {
    localStorage.removeItem("clientToken");
    localStorage.removeItem("clientInfo");
    navigate("/customer-login");
  };

  const handleSubmitBooking = async (e) => {
    e.preventDefault();
    if (!newBooking.pickup_location || !newBooking.dropoff_location || !newBooking.pickup_datetime) {
      toast.error("Please fill in all required fields");
      return;
    }

    setSubmitting(true);
    try {
      await axios.post(`${API}/client-portal/booking-requests`, newBooking, {
        headers: getAuthHeaders(),
      });
      toast.success("Booking request submitted! We'll confirm shortly.");
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
      });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to submit booking");
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      pending: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
      approved: "bg-green-500/20 text-green-400 border-green-500/30",
      confirmed: "bg-green-500/20 text-green-400 border-green-500/30",
      assigned: "bg-blue-500/20 text-blue-400 border-blue-500/30",
      completed: "bg-gray-500/20 text-gray-400 border-gray-500/30",
      cancelled: "bg-red-500/20 text-red-400 border-red-500/30",
      rejected: "bg-red-500/20 text-red-400 border-red-500/30",
    };
    const icons = {
      pending: Clock3,
      approved: CheckCircle,
      confirmed: CheckCircle,
      assigned: Car,
      completed: CheckCircle,
      cancelled: XCircle,
      rejected: XCircle,
    };
    const Icon = icons[status] || Clock3;
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${styles[status] || styles.pending}`}>
        <Icon className="w-3 h-3" />
        {status?.charAt(0).toUpperCase() + status?.slice(1)}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Header */}
      <header className="bg-[#1a1a1a] border-b border-blue-500/20">
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
                    <span className="text-blue-400 ml-1">({client.account_no})</span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Button
                onClick={() => setShowNewBooking(true)}
                className="bg-blue-500 hover:bg-blue-600 text-white"
                data-testid="new-booking-btn"
              >
                <Plus className="w-4 h-4 mr-2" />
                New Booking
              </Button>
              <Button
                variant="ghost"
                onClick={handleLogout}
                className="text-gray-400 hover:text-white"
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
      <div className="bg-[#1a1a1a]/50 border-b border-[#2d2d2d]">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-1">
            {[
              { id: "bookings", label: "Confirmed Bookings", icon: Car },
              { id: "requests", label: "Pending Requests", icon: Clock3 },
              { id: "history", label: "History", icon: History },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
                  activeTab === tab.id
                    ? "text-blue-400 border-blue-500"
                    : "text-gray-400 border-transparent hover:text-white hover:border-gray-600"
                }`}
                data-testid={`tab-${tab.id}`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
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
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Car className="w-5 h-5 text-blue-400" />
              Confirmed Bookings
            </h2>
            {bookings.filter(b => !['completed', 'cancelled'].includes(b.status)).length === 0 ? (
              <div className="text-center py-12 bg-[#1a1a1a] rounded-xl border border-[#2d2d2d]">
                <Car className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400">No confirmed bookings yet</p>
                <Button
                  onClick={() => setShowNewBooking(true)}
                  className="mt-4 bg-blue-500 hover:bg-blue-600"
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
                      className="bg-[#1a1a1a] rounded-xl border border-[#2d2d2d] p-4 hover:border-blue-500/30 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-white font-semibold">{booking.booking_id}</span>
                            {getStatusBadge(booking.status)}
                          </div>
                          <div className="flex items-center gap-4 mt-1 text-sm text-gray-400">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5" />
                              {format(new Date(booking.booking_datetime), "dd MMM yyyy")}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              {format(new Date(booking.booking_datetime), "HH:mm")}
                            </span>
                          </div>
                        </div>
                        {booking.fare && (
                          <span className="text-xl font-bold text-blue-400">
                            £{booking.fare.toFixed(2)}
                          </span>
                        )}
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-start gap-2">
                          <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5" />
                          <span className="text-gray-300 text-sm">{booking.pickup_location}</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <div className="w-2 h-2 rounded-full bg-red-500 mt-1.5" />
                          <span className="text-gray-300 text-sm">{booking.dropoff_location}</span>
                        </div>
                      </div>
                      {booking.driver_name && (
                        <div className="mt-3 pt-3 border-t border-[#2d2d2d] flex items-center gap-2 text-sm text-gray-400">
                          <User className="w-4 h-4" />
                          Driver: <span className="text-white">{booking.driver_name}</span>
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
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Clock3 className="w-5 h-5 text-yellow-400" />
              Pending Requests
            </h2>
            {requests.filter(r => r.status === 'pending').length === 0 ? (
              <div className="text-center py-12 bg-[#1a1a1a] rounded-xl border border-[#2d2d2d]">
                <Clock3 className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400">No pending requests</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {requests
                  .filter(r => r.status === 'pending')
                  .map((request) => (
                    <div
                      key={request.id}
                      className="bg-[#1a1a1a] rounded-xl border border-yellow-500/30 p-4"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          {getStatusBadge(request.status)}
                          <div className="flex items-center gap-4 mt-2 text-sm text-gray-400">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5" />
                              {request.pickup_datetime && format(new Date(request.pickup_datetime), "dd MMM yyyy HH:mm")}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-start gap-2">
                          <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5" />
                          <span className="text-gray-300 text-sm">{request.pickup_location}</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <div className="w-2 h-2 rounded-full bg-red-500 mt-1.5" />
                          <span className="text-gray-300 text-sm">{request.dropoff_location}</span>
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 mt-3">
                        Submitted {format(new Date(request.created_at), "dd MMM yyyy 'at' HH:mm")}
                      </p>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {/* History */}
        {activeTab === "history" && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <History className="w-5 h-5 text-gray-400" />
              Booking History
            </h2>
            {bookings.filter(b => ['completed', 'cancelled'].includes(b.status)).length === 0 ? (
              <div className="text-center py-12 bg-[#1a1a1a] rounded-xl border border-[#2d2d2d]">
                <History className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400">No booking history</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {bookings
                  .filter(b => ['completed', 'cancelled'].includes(b.status))
                  .map((booking) => (
                    <div
                      key={booking.id}
                      className="bg-[#1a1a1a]/50 rounded-xl border border-[#2d2d2d] p-4"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-gray-300 font-semibold">{booking.booking_id}</span>
                            {getStatusBadge(booking.status)}
                          </div>
                          <div className="text-sm text-gray-500 mt-1">
                            {format(new Date(booking.booking_datetime), "dd MMM yyyy 'at' HH:mm")}
                          </div>
                        </div>
                        {booking.fare && (
                          <span className="text-lg font-bold text-gray-400">
                            £{booking.fare.toFixed(2)}
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-400">
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
      <Dialog open={showNewBooking} onOpenChange={setShowNewBooking}>
        <DialogContent className="bg-[#1a1a1a] border-blue-500/30 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-blue-400" />
              New Booking Request
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmitBooking} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-gray-300">Pickup Location *</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500" />
                <Input
                  value={newBooking.pickup_location}
                  onChange={(e) => setNewBooking({ ...newBooking, pickup_location: e.target.value })}
                  placeholder="Enter pickup address"
                  className="pl-10 bg-[#2d2d2d] border-[#3d3d3d] text-white"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-gray-300">Drop-off Location *</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-red-500" />
                <Input
                  value={newBooking.dropoff_location}
                  onChange={(e) => setNewBooking({ ...newBooking, dropoff_location: e.target.value })}
                  placeholder="Enter drop-off address"
                  className="pl-10 bg-[#2d2d2d] border-[#3d3d3d] text-white"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-gray-300">Pickup Date & Time *</Label>
              <Input
                type="datetime-local"
                value={newBooking.pickup_datetime}
                onChange={(e) => setNewBooking({ ...newBooking, pickup_datetime: e.target.value })}
                className="bg-[#2d2d2d] border-[#3d3d3d] text-white"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-gray-300">Passengers</Label>
                <div className="relative">
                  <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    type="number"
                    min="1"
                    max="16"
                    value={newBooking.passenger_count}
                    onChange={(e) => setNewBooking({ ...newBooking, passenger_count: parseInt(e.target.value) || 1 })}
                    className="pl-10 bg-[#2d2d2d] border-[#3d3d3d] text-white"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-gray-300">Luggage</Label>
                <div className="relative">
                  <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    type="number"
                    min="0"
                    max="20"
                    value={newBooking.luggage_count}
                    onChange={(e) => setNewBooking({ ...newBooking, luggage_count: parseInt(e.target.value) || 0 })}
                    className="pl-10 bg-[#2d2d2d] border-[#3d3d3d] text-white"
                  />
                </div>
              </div>
            </div>

            {vehicleTypes.length > 0 && (
              <div className="space-y-2">
                <Label className="text-gray-300">Vehicle Type</Label>
                <Select
                  value={newBooking.vehicle_type_id}
                  onValueChange={(value) => {
                    const vt = vehicleTypes.find(v => v.id === value);
                    setNewBooking({
                      ...newBooking,
                      vehicle_type_id: value,
                      vehicle_type_name: vt?.name || "",
                    });
                  }}
                >
                  <SelectTrigger className="bg-[#2d2d2d] border-[#3d3d3d] text-white">
                    <SelectValue placeholder="Select vehicle type" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#2d2d2d] border-[#3d3d3d]">
                    {vehicleTypes.map((vt) => (
                      <SelectItem key={vt.id} value={vt.id} className="text-white">
                        {vt.name} ({vt.capacity} seats)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-gray-300">Flight Number (if applicable)</Label>
              <Input
                value={newBooking.flight_number}
                onChange={(e) => setNewBooking({ ...newBooking, flight_number: e.target.value })}
                placeholder="e.g., BA1234"
                className="bg-[#2d2d2d] border-[#3d3d3d] text-white"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-gray-300">Notes</Label>
              <Textarea
                value={newBooking.notes}
                onChange={(e) => setNewBooking({ ...newBooking, notes: e.target.value })}
                placeholder="Any special requirements..."
                className="bg-[#2d2d2d] border-[#3d3d3d] text-white resize-none"
                rows={3}
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowNewBooking(false)}
                className="flex-1 border-[#3d3d3d] text-gray-300 hover:bg-[#2d2d2d]"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="flex-1 bg-blue-500 hover:bg-blue-600 text-white"
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
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ClientPortal;
