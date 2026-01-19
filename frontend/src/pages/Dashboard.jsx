import { useEffect, useState } from "react";
import axios from "axios";
import { Calendar, Users, Car, DollarSign, Clock, CheckCircle, XCircle, AlertTriangle, MapPin } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const StatCard = ({ title, value, icon: Icon, subtitle, color = "primary" }) => (
  <Card className="stat-card" data-testid={`stat-${title.toLowerCase().replace(/\s+/g, '-')}`}>
    <CardContent className="p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <h3 className="text-3xl font-bold mt-1 tracking-tight">{value}</h3>
          {subtitle && (
            <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
          )}
        </div>
        <div className={`w-12 h-12 rounded-lg bg-${color}/10 flex items-center justify-center`}
             style={{ backgroundColor: color === 'accent' ? 'hsl(217 91% 60% / 0.1)' : 
                      color === 'success' ? 'hsl(160 84% 39% / 0.1)' : 
                      color === 'warning' ? 'hsl(38 92% 50% / 0.1)' : 
                      'hsl(222 47% 11% / 0.1)' }}>
          <Icon className="w-6 h-6" 
                style={{ color: color === 'accent' ? 'hsl(217 91% 60%)' : 
                         color === 'success' ? 'hsl(160 84% 39%)' : 
                         color === 'warning' ? 'hsl(38 92% 50%)' : 
                         'hsl(222 47% 11%)' }} />
        </div>
      </div>
    </CardContent>
  </Card>
);

const getStatusBadge = (status) => {
  const styles = {
    pending: "status-pending",
    assigned: "status-assigned",
    in_progress: "status-in_progress",
    completed: "status-completed",
    cancelled: "status-cancelled",
  };
  return (
    <Badge variant="outline" className={`${styles[status]} text-xs font-medium`}>
      {status.replace('_', ' ')}
    </Badge>
  );
};

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [recentBookings, setRecentBookings] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, bookingsRes, driversRes] = await Promise.all([
          axios.get(`${API}/stats`),
          axios.get(`${API}/bookings`),
          axios.get(`${API}/drivers`),
        ]);
        setStats(statsRes.data);
        setRecentBookings(bookingsRes.data.slice(-5).reverse());
        setDrivers(driversRes.data);
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const getDriverName = (driverId) => {
    const driver = drivers.find(d => d.id === driverId);
    return driver ? driver.name : "Unassigned";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div data-testid="dashboard">
      <header className="page-header">
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Overview of your fleet operations</p>
      </header>
      
      <div className="page-content">
        {/* Stats Grid */}
        <div className="bento-grid mb-8">
          <StatCard 
            title="Total Bookings" 
            value={stats?.bookings?.total || 0}
            icon={Calendar}
            subtitle={`${stats?.bookings?.pending || 0} pending`}
            color="primary"
          />
          <StatCard 
            title="Active Drivers" 
            value={stats?.drivers?.total || 0}
            icon={Users}
            subtitle={`${stats?.drivers?.available || 0} available`}
            color="accent"
          />
          <StatCard 
            title="In Progress" 
            value={(stats?.bookings?.assigned || 0) + (stats?.bookings?.in_progress || 0)}
            icon={Car}
            subtitle="Active trips"
            color="warning"
          />
          <StatCard 
            title="Revenue" 
            value={`£${(stats?.revenue || 0).toFixed(2)}`}
            icon={DollarSign}
            subtitle="From completed trips"
            color="success"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Bookings */}
          <Card className="lg:col-span-2" data-testid="recent-bookings">
            <CardHeader>
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Clock className="w-5 h-5 text-muted-foreground" />
                Recent Bookings
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recentBookings.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No bookings yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentBookings.map((booking) => (
                    <div 
                      key={booking.id} 
                      className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors"
                      data-testid={`booking-item-${booking.id}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <MapPin className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{booking.customer_name}</p>
                          <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                            {booking.pickup_location} → {booking.dropoff_location}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {format(new Date(booking.booking_datetime), "MMM d, h:mm a")}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        {getStatusBadge(booking.status)}
                        <p className="text-xs text-muted-foreground mt-1">
                          {booking.driver_id ? getDriverName(booking.driver_id) : "No driver"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Status Overview */}
          <Card data-testid="status-overview">
            <CardHeader>
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-muted-foreground" />
                Status Overview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg bg-yellow-50 border border-yellow-200">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-yellow-600" />
                    <span className="text-sm font-medium text-yellow-800">Pending</span>
                  </div>
                  <span className="text-lg font-bold text-yellow-800">{stats?.bookings?.pending || 0}</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-blue-50 border border-blue-200">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-medium text-blue-800">Assigned</span>
                  </div>
                  <span className="text-lg font-bold text-blue-800">{stats?.bookings?.assigned || 0}</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-purple-50 border border-purple-200">
                  <div className="flex items-center gap-2">
                    <Car className="w-4 h-4 text-purple-600" />
                    <span className="text-sm font-medium text-purple-800">In Progress</span>
                  </div>
                  <span className="text-lg font-bold text-purple-800">{stats?.bookings?.in_progress || 0}</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-green-50 border border-green-200">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span className="text-sm font-medium text-green-800">Completed</span>
                  </div>
                  <span className="text-lg font-bold text-green-800">{stats?.bookings?.completed || 0}</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-red-50 border border-red-200">
                  <div className="flex items-center gap-2">
                    <XCircle className="w-4 h-4 text-red-600" />
                    <span className="text-sm font-medium text-red-800">Cancelled</span>
                  </div>
                  <span className="text-lg font-bold text-red-800">{stats?.bookings?.cancelled || 0}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
