import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { Building2, Phone, Mail, Calendar, CreditCard, Search, X, Plus, MoreHorizontal, Pencil, Trash2, MapPin, FileText, Loader2, Download, Settings, PoundSterling, Key } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const CLIENT_TYPES = [
  { value: "Business", label: "Business" },
  { value: "Contract Account", label: "Contract Account" },
  { value: "Corporate", label: "Corporate" },
  { value: "School", label: "School" },
  { value: "Hospital", label: "Hospital" },
  { value: "Individual", label: "Individual" },
];

const PAYMENT_METHODS = [
  { value: "Cash", label: "Cash" },
  { value: "Invoice", label: "Invoice" },
  { value: "Card", label: "Card" },
  { value: "Account", label: "Account" },
];

const ClientsPage = () => {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState("");
  const [selectedClient, setSelectedClient] = useState(null);
  const [showFormModal, setShowFormModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showFareSettingsModal, setShowFareSettingsModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [editingClient, setEditingClient] = useState(null);
  const [clientBookings, setClientBookings] = useState([]);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generatingInvoice, setGeneratingInvoice] = useState(false);
  const [invoiceBookings, setInvoiceBookings] = useState([]);
  const [selectedBookingIds, setSelectedBookingIds] = useState(new Set()); // Track selected bookings for invoice
  const [loadingInvoicePreview, setLoadingInvoicePreview] = useState(false);
  const [loadingFareSettings, setLoadingFareSettings] = useState(false);
  const [vehicleTypes, setVehicleTypes] = useState([]);
  const [globalFareZones, setGlobalFareZones] = useState([]);
  const [globalMileRates, setGlobalMileRates] = useState(null);
  
  // Client fare settings
  const [fareSettings, setFareSettings] = useState({
    use_custom_fares: false,
    custom_fare_zones: [],
    custom_mile_rates: null
  });
  
  // Invoice date range - default to current month
  const [invoiceDateRange, setInvoiceDateRange] = useState({
    start: format(startOfMonth(new Date()), "yyyy-MM-dd"),
    end: format(endOfMonth(new Date()), "yyyy-MM-dd"),
  });

  const [formData, setFormData] = useState({
    name: "",
    mobile: "",
    email: "",
    client_type: "Business",
    payment_method: "Invoice",
    status: "active",
    start_date: format(new Date(), "yyyy-MM-dd"),
    address: "",
    town_city: "",
    post_code: "",
    country: "United Kingdom",
    notes: "",
    vat_rate: "20",
    vat_number: "",
  });

  useEffect(() => {
    fetchClients();
    fetchVehicleTypes();
    fetchGlobalFareSettings();
  }, []);

  useEffect(() => {
    if (selectedClient) {
      fetchClientBookings(selectedClient.id);
    }
  }, [selectedClient]);

  // Fetch invoice preview when modal opens or date range changes
  useEffect(() => {
    if (showInvoiceModal && selectedClient) {
      fetchInvoicePreview();
    }
  }, [showInvoiceModal, invoiceDateRange, selectedClient]);

  const fetchClients = async () => {
    try {
      const response = await axios.get(`${API}/clients`);
      setClients(response.data);
      // Auto-select first client if none selected
      if (response.data.length > 0 && !selectedClient) {
        setSelectedClient(response.data[0]);
      }
    } catch (error) {
      console.error("Error fetching clients:", error);
      toast.error("Failed to load clients");
    } finally {
      setLoading(false);
    }
  };

  const fetchVehicleTypes = async () => {
    try {
      const response = await axios.get(`${API}/vehicle-types`);
      setVehicleTypes(response.data || []);
    } catch (error) {
      console.error("Error fetching vehicle types:", error);
    }
  };

  const fetchGlobalFareSettings = async () => {
    try {
      const [zonesRes, ratesRes] = await Promise.all([
        axios.get(`${API}/settings/fare-zones`),
        axios.get(`${API}/settings/mile-rates`)
      ]);
      setGlobalFareZones(zonesRes.data || []);
      setGlobalMileRates(ratesRes.data);
    } catch (error) {
      console.error("Error fetching global fare settings:", error);
    }
  };

  const fetchClientFareSettings = async (clientId) => {
    setLoadingFareSettings(true);
    try {
      const response = await axios.get(`${API}/clients/${clientId}/fare-settings`);
      setFareSettings(response.data || {
        use_custom_fares: false,
        custom_fare_zones: [],
        custom_mile_rates: null
      });
    } catch (error) {
      console.error("Error fetching client fare settings:", error);
      setFareSettings({
        use_custom_fares: false,
        custom_fare_zones: [],
        custom_mile_rates: null
      });
    } finally {
      setLoadingFareSettings(false);
    }
  };

  const handleOpenFareSettings = async (client) => {
    setSelectedClient(client);
    await fetchClientFareSettings(client.id);
    setShowFareSettingsModal(true);
  };

  const handleSaveFareSettings = async () => {
    if (!selectedClient) return;
    
    setSaving(true);
    try {
      await axios.put(`${API}/clients/${selectedClient.id}/fare-settings`, fareSettings);
      toast.success("Fare settings saved successfully");
      setShowFareSettingsModal(false);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to save fare settings");
    } finally {
      setSaving(false);
    }
  };

  const handleCopyFromGlobal = () => {
    setFareSettings({
      ...fareSettings,
      custom_fare_zones: [...globalFareZones],
      custom_mile_rates: globalMileRates ? { ...globalMileRates } : null
    });
    toast.success("Copied global fare settings");
  };

  const fetchClientBookings = async (clientId) => {
    setLoadingBookings(true);
    try {
      const response = await axios.get(`${API}/clients/${clientId}/bookings`);
      setClientBookings(response.data);
    } catch (error) {
      console.error("Error fetching client bookings:", error);
      setClientBookings([]);
    } finally {
      setLoadingBookings(false);
    }
  };

  const handleSetPassword = async () => {
    if (!selectedClient || !newPassword) {
      toast.error("Please enter a password");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    
    setSaving(true);
    try {
      await axios.put(`${API}/clients/${selectedClient.id}/portal-password`, {
        password: newPassword
      });
      toast.success("Portal password updated successfully");
      setShowPasswordModal(false);
      setNewPassword("");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to update password");
    } finally {
      setSaving(false);
    }
  };

  const handleOpenForm = (client = null) => {
    if (client) {
      setEditingClient(client);
      setFormData({
        name: client.name || "",
        mobile: client.mobile || "",
        email: client.email || "",
        client_type: client.client_type || "Business",
        payment_method: client.payment_method || "Invoice",
        status: client.status || "active",
        start_date: client.start_date || format(new Date(), "yyyy-MM-dd"),
        address: client.address || "",
        town_city: client.town_city || "",
        post_code: client.post_code || "",
        country: client.country || "United Kingdom",
        notes: client.notes || "",
        vat_rate: client.vat_rate || "20",
        vat_number: client.vat_number || "",
      });
    } else {
      setEditingClient(null);
      setFormData({
        name: "",
        mobile: "",
        email: "",
        client_type: "Business",
        payment_method: "Invoice",
        status: "active",
        start_date: format(new Date(), "yyyy-MM-dd"),
        address: "",
        town_city: "",
        post_code: "",
        country: "United Kingdom",
        notes: "",
        vat_rate: "20",
        vat_number: "",
      });
    }
    setShowFormModal(true);
  };

  const handleSaveClient = async () => {
    if (!formData.name || !formData.mobile || !formData.email) {
      toast.error("Please fill in all required fields");
      return;
    }

    setSaving(true);
    try {
      if (editingClient) {
        await axios.put(`${API}/clients/${editingClient.id}`, formData);
        toast.success("Client updated successfully");
      } else {
        await axios.post(`${API}/clients`, formData);
        toast.success("Client created successfully");
      }
      setShowFormModal(false);
      fetchClients();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to save client");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClient = async () => {
    if (!selectedClient) return;
    
    setSaving(true);
    try {
      await axios.delete(`${API}/clients/${selectedClient.id}`);
      toast.success("Client deleted successfully");
      setShowDeleteModal(false);
      setSelectedClient(null);
      fetchClients();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to delete client");
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateInvoice = async (downloadOnly = false) => {
    if (!selectedClient || invoiceBookings.length === 0) {
      toast.error("No bookings to include in invoice");
      return;
    }
    
    setGeneratingInvoice(true);
    try {
      const params = new URLSearchParams();
      if (invoiceDateRange.start) params.append('start_date', invoiceDateRange.start);
      if (invoiceDateRange.end) params.append('end_date', invoiceDateRange.end);
      
      // Send custom prices along with the request
      const customPrices = {};
      invoiceBookings.forEach(b => {
        customPrices[b.id] = b.fare;
      });
      
      const response = await axios.post(
        `${API}/clients/${selectedClient.id}/invoice?${params.toString()}`,
        { custom_prices: customPrices },
        { responseType: 'blob' }
      );
      
      if (downloadOnly) {
        // Create download link
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `invoice_${selectedClient.account_no}_${format(new Date(), 'yyyyMMdd')}.pdf`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
        
        toast.success("Invoice downloaded successfully");
      } else {
        toast.success("Invoice generated and saved. It's now available in Invoice Manager and Client Portal.");
      }
      
      setShowInvoiceModal(false);
    } catch (error) {
      console.error("Error generating invoice:", error);
      toast.error("Failed to generate invoice");
    } finally {
      setGeneratingInvoice(false);
    }
  };

  const fetchInvoicePreview = async () => {
    if (!selectedClient) return;
    
    setLoadingInvoicePreview(true);
    try {
      const params = new URLSearchParams();
      if (invoiceDateRange.start) params.append('start_date', invoiceDateRange.start);
      if (invoiceDateRange.end) params.append('end_date', invoiceDateRange.end);
      
      const response = await axios.get(
        `${API}/clients/${selectedClient.id}/invoice/preview?${params.toString()}`
      );
      setInvoiceBookings(response.data);
      // Auto-select all bookings by default
      setSelectedBookingIds(new Set(response.data.map(b => b.id)));
    } catch (error) {
      console.error("Error fetching invoice preview:", error);
      setInvoiceBookings([]);
      setSelectedBookingIds(new Set());
    } finally {
      setLoadingInvoicePreview(false);
    }
  };

  const toggleBookingSelection = (bookingId) => {
    setSelectedBookingIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(bookingId)) {
        newSet.delete(bookingId);
      } else {
        newSet.add(bookingId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedBookingIds.size === invoiceBookings.length) {
      // All selected, deselect all
      setSelectedBookingIds(new Set());
    } else {
      // Select all
      setSelectedBookingIds(new Set(invoiceBookings.map(b => b.id)));
    }
  };

  const updateBookingPrice = (bookingId, newPrice) => {
    setInvoiceBookings(prev => 
      prev.map(b => b.id === bookingId ? { ...b, fare: parseFloat(newPrice) || 0 } : b)
    );
  };

  // Only calculate total for selected bookings
  const selectedBookings = invoiceBookings.filter(b => selectedBookingIds.has(b.id));
  const invoiceTotal = selectedBookings.reduce((sum, b) => sum + (b.fare || 0), 0);

  const setQuickDateRange = (range) => {
    const now = new Date();
    let newRange = {};
    switch (range) {
      case 'this_month':
        newRange = {
          start: format(startOfMonth(now), "yyyy-MM-dd"),
          end: format(endOfMonth(now), "yyyy-MM-dd"),
        };
        break;
      case 'last_month':
        const lastMonth = subMonths(now, 1);
        newRange = {
          start: format(startOfMonth(lastMonth), "yyyy-MM-dd"),
          end: format(endOfMonth(lastMonth), "yyyy-MM-dd"),
        };
        break;
      case 'all_time':
        newRange = { start: '', end: '' };
        break;
      default:
        return;
    }
    setInvoiceDateRange(newRange);
  };

  // Filter clients based on search
  const filteredClients = clients.filter(client => {
    if (!searchText) return true;
    const search = searchText.toLowerCase();
    return (
      client.name?.toLowerCase().includes(search) ||
      client.account_no?.toLowerCase().includes(search) ||
      client.email?.toLowerCase().includes(search) ||
      client.mobile?.includes(search)
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
    <div data-testid="clients-page" className="flex h-[calc(100vh-2rem)]">
      {/* Left Panel - Client List */}
      <div className="w-[400px] border-r bg-white flex flex-col">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-xl font-bold">Clients</h1>
              <p className="text-sm text-muted-foreground">{clients.length} accounts</p>
            </div>
            <div className="flex items-center gap-2">
              <Link to="/clients/invoices">
                <Button variant="outline" size="sm" data-testid="invoice-manager-btn">
                  <FileText className="w-4 h-4 mr-1" />
                  Invoices
                </Button>
              </Link>
              <Button onClick={() => handleOpenForm()} size="sm" data-testid="add-client-btn">
                <Plus className="w-4 h-4 mr-1" />
                New Client
              </Button>
            </div>
          </div>
          
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search clients..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="pl-10"
              data-testid="client-search-input"
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
            <div className="text-center py-12">
              <Building2 className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground">
                {searchText ? "No clients found" : "No clients yet"}
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
                  data-testid={`client-row-${client.id}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Building2 className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-slate-800">{client.name}</p>
                        <p className="text-xs text-muted-foreground">{client.account_no}</p>
                      </div>
                    </div>
                    <Badge 
                      variant={client.status === "active" ? "default" : "secondary"}
                      className={client.status === "active" ? "bg-green-100 text-green-700" : ""}
                    >
                      {client.status}
                    </Badge>
                  </div>
                  <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <FileText className="w-3 h-3" />
                      {client.booking_count || 0} bookings
                    </span>
                    <span className="flex items-center gap-1">
                      <CreditCard className="w-3 h-3" />
                      £{(client.total_invoice || 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Client Details */}
      <div className="flex-1 bg-slate-50 overflow-y-auto">
        {selectedClient ? (
          <div className="p-6">
            {/* Header */}
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Building2 className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold">{selectedClient.name}</h2>
                  <p className="text-muted-foreground">{selectedClient.account_no}</p>
                </div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" data-testid="client-actions-btn">
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setShowInvoiceModal(true)} data-testid="generate-invoice-btn">
                    <Download className="w-4 h-4 mr-2" />
                    Generate Invoice
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => handleOpenFareSettings(selectedClient)} data-testid="fare-settings-btn">
                    <PoundSterling className="w-4 h-4 mr-2" />
                    Fare Settings
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={() => {
                      setNewPassword("");
                      setShowPasswordModal(true);
                    }} 
                    data-testid="set-password-btn"
                  >
                    <Key className="w-4 h-4 mr-2" />
                    Set Portal Password
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => handleOpenForm(selectedClient)} data-testid="edit-client-btn">
                    <Pencil className="w-4 h-4 mr-2" />
                    Edit Client
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => setShowDeleteModal(true)}
                    className="text-destructive focus:text-destructive"
                    data-testid="delete-client-btn"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Client
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Client Details Cards */}
            <div className="grid grid-cols-2 gap-6">
              {/* Contact Details */}
              <div className="bg-white rounded-xl border p-5">
                <h3 className="font-semibold mb-4 text-slate-700">Contact Details</h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">{selectedClient.mobile || "-"}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">{selectedClient.email || "-"}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">Started: {selectedClient.start_date || "-"}</span>
                  </div>
                </div>
              </div>

              {/* Account Details */}
              <div className="bg-white rounded-xl border p-5">
                <h3 className="font-semibold mb-4 text-slate-700">Account Details</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Client Type</span>
                    <Badge variant="outline">{selectedClient.client_type}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Payment Method</span>
                    <Badge variant="outline">{selectedClient.payment_method}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Status</span>
                    <Badge className={selectedClient.status === "active" ? "bg-green-100 text-green-700" : ""}>
                      {selectedClient.status}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Location Details */}
              <div className="bg-white rounded-xl border p-5">
                <h3 className="font-semibold mb-4 text-slate-700">Location Details</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-start gap-3">
                    <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
                    <div>
                      {selectedClient.address && <p>{selectedClient.address}</p>}
                      {selectedClient.town_city && <p>{selectedClient.town_city}</p>}
                      {selectedClient.post_code && <p>{selectedClient.post_code}</p>}
                      {selectedClient.country && <p>{selectedClient.country}</p>}
                      {!selectedClient.address && !selectedClient.town_city && (
                        <p className="text-muted-foreground">No address provided</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Invoice Summary */}
              <div className="bg-white rounded-xl border p-5">
                <h3 className="font-semibold mb-4 text-slate-700">Invoice Summary</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Total Bookings</span>
                    <span className="font-semibold">{selectedClient.booking_count || 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Total Amount</span>
                    <span className="font-semibold text-lg">£{(selectedClient.total_invoice || 0).toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Notes */}
            {selectedClient.notes && (
              <div className="bg-white rounded-xl border p-5 mt-6">
                <h3 className="font-semibold mb-3 text-slate-700">Notes</h3>
                <p className="text-sm text-muted-foreground">{selectedClient.notes}</p>
              </div>
            )}

            {/* Recent Bookings */}
            <div className="bg-white rounded-xl border p-5 mt-6">
              <h3 className="font-semibold mb-4 text-slate-700">Recent Bookings</h3>
              {loadingBookings ? (
                <div className="text-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
                </div>
              ) : clientBookings.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="w-10 h-10 mx-auto text-muted-foreground/50 mb-2" />
                  <p className="text-sm text-muted-foreground">No bookings for this client</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {clientBookings.slice(0, 5).map((booking) => (
                    <div key={booking.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <div>
                        <p className="text-sm font-medium">{booking.booking_id}</p>
                        <p className="text-xs text-muted-foreground">
                          {booking.pickup_location?.substring(0, 30)}...
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">£{(booking.fare || 0).toFixed(2)}</p>
                        <Badge variant="outline" className="text-xs">
                          {booking.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Building2 className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
              <p className="text-muted-foreground">Select a client to view details</p>
            </div>
          </div>
        )}
      </div>

      {/* Add/Edit Client Modal */}
      <Dialog open={showFormModal} onOpenChange={setShowFormModal}>
        <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto" data-testid="client-form-modal">
          <DialogHeader>
            <DialogTitle>{editingClient ? "Edit Client" : "Add New Client"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Name <span className="text-destructive">*</span></Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter client name"
                data-testid="client-name-input"
              />
            </div>

            {/* Mobile & Email */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="mobile">Mobile <span className="text-destructive">*</span></Label>
                <Input
                  id="mobile"
                  value={formData.mobile}
                  onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                  placeholder="07700 900000"
                  data-testid="client-mobile-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email <span className="text-destructive">*</span></Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="client@example.com"
                  data-testid="client-email-input"
                />
              </div>
            </div>

            {/* Client Type & Payment Method */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Client Type</Label>
                <Select
                  value={formData.client_type}
                  onValueChange={(value) => setFormData({ ...formData, client_type: value })}
                >
                  <SelectTrigger data-testid="client-type-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CLIENT_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Default Payment Method</Label>
                <Select
                  value={formData.payment_method}
                  onValueChange={(value) => setFormData({ ...formData, payment_method: value })}
                >
                  <SelectTrigger data-testid="client-payment-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((method) => (
                      <SelectItem key={method.value} value={method.value}>
                        {method.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Start Date */}
            <div className="space-y-2">
              <Label htmlFor="start_date">Start Date</Label>
              <Input
                id="start_date"
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                data-testid="client-start-date-input"
              />
            </div>

            {/* Status */}
            <div className="flex items-center justify-between py-2">
              <div>
                <Label>Client Status</Label>
                <p className="text-sm text-muted-foreground">Is this client currently active?</p>
              </div>
              <Switch
                checked={formData.status === "active"}
                onCheckedChange={(checked) => 
                  setFormData({ ...formData, status: checked ? "active" : "inactive" })
                }
                data-testid="client-status-switch"
              />
            </div>

            {/* Address Fields */}
            <div className="border-t pt-4">
              <Label className="text-base font-semibold mb-3 block">Location Details</Label>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="address">Address</Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="Street address"
                    data-testid="client-address-input"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="town_city">Town/City</Label>
                    <Input
                      id="town_city"
                      value={formData.town_city}
                      onChange={(e) => setFormData({ ...formData, town_city: e.target.value })}
                      placeholder="Town or city"
                      data-testid="client-city-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="post_code">Post Code</Label>
                    <Input
                      id="post_code"
                      value={formData.post_code}
                      onChange={(e) => setFormData({ ...formData, post_code: e.target.value })}
                      placeholder="SR8 1AB"
                      data-testid="client-postcode-input"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="country">Country</Label>
                  <Input
                    id="country"
                    value={formData.country}
                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                    placeholder="United Kingdom"
                    data-testid="client-country-input"
                  />
                </div>
              </div>
            </div>

            {/* VAT Settings */}
            <div className="space-y-4 p-4 bg-slate-50 rounded-lg">
              <h4 className="font-medium text-slate-700">VAT Settings</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>VAT Rate</Label>
                  <Select
                    value={formData.vat_rate}
                    onValueChange={(value) => setFormData({ ...formData, vat_rate: value })}
                  >
                    <SelectTrigger data-testid="client-vat-rate">
                      <SelectValue placeholder="Select VAT rate" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="20">20% VAT</SelectItem>
                      <SelectItem value="0">No VAT (0%)</SelectItem>
                      <SelectItem value="exempt">VAT Exempt</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vat_number">VAT Number</Label>
                  <Input
                    id="vat_number"
                    value={formData.vat_number}
                    onChange={(e) => setFormData({ ...formData, vat_number: e.target.value })}
                    placeholder="GB123456789"
                    data-testid="client-vat-number"
                  />
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional notes about this client..."
                rows={3}
                data-testid="client-notes-input"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFormModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveClient} disabled={saving} data-testid="save-client-btn">
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : editingClient ? (
                "Update Client"
              ) : (
                "Create Client"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <AlertDialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <AlertDialogContent data-testid="delete-client-modal">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Client</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{selectedClient?.name}</strong>? 
              This will not delete their booking history but will remove the client account.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteClient}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="confirm-delete-client-btn"
            >
              {saving ? "Deleting..." : "Delete Client"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Generate Invoice Modal */}
      <Dialog open={showInvoiceModal} onOpenChange={setShowInvoiceModal}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-hidden flex flex-col" data-testid="invoice-modal">
          <DialogHeader>
            <DialogTitle>Generate Invoice</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4 overflow-y-auto flex-1">
            <div className="bg-slate-50 rounded-lg p-4">
              <p className="text-sm font-medium">{selectedClient?.name}</p>
              <p className="text-xs text-muted-foreground">Account: {selectedClient?.account_no}</p>
            </div>

            {/* Quick Date Range Buttons */}
            <div className="space-y-2">
              <Label>Date Range</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setQuickDateRange('this_month')}
                  className="flex-1"
                >
                  This Month
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setQuickDateRange('last_month')}
                  className="flex-1"
                >
                  Last Month
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setQuickDateRange('all_time')}
                  className="flex-1"
                >
                  All Time
                </Button>
              </div>
            </div>

            {/* Date Range Inputs */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="invoice_start_date">From Date</Label>
                <Input
                  id="invoice_start_date"
                  type="date"
                  value={invoiceDateRange.start}
                  onChange={(e) => setInvoiceDateRange({ ...invoiceDateRange, start: e.target.value })}
                  data-testid="invoice-start-date"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invoice_end_date">To Date</Label>
                <Input
                  id="invoice_end_date"
                  type="date"
                  value={invoiceDateRange.end}
                  onChange={(e) => setInvoiceDateRange({ ...invoiceDateRange, end: e.target.value })}
                  data-testid="invoice-end-date"
                />
              </div>
            </div>

            {/* Bookings Preview */}
            <div className="space-y-2">
              <Label>Bookings Preview</Label>
              <div className="border rounded-lg overflow-hidden">
                {loadingInvoicePreview ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : invoiceBookings.length === 0 ? (
                  <div className="text-center py-8 text-sm text-muted-foreground">
                    No bookings found for the selected period
                  </div>
                ) : (
                  <>
                    {/* Table Header */}
                    <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-slate-100 text-xs font-medium text-slate-600 border-b">
                      <div className="col-span-2">Date</div>
                      <div className="col-span-2">Booking</div>
                      <div className="col-span-3">Passenger</div>
                      <div className="col-span-3">Route</div>
                      <div className="col-span-2 text-right">Fare (£)</div>
                    </div>
                    {/* Table Body */}
                    <div className="max-h-[200px] overflow-y-auto">
                      {invoiceBookings.map((booking) => {
                        const bookingDate = booking.booking_datetime 
                          ? format(new Date(booking.booking_datetime), 'dd/MM/yy')
                          : '-';
                        const customerName = booking.customer_name || 
                          `${booking.first_name || ''} ${booking.last_name || ''}`.trim() || '-';
                        const route = `${(booking.pickup_location || '').substring(0, 15)}...`;
                        
                        return (
                          <div 
                            key={booking.id} 
                            className="grid grid-cols-12 gap-2 px-3 py-2 text-sm border-b last:border-b-0 hover:bg-slate-50 items-center"
                          >
                            <div className="col-span-2 text-xs text-muted-foreground">{bookingDate}</div>
                            <div className="col-span-2 font-medium">{booking.booking_id}</div>
                            <div className="col-span-3 truncate">{customerName}</div>
                            <div className="col-span-3 text-xs text-muted-foreground truncate">{route}</div>
                            <div className="col-span-2">
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={booking.fare || 0}
                                onChange={(e) => updateBookingPrice(booking.id, e.target.value)}
                                className="h-7 text-right text-sm w-full"
                                data-testid={`booking-fare-${booking.id}`}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {/* Total Row */}
                    <div className="grid grid-cols-12 gap-2 px-3 py-3 bg-slate-50 border-t font-medium">
                      <div className="col-span-10 text-right">Total:</div>
                      <div className="col-span-2 text-right text-primary">£{invoiceTotal.toFixed(2)}</div>
                    </div>
                  </>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                You can edit the fares above before generating the invoice
              </p>
            </div>
          </div>
          <DialogFooter className="border-t pt-4">
            <Button variant="outline" onClick={() => setShowInvoiceModal(false)}>
              Cancel
            </Button>
            <Button 
              variant="outline"
              onClick={() => handleGenerateInvoice(true)} 
              disabled={generatingInvoice || invoiceBookings.length === 0} 
              data-testid="download-invoice-btn"
            >
              {generatingInvoice ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  Download PDF
                </>
              )}
            </Button>
            <Button 
              onClick={() => handleGenerateInvoice(false)} 
              disabled={generatingInvoice || invoiceBookings.length === 0} 
              data-testid="generate-invoice-btn"
            >
              {generatingInvoice ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4 mr-2" />
                  Generate Invoice (£{invoiceTotal.toFixed(2)})
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Set Portal Password Modal */}
      <Dialog open={showPasswordModal} onOpenChange={setShowPasswordModal}>
        <DialogContent className="sm:max-w-[400px]" data-testid="password-modal">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="w-5 h-5" />
              Set Portal Password
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Set or reset the portal login password for <strong>{selectedClient?.name}</strong>
            </p>
            
            <div className="space-y-2">
              <Label>Login Email</Label>
              <Input 
                value={selectedClient?.email || selectedClient?.contact_email || "-"} 
                disabled 
                className="bg-slate-50"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password (min 6 characters)"
                data-testid="new-password-input"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPasswordModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleSetPassword} disabled={saving || !newPassword}>
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Set Password"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Fare Settings Modal */}
      <Dialog open={showFareSettingsModal} onOpenChange={setShowFareSettingsModal}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto" data-testid="fare-settings-modal">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PoundSterling className="w-5 h-5" />
              Fare Settings - {selectedClient?.name}
            </DialogTitle>
          </DialogHeader>

          {loadingFareSettings ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Toggle Custom Fares */}
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                <div>
                  <Label className="text-base font-medium">Use Custom Fare Model</Label>
                  <p className="text-sm text-muted-foreground">
                    Enable to use client-specific fares instead of global settings
                  </p>
                </div>
                <Switch
                  checked={fareSettings.use_custom_fares}
                  onCheckedChange={(checked) => setFareSettings({ ...fareSettings, use_custom_fares: checked })}
                  data-testid="use-custom-fares-switch"
                />
              </div>

              {fareSettings.use_custom_fares && (
                <>
                  {/* Copy from Global Button */}
                  <Button 
                    variant="outline" 
                    onClick={handleCopyFromGlobal}
                    className="w-full"
                  >
                    <Settings className="w-4 h-4 mr-2" />
                    Copy from Global Settings
                  </Button>

                  {/* Mile Rates Section */}
                  <div className="space-y-4">
                    <h3 className="font-semibold text-lg">Mileage Rates</h3>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Base Fare (£)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={fareSettings.custom_mile_rates?.base_fare || ""}
                          onChange={(e) => setFareSettings({
                            ...fareSettings,
                            custom_mile_rates: {
                              ...fareSettings.custom_mile_rates,
                              base_fare: parseFloat(e.target.value) || 0
                            }
                          })}
                          placeholder="e.g. 3.50"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Price per Mile (£)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={fareSettings.custom_mile_rates?.price_per_mile || ""}
                          onChange={(e) => setFareSettings({
                            ...fareSettings,
                            custom_mile_rates: {
                              ...fareSettings.custom_mile_rates,
                              price_per_mile: parseFloat(e.target.value) || 0
                            }
                          })}
                          placeholder="e.g. 2.00"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Minimum Fare (£)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={fareSettings.custom_mile_rates?.minimum_fare || ""}
                          onChange={(e) => setFareSettings({
                            ...fareSettings,
                            custom_mile_rates: {
                              ...fareSettings.custom_mile_rates,
                              minimum_fare: parseFloat(e.target.value) || 0
                            }
                          })}
                          placeholder="e.g. 10.00"
                        />
                      </div>
                    </div>

                    {/* Vehicle-specific rates */}
                    {vehicleTypes.length > 0 && (
                      <div className="space-y-3">
                        <Label className="text-sm font-medium">Vehicle-Specific Rates</Label>
                        <div className="space-y-2">
                          {vehicleTypes.map((vt) => (
                            <div key={vt.id} className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg">
                              <span className="w-32 font-medium text-sm">{vt.name}</span>
                              <div className="flex-1 grid grid-cols-3 gap-2">
                                <Input
                                  type="number"
                                  step="0.01"
                                  placeholder="Base"
                                  className="h-8 text-sm"
                                  value={fareSettings.custom_mile_rates?.vehicle_rates?.[vt.id]?.base_fare || ""}
                                  onChange={(e) => {
                                    const vehicleRates = fareSettings.custom_mile_rates?.vehicle_rates || {};
                                    setFareSettings({
                                      ...fareSettings,
                                      custom_mile_rates: {
                                        ...fareSettings.custom_mile_rates,
                                        vehicle_rates: {
                                          ...vehicleRates,
                                          [vt.id]: {
                                            ...vehicleRates[vt.id],
                                            base_fare: parseFloat(e.target.value) || 0
                                          }
                                        }
                                      }
                                    });
                                  }}
                                />
                                <Input
                                  type="number"
                                  step="0.01"
                                  placeholder="Per Mile"
                                  className="h-8 text-sm"
                                  value={fareSettings.custom_mile_rates?.vehicle_rates?.[vt.id]?.price_per_mile || ""}
                                  onChange={(e) => {
                                    const vehicleRates = fareSettings.custom_mile_rates?.vehicle_rates || {};
                                    setFareSettings({
                                      ...fareSettings,
                                      custom_mile_rates: {
                                        ...fareSettings.custom_mile_rates,
                                        vehicle_rates: {
                                          ...vehicleRates,
                                          [vt.id]: {
                                            ...vehicleRates[vt.id],
                                            price_per_mile: parseFloat(e.target.value) || 0
                                          }
                                        }
                                      }
                                    });
                                  }}
                                />
                                <Input
                                  type="number"
                                  step="0.01"
                                  placeholder="Minimum"
                                  className="h-8 text-sm"
                                  value={fareSettings.custom_mile_rates?.vehicle_rates?.[vt.id]?.minimum_fare || ""}
                                  onChange={(e) => {
                                    const vehicleRates = fareSettings.custom_mile_rates?.vehicle_rates || {};
                                    setFareSettings({
                                      ...fareSettings,
                                      custom_mile_rates: {
                                        ...fareSettings.custom_mile_rates,
                                        vehicle_rates: {
                                          ...vehicleRates,
                                          [vt.id]: {
                                            ...vehicleRates[vt.id],
                                            minimum_fare: parseFloat(e.target.value) || 0
                                          }
                                        }
                                      }
                                    });
                                  }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Fare Zones Section */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-lg">Fare Zones</h3>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setFareSettings({
                          ...fareSettings,
                          custom_fare_zones: [
                            ...fareSettings.custom_fare_zones,
                            { zone_name: "", zone_type: "dropoff", postcodes: [], areas: [], fixed_fare: 0, vehicle_fares: {} }
                          ]
                        })}
                      >
                        <Plus className="w-4 h-4 mr-1" /> Add Zone
                      </Button>
                    </div>

                    {fareSettings.custom_fare_zones?.map((zone, idx) => (
                      <div key={idx} className="p-4 border rounded-lg space-y-3 bg-white">
                        <div className="flex items-center justify-between">
                          <Input
                            value={zone.zone_name || ""}
                            onChange={(e) => {
                              const zones = [...fareSettings.custom_fare_zones];
                              zones[idx] = { ...zones[idx], zone_name: e.target.value };
                              setFareSettings({ ...fareSettings, custom_fare_zones: zones });
                            }}
                            placeholder="Zone Name (e.g. Newcastle Airport)"
                            className="w-64"
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const zones = fareSettings.custom_fare_zones.filter((_, i) => i !== idx);
                              setFareSettings({ ...fareSettings, custom_fare_zones: zones });
                            }}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs">Postcodes (comma separated)</Label>
                            <Input
                              value={(zone.postcodes || []).join(", ")}
                              onChange={(e) => {
                                const zones = [...fareSettings.custom_fare_zones];
                                zones[idx] = { ...zones[idx], postcodes: e.target.value.split(",").map(p => p.trim()).filter(Boolean) };
                                setFareSettings({ ...fareSettings, custom_fare_zones: zones });
                              }}
                              placeholder="NE13, DH1"
                              className="h-8 text-sm"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Areas (comma separated)</Label>
                            <Input
                              value={(zone.areas || []).join(", ")}
                              onChange={(e) => {
                                const zones = [...fareSettings.custom_fare_zones];
                                zones[idx] = { ...zones[idx], areas: e.target.value.split(",").map(a => a.trim()).filter(Boolean) };
                                setFareSettings({ ...fareSettings, custom_fare_zones: zones });
                              }}
                              placeholder="Durham, Sunderland"
                              className="h-8 text-sm"
                            />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Fixed Fare (£) - or set per vehicle below</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={zone.fixed_fare || ""}
                            onChange={(e) => {
                              const zones = [...fareSettings.custom_fare_zones];
                              zones[idx] = { ...zones[idx], fixed_fare: parseFloat(e.target.value) || 0 };
                              setFareSettings({ ...fareSettings, custom_fare_zones: zones });
                            }}
                            placeholder="45.00"
                            className="h-8 text-sm w-32"
                          />
                        </div>
                        {/* Per-vehicle fares for this zone */}
                        {vehicleTypes.length > 0 && (
                          <div className="space-y-1">
                            <Label className="text-xs">Per Vehicle Fares</Label>
                            <div className="flex flex-wrap gap-2">
                              {vehicleTypes.map((vt) => (
                                <div key={vt.id} className="flex items-center gap-1">
                                  <span className="text-xs text-muted-foreground">{vt.name}:</span>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    className="h-7 w-20 text-xs"
                                    placeholder="£"
                                    value={zone.vehicle_fares?.[vt.id] || ""}
                                    onChange={(e) => {
                                      const zones = [...fareSettings.custom_fare_zones];
                                      zones[idx] = {
                                        ...zones[idx],
                                        vehicle_fares: {
                                          ...zones[idx].vehicle_fares,
                                          [vt.id]: parseFloat(e.target.value) || 0
                                        }
                                      };
                                      setFareSettings({ ...fareSettings, custom_fare_zones: zones });
                                    }}
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}

                    {(!fareSettings.custom_fare_zones || fareSettings.custom_fare_zones.length === 0) && (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No fare zones configured. Add zones or copy from global settings.
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFareSettingsModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveFareSettings} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Settings"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ClientsPage;
