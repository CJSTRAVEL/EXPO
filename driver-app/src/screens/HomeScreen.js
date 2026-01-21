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
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { COLORS } from '../config';
import { updateStatus, updateLocation } from '../services/api';

// Custom car marker component
const CarMarker = () => (
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
  const [location, setLocation] = useState(null);
  const [heading, setHeading] = useState(0);
  const [isShiftActive, setIsShiftActive] = useState(user?.is_online || false);
  const [loading, setLoading] = useState(true);
  const [startingShift, setStartingShift] = useState(false);
  const mapRef = useRef(null);
  const locationSubscription = useRef(null);

  useEffect(() => {
    initializeLocation();
    return () => {
      if (locationSubscription.current) {
        locationSubscription.current.remove();
      }
    };
  }, []);

  useEffect(() => {
    setIsShiftActive(user?.is_online || false);
  }, [user]);

  const initializeLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required to use this app.');
        setLoading(false);
        return;
      }

      // Get initial location
      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      setLocation({
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
      });
      setHeading(currentLocation.coords.heading || 0);
      setLoading(false);

      // Start watching location
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

        // Update location on server if shift is active
        if (isShiftActive) {
          updateLocation(latitude, longitude).catch(console.error);
        }

        // Animate map to new position
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
    setStartingShift(true);
    try {
      // Request background location permission if not already granted
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
      await refreshProfile();

      if (newStatus) {
        Alert.alert('Shift Started', 'You are now online and available for bookings.');
      } else {
        Alert.alert('Shift Ended', 'You are now offline.');
      }
    } catch (error) {
      console.error('Error updating shift status:', error);
      Alert.alert('Error', 'Could not update your status. Please try again.');
    } finally {
      setStartingShift(false);
    }
  };

  const openLeftMenu = () => {
    navigation.openDrawer?.() || navigation.navigate('Profile');
  };

  const openRightMenu = () => {
    navigation.navigate('Profile');
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Getting your location...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
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
            <CarMarker />
          </Marker>
        )}
      </MapView>

      {/* Top Left Menu Button */}
      <TouchableOpacity style={styles.menuButtonLeft} onPress={openLeftMenu}>
        <Ionicons name="menu" size={24} color={COLORS.text} />
      </TouchableOpacity>

      {/* Top Right Logo/Menu Button */}
      <TouchableOpacity style={styles.menuButtonRight} onPress={openRightMenu}>
        <Image
          source={require('../../assets/logo.png')}
          style={styles.logoSmall}
          resizeMode="contain"
        />
      </TouchableOpacity>

      {/* Start/Stop Shift Button */}
      <View style={styles.startButtonContainer}>
        <TouchableOpacity
          style={[
            styles.startButton,
            isShiftActive && styles.stopButton,
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
        <View style={styles.statusIndicator}>
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>Online</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  map: {
    flex: 1,
  },
  menuButtonLeft: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    left: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  menuButtonRight: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    right: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
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
    width: 40,
    height: 40,
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
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  stopButton: {
    backgroundColor: COLORS.danger,
    shadowColor: COLORS.danger,
  },
  startButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
  },
  statusIndicator: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 115 : 95,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.95)',
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
    backgroundColor: COLORS.success,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.success,
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
