import { useEffect, useState } from "react";
import axios from "axios";
import { Calendar, Users, Car, DollarSign, Clock, CheckCircle, XCircle, AlertTriangle, MapPin, Navigation, FileWarning, Truck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format, differenceInDays, parseISO, isValid } from "date-fns";

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

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expiringDocs, setExpiringDocs] = useState([]);
  const [expiringVehicleDocs, setExpiringVehicleDocs] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, driversRes, vehiclesRes] = await Promise.all([
          axios.get(`${API}/stats`),
          axios.get(`${API}/drivers`),
          axios.get(`${API}/vehicles`)
        ]);
        setStats(statsRes.data);
        
        const today = new Date();
        const expiryWarningDays = 30;
        
        // Process driver documents for expiry
        const expiring = [];
        const driverDocTypes = [
          { key: 'taxi_licence_expiry', label: 'Taxi Licence' },
          { key: 'dbs_expiry', label: 'DBS Check' },
          { key: 'school_badge_expiry', label: 'School Badge' },
          { key: 'driving_licence_expiry', label: 'Driving Licence' },
          { key: 'cpc_expiry', label: 'CPC' },
          { key: 'tacho_card_expiry', label: 'Tacho Card' },
        ];
        
        driversRes.data.forEach(driver => {
          driverDocTypes.forEach(docType => {
            const expiryDate = driver[docType.key];
            if (expiryDate) {
              try {
                const parsedDate = parseISO(expiryDate);
                if (isValid(parsedDate)) {
                  const daysUntilExpiry = differenceInDays(parsedDate, today);
                  if (daysUntilExpiry <= expiryWarningDays) {
                    expiring.push({
                      driverName: driver.name,
                      driverId: driver.id,
                      docType: docType.label,
                      expiryDate: parsedDate,
                      daysUntilExpiry,
                      isExpired: daysUntilExpiry < 0
                    });
                  }
                }
              } catch (e) {
                // Invalid date format, skip
              }
            }
          });
        });
        
        expiring.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);
        setExpiringDocs(expiring);
        
        // Process vehicle documents for expiry
        const vehicleExpiring = [];
        const vehicleDocTypes = [
          { key: 'mot_expiry', label: 'MOT' },
          { key: 'insurance_expiry', label: 'Insurance' },
          { key: 'tax_expiry', label: 'Road Tax' },
        ];
        
        vehiclesRes.data.forEach(vehicle => {
          vehicleDocTypes.forEach(docType => {
            const expiryDate = vehicle[docType.key];
            if (expiryDate) {
              try {
                const parsedDate = parseISO(expiryDate);
                if (isValid(parsedDate)) {
                  const daysUntilExpiry = differenceInDays(parsedDate, today);
                  if (daysUntilExpiry <= expiryWarningDays) {
                    vehicleExpiring.push({
                      vehicleReg: vehicle.registration,
                      vehicleId: vehicle.id,
                      docType: docType.label,
                      expiryDate: parsedDate,
                      daysUntilExpiry,
                      isExpired: daysUntilExpiry < 0
                    });
                  }
                }
              } catch (e) {
                // Invalid date format, skip
              }
            }
          });
        });
        
        vehicleExpiring.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);
        setExpiringVehicleDocs(vehicleExpiring);
        
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

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
            title="Docs Expiring" 
            value={expiringDocs.length}
            icon={FileWarning}
            subtitle={expiringDocs.filter(d => d.isExpired).length > 0 
              ? `${expiringDocs.filter(d => d.isExpired).length} expired!` 
              : "Within 30 days"}
            color={expiringDocs.filter(d => d.isExpired).length > 0 ? "warning" : "primary"}
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
          {/* GPS Live Tracking */}
          <Card className="lg:col-span-2" data-testid="gps-tracking">
            <CardHeader>
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Navigation className="w-5 h-5 text-muted-foreground" />
                Live GPS Tracking
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="relative w-full" style={{ height: "450px" }}>
                <iframe
                  src="https://gpslive.co.uk/public-link/be37c779-68fd-4916-b950-26741285ba23?fit=true&zoom=12"
                  className="absolute inset-0 w-full h-full rounded-b-lg"
                  style={{ border: "none" }}
                  title="GPS Live Tracking"
                  allowFullScreen
                  data-testid="gps-iframe"
                />
              </div>
            </CardContent>
          </Card>

          {/* Status Overview */}
          <Card data-testid="status-overview">
            <CardHeader>
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <FileWarning className="w-5 h-5 text-muted-foreground" />
                Driver Docs Expiring
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-[380px] overflow-y-auto">
                {expiringDocs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-500" />
                    <p className="text-sm">All driver documents are up to date</p>
                  </div>
                ) : (
                  expiringDocs.map((doc, idx) => (
                    <div 
                      key={`${doc.driverId}-${doc.docType}-${idx}`}
                      className={`flex items-center justify-between p-3 rounded-lg border ${
                        doc.isExpired 
                          ? 'bg-red-50 border-red-200' 
                          : doc.daysUntilExpiry <= 7 
                            ? 'bg-orange-50 border-orange-200'
                            : 'bg-yellow-50 border-yellow-200'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium truncate ${
                          doc.isExpired ? 'text-red-800' : doc.daysUntilExpiry <= 7 ? 'text-orange-800' : 'text-yellow-800'
                        }`}>
                          {doc.driverName}
                        </p>
                        <p className={`text-xs ${
                          doc.isExpired ? 'text-red-600' : doc.daysUntilExpiry <= 7 ? 'text-orange-600' : 'text-yellow-600'
                        }`}>
                          {doc.docType}
                        </p>
                      </div>
                      <div className="text-right ml-2">
                        <Badge 
                          variant="outline" 
                          className={`text-xs ${
                            doc.isExpired 
                              ? 'bg-red-100 text-red-700 border-red-300' 
                              : doc.daysUntilExpiry <= 7 
                                ? 'bg-orange-100 text-orange-700 border-orange-300'
                                : 'bg-yellow-100 text-yellow-700 border-yellow-300'
                          }`}
                        >
                          {doc.isExpired 
                            ? `Expired ${Math.abs(doc.daysUntilExpiry)}d ago`
                            : doc.daysUntilExpiry === 0 
                              ? 'Expires today'
                              : `${doc.daysUntilExpiry}d left`
                          }
                        </Badge>
                        <p className={`text-xs mt-1 ${
                          doc.isExpired ? 'text-red-500' : doc.daysUntilExpiry <= 7 ? 'text-orange-500' : 'text-yellow-500'
                        }`}>
                          {format(doc.expiryDate, 'dd MMM yyyy')}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
