import { useEffect, useState } from "react";
import axios from "axios";
import { User, Phone, Mail, Calendar, Search, Shield, ShieldOff, Trash2, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { format, isValid, parseISO } from "date-fns";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

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

const PassengersPage = () => {
  const [passengers, setPassengers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);

  const fetchPassengers = async () => {
    try {
      const response = await axios.get(`${API}/admin/passengers`);
      setPassengers(response.data);
    } catch (error) {
      console.error("Error fetching passengers:", error);
      toast.error("Failed to load passengers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPassengers();
  }, []);

  const handleBlock = async (passenger) => {
    setActionLoading(passenger.id);
    try {
      await axios.put(`${API}/admin/passengers/${passenger.id}/block`);
      toast.success(`${passenger.name} has been blocked`);
      fetchPassengers();
    } catch (error) {
      toast.error("Failed to block passenger");
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnblock = async (passenger) => {
    setActionLoading(passenger.id);
    try {
      await axios.put(`${API}/admin/passengers/${passenger.id}/unblock`);
      toast.success(`${passenger.name} has been unblocked`);
      fetchPassengers();
    } catch (error) {
      toast.error("Failed to unblock passenger");
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (passenger) => {
    setActionLoading(passenger.id);
    try {
      await axios.delete(`${API}/admin/passengers/${passenger.id}`);
      toast.success(`${passenger.name} has been deleted`);
      setShowDeleteConfirm(null);
      fetchPassengers();
    } catch (error) {
      toast.error("Failed to delete passenger");
    } finally {
      setActionLoading(null);
    }
  };

  const filteredPassengers = passengers.filter((p) => {
    const search = searchText.toLowerCase();
    return (
      p.name?.toLowerCase().includes(search) ||
      p.phone?.includes(search) ||
      p.email?.toLowerCase().includes(search)
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-[#D4A853]" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="passengers-page">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Passenger Accounts</h1>
        <p className="text-gray-400 text-sm mt-1">
          {passengers.length} registered passenger{passengers.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          placeholder="Search by name, phone or email..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          className="pl-10 bg-[#1a1a1a] border-[#3d3d3d] text-white placeholder:text-gray-500"
          data-testid="search-passengers"
        />
      </div>

      {/* Passengers List */}
      <div className="space-y-3">
        {filteredPassengers.length === 0 ? (
          <div className="text-center py-12 bg-[#1a1a1a] rounded-xl border border-[#2d2d2d]">
            <User className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">No passengers found</p>
          </div>
        ) : (
          filteredPassengers.map((passenger) => (
            <div
              key={passenger.id}
              className={`bg-[#1a1a1a] rounded-xl border p-4 transition-all ${
                passenger.is_blocked 
                  ? 'border-red-500/30 bg-red-500/5' 
                  : 'border-[#2d2d2d]'
              }`}
              data-testid={`passenger-row-${passenger.id}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {/* Avatar */}
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                    passenger.is_blocked ? 'bg-red-500/20' : 'bg-[#D4A853]/20'
                  }`}>
                    <User className={`w-6 h-6 ${passenger.is_blocked ? 'text-red-400' : 'text-[#D4A853]'}`} />
                  </div>

                  {/* Info */}
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-white">{passenger.name}</h3>
                      {passenger.is_blocked && (
                        <Badge variant="destructive" className="text-xs">Blocked</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-sm text-gray-400">
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {passenger.phone}
                      </span>
                      {passenger.email && (
                        <span className="flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          {passenger.email}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                      <span>
                        Joined {safeFormatDate(passenger.created_at, "dd MMM yyyy")}
                      </span>
                      <span>
                        {passenger.booking_count || 0} booking{passenger.booking_count !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  {passenger.is_blocked ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleUnblock(passenger)}
                      disabled={actionLoading === passenger.id}
                      className="border-green-500/50 text-green-400 hover:bg-green-500/10 bg-transparent"
                      data-testid={`unblock-${passenger.id}`}
                    >
                      {actionLoading === passenger.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <ShieldOff className="w-4 h-4 mr-1" />
                          Unblock
                        </>
                      )}
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleBlock(passenger)}
                      disabled={actionLoading === passenger.id}
                      className="border-[#D4A853]/50 text-[#D4A853] hover:bg-[#D4A853]/10 bg-transparent"
                      data-testid={`block-${passenger.id}`}
                    >
                      {actionLoading === passenger.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <Shield className="w-4 h-4 mr-1" />
                          Block
                        </>
                      )}
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowDeleteConfirm(passenger)}
                    className="border-red-500/50 text-red-400 hover:bg-red-500/10 bg-transparent"
                    data-testid={`delete-${passenger.id}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!showDeleteConfirm} onOpenChange={() => setShowDeleteConfirm(null)}>
        <DialogContent className="bg-[#1a1a1a] border-[#3d3d3d] text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-400">
              <AlertTriangle className="w-5 h-5" />
              Delete Passenger Account
            </DialogTitle>
          </DialogHeader>
          
          {showDeleteConfirm && (
            <div className="py-4">
              <p className="text-gray-300">
                Are you sure you want to permanently delete <strong>{showDeleteConfirm.name}</strong>'s account?
              </p>
              <p className="text-sm text-gray-500 mt-2">
                This action cannot be undone. The passenger will no longer be able to log in.
              </p>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowDeleteConfirm(null)}
              className="border-[#3d3d3d] text-gray-300 hover:bg-[#2d2d2d] bg-transparent"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleDelete(showDeleteConfirm)}
              disabled={actionLoading === showDeleteConfirm?.id}
              className="bg-red-500 hover:bg-red-600"
            >
              {actionLoading === showDeleteConfirm?.id ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Trash2 className="w-4 h-4 mr-2" />
              )}
              Delete Account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PassengersPage;
