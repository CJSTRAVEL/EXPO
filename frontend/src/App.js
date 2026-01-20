import { BrowserRouter, Routes, Route, NavLink, useLocation, useParams, Navigate } from "react-router-dom";
import { LayoutDashboard, Users, Calendar, Car, UserCircle, KeyRound, Building2, FileText, Inbox } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { useEffect, useState } from "react";
import axios from "axios";
import Dashboard from "@/pages/Dashboard";
import DriversPage from "@/pages/DriversPage";
import BookingsPage from "@/pages/BookingsPage";
import BookingDetails from "@/pages/BookingDetails";
import PassengersPage from "@/pages/PassengersPage";
import PassengerLogin from "@/pages/PassengerLogin";
import PassengerPortal from "@/pages/PassengerPortal";
import PassengerPortalAdmin from "@/pages/PassengerPortalAdmin";
import ClientsPage from "@/pages/ClientsPage";
import ContractWorkPage from "@/pages/ContractWorkPage";
import RequestsPage from "@/pages/RequestsPage";
import "@/App.css";

const API = process.env.REACT_APP_BACKEND_URL;

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
  
  // Hide sidebar on public booking details page
  if (location.pathname.startsWith('/booking/') || location.pathname.startsWith('/b/')) {
    return null;
  }
  
  const navItems = [
    { path: "/", icon: LayoutDashboard, label: "Dashboard" },
    { path: "/bookings", icon: Calendar, label: "Bookings" },
    { path: "/requests", icon: Inbox, label: "Requests" },
    { path: "/contract-work", icon: FileText, label: "Contract Work" },
    { path: "/clients", icon: Building2, label: "Clients" },
    { path: "/passengers", icon: UserCircle, label: "Passengers" },
    { path: "/drivers", icon: Users, label: "Drivers" },
    { path: "/passenger-portal", icon: KeyRound, label: "Passenger Portal" },
  ];

  return (
    <aside className="sidebar" data-testid="sidebar">
      <div className="sidebar-header">
        <div className="flex items-center gap-3">
          <img 
            src="https://customer-assets.emergentagent.com/job_30ae4b98-ebfc-45ee-a35f-fc60498c61c6/artifacts/i2qqz1kf_Logo%20Background.png" 
            alt="CJ's Executive Travel" 
            className="w-12 h-12 object-contain"
          />
          <div>
            <h1 className="text-base font-bold tracking-tight leading-tight">CJ's Executive</h1>
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
            className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
            data-testid={`nav-${item.label.toLowerCase()}`}
          >
            <item.icon className="w-5 h-5" />
            {item.label}
          </NavLink>
        ))}
      </nav>
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

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public booking details page (no sidebar) */}
        <Route path="/booking/:bookingId" element={<BookingDetails />} />
        
        {/* Short URL for booking details - uses booking_id like CJ-001 */}
        <Route path="/b/:shortId" element={<ShortUrlBooking />} />
        
        {/* Passenger Login and Portal */}
        <Route path="/login" element={<PassengerLogin />} />
        <Route path="/portal" element={<PassengerPortal />} />
        
        {/* Admin pages with sidebar */}
        <Route path="/*" element={
          <div className="app-container">
            <Sidebar />
            <main className="main-content">
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/bookings" element={<BookingsPage />} />
                <Route path="/contract-work" element={<ContractWorkPage />} />
                <Route path="/clients" element={<ClientsPage />} />
                <Route path="/passengers" element={<PassengersPage />} />
                <Route path="/drivers" element={<DriversPage />} />
                <Route path="/passenger-portal" element={<PassengerPortalAdmin />} />
              </Routes>
            </main>
            <Toaster position="top-right" richColors />
          </div>
        } />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
