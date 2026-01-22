import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { updateStatus, updateLocation } from '../services/api';

// Custom car marker component
const CarMarker = ({ theme }) => (
  <View style={styles.carMarkerContainer}>
    <Image 
      source={require('../../assets/car-marker.png')} 
      style={styles.carMarker}
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
  const mapRef = useRef(null);
  const locationSubscription = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    initializeLocation();
    loadShiftState();
    return () => {
      if (locationSubscription.current) {
        locationSubscription.current.remove();
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    setIsShiftActive(user?.is_online || false);
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

        if (mapRef.current) {
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

  const handleStartShift = async () => {
    // Check if vehicle is selected before starting shift
    if (!isShiftActive) {
      try {
        const selectedVehicle = await SecureStore.getItemAsync('selected_vehicle');
        if (!selectedVehicle) {
          Alert.alert(
            'Vehicle Required',
            'Please select a vehicle before starting your shift.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Select Vehicle', onPress: () => navigation.navigate('Menu', { screen: 'VehicleSettings' }) }
            ]
          );
          return;
        }
      } catch (error) {
        console.log('Error checking vehicle:', error);
      }
    }

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

      const newStatus = !isShiftActive;
      await updateStatus({ is_online: newStatus });
      setIsShiftActive(newStatus);
      
      if (newStatus) {
        // Starting shift - save start time
        const startTime = Date.now();
        setShiftStartTime(startTime);
        await SecureStore.setItemAsync('shift_start_time', startTime.toString());
        Alert.alert('Shift Started', 'You are now online and available for bookings.');
      } else {
        // Ending shift - clear start time
        setShiftStartTime(null);
        setShiftDuration(0);
        await SecureStore.deleteItemAsync('shift_start_time');
        Alert.alert('Shift Ended', `You are now offline.\nShift duration: ${formatDuration(shiftDuration)}`);
      }
      
      await refreshProfile();
    } catch (error) {
      console.error('Error updating shift status:', error);
      Alert.alert('Error', 'Could not update your status. Please try again.');
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
      >
        {location && (
          <Marker
            coordinate={location}
            anchor={{ x: 0.5, y: 0.5 }}
            flat={true}
            rotation={heading}
          >
            <CarMarker theme={theme} />
          </Marker>
        )}
      </MapView>

      {/* Top Right Logo/Menu Button */}
      <TouchableOpacity style={styles.menuButtonRight} onPress={openMenu}>
        <Image
          source={require('../../assets/logo.png')}
          style={styles.logoSmall}
          resizeMode="cover"
        />
      </TouchableOpacity>

      {/* Shift Timer (when active) */}
      {isShiftActive && (
        <View style={[styles.timerContainer, { backgroundColor: theme.card }]}>
          <View style={[styles.timerDot, { backgroundColor: theme.success }]} />
          <Text style={[styles.timerLabel, { color: theme.textSecondary }]}>Shift Time</Text>
          <Text style={[styles.timerValue, { color: theme.text }]}>{formatDuration(shiftDuration)}</Text>
        </View>
      )}

      {/* Start/Stop Shift Button */}
      <View style={styles.startButtonContainer}>
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
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
    overflow: 'hidden',
  },
  logoSmall: {
    width: 52,
    height: 52,
    borderRadius: 26,
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
  carMarkerContainer: {
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  carMarker: {
    width: 40,
    height: 40,
  },
});
