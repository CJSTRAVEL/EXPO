import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Animated,
  PanResponder,
  Dimensions,
  Linking,
  Alert,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { updateBookingStatus } from '../services/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.6;

// Swipe Button Component
const SwipeButton = ({ onSwipeComplete, text, color = '#2196F3' }) => {
  const pan = useRef(new Animated.Value(0)).current;
  const [swiping, setSwiping] = useState(false);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        setSwiping(true);
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dx > 0 && gestureState.dx < SCREEN_WIDTH - 100) {
          pan.setValue(gestureState.dx);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        setSwiping(false);
        if (gestureState.dx > SWIPE_THRESHOLD) {
          Animated.spring(pan, {
            toValue: SCREEN_WIDTH - 100,
            useNativeDriver: false,
          }).start(() => {
            onSwipeComplete();
            pan.setValue(0);
          });
        } else {
          Animated.spring(pan, {
            toValue: 0,
            useNativeDriver: false,
          }).start();
        }
      },
    })
  ).current;

  const backgroundColor = pan.interpolate({
    inputRange: [0, SWIPE_THRESHOLD],
    outputRange: [color, '#4CAF50'],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.swipeContainer}>
      <Animated.View style={[styles.swipeTrack, { backgroundColor }]}>
        <Animated.View
          style={[styles.swipeButton, { transform: [{ translateX: pan }] }]}
          {...panResponder.panHandlers}
        >
          <Ionicons name="chevron-forward" size={24} color={color} />
          <Ionicons name="chevron-forward" size={24} color={color} style={{ marginLeft: -12 }} />
        </Animated.View>
        <Text style={styles.swipeText}>{text}</Text>
      </Animated.View>
    </View>
  );
};

// Ride Details Modal Component
const RideDetailsModal = ({ visible, onClose, booking, theme }) => {
  if (!visible || !booking) return null;

  const customerName = `${booking.first_name || ''} ${booking.last_name || ''}`.trim() || 'Customer';
  const fare = booking.fare || 0;
  const deposit = booking.deposit_paid || 0;
  const balanceDue = Math.max(0, fare - deposit);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.menuOverlay}>
        <View style={[styles.detailsContainer, { backgroundColor: theme.background }]}>
          <View style={styles.detailsHeader}>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="arrow-back" size={28} color={theme.text} />
            </TouchableOpacity>
            <Text style={[styles.detailsTitle, { color: theme.text }]}>Ride Details</Text>
            <View style={{ width: 28 }} />
          </View>

          <ScrollView style={styles.detailsContent}>
            {/* Customer Info */}
            <View style={[styles.detailsSection, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Text style={[styles.detailsSectionTitle, { color: theme.textSecondary }]}>PASSENGER</Text>
              <Text style={[styles.detailsValue, { color: theme.text }]}>{customerName}</Text>
              {booking.customer_phone && (
                <Text style={[styles.detailsSubValue, { color: theme.textSecondary }]}>{booking.customer_phone}</Text>
              )}
            </View>

            {/* Journey Info */}
            <View style={[styles.detailsSection, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Text style={[styles.detailsSectionTitle, { color: theme.textSecondary }]}>JOURNEY</Text>
              <View style={styles.journeyRow}>
                <View style={[styles.locationDot, { backgroundColor: '#4CAF50' }]} />
                <View style={styles.journeyContent}>
                  <Text style={[styles.journeyLabel, { color: theme.textSecondary }]}>Pickup</Text>
                  <Text style={[styles.journeyAddress, { color: theme.text }]}>{booking.pickup_location}</Text>
                </View>
              </View>
              
              {booking.additional_stops?.length > 0 && booking.additional_stops.map((stop, index) => (
                <View key={index} style={styles.journeyRow}>
                  <View style={[styles.locationDot, { backgroundColor: '#FF9800' }]} />
                  <View style={styles.journeyContent}>
                    <Text style={[styles.journeyLabel, { color: theme.textSecondary }]}>Stop {index + 1}</Text>
                    <Text style={[styles.journeyAddress, { color: theme.text }]}>{stop}</Text>
                  </View>
                </View>
              ))}

              <View style={styles.journeyRow}>
                <View style={[styles.locationDot, { backgroundColor: '#F44336' }]} />
                <View style={styles.journeyContent}>
                  <Text style={[styles.journeyLabel, { color: theme.textSecondary }]}>Drop-off</Text>
                  <Text style={[styles.journeyAddress, { color: theme.text }]}>{booking.dropoff_location}</Text>
                </View>
              </View>
            </View>

            {/* Fare Info */}
            <View style={[styles.detailsSection, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Text style={[styles.detailsSectionTitle, { color: theme.textSecondary }]}>PAYMENT</Text>
              <View style={styles.fareRow}>
                <Text style={[styles.fareLabel, { color: theme.text }]}>Total Fare</Text>
                <Text style={[styles.fareValue, { color: theme.text }]}>£{fare.toFixed(2)}</Text>
              </View>
              {deposit > 0 && (
                <View style={styles.fareRow}>
                  <Text style={[styles.fareLabel, { color: theme.textSecondary }]}>Deposit Paid</Text>
                  <Text style={[styles.fareValue, { color: '#4CAF50' }]}>-£{deposit.toFixed(2)}</Text>
                </View>
              )}
              <View style={[styles.fareRow, styles.balanceRow]}>
                <Text style={[styles.fareLabel, { color: theme.text, fontWeight: '700' }]}>Balance Due</Text>
                <Text style={[styles.fareValueLarge, { color: '#D4A853' }]}>£{balanceDue.toFixed(2)}</Text>
              </View>
              <Text style={[styles.paymentMethod, { color: theme.textSecondary }]}>
                Payment: {booking.payment_method || 'Cash'}
              </Text>
            </View>

            {/* Driver Notes */}
            {booking.driver_notes && (
              <View style={[styles.detailsSection, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <Text style={[styles.detailsSectionTitle, { color: theme.textSecondary }]}>DRIVER NOTES</Text>
                <Text style={[styles.notesText, { color: theme.text }]}>{booking.driver_notes}</Text>
              </View>
            )}

            {/* Flight Info */}
            {booking.flight_info?.flight_number && (
              <View style={[styles.detailsSection, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <Text style={[styles.detailsSectionTitle, { color: theme.textSecondary }]}>FLIGHT INFO</Text>
                <Text style={[styles.detailsValue, { color: theme.text }]}>{booking.flight_info.flight_number}</Text>
                {booking.flight_info.airline && (
                  <Text style={[styles.detailsSubValue, { color: theme.textSecondary }]}>{booking.flight_info.airline}</Text>
                )}
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

// Ride Menu Component
const RideMenu = ({ visible, onClose, booking, onCallPassenger, onTextPassenger, onRequestOfficeCall, onShowDetails, theme }) => {
  if (!visible) return null;

  const menuItems = [
    { icon: 'document-text-outline', label: 'Ride Details', onPress: () => { onShowDetails(); onClose(); } },
    { icon: 'call-outline', label: 'Call Passenger', onPress: () => { onCallPassenger(); onClose(); } },
    { icon: 'chatbox-outline', label: 'Text Passenger', onPress: () => { onTextPassenger(); onClose(); } },
    { icon: 'call-outline', label: 'Request Call From Office', onPress: () => { onRequestOfficeCall(); onClose(); } },
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.menuOverlay}>
        <View style={[styles.menuContainer, { backgroundColor: theme.background }]}>
          <TouchableOpacity style={styles.menuBackButton} onPress={onClose}>
            <Ionicons name="arrow-back" size={28} color={theme.text} />
          </TouchableOpacity>
          
          <Text style={[styles.menuTitle, { color: theme.text }]}>Ride Menu</Text>
          
          <View style={styles.menuItems}>
            {menuItems.map((item, index) => (
              <TouchableOpacity
                key={index}
                style={[styles.menuItem, { borderColor: theme.border }]}
                onPress={item.onPress}
              >
                <Ionicons name={item.icon} size={24} color={theme.text} />
                <Text style={[styles.menuItemText, { color: theme.text }]}>{item.label}</Text>
                <Ionicons name="arrow-forward" size={20} color={theme.textSecondary} />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
};

// Main Active Ride Screen
const ActiveRideScreen = ({ 
  visible, 
  booking, 
  onClose, 
  onMinimize,
  onComplete,
  isMinimized 
}) => {
  const { theme } = useTheme();
  const [stage, setStage] = useState('enroute'); // enroute, arrived, completing
  const [showMenu, setShowMenu] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rating, setRating] = useState(0);
  const [currentStopIndex, setCurrentStopIndex] = useState(0);

  useEffect(() => {
    if (booking) {
      // Set stage based on booking status
      if (booking.status === 'arrived') {
        setStage('arrived');
      } else if (booking.status === 'in_progress') {
        setStage('completing');
      } else {
        setStage('enroute');
      }
    }
  }, [booking]);

  const formatTime = (datetime) => {
    if (!datetime) return '--:--';
    try {
      const date = new Date(datetime);
      return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '--:--';
    }
  };

  // Get current destination based on stage and stop index
  const getCurrentDestination = () => {
    if (!booking) return { label: 'Destination', address: '' };
    
    if (stage === 'enroute') {
      return { label: 'Pickup', address: booking.pickup_location };
    }
    
    // After arrival - navigate through stops then to final destination
    const stops = booking.additional_stops || [];
    if (currentStopIndex < stops.length) {
      return { label: `Stop ${currentStopIndex + 1}`, address: stops[currentStopIndex] };
    }
    
    return { label: 'Drop Off', address: booking.dropoff_location };
  };

  const handleArrival = async () => {
    setLoading(true);
    try {
      await updateBookingStatus(booking.id, 'arrived');
      setStage('arrived');
      setCurrentStopIndex(0);
    } catch (error) {
      Alert.alert('Error', 'Failed to update status');
    } finally {
      setLoading(false);
    }
  };

  const handleStartJourney = async () => {
    setLoading(true);
    try {
      await updateBookingStatus(booking.id, 'in_progress');
      setStage('completing');
    } catch (error) {
      Alert.alert('Error', 'Failed to start journey');
    } finally {
      setLoading(false);
    }
  };

  const handleNextStop = () => {
    const stops = booking.additional_stops || [];
    if (currentStopIndex < stops.length) {
      setCurrentStopIndex(currentStopIndex + 1);
    }
  };

  const handleComplete = async () => {
    setLoading(true);
    try {
      await updateBookingStatus(booking.id, 'completed');
      if (onComplete) onComplete();
      onClose();
    } catch (error) {
      Alert.alert('Error', 'Failed to complete booking');
    } finally {
      setLoading(false);
    }
  };

  const handleCallPassenger = () => {
    if (booking?.customer_phone) {
      Linking.openURL(`tel:${booking.customer_phone}`);
    } else {
      Alert.alert('No Phone', 'No phone number available');
    }
  };

  const handleTextPassenger = () => {
    if (booking?.customer_phone) {
      Linking.openURL(`sms:${booking.customer_phone}`);
    } else {
      Alert.alert('No Phone', 'No phone number available');
    }
  };

  const handleRequestOfficeCall = () => {
    Alert.alert('Request Sent', 'Office will call you shortly');
  };

  const handleSendReceipt = () => {
    Alert.alert('Receipt Sent', 'Payment receipt has been sent to the passenger');
  };

  if (!visible || !booking) return null;

  // Calculate fare info
  const fare = booking.fare || 0;
  const deposit = booking.deposit_paid || 0;
  const balanceDue = Math.max(0, fare - deposit);
  const currentDest = getCurrentDestination();
  const stops = booking.additional_stops || [];
  const hasMoreStops = stage === 'completing' && currentStopIndex < stops.length;

  // Minimized view
  if (isMinimized) {
    return (
      <TouchableOpacity 
        style={[styles.minimizedBar, { backgroundColor: theme.primary }]}
        onPress={onMinimize}
      >
        <View style={styles.minimizedContent}>
          <Ionicons name="car" size={20} color="#fff" />
          <Text style={styles.minimizedText}>
            {stage === 'enroute' ? 'EnRoute to Passenger' : 
             stage === 'arrived' ? 'Passenger Pickup' : 'Journey in Progress'}
          </Text>
        </View>
        <Ionicons name="chevron-up" size={24} color="#fff" />
      </TouchableOpacity>
    );
  }

  const customerName = `${booking.first_name || ''} ${booking.last_name || ''}`.trim() || 'Customer';

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onMinimize}>
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: '#333' }]}>
          <TouchableOpacity onPress={onMinimize} style={styles.closeButton}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {stage === 'enroute' ? 'EnRoute to Passenger' : 
             stage === 'arrived' ? 'Passenger Pickup' : 'Journey Completion'}
          </Text>
          <View style={styles.onlineIndicator} />
        </View>

        {/* Content */}
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {stage === 'completing' ? (
            // Journey Completion View
            <View style={styles.completionContainer}>
              {/* Price Display */}
              <View style={[styles.priceCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <Text style={[styles.priceLabel, { color: theme.textSecondary }]}>Balance Due</Text>
                <Text style={[styles.priceValue, { color: '#D4A853' }]}>£{balanceDue.toFixed(2)}</Text>
                {deposit > 0 && (
                  <Text style={[styles.depositNote, { color: '#4CAF50' }]}>
                    (£{deposit.toFixed(2)} deposit already paid)
                  </Text>
                )}
                <Text style={[styles.paymentMethodText, { color: theme.textSecondary }]}>
                  Payment: {booking.payment_method || 'Cash'}
                </Text>
              </View>

              <View style={[styles.completionCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <View style={styles.completionHeader}>
                  <View style={styles.customerAvatar}>
                    <Ionicons name="person" size={40} color="#999" />
                  </View>
                  <View style={styles.ratingContainer}>
                    <Text style={[styles.customerNameLarge, { color: theme.text }]}>{customerName}</Text>
                    <View style={styles.stars}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <TouchableOpacity key={star} onPress={() => setRating(star)}>
                          <Ionicons 
                            name={rating >= star ? 'star' : 'star-outline'} 
                            size={32} 
                            color={rating >= star ? '#FFD700' : '#ccc'} 
                          />
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                </View>
              </View>

              <TouchableOpacity 
                style={[styles.receiptButton, { backgroundColor: '#0097A7' }]}
                onPress={handleSendReceipt}
              >
                <Ionicons name="mail-outline" size={24} color="#fff" />
                <Text style={styles.receiptButtonText}>Send Payment Receipt</Text>
              </TouchableOpacity>
            </View>
          ) : (
            // EnRoute / Arrived View
            <>
              {/* Action Buttons Row */}
              <View style={styles.actionRow}>
                <TouchableOpacity style={styles.actionButton}>
                  <Ionicons name="navigate" size={28} color="#666" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionButton} onPress={() => setShowMenu(true)}>
                  <Ionicons name="menu" size={28} color="#666" />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionButton, styles.alertButton]}>
                  <Ionicons name="alert-circle" size={28} color="#fff" />
                </TouchableOpacity>
              </View>

              {/* Price Display - Show when arrived or in progress */}
              {(stage === 'arrived' || stage === 'completing') && fare > 0 && (
                <View style={[styles.priceCardSmall, { backgroundColor: '#D4A853' }]}>
                  <Text style={styles.priceCardLabel}>Balance Due</Text>
                  <Text style={styles.priceCardValue}>£{balanceDue.toFixed(2)}</Text>
                </View>
              )}

              {/* Booking Info Card */}
              <View style={[styles.infoCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <View style={styles.infoRow}>
                  <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Name</Text>
                  {/* Notes Button */}
                  <TouchableOpacity 
                    style={[styles.notesButton, booking.driver_notes ? { backgroundColor: '#D4A853' } : {}]} 
                    onPress={() => setShowDetails(true)}
                  >
                    <Ionicons 
                      name="document-text-outline" 
                      size={24} 
                      color={booking.driver_notes ? '#fff' : '#999'} 
                    />
                  </TouchableOpacity>
                </View>
                <Text style={[styles.customerName, { color: theme.text }]}>{customerName}</Text>

                {/* Current Destination - Progressive Display */}
                <View style={styles.pickupSection}>
                  <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>
                    {currentDest.label}
                  </Text>
                  <View style={styles.timeContainer}>
                    <View style={styles.timeBadge}>
                      <Ionicons name="time-outline" size={16} color="#E53935" />
                      <Text style={styles.timeText}>{formatTime(booking.booking_datetime)}</Text>
                    </View>
                  </View>
                </View>
                <Text style={[styles.addressText, { color: theme.text }]}>
                  {currentDest.address}
                </Text>

                {/* Show stops progress indicator */}
                {stops.length > 0 && stage !== 'enroute' && (
                  <View style={styles.stopsProgress}>
                    <Text style={[styles.stopsProgressText, { color: theme.textSecondary }]}>
                      {currentStopIndex < stops.length 
                        ? `Stop ${currentStopIndex + 1} of ${stops.length}` 
                        : `Final destination`}
                    </Text>
                  </View>
                )}
              </View>
            </>
          )}
        </ScrollView>

        {/* Bottom Swipe Action */}
        <View style={styles.bottomAction}>
          {stage === 'enroute' && (
            <SwipeButton 
              text="Swipe on Arrival" 
              onSwipeComplete={handleArrival}
              color="#2196F3"
            />
          )}
          {stage === 'arrived' && (
            <SwipeButton 
              text="Swipe to Start Journey" 
              onSwipeComplete={handleStartJourney}
              color="#4CAF50"
            />
          )}
          {stage === 'completing' && hasMoreStops && (
            <SwipeButton 
              text={`Swipe: Arrived at Stop ${currentStopIndex + 1}`}
              onSwipeComplete={handleNextStop}
              color="#FF9800"
            />
          )}
          {stage === 'completing' && !hasMoreStops && (
            <SwipeButton 
              text="Swipe To Complete" 
              onSwipeComplete={handleComplete}
              color="#2196F3"
            />
          )}
        </View>

        {/* Ride Menu */}
        <RideMenu
          visible={showMenu}
          onClose={() => setShowMenu(false)}
          booking={booking}
          onCallPassenger={handleCallPassenger}
          onTextPassenger={handleTextPassenger}
          onRequestOfficeCall={handleRequestOfficeCall}
          onShowDetails={() => setShowDetails(true)}
          theme={theme}
        />

        {/* Ride Details Modal */}
        <RideDetailsModal
          visible={showDetails}
          onClose={() => setShowDetails(false)}
          booking={booking}
          theme={theme}
        />
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  closeButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
  },
  onlineIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#4CAF50',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginBottom: 16,
  },
  actionButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  alertButton: {
    backgroundColor: '#E53935',
  },
  priceCardSmall: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  priceCardLabel: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  priceCardValue: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
  },
  infoCard: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  notesButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  customerName: {
    fontSize: 24,
    fontWeight: '700',
    marginTop: 4,
  },
  pickupSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFEBEE',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  timeText: {
    color: '#E53935',
    fontWeight: '600',
  },
  addressText: {
    fontSize: 16,
    marginTop: 8,
    lineHeight: 22,
  },
  stopsProgress: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  stopsProgressText: {
    fontSize: 12,
    fontWeight: '600',
  },
  // Completion styles
  completionContainer: {
    alignItems: 'center',
  },
  priceCard: {
    width: '100%',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: 16,
  },
  priceLabel: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  priceValue: {
    fontSize: 48,
    fontWeight: '700',
    marginVertical: 8,
  },
  depositNote: {
    fontSize: 14,
    fontWeight: '500',
  },
  paymentMethodText: {
    fontSize: 12,
    marginTop: 8,
  },
  completionCard: {
    width: '100%',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    marginBottom: 16,
  },
  completionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  customerAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ratingContainer: {
    flex: 1,
  },
  customerNameLarge: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  stars: {
    flexDirection: 'row',
    gap: 4,
  },
  receiptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
    gap: 8,
    width: '100%',
  },
  receiptButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  // Bottom action
  bottomAction: {
    padding: 16,
    paddingBottom: 30,
  },
  // Swipe styles
  swipeContainer: {
    width: '100%',
    height: 60,
  },
  swipeTrack: {
    flex: 1,
    borderRadius: 30,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  swipeButton: {
    width: 50,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    zIndex: 1,
  },
  swipeText: {
    flex: 1,
    textAlign: 'center',
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: -50,
  },
  // Minimized bar
  minimizedBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  minimizedContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  minimizedText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  // Menu styles
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  menuContainer: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
  },
  menuBackButton: {
    marginBottom: 16,
  },
  menuTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 24,
  },
  menuItems: {
    gap: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  menuItemText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
  },
  // Details modal styles
  detailsContainer: {
    flex: 1,
    marginTop: 50,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  detailsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  detailsTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  detailsContent: {
    flex: 1,
    padding: 16,
  },
  detailsSection: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  detailsSectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  detailsValue: {
    fontSize: 18,
    fontWeight: '600',
  },
  detailsSubValue: {
    fontSize: 14,
    marginTop: 4,
  },
  journeyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  locationDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 4,
    marginRight: 12,
  },
  journeyContent: {
    flex: 1,
  },
  journeyLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  journeyAddress: {
    fontSize: 15,
    marginTop: 2,
  },
  fareRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  balanceRow: {
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 8,
    marginTop: 4,
  },
  fareLabel: {
    fontSize: 15,
  },
  fareValue: {
    fontSize: 15,
    fontWeight: '600',
  },
  fareValueLarge: {
    fontSize: 24,
    fontWeight: '700',
  },
  paymentMethod: {
    fontSize: 12,
    marginTop: 8,
  },
  notesText: {
    fontSize: 15,
    lineHeight: 22,
  },
});

export default ActiveRideScreen;
