import { useEffect, useState } from "react";
import axios from "axios";
import { format, isValid, parseISO } from "date-fns";
import { Inbox, Plane, Clock, MapPin, User, Phone, CheckCircle, XCircle, Loader2, MessageSquare, PoundSterling, Car } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

const RequestsPage = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [rejectDialog, setRejectDialog] = useState(null);
  const [rejectReason, setRejectReason] = useState("");

  const fetchRequests = async () => {
    try {
      const response = await axios.get(`${API}/admin/booking-requests`);
      setRequests(response.data || []);
    } catch (error) {
      toast.error("Failed to load requests");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleApprove = async (requestId) => {
    setProcessingId(requestId);
    try {
      const response = await axios.put(`${API}/admin/booking-requests/${requestId}/approve`);
      toast.success(`Booking ${response.data.booking_id} created!`);
      fetchRequests();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to approve request");
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async () => {
    if (!rejectDialog) return;
    setProcessingId(rejectDialog.id);
    try {
      await axios.put(`${API}/admin/booking-requests/${rejectDialog.id}/reject?admin_notes=${encodeURIComponent(rejectReason)}`);
      toast.success("Request rejected");
      setRejectDialog(null);
      setRejectReason("");
      fetchRequests();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to reject request");
    } finally {
      setProcessingId(null);
    }
  };

  const pendingRequests = requests.filter(r => r.status === 'pending');
  const processedRequests = requests.filter(r => r.status !== 'pending');

  const RequestCard = ({ request, showActions = true }) => (
    <Card 
      className={`overflow-hidden ${
        request.status === 'pending' ? 'border-amber-300 bg-amber-50/30' :
        request.status === 'approved' ? 'border-green-300 bg-green-50/30' :
        'border-red-300 bg-red-50/30'
      }`}
      data-testid={`request-card-${request.id}`}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
              request.status === 'pending' ? 'bg-amber-100' :
              request.status === 'approved' ? 'bg-green-100' : 'bg-red-100'
            }`}>
              <User className={`w-5 h-5 ${
                request.status === 'pending' ? 'text-amber-600' :
                request.status === 'approved' ? 'text-green-600' : 'text-red-600'
              }`} />
            </div>
            <div>
              <p className="font-semibold text-slate-800">{request.passenger_name}</p>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Phone className="w-3 h-3" />
                {request.passenger_phone}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {request.flight_number && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-600 text-white text-xs font-bold rounded">
                <Plane className="w-3 h-3" />
                {request.flight_number}
              </span>
            )}
            <Badge variant={
              request.status === 'pending' ? 'warning' :
              request.status === 'approved' ? 'success' : 'destructive'
            } className={
              request.status === 'pending' ? 'bg-amber-500' :
              request.status === 'approved' ? 'bg-green-500' : 'bg-red-500'
            }>
              {request.status.toUpperCase()}
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-4 mb-4">
          {/* Date & Time */}
          <div className="col-span-3">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Clock className="w-4 h-4" />
              <span className="text-xs">Pickup Time</span>
            </div>
            <p className="font-medium text-slate-800">
              {safeFormatDate(request.pickup_datetime, "EEE, dd MMM")}
            </p>
            <p className="text-xl font-bold text-primary">
              {safeFormatDate(request.pickup_datetime, "HH:mm")}
            </p>
          </div>

          {/* Journey */}
          <div className="col-span-6">
            <div className="flex items-start gap-3">
              <div className="flex flex-col items-center mt-1">
                <div className="w-3 h-3 rounded-full bg-green-500 border-2 border-white shadow"></div>
                <div className="w-0.5 h-10 bg-slate-300"></div>
                <div className="w-3 h-3 rounded-full bg-red-500 border-2 border-white shadow"></div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate" title={request.pickup_location}>
                  {request.pickup_location}
                </p>
                <div className="h-5"></div>
                <p className="text-sm text-slate-600 truncate" title={request.dropoff_location}>
                  {request.dropoff_location}
                </p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="col-span-3 flex items-center justify-end">
            {showActions && request.status === 'pending' && (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="text-red-600 border-red-300 hover:bg-red-50"
                  onClick={() => setRejectDialog(request)}
                  disabled={processingId === request.id}
                  data-testid={`reject-${request.id}`}
                >
                  <XCircle className="w-4 h-4 mr-1" />
                  Reject
                </Button>
                <Button
                  size="sm"
                  className="bg-green-600 hover:bg-green-700"
                  onClick={() => handleApprove(request.id)}
                  disabled={processingId === request.id}
                  data-testid={`approve-${request.id}`}
                >
                  {processingId === request.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Approve
                    </>
                  )}
                </Button>
              </div>
            )}
            {request.status === 'approved' && request.booking_id && (
              <Badge variant="outline" className="text-green-700 border-green-300">
                Booking: {request.booking_id}
              </Badge>
            )}
          </div>
        </div>

        {/* Notes */}
        {request.notes && (
          <div className="flex items-start gap-2 p-3 bg-white/50 rounded-lg border border-slate-200">
            <MessageSquare className="w-4 h-4 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Customer Notes</p>
              <p className="text-sm text-slate-700">{request.notes}</p>
            </div>
          </div>
        )}

        {/* Admin notes for rejected */}
        {request.status === 'rejected' && request.admin_notes && (
          <div className="flex items-start gap-2 p-3 bg-red-50 rounded-lg border border-red-200 mt-2">
            <MessageSquare className="w-4 h-4 text-red-500 mt-0.5" />
            <div>
              <p className="text-xs font-medium text-red-600 mb-1">Rejection Reason</p>
              <p className="text-sm text-red-700">{request.admin_notes}</p>
            </div>
          </div>
        )}

        {/* Timestamp */}
        <p className="text-xs text-muted-foreground mt-3">
          Requested {safeFormatDate(request.created_at, "dd MMM yyyy 'at' HH:mm")}
        </p>
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Booking Requests</h1>
          <p className="page-subtitle">
            Manage booking requests from the passenger portal
          </p>
        </div>
        {pendingRequests.length > 0 && (
          <div className="flex items-center gap-2 px-4 py-2 bg-amber-100 rounded-lg">
            <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></div>
            <span className="font-semibold text-amber-700">
              {pendingRequests.length} pending request{pendingRequests.length !== 1 ? 's' : ''}
            </span>
          </div>
        )}
      </div>

      <div className="page-content">
        <Tabs defaultValue="pending" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="pending" className="relative">
              Pending
              {pendingRequests.length > 0 && (
                <span className="ml-2 px-2 py-0.5 text-xs bg-amber-500 text-white rounded-full">
                  {pendingRequests.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="processed">
              Processed
              {processedRequests.length > 0 && (
                <span className="ml-2 px-2 py-0.5 text-xs bg-slate-500 text-white rounded-full">
                  {processedRequests.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending">
            {pendingRequests.length === 0 ? (
              <div className="text-center py-16">
                <Inbox className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-semibold mb-2">No pending requests</h3>
                <p className="text-muted-foreground">
                  New booking requests from passengers will appear here
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingRequests.map((request) => (
                  <RequestCard key={request.id} request={request} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="processed">
            {processedRequests.length === 0 ? (
              <div className="text-center py-16">
                <Inbox className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-semibold mb-2">No processed requests</h3>
                <p className="text-muted-foreground">
                  Approved and rejected requests will appear here
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {processedRequests.map((request) => (
                  <RequestCard key={request.id} request={request} showActions={false} />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Reject Dialog */}
      <Dialog open={!!rejectDialog} onOpenChange={() => setRejectDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Booking Request</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-4">
              Are you sure you want to reject the booking request from{' '}
              <strong>{rejectDialog?.passenger_name}</strong>?
            </p>
            <div className="space-y-2">
              <Label htmlFor="reason">Reason (optional)</Label>
              <Textarea
                id="reason"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Enter reason for rejection..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialog(null)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleReject}
              disabled={processingId === rejectDialog?.id}
            >
              {processingId === rejectDialog?.id ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <XCircle className="w-4 h-4 mr-2" />
              )}
              Reject Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RequestsPage;
