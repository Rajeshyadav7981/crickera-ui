import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { COLORS, STATUS_CONFIG, getStatusInfo } from '../theme';

const StatusBadge = ({ status, size = 'small' }) => {
  const info = getStatusInfo(status);
  const isLive = status === 'live' || status === 'in_progress';
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isLive) {
      const anim = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.4, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        ])
      );
      anim.start();
      return () => anim.stop();
    }
  }, [isLive]);

  const isSmall = size === 'small';

  return (
    <View style={[
      styles.badge,
      { backgroundColor: info.badgeBg },
      isSmall ? styles.small : styles.large,
    ]}>
      {isLive && (
        <Animated.View style={[styles.liveDot, { opacity: pulseAnim }]} />
      )}
      <Text style={[
        styles.text,
        { color: info.badgeText },
        isSmall ? styles.textSmall : styles.textLarge,
      ]}>
        {info.label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    gap: 4,
  },
  small: { paddingHorizontal: 10, paddingVertical: 4 },
  large: { paddingHorizontal: 14, paddingVertical: 6 },
  text: { fontWeight: '800', letterSpacing: 0.5 },
  textSmall: { fontSize: 9 },
  textLarge: { fontSize: 11 },
  liveDot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: COLORS.LIVE,
  },
});

export default React.memo(StatusBadge);
