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
import { User, Mail, Shield, Key, Plus, Edit, Trash2, Users, Clock, Check, X, MessageSquare, Send, RotateCcw, Info, Car, Calendar, Phone, Building2 } from "lucide-react";
import { format } from "date-fns";

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
  const { user: currentUser, isSuperAdmin } = useAuth();
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
                  placeholder="john@cjstravel.uk"
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

// Main Settings Page
const SettingsPage = () => {
  const { user, updateProfile, isSuperAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState("account");

  return (
    <div data-testid="settings-page">
      <header className="page-header">
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your account, users, and message templates
        </p>
      </header>

      <div className="page-content">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList>
            <TabsTrigger value="account">
              <User className="w-4 h-4 mr-2" />
              Account
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

          <TabsContent value="templates">
            <MessageTemplatesSection />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default SettingsPage;
