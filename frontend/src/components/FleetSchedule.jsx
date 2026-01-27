import { useState, useEffect, useMemo, useCallback } from "react";
import axios from "axios";
import { format, addDays, startOfDay, parseISO, isSameDay } from "date-fns";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CalendarIcon, ChevronLeft, ChevronRight, MapPin, Clock, Car, Link2, Wand2, Loader2, Eye, User, Phone, Mail, FileText, Navigation, ZoomIn, ZoomOut, Maximize2, GripVertical, Briefcase, Plane, UserCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const API = process.env.REACT_APP_BACKEND_URL;

// Working hours timeline (6am - 8pm)
const WORKING_HOURS = Array.from({ length: 15 }, (_, i) => i + 6); // 6-20
const FULL_HOURS = Array.from({ length: 24 }, (_, i) => i);

// Booking type colors
const BOOKING_COLORS = {
  contract: { bg: 'bg-purple-500', hover: 'hover:bg-purple-600', text: 'Contract Work' },
  airport: { bg: 'bg-green-500', hover: 'hover:bg-green-600', text: 'Airport' },
  corporate: { bg: 'bg-indigo-500', hover: 'hover:bg-indigo-600', text: 'Corporate' },
  default: { bg: 'bg-blue-500', hover: 'hover:bg-blue-600', text: 'Standard' }
};

// Get booking color based on type
const getBookingColor = (booking) => {
  if (booking.is_contract_work || booking.booking_source === 'contract') return BOOKING_COLORS.contract;
  if (booking.pickup_location?.toLowerCase().includes('airport') || 
      booking.dropoff_location?.toLowerCase().includes('airport')) return BOOKING_COLORS.airport;
  if (booking.client_id) return BOOKING_COLORS.corporate;
  return BOOKING_COLORS.default;
};

const FleetSchedule = ({ fullView = false }) => {
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [vehicles, setVehicles] = useState([]);
  const [vehicleTypes, setVehicleTypes] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [unassignedBookings, setUnassignedBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [allocateDialog, setAllocateDialog] = useState(null);
  const [selectedVehicle, setSelectedVehicle] = useState("");
  const [autoScheduling, setAutoScheduling] = useState(false);
  const [autoScheduleResult, setAutoScheduleResult] = useState(null);
  const [viewBooking, setViewBooking] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(1); // 0.5, 1, 1.5, 2
  const [draggedBooking, setDraggedBooking] = useState(null);

  // Use full hours or working hours based on view mode
  const HOURS = fullView ? FULL_HOURS : WORKING_HOURS;
  const hourWidth = 60 * zoomLevel; // Base width * zoom

  useEffect(() => {
    fetchData();
  }, [selectedDate]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [vehiclesRes, vehicleTypesRes, bookingsRes, driversRes] = await Promise.all([
        axios.get(`${API}/api/vehicles`),
        axios.get(`${API}/api/vehicle-types`),
        axios.get(`${API}/api/bookings`),
        axios.get(`${API}/api/drivers`),
      ]);

      setVehicles(vehiclesRes.data || []);
      setVehicleTypes(vehicleTypesRes.data || []);
      setDrivers(driversRes.data || []);
      
      // Filter bookings for selected date
      const allBookings = bookingsRes.data || [];
      const dayBookings = allBookings.filter(b => {
        if (!b.booking_datetime) return false;
        const bookingDate = parseISO(b.booking_datetime);
        return isSameDay(bookingDate, selectedDate);
      });
      
      setBookings(dayBookings);
      
      // Find unassigned bookings (no vehicle_id assigned)
      const unassigned = dayBookings.filter(b => !b.vehicle_id && b.status !== 'completed' && b.status !== 'cancelled');
      setUnassignedBookings(unassigned);
      
    } catch (error) {
      console.error("Error fetching schedule data:", error);
      toast.error("Failed to load schedule");
    } finally {
      setLoading(false);
    }
  };

  // Group vehicles by type
  const vehiclesByType = useMemo(() => {
    const grouped = {};
    vehicles.forEach(v => {
      // Handle both nested vehicle_type object and vehicle_type_id
      const typeName = v.vehicle_type?.name || 
                       vehicleTypes.find(vt => vt.id === v.vehicle_type_id)?.name || 
                       'Unknown';
      if (!grouped[typeName]) {
        grouped[typeName] = [];
      }
      grouped[typeName].push(v);
    });
    return grouped;
  }, [vehicles, vehicleTypes]);

  // Get bookings for a specific vehicle
  const getVehicleBookings = (vehicleId) => {
    return bookings.filter(b => b.vehicle_id === vehicleId);
  };

  // Calculate timeline summary
  const timelineSummary = useMemo(() => {
    const assignedBookings = bookings.filter(b => b.vehicle_id);
    const vehiclesWithBookings = new Set(assignedBookings.map(b => b.vehicle_id));
    
    // Group by vehicle for summary
    const vehicleSummary = {};
    assignedBookings.forEach(b => {
      const vehicle = vehicles.find(v => v.id === b.vehicle_id);
      if (vehicle) {
        if (!vehicleSummary[vehicle.id]) {
          vehicleSummary[vehicle.id] = {
            registration: vehicle.registration,
            make: vehicle.make,
            model: vehicle.model,
            bookings: []
          };
        }
        vehicleSummary[vehicle.id].bookings.push(b);
      }
    });
    
    // Sort bookings by time within each vehicle
    Object.values(vehicleSummary).forEach(v => {
      v.bookings.sort((a, b) => {
        const timeA = parseISO(a.booking_datetime);
        const timeB = parseISO(b.booking_datetime);
        return timeA - timeB;
      });
    });
    
    return {
      totalBookings: assignedBookings.length,
      vehiclesUsed: vehiclesWithBookings.size,
      vehicleSummary
    };
  }, [bookings, vehicles]);

  // Calculate booking position and width on timeline
  const getBookingStyle = (booking) => {
    if (!booking.booking_datetime) return null;
    
    const bookingTime = parseISO(booking.booking_datetime);
    const hours = bookingTime.getHours();
    const minutes = bookingTime.getMinutes();
    
    // Calculate position relative to displayed hours
    const startHour = HOURS[0];
    const endHour = HOURS[HOURS.length - 1] + 1;
    const totalMinutes = (endHour - startHour) * 60;
    
    const bookingMinutes = (hours - startHour) * 60 + minutes;
    const startPercent = (bookingMinutes / totalMinutes) * 100;
    
    // Duration in minutes (default 60 if not specified)
    const duration = booking.duration_minutes || 60;
    const widthPercent = (duration / totalMinutes) * 100;
    
    // Hide bookings outside visible range
    if (hours < startHour || hours >= endHour) return null;
    
    return {
      left: `${Math.max(0, startPercent)}%`,
      width: `${Math.max(widthPercent, 3)}%`, // Minimum 3% width for visibility
    };
  };

  // Format time from datetime
  const formatTime = (datetime) => {
    if (!datetime) return '';
    return format(parseISO(datetime), 'HH:mm');
  };

  // Get driver assigned to a vehicle
  const getVehicleDriver = (vehicleId) => {
    // Find driver assigned to this vehicle (you may need to adjust based on your data model)
    const driver = drivers.find(d => d.assigned_vehicle_id === vehicleId || d.vehicle_id === vehicleId);
    return driver;
  };

  // Handle drag start
  const handleDragStart = (e, booking) => {
    setDraggedBooking(booking);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', booking.id);
  };

  // Handle drag over
  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  // Handle drop on vehicle row
  const handleDrop = async (e, vehicleId) => {
    e.preventDefault();
    if (!draggedBooking) return;
    
    try {
      await axios.put(`${API}/api/bookings/${draggedBooking.id}`, {
        vehicle_id: vehicleId
      });
      toast.success(`Booking ${draggedBooking.booking_id} moved to vehicle`);
      setDraggedBooking(null);
      fetchData();
    } catch (error) {
      console.error("Error moving booking:", error);
      toast.error("Failed to move booking");
    }
  };

  // Handle allocating a booking to a vehicle
  const handleAllocate = async () => {
    if (!allocateDialog || !selectedVehicle) return;
    
    try {
      await axios.put(`${API}/api/bookings/${allocateDialog.id}`, {
        vehicle_id: selectedVehicle
      });
      toast.success(`Booking ${allocateDialog.booking_id} allocated successfully`);
      setAllocateDialog(null);
      setSelectedVehicle("");
      fetchData();
    } catch (error) {
      console.error("Error allocating booking:", error);
      toast.error("Failed to allocate booking");
    }
  };

  // Zoom controls
  const zoomIn = () => setZoomLevel(prev => Math.min(prev + 0.25, 2));
  const zoomOut = () => setZoomLevel(prev => Math.max(prev - 0.25, 0.5));

  // Navigate days
  const goToPreviousDay = () => setSelectedDate(prev => addDays(prev, -1));
  const goToNextDay = () => setSelectedDate(prev => addDays(prev, 1));
  const goToToday = () => setSelectedDate(new Date());

  // Auto-schedule all unassigned bookings
  const handleAutoSchedule = async () => {
    if (unassignedBookings.length === 0) {
      toast.info("No unassigned bookings to schedule");
      return;
    }
    
    setAutoScheduling(true);
    setAutoScheduleResult(null);
    
    try {
      const dateStr = format(selectedDate, "yyyy-MM-dd");
      const response = await axios.post(`${API}/api/scheduling/auto-assign?date=${dateStr}`);
      const result = response.data;
      
      setAutoScheduleResult(result);
      
      if (result.assigned > 0) {
        toast.success(`Successfully assigned ${result.assigned} booking(s) to ${result.vehicles_used} vehicle(s)`);
      }
      
      if (result.failed > 0) {
        toast.warning(`${result.failed} booking(s) could not be assigned`);
      }
      
      // Refresh data
      fetchData();
    } catch (error) {
      console.error("Error auto-scheduling:", error);
      toast.error("Failed to auto-schedule bookings");
    } finally {
      setAutoScheduling(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="fleet-schedule">
      {/* Header with Date Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-4 rounded-lg border">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={goToPreviousDay}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="min-w-[200px] justify-start text-left font-normal">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(selectedDate, "EEEE, dd MMMM yyyy")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && setSelectedDate(date)}
                initialFocus
              />
            </PopoverContent>
          </Popover>
          
          <Button variant="outline" size="icon" onClick={goToNextDay}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          
          <Button variant="ghost" size="sm" onClick={goToToday}>
            Today
          </Button>
        </div>
        
        <div className="flex items-center gap-4 text-sm flex-wrap">
          {/* Color Legend */}
          <div className="flex items-center gap-3 border-r pr-4">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-purple-500 rounded"></div>
              <span className="text-xs">Contract</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-green-500 rounded"></div>
              <span className="text-xs">Airport</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-indigo-500 rounded"></div>
              <span className="text-xs">Corporate</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-blue-500 rounded"></div>
              <span className="text-xs">Standard</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-amber-500 rounded"></div>
            <span className="text-xs">Unassigned ({unassignedBookings.length})</span>
          </div>
          
          {/* Zoom Controls */}
          <div className="flex items-center gap-1 border-l pl-4">
            <Button variant="outline" size="icon" className="h-7 w-7" onClick={zoomOut} disabled={zoomLevel <= 0.5}>
              <ZoomOut className="h-3 w-3" />
            </Button>
            <span className="text-xs w-12 text-center">{Math.round(zoomLevel * 100)}%</span>
            <Button variant="outline" size="icon" className="h-7 w-7" onClick={zoomIn} disabled={zoomLevel >= 2}>
              <ZoomIn className="h-3 w-3" />
            </Button>
          </div>
          
          {/* Full Timeline Button */}
          {!fullView && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/scheduling/full')}
              className="ml-2"
            >
              <Maximize2 className="h-4 w-4 mr-1" />
              Full 24h View
            </Button>
          )}
          
          {/* Auto Schedule Button */}
          {unassignedBookings.length > 0 && (
            <Button
              onClick={handleAutoSchedule}
              disabled={autoScheduling}
              className="bg-[#D4A853] hover:bg-[#c49843] text-white ml-2"
              data-testid="auto-schedule-btn"
            >
              {autoScheduling ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Scheduling...
                </>
              ) : (
                <>
                  <Wand2 className="h-4 w-4 mr-2" />
                  Auto Schedule
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Auto Schedule Result */}
      {autoScheduleResult && (
        <div className={`rounded-lg p-4 ${autoScheduleResult.failed > 0 ? 'bg-yellow-50 border border-yellow-200' : 'bg-green-50 border border-green-200'}`}>
          <h4 className="font-semibold mb-2">
            Auto-Schedule Results
          </h4>
          <div className="grid grid-cols-3 gap-4 text-sm mb-3">
            <div>
              <span className="text-gray-500">Assigned:</span>
              <span className="ml-2 font-bold text-green-600">{autoScheduleResult.assigned}</span>
            </div>
            <div>
              <span className="text-gray-500">Failed:</span>
              <span className="ml-2 font-bold text-red-600">{autoScheduleResult.failed}</span>
            </div>
            <div>
              <span className="text-gray-500">Vehicles Used:</span>
              <span className="ml-2 font-bold">{autoScheduleResult.vehicles_used}</span>
            </div>
          </div>
          
          {autoScheduleResult.assignments?.length > 0 && (
            <div className="mb-2">
              <p className="text-xs text-gray-500 mb-1">Assignments:</p>
              <div className="flex flex-wrap gap-2">
                {autoScheduleResult.assignments.map((a, i) => (
                  <Badge key={i} variant="outline" className="bg-green-100 text-green-800 text-xs">
                    {a.booking_id} → {a.vehicle_registration} @ {a.time}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          
          {autoScheduleResult.failures?.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 mb-1">Failed to assign:</p>
              <div className="flex flex-wrap gap-2">
                {autoScheduleResult.failures.map((f, i) => (
                  <Badge key={i} variant="outline" className="bg-red-100 text-red-800 text-xs">
                    {f.booking_id} @ {f.time} - {f.reason}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setAutoScheduleResult(null)}
            className="mt-2 text-xs"
          >
            Dismiss
          </Button>
        </div>
      )}

      {/* Timeline Summary - Shows when jobs are allocated */}
      {timelineSummary.totalBookings > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-800 mb-3 flex items-center gap-2">
            <Car className="h-4 w-4" />
            Scheduled Jobs Summary - {format(selectedDate, "dd MMM yyyy")}
          </h3>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="bg-white rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-blue-600">{timelineSummary.totalBookings}</div>
              <div className="text-xs text-gray-500">Total Bookings</div>
            </div>
            <div className="bg-white rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-green-600">{timelineSummary.vehiclesUsed}</div>
              <div className="text-xs text-gray-500">Vehicles Used</div>
            </div>
            <div className="bg-white rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-amber-600">{unassignedBookings.length}</div>
              <div className="text-xs text-gray-500">Unassigned</div>
            </div>
          </div>
          
          {/* Vehicle breakdown */}
          <div className="space-y-2">
            {Object.entries(timelineSummary.vehicleSummary).map(([vehicleId, vehicleData]) => (
              <div key={vehicleId} className="bg-white rounded-lg p-3 border">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-medium text-sm">
                    {vehicleData.registration} 
                    <span className="text-gray-400 font-normal ml-2">
                      {vehicleData.make} {vehicleData.model}
                    </span>
                  </div>
                  <Badge variant="outline" className="bg-blue-100 text-blue-700">
                    {vehicleData.bookings.length} job{vehicleData.bookings.length !== 1 ? 's' : ''}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-2">
                  {vehicleData.bookings.map(booking => (
                    <button
                      key={booking.id}
                      onClick={() => setViewBooking(booking)}
                      className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 px-2 py-1 rounded transition-colors"
                    >
                      {booking.booking_id} @ {formatTime(booking.booking_datetime)}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Unassigned Bookings */}
      {unassignedBookings.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <h3 className="font-semibold text-amber-800 mb-3 flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Unassigned Bookings for {format(selectedDate, "dd MMM")}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {unassignedBookings.map(booking => {
              const vehicleType = vehicleTypes.find(vt => vt.id === booking.vehicle_type) || booking.vehicle_type_data;
              return (
                <div 
                  key={booking.id}
                  className="bg-white border border-amber-300 rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => setViewBooking(booking)}
                >
                  <div className="flex justify-between items-start mb-2">
                    <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300">
                      {booking.booking_id}
                    </Badge>
                    <span className="text-sm font-medium">{formatTime(booking.booking_datetime)}</span>
                  </div>
                  <div className="text-xs space-y-1 text-gray-600">
                    <div className="flex items-start gap-1">
                      <MapPin className="h-3 w-3 mt-0.5 text-green-600" />
                      <span className="truncate">{booking.pickup_location}</span>
                    </div>
                    <div className="flex items-start gap-1">
                      <MapPin className="h-3 w-3 mt-0.5 text-red-600" />
                      <span className="truncate">{booking.dropoff_location}</span>
                    </div>
                    {vehicleType && (
                      <div className="flex items-center gap-1">
                        <Car className="h-3 w-3 text-gray-500" />
                        <span>{vehicleType.name}</span>
                      </div>
                    )}
                    {booking.duration_minutes && (
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-gray-500" />
                        <span>{booking.duration_minutes} mins</span>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 mt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        setViewBooking(booking);
                      }}
                    >
                      <Eye className="h-3 w-3 mr-1" />
                      View
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        setAllocateDialog(booking);
                      }}
                    >
                      <Link2 className="h-3 w-3 mr-1" />
                      Allocate
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="bg-white rounded-lg border overflow-hidden">
        {/* Timeline Header */}
        <div className="flex border-b bg-gray-50">
          <div className="w-48 flex-shrink-0 p-2 font-semibold text-sm border-r bg-gray-100">
            Vehicle
          </div>
          <div className="flex-1 flex">
            {HOURS.map(hour => (
              <div
                key={hour}
                className="flex-1 text-center text-xs py-2 border-r last:border-r-0 text-gray-500"
                style={{ minWidth: '40px' }}
              >
                {String(hour).padStart(2, '0')}:00
              </div>
            ))}
          </div>
        </div>

        {/* Vehicle Rows by Type */}
        {Object.entries(vehiclesByType).map(([typeName, typeVehicles]) => (
          <div key={typeName}>
            {/* Type Header */}
            <div className="bg-gray-800 text-white px-4 py-2 text-sm font-semibold">
              {typeName} ({typeVehicles.length} vehicles)
            </div>
            
            {/* Vehicles */}
            {typeVehicles.map(vehicle => {
              const vehicleBookings = getVehicleBookings(vehicle.id);
              
              return (
                <div key={vehicle.id} className="flex border-b hover:bg-gray-50">
                  {/* Vehicle Info */}
                  <div className="w-48 flex-shrink-0 p-2 border-r bg-gray-50">
                    <div className="font-medium text-sm">{vehicle.registration}</div>
                    <div className="text-xs text-gray-500">{vehicle.make} {vehicle.model}</div>
                    {vehicle.color && (
                      <div className="text-xs text-gray-400">{vehicle.color}</div>
                    )}
                  </div>
                  
                  {/* Timeline */}
                  <div className="flex-1 relative h-16">
                    {/* Hour Grid Lines */}
                    <div className="absolute inset-0 flex">
                      {HOURS.map(hour => (
                        <div
                          key={hour}
                          className="flex-1 border-r last:border-r-0 border-gray-100"
                          style={{ minWidth: '40px' }}
                        />
                      ))}
                    </div>
                    
                    {/* Bookings */}
                    {vehicleBookings.map(booking => {
                      const style = getBookingStyle(booking);
                      if (!style) return null;
                      
                      const endTime = booking.duration_minutes 
                        ? format(new Date(parseISO(booking.booking_datetime).getTime() + booking.duration_minutes * 60000), 'HH:mm')
                        : '';
                      
                      return (
                        <div
                          key={booking.id}
                          className="absolute top-1 bottom-1 bg-blue-500 rounded cursor-pointer hover:bg-blue-600 transition-colors overflow-hidden group"
                          style={style}
                          title={`Click to view ${booking.booking_id}`}
                          onClick={() => setViewBooking(booking)}
                        >
                          <div className="p-1 text-white text-xs h-full flex flex-col justify-center">
                            <div className="font-semibold truncate">{booking.booking_id}</div>
                            <div className="truncate opacity-80">
                              {formatTime(booking.booking_datetime)}{endTime && ` - ${endTime}`}
                            </div>
                          </div>
                          
                          {/* Tooltip on hover */}
                          <div className="absolute left-0 top-full mt-1 bg-gray-900 text-white text-xs rounded p-2 z-50 w-48 hidden group-hover:block shadow-lg pointer-events-none">
                            <div className="font-semibold mb-1">{booking.booking_id}</div>
                            <div className="flex items-start gap-1 mb-1">
                              <MapPin className="h-3 w-3 mt-0.5 text-green-400" />
                              <span>{booking.pickup_location}</span>
                            </div>
                            <div className="flex items-start gap-1">
                              <MapPin className="h-3 w-3 mt-0.5 text-red-400" />
                              <span>{booking.dropoff_location}</span>
                            </div>
                            {booking.duration_minutes && (
                              <div className="mt-1 text-gray-300">
                                Duration: {booking.duration_minutes} mins
                              </div>
                            )}
                            <div className="mt-1 text-blue-300 text-[10px]">Click to view details</div>
                          </div>
                        </div>
                      );
                    })}
                    
                    {/* Empty slot indicator - click to allocate */}
                    {vehicleBookings.length === 0 && (
                      <div 
                        className="absolute inset-0 flex items-center justify-center text-xs text-gray-400 cursor-pointer hover:bg-blue-50 transition-colors"
                        onClick={() => {
                          // Find unassigned bookings matching this vehicle type
                          const vehicleTypeId = vehicle.vehicle_type_id || vehicle.vehicle_type?.id;
                          const matchingBookings = unassignedBookings.filter(b => 
                            b.vehicle_type === vehicleTypeId || !b.vehicle_type
                          );
                          if (matchingBookings.length > 0) {
                            setAllocateDialog({ ...matchingBookings[0], targetVehicle: vehicle });
                            setSelectedVehicle(vehicle.id);
                          }
                        }}
                      >
                        {unassignedBookings.some(b => b.vehicle_type === (vehicle.vehicle_type_id || vehicle.vehicle_type?.id) || !b.vehicle_type) 
                          ? "Click to allocate booking" 
                          : "No bookings"
                        }
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}

        {vehicles.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            No vehicles found. Add vehicles in Settings to see the schedule.
          </div>
        )}
      </div>

      {/* Allocation Dialog */}
      <Dialog open={!!allocateDialog} onOpenChange={() => setAllocateDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Allocate Booking to Vehicle</DialogTitle>
          </DialogHeader>
          
          {allocateDialog && (
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="font-semibold">{allocateDialog.booking_id}</div>
                <div className="text-sm text-gray-600 mt-1">
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatTime(allocateDialog.booking_datetime)}
                    {allocateDialog.duration_minutes && ` (${allocateDialog.duration_minutes} mins)`}
                  </div>
                  <div className="flex items-start gap-1 mt-1">
                    <MapPin className="h-3 w-3 mt-0.5 text-green-600" />
                    <span>{allocateDialog.pickup_location}</span>
                  </div>
                  <div className="flex items-start gap-1">
                    <MapPin className="h-3 w-3 mt-0.5 text-red-600" />
                    <span>{allocateDialog.dropoff_location}</span>
                  </div>
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium mb-2 block">Select Vehicle</label>
                <Select value={selectedVehicle} onValueChange={setSelectedVehicle}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a vehicle..." />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(vehiclesByType).map(([typeName, typeVehicles]) => (
                      <div key={typeName}>
                        <div className="px-2 py-1 text-xs font-semibold text-gray-500 bg-gray-100">
                          {typeName}
                        </div>
                        {typeVehicles.map(v => (
                          <SelectItem key={v.id} value={v.id}>
                            {v.registration} - {v.make} {v.model}
                          </SelectItem>
                        ))}
                      </div>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setAllocateDialog(null)}>
              Cancel
            </Button>
            <Button onClick={handleAllocate} disabled={!selectedVehicle}>
              Allocate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Booking Dialog */}
      <Dialog open={!!viewBooking} onOpenChange={() => setViewBooking(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Booking Details
            </DialogTitle>
          </DialogHeader>
          
          {viewBooking && (
            <div className="space-y-4">
              {/* Booking ID and Status */}
              <div className="flex items-center justify-between">
                <Badge variant="outline" className="text-lg px-3 py-1 bg-blue-50 text-blue-700 border-blue-300">
                  {viewBooking.booking_id}
                </Badge>
                <Badge className={viewBooking.vehicle_id ? 'bg-green-500' : 'bg-amber-500'}>
                  {viewBooking.vehicle_id ? 'Assigned' : 'Unassigned'}
                </Badge>
              </div>
              
              {/* Customer Details */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <h4 className="font-semibold text-sm text-gray-700 flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Customer Details
                </h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-500">Name:</span>
                    <p className="font-medium">{viewBooking.first_name} {viewBooking.last_name}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Passengers:</span>
                    <p className="font-medium">{viewBooking.passengers || 1}</p>
                  </div>
                  {viewBooking.phone && (
                    <div className="flex items-center gap-1">
                      <Phone className="h-3 w-3 text-gray-400" />
                      <span>{viewBooking.phone}</span>
                    </div>
                  )}
                  {viewBooking.email && (
                    <div className="flex items-center gap-1">
                      <Mail className="h-3 w-3 text-gray-400" />
                      <span className="truncate">{viewBooking.email}</span>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Journey Details */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <h4 className="font-semibold text-sm text-gray-700 flex items-center gap-2">
                  <Navigation className="h-4 w-4" />
                  Journey Details
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-blue-500" />
                    <span className="font-medium">
                      {viewBooking.booking_datetime && format(parseISO(viewBooking.booking_datetime), "dd MMM yyyy 'at' HH:mm")}
                    </span>
                    {viewBooking.duration_minutes && (
                      <span className="text-gray-500">({viewBooking.duration_minutes} mins)</span>
                    )}
                  </div>
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-green-500 mt-0.5" />
                    <div>
                      <span className="text-gray-500 text-xs">Pickup</span>
                      <p className="font-medium">{viewBooking.pickup_location}</p>
                    </div>
                  </div>
                  {viewBooking.additional_stops?.length > 0 && (
                    <div className="ml-6 pl-2 border-l-2 border-dashed border-gray-300">
                      {viewBooking.additional_stops.map((stop, i) => (
                        <div key={i} className="text-gray-600 py-1">
                          <span className="text-xs text-gray-400">Stop {i + 1}:</span> {stop}
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-red-500 mt-0.5" />
                    <div>
                      <span className="text-gray-500 text-xs">Dropoff</span>
                      <p className="font-medium">{viewBooking.dropoff_location}</p>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Vehicle & Fare */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-lg p-3">
                  <span className="text-xs text-gray-500">Vehicle Type</span>
                  <p className="font-medium flex items-center gap-1">
                    <Car className="h-4 w-4 text-gray-400" />
                    {vehicleTypes.find(vt => vt.id === viewBooking.vehicle_type)?.name || 'Not specified'}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <span className="text-xs text-gray-500">Fare</span>
                  <p className="font-medium text-lg text-green-600">
                    £{viewBooking.quoted_fare?.toFixed(2) || viewBooking.fare?.toFixed(2) || '0.00'}
                  </p>
                </div>
              </div>
              
              {/* Assigned Vehicle */}
              {viewBooking.vehicle_id && (
                <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                  <span className="text-xs text-blue-600">Assigned Vehicle</span>
                  <p className="font-medium">
                    {vehicles.find(v => v.id === viewBooking.vehicle_id)?.registration || viewBooking.vehicle_id}
                  </p>
                </div>
              )}
              
              {/* Notes */}
              {viewBooking.notes && (
                <div className="bg-yellow-50 rounded-lg p-3 border border-yellow-200">
                  <span className="text-xs text-yellow-700">Notes</span>
                  <p className="text-sm mt-1">{viewBooking.notes}</p>
                </div>
              )}
            </div>
          )}
          
          <DialogFooter className="flex gap-2">
            {viewBooking && !viewBooking.vehicle_id && (
              <Button 
                variant="outline" 
                onClick={() => {
                  setAllocateDialog(viewBooking);
                  setViewBooking(null);
                }}
              >
                <Link2 className="h-4 w-4 mr-2" />
                Allocate Vehicle
              </Button>
            )}
            <Button onClick={() => setViewBooking(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FleetSchedule;
