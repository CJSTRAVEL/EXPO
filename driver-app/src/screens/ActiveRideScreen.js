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
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { updateBookingStatus } from '../services/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.6;

// Swipe Button Component
const SwipeButton = ({ onSwipeComplete, text, color = '#D4A853', disabled = false }) => {
  const pan = useRef(new Animated.Value(0)).current;
  const [swiping, setSwiping] = useState(false);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !disabled,
      onPanResponderGrant: () => {
        if (!disabled) setSwiping(true);
      },
      onPanResponderMove: (_, gestureState) => {
        if (!disabled && gestureState.dx > 0 && gestureState.dx < SCREEN_WIDTH - 100) {
          pan.setValue(gestureState.dx);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        setSwiping(false);
        if (!disabled && gestureState.dx > SWIPE_THRESHOLD) {
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
    <View style={[styles.swipeContainer, disabled && { opacity: 0.5 }]}>
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

// Completion Screen Component
const CompletionScreen = ({ booking, onEndJob, theme }) => {
  const fare = booking?.fare || 0;
  const deposit = booking?.deposit_paid || 0;
  const balanceDue = Math.max(0, fare - deposit);

  return (
    <View style={[styles.completionContainer, { backgroundColor: theme.background }]}>
      <View style={styles.completionHeader}>
        <Ionicons name="checkmark-circle" size={80} color="#4CAF50" />
        <Text style={[styles.completionTitle, { color: theme.text }]}>Journey Complete!</Text>
      </View>

      <View style={[styles.fareCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <Text style={[styles.fareSectionTitle, { color: theme.textSecondary }]}>PAYMENT SUMMARY</Text>
        
        <View style={styles.fareRow}>
          <Text style={[styles.fareLabel, { color: theme.text }]}>Total Fare</Text>
          <Text style={[styles.fareValue, { color: theme.text }]}>£{fare.toFixed(2)}</Text>
        </View>
        
        <View style={styles.fareRow}>
          <Text style={[styles.fareLabel, { color: theme.textSecondary }]}>Deposit Paid</Text>
          <Text style={[styles.fareValue, { color: deposit > 0 ? '#4CAF50' : theme.textSecondary }]}>
            £{deposit.toFixed(2)}
          </Text>
        </View>
        
        <View style={[styles.fareDivider, { backgroundColor: theme.border }]} />
        
        <View style={styles.fareRow}>
          <Text style={[styles.fareLabel, { color: theme.text, fontWeight: '700', fontSize: 18 }]}>Balance Due</Text>
          <Text style={[styles.fareValueLarge, { color: '#D4A853' }]}>£{balanceDue.toFixed(2)}</Text>
        </View>
        
        <Text style={[styles.paymentMethod, { color: theme.textSecondary }]}>
          Payment Method: {booking?.payment_method || 'Cash'}
        </Text>
      </View>

      <TouchableOpacity
        style={[styles.endJobButton, { backgroundColor: '#D4A853' }]}
        onPress={onEndJob}
      >
        <Text style={styles.endJobButtonText}>End Job</Text>
      </TouchableOpacity>
    </View>
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
  // Stages: on_route -> arrived -> pob -> stop_0, stop_1... -> dropoff -> complete
  const [stage, setStage] = useState('on_route');
  const [currentStopIndex, setCurrentStopIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const stops = booking?.additional_stops || [];
  const totalStops = stops.length;

  useEffect(() => {
    if (booking) {
      // Set initial stage based on booking status
      if (booking.status === 'completed') {
        setStage('complete');
      } else if (booking.status === 'in_progress') {
        // Check if we have stops to navigate
        if (totalStops > 0) {
          setStage('stop_0');
          setCurrentStopIndex(0);
        } else {
          setStage('dropoff');
        }
      } else if (booking.status === 'arrived') {
        setStage('arrived');
      } else {
        setStage('on_route');
      }
    }
  }, [booking?.id]);

  // Get current location info based on stage
  const getCurrentLocationInfo = () => {
    if (!booking) return { label: '', address: '', instruction: '' };

    switch (stage) {
      case 'on_route':
        return {
          label: 'PICKUP LOCATION',
          address: booking.pickup_location,
          instruction: 'Navigate to pickup location',
          dotColor: '#4CAF50',
        };
      case 'arrived':
        return {
          label: 'PICKUP LOCATION',
          address: booking.pickup_location,
          instruction: 'Confirm arrival at pickup',
          dotColor: '#4CAF50',
        };
      case 'pob':
        return {
          label: 'PICKUP LOCATION',
          address: booking.pickup_location,
          instruction: 'Confirm passengers on board',
          dotColor: '#4CAF50',
        };
      case 'dropoff':
        return {
          label: 'DROP-OFF LOCATION',
          address: booking.dropoff_location,
          instruction: 'Navigate to drop-off',
          dotColor: '#F44336',
        };
      case 'complete':
        return {
          label: 'JOURNEY COMPLETE',
          address: booking.dropoff_location,
          instruction: '',
          dotColor: '#4CAF50',
        };
      default:
        // Handle stop stages (stop_0, stop_1, etc.)
        if (stage.startsWith('stop_')) {
          const stopIdx = parseInt(stage.split('_')[1], 10);
          return {
            label: `STOP ${stopIdx + 1} OF ${totalStops}`,
            address: stops[stopIdx] || '',
            instruction: `Navigate to stop ${stopIdx + 1}`,
            dotColor: '#FF9800',
          };
        }
        return { label: '', address: '', instruction: '', dotColor: '#999' };
    }
  };

  const getStageTitle = () => {
    switch (stage) {
      case 'on_route': return 'On Route';
      case 'arrived': return 'Arrived';
      case 'pob': return 'POB';
      case 'dropoff': return 'Drop-off';
      case 'complete': return 'Complete';
      default:
        if (stage.startsWith('stop_')) {
          const stopIdx = parseInt(stage.split('_')[1], 10);
          return `Stop ${stopIdx + 1}`;
        }
        return 'In Progress';
    }
  };

  const getSwipeButtonConfig = () => {
    switch (stage) {
      case 'on_route':
        return { text: 'Swipe to Confirm Arrival', action: handleArrival };
      case 'arrived':
        return { text: 'Swipe to Confirm POB', action: handleConfirmPOB };
      case 'pob':
        if (totalStops > 0) {
          return { text: 'Swipe to Proceed to Stop 1', action: handleProceedToFirstStop };
        }
        return { text: 'Swipe to Proceed to Drop-off', action: handleProceedToDropoff };
      case 'dropoff':
        return { text: 'Swipe to Complete Journey', action: handleCompleteJourney };
      default:
        if (stage.startsWith('stop_')) {
          const stopIdx = parseInt(stage.split('_')[1], 10);
          if (stopIdx < totalStops - 1) {
            return { text: `Swipe to Proceed to Stop ${stopIdx + 2}`, action: () => handleNextStop(stopIdx) };
          }
          return { text: 'Swipe to Proceed to Drop-off', action: handleProceedToDropoff };
        }
        return null;
    }
  };

  // Stage handlers
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

  const handleConfirmPOB = async () => {
    setLoading(true);
    try {
      await updateBookingStatus(booking.id, 'in_progress');
      setStage('pob');
    } catch (error) {
      Alert.alert('Error', 'Failed to update status');
    } finally {
      setLoading(false);
    }
  };

  const handleProceedToFirstStop = () => {
    setCurrentStopIndex(0);
    setStage('stop_0');
  };

  const handleNextStop = (currentIdx) => {
    const nextIdx = currentIdx + 1;
    setCurrentStopIndex(nextIdx);
    setStage(`stop_${nextIdx}`);
  };

  const handleProceedToDropoff = () => {
    setStage('dropoff');
  };

  const handleCompleteJourney = async () => {
    setLoading(true);
    try {
      await updateBookingStatus(booking.id, 'completed');
      setStage('complete');
    } catch (error) {
      Alert.alert('Error', 'Failed to complete journey');
    } finally {
      setLoading(false);
    }
  };

  const handleEndJob = () => {
    if (onComplete) onComplete();
    onClose();
  };

  // Navigation
  const openNavigation = () => {
    const locationInfo = getCurrentLocationInfo();
    if (!locationInfo.address) {
      Alert.alert('No Address', 'No destination address available');
      return;
    }
    
    const encodedAddress = encodeURIComponent(locationInfo.address);
    const url = Platform.select({
      ios: `maps://app?daddr=${encodedAddress}`,
      android: `google.navigation:q=${encodedAddress}`,
    });
    
    Linking.canOpenURL(url).then((supported) => {
      if (supported) {
        Linking.openURL(url);
      } else {
        Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}`);
      }
    });
  };

  const handleCallPassenger = () => {
    if (booking?.customer_phone) {
      Linking.openURL(`tel:${booking.customer_phone}`);
    } else {
      Alert.alert('No Phone', 'No phone number available');
    }
  };

  if (!visible || !booking) return null;

  const customerName = `${booking.first_name || ''} ${booking.last_name || ''}`.trim() || 'Customer';
  const locationInfo = getCurrentLocationInfo();
  const swipeConfig = getSwipeButtonConfig();

  // Minimized view
  if (isMinimized) {
    return (
      <TouchableOpacity 
        style={[styles.minimizedBar, { backgroundColor: '#D4A853' }]}
        onPress={onMinimize}
      >
        <View style={styles.minimizedContent}>
          <Ionicons name="car" size={20} color="#fff" />
          <Text style={styles.minimizedText}>{getStageTitle()} - {customerName}</Text>
        </View>
        <Ionicons name="chevron-up" size={24} color="#fff" />
      </TouchableOpacity>
    );
  }

  // Complete screen
  if (stage === 'complete') {
    return (
      <Modal visible={visible} animationType="slide" onRequestClose={onMinimize}>
        <CompletionScreen booking={booking} onEndJob={handleEndJob} theme={theme} />
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onMinimize}>
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: '#1a3a5c' }]}>
          <TouchableOpacity onPress={onMinimize} style={styles.headerButton}>
            <Ionicons name="chevron-down" size={28} color="#fff" />
          </TouchableOpacity>
          
          <View style={styles.headerCenter}>
            <Text style={styles.stageLabel}>{getStageTitle()}</Text>
            <Text style={styles.customerName}>{customerName}</Text>
          </View>
          
          <TouchableOpacity onPress={handleCallPassenger} style={styles.headerButton}>
            <Ionicons name="call" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Progress Indicator */}
        <View style={[styles.progressContainer, { backgroundColor: theme.card }]}>
          <View style={styles.progressSteps}>
            <View style={[styles.progressStep, stage !== 'on_route' && styles.progressStepComplete]}>
              <View style={[styles.progressDot, stage !== 'on_route' ? styles.progressDotComplete : styles.progressDotActive]} />
              <Text style={[styles.progressLabel, { color: theme.textSecondary }]}>Route</Text>
            </View>
            <View style={[styles.progressLine, stage !== 'on_route' && stage !== 'arrived' && styles.progressLineComplete]} />
            <View style={[styles.progressStep, (stage === 'pob' || stage.startsWith('stop_') || stage === 'dropoff') && styles.progressStepComplete]}>
              <View style={[styles.progressDot, 
                (stage === 'arrived') ? styles.progressDotActive :
                (stage === 'pob' || stage.startsWith('stop_') || stage === 'dropoff') ? styles.progressDotComplete : {}
              ]} />
              <Text style={[styles.progressLabel, { color: theme.textSecondary }]}>Arrived</Text>
            </View>
            <View style={[styles.progressLine, (stage === 'pob' || stage.startsWith('stop_') || stage === 'dropoff') && styles.progressLineComplete]} />
            <View style={[styles.progressStep, (stage.startsWith('stop_') || stage === 'dropoff') && styles.progressStepComplete]}>
              <View style={[styles.progressDot,
                (stage === 'pob') ? styles.progressDotActive :
                (stage.startsWith('stop_') || stage === 'dropoff') ? styles.progressDotComplete : {}
              ]} />
              <Text style={[styles.progressLabel, { color: theme.textSecondary }]}>POB</Text>
            </View>
            {totalStops > 0 && (
              <>
                <View style={[styles.progressLine, stage === 'dropoff' && styles.progressLineComplete]} />
                <View style={[styles.progressStep, stage === 'dropoff' && styles.progressStepComplete]}>
                  <View style={[styles.progressDot,
                    stage.startsWith('stop_') ? styles.progressDotActive :
                    stage === 'dropoff' ? styles.progressDotComplete : {}
                  ]} />
                  <Text style={[styles.progressLabel, { color: theme.textSecondary }]}>Stops</Text>
                </View>
              </>
            )}
            <View style={[styles.progressLine, stage === 'dropoff' && styles.progressLineComplete]} />
            <View style={styles.progressStep}>
              <View style={[styles.progressDot, stage === 'dropoff' && styles.progressDotActive]} />
              <Text style={[styles.progressLabel, { color: theme.textSecondary }]}>Drop</Text>
            </View>
          </View>
        </View>

        {/* Main Content */}
        <ScrollView style={styles.content}>
          {/* Current Location Card */}
          <View style={[styles.locationCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.locationHeader}>
              <View style={[styles.locationDot, { backgroundColor: locationInfo.dotColor }]} />
              <Text style={[styles.locationLabel, { color: theme.textSecondary }]}>{locationInfo.label}</Text>
            </View>
            <Text style={[styles.locationAddress, { color: theme.text }]}>{locationInfo.address}</Text>
            {locationInfo.instruction && (
              <Text style={[styles.locationInstruction, { color: theme.textSecondary }]}>{locationInfo.instruction}</Text>
            )}
            
            {stage !== 'complete' && (
              <TouchableOpacity 
                style={[styles.navigateButton, { backgroundColor: '#D4A853' }]}
                onPress={openNavigation}
              >
                <Ionicons name="navigate" size={20} color="#fff" />
                <Text style={styles.navigateButtonText}>Navigate</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Journey Summary */}
          <View style={[styles.journeyCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.cardTitle, { color: theme.textSecondary }]}>JOURNEY SUMMARY</Text>
            
            {/* Pickup */}
            <View style={styles.journeyRow}>
              <View style={[styles.journeyDot, { backgroundColor: '#4CAF50' }]} />
              <View style={styles.journeyContent}>
                <Text style={[styles.journeyLabel, { color: theme.textSecondary }]}>Pickup</Text>
                <Text style={[styles.journeyAddress, { color: theme.text }]} numberOfLines={1}>{booking.pickup_location}</Text>
              </View>
              {(stage === 'on_route' || stage === 'arrived' || stage === 'pob') && (
                <Ionicons name="location" size={20} color="#4CAF50" />
              )}
            </View>
            
            {/* Stops */}
            {stops.map((stop, idx) => (
              <View key={idx} style={styles.journeyRow}>
                <View style={[styles.journeyDot, { backgroundColor: '#FF9800' }]} />
                <View style={styles.journeyContent}>
                  <Text style={[styles.journeyLabel, { color: theme.textSecondary }]}>Stop {idx + 1}</Text>
                  <Text style={[styles.journeyAddress, { color: theme.text }]} numberOfLines={1}>{stop}</Text>
                </View>
                {stage === `stop_${idx}` && (
                  <Ionicons name="location" size={20} color="#FF9800" />
                )}
              </View>
            ))}
            
            {/* Drop-off */}
            <View style={styles.journeyRow}>
              <View style={[styles.journeyDot, { backgroundColor: '#F44336' }]} />
              <View style={styles.journeyContent}>
                <Text style={[styles.journeyLabel, { color: theme.textSecondary }]}>Drop-off</Text>
                <Text style={[styles.journeyAddress, { color: theme.text }]} numberOfLines={1}>{booking.dropoff_location}</Text>
              </View>
              {stage === 'dropoff' && (
                <Ionicons name="location" size={20} color="#F44336" />
              )}
            </View>
          </View>

          {/* Fare Info */}
          <View style={[styles.fareCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.cardTitle, { color: theme.textSecondary }]}>FARE</Text>
            <View style={styles.fareRow}>
              <Text style={[styles.fareLabel, { color: theme.text }]}>Total</Text>
              <Text style={[styles.fareValue, { color: '#D4A853' }]}>£{(booking.fare || 0).toFixed(2)}</Text>
            </View>
          </View>
        </ScrollView>

        {/* Bottom Action */}
        {swipeConfig && (
          <View style={[styles.bottomAction, { backgroundColor: theme.background }]}>
            <SwipeButton 
              text={swipeConfig.text}
              onSwipeComplete={swipeConfig.action}
              disabled={loading}
            />
          </View>
        )}
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
    paddingBottom: 15,
    paddingHorizontal: 15,
  },
  headerButton: {
    padding: 5,
  },
  headerCenter: {
    alignItems: 'center',
  },
  stageLabel: {
    fontSize: 14,
    color: '#D4A853',
    fontWeight: '600',
  },
  customerName: {
    fontSize: 18,
    color: '#fff',
    fontWeight: '700',
  },
  progressContainer: {
    paddingVertical: 15,
    paddingHorizontal: 20,
  },
  progressSteps: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressStep: {
    alignItems: 'center',
  },
  progressDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#ddd',
  },
  progressDotActive: {
    backgroundColor: '#D4A853',
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  progressDotComplete: {
    backgroundColor: '#4CAF50',
  },
  progressLabel: {
    fontSize: 10,
    marginTop: 4,
  },
  progressLine: {
    width: 30,
    height: 2,
    backgroundColor: '#ddd',
    marginHorizontal: 5,
  },
  progressLineComplete: {
    backgroundColor: '#4CAF50',
  },
  content: {
    flex: 1,
    padding: 15,
  },
  locationCard: {
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    borderWidth: 1,
  },
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  locationDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  locationLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  locationAddress: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 5,
  },
  locationInstruction: {
    fontSize: 13,
    marginBottom: 15,
  },
  navigateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
  },
  navigateButtonText: {
    color: '#fff',
    fontWeight: '600',
    marginLeft: 8,
    fontSize: 15,
  },
  journeyCard: {
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    borderWidth: 1,
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 12,
  },
  journeyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  journeyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 10,
  },
  journeyContent: {
    flex: 1,
  },
  journeyLabel: {
    fontSize: 11,
  },
  journeyAddress: {
    fontSize: 14,
  },
  fareCard: {
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    borderWidth: 1,
  },
  fareRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fareLabel: {
    fontSize: 15,
  },
  fareValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  fareValueLarge: {
    fontSize: 24,
    fontWeight: '700',
  },
  fareDivider: {
    height: 1,
    marginVertical: 12,
  },
  fareSectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 15,
  },
  paymentMethod: {
    fontSize: 13,
    marginTop: 10,
  },
  bottomAction: {
    padding: 15,
    paddingBottom: 30,
  },
  swipeContainer: {
    height: 60,
    width: '100%',
  },
  swipeTrack: {
    flex: 1,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  swipeButton: {
    position: 'absolute',
    left: 5,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#fff',
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
    fontSize: 15,
    fontWeight: '600',
  },
  minimizedBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 15,
    paddingHorizontal: 20,
  },
  minimizedContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  minimizedText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 10,
  },
  completionContainer: {
    flex: 1,
    padding: 20,
    paddingTop: 80,
  },
  completionHeader: {
    alignItems: 'center',
    marginBottom: 30,
  },
  completionTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginTop: 15,
  },
  endJobButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 'auto',
    marginBottom: 30,
  },
  endJobButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
});

export default ActiveRideScreen;
