import { useState, useEffect, useMemo } from "react";
import axios from "axios";
import { format, addDays, startOfDay, parseISO, isSameDay } from "date-fns";
import { toast } from "sonner";
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
import { CalendarIcon, ChevronLeft, ChevronRight, MapPin, Clock, Car, Link2 } from "lucide-react";
import { cn } from "@/lib/utils";

const API = process.env.REACT_APP_BACKEND_URL;

// Generate hours for timeline
const HOURS = Array.from({ length: 24 }, (_, i) => i);

const FleetSchedule = () => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [vehicles, setVehicles] = useState([]);
  const [vehicleTypes, setVehicleTypes] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [unassignedBookings, setUnassignedBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [allocateDialog, setAllocateDialog] = useState(null);
  const [selectedVehicle, setSelectedVehicle] = useState("");

  useEffect(() => {
    fetchData();
  }, [selectedDate]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [vehiclesRes, vehicleTypesRes, bookingsRes] = await Promise.all([
        axios.get(`${API}/api/vehicles`),
        axios.get(`${API}/api/vehicle-types`),
        axios.get(`${API}/api/bookings`),
      ]);

      setVehicles(vehiclesRes.data || []);
      setVehicleTypes(vehicleTypesRes.data || []);
      
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

  // Calculate booking position and width on timeline
  const getBookingStyle = (booking) => {
    if (!booking.booking_datetime) return null;
    
    const bookingTime = parseISO(booking.booking_datetime);
    const hours = bookingTime.getHours();
    const minutes = bookingTime.getMinutes();
    const startPercent = ((hours * 60 + minutes) / (24 * 60)) * 100;
    
    // Duration in minutes (default 60 if not specified)
    const duration = booking.duration_minutes || 60;
    const widthPercent = (duration / (24 * 60)) * 100;
    
    return {
      left: `${startPercent}%`,
      width: `${Math.max(widthPercent, 2)}%`, // Minimum 2% width for visibility
    };
  };

  // Format time from datetime
  const formatTime = (datetime) => {
    if (!datetime) return '';
    return format(parseISO(datetime), 'HH:mm');
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

  // Navigate days
  const goToPreviousDay = () => setSelectedDate(prev => addDays(prev, -1));
  const goToNextDay = () => setSelectedDate(prev => addDays(prev, 1));
  const goToToday = () => setSelectedDate(new Date());

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
        
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-500 rounded"></div>
            <span>Assigned</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-amber-500 rounded"></div>
            <span>Unassigned ({unassignedBookings.length})</span>
          </div>
        </div>
      </div>

      {/* Unassigned Bookings */}
      {unassignedBookings.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <h3 className="font-semibold text-amber-800 mb-3 flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Unassigned Bookings for {format(selectedDate, "dd MMM")}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {unassignedBookings.map(booking => {
              const vehicleType = vehicleTypes.find(vt => vt.id === booking.vehicle_type);
              return (
                <div 
                  key={booking.id}
                  className="bg-white border border-amber-300 rounded-lg p-3 shadow-sm"
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
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full mt-2 text-xs"
                    onClick={() => setAllocateDialog(booking)}
                  >
                    <Link2 className="h-3 w-3 mr-1" />
                    Allocate to Vehicle
                  </Button>
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
                          title={`${booking.booking_id}: ${booking.pickup_location} → ${booking.dropoff_location}`}
                        >
                          <div className="p-1 text-white text-xs h-full flex flex-col justify-center">
                            <div className="font-semibold truncate">{booking.booking_id}</div>
                            <div className="truncate opacity-80">
                              {formatTime(booking.booking_datetime)}{endTime && ` - ${endTime}`}
                            </div>
                          </div>
                          
                          {/* Tooltip on hover */}
                          <div className="absolute left-0 top-full mt-1 bg-gray-900 text-white text-xs rounded p-2 z-50 w-48 hidden group-hover:block shadow-lg">
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
                          const vehicleType = vehicleTypes.find(vt => vt.id === vehicle.vehicle_type);
                          const matchingBookings = unassignedBookings.filter(b => 
                            b.vehicle_type === vehicle.vehicle_type || !b.vehicle_type
                          );
                          if (matchingBookings.length > 0) {
                            setAllocateDialog({ ...matchingBookings[0], targetVehicle: vehicle });
                            setSelectedVehicle(vehicle.id);
                          }
                        }}
                      >
                        {unassignedBookings.some(b => b.vehicle_type === vehicle.vehicle_type || !b.vehicle_type) 
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
    </div>
  );
};

export default FleetSchedule;
