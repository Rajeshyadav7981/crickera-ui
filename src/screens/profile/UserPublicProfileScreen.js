import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { usersAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useUserProfile } from '../../hooks/useUsers';
import { COLORS } from '../../theme';
import BackButton from '../../components/BackButton';
import Avatar from '../../components/Avatar';
import Skeleton from '../../components/Skeleton';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const UserPublicProfileScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const { username, initialTab } = route.params;
  const { user: currentUser, refreshUser } = useAuth();

  // React Query: auto-caches profile (5min), revisits are instant
  const { data: profileData, isLoading: loading, refetch } = useUserProfile(username);

  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [localCounts, setLocalCounts] = useState(null); // optimistic count overrides
  const [activeTab, setActiveTab] = useState(null);
  const [listData, setListData] = useState([]);
  const [listLoading, setListLoading] = useState(false);
  const [listFollowLoading, setListFollowLoading] = useState({});
  const initialTabHandled = useRef(false);

  // Refetch fresh data every time screen is focused (clears stale cache)
  useFocusEffect(useCallback(() => {
    refetch();
    setLocalCounts(null);
    setActiveTab(null);
    setListData([]);
    initialTabHandled.current = false;
  }, [refetch]));

  // Sync follow state when profile data loads/changes
  const profile = profileData ? { ...profileData, ...(localCounts || {}) } : null;
  useEffect(() => {
    if (profileData) setIsFollowing(profileData.is_following || false);
  }, [profileData]);

  // If this user has a linked player record, redirect to the richer PlayerProfile
  // (which shows career stats, recent form, teams AND user info/follow button).
  useEffect(() => {
    if (profileData?.player_id) {
      navigation.replace('PlayerProfile', { playerId: profileData.player_id });
    }
  }, [profileData?.player_id, navigation]);

  const handleFollow = useCallback(async () => {
    if (!profile || followLoading) return;
    setFollowLoading(true);
    try {
      if (isFollowing) {
        await usersAPI.unfollow(profile.id);
        setIsFollowing(false);
        setLocalCounts(prev => ({
          ...(prev || {}),
          followers_count: Math.max(0, (profile.followers_count || 0) - 1),
        }));
      } else {
        await usersAPI.follow(profile.id);
        setIsFollowing(true);
        setLocalCounts(prev => ({
          ...(prev || {}),
          followers_count: (profile.followers_count || 0) + 1,
        }));
      }
      refreshUser();
    } catch {}
    setFollowLoading(false);
  }, [profile, isFollowing, followLoading, refreshUser]);

  const loadList = useCallback(async (type) => {
    if (activeTab === type) { setActiveTab(null); return; }
    setActiveTab(type);
    setListLoading(true);
    try {
      const res = type === 'followers'
        ? await usersAPI.getFollowers(profile.id)
        : await usersAPI.getFollowing(profile.id);
      setListData(res.data || []);
    } catch { setListData([]); }
    setListLoading(false);
  }, [profile, activeTab]);

  const isSelf = profile?.is_self || currentUser?.id === profile?.id;

  // Auto-open followers/following tab if navigated with initialTab param
  useEffect(() => {
    if (profile && initialTab && !initialTabHandled.current) {
      initialTabHandled.current = true;
      loadList(initialTab);
    }
  }, [profile, initialTab]);

  // Follow/unfollow a user from the followers/following list
  const handleListFollow = useCallback(async (targetUser) => {
    if (listFollowLoading[targetUser.id]) return;
    setListFollowLoading(prev => ({ ...prev, [targetUser.id]: true }));
    try {
      if (targetUser.is_following) {
        await usersAPI.unfollow(targetUser.id);
        setListData(prev => prev.map(u => u.id === targetUser.id ? { ...u, is_following: false } : u));
      } else {
        await usersAPI.follow(targetUser.id);
        setListData(prev => prev.map(u => u.id === targetUser.id ? { ...u, is_following: true } : u));
      }
      refreshUser();
    } catch {}
    setListFollowLoading(prev => ({ ...prev, [targetUser.id]: false }));
  }, [listFollowLoading, refreshUser]);

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text style={s.headerTitle}>@{username}</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <View style={{ flex: 1 }}>
          {/* Hero skeleton */}
          <View style={s.hero}>
            <Skeleton width={80} height={80} borderRadius={40} />
            <Skeleton width={160} height={20} style={{ marginTop: 12 }} />
            <Skeleton width={100} height={14} style={{ marginTop: 8 }} />
            <View style={[s.statsRow, { marginTop: 20 }]}>
              <View style={s.statItem}>
                <Skeleton width={40} height={20} />
                <Skeleton width={60} height={12} style={{ marginTop: 6 }} />
              </View>
              <View style={s.statDivider} />
              <View style={s.statItem}>
                <Skeleton width={40} height={20} />
                <Skeleton width={60} height={12} style={{ marginTop: 6 }} />
              </View>
            </View>
            <Skeleton width={140} height={36} borderRadius={18} style={{ marginTop: 18 }} />
          </View>
          {/* Info card skeleton */}
          <View style={{ marginHorizontal: 16, marginTop: 14, gap: 10 }}>
            <Skeleton width="90%" height={14} />
            <Skeleton width="70%" height={14} />
            <Skeleton width="60%" height={14} />
          </View>
        </View>
      ) : !profile ? (
        <View style={s.center}><Text style={s.notFound}>User not found</Text></View>
      ) : (
        <ScrollView contentContainerStyle={s.content}>
          {/* Hero */}
          <View style={s.hero}>
            <Avatar uri={profile.profile} name={profile.full_name} size={80} color={COLORS.ACCENT} showRing />
            <Text style={s.name}>{profile.full_name}</Text>
            <Text style={s.usernameText}>@{profile.username}</Text>

            {/* Stats row */}
            <View style={s.statsRow}>
              <TouchableOpacity style={s.statItem} onPress={() => loadList('followers')}>
                <Text style={s.statNum}>{profile.followers_count || 0}</Text>
                <Text style={s.statLabel}>Followers</Text>
              </TouchableOpacity>
              <View style={s.statDivider} />
              <TouchableOpacity style={s.statItem} onPress={() => loadList('following')}>
                <Text style={s.statNum}>{profile.following_count || 0}</Text>
                <Text style={s.statLabel}>Following</Text>
              </TouchableOpacity>
            </View>

            {/* Follow / Edit button */}
            {!isSelf && (
              <TouchableOpacity
                style={[s.followBtn, isFollowing && s.followBtnActive]}
                onPress={handleFollow}
                disabled={followLoading}
                activeOpacity={0.7}
              >
                {followLoading ? (
                  <ActivityIndicator size="small" color={isFollowing ? COLORS.TEXT : '#fff'} />
                ) : (
                  <Text style={[s.followBtnText, isFollowing && s.followBtnTextActive]}>
                    {isFollowing ? 'Following' : 'Follow'}
                  </Text>
                )}
              </TouchableOpacity>
            )}
            {isSelf && (
              <TouchableOpacity style={s.editBtn} onPress={() => navigation.navigate('EditProfile')} activeOpacity={0.7}>
                <Text style={s.editBtnText}>Edit Profile</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Cricket Profile card */}
          {(profile.bio || profile.city || profile.country || profile.date_of_birth ||
            profile.player_role || profile.batting_style || profile.bowling_style) && (
            <View style={s.cricketCard}>
              {profile.player_role && (
                <View style={s.cricketPill}>
                  <MaterialCommunityIcons name="cricket" size={13} color={COLORS.ACCENT} />
                  <Text style={s.cricketPillText}>
                    {profile.player_role.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                  </Text>
                </View>
              )}
              {profile.bio ? (
                <View style={s.cricketRow}>
                  <MaterialCommunityIcons name="information-outline" size={15} color={COLORS.TEXT_MUTED} />
                  <Text style={s.cricketText}>{profile.bio}</Text>
                </View>
              ) : null}
              {(profile.batting_style || profile.bowling_style) ? (
                <View style={s.cricketRow}>
                  <MaterialCommunityIcons name="bat" size={15} color={COLORS.TEXT_MUTED} />
                  <Text style={s.cricketText}>
                    {[
                      profile.batting_style ? (profile.batting_style === 'right_hand' ? 'Right Hand Bat' : 'Left Hand Bat') : null,
                      profile.bowling_style ? profile.bowling_style.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : null,
                    ].filter(Boolean).join(' • ')}
                  </Text>
                </View>
              ) : null}
              {(profile.city || profile.state_province || profile.country) ? (
                <View style={s.cricketRow}>
                  <MaterialCommunityIcons name="map-marker-outline" size={15} color={COLORS.TEXT_MUTED} />
                  <Text style={s.cricketText}>
                    {[profile.city, profile.state_province, profile.country].filter(Boolean).join(', ')}
                  </Text>
                </View>
              ) : null}
              {profile.date_of_birth ? (
                <View style={s.cricketRow}>
                  <MaterialCommunityIcons name="cake-variant-outline" size={15} color={COLORS.TEXT_MUTED} />
                  <Text style={s.cricketText}>
                    {(() => {
                      try {
                        const d = new Date(profile.date_of_birth);
                        const age = Math.floor((Date.now() - d.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
                        return `${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} (${age} yrs)`;
                      } catch { return profile.date_of_birth; }
                    })()}
                  </Text>
                </View>
              ) : null}
            </View>
          )}

          {/* Followers/Following list */}
          {activeTab && (
            <View style={s.listSection}>
              <Text style={s.listTitle}>{activeTab === 'followers' ? 'Followers' : 'Following'}</Text>
              {listLoading ? (
                <ActivityIndicator style={{ padding: 20 }} color={COLORS.ACCENT} />
              ) : listData.length === 0 ? (
                <Text style={s.emptyList}>No {activeTab} yet</Text>
              ) : (
                listData.map((u) => (
                  <TouchableOpacity
                    key={u.id}
                    style={s.userRow}
                    onPress={() => navigation.push('UserPublicProfile', { username: u.username })}
                    activeOpacity={0.7}
                  >
                    <Avatar uri={u.profile} name={u.full_name} size={40} color={COLORS.ACCENT} />
                    <View style={s.userInfo}>
                      <Text style={s.userName}>{u.full_name}</Text>
                      {u.username && <Text style={s.userHandle}>@{u.username}</Text>}
                    </View>
                    {u.id !== currentUser?.id && (
                      <TouchableOpacity
                        style={[s.followChip, u.is_following && s.followChipActive]}
                        onPress={() => handleListFollow(u)}
                        disabled={!!listFollowLoading[u.id]}
                        activeOpacity={0.7}
                      >
                        {listFollowLoading[u.id] ? (
                          <ActivityIndicator size="small" color={u.is_following ? COLORS.TEXT_MUTED : '#fff'} />
                        ) : (
                          <Text style={[s.followChipText, u.is_following && s.followChipTextActive]}>
                            {u.is_following ? 'Following' : 'Follow'}
                          </Text>
                        )}
                      </TouchableOpacity>
                    )}
                  </TouchableOpacity>
                ))
              )}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
};

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.BG },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: COLORS.CARD, borderBottomWidth: 1, borderBottomColor: COLORS.BORDER,
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: COLORS.TEXT },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  notFound: { fontSize: 16, color: COLORS.TEXT_MUTED },
  content: { paddingBottom: 40 },

  // Hero
  hero: { alignItems: 'center', paddingVertical: 24, paddingHorizontal: 20 },
  name: { fontSize: 22, fontWeight: '800', color: COLORS.TEXT, marginTop: 14 },
  usernameText: { fontSize: 14, fontWeight: '600', color: COLORS.ACCENT, marginTop: 4 },

  // Stats
  statsRow: {
    flexDirection: 'row', alignItems: 'center', marginTop: 20,
    backgroundColor: COLORS.SURFACE, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 8,
    width: '80%',
  },
  statItem: { flex: 1, alignItems: 'center' },
  statNum: { fontSize: 20, fontWeight: '800', color: COLORS.TEXT },
  statLabel: { fontSize: 11, fontWeight: '600', color: COLORS.TEXT_MUTED, marginTop: 2 },
  statDivider: { width: 1, height: 28, backgroundColor: COLORS.BORDER },

  // Follow button
  followBtn: {
    marginTop: 16, paddingVertical: 10, paddingHorizontal: 40, borderRadius: 10,
    backgroundColor: COLORS.ACCENT,
  },
  followBtnActive: {
    backgroundColor: COLORS.SURFACE, borderWidth: 1, borderColor: COLORS.BORDER,
  },
  followBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  followBtnTextActive: { color: COLORS.TEXT },

  // Edit button
  editBtn: {
    marginTop: 16, paddingVertical: 10, paddingHorizontal: 32, borderRadius: 10,
    backgroundColor: COLORS.SURFACE, borderWidth: 1, borderColor: COLORS.BORDER,
  },
  editBtnText: { fontSize: 14, fontWeight: '600', color: COLORS.TEXT },

  // Followers/Following list
  cricketCard: {
    marginHorizontal: 16, marginTop: 16,
    backgroundColor: COLORS.CARD, borderRadius: 14,
    borderWidth: 1, borderColor: COLORS.BORDER,
    padding: 14, gap: 10,
  },
  cricketPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.ACCENT_SOFT,
    borderWidth: 1, borderColor: COLORS.ACCENT_SOFT_BORDER,
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 12,
  },
  cricketPillText: { fontSize: 11, fontWeight: '700', color: COLORS.ACCENT, textTransform: 'uppercase', letterSpacing: 0.3 },
  cricketRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  cricketText: { flex: 1, fontSize: 13, color: COLORS.TEXT_SECONDARY, lineHeight: 19 },

  listSection: { paddingHorizontal: 16, marginTop: 8 },
  listTitle: { fontSize: 16, fontWeight: '700', color: COLORS.TEXT, marginBottom: 12 },
  emptyList: { fontSize: 13, color: COLORS.TEXT_MUTED, textAlign: 'center', paddingVertical: 20 },
  userRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: COLORS.BORDER,
  },
  userInfo: { flex: 1 },
  userName: { fontSize: 14, fontWeight: '600', color: COLORS.TEXT },
  userHandle: { fontSize: 12, color: COLORS.TEXT_MUTED, marginTop: 1 },
  followChip: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8,
    backgroundColor: COLORS.ACCENT,
  },
  followChipActive: {
    backgroundColor: COLORS.SURFACE, borderWidth: 1, borderColor: COLORS.BORDER,
  },
  followChipText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  followChipTextActive: { color: COLORS.TEXT_MUTED },
});

export default UserPublicProfileScreen;
