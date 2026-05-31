import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, FONTS } from '../theme';
import FavoriteButton from './FavoriteButton';

const fmtDate = (d) => {
  if (!d) return '';
  try {
    return new Date(d).toLocaleDateString('en-US', {
      weekday: 'short', day: 'numeric', month: 'short',
    });
  } catch { return ''; }
};

const fmtAgo = (d) => {
  if (!d) return null;
  try {
    const ms = Math.max(0, Date.now() - new Date(d).getTime());
    const days = Math.floor(ms / 86400000);
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days}d ago`;
    if (days < 30) return `${Math.floor(days / 7)}w ago`;
    if (days < 365) return `${Math.floor(days / 30)}mo ago`;
    return `${Math.floor(days / 365)}y ago`;
  } catch { return null; }
};

const fmtOvers = (v) => {
  if (v == null) return null;
  const n = Number(v);
  if (Number.isNaN(n)) return String(v);
  return n.toFixed(1).replace(/\.0$/, '.0');
};

const formatLabel = (m) => {
  const explicit = (m.match_format || m.match_type_format || '').toUpperCase();
  if (['T5', 'T10', 'T15', 'T20', 'ODI', 'TEST'].includes(explicit)) return explicit;
  const o = Number(m.overs);
  if (!o || Number.isNaN(o)) return null;
  if (o <= 5) return 'T5';
  if (o <= 10) return 'T10';
  if (o <= 20) return 'T20';
  if (o <= 50) return 'ODI';
  return `${o}-OV`;
};

const stagePretty = (m) => {
  if (m.stage_label) return m.stage_label;
  const n = (m.stage_name || '').toLowerCase();
  if (!n) return null;
  if (n === 'final') return 'Final';
  if (n === 'semi_final') return 'Semi Final';
  if (n === 'quarter_final') return 'Quarter Final';
  if (n === 'round_of_16') return 'Round of 16';
  if (n === 'preliminary_round') return 'Preliminary';
  if (n === 'league_matches') return 'League';
  if (n === 'super_league') return 'Super League';
  return n.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
};

const matchNumLabel = (m) => {
  if (m.match_number) return `Match ${m.match_number}`;
  return null;
};

const chaseTrailer = (m) => {
  if (m.status !== 'live' && m.status !== 'in_progress') return null;
  const a = m.team_a_runs, b = m.team_b_runs;
  if (a == null || b == null) return null;
  const trail = Math.max(a, b) - Math.min(a, b);
  if (trail <= 0) return null;
  const chaser = a < b ? m.team_a_name : m.team_b_name;
  return chaser ? `${chaser} need ${trail + 1} to win` : null;
};

const calcCRR = (runs, overs) => {
  if (runs == null || overs == null) return null;
  const n = Number(overs);
  if (!n || Number.isNaN(n)) return null;
  const fullOvers = Math.floor(n);
  const balls = Math.round((n - fullOvers) * 10);
  const totalBalls = fullOvers * 6 + balls;
  if (totalBalls <= 0) return null;
  return (Number(runs) / (totalBalls / 6)).toFixed(2);
};

const buildResultFallback = (m) => {
  if (m.result_summary) return m.result_summary;
  if (m.status !== 'completed' || !m.winner_id) return null;
  const winnerName = m.winner_id === m.team_a_id ? m.team_a_name
    : m.winner_id === m.team_b_id ? m.team_b_name : null;
  if (!winnerName) return 'Match Completed';
  const aRuns = m.team_a_runs, bRuns = m.team_b_runs;
  const aWkts = m.team_a_wickets, bWkts = m.team_b_wickets;
  if (aRuns != null && bRuns != null) {
    if (m.winner_id === m.team_a_id && aRuns > bRuns) return `${winnerName} won by ${aRuns - bRuns} runs`;
    if (m.winner_id === m.team_b_id && bRuns > aRuns) {
      const wktsLeft = 10 - (bWkts ?? 0);
      return `${winnerName} won by ${wktsLeft} wicket${wktsLeft === 1 ? '' : 's'}`;
    }
  }
  return `${winnerName} won`;
};

const ACCENT_THEME = {
  fg: COLORS.ACCENT_LIGHT,
  bg: COLORS.ACCENT_SOFT,
  border: 'rgba(30,136,229,0.30)',
  glow: 'rgba(30,136,229,0.08)',
};

const STATUS = {
  live:        { label: 'LIVE',      pulse: true,  fg: COLORS.LIVE,           bg: COLORS.LIVE_BG,        border: 'rgba(255,59,48,0.35)',   glow: 'rgba(255,59,48,0.10)' },
  in_progress: { label: 'LIVE',      pulse: true,  fg: COLORS.LIVE,           bg: COLORS.LIVE_BG,        border: 'rgba(255,59,48,0.35)',   glow: 'rgba(255,59,48,0.10)' },
  completed:   { label: 'COMPLETED', pulse: false, fg: COLORS.SUCCESS_LIGHT,  bg: COLORS.SUCCESS_BG,     border: 'rgba(34,197,94,0.30)',   glow: 'rgba(34,197,94,0.08)' },
  upcoming:    { label: 'UPCOMING',  pulse: false, fg: COLORS.WARNING_LIGHT,  bg: COLORS.WARNING_BG,     border: 'rgba(245,158,11,0.30)',  glow: 'rgba(245,158,11,0.06)' },
  scheduled:   { label: 'SCHEDULED', pulse: false, fg: COLORS.WARNING_LIGHT,  bg: COLORS.WARNING_BG,     border: 'rgba(245,158,11,0.30)',  glow: 'rgba(245,158,11,0.06)' },
  toss:        { label: 'TOSS',      pulse: false, fg: COLORS.ACCENT_LIGHT,   bg: COLORS.ACCENT_SOFT,    border: 'rgba(30,136,229,0.30)',  glow: 'rgba(30,136,229,0.08)' },
  squad_set:   { label: 'SQUAD',     pulse: false, fg: COLORS.ACCENT_LIGHT,   bg: COLORS.ACCENT_SOFT,    border: 'rgba(30,136,229,0.30)',  glow: 'rgba(30,136,229,0.08)' },
};


const TeamBlock = ({ name, color, score, wickets, overs, isWinner, isBatting, isCompact, showCRR, liveRole, monochrome }) => {
  const crr = showCRR && isBatting ? calcCRR(score, overs) : null;
  const roleTone = liveRole === 'BATTING'
    ? (monochrome ? COLORS.ACCENT_LIGHT : COLORS.LIVE)
    : COLORS.TEXT_MUTED;
  return (
    <View style={[s.teamBlock, isCompact && s.teamBlockCompact]}>
      <View style={[s.teamBadge, { backgroundColor: color || COLORS.ACCENT }]}>
        <Text style={s.teamBadgeText}>{(name || '?').slice(0, 3).toUpperCase()}</Text>
        {isBatting ? <View style={s.batDot} /> : null}
      </View>
      <View style={s.teamNameWrap}>
        <Text style={[s.teamName, isWinner && s.teamNameWin]} numberOfLines={1}>
          {name || 'TBD'}
        </Text>
        {liveRole ? (
          <Text style={[s.roleLabel, { color: roleTone }]}>{liveRole}</Text>
        ) : null}
      </View>
      {score != null ? (
        <View style={s.scoreRow}>
          <Text style={[s.scoreText, isWinner && s.scoreTextWin]}>
            {score}
            <Text style={s.scoreSlash}>/{wickets ?? 0}</Text>
          </Text>
          {overs != null ? (
            <Text style={s.oversText}>
              ({fmtOvers(overs)}{crr ? ` · ${crr}` : ''})
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
};


const MatchCard = ({ match, onPress, style, width, monochrome = false }) => {
  const m = match || {};
  const baseStatus = STATUS[m.status] || STATUS.upcoming;
  const status = monochrome
    ? { label: baseStatus.label, pulse: baseStatus.pulse, ...ACCENT_THEME }
    : baseStatus;
  const isLive = m.status === 'live' || m.status === 'in_progress';
  const isCompleted = m.status === 'completed';
  const isUpcoming = !isLive && !isCompleted;
  const hasScore = m.team_a_runs != null || m.team_b_runs != null;

  const winnerA = m.winner_id && m.winner_id === m.team_a_id;
  const winnerB = m.winner_id && m.winner_id === m.team_b_id;
  const battingA = isLive && m.batting_team_id === m.team_a_id;
  const battingB = isLive && m.batting_team_id === m.team_b_id;

  const format = formatLabel(m);
  const stage = stagePretty(m);
  const matchNo = matchNumLabel(m);
  const trailer = chaseTrailer(m);

  const tossLine = !isCompleted && m.toss_winner_id
    ? `${m.toss_winner_name
        || (m.toss_winner_id === m.team_a_id ? m.team_a_name : m.team_b_name)
        || 'Team'} chose to ${m.toss_decision || 'bat'}`
    : null;

  const metaChips = [];
  if (m.match_date) metaChips.push({ icon: 'calendar-blank-outline', text: fmtDate(m.match_date) });
  if (m.time_slot) metaChips.push({ icon: 'clock-outline', text: m.time_slot });
  if (m.venue_name) metaChips.push({ icon: 'map-marker-outline', text: m.venue_name });
  if (m.group_name && m.group_name !== stage) {
    metaChips.push({ icon: 'account-group-outline', text: m.group_name });
  }
  if (m.distance_km != null) {
    const km = Number(m.distance_km);
    metaChips.push({
      icon: 'navigation-variant-outline',
      text: `${km < 10 ? km.toFixed(1) : Math.round(km)} km`,
    });
  }
  if (isCompleted) {
    const ago = fmtAgo(m.match_date);
    if (ago) metaChips.push({ icon: 'history', text: ago });
  }

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={onPress}
      style={[
        s.card,
        monochrome
          ? { backgroundColor: COLORS.BG, borderColor: 'transparent' }
          : { borderColor: status.border },
        width != null && { width },
        style,
      ]}
    >
      {monochrome ? (
        <>
          <LinearGradient
            colors={['#1C1C20', '#141418', '#0E0E11']}
            locations={[0, 0.5, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          <LinearGradient
            colors={['rgba(255,255,255,0.05)', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0.6, y: 0.45 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
        </>
      ) : null}

      <LinearGradient
        colors={[status.glow || 'rgba(30,136,229,0.08)', 'rgba(0,0,0,0)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={s.topGlow}
        pointerEvents="none"
      />

      <FavoriteButton entityType="match" entityId={m.id} />

      <View style={s.headerRow}>
        <View style={[s.statusChip, { backgroundColor: status.bg, borderColor: status.border }]}>
          {status.pulse ? <View style={[s.pulseDot, { backgroundColor: status.fg }]} /> : null}
          <Text style={[s.statusChipText, { color: status.fg }]}>{status.label}</Text>
        </View>
        {format ? (
          <View style={s.formatChip}>
            <Text style={s.formatChipText}>{format}</Text>
          </View>
        ) : null}
        <View style={s.headerSpacer} />
        {m.match_code ? (
          <Text style={s.codeText}>#{m.match_code}</Text>
        ) : null}
      </View>

      {m.name ? (
        <Text style={s.matchNameText} numberOfLines={1}>{m.name}</Text>
      ) : null}

      {(stage || matchNo) ? (
        <View style={s.stageRow}>
          {stage ? <Text style={s.stageText} numberOfLines={1}>{stage}</Text> : null}
          {stage && matchNo ? <Text style={s.stageDot}>·</Text> : null}
          {matchNo ? <Text style={s.matchNoText}>{matchNo}</Text> : null}
        </View>
      ) : null}

      {hasScore ? (
        <View style={s.scoresStack}>
          <TeamBlock
            name={m.team_a_name}
            color={m.team_a_color}
            score={m.team_a_runs}
            wickets={m.team_a_wickets}
            overs={m.team_a_overs}
            isWinner={winnerA}
            isBatting={battingA}
            isCompact
            showCRR={isLive}
            liveRole={isLive && m.batting_team_id ? (battingA ? 'BATTING' : 'BOWLING') : null}
            monochrome={monochrome}
          />
          <TeamBlock
            name={m.team_b_name}
            color={m.team_b_color}
            score={m.team_b_runs}
            wickets={m.team_b_wickets}
            overs={m.team_b_overs}
            isWinner={winnerB}
            isBatting={battingB}
            isCompact
            showCRR={isLive}
            liveRole={isLive && m.batting_team_id ? (battingB ? 'BATTING' : 'BOWLING') : null}
            monochrome={monochrome}
          />
        </View>
      ) : (
        <View style={s.versusRow}>
          <View style={s.versusSide}>
            <View style={[s.versusBadge, { backgroundColor: m.team_a_color || COLORS.ACCENT }]}>
              <Text style={s.versusBadgeText}>{(m.team_a_name || '?').slice(0, 3).toUpperCase()}</Text>
            </View>
            <Text style={s.versusName} numberOfLines={2}>{m.team_a_name || 'TBD'}</Text>
          </View>

          <View style={s.versusMid}>
            <Text style={s.versusVs}>VS</Text>
          </View>

          <View style={s.versusSide}>
            <View style={[s.versusBadge, { backgroundColor: m.team_b_color || COLORS.ACCENT_LIGHT }]}>
              <Text style={s.versusBadgeText}>{(m.team_b_name || '?').slice(0, 3).toUpperCase()}</Text>
            </View>
            <Text style={s.versusName} numberOfLines={2}>{m.team_b_name || 'TBD'}</Text>
          </View>
        </View>
      )}

      {tossLine ? (
        <View style={s.tossRow}>
          <MaterialCommunityIcons name="circle-outline" size={11} color={COLORS.WARNING_LIGHT} />
          <Text style={s.tossText} numberOfLines={1}>{tossLine}</Text>
        </View>
      ) : null}

      {metaChips.length > 0 && (
        <View style={s.metaRow}>
          {metaChips.map((c, i) => (
            <View
              key={i}
              style={[
                s.metaChip,
                monochrome && { borderColor: 'transparent', backgroundColor: 'rgba(255,255,255,0.04)' },
              ]}
            >
              <MaterialCommunityIcons name={c.icon} size={10} color={COLORS.TEXT_MUTED} />
              <Text style={s.metaText} numberOfLines={1}>{c.text}</Text>
            </View>
          ))}
        </View>
      )}

      {trailer ? (
        <View style={[
          s.footer,
          monochrome
            ? { backgroundColor: ACCENT_THEME.bg, borderColor: ACCENT_THEME.border }
            : { backgroundColor: COLORS.LIVE_BG, borderColor: 'rgba(255,59,48,0.25)' }
        ]}>
          <MaterialCommunityIcons
            name="run-fast"
            size={13}
            color={monochrome ? ACCENT_THEME.fg : COLORS.LIVE}
          />
          <Text
            style={[s.footerText, { color: monochrome ? ACCENT_THEME.fg : COLORS.LIVE }]}
            numberOfLines={1}
          >
            {trailer}
          </Text>
        </View>
      ) : (() => {
        const resultLine = buildResultFallback(m);
        if (!resultLine) return null;
        return (
          <View style={[
            s.footer,
            monochrome
              ? { backgroundColor: ACCENT_THEME.bg, borderColor: ACCENT_THEME.border }
              : isCompleted
                ? { backgroundColor: COLORS.SUCCESS_BG, borderColor: 'rgba(34,197,94,0.22)' }
                : { backgroundColor: COLORS.ACCENT_SOFT, borderColor: COLORS.ACCENT_SOFT_BORDER }
          ]}>
            <MaterialCommunityIcons
              name={isCompleted ? 'trophy-variant' : 'information-outline'}
              size={13}
              color={monochrome ? ACCENT_THEME.fg : (isCompleted ? COLORS.SUCCESS_LIGHT : COLORS.ACCENT_LIGHT)}
            />
            <Text
              style={[s.footerText, { color: monochrome ? ACCENT_THEME.fg : (isCompleted ? COLORS.SUCCESS_LIGHT : COLORS.ACCENT_LIGHT) }]}
              numberOfLines={2}
            >
              {resultLine}
            </Text>
          </View>
        );
      })()}
      {isUpcoming && (m.match_date || m.time_slot) && !m.result_summary ? (
        <View style={[s.footer, { backgroundColor: 'rgba(255,255,255,0.03)', borderColor: COLORS.BORDER }]}>
          <MaterialCommunityIcons name="calendar-clock" size={13} color={COLORS.TEXT_SECONDARY} />
          <Text style={[s.footerText, { color: COLORS.TEXT_SECONDARY }]} numberOfLines={1}>
            {m.match_date ? `Starts ${fmtDate(m.match_date)}` : 'Time'}
            {m.time_slot ? ` · ${m.time_slot}` : ''}
          </Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
};


const s = StyleSheet.create({
  card: {
    borderRadius: 14,
    backgroundColor: COLORS.CARD,
    borderWidth: 1,
    padding: 11,
    paddingTop: 12,
    gap: 9,
    overflow: 'hidden',
    position: 'relative',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 10 },
      android: { elevation: 4 },
    }),
  },
  topGlow: {
    position: 'absolute',
    top: 0, left: 0, right: 0, height: 64,
  },

  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingRight: 32 },
  statusChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 7, paddingVertical: 3,
    borderRadius: 5, borderWidth: 1,
  },
  statusChipText: {
    fontFamily: FONTS.family, fontSize: 9, fontWeight: '900', letterSpacing: 0.8,
  },
  pulseDot: { width: 5, height: 5, borderRadius: 3 },
  formatChip: {
    paddingHorizontal: 6, paddingVertical: 3, borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: COLORS.BORDER,
  },
  formatChipText: {
    fontFamily: FONTS.family, fontSize: 9, fontWeight: '900',
    color: COLORS.TEXT, letterSpacing: 0.5,
  },
  headerSpacer: { flex: 1 },
  codeText: {
    fontFamily: FONTS.family, fontSize: 9, fontWeight: '700',
    color: COLORS.TEXT_MUTED, letterSpacing: 0.4,
  },

  matchNameText: {
    fontFamily: FONTS.family, fontSize: 12, fontWeight: '900',
    color: COLORS.ACCENT_LIGHT, letterSpacing: 0.4,
    textTransform: 'uppercase', marginTop: -2,
  },
  stageRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: -2 },
  stageText: {
    fontFamily: FONTS.family, fontSize: 11, fontWeight: '800',
    color: COLORS.ACCENT_LIGHT, letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  stageDot: { color: COLORS.TEXT_MUTED, fontSize: 11 },
  matchNoText: {
    fontFamily: FONTS.family, fontSize: 10, fontWeight: '700',
    color: COLORS.TEXT_SECONDARY, letterSpacing: 0.2,
  },

  versusRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 5, gap: 6,
  },
  versusSide: { flex: 1, alignItems: 'center', gap: 6 },
  versusBadge: {
    width: 46, height: 46, borderRadius: 23,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.1)',
  },
  versusBadgeText: {
    fontFamily: FONTS.family, color: '#fff', fontSize: 13, fontWeight: '900', letterSpacing: 0.4,
  },
  versusName: {
    fontFamily: FONTS.family, fontSize: 12, fontWeight: '800',
    color: COLORS.TEXT, textAlign: 'center', letterSpacing: -0.1,
  },
  versusMid: { paddingHorizontal: 4 },
  versusVs: {
    fontFamily: FONTS.family, fontSize: 14, fontWeight: '900',
    color: COLORS.TEXT_MUTED, letterSpacing: 1.3,
  },

  scoresStack: { gap: 5 },
  teamBlock: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  teamBlockCompact: { paddingVertical: 1 },
  teamBadge: {
    width: 30, height: 30, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.2, borderColor: 'rgba(255,255,255,0.08)',
    position: 'relative',
  },
  teamBadgeText: {
    fontFamily: FONTS.family, color: '#fff', fontSize: 10, fontWeight: '900', letterSpacing: 0.4,
  },
  batDot: {
    position: 'absolute', top: -2, right: -2,
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: COLORS.LIVE,
    borderWidth: 1.5, borderColor: COLORS.CARD,
  },
  teamNameWrap: { flex: 1, flexDirection: 'row', alignItems: 'baseline', gap: 6, minWidth: 0 },
  teamName: {
    fontFamily: FONTS.family,
    fontSize: 13, fontWeight: '700', color: COLORS.TEXT_SECONDARY,
    letterSpacing: -0.1,
    flexShrink: 1,
  },
  teamNameWin: { color: COLORS.TEXT, fontWeight: '900' },
  roleLabel: {
    fontFamily: FONTS.family, fontSize: 8, fontWeight: '900', letterSpacing: 0.8,
  },
  scoreRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  scoreText: {
    fontFamily: FONTS.family, fontSize: 17, fontWeight: '900',
    color: COLORS.TEXT_SECONDARY, fontVariant: ['tabular-nums'],
    letterSpacing: -0.4,
  },
  scoreTextWin: { color: COLORS.TEXT },
  scoreSlash: {
    fontSize: 12, fontWeight: '700', color: COLORS.TEXT_MUTED,
  },
  oversText: {
    fontFamily: FONTS.family, fontSize: 10, fontWeight: '700',
    color: COLORS.TEXT_MUTED, fontVariant: ['tabular-nums'],
  },

  tossRow: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: COLORS.WARNING_BG,
    paddingHorizontal: 8, paddingVertical: 5,
    borderRadius: 7,
    borderWidth: 1, borderColor: 'rgba(245,158,11,0.18)',
  },
  tossText: {
    flex: 1, fontFamily: FONTS.family,
    fontSize: 10, fontWeight: '700', color: COLORS.WARNING_LIGHT,
    letterSpacing: 0.1,
  },

  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  metaChip: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 7, paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: COLORS.BORDER,
  },
  metaText: {
    fontFamily: FONTS.family, fontSize: 10, fontWeight: '600',
    color: COLORS.TEXT_SECONDARY, maxWidth: 140,
  },

  footer: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
  },
  footerText: {
    flex: 1, fontFamily: FONTS.family,
    fontSize: 12, fontWeight: '800',
    letterSpacing: 0.1,
  },
});

export default React.memo(MatchCard);
