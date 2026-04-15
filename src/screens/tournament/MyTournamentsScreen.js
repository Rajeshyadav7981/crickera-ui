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
import { tournamentsAPI } from '../../services/api';
import { COLORS } from '../../theme';
import { MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import Skeleton, { MatchCardSkeleton, ListSkeleton } from '../../components/Skeleton';
import SearchBar from '../../components/SearchBar';
import Chip from '../../components/Chip';
import EmptyState from '../../components/EmptyState';

const PAGE_SIZE = 20;

const STATUS_COLORS = {
  draft: { bg: COLORS.COMPLETED_BG, text: COLORS.TEXT_MUTED },
  upcoming: { bg: COLORS.INFO_BG, text: COLORS.INFO },
  ongoing: { bg: COLORS.SUCCESS_BG, text: COLORS.SUCCESS },
  completed: { bg: 'rgba(99,102,241,0.15)', text: COLORS.INDIGO_LIGHT },
  created: { bg: COLORS.COMPLETED_BG, text: COLORS.TEXT_MUTED },
};

const MyTournamentsScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  useAuthGate('view your tournaments');
  const { user } = useAuth();
  const initialStatus = route?.params?.status || null;
  const filterMode = route?.params?.mode || 'created'; // 'created' | 'played'
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState('');
  const [hasMore, setHasMore] = useState(true);
  const offsetRef = useRef(0);
  const searchTimer = useRef(null);

  const fetchTournaments = async (query = '', offset = 0, append = false) => {
    try {
      const params = { for_user: user?.id, limit: PAGE_SIZE, offset };
      if (initialStatus) params.status = initialStatus;
      if (filterMode === 'played') params.role = 'played';
      else if (filterMode === 'created') params.role = 'organized';
      if (query.trim()) params.search = query.trim();
      const res = await tournamentsAPI.list(params);
      const data = res.data || [];
      if (append) {
        setTournaments(prev => [...prev, ...data]);
      } else {
        setTournaments(data);
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
      fetchTournaments(search, 0, false);
    });
    return () => task.cancel();
  }, []));

  const onSearchChange = (text) => {
    setSearch(text);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setLoading(true);
      offsetRef.current = 0;
      fetchTournaments(text, 0, false);
    }, 400);
  };

  const clearSearch = () => {
    setSearch('');
    setLoading(true);
    offsetRef.current = 0;
    fetchTournaments('', 0, false);
  };

  const loadMore = () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    fetchTournaments(search, offsetRef.current, true);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch { return dateStr; }
  };

  const ROLE_LABELS = { organized: 'Organized', played: 'Played', both: 'Organized & Played' };

  const renderTournament = ({ item: t }) => {
    const sc = STATUS_COLORS[t.status] || STATUS_COLORS.draft;
    const stagesCount = t.stages_count || 0;
    const matchesTotal = t.matches_total || 0;
    const matchesCompleted = t.matches_completed || 0;
    const progressPct = matchesTotal > 0 ? Math.round((matchesCompleted / matchesTotal) * 100) : 0;
    const roleLabel = ROLE_LABELS[t.role];
    return (
      <TouchableOpacity
        style={s.card}
        activeOpacity={0.7}
        onPress={() => navigation.navigate('TournamentDetail', { tournamentId: t.id })}
      >
        <View style={s.cardHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Chip
              label={(t.status || 'draft').toUpperCase()}
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
            {t.tournament_code ? <Text style={s.code}>{t.tournament_code}</Text> : null}
          </View>
        </View>
        <Text style={s.name}>{t.name}</Text>

        {/* Stage / fixture progress — visible on every list card */}
        {stagesCount > 0 && (
          <View style={s.stageProgressRow}>
            <View style={s.stageProgressPill}>
              <MaterialCommunityIcons name="layers-outline" size={11} color={COLORS.ACCENT_LIGHT} />
              <Text style={s.stageProgressText}>
                {stagesCount} {stagesCount === 1 ? 'round' : 'rounds'}
              </Text>
            </View>
            {matchesTotal > 0 && (
              <View style={s.stageProgressPill}>
                <MaterialCommunityIcons name="cricket" size={11} color={COLORS.ACCENT_LIGHT} />
                <Text style={s.stageProgressText}>
                  {matchesCompleted}/{matchesTotal} matches • {progressPct}%
                </Text>
              </View>
            )}
          </View>
        )}

        <View style={s.meta}>
          {t.overs_per_match ? <Text style={s.metaText}>{t.overs_per_match} overs</Text> : null}
          {t.location ? <Text style={s.metaText}>{t.location}</Text> : null}
          {t.start_date ? <Text style={s.metaText}>{formatDate(t.start_date)}</Text> : null}
        </View>
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
          {filterMode === 'played' ? 'Played Tournaments' : (initialStatus ? `${initialStatus.charAt(0).toUpperCase() + initialStatus.slice(1)} Tournaments` : 'My Tournaments')}
        </Text>
        <View style={{ width: 28 }} />
      </View>

      {/* Search */}
      <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
        <SearchBar
          value={search}
          onChangeText={onSearchChange}
          onClear={clearSearch}
          placeholder="Search by name or code..."
        />
      </View>

      {loading ? (
        <View style={{ paddingHorizontal: 16, paddingTop: 10 }}>
          <ListSkeleton count={4} Card={MatchCardSkeleton} />
        </View>
      ) : (
        <FlashList
          data={tournaments}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderTournament}
          estimatedItemSize={120}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 20 }}
          showsVerticalScrollIndicator={false}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={
            <EmptyState
              icon="trophy"
              title={search ? 'No tournaments found' : filterMode === 'played' ? "You haven't played yet" : 'No tournaments yet'}
              message={search ? 'Try a different search' : filterMode === 'played' ? 'Join a team in a tournament to get started' : 'Create your first tournament'}
              actionLabel={!search && filterMode !== 'played' ? 'Create Tournament' : undefined}
              onAction={!search && filterMode !== 'played' ? () => navigation.navigate('CreateTournament') : undefined}
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
  code: { fontSize: 11, fontWeight: '600', color: COLORS.INDIGO_LIGHT, backgroundColor: 'rgba(99,102,241,0.15)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  typeText: { fontSize: 12, fontWeight: '600', color: COLORS.TEXT_MUTED, textTransform: 'capitalize' },
  name: { fontSize: 16, fontWeight: '700', color: COLORS.TEXT, marginBottom: 6 },
  meta: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  metaText: { fontSize: 12, color: COLORS.TEXT_SECONDARY, fontWeight: '500' },
  // Stage / fixture progress pills (visible on every tournament list card)
  stageProgressRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4, marginBottom: 8,
  },
  stageProgressPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.ACCENT_SOFT,
    borderWidth: 1, borderColor: COLORS.ACCENT_SOFT_BORDER,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999,
  },
  stageProgressText: {
    fontSize: 10, fontWeight: '700', color: COLORS.ACCENT_LIGHT,
    letterSpacing: 0.2,
  },

  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: COLORS.TEXT, marginBottom: 4 },
  emptySub: { fontSize: 13, color: COLORS.TEXT_MUTED, marginBottom: 16 },
  emptyBtn: { backgroundColor: COLORS.ACCENT, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 24 },
  emptyBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});

export default MyTournamentsScreen;
