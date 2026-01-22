import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { useTheme } from '../context/ThemeContext';
import { getVehicles } from '../services/api';

export default function VehicleSettingsScreen({ navigation }) {
  const { theme } = useTheme();
  const [vehicles, setVehicles] = useState([]);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadVehicles();
    loadSelectedVehicle();
  }, []);

  const loadVehicles = async () => {
    try {
      const data = await getVehicles();
      setVehicles(data || []);
    } catch (error) {
      console.error('Error loading vehicles:', error);
      Alert.alert('Error', 'Failed to load vehicles');
    } finally {
      setLoading(false);
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

  const selectVehicle = async (vehicle) => {
    try {
      await SecureStore.setItemAsync('selected_vehicle', JSON.stringify(vehicle));
      setSelectedVehicle(vehicle);
      Alert.alert('Vehicle Selected', `You have selected ${vehicle.registration || vehicle.name}`);
    } catch (error) {
      Alert.alert('Error', 'Failed to save vehicle selection');
    }
  };

  const VehicleCard = ({ vehicle }) => {
    const isSelected = selectedVehicle?.id === vehicle.id;
    
    return (
      <TouchableOpacity
        style={[
          styles.vehicleCard,
          { backgroundColor: theme.card, borderColor: isSelected ? theme.primary : theme.border },
          isSelected && { borderWidth: 2 }
        ]}
        onPress={() => selectVehicle(vehicle)}
      >
        <View style={[styles.vehicleIcon, { backgroundColor: theme.primary + '15' }]}>
          <Ionicons name="car-outline" size={28} color={theme.primary} />
        </View>
        <View style={styles.vehicleInfo}>
          <Text style={[styles.vehicleReg, { color: theme.text }]}>
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
        </View>
        {isSelected && (
          <View style={[styles.selectedBadge, { backgroundColor: theme.primary }]}>
            <Ionicons name="checkmark" size={16} color="#fff" />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Loading vehicles...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Info Banner */}
        <View style={[styles.infoBanner, { backgroundColor: theme.warning + '20' }]}>
          <Ionicons name="warning-outline" size={24} color={theme.warning} />
          <Text style={[styles.infoBannerText, { color: theme.text }]}>
            You must select a vehicle before starting your shift!
          </Text>
        </View>

        {/* Current Selection */}
        {selectedVehicle && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>CURRENT VEHICLE</Text>
            <View style={[styles.currentVehicle, { backgroundColor: theme.success + '15', borderColor: theme.success }]}>
              <Ionicons name="checkmark-circle" size={24} color={theme.success} />
              <View style={styles.currentVehicleInfo}>
                <Text style={[styles.currentVehicleReg, { color: theme.text }]}>
                  {selectedVehicle.registration || selectedVehicle.name}
                </Text>
                <Text style={[styles.currentVehicleType, { color: theme.textSecondary }]}>
                  {selectedVehicle.vehicle_type_name || selectedVehicle.type}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Available Vehicles */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
            AVAILABLE VEHICLES ({vehicles.length})
          </Text>
          {vehicles.length > 0 ? (
            vehicles.map((vehicle) => (
              <VehicleCard key={vehicle.id} vehicle={vehicle} />
            ))
          ) : (
            <View style={[styles.emptyState, { backgroundColor: theme.card }]}>
              <Ionicons name="car-outline" size={48} color={theme.textSecondary} />
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                No vehicles available
              </Text>
              <Text style={[styles.emptySubtext, { color: theme.textSecondary }]}>
                Contact dispatch to add vehicles
              </Text>
            </View>
          )}
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
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
    fontSize: 14,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  infoBannerText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
  section: {
    padding: 16,
    paddingTop: 0,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: 12,
    marginLeft: 4,
  },
  currentVehicle: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  currentVehicleInfo: {
    flex: 1,
  },
  currentVehicleReg: {
    fontSize: 16,
    fontWeight: '600',
  },
  currentVehicleType: {
    fontSize: 13,
    marginTop: 2,
  },
  vehicleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  vehicleIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  vehicleInfo: {
    flex: 1,
  },
  vehicleReg: {
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
  selectedBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    padding: 40,
    borderRadius: 16,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '500',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 13,
    marginTop: 4,
  },
});
