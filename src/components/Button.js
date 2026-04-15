/**
 * Button — themed primary action button.
 *
 * Variants:
 *   • primary   → blue gradient + blue glow shadow (default)
 *   • warning   → amber gradient
 *   • danger    → red gradient
 *   • success   → green gradient
 *   • outline   → transparent bg with accent border
 *   • ghost     → transparent bg, accent text, no border
 *
 * Props:
 *   variant, size ('sm'|'md'|'lg'), icon (mci name), iconRight, label,
 *   loading, disabled, fullWidth, rounded, onPress, style
 */
import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, View, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, BUTTON_GRADIENTS, RADIUS, SPACING, TYPE } from '../theme';

const SHADOW_BY_VARIANT = {
  primary: COLORS.ACCENT,
  warning: '#F59E0B',
  danger: COLORS.RED,
  success: '#16A34A',
};

const HEIGHTS = { sm: 38, md: 48, lg: 54 };
const FONT_SIZES = { sm: TYPE.bodySm, md: TYPE.body, lg: TYPE.h3 };
const ICON_SIZES = { sm: 16, md: 18, lg: 20 };

const Button = ({
  variant = 'primary',
  size = 'md',
  icon,
  iconRight,
  label,
  loading = false,
  disabled = false,
  fullWidth = false,
  rounded = false,
  onPress,
  style,
  textStyle,
}) => {
  const isGradient = ['primary', 'warning', 'danger', 'success'].includes(variant);
  const isOutline = variant === 'outline';
  const isGhost = variant === 'ghost';
  const height = HEIGHTS[size];
  const fontSize = FONT_SIZES[size];
  const iconSize = ICON_SIZES[size];
  const borderRadius = rounded ? RADIUS.pill : RADIUS.lg;

  const containerStyle = [
    styles.btn,
    {
      height,
      borderRadius,
      ...(fullWidth && { alignSelf: 'stretch' }),
    },
    isGradient && {
      shadowColor: SHADOW_BY_VARIANT[variant],
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.35,
      shadowRadius: 14,
      ...Platform.select({ android: { elevation: 6 } }),
    },
    isOutline && {
      borderWidth: 1.5,
      borderColor: COLORS.ACCENT,
      backgroundColor: 'transparent',
    },
    isGhost && { backgroundColor: 'transparent' },
    (disabled || loading) && { opacity: 0.5 },
    style,
  ];

  const inner = (
    <View style={[styles.inner, { paddingHorizontal: SPACING.xl }]}>
      {loading ? (
        <ActivityIndicator color={isOutline || isGhost ? COLORS.ACCENT : '#fff'} />
      ) : (
        <>
          {icon && (
            <MaterialCommunityIcons
              name={icon}
              size={iconSize}
              color={isOutline || isGhost ? COLORS.ACCENT : '#fff'}
              style={{ marginRight: label ? 8 : 0 }}
            />
          )}
          {label && (
            <Text
              style={[
                styles.label,
                { fontSize, color: isOutline || isGhost ? COLORS.ACCENT : '#fff' },
                textStyle,
              ]}
              numberOfLines={1}
            >
              {label}
            </Text>
          )}
          {iconRight && (
            <MaterialCommunityIcons
              name={iconRight}
              size={iconSize}
              color={isOutline || isGhost ? COLORS.ACCENT : '#fff'}
              style={{ marginLeft: label ? 8 : 0 }}
            />
          )}
        </>
      )}
    </View>
  );

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.85}
      style={containerStyle}
    >
      {isGradient ? (
        <LinearGradient
          colors={BUTTON_GRADIENTS[variant]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.gradient, { borderRadius }]}
        >
          {inner}
        </LinearGradient>
      ) : (
        inner
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  btn: {
    overflow: 'hidden',
    alignSelf: 'flex-start',
  },
  gradient: {
    flex: 1,
  },
  inner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});

export default React.memo(Button);
