import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, RefreshControl,
  Animated, Dimensions, InteractionManager,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../context/AuthContext';
import { usersAPI } from '../../services/api';
import { COLORS } from '../../theme';
import Icon from '../../components/Icon';
import Avatar from '../../components/Avatar';
import Skeleton, { ProfileSkeleton } from '../../components/Skeleton';
import Button from '../../components/Button';
import StatCard from '../../components/StatCard';

const { width: SW } = Dimensions.get('window');

const MENU_ITEMS = [
  { label: 'Edit Profile', icon: 'edit', color: '#2196F3', screen: 'EditProfile' },
  { label: 'My Stats', icon: 'stats', color: '#E91E63', screen: 'MyStats' },
  { label: 'Settings', icon: 'settings', color: COLORS.PURPLE, screen: 'Settings' },
  { label: 'Help & Support', icon: 'help', color: '#00BCD4', screen: 'Help' },
];

const ProfileTab = () => {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const navigation = useNavigation();
  const [stats, setStats] = useState({ created: {}, played: {} });
  const [statsLoading, setStatsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  const loadStats = async () => {
    if (!user) {
      setStats({ created: {}, played: {}, total: {} });
      setStatsLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      const res = await usersAPI.myStats();
      setStats(res.data || { created: {}, played: {} });
    } catch {}
    setStatsLoading(false);
    setRefreshing(false);
  };

  const statsLoadedRef = useRef(false);
  useFocusEffect(useCallback(() => {
    // Reload when user changes (sign-in/out)
    if (statsLoadedRef.current && user) return;
    const task = InteractionManager.runAfterInteractions(() => {
      loadStats();
      statsLoadedRef.current = true;
    });
    return () => task.cancel();
  }, [user?.id]));

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 50, friction: 8 }),
    ]).start();
  }, []);

  const initials = `${user?.first_name?.charAt(0)?.toUpperCase() || ''}${user?.last_name?.charAt(0)?.toUpperCase() || ''}`;

  // Handle both Firebase URLs (https://...) and local backend paths (/uploads/...)
  const profileImageUrl = (() => {
    const p = user?.profile;
    if (!p) return null;
    if (p.startsWith('http')) return p;
    // Local path — prepend API base URL
    const { default: apiInstance } = require('../../services/api');
    return `${apiInstance.defaults.baseURL}${p}`;
  })();

  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : 'Recently';

  // ── Guest mode: show sign-in prompt instead of profile ──
  if (!user) {
    return (
      <ScrollView
        style={[s.container, { paddingTop: insets.top }]}
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 20, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }], alignItems: 'center' }}>
          <LinearGradient colors={[COLORS.BG_DEEP, '#1E293B', COLORS.BG_DEEP]} style={s.guestHero}>
            <View style={s.guestIconCircle}>
              <Icon name="profile" size={40} color={COLORS.ACCENT} />
            </View>
            <Text style={s.guestTitle}>Welcome to CrecKStars</Text>
            <Text style={s.guestSub}>
              Sign in to create matches, track your stats, build teams, and connect with the cricket community.
            </Text>

            <Button
              variant="primary"
              size="md"
              fullWidth
              label="Sign In"
              onPress={() => navigation.navigate('Login')}
              style={{ marginBottom: 10 }}
            />
            <Button
              variant="outline"
              size="md"
              fullWidth
              label="Create Account"
              onPress={() => navigation.navigate('Register')}
            />
          </LinearGradient>

          <View style={s.guestFeatureList}>
            {[
              { icon: 'cricket', label: 'Score live matches ball-by-ball' },
              { icon: 'trophy', label: 'Organize tournaments & leaderboards' },
              { icon: 'team', label: 'Build teams and invite players' },
              { icon: 'stats', label: 'Track your career stats' },
              { icon: 'community', label: 'Post & discuss in the community' },
            ].map((f, i) => (
              <View key={i} style={s.guestFeatureRow}>
                <View style={s.guestFeatureIconWrap}>
                  <Icon name={f.icon} size={16} color={COLORS.ACCENT} />
                </View>
                <Text style={s.guestFeatureText}>{f.label}</Text>
              </View>
            ))}
          </View>
        </Animated.View>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={[s.container, { paddingTop: insets.top }]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadStats(); }} tintColor={COLORS.ACCENT} />
      }
    >
      <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>

        {/* ── Hero Profile Header ── */}
        <LinearGradient colors={['#0F172A', '#1E293B', '#0F172A']} style={s.hero}>
          {/* Avatar */}
          <View style={s.avatarWrap}>
            <Avatar
              uri={profileImageUrl}
              name={user?.full_name || `${user?.first_name || ''} ${user?.last_name || ''}`}
              size={82}
              color={COLORS.ACCENT}
              showRing
            />
            {(stats.created?.matches_live || 0) > 0 && (
              <View style={s.liveBadge}>
                <View style={s.liveDot} />
                <Text style={s.liveText}>{stats.created.matches_live} LIVE</Text>
              </View>
            )}
          </View>

          {/* Name & Username */}
          <Text style={s.name}>{user?.full_name || `${user?.first_name || ''} ${user?.last_name || ''}`.trim() || 'Player'}</Text>
          {user?.username && (
            <Text style={s.username}>@{user.username}</Text>
          )}

          {/* Followers / Following */}
          <View style={s.followRow}>
            <TouchableOpacity style={s.followItem} activeOpacity={0.7}
              onPress={() => user?.username && (user?.followers_count || 0) > 0 && navigation.navigate('UserPublicProfile', { username: user.username, initialTab: 'followers' })}>
              <Text style={s.followNum}>{user?.followers_count || 0}</Text>
              <Text style={s.followLabel}>Followers</Text>
            </TouchableOpacity>
            <View style={s.followDivider} />
            <TouchableOpacity style={s.followItem} activeOpacity={0.7}
              onPress={() => user?.username && (user?.following_count || 0) > 0 && navigation.navigate('UserPublicProfile', { username: user.username, initialTab: 'following' })}>
              <Text style={s.followNum}>{user?.following_count || 0}</Text>
              <Text style={s.followLabel}>Following</Text>
            </TouchableOpacity>
          </View>

          <View style={s.infoRow}>
            {user?.mobile && (
              <View style={s.infoPill}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Icon name="phone" size={12} color={COLORS.TEXT_SECONDARY} />
                  <Text style={s.infoPillText}>{user.mobile}</Text>
                </View>
              </View>
            )}
            {user?.email && (
              <View style={s.infoPill}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Icon name="email" size={12} color={COLORS.TEXT_SECONDARY} />
                  <Text style={s.infoPillText}>{user.email}</Text>
                </View>
              </View>
            )}
          </View>
          <Text style={s.memberSince}>Member since {memberSince}</Text>

          {/* Stats Grid — Combined totals */}
          <View style={s.statsGrid}>
            {statsLoading ? (
              [1,2,3,4].map(i => (
                <View key={i} style={s.statBox}>
                  <Skeleton width={18} height={18} borderRadius={9} style={{ marginBottom: 4 }} />
                  <Skeleton width={30} height={22} style={{ marginTop: 2 }} />
                  <Skeleton width={50} height={9} style={{ marginTop: 4 }} />
                </View>
              ))
            ) : (
              [
                { value: stats.total?.matches || 0, label: 'Matches', icon: 'cricket', color: COLORS.INDIGO, bg: 'rgba(99,102,241,0.15)' },
                { value: stats.total?.completed || 0, label: 'Completed', icon: 'check-circle', color: COLORS.SUCCESS_LIGHT, bg: 'rgba(34,197,94,0.15)' },
                { value: stats.total?.teams || 0, label: 'Teams', icon: 'account-group', color: COLORS.WARNING_LIGHT, bg: 'rgba(245,158,11,0.15)' },
                { value: stats.total?.tournaments || 0, label: 'Tournaments', icon: 'trophy', color: COLORS.PURPLE, bg: 'rgba(236,72,153,0.15)' },
              ].map((st, i) => (
                <StatCard
                  key={i}
                  value={st.value}
                  label={st.label}
                  icon={st.icon}
                  color={st.color}
                  bg={st.bg}
                  size="md"
                />
              ))
            )}
          </View>
        </LinearGradient>

        {/* ── Menu Items ── */}
        <View style={s.menuCard}>
          {MENU_ITEMS.map((item, index) => (
            <React.Fragment key={item.label}>
              {index > 0 && <View style={s.menuDivider} />}
              <TouchableOpacity style={s.menuItem} activeOpacity={0.6} onPress={() => navigation.navigate(item.screen)}>
                <View style={[s.menuIconBg, { backgroundColor: item.color + '18' }]}>
                  <Icon name={item.icon} size={18} color={item.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.menuText}>{item.label}</Text>
                </View>
                <Text style={s.menuArrow}>{'\u203A'}</Text>
              </TouchableOpacity>
            </React.Fragment>
          ))}
        </View>

        {/* ── App Info ── */}
        <View style={s.appInfoCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Icon name="cricket" size={20} color={COLORS.ACCENT} />
            <Text style={s.appName}>CrecKStars</Text>
          </View>
          <Text style={s.appVersion}>Version 1.0.0</Text>
          <Text style={s.appTagline}>Your Cricket Companion</Text>
        </View>

        {/* ── Sign Out ── */}
        <TouchableOpacity style={s.logoutBtn} onPress={logout} activeOpacity={0.8}>
          <Icon name="logout" size={16} color={COLORS.DANGER} />
          <Text style={s.logoutText}>Sign Out</Text>
        </TouchableOpacity>

        <View style={{ height: 120 }} />
      </Animated.View>
    </ScrollView>
  );
};

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.BG },

  // Hero
  hero: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24, alignItems: 'center' },
  avatarWrap: { alignItems: 'center', marginBottom: 14 },
  liveBadge: {
    position: 'absolute', bottom: -4, flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.LIVE, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10,
  },
  liveDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#fff' },
  liveText: { fontSize: 8, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },

  name: { fontSize: 24, fontWeight: '900', color: COLORS.TEXT, textAlign: 'center' },
  username: { fontSize: 14, fontWeight: '600', color: COLORS.ACCENT, textAlign: 'center', marginTop: 2 },
  followRow: {
    flexDirection: 'row', alignItems: 'center', marginTop: 12,
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 24,
  },
  followItem: { flex: 1, alignItems: 'center' },
  followNum: { fontSize: 18, fontWeight: '800', color: COLORS.TEXT },
  followLabel: { fontSize: 10, fontWeight: '600', color: COLORS.TEXT_MUTED, marginTop: 2 },
  followDivider: { width: 1, height: 24, backgroundColor: COLORS.BORDER },
  infoRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 8 },
  infoPill: { backgroundColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  infoPillText: { fontSize: 11, color: COLORS.TEXT_SECONDARY, fontWeight: '500' },
  memberSince: { fontSize: 11, color: COLORS.TEXT_MUTED, marginTop: 6, fontWeight: '500' },

  // Stats Grid
  statsGrid: { flexDirection: 'row', gap: 10, marginTop: 20, width: '100%' },
  // Loader skeleton placeholder shape (matches StatCard outer dimensions)
  statBox: {
    flex: 1, backgroundColor: COLORS.WHITE_06, borderRadius: 14, paddingVertical: 12, alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.WHITE_06,
  },

  // Menu
  menuCard: {
    backgroundColor: COLORS.CARD, marginHorizontal: 20, marginTop: 16, borderRadius: 18, overflow: 'hidden',
    borderWidth: 1, borderColor: COLORS.BORDER,
  },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, paddingHorizontal: 16, gap: 14 },
  menuIconBg: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  // menuEmoji style removed — replaced with Icon component
  menuText: { fontSize: 15, color: COLORS.TEXT, fontWeight: '600' },
  menuArrow: { fontSize: 22, color: COLORS.TEXT_MUTED },
  menuDivider: { height: 1, backgroundColor: COLORS.BORDER, marginLeft: 68 },

  // App Info
  appInfoCard: {
    alignItems: 'center', marginHorizontal: 20, marginTop: 24, paddingVertical: 20,
    backgroundColor: COLORS.CARD, borderRadius: 16, borderWidth: 1, borderColor: COLORS.BORDER,
  },
  appName: { fontSize: 18, fontWeight: '800', color: COLORS.TEXT },
  appVersion: { fontSize: 11, color: COLORS.TEXT_MUTED, marginTop: 4 },
  appTagline: { fontSize: 12, color: COLORS.TEXT_SECONDARY, fontWeight: '500', marginTop: 2, fontStyle: 'italic' },

  // Logout
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.CARD, marginHorizontal: 20, marginTop: 16, borderRadius: 14, paddingVertical: 14,
    borderWidth: 1, borderColor: COLORS.DANGER + '50',
  },
  // logoutIcon style removed — replaced with Icon component
  logoutText: { color: COLORS.DANGER, fontSize: 15, fontWeight: '700' },

  // Guest mode
  guestHero: {
    width: '100%', alignItems: 'center', paddingVertical: 32, paddingHorizontal: 24,
    borderRadius: 20, borderWidth: 1, borderColor: COLORS.BORDER,
  },
  guestIconCircle: {
    width: 82, height: 82, borderRadius: 41, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(30,136,229,0.14)', marginBottom: 16,
    borderWidth: 2, borderColor: 'rgba(30,136,229,0.35)',
  },
  guestTitle: { fontSize: 22, fontWeight: '900', color: COLORS.TEXT, textAlign: 'center' },
  guestSub: {
    fontSize: 13, color: COLORS.TEXT_SECONDARY, textAlign: 'center',
    marginTop: 8, marginBottom: 24, lineHeight: 20, paddingHorizontal: 8,
  },
  guestFeatureList: {
    width: '100%', marginTop: 24, backgroundColor: COLORS.CARD, borderRadius: 16,
    padding: 16, borderWidth: 1, borderColor: COLORS.BORDER,
  },
  guestFeatureRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 12,
  },
  guestFeatureIconWrap: {
    width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(30,136,229,0.12)',
  },
  guestFeatureText: { flex: 1, fontSize: 13, color: COLORS.TEXT_SECONDARY, fontWeight: '500' },
});

export default ProfileTab;
