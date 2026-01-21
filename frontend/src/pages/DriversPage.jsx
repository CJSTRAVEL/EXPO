import { useEffect, useState } from "react";
import axios from "axios";
import { Plus, Edit, Trash2, Phone, Car, User, FileText, AlertTriangle, CheckCircle2, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { parseISO, differenceInDays } from "date-fns";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const VEHICLE_TYPES = ["Sedan", "SUV", "MPV", "Executive", "Estate", "Minibus"];
const DRIVER_TYPES = [
  { value: "taxi", label: "Taxi" },
  { value: "psv", label: "PSV" },
];

// Document status helper
const getDocumentStatus = (expiryDate) => {
  if (!expiryDate) return { status: "missing", label: "Not Set", variant: "secondary" };
  
  const today = new Date();
  const expiry = parseISO(expiryDate);
  const daysUntilExpiry = differenceInDays(expiry, today);
  
  if (daysUntilExpiry < 0) {
    return { status: "expired", label: "Expired", variant: "destructive" };
  } else if (daysUntilExpiry <= 30) {
    return { status: "expiring", label: `${daysUntilExpiry}d`, variant: "warning" };
  } else {
    return { status: "valid", label: "Valid", variant: "success" };
  }
};

const DocumentBadge = ({ label, date }) => {
  const status = getDocumentStatus(date);
  const variantStyles = {
    success: "bg-green-100 text-green-800 border-green-200",
    warning: "bg-amber-100 text-amber-800 border-amber-200",
    destructive: "bg-red-100 text-red-800 border-red-200",
    secondary: "bg-gray-100 text-gray-600 border-gray-200",
  };
  
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <Badge variant="outline" className={`${variantStyles[status.variant]} text-xs px-1.5 py-0`}>
        {status.status === "expired" && <AlertTriangle className="w-2.5 h-2.5 mr-0.5" />}
        {status.status === "valid" && <CheckCircle2 className="w-2.5 h-2.5 mr-0.5" />}
        {status.label}
      </Badge>
    </div>
  );
};

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

const getDriverTypeBadge = (driverType) => {
  const styles = {
    taxi: "bg-blue-100 text-blue-800 border-blue-200",
    psv: "bg-purple-100 text-purple-800 border-purple-200",
  };
  return (
    <Badge variant="outline" className={`${styles[driverType] || "bg-gray-100"} text-xs font-medium uppercase`}>
      {driverType || "Taxi"}
    </Badge>
  );
};

// Check if driver has any expiring documents
const hasExpiringDocs = (driver) => {
  const taxiDocs = [driver.taxi_licence_expiry, driver.dbs_expiry, driver.school_badge_expiry, driver.driving_licence_expiry, driver.medical_due];
  const psvDocs = [driver.cpc_expiry, driver.tacho_card_expiry, driver.dbs_expiry, driver.school_badge_expiry];
  const docs = driver.driver_type === "psv" ? psvDocs : taxiDocs;
  
  return docs.some(d => {
    if (!d) return false;
    const status = getDocumentStatus(d);
    return status.status === "expiring" || status.status === "expired";
  });
};

const DriverCard = ({ driver, onEdit, onDelete }) => {
  const showExpiringWarning = hasExpiringDocs(driver);
  
  return (
    <Card className="driver-card group" data-testid={`driver-card-${driver.id}`}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center relative">
              <User className="w-6 h-6 text-primary" />
              {showExpiringWarning && (
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 rounded-full flex items-center justify-center">
                  <AlertTriangle className="w-2.5 h-2.5 text-white" />
                </div>
              )}
            </div>
            <div>
              <h3 className="font-semibold text-base">{driver.name}</h3>
              <div className="flex items-center gap-2 mt-1">
                {getStatusBadge(driver.status)}
                {getDriverTypeBadge(driver.driver_type)}
              </div>
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
        
        <div className="space-y-2 text-sm mb-3">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Phone className="w-4 h-4" />
            <span>{driver.phone}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Car className="w-4 h-4" />
            <span>{driver.vehicle_type} • {driver.vehicle_number}</span>
          </div>
        </div>

        {/* Document Status */}
        <div className="pt-3 border-t space-y-1.5">
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
            <FileText className="w-3 h-3" />
            Documents
          </h4>
          {driver.driver_type === "psv" ? (
            <>
              <DocumentBadge label="CPC" date={driver.cpc_expiry} />
              <DocumentBadge label="Tacho Card" date={driver.tacho_card_expiry} />
              <DocumentBadge label="DBS" date={driver.dbs_expiry} />
              <DocumentBadge label="School Badge" date={driver.school_badge_expiry} />
            </>
          ) : (
            <>
              <DocumentBadge label="Taxi Licence" date={driver.taxi_licence_expiry} />
              <DocumentBadge label="DBS" date={driver.dbs_expiry} />
              <DocumentBadge label="School Badge" date={driver.school_badge_expiry} />
              <DocumentBadge label="Driving Licence" date={driver.driving_licence_expiry} />
              <DocumentBadge label="Medical Due" date={driver.medical_due} />
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

const DriverForm = ({ driver, onSave, onClose, isOpen }) => {
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    driver_type: "taxi",
    vehicle_type: "Sedan",
    vehicle_number: "",
    status: "available",
    password: "",
    // Taxi docs
    taxi_licence_expiry: "",
    dbs_expiry: "",
    school_badge_expiry: "",
    driving_licence_expiry: "",
    medical_due: "",
    // PSV docs
    cpc_expiry: "",
    tacho_card_expiry: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (driver) {
      setFormData({
        ...driver,
        driver_type: driver.driver_type || "taxi",
        password: "",
        taxi_licence_expiry: driver.taxi_licence_expiry || "",
        dbs_expiry: driver.dbs_expiry || "",
        school_badge_expiry: driver.school_badge_expiry || "",
        driving_licence_expiry: driver.driving_licence_expiry || "",
        medical_due: driver.medical_due || "",
        cpc_expiry: driver.cpc_expiry || "",
        tacho_card_expiry: driver.tacho_card_expiry || "",
      });
    } else {
      setFormData({
        name: "",
        phone: "",
        email: "",
        driver_type: "taxi",
        vehicle_type: "Sedan",
        vehicle_number: "",
        status: "available",
        password: "",
        taxi_licence_expiry: "",
        dbs_expiry: "",
        school_badge_expiry: "",
        driving_licence_expiry: "",
        medical_due: "",
        cpc_expiry: "",
        tacho_card_expiry: "",
      });
    }
  }, [driver]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const dataToSave = { ...formData };
      // Don't send empty password on edit
      if (!dataToSave.password) {
        delete dataToSave.password;
      }
      // Convert empty strings to null for date fields
      const dateFields = ['taxi_licence_expiry', 'dbs_expiry', 'school_badge_expiry', 'driving_licence_expiry', 'medical_due', 'cpc_expiry', 'tacho_card_expiry'];
      dateFields.forEach(field => {
        if (!dataToSave[field]) dataToSave[field] = null;
      });
      
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
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto" data-testid="driver-form-modal">
        <DialogHeader>
          <DialogTitle>{driver ? "Edit Driver" : "Add New Driver"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name *</Label>
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
                <Label htmlFor="driver_type">Driver Type *</Label>
                <Select
                  value={formData.driver_type}
                  onValueChange={(value) => setFormData({ ...formData, driver_type: value })}
                >
                  <SelectTrigger data-testid="driver-type-select">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {DRIVER_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number *</Label>
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

            <div className="grid grid-cols-2 gap-4">
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
                <Label htmlFor="vehicle_number">Vehicle Registration *</Label>
                <Input
                  id="vehicle_number"
                  value={formData.vehicle_number}
                  onChange={(e) => setFormData({ ...formData, vehicle_number: e.target.value })}
                  placeholder="AB12 CDE"
                  required
                  data-testid="driver-vehicle-number-input"
                />
              </div>
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

            {/* Document Expiry Dates */}
            <div className="pt-4 border-t">
              <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Document Expiry Dates ({formData.driver_type === "psv" ? "PSV" : "Taxi"})
              </h4>
              
              {formData.driver_type === "psv" ? (
                // PSV Driver Documents
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="cpc_expiry">CPC Expiry</Label>
                    <Input
                      id="cpc_expiry"
                      type="date"
                      value={formData.cpc_expiry}
                      onChange={(e) => setFormData({ ...formData, cpc_expiry: e.target.value })}
                      data-testid="driver-cpc-expiry-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tacho_card_expiry">Tacho Card Expiry</Label>
                    <Input
                      id="tacho_card_expiry"
                      type="date"
                      value={formData.tacho_card_expiry}
                      onChange={(e) => setFormData({ ...formData, tacho_card_expiry: e.target.value })}
                      data-testid="driver-tacho-card-expiry-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dbs_expiry">DBS Expiry</Label>
                    <Input
                      id="dbs_expiry"
                      type="date"
                      value={formData.dbs_expiry}
                      onChange={(e) => setFormData({ ...formData, dbs_expiry: e.target.value })}
                      data-testid="driver-dbs-expiry-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="school_badge_expiry">School Badge Expiry</Label>
                    <Input
                      id="school_badge_expiry"
                      type="date"
                      value={formData.school_badge_expiry}
                      onChange={(e) => setFormData({ ...formData, school_badge_expiry: e.target.value })}
                      data-testid="driver-school-badge-expiry-input"
                    />
                  </div>
                </div>
              ) : (
                // Taxi Driver Documents
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="taxi_licence_expiry">Taxi Licence Expiry</Label>
                    <Input
                      id="taxi_licence_expiry"
                      type="date"
                      value={formData.taxi_licence_expiry}
                      onChange={(e) => setFormData({ ...formData, taxi_licence_expiry: e.target.value })}
                      data-testid="driver-taxi-licence-expiry-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dbs_expiry">DBS Expiry</Label>
                    <Input
                      id="dbs_expiry"
                      type="date"
                      value={formData.dbs_expiry}
                      onChange={(e) => setFormData({ ...formData, dbs_expiry: e.target.value })}
                      data-testid="driver-dbs-expiry-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="school_badge_expiry">School Badge Expiry</Label>
                    <Input
                      id="school_badge_expiry"
                      type="date"
                      value={formData.school_badge_expiry}
                      onChange={(e) => setFormData({ ...formData, school_badge_expiry: e.target.value })}
                      data-testid="driver-school-badge-expiry-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="driving_licence_expiry">Driving Licence Expiry</Label>
                    <Input
                      id="driving_licence_expiry"
                      type="date"
                      value={formData.driving_licence_expiry}
                      onChange={(e) => setFormData({ ...formData, driving_licence_expiry: e.target.value })}
                      data-testid="driver-driving-licence-expiry-input"
                    />
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="medical_due">Medical Due</Label>
                    <Input
                      id="medical_due"
                      type="date"
                      value={formData.medical_due}
                      onChange={(e) => setFormData({ ...formData, medical_due: e.target.value })}
                      data-testid="driver-medical-due-input"
                    />
                  </div>
                </div>
              )}
            </div>
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
  const [filterType, setFilterType] = useState("all");

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

  const filteredDrivers = drivers.filter(d => {
    if (filterType === "all") return true;
    if (filterType === "expiring") return hasExpiringDocs(d);
    return (d.driver_type || "taxi") === filterType;
  });

  // Stats
  const taxiCount = drivers.filter(d => !d.driver_type || d.driver_type === "taxi").length;
  const psvCount = drivers.filter(d => d.driver_type === "psv").length;
  const expiringCount = drivers.filter(d => hasExpiringDocs(d)).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-muted-foreground">Loading drivers...</div>
      </div>
    );
  }

  return (
    <div data-testid="drivers-page">
      <header className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Drivers</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage your drivers and their documents
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex gap-3 text-sm">
              <div className="text-center px-3 py-1 bg-blue-50 rounded-lg">
                <p className="font-bold text-blue-700">{taxiCount}</p>
                <p className="text-xs text-blue-600">Taxi</p>
              </div>
              <div className="text-center px-3 py-1 bg-purple-50 rounded-lg">
                <p className="font-bold text-purple-700">{psvCount}</p>
                <p className="text-xs text-purple-600">PSV</p>
              </div>
              {expiringCount > 0 && (
                <div className="text-center px-3 py-1 bg-amber-50 rounded-lg">
                  <p className="font-bold text-amber-700">{expiringCount}</p>
                  <p className="text-xs text-amber-600">Expiring</p>
                </div>
              )}
            </div>
            <Button onClick={() => { setSelectedDriver(null); setShowForm(true); }} data-testid="add-driver-btn">
              <Plus className="w-4 h-4 mr-2" />
              Add Driver
            </Button>
          </div>
        </div>
      </header>

      <div className="page-content">
        {/* Filter */}
        <div className="mb-6">
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[180px]" data-testid="driver-filter">
              <SelectValue placeholder="All Drivers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Drivers ({drivers.length})</SelectItem>
              <SelectItem value="taxi">Taxi Only ({taxiCount})</SelectItem>
              <SelectItem value="psv">PSV Only ({psvCount})</SelectItem>
              {expiringCount > 0 && (
                <SelectItem value="expiring">Docs Expiring ({expiringCount})</SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>

        {filteredDrivers.length === 0 ? (
          <div className="text-center py-16 bg-muted/30 rounded-lg">
            <User className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              {drivers.length === 0 ? "No drivers yet" : "No drivers match your filter"}
            </h3>
            <p className="text-muted-foreground mb-4">
              {drivers.length === 0 ? "Add your first driver to get started" : "Try changing your filter"}
            </p>
            {drivers.length === 0 && (
              <Button onClick={() => { setSelectedDriver(null); setShowForm(true); }}>
                <Plus className="w-4 h-4 mr-2" />
                Add Driver
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredDrivers.map((driver) => (
              <DriverCard
                key={driver.id}
                driver={driver}
                onEdit={(d) => { setSelectedDriver(d); setShowForm(true); }}
                onDelete={(d) => setDeleteDriver(d)}
              />
            ))}
          </div>
        )}
      </div>

      <DriverForm
        driver={selectedDriver}
        onSave={handleSave}
        onClose={() => { setShowForm(false); setSelectedDriver(null); }}
        isOpen={showForm}
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
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="confirm-delete-driver-btn"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default DriversPage;
