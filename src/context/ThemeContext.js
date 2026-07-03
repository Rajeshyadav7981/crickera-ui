import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
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

  // App is locked to the dark blue/black theme. Force it on mount and clear any
  // previously-saved 'light' preference so older installs flip to dark too.
  useEffect(() => {
    applyTheme(true);
    AsyncStorage.setItem(THEME_KEY, 'dark').catch(() => {});
  }, []);

  // Theme switching is disabled — kept as a no-op so any stray caller is safe.
  const toggleTheme = useCallback(() => {}, []);

  // Provide both the reactive context values AND ensure COLORS/GRADIENTS are in sync.
  // Memoized so consumers only re-render when isDark actually flips, not on every
  // ThemeProvider render.
  const value = useMemo(() => ({
    isDark,
    colors: isDark ? DARK_COLORS : LIGHT_COLORS,
    gradients: isDark ? DARK_GRADIENTS : LIGHT_GRADIENTS,
    toggleTheme,
  }), [isDark, toggleTheme]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};
