import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity, Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '../theme';

/**
 * Global network status bar — shows when offline with retry button.
 * Slides in from top when connection lost, slides out when restored.
 * Shows reconnecting state with spinner.
 *
 * Place this in App.js inside ToastProvider.
 */
const NetworkBar = () => {
  const [isConnected, setIsConnected] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const slideAnim = useRef(new Animated.Value(-60)).current;

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      // isInternetReachable can be null (unknown) in Expo Go — treat as connected
      const connected = state.isConnected !== false && state.isInternetReachable !== false;
      setIsConnected(connected);
      if (connected) setRetrying(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: isConnected ? -60 : 0,
      useNativeDriver: true,
      tension: 80,
      friction: 10,
    }).start();
  }, [isConnected]);

  const handleRetry = async () => {
    setRetrying(true);
    const state = await NetInfo.fetch();
    setIsConnected(state.isConnected !== false && state.isInternetReachable !== false);
    setTimeout(() => setRetrying(false), 2000);
  };

  return (
    <Animated.View style={[styles.bar, { transform: [{ translateY: slideAnim }] }]}>
      <View style={styles.content}>
        <MaterialCommunityIcons
          name={retrying ? 'loading' : 'wifi-off'}
          size={16}
          color="#fff"
        />
        <Text style={styles.text}>
          {retrying ? 'Reconnecting...' : 'No internet connection'}
        </Text>
        {!retrying && (
          <TouchableOpacity style={styles.retryBtn} onPress={handleRetry} activeOpacity={0.7}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 30,
    left: 0,
    right: 0,
    zIndex: 9998,
    paddingHorizontal: 16,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#DC2626',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  text: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  retryBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 6,
  },
  retryText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
});

export default React.memo(NetworkBar);
