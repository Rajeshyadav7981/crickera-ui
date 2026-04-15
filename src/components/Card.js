/**
 * Card — themed container with consistent bg, border, radius, padding.
 *
 * Replaces ad-hoc <View style={{ backgroundColor: COLORS.CARD, borderRadius: 16,
 * padding: 16, borderWidth: 1, borderColor: COLORS.BORDER }}> patterns.
 *
 * Props:
 *   variant ('default' | 'elevated' | 'outline' | 'tinted'),
 *   padding ('none' | 'sm' | 'md' | 'lg'),
 *   onPress, style, children
 */
import React from 'react';
import { TouchableOpacity, View, StyleSheet } from 'react-native';
import { COLORS, RADIUS, SPACING, CARD_SHADOW } from '../theme';

const PADDING = {
  none: 0,
  sm: SPACING.md,
  md: SPACING.lg,
  lg: SPACING.xl,
};

const Card = ({
  variant = 'default',
  padding = 'md',
  onPress,
  style,
  children,
}) => {
  const variantStyle = (() => {
    switch (variant) {
      case 'elevated':
        return [styles.card, styles.elevated, CARD_SHADOW];
      case 'outline':
        return [styles.card, styles.outline];
      case 'tinted':
        return [styles.card, styles.tinted];
      default:
        return [styles.card];
    }
  })();

  const Container = onPress ? TouchableOpacity : View;

  return (
    <Container
      onPress={onPress}
      activeOpacity={onPress ? 0.85 : 1}
      style={[...variantStyle, { padding: PADDING[padding] }, style]}
    >
      {children}
    </Container>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.CARD,
    borderRadius: RADIUS.xxl,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  elevated: {
    backgroundColor: COLORS.CARD_ELEVATED,
  },
  outline: {
    backgroundColor: 'transparent',
  },
  tinted: {
    backgroundColor: COLORS.WHITE_06,
  },
});

export default React.memo(Card);
