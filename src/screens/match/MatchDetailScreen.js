import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
  Animated, Share, Dimensions,
} from 'react-native';

const SCREEN_WIDTH = Dimensions.get('window').width;
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { matchesAPI, scoringAPI, teamsAPI } from '../../services/api';
import matchWS from '../../services/websocket';
import { COLORS } from '../../theme';
import BackButton from '../../components/BackButton';
import Icon from '../../components/Icon';
import Avatar from '../../components/Avatar';
import StepIndicator from '../../components/StepIndicator';
import Skeleton from '../../components/Skeleton';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const PRIMARY = COLORS.ACCENT;
const TABS = ['Summary', 'Scorecard', 'Commentary', 'Info'];
const COMM_FILTERS = ['All', 'Wickets', 'Boundaries'];

const MatchDetailScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { matchId } = route.params;
  const passedTeams = route.params.teams;

  const [match, setMatch] = useState(null);
  const [loading, setLoading] = useState(true);
  // Track which tabs have been visited (for lazy rendering)
  const [visitedTabs, setVisitedTabs] = useState({ 0: true });
  const [activeTab, setActiveTab] = useState(0);
  const [scorecard, setScorecard] = useState(null);
  const [commentary, setCommentary] = useState({});
  const [commLoading, setCommLoading] = useState(false);
  const [commFilter, setCommFilter] = useState('All');
  const [activeInnings, setActiveInnings] = useState(0);
  const [summaryInnings, setSummaryInnings] = useState(-1); // -1 = auto (latest)
  const [liveState, setLiveState] = useState(null);
  const [teamMap, setTeamMap] = useState({});
  const [squads, setSquads] = useState({});
  const [broadcastMsg, setBroadcastMsg] = useState(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Pulsing red dot
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.3, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  // ── API ──
  const loadMatch = useCallback(async () => {
    try {
      const res = await matchesAPI.get(matchId);
      setMatch(res.data);
    } catch (e) {} finally { setLoading(false); }
  }, [matchId]);

  const loadScorecard = useCallback(async () => {
    try {
      const res = await scoringAPI.scorecard(matchId);
      setScorecard(res.data);
    } catch (e) {}
  }, [matchId]);

  const COMM_PAGE_SIZE = 30;
  const commHasMore = useRef({});

  const loadCommentary = useCallback(async (inningsNum, force) => {
    if (!force && commentary[inningsNum]?.length > 0) return;
    setCommLoading(true);
    try {
      const res = await scoringAPI.commentary(matchId, inningsNum, COMM_PAGE_SIZE, 0);
      const data = res.data || [];
      setCommentary((prev) => ({ ...prev, [inningsNum]: data }));
      commHasMore.current[inningsNum] = data.length >= COMM_PAGE_SIZE;
    } catch (e) {} finally { setCommLoading(false); }
  }, [matchId, commentary]);

  const commLoadingMore = useRef(false);

  const loadMoreCommentary = useCallback(async (inningsNum) => {
    if (!commHasMore.current[inningsNum] || commLoadingMore.current) return;
    commLoadingMore.current = true;
    const existing = commentary[inningsNum] || [];
    try {
      const res = await scoringAPI.commentary(matchId, inningsNum, COMM_PAGE_SIZE, existing.length);
      const data = res.data || [];
      if (data.length > 0) {
        setCommentary((prev) => ({ ...prev, [inningsNum]: [...(prev[inningsNum] || []), ...data] }));
      }
      commHasMore.current[inningsNum] = data.length >= COMM_PAGE_SIZE;
    } catch {} finally {
      commLoadingMore.current = false;
    }
  }, [matchId, commentary]);

  const loadLiveState = useCallback(async () => {
    try {
      const res = await scoringAPI.liveState(matchId);
      setLiveState(res.data);
    } catch (e) {}
  }, [matchId]);

  const loadSquads = useCallback(async (m) => {
    if (!m) return;
    try {
      const [sA, sB] = await Promise.all([
        matchesAPI.getSquad(matchId, m.team_a_id).catch(() => ({ data: [] })),
        matchesAPI.getSquad(matchId, m.team_b_id).catch(() => ({ data: [] })),
      ]);
      setSquads({ [m.team_a_id]: sA.data || [], [m.team_b_id]: sB.data || [] });
    } catch (e) {}
  }, [matchId]);

  // Debounce timer ref for WebSocket events
  const _wsDebounceTimer = useRef(null);

  useFocusEffect(useCallback(() => {
    // Load match first, then scorecard + live state in parallel
    loadMatch();
    Promise.all([
      loadLiveState(),
      scoringAPI.getBroadcast(matchId).then(r => setBroadcastMsg(r.data?.message || null)).catch(() => {}),
    ]);

    if (passedTeams) {
      const m = {};
      (Array.isArray(passedTeams) ? passedTeams : []).forEach(t => { m[t.id] = t; });
      setTeamMap(m);
    } else {
      teamsAPI.list({}).then(r => {
        const m = {};
        (r.data || []).forEach(t => { m[t.id] = t; });
        setTeamMap(m);
      }).catch(() => {});
    }

    // Only connect WebSocket for live/in-progress matches (not completed ones)
    let unsub = null;
    const isLiveMatch = match?.status === 'live' || match?.status === 'in_progress' || match?.status === 'toss' || match?.status === 'squad_set';
    if (isLiveMatch || !match?.status) {
      matchWS.connect(matchId);
      unsub = matchWS.addListener((msg) => {
        if (msg.type === 'broadcast') {
          setBroadcastMsg(msg.data?.message || null);
        } else if (['delivery', 'over_end'].includes(msg.type)) {
          // Ball scored — only refresh live state (lightweight). Scorecard refreshes on tab view.
          if (_wsDebounceTimer.current) clearTimeout(_wsDebounceTimer.current);
          _wsDebounceTimer.current = setTimeout(() => {
            loadLiveState();
            setCommentary({}); // Clear stale commentary cache
          }, 500);
        } else if (['innings_end', 'match_end'].includes(msg.type)) {
          // Major event — refresh everything
          if (_wsDebounceTimer.current) clearTimeout(_wsDebounceTimer.current);
          _wsDebounceTimer.current = setTimeout(() => {
            loadMatch();
            loadScorecard();
            loadLiveState();
            setCommentary({});
          }, 500);
        }
      });
    }
    return () => {
      if (unsub) unsub();
      matchWS.disconnect();
      if (_wsDebounceTimer.current) clearTimeout(_wsDebounceTimer.current);
    };
  }, [matchId]));

  // Load squads when match loads
  useEffect(() => {
    if (match) loadSquads(match);
  }, [match?.id]);

  // Load scorecard + commentary when data is available
  useEffect(() => {
    if (!scorecard) {
      loadScorecard();
      return;
    }
    if (scorecard?.innings?.length > 0) {
      // Load commentary for active innings (used by Commentary tab)
      const innNum = scorecard.innings[activeInnings]?.innings_number;
      if (innNum) loadCommentary(innNum);
      // Also load latest innings commentary (used by Summary tab's recent overs)
      const latestInn = scorecard.innings[scorecard.innings.length - 1];
      if (latestInn?.innings_number && latestInn.innings_number !== innNum) {
        loadCommentary(latestInn.innings_number);
      }
    }
  }, [scorecard?.innings?.length, activeInnings]);

  // Content fade-in after loading
  const contentFade = React.useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!loading && match) {
      Animated.timing(contentFade, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    }
  }, [loading, match]);

  const tabScrollRef = React.useRef(null);
  const tabLayouts = React.useRef({});
  const pagerRef = React.useRef(null);
  const scrollX = React.useRef(new Animated.Value(0)).current;
  const isUserSwiping = React.useRef(false);

  const scrollTabIntoView = useCallback((i) => {
    const layout = tabLayouts.current[i];
    if (layout && tabScrollRef.current) {
      tabScrollRef.current.scrollTo({ x: Math.max(0, layout.x - 40), animated: true });
    }
  }, []);

  const switchTab = useCallback((i) => {
    if (i < 0 || i >= TABS.length) return;
    setActiveTab(i);
    setVisitedTabs(prev => ({ ...prev, [i]: true }));
    scrollTabIntoView(i);
    pagerRef.current?.scrollTo({ x: i * SCREEN_WIDTH, animated: true });
    if (i === 1 && !scorecard) loadScorecard();
  }, [scorecard, loadScorecard, scrollTabIntoView]);

  // Sync tab index when user swipes the pager
  const onPagerScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
    { useNativeDriver: false },
  );

  const onPagerMomentumEnd = useCallback((e) => {
    const newIdx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    if (newIdx >= 0 && newIdx < TABS.length) {
      setVisitedTabs(prev => ({ ...prev, [newIdx]: true }));
      if (newIdx !== activeTab) {
        setActiveTab(newIdx);
        scrollTabIntoView(newIdx);
        if (newIdx === 1 && !scorecard) loadScorecard();
      }
    }
    isUserSwiping.current = false;
  }, [activeTab, scorecard, loadScorecard, scrollTabIntoView]);

  // Animated tab indicator position (follows swipe smoothly)
  const indicatorTranslateX = scrollX.interpolate({
    inputRange: TABS.map((_, i) => i * SCREEN_WIDTH),
    outputRange: TABS.map((_, i) => i * (SCREEN_WIDTH / TABS.length)),
    extrapolate: 'clamp',
  });

  const onInningsChange = useCallback((i) => {
    setActiveInnings(i);
    // Load commentary for the selected innings
    if (scorecard?.innings?.[i]) {
      loadCommentary(scorecard.innings[i].innings_number);
    }
  }, [activeTab, scorecard, loadCommentary]);

  // ── Helpers ──
  const getTeamName = (id) => match?.[`team_${id === match?.team_a_id ? 'a' : 'b'}_name`] || teamMap[id]?.name || `Team`;
  const getTeamShort = (id) => {
    if (match?.team_a_id === id && match?.team_a_short) return match.team_a_short;
    if (match?.team_b_id === id && match?.team_b_short) return match.team_b_short;
    return teamMap[id]?.short_name || teamMap[id]?.name?.substring(0, 3).toUpperCase() || 'TBD';
  };
  const getTeamColor = (id) => {
    if (match?.team_a_id === id && match?.team_a_color) return match.team_a_color;
    if (match?.team_b_id === id && match?.team_b_color) return match.team_b_color;
    return teamMap[id]?.color || PRIMARY;
  };
  const isCreator = user?.id === match?.created_by;

  const goToPlayer = useCallback((playerId) => {
    if (playerId) navigation.navigate('PlayerProfile', { playerId });
  }, [navigation]);

  const handleShare = useCallback(async () => {
    try {
      const { getMatchLink } = require('../../services/linking');
      const tA = getTeamShort(match?.team_a_id);
      const tB = getTeamShort(match?.team_b_id);
      const link = getMatchLink(matchId);
      await Share.share({
        message: `${tA} vs ${tB} - Match on CrecKStars\n${link}`,
        url: link,
      });
    } catch (e) {}
  }, [match?.team_a_id, match?.team_b_id, matchId]);

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch { return ''; }
  };

  // Ball display helpers
  const getBallDisplay = (ball) => {
    if (ball.is_wicket) return 'W';
    if (ball.is_six) return '6';
    if (ball.is_boundary) return '4';
    if (ball.extra_type === 'wide') return `${ball.total_runs}wd`;
    if (ball.extra_type === 'noball') return `${ball.total_runs}nb`;
    if (ball.extra_type === 'bye' || ball.extra_type === 'legbye') return `${ball.total_runs}b`;
    return String(ball.batsman_runs);
  };

  const getBallBg = (ball) => {
    if (ball.is_wicket) return COLORS.LIVE;
    if (ball.is_six) return PRIMARY;
    if (ball.is_boundary) return COLORS.SUCCESS;
    if (ball.extra_type) return COLORS.WARNING;
    return COLORS.SURFACE;
  };

  const getBallTextColor = (ball) => {
    if (ball.is_wicket || ball.is_six) return COLORS.TEXT;
    if (ball.is_boundary) return COLORS.TEXT;
    if (ball.extra_type) return COLORS.BG;
    return COLORS.TEXT_SECONDARY;
  };

  const getBallDescription = (ball) => {
    const bowler = ball.bowler_name || 'Bowler';
    const striker = ball.striker_name || 'Batsman';
    if (ball.is_wicket) {
      const dismissed = ball.dismissed_player_name || striker;
      const fielder = ball.fielder_name;
      let desc = `${bowler} to ${striker}, OUT! ${dismissed}`;
      if (ball.wicket_type === 'bowled') desc += ' bowled';
      else if (ball.wicket_type === 'caught') desc += fielder ? ` c ${fielder}` : ' caught';
      else if (ball.wicket_type === 'lbw') desc += ' lbw';
      else if (ball.wicket_type === 'run_out') desc += fielder ? ` run out (${fielder})` : ' run out';
      else if (ball.wicket_type === 'stumped') desc += fielder ? ` st ${fielder}` : ' stumped';
      else desc += ` ${ball.wicket_type || ''}`;
      return desc;
    }
    if (ball.extra_type === 'wide') return `${bowler} to ${striker}, wide, ${ball.total_runs} run(s)`;
    if (ball.extra_type === 'noball') return `${bowler} to ${striker}, no ball, ${ball.total_runs} run(s)`;
    let desc = `${bowler} to ${striker}, `;
    if (ball.is_six) desc += 'SIX!';
    else if (ball.is_boundary) desc += 'FOUR!';
    else if (ball.batsman_runs === 0) desc += 'no run';
    else desc += `${ball.batsman_runs} run(s)`;
    return desc;
  };

  // ── Derived data (memoized — must be before early returns) ──
  const innings = useMemo(() => scorecard?.innings || [], [scorecard]);
  const currentInn = innings[activeInnings];
  const commData = commentary[currentInn?.innings_number] || [];

  const { overGroups, overNumbers } = useMemo(() => {
    const groups = {};
    [...commData].reverse().forEach((ball) => {
      const key = ball.over;
      if (!groups[key]) groups[key] = [];
      groups[key].push(ball);
    });
    const numbers = Object.keys(groups).map(Number).sort((a, b) => b - a);
    return { overGroups: groups, overNumbers: numbers };
  }, [commData]);

  // Memoize summary overs (must be before early returns to respect Rules of Hooks)
  const summaryInningsIdx = summaryInnings >= 0 ? summaryInnings : (innings.length - 1);
  const summaryInnData = innings[summaryInningsIdx] || null;
  const summaryInnNum = summaryInnData?.innings_number || null;
  const summaryCommData = summaryInnNum ? (commentary[summaryInnNum] || []) : [];
  const { summaryOvers, summaryOverNums } = useMemo(() => {
    const overs = {};
    [...summaryCommData].forEach((ball) => {
      const key = ball.over;
      if (key === undefined || key === null) return;
      if (!overs[key]) overs[key] = [];
      overs[key].push(ball);
    });
    Object.values(overs).forEach(arr => arr.sort((a, b) => a.ball - b.ball));
    const overNums = Object.keys(overs).map(Number).sort((a, b) => a - b);
    return { summaryOvers: overs, summaryOverNums: overNums };
  }, [summaryCommData]);

  // Filter commentary (must be before early returns — Rules of Hooks)
  const getFilteredBalls = useCallback((balls) => {
    if (commFilter === 'All') return balls;
    if (commFilter === 'Wickets') return balls.filter(b => b.is_wicket);
    if (commFilter === 'Boundaries') return balls.filter(b => b.is_boundary || b.is_six);
    return balls;
  }, [commFilter]);

  // ── Loading ──
  if (loading) {
    return (
      <View style={st.loadingContainer}>
        <View style={st.header}>
          <Skeleton width={36} height={36} borderRadius={18} />
          <Skeleton width={150} height={18} />
          <Skeleton width={36} height={36} borderRadius={18} />
        </View>
        <Skeleton width="90%" height={180} borderRadius={16} style={{ alignSelf: 'center', marginTop: 16 }} />
        <View style={{ flexDirection: 'row', gap: 12, margin: 16 }}>
          <Skeleton width="48%" height={80} borderRadius={14} />
          <Skeleton width="48%" height={80} borderRadius={14} />
        </View>
      </View>
    );
  }

  if (!match) return null;

  // Score helpers
  const getInningsScore = (teamId) => {
    const inn = innings.find(i => i.batting_team_id === teamId);
    if (!inn) return { runs: '-', wickets: '', overs: '' };
    return { runs: inn.total_runs, wickets: inn.total_wickets, overs: inn.total_overs };
  };

  const scoreA = getInningsScore(match.team_a_id);
  const scoreB = getInningsScore(match.team_b_id);

  const isLive = match.status === 'live';
  const isCompleted = match.status === 'completed';
  const isInningsBreak = liveState?.innings_break === true;

  const statusText = match.result_summary
    || (isInningsBreak
      ? `Innings Break — Target: ${liveState.target} runs`
      : isLive && liveState?.target > 0
      ? `Need ${liveState.target - (liveState.total_runs || 0)} runs from ${Math.max(0, (match.overs * 6) - (Math.floor(liveState.total_overs || 0) * 6 + Math.round(((liveState.total_overs || 0) % 1) * 10)))} balls${liveState.dls_par != null ? ` • DLS Par: ${liveState.dls_par}` : ''}`
      : isLive ? 'Match in progress'
      : match.status === 'upcoming' ? 'Match yet to begin'
      : '');

  // Determine which innings to show in summary (user-selectable or auto = latest)
  const sumInnIdx = summaryInningsIdx;
  const sumInnData = summaryInnData;
  const sumBattingId = sumInnData?.batting_team_id || match.team_a_id;
  const sumBowlingId = sumBattingId === match.team_a_id ? match.team_b_id : match.team_a_id;
  const battingInnScore = sumInnData
    ? { runs: sumInnData.total_runs, wickets: sumInnData.total_wickets, overs: sumInnData.total_overs }
    : { runs: '-', wickets: '', overs: '' };
  const bowlingInnScore = getInningsScore(sumBowlingId);
  const fowList = sumInnData?.fall_of_wickets || [];
  const lastFow = fowList.length > 0 ? fowList[fowList.length - 1] : null;
  const lastWicketBatter = lastFow ? sumInnData?.batting?.find(b => b.player_id === lastFow.player_id) : null;
  const computedCRR = sumInnData ? (sumInnData.total_runs / (sumInnData.total_overs || 1)).toFixed(2) : '0.00';

  const getNextAction = () => {
    if (!isCreator) return null;
    switch (match.status) {
      case 'upcoming': return { label: 'Record Toss', screen: 'Toss' };
      case 'toss': return { label: 'Set Squad', screen: 'SelectSquad' };
      case 'live': return { label: 'Continue Scoring', screen: 'LiveScoring' };
      default: return null;
    }
  };
  const action = getNextAction();

  const matchTypeLabel = (t) => {
    if (!t) return '';
    const map = { group: 'Group Stage', semi: 'Semi Final', final: 'Final', league: 'League' };
    return map[t] || t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  };

  // ── Squad card renderer ──
  const getRoleIcon = (role) => {
    switch (role) {
      case 'batsman': return 'batsman';
      case 'bowler': return 'bowler';
      case 'all_rounder': return 'allRounder';
      case 'wicket_keeper': return 'wicketKeeper';
      default: return 'batsman';
    }
  };

  const getRoleLabel = (role) => {
    switch (role) {
      case 'batsman': return 'Batsman';
      case 'bowler': return 'Bowler';
      case 'all_rounder': return 'All-rounder';
      case 'wicket_keeper': return 'Wicket Keeper';
      default: return role || '';
    }
  };

  const renderSquadCard = (teamId) => {
    const squad = squads[teamId] || [];
    const color = getTeamColor(teamId);
    return (
      <View style={st.card}>
        <View style={st.squadHeader}>
          <View style={[st.squadBar, { backgroundColor: color }]} />
          <Text style={st.sectionTitle}>Playing XI - {getTeamShort(teamId)}</Text>
          <Text style={{ fontSize: 11, color: COLORS.TEXT_MUTED, marginLeft: 'auto' }}>{squad.length} players</Text>
        </View>
        {squad.map((p, i) => {
          const pName = p.full_name || p.player_name || p.name || 'Unknown';
          return (
            <TouchableOpacity key={`${p.player_id}-${i}`} style={st.squadRow} onPress={() => goToPlayer(p.player_id)}>
              <Avatar name={pName} size={36} color={color} type="player" />
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={st.squadName}>{pName}</Text>
                  {i === 0 && <Text style={{ fontSize: 9, color: COLORS.ACCENT, fontWeight: '700' }}>(c)</Text>}
                </View>
                {p.role && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                    <Icon name={getRoleIcon(p.role)} size={10} />
                    <Text style={st.squadRole}>{getRoleLabel(p.role)}</Text>
                  </View>
                )}
              </View>
              <Text style={{ fontSize: 11, color: COLORS.TEXT_MUTED, fontWeight: '600' }}>#{p.batting_order || i + 1}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  // ═══════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════

  return (
    <Animated.View style={[st.container, { paddingTop: insets.top, opacity: contentFade }]}>

      {/* ── HEADER ── */}
      <View style={st.header}>
        <BackButton onPress={() => navigation.goBack()} />
        <View style={st.headerCenter}>
          <View style={st.headerTitleRow}>
            {isLive && <Animated.View style={[st.liveDot, { opacity: pulseAnim }]} />}
            <Text style={st.headerTitle} numberOfLines={1}>
              {getTeamShort(match.team_a_id)} vs {getTeamShort(match.team_b_id)}
            </Text>
          </View>
          {(match.tournament_name || match.match_code) && (
            <Text style={st.headerSubtitle} numberOfLines={1}>
              {match.tournament_name || ''}{match.match_number ? ` \u2022 Match ${match.match_number}` : ''}{match.match_code ? ` \u2022 ${match.match_code}` : ''}
            </Text>
          )}
        </View>
        <TouchableOpacity onPress={handleShare} style={st.headerBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Icon name="share" size={18} color={COLORS.TEXT} />
        </TouchableOpacity>
      </View>

      {/* ── TAB BAR with animated indicator ── */}
      <View style={st.tabBarWrap}>
        <ScrollView
          ref={tabScrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={st.tabBarScroll}
        >
          {TABS.map((tab, i) => (
            <TouchableOpacity
              key={tab}
              style={st.tab}
              onPress={() => switchTab(i)}
              onLayout={(e) => { tabLayouts.current[i] = e.nativeEvent.layout; }}
              activeOpacity={0.7}
            >
              <Text style={[st.tabText, activeTab === i && st.tabTextActive]}>{tab}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        {/* Animated sliding indicator */}
        <Animated.View
          style={[
            st.tabIndicator,
            { width: SCREEN_WIDTH / TABS.length, transform: [{ translateX: indicatorTranslateX }] },
          ]}
        />
      </View>

      {/* ── MATCH SETUP STEPPER (creator only, non-completed) ── */}
      {isCreator && !isCompleted && activeTab === 0 && (() => {
        const MATCH_STEPS = ['Create', 'Toss', 'Squad', 'Openers', 'Scoring'];
        const stepMap = {
          upcoming: 0,  // Match created, needs toss
          toss: 1,      // Toss done, needs squad
          squad_set: 2, // Squad set, needs openers
          live: 4,      // Match is live (scoring)
        };
        // Determine current step from match status
        let currentStep = stepMap[match.status] ?? 0;
        // If toss done but not squad, it's step 2
        if (match.toss_winner_id && !isLive && match.status !== 'squad_set') currentStep = Math.max(currentStep, 1);
        // Check if squads exist
        const hasSquads = Object.values(squads).some(s => s && s.length > 0);
        if (hasSquads && !isLive) currentStep = Math.max(currentStep, 2);
        if (isLive) currentStep = 4;

        const handleStepPress = (index) => {
          const teamsList = Object.values(teamMap);
          if (isLive) {
            if (index === 4) navigation.replace('LiveScoring', { matchId });
            return;
          }
          // Use replace for forward steps so back doesn't return to MatchDetail mid-setup
          if (index === 1) navigation.replace('Toss', { matchId, match, teams: teamsList });
          else if (index === 2) navigation.replace('SelectSquad', { matchId, match, teams: teamsList });
          else if (index === 3) navigation.replace('SelectOpeners', { matchId, match, teams: teamsList });
          else if (index === 4) navigation.replace('LiveScoring', { matchId });
        };

        return (
          <StepIndicator
            steps={MATCH_STEPS}
            currentStep={currentStep}
            onStepPress={handleStepPress}
          />
        );
      })()}

      <Animated.ScrollView
        ref={pagerRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={onPagerScroll}
        onMomentumScrollEnd={onPagerMomentumEnd}
        onScrollBeginDrag={() => { isUserSwiping.current = true; }}
        bounces={false}
        style={{ flex: 1 }}
      >

        {/* ── PAGE 0: SUMMARY ── */}
        <ScrollView style={{ width: SCREEN_WIDTH }} showsVerticalScrollIndicator={false} nestedScrollEnabled>

        {/* ═══════════════════════════════════════════════════════ */}
        {/* SUMMARY TAB (0)                                       */}
        {/* ═══════════════════════════════════════════════════════ */}
          <View style={st.tabContent}>
            {/* Innings selector removed — scores shown in Score Hero card */}

            {/* Score Hero Card */}
            <View style={st.scoreHero}>
              {isLive && sumInnIdx === innings.length - 1 ? (
                <>
                  {/* Live: Batting team focus layout */}
                  <View style={st.heroTopRow}>
                    <View style={{ flex: 1 }}>
                      <View style={st.heroTeamRow}>
                        <View style={[st.heroFlagChip, { backgroundColor: getTeamColor(sumBattingId) }]}>
                          <Text style={st.heroFlagChipText}>{getTeamShort(sumBattingId)}</Text>
                        </View>
                        <Text style={st.heroTeamLabel} numberOfLines={1}>{getTeamName(sumBattingId)}</Text>
                      </View>
                      <View style={st.heroScoreRow}>
                        <Text style={st.heroScoreBig}>
                          {battingInnScore.runs !== '-' ? `${battingInnScore.runs}/${battingInnScore.wickets}` : '-'}
                        </Text>
                        {battingInnScore.overs !== '' && (
                          <Text style={st.heroOversLabel}>({battingInnScore.overs})</Text>
                        )}
                      </View>
                    </View>
                    <View style={st.heroRightCol}>
                      <View style={st.liveBadge}>
                        <Animated.View style={[st.liveBadgeDot, { opacity: pulseAnim }]} />
                        <Text style={st.liveBadgeText}>LIVE</Text>
                      </View>
                      <Text style={st.heroCrrText}>CRR: {liveState?.run_rate || computedCRR}</Text>
                      {liveState?.required_rate != null && (
                        <Text style={st.heroRrrText}>RRR: {liveState.required_rate}</Text>
                      )}
                    </View>
                  </View>
                  {statusText !== '' && (
                    <View style={st.heroInfoBar}>
                      <Icon name="info" size={14} color={COLORS.ACCENT_LIGHT} />
                      <Text style={st.heroInfoText}>{statusText}</Text>
                    </View>
                  )}
                </>
              ) : (
                <>
                  {/* Completed/Upcoming: Both teams layout */}
                  <View style={st.heroStatusRow}>
                    {isCompleted && (
                      <View style={[st.liveBadge, { backgroundColor: COLORS.SUCCESS_BG }]}>
                        <Text style={[st.liveBadgeText, { color: COLORS.SUCCESS }]}>COMPLETED</Text>
                      </View>
                    )}
                    {!isCompleted && (
                      <View style={[st.liveBadge, { backgroundColor: COLORS.WARNING_BG }]}>
                        <Text style={[st.liveBadgeText, { color: COLORS.WARNING }]}>{match.status?.toUpperCase()}</Text>
                      </View>
                    )}
                    {match.match_type && <Text style={st.heroMatchInfo}>{matchTypeLabel(match.match_type)}</Text>}
                  </View>
                  {/* Team A */}
                  <View style={st.heroTeamScoreRow}>
                    <TouchableOpacity
                      style={st.heroTeamRow}
                      activeOpacity={0.7}
                      onPress={() => match.team_a_id && navigation.navigate('TeamDetail', { teamId: match.team_a_id })}
                    >
                      <View style={[st.heroFlagChip, { backgroundColor: getTeamColor(match.team_a_id) }]}>
                        <Text style={st.heroFlagChipText}>{getTeamShort(match.team_a_id)}</Text>
                      </View>
                      <Text style={st.heroTeamLabel} numberOfLines={1}>{getTeamName(match.team_a_id)}</Text>
                    </TouchableOpacity>
                    {scoreA.runs !== '-' && (
                      <Text style={st.heroTeamScoreText}>{scoreA.runs}/{scoreA.wickets} ({scoreA.overs} ov)</Text>
                    )}
                  </View>
                  {/* Team B */}
                  <View style={st.heroTeamScoreRow}>
                    <TouchableOpacity
                      style={st.heroTeamRow}
                      activeOpacity={0.7}
                      onPress={() => match.team_b_id && navigation.navigate('TeamDetail', { teamId: match.team_b_id })}
                    >
                      <View style={[st.heroFlagChip, { backgroundColor: getTeamColor(match.team_b_id) }]}>
                        <Text style={st.heroFlagChipText}>{getTeamShort(match.team_b_id)}</Text>
                      </View>
                      <Text style={st.heroTeamLabel} numberOfLines={1}>{getTeamName(match.team_b_id)}</Text>
                    </TouchableOpacity>
                    {scoreB.runs !== '-' && (
                      <Text style={st.heroTeamScoreText}>{scoreB.runs}/{scoreB.wickets} ({scoreB.overs} ov)</Text>
                    )}
                  </View>
                  {/* Result / Status */}
                  {statusText !== '' && (
                    <View style={st.heroInfoBar}>
                      <Icon name="info" size={14} color={COLORS.ACCENT_LIGHT} />
                      <Text style={st.heroInfoText}>{statusText}</Text>
                    </View>
                  )}
                  {match.match_date && (
                    <View style={st.heroDateRow}>
                      <Text style={st.heroDateText}>{formatDate(match.match_date)}{match.time_slot ? ` \u2022 ${match.time_slot}` : ''}</Text>
                    </View>
                  )}
                </>
              )}
            </View>

            {/* ====== BROADCAST BANNER ====== */}
            {broadcastMsg && (
              <View style={st.broadcastBanner}>
                <MaterialCommunityIcons name="bullhorn" size={16} color={COLORS.WARNING} />
                <Text style={st.broadcastBannerText}>{broadcastMsg}</Text>
              </View>
            )}

            {/* ====== PLAYER OF THE MATCH (completed only) ====== */}
            {isCompleted && scorecard?.top_performers?.player_of_match && (() => {
              const pom = scorecard.top_performers.player_of_match;
              return (
                <TouchableOpacity style={st.pomCard} activeOpacity={0.7} onPress={() => goToPlayer(pom.player_id)}>
                  <View style={st.pomBadge}>
                    <MaterialCommunityIcons name="trophy" size={14} color="#FFD700" />
                    <Text style={st.pomBadgeText}>PLAYER OF THE MATCH</Text>
                  </View>
                  <View style={st.pomContent}>
                    <View style={st.pomAvatarWrap}>
                      <Avatar
                        name={pom.player_name}
                        size={56}
                        color="#FFD700"
                        showRing
                        type="player"
                      />
                      <View style={st.pomStarBadge}>
                        <MaterialCommunityIcons name="star" size={12} color="#FFD700" />
                      </View>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={st.pomName}>{pom.player_name}</Text>
                      {pom.batting && (
                        <View style={st.pomStatLine}>
                          <MaterialCommunityIcons name="cricket" size={12} color={COLORS.ACCENT_LIGHT} />
                          <Text style={st.pomStatVal}>{pom.batting.runs}</Text>
                          <Text style={st.pomStatLabel}>({pom.batting.balls_faced}b)</Text>
                          <Text style={st.pomStatDetail}>{pom.batting.fours || 0}x4  {pom.batting.sixes || 0}x6</Text>
                          <Text style={st.pomStatDetail}>SR {(pom.batting.strike_rate || 0).toFixed(0)}</Text>
                        </View>
                      )}
                      {pom.bowling && pom.bowling.wickets > 0 && (
                        <View style={st.pomStatLine}>
                          <MaterialCommunityIcons name="baseball" size={12} color={COLORS.WARNING} />
                          <Text style={st.pomStatVal}>{pom.bowling.wickets}/{pom.bowling.runs_conceded}</Text>
                          <Text style={st.pomStatLabel}>({pom.bowling.overs_bowled} ov)</Text>
                          <Text style={st.pomStatDetail}>Econ {(pom.bowling.economy_rate || 0).toFixed(1)}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })()}

            {/* ====== KEY PERFORMERS - Player cards with avatar + stats (CricHeroes style) ====== */}
            {isCompleted && scorecard?.top_performers && (() => {
              const tp = scorecard.top_performers;
              const batters = tp.best_batters || [];
              const bowlers = tp.best_bowlers || [];
              if (!batters.length && !bowlers.length) return null;
              return (
                <>
                  {/* Best Batters */}
                  {batters.length > 0 && (
                    <View style={st.perfSection}>
                      <View style={st.perfSectionHead}>
                        <MaterialCommunityIcons name="cricket" size={16} color={COLORS.ACCENT_LIGHT} />
                        <Text style={st.perfSectionTitle}>Best Batters</Text>
                      </View>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.perfCardScroll}>
                        {batters.map((b, i) => {
                          return (
                            <TouchableOpacity key={i} style={st.perfPlayerCard} onPress={() => goToPlayer(b.player_id)} activeOpacity={0.7}>
                              {i === 0 && <View style={st.perfBestBadge}><MaterialCommunityIcons name="star" size={10} color="#FFD700" /></View>}
                              <Avatar name={b.player_name} size={48} color={COLORS.ACCENT} type="player" />
                              <Text style={st.perfCardName} numberOfLines={1}>{b.player_name}</Text>
                              <Text style={st.perfCardTeam} numberOfLines={1}>{b.team_name}</Text>
                              <View style={st.perfCardDivider} />
                              <Text style={st.perfCardMainStat}>{b.runs}<Text style={st.perfCardStatUnit}> runs</Text></Text>
                              <Text style={st.perfCardSubStat}>{b.balls_faced}b  {b.fours || 0}x4  {b.sixes || 0}x6</Text>
                              <Text style={st.perfCardSubStat}>SR {(b.strike_rate || 0).toFixed(1)}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    </View>
                  )}

                  {/* Best Bowlers */}
                  {bowlers.length > 0 && (
                    <View style={st.perfSection}>
                      <View style={st.perfSectionHead}>
                        <MaterialCommunityIcons name="baseball" size={16} color={COLORS.WARNING} />
                        <Text style={st.perfSectionTitle}>Best Bowlers</Text>
                      </View>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.perfCardScroll}>
                        {bowlers.map((bw, i) => {
                          return (
                            <TouchableOpacity key={i} style={st.perfPlayerCard} onPress={() => goToPlayer(bw.player_id)} activeOpacity={0.7}>
                              {i === 0 && <View style={st.perfBestBadge}><MaterialCommunityIcons name="star" size={10} color="#FFD700" /></View>}
                              <Avatar name={bw.player_name} size={48} color={COLORS.WARNING} type="player" />
                              <Text style={st.perfCardName} numberOfLines={1}>{bw.player_name}</Text>
                              <Text style={st.perfCardTeam} numberOfLines={1}>{bw.team_name}</Text>
                              <View style={st.perfCardDivider} />
                              <Text style={st.perfCardMainStat}>{bw.wickets}/{bw.runs_conceded}</Text>
                              <Text style={st.perfCardSubStat}>{bw.overs_bowled} ov  {bw.maidens || 0}m</Text>
                              <Text style={st.perfCardSubStat}>Econ {(bw.economy_rate || 0).toFixed(1)}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    </View>
                  )}

                  {/* Match Stats removed — available in Scorecard tab */}
                </>
              );
            })()}

            {/* Bowling team score removed — shown in Score Hero card */}

            {/* Recent Overs removed — available in Commentary tab */}

            {/* Mini Scorecard */}
            {isLive && sumInnIdx === innings.length - 1 && liveState && !liveState.message && (
              <View style={st.miniCard}>
                {/* Batter header */}
                <View style={st.miniTHead}>
                  <Text style={[st.miniTh, { flex: 1, textAlign: 'left' }]}>BATTER</Text>
                  <Text style={st.miniTh}>R</Text>
                  <Text style={st.miniTh}>B</Text>
                  <Text style={st.miniTh}>4s</Text>
                  <Text style={st.miniTh}>6s</Text>
                  <Text style={[st.miniTh, { width: 46 }]}>SR</Text>
                </View>
                {/* Striker */}
                {liveState.striker && (
                  <View style={st.miniTRow}>
                    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Text style={st.miniPlayerBold}>{liveState.striker.name}</Text>
                      <MaterialCommunityIcons name="star" size={11} color={PRIMARY} />
                    </View>
                    <Text style={st.miniTdBold}>{liveState.striker.runs}</Text>
                    <Text style={st.miniTd}>{liveState.striker.balls}</Text>
                    <Text style={st.miniTd}>{liveState.striker.fours ?? 0}</Text>
                    <Text style={st.miniTd}>{liveState.striker.sixes ?? 0}</Text>
                    <Text style={[st.miniTdLight, { width: 46 }]}>
                      {liveState.striker.balls > 0 ? ((liveState.striker.runs / liveState.striker.balls) * 100).toFixed(1) : '0.0'}
                    </Text>
                  </View>
                )}
                {/* Non-striker */}
                {liveState.non_striker && (
                  <View style={st.miniTRow}>
                    <Text style={[st.miniPlayerMed, { flex: 1 }]}>{liveState.non_striker.name}</Text>
                    <Text style={st.miniTdBold}>{liveState.non_striker.runs}</Text>
                    <Text style={st.miniTd}>{liveState.non_striker.balls}</Text>
                    <Text style={st.miniTd}>{liveState.non_striker.fours ?? 0}</Text>
                    <Text style={st.miniTd}>{liveState.non_striker.sixes ?? 0}</Text>
                    <Text style={[st.miniTdLight, { width: 46 }]}>
                      {liveState.non_striker.balls > 0 ? ((liveState.non_striker.runs / liveState.non_striker.balls) * 100).toFixed(1) : '0.0'}
                    </Text>
                  </View>
                )}
                {/* Bowler */}
                {liveState.bowler && (
                  <>
                    <View style={[st.miniTHead, { borderTopWidth: 1, borderTopColor: '#E2E8F0' }]}>
                      <Text style={[st.miniTh, { flex: 1, textAlign: 'left' }]}>BOWLER</Text>
                      <Text style={st.miniTh}>O</Text>
                      <Text style={st.miniTh}>M</Text>
                      <Text style={st.miniTh}>R</Text>
                      <Text style={st.miniTh}>W</Text>
                      <Text style={[st.miniTh, { width: 46 }]}>ECO</Text>
                    </View>
                    <View style={st.miniTRow}>
                      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Text style={st.miniPlayerMed}>{liveState.bowler.name}</Text>
                        <MaterialCommunityIcons name="star" size={11} color={PRIMARY} />
                      </View>
                      <Text style={st.miniTd}>{liveState.bowler.overs}</Text>
                      <Text style={st.miniTd}>{liveState.bowler.maidens ?? 0}</Text>
                      <Text style={st.miniTd}>{liveState.bowler.runs}</Text>
                      <Text style={st.miniTdBold}>{liveState.bowler.wickets}</Text>
                      <Text style={[st.miniTdLight, { width: 46 }]}>
                        {liveState.bowler.economy?.toFixed(2) ?? '0.00'}
                      </Text>
                    </View>
                  </>
                )}
              </View>
            )}

            {/* Last Wicket only (no partnership in summary) */}
            {lastFow && (isLive || isCompleted) && (
              <View style={[st.pshipRow, { justifyContent: 'center' }]}>
                <View style={st.pshipCard}>
                  <Text style={st.pshipLabel}>LAST WICKET</Text>
                  {lastWicketBatter && (
                    <Text style={st.pshipWicketName}>{lastWicketBatter.player_name} {lastWicketBatter.runs}({lastWicketBatter.balls_faced})</Text>
                  )}
                  <Text style={st.pshipWicketScore}>{lastFow.runs_at_fall}-{fowList.indexOf(lastFow) + 1} ({lastFow.overs_at_fall} ov)</Text>
                </View>
              </View>
            )}

            {/* Toss removed — shown in Info tab */}

            {/* Action Buttons */}
            {action && (
              <TouchableOpacity
                style={st.actionBtn}
                activeOpacity={0.8}
                onPress={() => navigation.replace(action.screen, { matchId, match, teams: Object.values(teamMap) })}
              >
                <Text style={st.actionBtnText}>{action.label}</Text>
              </TouchableOpacity>
            )}
            {!isCreator && isLive && (
              <TouchableOpacity
                style={[st.actionBtn, { backgroundColor: COLORS.ACCENT_DARK }]}
                activeOpacity={0.8}
                onPress={() => navigation.replace('LiveScoring', { matchId })}
              >
                <Text style={st.actionBtnText}>Watch Live</Text>
              </TouchableOpacity>
            )}

            {/* Empty state for upcoming */}
            {match.status === 'upcoming' && !scorecard && (
              <View style={st.emptyState}>
                <Icon name="cricket" size={32} />
                <Text style={st.emptyTitle}>Match Yet to Begin</Text>
                <Text style={st.emptyText}>{formatDate(match.match_date) || 'Check back when the match starts'}</Text>
              </View>
            )}
          </View>

          <View style={{ height: insets.bottom + 30 }} />
        </ScrollView>

        {/* ── PAGE 1: SCORECARD ── */}
        <ScrollView style={{ width: SCREEN_WIDTH }} showsVerticalScrollIndicator={false} nestedScrollEnabled>
        {(!visitedTabs[1] || !scorecard) && (
          <View style={st.tabContent}>
            <View style={{ padding: 16, gap: 12 }}>
              <Skeleton width="40%" height={14} />
              <Skeleton width="100%" height={120} borderRadius={12} />
              <Skeleton width="100%" height={120} borderRadius={12} />
              <Skeleton width="60%" height={14} style={{ marginTop: 8 }} />
              <Skeleton width="100%" height={80} borderRadius={12} />
            </View>
          </View>
        )}
        {scorecard && (
          <View style={st.tabContent}>
            {/* Innings selector */}
            {innings.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.inningsRow}>
                {innings.map((inn, i) => (
                  <TouchableOpacity
                    key={i}
                    style={[st.inningsTab, activeInnings === i && st.inningsTabActive]}
                    onPress={() => onInningsChange(i)}
                  >
                    <Text style={[st.inningsTabText, activeInnings === i && st.inningsTabTextActive]}>
                      {getTeamShort(inn.batting_team_id)} {inn.total_runs}/{inn.total_wickets}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            {!scorecard || innings.length === 0 ? (
              <View style={st.emptyState}>
                <Icon name="scorecard" size={32} />
                <Text style={st.emptyText}>No scorecard available yet</Text>
              </View>
            ) : currentInn ? (
              <>
                {/* Batting */}
                <View style={st.card}>
                  <View style={st.sectionHeader}>
                    <Text style={st.sectionTitle}>Batting</Text>
                    {currentInn.total_overs > 0 && (
                      <View style={st.rrBadge}>
                        <Text style={st.rrBadgeText}>
                          RR: {(currentInn.total_runs / currentInn.total_overs).toFixed(2)}
                        </Text>
                      </View>
                    )}
                  </View>
                  <View style={st.tableHeader}>
                    <Text style={[st.thCell, st.thName]}>Batsman</Text>
                    <Text style={st.thCell}>R</Text>
                    <Text style={st.thCell}>B</Text>
                    <Text style={st.thCell}>4s</Text>
                    <Text style={st.thCell}>6s</Text>
                    <Text style={st.thCell}>SR</Text>
                  </View>
                  {currentInn.batting.map((b, i) => {
                    const isNotOut = !b.is_out;
                    return (
                      <TouchableOpacity
                        key={i}
                        style={[st.tableRow, isNotOut && st.tableRowHighlight]}
                        onPress={() => goToPlayer(b.player_id)}
                      >
                        <View style={[st.tdCell, st.tdName]}>
                          <Text style={[st.playerName, isNotOut && { color: PRIMARY }]}>{b.player_name}</Text>
                          <Text style={[st.howOut, isNotOut && { color: PRIMARY, fontStyle: 'italic' }]}>
                            {b.is_out ? b.how_out : 'not out'}
                          </Text>
                        </View>
                        <Text style={[st.tdCell, st.tdBold]}>{b.runs}</Text>
                        <Text style={st.tdCell}>{b.balls_faced}</Text>
                        <Text style={st.tdCell}>{b.fours}</Text>
                        <Text style={st.tdCell}>{b.sixes}</Text>
                        <Text style={st.tdCell}>{b.strike_rate?.toFixed(1)}</Text>
                      </TouchableOpacity>
                    );
                  })}

                  {/* Extras */}
                  <View style={st.extrasRow}>
                    <Text style={st.extrasLabel}>Extras</Text>
                    <Text style={st.extrasValue}>{currentInn.total_extras}</Text>
                  </View>

                  {/* Total */}
                  <View style={st.totalRow}>
                    <Text style={st.totalLabel}>Total</Text>
                    <Text style={st.totalValue}>
                      {currentInn.total_runs}/{currentInn.total_wickets} ({currentInn.total_overs} Overs)
                    </Text>
                  </View>

                  {/* Did not bat */}
                  {currentInn.did_not_bat?.length > 0 && (
                    <Text style={st.dnbText}>
                      Did not bat: {currentInn.did_not_bat.map(p => p.player_name || p.name).join(', ')}
                    </Text>
                  )}
                </View>

                {/* Fall of Wickets */}
                {currentInn.fall_of_wickets?.length > 0 && (
                  <View style={st.card}>
                    <Text style={st.sectionTitle}>Fall of Wickets</Text>
                    <View style={st.fowRow}>
                      {currentInn.fall_of_wickets.map((f, i) => (
                        <TouchableOpacity key={i} style={st.fowChip} onPress={() => goToPlayer(f.player_id)}>
                          <Text style={st.fowScore}>{f.wicket_number}-{f.runs_at_fall}</Text>
                          {f.player_name && <Text style={st.fowPlayer}>{f.player_name}</Text>}
                          <Text style={st.fowOvers}>{f.overs_at_fall} ov</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}

                {/* Partnerships */}
                {currentInn.partnerships?.length > 0 && (
                  <View style={st.card}>
                    <Text style={st.sectionTitle}>Partnerships</Text>
                    {currentInn.partnerships
                      .filter(p => p.total_runs > 0 || p.is_active)
                      .sort((a, b) => a.wicket_number - b.wicket_number)
                      .map((p, i) => {
                        const totalP = p.total_runs || 1;
                        const aRuns = p.player_a_runs || 0;
                        const bRuns = p.player_b_runs || 0;
                        const extras = (p.extras || 0);
                        const aPct = totalP > 0 ? Math.round((aRuns / totalP) * 100) : 50;
                        const bPct = totalP > 0 ? Math.round((bRuns / totalP) * 100) : 50;
                        // Find max partnership for relative bar sizing
                        const maxRuns = Math.max(...currentInn.partnerships.map(pp => pp.total_runs || 0), 1);
                        const barPct = Math.round((totalP / maxRuns) * 100);

                        const totalBalls = p.total_balls || 0;
                        const aBalls = Math.round(totalBalls * (aPct / 100)) || 0;
                        const bBalls = totalBalls - aBalls;

                        return (
                          <View key={i} style={st.ptnrRow}>
                            {/* Wicket number */}
                            <View style={st.ptnrWicketBadge}>
                              <Text style={st.ptnrWicketNum}>{p.wicket_number}</Text>
                            </View>

                            {/* Content */}
                            <View style={st.ptnrBarArea}>
                              {/* Player A (left) + Total (center) + Player B (right) */}
                              <View style={st.ptnrPlayersRow}>
                                <View style={st.ptnrPlayerLeft}>
                                  <Text style={st.ptnrPlayerName}>{p.player_a_name || 'Player A'}</Text>
                                  <Text style={st.ptnrPlayerStats}>{aRuns} ({aBalls})</Text>
                                </View>
                                <View style={st.ptnrCenter}>
                                  <Text style={st.ptnrTotalRuns}>{totalP}</Text>
                                  <Text style={st.ptnrTotalBalls}>({totalBalls})</Text>
                                  {p.is_active && <View style={st.ptnrActiveBadge}><Text style={st.ptnrActiveText}>LIVE</Text></View>}
                                </View>
                                <View style={st.ptnrPlayerRight}>
                                  <Text style={[st.ptnrPlayerName, { textAlign: 'right' }]}>{p.player_b_name || 'Player B'}</Text>
                                  <Text style={[st.ptnrPlayerStats, { textAlign: 'right' }]}>{bRuns} ({bBalls})</Text>
                                </View>
                              </View>

                              {/* Split bar */}
                              <View style={[st.ptnrBarTrack, { width: `${barPct}%`, alignSelf: 'center' }]}>
                                <View style={[st.ptnrBarLeft, { flex: aPct || 1 }]} />
                                {extras > 0 && <View style={[st.ptnrBarExtras, { flex: Math.max(1, 100 - aPct - bPct) }]} />}
                                <View style={[st.ptnrBarRight, { flex: bPct || 1 }]} />
                              </View>
                            </View>
                            )}
                          </View>
                        );
                      })}
                  </View>
                )}

                {/* Bowling */}
                <View style={st.card}>
                  <Text style={st.sectionTitle}>Bowling</Text>
                  <View style={st.tableHeader}>
                    <Text style={[st.thCell, st.thName]}>Bowler</Text>
                    <Text style={st.thCell}>O</Text>
                    <Text style={st.thCell}>M</Text>
                    <Text style={st.thCell}>R</Text>
                    <Text style={st.thCell}>W</Text>
                    <Text style={st.thCell}>ECO</Text>
                  </View>
                  {currentInn.bowling.map((b, i) => (
                    <TouchableOpacity key={i} style={st.tableRow} onPress={() => goToPlayer(b.player_id)}>
                      <Text style={[st.tdCell, st.tdName, st.playerName]}>{b.player_name}</Text>
                      <Text style={st.tdCell}>{b.overs_bowled}</Text>
                      <Text style={st.tdCell}>{b.maidens}</Text>
                      <Text style={st.tdCell}>{b.runs_conceded}</Text>
                      <Text style={[st.tdCell, st.tdBold]}>{b.wickets}</Text>
                      <Text style={st.tdCell}>{b.economy_rate?.toFixed(1)}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            ) : null}
          </View>
        )}

          <View style={{ height: insets.bottom + 30 }} />
        </ScrollView>

        {/* ── PAGE 2: COMMENTARY ── */}
        <ScrollView
          style={{ width: SCREEN_WIDTH }}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled
          onScroll={({ nativeEvent }) => {
            const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
            if (contentSize.height - contentOffset.y - layoutMeasurement.height < 200) {
              const innNum = currentInn?.innings_number;
              if (innNum && commHasMore.current[innNum]) {
                loadMoreCommentary(innNum);
              }
            }
          }}
          scrollEventThrottle={400}
        >
        {(!visitedTabs[2] || !scorecard) && (
          <View style={st.tabContent}>
            <View style={{ padding: 16, gap: 10 }}>
              {[1,2,3,4,5,6].map(i => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Skeleton width={36} height={36} borderRadius={18} />
                  <View style={{ flex: 1 }}>
                    <Skeleton width="80%" height={12} />
                    <Skeleton width="50%" height={10} style={{ marginTop: 4 }} />
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}
        {scorecard && (
          <View style={st.tabContent}>
            {/* Innings selector */}
            {innings.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.inningsRow}>
                {innings.map((inn, i) => (
                  <TouchableOpacity
                    key={i}
                    style={[st.inningsTab, activeInnings === i && st.inningsTabActive]}
                    onPress={() => onInningsChange(i)}
                  >
                    <Text style={[st.inningsTabText, activeInnings === i && st.inningsTabTextActive]}>
                      {getTeamShort(inn.batting_team_id)} {inn.total_runs}/{inn.total_wickets}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            {/* Commentary Filters */}
            <View style={st.filterRow}>
              {COMM_FILTERS.map(f => (
                <TouchableOpacity
                  key={f}
                  style={[st.filterPill, commFilter === f && st.filterPillActive]}
                  onPress={() => setCommFilter(f)}
                >
                  <Text style={[st.filterPillText, commFilter === f && st.filterPillTextActive]}>{f}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {commLoading ? (
              <ActivityIndicator size="small" color={PRIMARY} style={{ marginVertical: 30 }} />
            ) : commData.length === 0 ? (
              <View style={st.emptyState}>
                <Icon name="commentary" size={32} />
                <Text style={st.emptyText}>No commentary available yet</Text>
              </View>
            ) : (
              overNumbers.map((overNum) => {
                const allBalls = overGroups[overNum];
                const balls = getFilteredBalls(allBalls);
                if (balls.length === 0) return null;
                const overRuns = allBalls.reduce((sum, b) => sum + b.total_runs, 0);
                const overWickets = allBalls.filter(b => b.is_wicket).length;

                return (
                  <View key={overNum} style={st.card}>
                    {/* Over Summary Header */}
                    <View style={st.overHeader}>
                      <View>
                        <Text style={st.overTitle}>Over {overNum + 1}</Text>
                        <Text style={st.overSummary}>
                          {overRuns} Runs{overWickets > 0 ? ` \u2022 ${overWickets} Wicket` : ''}
                        </Text>
                      </View>
                      <View style={st.overBallsRow}>
                        {allBalls.map((ball, i) => (
                          <View key={i} style={[st.overBallCircle, { backgroundColor: getBallBg(ball) }]}>
                            <Text style={[st.overBallText, { color: getBallTextColor(ball) }]}>
                              {getBallDisplay(ball)}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </View>

                    {/* Ball-by-ball details */}
                    {balls.map((ball, i) => (
                      <View key={`d-${i}`} style={[st.ballDetail, ball.is_wicket && st.ballDetailWicket]}>
                        <View style={st.ballNumCol}>
                          <Text style={st.ballNum}>{overNum + 1}.{ball.ball || 0}</Text>
                          <View style={[st.ballDot, { backgroundColor: getBallBg(ball) }]}>
                            <Text style={[st.ballDotText, { color: getBallTextColor(ball) }]}>
                              {getBallDisplay(ball)}
                            </Text>
                          </View>
                        </View>
                        <View style={st.ballDescCol}>
                          {ball.is_wicket && (
                            <Text style={st.wicketLabel}>WICKET!</Text>
                          )}
                          <Text style={st.ballDescTitle}>{getBallDescription(ball).split(',')[0]}</Text>
                          <Text style={st.ballDesc}>
                            {getBallDescription(ball).substring(getBallDescription(ball).indexOf(',') + 1).trim()}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                );
              })
            )}

            {/* Load more indicator */}
            {commHasMore.current[currentInn?.innings_number] && commData.length > 0 && (
              <View style={{ paddingVertical: 16, alignItems: 'center' }}>
                <ActivityIndicator size="small" color={PRIMARY} />
                <Text style={{ fontSize: 11, color: COLORS.TEXT_MUTED, marginTop: 6 }}>Loading older overs...</Text>
              </View>
            )}
          </View>
        )}

          <View style={{ height: insets.bottom + 30 }} />
        </ScrollView>

        {/* ── PAGE 3: INFO ── */}
        <ScrollView style={{ width: SCREEN_WIDTH }} showsVerticalScrollIndicator={false} nestedScrollEnabled>
          <View style={st.tabContent}>
            {/* Result Banner */}
            {match.result_summary && (
              <View style={[st.card, { backgroundColor: COLORS.SUCCESS + '15', borderColor: COLORS.SUCCESS + '30' }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <Icon name="trophy" size={16} color={COLORS.SUCCESS} />
                  <Text style={{ fontSize: 14, fontWeight: '800', color: COLORS.SUCCESS, textAlign: 'center', flex: 1 }}>{match.result_summary}</Text>
                </View>
              </View>
            )}

            {/* Match Info Card */}
            <View style={st.card}>
              <View style={st.infoSectionHeader}><View style={st.infoSectionIcon}><Icon name="cricket" size={15} color={COLORS.ACCENT} /></View><Text style={st.infoSectionTitle}>Match Details</Text></View>
              {match.match_code && <InfoRow label="Match Code" value={match.match_code} />}
              <InfoRow label="Format" value={`T${match.overs} (${match.overs} Overs)`} />
              {match.match_type && <InfoRow label="Stage" value={matchTypeLabel(match.match_type)} />}
              <InfoRow label="Status" value={match.status?.replace(/_/g, ' ').toUpperCase()} />
              {match.match_date && <InfoRow label="Date" value={formatDate(match.match_date)} />}
              {match.time_slot && <InfoRow label="Time" value={match.time_slot} />}
              {match.tournament_name && <InfoRow label="Tournament" value={match.tournament_name} />}
            </View>

            {/* Teams Card */}
            <View style={st.card}>
              <View style={st.infoSectionHeader}><View style={st.infoSectionIcon}><Icon name="team" size={15} color={COLORS.ACCENT} /></View><Text style={st.infoSectionTitle}>Teams</Text></View>
              <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.BORDER }} activeOpacity={0.7} onPress={() => navigation.navigate('TeamDetail', { teamId: match.team_a_id })}>
                <View style={[st.heroFlagChip, { backgroundColor: getTeamColor(match.team_a_id) }]}><Text style={st.heroFlagChipText}>{getTeamShort(match.team_a_id)}</Text></View>
                <View style={{ flex: 1 }}><Text style={{ fontSize: 14, fontWeight: '600', color: COLORS.TEXT }}>{getTeamName(match.team_a_id)}</Text><Text style={{ fontSize: 11, color: COLORS.TEXT_MUTED }}>Code: {getTeamShort(match.team_a_id)}</Text></View>
                <MaterialCommunityIcons name="chevron-right" size={18} color={COLORS.TEXT_MUTED} />
              </TouchableOpacity>
              <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 }} activeOpacity={0.7} onPress={() => navigation.navigate('TeamDetail', { teamId: match.team_b_id })}>
                <View style={[st.heroFlagChip, { backgroundColor: getTeamColor(match.team_b_id) }]}><Text style={st.heroFlagChipText}>{getTeamShort(match.team_b_id)}</Text></View>
                <View style={{ flex: 1 }}><Text style={{ fontSize: 14, fontWeight: '600', color: COLORS.TEXT }}>{getTeamName(match.team_b_id)}</Text><Text style={{ fontSize: 11, color: COLORS.TEXT_MUTED }}>Code: {getTeamShort(match.team_b_id)}</Text></View>
                <MaterialCommunityIcons name="chevron-right" size={18} color={COLORS.TEXT_MUTED} />
              </TouchableOpacity>
            </View>

            {/* Venue Card */}
            {(match.venue_id || match.venue_name) && (
              <View style={st.card}>
                <View style={st.infoSectionHeader}><View style={st.infoSectionIcon}><Icon name="venue" size={15} color={COLORS.ACCENT} /></View><Text style={st.infoSectionTitle}>Venue</Text></View>
                {match.venue_name && <InfoRow label="Ground" value={match.venue_name} />}
                {match.venue_city && <InfoRow label="City" value={match.venue_city} />}
                {match.venue_ground_type && <InfoRow label="Surface" value={match.venue_ground_type.charAt(0).toUpperCase() + match.venue_ground_type.slice(1)} />}
                {match.venue_address && <InfoRow label="Address" value={match.venue_address} />}
              </View>
            )}

            {/* Toss Info */}
            {match.toss_winner_id && (
              <View style={st.tossCard}>
                <View style={[st.infoSectionIcon, { backgroundColor: PRIMARY + '15' }]}>
                  <Icon name="toss" size={15} color={PRIMARY} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={st.tossLabel}>TOSS</Text>
                  <Text style={st.tossText}>
                    {getTeamName(match.toss_winner_id)} won the toss and elected to {match.toss_decision}
                  </Text>
                </View>
              </View>
            )}

            {/* Playing XI - Team A */}
            {squads[match.team_a_id]?.length > 0 && renderSquadCard(match.team_a_id)}

            {/* Playing XI - Team B */}
            {squads[match.team_b_id]?.length > 0 && renderSquadCard(match.team_b_id)}

            {/* Creator action */}
            {action && (
              <TouchableOpacity
                style={st.actionBtn}
                activeOpacity={0.8}
                onPress={() => navigation.replace(action.screen, { matchId, match, teams: Object.values(teamMap) })}
              >
                <Text style={st.actionBtnText}>{action.label}</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={{ height: insets.bottom + 30 }} />
        </ScrollView>

      </Animated.ScrollView>
    </Animated.View>
  );
};

// ── InfoRow ──
const InfoRow = ({ label, value, highlight }) => (
  <View style={st.infoRow}>
    <Text style={st.infoLabel}>{label}</Text>
    <Text style={[st.infoValue, highlight && { color: PRIMARY, fontWeight: '700' }]} numberOfLines={2}>
      {value}
    </Text>
  </View>
);

// ═══════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.BG },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.BG },
  scrollBody: { flex: 1 },

  // ── Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: COLORS.CARD, borderBottomWidth: 1, borderBottomColor: COLORS.BORDER,
  },
  headerBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  backArrow: { fontSize: 22, color: COLORS.TEXT, fontWeight: '600' },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.LIVE },
  headerTitle: { fontSize: 17, fontWeight: '700', color: COLORS.TEXT },
  shareIcon: { fontSize: 18, color: COLORS.TEXT },

  // ── Header center & subtitle
  headerCenter: { flex: 1, alignItems: 'center' },
  headerSubtitle: { fontSize: 11, color: COLORS.TEXT_MUTED, fontWeight: '500', marginTop: 2 },

  // ── Tab bar
  tabBarWrap: { backgroundColor: COLORS.CARD, borderBottomWidth: 1, borderBottomColor: COLORS.BORDER, position: 'relative' },
  tabBarScroll: { paddingHorizontal: 0 },
  tab: { width: SCREEN_WIDTH / 4, alignItems: 'center', justifyContent: 'center', paddingVertical: 12 },
  tabText: { fontSize: 13, color: COLORS.TEXT_MUTED, fontWeight: '600' },
  tabTextActive: { color: COLORS.TEXT, fontWeight: '700' },
  tabIndicator: { position: 'absolute', bottom: 0, height: 3, backgroundColor: PRIMARY, borderRadius: 2 },

  // ── Tab content
  tabContent: { paddingBottom: 8 },

  // ── Score Hero Card
  scoreHero: {
    margin: 16, borderRadius: 16, padding: 20, backgroundColor: COLORS.CARD,
    borderWidth: 1, borderColor: COLORS.BORDER,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 2,
  },
  heroTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  heroTeamRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 },
  heroFlagChip: { width: 28, height: 18, borderRadius: 3, alignItems: 'center', justifyContent: 'center' },
  heroFlagChipText: { fontSize: 8, fontWeight: '800', color: COLORS.TEXT },
  heroTeamLabel: { fontSize: 14, fontWeight: '700', color: COLORS.TEXT, flexShrink: 1 },
  heroScoreRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  heroScoreBig: { fontSize: 30, fontWeight: '900', color: COLORS.TEXT },
  heroOversLabel: { fontSize: 14, fontWeight: '500', color: COLORS.TEXT_MUTED },
  heroRightCol: { alignItems: 'flex-end', gap: 4 },
  heroCrrText: { fontSize: 12, fontWeight: '500', color: COLORS.TEXT_MUTED, marginTop: 4 },
  heroRrrText: { fontSize: 12, fontWeight: '700', color: PRIMARY },
  heroInfoBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12,
    backgroundColor: COLORS.ACCENT_SOFT, borderRadius: 10, borderWidth: 1, borderColor: COLORS.ACCENT_SOFT_BORDER,
    marginTop: 4,
  },
  heroInfoIcon: { fontSize: 16, color: PRIMARY },
  heroInfoText: { flex: 1, fontSize: 12, fontWeight: '500', color: COLORS.TEXT_SECONDARY },
  broadcastBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 16, marginTop: 10, paddingVertical: 12, paddingHorizontal: 16,
    backgroundColor: COLORS.WARNING + '15', borderRadius: 12,
    borderWidth: 1, borderColor: COLORS.WARNING + '30',
  },
  broadcastBannerText: { flex: 1, fontSize: 14, fontWeight: '700', color: COLORS.WARNING },
  heroStatusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  liveBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.LIVE_BG, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12,
  },
  liveBadgeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.LIVE },
  liveBadgeText: { fontSize: 10, fontWeight: '800', color: COLORS.LIVE, letterSpacing: 0.8 },
  heroMatchInfo: { fontSize: 11, color: COLORS.TEXT_MUTED, fontWeight: '500' },
  heroTeamScoreRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.BORDER,
  },
  heroTeamScoreText: { fontSize: 14, fontWeight: '700', color: COLORS.TEXT, textAlign: 'right' },
  heroDateRow: { marginTop: 12, borderTopWidth: 1, borderTopColor: COLORS.BORDER, paddingTop: 10 },
  heroDateText: { fontSize: 12, color: COLORS.TEXT_MUTED, textAlign: 'center' },

  // ── Secondary score bar (bowling team in live)
  secondaryScoreBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 16, marginTop: 8, paddingVertical: 10, paddingHorizontal: 14,
    backgroundColor: COLORS.CARD, borderRadius: 10, borderWidth: 1, borderColor: COLORS.BORDER,
  },
  secondaryScoreText: { fontSize: 13, fontWeight: '600', color: COLORS.TEXT_SECONDARY },

  // ── Recent Overs section
  recentSection: { marginTop: 16 },
  sectionLabel: { fontSize: 10, fontWeight: '700', color: COLORS.TEXT_MUTED, letterSpacing: 1.5, marginBottom: 10, paddingHorizontal: 16 },
  oversScroll: { paddingHorizontal: 16, alignItems: 'center', gap: 5 },
  overTag: { fontSize: 10, fontWeight: '700', color: COLORS.TEXT_MUTED, marginRight: 2 },
  overSep: { width: 1, height: 20, backgroundColor: COLORS.BORDER_LIGHT, marginHorizontal: 4 },
  recentBallSm: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  recentBallSmText: { fontSize: 10, fontWeight: '700' },

  // ── Mini Scorecard card
  miniCard: {
    backgroundColor: COLORS.CARD, marginHorizontal: 16, marginTop: 12, borderRadius: 16, overflow: 'hidden',
    borderWidth: 1, borderColor: COLORS.BORDER,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 1,
  },
  miniTHead: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 16,
    backgroundColor: COLORS.SURFACE,
  },
  miniTh: { width: 34, textAlign: 'right', fontSize: 10, fontWeight: '700', color: COLORS.TEXT_MUTED, letterSpacing: 0.5 },
  miniTRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: COLORS.BORDER,
  },
  miniPlayerBold: { fontSize: 13, fontWeight: '700', color: COLORS.TEXT },
  miniPlayerMed: { fontSize: 13, fontWeight: '500', color: COLORS.TEXT },
  miniTd: { width: 34, textAlign: 'right', fontSize: 13, color: COLORS.TEXT_SECONDARY },
  miniTdBold: { width: 34, textAlign: 'right', fontSize: 13, fontWeight: '700', color: COLORS.TEXT },
  miniTdLight: { textAlign: 'right', fontSize: 13, color: COLORS.TEXT_MUTED },

  // ── Partnership & Last Wicket
  // Partnership bars
  ptnrRow: {
    flexDirection: 'row', alignItems: 'flex-start', marginBottom: 14, gap: 10,
    paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: COLORS.BORDER,
  },
  ptnrWicketBadge: {
    width: 26, height: 26, borderRadius: 13, backgroundColor: COLORS.SURFACE,
    alignItems: 'center', justifyContent: 'center', marginTop: 2,
  },
  ptnrWicketNum: { fontSize: 11, fontWeight: '800', color: COLORS.TEXT_MUTED },
  ptnrBarArea: { flex: 1 },
  ptnrPlayersRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  ptnrPlayerLeft: { flex: 1 },
  ptnrCenter: { alignItems: 'center', paddingHorizontal: 8, minWidth: 60 },
  ptnrPlayerRight: { flex: 1 },
  ptnrPlayerName: { fontSize: 12, fontWeight: '700', color: COLORS.TEXT, lineHeight: 16 },
  ptnrPlayerStats: { fontSize: 12, fontWeight: '600', color: COLORS.ACCENT_LIGHT, marginTop: 2 },
  ptnrTotalRuns: { fontSize: 20, fontWeight: '900', color: COLORS.TEXT },
  ptnrTotalBalls: { fontSize: 11, fontWeight: '500', color: COLORS.TEXT_MUTED },
  ptnrBarTrack: {
    flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden',
    backgroundColor: COLORS.SURFACE, minWidth: '20%', width: '100%',
  },
  ptnrBarLeft: { backgroundColor: COLORS.ACCENT, borderTopLeftRadius: 5, borderBottomLeftRadius: 5 },
  ptnrBarRight: { backgroundColor: COLORS.SUCCESS, borderTopRightRadius: 5, borderBottomRightRadius: 5 },
  ptnrBarExtras: { backgroundColor: COLORS.WARNING + '60' },
  ptnrActiveBadge: {
    backgroundColor: COLORS.LIVE + '20', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
  },
  ptnrActiveText: { fontSize: 8, fontWeight: '800', color: COLORS.LIVE },

  pshipRow: { flexDirection: 'row', gap: 12, marginHorizontal: 16, marginTop: 12 },
  pshipCard: {
    flex: 1, backgroundColor: COLORS.CARD, padding: 14, borderRadius: 16,
    borderWidth: 1, borderColor: COLORS.BORDER,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 1,
  },
  pshipLabel: { fontSize: 10, fontWeight: '700', color: COLORS.TEXT_MUTED, letterSpacing: 0.5, marginBottom: 6 },
  pshipValue: { fontSize: 18, fontWeight: '900', color: COLORS.TEXT },
  pshipWicketName: { fontSize: 13, fontWeight: '700', color: COLORS.TEXT, marginBottom: 2 },
  pshipWicketScore: { fontSize: 11, color: COLORS.TEXT_MUTED },

  // ── Cards (used by other tabs)
  card: {
    backgroundColor: COLORS.CARD, marginHorizontal: 16, marginTop: 12, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: COLORS.BORDER,
  },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: COLORS.TEXT, marginBottom: 12 },

  // ── Recent Over
  recentOverRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  recentBall: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  recentBallText: { fontSize: 11, fontWeight: '700' },


  // ── Toss
  tossCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 16, marginTop: 12, padding: 14,
    backgroundColor: COLORS.ACCENT_SOFT, borderRadius: 12, borderWidth: 1, borderColor: COLORS.ACCENT_SOFT_BORDER,
  },
  tossIcon: { fontSize: 22 },
  tossLabel: { fontSize: 9, fontWeight: '700', color: COLORS.TEXT_MUTED, letterSpacing: 1, marginBottom: 2 },
  tossText: { fontSize: 13, fontWeight: '500', color: COLORS.TEXT },

  // ── Innings selector (horizontal scroll pills)
  inningsRow: {
    flexDirection: 'row', marginHorizontal: 16, marginTop: 12, gap: 8,
    justifyContent: 'center', flexGrow: 1,
  },
  inningsTab: {
    paddingVertical: 10, paddingHorizontal: 16, alignItems: 'center',
    backgroundColor: COLORS.SURFACE, borderRadius: 12,
  },
  inningsTabActive: { backgroundColor: PRIMARY },
  inningsTabText: { fontSize: 13, color: COLORS.TEXT_MUTED, fontWeight: '600' },
  inningsTabTextActive: { color: COLORS.TEXT, fontWeight: '700' },

  // ── Run rate badge
  rrBadge: { backgroundColor: COLORS.ACCENT_SOFT, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  rrBadgeText: { fontSize: 11, fontWeight: '700', color: PRIMARY },

  // ── Scorecard table
  tableHeader: {
    flexDirection: 'row', paddingVertical: 8, paddingHorizontal: 4,
    backgroundColor: COLORS.SURFACE, borderRadius: 8, marginBottom: 4,
  },
  thCell: { width: 38, textAlign: 'center', fontSize: 10, fontWeight: '700', color: COLORS.TEXT_MUTED, textTransform: 'uppercase', letterSpacing: 0.5 },
  thName: { flex: 1, textAlign: 'left', paddingLeft: 4 },
  tableRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 4,
    borderBottomWidth: 1, borderBottomColor: COLORS.BORDER,
  },
  tableRowHighlight: { backgroundColor: COLORS.ACCENT_SOFT },
  tdCell: { width: 38, textAlign: 'center', fontSize: 13, color: COLORS.TEXT_SECONDARY },
  tdName: { flex: 1, textAlign: 'left', paddingLeft: 4 },
  tdBold: { fontWeight: '700', color: COLORS.TEXT },
  playerName: { fontSize: 13, fontWeight: '600', color: COLORS.TEXT },
  howOut: { fontSize: 11, color: COLORS.TEXT_MUTED, fontStyle: 'italic', marginTop: 2 },

  // Extras & Total
  extrasRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 8, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: COLORS.BORDER,
  },
  extrasLabel: { fontSize: 13, color: COLORS.TEXT_MUTED, fontWeight: '500' },
  extrasValue: { fontSize: 13, color: COLORS.TEXT_SECONDARY, fontWeight: '600' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 10, paddingHorizontal: 4 },
  totalLabel: { fontSize: 14, fontWeight: '700', color: COLORS.TEXT },
  totalValue: { fontSize: 14, fontWeight: '700', color: COLORS.TEXT },
  dnbText: { fontSize: 11, color: COLORS.TEXT_MUTED, marginTop: 10, paddingHorizontal: 4, lineHeight: 16 },

  // ── Fall of Wickets
  fowRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  fowChip: {
    backgroundColor: COLORS.ACCENT_SOFT, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
    borderWidth: 1, borderColor: COLORS.ACCENT_SOFT_BORDER, alignItems: 'center',
  },
  fowScore: { fontSize: 12, fontWeight: '700', color: PRIMARY },
  fowPlayer: { fontSize: 10, fontWeight: '600', color: COLORS.TEXT_SECONDARY, marginTop: 2 },
  fowOvers: { fontSize: 10, color: COLORS.TEXT_MUTED, marginTop: 1 },

  // ── Commentary
  filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginTop: 12 },
  filterPill: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: COLORS.CARD, borderWidth: 1, borderColor: COLORS.BORDER,
  },
  filterPillActive: { backgroundColor: COLORS.ACCENT, borderColor: COLORS.ACCENT },
  filterPillText: { fontSize: 12, fontWeight: '600', color: COLORS.TEXT },
  filterPillTextActive: { color: COLORS.TEXT },

  overHeader: { marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: COLORS.BORDER },
  overTitle: { fontSize: 14, fontWeight: '700', color: COLORS.TEXT },
  overSummary: { fontSize: 12, color: COLORS.TEXT_SECONDARY, fontWeight: '500', marginTop: 2 },
  overBallsRow: { flexDirection: 'row', gap: 5, marginTop: 8 },
  overBallCircle: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  overBallText: { fontSize: 10, fontWeight: '700' },

  ballDetail: { flexDirection: 'row', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.BORDER },
  ballDetailWicket: { backgroundColor: COLORS.DANGER_SOFT, borderRadius: 8, marginVertical: 2, paddingHorizontal: 6 },
  ballNumCol: { width: 44, alignItems: 'center', gap: 4 },
  ballNum: { fontSize: 11, fontWeight: '700', color: COLORS.TEXT_MUTED },
  ballDot: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  ballDotText: { fontSize: 10, fontWeight: '700' },
  ballDescCol: { flex: 1, marginLeft: 8, justifyContent: 'center' },
  wicketLabel: { fontSize: 11, fontWeight: '800', color: COLORS.LIVE, marginBottom: 2 },
  ballDescTitle: { fontSize: 13, fontWeight: '600', color: COLORS.TEXT, marginBottom: 2 },
  ballDesc: { fontSize: 12, color: COLORS.TEXT_SECONDARY, lineHeight: 18 },

  // ── Info tab
  infoSectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14,
  },
  infoSectionIcon: {
    width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.ACCENT + '15',
  },
  infoSectionTitle: { fontSize: 15, fontWeight: '700', color: COLORS.TEXT },
  infoRow: { flexDirection: 'row', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.BORDER },
  infoLabel: { width: 90, fontSize: 13, color: COLORS.TEXT_MUTED, fontWeight: '500' },
  infoValue: { flex: 1, fontSize: 13, color: COLORS.TEXT, fontWeight: '500' },

  // ── Squads
  squadHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  squadBar: { width: 3, height: 20, borderRadius: 2 },
  squadRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.BORDER,
  },
  squadName: { fontSize: 13, fontWeight: '600', color: COLORS.TEXT },
  squadRole: { fontSize: 10, color: COLORS.TEXT_MUTED, marginTop: 1 },
  squadJersey: { fontSize: 11, fontWeight: '600', color: COLORS.TEXT_MUTED },

  // ── Action button
  actionBtn: {
    backgroundColor: PRIMARY, borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', marginHorizontal: 16, marginTop: 16,
  },
  actionBtnText: { color: COLORS.TEXT, fontSize: 16, fontWeight: '700' },

  // ── Empty state
  emptyState: { alignItems: 'center', paddingVertical: 48 },
  emptyIcon: { fontSize: 40 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: COLORS.TEXT, marginTop: 10 },
  emptyText: { fontSize: 13, color: COLORS.TEXT_MUTED, marginTop: 6, fontWeight: '500' },

  /* Player of the Match */
  pomCard: {
    backgroundColor: COLORS.CARD_ELEVATED || COLORS.CARD,
    marginHorizontal: 16, marginTop: 14, borderRadius: 16,
    borderWidth: 1.5, borderColor: 'rgba(255,215,0,0.3)', overflow: 'hidden',
  },
  pomBadge: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, backgroundColor: 'rgba(255,215,0,0.08)',
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,215,0,0.15)',
  },
  pomBadgeText: { fontSize: 11, fontWeight: '800', color: COLORS.GOLD, letterSpacing: 1.5 },
  pomContent: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 14 },
  pomAvatarWrap: { position: 'relative' },
  pomAvatar: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: COLORS.SURFACE,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'rgba(255,215,0,0.4)',
  },
  pomStarBadge: {
    position: 'absolute', bottom: -2, right: -2,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: COLORS.CARD, borderWidth: 1.5, borderColor: COLORS.GOLD,
    alignItems: 'center', justifyContent: 'center',
  },
  pomName: { fontSize: 16, fontWeight: '800', color: COLORS.TEXT, marginBottom: 6 },
  pomStatLine: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3, flexWrap: 'wrap' },
  pomStatVal: { fontSize: 14, fontWeight: '800', color: COLORS.TEXT },
  pomStatLabel: { fontSize: 11, fontWeight: '500', color: COLORS.TEXT_MUTED },
  pomStatDetail: { fontSize: 11, fontWeight: '600', color: COLORS.TEXT_SECONDARY },

  /* Key Performers - CricHeroes style player cards */
  perfSection: { marginTop: 14 },
  perfSectionHead: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingHorizontal: 16, marginBottom: 10,
  },
  perfSectionTitle: { fontSize: 15, fontWeight: '700', color: COLORS.TEXT },
  perfCardScroll: { paddingHorizontal: 16, gap: 10, justifyContent: 'center' },
  perfPlayerCard: {
    width: 130, backgroundColor: COLORS.CARD, borderRadius: 16,
    padding: 14, alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.BORDER, position: 'relative',
  },
  perfBestBadge: {
    position: 'absolute', top: 6, right: 6,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: 'rgba(255,215,0,0.15)', alignItems: 'center', justifyContent: 'center',
  },
  perfCardName: { fontSize: 12, fontWeight: '700', color: COLORS.TEXT, textAlign: 'center' },
  perfCardTeam: { fontSize: 10, color: COLORS.TEXT_MUTED, marginTop: 2, textAlign: 'center' },
  perfCardDivider: { width: 30, height: 1.5, backgroundColor: COLORS.BORDER, marginVertical: 8, borderRadius: 1 },
  perfCardMainStat: { fontSize: 18, fontWeight: '900', color: COLORS.TEXT },
  perfCardStatUnit: { fontSize: 11, fontWeight: '500', color: COLORS.TEXT_MUTED },
  perfCardSubStat: { fontSize: 10, color: COLORS.TEXT_SECONDARY, marginTop: 2, textAlign: 'center' },

  /* Key Match Stats */
  keyStatsCard: {
    backgroundColor: COLORS.CARD, borderRadius: 16, marginHorizontal: 16, marginTop: 14,
    padding: 16, borderWidth: 1, borderColor: COLORS.BORDER,
  },
  keyStatsTitle: { fontSize: 15, fontWeight: '800', color: COLORS.TEXT, marginBottom: 12 },
  keyStatsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 0 },
  keyStatItem: {
    width: '33.33%', alignItems: 'center', paddingVertical: 10,
  },
  keyStatValue: { fontSize: 18, fontWeight: '900', color: COLORS.TEXT },
  keyStatLabel: { fontSize: 10, fontWeight: '600', color: COLORS.TEXT_MUTED, marginTop: 3, textAlign: 'center' },
});

export default MatchDetailScreen;
