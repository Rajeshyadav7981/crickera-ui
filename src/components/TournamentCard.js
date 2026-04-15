import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS } from '../theme';
import StatusBadge from './StatusBadge';

const { width: SCREEN_W } = Dimensions.get('window');
const CARD_W = Math.min(SCREEN_W * 0.75, 260);

const TournamentCard = ({ tournament, onPress, width = CARD_W, style }) => {
  const { status, name, start_date, tournament_code } = tournament;

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
    } catch { return ''; }
  };

  return (
    <TouchableOpacity style={[styles.card, { width }, style]} activeOpacity={0.7} onPress={onPress}>
      <LinearGradient colors={['#1E293B', '#0F172A']} style={styles.inner}>
        <View style={styles.topRow}>
          <StatusBadge status={status || 'draft'} />
          {tournament_code && <Text style={styles.codeBadge}>{tournament_code}</Text>}
        </View>
        <Text style={styles.name} numberOfLines={2}>{name}</Text>
        <View style={styles.bottom}>
          {start_date && <Text style={styles.meta}>{formatDate(start_date)}</Text>}
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: { borderRadius: 16, overflow: 'hidden' },
  inner: {
    padding: 16, borderRadius: 16, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  name: { fontSize: 15, fontWeight: '800', color: COLORS.TEXT, marginBottom: 8 },
  bottom: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  meta: { fontSize: 11, color: COLORS.TEXT_SECONDARY, fontWeight: '500' },
  codeBadge: {
    fontSize: 9, fontWeight: '700', color: COLORS.ACCENT_LIGHT,
    backgroundColor: COLORS.ACCENT_SOFT, paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 6, overflow: 'hidden',
  },
});

export default React.memo(TournamentCard);
