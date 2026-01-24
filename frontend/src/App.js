import { BrowserRouter, Routes, Route, NavLink, useLocation, useParams, Navigate } from "react-router-dom";
import { LayoutDashboard, Users, Calendar, Car, UserCircle, KeyRound, Building2, FileText, Inbox, PlusCircle, Truck, Settings, LogOut, ClipboardCheck, FileQuestion } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { useEffect, useState } from "react";
import axios from "axios";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import Dashboard from "@/pages/Dashboard";
import DriversPage from "@/pages/DriversPage";
import BookingsPage from "@/pages/BookingsPage";
import NewBookingPage from "@/pages/NewBookingPage";
import BookingDetails from "@/pages/BookingDetails";
import PassengersPage from "@/pages/PassengersPage";
import PassengerLogin from "@/pages/PassengerLogin";
import PassengerPortal from "@/pages/PassengerPortal";
import PassengerPortalAdmin from "@/pages/PassengerPortalAdmin";
import CustomerLogin from "@/pages/CustomerLogin";
import ClientPortal from "@/pages/ClientPortal";
import ClientsPage from "@/pages/ClientsPage";
import ContractWorkPage from "@/pages/ContractWorkPage";
import RequestsPage from "@/pages/RequestsPage";
import VehiclesPage from "@/pages/VehiclesPage";
import AdminLogin from "@/pages/AdminLogin";
import SettingsPage from "@/pages/SettingsPage";
import QuotesPage from "@/pages/QuotesPage";
import NewQuotePage from "@/pages/NewQuotePage";
import "@/App.css";

const API = process.env.REACT_APP_BACKEND_URL;

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace />;
  }

  return children;
};

// Component to handle short URL redirects
const ShortUrlBooking = () => {
  const { shortId } = useParams();
  const [bookingUuid, setBookingUuid] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchBooking = async () => {
      try {
        const response = await axios.get(`${API}/api/b/${shortId}`);
        setBookingUuid(response.data.id);
      } catch (err) {
        setError("Booking not found");
      } finally {
        setLoading(false);
      }
    };
    fetchBooking();
  }, [shortId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading booking...</p>
        </div>
      </div>
    );
  }

  if (error || !bookingUuid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-2">Booking Not Found</h1>
          <p className="text-muted-foreground">The booking link may be invalid or expired.</p>
        </div>
      </div>
    );
  }

  // Redirect to the full booking page with UUID
  return <Navigate to={`/booking/${bookingUuid}`} replace />;
};

const Sidebar = () => {
  const location = useLocation();
  const { user, logout } = useAuth();
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  
  const isPublicPage = location.pathname.startsWith('/booking/') || location.pathname.startsWith('/b/');

  // Fetch pending requests count
  useEffect(() => {
    if (isPublicPage) return;
    
    const fetchPendingRequests = async () => {
      try {
        const response = await axios.get(`${API}/api/admin/booking-requests`);
        const pending = response.data?.filter(r => r.status === 'pending') || [];
        setPendingRequestsCount(pending.length);
      } catch (error) {
        console.error("Error fetching pending requests:", error);
      }
    };
    fetchPendingRequests();
    // Refresh count every 30 seconds
    const interval = setInterval(fetchPendingRequests, 30000);
    return () => clearInterval(interval);
  }, [isPublicPage]);

  // Hide sidebar on public booking details page
  if (isPublicPage) {
    return null;
  }
  
  const navItems = [
    { path: "/", icon: LayoutDashboard, label: "Dashboard" },
    { path: "/bookings/new", icon: PlusCircle, label: "New Booking", highlight: true },
    { path: "/bookings", icon: Calendar, label: "Bookings" },
    { path: "/requests", icon: Inbox, label: "Requests", badge: pendingRequestsCount },
    { path: "/contract-work", icon: FileText, label: "Contract Work" },
    { path: "/clients", icon: Building2, label: "Clients" },
    { path: "/passengers", icon: UserCircle, label: "Passengers" },
    { path: "/drivers", icon: Users, label: "Drivers" },
    { path: "/vehicles", icon: Truck, label: "Vehicles" },
    { path: "/passenger-portal", icon: KeyRound, label: "Passenger Portal" },
  ];

  return (
    <aside className="sidebar" data-testid="sidebar">
      <div className="sidebar-header">
        <div className="flex items-center gap-3">
          <img 
            src="https://customer-assets.emergentagent.com/job_c2bf04a6-1cc1-4dad-86ae-c96a52a9ec62/artifacts/t13g8907_Logo%20With%20Border.png" 
            alt="CJ&apos;s Executive Travel" 
            className="w-12 h-12 object-contain"
          />
          <div>
            <h1 className="text-base font-bold tracking-tight leading-tight">CJ&apos;s Executive</h1>
            <p className="text-xs text-muted-foreground">Travel Limited</p>
          </div>
        </div>
      </div>
      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === "/"}
            className={({ isActive }) => `nav-item ${isActive ? "active" : ""} ${item.highlight ? "!bg-[#D4A853] !text-[#1a1a1a] hover:!bg-[#c49843]" : ""}`}
            data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
          >
            <item.icon className="w-5 h-5" />
            {item.label}
            {item.badge > 0 && (
              <span className="ml-auto px-2 py-0.5 text-xs font-bold bg-[#D4A853] text-[#1a1a1a] rounded-full animate-pulse">
                {item.badge}
              </span>
            )}
          </NavLink>
        ))}
      </nav>
      
      {/* User Section at bottom */}
      <div className="mt-auto border-t border-[#2d2d2d] p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-full bg-[#D4A853]/20 flex items-center justify-center">
            <UserCircle className="w-5 h-5 text-[#D4A853]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate text-white">{user?.name}</p>
            <p className="text-xs text-gray-400 truncate">{user?.email}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <NavLink
            to="/settings"
            className={({ isActive }) => `flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm rounded-md transition-colors ${isActive ? 'bg-[#D4A853] text-[#1a1a1a]' : 'bg-[#2d2d2d] text-gray-300 hover:bg-[#3d3d3d]'}`}
            data-testid="nav-settings"
          >
            <Settings className="w-4 h-4" />
            Settings
          </NavLink>
          <button
            onClick={logout}
            className="flex items-center justify-center gap-2 px-3 py-2 text-sm rounded-md bg-[#2d2d2d] text-gray-300 hover:bg-red-900/50 hover:text-red-400 transition-colors"
            data-testid="logout-btn"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};

const AppLayout = ({ children, showSidebar }) => {
  return (
    <div className={showSidebar ? "app-container" : ""}>
      {showSidebar && <Sidebar />}
      <main className={showSidebar ? "main-content" : ""}>
        {children}
      </main>
    </div>
  );
};

function AppRoutes() {
  return (
    <Routes>
      {/* Public booking details page (no sidebar) */}
      <Route path="/booking/:bookingId" element={<BookingDetails />} />
      
      {/* Short URL for booking details - uses booking_id like CJ-001 */}
      <Route path="/b/:shortId" element={<ShortUrlBooking />} />
      
      {/* Customer Login and Portals */}
      <Route path="/login" element={<PassengerLogin />} />
      <Route path="/portal" element={<PassengerPortal />} />
      <Route path="/customer-login" element={<CustomerLogin />} />
      <Route path="/client-portal" element={<ClientPortal />} />
      
      {/* Admin Login */}
      <Route path="/admin/login" element={<AdminLogin />} />
      
      {/* Protected Admin pages with sidebar */}
      <Route path="/*" element={
        <ProtectedRoute>
          <div className="app-container">
            <Sidebar />
            <main className="main-content">
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/bookings" element={<BookingsPage />} />
                <Route path="/bookings/new" element={<NewBookingPage />} />
                <Route path="/requests" element={<RequestsPage />} />
                <Route path="/contract-work" element={<ContractWorkPage />} />
                <Route path="/clients" element={<ClientsPage />} />
                <Route path="/passengers" element={<PassengersPage />} />
                <Route path="/drivers" element={<DriversPage />} />
                <Route path="/vehicles" element={<VehiclesPage />} />
                <Route path="/passenger-portal" element={<PassengerPortalAdmin />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Routes>
            </main>
          </div>
        </ProtectedRoute>
      } />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
        <Toaster position="top-right" richColors />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
