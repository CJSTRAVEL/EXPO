import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Platform,
  TouchableOpacity,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export default function PersonalInfoScreen({ navigation }) {
  const { user } = useAuth();
  const { theme } = useTheme();

  const InfoItem = ({ icon, label, value }) => (
    <View style={[styles.infoItem, { borderBottomColor: theme.border }]}>
      <View style={[styles.iconContainer, { backgroundColor: theme.primary + '15' }]}>
        <Ionicons name={icon} size={20} color={theme.primary} />
      </View>
      <View style={styles.infoContent}>
        <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>{label}</Text>
        <Text style={[styles.infoValue, { color: theme.text }]}>{value || 'Not set'}</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.headerBar, { backgroundColor: theme.headerBg }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Personal Info</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Avatar Header */}
        <View style={[styles.header, { backgroundColor: theme.headerBg }]}>
          <View style={[styles.avatar, { backgroundColor: theme.secondary }]}>
            <Text style={[styles.avatarText, { color: theme.primary }]}>
              {user?.name?.charAt(0)?.toUpperCase() || 'D'}
            </Text>
          </View>
          <Text style={styles.headerName}>{user?.name || 'Driver'}</Text>
          <View style={[styles.statusBadge, { backgroundColor: user?.is_online ? theme.success : theme.offline }]}>
            <Text style={styles.statusText}>{user?.is_online ? 'Online' : 'Offline'}</Text>
          </View>
        </View>

        {/* Personal Information */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>PERSONAL INFORMATION</Text>
          <View style={[styles.card, { backgroundColor: theme.card }]}>
            <InfoItem icon="person-outline" label="Full Name" value={user?.name} />
            <InfoItem icon="mail-outline" label="Email" value={user?.email} />
            <InfoItem icon="call-outline" label="Phone" value={user?.phone} />
          </View>
        </View>

        {/* Driver Information */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>DRIVER INFORMATION</Text>
          <View style={[styles.card, { backgroundColor: theme.card }]}>
            <InfoItem icon="card-outline" label="License Number" value={user?.license_number} />
            <InfoItem icon="calendar-outline" label="License Expiry" value={user?.license_expiry} />
            <InfoItem icon="briefcase-outline" label="Driver Type" value={user?.driver_type} />
          </View>
        </View>

        {/* Vehicle Information */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>VEHICLE INFORMATION</Text>
          <View style={[styles.card, { backgroundColor: theme.card }]}>
            <InfoItem icon="car-outline" label="Vehicle Type" value={user?.vehicle_type} />
            <InfoItem icon="document-text-outline" label="Registration" value={user?.vehicle_number} />
          </View>
        </View>

        {/* Badge/License Information */}
        {user?.driver_type && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>BADGE INFORMATION</Text>
            <View style={[styles.card, { backgroundColor: theme.card }]}>
              {user?.driver_type === 'taxi' && (
                <>
                  <InfoItem icon="shield-checkmark-outline" label="Taxi Badge Number" value={user?.taxi_badge_number} />
                  <InfoItem icon="calendar-outline" label="Badge Expiry" value={user?.taxi_badge_expiry} />
                </>
              )}
              {user?.driver_type === 'psv' && (
                <>
                  <InfoItem icon="shield-checkmark-outline" label="PSV Badge Number" value={user?.psv_badge_number} />
                  <InfoItem icon="calendar-outline" label="Badge Expiry" value={user?.psv_badge_expiry} />
                  <InfoItem icon="document-outline" label="CPC Number" value={user?.cpc_number} />
                  <InfoItem icon="calendar-outline" label="CPC Expiry" value={user?.cpc_expiry} />
                </>
              )}
            </View>
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 0 : 40,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    fontStyle: 'italic',
    color: '#fff',
  },
  header: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingBottom: 32,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  headerName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
  },
  statusBadge: {
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  section: {
    padding: 16,
    paddingBottom: 0,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '500',
  },
});
