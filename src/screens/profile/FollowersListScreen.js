import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { usersAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { COLORS, FONTS } from '../../theme';
import BackButton from '../../components/BackButton';
import Avatar from '../../components/Avatar';
import { Feather } from '@expo/vector-icons';

const PAGE_SIZE = 20;

const FollowersListScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const { userId, username, mode = 'followers', title, count: routeCount } = route.params || {};
  const { user: currentUser, patchUser, refreshUser } = useAuth();

  // If this is the signed-in user's own list, the header count should track
  // AuthContext in real time (follow/unfollow elsewhere updates the user
  // object). Otherwise fall back to the count handed in via navigation.
  const isSelf = currentUser?.id === userId;
  const headerCount = isSelf
    ? (mode === 'following' ? currentUser?.following_count : currentUser?.followers_count)
    : routeCount;

  const [items, setItems] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [followBusy, setFollowBusy] = useState({});

  // Guard against double-fires of onEndReached.
  const fetchingRef = useRef(false);

  const fetchPage = useCallback(async ({ reset = false } = {}) => {
    if (!userId) return;
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    try {
      const api = mode === 'following' ? usersAPI.getFollowing : usersAPI.getFollowers;
      const res = await api(userId, {
        limit: PAGE_SIZE,
        cursor: reset ? null : cursor,
      });
      const next = res.headers?.['x-next-cursor'] || null;
      const rows = Array.isArray(res.data) ? res.data : [];
      setItems((prev) => (reset ? rows : [...prev, ...rows]));
      setCursor(next);
      setHasMore(!!next && rows.length > 0);
    } catch {
      if (reset) setItems([]);
      setHasMore(false);
    } finally {
      fetchingRef.current = false;
    }
  }, [userId, mode, cursor]);

  // Refresh on focus — every time the screen gains focus (including on
  // mount and when the user returns via back-button from a pushed screen),
  // reset the cursor and re-hit the API so stale rows from an earlier
  // session don't linger (e.g. someone they just unfollowed).
  useFocusEffect(useCallback(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setCursor(null);
      setHasMore(true);
      if (!cancelled) await fetchPage({ reset: true });
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
    // fetchPage intentionally omitted — it captures `cursor`, but we reset
    // cursor inside this effect anyway.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, mode]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setCursor(null);
    setHasMore(true);
    await fetchPage({ reset: true });
    setRefreshing(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, mode]);

  const onEndReached = useCallback(async () => {
    if (loading || loadingMore || !hasMore || !cursor) return;
    setLoadingMore(true);
    await fetchPage();
    setLoadingMore(false);
  }, [loading, loadingMore, hasMore, cursor, fetchPage]);

  const openUser = useCallback((u) => {
    if (u.player_id) {
      navigation.push('PlayerProfile', { playerId: u.player_id });
    } else if (u.username) {
      navigation.push('UserPublicProfile', { username: u.username });
    }
  }, [navigation]);

  const toggleFollow = useCallback(async (u) => {
    if (followBusy[u.id]) return;
    setFollowBusy((b) => ({ ...b, [u.id]: true }));
    // Optimistic swap on the row.
    const next = !u.is_following;
    setItems((list) => list.map((x) => x.id === u.id ? { ...x, is_following: next } : x));
    // Optimistic bump on the signed-in user's following count so Profile /
    // Home reflect the change the instant the user taps, without waiting for
    // /me to round-trip. The refreshUser() below reconciles if the server
    // disagrees.
    const delta = next ? 1 : -1;
    patchUser({ following_count: Math.max(0, (currentUser?.following_count || 0) + delta) });
    try {
      if (next) await usersAPI.follow(u.id);
      else await usersAPI.unfollow(u.id);
      // Fire-and-forget reconcile so the count is authoritative post-request.
      refreshUser().catch(() => {});
    } catch {
      // Revert both row and count on failure.
      setItems((list) => list.map((x) => x.id === u.id ? { ...x, is_following: !next } : x));
      patchUser({ following_count: Math.max(0, (currentUser?.following_count || 0)) });
    } finally {
      setFollowBusy((b) => ({ ...b, [u.id]: false }));
    }
  }, [followBusy, patchUser, refreshUser, currentUser?.following_count]);

  const renderItem = useCallback(({ item: u }) => {
    const isSelf = u.id === currentUser?.id;
    return (
      <TouchableOpacity style={s.row} activeOpacity={0.7} onPress={() => openUser(u)}>
        <Avatar uri={u.profile} name={u.full_name} size={48} color={COLORS.ACCENT} />
        <View style={s.rowInfo}>
          <Text style={s.rowName} numberOfLines={1}>{u.full_name || '—'}</Text>
          {u.username ? <Text style={s.rowHandle} numberOfLines={1}>@{u.username}</Text> : null}
        </View>
        {!isSelf && (
          <TouchableOpacity
            onPress={() => toggleFollow(u)}
            style={[s.followBtn, u.is_following && s.followBtnActive]}
            disabled={!!followBusy[u.id]}
            activeOpacity={0.7}
          >
            {followBusy[u.id] ? (
              <ActivityIndicator size="small" color={u.is_following ? COLORS.TEXT_MUTED : '#fff'} />
            ) : (
              <Text style={[s.followBtnText, u.is_following && s.followBtnTextActive]}>
                {u.is_following ? 'Following' : 'Follow'}
              </Text>
            )}
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  }, [currentUser?.id, openUser, toggleFollow, followBusy]);

  const listFooter = () => {
    if (loadingMore) {
      return (
        <View style={s.footer}>
          <ActivityIndicator color={COLORS.ACCENT} />
        </View>
      );
    }
    if (!hasMore && items.length > 0) {
      return <View style={s.footer}><Text style={s.footerText}>You're all caught up</Text></View>;
    }
    return null;
  };

  const headerTitle = title || (mode === 'following' ? 'Following' : 'Followers');

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <BackButton onPress={() => navigation.goBack()} />
        <View style={s.headerCenter}>
          <Text style={s.headerTitle}>
            {headerTitle}
            {typeof headerCount === 'number' ? (
              <Text style={s.headerCount}>  {headerCount}</Text>
            ) : null}
          </Text>
          {username ? <Text style={s.headerSub}>@{username}</Text> : null}
        </View>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={COLORS.ACCENT} />
        </View>
      ) : items.length === 0 ? (
        <View style={s.center}>
          <View style={s.emptyIconCircle}>
            <Feather name={mode === 'following' ? 'user-check' : 'users'} size={26} color={COLORS.TEXT_MUTED} />
          </View>
          <Text style={s.emptyTitle}>No {mode === 'following' ? 'following' : 'followers'} yet</Text>
          <Text style={s.emptySub}>
            {mode === 'following'
              ? 'People you follow will show up here.'
              : 'People who follow this account will show up here.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(u) => String(u.id)}
          renderItem={renderItem}
          contentContainerStyle={s.listContent}
          ItemSeparatorComponent={() => <View style={s.separator} />}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.4}
          ListFooterComponent={listFooter}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.ACCENT} />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
};

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.BG },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  headerCenter: { alignItems: 'center', flex: 1 },
  headerTitle: { fontFamily: FONTS.family, fontSize: 17, fontWeight: '800', color: COLORS.TEXT },
  headerCount: { fontFamily: FONTS.family, fontSize: 15, fontWeight: '700', color: COLORS.TEXT_MUTED },
  headerSub: { fontFamily: FONTS.family, fontSize: 12, color: COLORS.TEXT_MUTED, marginTop: 1, fontWeight: '500' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  emptyIconCircle: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: COLORS.ACCENT_SOFT,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: { fontFamily: FONTS.family, fontSize: 17, fontWeight: '800', color: COLORS.TEXT, textAlign: 'center' },
  emptySub: { fontFamily: FONTS.family, fontSize: 13, color: COLORS.TEXT_SECONDARY, textAlign: 'center', marginTop: 6, lineHeight: 19 },

  listContent: { paddingHorizontal: 12, paddingTop: 4, paddingBottom: 40 },
  separator: { height: 6 },

  // Card-style row — not a table. Padding + subtle border = clean list feel.
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, paddingHorizontal: 12,
    backgroundColor: COLORS.CARD,
    borderRadius: 14,
    borderWidth: 1, borderColor: COLORS.BORDER,
  },
  rowInfo: { flex: 1, minWidth: 0 },
  rowName: { fontFamily: FONTS.family, fontSize: 15, fontWeight: '700', color: COLORS.TEXT },
  rowHandle: { fontFamily: FONTS.family, fontSize: 12, color: COLORS.TEXT_MUTED, marginTop: 2, fontWeight: '500' },

  followBtn: {
    paddingHorizontal: 16, paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: COLORS.ACCENT,
    minWidth: 86,
    alignItems: 'center',
  },
  followBtnActive: {
    backgroundColor: 'transparent',
    borderWidth: 1, borderColor: COLORS.BORDER,
  },
  followBtnText: { fontFamily: FONTS.family, fontSize: 12, fontWeight: '800', color: '#fff', letterSpacing: 0.3 },
  followBtnTextActive: { color: COLORS.TEXT_SECONDARY },

  footer: { paddingVertical: 18, alignItems: 'center' },
  footerText: { fontFamily: FONTS.family, fontSize: 12, color: COLORS.TEXT_MUTED, fontWeight: '500' },
});

export default FollowersListScreen;
