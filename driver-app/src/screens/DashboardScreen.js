import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  SafeAreaView,
  Dimensions,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { getDriverStats, getDriverEarnings, getDriverHistory } from '../services/api';

const { width } = Dimensions.get('window');

export default function DashboardScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { theme } = useTheme();
  const [stats, setStats] = useState(null);
  const [earnings, setEarnings] = useState(null);
  const [recentJobs, setRecentJobs] = useState([]);
  const [selectedPeriod, setSelectedPeriod] = useState('week');
  const [dateRange, setDateRange] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadAllData();
    setDateRange(getDateRange());
  }, [selectedPeriod]);

  const loadAllData = async () => {
    try {
      const [statsData, earningsData, historyData] = await Promise.all([
        getDriverStats(),
        getDriverEarnings(),
        getDriverHistory()
      ]);
      setStats(statsData);
      setEarnings(earningsData);
      // historyData could be {bookings: [...]} or array directly
      const jobs = Array.isArray(historyData) ? historyData : (historyData?.bookings || []);
      setRecentJobs(jobs.slice(0, 5));
    } catch (error) {
      console.log('Error loading dashboard data:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAllData();
    setRefreshing(false);
  };

  const getDateRange = () => {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay() + 1);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    
    const format = (d) => d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
    return `${format(startOfWeek)} - ${format(endOfWeek)}`;
  };

  const getCurrentStats = () => {
    if (!stats) return { total: 0, completed: 0, pending: 0 };
    switch (selectedPeriod) {
      case 'today': return stats.today || { total: 0, completed: 0, pending: 0 };
      case 'week': return stats.week || { total: 0, completed: 0 };
      case 'month': return stats.month || { total: 0, completed: 0 };
      default: return stats.week || { total: 0, completed: 0 };
    }
  };

  const getCurrentEarnings = () => {
    if (!earnings) return { amount: 0, jobs: 0 };
    switch (selectedPeriod) {
      case 'today': return earnings.today || { amount: 0, jobs: 0 };
      case 'week': return earnings.week || { amount: 0, jobs: 0 };
      case 'month': return earnings.month || { amount: 0, jobs: 0 };
      default: return earnings.week || { amount: 0, jobs: 0 };
    }
  };

  const QuickActionButton = ({ icon, label, onPress, color }) => (
    <TouchableOpacity 
      style={[styles.quickAction, { backgroundColor: theme.card }]}
      onPress={onPress}
    >
      <View style={[styles.quickActionIcon, { backgroundColor: (color || theme.primary) + '15' }]}>
        <Ionicons name={icon} size={24} color={color || theme.primary} />
      </View>
      <Text style={[styles.quickActionLabel, { color: theme.text }]}>{label}</Text>
    </TouchableOpacity>
  );

  const StatCard = ({ label, value, subValue, icon, color }) => (
    <View style={[styles.statCard, { backgroundColor: theme.card }]}>
      <View style={[styles.statIconContainer, { backgroundColor: (color || theme.primary) + '15' }]}>
        <Ionicons name={icon} size={24} color={color || theme.primary} />
      </View>
      <Text style={[styles.statValue, { color: theme.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: theme.textSecondary }]}>{label}</Text>
      {subValue && (
        <Text style={[styles.statSubValue, { color: color || theme.primary }]}>{subValue}</Text>
      )}
    </View>
  );

  const RecentJobItem = ({ job }) => {
    const formatDate = (dateStr) => {
      if (!dateStr) return '';
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
    };

    return (
      <TouchableOpacity 
        style={[styles.jobItem, { backgroundColor: theme.card }]}
        onPress={() => navigation.navigate('BookingDetail', { booking: job })}
      >
        <View style={styles.jobInfo}>
          <Text style={[styles.jobId, { color: theme.primary }]}>{job.booking_id}</Text>
          <Text style={[styles.jobCustomer, { color: theme.text }]} numberOfLines={1}>
            {job.customer_name || `${job.first_name || ''} ${job.last_name || ''}`.trim()}
          </Text>
          <Text style={[styles.jobLocation, { color: theme.textSecondary }]} numberOfLines={1}>
            {job.pickup_location}
          </Text>
        </View>
        <View style={styles.jobMeta}>
          <Text style={[styles.jobDate, { color: theme.textSecondary }]}>
            {formatDate(job.completed_at || job.booking_datetime)}
          </Text>
          {job.fare && (
            <Text style={[styles.jobFare, { color: theme.success }]}>£{job.fare.toFixed(2)}</Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const currentStats = getCurrentStats();
  const currentEarnings = getCurrentEarnings();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.headerBar, { backgroundColor: theme.headerBg }]}>
        <Text style={styles.headerTitle}>Dashboard</Text>
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
        }
      >
        {/* Greeting */}
        <View style={styles.greetingSection}>
          <Text style={[styles.greeting, { color: theme.text }]}>
            Hello, {user?.name?.split(' ')[0] || 'Driver'}!
          </Text>
          <Text style={[styles.subGreeting, { color: theme.textSecondary }]}>
            Your performance summary
          </Text>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActionsRow}>
          <QuickActionButton 
            icon="list-outline" 
            label="My Jobs" 
            onPress={() => navigation.navigate('Bookings')}
            color={theme.primary}
          />
          <QuickActionButton 
            icon="time-outline" 
            label="History" 
            onPress={() => navigation.navigate('History')}
            color={theme.info}
          />
          <QuickActionButton 
            icon="wallet-outline" 
            label="Earnings" 
            onPress={() => navigation.navigate('Earnings')}
            color={theme.success}
          />
        </View>

        {/* Period Selector */}
        <View style={styles.periodSelector}>
          {['today', 'week', 'month'].map((period) => (
            <TouchableOpacity
              key={period}
              style={[
                styles.periodButton,
                selectedPeriod === period && { backgroundColor: theme.primary }
              ]}
              onPress={() => setSelectedPeriod(period)}
            >
              <Text style={[
                styles.periodButtonText,
                { color: selectedPeriod === period ? '#fff' : theme.textSecondary }
              ]}>
                {period.charAt(0).toUpperCase() + period.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Stats Cards */}
        <View style={styles.statsRow}>
          <StatCard 
            label="Jobs Completed"
            value={currentStats.completed || 0}
            icon="checkmark-circle-outline"
            color={theme.success}
          />
          <StatCard 
            label="Total Bookings"
            value={currentStats.total || 0}
            icon="car-outline"
            color={theme.info}
          />
        </View>

        <View style={styles.statsRow}>
          <StatCard 
            label="Company Takings"
            value={`£${(currentEarnings.amount || 0).toFixed(2)}`}
            subValue={`${currentEarnings.jobs || 0} paid jobs`}
            icon="cash-outline"
            color={theme.success}
          />
          {selectedPeriod === 'today' && (
            <StatCard 
              label="Pending"
              value={currentStats.pending || 0}
              icon="hourglass-outline"
              color={theme.warning}
            />
          )}
        </View>

        {/* All Time Stats */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>All Time</Text>
          <View style={styles.allTimeStats}>
            <View style={styles.allTimeStat}>
              <Text style={[styles.allTimeValue, { color: theme.primary }]}>
                {stats?.all_time?.completed || 0}
              </Text>
              <Text style={[styles.allTimeLabel, { color: theme.textSecondary }]}>Completed</Text>
            </View>
            <View style={[styles.allTimeDivider, { backgroundColor: theme.border }]} />
            <View style={styles.allTimeStat}>
              <Text style={[styles.allTimeValue, { color: theme.info }]}>
                {stats?.all_time?.total || 0}
              </Text>
              <Text style={[styles.allTimeLabel, { color: theme.textSecondary }]}>Total Jobs</Text>
            </View>
            <View style={[styles.allTimeDivider, { backgroundColor: theme.border }]} />
            <View style={styles.allTimeStat}>
              <Text style={[styles.allTimeValue, { color: theme.success }]}>
                £{(earnings?.all_time?.amount || 0).toFixed(2)}
              </Text>
              <Text style={[styles.allTimeLabel, { color: theme.textSecondary }]}>Takings</Text>
            </View>
          </View>
        </View>

        {/* Recent Jobs */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Recent Jobs</Text>
            <TouchableOpacity onPress={() => navigation.navigate('History')}>
              <Text style={[styles.seeAllText, { color: theme.primary }]}>See All</Text>
            </TouchableOpacity>
          </View>
          
          {recentJobs.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="car-outline" size={40} color={theme.textSecondary} />
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                No completed jobs yet
              </Text>
            </View>
          ) : (
            recentJobs.map((job, index) => (
              <RecentJobItem key={job.id || index} job={job} />
            ))
          )}
        </View>

        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: Platform.OS === 'android' ? 12 : 0,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  greetingSection: {
    padding: 16,
  },
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  subGreeting: {
    fontSize: 14,
    marginTop: 4,
  },
  quickActionsRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  quickAction: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    marginHorizontal: 4,
    borderRadius: 12,
  },
  quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  quickActionLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  periodSelector: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  periodButton: {
    flex: 1,
    paddingVertical: 10,
    marginHorizontal: 4,
    borderRadius: 8,
    alignItems: 'center',
  },
  periodButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    padding: 16,
    marginHorizontal: 4,
    borderRadius: 12,
    alignItems: 'center',
  },
  statIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  statSubValue: {
    fontSize: 11,
    marginTop: 2,
  },
  section: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: '500',
  },
  allTimeStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 8,
  },
  allTimeStat: {
    alignItems: 'center',
    flex: 1,
  },
  allTimeValue: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  allTimeLabel: {
    fontSize: 11,
    marginTop: 4,
  },
  allTimeDivider: {
    width: 1,
    height: 40,
  },
  jobItem: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  jobInfo: {
    flex: 1,
  },
  jobId: {
    fontSize: 12,
    fontWeight: '600',
  },
  jobCustomer: {
    fontSize: 14,
    fontWeight: '500',
    marginTop: 2,
  },
  jobLocation: {
    fontSize: 12,
    marginTop: 2,
  },
  jobMeta: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  jobDate: {
    fontSize: 11,
  },
  jobFare: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyText: {
    fontSize: 14,
    marginTop: 8,
  },
});
