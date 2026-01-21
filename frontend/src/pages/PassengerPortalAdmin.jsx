import { useEffect, useState } from "react";
import axios from "axios";
import { User, Phone, Calendar, Key, Search, X, Eye, EyeOff, MoreHorizontal, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { format } from "date-fns";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const PassengerPortalAdmin = () => {
  const [passengers, setPassengers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState("");
  const [selectedPassenger, setSelectedPassenger] = useState(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newUser, setNewUser] = useState({ name: "", phone: "", password: "" });

  useEffect(() => {
    fetchPassengers();
  }, []);

  const fetchPassengers = async () => {
    try {
      const response = await axios.get(`${API}/admin/passengers`);
      setPassengers(response.data);
    } catch (error) {
      console.error("Error fetching passengers:", error);
      toast.error("Failed to load passenger accounts");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async () => {
    if (!newUser.name || !newUser.phone || !newUser.password) {
      toast.error("Please fill in all fields");
      return;
    }
    if (newUser.password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setSaving(true);
    try {
      await axios.post(`${API}/admin/passengers`, newUser);
      toast.success("Passenger account created successfully");
      setShowCreateModal(false);
      setNewUser({ name: "", phone: "", password: "" });
      fetchPassengers();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to create account");
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setSaving(true);
    try {
      await axios.put(`${API}/admin/passengers/${selectedPassenger.id}/password`, {
        password: newPassword
      });
      toast.success("Password updated successfully");
      setShowPasswordModal(false);
      setNewPassword("");
      setSelectedPassenger(null);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to update password");
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePassenger = async () => {
    setSaving(true);
    try {
      await axios.delete(`${API}/admin/passengers/${selectedPassenger.id}`);
      toast.success("Passenger account deleted");
      setShowDeleteModal(false);
      setSelectedPassenger(null);
      fetchPassengers();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to delete account");
    } finally {
      setSaving(false);
    }
  };

  // Filter passengers based on search
  const filteredPassengers = passengers.filter(passenger => {
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
    <div data-testid="passenger-portal-admin">
      <header className="page-header flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Passenger Portal</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage passenger accounts • {passengers.length} registered
          </p>
        </div>
        <Button onClick={() => setShowCreateModal(true)} className="btn-animate" data-testid="create-user-btn">
          <Plus className="w-4 h-4 mr-2" />
          Create User
        </Button>
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
            Showing {filteredPassengers.length} of {passengers.length} accounts
          </p>
        )}
      </div>

      {/* Passengers List */}
      <div className="page-content">
        {passengers.length === 0 ? (
          <div className="text-center py-16">
            <User className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No passenger accounts</h3>
            <p className="text-muted-foreground">Passengers will appear here once they register</p>
          </div>
        ) : filteredPassengers.length === 0 ? (
          <div className="text-center py-16">
            <Search className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No accounts found</h3>
            <p className="text-muted-foreground mb-4">Try a different search term</p>
            <Button variant="outline" onClick={() => setSearchText("")}>
              Clear Search
            </Button>
          </div>
        ) : (
          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600">Passenger</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600">Phone</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600">Registered</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600">Bookings</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPassengers.map((passenger) => (
                  <tr key={passenger.id} className="border-b hover:bg-slate-50" data-testid={`passenger-row-${passenger.id}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-slate-800">{passenger.name}</p>
                          <p className="text-xs text-muted-foreground">ID: {passenger.id.slice(0, 8)}...</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="w-4 h-4 text-muted-foreground" />
                        {passenger.phone}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="w-4 h-4" />
                        {passenger.created_at ? format(new Date(passenger.created_at), "dd MMM yyyy") : '-'}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                        {passenger.booking_count || 0} bookings
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8" data-testid={`passenger-actions-${passenger.id}`}>
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem 
                            onClick={() => {
                              setSelectedPassenger(passenger);
                              setShowPasswordModal(true);
                            }}
                            data-testid={`change-password-${passenger.id}`}
                          >
                            <Key className="w-4 h-4 mr-2" />
                            Change Password
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Change Password Modal */}
      <Dialog open={showPasswordModal} onOpenChange={(open) => {
        setShowPasswordModal(open);
        if (!open) {
          setNewPassword("");
          setSelectedPassenger(null);
        }
      }}>
        <DialogContent className="sm:max-w-[400px]" data-testid="change-password-modal">
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            {selectedPassenger && (
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-sm text-muted-foreground">Changing password for:</p>
                <p className="font-semibold">{selectedPassenger.name}</p>
                <p className="text-sm text-muted-foreground">{selectedPassenger.phone}</p>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="pr-10"
                  data-testid="new-password-input"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">Minimum 6 characters</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPasswordModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleChangePassword} disabled={saving || !newPassword} data-testid="save-password-btn">
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Update Password"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <AlertDialog open={showDeleteModal} onOpenChange={(open) => {
        setShowDeleteModal(open);
        if (!open) setSelectedPassenger(null);
      }}>
        <AlertDialogContent data-testid="delete-passenger-modal">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Passenger Account</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the account for <strong>{selectedPassenger?.name}</strong>? 
              This will remove their login access but their booking history will be preserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeletePassenger}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="confirm-delete-btn"
            >
              {saving ? "Deleting..." : "Delete Account"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create User Modal */}
      <Dialog open={showCreateModal} onOpenChange={(open) => {
        setShowCreateModal(open);
        if (!open) {
          setNewUser({ name: "", phone: "", password: "" });
          setShowPassword(false);
        }
      }}>
        <DialogContent className="sm:max-w-[400px]" data-testid="create-user-modal">
          <DialogHeader>
            <DialogTitle>Create Passenger Account</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-user-name">Full Name</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="new-user-name"
                  type="text"
                  placeholder="John Smith"
                  value={newUser.name}
                  onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                  className="pl-10"
                  data-testid="new-user-name-input"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-user-phone">Phone Number</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="new-user-phone"
                  type="tel"
                  placeholder="07700 900000"
                  value={newUser.phone}
                  onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })}
                  className="pl-10"
                  data-testid="new-user-phone-input"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-user-password">Password</Label>
              <div className="relative">
                <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="new-user-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  className="pl-10 pr-10"
                  data-testid="new-user-password-input"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">Minimum 6 characters</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreateUser} 
              disabled={saving || !newUser.name || !newUser.phone || !newUser.password}
              data-testid="save-new-user-btn"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Account"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PassengerPortalAdmin;
