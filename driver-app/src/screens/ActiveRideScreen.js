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

// Ride Menu Component
const RideMenu = ({ visible, onClose, booking, onCallPassenger, onTextPassenger, onRequestOfficeCall, theme }) => {
  if (!visible) return null;

  const menuItems = [
    { icon: 'document-text-outline', label: 'Ride Details', onPress: () => { onClose(); } },
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
  const [loading, setLoading] = useState(false);
  const [rating, setRating] = useState(0);

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

  const handleArrival = async () => {
    setLoading(true);
    try {
      await updateBookingStatus(booking.id, 'arrived');
      setStage('arrived');
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

              {/* Booking Info Card */}
              <View style={[styles.infoCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <View style={styles.infoRow}>
                  <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Name</Text>
                  <TouchableOpacity style={styles.notesButton}>
                    <Ionicons name="document-text-outline" size={24} color="#999" />
                  </TouchableOpacity>
                </View>
                <Text style={[styles.customerName, { color: theme.text }]}>{customerName}</Text>

                <View style={styles.pickupSection}>
                  <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>
                    {stage === 'arrived' ? 'Drop Off' : 'Pickup'}
                  </Text>
                  <View style={styles.timeContainer}>
                    <View style={styles.timeBadge}>
                      <Ionicons name="time-outline" size={16} color="#E53935" />
                      <Text style={styles.timeText}>{formatTime(booking.booking_datetime)}</Text>
                    </View>
                  </View>
                </View>
                <Text style={[styles.addressText, { color: theme.text }]}>
                  {stage === 'arrived' ? booking.dropoff_location : booking.pickup_location}
                </Text>

                {stage === 'enroute' && (
                  <>
                    <Text style={[styles.infoLabel, { color: theme.textSecondary, marginTop: 16 }]}>Drop Off</Text>
                    <Text style={[styles.addressText, { color: theme.text }]}>{booking.dropoff_location}</Text>
                  </>
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
          {stage === 'completing' && (
            <SwipeButton 
              text="Swipe To Exit" 
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
    fontStyle: 'italic',
    color: '#fff',
  },
  onlineIndicator: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#4CAF50',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: 12,
    marginBottom: 16,
  },
  actionButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  alertButton: {
    backgroundColor: '#E53935',
    position: 'absolute',
    right: 0,
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
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  notesButton: {
    padding: 4,
  },
  customerName: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 16,
  },
  pickupSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
    borderRadius: 16,
    gap: 4,
  },
  timeText: {
    color: '#E53935',
    fontWeight: '600',
    fontSize: 14,
  },
  addressText: {
    fontSize: 20,
    fontWeight: '500',
    lineHeight: 28,
    marginTop: 8,
  },
  bottomAction: {
    padding: 16,
    paddingBottom: 32,
  },
  swipeContainer: {
    height: 64,
    borderRadius: 32,
    overflow: 'hidden',
  },
  swipeTrack: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 16,
  },
  swipeButton: {
    width: 80,
    height: 64,
    backgroundColor: '#fff',
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  swipeText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 16,
  },
  // Completion styles
  completionContainer: {
    paddingTop: 20,
  },
  completionCard: {
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
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ratingContainer: {
    flex: 1,
  },
  customerNameLarge: {
    fontSize: 20,
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
    padding: 16,
    borderRadius: 8,
    gap: 12,
  },
  receiptButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  // Minimized bar
  minimizedBar: {
    position: 'absolute',
    bottom: 100,
    left: 16,
    right: 16,
    height: 56,
    borderRadius: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
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
  },
  menuContainer: {
    flex: 1,
    paddingTop: 50,
    paddingHorizontal: 16,
  },
  menuBackButton: {
    marginBottom: 16,
  },
  menuTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    fontStyle: 'italic',
    marginBottom: 24,
  },
  menuItems: {
    gap: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    gap: 16,
  },
  menuItemText: {
    flex: 1,
    fontSize: 18,
    fontWeight: '500',
  },
  redMenuItem: {
    backgroundColor: '#E53935',
    borderColor: '#E53935',
  },
});

export default ActiveRideScreen;
