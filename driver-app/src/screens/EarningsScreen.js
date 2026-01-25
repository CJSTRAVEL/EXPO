import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  SafeAreaView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { getEarnings } from '../services/api';

export default function EarningsScreen() {
  const { theme } = useTheme();
  const [earnings, setEarnings] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchEarnings = async () => {
    try {
      const data = await getEarnings();
      setEarnings(data);
    } catch (error) {
      console.error('Error fetching earnings:', error);
    }
  };

  useEffect(() => {
    fetchEarnings();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchEarnings();
    setRefreshing(false);
  }, []);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.headerBar, { backgroundColor: theme.headerBg }]}>
        <Text style={styles.headerTitle}>Payments</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
        }
      >
        {/* Today's Earnings - Featured */}
        <View style={[styles.featuredCard, { backgroundColor: theme.primary }]}>
          <Text style={styles.featuredLabel}>Today's Earnings</Text>
          <Text style={styles.featuredValue}>
            £{earnings?.today?.amount?.toFixed(2) || '0.00'}
          </Text>
          <View style={styles.featuredStats}>
            <View style={styles.featuredStat}>
              <Ionicons name="car" size={16} color="rgba(255,255,255,0.8)" />
              <Text style={styles.featuredStatText}>
                {earnings?.today?.jobs || 0} trips
              </Text>
            </View>
          </View>
        </View>

        {/* Period Cards */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Earnings Overview</Text>
          
          <View style={[styles.periodCard, { backgroundColor: theme.card }]}>
            <View style={styles.periodHeader}>
              <Ionicons name="calendar-outline" size={24} color={theme.info} />
              <Text style={[styles.periodTitle, { color: theme.text }]}>This Week</Text>
            </View>
            <View style={styles.periodStats}>
              <View style={styles.periodStat}>
                <Text style={[styles.periodStatValue, { color: theme.text }]}>
                  £{earnings?.week?.amount?.toFixed(2) || '0.00'}
                </Text>
                <Text style={[styles.periodStatLabel, { color: theme.textSecondary }]}>Earnings</Text>
              </View>
              <View style={[styles.periodDivider, { backgroundColor: theme.border }]} />
              <View style={styles.periodStat}>
                <Text style={[styles.periodStatValue, { color: theme.text }]}>
                  {earnings?.week?.jobs || 0}
                </Text>
                <Text style={[styles.periodStatLabel, { color: theme.textSecondary }]}>Trips</Text>
            </View>
          </View>
        </View>

        <View style={[styles.periodCard, { backgroundColor: theme.card }]}>
          <View style={styles.periodHeader}>
            <Ionicons name="stats-chart-outline" size={24} color={theme.success} />
            <Text style={[styles.periodTitle, { color: theme.text }]}>All Time</Text>
          </View>
          <View style={styles.periodStats}>
            <View style={styles.periodStat}>
              <Text style={[styles.periodStatValue, { color: theme.text }]}>
                £{earnings?.all_time?.amount?.toFixed(2) || '0.00'}
              </Text>
              <Text style={[styles.periodStatLabel, { color: theme.textSecondary }]}>Total Earnings</Text>
            </View>
            <View style={[styles.periodDivider, { backgroundColor: theme.border }]} />
            <View style={styles.periodStat}>
              <Text style={[styles.periodStatValue, { color: theme.text }]}>
                {earnings?.all_time?.jobs || 0}
              </Text>
              <Text style={[styles.periodStatLabel, { color: theme.textSecondary }]}>Total Trips</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Info */}
      <View style={[styles.infoCard, { backgroundColor: theme.card }]}>
        <Ionicons name="information-circle" size={20} color={theme.info} />
        <Text style={[styles.infoText, { color: theme.textSecondary }]}>
          Earnings are calculated from completed trips. Contact dispatch for any discrepancies.
        </Text>
      </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerBar: {
    paddingTop: Platform.OS === 'ios' ? 0 : 40,
    paddingBottom: 16,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    fontStyle: 'italic',
    color: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  featuredCard: {
    padding: 24,
    margin: 16,
    borderRadius: 20,
    alignItems: 'center',
  },
  featuredLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    marginBottom: 8,
  },
  featuredValue: {
    color: '#fff',
    fontSize: 48,
    fontWeight: 'bold',
  },
  featuredStats: {
    flexDirection: 'row',
    marginTop: 16,
  },
  featuredStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  featuredStatText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
  },
  section: {
    padding: 16,
    paddingTop: 0,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  periodCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  periodHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  periodTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  periodStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  periodStat: {
    flex: 1,
    alignItems: 'center',
  },
  periodStatValue: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  periodStatLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  periodDivider: {
    width: 1,
    height: 40,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    margin: 16,
    marginTop: 0,
    padding: 16,
    borderRadius: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
});
