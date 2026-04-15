import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, InteractionManager, Share,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tournamentsAPI } from '../../services/api';
import { COLORS } from '../../theme';
import Skeleton from '../../components/Skeleton';

/* ─── design tokens ─── */
const ORANGE = '#F97316';
const ORANGE_TINT = 'rgba(249,115,22,0.12)';
const PURPLE = COLORS.PURPLE;
const PURPLE_TINT = 'rgba(139,92,246,0.12)';

const TABS = ['Batting', 'Bowling', 'Fielding'];

/* ─── placeholder data ─── */
const SAMPLE_MVP = {
  name: 'Virat Kohli',
  team: 'Royal Challengers',
  points: 847,
  impact: 9.6,
};

const SAMPLE_ORANGE_CAP = [
  { rank: 1, name: 'Shubman Gill', team: 'Gujarat Titans', runs: 432 },
  { rank: 2, name: 'Faf du Plessis', team: 'Royal Challengers', runs: 398 },
  { rank: 3, name: 'Devon Conway', team: 'Chennai Super Kings', runs: 371 },
];

const SAMPLE_PURPLE_CAP = [
  { rank: 1, name: 'Yuzvendra Chahal', team: 'Rajasthan Royals', wickets: 21 },
  { rank: 2, name: 'Rashid Khan', team: 'Gujarat Titans', wickets: 18 },
  { rank: 3, name: 'Jasprit Bumrah', team: 'Mumbai Indians', wickets: 16 },
];

const SAMPLE_HIGHEST_SCORE = {
  score: 128,
  notOut: true,
  name: 'Shubman Gill',
  match: 'GT vs MI • Match 14',
  detail: '128*(56) • 14 fours, 6 sixes',
};

/* ─── header ─── */
const Header = ({ insets, onBack, onShare }) => (
  <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
    <TouchableOpacity onPress={onBack} style={styles.headerBtn} hitSlop={12}>
      <Text style={styles.backArrow}>{'‹'}</Text>
    </TouchableOpacity>
    <Text style={styles.headerTitle}>Tournament Leaderboards</Text>
    <TouchableOpacity onPress={onShare} style={styles.headerBtn} hitSlop={12}>
      <Text style={styles.shareIcon}>↗</Text>
    </TouchableOpacity>
  </View>
);

/* ─── tab bar ─── */
const TabBar = ({ active, onChange }) => (
  <View style={styles.tabBar}>
  <ScrollView
    horizontal
    showsHorizontalScrollIndicator={false}
    contentContainerStyle={styles.tabBarContent}
  >
    {TABS.map((tab) => {
      const isActive = tab === active;
      return (
        <TouchableOpacity
          key={tab}
          onPress={() => onChange(tab)}
          style={[styles.tab, isActive && styles.tabActive]}
        >
          <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
            {tab}
          </Text>
        </TouchableOpacity>
      );
    })}
  </ScrollView>
  </View>
);

/* ─── MVP contender card ─── */
const MVPContenderCard = ({ player }) => (
  <View style={styles.mvpOuter}>
    <View style={styles.mvpInner}>
      {/* avatar placeholder */}
      <View style={styles.mvpAvatarWrap}>
        <View style={styles.mvpAvatar}>
          <Text style={styles.mvpAvatarText}>
            {player.name.charAt(0)}
          </Text>
        </View>
        <View style={styles.mvpStarBadge}>
          <Text style={styles.mvpStarText}>★</Text>
        </View>
      </View>

      <Text style={styles.mvpName}>{player.name}</Text>
      <Text style={styles.mvpTeam}>{player.team}</Text>

      {/* TOP SEED badge */}
      <View style={styles.topSeedBadge}>
        <Text style={styles.topSeedText}>TOP SEED</Text>
      </View>

      {/* stats row */}
      <View style={styles.mvpStatsRow}>
        <View style={styles.mvpStatItem}>
          <Text style={styles.mvpStatValue}>{player.points}</Text>
          <Text style={styles.mvpStatLabel}>Points</Text>
        </View>
        <View style={styles.mvpStatDivider} />
        <View style={styles.mvpStatItem}>
          <Text style={styles.mvpStatValue}>{player.impact}</Text>
          <Text style={styles.mvpStatLabel}>Impact</Text>
        </View>
      </View>
    </View>
  </View>
);

/* ─── section title ─── */
const SectionTitle = ({ icon, color, title }) => (
  <View style={styles.sectionTitleRow}>
    <View style={[styles.medalIcon, { backgroundColor: color }]}>
      <Text style={styles.medalText}>{icon}</Text>
    </View>
    <Text style={styles.sectionTitleText}>{title}</Text>
  </View>
);

/* ─── rank row ─── */
const RankRow = ({ item, isFirst, accentColor, tintColor, statLabel, statKey }) => (
  <View
    style={[
      styles.rankRow,
      isFirst && { backgroundColor: tintColor, borderLeftWidth: 4, borderLeftColor: accentColor },
    ]}
  >
    <Text style={[styles.rankNum, isFirst && { color: accentColor, fontWeight: '700' }]}>
      {item.rank}
    </Text>
    {/* avatar placeholder */}
    <View style={[styles.rankAvatar, isFirst && { borderColor: accentColor }]}>
      <Text style={styles.rankAvatarText}>{item.name.charAt(0)}</Text>
    </View>
    <View style={styles.rankInfo}>
      <Text style={styles.rankName}>{item.name}</Text>
      <Text style={styles.rankTeam}>{item.team}</Text>
    </View>
    <View style={styles.rankStatWrap}>
      <Text style={[styles.rankStatValue, isFirst && { color: accentColor }]}>
        {item[statKey]}
      </Text>
      <Text style={styles.rankStatLabel}>{statLabel}</Text>
    </View>
  </View>
);

/* ─── highest individual score card ─── */
const HighestScoreCard = ({ data: s }) => (
  <View style={styles.highScoreSection}>
    <Text style={styles.highScoreTitle}>Highest Individual Score</Text>
    <View style={styles.highScoreCard}>
      <View style={styles.highScoreLeft}>
        <View style={styles.highScoreBox}>
          <Text style={styles.highScoreValue}>
            {s.score}{s.notOut ? '*' : ''}
          </Text>
        </View>
      </View>
      <View style={styles.highScoreRight}>
        <Text style={styles.highScoreName}>{s.name}</Text>
        <Text style={styles.highScoreMatch}>{s.match}</Text>
        <Text style={styles.highScoreDetail}>{s.detail}</Text>
      </View>
    </View>
  </View>
);

/* ─── main component ─── */
const LeaderboardScreen = ({ route }) => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { tournamentId } = route.params;

  const [activeTab, setActiveTab] = useState('Batting');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Real data state — falls back to placeholder samples on error
  const [mvp, setMvp] = useState(SAMPLE_MVP);
  const [orangeCap, setOrangeCap] = useState(SAMPLE_ORANGE_CAP);
  const [purpleCap, setPurpleCap] = useState(SAMPLE_PURPLE_CAP);
  const [highestScore, setHighestScore] = useState(SAMPLE_HIGHEST_SCORE);
  const [fielders, setFielders] = useState([]);

  const load = async () => {
    try {
      const res = await tournamentsAPI.leaderboard(tournamentId);
      const d = res.data;

      // Map top batsmen → orange cap list
      if (d.top_batsmen && d.top_batsmen.length > 0) {
        setOrangeCap(
          d.top_batsmen.map((b, i) => ({
            rank: i + 1,
            name: b.player_name || b.name,
            team: b.team_name || '',
            runs: b.runs,
            innings: b.innings || 0,
            average: b.average || 0,
            strikeRate: b.strike_rate || (b.balls ? (b.runs / b.balls * 100).toFixed(1) : 0),
            fours: b.fours,
            sixes: b.sixes,
            highest: b.highest || b.runs,
          })),
        );

        // Derive MVP from top batsman
        const top = d.top_batsmen[0];
        setMvp({
          name: top.player_name || top.name,
          team: top.team_name || '',
          points: top.runs,
          impact: top.strike_rate,
        });
      }

      // Map top bowlers → purple cap list
      if (d.top_bowlers && d.top_bowlers.length > 0) {
        setPurpleCap(
          d.top_bowlers.map((b, i) => ({
            rank: i + 1,
            name: b.player_name || b.name,
            team: b.team_name || '',
            wickets: b.wickets,
            innings: b.innings || 0,
            overs: b.overs,
            runsConceded: b.runs_conceded,
            economy: b.economy || 0,
            average: b.average || 0,
            bestWickets: b.best_wickets,
            bestRuns: b.best_runs,
          })),
        );
      }

      // Map fielding stats
      if (d.top_fielders && d.top_fielders.length > 0) {
        setFielders(d.top_fielders.map((f, i) => ({
          rank: i + 1,
          name: f.name || f.player_name,
          catches: f.catches || 0,
          runOuts: f.run_outs || 0,
          stumpings: f.stumpings || 0,
          total: f.total || 0,
        })));
      }

      // Map highest individual score
      if (d.highest_scores && d.highest_scores.length > 0) {
        const hs = d.highest_scores[0];
        setHighestScore({
          score: hs.runs,
          notOut: !hs.is_out,
          name: hs.player_name,
          match: hs.team_name,
          detail: `${hs.runs}${hs.is_out ? '' : '*'}(${hs.balls_faced}) • ${hs.fours} fours, ${hs.sixes} sixes`,
        });
      }
    } catch {
      // keep placeholder data on error
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      const task = InteractionManager.runAfterInteractions(() => {
        load();
      });
      return () => task.cancel();
    }, [tournamentId]),
  );

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const handleBack = () => navigation.goBack();
  const handleShare = async () => {
    try {
      const { getTournamentLink } = require('../../services/linking');
      const link = getTournamentLink(tournamentId);
      await Share.share({
        message: `Check out the leaderboard on CrecKStars\n${link}`,
        url: link,
      });
    } catch (_) {}
  };

  /* ─── loading state ─── */
  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Header insets={insets} onBack={handleBack} onShare={handleShare} />
        <View style={{ padding: 16 }}>
          <Skeleton width="40%" height={12} style={{ marginBottom: 10 }} />
          <Skeleton width="100%" height={160} borderRadius={16} style={{ marginBottom: 24 }} />
          {[1,2,3,4,5].map(i => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10 }}>
              <Skeleton width={24} height={24} borderRadius={12} />
              <Skeleton width={38} height={38} borderRadius={19} />
              <View style={{ flex: 1 }}>
                <Skeleton width="60%" height={14} />
                <Skeleton width="30%" height={10} style={{ marginTop: 4 }} />
              </View>
              <Skeleton width={40} height={18} />
            </View>
          ))}
        </View>
      </View>
    );
  }

  /* ─── main render ─── */
  return (
    <View style={styles.container}>
      <Header insets={insets} onBack={handleBack} onShare={handleShare} />
      <TabBar active={activeTab} onChange={setActiveTab} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.ACCENT}
            colors={[COLORS.ACCENT]}
          />
        }
      >
        {/* Batting Tab */}
        {activeTab === 'Batting' && (
          <>
            <SectionTitle icon="🏏" color={ORANGE} title="Orange Cap - Most Runs" />
            <View style={styles.rankCard}>
              {orangeCap.map((item) => (
                <RankRow key={item.rank} item={item} isFirst={item.rank === 1} accentColor={ORANGE} tintColor={ORANGE_TINT} statLabel="RUNS" statKey="runs" />
              ))}
            </View>
            <HighestScoreCard data={highestScore} />
          </>
        )}

        {/* Bowling Tab */}
        {activeTab === 'Bowling' && (
          <>
            <SectionTitle icon="🎯" color={PURPLE} title="Purple Cap - Most Wickets" />
            <View style={styles.rankCard}>
              {purpleCap.map((item) => (
                <RankRow key={item.rank} item={item} isFirst={item.rank === 1} accentColor={PURPLE} tintColor={PURPLE_TINT} statLabel="WKTS" statKey="wickets" />
              ))}
            </View>
          </>
        )}

        {/* Fielding Tab */}
        {activeTab === 'Fielding' && (
          <>
            <SectionTitle icon="🧤" color="#22C55E" title="Best Fielders - Most Catches" />
            {fielders.length > 0 ? (
              <View style={styles.rankCard}>
                {fielders.map((item) => (
                  <View
                    key={item.rank}
                    style={[styles.rankRow, item.rank === 1 && { backgroundColor: 'rgba(34,197,94,0.12)', borderLeftWidth: 4, borderLeftColor: COLORS.SUCCESS_LIGHT }]}
                  >
                    <Text style={[styles.rankNum, item.rank === 1 && { color: COLORS.SUCCESS_LIGHT, fontWeight: '700' }]}>{item.rank}</Text>
                    <View style={[styles.rankAvatar, item.rank === 1 && { borderColor: COLORS.SUCCESS_LIGHT }]}>
                      <Text style={styles.rankAvatarText}>{item.name.charAt(0)}</Text>
                    </View>
                    <View style={styles.rankInfo}>
                      <Text style={styles.rankName}>{item.name}</Text>
                      <Text style={styles.rankTeam}>{item.catches}c · {item.runOuts}ro · {item.stumpings}st</Text>
                    </View>
                    <View style={styles.rankStatWrap}>
                      <Text style={[styles.rankStatValue, item.rank === 1 && { color: COLORS.SUCCESS_LIGHT }]}>{item.total}</Text>
                      <Text style={styles.rankStatLabel}>TOTAL</Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.emptyTab}>
                <Text style={styles.emptyTabText}>No fielding data yet</Text>
              </View>
            )}
          </>
        )}

        <View style={{ height: insets.bottom + 24 }} />
      </ScrollView>
    </View>
  );
};

/* ─── styles ─── */
const styles = StyleSheet.create({
  /* container */
  container: {
    flex: 1,
    backgroundColor: COLORS.BG,
  },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 24 },
  emptyTab: { alignItems: 'center', paddingVertical: 60 },
  emptyTabText: { fontSize: 14, color: COLORS.TEXT_MUTED },

  /* header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: COLORS.CARD,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER,
  },
  headerBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backArrow: { fontSize: 28, color: COLORS.TEXT, fontWeight: '300', marginTop: -2 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: COLORS.TEXT },
  shareIcon: { fontSize: 20, color: COLORS.TEXT },

  /* tabs */
  tabBar: {
    backgroundColor: COLORS.CARD,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER,
  },
  tabBarContent: {
    paddingHorizontal: 16,
    gap: 24,
  },
  tab: {
    paddingVertical: 12,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: COLORS.ACCENT,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.TEXT_MUTED,
  },
  tabTextActive: {
    color: COLORS.TEXT,
  },

  /* section label */
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.TEXT_MUTED,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },

  /* MVP card */
  mvpOuter: {
    borderRadius: 16,
    padding: 2,
    backgroundColor: COLORS.ACCENT,
    marginBottom: 24,
  },
  mvpInner: {
    backgroundColor: COLORS.CARD,
    borderRadius: 14,
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  mvpAvatarWrap: {
    marginBottom: 10,
    position: 'relative',
  },
  mvpAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: COLORS.ACCENT,
    backgroundColor: COLORS.ACCENT_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mvpAvatarText: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.ACCENT,
  },
  mvpStarBadge: {
    position: 'absolute',
    bottom: 0,
    right: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.GOLD,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.CARD,
  },
  mvpStarText: { fontSize: 12, color: COLORS.CARD },
  mvpName: { fontSize: 18, fontWeight: '700', color: COLORS.TEXT },
  mvpTeam: { fontSize: 13, color: COLORS.TEXT_MUTED, marginTop: 2 },
  topSeedBadge: {
    backgroundColor: COLORS.ACCENT,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 4,
    marginTop: 10,
  },
  topSeedText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.WHITE,
    letterSpacing: 1,
  },
  mvpStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    width: '100%',
    justifyContent: 'center',
  },
  mvpStatItem: { alignItems: 'center', paddingHorizontal: 24 },
  mvpStatValue: { fontSize: 22, fontWeight: '800', color: COLORS.TEXT },
  mvpStatLabel: { fontSize: 12, color: COLORS.TEXT_MUTED, marginTop: 2 },
  mvpStatDivider: {
    width: 1,
    height: 32,
    backgroundColor: COLORS.BORDER,
  },

  /* section title */
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  medalIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  medalText: { fontSize: 14 },
  sectionTitleText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.TEXT,
  },

  /* rank card */
  rankCard: {
    backgroundColor: COLORS.CARD,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER,
  },
  rankNum: {
    width: 24,
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.TEXT_MUTED,
    textAlign: 'center',
  },
  rankAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1.5,
    borderColor: COLORS.BORDER,
    backgroundColor: COLORS.SURFACE,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  rankAvatarText: { fontSize: 14, fontWeight: '600', color: COLORS.TEXT_MUTED },
  rankInfo: { flex: 1, marginLeft: 10 },
  rankName: { fontSize: 14, fontWeight: '600', color: COLORS.TEXT },
  rankTeam: { fontSize: 12, color: COLORS.TEXT_MUTED, marginTop: 1 },
  rankStatWrap: { alignItems: 'flex-end' },
  rankStatValue: { fontSize: 16, fontWeight: '800', color: COLORS.TEXT },
  rankStatLabel: { fontSize: 10, fontWeight: '600', color: COLORS.TEXT_MUTED, letterSpacing: 0.5 },

  /* highest score */
  highScoreSection: {
    backgroundColor: COLORS.CARD_ELEVATED,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  highScoreTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.TEXT,
    marginBottom: 12,
  },
  highScoreCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.CARD,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  highScoreLeft: {
    backgroundColor: COLORS.ACCENT,
    paddingVertical: 16,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  highScoreBox: {},
  highScoreValue: {
    fontSize: 28,
    fontWeight: '900',
    color: COLORS.WHITE,
  },
  highScoreRight: {
    flex: 1,
    padding: 14,
    justifyContent: 'center',
  },
  highScoreName: { fontSize: 15, fontWeight: '700', color: COLORS.TEXT },
  highScoreMatch: { fontSize: 12, color: COLORS.TEXT_MUTED, marginTop: 3 },
  highScoreDetail: { fontSize: 12, color: COLORS.TEXT_MUTED, marginTop: 2 },

  /* loading */
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: COLORS.TEXT_MUTED,
  },
});

export default LeaderboardScreen;
