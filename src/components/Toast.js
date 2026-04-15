import React, { useState, useEffect, useRef, useCallback, createContext, useContext } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity, Platform, StatusBar } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '../theme';

/**
 * Toast notification system — replaces Alert.alert with beautiful non-blocking toasts.
 *
 * Usage:
 *   // Wrap your app:
 *   <ToastProvider><App /></ToastProvider>
 *
 *   // In any component:
 *   const toast = useToast();
 *   toast.success('Match created successfully');
 *   toast.error('Failed to load data');
 *   toast.warning('You are offline');
 *   toast.info('Tap to view scorecard');
 *
 *   // With title:
 *   toast.error('Login Failed', 'Invalid credentials');
 *
 *   // Custom duration (ms):
 *   toast.success('Saved', null, 5000);
 */

const TOAST_DURATION = 3000;

const TOAST_CONFIG = {
  success: {
    icon: 'check-circle',
    bg: '#065F46',
    border: '#10B981',
    iconColor: '#34D399',
  },
  error: {
    icon: 'alert-circle',
    bg: '#7F1D1D',
    border: COLORS.RED,
    iconColor: '#F87171',
  },
  warning: {
    icon: 'alert',
    bg: '#78350F',
    border: '#F59E0B',
    iconColor: '#FBBF24',
  },
  info: {
    icon: 'information',
    bg: '#1E3A5F',
    border: '#3B82F6',
    iconColor: '#60A5FA',
  },
};

const ToastContext = createContext(null);

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
};

const ToastItem = ({ toast, onDismiss }) => {
  const translateY = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const config = TOAST_CONFIG[toast.type] || TOAST_CONFIG.info;

  useEffect(() => {
    // Slide in
    Animated.parallel([
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 80, friction: 10 }),
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();

    // Auto-dismiss
    const timer = setTimeout(() => dismiss(), toast.duration || TOAST_DURATION);
    return () => clearTimeout(timer);
  }, []);

  const dismiss = () => {
    Animated.parallel([
      Animated.timing(translateY, { toValue: -100, duration: 250, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => onDismiss(toast.id));
  };

  return (
    <Animated.View style={[styles.toast, { backgroundColor: config.bg, borderColor: config.border, transform: [{ translateY }], opacity }]}>
      <TouchableOpacity style={styles.toastInner} activeOpacity={0.8} onPress={dismiss}>
        <MaterialCommunityIcons name={config.icon} size={22} color={config.iconColor} />
        <View style={styles.toastContent}>
          {toast.title && <Text style={styles.toastTitle}>{toast.title}</Text>}
          {toast.message && <Text style={[styles.toastMessage, !toast.title && styles.toastMessageOnly]}>{toast.message}</Text>}
        </View>
        <TouchableOpacity onPress={dismiss} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <MaterialCommunityIcons name="close" size={16} color="rgba(255,255,255,0.5)" />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
};

export const ToastProvider = ({ children }) => {
  const topOffset = Platform.OS === 'ios' ? 50 : (StatusBar.currentHeight || 24) + 10;
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const show = useCallback((type, titleOrMsg, message, duration) => {
    const id = ++idRef.current;
    // If only 2 args: show(type, message) — no title
    const hasTitle = message !== undefined && message !== null;
    const toast = {
      id,
      type,
      title: hasTitle ? titleOrMsg : null,
      message: hasTitle ? message : titleOrMsg,
      duration: duration || TOAST_DURATION,
    };
    setToasts(prev => {
      // Max 3 visible toasts — remove oldest
      const next = [...prev, toast];
      return next.length > 3 ? next.slice(-3) : next;
    });
    return id;
  }, []);

  const api = {
    success: (titleOrMsg, message, duration) => show('success', titleOrMsg, message, duration),
    error: (titleOrMsg, message, duration) => show('error', titleOrMsg, message, duration),
    warning: (titleOrMsg, message, duration) => show('warning', titleOrMsg, message, duration),
    info: (titleOrMsg, message, duration) => show('info', titleOrMsg, message, duration),
    dismiss,
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      <View style={[styles.container, { top: topOffset }]} pointerEvents="box-none">
        {toasts.map(t => (
          <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </View>
    </ToastContext.Provider>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 9999,
    elevation: 9999,
  },
  toast: {
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 8,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12 },
      android: { elevation: 8 },
    }),
  },
  toastInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  toastContent: {
    flex: 1,
  },
  toastTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 2,
  },
  toastMessage: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    lineHeight: 18,
  },
  toastMessageOnly: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
});
