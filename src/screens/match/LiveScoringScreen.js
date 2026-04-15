import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Modal, ActivityIndicator,
  Dimensions, Animated, InteractionManager, Platform, TextInput,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { scoringAPI, matchesAPI } from '../../services/api';
import matchWS from '../../services/websocket';
import { COLORS } from '../../theme';
import Icon from '../../components/Icon';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import CelebrationOverlay from '../../components/CelebrationOverlay';
import OfflineBanner from '../../components/OfflineBanner';
import InningsEndDialog from '../../components/InningsEndDialog';
import ConfirmModal from '../../components/ConfirmModal';
import { setCurrentMatch, clearCurrentMatch } from '../../services/notifications';
import { subscribeToMatch } from '../../services/notifications';

// Haptics removed — visual feedback only for smoother scoring UX

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// --- Animated press button for run scoring ---
const AnimatedPressButton = ({ onPress, style, children, activeOpacity = 0.7 }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  return (
    <TouchableOpacity
      activeOpacity={activeOpacity}
      onPress={onPress}
      onPressIn={() => Animated.spring(scaleAnim, { toValue: 0.93, useNativeDriver: true, speed: 50, bounciness: 4 }).start()}
      onPressOut={() => Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 50, bounciness: 4 }).start()}
      style={{ flex: style?.flex }}
    >
      <Animated.View style={[style, { transform: [{ scale: scaleAnim }] }]}>
        {children}
      </Animated.View>
    </TouchableOpacity>
  );
};

// --- Pulsing dot for next ball indicator ---
const PulsingDot = () => {
  const pulseAnim = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.4, duration: 800, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);
  return (
    <Animated.View style={[s.overBallCircle, s.overBallNext, { opacity: pulseAnim }]}>
      <View style={s.nextBallDot} />
    </Animated.View>
  );
};

// --- Ball color helper for over display ---
const getBallStyle = (ball) => {
  if (ball === 'W') return s.overBallWicket;
  if (ball === '4') return s.overBallFour;
  if (ball === '6') return s.overBallSix;
  if (ball === '0') return s.overBallDot;
  const ballStr = typeof ball === 'string' ? ball.toLowerCase() : '';
  if (ballStr.includes('wd') || ballStr.includes('nb') || ballStr.includes('wd') || ballStr.includes('lb') || ballStr.includes('bye')) return s.overBallExtra;
  return s.overBallDefault;
};

const getBallTextStyle = (ball) => {
  if (ball === 'W') return s.overBallTextWicket;
  if (ball === '4') return s.overBallTextFour;
  if (ball === '6') return s.overBallTextSix;
  if (ball === '0') return s.overBallTextDot;
  const ballStr = typeof ball === 'string' ? ball.toLowerCase() : '';
  if (ballStr.includes('wd') || ballStr.includes('nb') || ballStr.includes('lb') || ballStr.includes('bye')) return s.overBallTextExtra;
  return s.overBallTextDefault;
};

// --- Wicket type icons mapping ---
const WICKET_ICONS = {
  bowled: 'cricket',
  caught: 'hand-back-right',
  lbw: 'shoe-formal',
  run_out: 'run-fast',
  stumped: 'account-remove',
  hit_wicket: 'alert-circle',
};

const LiveScoringScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { matchId } = route.params;
  const [state, setState] = useState(null);
  const [matchData, setMatchData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [scoring, setScoring] = useState(false);
  const [showExtras, setShowExtras] = useState(false);
  const [showWide, setShowWide] = useState(false);
  const [showNoBall, setShowNoBall] = useState(false);
  const [showWicket, setShowWicket] = useState(false);
  const [showEndOver, setShowEndOver] = useState(false);
  const [wicketType, setWicketType] = useState('bowled');
  const [fielderId, setFielderId] = useState(null);
  const [newBatsmanId, setNewBatsmanId] = useState(null);
  const [wicketStep, setWicketStep] = useState(1); // 1=type, 2=fielder, 3=runOut details, 4=new batsman
  const [runOutRuns, setRunOutRuns] = useState(0); // runs completed before run out
  const [runOutDismissed, setRunOutDismissed] = useState('striker'); // 'striker' | 'non_striker'
  const [swapping, setSwapping] = useState(false);
  const [nextBowlerId, setNextBowlerId] = useState(null);
  const [bowlingSquad, setBowlingSquad] = useState([]);
  const [battingSquad, setBattingSquad] = useState([]);
  const [showInningsBreak, setShowInningsBreak] = useState(false);
  const [showSuperOverPrompt, setShowSuperOverPrompt] = useState(false);
  const [soBatFirst, setSoBatFirst] = useState(null); // legacy fallback (dialog now manages selection internally)
  const [showUndoConfirm, setShowUndoConfirm] = useState(false);
  const [undoLoading, setUndoLoading] = useState(false);
  const [reverting, setReverting] = useState(false);
  const [celebration, setCelebration] = useState(null); // 'four' | 'six' | 'wicket' | 'fifty' | 'hundred'
  const [showBroadcast, setShowBroadcast] = useState(false);
  const [broadcastText, setBroadcastText] = useState('');
  const [activeBroadcast, setActiveBroadcast] = useState(null);
  const [showNoResultModal, setShowNoResultModal] = useState(false);
  const [noResultReason, setNoResultReason] = useState('');
  const wsDebounce = useRef(null);

  // Removed haptic vibration — was distracting during fast scoring.
  // Visual feedback (button press animation + celebration overlay) is sufficient.

  const loadState = async () => {
    try {
      const [stateRes, matchRes] = await Promise.all([
        scoringAPI.liveState(matchId),
        matchesAPI.get(matchId),
      ]);
      setState(stateRes.data);
      setMatchData(matchRes.data);
    } catch (e) {
      Alert.alert('Error', 'Failed to load match state');
    } finally {
      setLoading(false);
    }
  };

  const loadBroadcast = async () => {
    try {
      const res = await scoringAPI.getBroadcast(matchId);
      setActiveBroadcast(res.data?.message || null);
    } catch {}
  };

  const sendBroadcast = async (msg) => {
    try {
      await scoringAPI.broadcast(matchId, msg);
      setActiveBroadcast(msg);
      setShowBroadcast(false);
      setBroadcastText('');
    } catch (e) {
      Alert.alert('Error', 'Failed to send message');
    }
  };

  const clearBroadcast = async () => {
    try {
      await scoringAPI.clearBroadcast(matchId);
      setActiveBroadcast(null);
    } catch {}
  };

  // When the match flips to completed (after the scorer confirms End Match),
  // bounce to the Scorecard automatically — there's nothing left to do here.
  useEffect(() => {
    if (state?.status === 'completed') {
      const t = setTimeout(() => navigation.replace('Scorecard', { matchId }), 50);
      return () => clearTimeout(t);
    }
  }, [state?.status, matchId, navigation]);

  useFocusEffect(useCallback(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      loadState();
      loadBroadcast();
    });
    matchWS.connect(matchId);
    setCurrentMatch(matchId);
    subscribeToMatch(matchId); // Auto-subscribe for push when not in app
    const unsub = matchWS.addListener((msg) => {
      if (msg.type === 'broadcast') {
        setActiveBroadcast(msg.data?.message || null);
      } else if (['delivery', 'over_end', 'innings_end', 'match_end'].includes(msg.type)) {
        if (!wsDebounce.current) {
          wsDebounce.current = setTimeout(() => { wsDebounce.current = null; loadState(); }, 500);
        }
      }
    });
    return () => { task.cancel(); unsub(); matchWS.disconnect(); clearCurrentMatch(); if (wsDebounce.current) { clearTimeout(wsDebounce.current); wsDebounce.current = null; } };
  }, [matchId]));

  const isCreator = user?.id === matchData?.created_by;

  const scoreDelivery = async (data) => {
    if (scoring || !isCreator || activeBroadcast) return;
    // Block scoring if over is complete but not ended — force bowler selection
    if ((state?.current_ball || 0) >= 6) {
      const inn = state?.innings_number || matchData?.current_innings || 1;
      const bowlTeam = state?.bowling_team_id || (inn % 2 === 1 ? matchData?.team_b_id : matchData?.team_a_id);
      if (bowlTeam) {
        try {
          const sqRes = await matchesAPI.getSquad(matchId, bowlTeam);
          setBowlingSquad(sqRes.data || []);
        } catch {}
      }
      setShowEndOver(true);
      return;
    }
    setScoring(true);

    // Optimistic UI update — immediately reflect expected state change
    const isExtra = data.extra_type === 'wide' || data.extra_type === 'noball';
    const runsToAdd = (data.batsman_runs || 0) + (data.extra_runs || 0) + (isExtra ? 1 : 0);
    const isLegalBall = !isExtra;
    setState(prev => {
      if (!prev) return prev;
      const newBall = isLegalBall ? (prev.current_ball || 0) + 1 : (prev.current_ball || 0);
      const overIncrement = newBall >= 6 ? 1 : 0;
      return {
        ...prev,
        total_runs: (prev.total_runs || 0) + runsToAdd,
        current_ball: overIncrement ? 0 : newBall,
        current_over: (prev.current_over || 0) + overIncrement,
        total_wickets: data.is_wicket ? (prev.total_wickets || 0) + 1 : (prev.total_wickets || 0),
        striker: prev.striker ? {
          ...prev.striker,
          runs: (prev.striker.runs || 0) + (data.batsman_runs || 0),
          balls: (prev.striker.balls || 0) + (isLegalBall ? 1 : 0),
        } : prev.striker,
      };
    });

    // Show celebration overlay immediately
    if (data.is_wicket) {
      setCelebration('wicket');
    } else if (data.is_six || data.batsman_runs === 6) {
      setCelebration('six');
    } else if (data.is_boundary || data.batsman_runs === 4) {
      setCelebration('four');
    }

    try {
      const res = await scoringAPI.score(matchId, data);
      if (res.data.innings_complete) {
        // The backend marks the innings as completed but never auto-completes
        // the match anymore. loadState() refetches and will pick up
        // innings_break=true so the InningsEndDialog renders consistently
        // for both 1st innings end, 2nd innings end (chase win or otherwise),
        // and super over end. Same code path for every flow.
        await loadState();
      } else if (res.data.over_complete) {
        // Load state first, then squads
        const liveRes = await scoringAPI.liveState(matchId);
        const newState = liveRes.data;
        setState(newState);
        // Load bowling squad — use live state team ID, fallback based on innings number
        const innNum = newState?.innings_number || matchData?.current_innings || 1;
        const bowlTeam = newState?.bowling_team_id || (innNum % 2 === 1 ? matchData?.team_b_id : matchData?.team_a_id);
        if (bowlTeam) {
          try {
            const sqRes = await matchesAPI.getSquad(matchId, bowlTeam);
            setBowlingSquad(sqRes.data || []);
          } catch {}
        }
        setShowEndOver(true);
      }
    } catch (e) {
      await loadState();
      Alert.alert('Error', e.response?.data?.detail || 'Scoring failed');
    } finally {
      setScoring(false);
    }
  };

  const loadSquads = async (overrideState = null) => {
    const s = overrideState || state;
    try {
      if (s?.bowling_team_id) {
        const res = await matchesAPI.getSquad(matchId, s.bowling_team_id);
        setBowlingSquad(res.data || []);
      }
      if (s?.batting_team_id) {
        const res = await matchesAPI.getSquad(matchId, s.batting_team_id);
        setBattingSquad(res.data || []);
      }
    } catch (e) {}
  };

  const handleEndOver = async () => {
    if (scoring) return;
    if (!nextBowlerId) return Alert.alert('Error', 'Select next bowler');
    setScoring(true);
    try {
      await scoringAPI.endOver(matchId, nextBowlerId);
      setShowEndOver(false);
      setNextBowlerId(null);
      await loadState();
    } catch (e) {
      Alert.alert('Error', e.response?.data?.detail || 'Failed');
    } finally {
      setScoring(false);
    }
  };

  const handleInningsEnd = async () => {
    if (scoring) return;
    setScoring(true);
    try {
      // Step 1: End current innings (safe — idempotent)
      try { await scoringAPI.endInnings(matchId); } catch (_) {}

      // Step 2: Get latest match state
      const matchRes = await matchesAPI.get(matchId);

      if (matchRes.data.status === 'completed') {
        navigation.replace('Scorecard', { matchId });
        return;
      }

      // Step 3: Count innings to decide next action
      const scorecard = await scoringAPI.scorecard(matchId);
      const allInnings = scorecard.data?.innings || [];
      const completedInnings = allInnings.length;
      const isSecond = completedInnings >= 2 && completedInnings % 2 === 0;

      if (isSecond) {
        // Both innings done — end match
        try {
          const endRes = await scoringAPI.endMatch(matchId);
          if (endRes?.data?.is_tied) {
            setSoBatFirst(null);
            setShowSuperOverPrompt(true);
            return;
          }
        } catch (e) {
          Alert.alert('Error', e.response?.data?.detail || 'Failed to end match');
          // Still navigate if match is completed in the meantime
          const check = await matchesAPI.get(matchId);
          if (check.data.status === 'completed') {
            navigation.replace('Scorecard', { matchId });
          }
          return;
        }
        navigation.replace('Scorecard', { matchId });
      } else {
        // First innings done — go to select openers for 2nd innings
        navigation.replace('SelectOpeners', {
          matchId,
          match: matchRes.data,
          teams: route.params.teams || [],
          isSuperOver: completedInnings >= 2,
        });
      }
    } catch (e) {
      Alert.alert('Error', e.response?.data?.detail || 'Failed to end innings');
    } finally {
      setScoring(false);
    }
  };

  // Called from the unified InningsEndDialog (tied mode) — receives the team
  // id chosen inside the dialog. Falls back to local soBatFirst if needed.
  const handleStartSuperOver = async (batFirstId) => {
    const teamId = batFirstId || soBatFirst;
    if (!teamId) {
      Alert.alert('Select Team', 'Choose which team bats first in the Super Over');
      return;
    }
    setShowSuperOverPrompt(false);
    try {
      const matchRes = await matchesAPI.get(matchId);
      navigation.replace('SelectOpeners', {
        matchId,
        match: matchRes.data,
        teams: route.params.teams || [],
        isSuperOver: true,
        soBatFirstId: teamId,
      });
    } catch (e) {
      Alert.alert('Error', 'Failed to start super over');
    }
  };

  const handleEndAsTie = async () => {
    setShowSuperOverPrompt(false);
    try {
      await scoringAPI.endMatchAsTie(matchId);
      navigation.replace('Scorecard', { matchId });
    } catch (e) {
      Alert.alert('Error', e.response?.data?.detail || 'Failed to end match');
    }
  };

  // Single end-match handler used by InningsEndDialog (2nd innings + super-over).
  // Calls end-innings (idempotent), then end-match. If the result comes back tied
  // (super over needed), opens the super-over prompt; otherwise navigates to scorecard.
  const handleEndMatchUnified = async () => {
    if (scoring) return;
    setScoring(true);
    try {
      try { await scoringAPI.endInnings(matchId); } catch (_) {}
      try {
        const endRes = await scoringAPI.endMatch(matchId);
        if (endRes?.data?.is_tied) {
          setSoBatFirst(null);
          setShowSuperOverPrompt(true);
          return;
        }
      } catch (e) {
        const msg = e.response?.data?.detail || 'Failed to end match';
        Alert.alert('Error', msg);
        if (msg.toLowerCase().includes('creator')) return;
      }
      navigation.replace('Scorecard', { matchId });
    } finally {
      setScoring(false);
    }
  };

  const handleStartSuperOverFromDialog = () => {
    setSoBatFirst(null);
    setShowSuperOverPrompt(true);
  };

  const handleEndMatchNoResult = () => {
    setNoResultReason('');
    setShowNoResultModal(true);
  };

  const confirmNoResult = async () => {
    const reason = noResultReason.trim();
    if (!reason || reason.length < 8) {
      Alert.alert('Reason Required', 'Please enter a reason (at least 8 characters).');
      return;
    }
    if (reason.length > 100) {
      Alert.alert('Too Long', 'Reason must be under 100 characters.');
      return;
    }
    setShowNoResultModal(false);
    try {
      await scoringAPI.noResult(matchId, reason);
      navigation.replace('Scorecard', { matchId });
    } catch (e) {
      Alert.alert('Error', e.response?.data?.detail || 'Failed to end match');
    }
  };

  // Open the themed undo confirm modal. The actual undo runs in
  // confirmUndo() once the user taps "Yes, Undo".
  const handleUndo = () => {
    if (!isCreator || scoring) return;
    setShowUndoConfirm(true);
  };

  const confirmUndo = async () => {
    setUndoLoading(true);
    setScoring(true);
    try {
      await scoringAPI.undo(matchId);
      const liveRes = await scoringAPI.liveState(matchId);
      const newState = liveRes.data;
      setState(newState);
      // After undo: if ball=0 and over > 0, we're at start of an over — need bowler selection
      if ((newState?.current_ball === 0 || newState?.current_ball === 6) && (newState?.current_over || 0) > 0) {
        const inn = newState?.innings_number || matchData?.current_innings || 1;
        const bowlTeam = newState?.bowling_team_id || (inn % 2 === 1 ? matchData?.team_b_id : matchData?.team_a_id);
        if (bowlTeam) {
          try {
            const sqRes = await matchesAPI.getSquad(matchId, bowlTeam);
            setBowlingSquad(sqRes.data || []);
          } catch {}
        }
        setShowEndOver(true);
      }
    } catch (e) {
      Alert.alert('Error', e.response?.data?.detail || 'Nothing to undo');
    } finally {
      setUndoLoading(false);
      setScoring(false);
      setShowUndoConfirm(false);
    }
  };

  const openWicketModal = () => {
    setWicketType('bowled');
    setFielderId(null);
    setNewBatsmanId(null);
    setWicketStep(1);
    setRunOutRuns(0);
    setRunOutDismissed('striker');
    loadSquads();
    setShowWicket(true);
  };

  const needsFielder = (type) => ['caught', 'stumped', 'run_out'].includes(type);

  const handleWicketNext = () => {
    const goNextAfterFielder = () => {
      if (wicketType === 'run_out') {
        setWicketStep(3); // run out details
      } else if (state?.total_wickets < 9) {
        setWicketStep(4);
      } else {
        confirmWicket();
      }
    };
    if (wicketStep === 1) {
      if (needsFielder(wicketType)) {
        setWicketStep(2);
      } else if (state?.total_wickets < 9) {
        setWicketStep(4);
      } else {
        confirmWicket();
      }
    } else if (wicketStep === 2) {
      goNextAfterFielder();
    } else if (wicketStep === 3) {
      if (state?.total_wickets < 9) {
        setWicketStep(4);
      } else {
        confirmWicket();
      }
    } else {
      confirmWicket();
    }
  };

  const confirmWicket = () => {
    const isRunOut = wicketType === 'run_out';
    const dismissedId = isRunOut
      ? (runOutDismissed === 'non_striker' ? state?.non_striker?.player_id : state?.striker?.player_id)
      : state?.striker?.player_id;
    const payload = {
      batsman_runs: isRunOut ? runOutRuns : 0,
      is_wicket: true,
      wicket_type: wicketType,
      dismissed_player_id: dismissedId,
    };
    if (fielderId) payload.fielder_id = fielderId;
    if (newBatsmanId) payload.new_batsman_id = newBatsmanId;
    scoreDelivery(payload);
    setShowWicket(false);
  };

  const handleSwapBatters = async () => {
    if (swapping || !isCreator || !state?.striker?.player_id || !state?.non_striker?.player_id) return;
    setSwapping(true);
    // Optimistic swap
    setState(prev => prev ? { ...prev, striker: prev.non_striker, non_striker: prev.striker } : prev);
    try {
      await scoringAPI.swapBatters(matchId);
    } catch (e) {
      // Revert on failure
      setState(prev => prev ? { ...prev, striker: prev.non_striker, non_striker: prev.striker } : prev);
      Alert.alert('Error', e.response?.data?.detail || 'Failed to swap batters');
    } finally {
      setSwapping(false);
    }
  };

  // Players available for next batsman (not already batting, not already dismissed)
  const availableBatsmen = useMemo(() => {
    const dismissedIds = state?.dismissed_player_ids || [];
    return battingSquad.filter(p => {
      const pid = p.player_id || p.id;
      return pid !== state?.striker?.player_id
        && pid !== state?.non_striker?.player_id
        && !dismissedIds.includes(pid);
    });
  }, [battingSquad, state?.dismissed_player_ids, state?.striker?.player_id, state?.non_striker?.player_id]);

  // --- Helper to get team names ---
  const battingTeamName = state?.batting_team_name || matchData?.team_a_name || 'TEAM A';
  const bowlingTeamName = state?.bowling_team_name || matchData?.team_b_name || 'TEAM B';

  // Memoize innings completion status (must be before early returns — Rules of Hooks)
  const isInningsComplete = useMemo(() => {
    const totalBalls = (state?.current_over || 0) * 6 + (state?.current_ball || 0);
    const isSuperOver = (state?.innings_number || 0) > 2;
    const maxBalls = (isSuperOver ? 1 : (matchData?.overs || 20)) * 6;
    const maxWickets = isSuperOver ? 1 : 10;
    return (state?.total_wickets || 0) >= maxWickets || totalBalls >= maxBalls || (state?.target && (state?.total_runs || 0) >= state?.target);
  }, [state?.current_over, state?.current_ball, state?.innings_number, state?.total_wickets, state?.total_runs, state?.target, matchData?.overs]);

  // Stable callbacks for run scoring buttons (must be before early returns)
  const scoreRun = useCallback((runs) => scoreDelivery({ batsman_runs: runs }), [state, matchData, scoring]);
  const scoreFour = useCallback(() => scoreDelivery({ batsman_runs: 4, is_boundary: true }), [state, matchData, scoring]);
  const scoreSix = useCallback(() => scoreDelivery({ batsman_runs: 6, is_six: true }), [state, matchData, scoring]);

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color={COLORS.ACCENT} /></View>;

  const handleRevertMatch = async () => {
    setReverting(true);
    try {
      await scoringAPI.revert(matchId);
      await loadState();
    } catch (e) {
      Alert.alert('Error', e.response?.data?.detail || 'Failed to revert');
    } finally {
      setReverting(false);
    }
  };

  // Reusable: the themed undo confirm modal — included in EVERY early-return
  // branch below so the user can always trigger Undo Last Ball, even when the
  // main scoring view is unmounted (innings break, super over prompt, etc.).
  const undoConfirmModal = (
    <ConfirmModal
      visible={showUndoConfirm}
      icon="undo-variant"
      title="Undo Last Ball?"
      message={'This will revert the most recent delivery — runs, wickets and over progress will be rolled back. You can always rescore it.'}
      confirmText="Yes, Undo"
      cancelText="Keep Score"
      destructive
      loading={undoLoading}
      onConfirm={confirmUndo}
      onCancel={() => setShowUndoConfirm(false)}
    />
  );

  // Super Over prompt — renders as full screen so it's not hidden by other early returns
  // Tied / Super Over prompt — uses the unified InningsEndDialog so the user
  // gets the same look + the type-to-confirm + Undo Last Ball + team picker
  // all in one place.
  if (showSuperOverPrompt) return (
    <>
      <InningsEndDialog
        variant="fullscreen"
        // Force tied mode by injecting is_tied=true
        state={{ ...state, is_tied: true }}
        matchData={matchData}
        isCreator={isCreator}
        scoring={scoring}
        onStartSuperOver={async (batFirstId) => {
          // Dialog passes the picked team id. handleStartSuperOver also closes the prompt.
          await handleStartSuperOver(batFirstId);
        }}
        onEndAsTie={handleEndAsTie}
        onUndoLastBall={handleUndo}
        onViewScorecard={() => navigation.navigate('Scorecard', { matchId })}
      />
      {undoConfirmModal}
    </>
  );

  // Match completed state — only reachable if the scorer explicitly confirmed
  // End Match (backend no longer auto-completes on chase win). At this point
  // the scoring journey is over: show a brief loader; the useEffect above
  // schedules the navigation to the Scorecard.
  if (state?.status === 'completed') {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={COLORS.ACCENT} />
        <Text style={{ fontSize: 14, color: COLORS.TEXT_MUTED, marginTop: 12, fontWeight: '600' }}>
          Match completed — opening scorecard…
        </Text>
      </View>
    );
  }

  // Innings break state — shown to BOTH admin and viewers.
  // Uses the unified InningsEndDialog so 1st innings, 2nd innings, super over,
  // and tied flows render through one consistent component.
  if (state?.innings_break) {
    return (
      <>
        <InningsEndDialog
          variant="fullscreen"
          state={state}
          matchData={matchData}
          isCreator={isCreator}
          scoring={scoring}
          onStartNextInnings={handleInningsEnd}
          onEndMatch={handleEndMatchUnified}
          onStartSuperOver={handleStartSuperOverFromDialog}
          onEndAsTie={handleEndAsTie}
          onUndoLastBall={handleUndo}
          onViewScorecard={() => navigation.navigate('MatchDetail', { matchId })}
        />
        {undoConfirmModal}
      </>
    );
  }

  if (!state || (state.message && !state.innings_number)) return (
    <View style={s.center}>
      <Text style={s.noMatch}>{state?.message || 'Match not started'}</Text>
      <TouchableOpacity onPress={() => navigation.replace('MatchDetail', { matchId })} style={{ marginTop: 20 }}>
        <Text style={{ fontSize: 15, color: COLORS.ACCENT, fontWeight: '600' }}>{'< Go to Match'}</Text>
      </TouchableOpacity>
    </View>
  );

  const runBtnSize = (SCREEN_WIDTH - 24 - 36) / 4; // 4 columns with gaps

  return (
    <View style={s.container}>
      {/* Offline indicator banner */}
      <OfflineBanner />

      {/* Celebration overlay for boundaries/wickets */}
      <CelebrationOverlay
        type={celebration}
        visible={!!celebration}
        onFinish={() => setCelebration(null)}
      />

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: insets.bottom + 16 }} showsVerticalScrollIndicator={false}>

        {/* ===== HEADER ===== */}
        <View style={[s.header, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={() => navigation.replace('MatchDetail', { matchId })} style={s.headerBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Icon name="back" size={22} />
          </TouchableOpacity>
          <View style={s.headerCenter}>
            <Text style={s.headerTitle}>{state?.innings_number > 2 ? 'Super Over' : 'Match Scoring'}</Text>
            <Text style={s.headerSubtitle}>LIVE: {battingTeamName.toUpperCase()} vs {bowlingTeamName.toUpperCase()}</Text>
          </View>
          <TouchableOpacity onPress={() => navigation.replace('MatchDetail', { matchId })} style={s.headerSettings} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Icon name="settings" size={20} />
          </TouchableOpacity>
        </View>

        {/* ===== CHASE INFO BAR (2nd innings) ===== */}
        {state.target != null && state.target > 0 && (
          <View style={s.chaseBar}>
            <View style={{ flex: 1 }}>
              <Text style={s.chaseBarText}>
                {state.remaining_runs > 0
                  ? `Need ${state.remaining_runs} run${state.remaining_runs !== 1 ? 's' : ''} from ${state.remaining_balls} ball${state.remaining_balls !== 1 ? 's' : ''}`
                  : 'Target reached!'}
              </Text>
              {state.dls_par != null && state.remaining_runs > 0 && (
                <Text style={s.chaseBarDLS}>
                  DLS Par: {state.dls_par} {state.total_runs > state.dls_par ? '(ahead)' : state.total_runs === state.dls_par ? '(on par)' : '(behind)'}
                </Text>
              )}
            </View>
            {state.required_rate != null && state.remaining_runs > 0 && (
              <Text style={s.chaseBarRR}>RRR: {state.required_rate}</Text>
            )}
          </View>
        )}

        {/* ===== SCORE DISPLAY HEADER ===== */}
        <View style={s.scoreHeader}>
          <View style={s.scoreHeaderMain}>
            <Text style={s.scoreHeaderTeam}>{battingTeamName.toUpperCase()}</Text>
            <View style={s.scoreHeaderRow}>
              <Text style={s.scoreHeaderScore}>{state.total_runs}/{state.total_wickets}</Text>
              <View style={s.oversBadge}>
                <Text style={s.oversBadgeText}>{state.total_overs} ov</Text>
              </View>
            </View>
          </View>
          <View style={s.scoreHeaderRates}>
            <View style={s.rateBox}>
              <Text style={s.rateLabel}>CRR</Text>
              <Text style={s.rateValue}>{state.run_rate || '0.00'}</Text>
            </View>
            {state.target != null && state.target > 0 && state.required_rate != null && (
              <View style={s.rateBox}>
                <Text style={s.rateLabelAccent}>RRR</Text>
                <Text style={s.rateValueAccent}>{state.required_rate}</Text>
              </View>
            )}
            {state.target != null && state.target > 0 && (
              <View style={s.rateBox}>
                <Text style={s.rateLabel}>REM</Text>
                <Text style={s.rateValue}>{state.remaining_balls || 0}b</Text>
              </View>
            )}
          </View>
        </View>

        {/* ===== BATTING CARD ===== */}
        <View style={s.card}>
          <View style={s.cardHeaderRow}>
            <Text style={s.cardHeaderLabel}>BATTING</Text>
            {state.target ? (
              <Text style={s.cardHeaderRight}>Target: {state.target}</Text>
            ) : null}
          </View>
          <View style={s.battingHeaderBar}>
            <Text style={s.battingHeaderBarText}>Batsman</Text>
            <Text style={s.battingHeaderBarText}>R (B)</Text>
          </View>
          {state.striker && (
            <View style={s.batsmanRow}>
              <View style={s.strikerDot} />
              <Text style={s.batsmanName}>{state.striker.name}</Text>
              <Text style={s.batsmanScore}>{state.striker.runs} ({state.striker.balls})</Text>
            </View>
          )}
          {state.non_striker && (
            <View style={s.batsmanRow}>
              <View style={s.nonStrikerDot} />
              <Text style={s.batsmanName}>{state.non_striker.name}</Text>
              <Text style={s.batsmanScore}>{state.non_striker.runs} ({state.non_striker.balls})</Text>
            </View>
          )}
          {isCreator && state.striker && state.non_striker && (
            <TouchableOpacity
              style={s.swapBattersBtn}
              onPress={handleSwapBatters}
              disabled={swapping}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons name="swap-horizontal" size={14} color={COLORS.ACCENT} />
              <Text style={s.swapBattersText}>SWAP BATTERS</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ===== BOWLING CARD ===== */}
        {state.bowler && (
          <View style={s.card}>
            <View style={s.cardHeaderRow}>
              <Text style={s.cardHeaderLabel}>BOWLING</Text>
              <Text style={s.cardHeaderRight}>Current Over</Text>
            </View>
            <View style={s.bowlerRow}>
              <Icon name="cricket" size={16} />
              <Text style={s.bowlerName}>{state.bowler.name}</Text>
              <Text style={s.bowlerStats}>
                {state.bowler.overs} - {state.bowler.maidens} - {state.bowler.runs} - {state.bowler.wickets}
              </Text>
            </View>
            {/* Current Over Balls — colored circles */}
            <View style={s.overBallsRow}>
              {(state.this_over || []).map((ball, i) => (
                <View key={i} style={[s.overBallCircle, getBallStyle(ball)]}>
                  <Text style={[s.overBallText, getBallTextStyle(ball)]}>{ball}</Text>
                </View>
              ))}
              {/* Pulsing dot for next ball */}
              {(state.this_over || []).length < 6 && <PulsingDot />}
            </View>
          </View>
        )}

        {/* ===== FREE HIT INDICATOR ===== */}
        {state.is_free_hit && (
          <View style={s.freeHitBadge}>
            <Text style={s.freeHitText}>FREE HIT - Only Run Out allowed</Text>
          </View>
        )}

        {/* ===== INNINGS COMPLETE BANNER (optimistic / stuck state recovery) =====
            Uses the same InningsEndDialog component as the full-screen page so
            the UX is identical regardless of whether we beat the backend's
            innings_break update or not. */}
        {isCreator && matchData && state && !showEndOver && !scoring && isInningsComplete && (
          <InningsEndDialog
            variant="banner"
            state={state}
            matchData={matchData}
            isCreator={isCreator}
            scoring={scoring}
            onStartNextInnings={handleInningsEnd}
            onEndMatch={handleEndMatchUnified}
            onStartSuperOver={handleStartSuperOverFromDialog}
            onEndAsTie={handleEndAsTie}
            onUndoLastBall={handleUndo}
            onViewScorecard={() => navigation.navigate('Scorecard', { matchId })}
          />
        )}

        {/* ===== SCORING BUTTONS (creator only, hidden when innings complete or broadcast active) ===== */}
        {isCreator && !isInningsComplete ? (
          <View style={[s.scoringSection, activeBroadcast && { opacity: 0.5 }]}>
            {/* Scoring overlay — blocks all buttons while saving */}
            {scoring && (
              <View style={s.scoringOverlay}>
                <View style={s.scoringOverlayContent}>
                  <ActivityIndicator size="small" color={COLORS.ACCENT} />
                  <Text style={s.scoringOverlayText}>Adding score...</Text>
                </View>
              </View>
            )}

            {/* Broadcast blocking overlay */}
            {activeBroadcast && (
              <View style={s.broadcastBlockOverlay}>
                <MaterialCommunityIcons name="bullhorn-outline" size={24} color={COLORS.WARNING} />
                <Text style={s.broadcastBlockTitle}>Scoring Paused</Text>
                <Text style={s.broadcastBlockText}>{activeBroadcast}</Text>
                <TouchableOpacity style={s.broadcastBlockBtn} onPress={clearBroadcast} activeOpacity={0.7}>
                  <Text style={s.broadcastBlockBtnText}>Clear Broadcast & Resume</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Row 1: 0, 1, 2, 3 — 4-column grid with visual feedback */}
            <View style={s.runRow}>
              {[
                { val: 0, label: 'Dot', btnStyle: s.runBtnDot },
                { val: 1, label: 'Run', btnStyle: null },
                { val: 2, label: 'Runs', btnStyle: null },
                { val: 3, label: 'Runs', btnStyle: null },
              ].map((item) => (
                <AnimatedPressButton
                  key={item.val}
                  style={[s.runBtn, { width: runBtnSize, height: runBtnSize }, item.btnStyle]}
                  onPress={() => scoreRun(item.val)}
                >
                  <Text style={[s.runBtnNumber, item.val === 0 && s.runBtnNumberDot]}>{item.val}</Text>
                  <Text style={[s.runBtnLabel, item.val === 0 && s.runBtnLabelDot]}>{item.label}</Text>
                </AnimatedPressButton>
              ))}
            </View>

            {/* Row 2: 4, 6 — 2-column with colored tints */}
            <View style={s.boundaryRow}>
              <AnimatedPressButton
                style={[s.boundaryBtn, s.boundaryBtnFour]}
                onPress={scoreFour}
              >
                <Text style={s.boundaryBtnNumberFour}>4</Text>
                <Text style={s.boundaryBtnLabelFour}>BOUNDARY</Text>
              </AnimatedPressButton>
              <AnimatedPressButton
                style={[s.boundaryBtn, s.boundaryBtnSix]}
                onPress={scoreSix}
              >
                <Text style={s.boundaryBtnNumberSix}>6</Text>
                <Text style={s.boundaryBtnLabelSix}>MAXIMUM</Text>
              </AnimatedPressButton>
            </View>

            {/* Row 3: Wide, No Ball, Bye/LB — 3-column */}
            <View style={s.extrasRow}>
              <TouchableOpacity
                style={s.extraBtn}
                activeOpacity={0.7}
                disabled={scoring}
                onPress={() => setShowWide(true)}
              >
                <Text style={s.extraBtnText}>WIDE</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.extraBtn}
                activeOpacity={0.7}
                disabled={scoring}
                onPress={() => setShowNoBall(true)}
              >
                <Text style={s.extraBtnText}>NO BALL</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.extraBtn}
                activeOpacity={0.7}
                disabled={scoring}
                onPress={() => setShowExtras(true)}
              >
                <Text style={s.extraBtnText}>BYE/LB</Text>
              </TouchableOpacity>
            </View>

            {/* Wicket Button */}
            <TouchableOpacity style={s.wicketBtn} activeOpacity={0.7} disabled={scoring} onPress={openWicketModal}>
              <MaterialCommunityIcons name="close-circle" size={18} color="#fff" />
              <Text style={s.wicketBtnText}>WICKET</Text>
            </TouchableOpacity>

            {/* Undo Button */}
            <TouchableOpacity style={s.undoBtn} activeOpacity={0.7} disabled={scoring} onPress={handleUndo}>
              <MaterialCommunityIcons name="undo" size={18} color="#fff" />
              <Text style={s.undoBtnText}>UNDO LAST BALL</Text>
            </TouchableOpacity>

            {/* Admin action row: Broadcast + No Result */}
            <View style={s.adminActionsRow}>
              <TouchableOpacity
                style={s.broadcastBtn}
                activeOpacity={0.7}
                onPress={() => { setBroadcastText(''); setShowBroadcast(true); }}
              >
                <MaterialCommunityIcons name="bullhorn" size={16} color={COLORS.WARNING} />
                <Text style={s.broadcastBtnText}>BROADCAST</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={s.noResultBtn}
                activeOpacity={0.7}
                onPress={handleEndMatchNoResult}
              >
                <MaterialCommunityIcons name="weather-pouring" size={16} color={COLORS.DANGER} />
                <Text style={s.noResultBtnText}>NO RESULT</Text>
              </TouchableOpacity>
            </View>

            {/* Active broadcast banner */}
            {activeBroadcast && (
              <View style={s.activeBroadcastBar}>
                <MaterialCommunityIcons name="bullhorn" size={14} color={COLORS.WARNING} />
                <Text style={s.activeBroadcastText} numberOfLines={2}>{activeBroadcast}</Text>
                <TouchableOpacity onPress={clearBroadcast} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <MaterialCommunityIcons name="close-circle" size={18} color={COLORS.TEXT_MUTED} />
                </TouchableOpacity>
              </View>
            )}

          </View>
        ) : (
          /* Viewer-only bottom section */
          <View style={s.viewerBottom}>
            <View style={s.viewerInfoBox}>
              <MaterialCommunityIcons name="television" size={24} color={COLORS.TEXT_MUTED} />
              <Text style={s.viewerInfoTitle}>Watching Live</Text>
              <Text style={s.viewerInfoSub}>Score updates automatically</Text>
            </View>
            <View style={s.viewerActions}>
              <TouchableOpacity style={s.viewerBtn} onPress={() => navigation.navigate('MatchDetail', { matchId })}>
                <Icon name="scorecard" size={16} />
                <Text style={s.viewerBtnText}>Scorecard</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.viewerBtn} onPress={() => navigation.navigate('MatchDetail', { matchId })}>
                <Icon name="info" size={16} />
                <Text style={s.viewerBtnText}>Match Info</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>

      {/* ===== EXTRAS MODAL (Bye/LB detail) ===== */}
      <Modal visible={showExtras} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <Text style={s.modalTitle}>Extras</Text>
            <View style={s.modalGrid}>
              {[
                { label: 'Bye (1)', type: 'bye', extra: 1 },
                { label: 'Leg Bye (1)', type: 'legbye', extra: 1 },
                { label: 'Bye (2)', type: 'bye', extra: 2 },
                { label: 'Leg Bye (2)', type: 'legbye', extra: 2 },
                { label: 'Bye (4)', type: 'bye', extra: 4 },
                { label: 'Leg Bye (4)', type: 'legbye', extra: 4 },
              ].map((ex, i) => (
                <TouchableOpacity key={i} style={s.modalExtraBtn} onPress={() => {
                  setShowExtras(false);
                  scoreDelivery({ extra_type: ex.type, extra_runs: ex.extra, batsman_runs: 0 });
                }}>
                  <Text style={s.modalExtraBtnText}>{ex.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={s.modalClose} onPress={() => setShowExtras(false)}>
              <Text style={s.modalCloseText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ===== WIDE MODAL ===== */}
      <Modal visible={showWide} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <Text style={s.modalTitle}>Wide Ball</Text>
            <Text style={s.modalSubtitle}>Wide = 1 run + any extra runs (byes)</Text>
            <View style={s.modalGrid}>
              {[
                { label: 'Wide', extra: 0, desc: '1 run' },
                { label: 'Wide + 1', extra: 1, desc: '2 runs' },
                { label: 'Wide + 2', extra: 2, desc: '3 runs' },
                { label: 'Wide + 3', extra: 3, desc: '4 runs' },
                { label: 'Wide + 4 (Boundary)', extra: 4, desc: '5 runs' },
              ].map((item, i) => (
                <TouchableOpacity key={i} style={s.modalExtraBtn} onPress={() => {
                  setShowWide(false);
                  scoreDelivery({ extra_type: 'wide', extra_runs: item.extra, batsman_runs: 0 });
                }}>
                  <Text style={s.modalExtraBtnText}>{item.label}</Text>
                  <Text style={s.modalExtraDesc}>{item.desc}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={s.modalClose} onPress={() => setShowWide(false)}>
              <Text style={s.modalCloseText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ===== NO BALL MODAL ===== */}
      <Modal visible={showNoBall} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <Text style={s.modalTitle}>No Ball</Text>
            <Text style={s.modalSubtitle}>No Ball = 1 run + batsman runs</Text>
            <View style={s.modalGrid}>
              {[
                { label: 'No Ball', batsmanRuns: 0, extra: 0, boundary: false, six: false, desc: '1 run' },
                { label: 'NB + 1 Run', batsmanRuns: 1, extra: 0, boundary: false, six: false, desc: '2 runs' },
                { label: 'NB + 2 Runs', batsmanRuns: 2, extra: 0, boundary: false, six: false, desc: '3 runs' },
                { label: 'NB + 3 Runs', batsmanRuns: 3, extra: 0, boundary: false, six: false, desc: '4 runs' },
                { label: 'NB + 4 (Boundary)', batsmanRuns: 4, extra: 0, boundary: true, six: false, desc: '5 runs' },
                { label: 'NB + 6 (Six)', batsmanRuns: 6, extra: 0, boundary: false, six: true, desc: '7 runs' },
              ].map((item, i) => (
                <TouchableOpacity key={i} style={s.modalExtraBtn} onPress={() => {
                  setShowNoBall(false);
                  scoreDelivery({
                    extra_type: 'noball',
                    batsman_runs: item.batsmanRuns,
                    extra_runs: item.extra,
                    is_boundary: item.boundary,
                    is_six: item.six,
                  });
                }}>
                  <Text style={s.modalExtraBtnText}>{item.label}</Text>
                  <Text style={s.modalExtraDesc}>{item.desc}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={s.modalClose} onPress={() => setShowNoBall(false)}>
              <Text style={s.modalCloseText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ===== WICKET MODAL (Multi-step) ===== */}
      <Modal visible={showWicket} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            {/* Step 1: Wicket Type with icons */}
            {wicketStep === 1 && (
              <>
                <Text style={s.modalTitle}>Wicket Type</Text>
                <Text style={s.modalSubtitle}>
                  {wicketType === 'run_out' ? 'Select end in next step' : `Dismissed: ${state?.striker?.name || 'Batsman'}`}
                </Text>
                <View style={s.wicketTypeGrid}>
                  {['bowled', 'caught', 'lbw', 'run_out', 'stumped', 'hit_wicket'].map((wt) => (
                    <TouchableOpacity key={wt} style={[s.wicketTypeBtn, wicketType === wt && s.wicketTypeBtnActive]} onPress={() => setWicketType(wt)}>
                      <MaterialCommunityIcons
                        name={WICKET_ICONS[wt] || 'cricket'}
                        size={24}
                        color={wicketType === wt ? COLORS.TEXT : COLORS.TEXT_SECONDARY}
                      />
                      <Text style={[s.wicketTypeBtnText, wicketType === wt && s.wicketTypeBtnTextActive]}>
                        {wt.replace('_', ' ')}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TouchableOpacity style={s.confirmBtn} onPress={handleWicketNext}>
                  <Text style={s.confirmBtnText}>
                    {needsFielder(wicketType) ? 'Next: Select Fielder' : state?.total_wickets < 9 ? 'Next: Select Batsman' : 'Confirm Wicket'}
                  </Text>
                </TouchableOpacity>
              </>
            )}

            {/* Step 2: Fielder Selection with avatars */}
            {wicketStep === 2 && (
              <>
                <Text style={s.modalTitle}>
                  {wicketType === 'caught' ? 'Caught By' : wicketType === 'stumped' ? 'Stumped By' : 'Fielder'}
                </Text>
                <Text style={s.modalSubtitle}>
                  {state?.striker?.name} - {wicketType.replace('_', ' ')}
                </Text>
                <ScrollView style={{ maxHeight: 300 }}>
                  {bowlingSquad.map((p) => {
                    const pid = p.player_id || p.id;
                    const initials = (p.full_name || p.first_name || '?').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
                    return (
                      <TouchableOpacity key={pid} style={[s.playerOption, fielderId === pid && s.playerOptionActive]} onPress={() => setFielderId(pid)}>
                        <View style={[s.playerAvatar, fielderId === pid && s.playerAvatarActive]}>
                          <Text style={[s.playerAvatarText, fielderId === pid && s.playerAvatarTextActive]}>{initials}</Text>
                        </View>
                        <Text style={[s.playerOptionText, fielderId === pid && { fontWeight: '700' }]}>
                          {p.full_name || p.first_name}
                        </Text>
                        {fielderId === pid && <Icon name="check" size={16} color={COLORS.SUCCESS} />}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
                <TouchableOpacity style={s.confirmBtn} onPress={handleWicketNext}>
                  <Text style={s.confirmBtnText}>
                    {wicketType === 'run_out' ? 'Next: Run Out Details' : state?.total_wickets < 9 ? 'Next: Select Batsman' : 'Confirm Wicket'}
                  </Text>
                </TouchableOpacity>
              </>
            )}

            {/* Step 3: Run Out Details — runs completed + which batsman out */}
            {wicketStep === 3 && (
              <>
                <Text style={s.modalTitle}>Run Out Details</Text>
                <Text style={s.modalSubtitle}>Runs completed before run out</Text>
                <View style={s.runOutRunsRow}>
                  {[0, 1, 2, 3].map((r) => (
                    <TouchableOpacity
                      key={r}
                      style={[s.runOutRunBtn, runOutRuns === r && s.runOutRunBtnActive]}
                      onPress={() => setRunOutRuns(r)}
                    >
                      <Text style={[s.runOutRunBtnText, runOutRuns === r && s.runOutRunBtnTextActive]}>{r}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={[s.modalSubtitle, { marginTop: 16 }]}>Who is out?</Text>
                <View style={s.runOutEndCol}>
                  <TouchableOpacity
                    style={[s.runOutEndBtn, runOutDismissed === 'striker' && s.runOutEndBtnActive]}
                    onPress={() => setRunOutDismissed('striker')}
                  >
                    <View style={s.strikerDot} />
                    <Text style={[s.runOutEndBtnText, runOutDismissed === 'striker' && s.runOutEndBtnTextActive]}>
                      {state?.striker?.name || 'Striker'} (Striker)
                    </Text>
                    {runOutDismissed === 'striker' && <Icon name="check" size={16} color={COLORS.SUCCESS} />}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.runOutEndBtn, runOutDismissed === 'non_striker' && s.runOutEndBtnActive]}
                    onPress={() => setRunOutDismissed('non_striker')}
                  >
                    <View style={s.nonStrikerDot} />
                    <Text style={[s.runOutEndBtnText, runOutDismissed === 'non_striker' && s.runOutEndBtnTextActive]}>
                      {state?.non_striker?.name || 'Non-striker'} (Non-striker)
                    </Text>
                    {runOutDismissed === 'non_striker' && <Icon name="check" size={16} color={COLORS.SUCCESS} />}
                  </TouchableOpacity>
                </View>
                <TouchableOpacity style={s.confirmBtn} onPress={handleWicketNext}>
                  <Text style={s.confirmBtnText}>
                    {state?.total_wickets < 9 ? 'Next: Select Batsman' : 'Confirm Wicket'}
                  </Text>
                </TouchableOpacity>
              </>
            )}

            {/* Step 4: New Batsman Selection with batting order */}
            {wicketStep === 4 && (
              <>
                <Text style={s.modalTitle}>New Batsman</Text>
                <Text style={s.modalSubtitle}>
                  {(wicketType === 'run_out' && runOutDismissed === 'non_striker' ? state?.non_striker?.name : state?.striker?.name)} out - {wicketType.replace('_', ' ')}
                  {fielderId ? ` by ${bowlingSquad.find(p => (p.player_id || p.id) === fielderId)?.full_name || ''}` : ''}
                  {wicketType === 'run_out' && runOutRuns > 0 ? ` (${runOutRuns} run${runOutRuns > 1 ? 's' : ''} completed)` : ''}
                </Text>
                <ScrollView style={{ maxHeight: 300 }}>
                  {availableBatsmen.map((p, idx) => {
                    const pid = p.player_id || p.id;
                    const initials = (p.full_name || p.first_name || '?').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
                    return (
                      <TouchableOpacity key={pid} style={[s.playerOption, newBatsmanId === pid && s.playerOptionActive]} onPress={() => setNewBatsmanId(pid)}>
                        <View style={[s.playerAvatar, newBatsmanId === pid && s.playerAvatarActive]}>
                          <Text style={[s.playerAvatarText, newBatsmanId === pid && s.playerAvatarTextActive]}>{initials}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <View style={s.battingOrderBadge}>
                              <Text style={s.battingOrderText}>#{idx + 1}</Text>
                            </View>
                            <Text style={[s.playerOptionText, { flex: 0 }, newBatsmanId === pid && { fontWeight: '700' }]}>
                              {p.full_name || p.first_name}
                            </Text>
                          </View>
                          {p.role && <Text style={s.playerRole}>{p.role.replace('_', ' ')}</Text>}
                        </View>
                        {newBatsmanId === pid && <Icon name="check" size={16} color={COLORS.SUCCESS} />}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
                <TouchableOpacity
                  style={[s.confirmBtn, !newBatsmanId && { opacity: 0.5 }]}
                  onPress={newBatsmanId ? confirmWicket : null}
                  disabled={!newBatsmanId}
                >
                  <Text style={s.confirmBtnText}>Confirm Wicket</Text>
                </TouchableOpacity>
              </>
            )}

            <TouchableOpacity style={s.modalClose} onPress={() => setShowWicket(false)}>
              <Text style={s.modalCloseText}>Cancel</Text>
            </TouchableOpacity>
            {wicketStep > 1 && (
              <TouchableOpacity style={s.modalClose} onPress={() => {
                let prev = wicketStep - 1;
                // Skip step 3 (run out details) if not run_out
                if (prev === 3 && wicketType !== 'run_out') prev = 2;
                // Skip step 2 (fielder) if wicket doesn't need one
                if (prev === 2 && !needsFielder(wicketType)) prev = 1;
                setWicketStep(prev);
              }}>
                <Text style={[s.modalCloseText, { color: COLORS.ACCENT }]}>{'< Back'}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>

      {/* ===== END OVER MODAL with over summary ===== */}
      <Modal visible={showEndOver} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            {/* Over Summary */}
            <Text style={s.modalTitle}>Over Complete</Text>
            <View style={s.overSummaryBox}>
              <View style={s.overSummaryStats}>
                <View style={s.overSummaryStat}>
                  <Text style={s.overSummaryStatValue}>
                    {(state?.this_over || []).reduce((sum, b) => {
                      const n = parseInt(b, 10);
                      return sum + (isNaN(n) ? (b === 'W' ? 0 : 1) : n);
                    }, 0)}
                  </Text>
                  <Text style={s.overSummaryStatLabel}>Runs</Text>
                </View>
                <View style={s.overSummaryStat}>
                  <Text style={s.overSummaryStatValue}>
                    {(state?.this_over || []).filter(b => b === 'W').length}
                  </Text>
                  <Text style={s.overSummaryStatLabel}>Wickets</Text>
                </View>
                <View style={s.overSummaryStat}>
                  <Text style={s.overSummaryStatValue}>
                    {(state?.this_over || []).filter(b => {
                      const bs = typeof b === 'string' ? b.toLowerCase() : '';
                      return bs.includes('wd') || bs.includes('nb') || bs.includes('lb') || bs.includes('bye');
                    }).length}
                  </Text>
                  <Text style={s.overSummaryStatLabel}>Extras</Text>
                </View>
              </View>
              <View style={s.overSummaryBalls}>
                {(state?.this_over || []).map((ball, i) => (
                  <View key={i} style={[s.overBallCircle, getBallStyle(ball)]}>
                    <Text style={[s.overBallText, getBallTextStyle(ball)]}>{ball}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Bowler Selection */}
            <Text style={[s.modalTitle, { fontSize: 16, marginTop: 16 }]}>Select Next Bowler</Text>
            {bowlingSquad.length === 0 && (
              <Text style={{ color: COLORS.TEXT_MUTED, fontSize: 13, textAlign: 'center', padding: 10 }}>Loading bowlers...</Text>
            )}
            <ScrollView style={{ maxHeight: 250 }}>
              {bowlingSquad
                .filter((p) => p.player_id !== (state?.bowler?.player_id || state?.current_bowler_id))
                .map((p, idx) => (
                <TouchableOpacity key={`${p.player_id}-${idx}`} style={[s.bowlerOption, nextBowlerId === p.player_id && s.bowlerOptionActive]} onPress={() => setNextBowlerId(p.player_id)}>
                  <Text style={s.bowlerOptionText}>{p.full_name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={s.confirmBtn} onPress={handleEndOver}>
              <Text style={s.confirmBtnText}>Start Next Over</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ===== INNINGS BREAK MODAL =====
          Now uses the unified InningsEndDialog. Triggered manually by the
          inline banner's "Innings Break" tap (1st innings only). */}
      <InningsEndDialog
        variant="modal"
        visible={showInningsBreak}
        state={state}
        matchData={matchData}
        isCreator={isCreator}
        scoring={scoring}
        onStartNextInnings={() => { setShowInningsBreak(false); handleInningsEnd(); }}
        onEndMatch={async () => { setShowInningsBreak(false); await handleEndMatchUnified(); }}
        onStartSuperOver={() => { setShowInningsBreak(false); handleStartSuperOverFromDialog(); }}
        onEndAsTie={async () => { setShowInningsBreak(false); await handleEndAsTie(); }}
        onUndoLastBall={async () => { setShowInningsBreak(false); await handleUndo(); }}
        onViewScorecard={() => { setShowInningsBreak(false); navigation.navigate('Scorecard', { matchId }); }}
        onClose={() => setShowInningsBreak(false)}
      />

      {/* The standalone "End Match" confirmation modal was removed —
          end-match now flows through the inline banner / fullscreen dialog
          which already includes the type-to-confirm step via InningsEndDialog. */}

      {/* ===== UNDO LAST BALL CONFIRM ===== */}
      {undoConfirmModal}

      {/* ===== BROADCAST MESSAGE MODAL ===== */}
      <Modal visible={showBroadcast} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <MaterialCommunityIcons name="bullhorn" size={22} color={COLORS.WARNING} />
              <Text style={s.modalTitle}>Broadcast Message</Text>
            </View>
            <Text style={{ fontSize: 12, color: COLORS.TEXT_MUTED, marginBottom: 12 }}>
              This message will be shown as a banner to all viewers watching this match.
            </Text>
            <TextInput
              style={s.broadcastInput}
              placeholder="e.g. Innings Break, Rain Delay, Drinks..."
              placeholderTextColor={COLORS.TEXT_MUTED}
              value={broadcastText}
              onChangeText={setBroadcastText}
              maxLength={200}
              multiline
              autoFocus
            />
            <Text style={{ fontSize: 11, color: COLORS.TEXT_MUTED, alignSelf: 'flex-end', marginBottom: 12 }}>
              {broadcastText.length}/200
            </Text>
            {/* Quick presets */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
              {['Innings Break', 'Rain Delay', 'Drinks Break', 'Strategic Timeout', 'Bad Light'].map((preset) => (
                <TouchableOpacity
                  key={preset}
                  style={s.broadcastPreset}
                  onPress={() => setBroadcastText(preset)}
                >
                  <Text style={s.broadcastPresetText}>{preset}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={[s.confirmBtn, !broadcastText.trim() && { opacity: 0.4 }]}
              disabled={!broadcastText.trim()}
              onPress={() => sendBroadcast(broadcastText.trim())}
            >
              <Text style={s.confirmBtnText}>Send Broadcast</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ marginTop: 12, alignSelf: 'center' }} onPress={() => setShowBroadcast(false)}>
              <Text style={{ fontSize: 14, color: COLORS.TEXT_MUTED, fontWeight: '600' }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── No Result / Abandon Modal ── */}
      <Modal visible={showNoResultModal} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <MaterialCommunityIcons name="weather-pouring" size={22} color={COLORS.DANGER} />
              <Text style={s.modalTitle}>Abandon Match</Text>
            </View>
            <Text style={{ fontSize: 13, color: COLORS.TEXT_SECONDARY, marginBottom: 4, lineHeight: 19 }}>
              This will end the match with <Text style={{ fontWeight: '700', color: COLORS.DANGER }}>No Result</Text>.
              {matchData?.tournament_id
                ? ' Both teams will receive 1 shared point in the tournament standings.'
                : ''}
            </Text>
            <Text style={{ fontSize: 12, color: COLORS.TEXT_MUTED, marginBottom: 14 }}>
              You can revert this from the Scorecard screen if done by mistake.
            </Text>

            <Text style={{ fontSize: 13, fontWeight: '600', color: COLORS.TEXT_SECONDARY, marginBottom: 8 }}>
              Reason <Text style={{ color: COLORS.DANGER }}>*</Text> <Text style={{ fontWeight: '400', color: COLORS.TEXT_MUTED }}>(min 8 characters)</Text>
            </Text>
            <TextInput
              style={s.broadcastInput}
              placeholder="e.g. Rain stopped play"
              placeholderTextColor={COLORS.TEXT_MUTED}
              value={noResultReason}
              onChangeText={setNoResultReason}
              maxLength={100}
              autoFocus
            />
            <Text style={{ fontSize: 11, color: noResultReason.trim().length < 8 ? COLORS.DANGER : COLORS.TEXT_MUTED, alignSelf: 'flex-end', marginBottom: 12 }}>
              {noResultReason.trim().length}/100 {noResultReason.trim().length < 8 ? '(min 8)' : ''}
            </Text>

            {/* Quick presets */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
              {['Rain stopped play', 'Bad light stopped play', 'Ground unfit', 'Match abandoned', 'Disturbance on ground'].map((preset) => (
                <TouchableOpacity
                  key={preset}
                  style={s.broadcastPreset}
                  onPress={() => setNoResultReason(preset)}
                >
                  <Text style={s.broadcastPresetText}>{preset}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[s.confirmBtn, { backgroundColor: COLORS.DANGER }, noResultReason.trim().length < 8 && { opacity: 0.4 }]}
              disabled={noResultReason.trim().length < 8}
              onPress={confirmNoResult}
            >
              <Text style={s.confirmBtnText}>Confirm Abandon</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ marginTop: 12, alignSelf: 'center' }} onPress={() => setShowNoResultModal(false)}>
              <Text style={{ fontSize: 14, color: COLORS.TEXT_MUTED, fontWeight: '600' }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </View>
  );
};

/* ============================================================
   STYLES — Figma "Admin Match Scoring" design system
   Primary: COLORS.ACCENT, Background: #f6f8f6
   ============================================================ */
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.BG },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.BG },
  noMatch: { fontSize: 16, color: COLORS.COMPLETED },

  /* ---- Header ---- */
  header: {
    backgroundColor: COLORS.CARD,
    paddingBottom: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER,
  },
  headerBack: { padding: 4, marginRight: 12 },
  headerBackIcon: { fontSize: 22, color: COLORS.TEXT, fontWeight: '600' },
  headerCenter: { flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: COLORS.TEXT },
  headerSubtitle: { fontSize: 11, fontWeight: '700', color: COLORS.ACCENT, marginTop: 2, letterSpacing: 0.5 },
  headerSettings: { padding: 4, marginLeft: 12 },
  headerSettingsIcon: { fontSize: 22, color: COLORS.TEXT_SECONDARY },

  /* ---- Score Display Header (prominent) ---- */
  scoreHeader: {
    backgroundColor: COLORS.CARD,
    marginHorizontal: 12,
    marginTop: 14,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  scoreHeaderMain: {
    alignItems: 'center',
    marginBottom: 12,
  },
  scoreHeaderTeam: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.ACCENT_LIGHT,
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  scoreHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  scoreHeaderScore: {
    fontSize: 42,
    fontWeight: '900',
    color: COLORS.TEXT,
    letterSpacing: -1,
  },
  oversBadge: {
    backgroundColor: COLORS.SURFACE,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  oversBadgeText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.TEXT_SECONDARY,
  },
  scoreHeaderRates: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    borderTopWidth: 1,
    borderTopColor: COLORS.BORDER,
    paddingTop: 12,
  },
  rateBox: {
    alignItems: 'center',
  },
  rateLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.TEXT_MUTED,
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  rateLabelAccent: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.ACCENT_LIGHT,
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  rateValue: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.TEXT,
  },
  rateValueAccent: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.ACCENT_LIGHT,
  },

  /* ---- Batting Card ---- */
  card: {
    backgroundColor: COLORS.CARD,
    marginHorizontal: 12,
    marginTop: 10,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 8,
  },
  cardHeaderLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.TEXT,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  cardHeaderRight: { fontSize: 12, fontWeight: '600', color: COLORS.TEXT_SECONDARY },

  battingHeaderBar: {
    backgroundColor: 'rgba(19, 236, 19, 0.05)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  battingHeaderBarText: { fontSize: 10, fontWeight: '600', color: COLORS.TEXT_MUTED, textTransform: 'uppercase' },

  batsmanRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.SURFACE,
  },
  strikerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.ACCENT,
    marginRight: 10,
  },
  nonStrikerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: COLORS.ACCENT,
    backgroundColor: 'transparent',
    marginRight: 10,
  },
  batsmanName: { flex: 1, fontSize: 14, fontWeight: '600', color: COLORS.TEXT },
  batsmanScore: { fontSize: 14, fontWeight: '700', color: COLORS.TEXT },

  /* ---- Bowling Card ---- */
  bowlerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bowlerIcon: { fontSize: 16, marginRight: 8 },
  bowlerName: { flex: 1, fontSize: 14, fontWeight: '600', color: COLORS.TEXT },
  bowlerStats: { fontSize: 13, fontWeight: '600', color: COLORS.TEXT_SECONDARY },

  overBallsRow: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingBottom: 12,
    paddingTop: 4,
    gap: 6,
  },
  overBallCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overBallDot: { backgroundColor: '#444444' },
  overBallDefault: { backgroundColor: COLORS.SURFACE, borderWidth: 1.5, borderColor: COLORS.BORDER_LIGHT },
  overBallFour: { backgroundColor: 'rgba(76,175,80,0.25)', borderWidth: 1.5, borderColor: COLORS.SUCCESS },
  overBallSix: { backgroundColor: 'rgba(30,136,229,0.25)', borderWidth: 1.5, borderColor: COLORS.ACCENT },
  overBallWicket: { backgroundColor: COLORS.RED },
  overBallExtra: { backgroundColor: 'rgba(255,152,0,0.25)', borderWidth: 1.5, borderColor: COLORS.WARNING },
  overBallNext: { backgroundColor: COLORS.SURFACE, borderWidth: 2, borderColor: COLORS.BORDER_LIGHT, borderStyle: 'dashed' },
  nextBallDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.TEXT_MUTED },
  overBallText: { fontSize: 11, fontWeight: '700' },
  overBallTextDot: { color: '#999999' },
  overBallTextDefault: { color: COLORS.TEXT },
  overBallTextFour: { color: COLORS.SUCCESS },
  overBallTextSix: { color: COLORS.ACCENT_LIGHT },
  overBallTextWicket: { color: '#FFFFFF' },
  overBallTextExtra: { color: COLORS.WARNING },

  /* ---- Scoring Section ---- */
  scoringSection: { paddingHorizontal: 12, paddingTop: 14 },
  scoringOverlay: {
    ...StyleSheet.absoluteFillObject, zIndex: 50,
    backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  scoringOverlayContent: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: COLORS.CARD, paddingHorizontal: 24, paddingVertical: 14,
    borderRadius: 12, borderWidth: 1, borderColor: COLORS.BORDER,
  },
  scoringOverlayText: { fontSize: 14, fontWeight: '600', color: COLORS.TEXT },

  /* Run buttons row: 0, 1, 2, 3 */
  runRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  runBtn: {
    backgroundColor: COLORS.CARD,
    borderWidth: 2,
    borderColor: COLORS.BORDER,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    aspectRatio: 1,
  },
  runBtnDot: {
    backgroundColor: '#333333',
    borderColor: '#555555',
  },
  runBtnNumber: { fontSize: 28, fontWeight: '700', color: COLORS.TEXT },
  runBtnNumberDot: { color: '#999999' },
  runBtnLabel: { fontSize: 10, fontWeight: '600', color: COLORS.TEXT_MUTED, marginTop: 2, textTransform: 'uppercase' },
  runBtnLabelDot: { color: '#777777' },

  /* Boundary row: 4, 6 */
  boundaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 10,
  },
  boundaryBtn: {
    flex: 1,
    borderWidth: 2,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  boundaryBtnFour: {
    backgroundColor: 'rgba(76,175,80,0.12)',
    borderColor: 'rgba(76,175,80,0.4)',
  },
  boundaryBtnSix: {
    backgroundColor: 'rgba(30,136,229,0.12)',
    borderColor: 'rgba(30,136,229,0.4)',
  },
  boundaryBtnNumberFour: { fontSize: 28, fontWeight: '700', color: COLORS.SUCCESS },
  boundaryBtnLabelFour: { fontSize: 10, fontWeight: '700', color: COLORS.SUCCESS, marginTop: 2, letterSpacing: 0.5 },
  boundaryBtnNumberSix: { fontSize: 28, fontWeight: '700', color: COLORS.ACCENT_LIGHT },
  boundaryBtnLabelSix: { fontSize: 10, fontWeight: '700', color: COLORS.ACCENT_LIGHT, marginTop: 2, letterSpacing: 0.5 },

  /* Extras row: Wide, No Ball, Bye/LB */
  extrasRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 10,
  },
  extraBtn: {
    flex: 1,
    backgroundColor: COLORS.SURFACE,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  extraBtnText: { fontSize: 11, fontWeight: '700', color: COLORS.TEXT_SECONDARY, letterSpacing: 0.3 },

  /* Wicket button */
  wicketBtn: {
    backgroundColor: COLORS.RED,
    borderRadius: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    shadowColor: COLORS.RED,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  wicketBtnIcon: { fontSize: 16, marginRight: 8 },
  wicketBtnText: { fontSize: 15, fontWeight: '700', color: COLORS.TEXT, letterSpacing: 0.5 },

  /* Undo button */
  undoBtn: {
    backgroundColor: COLORS.SURFACE,
    borderRadius: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  undoBtnIcon: { fontSize: 16, color: COLORS.TEXT, marginRight: 8 },
  undoBtnText: { fontSize: 15, fontWeight: '700', color: COLORS.TEXT, letterSpacing: 0.5 },

  /* ---- Broadcast ---- */
  adminActionsRow: {
    flexDirection: 'row', gap: 8, marginTop: 10,
  },
  broadcastBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 12, borderRadius: 12,
    borderWidth: 1, borderColor: COLORS.WARNING + '40', backgroundColor: COLORS.WARNING + '10',
  },
  broadcastBtnText: { fontSize: 11, fontWeight: '700', color: COLORS.WARNING, letterSpacing: 0.3 },
  noResultBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 12, borderRadius: 12,
    borderWidth: 1, borderColor: COLORS.DANGER + '40', backgroundColor: COLORS.DANGER + '10',
  },
  noResultBtnText: { fontSize: 11, fontWeight: '700', color: COLORS.DANGER, letterSpacing: 0.3 },
  broadcastBlockOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: COLORS.BG + 'F0', zIndex: 10,
    alignItems: 'center', justifyContent: 'center', padding: 24, borderRadius: 16,
  },
  broadcastBlockTitle: { fontSize: 18, fontWeight: '800', color: COLORS.WARNING, marginTop: 12 },
  broadcastBlockText: { fontSize: 14, color: COLORS.TEXT_SECONDARY, marginTop: 8, textAlign: 'center', lineHeight: 20 },
  broadcastBlockBtn: {
    marginTop: 20, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12,
    backgroundColor: COLORS.WARNING, alignItems: 'center',
  },
  broadcastBlockBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  activeBroadcastBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10,
    paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10,
    backgroundColor: COLORS.WARNING + '15', borderWidth: 1, borderColor: COLORS.WARNING + '30',
  },
  activeBroadcastText: { flex: 1, fontSize: 13, fontWeight: '600', color: COLORS.WARNING },
  broadcastInput: {
    backgroundColor: COLORS.SURFACE, borderRadius: 12, padding: 14,
    fontSize: 15, color: COLORS.TEXT, borderWidth: 1, borderColor: COLORS.BORDER,
    minHeight: 56, textAlignVertical: 'top',
  },
  broadcastPreset: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
    backgroundColor: COLORS.SURFACE, borderWidth: 1, borderColor: COLORS.BORDER,
  },
  broadcastPresetText: { fontSize: 12, fontWeight: '600', color: COLORS.TEXT_SECONDARY },

  /* ---- Viewer bottom ---- */
  viewerBottom: { paddingHorizontal: 20, paddingTop: 40 },
  viewerInfoBox: { alignItems: 'center', marginBottom: 30 },
  viewerInfoIcon: { fontSize: 40 },
  viewerInfoTitle: { fontSize: 18, fontWeight: '700', color: COLORS.TEXT, marginTop: 12 },
  viewerInfoSub: { fontSize: 13, color: COLORS.TEXT_MUTED, marginTop: 4 },
  viewerActions: { flexDirection: 'row', justifyContent: 'center', gap: 16 },
  viewerBtn: {
    backgroundColor: COLORS.CARD, borderRadius: 14, padding: 20, alignItems: 'center', minWidth: 120,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  viewerBtnIcon: { fontSize: 28 },
  viewerBtnText: { fontSize: 13, fontWeight: '600', color: COLORS.TEXT, marginTop: 6 },

  /* ---- Modals ---- */
  modalOverlay: { flex: 1, backgroundColor: COLORS.OVERLAY, justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: COLORS.CARD, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, paddingBottom: 40,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: COLORS.TEXT, marginBottom: 16 },
  modalGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  modalExtraBtn: {
    paddingHorizontal: 16, paddingVertical: 14, borderRadius: 12,
    backgroundColor: COLORS.SURFACE, borderWidth: 1, borderColor: COLORS.BORDER,
  },
  modalExtraBtnActive: { backgroundColor: COLORS.ACCENT, borderColor: COLORS.ACCENT },
  modalExtraBtnText: { fontSize: 14, fontWeight: '600', color: COLORS.TEXT },
  modalExtraDesc: { fontSize: 11, color: COLORS.TEXT_MUTED, marginTop: 2 },
  confirmBtn: {
    backgroundColor: COLORS.ACCENT, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 16, minHeight: 48,
  },
  confirmBtnText: { color: COLORS.TEXT, fontSize: 15, fontWeight: '700' },
  modalClose: { alignItems: 'center', marginTop: 12 },
  modalCloseText: { color: COLORS.TEXT_MUTED, fontSize: 14, fontWeight: '600' },

  bowlerOption: {
    paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: COLORS.SURFACE,
  },
  bowlerOptionActive: { backgroundColor: COLORS.SUCCESS_BG },
  bowlerOptionText: { fontSize: 15, color: COLORS.TEXT, fontWeight: '500' },

  modalSubtitle: { fontSize: 14, color: COLORS.TEXT_SECONDARY, marginBottom: 12 },
  checkMark: { fontSize: 18, color: COLORS.ACCENT, fontWeight: '700' },
  playerRole: { fontSize: 11, color: COLORS.TEXT_MUTED, marginTop: 2, textTransform: 'capitalize' },

  /* ---- Run Out Details ---- */
  runOutRunsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  runOutRunBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    backgroundColor: COLORS.SURFACE,
    alignItems: 'center',
  },
  runOutRunBtnActive: {
    backgroundColor: COLORS.ACCENT,
    borderColor: COLORS.ACCENT,
  },
  runOutRunBtnText: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.TEXT_SECONDARY,
  },
  runOutRunBtnTextActive: {
    color: COLORS.TEXT,
  },
  runOutEndCol: {
    gap: 10,
    marginTop: 4,
  },
  runOutEndBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    backgroundColor: COLORS.SURFACE,
  },
  runOutEndBtnActive: {
    borderColor: COLORS.ACCENT,
    backgroundColor: COLORS.SUCCESS_BG,
  },
  runOutEndBtnText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.TEXT_SECONDARY,
  },
  runOutEndBtnTextActive: {
    color: COLORS.TEXT,
  },
  swapBattersBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    marginTop: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    backgroundColor: COLORS.SURFACE,
  },
  swapBattersText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.ACCENT,
    letterSpacing: 0.5,
  },

  /* ---- Wicket Type Grid ---- */
  wicketTypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  wicketTypeBtn: {
    width: '30%',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: COLORS.SURFACE,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  wicketTypeBtnActive: {
    backgroundColor: 'rgba(239,68,68,0.15)',
    borderColor: COLORS.RED,
  },
  wicketTypeBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.TEXT_SECONDARY,
    textTransform: 'capitalize',
  },
  wicketTypeBtnTextActive: {
    color: COLORS.TEXT,
    fontWeight: '700',
  },

  /* ---- Player Option with Avatar ---- */
  playerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.SURFACE,
  },
  playerOptionActive: {
    backgroundColor: COLORS.SUCCESS_BG,
  },
  playerOptionText: {
    flex: 1,
    fontSize: 15,
    color: COLORS.TEXT,
    fontWeight: '500',
  },
  playerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.SURFACE,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 1.5,
    borderColor: COLORS.BORDER_LIGHT,
  },
  playerAvatarActive: {
    backgroundColor: COLORS.SUCCESS_BG,
    borderColor: COLORS.SUCCESS,
  },
  playerAvatarText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.TEXT_SECONDARY,
  },
  playerAvatarTextActive: {
    color: COLORS.SUCCESS,
  },
  battingOrderBadge: {
    backgroundColor: COLORS.ACCENT_SOFT,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginRight: 8,
  },
  battingOrderText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.ACCENT_LIGHT,
  },

  /* ---- Over Summary (End Over Modal) ---- */
  overSummaryBox: {
    backgroundColor: COLORS.SURFACE,
    borderRadius: 12,
    padding: 14,
    marginBottom: 4,
  },
  overSummaryStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 12,
  },
  overSummaryStat: {
    alignItems: 'center',
  },
  overSummaryStatValue: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.TEXT,
  },
  overSummaryStatLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.TEXT_MUTED,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 2,
  },
  overSummaryBalls: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },

  /* ---- Chase Info Bar ---- */
  chaseBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.WARNING_BG,
    marginHorizontal: 12,
    marginTop: 10,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: COLORS.WARNING,
  },
  chaseBarText: { fontSize: 14, fontWeight: '700', color: COLORS.WARNING },
  chaseBarDLS: { fontSize: 11, fontWeight: '600', color: COLORS.TEXT_SECONDARY, marginTop: 3 },
  chaseBarRR: { fontSize: 13, fontWeight: '700', color: COLORS.WARNING },

  /* ---- Free Hit Badge ---- */
  freeHitBadge: {
    backgroundColor: COLORS.LIVE_BG,
    marginHorizontal: 12,
    marginTop: 8,
    borderRadius: 8,
    paddingVertical: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.LIVE,
  },
  freeHitText: { fontSize: 13, fontWeight: '700', color: COLORS.LIVE },
});

export default LiveScoringScreen;
