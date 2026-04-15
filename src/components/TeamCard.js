import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '../theme';

const TeamCard = ({ team, onPress, style }) => {
  const { name, short_name, color, player_count } = team;
  const teamColor = color || COLORS.ACCENT;

  return (
    <TouchableOpacity style={[styles.card, style]} activeOpacity={0.7} onPress={onPress}>
      {/* Color accent bar at top */}
      <View style={[styles.colorBar, { backgroundColor: teamColor }]} />

      {/* Shield avatar with team initial */}
      <LinearGradient
        colors={[teamColor + 'CC', teamColor + '66']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.avatar}
      >
        <MaterialCommunityIcons name="shield-half-full" size={20} color="rgba(255,255,255,0.3)" style={styles.shieldBg} />
        <Text style={styles.avatarLetter}>
          {(short_name || name || '?').charAt(0).toUpperCase()}
        </Text>
      </LinearGradient>

      <Text style={styles.name} numberOfLines={1}>{name}</Text>
      {short_name && <Text style={styles.short}>{short_name}</Text>}

      {/* Member count */}
      {player_count != null && (
        <View style={styles.memberRow}>
          <MaterialCommunityIcons name="account-group" size={11} color={COLORS.TEXT_HINT} />
          <Text style={styles.memberText}>{player_count}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    width: 120, backgroundColor: COLORS.CARD, borderRadius: 16,
    padding: 14, alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.BORDER,
    overflow: 'hidden',
  },
  colorBar: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 3, borderTopLeftRadius: 16, borderTopRightRadius: 16,
  },
  avatar: {
    width: 48, height: 48, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center', marginBottom: 10, marginTop: 4,
  },
  shieldBg: { position: 'absolute' },
  avatarLetter: { fontSize: 20, fontWeight: '900', color: '#fff', textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  name: { fontSize: 13, fontWeight: '700', color: COLORS.TEXT, textAlign: 'center' },
  short: { fontSize: 11, fontWeight: '600', color: COLORS.TEXT_MUTED, marginTop: 2 },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 6 },
  memberText: { fontSize: 10, color: COLORS.TEXT_HINT, fontWeight: '500' },
});

export default React.memo(TeamCard);
