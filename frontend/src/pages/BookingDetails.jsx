import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { MapPin, Clock, User, Phone, Car, FileText, CheckCircle, Navigation, Circle, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { format } from "date-fns";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const getStatusBadge = (status) => {
  const styles = {
    pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
    assigned: "bg-blue-100 text-blue-800 border-blue-200",
    in_progress: "bg-purple-100 text-purple-800 border-purple-200",
    completed: "bg-green-100 text-green-800 border-green-200",
    cancelled: "bg-red-100 text-red-800 border-red-200",
  };
  return (
    <Badge variant="outline" className={`${styles[status]} text-sm font-medium px-3 py-1`}>
      {status.replace('_', ' ')}
    </Badge>
  );
};

const getTrackingInfo = (status, bookingDatetime) => {
  const now = new Date();
  const bookingTime = new Date(bookingDatetime);
  const timeDiff = bookingTime - now;
  const minutesUntil = Math.floor(timeDiff / 60000);
  
  switch (status) {
    case 'pending':
      return {
        stage: 0,
        title: 'Awaiting Driver Assignment',
        subtitle: 'Your booking is confirmed. A driver will be assigned shortly.',
        progress: 10,
        eta: null,
        icon: Clock,
        color: 'yellow'
      };
    case 'assigned':
      return {
        stage: 1,
        title: 'Driver Assigned',
        subtitle: 'Your driver has been assigned and will be on their way soon.',
        progress: 35,
        eta: minutesUntil > 0 ? `Pickup in ${minutesUntil} mins` : 'Driver preparing',
        icon: User,
        color: 'blue'
      };
    case 'in_progress':
      return {
        stage: 2,
        title: 'Driver En Route',
        subtitle: 'Your driver is on the way to the pickup location.',
        progress: 65,
        eta: 'Arriving soon',
        icon: Navigation,
        color: 'purple'
      };
    case 'completed':
      return {
        stage: 3,
        title: 'Journey Completed',
        subtitle: 'Thank you for travelling with us!',
        progress: 100,
        eta: null,
        icon: CheckCircle,
        color: 'green'
      };
    case 'cancelled':
      return {
        stage: -1,
        title: 'Booking Cancelled',
        subtitle: 'This booking has been cancelled.',
        progress: 0,
        eta: null,
        icon: AlertCircle,
        color: 'red'
      };
    default:
      return {
        stage: 0,
        title: 'Status Unknown',
        subtitle: 'Please contact us for more information.',
        progress: 0,
        eta: null,
        icon: Circle,
        color: 'gray'
      };
  }
};

const TrackingTimeline = ({ currentStage }) => {
  const stages = [
    { label: 'Confirmed', stage: 0 },
    { label: 'Driver Assigned', stage: 1 },
    { label: 'En Route', stage: 2 },
    { label: 'Completed', stage: 3 },
  ];

  return (
    <div className="flex items-center justify-between w-full py-4">
      {stages.map((s, index) => (
        <div key={s.stage} className="flex items-center flex-1">
          <div className="flex flex-col items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
              currentStage >= s.stage 
                ? 'bg-green-500 text-white' 
                : 'bg-gray-200 text-gray-500'
            }`}>
              {currentStage > s.stage ? '✓' : index + 1}
            </div>
            <span className={`text-xs mt-2 text-center ${
              currentStage >= s.stage ? 'text-green-600 font-medium' : 'text-gray-400'
            }`}>
              {s.label}
            </span>
          </div>
          {index < stages.length - 1 && (
            <div className={`flex-1 h-1 mx-2 rounded ${
              currentStage > s.stage ? 'bg-green-500' : 'bg-gray-200'
            }`} />
          )}
        </div>
      ))}
    </div>
  );
};

const LiveTrackingCard = ({ tracking, driver }) => {
  const IconComponent = tracking.icon;
  const colorClasses = {
    yellow: 'bg-yellow-100 text-yellow-600 border-yellow-200',
    blue: 'bg-blue-100 text-blue-600 border-blue-200',
    purple: 'bg-purple-100 text-purple-600 border-purple-200',
    green: 'bg-green-100 text-green-600 border-green-200',
    red: 'bg-red-100 text-red-600 border-red-200',
    gray: 'bg-gray-100 text-gray-600 border-gray-200',
  };

  return (
    <Card className="mb-6 overflow-hidden">
      <div className={`h-2 ${
        tracking.color === 'green' ? 'bg-green-500' :
        tracking.color === 'blue' ? 'bg-blue-500' :
        tracking.color === 'purple' ? 'bg-purple-500' :
        tracking.color === 'yellow' ? 'bg-yellow-500' :
        tracking.color === 'red' ? 'bg-red-500' : 'bg-gray-500'
      }`} />
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Navigation className="w-5 h-5 text-primary" />
          Live Tracking
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Status Banner */}
        <div className={`flex items-center gap-4 p-4 rounded-lg border mb-4 ${colorClasses[tracking.color]}`}>
          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
            tracking.color === 'green' ? 'bg-green-200' :
            tracking.color === 'blue' ? 'bg-blue-200' :
            tracking.color === 'purple' ? 'bg-purple-200' :
            tracking.color === 'yellow' ? 'bg-yellow-200' :
            tracking.color === 'red' ? 'bg-red-200' : 'bg-gray-200'
          }`}>
            <IconComponent className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-base">{tracking.title}</h3>
            <p className="text-sm opacity-80">{tracking.subtitle}</p>
          </div>
          {tracking.eta && (
            <div className="text-right">
              <p className="text-xs uppercase tracking-wide opacity-70">ETA</p>
              <p className="font-semibold">{tracking.eta}</p>
            </div>
          )}
        </div>

        {/* Progress Timeline */}
        {tracking.stage >= 0 && (
          <TrackingTimeline currentStage={tracking.stage} />
        )}

        {/* Driver Location Indicator (when in_progress) */}
        {tracking.stage === 2 && driver && (
          <div className="mt-4 p-4 bg-slate-50 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-10 h-10 rounded-full bg-purple-500 flex items-center justify-center">
                  <Car className="w-5 h-5 text-white" />
                </div>
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white animate-pulse" />
              </div>
              <div>
                <p className="font-medium text-sm">{driver.name} is on the way</p>
                <p className="text-xs text-muted-foreground">{driver.vehicle_type} • {driver.vehicle_number}</p>
              </div>
            </div>
            <div className="mt-3">
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>Journey Progress</span>
                <span>{tracking.progress}%</span>
              </div>
              <Progress value={tracking.progress} className="h-2" />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const BookingDetails = () => {
  const { bookingId } = useParams();
  const [booking, setBooking] = useState(null);
  const [driver, setDriver] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchBooking = async () => {
    try {
      const response = await axios.get(`${API}/bookings/${bookingId}`);
      setBooking(response.data);
      
      if (response.data.driver_id) {
        const driverRes = await axios.get(`${API}/drivers/${response.data.driver_id}`);
        setDriver(driverRes.data);
      }
    } catch (err) {
      setError("Booking not found");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (bookingId) {
      fetchBooking();
      
      // Auto-refresh every 30 seconds for live tracking
      const interval = setInterval(fetchBooking, 30000);
      return () => clearInterval(interval);
    }
  }, [bookingId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading booking details...</div>
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="pt-6 text-center">
            <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <FileText className="w-8 h-8 text-red-600" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Booking Not Found</h2>
            <p className="text-muted-foreground">The booking you're looking for doesn't exist or has been removed.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const tracking = getTrackingInfo(booking.status, booking.booking_datetime);

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4" data-testid="booking-details-page">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <img 
            src="https://customer-assets.emergentagent.com/job_30ae4b98-ebfc-45ee-a35f-fc60498c61c6/artifacts/i2qqz1kf_Logo%20Background.png" 
            alt="CJ's Executive Travel" 
            className="w-20 h-20 object-contain mx-auto mb-4"
          />
          <h1 className="text-2xl font-bold tracking-tight mb-2">
            {booking.status === 'cancelled' ? 'Booking Cancelled' : 'Booking Confirmed'}
          </h1>
          <p className="text-muted-foreground">CJ's Executive Travel Limited</p>
        </div>

        {/* Live Tracking Card */}
        <LiveTrackingCard tracking={tracking} driver={driver} />

        {/* Journey Details */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <MapPin className="w-5 h-5 text-primary" />
              Journey Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-3 h-3 rounded-full bg-green-500 mt-1.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Pickup</p>
                <p className="font-medium">{booking.pickup_location}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-3 h-3 rounded-full bg-red-500 mt-1.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Drop-off</p>
                <p className="font-medium">{booking.dropoff_location}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 pt-2 border-t">
              <Clock className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Date & Time</p>
                <p className="font-medium">
                  {format(new Date(booking.booking_datetime), "EEEE, MMMM d, yyyy 'at' h:mm a")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Driver Details */}
        {driver && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Car className="w-5 h-5 text-primary" />
                Your Driver
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="w-7 h-7 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-lg">{driver.name}</p>
                  <p className="text-sm text-muted-foreground">{driver.vehicle_type} • {driver.vehicle_number}</p>
                </div>
                <a 
                  href={`tel:${driver.phone}`}
                  className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center hover:bg-green-200 transition-colors"
                >
                  <Phone className="w-5 h-5 text-green-600" />
                </a>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Customer Details */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <User className="w-5 h-5 text-primary" />
              Your Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3">
              <User className="w-4 h-4 text-muted-foreground" />
              <span>{booking.customer_name}</span>
            </div>
            <div className="flex items-center gap-3">
              <Phone className="w-4 h-4 text-muted-foreground" />
              <span>{booking.customer_phone}</span>
            </div>
          </CardContent>
        </Card>

        {/* Fare */}
        {booking.fare && (
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Estimated Fare</span>
                <span className="text-2xl font-bold">£{booking.fare.toFixed(2)}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Notes */}
        {booking.notes && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                Notes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">{booking.notes}</p>
            </CardContent>
          </Card>
        )}

        {/* Auto-refresh indicator */}
        <div className="text-center text-xs text-muted-foreground mb-4">
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            Live tracking updates every 30 seconds
          </span>
        </div>

        {/* Footer */}
        <div className="text-center text-sm text-muted-foreground mt-8">
          <p>Thank you for choosing CJ's Executive Travel Limited</p>
          <p className="mt-1">For any queries, please contact us.</p>
        </div>
      </div>
    </div>
  );
};

export default BookingDetails;
