import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  SafeAreaView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { BOOKING_STATUS_LABELS } from '../config';
import { getHistory } from '../services/api';

const formatDateTime = (dateString) => {
  if (!dateString) return { date: 'N/A', time: '' };
  const date = new Date(dateString);
  return {
    date: date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
    time: date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
  };
};

const HistoryCard = ({ booking, theme }) => {
  const { date, time } = formatDateTime(booking.completed_at || booking.booking_datetime);
  const customerName = `${booking.first_name || ''} ${booking.last_name || ''}`.trim() || 'Customer';

  return (
    <View style={[styles.card, { backgroundColor: theme.card }]}>
      <View style={styles.cardHeader}>
        <Text style={[styles.bookingId, { color: theme.textSecondary }]}>{booking.booking_id}</Text>
        <View style={styles.dateContainer}>
          <Text style={[styles.dateText, { color: theme.text }]}>{date}</Text>
          <Text style={[styles.timeText, { color: theme.textSecondary }]}>{time}</Text>
        </View>
      </View>

      <View style={styles.routeContainer}>
        <View style={styles.routePoint}>
          <View style={[styles.routeDot, { backgroundColor: theme.success }]} />
          <Text style={[styles.routeAddress, { color: theme.text }]} numberOfLines={1}>
            {booking.pickup_location}
          </Text>
        </View>
        <View style={styles.routePoint}>
          <View style={[styles.routeDot, { backgroundColor: theme.danger }]} />
          <Text style={[styles.routeAddress, { color: theme.text }]} numberOfLines={1}>
            {booking.dropoff_location}
          </Text>
        </View>
      </View>

      <View style={styles.cardFooter}>
        <View style={styles.customerInfo}>
          <Ionicons name="person-outline" size={14} color={theme.textSecondary} />
          <Text style={[styles.customerName, { color: theme.textSecondary }]}>{customerName}</Text>
        </View>
        {booking.fare && (
          <Text style={[styles.fare, { color: theme.success }]}>£{booking.fare.toFixed(2)}</Text>
        )}
      </View>
    </View>
  );
};

export default function HistoryScreen() {
  const { theme } = useTheme();
  const [history, setHistory] = useState({ bookings: [], total: 0 });
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchHistory = async (skip = 0) => {
    try {
      const data = await getHistory(20, skip);
      if (skip === 0) {
        setHistory(data);
      } else {
        setHistory(prev => ({
          ...data,
          bookings: [...prev.bookings, ...data.bookings],
        }));
      }
    } catch (error) {
      console.error('Error fetching history:', error);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchHistory(0);
    setRefreshing(false);
  }, []);

  const loadMore = async () => {
    if (loading || history.bookings.length >= history.total) return;
    setLoading(true);
    await fetchHistory(history.bookings.length);
    setLoading(false);
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={history.bookings}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <HistoryCard booking={item} />}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={styles.listContent}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListHeaderComponent={
          <Text style={styles.headerText}>
            {history.total} completed trip{history.total !== 1 ? 's' : ''}
          </Text>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="time-outline" size={64} color={COLORS.textSecondary} />
            <Text style={styles.emptyText}>No completed trips yet</Text>
          </View>
        }
        ListFooterComponent={
          loading ? (
            <Text style={styles.loadingText}>Loading more...</Text>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  listContent: {
    padding: 16,
  },
  headerText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 12,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  bookingId: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  dateContainer: {
    alignItems: 'flex-end',
  },
  dateText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  timeText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text,
  },
  routeContainer: {
    marginBottom: 12,
  },
  routePoint: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  routeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 8,
  },
  routeAddress: {
    flex: 1,
    fontSize: 13,
    color: COLORS.text,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  customerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  customerName: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  fare: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.success,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginTop: 12,
  },
  loadingText: {
    textAlign: 'center',
    color: COLORS.textSecondary,
    paddingVertical: 16,
  },
});
