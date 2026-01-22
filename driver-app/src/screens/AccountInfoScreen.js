import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { changePassword } from '../services/api';

export default function AccountInfoScreen({ navigation }) {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'New passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert('Error', 'New password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      await changePassword(currentPassword, newPassword);
      Alert.alert('Success', 'Password changed successfully');
      setShowChangePassword(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

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
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Login Information */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>LOGIN INFORMATION</Text>
          <View style={[styles.card, { backgroundColor: theme.card }]}>
            <InfoItem icon="mail-outline" label="Email" value={user?.email} />
            <InfoItem icon="key-outline" label="Password" value="••••••••" />
          </View>
        </View>

        {/* Change Password Button */}
        {!showChangePassword && (
          <TouchableOpacity
            style={[styles.changePasswordBtn, { backgroundColor: theme.primary }]}
            onPress={() => setShowChangePassword(true)}
          >
            <Ionicons name="lock-closed-outline" size={20} color="#fff" />
            <Text style={styles.changePasswordBtnText}>Change Password</Text>
          </TouchableOpacity>
        )}

        {/* Change Password Form */}
        {showChangePassword && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>CHANGE PASSWORD</Text>
            <View style={[styles.card, { backgroundColor: theme.card, padding: 16 }]}>
              {/* Current Password */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Current Password</Text>
                <View style={[styles.inputContainer, { backgroundColor: theme.inputBg, borderColor: theme.border }]}>
                  <TextInput
                    style={[styles.input, { color: theme.text }]}
                    value={currentPassword}
                    onChangeText={setCurrentPassword}
                    secureTextEntry={!showCurrentPassword}
                    placeholder="Enter current password"
                    placeholderTextColor={theme.textSecondary}
                  />
                  <TouchableOpacity onPress={() => setShowCurrentPassword(!showCurrentPassword)}>
                    <Ionicons 
                      name={showCurrentPassword ? "eye-off-outline" : "eye-outline"} 
                      size={20} 
                      color={theme.textSecondary} 
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* New Password */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>New Password</Text>
                <View style={[styles.inputContainer, { backgroundColor: theme.inputBg, borderColor: theme.border }]}>
                  <TextInput
                    style={[styles.input, { color: theme.text }]}
                    value={newPassword}
                    onChangeText={setNewPassword}
                    secureTextEntry={!showNewPassword}
                    placeholder="Enter new password"
                    placeholderTextColor={theme.textSecondary}
                  />
                  <TouchableOpacity onPress={() => setShowNewPassword(!showNewPassword)}>
                    <Ionicons 
                      name={showNewPassword ? "eye-off-outline" : "eye-outline"} 
                      size={20} 
                      color={theme.textSecondary} 
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Confirm Password */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Confirm New Password</Text>
                <View style={[styles.inputContainer, { backgroundColor: theme.inputBg, borderColor: theme.border }]}>
                  <TextInput
                    style={[styles.input, { color: theme.text }]}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry={true}
                    placeholder="Confirm new password"
                    placeholderTextColor={theme.textSecondary}
                  />
                </View>
              </View>

              {/* Buttons */}
              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={[styles.cancelBtn, { borderColor: theme.border }]}
                  onPress={() => {
                    setShowChangePassword(false);
                    setCurrentPassword('');
                    setNewPassword('');
                    setConfirmPassword('');
                  }}
                >
                  <Text style={[styles.cancelBtnText, { color: theme.text }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveBtn, { backgroundColor: theme.primary }]}
                  onPress={handleChangePassword}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.saveBtnText}>Save</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* Account Status */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>ACCOUNT STATUS</Text>
          <View style={[styles.card, { backgroundColor: theme.card }]}>
            <InfoItem 
              icon="checkmark-circle-outline" 
              label="Account Status" 
              value={user?.status === 'active' ? 'Active' : 'Inactive'} 
            />
            <InfoItem icon="calendar-outline" label="Member Since" value={user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'} />
          </View>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  changePasswordBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  changePasswordBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 12,
    marginBottom: 6,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  cancelBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },
  saveBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});
