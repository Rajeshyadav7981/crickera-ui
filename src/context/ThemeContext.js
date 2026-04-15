import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  COLORS, GRADIENTS, applyTheme,
  DARK_COLORS, LIGHT_COLORS, DARK_GRADIENTS, LIGHT_GRADIENTS,
} from '../theme';

const THEME_KEY = 'app_theme';

const ThemeContext = createContext({
  isDark: true,
  colors: DARK_COLORS,
  gradients: DARK_GRADIENTS,
  toggleTheme: () => {},
});

export const useThemeContext = () => useContext(ThemeContext);

export const ThemeProvider = ({ children }) => {
  const [isDark, setIsDark] = useState(true);
  // Counter to force re-render on all consumers when theme changes
  const [, setTick] = useState(0);

  // Load saved theme on mount
  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then((val) => {
      if (val === 'light') {
        setIsDark(false);
        applyTheme(false);
        setTick(t => t + 1);
      }
    });
  }, []);

  const toggleTheme = useCallback(async () => {
    const next = !isDark;
    setIsDark(next);
    // Mutate the global COLORS/GRADIENTS in-place (like CSS variables)
    applyTheme(next);
    // Force re-render
    setTick(t => t + 1);
    await AsyncStorage.setItem(THEME_KEY, next ? 'dark' : 'light');
  }, [isDark]);

  // Provide both the reactive context values AND ensure COLORS/GRADIENTS are in sync
  const value = {
    isDark,
    colors: isDark ? DARK_COLORS : LIGHT_COLORS,
    gradients: isDark ? DARK_GRADIENTS : LIGHT_GRADIENTS,
    toggleTheme,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};
