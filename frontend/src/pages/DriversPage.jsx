import { useEffect, useState } from "react";
import axios from "axios";
import { Plus, Edit, Trash2, Phone, Car, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const VEHICLE_TYPES = ["Sedan", "SUV", "MPV", "Executive", "Estate"];

const getStatusBadge = (status) => {
  const styles = {
    available: "status-available",
    busy: "status-busy",
    offline: "status-offline",
  };
  return (
    <Badge variant="outline" className={`${styles[status]} text-xs font-medium capitalize`}>
      {status}
    </Badge>
  );
};

const DriverCard = ({ driver, onEdit, onDelete }) => (
  <Card className="driver-card group" data-testid={`driver-card-${driver.id}`}>
    <CardContent className="p-5">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <User className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-base">{driver.name}</h3>
            {getStatusBadge(driver.status)}
          </div>
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onEdit(driver)}
            data-testid={`edit-driver-${driver.id}`}
          >
            <Edit className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive"
            onClick={() => onDelete(driver)}
            data-testid={`delete-driver-${driver.id}`}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
      
      <div className="space-y-2 text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Phone className="w-4 h-4" />
          <span>{driver.phone}</span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Car className="w-4 h-4" />
          <span>{driver.vehicle_type} • {driver.vehicle_number}</span>
        </div>
      </div>
    </CardContent>
  </Card>
);

const DriverForm = ({ driver, onSave, onClose, isOpen }) => {
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    vehicle_type: "Sedan",
    vehicle_number: "",
    status: "available",
    password: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (driver) {
      setFormData({ ...driver, password: "" });
    } else {
      setFormData({
        name: "",
        phone: "",
        email: "",
        vehicle_type: "Sedan",
        vehicle_number: "",
        status: "available",
        password: "",
      });
    }
  }, [driver]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      // Don't send empty password on edit
      const dataToSave = { ...formData };
      if (!dataToSave.password) {
        delete dataToSave.password;
      }
      await onSave(dataToSave);
      onClose();
    } catch (error) {
      console.error("Error saving driver:", error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]" data-testid="driver-form-modal">
        <DialogHeader>
          <DialogTitle>{driver ? "Edit Driver" : "Add New Driver"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="John Smith"
                required
                data-testid="driver-name-input"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+44 7700 900000"
                required
                data-testid="driver-phone-input"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email (for Driver App)</Label>
              <Input
                id="email"
                type="email"
                value={formData.email || ""}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="driver@cjstravel.uk"
                data-testid="driver-email-input"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{driver ? "New Password (leave blank to keep)" : "Password (for Driver App)"}</Label>
              <Input
                id="password"
                type="password"
                value={formData.password || ""}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder={driver ? "Leave blank to keep current" : "Set password"}
                data-testid="driver-password-input"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vehicle_type">Vehicle Type</Label>
              <Select
                value={formData.vehicle_type}
                onValueChange={(value) => setFormData({ ...formData, vehicle_type: value })}
              >
                <SelectTrigger data-testid="driver-vehicle-type-select">
                  <SelectValue placeholder="Select vehicle type" />
                </SelectTrigger>
                <SelectContent>
                  {VEHICLE_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="vehicle_number">Vehicle Registration</Label>
              <Input
                id="vehicle_number"
                value={formData.vehicle_number}
                onChange={(e) => setFormData({ ...formData, vehicle_number: e.target.value })}
                placeholder="AB12 CDE"
                required
                data-testid="driver-vehicle-number-input"
              />
            </div>
            {driver && (
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => setFormData({ ...formData, status: value })}
                >
                  <SelectTrigger data-testid="driver-status-select">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="available">Available</SelectItem>
                    <SelectItem value="busy">Busy</SelectItem>
                    <SelectItem value="offline">Offline</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving} data-testid="save-driver-btn">
              {saving ? "Saving..." : (driver ? "Update" : "Add Driver")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const DriversPage = () => {
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [deleteDriver, setDeleteDriver] = useState(null);

  const fetchDrivers = async () => {
    try {
      const response = await axios.get(`${API}/drivers`);
      setDrivers(response.data);
    } catch (error) {
      console.error("Error fetching drivers:", error);
      toast.error("Failed to load drivers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDrivers();
  }, []);

  const handleSave = async (formData) => {
    try {
      if (selectedDriver) {
        await axios.put(`${API}/drivers/${selectedDriver.id}`, formData);
        toast.success("Driver updated successfully");
      } else {
        await axios.post(`${API}/drivers`, formData);
        toast.success("Driver added successfully");
      }
      fetchDrivers();
      setShowForm(false);
      setSelectedDriver(null);
    } catch (error) {
      toast.error("Failed to save driver");
      throw error;
    }
  };

  const handleDelete = async () => {
    try {
      await axios.delete(`${API}/drivers/${deleteDriver.id}`);
      toast.success("Driver deleted successfully");
      fetchDrivers();
      setDeleteDriver(null);
    } catch (error) {
      toast.error("Failed to delete driver");
    }
  };

  const handleEdit = (driver) => {
    setSelectedDriver(driver);
    setShowForm(true);
  };

  const handleAdd = () => {
    setSelectedDriver(null);
    setShowForm(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div data-testid="drivers-page">
      <header className="page-header flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Drivers</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your fleet drivers</p>
        </div>
        <Button onClick={handleAdd} className="btn-animate" data-testid="add-driver-btn">
          <Plus className="w-4 h-4 mr-2" />
          Add Driver
        </Button>
      </header>

      <div className="page-content">
        {drivers.length === 0 ? (
          <div className="text-center py-16">
            <User className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No drivers yet</h3>
            <p className="text-muted-foreground mb-4">Add your first driver to get started</p>
            <Button onClick={handleAdd} data-testid="add-first-driver-btn">
              <Plus className="w-4 h-4 mr-2" />
              Add Driver
            </Button>
          </div>
        ) : (
          <div className="driver-grid">
            {drivers.map((driver) => (
              <DriverCard
                key={driver.id}
                driver={driver}
                onEdit={handleEdit}
                onDelete={setDeleteDriver}
              />
            ))}
          </div>
        )}
      </div>

      <DriverForm
        driver={selectedDriver}
        isOpen={showForm}
        onSave={handleSave}
        onClose={() => {
          setShowForm(false);
          setSelectedDriver(null);
        }}
      />

      <AlertDialog open={!!deleteDriver} onOpenChange={() => setDeleteDriver(null)}>
        <AlertDialogContent data-testid="delete-driver-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Driver</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {deleteDriver?.name}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" data-testid="confirm-delete-driver-btn">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default DriversPage;
