import { BrowserRouter, Routes, Route, NavLink, useLocation } from "react-router-dom";
import { LayoutDashboard, Users, Calendar, Car } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import Dashboard from "@/pages/Dashboard";
import DriversPage from "@/pages/DriversPage";
import BookingsPage from "@/pages/BookingsPage";
import BookingDetails from "@/pages/BookingDetails";
import "@/App.css";

const Sidebar = () => {
  const location = useLocation();
  
  // Hide sidebar on public booking details page
  if (location.pathname.startsWith('/booking/')) {
    return null;
  }
  
  const navItems = [
    { path: "/", icon: LayoutDashboard, label: "Dashboard" },
    { path: "/bookings", icon: Calendar, label: "Bookings" },
    { path: "/drivers", icon: Users, label: "Drivers" },
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
        
        {/* Admin pages with sidebar */}
        <Route path="/*" element={
          <div className="app-container">
            <Sidebar />
            <main className="main-content">
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/bookings" element={<BookingsPage />} />
                <Route path="/drivers" element={<DriversPage />} />
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
