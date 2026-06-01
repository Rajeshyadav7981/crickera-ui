import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
  Animated, Share, Dimensions, InteractionManager, ImageBackground,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const SCREEN_WIDTH = Dimensions.get('window').width;

// Charts show exactly 10 overs per visible window; user scrolls horizontally for more.
// pulseCard has marginHorizontal: 12 × 2 = 24, padding: 12 × 2 = 24, border ~2 → ~50px chrome.
const CHART_WINDOW_OVERS = 10;
const CHART_SLOT_WIDTH = Math.max(26, Math.floor((SCREEN_WIDTH - 50) / CHART_WINDOW_OVERS));
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import api, { matchesAPI, scoringAPI, teamsAPI } from '../../services/api';
import matchWS from '../../services/websocket';
import { COLORS, FONTS } from '../../theme';
import BackButton from '../../components/BackButton';
import CelebrationOverlay from '../../components/CelebrationOverlay';
import TabContentSkeleton from '../../components/TabContentSkeleton';
import Icon from '../../components/Icon';
import FavoriteButton from '../../components/FavoriteButton';
import ManhattanChart from '../../components/charts/ManhattanChart';
import Avatar from '../../components/Avatar';
import PlayerAvatar from '../../components/PlayerAvatar';
import StepIndicator from '../../components/StepIndicator';
import Skeleton from '../../components/Skeleton';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useMatch, useScorecard, useLiveState, useSquad, useBroadcast, useMatchInvalidators } from '../../hooks/useMatchData';

const PRIMARY = COLORS.ACCENT;
const TABS = ['Summary', 'Scorecard', 'Commentary', 'Info'];
const COMM_FILTERS = ['All', 'Wickets', 'Boundaries'];

const getBallKind = (ball) => {
  if (ball === 'W') return 'wicket';
  if (ball === '4') return 'four';
  if (ball === '6') return 'six';
  if (ball === '0' || ball === '•') return 'dot';
  const s = typeof ball === 'string' ? ball.toLowerCase() : '';
  if (s.includes('wd') || s.includes('nb') || s.includes('lb') || s.includes('bye')) return 'extra';
  return 'default';
};

const MatchDetailScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { matchId } = route.params;
  const passedTeams = route.params.teams;

  // React-Query-backed data — dedupes across tabs, caches across screen revisits.
  // We still hand the data off to local useState below so the rest of the file
  // (which reads `match`, `scorecard`, etc.) stays untouched.
  const matchQ = useMatch(matchId);
  const scQ = useScorecard(matchId);
  const liveQ = useLiveState(matchId);
  const bcastQ = useBroadcast(matchId);
  const { invalidateLive, invalidateInnings, invalidateMatch } = useMatchInvalidators(matchId);

  const [match, setMatch] = useState(null);
  const [loading, setLoading] = useState(true);
  // Track which tabs have been visited (for lazy rendering)
  const [visitedTabs, setVisitedTabs] = useState({ 0: true });
  // Deferred content-ready flag — set after pager animation + interactions finish,
  // so the skeleton stays on screen for ~300ms instead of flashing for one frame.
  const [contentReady, setContentReady] = useState({ 0: true });
  // Scorecard innings readiness + fade-in for a silky switch between innings.
  const [inningsReady, setInningsReady] = useState({ 0: true });
  // Charts are deferred into a second phase so the initial innings paint is cheap.
  const [chartsReady, setChartsReady] = useState({});
  const inningsFade = useRef(new Animated.Value(1)).current;
  // Sliding-indicator animation under the innings segmented pill (matches tournament tabs).
  const inningsPillX = useRef(new Animated.Value(0)).current;
  const [inningsPillWidth, setInningsPillWidth] = useState(0);
  // Pager scroll is temporarily disabled while the user is touching an inner
  // horizontal ScrollView (charts) — otherwise the outer pager eats the gesture
  // and the chart can't be swiped sideways.
  const [pagerScrollEnabled, setPagerScrollEnabled] = useState(true);
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
  // Viewer-side celebration + last commentary (mirrors what the scorer sees)
  const [celebration, setCelebration] = useState(null);
  const [liveCommentary, setLiveCommentary] = useState(null);
  const striker_prev_runs_ref = useRef(0);
  const clearCelebration = useCallback(() => setCelebration(null), []);
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

  // ── API → React Query bridge ──
  // The hooks above hold the canonical cached data; here we just sync into the
  // legacy useState atoms so the rest of the screen keeps working unchanged.
  useEffect(() => {
    if (matchQ.data) setMatch(matchQ.data);
    if (matchQ.isFetched) setLoading(false);
  }, [matchQ.data, matchQ.isFetched]);
  useEffect(() => {
    if (scQ.data) setScorecard(scQ.data);
  }, [scQ.data]);
  useEffect(() => {
    if (liveQ.data) setLiveState(liveQ.data);
  }, [liveQ.data]);
  useEffect(() => {
    if (bcastQ.data !== undefined) setBroadcastMsg(bcastQ.data);
  }, [bcastQ.data]);

  const loadMatch = useCallback(() => matchQ.refetch(), [matchQ.refetch]);
  const loadScorecard = useCallback(() => scQ.refetch(), [scQ.refetch]);

  const COMM_PAGE_SIZE = 30;
  const commHasMore = useRef({});
  const commentaryRef = useRef({});
  useEffect(() => { commentaryRef.current = commentary; }, [commentary]);

  const loadCommentary = useCallback(async (inningsNum, force) => {
    if (!force && commentaryRef.current[inningsNum]?.length > 0) return;
    setCommLoading(true);
    try {
      const res = await scoringAPI.commentary(matchId, inningsNum, COMM_PAGE_SIZE, 0);
      const data = res.data || [];
      setCommentary((prev) => ({ ...prev, [inningsNum]: data }));
      commHasMore.current[inningsNum] = data.length >= COMM_PAGE_SIZE;
    } catch (e) {} finally { setCommLoading(false); }
  }, [matchId]);


  const commLoadingMore = useRef(false);

  const loadMoreCommentary = useCallback(async (inningsNum) => {
    if (!commHasMore.current[inningsNum] || commLoadingMore.current) return;
    commLoadingMore.current = true;
    const existing = commentaryRef.current[inningsNum] || [];
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
  }, [matchId]);

  const loadLiveState = useCallback(() => liveQ.refetch(), [liveQ.refetch]);

  // Squad fetches are still per-team — keep the existing API but route through
  // React Query so two consumers (LiveScoring + this screen) share one request.
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
    // First focus: hooks already fired. Subsequent focuses: nudge them to refetch
    // (cached data stays visible — keepPreviousData prevents a loading flash).
    matchQ.refetch();
    liveQ.refetch();
    bcastQ.refetch();

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
        } else if (msg.type === 'delivery') {
          // Derive celebration from the enriched delivery payload.
          const d = msg.data || {};
          if (!d.swap) {
            if (d.is_wicket) {
              const wt = d.wicket_type;
              setCelebration(
                wt === 'bowled' ? 'wicket_bowled' :
                wt === 'caught' ? 'wicket_caught' :
                wt === 'lbw' ? 'wicket_lbw' :
                wt === 'run_out' ? 'wicket_runout' :
                'wicket'
              );
            } else if (d.is_six || d.batsman_runs === 6) {
              setCelebration('six');
            } else if (d.is_boundary || d.batsman_runs === 4) {
              setCelebration('four');
            }
            if (d.commentary) setLiveCommentary(d.commentary);
          }
          // Debounced state refresh via cache-invalidation
          if (_wsDebounceTimer.current) clearTimeout(_wsDebounceTimer.current);
          _wsDebounceTimer.current = setTimeout(() => {
            invalidateLive();
            setCommentary({});
          }, 500);
        } else if (msg.type === 'over_end') {
          if (_wsDebounceTimer.current) clearTimeout(_wsDebounceTimer.current);
          _wsDebounceTimer.current = setTimeout(() => {
            invalidateLive();
            setCommentary({});
          }, 500);
        } else if (['innings_end', 'match_end'].includes(msg.type)) {
          // Major event — wipe every cached subtree for this match.
          if (_wsDebounceTimer.current) clearTimeout(_wsDebounceTimer.current);
          _wsDebounceTimer.current = setTimeout(() => {
            invalidateMatch();
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

  // Load scorecard + commentary when data is available.
  // On first load, default activeInnings to the LATEST innings (current / most recent)
  // so Commentary opens on what's happening now, not the 1st innings by default.
  const inningsAutoSet = useRef(false);
  useEffect(() => {
    if (!scorecard) {
      loadScorecard();
      return;
    }
    if (scorecard?.innings?.length > 0) {
      if (!inningsAutoSet.current) {
        inningsAutoSet.current = true;
        const latestIdx = scorecard.innings.length - 1;
        if (latestIdx !== activeInnings) {
          setActiveInnings(latestIdx);
          // Defer the commentary load — setState triggers re-render which runs this effect again.
          return;
        }
      }
      // Load commentary for active innings (used by Commentary tab).
      // Chart data comes from innings.over_series on the scorecard payload — no extra fetch.
      const innNum = scorecard.innings[activeInnings]?.innings_number;
      if (innNum) loadCommentary(innNum);
      // Also load latest innings commentary (used by Summary tab's recent overs)
      const latestInn = scorecard.innings[scorecard.innings.length - 1];
      if (latestInn?.innings_number && latestInn.innings_number !== innNum) {
        loadCommentary(latestInn.innings_number);
      }
    }
  }, [scorecard?.innings?.length, activeInnings]);

  // Ensure inningsReady flips true for the currently-viewed innings after interactions
  // settle. Covers the initial auto-set to the latest innings (where onInningsChange
  // isn't called) so the skeleton doesn't stick.
  useEffect(() => {
    if (inningsReady[activeInnings]) return;
    const handle = InteractionManager.runAfterInteractions(() => {
      setInningsReady((prev) => (prev[activeInnings] ? prev : { ...prev, [activeInnings]: true }));
    });
    return () => handle.cancel && handle.cancel();
  }, [activeInnings, inningsReady]);

  // Phase 4: mount the charts ~400ms AFTER the innings content lands, so the initial
  // paint is cheap and the rest of the scorecard is interactive sooner.
  useEffect(() => {
    if (!inningsReady[activeInnings]) return;
    if (chartsReady[activeInnings]) return;
    const t = setTimeout(() => {
      setChartsReady((prev) => (prev[activeInnings] ? prev : { ...prev, [activeInnings]: true }));
    }, 400);
    return () => clearTimeout(t);
  }, [activeInnings, inningsReady, chartsReady]);

  // Innings list — memoized early so it's available to the useEffects / useCallbacks below.
  // (If declared after the effects, Babel's `var` hoisting leaves `innings` undefined when
  // React first reads the effect's dependency array → "Cannot read property 'length' of undefined".)
  const innings = useMemo(() => {
    const real = scorecard?.innings || [];
    if (!real.length) return real;
    const isLive = scorecard?.status === 'live' || scorecard?.status === 'innings_break';
    const mainReal = real.filter(i => !i.is_super_over);
    if (!isLive || mainReal.length !== 1) return real;
    const playedTeamId = mainReal[0].batting_team_id;
    const otherTeamId = playedTeamId === scorecard.team_a_id ? scorecard.team_b_id : scorecard.team_a_id;
    if (!otherTeamId) return real;
    const otherTeamName = otherTeamId === scorecard.team_a_id ? scorecard.team_a_name : scorecard.team_b_name;
    const otherSquad = (scorecard.team_squads && scorecard.team_squads[String(otherTeamId)]) || [];
    const pendingInn = {
      innings_number: 2,
      batting_team_id: otherTeamId,
      bowling_team_id: playedTeamId,
      batting_team_name: otherTeamName || 'Team 2',
      batting: [],
      bowling: [],
      fall_of_wickets: [],
      partnerships: [],
      yet_to_bat: otherSquad,
      over_series: [],
      total_runs: 0,
      total_wickets: 0,
      total_overs: 0,
      total_extras: 0,
      is_pending: true,
    };
    return [...real, pendingInn];
  }, [scorecard]);

  // Slide the innings-pill indicator whenever the active innings or measured width changes.
  useEffect(() => {
    if (!inningsPillWidth || !innings.length) return;
    const segW = (inningsPillWidth - 6) / innings.length; // 6 = 2 * padding:3 in segmented pill
    Animated.spring(inningsPillX, {
      toValue: activeInnings * segW,
      useNativeDriver: true,
      speed: 14,
      bounciness: 6,
    }).start();
  }, [activeInnings, inningsPillWidth, innings.length, inningsPillX]);

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

  const markContentReady = useCallback((i) => {
    setContentReady(prev => (prev[i] ? prev : { ...prev, [i]: true }));
  }, []);

  const switchTab = useCallback((i) => {
    if (i < 0 || i >= TABS.length) return;
    setActiveTab(i);
    setVisitedTabs(prev => ({ ...prev, [i]: true }));
    scrollTabIntoView(i);
    pagerRef.current?.scrollTo({ x: i * SCREEN_WIDTH, animated: true });
    if (i === 1 && !scorecard) loadScorecard();
    // Let the pager animate + current frame render before mounting heavy content.
    InteractionManager.runAfterInteractions(() => markContentReady(i));
  }, [scorecard, loadScorecard, scrollTabIntoView, markContentReady]);

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
      // Defer heavy content mount until interactions finish.
      InteractionManager.runAfterInteractions(() => markContentReady(newIdx));
    }
    isUserSwiping.current = false;
  }, [activeTab, scorecard, loadScorecard, scrollTabIntoView, markContentReady]);

  // Animated tab indicator position (follows swipe smoothly)
  const indicatorTranslateX = scrollX.interpolate({
    inputRange: TABS.map((_, i) => i * SCREEN_WIDTH),
    outputRange: TABS.map((_, i) => i * (SCREEN_WIDTH / TABS.length)),
    extrapolate: 'clamp',
  });

  const onInningsChange = useCallback((i) => {
    if (i === activeInnings) return;
    // Instant tactile feedback — slide the pill indicator immediately on tap,
    // even before the content fade starts. Matches tournament tab feel.
    if (inningsPillWidth && innings.length) {
      const segW = (inningsPillWidth - 6) / innings.length;
      Animated.spring(inningsPillX, {
        toValue: i * segW,
        useNativeDriver: true,
        speed: 14,
        bounciness: 6,
      }).start();
    }
    // Phase 1: fade the CURRENT innings out. Only swap after the fade lands at 0
    // so the user sees a deliberate dim-down instead of an abrupt content jump.
    Animated.timing(inningsFade, { toValue: 0, duration: 160, useNativeDriver: true }).start(() => {
      // Phase 2: swap state. Skeleton renders (inningsReady[i] undefined).
      setActiveInnings(i);
      const innNum = scorecard?.innings?.[i]?.innings_number;
      if (innNum) loadCommentary(innNum);
      // Phase 3: let skeleton breathe for a moment, then mount heavy content
      // after interactions settle, then fade back in. Charts defer to Phase 4.
      setTimeout(() => {
        InteractionManager.runAfterInteractions(() => {
          setInningsReady((prev) => (prev[i] ? prev : { ...prev, [i]: true }));
          Animated.timing(inningsFade, { toValue: 1, duration: 220, useNativeDriver: true }).start();
        });
      }, 220);
    });
  }, [activeInnings, scorecard, loadCommentary, inningsFade, inningsPillWidth, innings.length, inningsPillX]);

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
    // Scorer-authored commentary from ShotZonePicker wins, with a prefix for context.
    if (ball.commentary && !ball.is_wicket && !ball.extra_type) {
      let prefix = `${bowler} to ${striker}, `;
      if (ball.is_six) prefix += 'SIX! ';
      else if (ball.is_boundary) prefix += 'FOUR! ';
      else if (ball.batsman_runs) prefix += `${ball.batsman_runs} run${ball.batsman_runs === 1 ? '' : 's'}, `;
      return prefix + ball.commentary;
    }
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
  // `innings` is already declared above the effect hooks that depend on it.
  const currentInn = innings[activeInnings];
  const commData = commentary[currentInn?.innings_number] || [];

  const { overGroups, overNumbers } = useMemo(() => {
    const groups = {};
    for (let i = commData.length - 1; i >= 0; i--) {
      const ball = commData[i];
      const key = ball.over;
      (groups[key] ||= []).push(ball);
    }
    const numbers = Object.keys(groups).map(Number).sort((a, b) => b - a);
    return { overGroups: groups, overNumbers: numbers };
  }, [commData]);

  // Chart series for the Scorecard tab's active innings.
  // Prefers backend-provided currentInn.over_series (covers every over, one SQL aggregate).
  // Falls back to deriving from paginated commentary if the server doesn't expose it yet.
  const scorecardChartData = useMemo(() => {
    const series = currentInn?.over_series;
    if (series && series.length) {
      const manhattan = series.map((row) => ({
        over: row.over, runs: row.runs || 0, wickets: row.wickets || 0,
      }));
      return { manhattan };
    }
    if (!commData?.length) return { manhattan: [] };
    const byOver = {};
    commData.forEach((ball) => {
      const k = ball.over;
      if (k === undefined || k === null) return;
      if (!byOver[k]) byOver[k] = [];
      byOver[k].push(ball);
    });
    const overNums = Object.keys(byOver).map(Number).sort((a, b) => a - b);
    const manhattan = overNums.map((overIdx) => {
      const balls = byOver[overIdx] || [];
      const overRuns = balls.reduce((s, b) => s + (b.total_runs || 0), 0);
      const wickets = balls.filter((b) => b.is_wicket).length;
      return { over: overIdx + 1, runs: overRuns, wickets };
    });
    return { manhattan };
  }, [currentInn?.over_series, commData]);

  // Memoize summary overs (must be before early returns to respect Rules of Hooks)
  const summaryInningsIdx = summaryInnings >= 0 ? summaryInnings : (innings.length - 1);
  const summaryInnData = innings[summaryInningsIdx] || null;
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
              <PlayerAvatar player={p} size={36} color={color} />
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

  // RENDER

  return (
    <Animated.View style={[st.container, { paddingTop: insets.top, opacity: contentFade }]}>

      {/* ── CELEBRATION OVERLAY (viewer-side) ── */}
      <CelebrationOverlay
        type={celebration}
        visible={!!celebration}
        onFinish={clearCelebration}
      />

      {/* ── LIVE COMMENTARY TICKER ── */}
      {liveCommentary ? (
        <View style={st.liveCommentaryBar}>
          <Text style={st.liveCommentaryQuote}>"</Text>
          <Text style={st.liveCommentaryText} numberOfLines={2}>{liveCommentary}</Text>
        </View>
      ) : null}

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
          {match.name ? (
            <Text style={st.headerName} numberOfLines={1}>{match.name}</Text>
          ) : null}
          {(match.tournament_name || match.match_code) && (
            <Text style={st.headerSubtitle} numberOfLines={1}>
              {match.tournament_name || ''}{match.match_number ? ` \u2022 Match ${match.match_number}` : ''}{match.match_code ? ` \u2022 ${match.match_code}` : ''}
            </Text>
          )}
        </View>
        <FavoriteButton entityType="match" entityId={match.id} variant="header" size={20} />
        <TouchableOpacity onPress={handleShare} style={st.headerBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Icon name="share" size={18} color={COLORS.TEXT} />
        </TouchableOpacity>
      </View>
      {match.is_favorite && (
        <View style={st.inFavRow}>
          <MaterialCommunityIcons name="heart" size={12} color={COLORS.ACCENT_LIGHT} />
          <Text style={st.inFavText}>In your favorites</Text>
        </View>
      )}

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

      {/* ── MATCH SETUP STEPPER (creator only, pre-live setup phases only) ──
          Hidden once the match goes live or completes — scoring phase shouldn't
          clutter the Summary with a setup stepper. */}
      {isCreator && !isCompleted && !isLive && activeTab === 0 && (() => {
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
        scrollEnabled={pagerScrollEnabled}
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

            {/* Score Hero Card — for completed matches we back it with a big
                 hero image (POM profile if available, default cricket ground
                 otherwise) and dim the top with a dark gradient so the score
                 remains legible. Live / upcoming keep the flat treatment. */}
            {(() => {
              const pom = scorecard?.top_performers?.player_of_match;
              const heroImageUri = isCompleted && pom?.profile
                ? (pom.profile.startsWith('http')
                    ? pom.profile
                    : `${api.defaults.baseURL}${pom.profile}`)
                : null;
              // When no POM photo is available, fall back to a rich two-color
              // gradient using the winner's team color — much better than a
              // faint app-icon watermark.
              const winnerId = match?.winner_id;
              const rawWinnerColor = winnerId ? (getTeamColor(winnerId) || COLORS.ACCENT) : COLORS.ACCENT;
              const winnerColor = (typeof rawWinnerColor === 'string' && /^#[0-9A-Fa-f]{6}$/.test(rawWinnerColor)) ? rawWinnerColor : '#1E88E5';
              const HeroWrap = isCompleted ? ImageBackground : View;
              const heroProps = isCompleted
                ? {
                    source: heroImageUri
                      ? { uri: heroImageUri }
                      : require('../../../assets/icon.png'),
                    resizeMode: 'cover',
                    // Hide the default image entirely when there's no real POM
                    // photo — the gradient below replaces it visually.
                    imageStyle: { opacity: heroImageUri ? 0.6 : 0, borderRadius: 16 },
                    style: [st.scoreHero, st.scoreHeroCompleted],
                  }
                : { style: st.scoreHero };
              return (
            <HeroWrap {...heroProps}>
              {isCompleted ? (
                heroImageUri ? (
                  // Real image: darken for legibility, gradient top→bottom
                  <LinearGradient
                    colors={['rgba(0,0,0,0.25)', 'rgba(0,0,0,0.75)']}
                    style={StyleSheet.absoluteFill}
                  />
                ) : (
                  // No image: team-color gradient background
                  <LinearGradient
                    colors={[winnerColor + 'E6', winnerColor + '99', '#0D0D0D']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill}
                  />
                )
              ) : null}
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
                          <Text style={st.heroOversLabel}>
                            ({battingInnScore.overs}{match?.overs ? ` / ${sumInnData?.innings_number > 2 ? 1 : match.overs}` : ''} ov)
                          </Text>
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
            </HeroWrap>
              );
            })()}

            {/* ====== PLAYER OF THE MATCH — highlighted card, right under the score ====== */}
            {isCompleted && scorecard?.top_performers?.player_of_match && (() => {
              const pom = scorecard.top_performers.player_of_match;
              const hasBat = pom.batting && (pom.batting.runs || 0) > 0;
              const hasBowl = pom.bowling && (pom.bowling.wickets || 0) > 0;
              return (
                <TouchableOpacity
                  style={st.pomCard}
                  activeOpacity={0.85}
                  onPress={() => goToPlayer(pom.player_id)}
                >
                  {/* Top ribbon — gold strip so the card reads as a "win" highlight
                       even without a full border */}
                  <View style={st.pomRibbon}>
                    <MaterialCommunityIcons name="trophy" size={12} color="#FFD700" />
                    <Text style={st.pomRibbonText}>PLAYER OF THE MATCH</Text>
                  </View>
                  <View style={st.pomBody}>
                    <Avatar
                      uri={pom.profile}
                      name={pom.player_name}
                      size={48}
                      color="#FFD700"
                      showRing
                      type="player"
                    />
                    <View style={st.pomInfo}>
                      <Text style={st.pomName} numberOfLines={1}>
                        {pom.player_name}
                      </Text>
                      {pom.team_name ? (
                        <Text style={st.pomTeam} numberOfLines={1}>
                          {pom.team_name}
                        </Text>
                      ) : null}
                      <View style={st.pomStatsRow}>
                        {hasBat && (
                          <View style={st.pomPill}>
                            <MaterialCommunityIcons name="cricket" size={10} color={COLORS.ACCENT_LIGHT} />
                            <Text style={st.pomPillValue}>{pom.batting.runs}</Text>
                            <Text style={st.pomPillUnit}>({pom.batting.balls_faced})</Text>
                          </View>
                        )}
                        {hasBowl && (
                          <View style={st.pomPill}>
                            <MaterialCommunityIcons name="baseball" size={10} color={COLORS.WARNING} />
                            <Text style={st.pomPillValue}>
                              {pom.bowling.wickets}/{pom.bowling.runs_conceded}
                            </Text>
                            <Text style={st.pomPillUnit}>({pom.bowling.overs_bowled}ov)</Text>
                          </View>
                        )}
                      </View>
                    </View>
                    <MaterialCommunityIcons
                      name="chevron-right"
                      size={18}
                      color={COLORS.TEXT_MUTED}
                      style={{ marginLeft: 4 }}
                    />
                  </View>
                </TouchableOpacity>
              );
            })()}

            {/* ====== BROADCAST BANNER ====== */}
            {broadcastMsg && (
              <View style={st.broadcastBanner}>
                <MaterialCommunityIcons name="bullhorn" size={16} color={COLORS.WARNING} />
                <Text style={st.broadcastBannerText}>{broadcastMsg}</Text>
              </View>
            )}

            {/* Bowling team score removed — shown in Score Hero card */}

            {/* Recent Overs removed — available in Commentary tab */}

            {/* ====== TOP PERFORMERS — per innings with player avatars ======
                 One block per innings ("Innings 1 — Team A", "Innings 2 — Team B",
                 plus any super-over innings). Each innings shows the top 2
                 batters for that innings and the top 2 bowlers (from the
                 opposing team who bowled that innings). Avatars use each
                 player's profile image when the backend sends one; otherwise
                 Avatar falls back to initials on a colored gradient. */}
            {isCompleted && innings.length > 0 && (
              <View style={st.tpSection}>
                <View style={st.tpSectionHead}>
                  <MaterialCommunityIcons name="star-four-points" size={16} color={COLORS.ACCENT_LIGHT} />
                  <Text style={st.tpSectionTitle}>Top Performers</Text>
                </View>
                {innings.map((inn, idx) => {
                  const batList = (inn.batting || [])
                    .filter((b) => (b.balls_faced || 0) > 0 || (b.runs || 0) > 0)
                    .sort((a, b) => (b.runs || 0) - (a.runs || 0))
                    .slice(0, 2);
                  const bowlList = (inn.bowling || [])
                    .filter((b) => (b.overs_bowled || 0) > 0)
                    .sort((a, b) =>
                      (b.wickets || 0) - (a.wickets || 0) ||
                      (a.economy_rate || 0) - (b.economy_rate || 0)
                    )
                    .slice(0, 2);
                  if (!batList.length && !bowlList.length) return null;
                  const battingTeamColor = getTeamColor(inn.batting_team_id);
                  const bowlingTeamColor = getTeamColor(inn.bowling_team_id);
                  const inningsLabel = inn.innings_number > 2
                    ? `Super Over ${inn.innings_number - 2}`
                    : `Innings ${inn.innings_number}`;
                  return (
                    <View key={`tp-${idx}`} style={st.tpCard}>
                      {/* Innings + batting-team header */}
                      <View style={st.tpInnHead}>
                        <Text style={st.tpInnLabel}>{inningsLabel}</Text>
                        <View style={[st.tpTeamChip, { backgroundColor: battingTeamColor }]}>
                          <Text style={st.tpTeamChipText}>{getTeamShort(inn.batting_team_id)}</Text>
                        </View>
                        <Text style={st.tpTeamName} numberOfLines={1}>{getTeamName(inn.batting_team_id)}</Text>
                        <Text style={st.tpInnScore}>
                          {inn.total_runs}/{inn.total_wickets}
                          <Text style={st.tpInnOvers}> ({inn.total_overs})</Text>
                        </Text>
                      </View>

                      {/* Top batters */}
                      {batList.length > 0 && (
                        <View style={st.tpGroup}>
                          <Text style={st.tpGroupLabel}>TOP BATTERS</Text>
                          {batList.map((b, i) => (
                            <TouchableOpacity
                              key={`bat-${i}`}
                              style={st.tpRow}
                              activeOpacity={0.7}
                              onPress={() => goToPlayer(b.player_id)}
                            >
                              <Avatar uri={b.profile} name={b.player_name} size={32} color={battingTeamColor} type="player" />
                              <View style={st.tpRowMain}>
                                <Text style={st.tpRowName} numberOfLines={1}>{b.player_name}</Text>
                                <Text style={st.tpRowMeta}>
                                  {b.fours || 0}×4  •  {b.sixes || 0}×6  •  SR{' '}
                                  {(b.balls_faced || 0) > 0 ? ((b.runs / b.balls_faced) * 100).toFixed(1) : '0.0'}
                                </Text>
                              </View>
                              <View style={st.tpRowStat}>
                                <Text style={st.tpRowStatValue}>{b.runs || 0}</Text>
                                <Text style={st.tpRowStatUnit}>({b.balls_faced || 0})</Text>
                              </View>
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}

                      {/* Top bowlers (from the bowling side) */}
                      {bowlList.length > 0 && (
                        <View style={[st.tpGroup, { borderTopWidth: 1, borderTopColor: COLORS.BORDER }]}>
                          <Text style={st.tpGroupLabel}>TOP BOWLERS</Text>
                          {bowlList.map((bw, i) => (
                            <TouchableOpacity
                              key={`bowl-${i}`}
                              style={st.tpRow}
                              activeOpacity={0.7}
                              onPress={() => goToPlayer(bw.player_id)}
                            >
                              <Avatar uri={bw.profile} name={bw.player_name} size={32} color={bowlingTeamColor} type="player" />
                              <View style={st.tpRowMain}>
                                <Text style={st.tpRowName} numberOfLines={1}>{bw.player_name}</Text>
                                <Text style={st.tpRowMeta}>
                                  {bw.overs_bowled || 0}ov  •  {bw.maidens || 0}m  •  Econ {(bw.economy_rate || 0).toFixed(2)}
                                </Text>
                              </View>
                              <View style={st.tpRowStat}>
                                <Text style={st.tpRowStatValue}>{bw.wickets || 0}/{bw.runs_conceded || 0}</Text>
                                <Text style={st.tpRowStatUnit}>({bw.overs_bowled || 0}ov)</Text>
                              </View>
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            )}

            {isLive && sumInnIdx === innings.length - 1 && liveState?.this_over?.length > 0 && (
              <View style={st.thisOverCard}>
                <Text style={st.thisOverLabel}>THIS OVER</Text>
                <View style={st.thisOverRow}>
                  {liveState.this_over.map((ball, i) => {
                    const kind = getBallKind(ball);
                    return (
                      <View key={i} style={[st.ballPill, st[`ballPill_${kind}`]]}>
                        <Text style={[st.ballPillText, st[`ballPillText_${kind}`]]}>{ball}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

            {isLive && sumInnIdx === innings.length - 1 && (() => {
              const innNum = currentInn?.innings_number;
              const lastBall = innNum && commData?.[0];
              const commentaryText = liveCommentary || lastBall?.commentary || null;
              if (!commentaryText) return null;
              const cKind = celebration === 'six' ? 'six'
                : celebration === 'four' ? 'four'
                : (celebration && celebration.startsWith('wicket')) ? 'wicket'
                : (lastBall?.is_six ? 'six'
                  : lastBall?.is_wicket ? 'wicket'
                  : (lastBall?.is_boundary || lastBall?.batsman_runs === 4) ? 'four'
                  : null);
              return (
                <View style={[st.lastBallCard, cKind && st[`lastBallCard_${cKind}`]]}>
                  {cKind && (
                    <Text style={[st.lastBallTag, st[`lastBallTag_${cKind}`]]}>
                      {cKind === 'six' ? 'SIX!' : cKind === 'four' ? 'FOUR!' : 'WICKET!'}
                    </Text>
                  )}
                  <Text style={st.lastBallQuote}>"</Text>
                  <Text style={st.lastBallText} numberOfLines={3}>{commentaryText}</Text>
                </View>
              );
            })()}

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

            {/* Last Wicket — only during live play. Hidden on completed matches
                 because the full result is already visible in the hero card +
                 scorecard, and the "last wicket" framing feels stale once the
                 match is over. */}
            {lastFow && isLive && (
              <View style={[st.pshipRow, { justifyContent: 'center' }]}>
                <View style={st.lastWicketCard}>
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
        {/* Skeleton only until scorecard data arrives. If it's already cached,
            render immediately — don't wait for the content-ready tick. */}
        {!scorecard && (
          <TabContentSkeleton variant="scorecard" />
        )}
        {scorecard && (
          <View style={st.tabContent}>
            {/* Innings selector — segmented pill with a sliding indicator
                 (same transition feel as the tournament tab bar). */}
            {innings.length > 0 && (
              <View style={st.segmentedWrap}>
                <View
                  style={st.segmented}
                  onLayout={(e) => setInningsPillWidth(e.nativeEvent.layout.width)}
                >
                  {/* Sliding active indicator — translates in pixels under the segments */}
                  {inningsPillWidth > 0 && (
                    <Animated.View
                      pointerEvents="none"
                      style={[
                        st.segmentIndicator,
                        {
                          width: (inningsPillWidth - 6) / innings.length,
                          transform: [{ translateX: inningsPillX }],
                        },
                      ]}
                    />
                  )}
                  {innings.map((inn, i) => (
                    <TouchableOpacity
                      key={i}
                      style={st.segment}
                      onPress={() => onInningsChange(i)}
                      activeOpacity={0.75}
                    >
                      <Text style={[st.segmentCompact, activeInnings === i && st.segmentCompactActive]}>
                        {inn.is_pending
                          ? `${getTeamShort(inn.batting_team_id)} • Yet`
                          : `${getTeamShort(inn.batting_team_id)} ${inn.total_runs}/${inn.total_wickets}${inn.declared ? 'd' : ''}`}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {currentInn && !currentInn.is_pending && (() => {
              const plannedOvers = currentInn.innings_number > 2 ? 1 : (match?.overs || scorecard?.overs);
              const oversLabel = plannedOvers
                ? `${currentInn.total_overs || 0} / ${plannedOvers} overs`
                : `${currentInn.total_overs || 0} overs`;
              return (
                <View style={st.sHero}>
                  <View style={st.sHeroLeft}>
                    <Text style={st.sHeroTeam}>{currentInn.batting_team_name || getTeamShort(currentInn.batting_team_id)}</Text>
                    <Text style={st.sHeroOvers}>{oversLabel}{currentInn.target ? ` • Target ${currentInn.target}` : ''}</Text>
                  </View>
                  <View style={st.sHeroRight}>
                    <Text style={st.sHeroScore}>
                      {currentInn.total_runs}<Text style={st.sHeroWkts}>/{currentInn.total_wickets}</Text>
                      {currentInn.declared ? <Text style={st.sHeroDeclared}>{' d'}</Text> : null}
                    </Text>
                    {currentInn.total_overs > 0 && (
                      <Text style={st.sHeroRR}>RR {(currentInn.total_runs / currentInn.total_overs).toFixed(2)}</Text>
                    )}
                  </View>
                </View>
              );
            })()}

            {!scorecard || innings.length === 0 ? (
              <View style={st.emptyState}>
                <Icon name="scorecard" size={32} />
                <Text style={st.emptyText}>No scorecard available yet</Text>
              </View>
            ) : !inningsReady[activeInnings] ? (
              <TabContentSkeleton variant="scorecard" />
            ) : currentInn?.is_pending ? (
              <Animated.View style={{ opacity: inningsFade }}>
                <View style={st.card}>
                  <View style={st.pendingHero}>
                    <MaterialCommunityIcons name="clock-outline" size={28} color={COLORS.ACCENT_LIGHT} />
                    <Text style={st.pendingTitle}>{currentInn.batting_team_name}</Text>
                    <Text style={st.pendingSub}>Innings not started yet</Text>
                  </View>
                  {currentInn.yet_to_bat?.length > 0 ? (
                    <>
                      {currentInn.yet_to_bat.map((p, i) => {
                        const color = getTeamColor(currentInn.batting_team_id);
                        return (
                          <TouchableOpacity
                            key={p.player_id}
                            style={st.squadRow}
                            onPress={() => goToPlayer(p.player_id)}
                            activeOpacity={0.65}
                          >
                            <PlayerAvatar player={p} size={36} color={color} />
                            <View style={{ flex: 1 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Text style={st.squadName}>{p.player_name}</Text>
                                {p.is_captain && <Text style={st.capBadge}>C</Text>}
                                {!p.is_captain && p.is_vice_captain && <Text style={st.vcBadge}>VC</Text>}
                                {p.is_wicket_keeper && <Text style={st.wkBadge}>WK</Text>}
                              </View>
                              {p.role && (
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                                  <Icon name={getRoleIcon(p.role)} size={10} />
                                  <Text style={st.squadRole}>{getRoleLabel(p.role)}</Text>
                                </View>
                              )}
                            </View>
                            <Text style={{ fontSize: 11, color: COLORS.TEXT_MUTED, fontWeight: '600' }}>
                              #{p.batting_order || i + 1}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </>
                  ) : (
                    <View style={{ padding: 18, alignItems: 'center' }}>
                      <Text style={{ color: COLORS.TEXT_SECONDARY, fontSize: 13 }}>
                        Squad not selected yet
                      </Text>
                    </View>
                  )}
                </View>
              </Animated.View>
            ) : currentInn ? (
              <Animated.View style={{ opacity: inningsFade }}>
                {/* Batting */}
                <View style={st.card}>
                  <View style={st.sectionHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <MaterialCommunityIcons name="cricket" size={15} color={COLORS.ACCENT_LIGHT} />
                      <Text style={st.sectionTitle}>Batting</Text>
                    </View>
                    {currentInn.total_overs > 0 && (
                      <View style={st.rrBadge}>
                        <Text style={st.rrBadgeText}>
                          RR {(currentInn.total_runs / currentInn.total_overs).toFixed(2)}
                        </Text>
                      </View>
                    )}
                  </View>
                  <View style={st.tableHeader}>
                    <Text style={[st.thCell, st.thName]}>BATTER</Text>
                    <Text style={st.thCell}>R</Text>
                    <Text style={st.thCell}>B</Text>
                    <Text style={st.thCell}>4s</Text>
                    <Text style={st.thCell}>6s</Text>
                    <Text style={st.thCell}>SR</Text>
                  </View>
                  {(() => {
                    const teamTotal = Math.max(1, currentInn.total_runs || 1);
                    return currentInn.batting.map((b, i) => {
                      const isRetired = !b.is_out && /retired/i.test(b.how_out || '');
                      const isStillBatting = !b.is_out && !b.how_out;
                      const sharePct = Math.min(100, Math.round(((b.runs || 0) / teamTotal) * 100));
                      return (
                        <TouchableOpacity
                          key={i}
                          style={st.batRow}
                          onPress={() => goToPlayer(b.player_id)}
                          activeOpacity={0.7}
                        >
                          <View style={[st.tdCell, st.tdName]}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                              <Text style={st.playerName} numberOfLines={1}>
                                {b.player_name}
                              </Text>
                              {b.is_captain && <Text style={st.capBadgeSm}>C</Text>}
                              {!b.is_captain && b.is_vice_captain && <Text style={st.vcBadgeSm}>VC</Text>}
                              {b.is_wicket_keeper && <Text style={st.wkBadgeSm}>WK</Text>}
                            </View>
                            <Text
                              style={[
                                st.howOut,
                                isStillBatting
                                  ? { color: PRIMARY, fontStyle: 'italic' }
                                  : isRetired
                                  ? { color: COLORS.ACCENT_LIGHT, fontWeight: '700' }
                                  : /run out/i.test(b.how_out || '')
                                  ? { color: COLORS.WARNING }
                                  : { color: COLORS.TEXT_MUTED },
                              ]}
                              numberOfLines={1}
                            >
                              {b.how_out || 'not out'}
                            </Text>
                          </View>
                          <Text style={[st.tdCell, st.tdBold]}>{b.runs}</Text>
                          <Text style={st.tdCell}>{b.balls_faced}</Text>
                          <Text style={st.tdCell}>{b.fours}</Text>
                          <Text style={st.tdCell}>{b.sixes}</Text>
                          <Text style={st.tdCell}>{b.strike_rate?.toFixed(1)}</Text>
                        </TouchableOpacity>
                      );
                    });
                  })()}

                  {/* Extras */}
                  <View style={st.extrasRow}>
                    <Text style={st.extrasLabel}>Extras</Text>
                    <Text style={st.extrasValue}>{currentInn.total_extras}</Text>
                  </View>

                  {currentInn.yet_to_bat?.length > 0 && (
                    <View style={st.yetWrap}>
                      <Text style={st.yetLabel}>Yet to Bat</Text>
                      <View style={st.yetChipsRow}>
                        {currentInn.yet_to_bat.map((p) => (
                          <TouchableOpacity
                            key={p.player_id}
                            style={st.yetChip}
                            onPress={() => goToPlayer(p.player_id)}
                            activeOpacity={0.7}
                          >
                            {p.role && <Icon name={getRoleIcon(p.role)} size={10} />}
                            <Text style={st.yetChipText}>{p.player_name || p.name}</Text>
                            {p.is_captain && <Text style={st.capBadgeSm}>C</Text>}
                            {!p.is_captain && p.is_vice_captain && <Text style={st.vcBadgeSm}>VC</Text>}
                            {p.is_wicket_keeper && <Text style={st.wkBadgeSm}>WK</Text>}
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  )}
                </View>

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
                    <TouchableOpacity
                      key={i}
                      style={st.tableRow}
                      onPress={() => goToPlayer(b.player_id)}
                      activeOpacity={0.7}
                    >
                      <View style={[st.tdCell, st.tdName, { flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
                        <Text style={st.playerName} numberOfLines={1}>{b.player_name}</Text>
                        {b.is_captain && <Text style={st.capBadgeSm}>C</Text>}
                        {!b.is_captain && b.is_vice_captain && <Text style={st.vcBadgeSm}>VC</Text>}
                        {b.is_wicket_keeper && <Text style={st.wkBadgeSm}>WK</Text>}
                      </View>
                      <Text style={st.tdCell}>{b.overs_bowled}</Text>
                      <Text style={st.tdCell}>{b.maidens}</Text>
                      <Text style={st.tdCell}>{b.runs_conceded}</Text>
                      <Text style={[st.tdCell, st.tdBold]}>{b.wickets}</Text>
                      <Text style={st.tdCell}>{b.economy_rate?.toFixed(1)}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Fall of Wickets — three-column table (Batter / Score / Over).
                     Columns are flex-sized so Score and Over sit snugly next to
                     the Batter column instead of floating off to the right. */}
                {currentInn.fall_of_wickets?.length > 0 && (
                  <View style={st.card}>
                    <Text style={st.sectionTitle}>Fall of Wickets</Text>
                    <View style={st.tableHeader}>
                      <Text style={[st.thCell, st.fowColName]}>Batter</Text>
                      <Text style={[st.thCell, st.fowColNum]}>Score</Text>
                      <Text style={[st.thCell, st.fowColNum]}>Over</Text>
                    </View>
                    {currentInn.fall_of_wickets.map((f, i) => (
                      <TouchableOpacity
                        key={i}
                        style={st.tableRow}
                        onPress={() => goToPlayer(f.player_id)}
                        activeOpacity={0.7}
                      >
                        <Text style={[st.tdCell, st.fowColName, st.playerName]} numberOfLines={1}>
                          {f.player_name || '—'}
                        </Text>
                        <Text style={[st.tdCell, st.fowColNum, st.tdBold]}>
                          {f.runs_at_fall}-{f.wicket_number}
                        </Text>
                        <Text style={[st.tdCell, st.fowColNum]}>{f.overs_at_fall}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {/* Partnerships — stacked horizontal bars, biggest stand highlighted */}
                {currentInn.partnerships?.length > 0 && (
                  <View style={st.card}>
                    <View style={st.sectionHeader}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <MaterialCommunityIcons name="link-variant" size={15} color={COLORS.ACCENT_LIGHT} />
                        <Text style={st.sectionTitle}>Partnerships</Text>
                      </View>
                    </View>
                    {(() => {
                      const visible = currentInn.partnerships
                        .filter((p) => p.total_runs > 0 || p.is_active)
                        .sort((a, b) => a.wicket_number - b.wicket_number);
                      const maxRuns = Math.max(...visible.map((pp) => pp.total_runs || 0), 1);
                      const bestIdx = visible.reduce((best, p, idx, arr) => ((p.total_runs || 0) > (arr[best].total_runs || 0) ? idx : best), 0);
                      return visible.map((p, i) => {
                        const totalP = p.total_runs || 0;
                        const aRuns = p.player_a_runs || 0;
                        const bRuns = p.player_b_runs || 0;
                        const extras = Math.max(0, totalP - aRuns - bRuns);
                        const aPct = totalP > 0 ? (aRuns / totalP) * 100 : 50;
                        const bPct = totalP > 0 ? (bRuns / totalP) * 100 : 50;
                        const extrasPct = totalP > 0 ? (extras / totalP) * 100 : 0;
                        const barPct = Math.round(((totalP || 1) / maxRuns) * 100);
                        const isBest = i === bestIdx && totalP > 0;
                        const totalBalls = p.total_balls || 0;
                        return (
                          <View key={i} style={st.pshipCard}>
                            <View style={st.pshipHead}>
                              <View style={st.pshipWktChip}>
                                {/* Label from the loop index so partnerships
                                    are numbered 1-upwards regardless of how
                                    `wicket_number` is stored on the backend
                                    (0 for opening, 2+ after each wicket). */}
                                <Text style={st.pshipWktText}>W{i + 1}</Text>
                              </View>
                              <View style={{ flex: 1, alignItems: 'center' }}>
                                <Text style={st.pshipTotal}>
                                  {totalP} <Text style={st.pshipBalls}>({totalBalls})</Text>
                                </Text>
                              </View>
                              {/* Only show LIVE when the match itself is actually live.
                                  Backend doesn't always flip is_active=false when
                                  end_match is called without a wicket, so guard
                                  on match state here. */}
                              {p.is_active && isLive ? (
                                <View style={st.pshipLiveBadge}>
                                  <View style={st.pshipLiveDot} />
                                  <Text style={st.pshipLiveText}>LIVE</Text>
                                </View>
                              ) : isBest ? (
                                <View style={st.pshipBestBadge}>
                                  <MaterialCommunityIcons name="star" size={9} color={COLORS.ACCENT_LIGHT} />
                                  <Text style={st.pshipBestText}>BEST</Text>
                                </View>
                              ) : (
                                <View style={{ width: 44 }} />
                              )}
                            </View>
                            {/* Stacked bar — width proportional to biggest stand */}
                            <View style={[st.pshipBarTrack, { width: `${barPct}%` }]}>
                              <View style={[st.pshipBarSlice, { flex: aPct || 0.1, backgroundColor: COLORS.ACCENT_LIGHT, borderTopLeftRadius: 6, borderBottomLeftRadius: 6 }]} />
                              {extras > 0 && <View style={[st.pshipBarSlice, { flex: extrasPct || 0.1, backgroundColor: COLORS.TEXT_MUTED }]} />}
                              <View style={[st.pshipBarSlice, { flex: bPct || 0.1, backgroundColor: COLORS.ACCENT_DARK, borderTopRightRadius: 6, borderBottomRightRadius: 6 }]} />
                            </View>
                            {/* Players */}
                            <View style={st.pshipPlayersRow}>
                              <View style={{ flex: 1 }}>
                                <Text style={[st.pshipPlayerName, { color: COLORS.ACCENT_LIGHT }]} numberOfLines={1}>
                                  {p.player_a_name || 'Player A'}
                                </Text>
                                <Text style={st.pshipPlayerStat}>{aRuns}</Text>
                              </View>
                              <View style={{ flex: 1, alignItems: 'flex-end' }}>
                                <Text style={[st.pshipPlayerName, { color: COLORS.ACCENT_DARK, textAlign: 'right' }]} numberOfLines={1}>
                                  {p.player_b_name || 'Player B'}
                                </Text>
                                <Text style={st.pshipPlayerStat}>{bRuns}</Text>
                              </View>
                            </View>
                          </View>
                        );
                      });
                    })()}
                  </View>
                )}

                {scorecardChartData.manhattan.length > 1 && (
                  chartsReady[activeInnings] ? (
                    <View style={st.pulseCard}>
                      <View style={st.pulseHead}>
                        <MaterialCommunityIcons name="chart-bar" size={16} color={COLORS.ACCENT_LIGHT} />
                        <Text style={st.pulseTitle}>Runs per Over</Text>
                        <Text style={st.pulseSub}>{currentInn.batting_team_name || ''}</Text>
                      </View>
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        nestedScrollEnabled
                        directionalLockEnabled
                        onTouchStart={() => setPagerScrollEnabled(false)}
                        onTouchEnd={() => setPagerScrollEnabled(true)}
                        onTouchCancel={() => setPagerScrollEnabled(true)}
                      >
                        <ManhattanChart
                          overs={scorecardChartData.manhattan}
                          height={150}
                          barColor={COLORS.ACCENT}
                          minBarSlot={CHART_SLOT_WIDTH}
                          showTitle={false}
                          showLegend={false}
                          style={st.pulseChartInner}
                        />
                      </ScrollView>
                      <Text style={st.pulseHint}>Swipe sideways to see all overs →</Text>
                    </View>
                  ) : (
                    <View style={st.pulseCard}>
                      <View style={st.pulseHead}>
                        <MaterialCommunityIcons name="chart-bar" size={16} color={COLORS.ACCENT_LIGHT} />
                        <Text style={st.pulseTitle}>Runs per Over</Text>
                      </View>
                      <Skeleton width="100%" height={150} borderRadius={10} />
                    </View>
                  )
                )}
              </Animated.View>
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
        {/* Show skeleton until scorecard is cached (gives us innings info
            needed to render the tab). Cached = render instantly. */}
        {!scorecard && (
          <TabContentSkeleton variant="commentary" />
        )}
        {scorecard && (
          <View style={st.tabContent}>
            {/* Innings selector — segmented pill with sliding indicator
                 (same transition feel as the Scorecard tab and the tournament tab bar). */}
            {innings.length > 0 && (
              <View style={st.segmentedWrap}>
                <View
                  style={st.segmented}
                  onLayout={(e) => setInningsPillWidth(e.nativeEvent.layout.width)}
                >
                  {inningsPillWidth > 0 && (
                    <Animated.View
                      pointerEvents="none"
                      style={[
                        st.segmentIndicator,
                        {
                          width: (inningsPillWidth - 6) / innings.length,
                          transform: [{ translateX: inningsPillX }],
                        },
                      ]}
                    />
                  )}
                  {innings.map((inn, i) => (
                    <TouchableOpacity
                      key={i}
                      style={st.segment}
                      onPress={() => onInningsChange(i)}
                      activeOpacity={0.75}
                    >
                      <Text style={[st.segmentCompact, activeInnings === i && st.segmentCompactActive]}>
                        {getTeamShort(inn.batting_team_id)} {inn.total_runs}/{inn.total_wickets}{inn.declared ? 'd' : ''}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Commentary Filters + list — wrapped in Animated.View so the
                 content dims during an innings switch, matching the Scorecard tab. */}
            <Animated.View style={{ opacity: inningsFade }}>
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

            {commLoading && commData.length === 0 ? (
              // Skeleton only when we have nothing cached yet — subsequent
              // refetches (e.g. innings switch with cached data) keep the
              // existing commentary visible instead of blanking to a spinner.
              <TabContentSkeleton variant="commentary" />
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
            </Animated.View>
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

// STYLES

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.BG },
  pulseCard: {
    backgroundColor: COLORS.CARD,
    marginHorizontal: 12,
    marginTop: 10,
    marginBottom: 4,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  pulseHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 4,
    paddingBottom: 6,
  },
  pulseTitle: { fontFamily: FONTS.family, fontSize: 13, fontWeight: '800', color: COLORS.TEXT, letterSpacing: 0.5 },
  pulseSub: { fontFamily: FONTS.family, fontSize: 11, fontWeight: '600', color: COLORS.TEXT_MUTED, marginLeft: 'auto' },
  pulseChartInner: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    padding: 0,
    borderRadius: 0,
    // no horizontal padding — the outer pulseCard already provides padding,
    // and we want the chart to consume full scroll width
  },
  pulseHint: {
    fontFamily: FONTS.family,    fontSize: 10,
    color: COLORS.TEXT_MUTED,
    textAlign: 'center',
    marginTop: 8,
    letterSpacing: 0.3,
  },
  /* Player of the Match — highlighted card with a gold ribbon.
     Subtle gold tint + gold accent elements make it stand out without a border. */
  pomCard: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,215,0,0.06)',
  },
  pomRibbon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,215,0,0.14)',
  },
  pomRibbonText: {
    fontFamily: FONTS.family,    fontSize: 10,
    fontWeight: '900',
    color: '#FFD700',
    letterSpacing: 1.2,
  },
  pomBody: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 12,
  },
  pomInfo: {
    flex: 1,
    minWidth: 0, // lets the children actually shrink + ellipsize
  },
  pomName: { fontFamily: FONTS.family, fontSize: 14, fontWeight: '800', color: COLORS.TEXT },
  pomTeam: { fontFamily: FONTS.family, fontSize: 11, color: COLORS.TEXT_MUTED, marginTop: 1 },
  pomStatsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  pomPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: COLORS.SURFACE,
  },
  pomPillValue: {
    fontFamily: FONTS.family,    fontSize: 12,
    fontWeight: '900',
    color: COLORS.TEXT,
    fontVariant: ['tabular-nums'],
  },
  pomPillUnit: {
    fontFamily: FONTS.family,    fontSize: 10,
    fontWeight: '600',
    color: COLORS.TEXT_MUTED,
    fontVariant: ['tabular-nums'],
  },

  /* Top Performers — per innings, flat borderless blocks */
  tpSection: { marginTop: 12, gap: 6 },
  tpSectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingBottom: 2,
  },
  tpSectionTitle: { fontFamily: FONTS.family, fontSize: 13, fontWeight: '800', color: COLORS.TEXT, letterSpacing: 0.3 },
  tpCard: {
    marginHorizontal: 16,
    backgroundColor: COLORS.BG,
    overflow: 'hidden',
  },
  tpInnHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 4,
    paddingVertical: 8,
    backgroundColor: COLORS.BG,
  },
  tpInnLabel: { fontFamily: FONTS.family, fontSize: 10, fontWeight: '800', color: COLORS.TEXT_MUTED, letterSpacing: 0.5 },
  tpTeamChip: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
    minWidth: 34,
    alignItems: 'center',
  },
  tpTeamChipText: { fontFamily: FONTS.family, fontSize: 9, fontWeight: '900', color: '#fff', letterSpacing: 0.5 },
  tpTeamName: { fontFamily: FONTS.family, flex: 1, fontSize: 11, fontWeight: '700', color: COLORS.TEXT },
  tpInnScore: {
    fontFamily: FONTS.family,    fontSize: 12,
    fontWeight: '900',
    color: COLORS.TEXT,
    fontVariant: ['tabular-nums'],
  },
  tpInnOvers: { fontFamily: FONTS.family, fontSize: 9, fontWeight: '600', color: COLORS.TEXT_MUTED },
  tpGroup: { paddingHorizontal: 4, paddingTop: 6, paddingBottom: 4 },
  tpGroupLabel: {
    fontFamily: FONTS.family,    fontSize: 9,
    fontWeight: '800',
    color: COLORS.TEXT_MUTED,
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  tpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
  },
  tpRowMain: { flex: 1, marginLeft: 10 },
  tpRowName: { fontFamily: FONTS.family, fontSize: 12, fontWeight: '700', color: COLORS.TEXT },
  tpRowMeta: { fontFamily: FONTS.family, fontSize: 9, color: COLORS.TEXT_MUTED, marginTop: 2, fontVariant: ['tabular-nums'] },
  tpRowStat: { alignItems: 'flex-end' },
  tpRowStatValue: { fontFamily: FONTS.family, fontSize: 13, fontWeight: '900', color: COLORS.TEXT, fontVariant: ['tabular-nums'] },
  tpRowStatUnit: { fontFamily: FONTS.family, fontSize: 9, color: COLORS.TEXT_MUTED, fontVariant: ['tabular-nums'] },
  liveCommentaryBar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginHorizontal: 12,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: COLORS.SURFACE,
    borderRadius: 10,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.ACCENT,
  },
  liveCommentaryQuote: { fontFamily: FONTS.family, fontSize: 18, fontWeight: '900', color: COLORS.ACCENT, lineHeight: 18 },
  liveCommentaryText: { fontFamily: FONTS.family, flex: 1, fontSize: 13, color: COLORS.TEXT, fontStyle: 'italic', lineHeight: 18 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.BG },
  scrollBody: { flex: 1 },

  // ── Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: COLORS.BG,
  },
  headerBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  inFavRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 4, paddingVertical: 5, paddingHorizontal: 12,
    backgroundColor: 'rgba(30,136,229,0.10)',
    borderBottomWidth: 1, borderBottomColor: 'rgba(30,136,229,0.22)',
  },
  inFavText: { fontFamily: FONTS.family, fontSize: 11, fontWeight: '800', color: COLORS.ACCENT_LIGHT, letterSpacing: 0.4 },
  backArrow: { fontFamily: FONTS.family, fontSize: 22, color: COLORS.TEXT, fontWeight: '600' },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.LIVE },
  headerTitle: { fontFamily: FONTS.family, fontSize: 17, fontWeight: '700', color: COLORS.TEXT },
  shareIcon: { fontFamily: FONTS.family, fontSize: 18, color: COLORS.TEXT },

  // ── Header center & subtitle
  headerCenter: { flex: 1, alignItems: 'center' },
  headerSubtitle: { fontFamily: FONTS.family, fontSize: 11, color: COLORS.TEXT_MUTED, fontWeight: '500', marginTop: 2 },
  headerName: { fontFamily: FONTS.family, fontSize: 12, color: COLORS.ACCENT_LIGHT, fontWeight: '800', letterSpacing: 0.3, marginTop: 2 },

  // ── Tab bar
  tabBarWrap: { backgroundColor: COLORS.BG, position: 'relative' },
  tabBarScroll: { paddingHorizontal: 0 },
  tab: { width: SCREEN_WIDTH / 4, alignItems: 'center', justifyContent: 'center', paddingVertical: 12 },
  tabText: { fontFamily: FONTS.family, fontSize: 13, color: COLORS.TEXT_MUTED, fontWeight: '600' },
  tabTextActive: { color: COLORS.TEXT, fontWeight: '700' },
  tabIndicator: { position: 'absolute', bottom: 0, height: 3, backgroundColor: PRIMARY, borderRadius: 2 },

  // ── Tab content
  tabContent: { paddingBottom: 8 },

  // ── Score Hero Card
  scoreHero: {
    // Flat, borderless panel — padding alone groups the content.
    marginHorizontal: 16, marginTop: 12, padding: 16, backgroundColor: COLORS.BG,
  },
  // When the match is completed we render the hero as an ImageBackground —
  // give it a minimum height so the image is visible and clip children to the
  // rounded corners.
  scoreHeroCompleted: {
    backgroundColor: '#111',
    minHeight: 220,
    borderRadius: 16,
    overflow: 'hidden',
    padding: 18,
    justifyContent: 'flex-end',
  },
  heroTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  heroTeamRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 },
  heroFlagChip: { width: 28, height: 18, borderRadius: 3, alignItems: 'center', justifyContent: 'center' },
  heroFlagChipText: { fontFamily: FONTS.family, fontSize: 8, fontWeight: '800', color: COLORS.TEXT },
  heroTeamLabel: { fontFamily: FONTS.family, fontSize: 13, fontWeight: '700', color: COLORS.TEXT, flexShrink: 1 },
  heroScoreRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  heroScoreBig: { fontFamily: FONTS.family, fontSize: 26, fontWeight: '900', color: COLORS.TEXT },
  heroOversLabel: { fontFamily: FONTS.family, fontSize: 13, fontWeight: '500', color: COLORS.TEXT_MUTED },
  heroRightCol: { alignItems: 'flex-end', gap: 4 },
  heroCrrText: { fontFamily: FONTS.family, fontSize: 12, fontWeight: '500', color: COLORS.TEXT_MUTED, marginTop: 4 },
  heroRrrText: { fontFamily: FONTS.family, fontSize: 12, fontWeight: '700', color: PRIMARY },
  heroInfoBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12,
    backgroundColor: COLORS.ACCENT_SOFT, borderRadius: 10, borderWidth: 1, borderColor: COLORS.ACCENT_SOFT_BORDER,
    marginTop: 4,
  },
  heroInfoIcon: { fontFamily: FONTS.family, fontSize: 16, color: PRIMARY },
  heroInfoText: { fontFamily: FONTS.family, flex: 1, fontSize: 12, fontWeight: '500', color: COLORS.TEXT_SECONDARY },
  broadcastBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 16, marginTop: 10, paddingVertical: 12, paddingHorizontal: 16,
    backgroundColor: COLORS.WARNING + '15', borderRadius: 12,
    borderWidth: 1, borderColor: COLORS.WARNING + '30',
  },
  broadcastBannerText: { fontFamily: FONTS.family, flex: 1, fontSize: 14, fontWeight: '700', color: COLORS.WARNING },
  heroStatusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  liveBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.LIVE_BG, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12,
  },
  liveBadgeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.LIVE },
  liveBadgeText: { fontFamily: FONTS.family, fontSize: 10, fontWeight: '800', color: COLORS.LIVE, letterSpacing: 0.8 },
  heroMatchInfo: { fontFamily: FONTS.family, fontSize: 11, color: COLORS.TEXT_MUTED, fontWeight: '500' },
  heroTeamScoreRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.BORDER,
  },
  heroTeamScoreText: { fontFamily: FONTS.family, fontSize: 13, fontWeight: '700', color: COLORS.TEXT, textAlign: 'right' },
  heroDateRow: { marginTop: 12, borderTopWidth: 1, borderTopColor: COLORS.BORDER, paddingTop: 10 },
  heroDateText: { fontFamily: FONTS.family, fontSize: 12, color: COLORS.TEXT_MUTED, textAlign: 'center' },

  // ── Secondary score bar (bowling team in live)
  secondaryScoreBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 16, marginTop: 8, paddingVertical: 8, paddingHorizontal: 10,
    backgroundColor: COLORS.BG,
  },
  secondaryScoreText: { fontFamily: FONTS.family, fontSize: 13, fontWeight: '600', color: COLORS.TEXT_SECONDARY },

  // ── Recent Overs section
  recentSection: { marginTop: 16 },
  sectionLabel: { fontFamily: FONTS.family, fontSize: 10, fontWeight: '700', color: COLORS.TEXT_MUTED, letterSpacing: 1.5, marginBottom: 10, paddingHorizontal: 16 },
  oversScroll: { paddingHorizontal: 16, alignItems: 'center', gap: 5 },
  overTag: { fontFamily: FONTS.family, fontSize: 10, fontWeight: '700', color: COLORS.TEXT_MUTED, marginRight: 2 },
  overSep: { width: 1, height: 20, backgroundColor: COLORS.BORDER_LIGHT, marginHorizontal: 4 },
  recentBallSm: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  recentBallSmText: { fontFamily: FONTS.family, fontSize: 10, fontWeight: '700' },

  // ── Mini Scorecard card
  miniCard: {
    backgroundColor: COLORS.BG, marginHorizontal: 16, marginTop: 10, overflow: 'hidden',
  },
  miniTHead: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 12,
    backgroundColor: COLORS.BG,
  },
  miniTh: { fontFamily: FONTS.family, width: 32, textAlign: 'right', fontSize: 9, fontWeight: '700', color: COLORS.TEXT_MUTED, letterSpacing: 0.5 },
  miniTRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 9, paddingHorizontal: 12,
  },
  miniPlayerBold: { fontFamily: FONTS.family, fontSize: 12, fontWeight: '700', color: COLORS.TEXT },
  miniPlayerMed: { fontFamily: FONTS.family, fontSize: 12, fontWeight: '500', color: COLORS.TEXT },
  miniTd: { fontFamily: FONTS.family, width: 32, textAlign: 'right', fontSize: 12, color: COLORS.TEXT_SECONDARY },
  miniTdBold: { fontFamily: FONTS.family, width: 32, textAlign: 'right', fontSize: 12, fontWeight: '700', color: COLORS.TEXT },
  miniTdLight: { fontFamily: FONTS.family, textAlign: 'right', fontSize: 12, color: COLORS.TEXT_MUTED },

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
  ptnrWicketNum: { fontFamily: FONTS.family, fontSize: 11, fontWeight: '800', color: COLORS.TEXT_MUTED },
  ptnrBarArea: { flex: 1 },
  ptnrPlayersRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  ptnrPlayerLeft: { flex: 1 },
  ptnrCenter: { alignItems: 'center', paddingHorizontal: 8, minWidth: 60 },
  ptnrPlayerRight: { flex: 1 },
  ptnrPlayerName: { fontFamily: FONTS.family, fontSize: 12, fontWeight: '700', color: COLORS.TEXT, lineHeight: 16 },
  ptnrPlayerStats: { fontFamily: FONTS.family, fontSize: 12, fontWeight: '600', color: COLORS.ACCENT_LIGHT, marginTop: 2 },
  ptnrTotalRuns: { fontFamily: FONTS.family, fontSize: 20, fontWeight: '900', color: COLORS.TEXT },
  ptnrTotalBalls: { fontFamily: FONTS.family, fontSize: 11, fontWeight: '500', color: COLORS.TEXT_MUTED },
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
  ptnrActiveText: { fontFamily: FONTS.family, fontSize: 8, fontWeight: '800', color: COLORS.LIVE },

  // Summary "Last Wicket" mini-card. Renamed from pshipCard to avoid a
  // name clash with the Partnerships style later in this stylesheet —
  // StyleSheet.create overrides earlier keys silently, which was making
  // the summary card inherit the partnerships row's bottom border.
  pshipRow: { flexDirection: 'row', gap: 12, marginHorizontal: 16, marginTop: 12 },
  lastWicketCard: {
    flex: 1, backgroundColor: COLORS.BG, padding: 10,
  },
  pshipLabel: { fontFamily: FONTS.family, fontSize: 10, fontWeight: '700', color: COLORS.TEXT_MUTED, letterSpacing: 0.5, marginBottom: 6 },
  pshipValue: { fontFamily: FONTS.family, fontSize: 18, fontWeight: '900', color: COLORS.TEXT },
  pshipWicketName: { fontFamily: FONTS.family, fontSize: 13, fontWeight: '700', color: COLORS.TEXT, marginBottom: 2 },
  pshipWicketScore: { fontFamily: FONTS.family, fontSize: 11, color: COLORS.TEXT_MUTED },

  // ── Cards (used by other tabs)
  // No outer border — rely on the card background to separate it from the page.
  // Keeps the scorecard tables feeling light and flat instead of boxy.
  card: {
    backgroundColor: COLORS.BG, marginHorizontal: 16, marginTop: 10, padding: 12,
  },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontFamily: FONTS.family, fontSize: 15, fontWeight: '700', color: COLORS.TEXT, marginBottom: 12 },

  // ── Recent Over
  recentOverRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  recentBall: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  recentBallText: { fontFamily: FONTS.family, fontSize: 11, fontWeight: '700' },


  // ── Toss
  tossCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 16, marginTop: 12, padding: 14,
    backgroundColor: COLORS.ACCENT_SOFT, borderRadius: 12, borderWidth: 1, borderColor: COLORS.ACCENT_SOFT_BORDER,
  },
  tossIcon: { fontFamily: FONTS.family, fontSize: 22 },
  tossLabel: { fontFamily: FONTS.family, fontSize: 9, fontWeight: '700', color: COLORS.TEXT_MUTED, letterSpacing: 1, marginBottom: 2 },
  tossText: { fontFamily: FONTS.family, fontSize: 13, fontWeight: '500', color: COLORS.TEXT },

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
  inningsTabText: { fontFamily: FONTS.family, fontSize: 13, color: COLORS.TEXT_MUTED, fontWeight: '600' },
  inningsTabTextActive: { color: COLORS.TEXT, fontWeight: '700' },

  // ── Run rate badge
  rrBadge: { backgroundColor: COLORS.ACCENT_SOFT, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  rrBadgeText: { fontFamily: FONTS.family, fontSize: 11, fontWeight: '700', color: PRIMARY },

  // ── Scorecard table
  // Flat look: no row dividers, soft zebra stripes on alternating rows,
  // muted header background. Reads like a proper table without feeling boxy.
  tableHeader: {
    flexDirection: 'row', paddingVertical: 8, paddingHorizontal: 8,
    backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 8, marginBottom: 2,
  },
  thCell: { fontFamily: FONTS.family, width: 38, textAlign: 'center', fontSize: 10, fontWeight: '700', color: COLORS.TEXT_MUTED, textTransform: 'uppercase', letterSpacing: 0.5 },
  thName: { flex: 1, textAlign: 'left', paddingLeft: 4 },
  tableRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 8,
    borderRadius: 6,
  },
  tableRowStripe: { backgroundColor: 'rgba(255,255,255,0.025)' },
  // Fall-of-Wickets column sizing — three evenly-balanced columns
  // (Batter : Score : Over = 2 : 1 : 1) so the number cells stay close to
  // the name instead of being pushed to the right edge.
  fowColName: { flex: 2, textAlign: 'left', paddingLeft: 4, width: undefined },
  fowColNum: { flex: 1, textAlign: 'center', width: undefined },
  tableRowHighlight: { backgroundColor: COLORS.ACCENT_SOFT },
  tdCell: { fontFamily: FONTS.family, width: 38, textAlign: 'center', fontSize: 13, color: COLORS.TEXT_SECONDARY },
  tdName: { flex: 1, textAlign: 'left', paddingLeft: 4 },
  tdBold: { fontWeight: '700', color: COLORS.TEXT },
  playerName: { fontFamily: FONTS.family, fontSize: 13, fontWeight: '600', color: COLORS.TEXT },
  howOut: { fontFamily: FONTS.family, fontSize: 11, color: COLORS.TEXT_MUTED, fontStyle: 'italic', marginTop: 2 },

  // Extras & Total — no border, just soft surface tone to separate from rows above.
  extrasRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 10, paddingHorizontal: 8, marginTop: 4,
    backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 6,
  },
  extrasLabel: { fontFamily: FONTS.family, fontSize: 13, color: COLORS.TEXT_MUTED, fontWeight: '500' },
  extrasValue: { fontFamily: FONTS.family, fontSize: 13, color: COLORS.TEXT_SECONDARY, fontWeight: '600' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 10, paddingHorizontal: 4 },
  totalLabel: { fontFamily: FONTS.family, fontSize: 14, fontWeight: '700', color: COLORS.TEXT },
  totalValue: { fontFamily: FONTS.family, fontSize: 14, fontWeight: '700', color: COLORS.TEXT },
  dnbText: { fontFamily: FONTS.family, fontSize: 11, color: COLORS.TEXT_MUTED, marginTop: 10, paddingHorizontal: 4, lineHeight: 16 },
  yetWrap: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.BORDER,
  },
  yetLabel: {
    fontFamily: FONTS.family,
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.TEXT_MUTED,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  yetNames: {
    fontFamily: FONTS.family,
    fontSize: 13,
    color: COLORS.TEXT_SECONDARY,
    lineHeight: 20,
  },
  pendingHero: {
    alignItems: 'center',
    paddingVertical: 22,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER,
  },
  pendingTitle: {
    fontFamily: FONTS.family,
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.TEXT,
    marginTop: 6,
    letterSpacing: -0.2,
  },
  pendingSub: {
    fontFamily: FONTS.family,
    fontSize: 12,
    color: COLORS.TEXT_MUTED,
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  capBadge: {
    fontFamily: FONTS.family, fontSize: 9, fontWeight: '800', color: COLORS.ACCENT,
    backgroundColor: 'rgba(30,136,229,0.15)', borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1,
    overflow: 'hidden', letterSpacing: 0.3,
  },
  vcBadge: {
    fontFamily: FONTS.family, fontSize: 9, fontWeight: '800', color: COLORS.WARNING,
    backgroundColor: 'rgba(245,158,11,0.15)', borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1,
    overflow: 'hidden', letterSpacing: 0.3,
  },
  wkBadge: {
    fontFamily: FONTS.family, fontSize: 9, fontWeight: '800', color: COLORS.SUCCESS_LIGHT,
    backgroundColor: 'rgba(34,197,94,0.15)', borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1,
    overflow: 'hidden', letterSpacing: 0.3,
  },
  capBadgeSm: {
    fontFamily: FONTS.family, fontSize: 8, fontWeight: '800', color: COLORS.ACCENT,
    backgroundColor: 'rgba(30,136,229,0.18)', borderRadius: 3, paddingHorizontal: 3, paddingVertical: 0,
    overflow: 'hidden', letterSpacing: 0.3, marginLeft: 2,
  },
  vcBadgeSm: {
    fontFamily: FONTS.family, fontSize: 8, fontWeight: '800', color: COLORS.WARNING,
    backgroundColor: 'rgba(245,158,11,0.18)', borderRadius: 3, paddingHorizontal: 3, paddingVertical: 0,
    overflow: 'hidden', letterSpacing: 0.3, marginLeft: 2,
  },
  wkBadgeSm: {
    fontFamily: FONTS.family, fontSize: 8, fontWeight: '800', color: COLORS.SUCCESS_LIGHT,
    backgroundColor: 'rgba(34,197,94,0.18)', borderRadius: 3, paddingHorizontal: 3, paddingVertical: 0,
    overflow: 'hidden', letterSpacing: 0.3, marginLeft: 2,
  },
  yetChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  yetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: COLORS.SURFACE,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    borderRadius: 14,
  },
  yetChipText: {
    fontFamily: FONTS.family,
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.TEXT_SECONDARY,
  },

  // ── Segmented innings pill with sliding indicator (matches tournament tab feel)
  segmentedWrap: { paddingHorizontal: 12, marginTop: 10 },
  segmented: {
    flexDirection: 'row',
    position: 'relative',
    backgroundColor: COLORS.SURFACE,
    borderRadius: 10,
    padding: 3,
    overflow: 'hidden',
  },
  segmentIndicator: {
    position: 'absolute',
    top: 3,
    left: 3,
    bottom: 3,
    backgroundColor: PRIMARY,
    borderRadius: 8,
    shadowColor: PRIMARY,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  segment: {
    flex: 1,
    paddingVertical: 7,
    paddingHorizontal: 8,
    alignItems: 'center',
    zIndex: 1,
  },
  segmentCompact: { fontFamily: FONTS.family, fontSize: 12, fontWeight: '700', color: COLORS.TEXT_MUTED, letterSpacing: 0.3, fontVariant: ['tabular-nums'] },
  segmentCompactActive: { color: '#fff', fontWeight: '900' },

  // ── Scorecard hero (innings total at the top of the tab)
  sHero: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.BG,
    marginHorizontal: 16,
    marginTop: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  sHeroLeft: { flex: 1 },
  sHeroTeam: { fontFamily: FONTS.family, fontSize: 13, fontWeight: '900', color: COLORS.TEXT, letterSpacing: 0.3 },
  sHeroOvers: { fontFamily: FONTS.family, fontSize: 10, fontWeight: '600', color: COLORS.TEXT_MUTED, marginTop: 3 },
  sHeroRight: { alignItems: 'flex-end' },
  sHeroScore: { fontFamily: FONTS.family, fontSize: 24, fontWeight: '900', color: COLORS.TEXT, fontVariant: ['tabular-nums'], lineHeight: 26 },
  sHeroWkts: { fontFamily: FONTS.family, color: COLORS.TEXT_SECONDARY, fontWeight: '700', fontSize: 18 },
  sHeroDeclared: { fontFamily: FONTS.family, color: COLORS.SUCCESS_LIGHT, fontWeight: '800', fontSize: 14, fontStyle: 'italic' },
  sHeroRR: { fontFamily: FONTS.family, fontSize: 11, fontWeight: '800', color: PRIMARY, marginTop: 2, letterSpacing: 0.4 },

  // ── Redesigned batting rows
  batRow: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginBottom: 2,
  },
  batRowStripe: { backgroundColor: 'rgba(255,255,255,0.02)' },
  batRowActive: { backgroundColor: COLORS.ACCENT_SOFT, borderWidth: 1, borderColor: COLORS.ACCENT_SOFT_BORDER },
  batShareBar: {
    position: 'absolute',
    left: 0,
    top: '20%',
    width: 3,
    borderRadius: 2,
    opacity: 0.9,
  },

  // ── Prominent total footer
  totalFooter: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.SURFACE_HIGHLIGHT || COLORS.SURFACE,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
  },
  totalFooterLeft: {},
  totalFooterLabel: { fontFamily: FONTS.family, fontSize: 11, fontWeight: '900', letterSpacing: 1.2, color: COLORS.TEXT_MUTED },
  totalFooterOvers: { fontFamily: FONTS.family, fontSize: 12, fontWeight: '600', color: COLORS.TEXT_SECONDARY, marginTop: 2 },
  totalFooterRight: { alignItems: 'flex-end' },
  totalFooterScore: { fontFamily: FONTS.family, fontSize: 22, fontWeight: '900', color: COLORS.TEXT, fontVariant: ['tabular-nums'] },
  totalFooterWkts: { color: COLORS.TEXT_SECONDARY, fontWeight: '700' },
  totalFooterRR: { fontFamily: FONTS.family, fontSize: 11, fontWeight: '700', color: PRIMARY, marginTop: 2, letterSpacing: 0.5 },

  // ── Partnerships (redesigned stacked bars)
  pshipCard: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER_LIGHT,
  },
  pshipHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 2,
    marginBottom: 8,
  },
  pshipWktChip: {
    backgroundColor: COLORS.SURFACE,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  pshipWktText: { fontFamily: FONTS.family, fontSize: 10, fontWeight: '900', color: COLORS.TEXT_SECONDARY, letterSpacing: 0.5 },
  pshipTotal: { fontFamily: FONTS.family, fontSize: 18, fontWeight: '900', color: COLORS.TEXT, fontVariant: ['tabular-nums'] },
  pshipBalls: { fontFamily: FONTS.family, fontSize: 12, fontWeight: '600', color: COLORS.TEXT_MUTED },
  pshipLiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.LIVE_BG,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  pshipLiveDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: COLORS.LIVE },
  pshipLiveText: { fontFamily: FONTS.family, fontSize: 9, fontWeight: '900', color: COLORS.LIVE, letterSpacing: 0.5 },
  pshipBestBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: COLORS.ACCENT_SOFT,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.ACCENT_SOFT_BORDER,
  },
  pshipBestText: { fontFamily: FONTS.family, fontSize: 9, fontWeight: '900', color: COLORS.ACCENT_LIGHT, letterSpacing: 0.5 },
  pshipBarTrack: {
    flexDirection: 'row',
    height: 10,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: COLORS.SURFACE,
    alignSelf: 'center',
    minWidth: '15%',
  },
  pshipBarSlice: {},
  pshipPlayersRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 10 },
  pshipPlayerName: { fontFamily: FONTS.family, fontSize: 12, fontWeight: '700' },
  pshipPlayerStat: { fontFamily: FONTS.family, fontSize: 11, color: COLORS.TEXT_SECONDARY, marginTop: 2, fontVariant: ['tabular-nums'] },

  // ── Fall of Wickets
  fowRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  fowChip: {
    backgroundColor: COLORS.ACCENT_SOFT, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
    borderWidth: 1, borderColor: COLORS.ACCENT_SOFT_BORDER, alignItems: 'center',
  },
  fowScore: { fontFamily: FONTS.family, fontSize: 12, fontWeight: '700', color: PRIMARY },
  fowPlayer: { fontFamily: FONTS.family, fontSize: 10, fontWeight: '600', color: COLORS.TEXT_SECONDARY, marginTop: 2 },
  fowOvers: { fontFamily: FONTS.family, fontSize: 10, color: COLORS.TEXT_MUTED, marginTop: 1 },

  // ── Commentary
  filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginTop: 12 },
  filterPill: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: COLORS.CARD, borderWidth: 1, borderColor: COLORS.BORDER,
  },
  filterPillActive: { backgroundColor: COLORS.ACCENT, borderColor: COLORS.ACCENT },
  filterPillText: { fontFamily: FONTS.family, fontSize: 12, fontWeight: '600', color: COLORS.TEXT },
  filterPillTextActive: { color: COLORS.TEXT },

  overHeader: { marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: COLORS.BORDER },
  overTitle: { fontFamily: FONTS.family, fontSize: 14, fontWeight: '700', color: COLORS.TEXT },
  overSummary: { fontFamily: FONTS.family, fontSize: 12, color: COLORS.TEXT_SECONDARY, fontWeight: '500', marginTop: 2 },
  overBallsRow: { flexDirection: 'row', gap: 5, marginTop: 8 },
  overBallCircle: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  overBallText: { fontFamily: FONTS.family, fontSize: 10, fontWeight: '700' },

  ballDetail: { flexDirection: 'row', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.BORDER },
  ballDetailWicket: { backgroundColor: COLORS.DANGER_SOFT, borderRadius: 8, marginVertical: 2, paddingHorizontal: 6 },
  ballNumCol: { width: 44, alignItems: 'center', gap: 4 },
  ballNum: { fontFamily: FONTS.family, fontSize: 11, fontWeight: '700', color: COLORS.TEXT_MUTED },
  ballDot: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  ballDotText: { fontFamily: FONTS.family, fontSize: 10, fontWeight: '700' },
  ballDescCol: { flex: 1, marginLeft: 8, justifyContent: 'center' },
  wicketLabel: { fontFamily: FONTS.family, fontSize: 11, fontWeight: '800', color: COLORS.LIVE, marginBottom: 2 },
  ballDescTitle: { fontFamily: FONTS.family, fontSize: 13, fontWeight: '600', color: COLORS.TEXT, marginBottom: 2 },
  ballDesc: { fontFamily: FONTS.family, fontSize: 12, color: COLORS.TEXT_SECONDARY, lineHeight: 18 },

  // ── Info tab
  infoSectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14,
  },
  infoSectionIcon: {
    width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.ACCENT + '15',
  },
  infoSectionTitle: { fontFamily: FONTS.family, fontSize: 15, fontWeight: '700', color: COLORS.TEXT },
  infoRow: { flexDirection: 'row', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.BORDER },
  infoLabel: { fontFamily: FONTS.family, width: 90, fontSize: 13, color: COLORS.TEXT_MUTED, fontWeight: '500' },
  infoValue: { fontFamily: FONTS.family, flex: 1, fontSize: 13, color: COLORS.TEXT, fontWeight: '500' },

  // ── Squads
  squadHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  squadBar: { width: 3, height: 20, borderRadius: 2 },
  squadRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.BORDER,
  },
  squadName: { fontFamily: FONTS.family, fontSize: 13, fontWeight: '600', color: COLORS.TEXT },
  squadRole: { fontFamily: FONTS.family, fontSize: 10, color: COLORS.TEXT_MUTED, marginTop: 1 },
  squadJersey: { fontFamily: FONTS.family, fontSize: 11, fontWeight: '600', color: COLORS.TEXT_MUTED },

  // ── Action button
  actionBtn: {
    backgroundColor: PRIMARY, borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', marginHorizontal: 16, marginTop: 16,
  },
  actionBtnText: { fontFamily: FONTS.family, color: COLORS.TEXT, fontSize: 16, fontWeight: '700' },

  // ── Empty state
  emptyState: { alignItems: 'center', paddingVertical: 48 },
  emptyIcon: { fontFamily: FONTS.family, fontSize: 40 },
  emptyTitle: { fontFamily: FONTS.family, fontSize: 16, fontWeight: '700', color: COLORS.TEXT, marginTop: 10 },
  emptyText: { fontFamily: FONTS.family, fontSize: 13, color: COLORS.TEXT_MUTED, marginTop: 6, fontWeight: '500' },

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
  pomBadgeText: { fontFamily: FONTS.family, fontSize: 11, fontWeight: '800', color: COLORS.GOLD, letterSpacing: 1.5 },
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
  pomName: { fontFamily: FONTS.family, fontSize: 16, fontWeight: '800', color: COLORS.TEXT, marginBottom: 6 },
  pomStatLine: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3, flexWrap: 'wrap' },
  pomStatVal: { fontFamily: FONTS.family, fontSize: 14, fontWeight: '800', color: COLORS.TEXT },
  pomStatLabel: { fontFamily: FONTS.family, fontSize: 11, fontWeight: '500', color: COLORS.TEXT_MUTED },
  pomStatDetail: { fontFamily: FONTS.family, fontSize: 11, fontWeight: '600', color: COLORS.TEXT_SECONDARY },

  /* Key Performers - CricHeroes style player cards */
  perfSection: { marginTop: 14 },
  perfSectionHead: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingHorizontal: 16, marginBottom: 10,
  },
  perfSectionTitle: { fontFamily: FONTS.family, fontSize: 15, fontWeight: '700', color: COLORS.TEXT },
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
  perfCardName: { fontFamily: FONTS.family, fontSize: 12, fontWeight: '700', color: COLORS.TEXT, textAlign: 'center' },
  perfCardTeam: { fontFamily: FONTS.family, fontSize: 10, color: COLORS.TEXT_MUTED, marginTop: 2, textAlign: 'center' },
  perfCardDivider: { width: 30, height: 1.5, backgroundColor: COLORS.BORDER, marginVertical: 8, borderRadius: 1 },
  perfCardMainStat: { fontFamily: FONTS.family, fontSize: 18, fontWeight: '900', color: COLORS.TEXT },
  perfCardStatUnit: { fontFamily: FONTS.family, fontSize: 11, fontWeight: '500', color: COLORS.TEXT_MUTED },
  perfCardSubStat: { fontFamily: FONTS.family, fontSize: 10, color: COLORS.TEXT_SECONDARY, marginTop: 2, textAlign: 'center' },

  /* Key Match Stats */
  keyStatsCard: {
    backgroundColor: COLORS.BG, marginHorizontal: 16, marginTop: 12,
    padding: 10,
  },
  keyStatsTitle: { fontFamily: FONTS.family, fontSize: 15, fontWeight: '800', color: COLORS.TEXT, marginBottom: 12 },
  keyStatsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 0 },
  keyStatItem: {
    width: '33.33%', alignItems: 'center', paddingVertical: 10,
  },
  keyStatValue: { fontFamily: FONTS.family, fontSize: 18, fontWeight: '900', color: COLORS.TEXT },
  keyStatLabel: { fontFamily: FONTS.family, fontSize: 10, fontWeight: '600', color: COLORS.TEXT_MUTED, marginTop: 3, textAlign: 'center' },

  thisOverCard: {
    marginHorizontal: 16, marginTop: 10, padding: 12,
    backgroundColor: COLORS.CARD, borderRadius: 12,
    borderWidth: 1, borderColor: COLORS.BORDER,
  },
  thisOverLabel: {
    fontFamily: FONTS.family, fontSize: 10, fontWeight: '800',
    color: COLORS.TEXT_MUTED, letterSpacing: 1, marginBottom: 8,
  },
  thisOverRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ballPill: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: COLORS.BORDER, backgroundColor: COLORS.SURFACE,
  },
  ballPillText: { fontFamily: FONTS.family, fontSize: 13, fontWeight: '800', color: COLORS.TEXT },
  ballPill_wicket:  { backgroundColor: 'rgba(229,57,53,0.18)',  borderColor: 'rgba(229,57,53,0.65)' },
  ballPill_four:    { backgroundColor: 'rgba(30,136,229,0.18)', borderColor: 'rgba(30,136,229,0.65)' },
  ballPill_six:     { backgroundColor: 'rgba(168,85,247,0.20)', borderColor: 'rgba(168,85,247,0.65)' },
  ballPill_dot:     { backgroundColor: COLORS.SURFACE,           borderColor: COLORS.BORDER },
  ballPill_extra:   { backgroundColor: 'rgba(245,158,11,0.18)', borderColor: 'rgba(245,158,11,0.55)' },
  ballPill_default: {},
  ballPillText_wicket:  { color: '#FF6B6B' },
  ballPillText_four:    { color: COLORS.ACCENT_LIGHT },
  ballPillText_six:     { color: '#C084FC' },
  ballPillText_dot:     { color: COLORS.TEXT_MUTED },
  ballPillText_extra:   { color: COLORS.WARNING_LIGHT },
  ballPillText_default: {},

  lastBallCard: {
    marginHorizontal: 16, marginTop: 10, padding: 14,
    backgroundColor: COLORS.CARD, borderRadius: 12,
    borderWidth: 1, borderColor: COLORS.BORDER,
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
  },
  lastBallCard_six:    { borderColor: 'rgba(168,85,247,0.65)', backgroundColor: 'rgba(168,85,247,0.06)' },
  lastBallCard_four:   { borderColor: 'rgba(30,136,229,0.55)', backgroundColor: 'rgba(30,136,229,0.05)' },
  lastBallCard_wicket: { borderColor: 'rgba(229,57,53,0.55)',  backgroundColor: 'rgba(229,57,53,0.05)' },
  lastBallTag: {
    fontFamily: FONTS.family, fontSize: 10, fontWeight: '900',
    color: COLORS.TEXT, letterSpacing: 1.2,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
    backgroundColor: COLORS.SURFACE, marginRight: 4,
    overflow: 'hidden',
  },
  lastBallTag_six:    { backgroundColor: 'rgba(168,85,247,0.22)', color: '#C084FC' },
  lastBallTag_four:   { backgroundColor: 'rgba(30,136,229,0.22)', color: COLORS.ACCENT_LIGHT },
  lastBallTag_wicket: { backgroundColor: 'rgba(229,57,53,0.22)',  color: '#FF6B6B' },
  lastBallQuote: { fontFamily: FONTS.family, fontSize: 22, fontWeight: '900', color: COLORS.ACCENT, lineHeight: 18 },
  lastBallText: { fontFamily: FONTS.family, flex: 1, fontSize: 13, color: COLORS.TEXT, fontStyle: 'italic', lineHeight: 18 },
});

export default MatchDetailScreen;
