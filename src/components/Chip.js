/**
 * Chip — small pill/badge with optional icon and selectable state.
 *
 * Used for: filter chips, info pills, role badges, tag pills.
 *
 * Props:
 *   label, icon (mci name), color (text + icon),
 *   bg (background — defaults to color tint),
 *   variant ('soft' | 'solid' | 'outline'),
 *   selected (toggles to accent style),
 *   onPress, size ('sm' | 'md')
 */
import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, RADIUS, SPACING, TYPE } from '../theme';

const Chip = ({
  label,
  icon,
  color = COLORS.ACCENT_LIGHT,
  bg,
  variant = 'soft',         // 'soft' | 'solid' | 'outline'
  selected = false,
  onPress,
  size = 'md',
  style,
}) => {
  const isSm = size === 'sm';
  const padV = isSm ? 4 : 6;
  const padH = isSm ? 10 : 12;
  const fontSize = isSm ? TYPE.tiny : TYPE.small;
  const iconSize = isSm ? 11 : 13;

  // Build dynamic style based on variant + selected
  const baseStyle = (() => {
    if (selected) {
      return {
        backgroundColor: color,
        borderColor: color,
        borderWidth: 1,
      };
    }
    if (variant === 'solid') {
      return {
        backgroundColor: color,
        borderColor: color,
        borderWidth: 1,
      };
    }
    if (variant === 'outline') {
      return {
        backgroundColor: 'transparent',
        borderColor: color,
        borderWidth: 1,
      };
    }
    // soft (default)
    return {
      backgroundColor: bg || COLORS.WHITE_08,
      borderColor: COLORS.BORDER,
      borderWidth: 1,
    };
  })();

  const textColor = (selected || variant === 'solid') ? '#fff' : color;

  const Container = onPress ? TouchableOpacity : View;

  return (
    <Container
      onPress={onPress}
      activeOpacity={0.7}
      style={[
        styles.chip,
        baseStyle,
        { paddingVertical: padV, paddingHorizontal: padH },
        style,
      ]}
    >
      {icon && (
        <MaterialCommunityIcons name={icon} size={iconSize} color={textColor} />
      )}
      {label != null && (
        <Text style={[styles.label, { fontSize, color: textColor }]} numberOfLines={1}>
          {label}
        </Text>
      )}
    </Container>
  );
};

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: RADIUS.pill,
    alignSelf: 'flex-start',
  },
  label: {
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});

export default React.memo(Chip);
