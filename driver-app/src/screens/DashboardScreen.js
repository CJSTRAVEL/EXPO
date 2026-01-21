import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Switch,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { COLORS } from '../config';
import { getEarnings, updateStatus } from '../services/api';

export default function DashboardScreen({ navigation }) {
  const { user, refreshProfile } = useAuth();
  const [isOnline, setIsOnline] = useState(user?.is_online || false);
  const [onBreak, setOnBreak] = useState(user?.on_break || false);
  const [earnings, setEarnings] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      const earningsData = await getEarnings();
      setEarnings(earningsData);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchData(), refreshProfile()]);
    setRefreshing(false);
  }, []);

  const handleOnlineToggle = async (value) => {
    try {
      setIsOnline(value);
      await updateStatus({ is_online: value });
      if (!value) setOnBreak(false);
    } catch (error) {
      setIsOnline(!value);
      Alert.alert('Error', 'Failed to update status');
    }
  };

  const handleBreakToggle = async (value) => {
    try {
      setOnBreak(value);
      await updateStatus({ on_break: value });
    } catch (error) {
      setOnBreak(!value);
      Alert.alert('Error', 'Failed to update break status');
    }
  };

  const getStatusColor = () => {
    if (!isOnline) return COLORS.offline;
    if (onBreak) return COLORS.onBreak;
    return COLORS.available;
  };

  const getStatusText = () => {
    if (!isOnline) return 'Offline';
    if (onBreak) return 'On Break';
    return 'Online';
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Header Card */}
      <View style={styles.headerCard}>
        <View style={styles.profileRow}>
          <View style={[styles.avatar, { backgroundColor: getStatusColor() }]}>
            <Text style={styles.avatarText}>
              {user?.name?.charAt(0)?.toUpperCase() || 'D'}
            </Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.driverName}>{user?.name || 'Driver'}</Text>
            <Text style={styles.vehicleInfo}>
              {user?.vehicle_type} • {user?.vehicle_number}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor() }]}>
            <Text style={styles.statusText}>{getStatusText()}</Text>
          </View>
        </View>

        {/* Status Toggles */}
        <View style={styles.togglesContainer}>
          <View style={styles.toggleRow}>
            <View style={styles.toggleLabel}>
              <Ionicons name="radio-button-on" size={20} color={isOnline ? COLORS.success : COLORS.offline} />
              <Text style={styles.toggleText}>Go Online</Text>
            </View>
            <Switch
              value={isOnline}
              onValueChange={handleOnlineToggle}
              trackColor={{ false: COLORS.border, true: COLORS.success }}
              thumbColor="#fff"
            />
          </View>
          {isOnline && (
            <View style={styles.toggleRow}>
              <View style={styles.toggleLabel}>
                <Ionicons name="cafe" size={20} color={onBreak ? COLORS.onBreak : COLORS.textSecondary} />
                <Text style={styles.toggleText}>Take a Break</Text>
              </View>
              <Switch
                value={onBreak}
                onValueChange={handleBreakToggle}
                trackColor={{ false: COLORS.border, true: COLORS.onBreak }}
                thumbColor="#fff"
              />
            </View>
          )}
        </View>
      </View>

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionsGrid}>
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => navigation.navigate('Jobs')}
          >
            <View style={[styles.actionIcon, { backgroundColor: COLORS.info + '20' }]}>
              <Ionicons name="car" size={24} color={COLORS.info} />
            </View>
            <Text style={styles.actionLabel}>My Jobs</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => navigation.navigate('Earnings')}
          >
            <View style={[styles.actionIcon, { backgroundColor: COLORS.success + '20' }]}>
              <Ionicons name="wallet" size={24} color={COLORS.success} />
            </View>
            <Text style={styles.actionLabel}>Earnings</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => navigation.navigate('History')}
          >
            <View style={[styles.actionIcon, { backgroundColor: COLORS.secondary + '20' }]}>
              <Ionicons name="time" size={24} color={COLORS.secondary} />
            </View>
            <Text style={styles.actionLabel}>History</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => navigation.navigate('Profile')}
          >
            <View style={[styles.actionIcon, { backgroundColor: COLORS.primary + '20' }]}>
              <Ionicons name="person" size={24} color={COLORS.primary} />
            </View>
            <Text style={styles.actionLabel}>Profile</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Earnings Summary */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Today's Summary</Text>
        <View style={styles.earningsCard}>
          <View style={styles.earningItem}>
            <Text style={styles.earningValue}>
              £{earnings?.today?.earnings?.toFixed(2) || '0.00'}
            </Text>
            <Text style={styles.earningLabel}>Earnings</Text>
          </View>
          <View style={styles.earningDivider} />
          <View style={styles.earningItem}>
            <Text style={styles.earningValue}>
              {earnings?.today?.trips || 0}
            </Text>
            <Text style={styles.earningLabel}>Trips</Text>
          </View>
        </View>
      </View>

      {/* This Week */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>This Week</Text>
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Ionicons name="cash-outline" size={24} color={COLORS.success} />
            <Text style={styles.statValue}>
              £{earnings?.this_week?.earnings?.toFixed(2) || '0.00'}
            </Text>
            <Text style={styles.statLabel}>Earnings</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="car-outline" size={24} color={COLORS.info} />
            <Text style={styles.statValue}>
              {earnings?.this_week?.trips || 0}
            </Text>
            <Text style={styles.statLabel}>Trips</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  headerCard: {
    backgroundColor: COLORS.primary,
    padding: 20,
    paddingTop: 60,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  profileInfo: {
    flex: 1,
    marginLeft: 12,
  },
  driverName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  vehicleInfo: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  togglesContainer: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 4,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  toggleLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  toggleText: {
    color: '#fff',
    fontSize: 16,
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 12,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionCard: {
    width: '47%',
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text,
  },
  earningsCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  earningItem: {
    flex: 1,
    alignItems: 'center',
  },
  earningValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  earningLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  earningDivider: {
    width: 1,
    height: 40,
    backgroundColor: COLORS.border,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
});
