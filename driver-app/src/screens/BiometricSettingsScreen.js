import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { useTheme } from '../context/ThemeContext';

export default function BiometricSettingsScreen({ navigation }) {
  const { theme } = useTheme();
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState(null);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [hasCredentials, setHasCredentials] = useState(false);

  useEffect(() => {
    checkBiometricCapabilities();
    loadBiometricSetting();
  }, []);

  const checkBiometricCapabilities = async () => {
    try {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      setBiometricAvailable(compatible && enrolled);
      
      if (compatible) {
        const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
        if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
          setBiometricType('face');
        } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
          setBiometricType('fingerprint');
        }
      }
      
      // Check if credentials are saved
      const email = await SecureStore.getItemAsync('driver_email');
      const password = await SecureStore.getItemAsync('driver_password');
      setHasCredentials(!!email && !!password);
    } catch (error) {
      console.log('Error checking biometrics:', error);
    }
  };

  const loadBiometricSetting = async () => {
    try {
      const setting = await SecureStore.getItemAsync('biometric_enabled');
      setBiometricEnabled(setting === 'true');
    } catch (error) {
      console.log('Error loading biometric setting:', error);
    }
  };

  const toggleBiometric = async (value) => {
    if (value && !hasCredentials) {
      Alert.alert(
        'Login Required',
        'You need to login with email and password first before enabling biometric login.',
        [{ text: 'OK' }]
      );
      return;
    }
    
    if (value) {
      // Verify biometric before enabling
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Verify your identity to enable biometric login',
        cancelLabel: 'Cancel',
      });
      
      if (!result.success) {
        Alert.alert('Verification Failed', 'Could not verify your identity');
        return;
      }
    }
    
    try {
      await SecureStore.setItemAsync('biometric_enabled', value ? 'true' : 'false');
      setBiometricEnabled(value);
      Alert.alert(
        value ? 'Biometric Enabled' : 'Biometric Disabled',
        value 
          ? 'You can now use biometric login' 
          : 'Biometric login has been disabled'
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to update biometric setting');
    }
  };

  const getBiometricIcon = () => {
    if (biometricType === 'face') return 'scan-outline';
    if (biometricType === 'fingerprint') return 'finger-print-outline';
    return 'lock-closed-outline';
  };

  const getBiometricName = () => {
    if (biometricType === 'face') return 'Face ID';
    if (biometricType === 'fingerprint') return 'Fingerprint';
    return 'Biometric';
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={[styles.headerIcon, { backgroundColor: theme.primary + '15' }]}>
          <Ionicons name={getBiometricIcon()} size={48} color={theme.primary} />
        </View>
        <Text style={[styles.headerTitle, { color: theme.text }]}>
          {getBiometricName()} Login
        </Text>
        <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
          Use biometric authentication for quick and secure login
        </Text>
      </View>

      {/* Status Card */}
      <View style={styles.section}>
        {!biometricAvailable ? (
          <View style={[styles.statusCard, { backgroundColor: theme.warning + '15' }]}>
            <Ionicons name="warning-outline" size={24} color={theme.warning} />
            <View style={styles.statusContent}>
              <Text style={[styles.statusTitle, { color: theme.text }]}>
                Biometric Not Available
              </Text>
              <Text style={[styles.statusMessage, { color: theme.textSecondary }]}>
                Your device doesn't support biometric authentication or it hasn't been set up.
              </Text>
            </View>
          </View>
        ) : !hasCredentials ? (
          <View style={[styles.statusCard, { backgroundColor: theme.info + '15' }]}>
            <Ionicons name="information-circle-outline" size={24} color={theme.info} />
            <View style={styles.statusContent}>
              <Text style={[styles.statusTitle, { color: theme.text }]}>
                Login First
              </Text>
              <Text style={[styles.statusMessage, { color: theme.textSecondary }]}>
                Please login with your email and password to enable biometric login.
              </Text>
            </View>
          </View>
        ) : (
          <View style={[styles.toggleCard, { backgroundColor: theme.card }]}>
            <View style={styles.toggleLeft}>
              <View style={[styles.toggleIcon, { backgroundColor: theme.primary + '15' }]}>
                <Ionicons name={getBiometricIcon()} size={24} color={theme.primary} />
              </View>
              <View>
                <Text style={[styles.toggleTitle, { color: theme.text }]}>
                  Enable {getBiometricName()}
                </Text>
                <Text style={[styles.toggleSubtitle, { color: theme.textSecondary }]}>
                  {biometricEnabled ? 'Currently enabled' : 'Currently disabled'}
                </Text>
              </View>
            </View>
            <Switch
              value={biometricEnabled}
              onValueChange={toggleBiometric}
              trackColor={{ false: theme.border, true: theme.primary + '50' }}
              thumbColor={biometricEnabled ? theme.primary : '#f4f3f4'}
            />
          </View>
        )}
      </View>

      {/* Info Section */}
      {biometricAvailable && hasCredentials && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>HOW IT WORKS</Text>
          <View style={[styles.infoCard, { backgroundColor: theme.card }]}>
            <View style={styles.infoItem}>
              <View style={[styles.infoNumber, { backgroundColor: theme.primary }]}>
                <Text style={styles.infoNumberText}>1</Text>
              </View>
              <Text style={[styles.infoText, { color: theme.text }]}>
                Your login credentials are securely stored on your device
              </Text>
            </View>
            <View style={styles.infoItem}>
              <View style={[styles.infoNumber, { backgroundColor: theme.primary }]}>
                <Text style={styles.infoNumberText}>2</Text>
              </View>
              <Text style={[styles.infoText, { color: theme.text }]}>
                When you open the app, use {getBiometricName()} to verify your identity
              </Text>
            </View>
            <View style={styles.infoItem}>
              <View style={[styles.infoNumber, { backgroundColor: theme.primary }]}>
                <Text style={styles.infoNumberText}>3</Text>
              </View>
              <Text style={[styles.infoText, { color: theme.text }]}>
                You'll be logged in automatically - fast and secure!
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Security Note */}
      <View style={[styles.securityNote, { backgroundColor: theme.card }]}>
        <Ionicons name="shield-checkmark-outline" size={20} color={theme.success} />
        <Text style={[styles.securityNoteText, { color: theme.textSecondary }]}>
          Your credentials are encrypted and stored securely on your device. They are never sent to external servers.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    padding: 24,
  },
  headerIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  section: {
    padding: 16,
    paddingTop: 0,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: 12,
    marginLeft: 4,
  },
  statusCard: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    gap: 12,
    alignItems: 'flex-start',
  },
  statusContent: {
    flex: 1,
  },
  statusTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  statusMessage: {
    fontSize: 13,
    lineHeight: 18,
  },
  toggleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 16,
  },
  toggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  toggleIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  toggleTitle: {
    fontSize: 16,
    fontWeight: '500',
  },
  toggleSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  infoCard: {
    padding: 16,
    borderRadius: 16,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
    gap: 12,
  },
  infoNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoNumberText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  securityNote: {
    flexDirection: 'row',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    gap: 12,
    alignItems: 'flex-start',
  },
  securityNoteText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
  },
});
