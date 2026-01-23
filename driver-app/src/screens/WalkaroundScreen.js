import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  Image,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import SignatureCanvas from 'react-native-signature-canvas';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { API_URL } from '../config';

const CHECKLIST_ITEMS = [
  "Tyres, Wheel and Wheel Nuts",
  "Bodywork Damages",
  "Door Security",
  "Oil, Fluid or Coolant Leaks",
  "Tow Bar Security & Connections",
  "Lights & Reflectors",
  "Exhaust Security and Emissions",
  "Battery Security",
  "Horn & Dashboard Lights",
  "Mirrors & Indicators",
  "Washers & Wipers",
  "Seats & Seatbelts",
  "Brakes & Steering",
  "Registration Plates & Taxi Plate and Roundels",
  "Windscreen & Glass Windows",
  "Spare Wheel",
  "Tachograph",
  "Saloon Lighting",
  "Saloon Floor Covering",
  "Heating & Ventilation",
  "Exits, Locks and Handles",
  "First Aid Kit & First Aid Sticker",
  "Fire Extinguisher & Fire Extinguisher Sticker",
  "Emergency Hammer",
  "Are you fit to drive?"
];

export default function WalkaroundScreen({ navigation }) {
  const { user, token } = useAuth();
  const { theme } = useTheme();
  const signatureRef = useRef(null);
  
  const [vehicles, setVehicles] = useState([]);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [showVehiclePicker, setShowVehiclePicker] = useState(false);
  const [checkType, setCheckType] = useState('daily');
  const [checklist, setChecklist] = useState({});
  const [defects, setDefects] = useState('');
  const [agreement, setAgreement] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingVehicles, setLoadingVehicles] = useState(true);
  const [signature, setSignature] = useState(null);
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  
  // Initialize checklist with all items unchecked
  useEffect(() => {
    const initialChecklist = {};
    CHECKLIST_ITEMS.forEach(item => {
      initialChecklist[item] = false;
    });
    setChecklist(initialChecklist);
  }, []);
  
  // Fetch vehicles
  useEffect(() => {
    fetchVehicles();
  }, []);
  
  const fetchVehicles = async () => {
    try {
      const response = await fetch(`${API_URL}/vehicles`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      const data = await response.json();
      setVehicles(data.filter(v => v.is_active !== false));
    } catch (error) {
      console.error('Error fetching vehicles:', error);
    } finally {
      setLoadingVehicles(false);
    }
  };
  
  const toggleItem = (item) => {
    setChecklist(prev => ({
      ...prev,
      [item]: !prev[item]
    }));
  };
  
  const selectAllItems = () => {
    const allChecked = {};
    CHECKLIST_ITEMS.forEach(item => {
      allChecked[item] = true;
    });
    setChecklist(allChecked);
  };
  
  const clearAllItems = () => {
    const allUnchecked = {};
    CHECKLIST_ITEMS.forEach(item => {
      allUnchecked[item] = false;
    });
    setChecklist(allUnchecked);
  };
  
  const allItemsChecked = () => {
    return CHECKLIST_ITEMS.every(item => checklist[item] === true);
  };
  
  const handleSignature = (sig) => {
    setSignature(sig);
    setShowSignaturePad(false);
  };
  
  const handleClearSignature = () => {
    setSignature(null);
    if (signatureRef.current) {
      signatureRef.current.clearSignature();
    }
  };
  
  const handleSubmit = async () => {
    // Validation
    if (!selectedVehicle) {
      Alert.alert('Error', 'Please select a vehicle');
      return;
    }
    
    if (!allItemsChecked()) {
      Alert.alert('Error', 'Please check all items before submitting');
      return;
    }
    
    if (!agreement) {
      Alert.alert('Error', 'Please agree to the declaration before submitting');
      return;
    }
    
    if (!signature) {
      Alert.alert('Error', 'Please provide your signature before submitting');
      return;
    }
    
    setLoading(true);
    
    try {
      const response = await fetch(`${API_URL}/walkaround-checks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          driver_name: user?.name || 'Unknown Driver',
          vehicle_reg: selectedVehicle.registration,
          check_type: checkType,
          checklist: checklist,
          defects: defects.trim() || null,
          agreement: agreement,
          signature: signature,
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to submit check');
      }
      
      const result = await response.json();
      
      Alert.alert(
        'Success',
        `Walkaround check ${result.check_number} submitted successfully!`,
        [
          { text: 'OK', onPress: () => navigation.goBack() }
        ]
      );
      
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const ChecklistItem = ({ item, checked, onToggle }) => (
    <TouchableOpacity
      style={[
        styles.checklistItem,
        { backgroundColor: checked ? theme.primary + '15' : theme.card }
      ]}
      onPress={onToggle}
    >
      <View style={[
        styles.checkbox,
        { 
          backgroundColor: checked ? theme.primary : 'transparent',
          borderColor: checked ? theme.primary : theme.border
        }
      ]}>
        {checked && <Ionicons name="checkmark" size={16} color="#fff" />}
      </View>
      <Text style={[
        styles.checklistText,
        { color: checked ? theme.primary : theme.text }
      ]}>
        {item}
      </Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.headerBg }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Daily/Weekly Walkaround Check</Text>
        <View style={{ width: 40 }} />
      </View>
      
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Driver Name */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>Driver Name</Text>
          <Text style={[styles.sectionValue, { color: theme.text }]}>
            {user?.name || 'Unknown Driver'}
          </Text>
        </View>
        
        {/* Vehicle Selection */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>Vehicle Registration *</Text>
          <TouchableOpacity
            style={[styles.pickerButton, { borderColor: theme.border }]}
            onPress={() => setShowVehiclePicker(!showVehiclePicker)}
          >
            <Text style={[styles.pickerButtonText, { color: selectedVehicle ? theme.text : theme.textSecondary }]}>
              {selectedVehicle ? `${selectedVehicle.registration} - ${selectedVehicle.make} ${selectedVehicle.model}` : 'Select a vehicle...'}
            </Text>
            <Ionicons name="chevron-down" size={20} color={theme.textSecondary} />
          </TouchableOpacity>
          
          {showVehiclePicker && (
            <View style={[styles.pickerDropdown, { backgroundColor: theme.card, borderColor: theme.border }]}>
              {loadingVehicles ? (
                <ActivityIndicator size="small" color={theme.primary} style={{ padding: 16 }} />
              ) : vehicles.length === 0 ? (
                <Text style={[styles.noVehicles, { color: theme.textSecondary }]}>No vehicles available</Text>
              ) : (
                vehicles.map(vehicle => (
                  <TouchableOpacity
                    key={vehicle.id}
                    style={[
                      styles.pickerItem,
                      selectedVehicle?.id === vehicle.id && { backgroundColor: theme.primary + '15' }
                    ]}
                    onPress={() => {
                      setSelectedVehicle(vehicle);
                      setShowVehiclePicker(false);
                    }}
                  >
                    <Ionicons 
                      name="car-outline" 
                      size={20} 
                      color={selectedVehicle?.id === vehicle.id ? theme.primary : theme.textSecondary} 
                    />
                    <Text style={[
                      styles.pickerItemText,
                      { color: selectedVehicle?.id === vehicle.id ? theme.primary : theme.text }
                    ]}>
                      {vehicle.registration} - {vehicle.make} {vehicle.model}
                    </Text>
                  </TouchableOpacity>
                ))
              )}
            </View>
          )}
        </View>
        
        {/* Check Type */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>Check Type</Text>
          <View style={styles.checkTypeContainer}>
            <TouchableOpacity
              style={[
                styles.checkTypeButton,
                { borderColor: checkType === 'daily' ? theme.primary : theme.border },
                checkType === 'daily' && { backgroundColor: theme.primary + '15' }
              ]}
              onPress={() => setCheckType('daily')}
            >
              <Text style={[styles.checkTypeText, { color: checkType === 'daily' ? theme.primary : theme.text }]}>
                Daily
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.checkTypeButton,
                { borderColor: checkType === 'weekly' ? theme.primary : theme.border },
                checkType === 'weekly' && { backgroundColor: theme.primary + '15' }
              ]}
              onPress={() => setCheckType('weekly')}
            >
              <Text style={[styles.checkTypeText, { color: checkType === 'weekly' ? theme.primary : theme.text }]}>
                Weekly
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        
        {/* Checklist */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <View style={styles.checklistHeader}>
            <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>Checklist Items *</Text>
            <View style={styles.checklistActions}>
              <TouchableOpacity onPress={selectAllItems} style={styles.actionButton}>
                <Text style={[styles.actionText, { color: theme.primary }]}>Select All</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={clearAllItems} style={styles.actionButton}>
                <Text style={[styles.actionText, { color: theme.danger }]}>Clear All</Text>
              </TouchableOpacity>
            </View>
          </View>
          
          <View style={styles.checklistContainer}>
            {CHECKLIST_ITEMS.map((item, index) => (
              <ChecklistItem
                key={index}
                item={item}
                checked={checklist[item]}
                onToggle={() => toggleItem(item)}
              />
            ))}
          </View>
        </View>
        
        {/* Defects */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>Defects (if any)</Text>
          <View style={[styles.textAreaContainer, { borderColor: theme.border }]}>
            <Text
              style={[styles.textArea, { color: theme.text }]}
              onPress={() => {
                Alert.prompt(
                  'Enter Defects',
                  'Describe any defects found during the check',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'OK', onPress: (text) => setDefects(text || '') }
                  ],
                  'plain-text',
                  defects
                );
              }}
            >
              {defects || 'Tap to enter any defects...'}
            </Text>
          </View>
        </View>
        
        {/* Agreement */}
        <TouchableOpacity
          style={[styles.agreementContainer, { backgroundColor: theme.card }]}
          onPress={() => setAgreement(!agreement)}
        >
          <View style={[
            styles.checkbox,
            { 
              backgroundColor: agreement ? theme.primary : 'transparent',
              borderColor: agreement ? theme.primary : theme.border
            }
          ]}>
            {agreement && <Ionicons name="checkmark" size={16} color="#fff" />}
          </View>
          <Text style={[styles.agreementText, { color: theme.text }]}>
            I agree that I have checked these items against company Daily Check policy. 
            Make sure all items have been ticked before submitting.
          </Text>
        </TouchableOpacity>
        
        {/* Submit Button */}
        <TouchableOpacity
          style={[
            styles.submitButton,
            { backgroundColor: allItemsChecked() && agreement && selectedVehicle ? theme.primary : theme.border }
          ]}
          onPress={handleSubmit}
          disabled={loading || !allItemsChecked() || !agreement || !selectedVehicle}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={24} color="#fff" />
              <Text style={styles.submitButtonText}>Submit Walkaround Check</Text>
            </>
          )}
        </TouchableOpacity>
        
        <View style={{ height: 40 }} />
      </ScrollView>
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
    paddingTop: Platform.OS === 'ios' ? 10 : 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionValue: {
    fontSize: 16,
    fontWeight: '500',
  },
  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
  },
  pickerButtonText: {
    fontSize: 15,
  },
  pickerDropdown: {
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 8,
    maxHeight: 200,
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  pickerItemText: {
    fontSize: 15,
    marginLeft: 10,
  },
  noVehicles: {
    padding: 16,
    textAlign: 'center',
  },
  checkTypeContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  checkTypeButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  checkTypeText: {
    fontSize: 15,
    fontWeight: '500',
  },
  checklistHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  checklistActions: {
    flexDirection: 'row',
    gap: 16,
  },
  actionButton: {
    padding: 4,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '500',
  },
  checklistContainer: {
    gap: 8,
  },
  checklistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  checklistText: {
    flex: 1,
    fontSize: 14,
  },
  textAreaContainer: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    minHeight: 80,
  },
  textArea: {
    fontSize: 14,
  },
  agreementContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  agreementText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
