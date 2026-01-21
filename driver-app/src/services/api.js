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
  return response.data;
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

export default api;
