import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, APP_CONFIG } from '../config';
import { useAuth } from '../context/AuthContext';

export default function ProfileScreen({ navigation }) {
  const { user, logout } = useAuth();

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: logout,
        },
      ]
    );
  };

  const ProfileItem = ({ icon, label, value, onPress }) => (
    <TouchableOpacity
      style={styles.profileItem}
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={styles.profileItemLeft}>
        <View style={styles.iconContainer}>
          <Ionicons name={icon} size={20} color={COLORS.primary} />
        </View>
        <View>
          <Text style={styles.itemLabel}>{label}</Text>
          <Text style={styles.itemValue}>{value || 'Not set'}</Text>
        </View>
      </View>
      {onPress && (
        <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
      )}
    </TouchableOpacity>
  );

  return (
    <ScrollView style={styles.container}>
      {/* Profile Header */}
      <View style={styles.header}>
        {user?.photo ? (
          <Image
            source={{ uri: user.photo.startsWith('data:') ? user.photo : `data:image/jpeg;base64,${user.photo}` }}
            style={styles.avatarImage}
          />
        ) : (
          <View style={styles.avatarContainer}>
            <Text style={styles.avatarText}>
              {user?.name?.charAt(0)?.toUpperCase() || 'D'}
            </Text>
          </View>
        )}
        <Text style={styles.name}>{user?.name || 'Driver'}</Text>
        <Text style={styles.email}>{user?.email || 'No email set'}</Text>
      </View>

      {/* Profile Details */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Profile Details</Text>
        <View style={styles.card}>
          <ProfileItem
            icon="person-outline"
            label="Full Name"
            value={user?.name}
          />
          <ProfileItem
            icon="mail-outline"
            label="Email"
            value={user?.email}
          />
          <ProfileItem
            icon="call-outline"
            label="Phone"
            value={user?.phone}
          />
        </View>
      </View>

      {/* Vehicle Details */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Vehicle Information</Text>
        <View style={styles.card}>
          <ProfileItem
            icon="car-outline"
            label="Vehicle Type"
            value={user?.vehicle_type}
          />
          <ProfileItem
            icon="document-text-outline"
            label="Registration"
            value={user?.vehicle_number}
          />
        </View>
      </View>

      {/* App Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>App Information</Text>
        <View style={styles.card}>
          <ProfileItem
            icon="information-circle-outline"
            label="App Version"
            value={APP_CONFIG.version}
          />
        </View>
      </View>

      {/* Logout Button */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={20} color={COLORS.danger} />
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>

      {/* Footer */}
      <Text style={styles.footer}>{APP_CONFIG.name}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    paddingVertical: 32,
    paddingTop: 48,
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  email: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 4,
  },
  section: {
    padding: 16,
    paddingBottom: 0,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    overflow: 'hidden',
  },
  profileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  profileItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primary + '10',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  itemLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  itemValue: {
    fontSize: 15,
    color: COLORS.text,
    fontWeight: '500',
    marginTop: 2,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    margin: 16,
    padding: 16,
    backgroundColor: COLORS.danger + '10',
    borderRadius: 12,
    gap: 8,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.danger,
  },
  footer: {
    textAlign: 'center',
    color: COLORS.textSecondary,
    fontSize: 12,
    marginBottom: 32,
  },
});
