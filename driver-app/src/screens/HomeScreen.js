import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  Platform,
  Modal,
  ScrollView,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';
import * as Notifications from 'expo-notifications';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { updateStatus, updateLocation, getAvailableVehicles, selectVehicle, releaseVehicle, getDocumentNotifications, getBookings } from '../services/api';

// Online notification identifier
const ONLINE_NOTIFICATION_ID = 'driver-online-status';

// Show persistent online notification
const showOnlineNotification = async () => {
  try {
    // First dismiss any existing notification
    await Notifications.dismissNotificationAsync(ONLINE_NOTIFICATION_ID);
    
    // Schedule a persistent notification
    await Notifications.scheduleNotificationAsync({
      identifier: ONLINE_NOTIFICATION_ID,
      content: {
        title: "🟢 You're Online",
        body: "CJ's Travel - Online",
        data: { type: 'online_status' },
        sticky: true,
        autoDismiss: false,
      },
      trigger: null, // Show immediately
    });
  } catch (error) {
    console.log('Error showing online notification:', error);
  }
};

// Remove online notification
const hideOnlineNotification = async () => {
  try {
    await Notifications.dismissNotificationAsync(ONLINE_NOTIFICATION_ID);
  } catch (error) {
    console.log('Error hiding online notification:', error);
  }
};

// Custom vehicle marker component - Simple car icon
// Top-down vehicle image marker
const VehicleMarker = ({ heading = 0 }) => (
  <View style={[styles.vehicleMarkerContainer, { transform: [{ rotate: `${heading}deg` }] }]}>
    <Image 
      source={require('../../assets/car-top-view.png')} 
      style={styles.vehicleMarkerImage}
      resizeMode="contain"
    />
  </View>
);

export default function HomeScreen({ navigation }) {
  const { user, refreshProfile } = useAuth();
  const { theme } = useTheme();
  const [location, setLocation] = useState(null);
  const [heading, setHeading] = useState(0);
  const [isShiftActive, setIsShiftActive] = useState(user?.is_online || false);
  const [loading, setLoading] = useState(true);
  const [startingShift, setStartingShift] = useState(false);
  const [shiftStartTime, setShiftStartTime] = useState(null);
  const [shiftDuration, setShiftDuration] = useState(0);
  const [showVehicleModal, setShowVehicleModal] = useState(false);
  const [vehicles, setVehicles] = useState([]);
  const [loadingVehicles, setLoadingVehicles] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [activeBooking, setActiveBooking] = useState(null);
  const [isMapCentered, setIsMapCentered] = useState(true);
  const mapRef = useRef(null);
  const locationSubscription = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    initializeLocation();
    loadShiftState();
    loadSelectedVehicle();
    // Check document expiry notifications on app load
    checkDocumentNotifications();
    // Check for active bookings
    checkActiveBookings();
    return () => {
      if (locationSubscription.current) {
        locationSubscription.current.remove();
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  // Check for active bookings when screen is focused
  useFocusEffect(
    useCallback(() => {
      checkActiveBookings();
    }, [])
  );

  useEffect(() => {
    setIsShiftActive(user?.is_online || false);
    // Show/hide notification based on online status
    if (user?.is_online) {
      showOnlineNotification();
    } else {
      hideOnlineNotification();
    }
  }, [user]);

  // Shift timer effect
  useEffect(() => {
    if (isShiftActive && shiftStartTime) {
      timerRef.current = setInterval(() => {
        const now = Date.now();
        const elapsed = Math.floor((now - shiftStartTime) / 1000);
        setShiftDuration(elapsed);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      setShiftDuration(0);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isShiftActive, shiftStartTime]);

  // Check for active bookings (on_way, arrived, in_progress)
  const checkActiveBookings = async () => {
    try {
      const data = await getBookings();
      const allBookings = [...(data.today || []), ...(data.upcoming || [])];
      const active = allBookings.find(b => 
        ['on_way', 'arrived', 'in_progress'].includes(b.status)
      );
      setActiveBooking(active || null);
    } catch (error) {
      console.log('Error checking active bookings:', error);
    }
  };

  const loadShiftState = async () => {
    try {
      const savedStartTime = await SecureStore.getItemAsync('shift_start_time');
      if (savedStartTime && user?.is_online) {
        setShiftStartTime(parseInt(savedStartTime));
      }
    } catch (error) {
      console.log('Error loading shift state:', error);
    }
  };

  const loadSelectedVehicle = async () => {
    try {
      const saved = await SecureStore.getItemAsync('selected_vehicle');
      if (saved) {
        setSelectedVehicle(JSON.parse(saved));
      }
    } catch (error) {
      console.log('Error loading selected vehicle:', error);
    }
  };

  const loadVehicles = async () => {
    setLoadingVehicles(true);
    try {
      // Use the new available-vehicles endpoint that includes exclusivity status
      const data = await getAvailableVehicles();
      
      // Filter vehicles based on driver's license type
      // license_type can be: "taxi", "psv", "both", or null
      const driverLicenseType = user?.license_type;
      
      let filteredVehicles = data || [];
      if (driverLicenseType && driverLicenseType !== 'both') {
        filteredVehicles = (data || []).filter(vehicle => {
          const vehicleCategory = vehicle.vehicle_type?.category;
          // If vehicle has no category or is "both", show it
          if (!vehicleCategory || vehicleCategory === 'both') return true;
          // Otherwise, match driver license type to vehicle category
          return vehicleCategory === driverLicenseType;
        });
      }
      
      setVehicles(filteredVehicles);
    } catch (error) {
      console.error('Error loading vehicles:', error);
      Alert.alert('Error', 'Failed to load vehicles. Please try again.');
    } finally {
      setLoadingVehicles(false);
    }
  };

  const handleSelectVehicle = async (vehicle) => {
    // Check if vehicle is available
    if (!vehicle.is_available) {
      Alert.alert(
        'Vehicle Unavailable', 
        `This vehicle is currently in use by ${vehicle.in_use_by || 'another driver'}.`
      );
      return;
    }

    try {
      // Call backend to select vehicle (enforces exclusivity)
      await selectVehicle(vehicle.id);
      
      // Save locally
      await SecureStore.setItemAsync('selected_vehicle', JSON.stringify(vehicle));
      setSelectedVehicle(vehicle);
      setShowVehicleModal(false);
      
      // Now start the shift after vehicle selection
      startShiftAfterVehicleSelection();
    } catch (error) {
      const errorMessage = error.response?.data?.detail || 'Failed to select vehicle. It may be in use.';
      Alert.alert('Error', errorMessage);
      // Refresh vehicle list to get updated availability
      loadVehicles();
    }
  };

  const clearSelectedVehicle = async () => {
    try {
      // Call backend to release vehicle
      await releaseVehicle();
      // Clear local storage
      await SecureStore.deleteItemAsync('selected_vehicle');
      setSelectedVehicle(null);
    } catch (error) {
      console.log('Error clearing selected vehicle:', error);
      // Still clear locally even if API fails
      await SecureStore.deleteItemAsync('selected_vehicle');
      setSelectedVehicle(null);
    }
  };

  // Check for document expiry notifications
  const checkDocumentNotifications = async () => {
    try {
      const { notifications } = await getDocumentNotifications();
      
      if (notifications && notifications.length > 0) {
        // Schedule local notifications for expiring documents
        for (const notif of notifications) {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: notif.title,
              body: notif.body,
              data: { type: 'document_expiry', document: notif.document },
            },
            trigger: null, // Show immediately
          });
        }
      }
    } catch (error) {
      console.log('Error checking document notifications:', error);
    }
  };

  const formatDuration = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const initializeLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required to use this app.');
        setLoading(false);
        return;
      }

      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      setLocation({
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
      });
      setHeading(currentLocation.coords.heading || 0);
      setLoading(false);

      startLocationTracking();
    } catch (error) {
      console.error('Error getting location:', error);
      setLoading(false);
      Alert.alert('Error', 'Could not get your location. Please check your GPS settings.');
    }
  };

  const startLocationTracking = async () => {
    locationSubscription.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 5000,
        distanceInterval: 10,
      },
      (newLocation) => {
        const { latitude, longitude, heading: newHeading } = newLocation.coords;
        setLocation({ latitude, longitude });
        if (newHeading) setHeading(newHeading);

        if (isShiftActive) {
          updateLocation(latitude, longitude).catch(console.error);
        }

        // Only auto-animate if map is centered
        if (isMapCentered && mapRef.current) {
          mapRef.current.animateToRegion({
            latitude,
            longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }, 500);
        }
      }
    );
  };

  // Recenter map to driver's current location
  const handleRecenterMap = () => {
    if (location && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: location.latitude,
        longitude: location.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }, 500);
      setIsMapCentered(true);
    }
  };

  // Handle map region change to detect if user panned away
  const handleRegionChange = () => {
    setIsMapCentered(false);
  };

  const handleStartShift = async () => {
    // If shift is active, we're stopping - end the shift
    if (isShiftActive) {
      // Check if there's an active booking in progress
      if (activeBooking && ['assigned', 'on_way', 'arrived', 'in_progress'].includes(activeBooking.status)) {
        Alert.alert(
          'Booking In Progress',
          'You cannot end your shift while you have an active booking. Please complete or cancel the current booking first.',
          [{ text: 'OK' }]
        );
        return;
      }
      await stopShift();
    } else {
      // Starting shift - show vehicle selection popup
      loadVehicles();
      setShowVehicleModal(true);
    }
  };

  const startShiftAfterVehicleSelection = async () => {
    setStartingShift(true);
    try {
      const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
      if (bgStatus !== 'granted') {
        Alert.alert(
          'Background Location',
          'For best experience, please enable background location access.',
          [{ text: 'OK' }]
        );
      }

      await updateStatus({ is_online: true });
      setIsShiftActive(true);
      
      // Show persistent online notification
      await showOnlineNotification();
      
      // Starting shift - save start time
      const startTime = Date.now();
      setShiftStartTime(startTime);
      await SecureStore.setItemAsync('shift_start_time', startTime.toString());
      Alert.alert('Shift Started', `You are now online and available for bookings.\n\nVehicle: ${selectedVehicle?.registration || 'Selected'}`);
      
      await refreshProfile();
    } catch (error) {
      console.error('Error starting shift:', error);
      Alert.alert('Error', 'Could not start your shift. Please try again.');
    } finally {
      setStartingShift(false);
    }
  };

  const stopShift = async () => {
    console.log('stopShift called');
    setStartingShift(true);
    try {
      console.log('Updating status to offline...');
      const response = await updateStatus({ is_online: false });
      console.log('Status update response:', response);
      
      setIsShiftActive(false);
      
      // Hide persistent online notification
      await hideOnlineNotification();
      
      // Ending shift - clear start time and vehicle
      const finalDuration = shiftDuration;
      setShiftStartTime(null);
      setShiftDuration(0);
      await SecureStore.deleteItemAsync('shift_start_time');
      
      // Clear selected vehicle
      await clearSelectedVehicle();
      
      Alert.alert('Shift Ended', `You are now offline.\nShift duration: ${formatDuration(finalDuration)}\n\nVehicle has been reset. Please select a vehicle when starting your next shift.`);
      
      await refreshProfile();
      console.log('Shift ended successfully');
    } catch (error) {
      console.error('Error stopping shift:', error);
      console.error('Error details:', error.response?.data || error.message);
      Alert.alert('Error', `Could not end your shift: ${error.response?.data?.detail || error.message}`);
      // Still try to reset local state
      setIsShiftActive(false);
    } finally {
      setStartingShift(false);
    }
  };

  const openMenu = () => {
    navigation.navigate('Menu');
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Getting your location...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Map */}
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={{
          latitude: location?.latitude || 54.7294,
          longitude: location?.longitude || -1.2639,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
        showsUserLocation={false}
        showsMyLocationButton={false}
        showsCompass={false}
        rotateEnabled={true}
        pitchEnabled={true}
        onPanDrag={handleRegionChange}
      >
        {location && (
          <Marker
            coordinate={location}
            anchor={{ x: 0.5, y: 0.5 }}
            flat={true}
            tracksViewChanges={true}
            style={{ zIndex: 999 }}
          >
            <VehicleMarker heading={heading} />
          </Marker>
        )}
      </MapView>

      {/* Top Right Logo/Menu Button */}
      <TouchableOpacity style={styles.menuButtonRight} onPress={openMenu}>
        <Image
          source={require('../../assets/logo.png')}
          style={styles.logoSmall}
          resizeMode="contain"
        />
      </TouchableOpacity>

      {/* Recenter Button - Show only when map is not centered */}
      {!isMapCentered && (
        <TouchableOpacity 
          style={[styles.recenterButton, { backgroundColor: '#fff' }]} 
          onPress={handleRecenterMap}
        >
          <Ionicons name="locate" size={24} color={theme.primary} />
        </TouchableOpacity>
      )}

      {/* Shift Timer (when active) */}
      {isShiftActive && (
        <View style={[styles.timerContainer, { backgroundColor: theme.card }]}>
          <View style={[styles.timerDot, { backgroundColor: theme.success }]} />
          <Text style={[styles.timerLabel, { color: theme.textSecondary }]}>Shift Time</Text>
          <Text style={[styles.timerValue, { color: theme.text }]}>{formatDuration(shiftDuration)}</Text>
        </View>
      )}

      {/* Start/Stop Shift Button */}
      <View style={[styles.startButtonContainer, activeBooking && { bottom: 90 }]}>
        <TouchableOpacity
          style={[
            styles.startButton,
            { backgroundColor: isShiftActive ? theme.danger : theme.primary },
          ]}
          onPress={handleStartShift}
          disabled={startingShift}
        >
          {startingShift ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.startButtonText}>
              {isShiftActive ? 'Stop' : 'Start'}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Status Indicator */}
      {isShiftActive && (
        <View style={[styles.statusIndicator, { backgroundColor: 'rgba(255,255,255,0.95)' }]}>
          <View style={[styles.statusDot, { backgroundColor: theme.success }]} />
          <Text style={[styles.statusText, { color: theme.success }]}>Online</Text>
        </View>
      )}

      {/* Journey in Progress Bar - Above footer when there's an active booking */}
      {activeBooking && (
        <TouchableOpacity 
          style={styles.journeyProgressBar}
          onPress={() => navigation.navigate('Jobs')}
          activeOpacity={0.9}
        >
          <View style={styles.journeyProgressContent}>
            <View style={styles.journeyPulse} />
            <Ionicons name="car" size={20} color="#fff" />
            <View style={styles.journeyTextContainer}>
              <Text style={styles.journeyTitle}>Journey in Progress</Text>
              <Text style={styles.journeySubtitle} numberOfLines={1}>
                {activeBooking.first_name || 'Passenger'} • {activeBooking.dropoff_location?.substring(0, 25)}...
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#fff" />
          </View>
        </TouchableOpacity>
      )}

      {/* Vehicle Selection Modal */}
      <Modal
        visible={showVehicleModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowVehicleModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.background }]}>
            {/* Modal Header */}
            <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Select Vehicle</Text>
              <TouchableOpacity 
                style={styles.modalCloseButton}
                onPress={() => setShowVehicleModal(false)}
              >
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>

            {/* Info Banner */}
            <View style={[styles.vehicleInfoBanner, { backgroundColor: theme.primary + '15' }]}>
              <Ionicons name="car-sport" size={24} color={theme.primary} />
              <Text style={[styles.vehicleInfoText, { color: theme.text }]}>
                Select the vehicle you will be driving for this shift
              </Text>
            </View>

            {/* Vehicle List */}
            {loadingVehicles ? (
              <View style={styles.vehicleLoadingContainer}>
                <ActivityIndicator size="large" color={theme.primary} />
                <Text style={[styles.vehicleLoadingText, { color: theme.textSecondary }]}>
                  Loading vehicles...
                </Text>
              </View>
            ) : vehicles.length > 0 ? (
              <ScrollView 
                style={styles.vehicleList}
                showsVerticalScrollIndicator={false}
              >
                {vehicles.map((vehicle) => {
                  const isAvailable = vehicle.is_available;
                  const isYours = vehicle.in_use_by === 'you';
                  
                  return (
                    <TouchableOpacity
                      key={vehicle.id}
                      style={[
                        styles.vehicleCard, 
                        { 
                          backgroundColor: theme.card, 
                          borderColor: isYours ? theme.success : (!isAvailable ? theme.danger + '50' : theme.border),
                          opacity: isAvailable ? 1 : 0.6
                        }
                      ]}
                      onPress={() => handleSelectVehicle(vehicle)}
                      disabled={!isAvailable && !isYours}
                    >
                      <View style={[
                        styles.vehicleIconContainer, 
                        { backgroundColor: isYours ? theme.success + '15' : (!isAvailable ? theme.danger + '15' : theme.primary + '15') }
                      ]}>
                        <Ionicons 
                          name={isYours ? 'checkmark-circle' : (!isAvailable ? 'lock-closed' : 'car-outline')} 
                          size={28} 
                          color={isYours ? theme.success : (!isAvailable ? theme.danger : theme.primary)} 
                        />
                      </View>
                      <View style={styles.vehicleDetails}>
                        <Text style={[styles.vehicleRegistration, { color: theme.text }]}>
                          {vehicle.registration || 'No Registration'}
                        </Text>
                        <Text style={[styles.vehicleType, { color: theme.textSecondary }]}>
                          {vehicle.vehicle_type_name || vehicle.type || 'Standard'}
                        </Text>
                        {vehicle.make && vehicle.model && (
                          <Text style={[styles.vehicleModel, { color: theme.textSecondary }]}>
                            {vehicle.make} {vehicle.model}
                          </Text>
                        )}
                        {!isAvailable && !isYours && (
                          <Text style={[styles.vehicleInUse, { color: theme.danger }]}>
                            In use by: {vehicle.in_use_by}
                          </Text>
                        )}
                        {isYours && (
                          <Text style={[styles.vehicleInUse, { color: theme.success }]}>
                            Currently selected by you
                          </Text>
                        )}
                      </View>
                      {isAvailable && !isYours && (
                        <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
                      )}
                      {isYours && (
                        <Ionicons name="checkmark-circle" size={24} color={theme.success} />
                      )}
                      {!isAvailable && !isYours && (
                        <Ionicons name="lock-closed" size={20} color={theme.danger} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            ) : (
              <View style={styles.noVehiclesContainer}>
                <Ionicons name="car-outline" size={48} color={theme.textSecondary} />
                <Text style={[styles.noVehiclesText, { color: theme.textSecondary }]}>
                  No vehicles available
                </Text>
                <Text style={[styles.noVehiclesSubtext, { color: theme.textSecondary }]}>
                  Contact dispatch to add vehicles
                </Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
  map: {
    flex: 1,
  },
  menuButtonRight: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    right: 16,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
    overflow: 'hidden',
    padding: 4,
  },
  logoSmall: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  recenterButton: {
    position: 'absolute',
    bottom: 150,
    right: 16,
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  timerContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    left: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    alignItems: 'center',
  },
  timerDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  timerLabel: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  timerValue: {
    fontSize: 24,
    fontWeight: 'bold',
    fontVariant: ['tabular-nums'],
    marginTop: 2,
  },
  startButtonContainer: {
    position: 'absolute',
    bottom: 30,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  startButton: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  startButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
  },
  statusIndicator: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 125 : 105,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  // Vehicle Marker Styles - Top-down car image
  vehicleMarkerContainer: {
    width: 50,
    height: 70,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vehicleMarkerImage: {
    width: 45,
    height: 65,
  },
  // Journey Progress Bar styles
  journeyProgressBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#dc2626',
    paddingVertical: 14,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 10,
  },
  journeyProgressContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  journeyPulse: {
    position: 'absolute',
    left: -16,
    top: -14,
    bottom: -14,
    width: 4,
    backgroundColor: '#fff',
  },
  journeyTextContainer: {
    flex: 1,
  },
  journeyTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  journeySubtitle: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    marginTop: 2,
  },
  // Vehicle Selection Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    minHeight: '50%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  modalCloseButton: {
    padding: 4,
  },
  vehicleInfoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  vehicleInfoText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
  vehicleLoadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  vehicleLoadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  vehicleList: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  vehicleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  vehicleIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  vehicleDetails: {
    flex: 1,
  },
  vehicleRegistration: {
    fontSize: 16,
    fontWeight: '600',
  },
  vehicleType: {
    fontSize: 13,
    marginTop: 2,
  },
  vehicleModel: {
    fontSize: 12,
    marginTop: 2,
  },
  vehicleInUse: {
    fontSize: 11,
    marginTop: 4,
    fontWeight: '500',
  },
  noVehiclesContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  noVehiclesText: {
    fontSize: 16,
    fontWeight: '500',
    marginTop: 12,
  },
  noVehiclesSubtext: {
    fontSize: 13,
    marginTop: 4,
  },
});
