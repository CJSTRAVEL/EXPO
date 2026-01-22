import React, { createContext, useContext, useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';

const ThemeContext = createContext();

export const LIGHT_THEME = {
  primary: '#1a3a5c',
  primaryDark: '#152d47',
  secondary: '#d4af37',
  success: '#22c55e',
  warning: '#f59e0b',
  danger: '#ef4444',
  info: '#3b82f6',
  available: '#22c55e',
  busy: '#f59e0b',
  offline: '#6b7280',
  onBreak: '#8b5cf6',
  onJob: '#3b82f6',
  pending: '#f59e0b',
  assigned: '#3b82f6',
  on_way: '#8b5cf6',
  arrived: '#06b6d4',
  in_progress: '#22c55e',
  completed: '#10b981',
  cancelled: '#ef4444',
  background: '#f8fafc',
  card: '#ffffff',
  text: '#1e293b',
  textSecondary: '#64748b',
  border: '#e2e8f0',
  inputBg: '#f1f5f9',
  headerBg: '#1a3a5c',
  isDark: false,
};

export const DARK_THEME = {
  primary: '#d4af37',
  secondary: '#1a3a5c',
  success: '#22c55e',
  warning: '#f59e0b',
  danger: '#ef4444',
  info: '#3b82f6',
  available: '#22c55e',
  busy: '#f59e0b',
  offline: '#6b7280',
  onBreak: '#8b5cf6',
  onJob: '#3b82f6',
  pending: '#f59e0b',
  assigned: '#3b82f6',
  on_way: '#8b5cf6',
  arrived: '#06b6d4',
  in_progress: '#22c55e',
  completed: '#10b981',
  cancelled: '#ef4444',
  background: '#1a1a1a',
  card: '#252525',
  text: '#ffffff',
  textSecondary: '#a0a0a0',
  border: '#333333',
  inputBg: '#2d2d2d',
  isDark: true,
};

export function ThemeProvider({ children }) {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [theme, setTheme] = useState(LIGHT_THEME);

  useEffect(() => {
    loadThemePreference();
  }, []);

  const loadThemePreference = async () => {
    try {
      const savedTheme = await SecureStore.getItemAsync('theme_mode');
      if (savedTheme === 'dark') {
        setIsDarkMode(true);
        setTheme(DARK_THEME);
      }
    } catch (error) {
      console.log('Error loading theme:', error);
    }
  };

  const toggleTheme = async () => {
    try {
      const newMode = !isDarkMode;
      setIsDarkMode(newMode);
      setTheme(newMode ? DARK_THEME : LIGHT_THEME);
      await SecureStore.setItemAsync('theme_mode', newMode ? 'dark' : 'light');
    } catch (error) {
      console.log('Error saving theme:', error);
    }
  };

  const setDarkMode = async (dark) => {
    try {
      setIsDarkMode(dark);
      setTheme(dark ? DARK_THEME : LIGHT_THEME);
      await SecureStore.setItemAsync('theme_mode', dark ? 'dark' : 'light');
    } catch (error) {
      console.log('Error saving theme:', error);
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, isDarkMode, toggleTheme, setDarkMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
