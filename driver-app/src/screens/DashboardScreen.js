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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { getDriverStats } from '../services/api';

const { width } = Dimensions.get('window');

export default function DashboardScreen({ navigation }) {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [stats, setStats] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState('week');
  const [dateRange, setDateRange] = useState('');

  useEffect(() => {
    loadStats();
    setDateRange(getDateRange());
  }, [selectedPeriod]);

  const loadStats = async () => {
    try {
      const data = await getDriverStats();
      setStats(data);
    } catch (error) {
      console.log('Error loading stats:', error);
    }
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

  const StatCard = ({ label, value, color, small }) => (
    <View style={[
      small ? styles.statCardSmall : styles.statCard, 
      { backgroundColor: color + '15' }
    ]}>
      <Text style={[styles.statLabel, { color: theme.textSecondary }]}>{label}</Text>
      <Text style={[styles.statValue, { color: color || theme.text }]}>{value}</Text>
    </View>
  );

  const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const bookingsData = stats?.weekly_bookings || [0, 0, 1, 0, 0, 0, 0];
  const maxBookings = Math.max(...bookingsData, 1);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.greeting, { color: theme.text }]}>
            Hello, {user?.name?.split(' ')[0] || 'Driver'}!
          </Text>
          <Text style={[styles.subGreeting, { color: theme.textSecondary }]}>
            Your weekly booking summary
          </Text>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActionsRow}>
          <QuickActionButton 
            icon="trending-up-outline" 
            label="History" 
            onPress={() => navigation.navigate('History')}
            color={theme.info}
          />
          <QuickActionButton 
            icon="wallet-outline" 
            label="Payments" 
            onPress={() => navigation.navigate('Earnings')}
            color={theme.success}
          />
          <QuickActionButton 
            icon="card-outline" 
            label="Cards" 
            onPress={() => {}}
            color={theme.warning}
          />
        </View>

        {/* Date Range Selector */}
        <View style={styles.dateRangeContainer}>
          <TouchableOpacity 
            style={[styles.periodButton, selectedPeriod === 'today' && { backgroundColor: theme.primary }]}
            onPress={() => setSelectedPeriod('today')}
          >
            <Ionicons 
              name="today-outline" 
              size={16} 
              color={selectedPeriod === 'today' ? '#fff' : theme.textSecondary} 
            />
            <Text style={[
              styles.periodButtonText, 
              { color: selectedPeriod === 'today' ? '#fff' : theme.textSecondary }
            ]}>Today</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.dateRangeButton, { backgroundColor: theme.card }]}
          >
            <Ionicons name="calendar-outline" size={16} color={theme.textSecondary} />
            <Text style={[styles.dateRangeText, { color: theme.text }]}>{dateRange}</Text>
          </TouchableOpacity>
        </View>

        {/* Bookings Section */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Bookings</Text>
          
          <View style={styles.statsGrid}>
            <StatCard 
              label="Bookings" 
              value={stats?.total_bookings || '1'} 
              color={theme.info}
            />
            <StatCard 
              label="Income" 
              value={stats?.total_income ? `£${stats.total_income.toFixed(2)}` : '-'} 
              color={theme.success}
            />
          </View>
          
          <View style={styles.statsGridSmall}>
            <StatCard label="Cash" value={stats?.cash || '-'} color={theme.info} small />
            <StatCard label="Card" value={stats?.card || '-'} color={theme.info} small />
            <StatCard label="Account" value={stats?.account || '-'} color={theme.info} small />
          </View>

          {/* Chart */}
          <View style={styles.chartContainer}>
            <View style={styles.chartLegend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: theme.info }]} />
                <Text style={[styles.legendText, { color: theme.textSecondary }]}>Bookings</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: theme.success }]} />
                <Text style={[styles.legendText, { color: theme.textSecondary }]}>Income</Text>
              </View>
            </View>
            
            <View style={styles.chart}>
              <View style={styles.chartYAxis}>
                {[maxBookings, Math.ceil(maxBookings * 0.75), Math.ceil(maxBookings * 0.5), Math.ceil(maxBookings * 0.25), 0].map((val, i) => (
                  <Text key={i} style={[styles.chartYLabel, { color: theme.textSecondary }]}>{val}</Text>
                ))}
              </View>
              <View style={styles.chartBars}>
                {weekDays.map((day, index) => (
                  <View key={day} style={styles.chartBarContainer}>
                    <View style={styles.barGroup}>
                      <View 
                        style={[
                          styles.chartBar, 
                          { 
                            backgroundColor: theme.info,
                            height: (bookingsData[index] / maxBookings) * 80 || 0
                          }
                        ]} 
                      />
                    </View>
                    <Text style={[styles.chartXLabel, { color: theme.textSecondary }]}>{day}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        </View>

        {/* Shift Metrics */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Shift Metrics</Text>
          
          <View style={styles.statsGrid}>
            <StatCard 
              label="Total Shift Time" 
              value={stats?.total_shift_time || '01h 9m'} 
              color={theme.info}
            />
            <StatCard 
              label="Active Shift Time" 
              value={stats?.active_shift_time || '-'} 
              color="#facc15"
            />
          </View>
          
          <View style={styles.statsGrid}>
            <StatCard 
              label="On Job Time" 
              value={stats?.on_job_time || '01h 9m'} 
              color={theme.success}
            />
            <StatCard 
              label="On Break Time" 
              value={stats?.on_break_time || '-'} 
              color={theme.warning}
            />
          </View>

          {/* Mini chart for shift metrics */}
          <View style={styles.miniChart}>
            <View style={styles.chartLegend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: theme.info }]} />
                <Text style={[styles.legendText, { color: theme.textSecondary }]}>Total Shift Time</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#facc15' }]} />
                <Text style={[styles.legendText, { color: theme.textSecondary }]}>Active Shift Time</Text>
              </View>
            </View>
            <View style={styles.chartLegend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: theme.success }]} />
                <Text style={[styles.legendText, { color: theme.textSecondary }]}>On Job Time</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: theme.warning }]} />
                <Text style={[styles.legendText, { color: theme.textSecondary }]}>On Break Time</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Booking Offers */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Booking Offers</Text>
          
          <View style={styles.statsGrid}>
            <StatCard 
              label="Total" 
              value={stats?.offers_total || '0'} 
              color={theme.textSecondary}
            />
            <StatCard 
              label="Read" 
              value={stats?.offers_read || '0'} 
              color={theme.info}
            />
          </View>
          
          <View style={styles.statsGrid}>
            <StatCard 
              label="Accepted" 
              value={stats?.offers_accepted || '0'} 
              color={theme.success}
            />
            <StatCard 
              label="No Action" 
              value={stats?.offers_no_action || '0'} 
              color="#facc15"
            />
          </View>
          
          <View style={styles.statsGrid}>
            <StatCard 
              label="Rejected" 
              value={stats?.offers_rejected || '0'} 
              color={theme.danger}
            />
            <StatCard 
              label="Missed Earnings" 
              value={stats?.missed_earnings ? `£${stats.missed_earnings.toFixed(2)}` : '£0.00'} 
              color="#f87171"
            />
          </View>
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 8 : 16,
    paddingBottom: 16,
  },
  greeting: {
    fontSize: 28,
    fontWeight: 'bold',
    fontStyle: 'italic',
  },
  subGreeting: {
    fontSize: 14,
    marginTop: 4,
  },
  quickActionsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 16,
  },
  quickAction: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
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
  dateRangeContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 16,
  },
  periodButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'transparent',
    gap: 6,
  },
  periodButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  dateRangeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 24,
    gap: 8,
  },
  dateRangeText: {
    fontSize: 14,
    fontWeight: '500',
  },
  section: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  statsGridSmall: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
  },
  statCardSmall: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  chartContainer: {
    marginTop: 8,
  },
  chartLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    marginBottom: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
  },
  chart: {
    flexDirection: 'row',
    height: 120,
  },
  chartYAxis: {
    width: 24,
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingRight: 4,
    paddingBottom: 20,
  },
  chartYLabel: {
    fontSize: 10,
  },
  chartBars: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  chartBarContainer: {
    alignItems: 'center',
    flex: 1,
  },
  barGroup: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
    height: 80,
  },
  chartBar: {
    width: 16,
    borderRadius: 4,
    minHeight: 4,
  },
  chartXLabel: {
    fontSize: 10,
    marginTop: 4,
    position: 'absolute',
    bottom: -16,
  },
  miniChart: {
    marginTop: 8,
  },
});
