import React, { useRef } from 'react';
import { Text, TouchableOpacity, Animated, StyleSheet, Platform } from 'react-native';
import { COLORS } from '../theme';

let Haptics;
try { Haptics = require('expo-haptics'); } catch {}

const RunButton = ({
  label,
  onPress,
  variant = 'default', // 'default' | 'boundary' | 'six' | 'dot' | 'wicket' | 'extra'
  size = 'large', // 'small' | 'medium' | 'large'
  disabled = false,
  style,
}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, { toValue: 0.9, useNativeDriver: true, speed: 50, bounciness: 4 }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 50, bounciness: 4 }).start();
  };

  const handlePress = () => {
    if (disabled) return;
    // Haptic feedback
    if (Haptics && Platform.OS !== 'web') {
      if (variant === 'six' || variant === 'boundary') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else if (variant === 'wicket') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    }
    onPress?.();
  };

  const variantStyle = VARIANT_STYLES[variant] || VARIANT_STYLES.default;
  const sizeStyle = SIZE_STYLES[size] || SIZE_STYLES.large;

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
    >
      <Animated.View style={[
        styles.button,
        sizeStyle.button,
        variantStyle.button,
        disabled && styles.disabled,
        { transform: [{ scale: scaleAnim }] },
        style,
      ]}>
        <Text style={[styles.label, sizeStyle.label, variantStyle.label]}>
          {label}
        </Text>
      </Animated.View>
    </TouchableOpacity>
  );
};

const VARIANT_STYLES = {
  default: {
    button: { backgroundColor: COLORS.SURFACE, borderColor: COLORS.BORDER },
    label: { color: COLORS.TEXT },
  },
  boundary: {
    button: { backgroundColor: 'rgba(76,175,80,0.15)', borderColor: 'rgba(76,175,80,0.4)' },
    label: { color: COLORS.SUCCESS },
  },
  six: {
    button: { backgroundColor: 'rgba(156,39,176,0.15)', borderColor: 'rgba(156,39,176,0.4)' },
    label: { color: '#CE93D8' },
  },
  dot: {
    button: { backgroundColor: COLORS.CARD, borderColor: COLORS.BORDER },
    label: { color: COLORS.TEXT_MUTED },
  },
  wicket: {
    button: { backgroundColor: COLORS.DANGER_SOFT, borderColor: 'rgba(229,57,53,0.4)' },
    label: { color: COLORS.DANGER },
  },
  extra: {
    button: { backgroundColor: COLORS.WARNING_BG, borderColor: 'rgba(255,152,0,0.4)' },
    label: { color: COLORS.WARNING },
  },
};

const SIZE_STYLES = {
  small: {
    button: { width: 48, height: 48, borderRadius: 14 },
    label: { fontSize: 14 },
  },
  medium: {
    button: { width: 56, height: 56, borderRadius: 16 },
    label: { fontSize: 16 },
  },
  large: {
    button: { width: 68, height: 68, borderRadius: 20 },
    label: { fontSize: 22 },
  },
};

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  label: { fontWeight: '900' },
  disabled: { opacity: 0.4 },
});

export default React.memo(RunButton);
