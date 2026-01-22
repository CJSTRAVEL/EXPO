import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { User, Phone, Lock, Eye, EyeOff, Loader2, Mail, Building2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const CustomerLogin = () => {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [customerType, setCustomerType] = useState("passenger"); // "passenger" or "client"
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    password: "",
    company_name: "", // For clients
  });

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
      
      // Store token and user info
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
      
      // Navigate to appropriate portal
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
                isLogin 
                  ? (customerType === "passenger" ? "bg-[#D4A853] text-[#1a1a1a]" : "bg-blue-500 text-white")
                  : "bg-[#2d2d2d] text-gray-400 hover:bg-[#3d3d3d]"
              }`}
              data-testid="login-tab"
            >
              Login
            </button>
            <button
              onClick={() => setIsLogin(false)}
              className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
                !isLogin 
                  ? (customerType === "passenger" ? "bg-[#D4A853] text-[#1a1a1a]" : "bg-blue-500 text-white")
                  : "bg-[#2d2d2d] text-gray-400 hover:bg-[#3d3d3d]"
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
                      className="pl-10 bg-[#2d2d2d] border-[#D4A853]/30 text-white placeholder:text-gray-500 focus:border-[#D4A853] focus:ring-[#D4A853]"
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
                        className="pl-10 bg-[#2d2d2d] border-[#D4A853]/30 text-white placeholder:text-gray-500 focus:border-[#D4A853] focus:ring-[#D4A853]"
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
                  className="pl-10 bg-[#2d2d2d] border-[#D4A853]/30 text-white placeholder:text-gray-500 focus:border-[#D4A853] focus:ring-[#D4A853]"
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
                    className="pl-10 bg-[#2d2d2d] border-[#D4A853]/30 text-white placeholder:text-gray-500 focus:border-[#D4A853] focus:ring-[#D4A853]"
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
                  className="pl-10 pr-10 bg-[#2d2d2d] border-[#D4A853]/30 text-white placeholder:text-gray-500 focus:border-[#D4A853] focus:ring-[#D4A853]"
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

            <Button 
              type="submit" 
              className={`w-full font-semibold ${
                customerType === "passenger" 
                  ? "bg-[#D4A853] hover:bg-[#c49843] text-[#1a1a1a]"
                  : "bg-blue-500 hover:bg-blue-600 text-white"
              }`}
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
              className={`hover:underline font-medium ${customerType === "passenger" ? "text-[#D4A853]" : "text-blue-400"}`}
            >
              {isLogin ? "Register" : "Login"}
            </button>
          </p>
        </div>

        <p className="text-center text-gray-600 text-sm mt-6">
          © 2026 CJ's Executive Travel Limited
        </p>
      </div>
    </div>
  );
};

export default CustomerLogin;
