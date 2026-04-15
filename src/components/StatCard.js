/**
 * StatCard — number + label + optional icon, in a tinted card.
 *
 * Used in HomeTab, ProfileTab, MyStatsScreen, TournamentDetailScreen,
 * TeamDetailScreen, LeaderboardScreen — all currently hand-rolled.
 *
 * Props:
 *   value, label, icon (mci name), color (icon + accent color),
 *   bg (icon background — defaults to color tinted), size, onPress
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, RADIUS, SPACING, TYPE } from '../theme';

const StatCard = ({
  value,
  label,
  icon,
  color = COLORS.ACCENT,
  bg,                       // explicit background for icon wrap
  size = 'md',              // 'sm' | 'md' | 'lg'
  onPress,
  style,
}) => {
  const isLg = size === 'lg';
  const isSm = size === 'sm';
  const iconWrapSize = isLg ? 40 : isSm ? 28 : 32;
  const iconSize = isLg ? 22 : isSm ? 14 : 16;
  const valueSize = isLg ? TYPE.h1 : isSm ? TYPE.h3 : 22;
  const labelSize = isSm ? 9 : TYPE.tiny;

  // Auto-derive a soft tinted bg from the color if none provided
  const iconBg = bg || COLORS.WHITE_06;

  const Wrapper = onPress ? TouchableOpacity : View;

  return (
    <Wrapper
      onPress={onPress}
      activeOpacity={0.7}
      style={[styles.card, { padding: isSm ? SPACING.md : SPACING.lg }, style]}
    >
      {icon && (
        <View style={[styles.iconWrap, {
          width: iconWrapSize, height: iconWrapSize,
          borderRadius: iconWrapSize / 3,
          backgroundColor: iconBg,
        }]}>
          <MaterialCommunityIcons name={icon} size={iconSize} color={color} />
        </View>
      )}
      <Text style={[styles.value, { fontSize: valueSize }]} numberOfLines={1}>{value}</Text>
      <Text style={[styles.label, { fontSize: labelSize }]} numberOfLines={1}>{label}</Text>
    </Wrapper>
  );
};

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: COLORS.WHITE_06,
    borderRadius: RADIUS.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.WHITE_04,
  },
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.xs + 2,
  },
  value: {
    fontWeight: '900',
    color: COLORS.TEXT,
    letterSpacing: -0.5,
  },
  label: {
    fontWeight: '600',
    color: COLORS.TEXT_MUTED,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 2,
  },
});

export default React.memo(StatCard);
