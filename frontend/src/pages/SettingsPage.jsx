import { useState, useEffect } from "react";
import axios from "axios";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { User, Mail, Shield, Key, Plus, Edit, Trash2, Users, Clock, Check, X, MessageSquare, Send, RotateCcw, Info, Car, Calendar, Phone, Building2, MapPin, PoundSterling, Calculator, Route, Map } from "lucide-react";
import { format } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import BoundaryMap from "@/components/BoundaryMap";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const ROLES = [
  { value: "super_admin", label: "Super Admin", description: "Full access to all features" },
  { value: "admin", label: "Admin", description: "Manage users and settings" },
  { value: "dispatcher", label: "Dispatcher", description: "Create and manage bookings" },
];

const getRoleBadge = (role) => {
  const styles = {
    super_admin: "bg-purple-100 text-purple-800 border-purple-200",
    admin: "bg-blue-100 text-blue-800 border-blue-200",
    dispatcher: "bg-green-100 text-green-800 border-green-200",
  };
  const labels = {
    super_admin: "Super Admin",
    admin: "Admin",
    dispatcher: "Dispatcher",
  };
  return (
    <Badge variant="outline" className={styles[role] || "bg-gray-100"}>
      <Shield className="w-3 h-3 mr-1" />
      {labels[role] || role}
    </Badge>
  );
};

// Profile Settings Card
const ProfileCard = ({ user, onUpdate }) => {
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.name || "",
    email: user?.email || "",
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onUpdate(formData);
      toast.success("Profile updated");
      setEditing(false);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card data-testid="profile-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Profile
            </CardTitle>
            <CardDescription>Your account information</CardDescription>
          </div>
          {!editing && (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              <Edit className="w-4 h-4 mr-2" />
              Edit
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {editing ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                data-testid="profile-name-input"
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                data-testid="profile-email-input"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={saving} data-testid="save-profile-btn">
                {saving ? "Saving..." : "Save Changes"}
              </Button>
              <Button variant="outline" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="w-8 h-8 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">{user?.name}</h3>
                <p className="text-muted-foreground">{user?.email}</p>
                <div className="mt-1">{getRoleBadge(user?.role)}</div>
              </div>
            </div>
            {user?.last_login && (
              <div className="text-sm text-muted-foreground flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Last login: {format(new Date(user.last_login), "PPp")}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// Password Change Card
const PasswordCard = ({ onUpdate }) => {
  const [formData, setFormData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (formData.newPassword !== formData.confirmPassword) {
      toast.error("New passwords don't match");
      return;
    }
    
    if (formData.newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setSaving(true);
    try {
      await onUpdate({ password: formData.newPassword });
      toast.success("Password updated");
      setFormData({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to update password");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card data-testid="password-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Key className="w-5 h-5" />
          Change Password
        </CardTitle>
        <CardDescription>Update your account password</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>New Password</Label>
            <Input
              type="password"
              value={formData.newPassword}
              onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
              placeholder="Enter new password"
              data-testid="new-password-input"
            />
          </div>
          <div className="space-y-2">
            <Label>Confirm New Password</Label>
            <Input
              type="password"
              value={formData.confirmPassword}
              onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
              placeholder="Confirm new password"
              data-testid="confirm-password-input"
            />
          </div>
          <Button type="submit" disabled={saving} data-testid="change-password-btn">
            {saving ? "Updating..." : "Update Password"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

// User Management Card (Super Admin Only)
const UsersManagementCard = () => {
  const { user: currentUser, isSuperAdmin, isAdmin } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteUser, setDeleteUser] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: "dispatcher",
    is_active: true,
  });
  const [saving, setSaving] = useState(false);

  const fetchUsers = async () => {
    try {
      const response = await axios.get(`${API}/auth/users`);
      setUsers(response.data);
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isSuperAdmin) {
      fetchUsers();
    }
  }, [isSuperAdmin]);

  const resetForm = () => {
    setFormData({ name: "", email: "", password: "", role: "dispatcher", is_active: true });
    setEditing(null);
  };

  const openEdit = (user) => {
    setEditing(user);
    setFormData({
      name: user.name || "",
      email: user.email || "",
      password: "",
      role: user.role || "dispatcher",
      is_active: user.is_active !== false,
    });
    setShowForm(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const dataToSend = { ...formData };
      if (!dataToSend.password) delete dataToSend.password;
      
      if (editing) {
        await axios.put(`${API}/auth/users/${editing.id}`, dataToSend);
        toast.success("User updated");
      } else {
        if (!formData.password) {
          toast.error("Password is required for new users");
          setSaving(false);
          return;
        }
        await axios.post(`${API}/auth/users`, dataToSend);
        toast.success("User created");
      }
      fetchUsers();
      setShowForm(false);
      resetForm();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to save user");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await axios.delete(`${API}/auth/users/${deleteUser.id}`);
      toast.success("User deleted");
      fetchUsers();
      setDeleteUser(null);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to delete user");
    }
  };

  if (!isSuperAdmin) return null;

  return (
    <>
      <Card data-testid="users-management-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                User Management
              </CardTitle>
              <CardDescription>Manage dispatch system users</CardDescription>
            </div>
            <Button onClick={() => { resetForm(); setShowForm(true); }} data-testid="add-user-btn">
              <Plus className="w-4 h-4 mr-2" />
              Add User
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : users.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No users found</div>
          ) : (
            <div className="space-y-3">
              {users.map((u) => (
                <div
                  key={u.id}
                  className={`flex items-center justify-between p-4 rounded-lg border ${
                    !u.is_active ? "opacity-50 bg-muted/30" : "bg-card"
                  }`}
                  data-testid={`user-row-${u.id}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{u.name}</span>
                        {u.id === currentUser?.id && (
                          <Badge variant="secondary" className="text-xs">You</Badge>
                        )}
                        {!u.is_active && (
                          <Badge variant="outline" className="text-xs bg-red-50 text-red-700">Disabled</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{u.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {getRoleBadge(u.role)}
                    {u.id !== currentUser?.id && (
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(u)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => setDeleteUser(u)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* User Form Modal */}
      <Dialog open={showForm} onOpenChange={(open) => { if (!open) { setShowForm(false); resetForm(); }}}>
        <DialogContent className="sm:max-w-[425px]" data-testid="user-form-modal">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit User" : "Add New User"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="John Smith"
                  required
                  data-testid="user-name-input"
                />
              </div>
              <div className="space-y-2">
                <Label>Email *</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="john@cjsdispatch.co.uk"
                  required
                  data-testid="user-email-input"
                />
              </div>
              <div className="space-y-2">
                <Label>{editing ? "New Password (leave blank to keep)" : "Password *"}</Label>
                <Input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder={editing ? "Leave blank to keep current" : "Enter password"}
                  required={!editing}
                  data-testid="user-password-input"
                />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select
                  value={formData.role}
                  onValueChange={(value) => setFormData({ ...formData, role: value })}
                >
                  <SelectTrigger data-testid="user-role-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((role) => (
                      <SelectItem key={role.value} value={role.value}>
                        <div>
                          <div className="font-medium">{role.label}</div>
                          <div className="text-xs text-muted-foreground">{role.description}</div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Active</Label>
                  <p className="text-xs text-muted-foreground">Allow user to log in</p>
                </div>
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                  data-testid="user-active-switch"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setShowForm(false); resetForm(); }}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving} data-testid="save-user-btn">
                {saving ? "Saving..." : (editing ? "Update" : "Create User")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteUser} onOpenChange={() => setDeleteUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {deleteUser?.name}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

// ========== MESSAGE TEMPLATES SECTION ==========
const CATEGORY_INFO = {
  driver_app: { label: "Driver App", icon: Car, color: "bg-blue-100 text-blue-800" },
  passenger_portal: { label: "Passenger Portal", icon: Users, color: "bg-green-100 text-green-800" },
  corporate_portal: { label: "Corporate Portal", icon: Building2, color: "bg-indigo-100 text-indigo-800" },
  booking: { label: "New Bookings", icon: Calendar, color: "bg-purple-100 text-purple-800" },
  general: { label: "General", icon: MessageSquare, color: "bg-gray-100 text-gray-800" }
};

const VariableBadge = ({ variable }) => (
  <Badge variant="outline" className="text-xs font-mono bg-slate-50">
    {`{${variable}}`}
  </Badge>
);

// SMS Template Card Component
const SMSTemplateCard = ({ template, onEdit, onReset, onTest }) => {
  const category = CATEGORY_INFO[template.category] || CATEGORY_INFO.general;
  const CategoryIcon = category.icon;
  
  return (
    <Card className="hover:shadow-md transition-shadow" data-testid={`sms-template-${template.type}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge className={category.color}>
                <CategoryIcon className="w-3 h-3 mr-1" />
                {category.label}
              </Badge>
            </div>
            <CardTitle className="text-lg">{template.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</CardTitle>
            <CardDescription>{template.description}</CardDescription>
          </div>
          <MessageSquare className="w-5 h-5 text-muted-foreground" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="bg-slate-50 rounded-lg p-3 text-sm font-mono whitespace-pre-wrap border max-h-32 overflow-y-auto">
            {template.content}
          </div>
          
          {template.variables && template.variables.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Available Variables:</Label>
              <div className="flex flex-wrap gap-1">
                {template.variables.map(v => (
                  <VariableBadge key={v} variable={v} />
                ))}
              </div>
            </div>
          )}
          
          <div className="flex gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => onEdit(template)}>
              <Edit className="w-4 h-4 mr-1" /> Edit
            </Button>
            <Button variant="outline" size="sm" onClick={() => onReset(template.type)}>
              <RotateCcw className="w-4 h-4 mr-1" /> Reset
            </Button>
            <Button variant="outline" size="sm" onClick={() => onTest(template.type)}>
              <Send className="w-4 h-4 mr-1" /> Test
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Email Template Card Component
const EmailTemplateCard = ({ template, onEdit, onReset }) => {
  const category = CATEGORY_INFO[template.category] || CATEGORY_INFO.general;
  const CategoryIcon = category.icon;
  
  return (
    <Card className="hover:shadow-md transition-shadow" data-testid={`email-template-${template.type}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge className={category.color}>
                <CategoryIcon className="w-3 h-3 mr-1" />
                {category.label}
              </Badge>
            </div>
            <CardTitle className="text-lg">{template.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</CardTitle>
            <CardDescription>{template.description}</CardDescription>
          </div>
          <Mail className="w-5 h-5 text-muted-foreground" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <Label className="text-xs text-muted-foreground">Subject:</Label>
            <div className="bg-slate-50 rounded-lg p-2 text-sm font-medium border mt-1">
              {template.subject}
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Content:</Label>
            <div className="bg-slate-50 rounded-lg p-3 text-sm whitespace-pre-wrap border mt-1 max-h-24 overflow-y-auto">
              {template.content}
            </div>
          </div>
          
          {template.variables && template.variables.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Available Variables:</Label>
              <div className="flex flex-wrap gap-1">
                {template.variables.map(v => (
                  <VariableBadge key={v} variable={v} />
                ))}
              </div>
            </div>
          )}
          
          <div className="flex gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => onEdit(template)}>
              <Edit className="w-4 h-4 mr-1" /> Edit
            </Button>
            <Button variant="outline" size="sm" onClick={() => onReset(template.type)}>
              <RotateCcw className="w-4 h-4 mr-1" /> Reset
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Message Templates Section Component
const MessageTemplatesSection = () => {
  const [smsTemplates, setSmsTemplates] = useState([]);
  const [emailTemplates, setEmailTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [templateTab, setTemplateTab] = useState("sms");
  const [categoryFilter, setCategoryFilter] = useState("all");
  
  // Edit SMS Modal
  const [editingSMS, setEditingSMS] = useState(null);
  const [smsContent, setSmsContent] = useState("");
  const [savingSMS, setSavingSMS] = useState(false);
  
  // Edit Email Modal
  const [editingEmail, setEditingEmail] = useState(null);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailContent, setEmailContent] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);
  
  // Test SMS Modal
  const [testingSMS, setTestingSMS] = useState(null);
  const [testPhone, setTestPhone] = useState("");
  const [sendingTest, setSendingTest] = useState(false);
  
  // Reset Confirmation
  const [resetTemplate, setResetTemplate] = useState(null);
  const [resetType, setResetType] = useState(null);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const [smsRes, emailRes] = await Promise.all([
        axios.get(`${API}/admin/templates/sms`),
        axios.get(`${API}/admin/templates/email`)
      ]);
      setSmsTemplates(smsRes.data);
      setEmailTemplates(emailRes.data);
    } catch (error) {
      toast.error("Failed to load templates");
    } finally {
      setLoading(false);
    }
  };

  const handleEditSMS = (template) => {
    setEditingSMS(template);
    setSmsContent(template.content);
  };

  const handleSaveSMS = async () => {
    setSavingSMS(true);
    try {
      await axios.put(`${API}/admin/templates/sms`, {
        type: editingSMS.type,
        content: smsContent,
        category: editingSMS.category,
        description: editingSMS.description
      });
      toast.success("SMS template updated");
      setEditingSMS(null);
      loadTemplates();
    } catch (error) {
      toast.error("Failed to update template");
    } finally {
      setSavingSMS(false);
    }
  };

  const handleEditEmail = (template) => {
    setEditingEmail(template);
    setEmailSubject(template.subject);
    setEmailContent(template.content);
  };

  const handleSaveEmail = async () => {
    setSavingEmail(true);
    try {
      await axios.put(`${API}/admin/templates/email`, {
        type: editingEmail.type,
        subject: emailSubject,
        content: emailContent,
        category: editingEmail.category,
        description: editingEmail.description
      });
      toast.success("Email template updated");
      setEditingEmail(null);
      loadTemplates();
    } catch (error) {
      toast.error("Failed to update template");
    } finally {
      setSavingEmail(false);
    }
  };

  const handleResetTemplate = async () => {
    try {
      if (resetType === "sms") {
        await axios.delete(`${API}/admin/templates/sms/${resetTemplate}`);
      } else {
        await axios.delete(`${API}/admin/templates/email/${resetTemplate}`);
      }
      toast.success("Template reset to default");
      loadTemplates();
    } catch (error) {
      toast.error("Failed to reset template");
    } finally {
      setResetTemplate(null);
      setResetType(null);
    }
  };

  const handleTestSMS = async () => {
    if (!testPhone) {
      toast.error("Please enter a phone number");
      return;
    }
    setSendingTest(true);
    try {
      await axios.post(`${API}/admin/templates/sms/test?template_type=${testingSMS}&phone=${encodeURIComponent(testPhone)}`);
      toast.success("Test SMS sent!");
      setTestingSMS(null);
      setTestPhone("");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to send test SMS");
    } finally {
      setSendingTest(false);
    }
  };

  const filteredSMS = categoryFilter === "all" 
    ? smsTemplates 
    : smsTemplates.filter(t => t.category === categoryFilter);
    
  const filteredEmail = categoryFilter === "all"
    ? emailTemplates
    : emailTemplates.filter(t => t.category === categoryFilter);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Info Banner */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="py-3">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-600 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium">Template Variables</p>
              <p>Use variables like <code className="bg-blue-100 px-1 rounded">{'{customer_name}'}</code> in your templates. 
              These will be automatically replaced with actual values when messages are sent.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Category Filter */}
      <div className="flex items-center gap-4">
        <Label>Filter by category:</Label>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="driver_app">Driver App</SelectItem>
            <SelectItem value="passenger_portal">Passenger Portal</SelectItem>
            <SelectItem value="corporate_portal">Corporate Portal</SelectItem>
            <SelectItem value="booking">New Bookings</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Template Tabs */}
      <Tabs value={templateTab} onValueChange={setTemplateTab}>
        <TabsList>
          <TabsTrigger value="sms">
            <MessageSquare className="w-4 h-4 mr-2" />
            SMS ({filteredSMS.length})
          </TabsTrigger>
          <TabsTrigger value="email">
            <Mail className="w-4 h-4 mr-2" />
            Email ({filteredEmail.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sms" className="mt-4">
          <div className="grid gap-4 md:grid-cols-2">
            {filteredSMS.map(template => (
              <SMSTemplateCard
                key={template.type}
                template={template}
                onEdit={handleEditSMS}
                onReset={(type) => { setResetTemplate(type); setResetType("sms"); }}
                onTest={setTestingSMS}
              />
            ))}
          </div>
          {filteredSMS.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No SMS templates found for this category
            </div>
          )}
        </TabsContent>

        <TabsContent value="email" className="mt-4">
          <div className="grid gap-4 md:grid-cols-2">
            {filteredEmail.map(template => (
              <EmailTemplateCard
                key={template.type}
                template={template}
                onEdit={handleEditEmail}
                onReset={(type) => { setResetTemplate(type); setResetType("email"); }}
              />
            ))}
          </div>
          {filteredEmail.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No email templates found for this category
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Edit SMS Dialog */}
      <Dialog open={!!editingSMS} onOpenChange={() => setEditingSMS(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit SMS Template</DialogTitle>
            <DialogDescription>{editingSMS?.description}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {editingSMS?.variables && editingSMS.variables.length > 0 && (
              <div className="space-y-2">
                <Label>Available Variables (click to insert):</Label>
                <div className="flex flex-wrap gap-1">
                  {editingSMS.variables.map(v => (
                    <Button
                      key={v}
                      variant="outline"
                      size="sm"
                      className="text-xs font-mono"
                      onClick={() => setSmsContent(prev => prev + `{${v}}`)}
                    >
                      {`{${v}}`}
                    </Button>
                  ))}
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label>Message Content</Label>
              <Textarea
                value={smsContent}
                onChange={(e) => setSmsContent(e.target.value)}
                rows={6}
                className="font-mono text-sm"
                placeholder="Enter SMS content..."
              />
              <p className="text-xs text-muted-foreground">
                Character count: {smsContent.length} (SMS limit: 160 per segment)
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingSMS(null)}>Cancel</Button>
            <Button onClick={handleSaveSMS} disabled={savingSMS}>
              {savingSMS ? "Saving..." : "Save Template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Email Dialog */}
      <Dialog open={!!editingEmail} onOpenChange={() => setEditingEmail(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Email Template</DialogTitle>
            <DialogDescription>{editingEmail?.description}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {editingEmail?.variables && editingEmail.variables.length > 0 && (
              <div className="space-y-2">
                <Label>Available Variables (click to insert):</Label>
                <div className="flex flex-wrap gap-1">
                  {editingEmail.variables.map(v => (
                    <Button
                      key={v}
                      variant="outline"
                      size="sm"
                      className="text-xs font-mono"
                      onClick={() => setEmailContent(prev => prev + `{${v}}`)}
                    >
                      {`{${v}}`}
                    </Button>
                  ))}
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label>Subject Line</Label>
              <Input
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                placeholder="Email subject..."
              />
            </div>
            <div className="space-y-2">
              <Label>Email Content</Label>
              <Textarea
                value={emailContent}
                onChange={(e) => setEmailContent(e.target.value)}
                rows={8}
                placeholder="Enter email content..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingEmail(null)}>Cancel</Button>
            <Button onClick={handleSaveEmail} disabled={savingEmail}>
              {savingEmail ? "Saving..." : "Save Template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Test SMS Dialog */}
      <Dialog open={!!testingSMS} onOpenChange={() => { setTestingSMS(null); setTestPhone(""); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Test SMS</DialogTitle>
            <DialogDescription>Send a test message using sample data</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Phone Number</Label>
              <div className="flex gap-2">
                <Phone className="w-5 h-5 text-muted-foreground mt-2" />
                <Input
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  placeholder="+44 7XXX XXXXXX"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setTestingSMS(null); setTestPhone(""); }}>Cancel</Button>
            <Button onClick={handleTestSMS} disabled={sendingTest}>
              {sendingTest ? "Sending..." : "Send Test"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Confirmation */}
      <AlertDialog open={!!resetTemplate} onOpenChange={() => { setResetTemplate(null); setResetType(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset Template</AlertDialogTitle>
            <AlertDialogDescription>
              This will reset the template to its default content. Any customizations will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleResetTemplate}>Reset to Default</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

// Fare Settings Section with Zone Fares and Mile Rates
const FareSettingsSection = () => {
  const [fareTab, setFareTab] = useState("zones");
  const [zones, setZones] = useState([]);
  const [vehicleTypes, setVehicleTypes] = useState([]);
  const [mileRates, setMileRates] = useState({
    base_fare: 3.50,
    price_per_mile: 2.00,
    minimum_fare: 5.00,
    vehicle_rates: {}, // Per-vehicle rates: {vehicle_id: {base_fare, price_per_mile, minimum_fare}}
    waiting_rate_per_min: 0.50,
    night_multiplier: 1.5,
    night_start: "22:00",
    night_end: "06:00",
    airport_surcharge: 5.00,
  });
  const [loading, setLoading] = useState(true);
  const [showZoneDialog, setShowZoneDialog] = useState(false);
  const [editingZone, setEditingZone] = useState(null);
  const [zoneForm, setZoneForm] = useState({
    name: "",
    zone_type: "dropoff",
    postcodes: "",
    areas: "",
    vehicle_fares: {}, // Map of vehicle_type_id -> price
    description: "",
    boundary: null,
  });
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [zoneDefineMode, setZoneDefineMode] = useState("map"); // "map" or "text"

  // Fare calculator state
  const [calcDistance, setCalcDistance] = useState("");
  const [calcWaitTime, setCalcWaitTime] = useState("");
  const [calcIsNight, setCalcIsNight] = useState(false);
  const [calcIsAirport, setCalcIsAirport] = useState(false);
  const [calculatedFare, setCalculatedFare] = useState(null);
  const [calcVehicleType, setCalcVehicleType] = useState("");

  useEffect(() => {
    fetchFareSettings();
  }, []);

  const fetchFareSettings = async () => {
    try {
      const [zonesRes, ratesRes, vehicleTypesRes] = await Promise.all([
        axios.get(`${API}/settings/fare-zones`).catch(() => ({ data: [] })),
        axios.get(`${API}/settings/mile-rates`).catch(() => ({ data: null })),
        axios.get(`${API}/vehicle-types`).catch(() => ({ data: [] })),
      ]);
      setZones(zonesRes.data || []);
      setVehicleTypes(vehicleTypesRes.data || []);
      if (ratesRes.data) {
        setMileRates(prev => ({ ...prev, ...ratesRes.data }));
      }
    } catch (error) {
      console.error("Error fetching fare settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveZone = async () => {
    if (!zoneForm.name) {
      toast.error("Please enter zone name");
      return;
    }
    
    // Check if at least one vehicle fare is set
    const hasVehicleFares = Object.values(zoneForm.vehicle_fares).some(fare => fare && parseFloat(fare) > 0);
    if (!hasVehicleFares) {
      toast.error("Please set a fare for at least one vehicle type");
      return;
    }
    
    // Validate: need either boundary, postcodes, or areas
    const hasPostcodes = zoneForm.postcodes && zoneForm.postcodes.trim().length > 0;
    const hasAreas = zoneForm.areas && zoneForm.areas.trim().length > 0;
    const hasBoundary = zoneForm.boundary && zoneForm.boundary.length >= 3;
    
    if (!hasPostcodes && !hasAreas && !hasBoundary) {
      toast.error("Please draw a boundary on the map, or enter postcodes/area names");
      return;
    }

    setSaving(true);
    try {
      // Convert vehicle_fares values to floats and filter out empty/zero values
      const vehicleFares = {};
      Object.entries(zoneForm.vehicle_fares).forEach(([id, fare]) => {
        if (fare && parseFloat(fare) > 0) {
          vehicleFares[id] = parseFloat(fare);
        }
      });

      const payload = {
        name: zoneForm.name,
        zone_type: zoneForm.zone_type,
        description: zoneForm.description,
        vehicle_fares: vehicleFares,
        postcodes: hasPostcodes ? zoneForm.postcodes.split(",").map(p => p.trim().toUpperCase()).filter(Boolean) : [],
        areas: hasAreas ? zoneForm.areas.split(",").map(a => a.trim()).filter(Boolean) : [],
        boundary: hasBoundary ? zoneForm.boundary : null,
      };

      if (editingZone) {
        await axios.put(`${API}/settings/fare-zones/${editingZone.id}`, payload);
        toast.success("Zone updated");
      } else {
        await axios.post(`${API}/settings/fare-zones`, payload);
        toast.success("Zone created");
      }
      fetchFareSettings();
      setShowZoneDialog(false);
      resetZoneForm();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to save zone");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteZone = async (zoneId) => {
    try {
      await axios.delete(`${API}/settings/fare-zones/${zoneId}`);
      toast.success("Zone deleted");
      fetchFareSettings();
    } catch (error) {
      toast.error("Failed to delete zone");
    }
    setDeleteConfirm(null);
  };

  const handleSaveMileRates = async () => {
    setSaving(true);
    try {
      await axios.put(`${API}/settings/mile-rates`, mileRates);
      toast.success("Mile rates saved");
    } catch (error) {
      toast.error("Failed to save mile rates");
    } finally {
      setSaving(false);
    }
  };

  const calculateFare = () => {
    const distance = parseFloat(calcDistance) || 0;
    const waitTime = parseFloat(calcWaitTime) || 0;
    
    // Get rates for selected vehicle type, or use defaults
    const vehicleRates = calcVehicleType && mileRates.vehicle_rates?.[calcVehicleType];
    const baseFare = vehicleRates?.base_fare ?? mileRates.base_fare;
    const pricePerMile = vehicleRates?.price_per_mile ?? mileRates.price_per_mile;
    const minimumFare = vehicleRates?.minimum_fare ?? mileRates.minimum_fare;
    
    let fare = baseFare + (distance * pricePerMile);
    fare += waitTime * mileRates.waiting_rate_per_min;
    
    if (calcIsNight) {
      fare *= mileRates.night_multiplier;
    }
    
    if (calcIsAirport) {
      fare += mileRates.airport_surcharge;
    }
    
    fare = Math.max(fare, minimumFare);
    setCalculatedFare(fare);
  };

  const resetZoneForm = () => {
    setZoneForm({
      name: "",
      zone_type: "dropoff",
      postcodes: "",
      areas: "",
      vehicle_fares: {},
      description: "",
      boundary: null,
    });
    setEditingZone(null);
    setZoneDefineMode("map");
  };

  const openEditZone = (zone) => {
    setEditingZone(zone);
    // Convert vehicle_fares to string values for inputs
    const vehicleFares = {};
    if (zone.vehicle_fares) {
      Object.entries(zone.vehicle_fares).forEach(([id, fare]) => {
        vehicleFares[id] = fare?.toString() || "";
      });
    }
    // Legacy support: if zone has fixed_fare but no vehicle_fares, use fixed_fare for all types
    if (zone.fixed_fare && (!zone.vehicle_fares || Object.keys(zone.vehicle_fares).length === 0)) {
      vehicleTypes.forEach(vt => {
        vehicleFares[vt.id] = zone.fixed_fare.toString();
      });
    }
    
    setZoneForm({
      name: zone.name,
      zone_type: zone.zone_type || "dropoff",
      postcodes: (zone.postcodes || []).join(", "),
      areas: (zone.areas || []).join(", "),
      vehicle_fares: vehicleFares,
      description: zone.description || "",
      boundary: zone.boundary || null,
    });
    setZoneDefineMode(zone.boundary ? "map" : "text");
    setShowZoneDialog(true);
  };

  return (
    <div className="space-y-6">
      <Tabs value={fareTab} onValueChange={setFareTab}>
        <TabsList>
          <TabsTrigger value="zones">
            <MapPin className="w-4 h-4 mr-2" />
            Zone Fares
          </TabsTrigger>
          <TabsTrigger value="miles">
            <Route className="w-4 h-4 mr-2" />
            Mile Rates
          </TabsTrigger>
          <TabsTrigger value="calculator">
            <Calculator className="w-4 h-4 mr-2" />
            Fare Calculator
          </TabsTrigger>
        </TabsList>

        {/* Zone Fares Tab */}
        <TabsContent value="zones" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="w-5 h-5" />
                    Boundary Zone Fares
                  </CardTitle>
                  <CardDescription>
                    Define fixed fares for specific areas based on postcodes or location names
                  </CardDescription>
                </div>
                <Button onClick={() => { resetZoneForm(); setShowZoneDialog(true); }} data-testid="add-zone-btn">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Zone
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-muted-foreground">Loading zones...</p>
              ) : zones.length === 0 ? (
                <div className="text-center py-8 border rounded-lg border-dashed">
                  <MapPin className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">No fare zones defined yet</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Create zones to set fares per vehicle type for specific areas
                  </p>
                  <Button className="mt-4" onClick={() => setShowZoneDialog(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create First Zone
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Zone Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Postcodes / Areas</TableHead>
                      <TableHead>Vehicle Fares</TableHead>
                      <TableHead className="w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {zones.map((zone) => (
                      <TableRow key={zone.id}>
                        <TableCell className="font-medium">{zone.name}</TableCell>
                        <TableCell>
                          <Badge variant={zone.zone_type === "pickup" ? "default" : "secondary"}>
                            {zone.zone_type === "pickup" ? "Pickup" : "Drop-off"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {(zone.postcodes || []).slice(0, 3).map((pc, i) => (
                              <Badge key={i} variant="outline" className="text-xs">{pc}</Badge>
                            ))}
                            {(zone.areas || []).slice(0, 2).map((area, i) => (
                              <Badge key={`a-${i}`} variant="outline" className="text-xs bg-blue-50">{area}</Badge>
                            ))}
                            {((zone.postcodes?.length || 0) + (zone.areas?.length || 0)) > 5 && (
                              <Badge variant="outline" className="text-xs">
                                +{(zone.postcodes?.length || 0) + (zone.areas?.length || 0) - 5} more
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {zone.vehicle_fares && Object.keys(zone.vehicle_fares).length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {Object.entries(zone.vehicle_fares).slice(0, 3).map(([vtId, fare]) => {
                                const vt = vehicleTypes.find(v => v.id === vtId);
                                return (
                                  <Badge key={vtId} variant="outline" className="text-xs bg-green-50 text-green-800">
                                    {vt?.name?.replace("CJ's ", "") || 'Vehicle'}: £{fare?.toFixed(2)}
                                  </Badge>
                                );
                              })}
                              {Object.keys(zone.vehicle_fares).length > 3 && (
                                <Badge variant="outline" className="text-xs">
                                  +{Object.keys(zone.vehicle_fares).length - 3} more
                                </Badge>
                              )}
                            </div>
                          ) : zone.fixed_fare ? (
                            <span className="font-bold text-primary">£{zone.fixed_fare?.toFixed(2)}</span>
                          ) : (
                            <span className="text-muted-foreground text-sm">No fares set</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openEditZone(zone)}>
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => setDeleteConfirm(zone)}>
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Mile Rates Tab */}
        <TabsContent value="miles" className="mt-6 space-y-6">
          {/* Per-Vehicle Rates */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Car className="w-5 h-5" />
                Vehicle-Specific Mile Rates
              </CardTitle>
              <CardDescription>
                Set different mile rates for each vehicle type. Leave blank to use default rates.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vehicle Type</TableHead>
                    <TableHead className="w-[130px]">Base Fare (£)</TableHead>
                    <TableHead className="w-[130px]">Per Mile (£)</TableHead>
                    <TableHead className="w-[130px]">Min Fare (£)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vehicleTypes.map((vt) => {
                    const vehicleRate = mileRates.vehicle_rates?.[vt.id] || {};
                    return (
                      <TableRow key={vt.id}>
                        <TableCell className="font-medium">{vt.name}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder={mileRates.base_fare?.toString() || "3.50"}
                            value={vehicleRate.base_fare || ""}
                            onChange={(e) => setMileRates(prev => ({
                              ...prev,
                              vehicle_rates: {
                                ...prev.vehicle_rates,
                                [vt.id]: {
                                  ...prev.vehicle_rates?.[vt.id],
                                  base_fare: e.target.value ? parseFloat(e.target.value) : undefined
                                }
                              }
                            }))}
                            className="h-8"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder={mileRates.price_per_mile?.toString() || "2.00"}
                            value={vehicleRate.price_per_mile || ""}
                            onChange={(e) => setMileRates(prev => ({
                              ...prev,
                              vehicle_rates: {
                                ...prev.vehicle_rates,
                                [vt.id]: {
                                  ...prev.vehicle_rates?.[vt.id],
                                  price_per_mile: e.target.value ? parseFloat(e.target.value) : undefined
                                }
                              }
                            }))}
                            className="h-8"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder={mileRates.minimum_fare?.toString() || "5.00"}
                            value={vehicleRate.minimum_fare || ""}
                            onChange={(e) => setMileRates(prev => ({
                              ...prev,
                              vehicle_rates: {
                                ...prev.vehicle_rates,
                                [vt.id]: {
                                  ...prev.vehicle_rates?.[vt.id],
                                  minimum_fare: e.target.value ? parseFloat(e.target.value) : undefined
                                }
                              }
                            }))}
                            className="h-8"
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {vehicleTypes.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No vehicle types configured. Add vehicle types in the Vehicles section.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Default/Common Rates */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Route className="w-5 h-5" />
                Default Mile Rates
              </CardTitle>
              <CardDescription>
                These rates are used when no vehicle-specific rate is set
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Base Fare (£)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={mileRates.base_fare}
                    onChange={(e) => setMileRates({ ...mileRates, base_fare: parseFloat(e.target.value) || 0 })}
                    data-testid="base-fare-input"
                  />
                  <p className="text-xs text-muted-foreground">Initial charge when meter starts</p>
                </div>
                <div className="space-y-2">
                  <Label>Price Per Mile (£)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={mileRates.price_per_mile}
                    onChange={(e) => setMileRates({ ...mileRates, price_per_mile: parseFloat(e.target.value) || 0 })}
                    data-testid="price-per-mile-input"
                  />
                  <p className="text-xs text-muted-foreground">Charge per mile traveled</p>
                </div>
                <div className="space-y-2">
                  <Label>Minimum Fare (£)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={mileRates.minimum_fare}
                    onChange={(e) => setMileRates({ ...mileRates, minimum_fare: parseFloat(e.target.value) || 0 })}
                    data-testid="minimum-fare-input"
                  />
                  <p className="text-xs text-muted-foreground">Minimum charge for any journey</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Waiting Rate (£/min)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={mileRates.waiting_rate_per_min}
                    onChange={(e) => setMileRates({ ...mileRates, waiting_rate_per_min: parseFloat(e.target.value) || 0 })}
                  />
                  <p className="text-xs text-muted-foreground">Charge per minute of waiting time</p>
                </div>
                <div className="space-y-2">
                  <Label>Airport Surcharge (£)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={mileRates.airport_surcharge}
                    onChange={(e) => setMileRates({ ...mileRates, airport_surcharge: parseFloat(e.target.value) || 0 })}
                  />
                  <p className="text-xs text-muted-foreground">Additional charge for airport pickups/dropoffs</p>
                </div>
              </div>

              <div className="border-t pt-4">
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Night Rate Settings
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Night Multiplier</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={mileRates.night_multiplier}
                      onChange={(e) => setMileRates({ ...mileRates, night_multiplier: parseFloat(e.target.value) || 1 })}
                    />
                    <p className="text-xs text-muted-foreground">e.g. 1.5 = 50% extra</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Night Start Time</Label>
                    <Input
                      type="time"
                      value={mileRates.night_start}
                      onChange={(e) => setMileRates({ ...mileRates, night_start: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Night End Time</Label>
                    <Input
                      type="time"
                      value={mileRates.night_end}
                      onChange={(e) => setMileRates({ ...mileRates, night_end: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSaveMileRates} disabled={saving}>
                  {saving ? "Saving..." : "Save All Mile Rates"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Fare Calculator Tab */}
        <TabsContent value="calculator" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="w-5 h-5" />
                Fare Calculator
              </CardTitle>
              <CardDescription>
                Calculate fares based on your current mile rate settings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Distance (miles)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      placeholder="Enter distance"
                      value={calcDistance}
                      onChange={(e) => setCalcDistance(e.target.value)}
                      data-testid="calc-distance-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Waiting Time (minutes)</Label>
                    <Input
                      type="number"
                      placeholder="Enter waiting time"
                      value={calcWaitTime}
                      onChange={(e) => setCalcWaitTime(e.target.value)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>Night Rate</Label>
                    <Switch
                      checked={calcIsNight}
                      onCheckedChange={setCalcIsNight}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>Airport Journey</Label>
                    <Switch
                      checked={calcIsAirport}
                      onCheckedChange={setCalcIsAirport}
                    />
                  </div>
                  <Button className="w-full" onClick={calculateFare}>
                    <Calculator className="w-4 h-4 mr-2" />
                    Calculate Fare
                  </Button>
                </div>
                
                <div className="border rounded-lg p-6 bg-muted/30">
                  <h4 className="font-medium mb-4">Fare Breakdown</h4>
                  {calculatedFare !== null ? (
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span>Base Fare:</span>
                        <span>£{mileRates.base_fare.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Distance ({calcDistance || 0} miles × £{mileRates.price_per_mile.toFixed(2)}):</span>
                        <span>£{((parseFloat(calcDistance) || 0) * mileRates.price_per_mile).toFixed(2)}</span>
                      </div>
                      {calcWaitTime && parseFloat(calcWaitTime) > 0 && (
                        <div className="flex justify-between text-sm">
                          <span>Waiting ({calcWaitTime} mins × £{mileRates.waiting_rate_per_min.toFixed(2)}):</span>
                          <span>£{((parseFloat(calcWaitTime) || 0) * mileRates.waiting_rate_per_min).toFixed(2)}</span>
                        </div>
                      )}
                      {calcIsNight && (
                        <div className="flex justify-between text-sm text-amber-600">
                          <span>Night Rate ({mileRates.night_multiplier}x):</span>
                          <span>Applied</span>
                        </div>
                      )}
                      {calcIsAirport && (
                        <div className="flex justify-between text-sm">
                          <span>Airport Surcharge:</span>
                          <span>£{mileRates.airport_surcharge.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="border-t pt-3 mt-3">
                        <div className="flex justify-between items-center">
                          <span className="font-semibold">Total Fare:</span>
                          <span className="text-2xl font-bold text-primary">£{calculatedFare.toFixed(2)}</span>
                        </div>
                        {calculatedFare < mileRates.minimum_fare && (
                          <p className="text-xs text-muted-foreground mt-1">
                            (Minimum fare of £{mileRates.minimum_fare.toFixed(2)} applied)
                          </p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center text-muted-foreground py-8">
                      <Calculator className="w-12 h-12 mx-auto mb-3 opacity-30" />
                      <p>Enter journey details and click Calculate</p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Zone Dialog */}
      <Dialog open={showZoneDialog} onOpenChange={setShowZoneDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingZone ? "Edit Zone" : "Create Fare Zone"}</DialogTitle>
            <DialogDescription>
              Define a geographic boundary with fares per vehicle type using the map or text inputs
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Zone Name *</Label>
                <Input
                  placeholder="e.g. Newcastle Airport, City Centre"
                  value={zoneForm.name}
                  onChange={(e) => setZoneForm({ ...zoneForm, name: e.target.value })}
                  data-testid="zone-name-input"
                />
              </div>
              <div className="space-y-2">
                <Label>Zone Type</Label>
                <Select
                  value={zoneForm.zone_type}
                  onValueChange={(value) => setZoneForm({ ...zoneForm, zone_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dropoff">Drop-off Zone</SelectItem>
                    <SelectItem value="pickup">Pickup Zone</SelectItem>
                    <SelectItem value="both">Both Pickup & Drop-off</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Vehicle Type Fares */}
            <div className="space-y-3">
              <Label className="text-base font-medium flex items-center gap-2">
                <Car className="w-4 h-4" />
                Fares per Vehicle Type *
              </Label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {vehicleTypes.map((vt) => (
                  <div key={vt.id} className="space-y-1">
                    <Label className="text-xs text-muted-foreground">{vt.name}</Label>
                    <div className="relative">
                      <PoundSterling className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        className="pl-6 h-9"
                        value={zoneForm.vehicle_fares[vt.id] || ""}
                        onChange={(e) => setZoneForm({
                          ...zoneForm,
                          vehicle_fares: {
                            ...zoneForm.vehicle_fares,
                            [vt.id]: e.target.value
                          }
                        })}
                        data-testid={`zone-fare-${vt.id}`}
                      />
                    </div>
                  </div>
                ))}
              </div>
              {vehicleTypes.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No vehicle types configured. Add vehicle types in the Vehicles tab first.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Input
                placeholder="Additional notes about this zone"
                value={zoneForm.description}
                onChange={(e) => setZoneForm({ ...zoneForm, description: e.target.value })}
              />
            </div>

            {/* Zone Definition Mode Toggle */}
            <div className="border rounded-lg p-4 space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-base font-medium">Define Zone Boundary</Label>
                <div className="flex gap-2">
                  <Button
                    variant={zoneDefineMode === "map" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setZoneDefineMode("map")}
                  >
                    <Map className="w-4 h-4 mr-2" />
                    Draw on Map
                  </Button>
                  <Button
                    variant={zoneDefineMode === "text" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setZoneDefineMode("text")}
                  >
                    <MapPin className="w-4 h-4 mr-2" />
                    Postcodes/Areas
                  </Button>
                </div>
              </div>

              {zoneDefineMode === "map" ? (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Use the polygon tool to draw a boundary on the map. Click points to create the zone, then close the shape.
                  </p>
                  <BoundaryMap
                    initialBoundary={zoneForm.boundary}
                    onBoundaryChange={(boundary) => setZoneForm({ ...zoneForm, boundary })}
                    height="350px"
                  />
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Postcodes</Label>
                    <Textarea
                      placeholder="NE1, NE2, NE3, NE13 8BZ..."
                      value={zoneForm.postcodes}
                      onChange={(e) => setZoneForm({ ...zoneForm, postcodes: e.target.value })}
                      rows={2}
                    />
                    <p className="text-xs text-muted-foreground">
                      Comma-separated postcode prefixes or full postcodes
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Area Names</Label>
                    <Textarea
                      placeholder="Newcastle Airport, Central Station, Metro Centre..."
                      value={zoneForm.areas}
                      onChange={(e) => setZoneForm({ ...zoneForm, areas: e.target.value })}
                      rows={2}
                    />
                    <p className="text-xs text-muted-foreground">
                      Comma-separated location names to match in addresses
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowZoneDialog(false)}>Cancel</Button>
            <Button onClick={handleSaveZone} disabled={saving}>
              {saving ? "Saving..." : editingZone ? "Update Zone" : "Create Zone"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Zone</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &ldquo;{deleteConfirm?.name}&rdquo;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => handleDeleteZone(deleteConfirm?.id)} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

// Main Settings Page
const SettingsPage = () => {
  const { user, updateProfile, isSuperAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState("account");

  return (
    <div data-testid="settings-page">
      <header className="page-header">
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your account, fares, users, and message templates
        </p>
      </header>

      <div className="page-content">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList>
            <TabsTrigger value="account">
              <User className="w-4 h-4 mr-2" />
              Account
            </TabsTrigger>
            <TabsTrigger value="fares">
              <PoundSterling className="w-4 h-4 mr-2" />
              Fares
            </TabsTrigger>
            <TabsTrigger value="templates">
              <MessageSquare className="w-4 h-4 mr-2" />
              Message Templates
            </TabsTrigger>
          </TabsList>

          <TabsContent value="account">
            <div className="grid gap-6 max-w-4xl">
              <ProfileCard user={user} onUpdate={updateProfile} />
              <PasswordCard onUpdate={updateProfile} />
              {isSuperAdmin && <UsersManagementCard />}
            </div>
          </TabsContent>

          <TabsContent value="fares">
            <FareSettingsSection />
          </TabsContent>

          <TabsContent value="templates">
            <MessageTemplatesSection />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default SettingsPage;
