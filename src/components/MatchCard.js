import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '../theme';
import StatusBadge from './StatusBadge';

const { width: SCREEN_W } = Dimensions.get('window');
const CARD_W = Math.min(SCREEN_W * 0.75, 280);

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
  } catch { return ''; }
};

const MatchCard = ({
  match,
  onPress,
  showDistance = false,
  width = CARD_W,
  style,
}) => {
  const {
    status, team_a_name, team_b_name, overs, match_date, match_code,
    result_summary, distance_km, venue_name,
    team_a_runs, team_a_wickets, team_a_overs,
    team_b_runs, team_b_wickets, team_b_overs,
    team_a_color, team_b_color,
  } = match;

  const isLive = status === 'live' || status === 'in_progress';
  const isCompleted = status === 'completed';
  const hasScore = team_a_runs != null || team_b_runs != null;

  const colorA = team_a_color || '#3B82F6';
  const colorB = team_b_color || COLORS.RED;

  return (
    <TouchableOpacity style={[styles.card, { width }, style]} activeOpacity={0.7} onPress={onPress}>
      <LinearGradient colors={['#1E293B', '#0F172A']} style={styles.inner}>
        {/* Top row: status + badge */}
        <View style={styles.topRow}>
          <StatusBadge status={status} />
          <View style={styles.topRight}>
            {showDistance && distance_km != null && (
              <View style={styles.metaBadge}>
                <MaterialCommunityIcons name="map-marker" size={10} color={COLORS.ACCENT_LIGHT} />
                <Text style={styles.metaBadgeText}>{distance_km} km</Text>
              </View>
            )}
            {!showDistance && match_code && (
              <Text style={styles.codeBadge}>{match_code}</Text>
            )}
          </View>
        </View>

        {/* Teams with color bars */}
        <View style={styles.teamsSection}>
          {/* Team A */}
          <View style={styles.teamRow}>
            <View style={[styles.teamColorBar, { backgroundColor: colorA }]} />
            <Text style={styles.teamName} numberOfLines={1}>{team_a_name || 'Team A'}</Text>
            {hasScore && (
              <Text style={[styles.teamScore, match.winner_id === match.team_a_id && styles.teamScoreWin]}>
                {team_a_runs ?? '-'}/{team_a_wickets ?? 0}
                {team_a_overs != null && <Text style={styles.teamOvers}> ({team_a_overs})</Text>}
              </Text>
            )}
          </View>

          {/* Team B */}
          <View style={styles.teamRow}>
            <View style={[styles.teamColorBar, { backgroundColor: colorB }]} />
            <Text style={styles.teamName} numberOfLines={1}>{team_b_name || 'Team B'}</Text>
            {hasScore && (
              <Text style={[styles.teamScore, match.winner_id === match.team_b_id && styles.teamScoreWin]}>
                {team_b_runs ?? '-'}/{team_b_wickets ?? 0}
                {team_b_overs != null && <Text style={styles.teamOvers}> ({team_b_overs})</Text>}
              </Text>
            )}
          </View>
        </View>

        {/* Bottom: meta info */}
        <View style={styles.bottom}>
          <View style={styles.metaRow}>
            <MaterialCommunityIcons name="cricket" size={11} color={COLORS.TEXT_MUTED} />
            <Text style={styles.meta}>{overs} overs</Text>
          </View>
          {match_date && (
            <View style={styles.metaRow}>
              <MaterialCommunityIcons name="calendar" size={11} color={COLORS.TEXT_MUTED} />
              <Text style={styles.meta}>{formatDate(match_date)}</Text>
            </View>
          )}
          {venue_name && (
            <View style={styles.metaRow}>
              <MaterialCommunityIcons name="map-marker" size={11} color={COLORS.TEXT_MUTED} />
              <Text style={styles.meta} numberOfLines={1}>{venue_name}</Text>
            </View>
          )}
        </View>

        {/* Result */}
        {result_summary && (
          <View style={styles.resultRow}>
            <MaterialCommunityIcons
              name={isCompleted ? 'trophy' : 'information'}
              size={12}
              color={COLORS.SUCCESS}
            />
            <Text style={styles.result} numberOfLines={1}>{result_summary}</Text>
          </View>
        )}

        {/* Live pulse indicator */}
        {isLive && (
          <View style={styles.livePulse}>
            <View style={styles.liveDot} />
          </View>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: { height: 170, borderRadius: 16, overflow: 'hidden' },
  inner: {
    padding: 14, borderRadius: 16, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)', flex: 1,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },

  // Teams
  teamsSection: { gap: 6, marginBottom: 10 },
  teamRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  teamColorBar: { width: 3, height: 18, borderRadius: 2 },
  teamName: { fontSize: 14, fontWeight: '800', color: COLORS.TEXT, flex: 1 },
  teamScore: { fontSize: 14, fontWeight: '700', color: COLORS.TEXT_SECONDARY },
  teamScoreWin: { color: COLORS.TEXT, fontWeight: '900' },
  teamOvers: { fontSize: 11, fontWeight: '500', color: COLORS.TEXT_MUTED },

  // Meta
  bottom: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  meta: { fontSize: 10, color: COLORS.TEXT_MUTED, fontWeight: '500' },
  metaBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: COLORS.ACCENT_SOFT, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6,
  },
  metaBadgeText: { fontSize: 10, fontWeight: '700', color: COLORS.ACCENT_LIGHT },
  codeBadge: {
    fontSize: 9, fontWeight: '700', color: COLORS.ACCENT_LIGHT,
    backgroundColor: COLORS.ACCENT_SOFT, paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 6, overflow: 'hidden',
  },

  // Result
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  result: { fontSize: 11, fontWeight: '700', color: COLORS.SUCCESS, flex: 1 },

  // Live
  livePulse: { position: 'absolute', top: 14, right: 14 },
  liveDot: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.LIVE,
    shadowColor: COLORS.LIVE, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 4,
  },
});

export default React.memo(MatchCard);
