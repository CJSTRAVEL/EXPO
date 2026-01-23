import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { format, isValid, parseISO } from "date-fns";
import {
  MapPin, Calendar, Clock, User, Phone, Mail, LogOut,
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

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
    create_return: false,
    return_pickup_location: "",
    return_dropoff_location: "",
    return_datetime: "",
    return_flight_number: "",
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
      const [bookingsRes, requestsRes, invoicesRes, vehicleTypesRes] = await Promise.all([
        axios.get(`${API}/client-portal/bookings`, { headers: getAuthHeaders() }),
        axios.get(`${API}/client-portal/booking-requests`, { headers: getAuthHeaders() }),
        axios.get(`${API}/client-portal/invoices`, { headers: getAuthHeaders() }).catch(() => ({ data: [] })),
        axios.get(`${API}/vehicle-types`).catch(() => ({ data: [] })),
      ]);

      setBookings(bookingsRes.data);
      setRequests(requestsRes.data);
      setInvoices(invoicesRes.data);
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
      pending: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
      approved: "bg-green-500/20 text-green-400 border-green-500/30",
      confirmed: "bg-green-500/20 text-green-400 border-green-500/30",
      assigned: "bg-blue-500/20 text-blue-400 border-blue-500/30",
      completed: "bg-gray-500/20 text-gray-400 border-gray-500/30",
      cancelled: "bg-red-500/20 text-red-400 border-red-500/30",
      rejected: "bg-red-500/20 text-red-400 border-red-500/30",
      paid: "bg-green-500/20 text-green-400 border-green-500/30",
      unpaid: "bg-red-500/20 text-red-400 border-red-500/30",
      overdue: "bg-orange-500/20 text-orange-400 border-orange-500/30",
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
              { id: "invoices", label: "Invoices", icon: Receipt },
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
                              {safeFormatDate(booking.booking_datetime, "dd MMM yyyy")}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              {safeFormatDate(booking.booking_datetime, "HH:mm")}
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
                              {safeFormatDate(request.pickup_datetime, "dd MMM yyyy HH:mm")}
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
                        Submitted {safeFormatDate(request.created_at, "dd MMM yyyy 'at' HH:mm")}
                      </p>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {/* Invoices */}
        {activeTab === "invoices" && (
          <div className="space-y-6">
            {/* Invoice Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-[#1a1a1a] rounded-xl border border-[#2d2d2d] p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-500/20">
                    <Receipt className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white">{invoiceStats.total}</p>
                    <p className="text-xs text-gray-400">Total Invoices</p>
                  </div>
                </div>
              </div>
              <div className="bg-[#1a1a1a] rounded-xl border border-[#2d2d2d] p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-500/20">
                    <CheckCircle className="w-5 h-5 text-green-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white">{invoiceStats.paid}</p>
                    <p className="text-xs text-gray-400">Paid</p>
                  </div>
                </div>
              </div>
              <div className="bg-[#1a1a1a] rounded-xl border border-[#2d2d2d] p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-red-500/20">
                    <Clock3 className="w-5 h-5 text-red-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white">{invoiceStats.unpaid}</p>
                    <p className="text-xs text-gray-400">Unpaid</p>
                  </div>
                </div>
              </div>
              <div className="bg-[#1a1a1a] rounded-xl border border-[#2d2d2d] p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-yellow-500/20">
                    <Banknote className="w-5 h-5 text-yellow-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white">£{invoiceStats.outstandingAmount.toFixed(2)}</p>
                    <p className="text-xs text-gray-400">Outstanding</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Invoice List */}
            <div>
              <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
                <Receipt className="w-5 h-5 text-blue-400" />
                Your Invoices
              </h2>
              {invoices.length === 0 ? (
                <div className="text-center py-12 bg-[#1a1a1a] rounded-xl border border-[#2d2d2d]">
                  <Receipt className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400">No invoices yet</p>
                  <p className="text-sm text-gray-500 mt-2">
                    Invoices will appear here after your bookings are completed
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {invoices.map((invoice) => (
                    <div
                      key={invoice.id}
                      className="bg-[#1a1a1a] rounded-xl border border-[#2d2d2d] p-4 hover:border-blue-500/30 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="p-3 rounded-lg bg-blue-500/10">
                            <FileText className="w-6 h-6 text-blue-400" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-white font-semibold">{invoice.invoice_ref}</span>
                              {getStatusBadge(invoice.status || 'unpaid')}
                            </div>
                            <div className="flex items-center gap-4 mt-1 text-sm text-gray-400">
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
                            <p className="text-xl font-bold text-white">
                              £{(invoice.total || 0).toFixed(2)}
                            </p>
                            {invoice.vat_amount && (
                              <p className="text-xs text-gray-500">
                                Inc. VAT £{invoice.vat_amount.toFixed(2)}
                              </p>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setShowInvoiceDetails(invoice)}
                              className="text-gray-400 hover:text-white"
                              data-testid={`view-invoice-${invoice.id}`}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDownloadInvoice(invoice)}
                              disabled={downloadingInvoice === invoice.id}
                              className="text-blue-400 hover:text-blue-300"
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
                            {safeFormatDate(booking.booking_datetime, "dd MMM yyyy 'at' HH:mm")}
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
              <div className="flex gap-2">
                <Input
                  value={newBooking.flight_number}
                  onChange={(e) => {
                    setNewBooking({ ...newBooking, flight_number: e.target.value.toUpperCase() });
                    setFlightData(null);
                    setFlightError(null);
                  }}
                  placeholder="e.g., BA1234"
                  className="bg-[#2d2d2d] border-[#3d3d3d] text-white flex-1"
                />
                <Button
                  type="button"
                  onClick={handleFlightLookup}
                  disabled={loadingFlight || !newBooking.flight_number}
                  className="bg-blue-500 hover:bg-blue-600"
                >
                  {loadingFlight ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Search className="w-4 h-4 mr-1" />
                      Look Up
                    </>
                  )}
                </Button>
              </div>
              {flightError && (
                <p className="text-red-400 text-xs">{flightError}</p>
              )}
            </div>

            {/* Flight Data Display */}
            {flightData && !flightError && (
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-blue-400 text-sm font-medium flex items-center gap-1">
                    <Plane className="w-4 h-4" />
                    Live Flight Data {flightData.is_cached && "(cached)"}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    flightData.flight_status === 'landed' ? 'bg-green-500/20 text-green-400' :
                    flightData.flight_status === 'active' ? 'bg-blue-500/20 text-blue-400' :
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
                  <Plane className="w-4 h-4 text-blue-400" />
                  <div>
                    <p className="text-gray-500 text-xs">To</p>
                    <p className="font-medium text-white">{flightData.arrival_airport}</p>
                  </div>
                </div>
                {flightData.arrival_scheduled && (
                  <div className="text-xs text-gray-400">
                    <span className="font-medium">Arrival:</span>{' '}
                    {new Date(flightData.arrival_scheduled).toLocaleString()}
                    {flightData.arrival_terminal && ` - Terminal ${flightData.arrival_terminal}`}
                  </div>
                )}
                {flightData.airline && (
                  <div className="text-xs text-gray-400">
                    <span className="font-medium">Airline:</span> {flightData.airline}
                  </div>
                )}
              </div>
            )}

            {/* Return Journey Toggle */}
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
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
                      return_datetime: "",
                      return_flight_number: ""
                    });
                    setReturnFlightData(null);
                    setReturnFlightError(null);
                  }}
                  className="rounded"
                  data-testid="create-return-toggle"
                />
                <span className="text-sm font-semibold text-blue-400 flex items-center gap-2">
                  <ArrowLeftRight className="w-4 h-4" />
                  Create Return Journey
                </span>
              </label>
              
              {newBooking.create_return && (
                <div className="mt-4 pt-4 border-t border-blue-500/30 space-y-4">
                  <div className="bg-blue-500/20 rounded px-2 py-1">
                    <p className="text-xs font-semibold text-blue-400">RETURN JOURNEY DETAILS</p>
                  </div>
                  
                  {/* Return Pickup Location */}
                  <div className="space-y-2">
                    <Label className="text-gray-300">Return Pickup Location</Label>
                    <Input
                      value={newBooking.return_pickup_location}
                      onChange={(e) => setNewBooking({ ...newBooking, return_pickup_location: e.target.value })}
                      placeholder="Where to pick up for return..."
                      className="bg-[#2d2d2d] border-[#3d3d3d] text-white"
                      data-testid="return-pickup-input"
                    />
                  </div>

                  {/* Return Dropoff Location */}
                  <div className="space-y-2">
                    <Label className="text-gray-300">Return Drop-off Location</Label>
                    <Input
                      value={newBooking.return_dropoff_location}
                      onChange={(e) => setNewBooking({ ...newBooking, return_dropoff_location: e.target.value })}
                      placeholder="Where to drop off on return..."
                      className="bg-[#2d2d2d] border-[#3d3d3d] text-white"
                      data-testid="return-dropoff-input"
                    />
                  </div>

                  {/* Return Date & Time */}
                  <div className="space-y-2">
                    <Label className="text-gray-300">Return Date & Time</Label>
                    <Input
                      type="datetime-local"
                      value={newBooking.return_datetime}
                      onChange={(e) => setNewBooking({ ...newBooking, return_datetime: e.target.value })}
                      className="bg-[#2d2d2d] border-[#3d3d3d] text-white"
                      data-testid="return-datetime-input"
                    />
                  </div>

                  {/* Return Flight Number */}
                  <div className="space-y-2">
                    <Label className="text-gray-300">Return Flight Number (if applicable)</Label>
                    <div className="flex gap-2">
                      <Input
                        value={newBooking.return_flight_number}
                        onChange={(e) => {
                          setNewBooking({ ...newBooking, return_flight_number: e.target.value.toUpperCase() });
                          setReturnFlightData(null);
                          setReturnFlightError(null);
                        }}
                        placeholder="e.g., BA1234"
                        className="bg-[#2d2d2d] border-[#3d3d3d] text-white flex-1"
                        data-testid="return-flight-input"
                      />
                      <Button
                        type="button"
                        onClick={handleReturnFlightLookup}
                        disabled={loadingReturnFlight || !newBooking.return_flight_number}
                        className="bg-blue-500 hover:bg-blue-600"
                      >
                        {loadingReturnFlight ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <Search className="w-4 h-4 mr-1" />
                            Look Up
                          </>
                        )}
                      </Button>
                    </div>
                    {returnFlightError && (
                      <p className="text-red-400 text-xs">{returnFlightError}</p>
                    )}
                  </div>

                  {/* Return Flight Data Display */}
                  {returnFlightData && !returnFlightError && (
                    <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-green-400 text-sm font-medium flex items-center gap-1">
                          <Plane className="w-4 h-4" />
                          Return Flight {returnFlightData.is_cached && "(cached)"}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          returnFlightData.flight_status === 'landed' ? 'bg-green-500/20 text-green-400' :
                          returnFlightData.flight_status === 'active' ? 'bg-blue-500/20 text-blue-400' :
                          returnFlightData.flight_status === 'scheduled' ? 'bg-gray-500/20 text-gray-400' :
                          returnFlightData.flight_status === 'cancelled' ? 'bg-red-500/20 text-red-400' :
                          'bg-gray-500/20 text-gray-400'
                        }`}>
                          {returnFlightData.flight_status?.toUpperCase() || 'UNKNOWN'}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <div>
                          <p className="text-gray-500 text-xs">From</p>
                          <p className="font-medium text-white">{returnFlightData.departure_airport}</p>
                        </div>
                        <Plane className="w-4 h-4 text-green-400" />
                        <div>
                          <p className="text-gray-500 text-xs">To</p>
                          <p className="font-medium text-white">{returnFlightData.arrival_airport}</p>
                        </div>
                      </div>
                      {returnFlightData.departure_scheduled && (
                        <div className="text-xs text-gray-400">
                          <span className="font-medium">Departure:</span>{' '}
                          {new Date(returnFlightData.departure_scheduled).toLocaleString()}
                          {returnFlightData.departure_terminal && ` - Terminal ${returnFlightData.departure_terminal}`}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
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
