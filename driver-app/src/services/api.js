import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import { API_URL } from '../config';

// Create axios instance
const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor for debugging
api.interceptors.request.use(
  (config) => {
    console.log('API Request:', config.method?.toUpperCase(), config.baseURL + config.url);
    return config;
  },
  (error) => {
    console.error('API Request Error:', error);
    return Promise.reject(error);
  }
);

// Add response interceptor for debugging
api.interceptors.response.use(
  (response) => {
    console.log('API Response:', response.status, response.config.url);
    return response;
  },
  (error) => {
    console.error('API Response Error:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
    } else if (error.request) {
      console.error('No response received - network error');
    }
    return Promise.reject(error);
  }
);

// Token management
let authToken = null;

export const setAuthToken = async (token) => {
  authToken = token;
  if (token) {
    await SecureStore.setItemAsync('driver_token', token);
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    await SecureStore.deleteItemAsync('driver_token');
    delete api.defaults.headers.common['Authorization'];
  }
};

export const getStoredToken = async () => {
  try {
    const token = await SecureStore.getItemAsync('driver_token');
    if (token) {
      authToken = token;
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }
    return token;
  } catch (error) {
    console.error('Error getting stored token:', error);
    return null;
  }
};

// Get current auth token (synchronous - returns cached token)
export const getCurrentToken = () => {
  return authToken;
};

// Auth API
export const loginDriver = async (email, password) => {
  try {
    console.log('Attempting login for:', email);
    console.log('API URL:', API_URL);
    const response = await api.post('/driver/login', { email, password });
    console.log('Login response:', response.data);
    if (response.data.token) {
      await setAuthToken(response.data.token);
    }
    return response.data;
  } catch (error) {
    console.error('Login error:', error);
    console.error('Error response:', error.response?.data);
    console.error('Error status:', error.response?.status);
    throw error;
  }
};

export const logoutDriver = async () => {
  await setAuthToken(null);
};

// Profile API
export const getProfile = async () => {
  const response = await api.get('/driver/profile');
  return response.data;
};

export const updateStatus = async (statusData) => {
  const response = await api.put('/driver/status', statusData);
  return response.data;
};

export const updateLocation = async (latitude, longitude) => {
  const response = await api.put('/driver/location', { latitude, longitude });
  return response.data;
};

// Bookings API
export const getBookings = async () => {
  const response = await api.get('/driver/bookings');
  return response.data;
};

export const getPendingAssignments = async () => {
  const response = await api.get('/driver/bookings/pending');
  return response.data;
};

export const acceptBooking = async (bookingId) => {
  const response = await api.put(`/driver/bookings/${bookingId}/accept`);
  return response.data;
};

export const rejectBooking = async (bookingId, reason) => {
  const response = await api.put(`/driver/bookings/${bookingId}/reject`, null, {
    params: { reason }
  });
  return response.data;
};

export const updateBookingStatus = async (bookingId, status) => {
  const response = await api.put(`/driver/bookings/${bookingId}/status`, null, {
    params: { status }
  });
  return response.data;
};

export const notifyArrival = async (bookingId) => {
  const response = await api.post(`/driver/bookings/${bookingId}/notify-arrival`);
  return response.data;
};

// Earnings API
export const getEarnings = async () => {
  const response = await api.get('/driver/earnings');
  return response.data;
};

// History API
export const getHistory = async (limit = 50, skip = 0) => {
  const response = await api.get('/driver/history', {
    params: { limit, skip }
  });
  // API returns {bookings: [...], total, limit, skip} - extract bookings array
  return response.data?.bookings || response.data || [];
};

// Chat API
export const sendChatMessage = async (bookingId, message) => {
  const response = await api.post('/driver/chat/send', {
    booking_id: bookingId,
    message,
    sender_type: 'driver'
  });
  return response.data;
};

export const getChatMessages = async (bookingId) => {
  const response = await api.get(`/driver/chat/${bookingId}`);
  return response.data;
};

// Password API
export const changePassword = async (currentPassword, newPassword) => {
  const response = await api.put('/driver/change-password', {
    current_password: currentPassword,
    new_password: newPassword
  });
  return response.data;
};

// Vehicles API
export const getVehicles = async () => {
  const response = await api.get('/vehicles');
  return response.data;
};

// Get available vehicles with exclusivity status
export const getAvailableVehicles = async () => {
  const response = await api.get('/driver/available-vehicles');
  return response.data;
};

// Select a vehicle for the shift
export const selectVehicle = async (vehicleId) => {
  const response = await api.post('/driver/select-vehicle', { vehicle_id: vehicleId });
  return response.data;
};

// Release the currently selected vehicle
export const releaseVehicle = async () => {
  const response = await api.post('/driver/release-vehicle');
  return response.data;
};

// Driver Stats API
export const getDriverStats = async () => {
  const response = await api.get('/driver/stats');
  return response.data;
};

export const getDriverEarnings = async () => {
  const response = await api.get('/driver/earnings');
  return response.data;
};

export const getDriverHistory = async () => {
  const response = await api.get('/driver/history');
  return response.data;
};

// Document Expiry Notifications API
export const getDocumentNotifications = async () => {
  const response = await api.get('/driver/document-notifications');
  return response.data;
};

// Walkaround History API
export const getWalkaroundHistory = async () => {
  const response = await api.get('/driver/walkaround-history');
  return response.data;
};

// Admin Chat API - Now uses booking-specific chats
export const sendAdminMessage = async (bookingId, message) => {
  const response = await api.post('/driver/chat/send', { 
    booking_id: bookingId,
    message,
    sender_type: 'driver'
  });
  return response.data;
};

export const getAdminMessages = async (bookingId) => {
  const response = await api.get(`/driver/chat/${bookingId}`);
  return response.data;
};

export const getAllDriverChats = async () => {
  const response = await api.get('/driver/all-chats');
  return response.data;
};

export const markChatAsRead = async (bookingId) => {
  const response = await api.post(`/driver/chat/${bookingId}/mark-read`);
  return response.data;
};

export default api;
