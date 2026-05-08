import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, FONTS } from '../theme';

const { width: SCREEN_W } = Dimensions.get('window');
const CARD_W = Math.min(SCREEN_W * 0.75, 280);

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' });
  } catch { return ''; }
};

// Derive a readable match-format label from the match data.
// Preference order: explicit `match_format` → T20 / ODI / Test inferred from `overs`.
const formatLabel = (m) => {
  const explicit = (m.match_format || m.match_type_format || '').toUpperCase();
  if (explicit && ['T10', 'T20', 'T15', 'ODI', 'TEST', 'T5'].includes(explicit)) return explicit;
  const o = Number(m.overs);
  if (!o || Number.isNaN(o)) return null;
  if (o <= 5) return 'T5';
  if (o <= 10) return 'T10';
  if (o <= 20) return 'T20';
  if (o <= 50) return 'ODI';
  return `${o}-OV`;
};

// Map match_type + match_number into a readable label.
const matchLabel = (m) => {
  const mt = (m.match_type || '').toLowerCase();
  if (mt === 'final') return 'Final';
  if (mt === 'semi_final' || mt === 'semifinal') return `Semi-Final${m.match_number ? ` ${m.match_number}` : ''}`;
  if (mt === 'third_place') return '3rd Place Playoff';
  if (mt === 'qualifier') return `Qualifier${m.match_number ? ` ${m.match_number}` : ''}`;
  if (mt === 'eliminator') return 'Eliminator';
  if (m.match_number) return `Match ${m.match_number}`;
  return null;
};

// Relative time for completed matches — "2 days ago" / "last week".
const relativeAgo = (dateStr) => {
  if (!dateStr) return null;
  try {
    const then = new Date(dateStr).getTime();
    if (Number.isNaN(then)) return null;
    const diff = Math.max(0, Date.now() - then);
    const days = Math.floor(diff / 86400000);
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)}w ago`;
    if (days < 365) return `${Math.floor(days / 30)}mo ago`;
    return `${Math.floor(days / 365)}y ago`;
  } catch { return null; }
};

// Derive a live "chase trailer" when we have both scores — computes runs needed
// if the 2nd innings is in progress. Best-effort; skips cleanly if fields missing.
const chaseTrailer = (m) => {
  if (m.status !== 'live' && m.status !== 'in_progress') return null;
  const aRuns = m.team_a_runs, bRuns = m.team_b_runs;
  if (aRuns == null || bRuns == null) return null;
  // Whichever side is batting 2nd (has scored fewer balls than the other by > 0)
  // needs to beat the first innings total. Without full ball context we can
  // only show "needs X to win" — useful enough.
  const trailingRuns = Math.max(aRuns, bRuns) - Math.min(aRuns, bRuns);
  if (trailingRuns <= 0) return null;
  const chaser = aRuns < bRuns ? m.team_a_name : m.team_b_name;
  return chaser ? `${chaser} need ${trailingRuns + 1} to win` : null;
};

// Status → theme colors for the status chip.
const STATUS_THEME = {
  live:          { chipBg: COLORS.LIVE_BG,     chipFg: COLORS.LIVE,           dot: COLORS.LIVE,    label: 'LIVE' },
  in_progress:   { chipBg: COLORS.LIVE_BG,     chipFg: COLORS.LIVE,           dot: COLORS.LIVE,    label: 'LIVE' },
  completed:     { chipBg: COLORS.SUCCESS_BG,  chipFg: COLORS.SUCCESS_LIGHT,  dot: null,           label: 'DONE' },
  upcoming:      { chipBg: COLORS.WARNING_BG,  chipFg: COLORS.WARNING,        dot: null,           label: 'UPCOMING' },
  scheduled:     { chipBg: COLORS.WARNING_BG,  chipFg: COLORS.WARNING,        dot: null,           label: 'SCHEDULED' },
  toss:          { chipBg: COLORS.ACCENT_SOFT, chipFg: COLORS.ACCENT_LIGHT,   dot: null,           label: 'TOSS' },
  squad_set:     { chipBg: COLORS.ACCENT_SOFT, chipFg: COLORS.ACCENT_LIGHT,   dot: null,           label: 'SQUAD SET' },
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
    time_slot, result_summary, distance_km, venue_name,
    team_a_runs, team_a_wickets, team_a_overs,
    team_b_runs, team_b_wickets, team_b_overs,
    team_a_color, team_b_color, team_a_id, team_b_id, winner_id,
    toss_winner_id, toss_decision, toss_winner_name,
    tournament_name, group_name,
  } = match;

  const isLive = status === 'live' || status === 'in_progress';
  const isCompleted = status === 'completed';
  const isUpcoming = !isLive && !isCompleted;
  const theme = STATUS_THEME[status] || STATUS_THEME.upcoming;
  const hasScore = team_a_runs != null || team_b_runs != null;

  const colorA = team_a_color || COLORS.ACCENT;
  const colorB = team_b_color || COLORS.ACCENT_LIGHT;

  const winnerA = winner_id && winner_id === team_a_id;
  const winnerB = winner_id && winner_id === team_b_id;

  const label = matchLabel(match);
  const format = formatLabel(match);
  const agoText = isCompleted ? relativeAgo(match_date) : null;
  const trailer = chaseTrailer(match);

  // Meta chips: date/time + venue + distance (overs moved up to format pill)
  const metaChips = [];
  if (match_date && !isCompleted) metaChips.push({ icon: 'calendar-blank-outline', text: formatDate(match_date) });
  if (time_slot) metaChips.push({ icon: 'clock-outline', text: time_slot });
  if (venue_name) metaChips.push({ icon: 'map-marker-outline', text: venue_name });
  if (showDistance && distance_km != null) metaChips.push({ icon: 'navigation-variant-outline', text: `${distance_km} km` });
  if (agoText) metaChips.push({ icon: 'history', text: agoText });

  const tossText = !isCompleted && toss_winner_id
    ? `${toss_winner_name || (toss_winner_id === team_a_id ? team_a_name : team_b_name) || 'Team'} won toss · chose to ${toss_decision || 'bat'}`
    : null;

  // Top sub-line: context (tournament + group). Shown only if at least one is set.
  const contextBits = [];
  if (tournament_name) contextBits.push(tournament_name);
  if (group_name) contextBits.push(group_name);
  const contextLine = contextBits.join(' · ');

  return (
    <TouchableOpacity style={[styles.card, { width }, style]} activeOpacity={0.75} onPress={onPress}>
      <View style={styles.body}>
        {/* Optional context line — tournament · group */}
        {contextLine ? (
          <Text style={styles.contextText} numberOfLines={1}>{contextLine}</Text>
        ) : null}

        {/* Top row: status chip + format pill + match label + code */}
        <View style={styles.topRow}>
          <View style={[styles.statusChip, { backgroundColor: theme.chipBg }]}>
            {theme.dot ? <View style={[styles.livePulseDot, { backgroundColor: theme.dot }]} /> : null}
            <Text style={[styles.statusChipText, { color: theme.chipFg }]}>{theme.label}</Text>
          </View>
          {format ? (
            <View style={styles.formatChip}>
              <Text style={styles.formatChipText}>{format}</Text>
            </View>
          ) : null}
          {label ? (
            <Text style={styles.matchLabel} numberOfLines={1}>{label}</Text>
          ) : null}
          {match_code ? (
            <Text style={styles.codeText}>{match_code}</Text>
          ) : null}
        </View>

        {/* Teams — compact single-line rows */}
        <View style={styles.teamsBlock}>
          <View style={styles.teamRow}>
            <View style={[styles.teamChip, { backgroundColor: colorA }]}>
              <Text style={styles.teamChipText}>{(team_a_name || 'A').charAt(0).toUpperCase()}</Text>
            </View>
            <View style={styles.teamNameWrap}>
              <Text style={[styles.teamName, winnerA && styles.teamNameWin]} numberOfLines={1}>
                {team_a_name || 'Team A'}
              </Text>
            </View>
            {hasScore ? (
              <View style={styles.teamScoreWrap}>
                <Text style={[styles.teamScore, winnerA && styles.teamScoreWin]}>
                  {team_a_runs ?? '-'}/{team_a_wickets ?? 0}
                </Text>
                {team_a_overs != null && (
                  <Text style={styles.teamOvers}>({team_a_overs})</Text>
                )}
              </View>
            ) : null}
          </View>
          <View style={styles.teamRow}>
            <View style={[styles.teamChip, { backgroundColor: colorB }]}>
              <Text style={styles.teamChipText}>{(team_b_name || 'B').charAt(0).toUpperCase()}</Text>
            </View>
            <View style={styles.teamNameWrap}>
              <Text style={[styles.teamName, winnerB && styles.teamNameWin]} numberOfLines={1}>
                {team_b_name || 'Team B'}
              </Text>
            </View>
            {hasScore ? (
              <View style={styles.teamScoreWrap}>
                <Text style={[styles.teamScore, winnerB && styles.teamScoreWin]}>
                  {team_b_runs ?? '-'}/{team_b_wickets ?? 0}
                </Text>
                {team_b_overs != null && (
                  <Text style={styles.teamOvers}>({team_b_overs})</Text>
                )}
              </View>
            ) : null}
          </View>
        </View>

        {/* Live chase trailer ("X need Y to win") */}
        {trailer ? (
          <View style={[styles.resultFooter, { backgroundColor: COLORS.LIVE_BG }]}>
            <MaterialCommunityIcons name="chevron-double-right" size={12} color={COLORS.LIVE} />
            <Text style={[styles.resultText, { color: COLORS.LIVE }]} numberOfLines={1}>{trailer}</Text>
          </View>
        ) : null}

        {/* Toss row (pre-match / live, before chase starts) */}
        {tossText ? (
          <View style={styles.tossRow}>
            <MaterialCommunityIcons name="coin-outline" size={11} color={COLORS.WARNING} />
            <Text style={styles.tossText} numberOfLines={1}>{tossText}</Text>
          </View>
        ) : null}

        {/* Meta chips row */}
        {metaChips.length > 0 && (
          <View style={styles.metaRow}>
            {metaChips.map((c, i) => (
              <View key={i} style={styles.metaChip}>
                <MaterialCommunityIcons name={c.icon} size={10} color={COLORS.TEXT_MUTED} />
                <Text style={styles.metaChipText} numberOfLines={1}>{c.text}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Result footer (for completed) OR upcoming date/time summary */}
        {result_summary && !trailer ? (
          <View style={[styles.resultFooter, { backgroundColor: isCompleted ? COLORS.SUCCESS_BG : COLORS.ACCENT_SOFT }]}>
            <MaterialCommunityIcons
              name={isCompleted ? 'trophy' : 'information-outline'}
              size={12}
              color={isCompleted ? COLORS.SUCCESS_LIGHT : COLORS.ACCENT_LIGHT}
            />
            <Text
              style={[styles.resultText, { color: isCompleted ? COLORS.SUCCESS_LIGHT : COLORS.ACCENT_LIGHT }]}
              numberOfLines={2}
            >
              {result_summary}
            </Text>
          </View>
        ) : isUpcoming && match_date ? (
          <View style={styles.upcomingFooter}>
            <MaterialCommunityIcons name="calendar-clock" size={12} color={COLORS.TEXT_MUTED} />
            <Text style={styles.upcomingText} numberOfLines={1}>
              {formatDate(match_date)}{time_slot ? ` • ${time_slot}` : ''}
            </Text>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: COLORS.BG,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  body: {
    padding: 10,
    gap: 8,
  },

  /* Context line */
  contextText: {
    fontFamily: FONTS.family,
    fontSize: 9, fontWeight: '800', color: COLORS.ACCENT_LIGHT,
    letterSpacing: 0.6, textTransform: 'uppercase',
  },

  /* Top row */
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap' },
  statusChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
  },
  livePulseDot: { width: 5, height: 5, borderRadius: 3 },
  statusChipText: { fontFamily: FONTS.family, fontSize: 9, fontWeight: '900', letterSpacing: 0.6 },
  formatChip: {
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
    backgroundColor: COLORS.ACCENT_SOFT,
  },
  formatChipText: {
    fontFamily: FONTS.family,
    fontSize: 9, fontWeight: '900', color: COLORS.ACCENT_LIGHT, letterSpacing: 0.5,
  },
  matchLabel: {
    fontFamily: FONTS.family,
    flex: 1,
    fontSize: 10, fontWeight: '700', color: COLORS.TEXT_SECONDARY,
  },
  codeText: {
    fontFamily: FONTS.family,
    fontSize: 9, fontWeight: '700', color: COLORS.TEXT_MUTED,
    letterSpacing: 0.3,
  },

  /* Teams — compact single-line rows, flat (no tinted panel) */
  teamsBlock: { gap: 4 },
  teamRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 2,
  },
  teamChip: {
    width: 24, height: 24, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  teamChipText: {
    fontFamily: FONTS.family,
    fontSize: 11, fontWeight: '900', color: '#fff',
  },
  teamNameWrap: { flex: 1, minWidth: 0 },
  teamName: {
    fontFamily: FONTS.family,
    fontSize: 13, fontWeight: '700', color: COLORS.TEXT_SECONDARY,
  },
  teamNameWin: { color: COLORS.TEXT, fontWeight: '800' },
  teamScoreWrap: { flexDirection: 'row', alignItems: 'baseline', gap: 5 },
  teamScore: {
    fontFamily: FONTS.family,
    fontSize: 15, fontWeight: '800', color: COLORS.TEXT_SECONDARY,
    fontVariant: ['tabular-nums'],
  },
  teamScoreWin: { color: COLORS.TEXT, fontWeight: '900' },
  teamOvers: {
    fontFamily: FONTS.family,
    fontSize: 10, fontWeight: '600', color: COLORS.TEXT_MUTED,
    fontVariant: ['tabular-nums'],
  },
  teamSeparator: { height: 0 },

  /* Toss */
  tossRow: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.WARNING_BG,
    paddingHorizontal: 7, paddingVertical: 4,
    borderRadius: 5,
  },
  tossText: {
    fontFamily: FONTS.family,
    flex: 1,
    fontSize: 10, fontWeight: '700', color: COLORS.WARNING,
  },

  /* Meta */
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  metaChip: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
    backgroundColor: COLORS.SURFACE,
  },
  metaChipText: {
    fontFamily: FONTS.family,
    fontSize: 10, fontWeight: '600', color: COLORS.TEXT_SECONDARY,
    maxWidth: 140,
  },

  /* Result / chase / upcoming footers */
  resultFooter: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 7, paddingVertical: 5,
    borderRadius: 5,
  },
  resultText: {
    fontFamily: FONTS.family,
    flex: 1,
    fontSize: 11, fontWeight: '700',
  },
  upcomingFooter: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
  },
  upcomingText: {
    fontFamily: FONTS.family,
    flex: 1,
    fontSize: 10, fontWeight: '600', color: COLORS.TEXT_MUTED,
  },
});

export default React.memo(MatchCard);
