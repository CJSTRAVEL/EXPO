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

  const getExpiryColor = (daysUntil) => {
    if (daysUntil <= 0) return theme.danger;
    if (daysUntil <= 30) return theme.danger;
    if (daysUntil <= 60) return theme.warning;
    if (daysUntil <= 90) return '#facc15';
    return theme.success;
  };

  const getExpiryStatusText = (daysUntil) => {
    if (daysUntil <= 0) return 'EXPIRED';
    if (daysUntil === 1) return '1 day left';
    return `${daysUntil} days`;
  };

  const DocumentCard = ({ document }) => {
    const color = getExpiryColor(document.days_until_expiry);
    const statusText = getExpiryStatusText(document.days_until_expiry);
    const isExpired = document.days_until_expiry <= 0;
    const isUrgent = document.days_until_expiry <= 30;
    
    const formatDate = (dateStr) => {
      try {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      } catch {
        return dateStr;
      }
    };

    return (
      <View style={[styles.documentCard, { backgroundColor: theme.card, borderLeftColor: color }]}>
        <View style={styles.documentInfo}>
          <View style={styles.documentHeader}>
            <Ionicons 
              name={isExpired ? 'alert-circle' : 'document-text-outline'} 
              size={20} 
              color={color} 
            />
            <Text style={[styles.documentName, { color: theme.text }]}>{document.name}</Text>
          </View>
          <Text style={[styles.documentExpiry, { color: theme.textSecondary }]}>
            Expires: {formatDate(document.expiry_date)}
          </Text>
        </View>
        <View style={[styles.documentBadge, { backgroundColor: color + '20' }]}>
          <Text style={[styles.documentBadgeText, { color: color }]}>{statusText}</Text>
        </View>
      </View>
    );
  };

  const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const bookingsData = stats?.weekly_bookings || [0, 0, 1, 0, 0, 0, 0];
  const maxBookings = Math.max(...bookingsData, 1);

  // Sort documents by days until expiry (most urgent first)
  const sortedDocuments = stats?.documents 
    ? [...stats.documents].sort((a, b) => a.days_until_expiry - b.days_until_expiry)
    : [];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.headerBar, { backgroundColor: theme.headerBg }]}>
        <Text style={styles.headerTitle}>Dashboard</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Greeting */}
        <View style={styles.greetingSection}>
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
              value={stats?.total_bookings || '0'} 
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

        {/* 24hr Shift Metrics */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Shift Metrics</Text>
            <View style={[styles.periodBadge, { backgroundColor: theme.primary + '20' }]}>
              <Ionicons name="time-outline" size={12} color={theme.primary} />
              <Text style={[styles.periodBadgeText, { color: theme.primary }]}>Last 24hrs</Text>
            </View>
          </View>
          
          <View style={styles.statsGrid}>
            <StatCard 
              label="Bookings" 
              value={stats?.shift_24hr?.total_bookings || '0'} 
              color={theme.info}
            />
            <StatCard 
              label="Income" 
              value={stats?.shift_24hr?.total_income ? `£${stats.shift_24hr.total_income.toFixed(2)}` : '-'} 
              color={theme.success}
            />
          </View>
          
          <View style={styles.statsGrid}>
            <StatCard 
              label="Total Shift Time" 
              value={stats?.shift_24hr?.total_shift_time || '-'} 
              color={theme.info}
            />
            <StatCard 
              label="Active Time" 
              value={stats?.shift_24hr?.active_shift_time || '-'} 
              color="#facc15"
            />
          </View>
          
          <View style={styles.statsGrid}>
            <StatCard 
              label="On Job Time" 
              value={stats?.shift_24hr?.on_job_time || '-'} 
              color={theme.success}
            />
            <StatCard 
              label="On Break Time" 
              value={stats?.shift_24hr?.on_break_time || '-'} 
              color={theme.warning}
            />
          </View>
        </View>

        {/* Driver Documents Section */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Document Expiry</Text>
            <TouchableOpacity style={styles.refreshButton} onPress={loadStats}>
              <Ionicons name="refresh-outline" size={18} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>
          
          {sortedDocuments.length > 0 ? (
            <>
              {/* Expiry Legend */}
              <View style={styles.expiryLegend}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: theme.danger }]} />
                  <Text style={[styles.legendText, { color: theme.textSecondary }]}>≤30 days</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: theme.warning }]} />
                  <Text style={[styles.legendText, { color: theme.textSecondary }]}>31-60 days</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#facc15' }]} />
                  <Text style={[styles.legendText, { color: theme.textSecondary }]}>61-90 days</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: theme.success }]} />
                  <Text style={[styles.legendText, { color: theme.textSecondary }]}>&gt;90 days</Text>
                </View>
              </View>

              {/* Document List */}
              <View style={styles.documentsList}>
                {sortedDocuments.map((doc, index) => (
                  <DocumentCard key={index} document={doc} />
                ))}
              </View>
            </>
          ) : (
            <View style={styles.noDocuments}>
              <Ionicons name="document-outline" size={40} color={theme.textSecondary} />
              <Text style={[styles.noDocumentsText, { color: theme.textSecondary }]}>
                No document expiry dates on file
              </Text>
              <Text style={[styles.noDocumentsSubtext, { color: theme.textSecondary }]}>
                Contact dispatch to update your documents
              </Text>
            </View>
          )}
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
    paddingTop: Platform.OS === 'ios' ? 20 : 50,
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
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  periodBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  periodBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  refreshButton: {
    padding: 4,
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
  // Document Expiry Styles
  expiryLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  documentsList: {
    gap: 10,
  },
  documentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderLeftWidth: 4,
    backgroundColor: 'transparent',
  },
  documentInfo: {
    flex: 1,
  },
  documentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  documentName: {
    fontSize: 15,
    fontWeight: '600',
  },
  documentExpiry: {
    fontSize: 12,
    marginLeft: 28,
  },
  documentBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  documentBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  noDocuments: {
    alignItems: 'center',
    padding: 32,
  },
  noDocumentsText: {
    fontSize: 15,
    fontWeight: '500',
    marginTop: 12,
  },
  noDocumentsSubtext: {
    fontSize: 13,
    marginTop: 4,
    textAlign: 'center',
  },
});
