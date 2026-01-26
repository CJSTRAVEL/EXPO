import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { format } from "date-fns";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Search, ArrowRightLeft, Trash2, Eye, Edit } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

export default function QuotesPage() {
  const navigate = useNavigate();
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [vehicleTypes, setVehicleTypes] = useState([]);
  const [deleteQuote, setDeleteQuote] = useState(null);
  const [convertingQuote, setConvertingQuote] = useState(null);

  useEffect(() => {
    fetchQuotes();
    fetchVehicleTypes();
  }, []);

  const fetchQuotes = async () => {
    try {
      const response = await axios.get(`${API}/api/quotes`);
      setQuotes(response.data || []);
    } catch (error) {
      console.error("Error fetching quotes:", error);
      toast.error("Failed to load quotes");
    } finally {
      setLoading(false);
    }
  };

  const fetchVehicleTypes = async () => {
    try {
      const response = await axios.get(`${API}/api/vehicle-types`);
      setVehicleTypes(response.data || []);
    } catch (error) {
      console.error("Error fetching vehicle types:", error);
    }
  };

  const getVehicleTypeName = (vehicleTypeId) => {
    const vt = vehicleTypes.find((v) => v.id === vehicleTypeId);
    return vt ? vt.name : "Not specified";
  };

  const handleConvertToBooking = async (quote) => {
    setConvertingQuote(quote);
  };

  const confirmConvert = async () => {
    if (!convertingQuote) return;
    
    try {
      // Navigate to new booking page with quote data pre-filled
      navigate(`/bookings/new?from_quote=${convertingQuote.id}`);
    } catch (error) {
      console.error("Error converting quote:", error);
      toast.error("Failed to convert quote");
    } finally {
      setConvertingQuote(null);
    }
  };

  const handleDeleteQuote = async () => {
    if (!deleteQuote) return;
    
    try {
      await axios.delete(`${API}/api/quotes/${deleteQuote.id}`);
      toast.success("Quote deleted");
      fetchQuotes();
    } catch (error) {
      console.error("Error deleting quote:", error);
      toast.error("Failed to delete quote");
    } finally {
      setDeleteQuote(null);
    }
  };

  const getStatusBadge = (status) => {
    const variants = {
      pending: "bg-yellow-100 text-yellow-800 hover:bg-yellow-100",
      converted: "bg-green-100 text-green-800 hover:bg-green-100",
      expired: "bg-gray-100 text-gray-800 hover:bg-gray-100",
      cancelled: "bg-red-100 text-red-800 hover:bg-red-100",
    };
    return (
      <Badge className={variants[status] || variants.pending}>
        {status?.charAt(0).toUpperCase() + status?.slice(1) || "Pending"}
      </Badge>
    );
  };

  const filteredQuotes = quotes.filter((quote) => {
    const matchesSearch =
      searchTerm === "" ||
      `${quote.customer_first_name} ${quote.customer_last_name}`
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      quote.customer_phone?.includes(searchTerm) ||
      quote.pickup_location?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      quote.dropoff_location?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      quote.quote_number?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === "all" || quote.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="quotes-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Quotes & Scheduling</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage quotes and fleet scheduling
          </p>
        </div>
        <Button asChild className="bg-[#D4A853] hover:bg-[#c49843] text-white">
          <Link to="/quotes/new" data-testid="new-quote-btn">
            <Plus className="w-4 h-4 mr-2" />
            New Quote
          </Link>
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="quotes" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="quotes" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Quotes
          </TabsTrigger>
          <TabsTrigger value="scheduling" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Scheduling
          </TabsTrigger>
        </TabsList>

        <TabsContent value="quotes" className="mt-6">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, phone, location, or quote number..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                data-testid="search-quotes"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]" data-testid="status-filter">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="converted">Converted</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Quotes Table */}
          <div className="border rounded-lg bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quote #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Date & Time</TableHead>
                  <TableHead>Route</TableHead>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Fare</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created By</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredQuotes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      {searchTerm || statusFilter !== "all"
                        ? "No quotes match your search"
                        : "No quotes yet. Create your first quote!"}
                    </TableCell>
                  </TableRow>
                ) : (
              filteredQuotes.map((quote) => (
                <TableRow key={quote.id} data-testid={`quote-row-${quote.id}`}>
                  <TableCell className="font-medium">
                    {quote.quote_number || "—"}
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">
                        {quote.customer_first_name} {quote.customer_last_name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {quote.customer_phone}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    {quote.quote_date ? (
                      <div>
                        <p>{format(new Date(quote.quote_date), "dd MMM yyyy")}</p>
                        <p className="text-sm text-muted-foreground">
                          {quote.quote_time || format(new Date(quote.quote_date), "HH:mm")}
                        </p>
                      </div>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="max-w-[200px]">
                      <p className="text-sm truncate" title={quote.pickup_location}>
                        📍 {quote.pickup_location}
                      </p>
                      {quote.additional_stops?.length > 0 && (
                        <p className="text-xs text-muted-foreground">
                          +{quote.additional_stops.length} stop(s)
                        </p>
                      )}
                      <p className="text-sm truncate" title={quote.dropoff_location}>
                        🎯 {quote.dropoff_location}
                      </p>
                      {quote.return_journey && (
                        <Badge variant="outline" className="text-xs mt-1">
                          Return
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{getVehicleTypeName(quote.vehicle_type_id)}</TableCell>
                  <TableCell>
                    {quote.quoted_fare ? `£${quote.quoted_fare.toFixed(2)}` : "—"}
                  </TableCell>
                  <TableCell>{getStatusBadge(quote.status)}</TableCell>
                  <TableCell>
                    <p className="text-sm">{quote.created_by_name || "—"}</p>
                    {quote.created_at && (
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(quote.created_at), "dd/MM/yy")}
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      {quote.status === "pending" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleConvertToBooking(quote)}
                          className="text-green-600 hover:text-green-700 hover:bg-green-50"
                          data-testid={`convert-quote-${quote.id}`}
                        >
                          <ArrowRightLeft className="w-4 h-4 mr-1" />
                          Convert
                        </Button>
                      )}
                      {quote.status === "converted" && quote.converted_booking_id && (
                        <Button
                          variant="outline"
                          size="sm"
                          asChild
                        >
                          <Link to={`/bookings/${quote.converted_booking_id}`}>
                            <Eye className="w-4 h-4 mr-1" />
                            View Booking
                          </Link>
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        asChild
                      >
                        <Link to={`/quotes/${quote.id}/edit`}>
                          <Edit className="w-4 h-4" />
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteQuote(quote)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
        </TabsContent>

        <TabsContent value="scheduling" className="mt-6">
          <FleetSchedule />
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteQuote} onOpenChange={() => setDeleteQuote(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Quote</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete quote {deleteQuote?.quote_number}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteQuote}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Convert Confirmation Dialog */}
      <AlertDialog open={!!convertingQuote} onOpenChange={() => setConvertingQuote(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Convert Quote to Booking</AlertDialogTitle>
            <AlertDialogDescription>
              You'll be taken to the new booking page with all quote details pre-filled. 
              You can review and modify the details before creating the booking.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmConvert}
              className="bg-green-600 hover:bg-green-700"
            >
              Continue to Booking
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
