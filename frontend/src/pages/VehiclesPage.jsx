import { useEffect, useState } from "react";
import axios from "axios";
import { 
  Car, Plus, Edit, Trash2, Users, Calendar, FileText, 
  Shield, AlertTriangle, CheckCircle2, Truck, Search, Filter
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { format, parseISO, differenceInDays, isAfter, isBefore, addDays } from "date-fns";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Document status badge helper
const getDocumentStatus = (expiryDate) => {
  if (!expiryDate) return { status: "missing", label: "Not Set", variant: "secondary" };
  
  const today = new Date();
  const expiry = parseISO(expiryDate);
  const daysUntilExpiry = differenceInDays(expiry, today);
  
  if (daysUntilExpiry < 0) {
    return { status: "expired", label: "Expired", variant: "destructive" };
  } else if (daysUntilExpiry <= 30) {
    return { status: "expiring", label: `${daysUntilExpiry}d left`, variant: "warning" };
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
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <Badge variant="outline" className={variantStyles[status.variant]}>
        {status.status === "expired" && <AlertTriangle className="w-3 h-3 mr-1" />}
        {status.status === "valid" && <CheckCircle2 className="w-3 h-3 mr-1" />}
        {status.label}
      </Badge>
    </div>
  );
};

// ============== VEHICLE TYPES TAB ==============
const VehicleTypesTab = ({ vehicleTypes, onRefresh }) => {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteItem, setDeleteItem] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    capacity: 4,
    description: "",
    has_trailer: false,
  });
  const [saving, setSaving] = useState(false);

  const resetForm = () => {
    setFormData({ name: "", capacity: 4, description: "", has_trailer: false });
    setEditing(null);
  };

  const openEdit = (vt) => {
    setEditing(vt);
    setFormData({
      name: vt.name || "",
      capacity: vt.capacity || 4,
      description: vt.description || "",
      has_trailer: vt.has_trailer || false,
    });
    setShowForm(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await axios.put(`${API}/vehicle-types/${editing.id}`, formData);
        toast.success("Vehicle type updated");
      } else {
        await axios.post(`${API}/vehicle-types`, formData);
        toast.success("Vehicle type created");
      }
      onRefresh();
      setShowForm(false);
      resetForm();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to save vehicle type");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await axios.delete(`${API}/vehicle-types/${deleteItem.id}`);
      toast.success("Vehicle type deleted");
      onRefresh();
      setDeleteItem(null);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to delete vehicle type");
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-muted-foreground">
          Create vehicle categories to group your fleet by capacity and type
        </p>
        <Button 
          onClick={() => { resetForm(); setShowForm(true); }} 
          data-testid="add-vehicle-type-btn"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Vehicle Type
        </Button>
      </div>

      {vehicleTypes.length === 0 ? (
        <div className="text-center py-16 bg-muted/30 rounded-lg">
          <Truck className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-semibold mb-2">No vehicle types yet</h3>
          <p className="text-muted-foreground mb-4">Create your first vehicle category to organize your fleet</p>
          <Button onClick={() => { resetForm(); setShowForm(true); }}>
            <Plus className="w-4 h-4 mr-2" />
            Add Vehicle Type
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {vehicleTypes.map((vt) => (
            <Card key={vt.id} className="group hover:shadow-md transition-shadow" data-testid={`vehicle-type-card-${vt.id}`}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                      {vt.has_trailer ? (
                        <Truck className="w-5 h-5 text-blue-600" />
                      ) : (
                        <Car className="w-5 h-5 text-blue-600" />
                      )}
                    </div>
                    <div>
                      <h3 className="font-semibold">{vt.name}</h3>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Users className="w-3 h-3" />
                        <span>{vt.capacity} passengers</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(vt)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => setDeleteItem(vt)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                
                {vt.description && (
                  <p className="text-sm text-muted-foreground mb-3">{vt.description}</p>
                )}
                
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Vehicles</span>
                  <Badge variant="secondary">{vt.vehicle_count || 0}</Badge>
                </div>
                
                {vt.has_trailer && (
                  <div className="mt-2 pt-2 border-t">
                    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                      <Truck className="w-3 h-3 mr-1" />
                      Has Trailer
                    </Badge>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Vehicle Type Form Modal */}
      <Dialog open={showForm} onOpenChange={(open) => { if (!open) { setShowForm(false); resetForm(); }}}>
        <DialogContent className="sm:max-w-[425px]" data-testid="vehicle-type-form-modal">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Vehicle Type" : "Add Vehicle Type"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="vt-name">Name *</Label>
                <Input
                  id="vt-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. CJ's Taxi"
                  required
                  data-testid="vehicle-type-name-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vt-capacity">Passenger Capacity *</Label>
                <Input
                  id="vt-capacity"
                  type="number"
                  min="1"
                  max="50"
                  value={formData.capacity}
                  onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) || 1 })}
                  required
                  data-testid="vehicle-type-capacity-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vt-description">Description</Label>
                <Textarea
                  id="vt-description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Optional description for this vehicle type"
                  rows={2}
                  data-testid="vehicle-type-description-input"
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="vt-trailer">Has Trailer</Label>
                  <p className="text-xs text-muted-foreground">For vehicles with attached luggage trailers</p>
                </div>
                <Switch
                  id="vt-trailer"
                  checked={formData.has_trailer}
                  onCheckedChange={(checked) => setFormData({ ...formData, has_trailer: checked })}
                  data-testid="vehicle-type-trailer-switch"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setShowForm(false); resetForm(); }}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving} data-testid="save-vehicle-type-btn">
                {saving ? "Saving..." : (editing ? "Update" : "Create")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteItem} onOpenChange={() => setDeleteItem(null)}>
        <AlertDialogContent data-testid="delete-vehicle-type-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Vehicle Type</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteItem?.name}"? 
              {deleteItem?.vehicle_count > 0 && (
                <span className="block mt-2 text-amber-600">
                  Warning: {deleteItem.vehicle_count} vehicles are assigned to this type. 
                  You must reassign or delete them first.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete} 
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="confirm-delete-vehicle-type-btn"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

// ============== VEHICLES TAB ==============
const VehiclesTab = ({ vehicles, vehicleTypes, onRefresh }) => {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteItem, setDeleteItem] = useState(null);
  const [searchText, setSearchText] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [formData, setFormData] = useState({
    registration: "",
    make: "",
    model: "",
    color: "",
    year: new Date().getFullYear(),
    vehicle_type_id: "",
    insurance_expiry: "",
    tax_expiry: "",
    mot_expiry: "",
    notes: "",
    is_active: true,
  });
  const [saving, setSaving] = useState(false);

  const resetForm = () => {
    setFormData({
      registration: "",
      make: "",
      model: "",
      color: "",
      year: new Date().getFullYear(),
      vehicle_type_id: "",
      insurance_expiry: "",
      tax_expiry: "",
      mot_expiry: "",
      notes: "",
      is_active: true,
    });
    setEditing(null);
  };

  const openEdit = (v) => {
    setEditing(v);
    setFormData({
      registration: v.registration || "",
      make: v.make || "",
      model: v.model || "",
      color: v.color || "",
      year: v.year || new Date().getFullYear(),
      vehicle_type_id: v.vehicle_type_id || "",
      insurance_expiry: v.insurance_expiry || "",
      tax_expiry: v.tax_expiry || "",
      mot_expiry: v.mot_expiry || "",
      notes: v.notes || "",
      is_active: v.is_active !== false,
    });
    setShowForm(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const dataToSend = { ...formData };
      // Convert empty strings to null for optional fields
      if (!dataToSend.vehicle_type_id) dataToSend.vehicle_type_id = null;
      if (!dataToSend.insurance_expiry) dataToSend.insurance_expiry = null;
      if (!dataToSend.tax_expiry) dataToSend.tax_expiry = null;
      if (!dataToSend.mot_expiry) dataToSend.mot_expiry = null;
      
      if (editing) {
        await axios.put(`${API}/vehicles/${editing.id}`, dataToSend);
        toast.success("Vehicle updated");
      } else {
        await axios.post(`${API}/vehicles`, dataToSend);
        toast.success("Vehicle added");
      }
      onRefresh();
      setShowForm(false);
      resetForm();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to save vehicle");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await axios.delete(`${API}/vehicles/${deleteItem.id}`);
      toast.success("Vehicle deleted");
      onRefresh();
      setDeleteItem(null);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to delete vehicle");
    }
  };

  // Filter vehicles
  const filteredVehicles = vehicles.filter((v) => {
    const matchesSearch = 
      v.registration?.toLowerCase().includes(searchText.toLowerCase()) ||
      v.make?.toLowerCase().includes(searchText.toLowerCase()) ||
      v.model?.toLowerCase().includes(searchText.toLowerCase());
    
    const matchesType = filterType === "all" || v.vehicle_type_id === filterType;
    
    let matchesStatus = true;
    if (filterStatus === "active") matchesStatus = v.is_active !== false;
    if (filterStatus === "inactive") matchesStatus = v.is_active === false;
    if (filterStatus === "expiring") {
      // Has any document expiring in 30 days
      const docs = [v.insurance_expiry, v.tax_expiry, v.mot_expiry];
      matchesStatus = docs.some(d => {
        if (!d) return false;
        const status = getDocumentStatus(d);
        return status.status === "expiring" || status.status === "expired";
      });
    }
    
    return matchesSearch && matchesType && matchesStatus;
  });

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by registration, make, model..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="pl-9"
            data-testid="vehicle-search-input"
          />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[180px]" data-testid="vehicle-type-filter">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {vehicleTypes.map((vt) => (
              <SelectItem key={vt.id} value={vt.id}>{vt.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[150px]" data-testid="vehicle-status-filter">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="expiring">Docs Expiring</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={() => { resetForm(); setShowForm(true); }} data-testid="add-vehicle-btn">
          <Plus className="w-4 h-4 mr-2" />
          Add Vehicle
        </Button>
      </div>

      {filteredVehicles.length === 0 ? (
        <div className="text-center py-16 bg-muted/30 rounded-lg">
          <Car className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-semibold mb-2">
            {vehicles.length === 0 ? "No vehicles yet" : "No vehicles match your filters"}
          </h3>
          <p className="text-muted-foreground mb-4">
            {vehicles.length === 0 
              ? "Add your first vehicle to start managing your fleet" 
              : "Try adjusting your search or filters"}
          </p>
          {vehicles.length === 0 && (
            <Button onClick={() => { resetForm(); setShowForm(true); }}>
              <Plus className="w-4 h-4 mr-2" />
              Add Vehicle
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredVehicles.map((v) => (
            <Card 
              key={v.id} 
              className={`group hover:shadow-md transition-shadow ${!v.is_active ? 'opacity-60' : ''}`}
              data-testid={`vehicle-card-${v.id}`}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${v.is_active ? 'bg-primary/10' : 'bg-gray-100'}`}>
                      <Car className={`w-6 h-6 ${v.is_active ? 'text-primary' : 'text-gray-400'}`} />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg">{v.registration}</h3>
                      <p className="text-sm text-muted-foreground">
                        {v.make} {v.model} {v.year ? `(${v.year})` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(v)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => setDeleteItem(v)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Vehicle Type Badge */}
                {v.vehicle_type && (
                  <div className="mb-3">
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                      <Users className="w-3 h-3 mr-1" />
                      {v.vehicle_type.name} ({v.vehicle_type.capacity} pax)
                    </Badge>
                  </div>
                )}

                {/* Document Status */}
                <div className="space-y-2 pt-3 border-t">
                  <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                    Documents
                  </h4>
                  <DocumentBadge label="Insurance" date={v.insurance_expiry} />
                  <DocumentBadge label="Road Tax" date={v.tax_expiry} />
                  <DocumentBadge label="MOT Test" date={v.mot_expiry} />
                </div>

                {/* Color & Notes */}
                {(v.color || v.notes) && (
                  <div className="mt-3 pt-3 border-t text-sm">
                    {v.color && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <span>Color:</span>
                        <span className="font-medium text-foreground">{v.color}</span>
                      </div>
                    )}
                    {v.notes && (
                      <p className="text-muted-foreground mt-1 line-clamp-2">{v.notes}</p>
                    )}
                  </div>
                )}

                {!v.is_active && (
                  <div className="mt-3">
                    <Badge variant="secondary">Inactive</Badge>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Vehicle Form Modal */}
      <Dialog open={showForm} onOpenChange={(open) => { if (!open) { setShowForm(false); resetForm(); }}}>
        <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto" data-testid="vehicle-form-modal">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Vehicle" : "Add Vehicle"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave}>
            <div className="space-y-4 py-4">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="v-registration">Registration *</Label>
                  <Input
                    id="v-registration"
                    value={formData.registration}
                    onChange={(e) => setFormData({ ...formData, registration: e.target.value.toUpperCase() })}
                    placeholder="AB12 CDE"
                    required
                    data-testid="vehicle-registration-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="v-type">Vehicle Type</Label>
                  <Select 
                    value={formData.vehicle_type_id} 
                    onValueChange={(value) => setFormData({ ...formData, vehicle_type_id: value })}
                  >
                    <SelectTrigger data-testid="vehicle-type-select">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {vehicleTypes.map((vt) => (
                        <SelectItem key={vt.id} value={vt.id}>
                          {vt.name} ({vt.capacity} pax)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="v-make">Make *</Label>
                  <Input
                    id="v-make"
                    value={formData.make}
                    onChange={(e) => setFormData({ ...formData, make: e.target.value })}
                    placeholder="Mercedes"
                    required
                    data-testid="vehicle-make-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="v-model">Model *</Label>
                  <Input
                    id="v-model"
                    value={formData.model}
                    onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                    placeholder="V-Class"
                    required
                    data-testid="vehicle-model-input"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="v-color">Color</Label>
                  <Input
                    id="v-color"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    placeholder="Black"
                    data-testid="vehicle-color-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="v-year">Year</Label>
                  <Input
                    id="v-year"
                    type="number"
                    min="1990"
                    max="2030"
                    value={formData.year}
                    onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) || null })}
                    data-testid="vehicle-year-input"
                  />
                </div>
              </div>

              {/* Document Dates */}
              <div className="pt-4 border-t">
                <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Document Expiry Dates
                </h4>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="v-insurance">Insurance</Label>
                    <Input
                      id="v-insurance"
                      type="date"
                      value={formData.insurance_expiry}
                      onChange={(e) => setFormData({ ...formData, insurance_expiry: e.target.value })}
                      data-testid="vehicle-insurance-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="v-tax">Road Tax</Label>
                    <Input
                      id="v-tax"
                      type="date"
                      value={formData.tax_expiry}
                      onChange={(e) => setFormData({ ...formData, tax_expiry: e.target.value })}
                      data-testid="vehicle-tax-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="v-mot">MOT Test</Label>
                    <Input
                      id="v-mot"
                      type="date"
                      value={formData.mot_expiry}
                      onChange={(e) => setFormData({ ...formData, mot_expiry: e.target.value })}
                      data-testid="vehicle-mot-input"
                    />
                  </div>
                </div>
              </div>

              {/* Notes & Status */}
              <div className="space-y-2">
                <Label htmlFor="v-notes">Notes</Label>
                <Textarea
                  id="v-notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Any additional notes about this vehicle..."
                  rows={2}
                  data-testid="vehicle-notes-input"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <div>
                  <Label htmlFor="v-active">Active Vehicle</Label>
                  <p className="text-xs text-muted-foreground">Inactive vehicles won't appear in assignments</p>
                </div>
                <Switch
                  id="v-active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                  data-testid="vehicle-active-switch"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setShowForm(false); resetForm(); }}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving} data-testid="save-vehicle-btn">
                {saving ? "Saving..." : (editing ? "Update" : "Add Vehicle")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteItem} onOpenChange={() => setDeleteItem(null)}>
        <AlertDialogContent data-testid="delete-vehicle-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Vehicle</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {deleteItem?.registration}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete} 
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="confirm-delete-vehicle-btn"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

// ============== MAIN PAGE ==============
const VehiclesPage = () => {
  const [vehicles, setVehicles] = useState([]);
  const [vehicleTypes, setVehicleTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("vehicles");

  const fetchData = async () => {
    try {
      const [vehiclesRes, typesRes] = await Promise.all([
        axios.get(`${API}/vehicles`),
        axios.get(`${API}/vehicle-types`),
      ]);
      setVehicles(vehiclesRes.data);
      setVehicleTypes(typesRes.data);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load vehicles data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // Stats for header
  const activeVehicles = vehicles.filter(v => v.is_active !== false).length;
  const expiringDocs = vehicles.filter(v => {
    const docs = [v.insurance_expiry, v.tax_expiry, v.mot_expiry];
    return docs.some(d => {
      if (!d) return false;
      const status = getDocumentStatus(d);
      return status.status === "expiring" || status.status === "expired";
    });
  }).length;

  return (
    <div data-testid="vehicles-page">
      <header className="page-header">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Fleet Management</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage your vehicles and vehicle types
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-2xl font-bold">{activeVehicles}</p>
              <p className="text-xs text-muted-foreground">Active Vehicles</p>
            </div>
            {expiringDocs > 0 && (
              <div className="text-right">
                <p className="text-2xl font-bold text-amber-600">{expiringDocs}</p>
                <p className="text-xs text-muted-foreground">Docs Expiring</p>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="page-content">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-6" data-testid="vehicles-tabs">
            <TabsTrigger value="vehicles" className="gap-2" data-testid="vehicles-tab">
              <Car className="w-4 h-4" />
              Vehicles ({vehicles.length})
            </TabsTrigger>
            <TabsTrigger value="types" className="gap-2" data-testid="vehicle-types-tab">
              <Truck className="w-4 h-4" />
              Vehicle Types ({vehicleTypes.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="vehicles">
            <VehiclesTab 
              vehicles={vehicles} 
              vehicleTypes={vehicleTypes} 
              onRefresh={fetchData} 
            />
          </TabsContent>

          <TabsContent value="types">
            <VehicleTypesTab 
              vehicleTypes={vehicleTypes} 
              onRefresh={fetchData} 
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default VehiclesPage;
