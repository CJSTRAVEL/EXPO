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
  Modal,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { BOOKING_STATUS_LABELS } from '../config';
import {
  getBookings,
  updateBookingStatus,
  notifyArrival,
} from '../services/api';
import ActiveRideScreen from './ActiveRideScreen';

const formatDateTime = (dateString) => {
  const date = new Date(dateString);
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const isToday = date.toDateString() === now.toDateString();
  const isTomorrow = date.toDateString() === tomorrow.toDateString();
  
  let dateLabel = '';
  if (isToday) {
    dateLabel = 'TODAY';
  } else if (isTomorrow) {
    dateLabel = 'TOMORROW';
  } else {
    dateLabel = date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }
  
  return {
    dateLabel,
    time: date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
    fullDate: date.toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }),
  };
};

// Job Details Modal Component
const JobDetailsModal = ({ visible, booking, onClose, onStartRide, theme }) => {
  if (!visible || !booking) return null;

  const { dateLabel, time, fullDate } = formatDateTime(booking.booking_datetime);
  const customerName = `${booking.first_name || ''} ${booking.last_name || ''}`.trim() || 'Customer';
  const vehicleType = booking.vehicle_type_name || booking.vehicle_type || booking.vehicleType || 'Not specified';
  const isActiveRide = ['on_way', 'arrived', 'in_progress'].includes(booking.status);

  const handleCall = () => {
    if (booking.customer_phone) {
      Linking.openURL(`tel:${booking.customer_phone}`);
    } else {
      Alert.alert('No Phone', 'No phone number available for this booking');
    }
  };

  const handleNavigate = (address) => {
    const encodedAddress = encodeURIComponent(address);
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodedAddress}`);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.detailsModal, { backgroundColor: theme.background }]}>
          {/* Header */}
          <View style={[styles.detailsHeader, { borderBottomColor: theme.border }]}>
            <TouchableOpacity onPress={onClose} style={styles.detailsCloseBtn}>
              <Ionicons name="close" size={28} color={theme.text} />
            </TouchableOpacity>
            <Text style={[styles.detailsTitle, { color: theme.text }]}>Job Details</Text>
            <View style={{ width: 28 }} />
          </View>

          <ScrollView style={styles.detailsContent} showsVerticalScrollIndicator={false}>
            {/* Date & Time */}
            <View style={[styles.detailsSection, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <View style={styles.detailsRow}>
                <Ionicons name="calendar-outline" size={20} color={theme.primary} />
                <View style={styles.detailsRowContent}>
                  <Text style={[styles.detailsLabel, { color: theme.textSecondary }]}>Date & Time</Text>
                  <Text style={[styles.detailsValue, { color: theme.text }]}>{fullDate}</Text>
                  <Text style={[styles.detailsValueLarge, { color: theme.text }]}>{time}</Text>
                </View>
              </View>
            </View>

            {/* Customer Info */}
            <View style={[styles.detailsSection, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <View style={styles.detailsRow}>
                <Ionicons name="person-outline" size={20} color={theme.primary} />
                <View style={styles.detailsRowContent}>
                  <Text style={[styles.detailsLabel, { color: theme.textSecondary }]}>Passenger</Text>
                  <Text style={[styles.detailsValue, { color: theme.text }]}>{customerName}</Text>
                </View>
                {booking.customer_phone && (
                  <TouchableOpacity style={[styles.callButton, { backgroundColor: theme.success }]} onPress={handleCall}>
                    <Ionicons name="call" size={18} color="#fff" />
                  </TouchableOpacity>
                )}
              </View>
              {booking.customer_phone && (
                <Text style={[styles.detailsSubValue, { color: theme.textSecondary }]}>{booking.customer_phone}</Text>
              )}
              {booking.customer_email && (
                <Text style={[styles.detailsSubValue, { color: theme.textSecondary }]}>{booking.customer_email}</Text>
              )}
            </View>

            {/* Vehicle & Passengers */}
            <View style={[styles.detailsSection, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <View style={styles.detailsRow}>
                <Ionicons name="car-outline" size={20} color={theme.primary} />
                <View style={styles.detailsRowContent}>
                  <Text style={[styles.detailsLabel, { color: theme.textSecondary }]}>Vehicle Type</Text>
                  <Text style={[styles.detailsValue, { color: theme.text }]}>{vehicleType}</Text>
                </View>
              </View>
              <View style={styles.detailsInfoRow}>
                <View style={styles.detailsInfoItem}>
                  <Ionicons name="people" size={16} color={theme.textSecondary} />
                  <Text style={[styles.detailsInfoText, { color: theme.text }]}>{booking.passenger_count || 1} passengers</Text>
                </View>
                <View style={styles.detailsInfoItem}>
                  <Ionicons name="briefcase" size={16} color={theme.textSecondary} />
                  <Text style={[styles.detailsInfoText, { color: theme.text }]}>{booking.luggage_count || 0} luggage</Text>
                </View>
              </View>
            </View>

            {/* Pickup Location */}
            <View style={[styles.detailsSection, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <View style={styles.detailsRow}>
                <View style={[styles.locationDot, { backgroundColor: theme.success }]} />
                <View style={styles.detailsRowContent}>
                  <Text style={[styles.detailsLabel, { color: theme.textSecondary }]}>Pickup</Text>
                  <Text style={[styles.detailsAddress, { color: theme.text }]}>{booking.pickup_location}</Text>
                </View>
                <TouchableOpacity 
                  style={[styles.navButton, { backgroundColor: theme.primary }]} 
                  onPress={() => handleNavigate(booking.pickup_location)}
                >
                  <Ionicons name="navigate" size={18} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Additional Stops */}
            {booking.additional_stops?.length > 0 && (
              <View style={[styles.detailsSection, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <Text style={[styles.detailsLabel, { color: theme.textSecondary, marginBottom: 8 }]}>
                  Additional Stops ({booking.additional_stops.length})
                </Text>
                {booking.additional_stops.map((stop, index) => (
                  <View key={index} style={styles.stopItem}>
                    <View style={[styles.locationDot, { backgroundColor: theme.warning }]} />
                    <Text style={[styles.stopAddress, { color: theme.text }]}>{stop}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Dropoff Location */}
            <View style={[styles.detailsSection, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <View style={styles.detailsRow}>
                <View style={[styles.locationDot, { backgroundColor: theme.danger }]} />
                <View style={styles.detailsRowContent}>
                  <Text style={[styles.detailsLabel, { color: theme.textSecondary }]}>Drop-off</Text>
                  <Text style={[styles.detailsAddress, { color: theme.text }]}>{booking.dropoff_location}</Text>
                </View>
                <TouchableOpacity 
                  style={[styles.navButton, { backgroundColor: theme.primary }]} 
                  onPress={() => handleNavigate(booking.dropoff_location)}
                >
                  <Ionicons name="navigate" size={18} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Fare */}
            <View style={[styles.detailsSection, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <View style={styles.detailsRow}>
                <Ionicons name="cash-outline" size={20} color={theme.primary} />
                <View style={styles.detailsRowContent}>
                  <Text style={[styles.detailsLabel, { color: theme.textSecondary }]}>Fare</Text>
                  <Text style={[styles.fareValue, { color: theme.text }]}>£{(booking.fare || 0).toFixed(2)}</Text>
                </View>
              </View>
              {booking.payment_method && (
                <Text style={[styles.detailsSubValue, { color: theme.textSecondary }]}>
                  Payment: {booking.payment_method}
                </Text>
              )}
            </View>

            {/* Notes */}
            {booking.notes && (
              <View style={[styles.detailsSection, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <View style={styles.detailsRow}>
                  <Ionicons name="document-text-outline" size={20} color={theme.primary} />
                  <View style={styles.detailsRowContent}>
                    <Text style={[styles.detailsLabel, { color: theme.textSecondary }]}>Notes</Text>
                    <Text style={[styles.detailsValue, { color: theme.text }]}>{booking.notes}</Text>
                  </View>
                </View>
              </View>
            )}

            {/* Flight Info */}
            {booking.flight_number && (
              <View style={[styles.detailsSection, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <View style={styles.detailsRow}>
                  <Ionicons name="airplane-outline" size={20} color={theme.primary} />
                  <View style={styles.detailsRowContent}>
                    <Text style={[styles.detailsLabel, { color: theme.textSecondary }]}>Flight</Text>
                    <Text style={[styles.detailsValue, { color: theme.text }]}>{booking.flight_number}</Text>
                  </View>
                </View>
              </View>
            )}
          </ScrollView>

          {/* Start Ride Button */}
          {!isActiveRide && (
            <View style={styles.detailsFooter}>
              <TouchableOpacity 
                style={[styles.startRideFullBtn, { backgroundColor: theme.primary }]}
                onPress={onStartRide}
              >
                <Ionicons name="car" size={22} color="#fff" />
                <Text style={styles.startRideBtnText}>Start Ride</Text>
              </TouchableOpacity>
            </View>
          )}
          {isActiveRide && (
            <View style={styles.detailsFooter}>
              <TouchableOpacity 
                style={[styles.startRideFullBtn, { backgroundColor: theme.success }]}
                onPress={onStartRide}
              >
                <Ionicons name="eye" size={22} color="#fff" />
                <Text style={styles.startRideBtnText}>View Active Ride</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const BookingCard = ({ booking, theme, onStatusUpdate, onViewDetail }) => {
  const { dateLabel, time } = formatDateTime(booking.booking_datetime);
  
  const getVehicleTypeDisplay = () => {
    // Check all possible fields for vehicle type
    return booking.vehicle_type_name || booking.vehicle_type || booking.vehicleType || 'Unknown';
  };

  const getStartButtonLabel = (currentStatus) => {
    const labels = {
      assigned: 'View Details',
      on_way: 'View Ride',
      arrived: 'View Ride',
      in_progress: 'View Ride',
    };
    return labels[currentStatus] || 'View Details';
  };

  const handleCardPress = () => {
    onViewDetail(booking, 'details');
  };

  const handleButtonPress = () => {
    onViewDetail(booking, 'action');
  };

  const isActiveRide = ['on_way', 'arrived', 'in_progress'].includes(booking.status);

  return (
    <TouchableOpacity 
      style={[
        styles.bookingCard, 
        { backgroundColor: theme.card },
        isActiveRide && { borderColor: theme.primary, borderWidth: 2 }
      ]}
      onPress={() => onViewDetail(booking)}
      activeOpacity={0.7}
    >
      {/* Header Row - Time and Price */}
      <View style={styles.cardHeader}>
        <View style={styles.timeContainer}>
          <Text style={[styles.timeText, { color: theme.text }]}>{time}</Text>
          <Text style={[styles.dateLabel, { color: theme.textSecondary }]}>{dateLabel}</Text>
        </View>
        <Text style={[styles.fareText, { color: theme.text }]}>
          £{(booking.fare || 0).toFixed(2)}
        </Text>
      </View>

      {/* Vehicle Type Badge */}
      <View style={styles.badgeRow}>
        <View style={[styles.vehicleBadge, { backgroundColor: theme.primary }]}>
          <Text style={styles.vehicleBadgeText}>{getVehicleTypeDisplay()}</Text>
        </View>
        {booking.passenger_count > 0 && (
          <View style={[styles.paxBadge, { backgroundColor: theme.info }]}>
            <Ionicons name="people" size={12} color="#fff" />
            <Text style={styles.paxText}>{booking.passenger_count}</Text>
          </View>
        )}
        {booking.luggage_count > 0 && (
          <View style={[styles.luggageBadge, { backgroundColor: theme.warning }]}>
            <Ionicons name="briefcase" size={12} color="#fff" />
            <Text style={styles.luggageText}>{booking.luggage_count}</Text>
          </View>
        )}
        {/* Status indicator dot */}
        <View style={[
          styles.statusDot, 
          { backgroundColor: booking.status === 'assigned' ? theme.danger : theme.success }
        ]} />
      </View>

      {/* Route Information */}
      <View style={styles.routeContainer}>
        {/* Pickup */}
        <View style={styles.routeRow}>
          <View style={styles.routeLineContainer}>
            <View style={[styles.routeDotStart, { backgroundColor: theme.success }]} />
            <View style={[styles.routeLine, { backgroundColor: theme.border }]} />
          </View>
          <Text style={[styles.routeAddress, { color: theme.text }]} numberOfLines={2}>
            {booking.pickup_location}
          </Text>
        </View>

        {/* Additional Stops */}
        {booking.additional_stops?.length > 0 && (
          <View style={styles.stopsIndicator}>
            <Text style={[styles.stopsText, { color: theme.textSecondary }]}>
              +{booking.additional_stops.length} stop{booking.additional_stops.length > 1 ? 's' : ''}
            </Text>
          </View>
        )}

        {/* Dropoff */}
        <View style={styles.routeRow}>
          <View style={styles.routeLineContainer}>
            <View style={[styles.routeDotEnd, { backgroundColor: theme.danger }]} />
          </View>
          <Text style={[styles.routeAddress, { color: theme.text }]} numberOfLines={2}>
            {booking.dropoff_location}
          </Text>
        </View>
      </View>

      {/* Start Ride Button */}
      {booking.status !== 'completed' && booking.status !== 'cancelled' && (
        <TouchableOpacity
          style={[styles.startRideButton, { backgroundColor: theme.primary }]}
          onPress={handleStartRide}
        >
          <Text style={styles.startRideText}>{getStartButtonLabel(booking.status)}</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
};

export default function JobsScreen({ navigation }) {
  const { theme } = useTheme();
  const [bookings, setBookings] = useState({ today: [], upcoming: [], past: [] });
  const [refreshing, setRefreshing] = useState(false);
  const [activeRide, setActiveRide] = useState(null);
  const [rideMinimized, setRideMinimized] = useState(false);

  const fetchBookings = async () => {
    try {
      const data = await getBookings();
      setBookings(data);
      
      // Check for active ride (on_way, arrived, or in_progress status)
      const allBookings = [...(data.today || []), ...(data.upcoming || [])];
      const activeBooking = allBookings.find(b => 
        ['on_way', 'arrived', 'in_progress'].includes(b.status)
      );
      if (activeBooking && !activeRide) {
        setActiveRide(activeBooking);
      }
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

  const handleStartRide = (booking) => {
    // Start the ride - set status to on_way
    updateBookingStatus(booking.id, 'on_way')
      .then(() => {
        setActiveRide({...booking, status: 'on_way'});
        setRideMinimized(false);
        fetchBookings();
      })
      .catch(() => Alert.alert('Error', 'Failed to start ride'));
  };

  const handleViewDetail = (booking) => {
    // If booking is already active, show active ride screen
    if (['on_way', 'arrived', 'in_progress'].includes(booking.status)) {
      setActiveRide(booking);
      setRideMinimized(false);
    } else {
      // For assigned bookings, offer to start the ride
      Alert.alert(
        'Start Ride',
        `Start ride to ${booking.first_name} ${booking.last_name}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Start', onPress: () => handleStartRide(booking) }
        ]
      );
    }
  };

  const handleRideComplete = () => {
    setActiveRide(null);
    setRideMinimized(false);
    fetchBookings();
  };

  // Combine today and upcoming, filter out completed/cancelled, sort by datetime
  const getAllBookings = () => {
    const all = [...(bookings.today || []), ...(bookings.upcoming || [])];
    // Filter out completed and cancelled bookings
    const activeBookings = all.filter(b => !['completed', 'cancelled'].includes(b.status));
    return activeBookings.sort((a, b) => new Date(a.booking_datetime) - new Date(b.booking_datetime));
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Upcoming</Text>
      </View>

      {/* Bookings List */}
      <FlatList
        data={getAllBookings()}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <BookingCard
            booking={item}
            theme={theme}
            onStatusUpdate={handleStatusUpdate}
            onViewDetail={handleViewDetail}
          />
        )}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh}
            tintColor={theme.primary}
          />
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="calendar-outline" size={64} color={theme.textSecondary} />
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No upcoming bookings</Text>
            <Text style={[styles.emptySubtext, { color: theme.textSecondary }]}>
              Your assigned bookings will appear here
            </Text>
          </View>
        }
      />

      {/* Active Ride Screen */}
      <ActiveRideScreen
        visible={!!activeRide}
        booking={activeRide}
        isMinimized={rideMinimized}
        onClose={() => { setActiveRide(null); setRideMinimized(false); }}
        onMinimize={() => setRideMinimized(!rideMinimized)}
        onComplete={handleRideComplete}
      />
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
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  listContent: {
    padding: 16,
    paddingTop: 0,
  },
  bookingCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
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
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  timeText: {
    fontSize: 28,
    fontWeight: '300',
  },
  dateLabel: {
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  fareText: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  vehicleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 4,
  },
  vehicleBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  paxBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 4,
  },
  paxText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  luggageBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 4,
  },
  luggageText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginLeft: 'auto',
  },
  routeContainer: {
    marginBottom: 16,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  routeLineContainer: {
    width: 20,
    alignItems: 'center',
    marginRight: 12,
  },
  routeDotStart: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  routeLine: {
    width: 2,
    height: 30,
    marginVertical: 4,
  },
  routeDotEnd: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  routeAddress: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  stopsIndicator: {
    marginLeft: 32,
    marginVertical: 4,
  },
  stopsText: {
    fontSize: 12,
  },
  startRideButton: {
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  startRideText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    marginTop: 4,
  },
});
