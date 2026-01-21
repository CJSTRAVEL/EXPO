import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { updateLocation } from './api';

const LOCATION_TASK_NAME = 'CJS_DRIVER_LOCATION_TASK';

// Define the background location task
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error('Background location error:', error);
    return;
  }
  
  if (data) {
    const { locations } = data;
    if (locations && locations.length > 0) {
      const location = locations[0];
      try {
        await updateLocation(
          location.coords.latitude,
          location.coords.longitude
        );
        console.log('Background location updated:', location.coords);
      } catch (err) {
        console.error('Error updating background location:', err);
      }
    }
  }
});

export const requestLocationPermissions = async () => {
  try {
    // Request foreground permission
    const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
    if (foregroundStatus !== 'granted') {
      return { granted: false, error: 'Foreground location permission denied' };
    }

    // Request background permission
    const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
    if (backgroundStatus !== 'granted') {
      console.log('Background location permission denied, foreground only');
      return { granted: true, background: false };
    }

    return { granted: true, background: true };
  } catch (error) {
    console.error('Error requesting location permissions:', error);
    return { granted: false, error: error.message };
  }
};

export const startBackgroundLocationTracking = async () => {
  try {
    const hasStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
    if (hasStarted) {
      console.log('Background location already running');
      return true;
    }

    await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
      accuracy: Location.Accuracy.High,
      timeInterval: 30000, // 30 seconds
      distanceInterval: 50, // 50 meters
      foregroundService: {
        notificationTitle: "CJ's Driver",
        notificationBody: 'Tracking your location for dispatch',
        notificationColor: '#1a3a5c',
      },
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
    });

    console.log('Background location tracking started');
    return true;
  } catch (error) {
    console.error('Error starting background location:', error);
    return false;
  }
};

export const stopBackgroundLocationTracking = async () => {
  try {
    const hasStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
    if (hasStarted) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
      console.log('Background location tracking stopped');
    }
    return true;
  } catch (error) {
    console.error('Error stopping background location:', error);
    return false;
  }
};

export const getCurrentLocation = async () => {
  try {
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });
    return {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      accuracy: location.coords.accuracy,
      heading: location.coords.heading,
      speed: location.coords.speed,
    };
  } catch (error) {
    console.error('Error getting current location:', error);
    return null;
  }
};

export const watchLocation = async (callback, options = {}) => {
  const defaultOptions = {
    accuracy: Location.Accuracy.High,
    timeInterval: 5000,
    distanceInterval: 10,
    ...options,
  };

  try {
    const subscription = await Location.watchPositionAsync(
      defaultOptions,
      (location) => {
        callback({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          accuracy: location.coords.accuracy,
          heading: location.coords.heading,
          speed: location.coords.speed,
          timestamp: location.timestamp,
        });
      }
    );
    return subscription;
  } catch (error) {
    console.error('Error watching location:', error);
    return null;
  }
};

// Calculate distance between two coordinates (Haversine formula)
export const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 3959; // Earth's radius in miles
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const toRad = (value) => (value * Math.PI) / 180;

// Estimate arrival time based on distance and average speed
export const estimateArrival = (distanceMiles, avgSpeedMph = 25) => {
  const timeHours = distanceMiles / avgSpeedMph;
  const timeMinutes = Math.round(timeHours * 60);
  
  const arrivalTime = new Date();
  arrivalTime.setMinutes(arrivalTime.getMinutes() + timeMinutes);
  
  return {
    minutes: timeMinutes,
    arrivalTime,
    formattedTime: arrivalTime.toLocaleTimeString('en-GB', { 
      hour: '2-digit', 
      minute: '2-digit' 
    }),
  };
};
