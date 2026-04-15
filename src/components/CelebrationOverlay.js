import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';
import { COLORS } from '../theme';

const { width: SCREEN_W } = Dimensions.get('window');

/**
 * Lightweight celebration toast — slides in from top, auto-dismisses.
 * Non-blocking: doesn't cover the scoring buttons.
 * Fast: 600ms display, 200ms fade = under 1 second total.
 */
const CelebrationOverlay = ({ type, visible, onFinish }) => {
  const slideAnim = useRef(new Animated.Value(-80)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const dismissTimer = useRef(null);

  useEffect(() => {
    if (visible && type) {
      slideAnim.setValue(-80);
      opacityAnim.setValue(0);
      scaleAnim.setValue(0.8);

      // Slide in
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 60, useNativeDriver: true, tension: 80, friction: 8 }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 80, friction: 6 }),
      ]).start();

      // Auto dismiss after 600ms
      dismissTimer.current = setTimeout(() => {
        Animated.parallel([
          Animated.timing(slideAnim, { toValue: -80, duration: 200, useNativeDriver: true }),
          Animated.timing(opacityAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
        ]).start(() => onFinish?.());
      }, 600);
    }

    return () => {
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    };
  }, [visible, type]);

  if (!visible || !type) return null;

  const config = CELEBRATION_CONFIG[type] || {};

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: opacityAnim,
          transform: [{ translateY: slideAnim }, { scale: scaleAnim }],
        },
      ]}
      pointerEvents="none"
    >
      <View style={[styles.pill, { backgroundColor: config.bg }]}>
        <View style={[styles.iconCircle, { backgroundColor: config.iconBg }]}>
          <Text style={styles.iconText}>{config.icon}</Text>
        </View>
        <View>
          <Text style={[styles.title, { color: config.color }]}>{config.title}</Text>
          {config.subtitle && <Text style={styles.subtitle}>{config.subtitle}</Text>}
        </View>
      </View>
    </Animated.View>
  );
};

const CELEBRATION_CONFIG = {
  four: {
    icon: '4',
    title: 'FOUR!',
    subtitle: 'Boundary',
    color: COLORS.SUCCESS,
    bg: 'rgba(76,175,80,0.15)',
    iconBg: 'rgba(76,175,80,0.25)',
  },
  six: {
    icon: '6',
    title: 'MAXIMUM!',
    subtitle: 'SIX',
    color: '#CE93D8',
    bg: 'rgba(156,39,176,0.15)',
    iconBg: 'rgba(156,39,176,0.25)',
  },
  wicket: {
    icon: 'W',
    title: 'OUT!',
    subtitle: 'Wicket',
    color: COLORS.DANGER,
    bg: 'rgba(229,57,53,0.15)',
    iconBg: 'rgba(229,57,53,0.25)',
  },
  fifty: {
    icon: '50',
    title: 'HALF CENTURY!',
    subtitle: null,
    color: '#FFD700',
    bg: 'rgba(255,215,0,0.15)',
    iconBg: 'rgba(255,215,0,0.25)',
  },
  hundred: {
    icon: '100',
    title: 'CENTURY!',
    subtitle: null,
    color: '#FFD700',
    bg: 'rgba(255,215,0,0.15)',
    iconBg: 'rgba(255,215,0,0.25)',
  },
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 20,
    right: 20,
    zIndex: 100,
    alignItems: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
    backdropFilter: 'blur(10)',
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: { fontSize: 18, fontWeight: '900', color: '#fff' },
  title: { fontSize: 16, fontWeight: '900', letterSpacing: 1 },
  subtitle: { fontSize: 11, color: COLORS.TEXT_MUTED, marginTop: 1 },
});

export default CelebrationOverlay;
