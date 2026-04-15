import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, InteractionManager, TouchableOpacity, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../context/AuthContext';
import { useAuthGate } from '../../hooks/useRequireAuth';
import { usersAPI } from '../../services/api';
import { COLORS } from '../../theme';
import BackButton from '../../components/BackButton';
import Avatar from '../../components/Avatar';
import Skeleton from '../../components/Skeleton';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const MyStatsScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  useAuthGate('view your stats');
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState(null);
  const [activeTab, setActiveTab] = useState('organized'); // 'organized' | 'played'

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => loadStats());
    return () => task.cancel();
  }, []);

  const loadStats = async () => {
    try {
      const res = await usersAPI.myStats();
      setStats(res.data || null);
    } catch {
      setStats(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadStats();
  };

  if (loading) {
    return (
      <View style={[s.container, { paddingTop: insets.top }]}>
        <View style={s.header}>
          <BackButton onPress={() => navigation.goBack()} />
          <Text style={s.headerTitle}>My Stats</Text>
          <View style={{ width: 36 }} />
        </View>
        <View style={{ padding: 16, alignItems: 'center' }}>
          <Skeleton width={80} height={80} borderRadius={40} />
          <Skeleton width={140} height={18} style={{ marginTop: 14 }} />
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 20, width: '100%' }}>
            {[1,2].map(i => <Skeleton key={i} width="48%" height={120} borderRadius={16} />)}
          </View>
        </View>
      </View>
    );
  }

  const c = stats?.created || {};
  const p = stats?.played || {};
  const t = stats?.total || {};

  // Hero headline — use backend-deduplicated totals (a match you organized AND played = 1, not 2)
  const totalTouched = t.matches ?? ((c.matches || 0) + (p.matches || 0));
  const totalTournaments = t.tournaments ?? ((c.tournaments || 0) + (p.tournaments || 0));
  const totalTeams = t.teams ?? ((c.teams || 0) + (p.teams || 0));

  // === Organized primary cards — unified theme ===
  const organizedPrimary = [
    {
      label: 'Matches',
      value: c.matches || 0,
      icon: 'cricket',
      sub: `${c.matches_completed || 0} completed`,
      nav: 'MyMatches',
      params: { mode: 'created' },
    },
    {
      label: 'Tournaments',
      value: c.tournaments || 0,
      icon: 'trophy',
      sub: `${c.tournaments_completed || 0} completed`,
      nav: 'MyTournaments',
      params: { mode: 'created' },
    },
  ];

  const organizedSecondary = [
    { label: 'Teams Created', value: c.teams || 0, icon: 'account-group', nav: 'MyTeams', params: { mode: 'created' } },
    { label: 'Live Now', value: c.matches_live || 0, icon: 'broadcast', live: true, nav: 'MyMatches', params: { mode: 'created', status: 'live' } },
    { label: 'Upcoming', value: c.matches_upcoming || 0, icon: 'clock-outline', nav: 'MyMatches', params: { mode: 'created', status: 'upcoming' } },
    { label: 'Completed', value: c.matches_completed || 0, icon: 'check-circle', nav: 'MyMatches', params: { mode: 'created', status: 'completed' } },
  ];

  // === Played primary cards ===
  const playedPrimary = [
    {
      label: 'Matches',
      value: p.matches || 0,
      icon: 'cricket',
      sub: `${p.matches_completed || 0} completed`,
      nav: 'MyMatches',
      params: { mode: 'played' },
    },
    {
      label: 'Tournaments',
      value: p.tournaments || 0,
      icon: 'trophy',
      sub: `${p.teams || 0} teams`,
      nav: 'MyTournaments',
      params: { mode: 'played' },
    },
  ];

  const playedSecondary = [
    { label: 'Teams Joined', value: p.teams || 0, icon: 'account-group', nav: 'MyTeams', params: { mode: 'played' } },
    { label: 'Live Now', value: p.matches_live || 0, icon: 'broadcast', live: true, nav: 'MyMatches', params: { mode: 'played', status: 'live' } },
    { label: 'Completed', value: p.matches_completed || 0, icon: 'check-circle', nav: 'MyMatches', params: { mode: 'played', status: 'completed' } },
  ];

  const activePrimary = activeTab === 'organized' ? organizedPrimary : playedPrimary;
  const activeSecondary = activeTab === 'organized' ? organizedSecondary : playedSecondary;

  // Progress breakdown — reflects active tab
  const activeData = activeTab === 'organized' ? c : p;
  const totalMatches = activeData.matches || 0;
  const completedCount = activeData.matches_completed || 0;
  const liveCount = activeData.matches_live || 0;
  const upcomingCount = activeData.matches_upcoming || 0; // played doesn't have upcoming — will be 0
  const completionRate = totalMatches > 0 ? Math.round((completedCount / totalMatches) * 100) : 0;
  const livePct = totalMatches > 0 ? Math.round((liveCount / totalMatches) * 100) : 0;
  const upcomingPct = totalMatches > 0 ? Math.round((upcomingCount / totalMatches) * 100) : 0;

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text style={s.headerTitle}>My Stats</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.ACCENT} />}
      >
        {/* === HERO: Profile + Key highlight === */}
        <LinearGradient
          colors={['#1E293B', '#0F172A']}
          style={s.hero}
        >
          <Avatar
            uri={user?.profile}
            name={user?.full_name || user?.first_name}
            size={76}
            color={COLORS.ACCENT}
            showRing
          />
          <Text style={s.heroName}>{user?.full_name || `${user?.first_name || ''} ${user?.last_name || ''}`.trim()}</Text>
          {user?.username && <Text style={s.heroUsername}>@{user.username}</Text>}

          {/* Highlight summary pill row */}
          <View style={s.heroHighlights}>
            <View style={s.heroHighlightItem}>
              <Text style={s.heroHighlightValue}>{totalTouched}</Text>
              <Text style={s.heroHighlightLabel}>Matches</Text>
            </View>
            <View style={s.heroHighlightDivider} />
            <View style={s.heroHighlightItem}>
              <Text style={s.heroHighlightValue}>{totalTournaments}</Text>
              <Text style={s.heroHighlightLabel}>Tournaments</Text>
            </View>
            <View style={s.heroHighlightDivider} />
            <View style={s.heroHighlightItem}>
              <Text style={s.heroHighlightValue}>{totalTeams}</Text>
              <Text style={s.heroHighlightLabel}>Teams</Text>
            </View>
          </View>
        </LinearGradient>

        {/* === TAB TOGGLE (Organized / Played) === */}
        <View style={s.tabRow}>
          <TouchableOpacity
            style={[s.tabBtn, activeTab === 'organized' && s.tabBtnActive]}
            onPress={() => setActiveTab('organized')}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons
              name="clipboard-edit-outline"
              size={16}
              color={activeTab === 'organized' ? '#fff' : COLORS.TEXT_MUTED}
            />
            <Text style={[s.tabBtnText, activeTab === 'organized' && s.tabBtnTextActive]}>Organized</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.tabBtn, activeTab === 'played' && s.tabBtnActive]}
            onPress={() => setActiveTab('played')}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons
              name="cricket"
              size={16}
              color={activeTab === 'played' ? '#fff' : COLORS.TEXT_MUTED}
            />
            <Text style={[s.tabBtnText, activeTab === 'played' && s.tabBtnTextActive]}>Played</Text>
          </TouchableOpacity>
        </View>

        {/* === PRIMARY CARDS (2 clean theme cards) === */}
        <View style={s.primaryRow}>
          {activePrimary.map((card, i) => (
            <TouchableOpacity
              key={i}
              activeOpacity={0.8}
              onPress={card.nav ? () => navigation.navigate(card.nav, card.params || {}) : undefined}
              style={s.primaryCard}
            >
              <View style={s.primaryTopRow}>
                <View style={s.primaryIconWrap}>
                  <MaterialCommunityIcons name={card.icon} size={20} color={COLORS.ACCENT} />
                </View>
                <MaterialCommunityIcons name="chevron-right" size={18} color={COLORS.TEXT_MUTED} />
              </View>
              <Text style={s.primaryValue}>{card.value}</Text>
              <Text style={s.primaryLabel}>{card.label}</Text>
              {card.sub ? <Text style={s.primarySub}>{card.sub}</Text> : null}
            </TouchableOpacity>
          ))}
        </View>

        {/* === SECONDARY STATS (compact row list) === */}
        <View style={s.secondaryCard}>
          {activeSecondary.map((card, i) => {
            const iconColor = card.live ? COLORS.LIVE : COLORS.ACCENT;
            const valueColor = card.live && card.value > 0 ? COLORS.LIVE : COLORS.TEXT;
            return (
              <TouchableOpacity
                key={i}
                style={[
                  s.secondaryRow,
                  i === activeSecondary.length - 1 && { borderBottomWidth: 0 },
                ]}
                activeOpacity={0.7}
                onPress={card.nav ? () => navigation.navigate(card.nav, card.params || {}) : undefined}
              >
                <View style={[s.secondaryIconWrap, card.live && { backgroundColor: COLORS.LIVE_BG }]}>
                  <MaterialCommunityIcons name={card.icon} size={18} color={iconColor} />
                </View>
                <Text style={s.secondaryLabel}>{card.label}</Text>
                <View style={s.secondaryRight}>
                  <Text style={[s.secondaryValue, { color: valueColor }]}>{card.value}</Text>
                  {card.nav && <MaterialCommunityIcons name="chevron-right" size={18} color={COLORS.TEXT_MUTED} />}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* === COMPLETION PROGRESS (per active tab) === */}
        {totalMatches > 0 && (
          <View style={s.progressCard}>
            <View style={s.progressHeadRow}>
              <View style={s.progressIconWrap}>
                <MaterialCommunityIcons name="chart-arc" size={16} color={COLORS.ACCENT} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.progressTitle}>Match Progress</Text>
                <Text style={s.progressSub}>{completionRate}% of {totalMatches} completed</Text>
              </View>
              <Text style={s.progressPct}>{completionRate}%</Text>
            </View>

            {/* Segmented bar */}
            <View style={s.progressBar}>
              {completionRate > 0 && <View style={[s.progressSegment, { width: `${completionRate}%`, backgroundColor: COLORS.ACCENT }]} />}
              {livePct > 0 && <View style={[s.progressSegment, { width: `${livePct}%`, backgroundColor: COLORS.LIVE }]} />}
              {upcomingPct > 0 && <View style={[s.progressSegment, { width: `${upcomingPct}%`, backgroundColor: COLORS.BORDER_LIGHT }]} />}
            </View>

            {/* Legend */}
            <View style={s.progressLegend}>
              <View style={s.legendItem}>
                <View style={[s.legendDot, { backgroundColor: COLORS.ACCENT }]} />
                <Text style={s.legendText}>{completedCount} done</Text>
              </View>
              <View style={s.legendItem}>
                <View style={[s.legendDot, { backgroundColor: COLORS.LIVE }]} />
                <Text style={s.legendText}>{liveCount} live</Text>
              </View>
              <View style={s.legendItem}>
                <View style={[s.legendDot, { backgroundColor: COLORS.BORDER_LIGHT }]} />
                <Text style={s.legendText}>{upcomingCount} upcoming</Text>
              </View>
            </View>
          </View>
        )}

        {!stats && (
          <View style={{ alignItems: 'center', paddingVertical: 40 }}>
            <MaterialCommunityIcons name="chart-bar" size={48} color={COLORS.TEXT_MUTED} />
            <Text style={{ fontSize: 14, color: COLORS.TEXT_SECONDARY, marginTop: 8 }}>Could not load stats</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.BG },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 12, backgroundColor: COLORS.CARD,
    borderBottomWidth: 1, borderBottomColor: COLORS.BORDER,
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: COLORS.TEXT },
  content: { paddingBottom: 40 },

  // Hero (gradient)
  hero: {
    paddingHorizontal: 24, paddingTop: 24, paddingBottom: 20,
    alignItems: 'center',
  },
  heroName: { fontSize: 20, fontWeight: '800', color: '#fff', marginTop: 12 },
  heroUsername: { fontSize: 13, fontWeight: '600', color: COLORS.ACCENT_LIGHT, marginTop: 2 },

  heroHighlights: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    paddingVertical: 12, paddingHorizontal: 8,
    marginTop: 18,
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  heroHighlightItem: { flex: 1, alignItems: 'center' },
  heroHighlightValue: { fontSize: 22, fontWeight: '900', color: '#fff', letterSpacing: -0.5 },
  heroHighlightLabel: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 },
  heroHighlightDivider: { width: 1, height: 32, backgroundColor: 'rgba(255,255,255,0.15)' },

  // Tab toggle
  tabRow: {
    flexDirection: 'row', marginHorizontal: 16, marginTop: 16,
    backgroundColor: COLORS.CARD, borderRadius: 14, padding: 4,
    borderWidth: 1, borderColor: COLORS.BORDER,
  },
  tabBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 11, borderRadius: 10,
  },
  tabBtnActive: { backgroundColor: COLORS.ACCENT },
  tabBtnText: { fontSize: 13, fontWeight: '700', color: COLORS.TEXT_MUTED },
  tabBtnTextActive: { color: '#fff' },

  // Primary cards (unified theme)
  primaryRow: { flexDirection: 'row', gap: 12, marginHorizontal: 16, marginTop: 14 },
  primaryCard: {
    flex: 1, borderRadius: 18, padding: 16, minHeight: 140, justifyContent: 'space-between',
    backgroundColor: COLORS.CARD, borderWidth: 1, borderColor: COLORS.BORDER,
  },
  primaryTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  primaryIconWrap: {
    width: 38, height: 38, borderRadius: 11,
    backgroundColor: COLORS.ACCENT_SOFT,
    alignItems: 'center', justifyContent: 'center',
  },
  primaryValue: { fontSize: 34, fontWeight: '900', color: COLORS.TEXT, letterSpacing: -1, marginTop: 8 },
  primaryLabel: { fontSize: 12, fontWeight: '700', color: COLORS.TEXT_SECONDARY, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 },
  primarySub: { fontSize: 11, fontWeight: '500', color: COLORS.TEXT_MUTED, marginTop: 4 },

  // Secondary card (row list)
  secondaryCard: {
    backgroundColor: COLORS.CARD, borderRadius: 16, marginHorizontal: 16, marginTop: 14,
    borderWidth: 1, borderColor: COLORS.BORDER, overflow: 'hidden',
  },
  secondaryRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 14, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: COLORS.BORDER,
  },
  secondaryIconWrap: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: COLORS.ACCENT_SOFT,
    alignItems: 'center', justifyContent: 'center',
  },
  secondaryLabel: { flex: 1, fontSize: 14, fontWeight: '600', color: COLORS.TEXT },
  secondaryRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  secondaryValue: { fontSize: 20, fontWeight: '900', letterSpacing: -0.3 },

  // Progress
  progressCard: {
    backgroundColor: COLORS.CARD, borderRadius: 16, padding: 16,
    marginHorizontal: 16, marginTop: 14,
    borderWidth: 1, borderColor: COLORS.BORDER,
  },
  progressHeadRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  progressIconWrap: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: COLORS.ACCENT_SOFT,
    alignItems: 'center', justifyContent: 'center',
  },
  progressTitle: { fontSize: 14, fontWeight: '700', color: COLORS.TEXT },
  progressSub: { fontSize: 12, color: COLORS.TEXT_MUTED, marginTop: 1 },
  progressPct: { fontSize: 22, fontWeight: '900', color: COLORS.ACCENT },
  progressBar: { height: 10, backgroundColor: COLORS.SURFACE, borderRadius: 5, overflow: 'hidden', flexDirection: 'row' },
  progressSegment: { height: 10 },
  progressLegend: { flexDirection: 'row', gap: 14, marginTop: 12, flexWrap: 'wrap' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, color: COLORS.TEXT_SECONDARY, fontWeight: '500' },
});

export default MyStatsScreen;
