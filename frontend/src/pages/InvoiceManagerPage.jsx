import { useEffect, useState } from "react";
import axios from "axios";
import { 
  FileText, 
  Search, 
  Filter, 
  Download, 
  Mail, 
  CheckCircle, 
  Clock, 
  AlertCircle,
  XCircle,
  Building2,
  Calendar,
  PoundSterling,
  ChevronLeft,
  MoreHorizontal,
  Eye,
  Send,
  Loader2,
  ExternalLink,
  Pencil
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { format } from "date-fns";
import { Link } from "react-router-dom";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const STATUS_CONFIG = {
  paid: { 
    label: "Paid", 
    color: "bg-green-100 text-green-800 border-green-200",
    icon: CheckCircle 
  },
  unpaid: { 
    label: "Outstanding", 
    color: "bg-amber-100 text-amber-800 border-amber-200",
    icon: Clock 
  },
  overdue: { 
    label: "Overdue", 
    color: "bg-red-100 text-red-800 border-red-200",
    icon: AlertCircle 
  },
  cancelled: { 
    label: "Cancelled", 
    color: "bg-slate-100 text-slate-600 border-slate-200",
    icon: XCircle 
  },
};

const InvoiceManagerPage = () => {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [invoiceDetails, setInvoiceDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [sendingReminder, setSendingReminder] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  useEffect(() => {
    fetchInvoices();
  }, []);

  const fetchInvoices = async () => {
    try {
      const response = await axios.get(`${API}/invoices`);
      setInvoices(response.data);
    } catch (error) {
      console.error("Error fetching invoices:", error);
      toast.error("Failed to load invoices");
    } finally {
      setLoading(false);
    }
  };

  const fetchInvoiceDetails = async (invoiceId) => {
    setLoadingDetails(true);
    try {
      const response = await axios.get(`${API}/invoices/${invoiceId}`);
      setInvoiceDetails(response.data);
    } catch (error) {
      console.error("Error fetching invoice details:", error);
      toast.error("Failed to load invoice details");
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleViewDetails = async (invoice) => {
    setSelectedInvoice(invoice);
    setShowDetailModal(true);
    await fetchInvoiceDetails(invoice.id);
  };

  const handleUpdateStatus = async (invoiceId, newStatus) => {
    setUpdatingStatus(true);
    try {
      await axios.put(`${API}/invoices/${invoiceId}/status`, { status: newStatus });
      toast.success(`Invoice marked as ${newStatus}`);
      fetchInvoices();
      if (invoiceDetails && invoiceDetails.id === invoiceId) {
        setInvoiceDetails({ ...invoiceDetails, status: newStatus });
      }
    } catch (error) {
      console.error("Error updating invoice status:", error);
      toast.error(error.response?.data?.detail || "Failed to update status");
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleSendReminder = async (invoiceId) => {
    setSendingReminder(true);
    try {
      const response = await axios.post(`${API}/invoices/${invoiceId}/send-reminder`);
      toast.success(response.data.message || "Reminder sent successfully");
    } catch (error) {
      console.error("Error sending reminder:", error);
      toast.error(error.response?.data?.detail || "Failed to send reminder");
    } finally {
      setSendingReminder(false);
    }
  };

  const handleDownloadInvoice = async (invoice) => {
    try {
      // Use the client portal download endpoint with client ID
      const response = await axios.get(
        `${API}/clients/${invoice.client_id}/invoice?start_date=${invoice.start_date}&end_date=${invoice.end_date}`,
        { responseType: "blob" }
      );
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `${invoice.invoice_ref}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading invoice:", error);
      toast.error("Failed to download invoice");
    }
  };

  // Filter invoices
  const filteredInvoices = invoices.filter((invoice) => {
    const matchesSearch = 
      searchText === "" ||
      invoice.invoice_ref?.toLowerCase().includes(searchText.toLowerCase()) ||
      invoice.client_name?.toLowerCase().includes(searchText.toLowerCase()) ||
      invoice.client_account_no?.toLowerCase().includes(searchText.toLowerCase());
    
    const matchesStatus = 
      statusFilter === "all" || invoice.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  // Calculate stats
  const stats = {
    total: invoices.length,
    paid: invoices.filter(i => i.status === "paid").length,
    unpaid: invoices.filter(i => i.status === "unpaid").length,
    overdue: invoices.filter(i => i.status === "overdue").length,
    totalValue: invoices.reduce((sum, i) => sum + (i.total || 0), 0),
    outstandingValue: invoices
      .filter(i => i.status === "unpaid" || i.status === "overdue")
      .reduce((sum, i) => sum + (i.total || 0), 0),
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "N/A";
    try {
      return format(new Date(dateStr), "dd/MM/yyyy");
    } catch {
      return dateStr;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" data-testid="invoice-manager-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/clients">
            <Button variant="ghost" size="icon">
              <ChevronLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-7 h-7 text-primary" />
              Invoice Manager
            </h1>
            <p className="text-slate-500 text-sm">Manage and track all client invoices</p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Total Invoices</p>
              <p className="text-xl font-bold">{stats.total}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Paid</p>
              <p className="text-xl font-bold text-green-600">{stats.paid}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-lg">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Outstanding</p>
              <p className="text-xl font-bold text-amber-600">{stats.unpaid + stats.overdue}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <PoundSterling className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Outstanding Value</p>
              <p className="text-xl font-bold text-purple-600">£{stats.outstandingValue.toFixed(2)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border p-4">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search by reference, client name..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="pl-10"
              data-testid="invoice-search"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]" data-testid="status-filter">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="unpaid">Outstanding</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Invoice Table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead>Reference</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Period</TableHead>
              <TableHead>Journeys</TableHead>
              <TableHead>VAT</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredInvoices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-12">
                  <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500">No invoices found</p>
                </TableCell>
              </TableRow>
            ) : (
              filteredInvoices.map((invoice) => {
                const statusConfig = STATUS_CONFIG[invoice.status] || STATUS_CONFIG.unpaid;
                const StatusIcon = statusConfig.icon;
                const vatLabel = invoice.vat_rate === '0' ? 'No VAT' : 
                                 invoice.vat_rate === 'exempt' ? 'Exempt' : '20%';
                
                return (
                  <TableRow 
                    key={invoice.id} 
                    className="hover:bg-slate-50 cursor-pointer"
                    onClick={() => handleViewDetails(invoice)}
                    data-testid={`invoice-row-${invoice.id}`}
                  >
                    <TableCell className="font-medium">
                      {invoice.invoice_ref || "N/A"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-slate-400" />
                        <div>
                          <p className="font-medium">{invoice.client_name}</p>
                          <p className="text-xs text-slate-500">{invoice.client_account_no}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">
                        {formatDate(invoice.start_date)} - {formatDate(invoice.end_date)}
                      </span>
                    </TableCell>
                    <TableCell>{invoice.journey_count || 0}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={
                        invoice.vat_rate === '0' || invoice.vat_rate === 'exempt' 
                          ? 'text-slate-600' 
                          : 'text-blue-600'
                      }>
                        {vatLabel}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      £{(invoice.total || 0).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Badge className={`${statusConfig.color} border`}>
                        <StatusIcon className="w-3 h-3 mr-1" />
                        {statusConfig.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {formatDate(invoice.created_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleViewDetails(invoice); }}>
                            <Eye className="w-4 h-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDownloadInvoice(invoice); }}>
                            <Download className="w-4 h-4 mr-2" />
                            Download PDF
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {invoice.status !== "paid" && (
                            <DropdownMenuItem 
                              onClick={(e) => { e.stopPropagation(); handleUpdateStatus(invoice.id, "paid"); }}
                              className="text-green-600"
                            >
                              <CheckCircle className="w-4 h-4 mr-2" />
                              Mark as Paid
                            </DropdownMenuItem>
                          )}
                          {invoice.status === "paid" && (
                            <DropdownMenuItem 
                              onClick={(e) => { e.stopPropagation(); handleUpdateStatus(invoice.id, "unpaid"); }}
                              className="text-amber-600"
                            >
                              <Clock className="w-4 h-4 mr-2" />
                              Mark as Outstanding
                            </DropdownMenuItem>
                          )}
                          {(invoice.status === "unpaid" || invoice.status === "overdue") && (
                            <DropdownMenuItem 
                              onClick={(e) => { e.stopPropagation(); handleSendReminder(invoice.id); }}
                            >
                              <Send className="w-4 h-4 mr-2" />
                              Send Reminder
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Invoice Detail Modal */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Invoice Details
            </DialogTitle>
          </DialogHeader>

          {loadingDetails ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : invoiceDetails ? (
            <div className="space-y-6">
              {/* Invoice Header Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-slate-500">Reference</p>
                    <p className="font-semibold text-lg">{invoiceDetails.invoice_ref}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Client</p>
                    <p className="font-medium">{invoiceDetails.client_name}</p>
                    <p className="text-sm text-slate-500">{invoiceDetails.client_account_no}</p>
                  </div>
                  {invoiceDetails.client_email && (
                    <div>
                      <p className="text-sm text-slate-500">Email</p>
                      <p className="text-sm">{invoiceDetails.client_email}</p>
                    </div>
                  )}
                </div>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-slate-500">Status</p>
                    <div className="mt-1">
                      <Select 
                        value={invoiceDetails.status} 
                        onValueChange={(value) => handleUpdateStatus(invoiceDetails.id, value)}
                        disabled={updatingStatus}
                      >
                        <SelectTrigger className="w-[180px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="paid">
                            <span className="flex items-center gap-2">
                              <CheckCircle className="w-4 h-4 text-green-500" />
                              Paid
                            </span>
                          </SelectItem>
                          <SelectItem value="unpaid">
                            <span className="flex items-center gap-2">
                              <Clock className="w-4 h-4 text-amber-500" />
                              Outstanding
                            </span>
                          </SelectItem>
                          <SelectItem value="overdue">
                            <span className="flex items-center gap-2">
                              <AlertCircle className="w-4 h-4 text-red-500" />
                              Overdue
                            </span>
                          </SelectItem>
                          <SelectItem value="cancelled">
                            <span className="flex items-center gap-2">
                              <XCircle className="w-4 h-4 text-slate-500" />
                              Cancelled
                            </span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Period</p>
                    <p className="font-medium">
                      {formatDate(invoiceDetails.start_date)} - {formatDate(invoiceDetails.end_date)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Created</p>
                    <p className="text-sm">{formatDate(invoiceDetails.created_at)}</p>
                  </div>
                  {invoiceDetails.paid_at && (
                    <div>
                      <p className="text-sm text-slate-500">Paid On</p>
                      <p className="text-sm text-green-600">{formatDate(invoiceDetails.paid_at)}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Financial Summary */}
              <div className="bg-slate-50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-600">Journeys</span>
                  <span className="font-medium">{invoiceDetails.journey_count || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Subtotal</span>
                  <span>£{(invoiceDetails.subtotal || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">
                    {invoiceDetails.vat_rate === '0' ? 'No VAT (0%)' : 
                     invoiceDetails.vat_rate === 'exempt' ? 'VAT Exempt' : 'VAT (20%)'}
                  </span>
                  <span>£{(invoiceDetails.vat_amount || 0).toFixed(2)}</span>
                </div>
                <div className="border-t pt-2 flex justify-between">
                  <span className="font-semibold">Total</span>
                  <span className="font-bold text-lg">£{(invoiceDetails.total || 0).toFixed(2)}</span>
                </div>
              </div>

              {/* Bookings List */}
              {invoiceDetails.bookings && invoiceDetails.bookings.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-3">Journeys ({invoiceDetails.bookings.length})</h4>
                  <div className="border rounded-lg overflow-hidden max-h-[300px] overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50">
                          <TableHead>Date</TableHead>
                          <TableHead>Ref</TableHead>
                          <TableHead>Route</TableHead>
                          <TableHead className="text-right">Fare</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {invoiceDetails.bookings.map((booking, idx) => (
                          <TableRow key={booking.id || idx}>
                            <TableCell className="text-sm">
                              {formatDate(booking.booking_datetime)}
                            </TableCell>
                            <TableCell className="text-sm font-medium">
                              {booking.booking_id || "N/A"}
                            </TableCell>
                            <TableCell className="text-sm">
                              <div className="max-w-[200px] truncate">
                                {booking.pickup_location} → {booking.dropoff_location}
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              £{(booking.fare || 0).toFixed(2)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {/* Reminder History */}
              {invoiceDetails.reminders_sent && invoiceDetails.reminders_sent.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2 text-sm text-slate-600">Reminders Sent</h4>
                  <div className="flex flex-wrap gap-2">
                    {invoiceDetails.reminders_sent.map((date, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        <Mail className="w-3 h-3 mr-1" />
                        {formatDate(date)}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : null}

          <DialogFooter className="flex gap-2">
            {invoiceDetails && (invoiceDetails.status === "unpaid" || invoiceDetails.status === "overdue") && (
              <Button 
                variant="outline" 
                onClick={() => handleSendReminder(invoiceDetails.id)}
                disabled={sendingReminder}
              >
                {sendingReminder ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Send className="w-4 h-4 mr-2" />
                )}
                Send Reminder
              </Button>
            )}
            {invoiceDetails && (
              <Button 
                variant="outline" 
                onClick={() => handleDownloadInvoice(invoiceDetails)}
              >
                <Download className="w-4 h-4 mr-2" />
                Download PDF
              </Button>
            )}
            <Button onClick={() => setShowDetailModal(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default InvoiceManagerPage;
