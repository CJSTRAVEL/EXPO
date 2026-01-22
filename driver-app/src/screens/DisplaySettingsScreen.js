import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, LIGHT_THEME, DARK_THEME } from '../context/ThemeContext';

export default function DisplaySettingsScreen({ navigation }) {
  const { theme, isDarkMode, setDarkMode } = useTheme();

  const ThemeOption = ({ title, subtitle, isSelected, onPress, icon }) => (
    <TouchableOpacity
      style={[
        styles.themeOption,
        { backgroundColor: theme.card, borderColor: isSelected ? theme.primary : theme.border },
        isSelected && { borderWidth: 2 }
      ]}
      onPress={onPress}
    >
      <View style={[styles.themePreview, { backgroundColor: isSelected ? (isDarkMode ? '#1a1a1a' : '#f8fafc') : theme.inputBg }]}>
        <Ionicons name={icon} size={32} color={isSelected ? theme.primary : theme.textSecondary} />
      </View>
      <Text style={[styles.themeTitle, { color: theme.text }]}>{title}</Text>
      <Text style={[styles.themeSubtitle, { color: theme.textSecondary }]}>{subtitle}</Text>
      {isSelected && (
        <View style={[styles.checkmark, { backgroundColor: theme.primary }]}>
          <Ionicons name="checkmark" size={14} color="#fff" />
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.content}>
        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>APPEARANCE</Text>
        
        <View style={styles.themeGrid}>
          <ThemeOption
            title="Light"
            subtitle="Classic bright theme"
            isSelected={!isDarkMode}
            onPress={() => setDarkMode(false)}
            icon="sunny-outline"
          />
          <ThemeOption
            title="Dark"
            subtitle="Easy on the eyes"
            isSelected={isDarkMode}
            onPress={() => setDarkMode(true)}
            icon="moon-outline"
          />
        </View>

        {/* Quick Toggle */}
        <View style={[styles.toggleCard, { backgroundColor: theme.card }]}>
          <View style={styles.toggleLeft}>
            <View style={[styles.toggleIcon, { backgroundColor: theme.primary + '15' }]}>
              <Ionicons name={isDarkMode ? "moon" : "sunny"} size={22} color={theme.primary} />
            </View>
            <View>
              <Text style={[styles.toggleTitle, { color: theme.text }]}>Dark Mode</Text>
              <Text style={[styles.toggleSubtitle, { color: theme.textSecondary }]}>
                {isDarkMode ? 'Currently enabled' : 'Currently disabled'}
              </Text>
            </View>
          </View>
          <Switch
            value={isDarkMode}
            onValueChange={setDarkMode}
            trackColor={{ false: theme.border, true: theme.primary + '50' }}
            thumbColor={isDarkMode ? theme.primary : '#f4f3f4'}
          />
        </View>

        {/* Info */}
        <View style={[styles.infoCard, { backgroundColor: theme.card }]}>
          <Ionicons name="information-circle-outline" size={20} color={theme.info} />
          <Text style={[styles.infoText, { color: theme.textSecondary }]}>
            Dark mode reduces eye strain in low-light conditions and can help save battery on OLED screens.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: 12,
    marginLeft: 4,
  },
  themeGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  themeOption: {
    flex: 1,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    position: 'relative',
  },
  themePreview: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  themeTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  themeSubtitle: {
    fontSize: 12,
  },
  checkmark: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  toggleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
  },
  toggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  toggleIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
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
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    gap: 12,
    alignItems: 'flex-start',
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
});
