import React, { createContext, useState, useContext, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import { getStoredToken, loginDriver, logoutDriver, getProfile } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const token = await getStoredToken();
      if (token) {
        const profile = await getProfile();
        setUser(profile);
        setIsAuthenticated(true);
      }
    } catch (error) {
      console.log('Auth check failed:', error);
      await logoutDriver();
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      console.log('AuthContext: Attempting login for:', email);
      const response = await loginDriver(email, password);
      console.log('AuthContext: Login successful, driver:', response.driver);
      setUser(response.driver);
      setIsAuthenticated(true);
      return { success: true };
    } catch (error) {
      console.error('AuthContext: Login error:', error);
      console.error('AuthContext: Error response:', error.response?.data);
      console.error('AuthContext: Error message:', error.message);
      const message = error.response?.data?.detail || error.message || 'Login failed. Please check your connection.';
      return { success: false, error: message };
    }
  };

  const logout = async () => {
    await logoutDriver();
    setUser(null);
    setIsAuthenticated(false);
  };

  const refreshProfile = async () => {
    try {
      const profile = await getProfile();
      setUser(profile);
    } catch (error) {
      console.error('Failed to refresh profile:', error);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated,
        login,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
