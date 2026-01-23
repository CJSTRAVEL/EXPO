import React, { useEffect, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, StyleSheet, Platform, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';

// Screens
import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import JobsScreen from './src/screens/JobsScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import ChatScreen from './src/screens/ChatScreen';
import AdminChatScreen from './src/screens/AdminChatScreen';
import NavigationScreen from './src/screens/NavigationScreen';
import JobDetailScreen from './src/screens/JobDetailScreen';
import EarningsScreen from './src/screens/EarningsScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import MenuScreen from './src/screens/MenuScreen';
import PersonalInfoScreen from './src/screens/PersonalInfoScreen';
import AccountInfoScreen from './src/screens/AccountInfoScreen';
import DisplaySettingsScreen from './src/screens/DisplaySettingsScreen';
import VehicleSettingsScreen from './src/screens/VehicleSettingsScreen';
import DiagnosticsScreen from './src/screens/DiagnosticsScreen';
import BiometricSettingsScreen from './src/screens/BiometricSettingsScreen';
import LogoutScreen from './src/screens/LogoutScreen';
import WalkaroundScreen from './src/screens/WalkaroundScreen';
import WalkaroundHistoryScreen from './src/screens/WalkaroundHistoryScreen';

// Configure notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Bottom Tab Navigator
function MainTabs() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  
  // Add extra padding for Android devices with gesture navigation
  const bottomPadding = Platform.OS === 'android' ? Math.max(insets.bottom, 16) : insets.bottom;
  
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Bookings') {
            iconName = focused ? 'document-text' : 'document-text-outline';
          } else if (route.name === 'Dashboard') {
            iconName = focused ? 'grid' : 'grid-outline';
          } else if (route.name === 'Chat') {
            iconName = focused ? 'chatbubbles' : 'chatbubbles-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.textSecondary,
        tabBarStyle: {
          backgroundColor: theme.card,
          borderTopWidth: 1,
          borderTopColor: theme.border,
          paddingTop: 8,
          paddingBottom: Platform.OS === 'ios' ? 24 : bottomPadding + 8,
          height: Platform.OS === 'ios' ? 88 : 64 + bottomPadding,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
          marginTop: 2,
        },
        headerShown: false,
      })}
    >
      <Tab.Screen 
        name="Home" 
        component={HomeScreen}
        options={{
          tabBarLabel: 'Home',
        }}
      />
      <Tab.Screen 
        name="Bookings" 
        component={JobsScreen}
        options={{
          tabBarLabel: 'Bookings',
        }}
      />
      <Tab.Screen 
        name="Dashboard" 
        component={DashboardScreen}
        options={{
          tabBarLabel: 'Dashboard',
        }}
      />
      <Tab.Screen 
        name="Chat" 
        component={AdminChatScreen}
        options={{
          tabBarLabel: 'Chat',
        }}
      />
    </Tab.Navigator>
  );
}

function AppNavigator() {
  const { user, loading } = useAuth();
  const { theme } = useTheme();
  const notificationListener = useRef();
  const responseListener = useRef();
  const navigationRef = useRef();

  useEffect(() => {
    // Handle incoming notifications while app is in foreground
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      console.log('Notification received:', notification);
      // Could show in-app alert here if needed
    });

    // Handle notification tap/response
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Notification response:', response);
      const data = response.notification.request.content.data;
      if (data?.type === 'new_booking' && data?.booking_id) {
        // Navigate to bookings tab when user taps notification
        // Navigation will happen after app loads
      }
    });

    return () => {
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
  }, []);

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <View style={styles.loadingContent}>
          <Image 
            source={require('./assets/logo.png')} 
            style={styles.loadingLogo}
            resizeMode="contain"
          />
          <Text style={[styles.loadingText, { color: theme.primary }]}>CJ's Travel Driver</Text>
        </View>
      </View>
    );
  }

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: theme.primary,
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: '600',
        },
        headerBackTitleVisible: false,
      }}
    >
      {!user ? (
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{ headerShown: false }}
        />
      ) : (
        <>
          <Stack.Screen
            name="MainTabs"
            component={MainTabs}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Menu"
            component={MenuScreen}
            options={{ 
              headerShown: false,
              presentation: 'modal',
              animation: 'slide_from_right',
            }}
          />
          <Stack.Screen
            name="PersonalInfo"
            component={PersonalInfoScreen}
            options={{ title: 'Personal Info' }}
          />
          <Stack.Screen
            name="AccountInfo"
            component={AccountInfoScreen}
            options={{ title: 'Account Info' }}
          />
          <Stack.Screen
            name="DisplaySettings"
            component={DisplaySettingsScreen}
            options={{ title: 'Display' }}
          />
          <Stack.Screen
            name="VehicleSettings"
            component={VehicleSettingsScreen}
            options={{ title: 'Vehicle' }}
          />
          <Stack.Screen
            name="Diagnostics"
            component={DiagnosticsScreen}
            options={{ title: 'Diagnostics' }}
          />
          <Stack.Screen
            name="BiometricSettings"
            component={BiometricSettingsScreen}
            options={{ title: 'Biometric Settings' }}
          />
          <Stack.Screen
            name="Logout"
            component={LogoutScreen}
            options={{ 
              title: 'Logout',
              presentation: 'modal',
            }}
          />
          <Stack.Screen
            name="Walkaround"
            component={WalkaroundScreen}
            options={{ 
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="JobDetail"
            component={JobDetailScreen}
            options={({ route }) => ({
              title: route.params?.booking?.booking_id || 'Job Details',
            })}
          />
          <Stack.Screen
            name="BookingChat"
            component={ChatScreen}
            options={({ route }) => ({
              title: `Chat - ${route.params?.booking?.booking_id || 'Booking'}`,
            })}
          />
          <Stack.Screen
            name="Navigation"
            component={NavigationScreen}
            options={{ 
              title: 'Navigation',
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="Profile"
            component={ProfileScreen}
            options={{ title: 'Profile' }}
          />
          <Stack.Screen
            name="Earnings"
            component={EarningsScreen}
            options={{ title: 'Earnings' }}
          />
          <Stack.Screen
            name="History"
            component={HistoryScreen}
            options={{ title: 'Job History' }}
          />
        </>
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <NavigationContainer>
            <AppNavigator />
          </NavigationContainer>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContent: {
    alignItems: 'center',
  },
  loadingLogo: {
    width: 150,
    height: 150,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '600',
  },
});
