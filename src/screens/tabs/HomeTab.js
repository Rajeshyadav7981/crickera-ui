import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Image,
  RefreshControl, ActivityIndicator, Animated, Dimensions, InteractionManager, Keyboard,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../context/AuthContext';
import { matchesAPI, tournamentsAPI, teamsAPI, venuesAPI } from '../../services/api';
import offlineCache from '../../services/offlineCache';
import { useLocation } from '../../hooks/useLocation';
import { useUserSearch, useRecentSearches } from '../../hooks/useUsers';
import { useRequireAuth } from '../../hooks/useRequireAuth';
import { COLORS, GRADIENTS, STATUS_CONFIG } from '../../theme';
import Icon from '../../components/Icon';
import Avatar from '../../components/Avatar';
import Skeleton, { MatchCardSkeleton, HorizontalSkeleton } from '../../components/Skeleton';

const { width: SCREEN_W } = Dimensions.get('window');
const CARD_W = SCREEN_W * 0.75;

const HomeTab = () => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const navigation = useNavigation();
  const requireAuth = useRequireAuth();
  const { location: userLocation, permissionDenied, requestLocation } = useLocation(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [myMatches, setMyMatches] = useState([]);
  const [myTournaments, setMyTournaments] = useState([]);
  const [myTeams, setMyTeams] = useState([]);
  const [nearbyMatches, setNearbyMatches] = useState([]);
  const [nearbyVenues, setNearbyVenues] = useState([]);
  const [nearbyTournaments, setNearbyTournaments] = useState([]);
  const searchRef = useRef(null);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const { recent: recentSearches, addRecent, clearRecent } = useRecentSearches();

  // Debounce search input → debouncedQuery (250ms)
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchInput.trim()), 250);
    return () => clearTimeout(t);
  }, [searchInput]);

  // React Query: auto-cancels stale requests, caches results, deduplicates
  const { data: searchResults = [], isLoading: searchLoading } = useUserSearch(debouncedQuery);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  // Memoized navigation callbacks to avoid inline functions in render
  const navigateToProfile = useCallback(() => navigation.navigate('Profile'), [navigation]);
  const navigateToMyMatches = useCallback(() => navigation.navigate('MyMatches'), [navigation]);
  const navigateToMyTournaments = useCallback(() => navigation.navigate('MyTournaments'), [navigation]);
  const navigateToMatchDetail = useCallback((matchId) => navigation.navigate('MatchDetail', { matchId }), [navigation]);
  const navigateToTeamDetail = useCallback((teamId) => navigation.navigate('TeamDetail', { teamId }), [navigation]);
  const navigateToTournamentDetail = useCallback((tournamentId) => navigation.navigate('TournamentDetail', { tournamentId }), [navigation]);
  const navigateToQuickAction = useCallback((nav, params, label) => {
    if (!requireAuth(label || 'continue')) return;
    navigation.navigate(nav, params);
  }, [navigation, requireAuth]);

  const fetchNearby = async (coords) => {
    if (!coords) return;
    try {
      const [mRes, vRes, tRes] = await Promise.all([
        matchesAPI.nearby(coords.latitude, coords.longitude, 50).catch(() => ({ data: [] })),
        venuesAPI.nearby(coords.latitude, coords.longitude, 50).catch(() => ({ data: [] })),
        tournamentsAPI.list({ limit: 10 }).catch(() => ({ data: [] })),
      ]);
      setNearbyMatches(mRes.data || []);
      setNearbyVenues(vRes.data || []);
      // Show tournaments that have a location set (proxy for "nearby")
      setNearbyTournaments((tRes.data || []).filter(t => t.location));
    } catch {}
  };

  const lastFetchRef = useRef(0);
  // Short throttle so rapid tab-switches don't spam the API, but short
  // enough that returning to Home after ending a match always refreshes.
  const REFRESH_INTERVAL = 3000;

  const fetchData = useCallback(async (force = false) => {
    // Skip "my data" for guest users — they see only nearby + empty prompts
    if (!user?.id) {
      setMyMatches([]);
      setMyTournaments([]);
      setMyTeams([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    const now = Date.now();
    const cacheKey = `home_${user?.id}`;

    // Show cached data instantly on first load (no waiting for API)
    if (loading && !force) {
      const cached = await offlineCache.getStale(cacheKey);
      if (cached) {
        setMyMatches(cached.matches || []);
        setMyTournaments(cached.tournaments || []);
        setMyTeams(cached.teams || []);
        setLoading(false);
      }
    }

    // Skip network fetch if recently fetched
    if (!force && lastFetchRef.current && now - lastFetchRef.current < REFRESH_INTERVAL) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      const [matchesRes, tourRes, teamsRes] = await Promise.all([
        matchesAPI.list({ created_by: user?.id, limit: 10 }).catch(() => ({ data: [] })),
        tournamentsAPI.list({ created_by: user?.id, limit: 10 }).catch(() => ({ data: [] })),
        teamsAPI.list({ created_by: user?.id, limit: 10 }).catch(() => ({ data: [] })),
      ]);
      const matches = matchesRes.data || [];
      const tournaments = tourRes.data || [];
      const teams = teamsRes.data || [];
      setMyMatches(matches);
      setMyTournaments(tournaments);
      setMyTeams(teams);
      if (userLocation) fetchNearby(userLocation);
      lastFetchRef.current = now;

      // Cache for offline use
      await offlineCache.set(cacheKey, { matches, tournaments, teams });
    } catch {} finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  const formatDate = useCallback((dateStr) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
    } catch { return ''; }
  }, []);

  // Cricket-style relative date label (Today / Tomorrow / 12 Mar)
  const cricketDateLabel = useCallback((dateStr) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      const today = new Date();
      const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const t1 = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const diffDays = Math.round((t1 - t0) / 86400000);
      if (diffDays === 0) return 'Today';
      if (diffDays === 1) return 'Tomorrow';
      if (diffDays === -1) return 'Yesterday';
      if (diffDays > 1 && diffDays < 7) return d.toLocaleDateString('en-US', { weekday: 'long' });
      return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
    } catch { return ''; }
  }, []);

  // Cricket-style score score formatter (155/3) with overs separately
  const formatScore = useCallback((runs, wickets) => {
    if (runs == null) return null;
    return `${runs}${wickets != null ? '/' + wickets : ''}`;
  }, []);

  useEffect(() => {
    if (!loading) {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 50, friction: 8 }),
      ]).start();
    }
  }, [loading]);

  useEffect(() => {
    if (userLocation) fetchNearby(userLocation);
  }, [userLocation]);

  useFocusEffect(useCallback(() => {
    // Always force-refresh on focus so returning from LiveScoring / Scorecard /
    // CreateMatch reflects the latest state. The backend has its own short
    // cache (~30s) which dedupes hammering, so this is safe.
    const task = InteractionManager.runAfterInteractions(() => {
      fetchData(true);
    });
    return () => task.cancel();
  }, [fetchData]));

  const getStatusColors = useCallback((status) => {
    const cfg = STATUS_CONFIG[status];
    if (cfg) return { bg: cfg.bg, text: cfg.text, label: cfg.label };
    return { bg: COLORS.COMPLETED_BG, text: COLORS.TEXT_MUTED, label: (status || '').toUpperCase() };
  }, []);

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 5) return { text: 'Good Night', iconName: 'moon' };
    if (h < 12) return { text: 'Good Morning', iconName: 'sun' };
    if (h < 17) return { text: 'Good Afternoon', iconName: 'sunCloud' };
    if (h < 21) return { text: 'Good Evening', iconName: 'sunset' };
    return { text: 'Good Night', iconName: 'moon' };
  }, []);

  const clearSearch = useCallback(() => {
    setSearchInput('');
    setDebouncedQuery('');
    setSearchFocused(false);
    Keyboard.dismiss();
  }, []);

  // Clear search when navigating away and coming back
  useFocusEffect(useCallback(() => {
    return () => {
      setSearchInput('');
      setDebouncedQuery('');
      setSearchFocused(false);
    };
  }, []));

  // Memoized refresh handler
  const onRefresh = useCallback(() => { setRefreshing(true); fetchData(true); }, [fetchData]);

  // Live matches count
  const liveCount = myMatches.filter(m => m.status === 'in_progress' || m.status === 'live').length;

  // Animated loader
  const pulseAnim = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    if (loading) {
      Animated.loop(Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.3, duration: 1000, useNativeDriver: true }),
      ])).start();
    }
  }, [loading]);

  if (loading) {
    return (
      <LinearGradient colors={GRADIENTS.LOADER} style={[s.container, s.loaderWrap, { paddingTop: insets.top }]}>
        <Animated.View style={{ opacity: pulseAnim, alignItems: 'center' }}>
          <Animated.View style={{
            transform: [{ scale: pulseAnim.interpolate({ inputRange: [0.3, 1], outputRange: [0.9, 1.05] }) }],
          }}>
            <Image source={require('../../../assets/creckstars-logo.png')} style={s.loaderLogo} />
          </Animated.View>
          <Text style={s.loaderTitle}>CrecKStars</Text>
          <Text style={s.loaderSub}>Your Cricket Companion</Text>
          <View style={s.loaderDots}>
            <Animated.View style={[s.loaderDot, { opacity: pulseAnim }]} />
            <Animated.View style={[s.loaderDot, { opacity: pulseAnim.interpolate({ inputRange: [0.3, 1], outputRange: [1, 0.3] }) }]} />
            <Animated.View style={[s.loaderDot, { opacity: pulseAnim }]} />
          </View>
        </Animated.View>
      </LinearGradient>
    );
  }

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <Animated.View style={{ flex: 1, opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
        <ScrollView
          style={s.feed}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[COLORS.ACCENT]}
              tintColor={COLORS.ACCENT}
            />
          }
        >
          {/* ── Hero Header (scrolls with content, gradient fades into body) ── */}
          <LinearGradient colors={[...GRADIENTS.HERO_DARK, COLORS.BG]} style={s.heroHeader}>
            <View style={s.heroTop}>
              <View style={s.heroLeft}>
                <Text style={s.heroGreeting}>{greeting.text} <Icon name={greeting.iconName} size={16} color={COLORS.ACCENT} /></Text>
                <Text style={s.heroName} numberOfLines={1}>{user?.first_name || 'Player'}</Text>
              </View>
              <TouchableOpacity activeOpacity={0.7} onPress={navigateToProfile}>
                <Avatar uri={user?.profile} name={user?.full_name || user?.first_name} size={42} color={COLORS.ACCENT} />
              </TouchableOpacity>
            </View>
          </LinearGradient>
          {/* ── Search Bar ── */}
          <View style={[s.searchBar, searchFocused && s.searchBarFocused]}>
            <Icon name="search" size={18} color={searchFocused ? COLORS.ACCENT : COLORS.TEXT_MUTED} />
            <TextInput
              ref={searchRef}
              style={s.searchBarInput}
              placeholder="Search players..."
              placeholderTextColor={COLORS.TEXT_HINT}
              value={searchInput}
              onChangeText={setSearchInput}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => { if (!searchInput) setSearchFocused(false); }}
              returnKeyType="search"
            />
            {searchInput.length > 0 && (
              <TouchableOpacity onPress={clearSearch} activeOpacity={0.7} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Icon name="close" size={16} color={COLORS.TEXT_MUTED} />
              </TouchableOpacity>
            )}
          </View>

          {/* ── Quick Actions ── */}
          <View style={s.quickRow}>
            {[
              { iconName: 'cricket', label: 'Quick\nMatch', nav: 'QuickMatch', authLabel: 'create a match' },
              { iconName: 'trophy', label: 'Create\nTournament', nav: 'CreateTournament', authLabel: 'create a tournament' },
              { iconName: 'team', label: 'New\nTeam', nav: 'CreateTeam', params: {}, authLabel: 'create a team' },
              { iconName: 'stats', label: 'My\nStats', nav: 'MyStats', authLabel: 'view your stats' },
            ].map((a, i) => (
              <TouchableOpacity
                key={i}
                style={s.quickBtn}
                activeOpacity={0.7}
                onPress={() => navigateToQuickAction(a.nav, a.params, a.authLabel)}
              >
                <LinearGradient colors={GRADIENTS.QUICK_ACTION} style={s.quickBtnGrad}>
                  <Icon name={a.iconName} size={28} color={COLORS.ACCENT} />
                </LinearGradient>
                <Text style={s.quickLabel}>{a.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ── Search Results / Recent Searches ── */}
          {debouncedQuery.length > 0 ? (
            <View style={s.searchResultsWrap}>
              {searchLoading && searchResults.length === 0 ? (
                <ActivityIndicator style={{ padding: 20 }} color={COLORS.ACCENT} />
              ) : searchResults.length === 0 ? (
                <Text style={s.searchEmpty}>No users found</Text>
              ) : (
                searchResults.map(u => (
                  <TouchableOpacity
                    key={u.id}
                    style={s.searchRow}
                    activeOpacity={0.7}
                    onPress={() => { addRecent(u); clearSearch(); navigation.navigate('UserPublicProfile', { username: u.username || u.full_name }); }}
                  >
                    <Avatar uri={u.profile} name={u.full_name} size={40} color={COLORS.ACCENT} />
                    <View style={{ flex: 1 }}>
                      <Text style={s.searchName}>{u.full_name}</Text>
                      {u.username && <Text style={s.searchHandle}>@{u.username}</Text>}
                    </View>
                    <Icon name="forward" size={16} color={COLORS.TEXT_MUTED} />
                  </TouchableOpacity>
                ))
              )}
            </View>
          ) : searchFocused && recentSearches.length > 0 ? (
            <View style={s.searchResultsWrap}>
              <View style={s.recentHeader}>
                <Text style={s.recentTitle}>Recent</Text>
                <TouchableOpacity onPress={clearRecent} activeOpacity={0.7}>
                  <Text style={s.recentClear}>Clear All</Text>
                </TouchableOpacity>
              </View>
              {recentSearches.map(u => (
                <TouchableOpacity
                  key={u.id}
                  style={s.searchRow}
                  activeOpacity={0.7}
                  onPress={() => { clearSearch(); navigation.navigate('UserPublicProfile', { username: u.username || u.full_name }); }}
                >
                  <Avatar uri={u.profile} name={u.full_name} size={40} color={COLORS.ACCENT} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.searchName}>{u.full_name}</Text>
                    {u.username && <Text style={s.searchHandle}>@{u.username}</Text>}
                  </View>
                  <Icon name="forward" size={16} color={COLORS.TEXT_MUTED} />
                </TouchableOpacity>
              ))}
            </View>
          ) : null}

          {/* ── Location Banner ── */}
          {permissionDenied && (
            <TouchableOpacity style={s.locBanner} activeOpacity={0.8} onPress={requestLocation}>
              <Icon name="location" size={20} color={COLORS.ACCENT} style={{ marginRight: 12 }} />
              <View style={{ flex: 1 }}>
                <Text style={s.locTitle}>Enable Location</Text>
                <Text style={s.locText}>Find nearby matches & grounds</Text>
              </View>
              <Text style={s.locArrow}>{'\u203A'}</Text>
            </TouchableOpacity>
          )}

          {/* ── Nearby Matches ── */}
          {nearbyMatches.length > 0 && renderSection(
            'Nearby Matches', null,
            nearbyMatches.map(m => {
              const sc = getStatusColors(m.status);
              return (
                <TouchableOpacity key={m.id} style={s.matchCard} activeOpacity={0.7}
                  onPress={() => navigateToMatchDetail(m.id)}>
                  <LinearGradient colors={GRADIENTS.SLATE_CARD} style={s.matchCardInner}>
                    <View style={s.matchTopRow}>
                      <View style={[s.statusBadge, { backgroundColor: sc.bg }]}>
                        <Text style={[s.statusText, { color: sc.text }]}>{sc.label || (m.status || '').toUpperCase()}</Text>
                      </View>
                      <Text style={s.distBadge}>{m.distance_km} km</Text>
                    </View>
                    <View style={s.matchTeams}>
                      <View style={s.matchScoreRow}>
                        <Text style={s.teamName} numberOfLines={1}>{m.team_a_name || 'Team A'}</Text>
                        {m.team_a_runs != null && (
                          <Text style={s.scoreText}>{m.team_a_runs}/{m.team_a_wickets ?? 0}</Text>
                        )}
                      </View>
                      <Text style={s.vsText}>VS</Text>
                      <View style={s.matchScoreRow}>
                        <Text style={s.teamName} numberOfLines={1}>{m.team_b_name || 'Team B'}</Text>
                        {m.team_b_runs != null && (
                          <Text style={s.scoreText}>{m.team_b_runs}/{m.team_b_wickets ?? 0}</Text>
                        )}
                      </View>
                    </View>
                    <View style={s.matchBottom}>
                      <Text style={s.matchMeta}>{m.overs} overs</Text>
                      {m.match_date && <Text style={s.matchMeta}>{formatDate(m.match_date)}</Text>}
                      {m.venue_name && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Icon name="venue" size={11} color={COLORS.TEXT_SECONDARY} /><Text style={s.matchMeta} numberOfLines={1}>{m.venue_name}</Text></View>}
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
              );
            })
          )}

          {/* ── Nearby Tournaments ── */}
          {nearbyTournaments.length > 0 && renderSection(
            'Nearby Tournaments', null,
            nearbyTournaments.map(t => {
              const sc = getStatusColors(t.status);
              return (
                <TouchableOpacity key={t.id} style={s.tournCard} activeOpacity={0.7}
                  onPress={() => navigateToTournamentDetail(t.id)}>
                  <LinearGradient colors={GRADIENTS.SLATE_CARD} style={s.tournCardInner}>
                    <View style={s.matchTopRow}>
                      <View style={[s.statusBadge, { backgroundColor: sc.bg }]}>
                        <Text style={[s.statusText, { color: sc.text }]}>{sc.label || (t.status || 'draft').toUpperCase()}</Text>
                      </View>
                      {t.tournament_code && <Text style={s.codeBadge}>{t.tournament_code}</Text>}
                    </View>
                    <Text style={s.tournName} numberOfLines={2}>{t.name}</Text>
                    <View style={s.matchBottom}>
                      {t.location && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Icon name="venue" size={11} color={COLORS.TEXT_SECONDARY} /><Text style={s.matchMeta} numberOfLines={1}>{t.location}</Text></View>}
                      {t.start_date && <Text style={s.matchMeta}>{formatDate(t.start_date)}</Text>}
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
              );
            })
          )}

          {/* ── My Matches ── */}
          {myMatches.length > 0 && renderSection(
            'My Matches', navigateToMyMatches,
            myMatches.map(m => {
              const sc = getStatusColors(m.status);
              return (
                <TouchableOpacity key={m.id} style={s.matchCard} activeOpacity={0.7}
                  onPress={() => navigateToMatchDetail(m.id)}>
                  <LinearGradient colors={GRADIENTS.SLATE_CARD} style={s.matchCardInner}>
                    <View style={s.matchTopRow}>
                      <View style={[s.statusBadge, { backgroundColor: sc.bg }]}>
                        <Text style={[s.statusText, { color: sc.text }]}>{sc.label || m.status?.replace('_', ' ').toUpperCase()}</Text>
                      </View>
                      {m.match_code && <Text style={s.codeBadge}>{m.match_code}</Text>}
                    </View>
                    <View style={s.matchTeams}>
                      <View style={s.matchScoreRow}>
                        <Text style={s.teamName} numberOfLines={1}>{m.team_a_name || 'Team A'}</Text>
                        {m.team_a_runs != null && (
                          <Text style={s.scoreText}>{m.team_a_runs}/{m.team_a_wickets ?? 0}{m.team_a_overs != null ? ` (${m.team_a_overs})` : ''}</Text>
                        )}
                      </View>
                      <Text style={s.vsText}>VS</Text>
                      <View style={s.matchScoreRow}>
                        <Text style={s.teamName} numberOfLines={1}>{m.team_b_name || 'Team B'}</Text>
                        {m.team_b_runs != null && (
                          <Text style={s.scoreText}>{m.team_b_runs}/{m.team_b_wickets ?? 0}{m.team_b_overs != null ? ` (${m.team_b_overs})` : ''}</Text>
                        )}
                      </View>
                    </View>
                    <View style={s.matchBottom}>
                      <Text style={s.matchMeta}>{m.overs} overs</Text>
                      {m.match_date && <Text style={s.matchMeta}>{formatDate(m.match_date)}</Text>}
                      {m.venue_name && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Icon name="venue" size={11} color={COLORS.TEXT_SECONDARY} /><Text style={s.matchMeta} numberOfLines={1}>{m.venue_name}</Text></View>}
                    </View>
                    {m.result_summary && <Text style={s.resultText} numberOfLines={1}>{m.result_summary}</Text>}
                  </LinearGradient>
                </TouchableOpacity>
              );
            })
          )}

          {/* ── My Teams ── */}
          {myTeams.length > 0 && renderSection(
            'My Teams', null,
            myTeams.map(t => (
              <TouchableOpacity key={t.id} style={s.teamCard} activeOpacity={0.7}
                onPress={() => navigateToTeamDetail(t.id)}>
                <View style={[s.teamAvatarCircle, { backgroundColor: COLORS.ACCENT_SOFT }]}>
                  <Text style={[s.teamAvatarLetter, { color: COLORS.ACCENT }]}>
                    {(t.short_name || t.name || '?').substring(0, 3).toUpperCase()}
                  </Text>
                </View>
                <Text style={s.teamCardName} numberOfLines={1}>{t.name}</Text>
                {t.short_name && <Text style={s.teamCardShort}>{t.short_name}</Text>}
              </TouchableOpacity>
            ))
          )}

          {/* ── My Tournaments ── */}
          {myTournaments.length > 0 && renderSection(
            'My Tournaments', navigateToMyTournaments,
            myTournaments.map(t => {
              const sc = getStatusColors(t.status);
              return (
                <TouchableOpacity key={t.id} style={s.tournCard} activeOpacity={0.7}
                  onPress={() => navigateToTournamentDetail(t.id)}>
                  <LinearGradient colors={GRADIENTS.SLATE_CARD} style={s.tournCardInner}>
                    <View style={s.matchTopRow}>
                      <View style={[s.statusBadge, { backgroundColor: sc.bg }]}>
                        <Text style={[s.statusText, { color: sc.text }]}>{sc.label || (t.status || 'draft').toUpperCase()}</Text>
                      </View>
                      {t.tournament_code && <Text style={s.codeBadge}>{t.tournament_code}</Text>}
                    </View>
                    <Text style={s.tournName} numberOfLines={2}>{t.name}</Text>
                    <View style={s.matchBottom}>
                      {t.start_date && <Text style={s.matchMeta}>{formatDate(t.start_date)}</Text>}
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
              );
            })
          )}

          {/* ── Empty State ── */}
          {myMatches.length === 0 && myTeams.length === 0 && myTournaments.length === 0 && (
            <View style={s.emptyWrap}>
              <Icon name="cricket" size={56} color={COLORS.TEXT_MUTED} />
              <Text style={s.emptyTitle}>Welcome to CrecKStars!</Text>
              <Text style={s.emptyText}>Create your first match, team or tournament using the quick actions above</Text>
            </View>
          )}

          <View style={{ height: 30 }} />
        </ScrollView>
      </Animated.View>
    </View>
  );
};

const renderSection = (title, onSeeAll, children) => (
  <View style={s.section}>
    <View style={s.sectionHeader}>
      <Text style={s.sectionTitle}>{title}</Text>
      {onSeeAll && (
        <TouchableOpacity onPress={onSeeAll}>
          <Text style={s.seeAll}>See All</Text>
        </TouchableOpacity>
      )}
    </View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.hScroll}>
      {children}
    </ScrollView>
  </View>
);

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.BG },

  // Hero Header — gradient fades into body bg
  heroHeader: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 20,
  },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  heroLeft: { flex: 1 },
  heroGreeting: { fontSize: 13, fontWeight: '500', color: COLORS.TEXT_MUTED, lineHeight: 18 },
  heroName: { fontSize: 24, fontWeight: '900', color: COLORS.TEXT, letterSpacing: -0.5, marginTop: 2 },

  // Search Bar — inside scroll, below quick actions
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginTop: 6,
    marginBottom: 6,
    backgroundColor: 'transparent',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 44,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  searchBarFocused: {
    borderColor: COLORS.ACCENT,
    backgroundColor: COLORS.CARD,
  },
  searchBarInput: { flex: 1, fontSize: 15, color: COLORS.TEXT, padding: 0 },
  searchResultsWrap: {
    marginHorizontal: 16, marginTop: 12, backgroundColor: COLORS.CARD,
    borderRadius: 14, borderWidth: 1, borderColor: COLORS.BORDER, overflow: 'hidden',
  },
  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 14,
    borderBottomWidth: 0.5, borderBottomColor: COLORS.BORDER,
  },
  searchName: { fontSize: 14, fontWeight: '600', color: COLORS.TEXT },
  searchHandle: { fontSize: 12, color: COLORS.TEXT_MUTED, marginTop: 1 },
  searchEmpty: { fontSize: 13, color: COLORS.TEXT_MUTED, textAlign: 'center', padding: 20 },
  recentHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: COLORS.BORDER,
  },
  recentTitle: { fontSize: 13, fontWeight: '700', color: COLORS.TEXT },
  recentClear: { fontSize: 12, fontWeight: '600', color: COLORS.ACCENT },

  // Loader
  loaderWrap: { alignItems: 'center', justifyContent: 'center' },
  loaderLogo: { width: 120, height: 120, resizeMode: 'contain' },
  loaderTitle: { fontSize: 30, fontWeight: '900', color: '#FFFFFF', marginTop: 20, letterSpacing: 1 },
  loaderSub: { fontSize: 14, color: 'rgba(255,255,255,0.5)', marginTop: 8, fontWeight: '500' },
  loaderDots: { flexDirection: 'row', gap: 8, marginTop: 30 },
  loaderDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.ACCENT },

  feed: { flex: 1 },

  // Quick Actions
  quickRow: { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8, gap: 12 },
  quickBtn: { flex: 1, alignItems: 'center', gap: 8 },
  quickBtnGrad: {
    width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: COLORS.BORDER_LIGHT,
  },
  quickLabel: { fontSize: 10, fontWeight: '600', color: COLORS.TEXT_SECONDARY, textAlign: 'center', lineHeight: 14 },

  // Location banner
  locBanner: {
    flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginTop: 12,
    backgroundColor: COLORS.ACCENT_SOFT, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: COLORS.ACCENT_SOFT_BORDER,
  },
  // locIcon style removed — replaced with Icon component
  locTitle: { fontSize: 14, fontWeight: '700', color: COLORS.ACCENT },
  locText: { fontSize: 11, color: COLORS.ACCENT, marginTop: 2 },
  locArrow: { fontSize: 24, color: COLORS.ACCENT, fontWeight: '300' },

  // Section
  section: { marginTop: 8 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 14, paddingBottom: 10 },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: COLORS.TEXT },
  seeAll: { fontSize: 13, fontWeight: '600', color: COLORS.ACCENT },
  hScroll: { paddingHorizontal: 16, paddingBottom: 8, gap: 12 },

  // Match Card
  matchCard: { width: CARD_W > 280 ? 280 : CARD_W, height: 160, borderRadius: 16, overflow: 'hidden' },
  matchCardInner: { padding: 16, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', flex: 1 },
  matchTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  matchTeams: { gap: 2, marginBottom: 10 },
  matchScoreRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  teamName: { fontSize: 15, fontWeight: '800', color: COLORS.TEXT, flex: 1 },
  scoreText: { fontSize: 15, fontWeight: '900', color: COLORS.TEXT, marginLeft: 8 },
  vsText: { fontSize: 10, fontWeight: '700', color: COLORS.TEXT_MUTED, marginVertical: 2 },
  matchBottom: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  matchMeta: { fontSize: 11, color: COLORS.TEXT_SECONDARY, fontWeight: '500' },
  resultText: { fontSize: 11, fontWeight: '700', color: COLORS.SUCCESS, marginTop: 6 },
  distBadge: {
    fontSize: 10, fontWeight: '700', color: COLORS.ACCENT,
    backgroundColor: COLORS.ACCENT_SOFT, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, overflow: 'hidden',
  },
  codeBadge: {
    fontSize: 9, fontWeight: '700', color: COLORS.ACCENT,
    backgroundColor: COLORS.ACCENT_SOFT, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, overflow: 'hidden',
  },

  // Venue Card
  // venueIcon style removed — replaced with Icon component
  // Team Card
  teamCard: {
    width: 120, backgroundColor: COLORS.CARD, borderRadius: 16, padding: 16, alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.BORDER,
  },
  teamAvatarCircle: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  teamAvatarLetter: { fontSize: 20, fontWeight: '900' },
  teamCardName: { fontSize: 13, fontWeight: '700', color: COLORS.TEXT, textAlign: 'center' },
  teamCardShort: { fontSize: 11, fontWeight: '600', color: COLORS.TEXT_MUTED, marginTop: 2 },

  // Tournament Card
  tournCard: { width: CARD_W > 260 ? 260 : CARD_W, borderRadius: 16, overflow: 'hidden' },
  tournCardInner: { padding: 16, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  tournName: { fontSize: 15, fontWeight: '800', color: COLORS.TEXT, marginBottom: 8 },

  // ─── Match Card v2 ────────────────────────────────────────────────────

  // ─── Team Card v2 ─────────────────────────────────────────────────────

  // ─── Tournament Card v2 ───────────────────────────────────────────────

  // ─── Match Card v3 — broadcast scoreboard layout ─────────────────────

  // ─── Tournament Card v3 — championship banner ────────────────────────

  // ─── Team Card v3 — jersey-badge ──────────────────────────────────────

  // ─── Team card (simple) ────────────────────────────────────────────────
  // ─── Match card (clean minimal) ────────────────────────────────────────

  // ─── Tournament card (clean minimal) ──────────────────────────────────
  // Empty
  emptyWrap: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 40 },
  // emptyEmoji style removed — replaced with Icon component
  emptyTitle: { fontSize: 20, fontWeight: '800', color: COLORS.TEXT, marginTop: 16 },
  emptyText: { fontSize: 14, color: COLORS.TEXT_SECONDARY, marginTop: 8, textAlign: 'center', lineHeight: 20 },
});

export default HomeTab;
