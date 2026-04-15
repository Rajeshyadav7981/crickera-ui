import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS } from '../theme';
import Avatar from './Avatar';
import Icon from './Icon';

const ROLE_ICONS = {
  batsman: 'batsman',
  bowler: 'bowler',
  all_rounder: 'allRounder',
  wicket_keeper: 'wicketKeeper',
};

const ROLE_COLORS = {
  batsman: '#3B82F6',
  bowler: COLORS.RED,
  all_rounder: '#8B5CF6',
  wicket_keeper: '#F59E0B',
};

const PlayerCard = ({ player, onPress, selected = false, style }) => {
  const name = player.player_name || player.name || 'Unknown';
  const role = player.role || '';
  const uri = player.profile || player.profile_image;
  const roleIcon = ROLE_ICONS[role] || 'batsman';
  const roleColor = ROLE_COLORS[role] || COLORS.TEXT_MUTED;

  return (
    <TouchableOpacity
      style={[styles.card, selected && styles.cardSelected, style]}
      activeOpacity={0.7}
      onPress={onPress}
    >
      <Avatar
        uri={uri}
        name={name}
        size={42}
        color={selected ? COLORS.ACCENT : roleColor}
        type="player"
        style={{ marginBottom: 6 }}
      />
      <Text style={[styles.name, selected && styles.nameSelected]} numberOfLines={1}>{name}</Text>

      {/* Role badge with icon */}
      {!!role && (
        <View style={[styles.roleBadge, { backgroundColor: roleColor + '18' }]}>
          <Icon name={roleIcon} size={10} color={roleColor} />
          <Text style={[styles.roleText, { color: roleColor }]}>
            {role.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).split(' ')[0]}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    alignItems: 'center', padding: 12,
    backgroundColor: COLORS.CARD, borderRadius: 14,
    borderWidth: 1.5, borderColor: COLORS.BORDER,
    width: 90,
  },
  cardSelected: { borderColor: COLORS.ACCENT, backgroundColor: COLORS.ACCENT_SOFT },
  name: { fontSize: 11, fontWeight: '700', color: COLORS.TEXT, textAlign: 'center' },
  nameSelected: { color: COLORS.ACCENT_LIGHT },
  roleBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginTop: 4,
  },
  roleText: { fontSize: 8, fontWeight: '700' },
});

export default React.memo(PlayerCard);
