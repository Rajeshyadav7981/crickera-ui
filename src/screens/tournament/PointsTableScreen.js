import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator, InteractionManager } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tournamentsAPI } from '../../services/api';
import { COLORS } from '../../theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Skeleton from '../../components/Skeleton';

const QUALIFY_BG = COLORS.ACCENT_SOFT;
const QUALIFY_BORDER = COLORS.ACCENT_SOFT_BORDER;

const STAGE_TABS = ['League Stage', 'Playoffs'];

/* ─── placeholder data ─── */
const PLACEHOLDER_STANDINGS = [
  { rank: 1, team: 'Mumbai Indians', short: 'MI', played: 14, won: 11, lost: 3, nrr: '+1.107', pts: 22, qualifying: true },
  { rank: 2, team: 'Gujarat Titans', short: 'GT', played: 14, won: 10, lost: 4, nrr: '+0.809', pts: 20, qualifying: true },
  { rank: 3, team: 'Chennai Super Kings', short: 'CSK', played: 14, won: 9, lost: 5, nrr: '+0.652', pts: 18, qualifying: true },
  { rank: 4, team: 'Rajasthan Royals', short: 'RR', played: 14, won: 8, lost: 6, nrr: '+0.304', pts: 16, qualifying: false },
  { rank: 5, team: 'Royal Challengers', short: 'RCB', played: 14, won: 7, lost: 7, nrr: '-0.145', pts: 14, qualifying: false },
  { rank: 6, team: 'Kolkata Knight Riders', short: 'KKR', played: 14, won: 6, lost: 8, nrr: '-0.320', pts: 12, qualifying: false },
  { rank: 7, team: 'Delhi Capitals', short: 'DC', played: 14, won: 5, lost: 9, nrr: '-0.562', pts: 10, qualifying: false },
  { rank: 8, team: 'Sunrisers Hyderabad', short: 'SRH', played: 14, won: 4, lost: 10, nrr: '-0.891', pts: 8, qualifying: false },
  { rank: 9, team: 'Punjab Kings', short: 'PBKS', played: 14, won: 3, lost: 11, nrr: '-1.023', pts: 6, qualifying: false },
  { rank: 10, team: 'Lucknow Super Giants', short: 'LSG', played: 14, won: 2, lost: 12, nrr: '-1.245', pts: 4, qualifying: false },
];

const QUALIFYING_COUNT = 3;

const PointsTableScreen = ({ route }) => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { tournamentId } = route.params;

  const [activeTab, setActiveTab] = useState('League Stage');
  const [standings, setStandings] = useState(PLACEHOLDER_STANDINGS);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const res = await tournamentsAPI.standings(tournamentId);
      const apiData = res.data;
      if (apiData && apiData.length > 0) {
        const mapped = apiData.map((item, index) => ({
          rank: index + 1,
          team: item.team_name,
          short: item.short_name,
          color: item.color,
          played: item.played,
          won: item.won,
          lost: item.lost,
          drawn: item.drawn,
          nrr: item.nrr,
          pts: item.points,
          qualifying: item.qualifying,
        }));
        setStandings(mapped);
      } else {
        setStandings(PLACEHOLDER_STANDINGS);
      }
    } catch (_) {
      // Use placeholder data if API is not available
      setStandings(PLACEHOLDER_STANDINGS);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      const task = InteractionManager.runAfterInteractions(() => {
        load();
      });
      return () => task.cancel();
    }, [tournamentId]),
  );

  const handleRefresh = () => {
    setRefreshing(true);
    load();
  };

  /* ─── Header ─── */
  const renderHeader = () => (
    <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
      <TouchableOpacity
        onPress={() => navigation.goBack()}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        style={styles.headerBtn}
      >
        <Text style={styles.headerIcon}>{'<'}</Text>
      </TouchableOpacity>
      <Text style={styles.headerTitle}>Tournament Stages</Text>
      <TouchableOpacity
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        style={styles.headerBtn}
      >
        <Text style={styles.headerIcon}>{'...'}</Text>
      </TouchableOpacity>
    </View>
  );

  /* ─── Stage Tabs ─── */
  const renderTabs = () => (
    <View style={styles.tabBar}>
      {STAGE_TABS.map((tab) => {
        const active = activeTab === tab;
        return (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, active && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, active && styles.tabTextActive]}>{tab}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  /* ─── Title Row ─── */
  const renderTitleRow = () => (
    <View style={styles.titleRow}>
      <Text style={styles.pointsTitle}>Points Table</Text>
      <View style={styles.seasonBadge}>
        <Text style={styles.seasonText}>Season 2024</Text>
      </View>
    </View>
  );

  /* ─── Table Header ─── */
  const renderTableHeader = () => (
    <View style={styles.tableHeader}>
      <Text style={[styles.colLabel, styles.colTeam]}>TEAM</Text>
      <Text style={[styles.colLabel, styles.colStat]}>P</Text>
      <Text style={[styles.colLabel, styles.colStat]}>W</Text>
      <Text style={[styles.colLabel, styles.colStat]}>L</Text>
      <Text style={[styles.colLabel, styles.colNrr]}>NRR</Text>
      <Text style={[styles.colLabel, styles.colPts]}>PTS</Text>
    </View>
  );

  /* ─── Team Row ─── */
  const renderTeamRow = (item, index) => {
    const qualifying = item.qualifying !== undefined ? item.qualifying : index < QUALIFYING_COUNT;
    const isLastQualifying = qualifying && (
      index === standings.length - 1 ||
      (standings[index + 1] && !(standings[index + 1].qualifying !== undefined ? standings[index + 1].qualifying : (index + 1) < QUALIFYING_COUNT))
    );
    const nrrValue = typeof item.nrr === 'string' ? item.nrr : (item.nrr >= 0 ? `+${item.nrr.toFixed(3)}` : item.nrr.toFixed(3));
    const nrrPositive = typeof item.nrr === 'string' ? item.nrr.startsWith('+') : item.nrr >= 0;

    return (
      <View key={item.rank || index}>
        <View style={[styles.teamRow, qualifying && styles.teamRowQualifying, index % 2 === 1 && styles.teamRowAlt]}>
          {/* Rank circle */}
          <View style={[styles.rankCircle, qualifying ? styles.rankCircleAccent : styles.rankCircleGray]}>
            <Text style={[styles.rankText, qualifying ? styles.rankTextAccent : styles.rankTextGray]}>
              {item.rank || index + 1}
            </Text>
          </View>

          {/* Team name */}
          <View style={styles.teamNameCol}>
            <Text style={styles.teamName} numberOfLines={1}>
              {item.short || item.team}
            </Text>
            {item.rank === 1 && (
              <MaterialCommunityIcons name="check" size={12} color={COLORS.ACCENT} style={{ marginLeft: 4 }} />
            )}
          </View>

          {/* Stats */}
          <Text style={[styles.colValue, styles.colStat]}>{item.played}</Text>
          <Text style={[styles.colValue, styles.colStat]}>{item.won}</Text>
          <Text style={[styles.colValue, styles.colStat]}>{item.lost}</Text>
          <Text style={[styles.colValue, styles.colNrr, nrrPositive ? styles.nrrPositive : styles.nrrNegative]}>
            {nrrValue}
          </Text>
          <Text style={[styles.colValue, styles.colPts, styles.ptsValue]}>{item.pts}</Text>
        </View>

        {/* Separator between qualifying and non-qualifying */}
        {isLastQualifying && <View style={styles.qualifySeparator} />}
      </View>
    );
  };

  /* ─── Legend ─── */
  const renderLegend = () => (
    <View style={styles.legendRow}>
      <View style={styles.legendDot} />
      <Text style={styles.legendText}>Top 3 teams qualify for Playoffs</Text>
    </View>
  );

  /* ─── Points Table Card ─── */
  const renderPointsTable = () => (
    <View style={styles.tableCard}>
      {renderTableHeader()}
      {standings.map((item, index) => renderTeamRow(item, index))}
      {renderLegend()}
    </View>
  );

  /* ─── Promotion Card ─── */
  const renderPromotionCard = () => (
    <View style={styles.promoCard}>
      <View style={styles.promoTopRow}>
        <View style={styles.liveBadge}>
          <View style={styles.liveDot} />
          <Text style={styles.liveBadgeText}>Live Update</Text>
        </View>
      </View>
      <Text style={styles.promoTitle}>Next Match</Text>
      <Text style={styles.promoSubtitle}>MI vs CSK - Today, 7:30 PM</Text>
      <TouchableOpacity style={styles.reminderBtn}>
        <Text style={styles.reminderBtnText}>Set Reminder</Text>
      </TouchableOpacity>
    </View>
  );

  /* ─── Loading State ─── */
  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {renderHeader()}
        <View style={{ padding: 16 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
            <Skeleton width={120} height={20} />
            <Skeleton width={80} height={20} borderRadius={12} />
          </View>
          <View style={{ backgroundColor: COLORS.CARD, borderRadius: 16, borderWidth: 1, borderColor: COLORS.BORDER, overflow: 'hidden' }}>
            <View style={{ flexDirection: 'row', padding: 10, backgroundColor: COLORS.SURFACE }}>
              <Skeleton width="30%" height={10} />
              <Skeleton width="10%" height={10} />
              <Skeleton width="10%" height={10} />
              <Skeleton width="10%" height={10} />
              <Skeleton width="15%" height={10} />
              <Skeleton width="10%" height={10} />
            </View>
            {[1,2,3,4,5,6,7,8].map(i => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', padding: 10, gap: 8 }}>
                <Skeleton width={24} height={24} borderRadius={12} />
                <Skeleton width="25%" height={14} />
                <Skeleton width="8%" height={14} />
                <Skeleton width="8%" height={14} />
                <Skeleton width="8%" height={14} />
                <Skeleton width="15%" height={14} />
                <Skeleton width="10%" height={14} />
              </View>
            ))}
          </View>
        </View>
      </View>
    );
  }

  /* ─── Main Render ─── */
  return (
    <View style={[styles.container, { paddingTop: 0 }]}>
      {renderHeader()}
      {renderTabs()}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={COLORS.ACCENT}
          />
        }
      >
        {renderTitleRow()}

        {activeTab === 'League Stage' ? (
          <>
            {renderPointsTable()}
            {renderPromotionCard()}
          </>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Playoffs bracket will appear once the league stage is complete</Text>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
};

/* ─────────────────────── STYLES ─────────────────────── */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BG,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },

  /* ── header ── */
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
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerIcon: {
    fontSize: 20,
    color: COLORS.TEXT,
    fontWeight: '600',
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.TEXT,
    textAlign: 'center',
    marginHorizontal: 8,
  },

  /* ── tab bar ── */
  tabBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.CARD,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: COLORS.ACCENT,
  },
  tabText: {
    fontSize: 14,
    color: COLORS.TEXT_MUTED,
    fontWeight: '500',
  },
  tabTextActive: {
    color: COLORS.TEXT,
    fontWeight: '700',
  },

  /* ── title row ── */
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 12,
  },
  pointsTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.TEXT,
  },
  seasonBadge: {
    backgroundColor: COLORS.SURFACE,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  seasonText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.TEXT_SECONDARY,
  },

  /* ── table card ── */
  tableCard: {
    marginHorizontal: 16,
    backgroundColor: COLORS.CARD,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },

  /* ── table header ── */
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.SURFACE,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER,
  },
  colLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.TEXT_MUTED,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  colTeam: {
    flex: 1,
    paddingLeft: 36,
  },
  colStat: {
    width: 28,
    textAlign: 'center',
  },
  colNrr: {
    width: 52,
    textAlign: 'center',
  },
  colPts: {
    width: 34,
    textAlign: 'right',
    paddingRight: 4,
  },

  /* ── team row ── */
  teamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER,
    backgroundColor: COLORS.CARD,
  },
  teamRowAlt: {
    backgroundColor: '#1F1F1F',
  },
  teamRowQualifying: {
    backgroundColor: QUALIFY_BG,
  },

  /* ── rank circle ── */
  rankCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  rankCircleAccent: {
    backgroundColor: COLORS.ACCENT_SOFT,
  },
  rankCircleGray: {
    backgroundColor: COLORS.SURFACE,
  },
  rankText: {
    fontSize: 11,
    fontWeight: '700',
  },
  rankTextAccent: {
    color: COLORS.ACCENT,
  },
  rankTextGray: {
    color: COLORS.TEXT_MUTED,
  },

  /* ── team name ── */
  teamNameCol: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  teamName: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.TEXT,
  },
  checkIcon: {
    fontSize: 12,
    color: COLORS.ACCENT,
    fontWeight: '700',
  },

  /* ── stat values ── */
  colValue: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.TEXT_SECONDARY,
    textAlign: 'center',
  },
  nrrPositive: {
    color: COLORS.SUCCESS,
  },
  nrrNegative: {
    color: '#DC2626',
  },
  ptsValue: {
    fontWeight: '700',
    color: COLORS.TEXT,
    textAlign: 'right',
    paddingRight: 4,
  },

  /* ── qualify separator ── */
  qualifySeparator: {
    height: 2,
    backgroundColor: QUALIFY_BORDER,
    marginHorizontal: 12,
  },

  /* ── legend ── */
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.BORDER,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.ACCENT,
    marginRight: 8,
  },
  legendText: {
    fontSize: 11,
    color: COLORS.TEXT_MUTED,
    fontWeight: '500',
  },

  /* ── promotion card ── */
  promoCard: {
    marginHorizontal: 16,
    marginTop: 20,
    backgroundColor: COLORS.CARD_ELEVATED,
    borderRadius: 16,
    padding: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  promoTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.LIVE_BG,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.LIVE,
    marginRight: 6,
  },
  liveBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.LIVE,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  promoTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.TEXT,
    marginBottom: 4,
  },
  promoSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.TEXT_SECONDARY,
    marginBottom: 16,
  },
  reminderBtn: {
    backgroundColor: COLORS.ACCENT,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  reminderBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },

  /* ── empty state ── */
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
  },
  emptyText: {
    color: COLORS.TEXT_MUTED,
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
});

export default PointsTableScreen;
