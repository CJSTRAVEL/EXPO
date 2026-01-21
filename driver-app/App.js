import React, { useEffect, useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Alert } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';

import { AuthProvider, useAuth } from './src/context/AuthContext';
import { COLORS, LOCATION_UPDATE_INTERVAL } from './src/config';
import { updateLocation } from './src/services/api';
import {
  registerForPushNotificationsAsync,
  addNotificationListeners,
} from './src/services/notifications';

// Screens
import LoginScreen from './src/screens/LoginScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import JobsScreen from './src/screens/JobsScreen';
import EarningsScreen from './src/screens/EarningsScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import ChatScreen from './src/screens/ChatScreen';
import NavigationScreen from './src/screens/NavigationScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Location tracking hook
const useLocationTracking = () => {
  const { isAuthenticated, user } = useAuth();

  useEffect(() => {
    let locationSubscription;

    const startLocationTracking = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          console.log('Location permission denied');
          return;
        }

        // Start watching location
        locationSubscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: LOCATION_UPDATE_INTERVAL,
            distanceInterval: 50, // Update every 50 meters
          },
          async (location) => {
            try {
              await updateLocation(
                location.coords.latitude,
                location.coords.longitude
              );
            } catch (error) {
              console.log('Error updating location:', error);
            }
          }
        );
      } catch (error) {
        console.log('Error starting location tracking:', error);
      }
    };

    if (isAuthenticated && user?.is_online) {
      startLocationTracking();
    }

    return () => {
      if (locationSubscription) {
        locationSubscription.remove();
      }
    };
  }, [isAuthenticated, user?.is_online]);
};

// Push notifications hook
const usePushNotifications = (navigationRef) => {
  const { isAuthenticated } = useAuth();
  const notificationListener = useRef();
  const responseListener = useRef();

  useEffect(() => {
    if (!isAuthenticated) return;

    // Register for push notifications
    registerForPushNotificationsAsync();

    // Handle notification received while app is foregrounded
    const handleNotificationReceived = (notification) => {
      console.log('Notification received:', notification);
      const { title, body, data } = notification.request.content;
      
      // Show an alert for new booking notifications
      if (data?.type === 'new_booking') {
        Alert.alert(
          title || 'New Booking',
          body || 'You have a new booking assignment',
          [
            { text: 'Later', style: 'cancel' },
            {
              text: 'View',
              onPress: () => {
                if (navigationRef.current) {
                  navigationRef.current.navigate('Jobs');
                }
              },
            },
          ]
        );
      }
    };

    // Handle notification tap
    const handleNotificationResponse = (response) => {
      console.log('Notification tapped:', response);
      const { data } = response.notification.request.content;
      
      if (data?.booking_id && navigationRef.current) {
        navigationRef.current.navigate('Jobs');
      }
    };

    // Add listeners
    const removeListeners = addNotificationListeners(
      handleNotificationReceived,
      handleNotificationResponse
    );

    return removeListeners;
  }, [isAuthenticated]);
};

// Tab Navigator for authenticated users
function MainTabs() {
  useLocationTracking();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          switch (route.name) {
            case 'Dashboard':
              iconName = focused ? 'home' : 'home-outline';
              break;
            case 'Jobs':
              iconName = focused ? 'car' : 'car-outline';
              break;
            case 'Earnings':
              iconName = focused ? 'wallet' : 'wallet-outline';
              break;
            case 'History':
              iconName = focused ? 'time' : 'time-outline';
              break;
            case 'Profile':
              iconName = focused ? 'person' : 'person-outline';
              break;
            default:
              iconName = 'ellipse';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textSecondary,
        tabBarStyle: {
          backgroundColor: COLORS.card,
          borderTopColor: COLORS.border,
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
        },
        headerStyle: {
          backgroundColor: COLORS.primary,
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: '600',
        },
      })}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          headerShown: false,
        }}
      />
      <Tab.Screen
        name="Jobs"
        component={JobsScreen}
        options={{
          title: 'My Jobs',
        }}
      />
      <Tab.Screen
        name="Earnings"
        component={EarningsScreen}
        options={{
          title: 'Earnings',
        }}
      />
      <Tab.Screen
        name="History"
        component={HistoryScreen}
        options={{
          title: 'History',
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          headerShown: false,
        }}
      />
    </Tab.Navigator>
  );
}

// Main Stack Navigator
function AppNavigator({ navigationRef }) {
  const { isAuthenticated, loading } = useAuth();
  usePushNotifications(navigationRef);

  if (loading) {
    return null; // Or a splash screen
  }

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: COLORS.primary,
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: '600',
        },
      }}
    >
      {!isAuthenticated ? (
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{ headerShown: false }}
        />
      ) : (
        <>
          <Stack.Screen
            name="Main"
            component={MainTabs}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Chat"
            component={ChatScreen}
            options={({ route }) => ({
              title: `Chat - ${route.params?.booking?.booking_id || 'Booking'}`,
            })}
          />
          <Stack.Screen
            name="Navigation"
            component={NavigationScreen}
            options={{
              headerShown: false,
              presentation: 'fullScreenModal',
            }}
          />
        </>
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  const navigationRef = useRef();

  return (
    <AuthProvider>
      <NavigationContainer ref={navigationRef}>
        <StatusBar style="light" />
        <AppNavigator navigationRef={navigationRef} />
      </NavigationContainer>
    </AuthProvider>
  );
}
