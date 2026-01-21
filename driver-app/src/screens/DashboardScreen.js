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
  SafeAreaView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { COLORS, BOOKING_STATUS_LABELS } from '../config';
import { getEarnings, updateStatus, getBookings } from '../services/api';
import {
  requestLocationPermissions,
  startBackgroundLocationTracking,
  stopBackgroundLocationTracking,
} from '../services/locationService';

export default function DashboardScreen({ navigation }) {
  const { user, refreshProfile } = useAuth();
  const [isOnline, setIsOnline] = useState(user?.is_online || false);
  const [onBreak, setOnBreak] = useState(user?.on_break || false);
  const [earnings, setEarnings] = useState(null);
  const [activeJob, setActiveJob] = useState(null);
  const [todayJobs, setTodayJobs] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      const [earningsData, bookingsData] = await Promise.all([
        getEarnings(),
        getBookings(),
      ]);
      setEarnings(earningsData);
      
      // Find active job (in_progress or on_way or arrived)
      const allBookings = [...(bookingsData.today || []), ...(bookingsData.upcoming || [])];
      const active = allBookings.find(b => 
        ['on_way', 'arrived', 'in_progress'].includes(b.status)
      );
      setActiveJob(active);
      setTodayJobs(bookingsData.today || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  useEffect(() => {
    fetchData();
    // Set up refresh interval
    const interval = setInterval(fetchData, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Update local state when user changes
    setIsOnline(user?.is_online || false);
    setOnBreak(user?.on_break || false);
  }, [user]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchData(), refreshProfile()]);
    setRefreshing(false);
  }, []);

  const handleOnlineToggle = async (value) => {
    try {
      if (value) {
        // Request location permissions and start tracking
        const permissions = await requestLocationPermissions();
        if (!permissions.granted) {
          Alert.alert(
            'Location Required',
            'Location permission is required to go online. Please enable it in settings.',
            [{ text: 'OK' }]
          );
          return;
        }
        
        if (permissions.background) {
          await startBackgroundLocationTracking();
        }
      } else {
        // Stop location tracking when going offline
        await stopBackgroundLocationTracking();
      }

      setIsOnline(value);
      await updateStatus({ is_online: value });
      if (!value) setOnBreak(false);
      await refreshProfile();
    } catch (error) {
      setIsOnline(!value);
      Alert.alert('Error', 'Failed to update status');
    }
  };

  const handleBreakToggle = async (value) => {
    try {
      setOnBreak(value);
      await updateStatus({ on_break: value });
      await refreshProfile();
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

  const getJobStatusColor = (status) => {
    const colors = {
      on_way: '#8b5cf6',
      arrived: '#06b6d4',
      in_progress: COLORS.success,
    };
    return colors[status] || COLORS.info;
  };

  const formatTime = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  };

  const handleViewActiveJob = () => {
    if (activeJob) {
      navigation.navigate('JobDetail', { booking: activeJob, onRefresh: fetchData });
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Page Title */}
        <View style={styles.pageHeader}>
          <Text style={styles.pageTitle}>Dashboard</Text>
        </View>
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
            <View style={[styles.statusDot, { backgroundColor: isOnline ? '#fff' : 'transparent' }]} />
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

      {/* Active Job Card */}
      {activeJob && (
        <TouchableOpacity style={styles.activeJobCard} onPress={handleViewActiveJob}>
          <View style={styles.activeJobHeader}>
            <View style={styles.activeJobBadge}>
              <View style={styles.pulseDot} />
              <Text style={styles.activeJobBadgeText}>ACTIVE JOB</Text>
            </View>
            <Text style={styles.activeJobId}>{activeJob.booking_id}</Text>
          </View>
          
          <View style={styles.activeJobContent}>
            <View style={styles.activeJobRoute}>
              <View style={styles.activeJobLocation}>
                <View style={[styles.locationDot, { backgroundColor: COLORS.success }]} />
                <Text style={styles.activeJobAddress} numberOfLines={1}>
                  {activeJob.pickup_location}
                </Text>
              </View>
              <View style={styles.activeJobLocation}>
                <View style={[styles.locationDot, { backgroundColor: COLORS.danger }]} />
                <Text style={styles.activeJobAddress} numberOfLines={1}>
                  {activeJob.dropoff_location}
                </Text>
              </View>
            </View>
            
            <View style={[styles.activeJobStatus, { backgroundColor: getJobStatusColor(activeJob.status) }]}>
              <Text style={styles.activeJobStatusText}>
                {BOOKING_STATUS_LABELS[activeJob.status]}
              </Text>
              <Ionicons name="chevron-forward" size={16} color="#fff" />
            </View>
          </View>
        </TouchableOpacity>
      )}

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
            {todayJobs.length > 0 && (
              <View style={styles.actionBadge}>
                <Text style={styles.actionBadgeText}>{todayJobs.length}</Text>
              </View>
            )}
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

      {/* Upcoming Jobs Preview */}
      {todayJobs.length > 0 && !activeJob && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Today's Jobs</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Jobs')}>
              <Text style={styles.seeAll}>See All</Text>
            </TouchableOpacity>
          </View>
          {todayJobs.slice(0, 2).map((job, index) => (
            <TouchableOpacity 
              key={job.id || index} 
              style={styles.upcomingJob}
              onPress={() => navigation.navigate('JobDetail', { booking: job, onRefresh: fetchData })}
            >
              <View style={styles.upcomingJobTime}>
                <Text style={styles.upcomingJobTimeText}>{formatTime(job.booking_datetime)}</Text>
              </View>
              <View style={styles.upcomingJobInfo}>
                <Text style={styles.upcomingJobId}>{job.booking_id}</Text>
                <Text style={styles.upcomingJobAddress} numberOfLines={1}>
                  {job.pickup_location}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>
          ))}
        </View>
      )}

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

      <View style={styles.bottomPadding} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  pageHeader: {
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 8 : 16,
    paddingBottom: 16,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  headerCard: {
    backgroundColor: COLORS.primary,
    padding: 20,
    paddingTop: 16,
    marginHorizontal: 16,
    borderRadius: 16,
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
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
  // Active Job Card
  activeJobCard: {
    backgroundColor: COLORS.card,
    margin: 16,
    marginTop: -12,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
    borderWidth: 2,
    borderColor: COLORS.success + '40',
  },
  activeJobHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  activeJobBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.success,
  },
  activeJobBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.success,
    letterSpacing: 0.5,
  },
  activeJobId: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
  },
  activeJobContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  activeJobRoute: {
    flex: 1,
    gap: 8,
  },
  activeJobLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  locationDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  activeJobAddress: {
    flex: 1,
    fontSize: 13,
    color: COLORS.text,
  },
  activeJobStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 4,
  },
  activeJobStatusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  // Section styles
  section: {
    padding: 16,
    paddingBottom: 0,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 12,
  },
  seeAll: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '500',
  },
  // Actions Grid
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
    position: 'relative',
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
  actionBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: COLORS.danger,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  actionBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  // Earnings Card
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
  // Upcoming Jobs
  upcomingJob: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  upcomingJobTime: {
    backgroundColor: COLORS.primary + '15',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginRight: 12,
  },
  upcomingJobTimeText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
  },
  upcomingJobInfo: {
    flex: 1,
  },
  upcomingJobId: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  upcomingJobAddress: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  // Stats Row
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
  bottomPadding: {
    height: 24,
  },
});
