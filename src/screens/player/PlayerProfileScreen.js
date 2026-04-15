import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Animated,
  InteractionManager,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { playersAPI, usersAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { COLORS } from '../../theme';
import BackButton from '../../components/BackButton';
import Icon from '../../components/Icon';
import Avatar from '../../components/Avatar';
import Skeleton from '../../components/Skeleton';
import { MaterialCommunityIcons } from '@expo/vector-icons';

// Color coding helper for stat values
const getStatColor = (key, val) => {
  const num = typeof val === 'number' ? val : parseFloat(val);
  if (isNaN(num)) return COLORS.TEXT;
  if (key === 'SR' && num > 150) return COLORS.SUCCESS_LIGHT;
  if (key === 'SR' && num < 100 && num > 0) return COLORS.WARNING_LIGHT;
  if (key === 'Avg' && num > 40) return COLORS.SUCCESS_LIGHT;
  if (key === 'Econ' && num > 0 && num < 6) return COLORS.SUCCESS_LIGHT;
  if (key === 'Econ' && num > 10) return COLORS.LIVE;
  return COLORS.TEXT;
};

// ── Skeleton placeholder while player stats load ──
const PlayerProfileSkeleton = ({ insets, onBack }) => (
  <View style={[s.container, { paddingTop: insets.top }]}>
    <View style={s.header}>
      <BackButton onPress={onBack} />
      <Text style={s.headerTitle}>Player Profile</Text>
      <View style={{ width: 36 }} />
    </View>
    <View style={{ flex: 1 }}>
      {/* Hero skeleton */}
      <LinearGradient colors={['#0F172A', '#1E293B', '#0F172A']} style={s.hero}>
        <Skeleton width={88} height={88} borderRadius={44} />
        <Skeleton width={180} height={22} style={{ marginTop: 14 }} />
        <Skeleton width={120} height={14} style={{ marginTop: 8 }} />
        <Skeleton width={100} height={28} borderRadius={14} style={{ marginTop: 14 }} />
        <Skeleton width={140} height={36} borderRadius={18} style={{ marginTop: 16 }} />
      </LinearGradient>

      {/* Info card skeleton */}
      <View style={s.infoCard}>
        <View style={s.infoRow}>
          <Skeleton width={16} height={16} borderRadius={8} />
          <Skeleton width="80%" height={14} style={{ marginLeft: 10 }} />
        </View>
        <View style={s.infoRow}>
          <Skeleton width={16} height={16} borderRadius={8} />
          <Skeleton width="60%" height={14} style={{ marginLeft: 10 }} />
        </View>
        <View style={s.infoRow}>
          <Skeleton width={16} height={16} borderRadius={8} />
          <Skeleton width="50%" height={14} style={{ marginLeft: 10 }} />
        </View>
      </View>

      {/* Stats toggle skeleton */}
      <View style={s.section}>
        <Skeleton width="100%" height={44} borderRadius={14} />
      </View>

      {/* Primary stats row (3 cards) */}
      <View style={[s.section, { marginTop: 14 }]}>
        <View style={s.primaryRow}>
          <Skeleton width="32%" height={110} borderRadius={16} />
          <Skeleton width="32%" height={110} borderRadius={16} />
          <Skeleton width="32%" height={110} borderRadius={16} />
        </View>
      </View>

      {/* Detail rows skeleton */}
      <View style={[s.section, { marginTop: 14 }]}>
        <View style={s.detailsCard}>
          {[0, 1, 2, 3].map(i => (
            <View key={i} style={[s.detailRow, i === 3 && { borderBottomWidth: 0 }]}>
              <View style={s.detailLeft}>
                <Skeleton width={34} height={34} borderRadius={10} />
                <View style={{ marginLeft: 12 }}>
                  <Skeleton width={110} height={14} />
                  <Skeleton width={70} height={10} style={{ marginTop: 4 }} />
                </View>
              </View>
              <Skeleton width={40} height={20} borderRadius={4} />
            </View>
          ))}
        </View>
      </View>
    </View>
  </View>
);

const PlayerProfileScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const { user: currentUser } = useAuth();
  const { playerId } = route.params;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeFormat, setActiveFormat] = useState('Overall');
  const [statsTab, setStatsTab] = useState('batting'); // batting | bowling — drives both Stats + Recent Form
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [localFollowerDelta, setLocalFollowerDelta] = useState(0);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const formatFadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => { loadStats(); });
    return () => task.cancel();
  }, []);

  const loadStats = async () => {
    try {
      const res = await playersAPI.stats(playerId);
      setData(res.data);
      // Follow status computed by backend — single call, no second lookup
      setIsFollowing(!!res.data?.is_following);
      if (res.data?.player?.role === 'bowler') {
        setStatsTab('bowling');
      }
    } catch {
      // stats fetch failed — empty state handled below
    } finally { setLoading(false); }
  };

  const handleFollow = async () => {
    if (followLoading || !data?.player?.user_id) return;
    const targetUserId = data.player.user_id;
    setFollowLoading(true);
    const wasFollowing = isFollowing;
    // Optimistic update
    setIsFollowing(!wasFollowing);
    setLocalFollowerDelta((d) => d + (wasFollowing ? -1 : 1));
    try {
      if (wasFollowing) await usersAPI.unfollow(targetUserId);
      else await usersAPI.follow(targetUserId);
    } catch {
      // Revert on failure
      setIsFollowing(wasFollowing);
      setLocalFollowerDelta((d) => d + (wasFollowing ? 1 : -1));
    } finally {
      setFollowLoading(false);
    }
  };

  useEffect(() => {
    if (!loading && data) {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 50, friction: 8 }),
      ]).start();
    }
  }, [loading, data]);

  const handleFormatChange = (format) => {
    if (format === activeFormat) return;
    Animated.timing(formatFadeAnim, { toValue: 0, duration: 120, useNativeDriver: true }).start(() => {
      setActiveFormat(format);
      Animated.timing(formatFadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    });
  };

  if (loading) return <PlayerProfileSkeleton insets={insets} onBack={() => navigation.goBack()} />;

  if (!data) return (
    <View style={s.center}>
      <Icon name="cricket" size={40} color={COLORS.TEXT_MUTED} />
      <Text style={s.notFoundText}>Player not found</Text>
      <TouchableOpacity onPress={() => navigation.goBack()} style={s.goBackBtn}>
        <Text style={s.goBackText}><MaterialCommunityIcons name="chevron-left" size={16} color={COLORS.ACCENT} /> Go Back</Text>
      </TouchableOpacity>
    </View>
  );

  const { player, batting, bowling, matches_played, teams, recent_innings, recent_bowling, format_stats } = data;
  const formats = ['Overall', ...Object.keys(format_stats || {}).sort()];

  const getActiveBatting = () => activeFormat === 'Overall' ? batting : (format_stats?.[activeFormat]?.batting || {});
  const getActiveBowling = () => activeFormat === 'Overall' ? bowling : (format_stats?.[activeFormat]?.bowling || {});
  const activeMatches = activeFormat === 'Overall' ? matches_played : (format_stats?.[activeFormat]?.matches ?? 0);
  const activeBat = getActiveBatting();
  const activeBowl = getActiveBowling();

  const hasBattingData = (activeBat?.innings ?? 0) > 0;
  const hasBowlingData = (activeBowl?.innings ?? 0) > 0;
  const hasFormatData = activeFormat === 'Overall' || format_stats?.[activeFormat];

  const getRoleIconName = (role) => {
    switch (role) {
      case 'batsman': return 'batsman';
      case 'bowler': return 'bowler';
      case 'all_rounder': return 'allRounder';
      case 'wicket_keeper': return 'wicketKeeper';
      default: return 'batsman';
    }
  };

  const getRoleLabel = (role) => {
    if (!role) return 'Player';
    return role.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  };

  const getBatStyleLabel = (style) => style === 'right_hand' ? 'Right Hand Bat' : style === 'left_hand' ? 'Left Hand Bat' : null;
  const getBowlStyleLabel = (style) => style ? style.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : null;

  const teamName = teams?.length > 0 ? teams[0].name : null;
  const teamColor = teams?.length > 0 && teams[0].color ? teams[0].color : COLORS.ACCENT;

  // Recent form — filter by format, dedupe by match_id (a player can have
  // multiple scorecards for the same match via super overs / second innings),
  // then take last 5.
  const matchesFormat = (entry) => {
    if (activeFormat === 'Overall') return true;
    const f = entry.format || entry.match_format;
    return f === activeFormat;
  };
  const dedupeByMatch = (list) => {
    const seen = new Set();
    const out = [];
    for (const item of list) {
      if (item.match_id == null || seen.has(item.match_id)) continue;
      seen.add(item.match_id);
      out.push(item);
    }
    return out;
  };
  const filteredBattingForm = dedupeByMatch((recent_innings || []).filter(matchesFormat)).slice(0, 5);
  const filteredBowlingForm = dedupeByMatch((recent_bowling || []).filter(matchesFormat)).slice(0, 5);

  const formatDate = (dateStr) => {
    if (!dateStr) return null;
    try {
      const d = new Date(dateStr);
      return `${d.getDate()}/${d.getMonth() + 1}`;
    } catch { return null; }
  };

  const fmtOvers = (ov) => {
    if (ov == null) return 0;
    const rounded = Math.round(ov * 10) / 10;
    return rounded % 1 === 0 ? Math.floor(rounded) : rounded.toFixed(1);
  };

  const fmtDec = (val) => {
    if (val == null || val === '-') return '-';
    return typeof val === 'number' ? val.toFixed(2) : val;
  };

  // === NEW: Hero primary stats (big 3-card row) — unified ACCENT palette ===
  const battingPrimary = [
    { label: 'Runs', value: activeBat?.runs ?? 0, icon: 'run-fast' },
    { label: 'Average', value: fmtDec(activeBat?.average), icon: 'chart-line' },
    { label: 'Strike Rate', value: fmtDec(activeBat?.strike_rate), icon: 'speedometer' },
  ];

  const bowlingPrimary = [
    { label: 'Wickets', value: activeBowl?.wickets ?? 0, icon: 'target' },
    { label: 'Economy', value: fmtDec(activeBowl?.economy), icon: 'gauge' },
    { label: 'Best', value: activeBowl?.best ?? '-', icon: 'trophy' },
  ];

  // === NEW: Secondary detailed stats as rows (not grid) — no per-row colors ===
  const battingDetails = [
    { k: 'Innings', v: activeBat?.innings ?? 0, icon: 'numeric', hint: 'batted' },
    { k: 'Highest Score', v: activeBat?.highest ?? '-', icon: 'trophy-outline', hint: 'career best', highlight: true },
    { k: 'Not Outs', v: activeBat?.not_outs ?? 0, icon: 'shield-check-outline', hint: 'dismissals avoided' },
    { k: 'Fours', v: activeBat?.fours ?? 0, icon: 'numeric-4-box', hint: 'boundaries' },
    { k: 'Sixes', v: activeBat?.sixes ?? 0, icon: 'numeric-6-box', hint: 'maximums' },
    { k: 'Fifties', v: activeBat?.fifties ?? 0, icon: 'medal-outline', hint: '50+ scores' },
    { k: 'Hundreds', v: activeBat?.hundreds ?? 0, icon: 'medal', hint: 'centuries', highlight: true },
  ];

  const bowlingDetails = [
    { k: 'Innings', v: activeBowl?.innings ?? 0, icon: 'numeric', hint: 'bowled' },
    { k: 'Overs', v: fmtOvers(activeBowl?.overs), icon: 'timer-outline', hint: 'total delivered' },
    { k: 'Runs Conceded', v: activeBowl?.runs_conceded ?? 0, icon: 'arrow-up-right', hint: 'given away' },
    { k: 'Maidens', v: activeBowl?.maidens ?? 0, icon: 'shield-star', hint: 'dot overs', highlight: true },
    { k: 'Average', v: fmtDec(activeBowl?.average), icon: 'chart-line-variant', hint: 'runs per wicket' },
  ];

  const activeDetails = statsTab === 'batting' ? battingDetails : bowlingDetails;
  const activePrimary = statsTab === 'batting' ? battingPrimary : bowlingPrimary;
  const hasActiveData = statsTab === 'batting' ? hasBattingData : hasBowlingData;

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text style={s.headerTitle}>Player Profile</Text>
        <View style={{ width: 36 }} />
      </View>

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* -- Hero Card -- */}
        <LinearGradient colors={['#0F172A', '#1E293B', '#0F172A']} style={s.hero}>
          <Avatar
            uri={player.profile_image}
            name={player.full_name || `${player.first_name || ''} ${player.last_name || ''}`}
            size={88}
            color={teamColor}
            showRing
            type="player"
          />

          <Text style={s.playerName}>{player.full_name}</Text>
          {player.username && (
            <Text style={s.playerUsername}>@{player.username}</Text>
          )}

          <View style={s.badgeRow}>
            <View style={[s.roleBadge, { backgroundColor: COLORS.ACCENT_SOFT }]}>
              <Icon name={getRoleIconName(player.role)} size={14} color={COLORS.ACCENT} />
              <Text style={[s.roleBadgeText, { color: COLORS.ACCENT }]}>{getRoleLabel(player.role)}</Text>
            </View>
          </View>

          {/* Follow / Unfollow — backend tells us is_self so we don't guess */}
          {player.user_id && !data?.is_self && (
            <TouchableOpacity
              style={[s.followBtn, isFollowing && s.followBtnActive]}
              onPress={handleFollow}
              disabled={followLoading}
              activeOpacity={0.8}
            >
              {followLoading ? (
                <ActivityIndicator size="small" color={isFollowing ? COLORS.TEXT : '#fff'} />
              ) : (
                <>
                  <MaterialCommunityIcons
                    name={isFollowing ? 'account-check' : 'account-plus'}
                    size={14}
                    color={isFollowing ? COLORS.TEXT : '#fff'}
                  />
                  <Text style={[s.followBtnText, isFollowing && s.followBtnTextActive]}>
                    {isFollowing ? 'Following' : 'Follow'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {/* Format Tabs */}
          {formats.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.formatRow}>
              {formats.map(f => (
                <TouchableOpacity
                  key={f}
                  style={[s.formatTab, activeFormat === f && s.formatTabActive]}
                  onPress={() => handleFormatChange(f)}
                  activeOpacity={0.7}
                >
                  <Text style={[s.formatTabText, activeFormat === f && s.formatTabTextActive]}>{f}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </LinearGradient>

        {/* -- Player Info -- */}
        {(player.bio || player.city || player.country || player.date_of_birth ||
          player.batting_style || player.bowling_style || player.followers_count > 0 || player.following_count > 0) && (
          <View style={s.infoCard}>
            {/* Social stats — followers / following (only when linked to a user) */}
            {player.username && (
              <View style={s.socialRow}>
                <View style={s.socialItem}>
                  <Text style={s.socialNum}>{Math.max(0, (player.followers_count || 0) + localFollowerDelta)}</Text>
                  <Text style={s.socialLabel}>Followers</Text>
                </View>
                <View style={s.socialDivider} />
                <View style={s.socialItem}>
                  <Text style={s.socialNum}>{player.following_count || 0}</Text>
                  <Text style={s.socialLabel}>Following</Text>
                </View>
              </View>
            )}

            {/* Bio */}
            {player.bio ? (
              <View style={s.infoRow}>
                <MaterialCommunityIcons name="information-outline" size={16} color={COLORS.ACCENT} />
                <Text style={s.infoText}>{player.bio}</Text>
              </View>
            ) : null}

            {/* Batting + Bowling style */}
            {(getBatStyleLabel(player.batting_style) || getBowlStyleLabel(player.bowling_style)) && (
              <View style={s.infoRow}>
                <MaterialCommunityIcons name="bat" size={16} color={COLORS.ACCENT} />
                <Text style={s.infoText}>
                  {[
                    getBatStyleLabel(player.batting_style),
                    getBowlStyleLabel(player.bowling_style),
                  ].filter(Boolean).join(' • ')}
                </Text>
              </View>
            )}

            {/* Location */}
            {(player.city || player.state_province || player.country) && (
              <View style={s.infoRow}>
                <MaterialCommunityIcons name="map-marker-outline" size={16} color={COLORS.ACCENT} />
                <Text style={s.infoText}>
                  {[player.city, player.state_province, player.country].filter(Boolean).join(', ')}
                </Text>
              </View>
            )}

            {/* Date of Birth + age */}
            {player.date_of_birth && (
              <View style={s.infoRow}>
                <MaterialCommunityIcons name="cake-variant-outline" size={16} color={COLORS.ACCENT} />
                <Text style={s.infoText}>
                  {(() => {
                    const dob = new Date(player.date_of_birth);
                    const age = Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
                    return `${dob.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} (${age} yrs)`;
                  })()}
                </Text>
              </View>
            )}

            {/* Player ID — always visible for admins / reference */}
            <View style={s.infoRow}>
              <MaterialCommunityIcons name="identifier" size={16} color={COLORS.TEXT_MUTED} />
              <Text style={[s.infoText, { color: COLORS.TEXT_MUTED, fontSize: 12 }]}>Player ID #{player.id}</Text>
            </View>
          </View>
        )}

        {/* ===== NEW STATS SECTION ===== */}
        {hasFormatData && (
          <View style={s.section}>
            {/* Batting/Bowling toggle — big, prominent */}
            <View style={s.statsToggleRow}>
              <TouchableOpacity
                style={[s.statsToggleBtn, statsTab === 'batting' && s.statsToggleBtnActive]}
                onPress={() => setStatsTab('batting')}
                activeOpacity={0.7}
              >
                <Icon name="batsman" size={16} color={statsTab === 'batting' ? '#fff' : COLORS.TEXT_MUTED} />
                <Text style={[s.statsToggleText, statsTab === 'batting' && s.statsToggleTextActive]}>Batting</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.statsToggleBtn, statsTab === 'bowling' && s.statsToggleBtnActive]}
                onPress={() => setStatsTab('bowling')}
                activeOpacity={0.7}
              >
                <Icon name="bowler" size={16} color={statsTab === 'bowling' ? '#fff' : COLORS.TEXT_MUTED} />
                <Text style={[s.statsToggleText, statsTab === 'bowling' && s.statsToggleTextActive]}>Bowling</Text>
              </TouchableOpacity>
            </View>

            {hasActiveData ? (
              <Animated.View style={{ opacity: formatFadeAnim }}>
                {/* PRIMARY STATS — 3 cards, unified theme look */}
                <View style={s.primaryRow}>
                  {activePrimary.map((stat, i) => (
                    <View key={i} style={s.primaryCard}>
                      <View style={s.primaryIconWrap}>
                        <MaterialCommunityIcons name={stat.icon} size={18} color={COLORS.ACCENT} />
                      </View>
                      <Text style={s.primaryValue} numberOfLines={1} adjustsFontSizeToFit>{stat.value}</Text>
                      <Text style={s.primaryLabel}>{stat.label}</Text>
                    </View>
                  ))}
                </View>

                {/* SECONDARY DETAILED STATS — 2-column row list */}
                <View style={s.detailsCard}>
                  {activeDetails.map((item, i) => {
                    const valueColor = item.highlight ? COLORS.ACCENT : COLORS.TEXT;
                    const iconColor = item.highlight ? COLORS.ACCENT : COLORS.TEXT_SECONDARY;
                    return (
                      <View
                        key={i}
                        style={[
                          s.detailRow,
                          i === activeDetails.length - 1 && { borderBottomWidth: 0 },
                        ]}
                      >
                        <View style={s.detailLeft}>
                          <View style={[s.detailIconWrap, item.highlight && { backgroundColor: COLORS.ACCENT_SOFT }]}>
                            <MaterialCommunityIcons name={item.icon} size={16} color={iconColor} />
                          </View>
                          <View>
                            <Text style={s.detailKey}>{item.k}</Text>
                            <Text style={s.detailHint}>{item.hint}</Text>
                          </View>
                        </View>
                        <Text style={[s.detailValue, { color: valueColor }]}>{item.v}</Text>
                      </View>
                    );
                  })}
                </View>
              </Animated.View>
            ) : (
              <View style={s.emptySection}>
                <Icon name={statsTab === 'batting' ? 'batsman' : 'bowler'} size={28} color={COLORS.TEXT_MUTED} />
                <Text style={s.emptySectionText}>No {statsTab} data yet</Text>
              </View>
            )}
          </View>
        )}

        {!hasFormatData && (
          <View style={s.section}>
            <View style={s.emptySection}>
              <Icon name="cricket" size={28} color={COLORS.TEXT_MUTED} />
              <Text style={s.emptySectionText}>No data for this format</Text>
            </View>
          </View>
        )}

        {/* -- Recent Form — driven by top Stats toggle + active format -- */}
        <View style={s.section}>
          <View style={s.sectionHead}>
            <MaterialCommunityIcons name="fire" size={18} color={COLORS.ACCENT} />
            <Text style={s.sectionTitle}>Recent {statsTab === 'batting' ? 'Batting' : 'Bowling'} Form</Text>
            {activeFormat !== 'Overall' && (
              <View style={s.formatChip}>
                <Text style={s.formatChipText}>{activeFormat}</Text>
              </View>
            )}
          </View>

          {statsTab === 'batting' ? (
            filteredBattingForm.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                {filteredBattingForm.map((inn, idx) => {
                  const isWin = inn.result === 'W' || inn.result === 'win';
                  const isLoss = inn.result === 'L' || inn.result === 'loss';
                  const resultColor = isWin ? COLORS.SUCCESS_LIGHT : isLoss ? COLORS.LIVE : COLORS.TEXT_MUTED;
                  const resultLabel = isWin ? 'W' : isLoss ? 'L' : (inn.result || '-');
                  const dateStr = formatDate(inn.date || inn.match_date);
                  return (
                    <TouchableOpacity
                      key={inn.match_id ?? `b${idx}`}
                      style={s.formCard}
                      activeOpacity={0.7}
                      onPress={() => inn.match_id && navigation.navigate('MatchDetail', { matchId: inn.match_id })}
                    >
                      <LinearGradient colors={['#1E293B', '#0F172A']} style={s.formCardInner}>
                        {(inn.format || inn.match_format) && (
                          <View style={s.formFormatBadge}>
                            <Text style={s.formFormatText}>{inn.format || inn.match_format}</Text>
                          </View>
                        )}
                        <View style={[s.formResult, { backgroundColor: resultColor }]}>
                          <Text style={s.formResultText}>{resultLabel}</Text>
                        </View>
                        <Text style={s.formScore}>
                          {inn.runs ?? 0}{inn.is_out ? '' : '*'}
                        </Text>
                        <Text style={s.formBalls}>({inn.balls_faced ?? 0}b)</Text>
                        {(inn.opponent || inn.opponent_team) && (
                          <Text style={s.formOpp} numberOfLines={1}>vs {inn.opponent || inn.opponent_team}</Text>
                        )}
                        <Text style={s.formDate}>{dateStr || (inn.match_code ? `#${inn.match_code}` : `#${inn.match_id}`)}</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            ) : (
              <View style={s.emptySection}>
                <Icon name="batsman" size={24} color={COLORS.TEXT_MUTED} />
                <Text style={s.emptySectionText}>
                  {activeFormat === 'Overall' ? 'No recent batting data' : `No batting data in ${activeFormat}`}
                </Text>
              </View>
            )
          ) : (
            filteredBowlingForm.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                {filteredBowlingForm.map((spell, idx) => {
                  const wickets = spell.wickets || 0;
                  const runs = spell.runs || 0;
                  const overs = fmtOvers(spell.overs);
                  const highlightColor = wickets >= 3 ? COLORS.ACCENT : wickets >= 1 ? COLORS.SUCCESS_LIGHT : COLORS.TEXT_MUTED;
                  const dateStr = formatDate(spell.match_date);
                  return (
                    <TouchableOpacity
                      key={spell.match_id ?? `w${idx}`}
                      style={s.formCard}
                      activeOpacity={0.7}
                      onPress={() => spell.match_id && navigation.navigate('MatchDetail', { matchId: spell.match_id })}
                    >
                      <LinearGradient colors={['#1E293B', '#0F172A']} style={s.formCardInner}>
                        {spell.match_format && (
                          <View style={s.formFormatBadge}>
                            <Text style={s.formFormatText}>{spell.match_format}</Text>
                          </View>
                        )}
                        <View style={[s.formResult, { backgroundColor: highlightColor }]}>
                          <Text style={s.formResultText}>{wickets}W</Text>
                        </View>
                        <Text style={s.formScore}>{wickets}/{runs}</Text>
                        <Text style={s.formBalls}>({overs} ov)</Text>
                        {spell.economy > 0 && (
                          <Text style={[s.formOpp, { color: spell.economy < 6 ? COLORS.SUCCESS_LIGHT : spell.economy > 10 ? COLORS.LIVE : COLORS.TEXT_MUTED }]}>
                            Econ {fmtDec(spell.economy)}
                          </Text>
                        )}
                        {spell.opponent_team && (
                          <Text style={s.formOpp} numberOfLines={1}>vs {spell.opponent_team}</Text>
                        )}
                        <Text style={s.formDate}>{dateStr || (spell.match_code ? `#${spell.match_code}` : `#${spell.match_id}`)}</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            ) : (
              <View style={s.emptySection}>
                <Icon name="bowler" size={24} color={COLORS.TEXT_MUTED} />
                <Text style={s.emptySectionText}>
                  {activeFormat === 'Overall' ? 'No recent bowling data' : `No bowling data in ${activeFormat}`}
                </Text>
              </View>
            )
          )}
        </View>

        {/* -- Teams -- */}
        {teams?.length > 0 && (
          <View style={s.section}>
            <View style={s.sectionHead}>
              <Icon name="team" size={18} color={COLORS.ACCENT_LIGHT} />
              <Text style={s.sectionTitle}>Teams</Text>
            </View>
            <View style={{ gap: 8 }}>
              {teams.map((t, i) => {
                const tColor = t.color || COLORS.ACCENT;
                return (
                  <TouchableOpacity
                    key={i}
                    style={s.teamCard}
                    activeOpacity={0.7}
                    onPress={() => t.id && navigation.navigate('TeamDetail', { teamId: t.id })}
                  >
                    <View style={[s.teamStripe, { backgroundColor: tColor }]} />
                    <View style={[s.teamAvatar, { backgroundColor: tColor + '22' }]}>
                      <Text style={[s.teamAvatarText, { color: tColor }]}>
                        {(t.short_name || t.name || '?').charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.teamCardName}>{t.name}</Text>
                      <View style={s.teamMeta}>
                        {t.short_name && <Text style={s.teamCardShort}>{t.short_name}</Text>}
                        {t.player_count != null && (
                          <Text style={s.teamPlayerCount}>
                            {t.player_count} player{t.player_count !== 1 ? 's' : ''}
                          </Text>
                        )}
                      </View>
                    </View>
                    <MaterialCommunityIcons name="chevron-right" size={20} color={COLORS.TEXT_MUTED} />
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}
      </Animated.ScrollView>
    </View>
  );
};

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.BG },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.BG, gap: 12 },
  loadText: { color: COLORS.TEXT_MUTED, fontSize: 13, marginTop: 8 },
  notFoundText: { fontSize: 16, fontWeight: '700', color: COLORS.TEXT },
  goBackBtn: { marginTop: 8, paddingHorizontal: 20, paddingVertical: 10, backgroundColor: COLORS.CARD, borderRadius: 10 },
  goBackText: { color: COLORS.ACCENT, fontWeight: '600', fontSize: 14 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: COLORS.CARD, borderBottomWidth: 1, borderBottomColor: COLORS.BORDER,
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: COLORS.TEXT },

  // Hero
  hero: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 20, alignItems: 'center' },
  playerName: { fontSize: 24, fontWeight: '900', color: COLORS.TEXT, textAlign: 'center', marginTop: 12 },
  playerUsername: { fontSize: 14, fontWeight: '600', color: COLORS.ACCENT_LIGHT, marginTop: 4 },
  badgeRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  roleBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
  roleBadgeText: { fontSize: 12, fontWeight: '700' },

  // Follow button
  followBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    marginTop: 14, paddingHorizontal: 32, paddingVertical: 10,
    backgroundColor: COLORS.ACCENT, borderRadius: 22,
    minWidth: 140,
  },
  followBtnActive: {
    backgroundColor: 'transparent',
    borderWidth: 1.5, borderColor: COLORS.BORDER_LIGHT,
  },
  followBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  followBtnTextActive: { color: COLORS.TEXT },
  // Social stats row (followers/following)
  socialRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 8, paddingHorizontal: 8, marginBottom: 4,
    borderBottomWidth: 1, borderBottomColor: COLORS.BORDER,
  },
  socialItem: { flex: 1, alignItems: 'center' },
  socialNum: { fontSize: 18, fontWeight: '900', color: COLORS.TEXT },
  socialLabel: { fontSize: 10, fontWeight: '700', color: COLORS.TEXT_MUTED, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 },
  socialDivider: { width: 1, height: 24, backgroundColor: COLORS.BORDER },


  // Info
  infoCard: {
    marginHorizontal: 16, marginTop: 14, backgroundColor: COLORS.CARD, borderRadius: 14,
    borderWidth: 1, borderColor: COLORS.BORDER, paddingVertical: 12, paddingHorizontal: 16, gap: 10,
  },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  infoText: { flex: 1, fontSize: 13, color: COLORS.TEXT_SECONDARY, lineHeight: 18 },

  // Format Tabs
  formatRow: { paddingHorizontal: 4, gap: 8, marginTop: 14 },
  formatTab: {
    paddingHorizontal: 18, paddingVertical: 8, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  formatTabActive: { backgroundColor: COLORS.ACCENT, borderColor: COLORS.ACCENT_LIGHT },
  formatTabText: { fontSize: 12, fontWeight: '700', color: COLORS.TEXT_MUTED },
  formatTabTextActive: { color: '#fff' },

  // Sections
  section: { marginHorizontal: 16, marginTop: 20 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: COLORS.TEXT },

  // NEW: Stats toggle (Batting / Bowling)
  statsToggleRow: {
    flexDirection: 'row', gap: 0, marginBottom: 14,
    backgroundColor: COLORS.CARD, borderRadius: 14, padding: 4,
    borderWidth: 1, borderColor: COLORS.BORDER,
  },
  statsToggleBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 11, borderRadius: 10,
  },
  statsToggleBtnActive: { backgroundColor: COLORS.ACCENT },
  statsToggleText: { fontSize: 14, fontWeight: '700', color: COLORS.TEXT_MUTED },
  statsToggleTextActive: { color: '#fff' },

  // Primary stats (theme card style)
  primaryRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  primaryCard: {
    flex: 1, borderRadius: 16, padding: 14, alignItems: 'flex-start',
    minHeight: 110, justifyContent: 'space-between',
    backgroundColor: COLORS.CARD, borderWidth: 1, borderColor: COLORS.BORDER,
  },
  primaryIconWrap: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: COLORS.ACCENT_SOFT,
    alignItems: 'center', justifyContent: 'center', marginBottom: 8,
  },
  primaryValue: { fontSize: 26, fontWeight: '900', color: COLORS.TEXT, letterSpacing: -0.5 },
  primaryLabel: { fontSize: 11, fontWeight: '700', color: COLORS.TEXT_MUTED, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 },

  // NEW: Secondary detailed stats (list rows)
  detailsCard: {
    backgroundColor: COLORS.CARD, borderRadius: 16,
    borderWidth: 1, borderColor: COLORS.BORDER, overflow: 'hidden',
  },
  detailRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: COLORS.BORDER,
  },
  detailLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  detailIconWrap: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: COLORS.SURFACE,
    alignItems: 'center', justifyContent: 'center',
  },
  detailKey: { fontSize: 14, fontWeight: '700', color: COLORS.TEXT },
  detailHint: { fontSize: 11, color: COLORS.TEXT_MUTED, marginTop: 1 },
  detailValue: { fontSize: 20, fontWeight: '900', letterSpacing: -0.3 },

  // Empty
  emptySection: {
    alignItems: 'center', justifyContent: 'center', paddingVertical: 28,
    backgroundColor: COLORS.CARD, borderRadius: 16, borderWidth: 1, borderColor: COLORS.BORDER,
    gap: 8,
  },
  emptySectionText: { fontSize: 13, fontWeight: '600', color: COLORS.TEXT_MUTED },

  // Format chip next to Recent Form title
  formatChip: {
    marginLeft: 'auto',
    backgroundColor: COLORS.ACCENT_SOFT,
    borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: COLORS.ACCENT_SOFT_BORDER,
  },
  formatChipText: { fontSize: 10, fontWeight: '700', color: COLORS.ACCENT, textTransform: 'uppercase', letterSpacing: 0.5 },

  // Recent Form Cards
  formCard: { width: 110, borderRadius: 14, overflow: 'hidden' },
  formCardInner: { padding: 12, alignItems: 'center', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  formFormatBadge: {
    backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 6,
    paddingHorizontal: 6, paddingVertical: 2, marginBottom: 6,
  },
  formFormatText: { fontSize: 9, fontWeight: '700', color: COLORS.TEXT_SECONDARY, textTransform: 'uppercase', letterSpacing: 0.3 },
  formResult: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  formResultText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  formScore: { fontSize: 18, fontWeight: '900', color: COLORS.TEXT },
  formBalls: { fontSize: 11, color: COLORS.TEXT_MUTED, marginTop: 1 },
  formOpp: { fontSize: 10, color: COLORS.TEXT_MUTED, marginTop: 4, textAlign: 'center' },
  formDate: { fontSize: 9, color: COLORS.TEXT_HINT, marginTop: 2 },

  // Teams
  teamCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.CARD, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: COLORS.BORDER, overflow: 'hidden',
  },
  teamStripe: {
    position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, borderTopLeftRadius: 14, borderBottomLeftRadius: 14,
  },
  teamAvatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', marginLeft: 4 },
  teamAvatarText: { fontSize: 18, fontWeight: '800' },
  teamCardName: { fontSize: 14, fontWeight: '700', color: COLORS.TEXT },
  teamCardShort: { fontSize: 11, color: COLORS.TEXT_MUTED, marginTop: 1 },
  teamMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 1 },
  teamPlayerCount: { fontSize: 11, color: COLORS.TEXT_HINT },
});

export default PlayerProfileScreen;
