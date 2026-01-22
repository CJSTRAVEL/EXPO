import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  Platform,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export default function MenuScreen({ navigation }) {
  const { user } = useAuth();
  const { theme } = useTheme();

  const MenuItem = ({ icon, label, onPress, color }) => (
    <TouchableOpacity
      style={[styles.menuItem, { backgroundColor: theme.card }]}
      onPress={onPress}
    >
      <View style={[styles.menuIconContainer, { backgroundColor: (color || theme.primary) + '15' }]}>
        <Ionicons name={icon} size={22} color={color || theme.primary} />
      </View>
      <Text style={[styles.menuLabel, { color: theme.text }]}>{label}</Text>
      <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
    </TouchableOpacity>
  );

  const SectionHeader = ({ title }) => (
    <Text style={[styles.sectionHeader, { color: theme.textSecondary }]}>{title}</Text>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header with Logo */}
        <View style={[styles.header, { backgroundColor: '#000000' }]}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          <Image
            source={require('../../assets/logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <View style={styles.driverInfo}>
            <Text style={styles.driverName}>{user?.name || 'Driver'}</Text>
            <Text style={styles.driverEmail}>{user?.email || ''}</Text>
          </View>
        </View>

        {/* Profile Section */}
        <View style={styles.section}>
          <SectionHeader title="PROFILE" />
          <View style={[styles.menuCard, { backgroundColor: theme.card }]}>
            <MenuItem
              icon="person-outline"
              label="Personal Info"
              onPress={() => navigation.navigate('PersonalInfo')}
            />
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
            <MenuItem
              icon="key-outline"
              label="Account Info"
              onPress={() => navigation.navigate('AccountInfo')}
            />
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
            <MenuItem
              icon="log-out-outline"
              label="Logout"
              onPress={() => navigation.navigate('Logout')}
              color={theme.danger}
            />
          </View>
        </View>

        {/* Settings Section */}
        <View style={styles.section}>
          <SectionHeader title="SETTINGS" />
          <View style={[styles.menuCard, { backgroundColor: theme.card }]}>
            <MenuItem
              icon="sunny-outline"
              label="Display"
              onPress={() => navigation.navigate('DisplaySettings')}
            />
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
            <MenuItem
              icon="car-outline"
              label="Vehicle"
              onPress={() => navigation.navigate('VehicleSettings')}
            />
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
            <MenuItem
              icon="speedometer-outline"
              label="Diagnostics"
              onPress={() => navigation.navigate('Diagnostics')}
            />
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
            <MenuItem
              icon="finger-print-outline"
              label="Biometric Settings"
              onPress={() => navigation.navigate('BiometricSettings')}
            />
          </View>
        </View>

        {/* App Version */}
        <Text style={[styles.versionText, { color: theme.textSecondary }]}>
          CJ's Travel Driver v1.0.0
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 20 : 50,
    paddingBottom: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  backButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 20 : 50,
    right: 16,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 16,
  },
  driverInfo: {
    alignItems: 'center',
  },
  driverName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  driverEmail: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 4,
  },
  section: {
    paddingHorizontal: 16,
    marginTop: 24,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: 8,
    marginLeft: 4,
  },
  menuCard: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  menuIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  menuLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    marginLeft: 68,
  },
  versionText: {
    textAlign: 'center',
    fontSize: 12,
    marginTop: 32,
    marginBottom: 24,
  },
});
