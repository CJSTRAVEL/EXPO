import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Modal,
  ScrollView,
  Alert,
  Platform,
  Linking,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { getWalkaroundHistory } from '../services/api';
import { API_URL } from '../config';

// Simple date formatter (no external dependency)
const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  try {
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${day} ${month} ${year}, ${hours}:${minutes}`;
  } catch (e) {
    return 'N/A';
  }
};

// Format date for display in filter
const formatFilterDate = (dateString) => {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    return `${day} ${month} ${year}`;
  } catch (e) {
    return '';
  }
};

// Simple Calendar Component
const SimpleCalendar = ({ selectedDate, onSelectDate, onClose, theme }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                  'July', 'August', 'September', 'October', 'November', 'December'];
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  
  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const days = [];
    // Add empty slots for days before the first day
    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }
    // Add actual days
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i);
    }
    return days;
  };
  
  const isSelected = (day) => {
    if (!day || !selectedDate) return false;
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    return date.toISOString().slice(0, 10) === selectedDate;
  };
  
  const isToday = (day) => {
    if (!day) return false;
    const today = new Date();
    return day === today.getDate() && 
           currentMonth.getMonth() === today.getMonth() && 
           currentMonth.getFullYear() === today.getFullYear();
  };
  
  const handleSelectDate = (day) => {
    if (!day) return;
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    onSelectDate(date.toISOString().slice(0, 10));
    onClose();
  };
  
  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };
  
  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };
  
  return (
    <View style={[calendarStyles.container, { backgroundColor: theme.card }]}>
      {/* Header */}
      <View style={calendarStyles.header}>
        <TouchableOpacity onPress={prevMonth} style={calendarStyles.navButton}>
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[calendarStyles.monthText, { color: theme.text }]}>
          {months[currentMonth.getMonth()]} {currentMonth.getFullYear()}
        </Text>
        <TouchableOpacity onPress={nextMonth} style={calendarStyles.navButton}>
          <Ionicons name="chevron-forward" size={24} color={theme.text} />
        </TouchableOpacity>
      </View>
      
      {/* Week days header */}
      <View style={calendarStyles.weekDaysRow}>
        {weekDays.map((day, index) => (
          <Text key={index} style={[calendarStyles.weekDayText, { color: theme.textSecondary }]}>
            {day}
          </Text>
        ))}
      </View>
      
      {/* Days grid */}
      <View style={calendarStyles.daysGrid}>
        {getDaysInMonth(currentMonth).map((day, index) => (
          <TouchableOpacity
            key={index}
            style={[
              calendarStyles.dayCell,
              isSelected(day) && { backgroundColor: theme.primary },
              isToday(day) && !isSelected(day) && { backgroundColor: theme.primary + '30' },
            ]}
            onPress={() => handleSelectDate(day)}
            disabled={!day}
          >
            <Text style={[
              calendarStyles.dayText,
              { color: day ? theme.text : 'transparent' },
              isSelected(day) && { color: '#fff' },
            ]}>
              {day || ''}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      
      {/* Close button */}
      <TouchableOpacity 
        style={[calendarStyles.closeButton, { borderTopColor: theme.border }]} 
        onPress={onClose}
      >
        <Text style={[calendarStyles.closeButtonText, { color: theme.primary }]}>Close</Text>
      </TouchableOpacity>
    </View>
  );
};

const calendarStyles = StyleSheet.create({
  container: {
    borderRadius: 12,
    padding: 16,
    margin: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  navButton: {
    padding: 8,
  },
  monthText: {
    fontSize: 18,
    fontWeight: '600',
  },
  weekDaysRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 8,
  },
  weekDayText: {
    fontSize: 12,
    fontWeight: '600',
    width: 40,
    textAlign: 'center',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
  },
  dayText: {
    fontSize: 14,
    fontWeight: '500',
  },
  closeButton: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

export default function WalkaroundHistoryScreen({ navigation }) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [checks, setChecks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCheck, setSelectedCheck] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  
  // Search filters
  const [searchDate, setSearchDate] = useState('');
  const [searchVehicle, setSearchVehicle] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showVehiclePicker, setShowVehiclePicker] = useState(false);
  const [vehicles, setVehicles] = useState([]);

  useEffect(() => {
    fetchHistory();
    fetchVehicles();
  }, []);

  const fetchVehicles = async () => {
    try {
      const response = await fetch(`${API_URL}/vehicles`, {
        headers: {
          'Content-Type': 'application/json',
        },
      });
      const data = await response.json();
      // Filter to only active vehicles and based on driver license type
      const driverLicenseType = user?.license_type;
      let filteredVehicles = (data || []).filter(v => v.is_active !== false);
      
      if (driverLicenseType && driverLicenseType !== 'both') {
        filteredVehicles = filteredVehicles.filter(vehicle => {
          const vehicleCategory = vehicle.vehicle_type?.category;
          if (!vehicleCategory || vehicleCategory === 'both') return true;
          return vehicleCategory === driverLicenseType;
        });
      }
      
      setVehicles(filteredVehicles);
    } catch (error) {
      console.error('Error fetching vehicles:', error);
    }
  };

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const data = await getWalkaroundHistory();
      setChecks(data || []);
    } catch (error) {
      console.error('Error fetching walkaround history:', error);
      Alert.alert('Error', 'Failed to load walkaround history');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchHistory();
    setRefreshing(false);
  }, []);

  const getStatusColor = (status) => {
    if (status === 'pass' || status === 'passed') return '#10b981';
    if (status === 'fail' || status === 'failed') return '#ef4444';
    return '#f59e0b';
  };

  const getStatusIcon = (status) => {
    if (status === 'pass' || status === 'passed') return 'checkmark-circle';
    if (status === 'fail' || status === 'failed') return 'close-circle';
    return 'alert-circle';
  };

  // Filter checks by date and vehicle
  const filteredChecks = checks.filter(check => {
    let matchesDate = true;
    let matchesVehicle = true;
    
    if (searchDate) {
      const checkDate = check.submitted_at ? check.submitted_at.slice(0, 10) : '';
      matchesDate = checkDate === searchDate;
    }
    
    if (searchVehicle) {
      const vehicleReg = (check.vehicle_reg || '').toLowerCase();
      matchesVehicle = vehicleReg.includes(searchVehicle.toLowerCase());
    }
    
    return matchesDate && matchesVehicle;
  });

  const clearFilters = () => {
    setSearchDate('');
    setSearchVehicle('');
  };

  const openPDF = async (checkId) => {
    try {
      const url = `${API_URL}/walkaround-checks/${checkId}/pdf`;
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Error', 'Cannot open PDF on this device');
      }
    } catch (error) {
      console.error('Error opening PDF:', error);
      Alert.alert('Error', 'Failed to open PDF');
    }
  };

  const renderCheckItem = ({ item }) => (
    <TouchableOpacity
      style={[styles.checkCard, { backgroundColor: theme.card }]}
      onPress={() => {
        setSelectedCheck(item);
        setShowDetailModal(true);
      }}
    >
      <View style={styles.checkHeader}>
        <View style={styles.checkInfo}>
          <Text style={[styles.checkNumber, { color: theme.text }]}>
            {item.check_number || `WO-${item.id?.slice(0, 6)}`}
          </Text>
          <Text style={[styles.checkDate, { color: theme.textSecondary }]}>
            {formatDate(item.submitted_at)}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.overall_status) + '20' }]}>
          <Ionicons 
            name={getStatusIcon(item.overall_status)} 
            size={16} 
            color={getStatusColor(item.overall_status)} 
          />
          <Text style={[styles.statusText, { color: getStatusColor(item.overall_status) }]}>
            {(item.overall_status || 'Unknown').toUpperCase()}
          </Text>
        </View>
      </View>
      
      <View style={[styles.checkDetails, { borderTopColor: theme.border }]}>
        <View style={styles.detailItem}>
          <Ionicons name="car-outline" size={16} color={theme.textSecondary} />
          <Text style={[styles.detailText, { color: theme.text }]}>
            {item.vehicle_reg || 'Unknown Vehicle'}
          </Text>
        </View>
        <View style={styles.detailItem}>
          <Ionicons name="document-outline" size={16} color={theme.textSecondary} />
          <Text style={[styles.detailText, { color: theme.text }]}>
            {item.check_type || 'Standard Check'}
          </Text>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.viewPdfButton, { backgroundColor: theme.primary + '20' }]}
        onPress={() => openPDF(item.id)}
      >
        <Ionicons name="document-text-outline" size={18} color={theme.primary} />
        <Text style={[styles.viewPdfText, { color: theme.primary }]}>View PDF</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const renderDetailModal = () => (
    <Modal
      visible={showDetailModal}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowDetailModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              Check Details
            </Text>
            <TouchableOpacity onPress={() => setShowDetailModal(false)}>
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
          </View>

          {selectedCheck && (
            <ScrollView style={styles.modalBody}>
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Certificate #</Text>
                <Text style={[styles.detailValue, { color: theme.text }]}>
                  {selectedCheck.check_number || `WO-${selectedCheck.id?.slice(0, 6)}`}
                </Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Date & Time</Text>
                <Text style={[styles.detailValue, { color: theme.text }]}>
                  {formatDate(selectedCheck.submitted_at)}
                </Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Vehicle</Text>
                <Text style={[styles.detailValue, { color: theme.text }]}>
                  {selectedCheck.vehicle_reg || 'Unknown'}
                </Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Check Type</Text>
                <Text style={[styles.detailValue, { color: theme.text }]}>
                  {selectedCheck.check_type || 'Standard'}
                </Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Status</Text>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(selectedCheck.overall_status) + '20' }]}>
                  <Ionicons 
                    name={getStatusIcon(selectedCheck.overall_status)} 
                    size={16} 
                    color={getStatusColor(selectedCheck.overall_status)} 
                  />
                  <Text style={[styles.statusText, { color: getStatusColor(selectedCheck.overall_status) }]}>
                    {(selectedCheck.overall_status || 'Unknown').toUpperCase()}
                  </Text>
                </View>
              </View>

              {selectedCheck.notes && (
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Notes</Text>
                  <Text style={[styles.detailValue, { color: theme.text }]}>
                    {selectedCheck.notes}
                  </Text>
                </View>
              )}

              {/* Check Items */}
              {selectedCheck.items && selectedCheck.items.length > 0 && (
                <View style={styles.itemsSection}>
                  <Text style={[styles.sectionTitle, { color: theme.text }]}>Check Items</Text>
                  {selectedCheck.items.map((item, index) => (
                    <View key={index} style={[styles.checkItem, { borderBottomColor: theme.border }]}>
                      <View style={styles.itemInfo}>
                        <Ionicons 
                          name={item.status === 'pass' || item.status === 'passed' ? 'checkmark-circle' : 'close-circle'} 
                          size={20} 
                          color={item.status === 'pass' || item.status === 'passed' ? '#10b981' : '#ef4444'} 
                        />
                        <Text style={[styles.itemName, { color: theme.text }]}>{item.name}</Text>
                      </View>
                      {item.notes && (
                        <Text style={[styles.itemNotes, { color: theme.textSecondary }]}>{item.notes}</Text>
                      )}
                    </View>
                  ))}
                </View>
              )}

              <TouchableOpacity
                style={[styles.downloadButton, { backgroundColor: theme.primary }]}
                onPress={() => openPDF(selectedCheck.id)}
              >
                <Ionicons name="download-outline" size={20} color="#fff" />
                <Text style={styles.downloadButtonText}>Download PDF</Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.headerBg }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Walkaround History</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Search Filters */}
      <View style={[styles.filterContainer, { backgroundColor: theme.card }]}>
        {/* Date Filter - Calendar Dropdown */}
        <View style={styles.filterRow}>
          <TouchableOpacity 
            style={[styles.filterInput, { backgroundColor: theme.background, borderColor: theme.border }]}
            onPress={() => setShowDatePicker(true)}
          >
            <Ionicons name="calendar-outline" size={18} color={theme.textSecondary} />
            <Text style={[styles.filterTextInput, { color: searchDate ? theme.text : theme.textSecondary, flex: 1 }]}>
              {searchDate ? formatFilterDate(searchDate) : 'Select date...'}
            </Text>
            {searchDate ? (
              <TouchableOpacity onPress={() => setSearchDate('')}>
                <Ionicons name="close-circle" size={18} color={theme.textSecondary} />
              </TouchableOpacity>
            ) : (
              <Ionicons name="chevron-down" size={18} color={theme.textSecondary} />
            )}
          </TouchableOpacity>
        </View>
        
        {/* Vehicle Filter - Dropdown */}
        <View style={styles.filterRow}>
          <TouchableOpacity 
            style={[styles.filterInput, { backgroundColor: theme.background, borderColor: theme.border }]}
            onPress={() => setShowVehiclePicker(true)}
          >
            <Ionicons name="car-outline" size={18} color={theme.textSecondary} />
            <Text style={[styles.filterTextInput, { color: searchVehicle ? theme.text : theme.textSecondary, flex: 1 }]}>
              {searchVehicle || 'Select vehicle...'}
            </Text>
            {searchVehicle ? (
              <TouchableOpacity onPress={() => setSearchVehicle('')}>
                <Ionicons name="close-circle" size={18} color={theme.textSecondary} />
              </TouchableOpacity>
            ) : (
              <Ionicons name="chevron-down" size={18} color={theme.textSecondary} />
            )}
          </TouchableOpacity>
        </View>

        {/* Clear Filters Button */}
        {(searchDate || searchVehicle) && (
          <TouchableOpacity style={styles.clearButton} onPress={clearFilters}>
            <Ionicons name="refresh-outline" size={16} color={theme.primary} />
            <Text style={[styles.clearButtonText, { color: theme.primary }]}>Clear Filters</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Date Picker Modal */}
      <Modal
        visible={showDatePicker}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowDatePicker(false)}
      >
        <TouchableOpacity 
          style={styles.calendarOverlay} 
          activeOpacity={1} 
          onPress={() => setShowDatePicker(false)}
        >
          <TouchableOpacity activeOpacity={1}>
            <SimpleCalendar
              selectedDate={searchDate}
              onSelectDate={setSearchDate}
              onClose={() => setShowDatePicker(false)}
              theme={theme}
            />
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Vehicle Picker Modal */}
      <Modal
        visible={showVehiclePicker}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowVehiclePicker(false)}
      >
        <TouchableOpacity 
          style={styles.calendarOverlay} 
          activeOpacity={1} 
          onPress={() => setShowVehiclePicker(false)}
        >
          <View style={[styles.vehiclePickerContainer, { backgroundColor: theme.card }]}>
            <Text style={[styles.vehiclePickerTitle, { color: theme.text }]}>Select Vehicle</Text>
            <ScrollView style={styles.vehiclePickerList}>
              {vehicles.map((vehicle) => (
                <TouchableOpacity
                  key={vehicle.id}
                  style={[
                    styles.vehiclePickerItem, 
                    { borderBottomColor: theme.border },
                    searchVehicle === vehicle.registration && { backgroundColor: theme.primary + '20' }
                  ]}
                  onPress={() => {
                    setSearchVehicle(vehicle.registration);
                    setShowVehiclePicker(false);
                  }}
                >
                  <View style={styles.vehiclePickerItemContent}>
                    <Text style={[styles.vehiclePickerReg, { color: theme.text }]}>
                      {vehicle.registration}
                    </Text>
                    <Text style={[styles.vehiclePickerType, { color: theme.textSecondary }]}>
                      {vehicle.vehicle_type?.name || `${vehicle.make} ${vehicle.model}`}
                    </Text>
                  </View>
                  {searchVehicle === vehicle.registration && (
                    <Ionicons name="checkmark-circle" size={20} color={theme.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity 
              style={[styles.vehiclePickerClose, { borderTopColor: theme.border }]} 
              onPress={() => setShowVehiclePicker(false)}
            >
              <Text style={[styles.vehiclePickerCloseText, { color: theme.primary }]}>Close</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Content */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Loading history...</Text>
        </View>
      ) : filteredChecks.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="document-text-outline" size={64} color={theme.textSecondary} />
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
            No walkaround checks found
          </Text>
          <TouchableOpacity
            style={[styles.newCheckButton, { backgroundColor: theme.primary }]}
            onPress={() => navigation.navigate('Walkaround')}
          >
            <Ionicons name="add" size={20} color="#fff" />
            <Text style={styles.newCheckText}>New Walkaround Check</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredChecks}
          renderItem={renderCheckItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.primary]} />
          }
        />
      )}

      {renderDetailModal()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  filterContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  filterRow: {
    marginBottom: 10,
  },
  filterInput: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    gap: 10,
  },
  filterTextInput: {
    flex: 1,
    fontSize: 14,
    padding: 0,
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 6,
  },
  clearButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  calendarOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  vehiclePickerContainer: {
    width: '85%',
    maxHeight: '70%',
    borderRadius: 12,
    overflow: 'hidden',
  },
  vehiclePickerTitle: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  vehiclePickerList: {
    maxHeight: 300,
  },
  vehiclePickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  vehiclePickerItemContent: {
    flex: 1,
  },
  vehiclePickerReg: {
    fontSize: 16,
    fontWeight: '600',
  },
  vehiclePickerType: {
    fontSize: 13,
    marginTop: 2,
  },
  vehiclePickerClose: {
    paddingVertical: 16,
    borderTopWidth: 1,
    alignItems: 'center',
  },
  vehiclePickerCloseText: {
    fontSize: 16,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 12,
    marginBottom: 20,
  },
  newCheckButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    gap: 8,
  },
  newCheckText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  checkCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  checkHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  checkInfo: {
    flex: 1,
  },
  checkNumber: {
    fontSize: 16,
    fontWeight: '600',
  },
  checkDate: {
    fontSize: 12,
    marginTop: 4,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  checkDetails: {
    flexDirection: 'row',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    gap: 20,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailText: {
    fontSize: 13,
  },
  viewPdfButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  viewPdfText: {
    fontSize: 14,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  modalBody: {
    padding: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  detailLabel: {
    fontSize: 14,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'right',
    flex: 1,
    marginLeft: 16,
  },
  itemsSection: {
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  checkItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  itemInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '500',
  },
  itemNotes: {
    fontSize: 12,
    marginLeft: 30,
    marginTop: 4,
  },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
    marginTop: 20,
    marginBottom: 30,
    gap: 8,
  },
  downloadButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
