import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator,
  InteractionManager,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { useAuthGate } from '../../hooks/useRequireAuth';
import { matchesAPI } from '../../services/api';
import { COLORS } from '../../theme';
import { MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import Skeleton, { MatchCardSkeleton, ListSkeleton } from '../../components/Skeleton';
import SearchBar from '../../components/SearchBar';
import Chip from '../../components/Chip';
import EmptyState from '../../components/EmptyState';

const PAGE_SIZE = 20;

const STATUS_COLORS = {
  live: { bg: COLORS.LIVE_BG, text: COLORS.LIVE },
  completed: { bg: COLORS.COMPLETED_BG, text: COLORS.COMPLETED },
  scheduled: { bg: COLORS.WARNING_BG, text: COLORS.WARNING },
  created: { bg: COLORS.COMPLETED_BG, text: COLORS.TEXT_MUTED },
  toss_done: { bg: COLORS.WARNING_BG, text: COLORS.WARNING },
  squad_set: { bg: COLORS.WARNING_BG, text: COLORS.WARNING },
};

const MyMatchesScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  useAuthGate('view your matches');
  const { user } = useAuth();
  const initialStatus = route?.params?.status || null;
  const filterMode = route?.params?.mode || 'created'; // 'created' or 'played'
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState('');
  const [hasMore, setHasMore] = useState(true);
  const offsetRef = useRef(0);
  const searchTimer = useRef(null);

  const fetchMatches = async (query = '', offset = 0, append = false) => {
    try {
      const params = { for_user: user?.id, limit: PAGE_SIZE, offset };
      if (initialStatus) params.status = initialStatus;
      // Server-side role filter — backend handles 'played' vs 'created' (=organized)
      if (filterMode === 'played') params.role = 'played';
      else if (filterMode === 'created') params.role = 'organized';
      if (query.trim()) params.search = query.trim();
      const res = await matchesAPI.list(params);
      const data = res.data || [];
      if (append) {
        setMatches(prev => [...prev, ...data]);
      } else {
        setMatches(data);
      }
      setHasMore(data.length >= PAGE_SIZE);
      offsetRef.current = offset + data.length;
    } catch (e) {}
    setLoading(false);
    setLoadingMore(false);
  };

  useFocusEffect(useCallback(() => {
    setLoading(true);
    offsetRef.current = 0;
    const task = InteractionManager.runAfterInteractions(() => {
      fetchMatches(search, 0, false);
    });
    return () => task.cancel();
  }, []));

  const onSearchChange = (text) => {
    setSearch(text);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setLoading(true);
      offsetRef.current = 0;
      fetchMatches(text, 0, false);
    }, 400);
  };

  const clearSearch = () => {
    setSearch('');
    setLoading(true);
    offsetRef.current = 0;
    fetchMatches('', 0, false);
  };

  const loadMore = () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    fetchMatches(search, offsetRef.current, true);
  };

  const navigateToMatch = (match) => {
    navigation.navigate('MatchDetail', { matchId: match.id });
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch { return dateStr; }
  };

  const ROLE_LABELS = { organized: 'Organized', played: 'Played', both: 'Organized & Played' };

  const renderMatch = ({ item: match }) => {
    const sc = STATUS_COLORS[match.status] || STATUS_COLORS.created;
    const roleLabel = ROLE_LABELS[match.role];
    return (
      <TouchableOpacity style={s.card} activeOpacity={0.7} onPress={() => navigateToMatch(match)}>
        <View style={s.cardHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Chip
              label={match.status.replace('_', ' ').toUpperCase()}
              color={sc.text}
              bg={sc.bg}
              size="sm"
            />
            {roleLabel && (
              <Chip
                label={roleLabel}
                color={COLORS.ACCENT}
                bg={COLORS.ACCENT_SOFT}
                size="sm"
              />
            )}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {match.match_code ? <Text style={s.code}>{match.match_code}</Text> : null}
            <Text style={s.overs}>{match.overs} overs</Text>
          </View>
        </View>
        <View style={s.teams}>
          <Text style={s.teamName}>{match.team_a_name || 'Team A'}</Text>
          <Text style={s.vs}>vs</Text>
          <Text style={s.teamName}>{match.team_b_name || 'Team B'}</Text>
        </View>
        {match.result_summary ? <Text style={s.result}>{match.result_summary}</Text> : null}
        {match.match_date ? <Text style={s.date}>{formatDate(match.match_date)}</Text> : null}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <MaterialCommunityIcons name="chevron-left" size={22} color={COLORS.TEXT} />
        </TouchableOpacity>
        <Text style={s.title}>
          {(() => {
            const base = filterMode === 'played' ? 'Played Matches' : 'My Matches';
            return initialStatus
              ? `${initialStatus.charAt(0).toUpperCase() + initialStatus.slice(1)} ${filterMode === 'played' ? 'Played' : ''}`.trim() + ' Matches'
              : base;
          })()}
        </Text>
        <View style={{ width: 28 }} />
      </View>

      {/* Search */}
      <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
        <SearchBar
          value={search}
          onChangeText={onSearchChange}
          onClear={clearSearch}
          placeholder="Search by team name or code..."
        />
      </View>

      {loading ? (
        <View style={{ paddingHorizontal: 16, paddingTop: 10 }}>
          <ListSkeleton count={4} Card={MatchCardSkeleton} />
        </View>
      ) : (
        <FlashList
          data={matches}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderMatch}
          estimatedItemSize={150}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 20 }}
          showsVerticalScrollIndicator={false}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={
            <EmptyState
              icon="cricket"
              title={search ? 'No matches found' : filterMode === 'played' ? "You haven't played yet" : 'No matches yet'}
              message={search ? 'Try a different search' : filterMode === 'played' ? 'Join a team squad to get started' : 'Create your first match'}
              actionLabel={!search && filterMode !== 'played' ? 'Create Match' : undefined}
              onAction={!search && filterMode !== 'played' ? () => navigation.navigate('QuickMatch') : undefined}
            />
          }
          ListFooterComponent={
            loadingMore ? <ActivityIndicator color={COLORS.ACCENT} style={{ marginVertical: 16 }} /> : null
          }
        />
      )}
    </View>
  );
};

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.BG },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14, backgroundColor: COLORS.CARD,
    borderBottomWidth: 1, borderBottomColor: COLORS.BORDER,
  },
  backIcon: { fontSize: 22, color: COLORS.TEXT, fontWeight: '600' },
  title: { fontSize: 18, fontWeight: '700', color: COLORS.TEXT },

  searchBar: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.SURFACE, borderRadius: 12,
    marginHorizontal: 16, marginTop: 12, marginBottom: 8, paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1, borderColor: COLORS.BORDER,
  },
  searchIcon: { fontSize: 14, marginRight: 8 },
  searchInput: { flex: 1, fontSize: 14, color: COLORS.TEXT, paddingVertical: 0 },
  searchClear: { fontSize: 16, color: COLORS.TEXT_MUTED, padding: 4 },

  card: {
    backgroundColor: COLORS.CARD, borderRadius: 14, padding: 16, marginTop: 10,
    borderWidth: 1, borderColor: COLORS.BORDER,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 2,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  badgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  code: { fontSize: 11, fontWeight: '600', color: COLORS.INFO, backgroundColor: COLORS.INFO_BG, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  overs: { fontSize: 12, fontWeight: '600', color: COLORS.TEXT_MUTED },
  teams: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  teamName: { fontSize: 15, fontWeight: '700', color: COLORS.TEXT, flex: 1 },
  vs: { fontSize: 12, fontWeight: '600', color: COLORS.TEXT_MUTED, marginHorizontal: 8 },
  result: { fontSize: 13, fontWeight: '600', color: COLORS.SUCCESS, marginTop: 4 },
  date: { fontSize: 12, color: COLORS.TEXT_MUTED, marginTop: 4 },

  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: COLORS.TEXT, marginBottom: 4 },
  emptySub: { fontSize: 13, color: COLORS.TEXT_MUTED, marginBottom: 16 },
  emptyBtn: { backgroundColor: COLORS.ACCENT, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 24 },
  emptyBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});

export default MyMatchesScreen;
