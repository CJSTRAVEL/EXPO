import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Linking,
  Platform,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, BOOKING_STATUS_LABELS } from '../config';
import {
  getBookings,
  acceptBooking,
  rejectBooking,
  updateBookingStatus,
  notifyArrival,
} from '../services/api';

const formatDateTime = (dateString) => {
  const date = new Date(dateString);
  return {
    date: date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }),
    time: date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
  };
};

const BookingCard = ({ booking, onStatusUpdate, onNavigate, onCall, onChat, onStartNavigation, onViewDetail }) => {
  const { date, time } = formatDateTime(booking.booking_datetime);
  const customerName = `${booking.first_name || ''} ${booking.last_name || ''}`.trim() || 'Customer';
  
  const getStatusColor = (status) => {
    return COLORS[status] || COLORS.pending;
  };

  const getNextStatus = (currentStatus) => {
    const flow = {
      assigned: 'on_way',
      on_way: 'arrived',
      arrived: 'in_progress',
      in_progress: 'completed',
    };
    return flow[currentStatus];
  };

  const getNextStatusLabel = (currentStatus) => {
    const labels = {
      assigned: 'Start Journey',
      on_way: 'Arrived',
      arrived: 'Start Trip',
      in_progress: 'Complete',
    };
    return labels[currentStatus];
  };

  // Determine which location to navigate to based on status
  const getNavigationDestination = () => {
    if (booking.status === 'assigned' || booking.status === 'on_way') {
      return { destination: booking.pickup_location, type: 'pickup' };
    }
    return { destination: booking.dropoff_location, type: 'dropoff' };
  };

  return (
    <TouchableOpacity 
      style={styles.bookingCard}
      onPress={() => onViewDetail(booking)}
      activeOpacity={0.7}
    >
      {/* Header */}
      <View style={styles.cardHeader}>
        <View style={styles.bookingIdContainer}>
          <Text style={styles.bookingId}>{booking.booking_id || 'N/A'}</Text>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(booking.status) }]}>
            <Text style={styles.statusText}>
              {BOOKING_STATUS_LABELS[booking.status] || booking.status}
            </Text>
          </View>
        </View>
        <View style={styles.dateTimeContainer}>
          <Text style={styles.dateText}>{date}</Text>
          <Text style={styles.timeText}>{time}</Text>
        </View>
      </View>

      {/* Customer Info */}
      <View style={styles.customerRow}>
        <Ionicons name="person" size={16} color={COLORS.textSecondary} />
        <Text style={styles.customerName}>{customerName}</Text>
        {booking.passenger_count > 1 && (
          <Text style={styles.paxBadge}>{booking.passenger_count} PAX</Text>
        )}
      </View>

      {/* Route */}
      <View style={styles.routeContainer}>
        <View style={styles.routePoint}>
          <View style={[styles.routeDot, { backgroundColor: COLORS.success }]} />
          <Text style={styles.routeAddress} numberOfLines={2}>
            {booking.pickup_location}
          </Text>
        </View>
        {booking.additional_stops?.length > 0 && (
          <View style={styles.routePoint}>
            <View style={[styles.routeDot, { backgroundColor: COLORS.warning }]} />
            <Text style={styles.routeAddress} numberOfLines={1}>
              +{booking.additional_stops.length} stop(s)
            </Text>
          </View>
        )}
        <View style={styles.routePoint}>
          <View style={[styles.routeDot, { backgroundColor: COLORS.danger }]} />
          <Text style={styles.routeAddress} numberOfLines={2}>
            {booking.dropoff_location}
          </Text>
        </View>
      </View>

      {/* Fare */}
      {booking.fare && (
        <View style={styles.fareRow}>
          <Ionicons name="cash" size={16} color={COLORS.success} />
          <Text style={styles.fareText}>£{booking.fare.toFixed(2)}</Text>
        </View>
      )}

      {/* Actions */}
      <View style={styles.actionsContainer}>
        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => onCall(booking.customer_phone)}
          >
            <Ionicons name="call" size={20} color={COLORS.success} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.iconButton, { backgroundColor: COLORS.info + '20' }]}
            onPress={() => {
              const nav = getNavigationDestination();
              onStartNavigation(booking, nav.type);
            }}
          >
            <Ionicons name="navigate" size={20} color={COLORS.info} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => onChat(booking)}
          >
            <Ionicons name="chatbubble" size={20} color={COLORS.primary} />
          </TouchableOpacity>
        </View>

        {/* Status Update Button */}
        {booking.status !== 'completed' && booking.status !== 'cancelled' && (
          <TouchableOpacity
            style={[styles.statusButton, { backgroundColor: getStatusColor(getNextStatus(booking.status)) }]}
            onPress={() => onStatusUpdate(booking.id, getNextStatus(booking.status))}
          >
            <Text style={styles.statusButtonText}>
              {getNextStatusLabel(booking.status)}
            </Text>
            <Ionicons name="chevron-forward" size={18} color="#fff" />
          </TouchableOpacity>
        )}
      </View>

      {/* Notify Arrival Button */}
      {booking.status === 'arrived' && (
        <TouchableOpacity
          style={styles.notifyButton}
          onPress={() => onNotifyArrival(booking.id)}
        >
          <Ionicons name="notifications" size={18} color="#fff" />
          <Text style={styles.notifyButtonText}>Notify Customer</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
};

export default function JobsScreen({ navigation }) {
  const [bookings, setBookings] = useState({ today: [], upcoming: [], past: [] });
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('today');

  const fetchBookings = async () => {
    try {
      const data = await getBookings();
      setBookings(data);
    } catch (error) {
      console.error('Error fetching bookings:', error);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchBookings();
    setRefreshing(false);
  }, []);

  const handleStatusUpdate = async (bookingId, newStatus) => {
    try {
      await updateBookingStatus(bookingId, newStatus);
      await fetchBookings();
      Alert.alert('Success', `Status updated to ${BOOKING_STATUS_LABELS[newStatus]}`);
    } catch (error) {
      Alert.alert('Error', 'Failed to update status');
    }
  };

  const handleNavigate = (address) => {
    const url = Platform.select({
      ios: `maps://app?daddr=${encodeURIComponent(address)}`,
      android: `google.navigation:q=${encodeURIComponent(address)}`,
    });
    Linking.openURL(url).catch(() => {
      // Fallback to Google Maps web
      Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`);
    });
  };

  const handleCall = (phone) => {
    if (phone) {
      Linking.openURL(`tel:${phone}`);
    }
  };

  const handleChat = (booking) => {
    navigation.navigate('Chat', { booking });
  };

  const handleStartNavigation = (booking, destinationType) => {
    navigation.navigate('Navigation', { booking, destinationType });
  };

  const handleViewDetail = (booking) => {
    navigation.navigate('JobDetail', { booking, onRefresh: fetchBookings });
  };

  const handleNotifyArrival = async (bookingId) => {
    try {
      await notifyArrival(bookingId);
      Alert.alert('Success', 'Customer has been notified of your arrival');
    } catch (error) {
      Alert.alert('Error', 'Failed to send notification');
    }
  };

  const getActiveBookings = () => {
    switch (activeTab) {
      case 'today':
        return bookings.today || [];
      case 'upcoming':
        return bookings.upcoming || [];
      default:
        return [];
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Bookings</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'today' && styles.activeTab]}
          onPress={() => setActiveTab('today')}
        >
          <Text style={[styles.tabText, activeTab === 'today' && styles.activeTabText]}>
            Today ({bookings.today?.length || 0})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'upcoming' && styles.activeTab]}
          onPress={() => setActiveTab('upcoming')}
        >
          <Text style={[styles.tabText, activeTab === 'upcoming' && styles.activeTabText]}>
            Upcoming ({bookings.upcoming?.length || 0})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Bookings List */}
      <FlatList
        data={getActiveBookings()}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <BookingCard
            booking={item}
            onStatusUpdate={handleStatusUpdate}
            onNavigate={handleNavigate}
            onCall={handleCall}
            onChat={handleChat}
            onStartNavigation={handleStartNavigation}
            onViewDetail={handleViewDetail}
            onNotifyArrival={handleNotifyArrival}
          />
        )}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="car-outline" size={64} color={COLORS.textSecondary} />
            <Text style={styles.emptyText}>No {activeTab} bookings</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 8 : 16,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    padding: 4,
    margin: 16,
    borderRadius: 12,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 10,
  },
  activeTab: {
    backgroundColor: COLORS.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  activeTabText: {
    color: '#fff',
  },
  listContent: {
    padding: 16,
    paddingTop: 0,
  },
  bookingCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
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
  bookingIdContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bookingId: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  dateTimeContainer: {
    alignItems: 'flex-end',
  },
  dateText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  timeText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  customerName: {
    fontSize: 14,
    color: COLORS.text,
    flex: 1,
  },
  paxBadge: {
    backgroundColor: COLORS.info + '20',
    color: COLORS.info,
    fontSize: 10,
    fontWeight: '600',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  routeContainer: {
    marginBottom: 12,
  },
  routePoint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  routeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 5,
    marginRight: 10,
  },
  routeAddress: {
    flex: 1,
    fontSize: 13,
    color: COLORS.text,
    lineHeight: 18,
  },
  fareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    marginBottom: 12,
  },
  fareText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.success,
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  quickActions: {
    flexDirection: 'row',
    gap: 8,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 4,
  },
  statusButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  notifyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.info,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 12,
    gap: 8,
  },
  notifyButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
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
});
