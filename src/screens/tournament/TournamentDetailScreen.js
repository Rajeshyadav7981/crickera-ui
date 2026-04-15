import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Platform,
  ActivityIndicator, RefreshControl, Animated, Share, Dimensions,
  Modal, TextInput, KeyboardAvoidingView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import api, { tournamentsAPI, matchesAPI } from '../../services/api';
import { COLORS } from '../../theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Skeleton, { MatchCardSkeleton, ListSkeleton } from '../../components/Skeleton';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PRIMARY = COLORS.ACCENT;
const BG = COLORS.BG;
const CARD_BORDER = COLORS.BORDER;
const TAB_INACTIVE = COLORS.TEXT_MUTED;
const DARK = COLORS.TEXT;
const TABS = ['Overview', 'Matches', 'Standings', 'Stats', 'Teams'];

/* ─── pulsing red dot for live indicator ─── */
const PulsingDot = () => {
  const anim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 0.3, duration: 800, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);
  return <Animated.View style={[styles.pulseDot, { opacity: anim }]} />;
};

/* ─── helpers ─── */
const formatScore = (runs, wickets, overs) => {
  if (runs == null) return '';
  return `${runs}/${wickets ?? 0} (${overs ?? 0})`;
};

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const day = d.getDate();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[d.getMonth()];
  const hours = d.getHours();
  const mins = d.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const h = hours % 12 || 12;
  const m = mins < 10 ? `0${mins}` : mins;
  return `${day} ${month}, ${h}:${m} ${ampm}`;
};

const getShortName = (team) => {
  if (!team) return 'TBD';
  return team.short_name || team.name?.substring(0, 3).toUpperCase() || team.name || 'TBD';
};
const stagePrettyName = (s) => (s || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
const formatOversLabel = (overs) => {
  if (!overs) return '';
  if (overs === 50) return 'ODI';
  if (overs === 90) return 'Test';
  return `T${overs}`;
};

/* ─── main component ─── */
const TournamentDetailScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const { tournamentId } = route.params;
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('Overview');
  const tabPagerRef = useRef(null);
  const tabScrollX = useRef(new Animated.Value(0)).current;
  const tabBarRef = useRef(null);
  const tabItemLayouts = useRef({});
  const [standings, setStandings] = useState(null);
  const [leaderboard, setLeaderboard] = useState(null);
  const [standingsLoading, setStandingsLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [selectedStageIdx, setSelectedStageIdx] = useState(0);
  const [stageStandings, setStageStandings] = useState({});
  const [matchStageFilter, setMatchStageFilter] = useState('all');
  const [showAdmin, setShowAdmin] = useState(false);
  const [swapMode, setSwapMode] = useState(false);
  const [swapFirstMatch, setSwapFirstMatch] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [editSaving, setEditSaving] = useState(false);
  const [editShowStartPicker, setEditShowStartPicker] = useState(false);

  const activeTabIdx = TABS.indexOf(activeTab);

  const switchToTab = useCallback((idx) => {
    if (idx < 0 || idx >= TABS.length) return;
    const tab = TABS[idx];
    setActiveTab(tab);
    tabPagerRef.current?.scrollTo({ x: idx * SCREEN_WIDTH, animated: true });
    // Scroll tab bar to keep active tab visible
    const layout = tabItemLayouts.current[idx];
    if (layout && tabBarRef.current) {
      tabBarRef.current.scrollTo({ x: Math.max(0, layout.x - 30), animated: true });
    }
    // Load data for tab
    if (tab === 'Standings') {
      if (stages.length > 0) {
        loadStageStandings(stages[selectedStageIdx]?.stage_id || stages[0]?.stage_id);
      } else {
        loadStandings();
      }
    }
    if (tab === 'Stats') loadLeaderboard();
  }, [stages, selectedStageIdx, loadStageStandings, loadStandings, loadLeaderboard]);

  const onTabPagerMomentumEnd = useCallback((e) => {
    const newIdx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    if (newIdx >= 0 && newIdx < TABS.length && TABS[newIdx] !== activeTab) {
      switchToTab(newIdx);
    }
  }, [activeTab, switchToTab]);

  const onTabPagerScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { x: tabScrollX } } }],
    { useNativeDriver: false },
  );

  const tabIndicatorX = tabScrollX.interpolate({
    inputRange: TABS.map((_, i) => i * SCREEN_WIDTH),
    outputRange: TABS.map((_, i) => i * (SCREEN_WIDTH / TABS.length)),
    extrapolate: 'clamp',
  });
  const [editShowEndPicker, setEditShowEndPicker] = useState(false);

  const parseDate = (str) => {
    if (!str) return null;
    const d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
  };

  const formatDateForAPI = (d) => d ? d.toISOString().split('T')[0] : undefined;
  const formatDateDisplay = (d) => d ? d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

  const oversToFormat = (o) => {
    if (o === 5) return 'T5';
    if (o === 10) return 'T10';
    if (o === 20) return 'T20';
    return 'Custom';
  };

  const handleSwapTap = async (match) => {
    if (!swapFirstMatch) {
      setSwapFirstMatch(match);
      return;
    }
    if (swapFirstMatch.id === match.id) {
      setSwapFirstMatch(null);
      return;
    }
    // Perform swap
    try {
      await tournamentsAPI.swapBracket(tournamentId, match.stage_id, swapFirstMatch.id, match.id, 'cross');
      setSwapFirstMatch(null);
      setSwapMode(false);
      load(); // Refresh
    } catch (e) {
      Alert.alert('Swap Failed', e?.response?.data?.detail || 'Could not swap teams');
    }
  };

  const openEditModal = () => {
    const overs = tournament?.overs_per_match || 20;
    setEditForm({
      name: tournament?.name || '',
      organizer_name: tournament?.organizer_name || '',
      location: tournament?.location || '',
      matchFormat: oversToFormat(overs),
      customOvers: String(overs),
      ball_type: tournament?.ball_type || 'tennis',
      entry_fee: String(tournament?.entry_fee || '0'),
      prize_pool: String(tournament?.prize_pool || '0'),
      start_date: parseDate(tournament?.start_date),
      end_date: parseDate(tournament?.end_date),
    });
    setShowEditModal(true);
  };

  const saveEdit = async () => {
    if (!editForm.name?.trim()) {
      Alert.alert('Required', 'Tournament name is required');
      return;
    }
    setEditSaving(true);
    try {
      const oversMap = { T5: 5, T10: 10, T20: 20 };
      const overs = editForm.matchFormat === 'Custom'
        ? (parseInt(editForm.customOvers, 10) || 20)
        : (oversMap[editForm.matchFormat] || 20);

      const payload = {};
      if (editForm.name?.trim() !== tournament?.name) payload.name = editForm.name.trim();
      if (editForm.organizer_name?.trim() !== (tournament?.organizer_name || '')) payload.organizer_name = editForm.organizer_name.trim();
      if (editForm.location?.trim() !== (tournament?.location || '')) payload.location = editForm.location.trim();
      if (overs !== tournament?.overs_per_match) payload.overs_per_match = overs;
      if (editForm.ball_type !== tournament?.ball_type) payload.ball_type = editForm.ball_type;
      const fee = parseFloat(editForm.entry_fee);
      if (!isNaN(fee) && fee !== (tournament?.entry_fee || 0)) payload.entry_fee = fee;
      const prize = parseFloat(editForm.prize_pool);
      if (!isNaN(prize) && prize !== (tournament?.prize_pool || 0)) payload.prize_pool = prize;
      const sd = formatDateForAPI(editForm.start_date);
      if (sd && sd !== tournament?.start_date) payload.start_date = sd;
      const ed = formatDateForAPI(editForm.end_date);
      if (ed && ed !== tournament?.end_date) payload.end_date = ed;

      if (Object.keys(payload).length === 0) {
        setShowEditModal(false);
        return;
      }
      await tournamentsAPI.update(tournamentId, payload);
      setShowEditModal(false);
      load();
    } catch (e) {
      Alert.alert('Error', e?.response?.data?.detail || 'Failed to update tournament');
    } finally {
      setEditSaving(false);
    }
  };

  const load = async () => {
    try {
      const res = await tournamentsAPI.get(tournamentId);
      setData(res.data);
    } catch (e) {
      Alert.alert('Error', 'Failed to load tournament');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadStandings = async () => {
    if (standings) return;
    setStandingsLoading(true);
    try {
      const res = await tournamentsAPI.standings(tournamentId);
      setStandings(res.data?.standings || res.data || []);
    } catch (_) {}
    setStandingsLoading(false);
  };

  const loadStageStandings = async (stageId) => {
    if (stageStandings[stageId]) return;
    setStandingsLoading(true);
    try {
      const res = await tournamentsAPI.stageStandings(tournamentId, stageId);
      setStageStandings(prev => ({ ...prev, [stageId]: res.data?.groups || [] }));
    } catch (_) {}
    setStandingsLoading(false);
  };

  const loadLeaderboard = async () => {
    if (leaderboard) return;
    setStatsLoading(true);
    try {
      const res = await tournamentsAPI.leaderboard(tournamentId);
      setLeaderboard(res.data);
    } catch (_) {}
    setStatsLoading(false);
  };

  useFocusEffect(useCallback(() => { load(); }, [tournamentId]));

  const handleShare = async () => {
    try {
      const { getTournamentLink } = require('../../services/linking');
      const link = getTournamentLink(tournamentId);
      await Share.share({
        message: `Check out ${data?.tournament?.name || 'this tournament'} on CrecKStars\n${link}`,
        url: link,
      });
    } catch (_) {}
  };

  const { tournament, teams, matches, stages: tournamentStages } = data || {};
  const stages = tournamentStages || [];
  const matchesSafe = matches || [];

  /* ─── categorise matches (memoized — must be before early returns) ─── */
  const liveMatches = useMemo(() => matchesSafe.filter((m) => m.status === 'live'), [matchesSafe]);
  const upcomingMatches = useMemo(() => matchesSafe.filter((m) => m.status === 'upcoming' || m.status === 'scheduled' || m.status === 'toss'), [matchesSafe]);
  const completedMatches = useMemo(() => matchesSafe.filter((m) => m.status === 'completed'), [matchesSafe]);
  const totalMatches = matchesSafe.length;
  const completedCount = completedMatches.length;
  const liveCount = liveMatches.length;
  const isCreator = user?.id === tournament?.created_by;

  /* ─── loading / error states ─── */
  if (loading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <Skeleton width={200} height={24} style={{ marginBottom: 16 }} />
        <Skeleton width="90%" height={160} borderRadius={16} style={{ marginBottom: 16 }} />
        <ListSkeleton count={3} Card={MatchCardSkeleton} />
      </View>
    );
  }
  if (!data) {
    return (
      <View style={styles.center}>
        <Text style={{ color: TAB_INACTIVE, fontSize: 15 }}>Tournament not found</Text>
      </View>
    );
  }

  /* ─── tournament status helpers ─── */
  const tournamentStatus = tournament.status || 'upcoming';
  const isCompleted = tournamentStatus === 'completed';
  const isLive = tournamentStatus === 'in_progress' || liveCount > 0;
  const isUpcoming = tournamentStatus === 'upcoming' && completedCount === 0;

  /* ─── find champion ─── */
  const finalStage = stages.find(s => s.stage_name === 'final');
  const finalMatch = finalStage
    ? matches.find(m => m.stage_id === finalStage.stage_id && m.status === 'completed')
    : null;
  const championTeamId = finalMatch?.winner_id;
  const championTeam = championTeamId ? teams.find(t => t.id === championTeamId) : null;

  /* ─── sub-renders ─── */
  /* ════════════════════════════════════════════════════ */
  /* OVERVIEW TAB                                        */
  /* ════════════════════════════════════════════════════ */
  const renderOverviewTab = () => {
    const statusColor = isCompleted ? COLORS.SUCCESS : isLive ? COLORS.WARNING : COLORS.INFO;
    const statusLabel = isCompleted ? 'Completed' : isLive ? 'In Progress' : 'Upcoming';
    const format = formatOversLabel(tournament.overs_per_match);
    const ballType = (tournament.ball_type || '').charAt(0).toUpperCase() + (tournament.ball_type || '').slice(1);

    return (
      <View style={styles.contentArea}>
        {/* Champion Banner */}
        {isCompleted && championTeam && (
          <View style={styles.championBanner}>
            <Text style={styles.championTrophy}>🏆</Text>
            <Text style={styles.championTitle}>Tournament Champion</Text>
            <View style={styles.championTeamRow}>
              <View style={[styles.championFlag, { backgroundColor: championTeam.color || PRIMARY }]}>
                <Text style={styles.championFlagText}>{getShortName(championTeam).charAt(0)}</Text>
              </View>
              <Text style={styles.championTeamName}>{championTeam.name}</Text>
            </View>
          </View>
        )}

        {/* Tournament Info Card */}
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
              <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
                <Text style={styles.statusBadgeText}>{statusLabel}</Text>
              </View>
            </View>
            {isCreator && (
              <TouchableOpacity onPress={openEditModal} style={styles.editInfoBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <MaterialCommunityIcons name="pencil-outline" size={16} color={COLORS.ACCENT} />
                <Text style={styles.editInfoBtnText}>Edit</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Format</Text>
              <Text style={styles.infoValue}>{format || `${tournament.overs_per_match} Overs`}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Ball</Text>
              <Text style={styles.infoValue}>{ballType || 'Tennis'}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Teams</Text>
              <Text style={styles.infoValue}>{teams.length}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Matches</Text>
              <Text style={styles.infoValue}>{completedCount}/{totalMatches}</Text>
            </View>
          </View>

          {(tournament.organizer_name || tournament.location) && (
            <View style={styles.infoMetaRow}>
              {tournament.organizer_name && (
                <Text style={styles.infoMeta}>Organized by {tournament.organizer_name}</Text>
              )}
              {tournament.location && (
                <Text style={styles.infoMeta}>📍 {tournament.location}</Text>
              )}
            </View>
          )}
        </View>

        {/* Stage Progression Bar — every step is tappable; tapping drills
            into the Matches tab filtered to that specific stage. */}
        {stages.length > 0 && (
          <View style={styles.progressionCard}>
            <View style={styles.progressionRow}>
              {stages.map((s, i) => {
                const stageMatches = matches.filter(m => m.stage_id === s.stage_id);
                const stageCompleted = stageMatches.filter(m => m.status === 'completed').length;
                const stageTotal = stageMatches.length;
                return (
                  <TouchableOpacity
                    key={s.stage_id}
                    style={styles.progressionStep}
                    activeOpacity={0.7}
                    onPress={() => {
                      setMatchStageFilter(String(s.stage_id));
                      switchToTab(TABS.indexOf('Matches'));
                    }}
                  >
                    <View style={styles.progressionDotRow}>
                      {i > 0 && (
                        <View style={[
                          styles.progressionLine,
                          stages[i - 1].status === 'completed' && styles.progressionLineDone,
                        ]} />
                      )}
                      <View style={[
                        styles.progressionDot,
                        s.status === 'completed' && styles.progressionDotDone,
                        s.status === 'in_progress' && styles.progressionDotLive,
                      ]}>
                        {s.status === 'completed'
                          ? <MaterialCommunityIcons name="check" size={12} color="#fff" />
                          : s.status === 'in_progress'
                          ? <MaterialCommunityIcons name="cricket" size={10} color="#fff" />
                          : <Text style={{ color: COLORS.TEXT_MUTED, fontSize: 10 }}>{i + 1}</Text>
                        }
                      </View>
                      {i < stages.length - 1 && (
                        <View style={[
                          styles.progressionLine,
                          s.status === 'completed' && styles.progressionLineDone,
                        ]} />
                      )}
                    </View>
                    <Text style={styles.progressionLabel} numberOfLines={1}>
                      {stagePrettyName(s.stage_name)}
                    </Text>
                    <Text style={styles.progressionSub}>
                      {stageCompleted}/{stageTotal}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={{ fontSize: 11, color: COLORS.TEXT_MUTED, marginTop: 8, textAlign: 'center' }}>
              Tap any stage to view its matches
            </Text>
          </View>
        )}

        {/* Tournament Progress Timeline */}
        {stages.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Tournament Progress</Text>
            <View style={styles.timelineCard}>
              {stages.map((s, i) => {
                const isDone = s.status === 'completed';
                const isActive = s.status === 'in_progress';
                const stageMatches = matches.filter(m => m.stage_id === s.stage_id);
                const stageCompleted = stageMatches.filter(m => m.status === 'completed').length;
                const stageTotal = stageMatches.length;
                const progressPct = stageTotal > 0 ? (stageCompleted / stageTotal) * 100 : 0;

                return (
                  <TouchableOpacity
                    key={s.stage_id}
                    activeOpacity={0.75}
                    onPress={() => {
                      setMatchStageFilter(String(s.stage_id));
                      switchToTab(TABS.indexOf('Matches'));
                    }}
                  >
                    <View style={styles.timelineRow}>
                      <View style={styles.timelineLeft}>
                        <View style={[
                          styles.timelineCircle,
                          isDone && styles.timelineCircleDone,
                          isActive && styles.timelineCircleActive,
                        ]}>
                          {isDone ? (
                            <Text style={styles.timelineCheck}>✓</Text>
                          ) : (
                            <Text style={[styles.timelineNum, (isDone || isActive) && { color: '#fff' }]}>{i + 1}</Text>
                          )}
                        </View>
                        {i < stages.length - 1 && (
                          <View style={[styles.timelineLine, isDone && styles.timelineLineDone]} />
                        )}
                      </View>
                      <View style={styles.timelineContent}>
                        <Text style={[styles.timelineStageName, isActive && { color: DARK, fontWeight: '700' }]}>
                          {stagePrettyName(s.stage_name)}
                        </Text>
                        {stageTotal > 0 && (
                          <View style={styles.timelineProgress}>
                            <View style={styles.timelineProgressBar}>
                              <View style={[styles.timelineProgressFill, { width: `${progressPct}%` }]} />
                            </View>
                            <Text style={styles.timelineProgressText}>
                              {stageCompleted}/{stageTotal} matches
                            </Text>
                          </View>
                        )}
                        {stageTotal === 0 && !isDone && (
                          <Text style={styles.timelineWaiting}>Waiting for qualifiers</Text>
                        )}
                      </View>
                      <MaterialCommunityIcons name="chevron-right" size={18} color={COLORS.TEXT_MUTED} />
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* ── Stage Actions: Create Next Stage (creator only) ── */}
        {isCreator && stages.length > 0 && (() => {
          const lastStage = stages[stages.length - 1];
          const tournamentDone = tournament?.status === 'completed';

          // Check if last stage is done using multiple signals
          const lastStageDoneByStatus = lastStage.status === 'completed';
          // Also check from matches array directly (most reliable)
          const stageMatchesFromList = matchesSafe.filter(m => m.stage_id === lastStage.stage_id);
          const lastStageDoneByMatches = stageMatchesFromList.length > 0 && stageMatchesFromList.every(m => m.status === 'completed');
          // Also check from stage data
          const lastStageDoneByData = (lastStage.total_matches || 0) > 0 && (lastStage.completed_matches || 0) >= (lastStage.total_matches || 0);
          const lastStageDone = lastStageDoneByStatus || lastStageDoneByMatches || lastStageDoneByData;
          const canAddStage = lastStageDone && !tournamentDone;

          return (
            <View style={styles.stageActionsCard}>
              {/* Create next stage — navigates to TournamentSetup with qualified teams */}
              {canAddStage && (() => {
                // Gather qualified teams from the LAST completed stage only
                // (earlier stages may have teams that were later eliminated)
                const completedStages = stages.filter(s => s.status === 'completed' ||
                  ((s.total_matches || 0) > 0 && (s.completed_matches || 0) >= (s.total_matches || 0)));
                const latestStage = completedStages.length > 0
                  ? completedStages[completedStages.length - 1]
                  : null;

                const qualifiedTeams = [];
                if (latestStage) {
                  (latestStage.groups || []).forEach(g => {
                    (g.teams || []).forEach(t => {
                      if (t.qualification_status === 'qualified') {
                        const fullTeam = teams.find(tm => tm.id === t.team_id);
                        if (fullTeam && !qualifiedTeams.find(q => q.id === fullTeam.id)) {
                          qualifiedTeams.push(fullTeam);
                        }
                      }
                    });
                  });
                }

                return (
                  <>
                    <TouchableOpacity
                      style={[styles.stageActionBtn, styles.stageActionBtnPrimary]}
                      onPress={() => {
                        navigation.navigate('TournamentSetup', {
                          tournamentId: tournament.id,
                          tournamentName: tournament.name,
                          existingTeams: teams,
                          qualifiedTeams,
                          addNextStage: true,
                        });
                      }}
                    >
                      <MaterialCommunityIcons name="plus-circle" size={18} color={COLORS.TEXT} />
                      <Text style={[styles.stageActionBtnText, { color: COLORS.TEXT }]}>
                        Create Next Stage {qualifiedTeams.length > 0 ? `(${qualifiedTeams.length} qualified)` : ''}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.stageActionBtn}
                      onPress={() => {
                        Alert.alert(
                          'Complete Tournament',
                          'Are you sure? This will mark the tournament as completed.',
                          [
                            { text: 'Cancel', style: 'cancel' },
                            { text: 'Complete', style: 'destructive', onPress: async () => {
                              try {
                                await api.put(`/api/tournaments/${tournament.id}`, { status: 'completed' });
                                load();
                              } catch (e) {
                                Alert.alert('Error', e.response?.data?.detail || 'Failed');
                              }
                            }},
                          ]
                        );
                      }}
                    >
                      <MaterialCommunityIcons name="check-circle" size={18} color={COLORS.SUCCESS} />
                      <Text style={[styles.stageActionBtnText, { color: COLORS.SUCCESS }]}>Complete Tournament</Text>
                    </TouchableOpacity>
                  </>
                );
              })()}
            </View>
          );
        })()}

        {/* Live Matches Preview */}
        {liveMatches.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.liveNowTitle}>
                <PulsingDot />
                <Text style={styles.sectionTitle}>Live Now</Text>
              </View>
            </View>
            {liveMatches.slice(0, 2).map(m => renderLiveCard(m))}
          </View>
        )}

        {/* Upcoming preview */}
        {upcomingMatches.length > 0 && !isCompleted && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Next Up</Text>
              <TouchableOpacity onPress={() => switchToTab(TABS.indexOf('Matches'))}>
                <Text style={styles.sectionLink}>View All</Text>
              </TouchableOpacity>
            </View>
            {upcomingMatches.slice(0, 3).map(m => renderUpcomingCard(m))}
          </View>
        )}

        {/* Quick Actions for Creator */}
        {isCreator && tournament?.status !== 'completed' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
            <View style={styles.actionsGrid}>
              {matches.length === 0 && (
                <TouchableOpacity
                  style={styles.actionCard}
                  onPress={() => navigation.navigate('TournamentSetup', {
                    tournamentId, tournamentName: tournament.name, existingTeams: teams,
                  })}
                >
                  <Text style={styles.actionCardIcon}>⚙️</Text>
                  <Text style={styles.actionCardText}>Setup Tournament</Text>
                </TouchableOpacity>
              )}
              {teams.length >= 2 && (
                <TouchableOpacity
                  style={styles.actionCard}
                  onPress={() => navigation.navigate('CreateMatch', { tournamentId, teams })}
                >
                  <Text style={styles.actionCardIcon}>🏏</Text>
                  <Text style={styles.actionCardText}>Add Match</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={styles.actionCard}
                onPress={() => {
                  switchToTab(TABS.indexOf('Standings'));
                  if (stages.length > 0) {
                    loadStageStandings(stages[0]?.stage_id);
                  } else {
                    loadStandings();
                  }
                }}
              >
                <Text style={styles.actionCardIcon}>📊</Text>
                <Text style={styles.actionCardText}>Points Table</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Recent Results */}
        {completedMatches.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Recent Results</Text>
              <TouchableOpacity onPress={() => switchToTab(TABS.indexOf('Matches'))}>
                <Text style={styles.sectionLink}>See All</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.resultsContainer}>
              {completedMatches.slice(0, 3).map((m, i) => renderResultCard(m, i))}
            </View>
          </View>
        )}

        {/* Empty state for brand new tournament */}
        {matches.length === 0 && teams.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={{ fontSize: 48, marginBottom: 12 }}>🏏</Text>
            <Text style={styles.emptyTitle}>Get Started</Text>
            <Text style={styles.emptyText}>Add teams and set up your tournament to start scheduling matches</Text>
            {isCreator && (
              <TouchableOpacity
                style={[styles.createMatchBtn, { marginTop: 20, paddingHorizontal: 40 }]}
                onPress={() => navigation.navigate('TournamentSetup', {
                  tournamentId, tournamentName: tournament.name, existingTeams: [],
                })}
              >
                <Text style={styles.createMatchBtnText}>Setup Tournament</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ── Admin: Reset/Delete controls ── */}
        {isCreator && stages.length > 0 && (
          <View style={styles.adminSection}>
            <TouchableOpacity
              style={styles.adminToggle}
              onPress={() => setShowAdmin(!showAdmin)}
            >
              <MaterialCommunityIcons name="shield-account" size={16} color={COLORS.TEXT_MUTED} />
              <Text style={styles.adminToggleText}>Admin Controls</Text>
              <Text style={{ color: COLORS.TEXT_MUTED, fontSize: 12 }}>{showAdmin ? '▲' : '▼'}</Text>
            </TouchableOpacity>

            {showAdmin && (
              <View style={styles.adminContent}>
                {stages.map((s) => (
                  <View key={s.stage_id} style={styles.adminStageRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.adminStageName}>{stagePrettyName(s.stage_name)}</Text>
                      <Text style={styles.adminStageMeta}>
                        {s.status} • {s.completed_matches || 0}/{s.total_matches || 0} matches
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.adminBtnWarn}
                      onPress={() => {
                        Alert.alert(
                          'Reset Stage',
                          `Delete all matches in "${stagePrettyName(s.stage_name)}" and reset? Groups and teams will be kept.`,
                          [
                            { text: 'Cancel', style: 'cancel' },
                            { text: 'Reset', style: 'destructive', onPress: async () => {
                              try {
                                await api.post(`/api/tournaments/${tournament.id}/stages/${s.stage_id}/reset`);
                                load();
                                Alert.alert('Done', 'Stage reset. You can regenerate fixtures.');
                              } catch (e) { Alert.alert('Error', e.response?.data?.detail || 'Failed'); }
                            }},
                          ]
                        );
                      }}
                    >
                      <Text style={styles.adminBtnWarnText}>Reset</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.adminBtnDanger}
                      onPress={() => {
                        Alert.alert(
                          'Delete Stage',
                          `Permanently delete "${stagePrettyName(s.stage_name)}" and ALL its matches?`,
                          [
                            { text: 'Cancel', style: 'cancel' },
                            { text: 'Delete', style: 'destructive', onPress: async () => {
                              try {
                                await api.delete(`/api/tournaments/${tournament.id}/stages/${s.stage_id}`);
                                load();
                              } catch (e) { Alert.alert('Error', e.response?.data?.detail || 'Failed'); }
                            }},
                          ]
                        );
                      }}
                    >
                      <Text style={styles.adminBtnDangerText}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                ))}

                {tournament.status === 'completed' && (
                  <TouchableOpacity
                    style={[styles.stageActionBtn, { borderColor: COLORS.WARNING, marginTop: 8 }]}
                    onPress={() => {
                      Alert.alert('Reopen Tournament', 'Set tournament back to in-progress?', [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Reopen', onPress: async () => {
                          try {
                            await api.put(`/api/tournaments/${tournament.id}`, { status: 'in_progress' });
                            load();
                          } catch (e) { Alert.alert('Error', e.response?.data?.detail || 'Failed'); }
                        }},
                      ]);
                    }}
                  >
                    <MaterialCommunityIcons name="restart" size={16} color={COLORS.WARNING} />
                    <Text style={[styles.stageActionBtnText, { color: COLORS.WARNING }]}>Reopen Tournament</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        )}
      </View>
    );
  };

  /* ── live match card (large, hero style) ── */
  const renderLiveCard = (match) => {
    const teamA = teams.find((t) => t.id === match.team_a_id);
    const teamB = teams.find((t) => t.id === match.team_b_id);
    const matchLabel = match.match_label || match.stage || 'Group Stage';
    const matchNumber = match.match_number ? `Match ${match.match_number}` : '';

    const scoreA = formatScore(match.team_a_runs, match.team_a_wickets, match.team_a_overs);
    const scoreB = formatScore(match.team_b_runs, match.team_b_wickets, match.team_b_overs);
    const battingTeam = match.batting_team_id;
    const aIsBatting = battingTeam === match.team_a_id;
    const bIsBatting = battingTeam === match.team_b_id;

    return (
      <TouchableOpacity
        key={match.id}
        activeOpacity={0.85}
        style={styles.liveCard}
        onPress={() => navigation.navigate('LiveScoring', { matchId: match.id })}
      >
        <View style={styles.liveCardBg}>
          <View style={styles.liveCardGradient} />
        </View>

        <View style={styles.liveCardTopRow}>
          <View style={styles.liveBadge}>
            <Text style={styles.liveBadgeText}>LIVE</Text>
          </View>
          <Text style={styles.liveMatchInfo}>
            {matchLabel}{matchNumber ? ` - ${matchNumber}` : ''}
          </Text>
        </View>

        <View style={styles.liveScoreArea}>
          <View style={styles.liveTeamCol}>
            <View style={styles.liveTeamFlag}>
              <Text style={styles.liveTeamFlagText}>{getShortName(teamA).charAt(0)}</Text>
            </View>
            <Text style={[styles.liveTeamAbbr, aIsBatting && styles.liveTeamBatting]}>
              {getShortName(teamA)}
            </Text>
            <Text style={[styles.liveTeamScore, aIsBatting && styles.liveTeamBatting]}>
              {scoreA || '—'}
            </Text>
          </View>

          <Text style={styles.liveVsText}>vs</Text>

          <View style={styles.liveTeamCol}>
            <View style={styles.liveTeamFlag}>
              <Text style={styles.liveTeamFlagText}>{getShortName(teamB).charAt(0)}</Text>
            </View>
            <Text style={[styles.liveTeamAbbr, bIsBatting && styles.liveTeamBatting]}>
              {getShortName(teamB)}
            </Text>
            <Text style={[styles.liveTeamScore, bIsBatting && styles.liveTeamBatting]}>
              {scoreB || '—'}
            </Text>
          </View>
        </View>

        {match.status_text ? (
          <Text style={styles.liveStatusText}>{match.status_text}</Text>
        ) : null}

        <TouchableOpacity
          style={styles.watchLiveBtn}
          onPress={() => navigation.navigate('LiveScoring', { matchId: match.id })}
        >
          <Text style={styles.watchLiveBtnText}>Watch Live</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  /* ── upcoming match card ── */
  const renderUpcomingCard = (match) => {
    const teamA = teams.find((t) => t.id === match.team_a_id);
    const teamB = teams.find((t) => t.id === match.team_b_id);
    const stageName = stages.find(s => s.stage_id === match.stage_id);
    const isKnockout = match.match_type && match.match_type !== 'group_stage';
    const isSwapSelected = swapFirstMatch?.id === match.id;

    return (
      <TouchableOpacity
        key={match.id}
        style={[styles.upcomingCard, isSwapSelected && { borderColor: COLORS.WARNING, borderWidth: 2 }]}
        activeOpacity={0.7}
        onPress={swapMode && isKnockout ? () => handleSwapTap(match) : () => navigation.navigate('MatchDetail', { matchId: match.id, teams })}
      >
        {(match.time_slot || stageName) && (
          <Text style={styles.matchStageBadge}>
            {match.time_slot || stagePrettyName(stageName?.stage_name || match.match_type || '')}
          </Text>
        )}
        <View style={styles.upcomingTeamsRow}>
          <View style={styles.upcomingTeamInfo}>
            <View style={[styles.upcomingFlag, teamA?.color && { backgroundColor: teamA.color }]}>
              <Text style={styles.upcomingFlagText}>{getShortName(teamA).charAt(0)}</Text>
            </View>
            <Text style={styles.upcomingTeamName}>{getShortName(teamA)}</Text>
          </View>

          <Text style={styles.upcomingVs}>vs</Text>

          <View style={styles.upcomingTeamInfo}>
            <View style={[styles.upcomingFlag, teamB?.color && { backgroundColor: teamB.color }]}>
              <Text style={styles.upcomingFlagText}>{getShortName(teamB).charAt(0)}</Text>
            </View>
            <Text style={styles.upcomingTeamName}>{getShortName(teamB)}</Text>
          </View>

          {match.match_number && (
            <View style={styles.matchNumBadge}>
              <Text style={styles.matchNumText}>#{match.match_number}</Text>
            </View>
          )}
        </View>
        <Text style={styles.upcomingDate}>
          {formatDate(match.match_date || match.scheduled_at || match.created_at)}
          {match.status === 'toss' ? '  •  Toss Done' : ''}
        </Text>
      </TouchableOpacity>
    );
  };

  /* ── result card ── */
  const renderResultCard = (match, idx) => {
    const teamA = teams.find((t) => t.id === match.team_a_id);
    const teamB = teams.find((t) => t.id === match.team_b_id);
    const winnerId = match.winner_id;
    const aWon = winnerId === match.team_a_id;
    const bWon = winnerId === match.team_b_id;
    const matchNum = match.match_number ? `Match ${match.match_number}` : `Match ${idx + 1}`;
    const stageName = stages.find(s => s.stage_id === match.stage_id);

    const scoreA = formatScore(match.team_a_runs, match.team_a_wickets, match.team_a_overs);
    const scoreB = formatScore(match.team_b_runs, match.team_b_wickets, match.team_b_overs);

    return (
      <TouchableOpacity
        key={match.id}
        style={[styles.resultCard, idx < completedMatches.length - 1 && styles.resultCardBorder]}
        activeOpacity={0.7}
        onPress={() => navigation.navigate('MatchDetail', { matchId: match.id })}
      >
        <View style={styles.resultTopRow}>
          <Text style={styles.resultMatchNum}>
            {matchNum} • {formatDate(match.match_date || match.scheduled_at || match.created_at)}
          </Text>
          {(match.time_slot || stageName) && (
            <View style={styles.resultStagePill}>
              <Text style={styles.resultStageText}>
                {match.time_slot || stagePrettyName(stageName?.stage_name || match.match_type || '')}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.resultScoreRow}>
          <Text style={[styles.resultTeamName, aWon && styles.resultWinner]}>{getShortName(teamA)}</Text>
          <Text style={[styles.resultTeamScore, aWon && styles.resultWinner]}>{scoreA || '—'}</Text>
        </View>
        <View style={styles.resultScoreRow}>
          <Text style={[styles.resultTeamName, bWon && styles.resultWinner]}>{getShortName(teamB)}</Text>
          <Text style={[styles.resultTeamScore, bWon && styles.resultWinner]}>{scoreB || '—'}</Text>
        </View>

        {(match.result_text || match.result_summary) ? (
          <Text style={styles.resultText}>{match.result_text || match.result_summary}</Text>
        ) : null}
      </TouchableOpacity>
    );
  };

  /* ════════════════════════════════════════════════════ */
  /* MATCHES TAB                                         */
  /* ════════════════════════════════════════════════════ */
  const renderMatchesTab = () => {
    // Build a set of stage IDs that should be visible.
    // A stage is visible only if ALL stages before it (lower stage_order) are completed.
    // This prevents showing semi-final/final matches when the group stage isn't done,
    // even if the backend has them as "in_progress" due to bad data.
    const visibleStageIds = new Set();
    let allPriorCompleted = true;
    for (const s of stages) {
      if (allPriorCompleted && (s.status === 'in_progress' || s.status === 'completed')) {
        visibleStageIds.add(String(s.stage_id));
      }
      if (s.status !== 'completed') {
        allPriorCompleted = false;
      }
    }

    // Only show stage pills for visible stages
    const stageFilters = [
      { key: 'all', label: 'All', status: null },
      ...stages
        .filter(s => visibleStageIds.has(String(s.stage_id)))
        .map(s => ({
          key: String(s.stage_id), label: stagePrettyName(s.stage_name), status: s.status,
        })),
    ];

    // "All" view only shows matches from visible stages
    const filteredMatches = matchStageFilter === 'all'
      ? matches.filter(m => !m.stage_id || visibleStageIds.has(String(m.stage_id)))
      : matches.filter(m => String(m.stage_id) === matchStageFilter);

    const filteredLive = filteredMatches.filter(m => m.status === 'live');
    const filteredUpcoming = filteredMatches.filter(m => m.status === 'upcoming' || m.status === 'scheduled' || m.status === 'toss');
    const filteredCompleted = filteredMatches.filter(m => m.status === 'completed');

    return (
      <View style={styles.contentArea}>
        {/* Stage filter pills */}
        {stages.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
            {stageFilters.map(sf => {
              const isCompleted = sf.status === 'completed';
              const isLive = sf.status === 'in_progress';
              const badgeBg = isCompleted ? COLORS.GREEN_LIGHT : isLive ? COLORS.WARNING_LIGHT : null;
              const badgeLabel = isCompleted ? 'Done' : isLive ? 'Live' : null;
              return (
                <TouchableOpacity
                  key={sf.key}
                  style={[styles.filterPill, matchStageFilter === sf.key && styles.filterPillActive, isCompleted && { opacity: 0.5 }]}
                  onPress={() => setMatchStageFilter(sf.key)}
                >
                  <Text style={[styles.filterPillText, matchStageFilter === sf.key && styles.filterPillTextActive]}>
                    {sf.label}
                  </Text>
                  {badgeLabel && (
                    <View style={[styles.stageBadge, { backgroundColor: badgeBg, marginLeft: 6 }]}>
                      <Text style={styles.stageBadgeText}>{badgeLabel}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {/* Live Now */}
        {filteredLive.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.liveNowTitle}>
                <PulsingDot />
                <Text style={styles.sectionTitle}>Live Now</Text>
              </View>
            </View>
            {filteredLive.map(renderLiveCard)}
          </View>
        )}

        {/* Upcoming Matches */}
        {filteredUpcoming.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Upcoming ({filteredUpcoming.length})</Text>
            </View>
            {filteredUpcoming.map(m => renderUpcomingCard(m))}
          </View>
        )}

        {/* Completed Matches */}
        {filteredCompleted.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Completed ({filteredCompleted.length})</Text>
            </View>
            <View style={styles.resultsContainer}>
              {filteredCompleted.map((m, i) => renderResultCard(m, i))}
            </View>
          </View>
        )}

        {/* Swap bracket toggle (for knockout stages with upcoming matches) */}
        {isCreator && filteredUpcoming.length >= 2 && filteredUpcoming.some(m => m.match_type !== 'group_stage') && (
          <TouchableOpacity
            style={[styles.swapBracketBtn, swapMode && styles.swapBracketBtnActive]}
            onPress={() => { setSwapMode(!swapMode); setSwapFirstMatch(null); }}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="swap-horizontal" size={18} color={swapMode ? '#fff' : COLORS.WARNING} />
            <Text style={[styles.swapBracketText, swapMode && { color: '#fff' }]}>
              {swapMode ? (swapFirstMatch ? 'Tap 2nd match to swap' : 'Tap 1st match') : 'Swap Bracket'}
            </Text>
          </TouchableOpacity>
        )}

        {/* Creator actions */}
        {isCreator && tournament?.status !== 'completed' && teams.length >= 2 && (
          <TouchableOpacity
            style={styles.createMatchBtn}
            onPress={() => navigation.navigate('CreateMatch', { tournamentId, teams })}
          >
            <Text style={styles.createMatchBtnText}>+ Create Match</Text>
          </TouchableOpacity>
        )}

        {filteredMatches.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No matches in this stage yet</Text>
            {isCreator && matches.length === 0 && (
              <TouchableOpacity
                style={[styles.createMatchBtn, { marginTop: 16 }]}
                onPress={() => navigation.navigate('TournamentSetup', {
                  tournamentId, tournamentName: tournament.name, existingTeams: teams,
                })}
              >
                <Text style={styles.createMatchBtnText}>Setup Tournament</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    );
  };

  /* ─── Standings table helper ─── */
  const renderStandingsTable = (rows, qualTopN) => (
    <>
      <View style={styles.standingsHeader}>
        <Text style={[styles.standingsCell, styles.standingsTeamCell, styles.standingsHeaderText]}>Team</Text>
        <Text style={[styles.standingsCell, styles.standingsNumCell, styles.standingsHeaderText]}>P</Text>
        <Text style={[styles.standingsCell, styles.standingsNumCell, styles.standingsHeaderText]}>W</Text>
        <Text style={[styles.standingsCell, styles.standingsNumCell, styles.standingsHeaderText]}>L</Text>
        <Text style={[styles.standingsCell, styles.standingsNumCell, styles.standingsHeaderText]}>D</Text>
        <Text style={[styles.standingsCell, styles.standingsNumCell, styles.standingsHeaderText]}>Pts</Text>
        <Text style={[styles.standingsCell, styles.standingsNrrCell, styles.standingsHeaderText]}>NRR</Text>
      </View>
      {rows.map((s, idx) => {
        const isQualified = s.qualification_status === 'qualified';
        const isEliminated = s.qualification_status === 'eliminated';
        const qualifies = qualTopN ? idx < qualTopN : idx < 2;
        const dotColor = isQualified ? PRIMARY : isEliminated ? COLORS.RED : qualifies ? PRIMARY : COLORS.TEXT_HINT;
        return (
          <View key={s.team_id || idx} style={[styles.standingsRow, idx % 2 === 0 && styles.standingsRowAlt, isEliminated && { opacity: 0.5 }]}>
            <View style={[styles.standingsCell, styles.standingsTeamCell, { flexDirection: 'row', alignItems: 'center', gap: 8 }]}>
              <Text style={styles.standingsRank}>{idx + 1}</Text>
              <View style={[styles.standingsDot, { backgroundColor: dotColor }]} />
              <Text style={[styles.standingsTeamName, isEliminated && { textDecorationLine: 'line-through' }]} numberOfLines={1}>{s.short_name || s.team_name}</Text>
              {isQualified && <Text style={{ fontSize: 10, color: PRIMARY }}>Q</Text>}
              {isEliminated && <Text style={{ fontSize: 10, color: COLORS.RED, fontWeight: '700' }}>E</Text>}
            </View>
            <Text style={[styles.standingsCell, styles.standingsNumCell]}>{s.played ?? 0}</Text>
            <Text style={[styles.standingsCell, styles.standingsNumCell, { color: COLORS.GREEN_LIGHT, fontWeight: '600' }]}>{s.won ?? 0}</Text>
            <Text style={[styles.standingsCell, styles.standingsNumCell, { color: COLORS.RED }]}>{s.lost ?? 0}</Text>
            <Text style={[styles.standingsCell, styles.standingsNumCell]}>{s.drawn ?? 0}</Text>
            <Text style={[styles.standingsCell, styles.standingsNumCell, styles.standingsPts]}>{s.points ?? 0}</Text>
            <Text style={[styles.standingsCell, styles.standingsNrrCell, { color: (s.nrr ?? 0) >= 0 ? COLORS.GREEN_LIGHT : COLORS.RED }]}>
              {(s.nrr ?? 0) >= 0 ? '+' : ''}{(s.nrr ?? 0).toFixed(2)}
            </Text>
          </View>
        );
      })}
    </>
  );

  /* ─── Standings tab ─── */
  const renderStandingsTab = () => {
    const hasStages = stages.length > 0;

    if (standingsLoading) {
      return (
        <View style={styles.contentArea}>
          {/* Stage pills skeleton */}
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
            <Skeleton width={90} height={32} borderRadius={16} />
            <Skeleton width={90} height={32} borderRadius={16} />
            <Skeleton width={90} height={32} borderRadius={16} />
          </View>
          {/* Table header skeleton */}
          <View style={{ backgroundColor: COLORS.CARD, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: CARD_BORDER }}>
            <Skeleton width="50%" height={14} style={{ marginBottom: 16 }} />
            <View style={{ flexDirection: 'row', marginBottom: 12 }}>
              <Skeleton width="30%" height={10} />
              <View style={{ flex: 1 }} />
              {[1,2,3,4,5].map(i => <Skeleton key={i} width={28} height={10} style={{ marginLeft: 8 }} />)}
            </View>
            {/* Table rows */}
            {[1,2,3,4].map(i => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderTopColor: COLORS.BORDER }}>
                <Skeleton width={20} height={20} borderRadius={10} />
                <Skeleton width="35%" height={12} style={{ marginLeft: 10 }} />
                <View style={{ flex: 1 }} />
                {[1,2,3,4,5].map(j => <Skeleton key={j} width={24} height={12} style={{ marginLeft: 8 }} />)}
              </View>
            ))}
          </View>
        </View>
      );
    }

    if (hasStages) {
      const stage = stages[selectedStageIdx] || stages[0];
      const groups = stageStandings[stage?.stage_id] || [];
      const qualTopN = stage?.qualification_rule?.top_n || 2;
      const statusBadge = (s) => {
        if (s.status === 'completed') return { bg: COLORS.GREEN_LIGHT, text: 'Done' };
        if (s.status === 'in_progress') return { bg: COLORS.WARNING_LIGHT, text: 'Live' };
        return { bg: '#94A3B8', text: 'Upcoming' };
      };

      return (
        <View style={styles.contentArea}>
          {/* Stage selector pills */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
            {stages.map((s, i) => {
              const active = i === selectedStageIdx;
              const badge = statusBadge(s);
              return (
                <TouchableOpacity
                  key={s.stage_id}
                  style={[styles.stagePill, active && styles.stagePillActive]}
                  onPress={() => {
                    setSelectedStageIdx(i);
                    loadStageStandings(s.stage_id);
                  }}
                >
                  <Text style={[styles.stagePillText, active && styles.stagePillTextActive]}>
                    {stagePrettyName(s.stage_name)}
                  </Text>
                  <View style={[styles.stageBadge, { backgroundColor: badge.bg }]}>
                    <Text style={styles.stageBadgeText}>{badge.text}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Points system info */}
          <View style={styles.pointsInfoRow}>
            <Text style={styles.pointsInfoText}>Win: 2 pts</Text>
            <Text style={styles.pointsInfoDot}>•</Text>
            <Text style={styles.pointsInfoText}>Tie/NR: 1 pt</Text>
            <Text style={styles.pointsInfoDot}>•</Text>
            <Text style={styles.pointsInfoText}>Loss: 0 pts</Text>
          </View>

          {/* Groups within selected stage */}
          {groups.length > 0 ? (
            groups.map((g) => (
              <View key={g.group_id} style={styles.section}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionTitle}>{g.group_name}</Text>
                  <Text style={{ fontSize: 11, color: TAB_INACTIVE }}>Top {qualTopN} qualify</Text>
                </View>
                {renderStandingsTable(g.standings || [], qualTopN)}
              </View>
            ))
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>
                {stage?.stage_name?.includes('group')
                  ? 'Play matches to see standings'
                  : 'Knockout stage - no group standings'}
              </Text>
            </View>
          )}

          {/* Stage progress summary */}
          <View style={[styles.stageProgressCard, { marginTop: 8 }]}>
            {stages.map((s, i) => {
              const badge = statusBadge(s);
              const isLast = i === stages.length - 1;
              return (
                <View key={s.stage_id} style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={[styles.stageNode, { backgroundColor: badge.bg }]}>
                    <Text style={styles.stageNodeText}>{i + 1}</Text>
                  </View>
                  <View style={{ marginLeft: 8, flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: DARK }}>{stagePrettyName(s.stage_name)}</Text>
                    <Text style={{ fontSize: 11, color: TAB_INACTIVE }}>
                      {s.groups?.length || 0} group{(s.groups?.length || 0) !== 1 ? 's' : ''} •{' '}
                      {s.groups?.reduce((a, g) => a + (g.completed_matches || 0), 0) || 0}/
                      {s.groups?.reduce((a, g) => a + (g.total_matches || 0), 0) || 0} matches
                    </Text>
                  </View>
                  {!isLast && <Text style={{ color: TAB_INACTIVE, marginHorizontal: 4 }}>→</Text>}
                </View>
              );
            })}
          </View>
        </View>
      );
    }

    // Fallback: flat standings
    if (!standings || standings.length === 0) {
      return (
        <View style={styles.contentArea}>
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Standings will appear once matches are played</Text>
          </View>
        </View>
      );
    }
    return (
      <View style={styles.contentArea}>
        {renderStandingsTable(standings)}
      </View>
    );
  };

  /* ─── Stats tab ─── */
  const renderStatsTab = () => {
    if (statsLoading) {
      return (
        <View style={styles.contentArea}>
          {/* Quick stats row skeleton */}
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
            {[1,2,3].map(i => (
              <View key={i} style={{ flex: 1, backgroundColor: COLORS.CARD, borderRadius: 14, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: CARD_BORDER }}>
                <Skeleton width={36} height={24} style={{ marginBottom: 6 }} />
                <Skeleton width={50} height={10} />
              </View>
            ))}
          </View>
          {/* Leaderboard section skeleton */}
          <Skeleton width={130} height={14} style={{ marginBottom: 12 }} />
          <View style={{ backgroundColor: COLORS.CARD, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: CARD_BORDER }}>
            {[1,2,3,4,5].map(i => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: i > 1 ? 1 : 0, borderTopColor: COLORS.BORDER }}>
                <Skeleton width={20} height={14} />
                <Skeleton width={32} height={32} borderRadius={16} />
                <View style={{ flex: 1 }}>
                  <Skeleton width="60%" height={12} />
                  <Skeleton width="40%" height={9} style={{ marginTop: 4 }} />
                </View>
                <Skeleton width={36} height={16} />
              </View>
            ))}
          </View>
          {/* Second section */}
          <Skeleton width={120} height={14} style={{ marginTop: 20, marginBottom: 12 }} />
          <View style={{ backgroundColor: COLORS.CARD, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: CARD_BORDER }}>
            {[1,2,3].map(i => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: i > 1 ? 1 : 0, borderTopColor: COLORS.BORDER }}>
                <Skeleton width={20} height={14} />
                <Skeleton width={32} height={32} borderRadius={16} />
                <View style={{ flex: 1 }}>
                  <Skeleton width="55%" height={12} />
                  <Skeleton width="35%" height={9} style={{ marginTop: 4 }} />
                </View>
                <Skeleton width={36} height={16} />
              </View>
            ))}
          </View>
        </View>
      );
    }
    if (!leaderboard) {
      return (
        <View style={styles.contentArea}>
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Stats will be available after matches are completed</Text>
          </View>
        </View>
      );
    }

    const topBatsmen = leaderboard.top_batsmen || leaderboard.batting || [];
    const topBowlers = leaderboard.top_bowlers || leaderboard.bowling || [];
    const highestScores = leaderboard.highest_scores || [];

    return (
      <View style={styles.contentArea}>
        {/* Quick stat cards */}
        <View style={styles.statsSummaryRow}>
          <View style={styles.statSummaryCard}>
            <Text style={styles.statSummaryValue}>{completedCount}</Text>
            <Text style={styles.statSummaryLabel}>Matches</Text>
          </View>
          <View style={styles.statSummaryCard}>
            <Text style={styles.statSummaryValue}>{topBatsmen[0]?.runs ?? 0}</Text>
            <Text style={styles.statSummaryLabel}>Most Runs</Text>
          </View>
          <View style={styles.statSummaryCard}>
            <Text style={styles.statSummaryValue}>{topBowlers[0]?.wickets ?? 0}</Text>
            <Text style={styles.statSummaryLabel}>Most Wkts</Text>
          </View>
        </View>

        {/* Top Run Scorers */}
        {topBatsmen.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Top Run Scorers</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Leaderboard', { tournamentId })}>
                <Text style={styles.sectionLink}>Full Board</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.statsCard}>
              {topBatsmen.slice(0, 5).map((b, idx) => (
                <TouchableOpacity
                  key={`${b.player_id}-${idx}`}
                  style={[styles.statsRow, idx < Math.min(topBatsmen.length, 5) - 1 && styles.statsRowBorder]}
                  onPress={() => b.player_id && navigation.navigate('PlayerProfile', { playerId: b.player_id })}
                >
                  <Text style={styles.statsRank}>{idx + 1}</Text>
                  <View style={styles.statsAvatar}>
                    <Text style={styles.statsAvatarText}>
                      {(b.name || b.player_name || 'U').charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.statsPlayerInfo}>
                    <Text style={styles.statsPlayerName}>{b.name || b.player_name || 'Unknown'}</Text>
                    <Text style={styles.statsPlayerMeta}>
                      {b.balls || 0} balls • SR {(b.balls ? (b.runs / b.balls * 100) : 0).toFixed(1)}
                    </Text>
                  </View>
                  <View style={styles.statsValueCol}>
                    <Text style={styles.statsValue}>{b.runs ?? 0}</Text>
                    <Text style={styles.statsValueLabel}>runs</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Top Wicket Takers */}
        {topBowlers.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Top Wicket Takers</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Leaderboard', { tournamentId })}>
                <Text style={styles.sectionLink}>Full Board</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.statsCard}>
              {topBowlers.slice(0, 5).map((b, idx) => (
                <TouchableOpacity
                  key={`${b.player_id}-${idx}`}
                  style={[styles.statsRow, idx < Math.min(topBowlers.length, 5) - 1 && styles.statsRowBorder]}
                  onPress={() => b.player_id && navigation.navigate('PlayerProfile', { playerId: b.player_id })}
                >
                  <Text style={styles.statsRank}>{idx + 1}</Text>
                  <View style={styles.statsAvatar}>
                    <Text style={styles.statsAvatarText}>
                      {(b.name || b.player_name || 'U').charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.statsPlayerInfo}>
                    <Text style={styles.statsPlayerName}>{b.name || b.player_name || 'Unknown'}</Text>
                    <Text style={styles.statsPlayerMeta}>
                      {b.overs || 0} ov • Econ {(b.runs_conceded && b.overs ? (b.runs_conceded / parseFloat(b.overs || 1)).toFixed(1) : '0.0')}
                    </Text>
                  </View>
                  <View style={styles.statsValueCol}>
                    <Text style={styles.statsValue}>{b.wickets ?? 0}</Text>
                    <Text style={styles.statsValueLabel}>wkts</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Highest Scores */}
        {highestScores.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Highest Scores</Text>
            <View style={styles.statsCard}>
              {highestScores.slice(0, 5).map((h, idx) => (
                <View key={idx} style={[styles.statsRow, idx < Math.min(highestScores.length, 5) - 1 && styles.statsRowBorder]}>
                  <Text style={styles.statsRank}>{idx + 1}</Text>
                  <View style={styles.statsAvatar}>
                    <Text style={styles.statsAvatarText}>
                      {(h.player_name || 'U').charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.statsPlayerInfo}>
                    <Text style={styles.statsPlayerName}>{h.player_name || h.name || 'Unknown'}</Text>
                    <Text style={styles.statsPlayerMeta}>
                      {h.balls_faced || 0}b • {h.fours || 0}x4 • {h.sixes || 0}x6
                    </Text>
                  </View>
                  <View style={styles.statsValueCol}>
                    <Text style={styles.statsValue}>{h.runs ?? 0}{h.is_out === false ? '*' : ''}</Text>
                    <Text style={styles.statsValueLabel}>runs</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {topBatsmen.length === 0 && topBowlers.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No stats available yet</Text>
          </View>
        )}
      </View>
    );
  };

  /* ─── Teams tab ─── */
  const renderTeamsTab = () => {
    // Build a map of team qualification statuses from stages data
    const teamQualStatus = {};
    stages.forEach(s => {
      (s.groups || []).forEach(g => {
        (g.teams || []).forEach(t => {
          if (t.qualification_status === 'qualified' || t.qualification_status === 'eliminated') {
            // Keep the most recent (latest stage) status
            teamQualStatus[t.team_id] = t.qualification_status;
          }
        });
      });
    });

    const qualifiedTeams = teams.filter(t => teamQualStatus[t.id] === 'qualified');
    const eliminatedTeams = teams.filter(t => teamQualStatus[t.id] === 'eliminated');
    const otherTeams = teams.filter(t => !teamQualStatus[t.id]);
    const hasQualStatuses = qualifiedTeams.length > 0 || eliminatedTeams.length > 0;

    const renderTeamRow = (t) => {
      const qualStatus = teamQualStatus[t.id];
      const isEliminated = qualStatus === 'eliminated';
      return (
        <TouchableOpacity
          key={t.id}
          style={[styles.teamCard, isEliminated && styles.teamCardEliminated]}
          activeOpacity={0.7}
          onPress={() => navigation.navigate('TeamDetail', { teamId: t.id })}
        >
          <View style={[styles.teamFlag, t.color && { backgroundColor: t.color }, isEliminated && { opacity: 0.4 }]}>
            <Text style={styles.teamFlagText}>{(t.short_name || t.name || '?').charAt(0).toUpperCase()}</Text>
          </View>
          <View style={styles.teamInfo}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={[styles.teamName, isEliminated && { color: COLORS.TEXT_MUTED }]}>{t.name}</Text>
              {qualStatus === 'qualified' && (
                <View style={styles.qualBadge}>
                  <Text style={styles.qualBadgeText}>Q</Text>
                </View>
              )}
              {qualStatus === 'eliminated' && (
                <View style={styles.elimBadge}>
                  <Text style={styles.elimBadgeText}>E</Text>
                </View>
              )}
            </View>
            <Text style={styles.teamShort}>{t.short_name || ''}</Text>
          </View>
          <View style={styles.teamStatsCol}>
            {(() => {
              const teamMatches = matches.filter(m => (m.team_a_id === t.id || m.team_b_id === t.id) && m.status === 'completed');
              const wins = teamMatches.filter(m => m.winner_id === t.id).length;
              return (
                <Text style={[styles.teamStatValue, isEliminated && { color: COLORS.TEXT_MUTED }]}>
                  {teamMatches.length} P / {wins} W
                </Text>
              );
            })()}
          </View>
          <Text style={[styles.teamArrow, isEliminated && { color: COLORS.TEXT_MUTED }]}>›</Text>
        </TouchableOpacity>
      );
    };

    return (
      <View style={styles.contentArea}>
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Teams ({teams.length})</Text>
          </View>

          {teams.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No teams added yet</Text>
            </View>
          )}

          {hasQualStatuses ? (
            <>
              {qualifiedTeams.length > 0 && (
                <View style={{ marginBottom: 16 }}>
                  <Text style={styles.teamSectionLabel}>Qualified</Text>
                  {qualifiedTeams.map(renderTeamRow)}
                </View>
              )}
              {otherTeams.length > 0 && (
                <View style={{ marginBottom: 16 }}>
                  <Text style={styles.teamSectionLabel}>In Progress</Text>
                  {otherTeams.map(renderTeamRow)}
                </View>
              )}
              {eliminatedTeams.length > 0 && (
                <View style={{ marginBottom: 16 }}>
                  <Text style={styles.teamSectionLabel}>Eliminated</Text>
                  {eliminatedTeams.map(renderTeamRow)}
                </View>
              )}
            </>
          ) : (
            teams.map(renderTeamRow)
          )}
        </View>
      </View>
    );
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'Overview': return renderOverviewTab();
      case 'Matches': return renderMatchesTab();
      case 'Standings': return renderStandingsTab();
      case 'Stats': return renderStatsTab();
      case 'Teams': return renderTeamsTab();
      default: return renderOverviewTab();
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <MaterialCommunityIcons name="chevron-left" size={24} color={COLORS.TEXT} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{tournament.name}</Text>
        <TouchableOpacity onPress={handleShare} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Text style={styles.headerIcon}>{'\u2934'}</Text>
        </TouchableOpacity>
      </View>

      {/* Tab Bar with animated indicator */}
      <View style={styles.tabBarWrap}>
        <ScrollView ref={tabBarRef} horizontal showsHorizontalScrollIndicator={false}>
          {TABS.map((tab, i) => (
            <TouchableOpacity
              key={tab}
              style={styles.tab}
              onPress={() => switchToTab(i)}
              onLayout={(e) => { tabItemLayouts.current[i] = e.nativeEvent.layout; }}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <Animated.View
          style={[
            styles.tabIndicator,
            { width: SCREEN_WIDTH / TABS.length, transform: [{ translateX: tabIndicatorX }] },
          ]}
        />
      </View>

      {/* Swipeable content pager */}
      <Animated.ScrollView
        ref={tabPagerRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={onTabPagerScroll}
        onMomentumScrollEnd={onTabPagerMomentumEnd}
        bounces={false}
        style={{ flex: 1 }}
      >
        {TABS.map((tab, i) => (
          <ScrollView
            key={tab}
            style={{ width: SCREEN_WIDTH }}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled
          >
            {tab === 'Overview' && renderOverviewTab()}
            {tab === 'Matches' && renderMatchesTab()}
            {tab === 'Standings' && renderStandingsTab()}
            {tab === 'Stats' && renderStatsTab()}
            {tab === 'Teams' && renderTeamsTab()}
            <View style={{ height: 40 }} />
          </ScrollView>
        ))}
      </Animated.ScrollView>

      {/* ── Edit Tournament Modal ── */}
      <Modal visible={showEditModal} animationType="slide" transparent={false}>
        <View style={[eStyles.screen, { paddingTop: insets.top }]}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
            {/* Header */}
            <View style={eStyles.header}>
              <TouchableOpacity onPress={() => setShowEditModal(false)} style={eStyles.headerSideBtn}>
                <Text style={eStyles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <Text style={eStyles.headerTitle}>Edit Tournament</Text>
              <TouchableOpacity onPress={saveEdit} disabled={editSaving} style={eStyles.headerSideBtn}>
                {editSaving
                  ? <ActivityIndicator size="small" color={PRIMARY} />
                  : <Text style={eStyles.saveText}>Save</Text>
                }
              </TouchableOpacity>
            </View>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

              {/* ── BASIC INFORMATION ── */}
              <Text style={eStyles.sectionLabel}>BASIC INFORMATION</Text>

              <Text style={eStyles.inputLabel}>Tournament Name <Text style={{ color: COLORS.DANGER }}>*</Text></Text>
              <TextInput
                style={eStyles.input}
                value={editForm.name}
                onChangeText={(v) => setEditForm(f => ({ ...f, name: v }))}
                placeholder="e.g. Champions Cricket League 2024"
                placeholderTextColor={COLORS.TEXT_MUTED}
              />

              <Text style={eStyles.inputLabel}>Organizer Name</Text>
              <TextInput
                style={eStyles.input}
                value={editForm.organizer_name}
                onChangeText={(v) => setEditForm(f => ({ ...f, organizer_name: v }))}
                placeholder="Individual or Club Name"
                placeholderTextColor={COLORS.TEXT_MUTED}
              />

              <Text style={eStyles.inputLabel}>Match Format</Text>
              <View style={eStyles.toggleRow}>
                {['T5', 'T10', 'T20', 'Custom'].map(fmt => (
                  <TouchableOpacity
                    key={fmt}
                    style={[eStyles.toggleBtn, editForm.matchFormat === fmt && eStyles.toggleBtnActive]}
                    onPress={() => setEditForm(f => ({ ...f, matchFormat: fmt }))}
                    activeOpacity={0.7}
                  >
                    <Text style={[eStyles.toggleText, editForm.matchFormat === fmt && eStyles.toggleTextActive]}>{fmt}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {editForm.matchFormat === 'Custom' && (
                <>
                  <Text style={eStyles.inputLabel}>Number of Overs</Text>
                  <TextInput
                    style={eStyles.input}
                    value={editForm.customOvers}
                    onChangeText={(v) => setEditForm(f => ({ ...f, customOvers: v }))}
                    placeholder="e.g. 15"
                    placeholderTextColor={COLORS.TEXT_MUTED}
                    keyboardType="numeric"
                  />
                </>
              )}

              <Text style={eStyles.inputLabel}>Ball Type</Text>
              <View style={eStyles.toggleRow}>
                {['tennis', 'leather', 'rubber'].map(bt => (
                  <TouchableOpacity
                    key={bt}
                    style={[eStyles.toggleBtn, editForm.ball_type === bt && eStyles.toggleBtnActive]}
                    onPress={() => setEditForm(f => ({ ...f, ball_type: bt }))}
                    activeOpacity={0.7}
                  >
                    <Text style={[eStyles.toggleText, editForm.ball_type === bt && eStyles.toggleTextActive]}>
                      {bt.charAt(0).toUpperCase() + bt.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* ── SCHEDULE & LOCATION ── */}
              <Text style={eStyles.sectionLabel}>SCHEDULE & LOCATION</Text>

              <View style={eStyles.gridRow}>
                <View style={{ flex: 1 }}>
                  <Text style={eStyles.inputLabel}>Start Date</Text>
                  <TouchableOpacity
                    style={eStyles.inputWithIcon}
                    onPress={() => setEditShowStartPicker(true)}
                    activeOpacity={0.7}
                  >
                    <MaterialCommunityIcons name="calendar" size={18} color={COLORS.TEXT_MUTED} style={{ marginRight: 8 }} />
                    <Text style={[eStyles.inputInnerText, !editForm.start_date && { color: COLORS.TEXT_MUTED }]}>
                      {editForm.start_date ? formatDateDisplay(editForm.start_date) : 'Select date'}
                    </Text>
                  </TouchableOpacity>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={eStyles.inputLabel}>End Date</Text>
                  <TouchableOpacity
                    style={eStyles.inputWithIcon}
                    onPress={() => setEditShowEndPicker(true)}
                    activeOpacity={0.7}
                  >
                    <MaterialCommunityIcons name="calendar" size={18} color={COLORS.TEXT_MUTED} style={{ marginRight: 8 }} />
                    <Text style={[eStyles.inputInnerText, !editForm.end_date && { color: COLORS.TEXT_MUTED }]}>
                      {editForm.end_date ? formatDateDisplay(editForm.end_date) : 'Select date'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Simple date picker modals (inline) */}
              {editShowStartPicker && (
                <Modal visible transparent animationType="fade">
                  <TouchableOpacity style={eStyles.dateOverlay} activeOpacity={1} onPress={() => setEditShowStartPicker(false)}>
                    <View style={eStyles.dateCard} onStartShouldSetResponder={() => true}>
                      <Text style={eStyles.dateTitle}>Start Date</Text>
                      <TextInput
                        style={eStyles.input}
                        placeholder="YYYY-MM-DD"
                        placeholderTextColor={COLORS.TEXT_MUTED}
                        defaultValue={editForm.start_date ? formatDateForAPI(editForm.start_date) : ''}
                        onSubmitEditing={(e) => {
                          const d = new Date(e.nativeEvent.text);
                          if (!isNaN(d.getTime())) {
                            setEditForm(f => ({ ...f, start_date: d }));
                            if (editForm.end_date && editForm.end_date <= d) setEditForm(f => ({ ...f, end_date: null }));
                          }
                          setEditShowStartPicker(false);
                        }}
                        autoFocus
                        returnKeyType="done"
                      />
                      <TouchableOpacity onPress={() => setEditShowStartPicker(false)} style={{ alignSelf: 'flex-end', marginTop: 8 }}>
                        <Text style={{ color: PRIMARY, fontWeight: '600', fontSize: 14 }}>Done</Text>
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                </Modal>
              )}
              {editShowEndPicker && (
                <Modal visible transparent animationType="fade">
                  <TouchableOpacity style={eStyles.dateOverlay} activeOpacity={1} onPress={() => setEditShowEndPicker(false)}>
                    <View style={eStyles.dateCard} onStartShouldSetResponder={() => true}>
                      <Text style={eStyles.dateTitle}>End Date</Text>
                      <TextInput
                        style={eStyles.input}
                        placeholder="YYYY-MM-DD"
                        placeholderTextColor={COLORS.TEXT_MUTED}
                        defaultValue={editForm.end_date ? formatDateForAPI(editForm.end_date) : ''}
                        onSubmitEditing={(e) => {
                          const d = new Date(e.nativeEvent.text);
                          if (!isNaN(d.getTime())) setEditForm(f => ({ ...f, end_date: d }));
                          setEditShowEndPicker(false);
                        }}
                        autoFocus
                        returnKeyType="done"
                      />
                      <TouchableOpacity onPress={() => setEditShowEndPicker(false)} style={{ alignSelf: 'flex-end', marginTop: 8 }}>
                        <Text style={{ color: PRIMARY, fontWeight: '600', fontSize: 14 }}>Done</Text>
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                </Modal>
              )}

              <Text style={eStyles.inputLabel}>Ground / Location</Text>
              <View style={eStyles.inputWithIcon}>
                <MaterialCommunityIcons name="map-marker" size={18} color={COLORS.ACCENT} style={{ marginRight: 8 }} />
                <TextInput
                  style={eStyles.inputInner}
                  value={editForm.location}
                  onChangeText={(v) => setEditForm(f => ({ ...f, location: v }))}
                  placeholder="City or venue name"
                  placeholderTextColor={COLORS.TEXT_MUTED}
                />
              </View>

              {/* ── FEES & REWARDS ── */}
              <Text style={eStyles.sectionLabel}>FEES & REWARDS</Text>

              <View style={eStyles.gridRow}>
                <View style={{ flex: 1 }}>
                  <Text style={eStyles.inputLabel}>Entry Fee</Text>
                  <View style={eStyles.inputWithIcon}>
                    <Text style={eStyles.currencyPrefix}>₹</Text>
                    <TextInput
                      style={eStyles.inputInner}
                      value={editForm.entry_fee}
                      onChangeText={(v) => setEditForm(f => ({ ...f, entry_fee: v }))}
                      placeholder="0"
                      placeholderTextColor={COLORS.TEXT_MUTED}
                      keyboardType="numeric"
                    />
                  </View>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={eStyles.inputLabel}>Prize Pool</Text>
                  <View style={eStyles.inputWithIcon}>
                    <Text style={eStyles.currencyPrefix}>₹</Text>
                    <TextInput
                      style={eStyles.inputInner}
                      value={editForm.prize_pool}
                      onChangeText={(v) => setEditForm(f => ({ ...f, prize_pool: v }))}
                      placeholder="0"
                      placeholderTextColor={COLORS.TEXT_MUTED}
                      keyboardType="numeric"
                    />
                  </View>
                </View>
              </View>

              <View style={{ height: 100 }} />
            </ScrollView>

            {/* Fixed Save Button */}
            <View style={[eStyles.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
              <TouchableOpacity style={eStyles.saveBtn} onPress={saveEdit} disabled={editSaving} activeOpacity={0.8}>
                <Text style={eStyles.saveBtnText}>{editSaving ? 'Saving...' : 'Save Changes'}</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
};

/* ─────────────────────── STYLES ─────────────────────── */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: BG },
  scrollView: { flex: 1 },

  /* ── header ── */
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: COLORS.CARD,
    borderBottomWidth: 1, borderBottomColor: CARD_BORDER,
  },
  headerIcon: { fontSize: 22, color: DARK, width: 32, textAlign: 'center' },
  headerTitle: {
    flex: 1, fontSize: 17, fontWeight: '700', color: DARK, textAlign: 'center', marginHorizontal: 8,
  },

  /* ── tab bar ── */
  tabBarWrap: { backgroundColor: COLORS.CARD, borderBottomWidth: 1, borderBottomColor: CARD_BORDER, position: 'relative' },
  tab: { width: SCREEN_WIDTH / 5, alignItems: 'center', justifyContent: 'center', paddingVertical: 12 },
  tabText: { fontSize: 12, color: TAB_INACTIVE, fontWeight: '600' },
  tabTextActive: { color: DARK, fontWeight: '700' },
  tabIndicator: { position: 'absolute', bottom: 0, height: 3, backgroundColor: PRIMARY, borderRadius: 2 },

  /* ── Swap bracket button ── */
  swapBracketBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 12, marginBottom: 12, borderRadius: 12,
    borderWidth: 1, borderColor: COLORS.WARNING + '40', backgroundColor: COLORS.WARNING + '10',
  },
  swapBracketBtnActive: {
    backgroundColor: COLORS.WARNING, borderColor: COLORS.WARNING,
  },
  swapBracketText: { fontSize: 13, fontWeight: '700', color: COLORS.WARNING },

  /* ── content ── */
  contentArea: { paddingHorizontal: 14, paddingTop: 10 },

  /* ── section ── */
  section: { marginBottom: 16 },
  sectionHeaderRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8,
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: DARK },
  sectionLink: { fontSize: 13, fontWeight: '600', color: PRIMARY },
  liveNowTitle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pulseDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.LIVE },

  /* ── champion banner ── */
  championBanner: {
    backgroundColor: 'rgba(255,215,0,0.1)', borderRadius: 14, padding: 16, alignItems: 'center',
    marginBottom: 14, borderWidth: 1.5, borderColor: 'rgba(255,215,0,0.3)',
  },
  championTrophy: { fontSize: 48, marginBottom: 8 },
  championTitle: { fontSize: 14, fontWeight: '600', color: COLORS.GOLD, textTransform: 'uppercase', letterSpacing: 1 },
  championTeamRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 12 },
  championFlag: {
    width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center',
  },
  championFlagText: { fontSize: 20, fontWeight: '800', color: '#fff' },
  championTeamName: { fontSize: 22, fontWeight: '800', color: DARK },

  /* ── info card ── */
  infoCard: {
    backgroundColor: COLORS.CARD, borderRadius: 16, padding: 16, marginBottom: 20,
    borderWidth: 1, borderColor: CARD_BORDER,
  },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusBadgeText: { fontSize: 11, fontWeight: '700', color: '#fff', textTransform: 'uppercase' },
  typeBadge: { backgroundColor: COLORS.SURFACE, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  typeBadgeText: { fontSize: 10, fontWeight: '600', color: TAB_INACTIVE, letterSpacing: 0.5 },
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  infoItem: {
    width: '25%', alignItems: 'center', paddingVertical: 8,
  },
  infoLabel: { fontSize: 11, color: TAB_INACTIVE, fontWeight: '500', marginBottom: 4 },
  infoValue: { fontSize: 16, fontWeight: '700', color: DARK },
  infoMetaRow: { borderTopWidth: 1, borderTopColor: CARD_BORDER, paddingTop: 12, gap: 4 },
  infoMeta: { fontSize: 12, color: TAB_INACTIVE },

  /* ── timeline ── */
  timelineCard: {
    backgroundColor: COLORS.CARD, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: CARD_BORDER,
  },
  timelineRow: { flexDirection: 'row', minHeight: 56 },
  timelineLeft: { width: 40, alignItems: 'center' },
  timelineCircle: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.SURFACE,
    justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: CARD_BORDER,
  },
  timelineCircleDone: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  timelineCircleActive: { backgroundColor: COLORS.WARNING, borderColor: COLORS.WARNING },
  timelineCheck: { fontSize: 14, color: '#fff', fontWeight: '700' },
  timelineNum: { fontSize: 13, fontWeight: '700', color: TAB_INACTIVE },
  timelineLine: {
    width: 2, flex: 1, backgroundColor: CARD_BORDER, marginVertical: 4,
  },
  timelineLineDone: { backgroundColor: PRIMARY },
  timelineContent: { flex: 1, marginLeft: 12, paddingBottom: 16 },
  timelineStageName: { fontSize: 15, fontWeight: '600', color: COLORS.TEXT_SECONDARY },
  timelineProgress: { marginTop: 6, gap: 4 },
  timelineProgressBar: {
    height: 4, backgroundColor: CARD_BORDER, borderRadius: 2, overflow: 'hidden',
  },
  timelineProgressFill: { height: 4, backgroundColor: PRIMARY, borderRadius: 2 },
  timelineProgressText: { fontSize: 11, color: TAB_INACTIVE },
  timelineWaiting: { fontSize: 12, color: TAB_INACTIVE, fontStyle: 'italic', marginTop: 4 },

  /* ── Stage actions (create next stage, add team) ── */
  stageActionsCard: {
    marginHorizontal: 16, marginTop: 12, gap: 8,
  },
  stageActionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: COLORS.CARD, borderRadius: 14,
    paddingVertical: 14, paddingHorizontal: 16,
    borderWidth: 1, borderColor: COLORS.BORDER,
  },
  stageActionBtnPrimary: {
    backgroundColor: COLORS.ACCENT, borderColor: COLORS.ACCENT,
  },
  stageActionBtnText: { fontSize: 14, fontWeight: '700', color: COLORS.ACCENT },

  /* ── Admin controls ── */
  adminSection: { marginHorizontal: 16, marginTop: 20, marginBottom: 12 },
  adminToggle: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 10, paddingHorizontal: 14,
    backgroundColor: COLORS.SURFACE, borderRadius: 12,
  },
  adminToggleText: { flex: 1, fontSize: 13, fontWeight: '600', color: COLORS.TEXT_MUTED },
  adminContent: { marginTop: 8, gap: 6 },
  adminStageRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.CARD, borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: COLORS.BORDER,
  },
  adminStageName: { fontSize: 13, fontWeight: '600', color: COLORS.TEXT },
  adminStageMeta: { fontSize: 10, color: COLORS.TEXT_MUTED, marginTop: 2 },
  adminBtnWarn: {
    paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8,
    backgroundColor: COLORS.WARNING_BG, borderWidth: 1, borderColor: 'rgba(255,152,0,0.3)',
  },
  adminBtnWarnText: { fontSize: 11, fontWeight: '700', color: COLORS.WARNING },
  adminBtnDanger: {
    paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8,
    backgroundColor: COLORS.DANGER_SOFT, borderWidth: 1, borderColor: 'rgba(229,57,53,0.3)',
  },
  adminBtnDangerText: { fontSize: 11, fontWeight: '700', color: COLORS.DANGER },

  /* ── actions grid ── */
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  actionCard: {
    width: (SCREEN_WIDTH - 58) / 2, backgroundColor: COLORS.CARD, borderRadius: 12,
    padding: 16, alignItems: 'center', borderWidth: 1, borderColor: CARD_BORDER,
  },
  actionCardIcon: { fontSize: 28, marginBottom: 8 },
  actionCardText: { fontSize: 13, fontWeight: '600', color: DARK },

  /* ── filter pills ── */
  filterPill: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: COLORS.CARD, borderWidth: 1, borderColor: CARD_BORDER, marginRight: 8,
  },
  filterPillActive: { backgroundColor: COLORS.ACCENT, borderColor: COLORS.ACCENT },
  filterPillText: { fontSize: 13, fontWeight: '600', color: DARK },
  filterPillTextActive: { color: '#fff' },

  /* ── live card ── */
  liveCard: {
    borderRadius: 16, overflow: 'hidden', marginBottom: 12, backgroundColor: COLORS.CARD_ELEVATED, minHeight: 240,
    borderWidth: 1, borderColor: CARD_BORDER,
  },
  liveCardBg: { ...StyleSheet.absoluteFillObject },
  liveCardGradient: { ...StyleSheet.absoluteFillObject, backgroundColor: COLORS.CARD_ELEVATED, opacity: 0.95 },
  liveCardTopRow: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 16, gap: 10,
  },
  liveBadge: { backgroundColor: COLORS.LIVE, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  liveBadgeText: {
    color: '#fff', fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8,
  },
  liveMatchInfo: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '500' },
  liveScoreArea: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 20, paddingHorizontal: 16, gap: 24,
  },
  liveTeamCol: { alignItems: 'center', flex: 1 },
  liveTeamFlag: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center', alignItems: 'center', marginBottom: 6,
  },
  liveTeamFlagText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  liveTeamAbbr: { color: 'rgba(255,255,255,0.8)', fontSize: 14, fontWeight: '600', marginBottom: 4 },
  liveTeamScore: { color: 'rgba(255,255,255,0.9)', fontSize: 18, fontWeight: '700' },
  liveTeamBatting: { color: PRIMARY },
  liveVsText: { color: 'rgba(255,255,255,0.4)', fontSize: 14, fontWeight: '600' },
  liveStatusText: {
    color: PRIMARY, fontSize: 13, fontWeight: '600', textAlign: 'center', paddingHorizontal: 16, marginBottom: 12,
  },
  watchLiveBtn: {
    backgroundColor: PRIMARY, marginHorizontal: 16, marginBottom: 16, paddingVertical: 12,
    borderRadius: 10, alignItems: 'center',
  },
  watchLiveBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  /* ── upcoming cards ── */
  upcomingCard: {
    backgroundColor: COLORS.CARD, borderRadius: 12, borderWidth: 1, borderColor: CARD_BORDER,
    padding: 14, marginBottom: 10,
  },
  matchStageBadge: {
    fontSize: 10, fontWeight: '600', color: TAB_INACTIVE, textTransform: 'uppercase',
    letterSpacing: 0.5, marginBottom: 8,
  },
  upcomingTeamsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  upcomingTeamInfo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  upcomingFlag: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: COLORS.SURFACE,
    justifyContent: 'center', alignItems: 'center',
  },
  upcomingFlagText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  upcomingTeamName: { fontSize: 14, fontWeight: '600', color: DARK },
  upcomingVs: { fontSize: 13, color: TAB_INACTIVE, fontWeight: '500', marginHorizontal: 12 },
  matchNumBadge: {
    marginLeft: 'auto', backgroundColor: COLORS.SURFACE, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10,
  },
  matchNumText: { fontSize: 11, fontWeight: '600', color: TAB_INACTIVE },
  upcomingDate: { fontSize: 12, color: TAB_INACTIVE, fontWeight: '500' },

  /* ── result cards ── */
  resultsContainer: {
    backgroundColor: COLORS.CARD, borderRadius: 12, borderWidth: 1, borderColor: CARD_BORDER, overflow: 'hidden',
  },
  resultCard: { padding: 14 },
  resultCardBorder: { borderBottomWidth: 1, borderBottomColor: CARD_BORDER },
  resultTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  resultMatchNum: { fontSize: 11, color: TAB_INACTIVE, fontWeight: '500' },
  resultStagePill: { backgroundColor: COLORS.SURFACE, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  resultStageText: { fontSize: 9, fontWeight: '600', color: TAB_INACTIVE, textTransform: 'uppercase' },
  resultScoreRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4,
  },
  resultTeamName: { fontSize: 14, fontWeight: '500', color: COLORS.TEXT_SECONDARY },
  resultTeamScore: { fontSize: 14, fontWeight: '500', color: COLORS.TEXT_SECONDARY },
  resultWinner: { color: PRIMARY, fontWeight: '700' },
  resultText: { fontSize: 12, color: TAB_INACTIVE, marginTop: 6, fontWeight: '500' },

  /* ── stage progression bar ── */
  progressionCard: {
    backgroundColor: COLORS.CARD, borderRadius: 16, padding: 16, marginBottom: 20,
    borderWidth: 1, borderColor: CARD_BORDER,
  },
  progressionRow: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center',
  },
  progressionStep: {
    alignItems: 'center', flex: 1,
  },
  progressionDotRow: {
    flexDirection: 'row', alignItems: 'center', width: '100%', justifyContent: 'center',
  },
  progressionDot: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.SURFACE,
    justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: CARD_BORDER,
  },
  progressionDotDone: {
    backgroundColor: COLORS.SUCCESS, borderColor: COLORS.SUCCESS,
  },
  progressionDotLive: {
    backgroundColor: COLORS.INFO, borderColor: COLORS.INFO,
  },
  progressionLine: {
    flex: 1, height: 2, backgroundColor: CARD_BORDER,
  },
  progressionLineDone: {
    backgroundColor: COLORS.SUCCESS,
  },
  progressionLabel: {
    fontSize: 10, fontWeight: '600', color: DARK, marginTop: 6, textAlign: 'center',
  },
  progressionSub: {
    fontSize: 9, color: TAB_INACTIVE, fontWeight: '500', marginTop: 2,
  },

  /* ── team cards ── */
  teamCard: {
    backgroundColor: COLORS.CARD, borderRadius: 12, borderWidth: 1, borderColor: CARD_BORDER,
    padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'center',
  },
  teamCardEliminated: {
    opacity: 0.6,
  },
  teamFlag: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.SURFACE,
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  teamFlagText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  teamInfo: { flex: 1 },
  teamName: { fontSize: 15, fontWeight: '600', color: DARK },
  teamShort: { fontSize: 12, color: TAB_INACTIVE, marginTop: 2 },
  teamStatsCol: { marginRight: 8 },
  teamStatValue: { fontSize: 12, fontWeight: '600', color: TAB_INACTIVE },
  teamArrow: { fontSize: 22, color: TAB_INACTIVE, fontWeight: '300' },
  teamSectionLabel: {
    fontSize: 12, fontWeight: '700', color: TAB_INACTIVE, textTransform: 'uppercase',
    letterSpacing: 0.8, marginBottom: 8, marginTop: 4,
  },
  qualBadge: {
    backgroundColor: COLORS.SUCCESS, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6,
  },
  qualBadgeText: { fontSize: 10, fontWeight: '800', color: '#fff' },
  elimBadge: {
    backgroundColor: COLORS.LIVE || COLORS.RED, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6,
  },
  elimBadgeText: { fontSize: 10, fontWeight: '800', color: '#fff' },

  /* ── standings ── */
  standingsHeader: {
    flexDirection: 'row', backgroundColor: COLORS.SURFACE,
    borderTopLeftRadius: 10, borderTopRightRadius: 10, paddingVertical: 10, paddingHorizontal: 8,
  },
  standingsHeaderText: { color: COLORS.TEXT_SECONDARY, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  standingsRow: {
    flexDirection: 'row', backgroundColor: COLORS.CARD, paddingVertical: 12, paddingHorizontal: 8,
    borderBottomWidth: 1, borderBottomColor: CARD_BORDER,
  },
  standingsRowAlt: { backgroundColor: '#1F1F1F' },
  standingsCell: { fontSize: 13, color: DARK, fontWeight: '500' },
  standingsTeamCell: { flex: 3 },
  standingsNumCell: { flex: 1, textAlign: 'center' },
  standingsNrrCell: { flex: 1.5, textAlign: 'right', fontSize: 12 },
  standingsRank: { fontSize: 12, fontWeight: '700', color: TAB_INACTIVE, width: 16 },
  standingsDot: { width: 8, height: 8, borderRadius: 4 },
  standingsTeamName: { fontSize: 13, fontWeight: '600', color: DARK, flex: 1 },
  standingsPts: { fontWeight: '800', color: DARK },
  pointsInfoRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.SURFACE, borderRadius: 8, paddingVertical: 6, marginBottom: 16, gap: 8,
  },
  pointsInfoText: { fontSize: 11, fontWeight: '600', color: TAB_INACTIVE },
  pointsInfoDot: { fontSize: 8, color: COLORS.TEXT_HINT },

  /* ── stats summary ── */
  statsSummaryRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  statSummaryCard: {
    flex: 1, backgroundColor: COLORS.CARD, borderRadius: 12, padding: 14, alignItems: 'center',
    borderWidth: 1, borderColor: CARD_BORDER,
  },
  statSummaryValue: { fontSize: 22, fontWeight: '800', color: DARK },
  statSummaryLabel: { fontSize: 11, color: TAB_INACTIVE, fontWeight: '500', marginTop: 4 },

  /* ── stats / leaderboard ── */
  statsCard: {
    backgroundColor: COLORS.CARD, borderRadius: 12, borderWidth: 1, borderColor: CARD_BORDER,
    overflow: 'hidden', marginTop: 8,
  },
  statsRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 14,
  },
  statsRowBorder: { borderBottomWidth: 1, borderBottomColor: CARD_BORDER },
  statsRank: { width: 24, fontSize: 14, fontWeight: '700', color: TAB_INACTIVE },
  statsPlayerInfo: { flex: 1, marginLeft: 4 },
  statsPlayerName: { fontSize: 14, fontWeight: '600', color: DARK },
  statsPlayerMeta: { fontSize: 11, color: TAB_INACTIVE, marginTop: 2 },
  statsAvatar: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: COLORS.ACCENT + '22',
    alignItems: 'center', justifyContent: 'center',
    marginRight: 10,
  },
  statsAvatarText: {
    fontSize: 13, fontWeight: '700', color: COLORS.ACCENT,
  },
  statsValueCol: { alignItems: 'flex-end', minWidth: 50 },
  statsValue: { fontSize: 18, fontWeight: '800', color: DARK },
  statsValueLabel: { fontSize: 10, color: TAB_INACTIVE, fontWeight: '500', textTransform: 'uppercase' },

  /* ── stage pills ── */
  stagePill: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.CARD, borderRadius: 20,
    borderWidth: 1, borderColor: CARD_BORDER, paddingHorizontal: 14, paddingVertical: 8,
    marginRight: 8, gap: 6,
  },
  stagePillActive: { backgroundColor: COLORS.ACCENT, borderColor: COLORS.ACCENT },
  stagePillText: { fontSize: 13, fontWeight: '600', color: DARK },
  stagePillTextActive: { color: '#fff' },
  stageBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  stageBadgeText: { fontSize: 9, fontWeight: '700', color: '#fff', textTransform: 'uppercase' },
  stageProgressCard: {
    backgroundColor: COLORS.CARD, borderRadius: 12, borderWidth: 1, borderColor: CARD_BORDER,
    padding: 14, gap: 12, marginBottom: 16,
  },
  stageNode: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  stageNodeText: { fontSize: 12, fontWeight: '700', color: '#fff' },

  /* ── empty + actions ── */
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: DARK, marginBottom: 8 },
  emptyText: { color: TAB_INACTIVE, fontSize: 14, fontWeight: '500', textAlign: 'center', paddingHorizontal: 20 },
  createMatchBtn: {
    backgroundColor: PRIMARY, paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginBottom: 16,
  },
  createMatchBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  /* ── Edit info button ── */
  editInfoBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8,
    backgroundColor: COLORS.ACCENT + '15',
  },
  editInfoBtnText: { fontSize: 12, fontWeight: '600', color: COLORS.ACCENT },
});

/* ── Edit Modal Styles (matches CreateTournamentScreen) ── */
const eStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.BG },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: COLORS.CARD, borderBottomWidth: 1, borderBottomColor: COLORS.BORDER,
  },
  headerSideBtn: { width: 60 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: DARK, textAlign: 'center', flex: 1 },
  cancelText: { fontSize: 15, color: COLORS.TEXT_SECONDARY, fontWeight: '500' },
  saveText: { fontSize: 15, color: PRIMARY, fontWeight: '700', textAlign: 'right' },

  sectionLabel: {
    fontSize: 11, fontWeight: '600', color: COLORS.TEXT_MUTED,
    letterSpacing: 1, textTransform: 'uppercase', marginTop: 24, marginBottom: 12,
  },
  inputLabel: { fontSize: 13, fontWeight: '500', color: COLORS.TEXT_SECONDARY, marginBottom: 8 },
  input: {
    height: 48, backgroundColor: COLORS.SURFACE,
    borderWidth: 1, borderColor: COLORS.BORDER, borderRadius: 8,
    paddingHorizontal: 16, fontSize: 15, color: DARK, marginBottom: 16,
  },
  inputWithIcon: {
    height: 48, backgroundColor: COLORS.SURFACE,
    borderWidth: 1, borderColor: COLORS.BORDER, borderRadius: 8,
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, marginBottom: 16,
  },
  inputInner: { flex: 1, height: 48, fontSize: 15, color: DARK },
  inputInnerText: { flex: 1, fontSize: 15, color: DARK, lineHeight: 48 },
  currencyPrefix: { fontSize: 15, fontWeight: '600', color: COLORS.TEXT_SECONDARY, marginRight: 4 },

  toggleRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  toggleBtn: {
    flex: 1, height: 48, borderRadius: 8, borderWidth: 1.5, borderColor: COLORS.BORDER,
    backgroundColor: COLORS.CARD, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  toggleBtnActive: { borderWidth: 2, borderColor: COLORS.ACCENT, backgroundColor: COLORS.ACCENT_SOFT },
  toggleText: { fontSize: 14, fontWeight: '500', color: COLORS.TEXT_SECONDARY },
  toggleTextActive: { color: COLORS.ACCENT },

  gridRow: { flexDirection: 'row', gap: 12 },

  dateOverlay: { flex: 1, backgroundColor: COLORS.OVERLAY, justifyContent: 'center', paddingHorizontal: 30 },
  dateCard: { backgroundColor: COLORS.CARD, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: COLORS.BORDER },
  dateTitle: { fontSize: 16, fontWeight: '700', color: DARK, marginBottom: 16 },

  bottomBar: {
    paddingHorizontal: 16, paddingTop: 12,
    backgroundColor: COLORS.BG, borderTopWidth: 1, borderTopColor: COLORS.BORDER,
  },
  saveBtn: {
    backgroundColor: COLORS.ACCENT, borderRadius: 12, paddingVertical: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});

export default TournamentDetailScreen;
