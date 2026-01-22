import { useState, useEffect } from "react";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { MessageSquare, Mail, Edit, RotateCcw, Send, Info, Car, Users, Calendar, Phone } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const CATEGORY_INFO = {
  driver_app: { label: "Driver App", icon: Car, color: "bg-blue-100 text-blue-800" },
  passenger_portal: { label: "Passenger Portal", icon: Users, color: "bg-green-100 text-green-800" },
  booking: { label: "New Bookings", icon: Calendar, color: "bg-purple-100 text-purple-800" },
  general: { label: "General", icon: MessageSquare, color: "bg-gray-100 text-gray-800" }
};

const VariableBadge = ({ variable }) => (
  <Badge variant="outline" className="text-xs font-mono bg-slate-50">
    {`{${variable}}`}
  </Badge>
);

// SMS Template Card
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
          <div className="bg-slate-50 rounded-lg p-3 text-sm font-mono whitespace-pre-wrap border">
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
            <Button variant="outline" size="sm" onClick={() => onEdit(template)} data-testid={`edit-sms-${template.type}`}>
              <Edit className="w-4 h-4 mr-1" /> Edit
            </Button>
            <Button variant="outline" size="sm" onClick={() => onReset(template.type)} data-testid={`reset-sms-${template.type}`}>
              <RotateCcw className="w-4 h-4 mr-1" /> Reset
            </Button>
            <Button variant="outline" size="sm" onClick={() => onTest(template.type)} data-testid={`test-sms-${template.type}`}>
              <Send className="w-4 h-4 mr-1" /> Test
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Email Template Card
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
            <div className="bg-slate-50 rounded-lg p-3 text-sm whitespace-pre-wrap border mt-1 max-h-32 overflow-y-auto">
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
            <Button variant="outline" size="sm" onClick={() => onEdit(template)} data-testid={`edit-email-${template.type}`}>
              <Edit className="w-4 h-4 mr-1" /> Edit
            </Button>
            <Button variant="outline" size="sm" onClick={() => onReset(template.type)} data-testid={`reset-email-${template.type}`}>
              <RotateCcw className="w-4 h-4 mr-1" /> Reset
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Main Page Component
const MessageTemplatesPage = () => {
  const [smsTemplates, setSmsTemplates] = useState([]);
  const [emailTemplates, setEmailTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("sms");
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
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div data-testid="message-templates-page">
      <header className="page-header">
        <h1 className="text-2xl font-bold tracking-tight">Message Templates</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Customize SMS and email templates for driver app, passenger portal, and booking notifications
        </p>
      </header>

      <div className="page-content">
        {/* Info Banner */}
        <Card className="mb-6 bg-blue-50 border-blue-200">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-600 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">Template Variables</p>
                <p>Use variables like <code className="bg-blue-100 px-1 rounded">{'{customer_name}'}</code> in your templates. 
                These will be automatically replaced with actual values when messages are sent.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Category Filter */}
        <div className="flex items-center gap-4 mb-6">
          <Label>Filter by category:</Label>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-48" data-testid="category-filter">
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

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="sms" data-testid="sms-tab">
              <MessageSquare className="w-4 h-4 mr-2" />
              SMS Templates ({filteredSMS.length})
            </TabsTrigger>
            <TabsTrigger value="email" data-testid="email-tab">
              <Mail className="w-4 h-4 mr-2" />
              Email Templates ({filteredEmail.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="sms">
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
              <div className="text-center py-12 text-muted-foreground">
                No SMS templates found for this category
              </div>
            )}
          </TabsContent>

          <TabsContent value="email">
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
              <div className="text-center py-12 text-muted-foreground">
                No email templates found for this category
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Edit SMS Dialog */}
      <Dialog open={!!editingSMS} onOpenChange={() => setEditingSMS(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit SMS Template</DialogTitle>
            <DialogDescription>
              {editingSMS?.description}
            </DialogDescription>
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
                rows={8}
                className="font-mono text-sm"
                placeholder="Enter SMS content..."
                data-testid="sms-content-input"
              />
              <p className="text-xs text-muted-foreground">
                Character count: {smsContent.length} (SMS limit: 160 per segment)
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingSMS(null)}>Cancel</Button>
            <Button onClick={handleSaveSMS} disabled={savingSMS} data-testid="save-sms-btn">
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
            <DialogDescription>
              {editingEmail?.description}
            </DialogDescription>
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
                data-testid="email-subject-input"
              />
            </div>
            <div className="space-y-2">
              <Label>Email Content</Label>
              <Textarea
                value={emailContent}
                onChange={(e) => setEmailContent(e.target.value)}
                rows={10}
                placeholder="Enter email content..."
                data-testid="email-content-input"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingEmail(null)}>Cancel</Button>
            <Button onClick={handleSaveEmail} disabled={savingEmail} data-testid="save-email-btn">
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
            <DialogDescription>
              Send a test message using sample data to verify the template
            </DialogDescription>
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
                  data-testid="test-phone-input"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Enter the phone number to receive the test SMS
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setTestingSMS(null); setTestPhone(""); }}>
              Cancel
            </Button>
            <Button onClick={handleTestSMS} disabled={sendingTest} data-testid="send-test-btn">
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
            <AlertDialogAction onClick={handleResetTemplate} data-testid="confirm-reset-btn">
              Reset to Default
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default MessageTemplatesPage;
