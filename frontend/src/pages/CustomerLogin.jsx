import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { User, Phone, Lock, Eye, EyeOff, Loader2, Mail, Building2, Users, KeyRound, ArrowLeft, CheckCircle, MessageSquare, MapPin, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const CLIENT_TYPES = [
  { value: "Business", label: "Business" },
  { value: "Contract Account", label: "Contract Account" },
  { value: "Corporate", label: "Corporate" },
  { value: "School", label: "School" },
  { value: "Hospital", label: "Hospital" },
];

const PAYMENT_METHODS = [
  { value: "Invoice", label: "Invoice" },
  { value: "Cash", label: "Cash" },
  { value: "Card", label: "Card" },
  { value: "Account", label: "Account" },
];

const CustomerLogin = () => {
  const navigate = useNavigate();
  
  // Step 1: Choose account type, Step 2: Login/Register form
  const [step, setStep] = useState(1);
  const [customerType, setCustomerType] = useState(null); // "passenger" or "corporate"
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Passenger form data
  const [passengerData, setPassengerData] = useState({
    name: "",
    phone: "",
    email: "",
    password: "",
  });

  // Corporate form data (matches Create Client)
  const [corporateData, setCorporateData] = useState({
    name: "", // Company name
    contact_name: "",
    mobile: "",
    email: "",
    client_type: "Corporate",
    payment_method: "Invoice",
    address: "",
    town_city: "",
    post_code: "",
    notes: "",
    password: "",
  });

  // Forgot Password State
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotStep, setForgotStep] = useState(1);
  const [resetMethod, setResetMethod] = useState("sms");
  const [forgotPhone, setForgotPhone] = useState("");
  const [forgotEmail, setForgotEmail] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);

  const handleSelectType = (type) => {
    setCustomerType(type);
    setStep(2);
    setIsLogin(true);
  };

  const handleBack = () => {
    setStep(1);
    setCustomerType(null);
    setIsLogin(true);
  };

  const handlePassengerSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const endpoint = isLogin ? "/passenger/login" : "/passenger/register";
      const payload = isLogin 
        ? { phone: passengerData.phone, password: passengerData.password }
        : { name: passengerData.name, phone: passengerData.phone, email: passengerData.email || null, password: passengerData.password };

      const response = await axios.post(`${API}${endpoint}`, payload);
      
      localStorage.setItem("passengerToken", response.data.token);
      localStorage.setItem("passengerInfo", JSON.stringify({
        id: response.data.id,
        name: response.data.name,
        phone: response.data.phone,
        email: response.data.email,
        type: "passenger",
      }));

      toast.success(isLogin ? "Welcome back!" : "Account created successfully!");
      navigate("/portal");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  const handleCorporateSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        // Login
        const response = await axios.post(`${API}/client-portal/login`, {
          phone: corporateData.mobile,
          password: corporateData.password
        });
        
        localStorage.setItem("clientToken", response.data.token);
        localStorage.setItem("clientInfo", JSON.stringify({
          id: response.data.id,
          name: response.data.name,
          phone: response.data.phone,
          email: response.data.email,
          company_name: response.data.company_name,
          account_no: response.data.account_no,
          type: "corporate",
        }));

        toast.success("Welcome back!");
        navigate("/client-portal");
      } else {
        // Register - send full client data
        const response = await axios.post(`${API}/client-portal/register`, {
          name: corporateData.contact_name,
          phone: corporateData.mobile,
          email: corporateData.email,
          password: corporateData.password,
          company_name: corporateData.name,
          client_type: corporateData.client_type,
          payment_method: corporateData.payment_method,
          address: corporateData.address,
          town_city: corporateData.town_city,
          post_code: corporateData.post_code,
          notes: corporateData.notes,
        });
        
        toast.success("Registration submitted! Your account is pending approval.");
        setIsLogin(true);
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  const handleRequestCode = async () => {
    if (resetMethod === "sms" && !forgotPhone) {
      toast.error("Please enter your phone number");
      return;
    }
    if (resetMethod === "email" && !forgotEmail) {
      toast.error("Please enter your email address");
      return;
    }
    
    setForgotLoading(true);
    try {
      await axios.post(`${API}/password-reset/request`, {
        phone: resetMethod === "sms" ? forgotPhone : null,
        email: resetMethod === "email" ? forgotEmail : null,
        method: resetMethod,
        account_type: customerType === "passenger" ? "passenger" : "client"
      });
      toast.success(`If an account exists, a reset code has been sent via ${resetMethod.toUpperCase()}`);
      setForgotStep(2);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to send reset code");
    } finally {
      setForgotLoading(false);
    }
  };

  const handleVerifyCode = () => {
    if (!resetCode || resetCode.length !== 6) {
      toast.error("Please enter the 6-digit code");
      return;
    }
    setForgotStep(3);
  };

  const handleResetPassword = async () => {
    if (!newPassword || !confirmPassword) {
      toast.error("Please fill in both password fields");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setForgotLoading(true);
    try {
      await axios.post(`${API}/password-reset/verify`, {
        identifier: resetMethod === "sms" ? forgotPhone : forgotEmail,
        code: resetCode,
        new_password: newPassword,
        account_type: customerType === "passenger" ? "passenger" : "client",
        method: resetMethod
      });
      toast.success("Password reset successfully!");
      closeForgotPassword();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to reset password");
    } finally {
      setForgotLoading(false);
    }
  };

  const closeForgotPassword = () => {
    setShowForgotPassword(false);
    setForgotStep(1);
    setResetMethod("sms");
    setForgotPhone("");
    setForgotEmail("");
    setResetCode("");
    setNewPassword("");
    setConfirmPassword("");
  };

  const accentColor = customerType === "passenger" ? "#D4A853" : "#3b82f6";
  const accentClass = customerType === "passenger" ? "bg-[#D4A853] text-[#1a1a1a]" : "bg-blue-500 text-white";
  const accentHover = customerType === "passenger" ? "hover:bg-[#c49843]" : "hover:bg-blue-600";
  const textAccent = customerType === "passenger" ? "text-[#D4A853]" : "text-blue-400";

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 50%, #1a1a1a 100%)' }}>
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <img 
            src="https://customer-assets.emergentagent.com/job_c2bf04a6-1cc1-4dad-86ae-c96a52a9ec62/artifacts/t13g8907_Logo%20With%20Border.png" 
            alt="CJ's Executive Travel" 
            className="w-24 h-24 mx-auto mb-4 object-contain"
          />
          <h1 className="text-2xl font-bold text-white">CJ's Executive Travel</h1>
          <p className="text-[#D4A853] mt-2 font-medium">Customer Portal</p>
        </div>

        {/* Step 1: Choose Account Type */}
        {step === 1 && (
          <div className="bg-[#1a1a1a]/90 backdrop-blur border border-[#D4A853]/30 rounded-2xl shadow-2xl p-8">
            <h2 className="text-xl font-semibold text-white text-center mb-6">Select Account Type</h2>
            
            <div className="space-y-4">
              <button
                onClick={() => handleSelectType("passenger")}
                className="w-full p-6 rounded-xl border-2 border-[#D4A853]/30 bg-[#2d2d2d] hover:border-[#D4A853] hover:bg-[#D4A853]/10 transition-all group"
                data-testid="select-passenger-btn"
              >
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-full bg-[#D4A853]/20 group-hover:bg-[#D4A853]/30">
                    <Users className="w-8 h-8 text-[#D4A853]" />
                  </div>
                  <div className="text-left">
                    <h3 className="text-lg font-semibold text-white">Passenger</h3>
                    <p className="text-sm text-gray-400">Personal travel bookings</p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => handleSelectType("corporate")}
                className="w-full p-6 rounded-xl border-2 border-blue-500/30 bg-[#2d2d2d] hover:border-blue-500 hover:bg-blue-500/10 transition-all group"
                data-testid="select-corporate-btn"
              >
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-full bg-blue-500/20 group-hover:bg-blue-500/30">
                    <Building2 className="w-8 h-8 text-blue-400" />
                  </div>
                  <div className="text-left">
                    <h3 className="text-lg font-semibold text-white">Corporate</h3>
                    <p className="text-sm text-gray-400">Business & contract accounts</p>
                  </div>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Login/Register Form */}
        {step === 2 && (
          <div className="bg-[#1a1a1a]/90 backdrop-blur border border-[#D4A853]/30 rounded-2xl shadow-2xl p-8">
            {/* Back Button */}
            <button
              onClick={handleBack}
              className="flex items-center gap-2 text-gray-400 hover:text-white mb-4 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>

            {/* Account Type Badge */}
            <div className="flex items-center justify-center gap-2 mb-6">
              {customerType === "passenger" ? (
                <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#D4A853]/20 border border-[#D4A853]/30">
                  <Users className="w-4 h-4 text-[#D4A853]" />
                  <span className="text-[#D4A853] font-medium">Passenger</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/20 border border-blue-500/30">
                  <Building2 className="w-4 h-4 text-blue-400" />
                  <span className="text-blue-400 font-medium">Corporate</span>
                </div>
              )}
            </div>

            {/* Login/Register Tabs */}
            <div className="flex gap-2 mb-6">
              <button
                onClick={() => setIsLogin(true)}
                className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
                  isLogin ? accentClass : "bg-[#2d2d2d] text-gray-400 hover:bg-[#3d3d3d]"
                }`}
                data-testid="login-tab"
              >
                Login
              </button>
              <button
                onClick={() => setIsLogin(false)}
                className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
                  !isLogin ? accentClass : "bg-[#2d2d2d] text-gray-400 hover:bg-[#3d3d3d]"
                }`}
                data-testid="register-tab"
              >
                Register
              </button>
            </div>

            {/* PASSENGER FORM */}
            {customerType === "passenger" && (
              <form onSubmit={handlePassengerSubmit} className="space-y-4">
                {!isLogin && (
                  <>
                    <div className="space-y-2">
                      <Label className="text-gray-200">Full Name</Label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                        <Input
                          type="text"
                          placeholder="John Smith"
                          value={passengerData.name}
                          onChange={(e) => setPassengerData({ ...passengerData, name: e.target.value })}
                          className="pl-10 bg-[#2d2d2d] border-[#D4A853]/30 text-white"
                          required
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-gray-200">Phone Number</Label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                        <Input
                          type="tel"
                          placeholder="07700 900000"
                          value={passengerData.phone}
                          onChange={(e) => setPassengerData({ ...passengerData, phone: e.target.value })}
                          className="pl-10 bg-[#2d2d2d] border-[#D4A853]/30 text-white"
                          required
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-gray-200">Email (optional)</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                        <Input
                          type="email"
                          placeholder="john@example.com"
                          value={passengerData.email}
                          onChange={(e) => setPassengerData({ ...passengerData, email: e.target.value })}
                          className="pl-10 bg-[#2d2d2d] border-[#D4A853]/30 text-white"
                        />
                      </div>
                    </div>
                  </>
                )}

                {isLogin && (
                  <div className="space-y-2">
                    <Label className="text-gray-200">Phone or Email</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                      <Input
                        type="text"
                        placeholder="07700 900000 or john@example.com"
                        value={passengerData.phone}
                        onChange={(e) => setPassengerData({ ...passengerData, phone: e.target.value })}
                        className="pl-10 bg-[#2d2d2d] border-[#D4A853]/30 text-white"
                        required
                        data-testid="login-identifier-input"
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label className="text-gray-200">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={passengerData.password}
                      onChange={(e) => setPassengerData({ ...passengerData, password: e.target.value })}
                      className="pl-10 pr-10 bg-[#2d2d2d] border-[#D4A853]/30 text-white"
                      required
                      data-testid="login-password-input"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-[#D4A853]"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {isLogin && (
                  <div className="text-right">
                    <button type="button" onClick={() => setShowForgotPassword(true)} className={`text-sm hover:underline ${textAccent}`}>
                      Forgot Password?
                    </button>
                  </div>
                )}

                <Button type="submit" className={`w-full font-semibold ${accentClass} ${accentHover}`} disabled={loading}>
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  {isLogin ? "Login" : "Create Account"}
                </Button>
              </form>
            )}

            {/* CORPORATE FORM */}
            {customerType === "corporate" && (
              <form onSubmit={handleCorporateSubmit} className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                {!isLogin && (
                  <>
                    {/* Company Name */}
                    <div className="space-y-2">
                      <Label className="text-gray-200">Company Name *</Label>
                      <div className="relative">
                        <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                        <Input
                          type="text"
                          placeholder="ABC Company Ltd"
                          value={corporateData.name}
                          onChange={(e) => setCorporateData({ ...corporateData, name: e.target.value })}
                          className="pl-10 bg-[#2d2d2d] border-blue-500/30 text-white"
                          required
                        />
                      </div>
                    </div>

                    {/* Contact Name */}
                    <div className="space-y-2">
                      <Label className="text-gray-200">Contact Name *</Label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                        <Input
                          type="text"
                          placeholder="John Smith"
                          value={corporateData.contact_name}
                          onChange={(e) => setCorporateData({ ...corporateData, contact_name: e.target.value })}
                          className="pl-10 bg-[#2d2d2d] border-blue-500/30 text-white"
                          required
                        />
                      </div>
                    </div>

                    {/* Mobile Number */}
                    <div className="space-y-2">
                      <Label className="text-gray-200">Mobile Number *</Label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                        <Input
                          type="tel"
                          placeholder="07700 900000"
                          value={corporateData.mobile}
                          onChange={(e) => setCorporateData({ ...corporateData, mobile: e.target.value })}
                          className="pl-10 bg-[#2d2d2d] border-blue-500/30 text-white"
                          required
                        />
                      </div>
                    </div>

                    {/* Client Type & Payment Method */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-gray-200">Account Type</Label>
                        <Select value={corporateData.client_type} onValueChange={(v) => setCorporateData({ ...corporateData, client_type: v })}>
                          <SelectTrigger className="bg-[#2d2d2d] border-blue-500/30 text-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-[#2d2d2d] border-blue-500/30">
                            {CLIENT_TYPES.map((t) => (
                              <SelectItem key={t.value} value={t.value} className="text-white">{t.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-gray-200">Payment Method</Label>
                        <Select value={corporateData.payment_method} onValueChange={(v) => setCorporateData({ ...corporateData, payment_method: v })}>
                          <SelectTrigger className="bg-[#2d2d2d] border-blue-500/30 text-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-[#2d2d2d] border-blue-500/30">
                            {PAYMENT_METHODS.map((m) => (
                              <SelectItem key={m.value} value={m.value} className="text-white">{m.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Address */}
                    <div className="space-y-2">
                      <Label className="text-gray-200">Address</Label>
                      <div className="relative">
                        <MapPin className="absolute left-3 top-3 w-4 h-4 text-gray-500" />
                        <Textarea
                          placeholder="Street address"
                          value={corporateData.address}
                          onChange={(e) => setCorporateData({ ...corporateData, address: e.target.value })}
                          className="pl-10 bg-[#2d2d2d] border-blue-500/30 text-white resize-none"
                          rows={2}
                        />
                      </div>
                    </div>

                    {/* Town/City & Post Code */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-gray-200">Town/City</Label>
                        <Input
                          type="text"
                          placeholder="London"
                          value={corporateData.town_city}
                          onChange={(e) => setCorporateData({ ...corporateData, town_city: e.target.value })}
                          className="bg-[#2d2d2d] border-blue-500/30 text-white"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-gray-200">Post Code</Label>
                        <Input
                          type="text"
                          placeholder="SW1A 1AA"
                          value={corporateData.post_code}
                          onChange={(e) => setCorporateData({ ...corporateData, post_code: e.target.value })}
                          className="bg-[#2d2d2d] border-blue-500/30 text-white"
                        />
                      </div>
                    </div>

                    {/* Notes */}
                    <div className="space-y-2">
                      <Label className="text-gray-200">Notes</Label>
                      <Textarea
                        placeholder="Any additional information..."
                        value={corporateData.notes}
                        onChange={(e) => setCorporateData({ ...corporateData, notes: e.target.value })}
                        className="bg-[#2d2d2d] border-blue-500/30 text-white resize-none"
                        rows={2}
                      />
                    </div>
                  </>
                )}

                {/* Email (always shown - used for login) */}
                <div className="space-y-2">
                  <Label className="text-gray-200">Email *</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <Input
                      type="email"
                      placeholder="john@company.com"
                      value={corporateData.email}
                      onChange={(e) => setCorporateData({ ...corporateData, email: e.target.value })}
                      className="pl-10 bg-[#2d2d2d] border-blue-500/30 text-white"
                      required
                      data-testid="corporate-email-input"
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="space-y-2">
                  <Label className="text-gray-200">Password *</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={corporateData.password}
                      onChange={(e) => setCorporateData({ ...corporateData, password: e.target.value })}
                      className="pl-10 pr-10 bg-[#2d2d2d] border-blue-500/30 text-white"
                      required
                      data-testid="corporate-password-input"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-blue-400"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {isLogin && (
                  <div className="text-right">
                    <button type="button" onClick={() => setShowForgotPassword(true)} className={`text-sm hover:underline ${textAccent}`}>
                      Forgot Password?
                    </button>
                  </div>
                )}

                <Button type="submit" className={`w-full font-semibold ${accentClass} ${accentHover}`} disabled={loading}>
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  {isLogin ? "Login" : "Submit Registration"}
                </Button>

                {!isLogin && (
                  <p className="text-xs text-gray-500 text-center">
                    Your registration will be reviewed by our team. We'll contact you once approved.
                  </p>
                )}
              </form>
            )}

            <p className="text-center text-sm text-gray-500 mt-6">
              {isLogin ? "Don't have an account? " : "Already have an account? "}
              <button onClick={() => setIsLogin(!isLogin)} className={`hover:underline font-medium ${textAccent}`}>
                {isLogin ? "Register" : "Login"}
              </button>
            </p>
          </div>
        )}

        <p className="text-center text-gray-600 text-sm mt-6">
          © 2026 CJ's Executive Travel Limited
        </p>
      </div>

      {/* Forgot Password Dialog */}
      <Dialog open={showForgotPassword} onOpenChange={closeForgotPassword}>
        <DialogContent className="bg-[#1a1a1a] border-[#D4A853]/30 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <KeyRound className="w-5 h-5" style={{ color: accentColor }} />
              Reset Password
            </DialogTitle>
          </DialogHeader>

          <div className="flex items-center justify-center gap-2 py-4">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${forgotStep >= s ? accentClass : "bg-[#2d2d2d] text-gray-500"}`}>
                  {forgotStep > s ? <CheckCircle className="w-4 h-4" /> : s}
                </div>
                {s < 3 && <div className="w-12 h-0.5" style={{ backgroundColor: forgotStep > s ? accentColor : '#2d2d2d' }} />}
              </div>
            ))}
          </div>

          {forgotStep === 1 && (
            <div className="space-y-4">
              <p className="text-gray-400 text-sm">Choose how to receive your verification code.</p>
              <div className="flex gap-2">
                <button type="button" onClick={() => setResetMethod("sms")} className={`flex-1 py-3 rounded-lg font-medium flex items-center justify-center gap-2 ${resetMethod === "sms" ? accentClass : "bg-[#2d2d2d] text-gray-400 border border-[#3d3d3d]"}`}>
                  <MessageSquare className="w-4 h-4" /> SMS
                </button>
                <button type="button" onClick={() => setResetMethod("email")} className={`flex-1 py-3 rounded-lg font-medium flex items-center justify-center gap-2 ${resetMethod === "email" ? accentClass : "bg-[#2d2d2d] text-gray-400 border border-[#3d3d3d]"}`}>
                  <Mail className="w-4 h-4" /> Email
                </button>
              </div>
              {resetMethod === "sms" ? (
                <div className="space-y-2">
                  <Label className="text-gray-200">Phone Number</Label>
                  <Input type="tel" placeholder="07700 900000" value={forgotPhone} onChange={(e) => setForgotPhone(e.target.value)} className="bg-[#2d2d2d] border-[#3d3d3d] text-white" />
                </div>
              ) : (
                <div className="space-y-2">
                  <Label className="text-gray-200">Email Address</Label>
                  <Input type="email" placeholder="john@example.com" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} className="bg-[#2d2d2d] border-[#3d3d3d] text-white" />
                </div>
              )}
              <Button onClick={handleRequestCode} disabled={forgotLoading} className={`w-full ${accentClass} ${accentHover}`}>
                {forgotLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Send Code
              </Button>
            </div>
          )}

          {forgotStep === 2 && (
            <div className="space-y-4">
              <p className="text-gray-400 text-sm">Enter the 6-digit code sent to <span className="text-white">{resetMethod === "sms" ? forgotPhone : forgotEmail}</span></p>
              <Input type="text" placeholder="000000" maxLength={6} value={resetCode} onChange={(e) => setResetCode(e.target.value.replace(/\D/g, ''))} className="bg-[#2d2d2d] border-[#3d3d3d] text-white text-center text-2xl tracking-widest" />
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setForgotStep(1)} className="flex-1 border-[#3d3d3d] text-gray-300"><ArrowLeft className="w-4 h-4 mr-2" /> Back</Button>
                <Button onClick={handleVerifyCode} className={`flex-1 ${accentClass} ${accentHover}`}>Verify</Button>
              </div>
            </div>
          )}

          {forgotStep === 3 && (
            <div className="space-y-4">
              <p className="text-gray-400 text-sm">Create a new password.</p>
              <div className="space-y-2">
                <Label className="text-gray-200">New Password</Label>
                <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="bg-[#2d2d2d] border-[#3d3d3d] text-white" />
              </div>
              <div className="space-y-2">
                <Label className="text-gray-200">Confirm Password</Label>
                <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="bg-[#2d2d2d] border-[#3d3d3d] text-white" />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setForgotStep(2)} className="flex-1 border-[#3d3d3d] text-gray-300"><ArrowLeft className="w-4 h-4 mr-2" /> Back</Button>
                <Button onClick={handleResetPassword} disabled={forgotLoading} className={`flex-1 ${accentClass} ${accentHover}`}>
                  {forgotLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Reset
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CustomerLogin;
