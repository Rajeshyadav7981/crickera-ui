import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, TextInput, ImageBackground,
  Dimensions, Animated, InteractionManager,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tournamentsAPI, matchesAPI, teamsAPI } from '../../services/api';
import { useRequireAuth } from '../../hooks/useRequireAuth';
import { COLORS, getStatusInfo as themeGetStatusInfo } from '../../theme';
import Icon from '../../components/Icon';
import Skeleton, { MatchCardSkeleton, ListSkeleton } from '../../components/Skeleton';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PRIMARY = COLORS.ACCENT;
const DARK = COLORS.TEXT;
const MID = '#888888';
const MUTED = '#666666';
const BORDER = COLORS.BORDER;
const BG = COLORS.BG;
const CARD = COLORS.CARD;
const SURFACE = COLORS.SURFACE;
const PAGE_SIZE = 20;

const TOURNAMENT_IMAGES = [
  'https://images.unsplash.com/photo-1531415074968-036ba1b575da?w=800&q=80',
  'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=800&q=80',
  'https://images.unsplash.com/photo-1624526267942-ab0ff8a3e972?w=800&q=80',
  'https://images.unsplash.com/photo-1587280501635-68a0e82cd5ff?w=800&q=80',
  'https://images.unsplash.com/photo-1580674684081-7617fbf3d745?w=800&q=80',
  'https://images.unsplash.com/photo-1589801258579-18e091f4ca26?w=800&q=80',
];

const TOURN_FILTERS = ['All', 'Live', 'Upcoming', 'Completed'];
const MATCH_FILTERS = ['All', 'Live', 'Upcoming', 'Completed'];

const STATUS_MAP_TOURN = { Live: 'in_progress', Upcoming: 'upcoming', Completed: 'completed' };
const STATUS_MAP_MATCH = { Live: 'live', Upcoming: 'upcoming', Completed: 'completed' };

const getStatusInfo = (status) => themeGetStatusInfo(status);

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch { return dateStr; }
};

const formatDateShort = (dateStr) => {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch { return ''; }
};

/* Pulsing Dot */
const PulsingDot = () => {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.3, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, []);
  return <Animated.View style={[styles.pulsingDot, { opacity: pulse }]} />;
};

const TournamentsTab = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const requireAuth = useRequireAuth();

  // Tab state
  const [activeTab, setActiveTab] = useState('tournaments');
  const tabSlideAnim = useRef(new Animated.Value(0)).current;
  const contentTranslateX = tabSlideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -SCREEN_WIDTH],
  });
  const [tabSwitching, setTabSwitching] = useState(false);

  // Tournaments pagination
  const [tournaments, setTournaments] = useState([]);
  const [tournFilter, setTournFilter] = useState('All');
  const [tournSearch, setTournSearch] = useState('');
  const [tournLoading, setTournLoading] = useState(true);
  const [tournLoadingMore, setTournLoadingMore] = useState(false);
  const [tournRefreshing, setTournRefreshing] = useState(false);
  const tournOffsetRef = useRef(0);
  const tournHasMoreRef = useRef(true);

  // Matches pagination
  const [matches, setMatches] = useState([]);
  const [matchFilter, setMatchFilter] = useState('All');
  const [matchSearch, setMatchSearch] = useState('');
  const [matchLoading, setMatchLoading] = useState(true);
  const [matchLoadingMore, setMatchLoadingMore] = useState(false);
  const [matchRefreshing, setMatchRefreshing] = useState(false);
  const matchOffsetRef = useRef(0);
  const matchHasMoreRef = useRef(true);

  // Live data (small sets, no pagination needed)
  const [liveTournaments, setLiveTournaments] = useState([]);
  const [liveMatches, setLiveMatches] = useState([]);

  // Shared
  const [teams, setTeams] = useState({});

  // Debounce refs
  const tournSearchTimer = useRef(null);
  const matchSearchTimer = useRef(null);

  const getTeamName = useCallback((id) => teams[id]?.short_name || teams[id]?.name || `Team ${id}`, [teams]);
  const getTeamColor = useCallback((id) => teams[id]?.color || PRIMARY, [teams]);

  // Tournament lookup for match tournament badges
  const tournMapRef = useRef({});

  /* ── Load Teams (once) ── */
  const loadTeams = async () => {
    try {
      const res = await teamsAPI.list({});
      const teamMap = {};
      (res.data || []).forEach(t => { teamMap[t.id] = t; });
      setTeams(teamMap);
    } catch {}
  };

  /* ── Load Live Data ── */
  const loadLiveData = async () => {
    try {
      const [liveT, liveM] = await Promise.all([
        tournamentsAPI.list({ status: 'in_progress', limit: 20 }).catch(() => ({ data: [] })),
        matchesAPI.list({ status: 'live', limit: 20 }).catch(() => ({ data: [] })),
      ]);
      setLiveTournaments(liveT.data || []);
      setLiveMatches(liveM.data || []);
    } catch {}
  };

  /* ── Fetch Tournaments (paginated) ── */
  const fetchTournaments = useCallback(async (reset = false) => {
    if (!reset && !tournHasMoreRef.current) return;

    const offset = reset ? 0 : tournOffsetRef.current;
    if (reset) {
      setTournLoading(true);
    } else {
      setTournLoadingMore(true);
    }

    try {
      const params = { limit: PAGE_SIZE, offset };
      if (tournFilter !== 'All') params.status = STATUS_MAP_TOURN[tournFilter];
      if (tournSearch.trim()) params.search = tournSearch.trim();

      const res = await tournamentsAPI.list(params);
      const data = res.data || [];

      if (reset) {
        setTournaments(data);
        // Build tournament map
        const map = {};
        data.forEach(t => { map[t.id] = t; });
        tournMapRef.current = map;
      } else {
        setTournaments(prev => {
          const updated = [...prev, ...data];
          const map = {};
          updated.forEach(t => { map[t.id] = t; });
          tournMapRef.current = map;
          return updated;
        });
      }

      tournOffsetRef.current = offset + data.length;
      tournHasMoreRef.current = data.length >= PAGE_SIZE;
    } catch {
      if (reset) setTournaments([]);
    } finally {
      setTournLoading(false);
      setTournLoadingMore(false);
      setTournRefreshing(false);
    }
  }, [tournFilter, tournSearch]);

  /* ── Fetch Matches (paginated) ── */
  const fetchMatches = useCallback(async (reset = false) => {
    if (!reset && !matchHasMoreRef.current) return;

    const offset = reset ? 0 : matchOffsetRef.current;
    if (reset) {
      setMatchLoading(true);
    } else {
      setMatchLoadingMore(true);
    }

    try {
      const params = { limit: PAGE_SIZE, offset };
      if (matchFilter !== 'All') params.status = STATUS_MAP_MATCH[matchFilter];
      if (matchSearch.trim()) params.search = matchSearch.trim();

      const res = await matchesAPI.list(params);
      const data = res.data || [];

      if (reset) {
        setMatches(data);
      } else {
        setMatches(prev => [...prev, ...data]);
      }

      matchOffsetRef.current = offset + data.length;
      matchHasMoreRef.current = data.length >= PAGE_SIZE;
    } catch {
      if (reset) setMatches([]);
    } finally {
      setMatchLoading(false);
      setMatchLoadingMore(false);
      setMatchRefreshing(false);
    }
  }, [matchFilter, matchSearch]);

  /* ── Initial load on focus — only refetch if stale (>60s) ── */
  const lastFetchRef = useRef(0);
  const dataLoadedRef = useRef(false);

  useFocusEffect(useCallback(() => {
    const now = Date.now();
    const isStale = !dataLoadedRef.current || now - lastFetchRef.current > 60000;
    if (!isStale) return;

    const task = InteractionManager.runAfterInteractions(() => {
      loadTeams();
      loadLiveData();
      tournOffsetRef.current = 0;
      tournHasMoreRef.current = true;
      matchOffsetRef.current = 0;
      matchHasMoreRef.current = true;
      fetchTournaments(true);
      fetchMatches(true);
      lastFetchRef.current = now;
      dataLoadedRef.current = true;
    });
    return () => task.cancel();
  }, []));

  /* ── Re-fetch when filter changes ── */
  useEffect(() => {
    tournOffsetRef.current = 0;
    tournHasMoreRef.current = true;
    fetchTournaments(true);
  }, [tournFilter]);

  useEffect(() => {
    matchOffsetRef.current = 0;
    matchHasMoreRef.current = true;
    fetchMatches(true);
  }, [matchFilter]);

  /* ── Debounced search ── */
  const handleTournSearchChange = (text) => {
    setTournSearch(text);
    if (tournSearchTimer.current) clearTimeout(tournSearchTimer.current);
    tournSearchTimer.current = setTimeout(() => {
      tournOffsetRef.current = 0;
      tournHasMoreRef.current = true;
      fetchTournaments(true);
    }, 500);
  };

  const handleMatchSearchChange = (text) => {
    setMatchSearch(text);
    if (matchSearchTimer.current) clearTimeout(matchSearchTimer.current);
    matchSearchTimer.current = setTimeout(() => {
      matchOffsetRef.current = 0;
      matchHasMoreRef.current = true;
      fetchMatches(true);
    }, 500);
  };

  const clearTournSearch = () => {
    setTournSearch('');
    if (tournSearchTimer.current) clearTimeout(tournSearchTimer.current);
    tournOffsetRef.current = 0;
    tournHasMoreRef.current = true;
    fetchTournaments(true);
  };

  const clearMatchSearch = () => {
    setMatchSearch('');
    if (matchSearchTimer.current) clearTimeout(matchSearchTimer.current);
    matchOffsetRef.current = 0;
    matchHasMoreRef.current = true;
    fetchMatches(true);
  };

  /* ── Load more handlers ── */
  const loadMoreTournaments = () => {
    if (!tournLoadingMore && tournHasMoreRef.current && !tournLoading) {
      fetchTournaments(false);
    }
  };

  const loadMoreMatches = () => {
    if (!matchLoadingMore && matchHasMoreRef.current && !matchLoading) {
      fetchMatches(false);
    }
  };

  /* ── Refresh handlers ── */
  const refreshTournaments = () => {
    setTournRefreshing(true);
    tournOffsetRef.current = 0;
    tournHasMoreRef.current = true;
    loadLiveData();
    fetchTournaments(true);
  };

  const refreshMatches = () => {
    setMatchRefreshing(true);
    matchOffsetRef.current = 0;
    matchHasMoreRef.current = true;
    loadLiveData();
    fetchMatches(true);
  };

  /* ── Footer loader ── */
  const renderFooterLoader = useCallback((isLoading) => {
    if (!isLoading) return <View style={{ height: 30 }} />;
    return (
      <View style={{ paddingVertical: 20, alignItems: 'center' }}>
        <ActivityIndicator size="small" color={PRIMARY} />
      </View>
    );
  }, []);

  /* ── Memoized footer components to avoid inline arrow in FlatList ── */
  const TournFooter = useMemo(() => renderFooterLoader(tournLoadingMore), [tournLoadingMore, renderFooterLoader]);
  const MatchFooter = useMemo(() => renderFooterLoader(matchLoadingMore), [matchLoadingMore, renderFooterLoader]);

  /* ── getItemLayout for match cards (fixed height ~140px + 10px margin) ── */
  const getMatchItemLayout = useCallback((data, index) => ({
    length: 150,
    offset: 150 * index,
    index,
  }), []);

  /* ═══════════════════════════════════ */
  /* TOURNAMENT ITEM RENDERER           */
  /* ═══════════════════════════════════ */
  const renderTournamentItem = useCallback(({ item: t, index: idx }) => {
    const img = TOURNAMENT_IMAGES[idx % TOURNAMENT_IMAGES.length];
    const statusInfo = getStatusInfo(t.status);
    return (
      <TouchableOpacity
        style={styles.tournamentCard}
        activeOpacity={0.9}
        onPress={() => navigation.navigate('TournamentDetail', { tournamentId: t.id })}
      >
        <ImageBackground source={{ uri: img }} style={styles.tournamentImage} imageStyle={styles.tournamentImageStyle}
          defaultSource={require('../../../assets/icon.png')}>
          <View style={styles.tournamentOverlay}>
            <View style={styles.tournamentTopRow}>
              <View style={[styles.statusChip, { backgroundColor: statusInfo.bg }]}>
                {(t.status === 'live' || t.status === 'in_progress') && <PulsingDot />}
                <Text style={[styles.statusChipText, { color: statusInfo.color }]}>{statusInfo.label}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                {t.tournament_code && <View style={styles.oversChip}><Text style={styles.oversChipText}>{t.tournament_code}</Text></View>}
                {t.overs_per_match && <View style={styles.oversChip}><Text style={styles.oversChipText}>{t.overs_per_match} Overs</Text></View>}
              </View>
            </View>
            <View style={{ marginTop: 'auto' }}>
              <Text style={styles.tournamentName} numberOfLines={2}>{t.name}</Text>
              <View style={styles.tournamentMeta}>
                {t.location && <View style={styles.metaItem}><Icon name="location" size={12} /><Text style={styles.metaText}>{t.location}</Text></View>}
                {t.start_date && <View style={styles.metaItem}><Icon name="calendar" size={12} /><Text style={styles.metaText}>{formatDate(t.start_date)}</Text></View>}
              </View>
              <View style={styles.statsRow}>
                {t.prize_pool > 0 && <View style={styles.statItem}><Text style={[styles.statValue, { color: '#FDE68A' }]}>{'\u20B9'}{t.prize_pool}</Text><Text style={styles.statLabel}>Prize</Text></View>}
                {t.entry_fee > 0 && <View style={styles.statItem}><Text style={styles.statValue}>{'\u20B9'}{t.entry_fee}</Text><Text style={styles.statLabel}>Entry</Text></View>}
              </View>
            </View>
          </View>
        </ImageBackground>
      </TouchableOpacity>
    );
  }, [navigation]);

  /* ═══════════════════════════════════ */
  /* MATCH ITEM RENDERER                */
  /* ═══════════════════════════════════ */
  const renderMatchItem = useCallback(({ item: m }) => {
    const statusInfo = getStatusInfo(m.status);
    const tourn = tournMapRef.current[m.tournament_id];
    const isLive = m.status === 'live';
    return (
      <TouchableOpacity
        style={styles.matchCard}
        activeOpacity={0.8}
        onPress={() => navigation.navigate('MatchDetail', { matchId: m.id })}
      >
        {/* Top row: status + meta */}
        <View style={styles.matchCardTop}>
          <View style={[styles.matchStatusBadge, { backgroundColor: statusInfo.badgeBg }]}>
            {isLive && <PulsingDot />}
            <Text style={[styles.matchStatusText, { color: statusInfo.badgeText }]}>{statusInfo.label}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {m.match_code && <Text style={styles.matchCode}>{m.match_code}</Text>}
            <Text style={styles.matchOvers}>T{m.overs}</Text>
          </View>
        </View>

        {/* Tournament badge */}
        {tourn && (
          <View style={styles.matchTournBadge}>
            <Icon name="trophy" size={10} style={{ marginRight: 4 }} />
            <Text style={styles.matchTournText} numberOfLines={1}>{tourn.name}</Text>
            {tourn.tournament_code && <Text style={styles.matchTournCode}>{tourn.tournament_code}</Text>}
          </View>
        )}

        {/* Teams */}
        <View style={styles.matchTeamsRow}>
          <View style={styles.matchTeamSide}>
            <View style={[styles.teamDot, { backgroundColor: getTeamColor(m.team_a_id) }]}>
              <Text style={styles.teamDotText}>{getTeamName(m.team_a_id)[0]}</Text>
            </View>
            <Text style={styles.matchTeamName} numberOfLines={1}>{m.team_a_name || getTeamName(m.team_a_id)}</Text>
          </View>
          <View style={styles.matchVsCircle}><Text style={styles.matchVsText}>VS</Text></View>
          <View style={[styles.matchTeamSide, { alignItems: 'flex-end' }]}>
            <Text style={[styles.matchTeamName, { textAlign: 'right' }]} numberOfLines={1}>{m.team_b_name || getTeamName(m.team_b_id)}</Text>
            <View style={[styles.teamDot, { backgroundColor: getTeamColor(m.team_b_id) }]}>
              <Text style={styles.teamDotText}>{getTeamName(m.team_b_id)[0]}</Text>
            </View>
          </View>
        </View>

        {/* Result / Date */}
        {m.result_summary ? (
          <Text style={styles.matchResult} numberOfLines={1}>{m.result_summary}</Text>
        ) : m.match_date ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Icon name="calendar" size={11} />
            <Text style={styles.matchDate}>{formatDateShort(m.match_date)}</Text>
          </View>
        ) : null}

        {/* Winner marker */}
        {m.winner_id && (
          <View style={styles.matchWinnerTag}>
            <Icon name="trophy" size={10} style={{ marginRight: 3 }} />
            <Text style={styles.matchWinnerText}>{getTeamName(m.winner_id)} won</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  }, [navigation, getTeamName, getTeamColor]);

  /* ═══════════════════════════════════ */
  /* TOURNAMENTS LIST HEADER            */
  /* ═══════════════════════════════════ */
  const TournamentsListHeader = () => (
    <>
      {/* Live Tournaments Horizontal Strip */}
      {liveTournaments.length > 0 && tournFilter === 'All' && !tournSearch.trim() && (
        <View style={{ marginBottom: 16, paddingTop: 8 }}>
          <View style={styles.sectionHeader}>
            <View style={styles.liveIndicator}><PulsingDot /></View>
            <Text style={styles.sectionTitle}>Live Now</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}>
            {liveTournaments.map((t, idx) => {
              const img = TOURNAMENT_IMAGES[idx % TOURNAMENT_IMAGES.length];
              return (
                <TouchableOpacity
                  key={t.id}
                  style={styles.liveCard}
                  activeOpacity={0.85}
                  onPress={() => navigation.navigate('TournamentDetail', { tournamentId: t.id })}
                >
                  <ImageBackground source={{ uri: img }} style={styles.liveCardImage} imageStyle={{ borderRadius: 14 }}>
                    <View style={styles.liveCardOverlay}>
                      <View style={styles.liveChip}><PulsingDot /><Text style={styles.liveChipText}>LIVE</Text></View>
                      <Text style={styles.liveCardName} numberOfLines={2}>{t.name}</Text>
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        {t.overs_per_match && <Text style={styles.liveCardMeta}>T{t.overs_per_match}</Text>}
                        {t.location && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Icon name="location" size={10} /><Text style={styles.liveCardMeta}>{t.location}</Text></View>}
                      </View>
                    </View>
                  </ImageBackground>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}
    </>
  );

  /* ═══════════════════════════════════ */
  /* MATCHES LIST HEADER                */
  /* ═══════════════════════════════════ */
  const MatchesListHeader = () => (
    <>
      {/* Live Matches Horizontal Strip */}
      {liveMatches.length > 0 && matchFilter === 'All' && !matchSearch.trim() && (
        <View style={{ marginBottom: 16, paddingTop: 8 }}>
          <View style={styles.sectionHeader}>
            <View style={styles.liveIndicator}><PulsingDot /></View>
            <Text style={styles.sectionTitle}>Live Matches</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}>
            {liveMatches.map(m => {
              const tourn = tournMapRef.current[m.tournament_id];
              return (
                <TouchableOpacity
                  key={m.id}
                  style={styles.liveMatchCard}
                  activeOpacity={0.85}
                  onPress={() => navigation.navigate('MatchDetail', { matchId: m.id })}
                >
                  <View style={styles.liveMatchHeader}>
                    <View style={styles.liveChipSmall}><PulsingDot /><Text style={{ fontSize: 9, fontWeight: '800', color: '#fff' }}>LIVE</Text></View>
                    {tourn && <Text style={styles.liveMatchTourn} numberOfLines={1}>{tourn.name}</Text>}
                  </View>
                  <View style={styles.liveMatchTeams}>
                    <View style={styles.liveMatchTeamRow}>
                      <View style={[styles.teamDot, { backgroundColor: getTeamColor(m.team_a_id) }]}>
                        <Text style={styles.teamDotText}>{getTeamName(m.team_a_id)[0]}</Text>
                      </View>
                      <Text style={styles.liveMatchTeamName} numberOfLines={1}>{m.team_a_name || getTeamName(m.team_a_id)}</Text>
                    </View>
                    <Text style={styles.liveMatchVs}>vs</Text>
                    <View style={styles.liveMatchTeamRow}>
                      <View style={[styles.teamDot, { backgroundColor: getTeamColor(m.team_b_id) }]}>
                        <Text style={styles.teamDotText}>{getTeamName(m.team_b_id)[0]}</Text>
                      </View>
                      <Text style={styles.liveMatchTeamName} numberOfLines={1}>{m.team_b_name || getTeamName(m.team_b_id)}</Text>
                    </View>
                  </View>
                  <Text style={styles.liveMatchOvers}>T{m.overs}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}
    </>
  );

  /* ═══════════════════════════════════ */
  /* EMPTY COMPONENTS                   */
  /* ═══════════════════════════════════ */
  const TournamentsEmpty = () => (
    <View style={styles.emptyBox}>
      <View style={styles.emptyIconCircle}><Icon name="trophy" size={32} /></View>
      <Text style={styles.emptyTitle}>No tournaments found</Text>
      <Text style={styles.emptySub}>{tournSearch.trim() ? 'Try a different search' : 'No tournaments available'}</Text>
      <TouchableOpacity style={styles.emptyCreateBtn} onPress={() => { if (!requireAuth('create a tournament')) return; navigation.navigate('CreateTournament'); }}>
        <Text style={styles.emptyCreateBtnText}>Create Tournament</Text>
      </TouchableOpacity>
    </View>
  );

  const MatchesEmpty = () => (
    <View style={styles.emptyBox}>
      <View style={styles.emptyIconCircle}><Icon name="cricket" size={32} /></View>
      <Text style={styles.emptyTitle}>No matches found</Text>
      <Text style={styles.emptySub}>{matchSearch.trim() ? 'Try a different search' : 'No matches available'}</Text>
    </View>
  );

  /* ═══════════════════════════════════ */
  /* TOURNAMENTS VIEW                   */
  /* ═══════════════════════════════════ */
  const renderTournamentsView = () => (
    <>
      {/* Search */}
      <View style={styles.searchBar}>
        <Icon name="search" size={16} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search tournaments by name, code..."
          placeholderTextColor={MUTED}
          value={tournSearch}
          onChangeText={handleTournSearchChange}
          returnKeyType="search"
        />
        {tournSearch.length > 0 && (
          <TouchableOpacity onPress={clearTournSearch}>
            <Icon name="close" size={14} />
          </TouchableOpacity>
        )}
      </View>

      {/* Filter chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={styles.filterRowContent}>
        {TOURN_FILTERS.map(f => {
          const active = tournFilter === f;
          return (
            <TouchableOpacity key={f} style={[styles.filterPill, active && styles.filterPillActive]} onPress={() => setTournFilter(f)}>
              {f === 'Live' && <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.LIVE }} />}
              <Text style={[styles.filterText, active && styles.filterTextActive]}>{f}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {tournLoading && !tournRefreshing ? (
        <ListSkeleton count={3} Card={MatchCardSkeleton} />
      ) : (
        <FlashList
          style={{ flex: 1 }}
          data={tournaments}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderTournamentItem}
          estimatedItemSize={200}
          ListHeaderComponent={TournamentsListHeader}
          ListEmptyComponent={TournamentsEmpty}
          ListFooterComponent={TournFooter}
          onEndReached={loadMoreTournaments}
          onEndReachedThreshold={0.3}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={tournRefreshing} onRefresh={refreshTournaments} tintColor={PRIMARY} />}
          contentContainerStyle={tournaments.length === 0 ? { flexGrow: 1 } : undefined}
        />
      )}
    </>
  );

  /* ═══════════════════════════════════ */
  /* MATCHES VIEW                       */
  /* ═══════════════════════════════════ */
  const renderMatchesView = () => (
    <>
      {/* Search */}
      <View style={styles.searchBar}>
        <Icon name="search" size={16} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by team, match code..."
          placeholderTextColor={MUTED}
          value={matchSearch}
          onChangeText={handleMatchSearchChange}
          returnKeyType="search"
        />
        {matchSearch.length > 0 && (
          <TouchableOpacity onPress={clearMatchSearch}>
            <Icon name="close" size={14} />
          </TouchableOpacity>
        )}
      </View>

      {/* Filter chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={styles.filterRowContent}>
        {MATCH_FILTERS.map(f => {
          const active = matchFilter === f;
          return (
            <TouchableOpacity key={f} style={[styles.filterPill, active && styles.filterPillActive]} onPress={() => setMatchFilter(f)}>
              {f === 'Live' && <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.LIVE }} />}
              <Text style={[styles.filterText, active && styles.filterTextActive]}>{f}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {matchLoading && !matchRefreshing ? (
        <ListSkeleton count={3} Card={MatchCardSkeleton} />
      ) : (
        <FlashList
          style={{ flex: 1 }}
          data={matches}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderMatchItem}
          estimatedItemSize={150}
          ListHeaderComponent={MatchesListHeader}
          ListEmptyComponent={MatchesEmpty}
          ListFooterComponent={MatchFooter}
          onEndReached={loadMoreMatches}
          onEndReachedThreshold={0.3}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={matchRefreshing} onRefresh={refreshMatches} tintColor={PRIMARY} />}
          contentContainerStyle={matches.length === 0 ? { flexGrow: 1 } : { paddingHorizontal: 16 }}
        />
      )}
    </>
  );

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Explore</Text>
        <TouchableOpacity style={styles.createBtn} activeOpacity={0.8} onPress={() => { if (!requireAuth('create a tournament')) return; navigation.navigate('CreateTournament'); }}>
          <Text style={styles.createBtnText}>+ Create</Text>
        </TouchableOpacity>
      </View>

      {/* Tab Toggle with sliding indicator */}
      <View style={styles.tabRow}>
        {/* Animated sliding background */}
        <Animated.View style={[styles.tabSlider, {
          transform: [{ translateX: tabSlideAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [3, (SCREEN_WIDTH - 40) / 2 - 1],
          }) }],
          width: (SCREEN_WIDTH - 40 - 6) / 2,
        }]} />
        <TouchableOpacity
          style={styles.tabBtn}
          onPress={() => {
            if (activeTab === 'tournaments') return;
            setTabSwitching(true);
            Animated.spring(tabSlideAnim, { toValue: 0, useNativeDriver: true, tension: 68, friction: 10 }).start(() => {
              setActiveTab('tournaments');
              setTabSwitching(false);
            });
          }}
          activeOpacity={0.7}
        >
          <Icon name="trophy" size={15} color={activeTab === 'tournaments' ? '#fff' : MID} style={{ marginRight: 4 }} />
          <Text style={[styles.tabText, activeTab === 'tournaments' && styles.tabTextActive]}>Tournaments</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.tabBtn}
          onPress={() => {
            if (activeTab === 'matches') return;
            setTabSwitching(true);
            Animated.spring(tabSlideAnim, { toValue: 1, useNativeDriver: true, tension: 68, friction: 10 }).start(() => {
              setActiveTab('matches');
              setTabSwitching(false);
            });
          }}
          activeOpacity={0.7}
        >
          <Icon name="cricket" size={15} color={activeTab === 'matches' ? '#fff' : MID} style={{ marginRight: 4 }} />
          <Text style={[styles.tabText, activeTab === 'matches' && styles.tabTextActive]}>Matches</Text>
        </TouchableOpacity>
      </View>

      {/* Content pager — slides in sync with tab indicator */}
      <View style={{ flex: 1, overflow: 'hidden' }}>
        <Animated.View style={{ flexDirection: 'row', width: SCREEN_WIDTH * 2, flex: 1, transform: [{ translateX: contentTranslateX }] }}>
          <View style={{ width: SCREEN_WIDTH, flex: 1 }}>
            {tabSwitching ? (
              <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
                <ListSkeleton count={3} Card={MatchCardSkeleton} />
              </View>
            ) : renderTournamentsView()}
          </View>
          <View style={{ width: SCREEN_WIDTH, flex: 1 }}>
            {tabSwitching ? (
              <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
                <ListSkeleton count={3} Card={MatchCardSkeleton} />
              </View>
            ) : renderMatchesView()}
          </View>
        </Animated.View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },

  /* Header */
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8,
  },
  title: { fontSize: 28, fontWeight: '800', color: DARK },
  createBtn: { backgroundColor: PRIMARY, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },
  createBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  /* Tabs */
  tabRow: {
    flexDirection: 'row', marginHorizontal: 20, marginBottom: 12,
    backgroundColor: CARD, borderRadius: 12, borderWidth: 1, borderColor: BORDER, padding: 3,
  },
  tabSlider: {
    position: 'absolute', top: 3, bottom: 3, borderRadius: 10,
    backgroundColor: PRIMARY,
  },
  tabBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 10, borderRadius: 10, zIndex: 1,
  },
  tabText: { fontSize: 14, fontWeight: '700', color: MID },
  tabTextActive: { color: '#fff' },

  /* Search */
  searchBar: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: CARD,
    marginHorizontal: 20, borderRadius: 12, borderWidth: 1, borderColor: BORDER,
    height: 44, paddingHorizontal: 14, marginBottom: 10,
  },
  searchIcon: { fontSize: 14, marginRight: 10, color: MUTED },
  searchInput: { flex: 1, fontSize: 14, color: DARK, height: 44, padding: 0 },
  clearSearch: { fontSize: 14, color: MUTED, padding: 4 },

  /* Filters */
  filterRow: { flexGrow: 0, marginBottom: 4, zIndex: 1 },
  filterRowContent: { paddingHorizontal: 20, gap: 8 },
  filterPill: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    backgroundColor: CARD, borderWidth: 1, borderColor: BORDER, gap: 4,
  },
  filterPillActive: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  filterIcon: { fontSize: 10 },
  filterText: { fontSize: 12, color: MID, fontWeight: '600' },
  filterTextActive: { color: '#fff' },

  /* Section Header */
  sectionHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginBottom: 10, gap: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: DARK },
  liveIndicator: {
    width: 20, height: 20, borderRadius: 10, backgroundColor: COLORS.LIVE_BG,
    alignItems: 'center', justifyContent: 'center',
  },

  /* Live Tournament Card (horizontal) */
  liveCard: { width: 240, borderRadius: 14, overflow: 'hidden' },
  liveCardImage: { height: 150, justifyContent: 'flex-end' },
  liveCardOverlay: {
    flex: 1, borderRadius: 14, padding: 12, justifyContent: 'space-between', backgroundColor: 'rgba(0,0,0,0.65)',
  },
  liveChip: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start',
    backgroundColor: PRIMARY, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, gap: 4,
  },
  liveChipText: { fontSize: 9, fontWeight: '800', color: '#fff' },
  liveCardName: { fontSize: 15, fontWeight: '800', color: '#fff', marginTop: 'auto' },
  liveCardMeta: { fontSize: 10, fontWeight: '600', color: 'rgba(255,255,255,0.8)' },

  /* Live Match Card (horizontal) */
  liveMatchCard: {
    width: 200, backgroundColor: CARD, borderRadius: 14, padding: 14,
    borderWidth: 1.5, borderColor: COLORS.ACCENT_SOFT_BORDER,
    shadowColor: PRIMARY, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 3,
  },
  liveMatchHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  liveChipSmall: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: PRIMARY,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, gap: 3,
  },
  liveMatchTourn: { flex: 1, fontSize: 10, fontWeight: '600', color: MUTED },
  liveMatchTeams: { gap: 4 },
  liveMatchTeamRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  liveMatchTeamName: { fontSize: 13, fontWeight: '700', color: DARK },
  liveMatchVs: { fontSize: 10, color: MUTED, fontWeight: '600', textAlign: 'center' },
  liveMatchOvers: {
    fontSize: 10, fontWeight: '700', color: MID, marginTop: 8,
    alignSelf: 'flex-end', backgroundColor: SURFACE, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
  },

  /* Tournament Card */
  tournamentCard: { marginHorizontal: 16, marginBottom: 16, borderRadius: 16, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6 },
  tournamentImage: { height: 200, justifyContent: 'flex-end' },
  tournamentImageStyle: { borderRadius: 16 },
  tournamentOverlay: { flex: 1, borderRadius: 16, padding: 14, justifyContent: 'space-between', backgroundColor: 'rgba(0,0,0,0.6)' },
  tournamentTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  statusChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, gap: 5 },
  statusChipText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  oversChip: { backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  oversChipText: { fontSize: 10, fontWeight: '700', color: '#fff' },
  tournamentName: { fontSize: 20, fontWeight: '800', color: '#fff', marginBottom: 6 },
  tournamentMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  metaItem: { flexDirection: 'row', alignItems: 'center' },
  metaIcon: { fontSize: 11, marginRight: 3 },
  metaText: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.9)' },
  statsRow: { flexDirection: 'row', gap: 16, marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.15)' },
  statItem: { alignItems: 'center' },
  statValue: { fontSize: 13, fontWeight: '700', color: '#fff', textTransform: 'capitalize' },
  statLabel: { fontSize: 9, fontWeight: '600', color: 'rgba(255,255,255,0.7)', marginTop: 1, textTransform: 'uppercase', letterSpacing: 0.3 },
  pulsingDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: PRIMARY },

  /* Match Card */
  matchCard: {
    backgroundColor: CARD, borderRadius: 14, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: BORDER,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 1,
  },
  matchCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  matchStatusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, gap: 4 },
  matchStatusText: { fontSize: 9, fontWeight: '700', letterSpacing: 0.3 },
  matchCode: { fontSize: 9, fontWeight: '600', color: MUTED, backgroundColor: SURFACE, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 3, overflow: 'hidden' },
  matchOvers: { fontSize: 10, fontWeight: '700', color: MID, backgroundColor: SURFACE, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, overflow: 'hidden' },
  matchTournBadge: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(180,83,9,0.15)',
    borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, marginBottom: 10,
  },
  matchTournText: { flex: 1, fontSize: 11, fontWeight: '600', color: '#D97706' },
  matchTournCode: { fontSize: 9, fontWeight: '700', color: COLORS.WARNING_LIGHT, backgroundColor: 'rgba(217,119,6,0.2)', paddingHorizontal: 4, paddingVertical: 1, borderRadius: 3, marginLeft: 6, overflow: 'hidden' },
  matchTeamsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  matchTeamSide: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  teamDot: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  teamDotText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  matchTeamName: { flex: 1, fontSize: 13, fontWeight: '700', color: DARK },
  matchVsCircle: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: SURFACE,
    alignItems: 'center', justifyContent: 'center', marginHorizontal: 6,
  },
  matchVsText: { fontSize: 9, fontWeight: '800', color: MID },
  matchResult: { fontSize: 11, fontWeight: '600', color: COLORS.SUCCESS, textAlign: 'center', marginTop: 4, paddingTop: 8, borderTopWidth: 1, borderTopColor: BORDER },
  matchDate: { fontSize: 11, color: MUTED, textAlign: 'center', marginTop: 4 },
  matchWinnerTag: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: BORDER,
  },
  matchWinnerText: { fontSize: 10, fontWeight: '700', color: COLORS.SUCCESS },

  /* Empty */
  emptyBox: { alignItems: 'center', marginTop: 60, paddingHorizontal: 40 },
  emptyIconCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: COLORS.ACCENT_SOFT, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: DARK, marginBottom: 6 },
  emptySub: { fontSize: 13, color: MUTED, textAlign: 'center', lineHeight: 18 },
  emptyCreateBtn: { backgroundColor: PRIMARY, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12, marginTop: 20 },
  emptyCreateBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});

export default TournamentsTab;
