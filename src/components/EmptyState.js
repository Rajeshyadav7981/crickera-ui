import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS, FONTS } from '../theme';
import Icon from './Icon';

const EmptyState = ({
  icon = 'cricket',
  iconSize = 56,
  title = 'Nothing here yet',
  message = '',
  actionLabel,
  onAction,
  style,
}) => (
  <View style={[styles.container, style]}>
    <Icon name={icon} size={iconSize} color={COLORS.TEXT_MUTED} />
    <Text style={styles.title}>{title}</Text>
    {!!message && <Text style={styles.message}>{message}</Text>}
    {actionLabel && onAction && (
      <TouchableOpacity style={styles.actionBtn} onPress={onAction} activeOpacity={0.7}>
        <Text style={styles.actionText}>{actionLabel}</Text>
      </TouchableOpacity>
    )}
  </View>
);

const styles = StyleSheet.create({
  container: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 40 },
  title: { fontFamily: FONTS.family, fontSize: 20, fontWeight: '800', color: COLORS.TEXT, marginTop: 16 },
  message: {
    fontFamily: FONTS.family,    fontSize: 14, color: COLORS.TEXT_SECONDARY, marginTop: 8,
    textAlign: 'center', lineHeight: 20,
  },
  actionBtn: {
    marginTop: 20, backgroundColor: COLORS.ACCENT,
    paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12,
  },
  actionText: { fontFamily: FONTS.family, fontSize: 14, fontWeight: '700', color: COLORS.TEXT },
});

export default React.memo(EmptyState);
