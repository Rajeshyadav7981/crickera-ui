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
import { teamsAPI } from '../../services/api';
import { COLORS } from '../../theme';
import { MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import Skeleton, { ListSkeleton } from '../../components/Skeleton';
import SearchBar from '../../components/SearchBar';
import EmptyState from '../../components/EmptyState';

const PAGE_SIZE = 20;

const MyTeamsScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  useAuthGate('view your teams');
  const { user } = useAuth();
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState('');
  const [hasMore, setHasMore] = useState(true);
  const offsetRef = useRef(0);
  const searchTimer = useRef(null);

  const fetchTeams = async (query = '', offset = 0, append = false) => {
    try {
      const params = { created_by: user?.id, limit: PAGE_SIZE, offset };
      if (query.trim()) params.search = query.trim();
      const res = await teamsAPI.list(params);
      const data = res.data || [];
      if (append) {
        setTeams(prev => [...prev, ...data]);
      } else {
        setTeams(data);
      }
      setHasMore(data.length >= PAGE_SIZE);
      offsetRef.current = offset + data.length;
    } catch {}
    setLoading(false);
    setLoadingMore(false);
  };

  useFocusEffect(useCallback(() => {
    setLoading(true);
    offsetRef.current = 0;
    const task = InteractionManager.runAfterInteractions(() => {
      fetchTeams(search, 0, false);
    });
    return () => task.cancel();
  }, []));

  const onSearchChange = (text) => {
    setSearch(text);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setLoading(true);
      offsetRef.current = 0;
      fetchTeams(text, 0, false);
    }, 400);
  };

  const clearSearch = () => {
    setSearch('');
    setLoading(true);
    offsetRef.current = 0;
    fetchTeams('', 0, false);
  };

  const loadMore = () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    fetchTeams(search, offsetRef.current, true);
  };

  const renderTeam = ({ item: team }) => (
    <TouchableOpacity
      style={s.card}
      activeOpacity={0.7}
      onPress={() => navigation.navigate('TeamDetail', { teamId: team.id })}
    >
      <View style={[s.avatar, { backgroundColor: (team.color || COLORS.ACCENT) + '22' }]}>
        <Text style={[s.avatarText, { color: team.color || COLORS.ACCENT }]}>
          {(team.short_name || team.name || '?').charAt(0).toUpperCase()}
        </Text>
      </View>
      <View style={s.info}>
        <Text style={s.teamName} numberOfLines={1}>{team.name}</Text>
        {team.short_name && <Text style={s.shortName}>{team.short_name}</Text>}
      </View>
      {team.team_code && <Text style={s.code}>{team.team_code}</Text>}
      <MaterialCommunityIcons name="chevron-right" size={20} color={COLORS.TEXT_MUTED} />
    </TouchableOpacity>
  );

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <MaterialCommunityIcons name="chevron-left" size={22} color={COLORS.TEXT} />
        </TouchableOpacity>
        <Text style={s.title}>My Teams</Text>
        <TouchableOpacity onPress={() => navigation.navigate('CreateTeam')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <MaterialCommunityIcons name="plus" size={22} color={COLORS.ACCENT} />
        </TouchableOpacity>
      </View>

      <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
        <SearchBar
          value={search}
          onChangeText={onSearchChange}
          onClear={clearSearch}
          placeholder="Search teams..."
        />
      </View>

      {loading ? (
        <View style={{ paddingHorizontal: 16, paddingTop: 10 }}>
          {[1, 2, 3, 4, 5].map(i => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <Skeleton width={48} height={48} borderRadius={24} />
              <View>
                <Skeleton width={140} height={14} />
                <Skeleton width={60} height={10} style={{ marginTop: 6 }} />
              </View>
            </View>
          ))}
        </View>
      ) : (
        <FlashList
          data={teams}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderTeam}
          estimatedItemSize={100}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 20 }}
          showsVerticalScrollIndicator={false}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={loadingMore ? <ActivityIndicator style={{ padding: 16 }} color={COLORS.ACCENT} /> : null}
          ListEmptyComponent={
            <EmptyState
              icon="team"
              title={search ? 'No teams found' : 'No teams yet'}
              message={search ? 'Try a different search' : 'Create your first team'}
              actionLabel={!search ? 'Create Team' : undefined}
              onAction={!search ? () => navigation.navigate('CreateTeam') : undefined}
            />
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
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: COLORS.CARD, borderBottomWidth: 1, borderBottomColor: COLORS.BORDER,
  },
  title: { fontSize: 17, fontWeight: '700', color: COLORS.TEXT },
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginVertical: 10,
    backgroundColor: COLORS.SURFACE, borderRadius: 10,
    paddingHorizontal: 12, height: 40,
    borderWidth: 1, borderColor: COLORS.BORDER,
  },
  searchInput: { flex: 1, fontSize: 14, color: COLORS.TEXT },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.CARD, borderRadius: 14, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: COLORS.BORDER,
  },
  avatar: {
    width: 48, height: 48, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 20, fontWeight: '900' },
  info: { flex: 1 },
  teamName: { fontSize: 15, fontWeight: '700', color: COLORS.TEXT },
  shortName: { fontSize: 12, color: COLORS.TEXT_MUTED, marginTop: 2 },
  code: {
    fontSize: 10, fontWeight: '700', color: COLORS.ACCENT_LIGHT,
    backgroundColor: COLORS.ACCENT_SOFT, paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 6, overflow: 'hidden', marginRight: 4,
  },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: COLORS.TEXT },
  emptySub: { fontSize: 13, color: COLORS.TEXT_MUTED, marginTop: 4 },
  createBtn: {
    marginTop: 16, backgroundColor: COLORS.ACCENT, borderRadius: 10,
    paddingVertical: 10, paddingHorizontal: 24,
  },
  createBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});

export default MyTeamsScreen;
