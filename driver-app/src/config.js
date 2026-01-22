// API Configuration
// In React Native/Expo, use Constants.expoConfig.extra for environment variables
// For now, using the preview URL - will be configured via app.config.js for production
export const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://cjbooking.preview.emergentagent.com/api';

// App Configuration
export const APP_CONFIG = {
  name: "CJ's Executive Travel",
  shortName: "CJ's Driver",
  version: "1.0.0",
};

// Theme Colors
export const COLORS = {
  primary: '#1a3a5c',
  secondary: '#d4af37',
  success: '#22c55e',
  warning: '#f59e0b',
  danger: '#ef4444',
  info: '#3b82f6',
  
  // Status Colors
  available: '#22c55e',
  busy: '#f59e0b',
  offline: '#6b7280',
  onBreak: '#8b5cf6',
  onJob: '#3b82f6',
  
  // Booking Status Colors
  pending: '#f59e0b',
  assigned: '#3b82f6',
  on_way: '#8b5cf6',
  arrived: '#06b6d4',
  in_progress: '#22c55e',
  completed: '#10b981',
  cancelled: '#ef4444',
  
  // UI Colors
  background: '#f8fafc',
  card: '#ffffff',
  text: '#1e293b',
  textSecondary: '#64748b',
  border: '#e2e8f0',
  inputBg: '#f1f5f9',
};

// Booking Status Labels
export const BOOKING_STATUS_LABELS = {
  pending: 'Pending',
  assigned: 'Assigned',
  on_way: 'On Way',
  arrived: 'Arrived',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

// Location Update Interval (in milliseconds)
export const LOCATION_UPDATE_INTERVAL = 30000; // 30 seconds
