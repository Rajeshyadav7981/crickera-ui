import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { COLORS } from '../theme';
import offlineQueue from '../services/offlineQueue';
import Icon from './Icon';

const OfflineBanner = ({ style }) => {
  const [state, setState] = useState({
    isOnline: true,
    queueLength: 0,
    isSyncing: false,
  });
  const slideAnim = React.useRef(new Animated.Value(-50)).current;

  useEffect(() => {
    const unsubscribe = offlineQueue.addListener(setState);
    // Set initial state
    setState({
      isOnline: offlineQueue.isOnline,
      queueLength: offlineQueue.queueLength,
      isSyncing: offlineQueue.isSyncing,
    });
    return unsubscribe;
  }, []);

  const showBanner = !state.isOnline || state.queueLength > 0;

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: showBanner ? 0 : -50,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [showBanner]);

  if (!showBanner) return null;

  const isOffline = !state.isOnline;

  return (
    <Animated.View style={[
      styles.banner,
      isOffline ? styles.bannerOffline : styles.bannerSyncing,
      { transform: [{ translateY: slideAnim }] },
      style,
    ]}>
      <Icon
        name={isOffline ? 'warning' : 'sync'}
        size={14}
        color={isOffline ? COLORS.WARNING : COLORS.ACCENT_LIGHT}
      />
      <Text style={[styles.text, isOffline ? styles.textOffline : styles.textSyncing]}>
        {isOffline
          ? `Offline - ${state.queueLength} action${state.queueLength !== 1 ? 's' : ''} queued`
          : state.isSyncing
            ? 'Syncing...'
            : `${state.queueLength} queued action${state.queueLength !== 1 ? 's' : ''} pending`
        }
      </Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  bannerOffline: { backgroundColor: 'rgba(255,152,0,0.15)' },
  bannerSyncing: { backgroundColor: 'rgba(30,136,229,0.1)' },
  text: { fontSize: 12, fontWeight: '600' },
  textOffline: { color: COLORS.WARNING },
  textSyncing: { color: COLORS.ACCENT_LIGHT },
});

export default React.memo(OfflineBanner);
