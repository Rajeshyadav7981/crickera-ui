import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  RefreshControl, Animated, Dimensions,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, FONTS } from '../theme';
import { useAuth } from '../context/AuthContext';
import { useRequireAuth } from '../hooks/useRequireAuth';
import { useFavoriteMatches, useFavoriteTournaments } from '../hooks/useFavorites';
import MatchCard from '../components/MatchCard';
import TournamentCard from '../components/TournamentCard';

const { width: SCREEN_W } = Dimensions.get('window');

const TABS = [
  { key: 'matches', label: 'Matches', icon: 'cricket' },
  { key: 'tournaments', label: 'Tournaments', icon: 'trophy-outline' },
];

const FavoritesScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { user } = useAuth();
  const requireAuth = useRequireAuth();

  const [activeTab, setActiveTab] = useState('matches');
  const [searchInput, setSearchInput] = useState('');
  const [query, setQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const indicatorAnim = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const t = setTimeout(() => setQuery(searchInput.trim().toLowerCase()), 200);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    Animated.spring(indicatorAnim, {
      toValue: activeTab === 'matches' ? 0 : 1,
      useNativeDriver: true, friction: 9, tension: 80,
    }).start();
  }, [activeTab, indicatorAnim]);

  const matchesQ = useFavoriteMatches();
  const tournamentsQ = useFavoriteTournaments();

  useFocusEffect(
    useCallback(() => {
      if (user?.id) {
        matchesQ.refetch();
        tournamentsQ.refetch();
      }
    }, [user?.id])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([matchesQ.refetch(), tournamentsQ.refetch()]);
    setRefreshing(false);
  }, [matchesQ, tournamentsQ]);

  const matchHaystack = (m) => {
    const dateStr = m.match_date ? (() => {
      try {
        const d = new Date(m.match_date);
        return [
          d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }),
          d.toLocaleDateString('en-US', { day: 'numeric', month: 'long' }),
          String(d.getFullYear()),
        ].join(' ');
      } catch { return ''; }
    })() : null;
    const matchTypeStr = m.match_type ? String(m.match_type).replace(/_/g, ' ') : null;
    return [
      m.name,
      m.team_a_name, m.team_b_name,
      m.match_code,
      m.venue_name,
      m.result_summary,
      m.tournament_name,
      matchTypeStr,
      m.stage_label,
      m.stage_name && String(m.stage_name).replace(/_/g, ' '),
      m.match_number ? `match ${m.match_number}` : null,
      dateStr,
    ].filter(Boolean).map((s) => String(s).toLowerCase());
  };
  const tournamentHaystack = (t) => [
    t.name, t.tournament_code, t.organizer_name, t.tournament_type, t.location, t.venue_name,
  ].filter(Boolean).map((s) => String(s).toLowerCase());

  const filteredMatches = useMemo(() => {
    const items = matchesQ.data || [];
    const sorted = [...items].sort((a, b) => {
      const ta = a.favorited_at ? new Date(a.favorited_at).getTime() : 0;
      const tb = b.favorited_at ? new Date(b.favorited_at).getTime() : 0;
      return tb - ta;
    });
    if (!query) return sorted;
    return sorted.filter((m) => matchHaystack(m).some((s) => s.includes(query)));
  }, [matchesQ.data, query]);

  const filteredTournaments = useMemo(() => {
    const items = tournamentsQ.data || [];
    const sorted = [...items].sort((a, b) => {
      const ta = a.favorited_at ? new Date(a.favorited_at).getTime() : 0;
      const tb = b.favorited_at ? new Date(b.favorited_at).getTime() : 0;
      return tb - ta;
    });
    if (!query) return sorted;
    return sorted.filter((t) => tournamentHaystack(t).some((s) => s.includes(query)));
  }, [tournamentsQ.data, query]);

  const counts = useMemo(() => ({
    matches: matchesQ.data?.length || 0,
    tournaments: tournamentsQ.data?.length || 0,
  }), [matchesQ.data, tournamentsQ.data]);

  const renderMatch = useCallback(({ item }) => (
    <MatchCard
      match={item}
      style={s.cardSpacing}
      onPress={() => navigation.navigate('MatchDetail', { matchId: item.id })}
    />
  ), [navigation]);

  const renderTournament = useCallback(({ item }) => (
    <TournamentCard
      tournament={item}
      style={s.cardSpacing}
      onPress={() => navigation.navigate('TournamentDetail', { tournamentId: item.id })}
    />
  ), [navigation]);

  if (!user?.id) {
    return (
      <View style={[s.container, { paddingTop: insets.top }]}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <MaterialCommunityIcons name="chevron-left" size={26} color={COLORS.TEXT} />
          </TouchableOpacity>
          <View style={s.headerTitleRow}>
            <MaterialCommunityIcons name="heart" size={18} color={COLORS.ACCENT_LIGHT} />
            <Text style={s.headerTitle}>Favorites</Text>
          </View>
          <View style={{ width: 26 }} />
        </View>
        <View style={s.signedOutWrap}>
          <View style={s.signedOutIcon}>
            <MaterialCommunityIcons name="heart-outline" size={36} color={COLORS.TEXT_MUTED} />
          </View>
          <Text style={s.emptyTitle}>Sign in to view favorites</Text>
          <Text style={s.emptyText}>Save matches and tournaments to see them here across all your devices.</Text>
          <TouchableOpacity
            style={s.signInBtn}
            onPress={() => requireAuth('view your favorites')}
            activeOpacity={0.85}
          >
            <Text style={s.signInBtnText}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const activeData = activeTab === 'matches' ? filteredMatches : filteredTournaments;
  const activeRenderer = activeTab === 'matches' ? renderMatch : renderTournament;
  const hasAny = counts[activeTab] > 0;

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <MaterialCommunityIcons name="chevron-left" size={26} color={COLORS.TEXT} />
        </TouchableOpacity>
        <View style={s.headerTitleRow}>
          <MaterialCommunityIcons name="heart" size={18} color={COLORS.LIVE} />
          <Text style={s.headerTitle}>Favorites</Text>
        </View>
        <Text style={s.headerCount}>{counts.matches + counts.tournaments}</Text>
      </View>

      <View style={s.searchWrap}>
        <MaterialCommunityIcons name="magnify" size={18} color={COLORS.TEXT_MUTED} />
        <TextInput
          value={searchInput}
          onChangeText={setSearchInput}
          placeholder={`Search favorite ${activeTab}…`}
          placeholderTextColor={COLORS.TEXT_MUTED}
          style={s.searchInput}
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
        />
        {searchInput.length > 0 && (
          <TouchableOpacity onPress={() => setSearchInput('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <MaterialCommunityIcons name="close-circle" size={16} color={COLORS.TEXT_MUTED} />
          </TouchableOpacity>
        )}
      </View>

      <View style={s.tabSwitcher}>
        <Animated.View
          style={[
            s.tabIndicator,
            {
              transform: [{
                translateX: indicatorAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, (SCREEN_W - 32) / 2],
                }),
              }],
            },
          ]}
        />
        {TABS.map((t) => {
          const active = activeTab === t.key;
          return (
            <TouchableOpacity
              key={t.key}
              style={s.tabBtn}
              onPress={() => setActiveTab(t.key)}
              activeOpacity={0.85}
            >
              <MaterialCommunityIcons
                name={t.icon}
                size={14}
                color={active ? '#fff' : COLORS.TEXT_SECONDARY}
              />
              <Text style={[s.tabText, active && s.tabTextActive]}>{t.label}</Text>
              <View style={[s.tabCount, active && s.tabCountActive]}>
                <Text style={[s.tabCountText, active && s.tabCountTextActive]}>{counts[t.key]}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {activeData.length === 0 ? (
        <View style={s.emptyWrap}>
          <View style={s.emptyIcon}>
            <MaterialCommunityIcons
              name={hasAny ? 'magnify' : 'heart-outline'}
              size={32}
              color={COLORS.TEXT_MUTED}
            />
          </View>
          <Text style={s.emptyTitle}>
            {hasAny ? 'No results' : `No favorite ${activeTab} yet`}
          </Text>
          <Text style={s.emptyText}>
            {hasAny
              ? `Nothing matches "${searchInput}". Try a different search or clear it.`
              : `Tap the heart on any ${activeTab === 'matches' ? 'match' : 'tournament'} to save it here.`}
          </Text>
        </View>
      ) : (
        <FlashList
          data={activeData}
          renderItem={activeRenderer}
          keyExtractor={(it) => `${activeTab}-${it.id}`}
          estimatedItemSize={200}
          contentContainerStyle={{ paddingHorizontal: 14, paddingTop: 4, paddingBottom: insets.bottom + 16 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.ACCENT_LIGHT} colors={[COLORS.ACCENT_LIGHT]} />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
};

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.BG },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8,
  },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontFamily: FONTS.family, fontSize: 20, fontWeight: '900', color: COLORS.TEXT, letterSpacing: -0.3 },
  headerCount: {
    fontFamily: FONTS.family, fontSize: 11, fontWeight: '900',
    color: COLORS.ACCENT_LIGHT, letterSpacing: 0.6,
    backgroundColor: 'rgba(30,136,229,0.15)',
    paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999,
    fontVariant: ['tabular-nums'],
  },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 14, marginBottom: 10,
    paddingHorizontal: 12, paddingVertical: 9,
    backgroundColor: COLORS.SURFACE,
    borderRadius: 12,
    borderWidth: 1, borderColor: COLORS.BORDER,
  },
  searchInput: {
    flex: 1, fontFamily: FONTS.family, fontSize: 14, fontWeight: '600',
    color: COLORS.TEXT, paddingVertical: 0,
  },

  tabSwitcher: {
    flexDirection: 'row',
    marginHorizontal: 16, marginBottom: 10,
    backgroundColor: COLORS.SURFACE,
    borderRadius: 12, padding: 4,
    borderWidth: 1, borderColor: COLORS.BORDER,
    position: 'relative',
  },
  tabIndicator: {
    position: 'absolute',
    top: 4, left: 4, bottom: 4,
    width: (SCREEN_W - 40) / 2,
    backgroundColor: COLORS.ACCENT,
    borderRadius: 9,
  },
  tabBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 9, borderRadius: 9,
  },
  tabText: { fontFamily: FONTS.family, fontSize: 13, fontWeight: '800', color: COLORS.TEXT_SECONDARY },
  tabTextActive: { color: '#fff' },
  tabCount: {
    paddingHorizontal: 6, paddingVertical: 1, borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)', minWidth: 20, alignItems: 'center',
  },
  tabCountActive: { backgroundColor: 'rgba(255,255,255,0.22)' },
  tabCountText: { fontFamily: FONTS.family, fontSize: 10, fontWeight: '900', color: COLORS.TEXT_SECONDARY, fontVariant: ['tabular-nums'] },
  tabCountTextActive: { color: '#fff' },

  cardSpacing: { marginBottom: 10 },

  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, paddingBottom: 80 },
  emptyIcon: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(30,136,229,0.10)',
    borderWidth: 1, borderColor: 'rgba(30,136,229,0.22)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  emptyTitle: { fontFamily: FONTS.family, fontSize: 16, fontWeight: '900', color: COLORS.TEXT, marginBottom: 6, textAlign: 'center' },
  emptyText: { fontFamily: FONTS.family, fontSize: 13, fontWeight: '500', color: COLORS.TEXT_SECONDARY, textAlign: 'center', lineHeight: 19 },

  signedOutWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  signedOutIcon: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(30,136,229,0.10)',
    borderWidth: 1, borderColor: 'rgba(30,136,229,0.22)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  signInBtn: {
    marginTop: 20,
    paddingHorizontal: 24, paddingVertical: 11, borderRadius: 12,
    backgroundColor: COLORS.ACCENT,
  },
  signInBtnText: { fontFamily: FONTS.family, fontSize: 14, fontWeight: '900', color: '#fff', letterSpacing: 0.3 },
});

export default FavoritesScreen;
