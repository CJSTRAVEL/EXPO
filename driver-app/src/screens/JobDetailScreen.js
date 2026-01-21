import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Linking,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, BOOKING_STATUS_LABELS } from '../config';
import {
  updateBookingStatus,
  notifyArrival,
} from '../services/api';

const formatDateTime = (dateString) => {
  if (!dateString) return { date: 'N/A', time: 'N/A' };
  const date = new Date(dateString);
  return {
    date: date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
    time: date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
  };
};

export default function JobDetailScreen({ route, navigation }) {
  const { booking: initialBooking, onRefresh } = route.params;
  const [booking, setBooking] = useState(initialBooking);
  const [loading, setLoading] = useState(false);
  const [notifying, setNotifying] = useState(false);

  const { date, time } = formatDateTime(booking.booking_datetime);
  const customerName = `${booking.first_name || ''} ${booking.last_name || ''}`.trim() || 'Customer';

  const getStatusColor = (status) => {
    const colors = {
      pending: COLORS.warning,
      assigned: COLORS.info,
      on_way: '#8b5cf6',
      arrived: '#06b6d4',
      in_progress: COLORS.success,
      completed: '#10b981',
      cancelled: COLORS.danger,
    };
    return colors[status] || COLORS.pending;
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
      assigned: 'Start Journey to Pickup',
      on_way: 'Arrived at Pickup',
      arrived: 'Start Trip with Passenger',
      in_progress: 'Complete Trip',
    };
    return labels[currentStatus];
  };

  const getStatusIcon = (status) => {
    const icons = {
      assigned: 'checkmark-circle',
      on_way: 'car',
      arrived: 'location',
      in_progress: 'navigate',
      completed: 'flag',
    };
    return icons[status] || 'ellipse';
  };

  const handleStatusUpdate = async () => {
    const nextStatus = getNextStatus(booking.status);
    if (!nextStatus) return;

    const confirmMessage = {
      on_way: 'Start your journey to the pickup location?',
      arrived: 'Confirm you have arrived at the pickup location?',
      in_progress: 'Start the trip with the passenger?',
      completed: 'Mark this trip as completed?',
    };

    Alert.alert(
      'Update Status',
      confirmMessage[nextStatus],
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            setLoading(true);
            try {
              await updateBookingStatus(booking.id, nextStatus);
              setBooking({ ...booking, status: nextStatus });
              if (onRefresh) onRefresh();
              
              if (nextStatus === 'completed') {
                Alert.alert('Trip Completed', 'Great job! The trip has been marked as complete.', [
                  { text: 'OK', onPress: () => navigation.goBack() }
                ]);
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to update status. Please try again.');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleNotifyArrival = async () => {
    setNotifying(true);
    try {
      await notifyArrival(booking.id);
      Alert.alert('Success', 'Customer has been notified of your arrival');
    } catch (error) {
      Alert.alert('Error', 'Failed to send notification');
    } finally {
      setNotifying(false);
    }
  };

  const handleCall = () => {
    if (booking.customer_phone) {
      Linking.openURL(`tel:${booking.customer_phone}`);
    }
  };

  const handleSMS = () => {
    if (booking.customer_phone) {
      Linking.openURL(`sms:${booking.customer_phone}`);
    }
  };

  const handleNavigate = (address) => {
    const url = Platform.select({
      ios: `maps://app?daddr=${encodeURIComponent(address)}`,
      android: `google.navigation:q=${encodeURIComponent(address)}`,
    });
    Linking.openURL(url).catch(() => {
      Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`);
    });
  };

  const handleStartNavigation = (destinationType) => {
    navigation.navigate('Navigation', { booking, destinationType });
  };

  const renderStatusTimeline = () => {
    const statuses = ['assigned', 'on_way', 'arrived', 'in_progress', 'completed'];
    const currentIndex = statuses.indexOf(booking.status);

    return (
      <View style={styles.timeline}>
        {statuses.map((status, index) => {
          const isActive = index <= currentIndex;
          const isCurrent = index === currentIndex;
          return (
            <View key={status} style={styles.timelineItem}>
              <View style={[
                styles.timelineDot,
                isActive && styles.timelineDotActive,
                isCurrent && styles.timelineDotCurrent,
              ]}>
                {isActive && (
                  <Ionicons 
                    name={index < currentIndex ? 'checkmark' : getStatusIcon(status)} 
                    size={12} 
                    color="#fff" 
                  />
                )}
              </View>
              {index < statuses.length - 1 && (
                <View style={[
                  styles.timelineLine,
                  index < currentIndex && styles.timelineLineActive,
                ]} />
              )}
              <Text style={[
                styles.timelineLabel,
                isActive && styles.timelineLabelActive,
                isCurrent && styles.timelineLabelCurrent,
              ]}>
                {BOOKING_STATUS_LABELS[status]}
              </Text>
            </View>
          );
        })}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Status Header */}
        <View style={[styles.statusHeader, { backgroundColor: getStatusColor(booking.status) }]}>
          <View style={styles.statusContent}>
            <View style={styles.statusBadge}>
              <Ionicons name={getStatusIcon(booking.status)} size={20} color="#fff" />
              <Text style={styles.statusText}>
                {BOOKING_STATUS_LABELS[booking.status] || booking.status}
              </Text>
            </View>
            <Text style={styles.bookingId}>{booking.booking_id || 'N/A'}</Text>
          </View>
        </View>

        {/* Timeline */}
        {booking.status !== 'completed' && booking.status !== 'cancelled' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Progress</Text>
            {renderStatusTimeline()}
          </View>
        )}

        {/* Date & Time */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Schedule</Text>
          <View style={styles.card}>
            <View style={styles.scheduleRow}>
              <View style={styles.scheduleItem}>
                <Ionicons name="calendar-outline" size={20} color={COLORS.primary} />
                <View style={styles.scheduleInfo}>
                  <Text style={styles.scheduleLabel}>Date</Text>
                  <Text style={styles.scheduleValue}>{date}</Text>
                </View>
              </View>
              <View style={styles.scheduleItem}>
                <Ionicons name="time-outline" size={20} color={COLORS.primary} />
                <View style={styles.scheduleInfo}>
                  <Text style={styles.scheduleLabel}>Time</Text>
                  <Text style={styles.scheduleValue}>{time}</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Customer Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Customer</Text>
          <View style={styles.card}>
            <View style={styles.customerRow}>
              <View style={styles.customerInfo}>
                <Text style={styles.customerName}>{customerName}</Text>
                {booking.customer_phone && (
                  <Text style={styles.customerPhone}>{booking.customer_phone}</Text>
                )}
              </View>
              <View style={styles.customerActions}>
                <TouchableOpacity style={styles.actionButton} onPress={handleCall}>
                  <Ionicons name="call" size={20} color={COLORS.success} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionButton} onPress={handleSMS}>
                  <Ionicons name="chatbubble" size={20} color={COLORS.info} />
                </TouchableOpacity>
              </View>
            </View>
            {(booking.passenger_count > 1 || booking.luggage_count > 0) && (
              <View style={styles.paxRow}>
                {booking.passenger_count > 0 && (
                  <View style={styles.paxItem}>
                    <Ionicons name="people" size={16} color={COLORS.textSecondary} />
                    <Text style={styles.paxText}>{booking.passenger_count} PAX</Text>
                  </View>
                )}
                {booking.luggage_count > 0 && (
                  <View style={styles.paxItem}>
                    <Ionicons name="briefcase" size={16} color={COLORS.textSecondary} />
                    <Text style={styles.paxText}>{booking.luggage_count} Cases</Text>
                  </View>
                )}
              </View>
            )}
          </View>
        </View>

        {/* Route */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Route</Text>
          <View style={styles.card}>
            {/* Pickup */}
            <TouchableOpacity 
              style={styles.locationItem}
              onPress={() => handleNavigate(booking.pickup_location)}
            >
              <View style={styles.locationDotContainer}>
                <View style={[styles.locationDot, { backgroundColor: COLORS.success }]} />
                <View style={styles.locationLine} />
              </View>
              <View style={styles.locationInfo}>
                <Text style={styles.locationLabel}>PICKUP</Text>
                <Text style={styles.locationAddress}>{booking.pickup_location}</Text>
              </View>
              <Ionicons name="navigate" size={20} color={COLORS.info} />
            </TouchableOpacity>

            {/* Additional Stops */}
            {booking.additional_stops?.map((stop, index) => (
              <TouchableOpacity 
                key={index}
                style={styles.locationItem}
                onPress={() => handleNavigate(stop)}
              >
                <View style={styles.locationDotContainer}>
                  <View style={[styles.locationDot, { backgroundColor: COLORS.warning }]} />
                  <View style={styles.locationLine} />
                </View>
                <View style={styles.locationInfo}>
                  <Text style={styles.locationLabel}>STOP {index + 1}</Text>
                  <Text style={styles.locationAddress}>{stop}</Text>
                </View>
                <Ionicons name="navigate" size={20} color={COLORS.info} />
              </TouchableOpacity>
            ))}

            {/* Dropoff */}
            <TouchableOpacity 
              style={[styles.locationItem, styles.locationItemLast]}
              onPress={() => handleNavigate(booking.dropoff_location)}
            >
              <View style={styles.locationDotContainer}>
                <View style={[styles.locationDot, { backgroundColor: COLORS.danger }]} />
              </View>
              <View style={styles.locationInfo}>
                <Text style={styles.locationLabel}>DROP-OFF</Text>
                <Text style={styles.locationAddress}>{booking.dropoff_location}</Text>
              </View>
              <Ionicons name="navigate" size={20} color={COLORS.info} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Trip Info */}
        {(booking.distance_miles || booking.duration_minutes || booking.fare) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Trip Details</Text>
            <View style={styles.tripStatsRow}>
              {booking.distance_miles && (
                <View style={styles.tripStat}>
                  <Ionicons name="speedometer-outline" size={24} color={COLORS.info} />
                  <Text style={styles.tripStatValue}>{booking.distance_miles.toFixed(1)}</Text>
                  <Text style={styles.tripStatLabel}>miles</Text>
                </View>
              )}
              {booking.duration_minutes && (
                <View style={styles.tripStat}>
                  <Ionicons name="time-outline" size={24} color={COLORS.primary} />
                  <Text style={styles.tripStatValue}>{Math.round(booking.duration_minutes)}</Text>
                  <Text style={styles.tripStatLabel}>mins</Text>
                </View>
              )}
              {booking.fare && (
                <View style={styles.tripStat}>
                  <Ionicons name="cash-outline" size={24} color={COLORS.success} />
                  <Text style={styles.tripStatValue}>£{booking.fare.toFixed(2)}</Text>
                  <Text style={styles.tripStatLabel}>fare</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Notes */}
        {booking.notes && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <View style={styles.card}>
              <Text style={styles.notesText}>{booking.notes}</Text>
            </View>
          </View>
        )}

        {/* Flight Info */}
        {booking.flight_number && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Flight Information</Text>
            <View style={styles.card}>
              <View style={styles.flightRow}>
                <Ionicons name="airplane" size={20} color={COLORS.info} />
                <View style={styles.flightInfo}>
                  <Text style={styles.flightNumber}>{booking.flight_number}</Text>
                  {booking.flight_arrival_time && (
                    <Text style={styles.flightTime}>
                      Arrival: {new Date(booking.flight_arrival_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  )}
                </View>
              </View>
            </View>
          </View>
        )}

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Action Buttons */}
      {booking.status !== 'completed' && booking.status !== 'cancelled' && (
        <View style={styles.actionFooter}>
          {/* Navigation Buttons */}
          <View style={styles.navButtons}>
            <TouchableOpacity 
              style={[styles.navButton, { backgroundColor: COLORS.success + '20' }]}
              onPress={() => handleStartNavigation('pickup')}
            >
              <Ionicons name="location" size={20} color={COLORS.success} />
              <Text style={[styles.navButtonText, { color: COLORS.success }]}>Pickup</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.navButton, { backgroundColor: COLORS.danger + '20' }]}
              onPress={() => handleStartNavigation('dropoff')}
            >
              <Ionicons name="flag" size={20} color={COLORS.danger} />
              <Text style={[styles.navButtonText, { color: COLORS.danger }]}>Drop-off</Text>
            </TouchableOpacity>
          </View>

          {/* Notify Button (when arrived) */}
          {booking.status === 'arrived' && (
            <TouchableOpacity 
              style={styles.notifyButton}
              onPress={handleNotifyArrival}
              disabled={notifying}
            >
              {notifying ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Ionicons name="notifications" size={20} color="#fff" />
                  <Text style={styles.notifyButtonText}>Notify Customer</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {/* Status Update Button */}
          {getNextStatus(booking.status) && (
            <TouchableOpacity 
              style={[styles.statusButton, { backgroundColor: getStatusColor(getNextStatus(booking.status)) }]}
              onPress={handleStatusUpdate}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Text style={styles.statusButtonText}>{getNextStatusLabel(booking.status)}</Text>
                  <Ionicons name="arrow-forward" size={20} color="#fff" />
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollView: {
    flex: 1,
  },
  statusHeader: {
    padding: 24,
    paddingTop: 16,
  },
  statusContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  bookingId: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  section: {
    padding: 16,
    paddingBottom: 0,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  // Timeline styles
  timeline: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    paddingTop: 20,
  },
  timelineItem: {
    alignItems: 'center',
    flex: 1,
  },
  timelineDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  timelineDotActive: {
    backgroundColor: COLORS.success,
  },
  timelineDotCurrent: {
    backgroundColor: COLORS.primary,
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  timelineLine: {
    position: 'absolute',
    top: 12,
    left: '50%',
    width: '100%',
    height: 2,
    backgroundColor: COLORS.border,
    zIndex: 0,
  },
  timelineLineActive: {
    backgroundColor: COLORS.success,
  },
  timelineLabel: {
    fontSize: 9,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 6,
  },
  timelineLabelActive: {
    color: COLORS.text,
  },
  timelineLabelCurrent: {
    fontWeight: '600',
    color: COLORS.primary,
  },
  // Schedule styles
  scheduleRow: {
    flexDirection: 'row',
  },
  scheduleItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  scheduleInfo: {
    flex: 1,
  },
  scheduleLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
  },
  scheduleValue: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: 2,
  },
  // Customer styles
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  customerInfo: {
    flex: 1,
  },
  customerName: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
  },
  customerPhone: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  customerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  paxRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  paxItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  paxText: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  // Location styles
  locationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
  },
  locationItemLast: {
    paddingBottom: 0,
  },
  locationDotContainer: {
    alignItems: 'center',
    marginRight: 12,
  },
  locationDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  locationLine: {
    width: 2,
    height: 40,
    backgroundColor: COLORS.border,
    marginTop: 4,
  },
  locationInfo: {
    flex: 1,
  },
  locationLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.textSecondary,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  locationAddress: {
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 20,
  },
  // Trip stats styles
  tripStatsRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    justifyContent: 'space-around',
  },
  tripStat: {
    alignItems: 'center',
  },
  tripStatValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
    marginTop: 4,
  },
  tripStatLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  // Notes styles
  notesText: {
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 20,
  },
  // Flight styles
  flightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  flightInfo: {
    flex: 1,
  },
  flightNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  flightTime: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  // Footer styles
  bottomPadding: {
    height: 120,
  },
  actionFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.card,
    padding: 16,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: 10,
  },
  navButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  navButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 6,
  },
  navButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  notifyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.info,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  notifyButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  statusButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  statusButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
