import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Platform,
  Linking,
  Alert,
  ActivityIndicator,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../config';

const { width, height } = Dimensions.get('window');

export default function NavigationScreen({ route, navigation }) {
  const { booking, destination, destinationType } = route.params;
  const mapRef = useRef(null);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [routeCoordinates, setRouteCoordinates] = useState([]);
  const [distance, setDistance] = useState(null);
  const [duration, setDuration] = useState(null);
  const [loading, setLoading] = useState(true);
  const [heading, setHeading] = useState(0);

  const destinationAddress = destinationType === 'pickup' 
    ? booking.pickup_location 
    : booking.dropoff_location;

  useEffect(() => {
    let locationSubscription;

    const startNavigation = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Denied', 'Location permission is required for navigation');
          navigation.goBack();
          return;
        }

        // Get initial location
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        
        setCurrentLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });

        // Geocode destination
        const geocoded = await Location.geocodeAsync(destinationAddress);
        if (geocoded.length > 0) {
          const dest = {
            latitude: geocoded[0].latitude,
            longitude: geocoded[0].longitude,
          };

          // Get route from Google Directions API
          await fetchRoute(
            { latitude: location.coords.latitude, longitude: location.coords.longitude },
            dest
          );
        }

        // Start watching location
        locationSubscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.BestForNavigation,
            timeInterval: 2000,
            distanceInterval: 5,
          },
          (newLocation) => {
            setCurrentLocation({
              latitude: newLocation.coords.latitude,
              longitude: newLocation.coords.longitude,
            });
            setHeading(newLocation.coords.heading || 0);
          }
        );

        setLoading(false);
      } catch (error) {
        console.error('Navigation error:', error);
        setLoading(false);
        Alert.alert('Error', 'Failed to start navigation');
      }
    };

    startNavigation();

    return () => {
      if (locationSubscription) {
        locationSubscription.remove();
      }
    };
  }, []);

  const fetchRoute = async (origin, destination) => {
    try {
      // Using Google Directions API (you'd need to proxy this through your backend)
      const response = await fetch(
        `https://cj-travel-app.preview.emergentagent.com/api/directions?origin=${origin.latitude},${origin.longitude}&destination=${destination.latitude},${destination.longitude}`
      );
      const data = await response.json();

      if (data.success && data.polyline) {
        // Decode polyline
        const coords = decodePolyline(data.polyline);
        setRouteCoordinates(coords);
        setDistance(data.distance?.text);
        setDuration(data.duration?.text);
      }
    } catch (error) {
      console.error('Error fetching route:', error);
    }
  };

  // Decode Google polyline
  const decodePolyline = (encoded) => {
    const points = [];
    let index = 0, len = encoded.length;
    let lat = 0, lng = 0;

    while (index < len) {
      let b, shift = 0, result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
      lat += dlat;

      shift = 0;
      result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
      lng += dlng;

      points.push({
        latitude: lat / 1e5,
        longitude: lng / 1e5,
      });
    }
    return points;
  };

  const openExternalMaps = () => {
    const url = Platform.select({
      ios: `maps://app?daddr=${encodeURIComponent(destinationAddress)}`,
      android: `google.navigation:q=${encodeURIComponent(destinationAddress)}`,
    });
    
    Linking.canOpenURL(url).then((supported) => {
      if (supported) {
        Linking.openURL(url);
      } else {
        Linking.openURL(
          `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destinationAddress)}`
        );
      }
    });
  };

  const centerOnUser = () => {
    if (currentLocation && mapRef.current) {
      mapRef.current.animateToRegion({
        ...currentLocation,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Starting navigation...</Text>
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
        initialRegion={
          currentLocation
            ? {
                ...currentLocation,
                latitudeDelta: 0.05,
                longitudeDelta: 0.05,
              }
            : undefined
        }
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass
        followsUserLocation
      >
        {/* Route polyline */}
        {routeCoordinates.length > 0 && (
          <Polyline
            coordinates={routeCoordinates}
            strokeWidth={5}
            strokeColor={COLORS.primary}
          />
        )}

        {/* Destination marker */}
        {routeCoordinates.length > 0 && (
          <Marker
            coordinate={routeCoordinates[routeCoordinates.length - 1]}
            title={destinationType === 'pickup' ? 'Pickup' : 'Drop-off'}
          >
            <View style={[styles.markerContainer, { backgroundColor: destinationType === 'pickup' ? COLORS.success : COLORS.danger }]}>
              <Ionicons name="location" size={20} color="#fff" />
            </View>
          </Marker>
        )}
      </MapView>

      {/* Navigation Info Panel */}
      <View style={styles.infoPanel}>
        <View style={styles.etaContainer}>
          <View style={styles.etaItem}>
            <Text style={styles.etaValue}>{duration || '--'}</Text>
            <Text style={styles.etaLabel}>ETA</Text>
          </View>
          <View style={styles.etaDivider} />
          <View style={styles.etaItem}>
            <Text style={styles.etaValue}>{distance || '--'}</Text>
            <Text style={styles.etaLabel}>Distance</Text>
          </View>
        </View>

        <View style={styles.destinationContainer}>
          <View style={[styles.destinationDot, { backgroundColor: destinationType === 'pickup' ? COLORS.success : COLORS.danger }]} />
          <View style={styles.destinationInfo}>
            <Text style={styles.destinationType}>
              {destinationType === 'pickup' ? 'Picking up' : 'Dropping off'}
            </Text>
            <Text style={styles.destinationAddress} numberOfLines={2}>
              {destinationAddress}
            </Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.centerButton} onPress={centerOnUser}>
            <Ionicons name="locate" size={24} color={COLORS.primary} />
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.externalMapsButton} onPress={openExternalMaps}>
            <Ionicons name="navigate" size={20} color="#fff" />
            <Text style={styles.externalMapsText}>Open in Maps</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.closeButton} onPress={() => navigation.goBack()}>
            <Ionicons name="close" size={24} color={COLORS.danger} />
          </TouchableOpacity>
        </View>
      </View>
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
  markerContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  infoPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 10,
  },
  etaContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  etaItem: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  etaValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  etaLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  etaDivider: {
    width: 1,
    height: 40,
    backgroundColor: COLORS.border,
  },
  destinationContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.background,
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  destinationDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 4,
    marginRight: 12,
  },
  destinationInfo: {
    flex: 1,
  },
  destinationType: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    fontWeight: '600',
    marginBottom: 4,
  },
  destinationAddress: {
    fontSize: 15,
    color: COLORS.text,
    lineHeight: 20,
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  centerButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  externalMapsButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  externalMapsText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  closeButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.danger + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
