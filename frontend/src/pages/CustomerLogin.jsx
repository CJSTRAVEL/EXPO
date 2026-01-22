import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { User, Phone, Lock, Eye, EyeOff, Loader2, Mail, Building2, Users, KeyRound, ArrowLeft, CheckCircle, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const CustomerLogin = () => {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [customerType, setCustomerType] = useState("passenger");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    password: "",
    company_name: "",
  });

  // Forgot Password State
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotStep, setForgotStep] = useState(1);
  const [resetMethod, setResetMethod] = useState("sms"); // "sms" or "email"
  const [forgotPhone, setForgotPhone] = useState("");
  const [forgotEmail, setForgotEmail] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      let endpoint, payload;
      
      if (customerType === "passenger") {
        endpoint = isLogin ? "/passenger/login" : "/passenger/register";
        payload = isLogin 
          ? { phone: formData.phone, password: formData.password }
          : { name: formData.name, phone: formData.phone, email: formData.email || null, password: formData.password };
      } else {
        endpoint = isLogin ? "/client-portal/login" : "/client-portal/register";
        payload = isLogin 
          ? { phone: formData.phone, password: formData.password }
          : { 
              name: formData.name, 
              phone: formData.phone, 
              email: formData.email || null, 
              password: formData.password,
              company_name: formData.company_name 
            };
      }

      const response = await axios.post(`${API}${endpoint}`, payload);
      
      const tokenKey = customerType === "passenger" ? "passengerToken" : "clientToken";
      const infoKey = customerType === "passenger" ? "passengerInfo" : "clientInfo";
      
      localStorage.setItem(tokenKey, response.data.token);
      localStorage.setItem(infoKey, JSON.stringify({
        id: response.data.id,
        name: response.data.name,
        phone: response.data.phone,
        email: response.data.email,
        company_name: response.data.company_name,
        account_no: response.data.account_no,
        type: customerType,
      }));

      toast.success(isLogin ? "Welcome back!" : "Account created successfully!");
      
      if (customerType === "passenger") {
        navigate("/portal");
      } else {
        navigate("/client-portal");
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
        account_type: customerType
      });
      toast.success(`If an account exists, a reset code has been sent via ${resetMethod.toUpperCase()}`);
      setForgotStep(2);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to send reset code");
    } finally {
      setForgotLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!resetCode) {
      toast.error("Please enter the verification code");
      return;
    }
    if (resetCode.length !== 6) {
      toast.error("Code must be 6 digits");
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
        account_type: customerType,
        method: resetMethod
      });
      toast.success("Password reset successfully! You can now login.");
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
        {/* Logo and Header */}
        <div className="text-center mb-8">
          <img 
            src="https://customer-assets.emergentagent.com/job_c2bf04a6-1cc1-4dad-86ae-c96a52a9ec62/artifacts/t13g8907_Logo%20With%20Border.png" 
            alt="CJ's Executive Travel" 
            className="w-24 h-24 mx-auto mb-4 object-contain"
          />
          <h1 className="text-2xl font-bold text-white">CJ's Executive Travel</h1>
          <p className="text-[#D4A853] mt-2 font-medium">Customer Portal</p>
        </div>

        {/* Login/Register Card */}
        <div className="bg-[#1a1a1a]/90 backdrop-blur border border-[#D4A853]/30 rounded-2xl shadow-2xl p-8">
          {/* Customer Type Selection */}
          <div className="mb-6">
            <Label className="text-gray-200 text-sm mb-2 block">I am a</Label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setCustomerType("passenger")}
                className={`flex-1 py-3 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
                  customerType === "passenger"
                    ? "bg-[#D4A853] text-[#1a1a1a] shadow-lg"
                    : "bg-[#2d2d2d] text-gray-400 hover:bg-[#3d3d3d] border border-[#3d3d3d]"
                }`}
                data-testid="passenger-type-btn"
              >
                <Users className="w-4 h-4" />
                Passenger
              </button>
              <button
                type="button"
                onClick={() => setCustomerType("client")}
                className={`flex-1 py-3 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
                  customerType === "client"
                    ? "bg-blue-500 text-white shadow-lg"
                    : "bg-[#2d2d2d] text-gray-400 hover:bg-[#3d3d3d] border border-[#3d3d3d]"
                }`}
                data-testid="client-type-btn"
              >
                <Building2 className="w-4 h-4" />
                Business Client
              </button>
            </div>
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

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-gray-200">
                    {customerType === "client" ? "Contact Name" : "Full Name"}
                  </Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <Input
                      id="name"
                      type="text"
                      placeholder="John Smith"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="pl-10 bg-[#2d2d2d] border-[#D4A853]/30 text-white placeholder:text-gray-500"
                      required={!isLogin}
                      data-testid="register-name-input"
                    />
                  </div>
                </div>

                {customerType === "client" && (
                  <div className="space-y-2">
                    <Label htmlFor="company" className="text-gray-200">Company Name</Label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                      <Input
                        id="company"
                        type="text"
                        placeholder="ABC Company Ltd"
                        value={formData.company_name}
                        onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                        className="pl-10 bg-[#2d2d2d] border-[#D4A853]/30 text-white placeholder:text-gray-500"
                        required={customerType === "client" && !isLogin}
                        data-testid="register-company-input"
                      />
                    </div>
                  </div>
                )}
              </>
            )}

            <div className="space-y-2">
              <Label htmlFor="phone" className="text-gray-200">Phone Number</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <Input
                  id="phone"
                  type="tel"
                  placeholder="07700 900000"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="pl-10 bg-[#2d2d2d] border-[#D4A853]/30 text-white placeholder:text-gray-500"
                  required
                  data-testid="login-phone-input"
                />
              </div>
            </div>

            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="email" className="text-gray-200">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="john@example.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="pl-10 bg-[#2d2d2d] border-[#D4A853]/30 text-white placeholder:text-gray-500"
                    required={customerType === "client" && !isLogin}
                    data-testid="register-email-input"
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="password" className="text-gray-200">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="pl-10 pr-10 bg-[#2d2d2d] border-[#D4A853]/30 text-white placeholder:text-gray-500"
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
                <button
                  type="button"
                  onClick={() => setShowForgotPassword(true)}
                  className={`text-sm hover:underline ${textAccent}`}
                  data-testid="forgot-password-link"
                >
                  Forgot Password?
                </button>
              </div>
            )}

            <Button 
              type="submit" 
              className={`w-full font-semibold ${accentClass} ${accentHover}`}
              disabled={loading}
              data-testid="login-submit-btn"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {isLogin ? "Logging in..." : "Creating account..."}
                </>
              ) : (
                isLogin ? "Login" : "Create Account"
              )}
            </Button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <button 
              onClick={() => setIsLogin(!isLogin)}
              className={`hover:underline font-medium ${textAccent}`}
            >
              {isLogin ? "Register" : "Login"}
            </button>
          </p>
        </div>

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

          {/* Step Indicator */}
          <div className="flex items-center justify-center gap-2 py-4">
            {[1, 2, 3].map((step) => (
              <div key={step} className="flex items-center">
                <div 
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                    forgotStep >= step ? accentClass : "bg-[#2d2d2d] text-gray-500"
                  }`}
                >
                  {forgotStep > step ? <CheckCircle className="w-4 h-4" /> : step}
                </div>
                {step < 3 && (
                  <div 
                    className="w-12 h-0.5 transition-colors"
                    style={{ backgroundColor: forgotStep > step ? accentColor : '#2d2d2d' }}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Step 1: Choose Method & Enter Phone/Email */}
          {forgotStep === 1 && (
            <div className="space-y-4">
              <p className="text-gray-400 text-sm">
                Choose how you'd like to receive your verification code.
              </p>
              
              {/* Method Toggle */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setResetMethod("sms")}
                  className={`flex-1 py-3 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
                    resetMethod === "sms"
                      ? accentClass
                      : "bg-[#2d2d2d] text-gray-400 hover:bg-[#3d3d3d] border border-[#3d3d3d]"
                  }`}
                  data-testid="reset-method-sms"
                >
                  <MessageSquare className="w-4 h-4" />
                  SMS
                </button>
                <button
                  type="button"
                  onClick={() => setResetMethod("email")}
                  className={`flex-1 py-3 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
                    resetMethod === "email"
                      ? accentClass
                      : "bg-[#2d2d2d] text-gray-400 hover:bg-[#3d3d3d] border border-[#3d3d3d]"
                  }`}
                  data-testid="reset-method-email"
                >
                  <Mail className="w-4 h-4" />
                  Email
                </button>
              </div>

              {/* Phone or Email Input */}
              {resetMethod === "sms" ? (
                <div className="space-y-2">
                  <Label className="text-gray-200">Phone Number</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <Input
                      type="tel"
                      placeholder="07700 900000"
                      value={forgotPhone}
                      onChange={(e) => setForgotPhone(e.target.value)}
                      className="pl-10 bg-[#2d2d2d] border-[#3d3d3d] text-white"
                      data-testid="forgot-phone-input"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label className="text-gray-200">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <Input
                      type="email"
                      placeholder="john@example.com"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      className="pl-10 bg-[#2d2d2d] border-[#3d3d3d] text-white"
                      data-testid="forgot-email-input"
                    />
                  </div>
                </div>
              )}

              <Button
                onClick={handleRequestCode}
                disabled={forgotLoading}
                className={`w-full ${accentClass} ${accentHover}`}
                data-testid="forgot-send-code-btn"
              >
                {forgotLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Send Verification Code
              </Button>
            </div>
          )}

          {/* Step 2: Enter Code */}
          {forgotStep === 2 && (
            <div className="space-y-4">
              <p className="text-gray-400 text-sm">
                Enter the 6-digit code sent to{" "}
                <span className="text-white font-medium">
                  {resetMethod === "sms" ? forgotPhone : forgotEmail}
                </span>
              </p>
              <div className="space-y-2">
                <Label className="text-gray-200">Verification Code</Label>
                <Input
                  type="text"
                  placeholder="000000"
                  maxLength={6}
                  value={resetCode}
                  onChange={(e) => setResetCode(e.target.value.replace(/\D/g, ''))}
                  className="bg-[#2d2d2d] border-[#3d3d3d] text-white text-center text-2xl tracking-widest"
                  data-testid="forgot-code-input"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setForgotStep(1)}
                  className="flex-1 border-[#3d3d3d] text-gray-300 hover:bg-[#2d2d2d]"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
                <Button
                  onClick={handleVerifyCode}
                  className={`flex-1 ${accentClass} ${accentHover}`}
                  data-testid="forgot-verify-btn"
                >
                  Verify Code
                </Button>
              </div>
              <button
                onClick={handleRequestCode}
                className={`text-sm w-full text-center ${textAccent} hover:underline`}
              >
                Didn't receive code? Resend
              </button>
            </div>
          )}

          {/* Step 3: New Password */}
          {forgotStep === 3 && (
            <div className="space-y-4">
              <p className="text-gray-400 text-sm">
                Create a new password for your account.
              </p>
              <div className="space-y-2">
                <Label className="text-gray-200">New Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <Input
                    type="password"
                    placeholder="••••••••"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="pl-10 bg-[#2d2d2d] border-[#3d3d3d] text-white"
                    data-testid="forgot-new-password-input"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-gray-200">Confirm Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <Input
                    type="password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pl-10 bg-[#2d2d2d] border-[#3d3d3d] text-white"
                    data-testid="forgot-confirm-password-input"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setForgotStep(2)}
                  className="flex-1 border-[#3d3d3d] text-gray-300 hover:bg-[#2d2d2d]"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
                <Button
                  onClick={handleResetPassword}
                  disabled={forgotLoading}
                  className={`flex-1 ${accentClass} ${accentHover}`}
                  data-testid="forgot-reset-btn"
                >
                  {forgotLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Reset Password
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
