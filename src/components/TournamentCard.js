import React from 'react';
import { View, Text, TouchableOpacity, ImageBackground, StyleSheet, Platform } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, FONTS } from '../theme';
import FavoriteButton from './FavoriteButton';

const fmtDate = (d) => {
  if (!d) return null;
  try {
    return new Date(d).toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
  } catch { return null; }
};

const fmtDateRange = (start, end) => {
  if (!start && !end) return null;
  const s = fmtDate(start), e = fmtDate(end);
  if (s && e && s !== e) return `${s} – ${e}`;
  return s || e || null;
};

const fmtMoney = (n) => {
  if (n == null || Number(n) === 0) return null;
  const v = Number(n);
  if (v >= 100000) return `₹${(v / 100000).toFixed(v % 100000 === 0 ? 0 : 1)}L`;
  if (v >= 1000) return `₹${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k`;
  return `₹${v}`;
};

const fmtKm = (n) => {
  if (n == null) return null;
  const v = Number(n);
  if (Number.isNaN(v)) return null;
  return `${v < 10 ? v.toFixed(1) : Math.round(v)} km`;
};

const TYPE_LABEL = {
  league_knockout: 'League + Knockout',
  league: 'League',
  knockout: 'Knockout',
};

const ROLE_LABEL = {
  organized: 'You organize',
  played: "You're playing",
  both: 'Organize + play',
};

const ACCENT_THEME = {
  fg: COLORS.ACCENT_LIGHT,
  bg: COLORS.ACCENT_SOFT,
  border: 'rgba(30,136,229,0.30)',
  glow: 'rgba(30,136,229,0.08)',
};

const STATUS = {
  live:         { label: 'LIVE',      pulse: true,  fg: COLORS.LIVE,           bg: COLORS.LIVE_BG,     border: 'rgba(255,59,48,0.35)',   glow: 'rgba(255,59,48,0.10)' },
  in_progress:  { label: 'LIVE',      pulse: true,  fg: COLORS.LIVE,           bg: COLORS.LIVE_BG,     border: 'rgba(255,59,48,0.35)',   glow: 'rgba(255,59,48,0.10)' },
  ongoing:      { label: 'LIVE',      pulse: true,  fg: COLORS.LIVE,           bg: COLORS.LIVE_BG,     border: 'rgba(255,59,48,0.35)',   glow: 'rgba(255,59,48,0.10)' },
  completed:    { label: 'COMPLETED', pulse: false, fg: COLORS.SUCCESS_LIGHT,  bg: COLORS.SUCCESS_BG,  border: 'rgba(34,197,94,0.30)',   glow: 'rgba(34,197,94,0.08)' },
  upcoming:     { label: 'UPCOMING',  pulse: false, fg: COLORS.WARNING_LIGHT,  bg: COLORS.WARNING_BG,  border: 'rgba(245,158,11,0.30)',  glow: 'rgba(245,158,11,0.06)' },
  draft:        { label: 'DRAFT',     pulse: false, fg: COLORS.TEXT_SECONDARY, bg: 'rgba(255,255,255,0.05)', border: COLORS.BORDER,       glow: 'rgba(255,255,255,0.04)' },
};


const TournamentCard = ({ tournament, onPress, style, width, monochrome = false }) => {
  const t = tournament || {};
  const baseStatus = STATUS[t.status] || STATUS.upcoming;
  const status = monochrome
    ? { label: baseStatus.label, pulse: baseStatus.pulse, ...ACCENT_THEME }
    : baseStatus;

  const typeLabel = TYPE_LABEL[t.tournament_type] || null;
  const dateRange = fmtDateRange(t.start_date, t.end_date);
  const venue = t.venue_name || t.venue_city || t.location;
  const distance = fmtKm(t.distance_km);
  const roleLabel = ROLE_LABEL[t.role] || null;
  const overs = t.overs_per_match ? `T${t.overs_per_match}` : null;
  const prize = fmtMoney(t.prize_pool);
  const entry = fmtMoney(t.entry_fee);

  const stages = t.stages_count;
  const matchesTotal = t.matches_total;
  const matchesDone = t.matches_completed;
  const showStages = stages != null && stages > 0;
  const showMatches = matchesTotal != null && matchesTotal > 0;
  const showPrize = !!prize;

  const tiles = [];
  if (showStages) tiles.push({ icon: 'flag-checkered', label: `${stages}`, value: stages === 1 ? 'stage' : 'stages' });
  if (showMatches) tiles.push({ icon: 'cricket', label: `${matchesDone || 0}/${matchesTotal}`, value: 'matches' });
  if (showPrize) tiles.push({ icon: 'cash-multiple', label: prize, value: 'prize pool' });
  if (!showPrize && entry) tiles.push({ icon: 'ticket-outline', label: entry, value: 'entry' });

  const metaChips = [];
  if (venue) metaChips.push({ icon: 'map-marker-outline', text: venue });
  if (dateRange) metaChips.push({ icon: 'calendar-blank-outline', text: dateRange });
  if (distance) metaChips.push({ icon: 'navigation-variant-outline', text: distance });
  if (roleLabel) metaChips.push({ icon: 'shield-account-outline', text: roleLabel, accent: true });

  const progressPct = matchesTotal > 0
    ? Math.min(100, Math.round(((matchesDone || 0) / matchesTotal) * 100))
    : 0;

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
      {t.banner_url ? (
        <ImageBackground
          source={{ uri: t.banner_url }}
          style={s.banner}
          imageStyle={s.bannerImg}
        >
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.75)']}
            style={s.bannerShade}
          />
        </ImageBackground>
      ) : (
        <LinearGradient
          colors={[status.glow, 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={s.topGlow}
          pointerEvents="none"
        />
      )}

      <FavoriteButton entityType="tournament" entityId={t.id} />

      <View style={s.headerRow}>
        <View style={[s.statusChip, { backgroundColor: status.bg, borderColor: status.border }]}>
          {status.pulse ? <View style={[s.pulseDot, { backgroundColor: status.fg }]} /> : null}
          <Text style={[s.statusChipText, { color: status.fg }]}>{status.label}</Text>
        </View>
        {overs ? (
          <View style={s.formatChip}>
            <Text style={s.formatChipText}>{overs}</Text>
          </View>
        ) : null}
        {t.ball_type ? (
          <View style={s.formatChip}>
            <Text style={s.formatChipText}>{String(t.ball_type).toUpperCase()}</Text>
          </View>
        ) : null}
        <View style={s.headerSpacer} />
        {t.tournament_code ? (
          <Text style={s.codeText}>#{t.tournament_code}</Text>
        ) : null}
      </View>

      <View style={s.titleBlock}>
        <Text style={s.title} numberOfLines={2}>{t.name || 'Untitled Tournament'}</Text>
        {(typeLabel || t.organizer_name) && (
          <View style={s.subRow}>
            {typeLabel ? (
              <Text style={s.subLine} numberOfLines={1}>{typeLabel}</Text>
            ) : null}
            {typeLabel && t.organizer_name ? <Text style={s.subDot}>·</Text> : null}
            {t.organizer_name ? (
              <Text style={s.subLine} numberOfLines={1}>by {t.organizer_name}</Text>
            ) : null}
          </View>
        )}
      </View>

      {tiles.length > 0 && (
        <View style={s.tilesRow}>
          {tiles.map((tile, i) => (
            <View
              key={i}
              style={[
                s.tile,
                monochrome && { borderColor: 'transparent', backgroundColor: 'rgba(255,255,255,0.05)' },
              ]}
            >
              <MaterialCommunityIcons name={tile.icon} size={12} color={status.fg} />
              <Text style={s.tileLabel}>{tile.label}</Text>
              <Text style={s.tileValue}>{tile.value}</Text>
            </View>
          ))}
        </View>
      )}

      {matchesTotal > 0 && (
        <View style={s.progressWrap}>
          <View style={s.progressBar}>
            <View
              style={[
                s.progressFill,
                { width: `${progressPct}%`, backgroundColor: status.fg },
              ]}
            />
          </View>
          <Text style={s.progressText}>
            {progressPct}% complete
          </Text>
        </View>
      )}

      {metaChips.length > 0 && (
        <View style={s.metaRow}>
          {metaChips.map((c, i) => (
            <View
              key={i}
              style={[
                s.metaChip,
                monochrome && { borderColor: 'transparent', backgroundColor: 'rgba(255,255,255,0.04)' },
                c.accent && { backgroundColor: status.bg, borderColor: status.border },
              ]}
            >
              <MaterialCommunityIcons
                name={c.icon}
                size={10}
                color={c.accent ? status.fg : COLORS.TEXT_MUTED}
              />
              <Text
                style={[s.metaText, c.accent && { color: status.fg }]}
                numberOfLines={1}
              >
                {c.text}
              </Text>
            </View>
          ))}
        </View>
      )}
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
  topGlow: { position: 'absolute', top: 0, left: 0, right: 0, height: 64 },

  banner: {
    height: 70,
    marginHorizontal: -11,
    marginTop: -12,
    marginBottom: -2,
    overflow: 'hidden',
  },
  bannerImg: { resizeMode: 'cover' },
  bannerShade: { ...StyleSheet.absoluteFillObject },

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

  titleBlock: { gap: 2, marginTop: -2 },
  title: {
    fontFamily: FONTS.family, fontSize: 15, fontWeight: '900',
    color: COLORS.TEXT, letterSpacing: -0.2, lineHeight: 19,
  },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap' },
  subLine: {
    fontFamily: FONTS.family, fontSize: 11, fontWeight: '700',
    color: COLORS.TEXT_SECONDARY, letterSpacing: 0.1,
  },
  subDot: { color: COLORS.TEXT_MUTED, fontSize: 11 },

  tilesRow: { flexDirection: 'row', gap: 6 },
  tile: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    paddingVertical: 6,
    paddingHorizontal: 6,
    alignItems: 'center',
    gap: 1,
  },
  tileLabel: {
    fontFamily: FONTS.family, fontSize: 12, fontWeight: '900',
    color: COLORS.TEXT, marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  tileValue: {
    fontFamily: FONTS.family, fontSize: 8, fontWeight: '700',
    color: COLORS.TEXT_MUTED, letterSpacing: 0.4,
    textTransform: 'uppercase',
  },

  progressWrap: { gap: 4 },
  progressBar: {
    height: 5, borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 3 },
  progressText: {
    fontFamily: FONTS.family, fontSize: 9, fontWeight: '700',
    color: COLORS.TEXT_MUTED, letterSpacing: 0.3,
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
});

export default React.memo(TournamentCard);
