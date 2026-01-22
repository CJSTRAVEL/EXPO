import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { API_URL } from '../config';

export default function DiagnosticsScreen({ navigation }) {
  const { theme } = useTheme();
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState(null);

  const runDiagnostics = async () => {
    setRunning(true);
    setResults(null);
    
    const diagnosticResults = {
      network: { status: 'checking', message: '' },
      api: { status: 'checking', message: '' },
      location: { status: 'checking', message: '' },
      storage: { status: 'checking', message: '' },
      notifications: { status: 'checking', message: '' },
    };
    
    setResults({ ...diagnosticResults });
    
    // Check Network
    try {
      const start = Date.now();
      await fetch('https://www.google.com', { method: 'HEAD' });
      const latency = Date.now() - start;
      diagnosticResults.network = { 
        status: 'pass', 
        message: `Connected (${latency}ms)` 
      };
    } catch (error) {
      diagnosticResults.network = { 
        status: 'fail', 
        message: 'No internet connection' 
      };
    }
    setResults({ ...diagnosticResults });
    
    // Check API
    try {
      const start = Date.now();
      const response = await fetch(`${API_URL}/health`);
      const latency = Date.now() - start;
      if (response.ok) {
        diagnosticResults.api = { 
          status: 'pass', 
          message: `Server responding (${latency}ms)` 
        };
      } else {
        diagnosticResults.api = { 
          status: 'warning', 
          message: `Server returned ${response.status}` 
        };
      }
    } catch (error) {
      diagnosticResults.api = { 
        status: 'fail', 
        message: 'Cannot reach server' 
      };
    }
    setResults({ ...diagnosticResults });
    
    // Check Location
    try {
      const { status } = await import('expo-location').then(m => m.requestForegroundPermissionsAsync());
      if (status === 'granted') {
        diagnosticResults.location = { 
          status: 'pass', 
          message: 'Location access granted' 
        };
      } else {
        diagnosticResults.location = { 
          status: 'fail', 
          message: 'Location permission denied' 
        };
      }
    } catch (error) {
      diagnosticResults.location = { 
        status: 'warning', 
        message: 'Could not check location' 
      };
    }
    setResults({ ...diagnosticResults });
    
    // Check Storage
    try {
      const SecureStore = await import('expo-secure-store');
      await SecureStore.setItemAsync('diagnostic_test', 'test');
      await SecureStore.deleteItemAsync('diagnostic_test');
      diagnosticResults.storage = { 
        status: 'pass', 
        message: 'Secure storage working' 
      };
    } catch (error) {
      diagnosticResults.storage = { 
        status: 'fail', 
        message: 'Storage access failed' 
      };
    }
    setResults({ ...diagnosticResults });
    
    // Check Notifications
    try {
      const Notifications = await import('expo-notifications');
      const { status } = await Notifications.getPermissionsAsync();
      if (status === 'granted') {
        diagnosticResults.notifications = { 
          status: 'pass', 
          message: 'Notifications enabled' 
        };
      } else {
        diagnosticResults.notifications = { 
          status: 'warning', 
          message: 'Notifications not enabled' 
        };
      }
    } catch (error) {
      diagnosticResults.notifications = { 
        status: 'warning', 
        message: 'Could not check notifications' 
      };
    }
    setResults({ ...diagnosticResults });
    
    setRunning(false);
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pass':
        return { name: 'checkmark-circle', color: theme.success };
      case 'fail':
        return { name: 'close-circle', color: theme.danger };
      case 'warning':
        return { name: 'warning', color: theme.warning };
      default:
        return { name: 'ellipsis-horizontal-circle', color: theme.textSecondary };
    }
  };

  const DiagnosticItem = ({ title, icon, result }) => {
    const statusIcon = getStatusIcon(result?.status);
    
    return (
      <View style={[styles.diagnosticItem, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <View style={[styles.itemIcon, { backgroundColor: theme.primary + '15' }]}>
          <Ionicons name={icon} size={22} color={theme.primary} />
        </View>
        <View style={styles.itemContent}>
          <Text style={[styles.itemTitle, { color: theme.text }]}>{title}</Text>
          {result && (
            <Text style={[styles.itemMessage, { color: theme.textSecondary }]}>
              {result.message}
            </Text>
          )}
        </View>
        {result ? (
          <Ionicons name={statusIcon.name} size={24} color={statusIcon.color} />
        ) : (
          <View style={[styles.pendingDot, { backgroundColor: theme.textSecondary }]} />
        )}
      </View>
    );
  };

  const allPassed = results && Object.values(results).every(r => r.status === 'pass');
  const hasFails = results && Object.values(results).some(r => r.status === 'fail');

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View style={[styles.headerIcon, { backgroundColor: theme.primary + '15' }]}>
            <Ionicons name="speedometer-outline" size={40} color={theme.primary} />
          </View>
          <Text style={[styles.headerTitle, { color: theme.text }]}>App Diagnostics</Text>
          <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
            Run a quick check to ensure everything is working properly
          </Text>
        </View>

        {/* Results Summary */}
        {results && !running && (
          <View style={[
            styles.summaryBanner, 
            { backgroundColor: allPassed ? theme.success + '15' : hasFails ? theme.danger + '15' : theme.warning + '15' }
          ]}>
            <Ionicons 
              name={allPassed ? 'checkmark-circle' : hasFails ? 'alert-circle' : 'warning'} 
              size={24} 
              color={allPassed ? theme.success : hasFails ? theme.danger : theme.warning} 
            />
            <Text style={[styles.summaryText, { color: theme.text }]}>
              {allPassed ? 'All systems operational!' : hasFails ? 'Some issues detected' : 'Minor issues found'}
            </Text>
          </View>
        )}

        {/* Diagnostic Items */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>SYSTEM CHECKS</Text>
          <DiagnosticItem 
            title="Network Connection" 
            icon="wifi-outline" 
            result={results?.network} 
          />
          <DiagnosticItem 
            title="API Server" 
            icon="server-outline" 
            result={results?.api} 
          />
          <DiagnosticItem 
            title="Location Services" 
            icon="location-outline" 
            result={results?.location} 
          />
          <DiagnosticItem 
            title="Secure Storage" 
            icon="lock-closed-outline" 
            result={results?.storage} 
          />
          <DiagnosticItem 
            title="Push Notifications" 
            icon="notifications-outline" 
            result={results?.notifications} 
          />
        </View>

        {/* Run Button */}
        <TouchableOpacity
          style={[styles.runButton, { backgroundColor: theme.primary }]}
          onPress={runDiagnostics}
          disabled={running}
        >
          {running ? (
            <>
              <ActivityIndicator color="#fff" size="small" />
              <Text style={styles.runButtonText}>Running Diagnostics...</Text>
            </>
          ) : (
            <>
              <Ionicons name="play" size={20} color="#fff" />
              <Text style={styles.runButtonText}>
                {results ? 'Run Again' : 'Start Diagnostics'}
              </Text>
            </>
          )}
        </TouchableOpacity>

        <View style={{ height: 32 }} />
      </ScrollView>
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
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 14,
    textAlign: 'center',
  },
  summaryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 12,
    gap: 12,
    marginBottom: 8,
  },
  summaryText: {
    fontSize: 15,
    fontWeight: '600',
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: 12,
    marginLeft: 4,
  },
  diagnosticItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  itemIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  itemContent: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '500',
  },
  itemMessage: {
    fontSize: 12,
    marginTop: 2,
  },
  pendingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  runButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  runButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
