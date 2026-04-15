/**
 * InningsEndDialog
 * ─────────────────
 * Single source of truth for the end-of-innings / end-of-match UI.
 *
 * Replaces 4 previously divergent paths in LiveScoringScreen:
 *   1. <Modal showInningsBreak />        — manual "I'm done with this innings"
 *   2. <Modal showMatchEndConfirm />     — manual "End match" with code confirmation
 *   3. Inline "Innings Complete" banner  — optimistic local check
 *   4. Full-screen state.innings_break   — backend-authoritative branch
 *
 * One component → one consistent UX → one code path to debug.
 *
 * Modes (auto-detected from props):
 *   • "innings_break_1"   → 1st innings done   → primary: Start 2nd Innings
 *   • "innings_break_2"   → 2nd innings done   → primary: End Match (with type-to-confirm)
 *   • "tied"              → Match tied         → primary: Start Super Over (no undo)
 *   • "super_over_break"  → SO innings done    → primary: End Match
 *
 * Always offers (except "tied"):
 *   • Undo Last Ball (Wrong Entry)  — secondary
 *   • View Scorecard                — tertiary
 *
 * Render variants:
 *   • variant="modal"      → centered modal card (used for manual triggers)
 *   • variant="fullscreen" → centered full-screen card (used when state.innings_break is true)
 *   • variant="banner"     → inline banner inside scoring screen (optimistic state)
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, TextInput, ActivityIndicator,
  Animated, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, GRADIENTS } from '../theme';

const isSecondInningsOfPair = (inningsNumber) => (inningsNumber || 1) % 2 === 0;

/**
 * Pure helper — derive the dialog mode from match state.
 * Exported for testing and so callers can decide whether to render at all.
 *
 * Modes:
 *   • tied             → 2nd innings done with equal scores → super over decision
 *   • super_over_break → 2nd innings of a super over done → end match
 *   • innings_break_2  → 2nd main innings done → end match
 *   • innings_break_1  → 1st innings done → start 2nd innings
 *
 * NOTE: a "fully completed" match (status='completed') still resolves to
 * innings_break_2 / super_over_break here — that way, if the scorer closes
 * the app and reopens it, they still get the same End Match + Undo Last Ball
 * popup with the type-to-confirm input, instead of a different "match over"
 * screen. End-match is idempotent on the backend, so re-confirming is safe.
 */
export const getInningsEndMode = (state) => {
  if (!state) return null;
  if (state.is_tied === true) return 'tied';
  const isSo = state.is_super_over || (state.innings_number || 0) > 2;
  const isSecond = isSecondInningsOfPair(state.innings_number);
  if (isSo && isSecond) return 'super_over_break';
  return isSecond ? 'innings_break_2' : 'innings_break_1';
};

const TITLE_BY_MODE = {
  innings_break_1: 'Innings Break',
  innings_break_2: 'Innings Complete',
  super_over_break: 'Super Over Complete',
  tied: 'Match Tied!',
};

const ICON_BY_MODE = {
  innings_break_1: 'tea',                  // tea-time / break feel
  innings_break_2: 'trophy-variant',       // winner trophy
  super_over_break: 'lightning-bolt-circle',
  tied: 'lightning-bolt',
};

const PRIMARY_LABEL = {
  innings_break_1: 'Start 2nd Innings',
  innings_break_2: 'End Match',
  super_over_break: 'End Match',
  tied: 'Start Super Over',
};

// Gradient palette for the hero icon, derived from theme.
// Blue for "in progress" (1st innings break),
// amber for "decision moment" (end match / tie / super over).
const HERO_GRADIENT = {
  innings_break_1: ['rgba(30,136,229,0.32)', 'rgba(30,136,229,0.04)'],
  innings_break_2: ['rgba(255,152,0,0.32)', 'rgba(255,152,0,0.04)'],
  super_over_break: ['rgba(255,152,0,0.32)', 'rgba(255,152,0,0.04)'],
  tied: ['rgba(255,152,0,0.32)', 'rgba(255,152,0,0.04)'],
};

const HERO_BORDER = {
  innings_break_1: 'rgba(30,136,229,0.45)',
  innings_break_2: 'rgba(255,152,0,0.45)',
  super_over_break: 'rgba(255,152,0,0.45)',
  tied: 'rgba(255,152,0,0.45)',
};

const HERO_ICON_COLOR = {
  innings_break_1: COLORS.ACCENT_LIGHT,
  innings_break_2: COLORS.WARNING,
  super_over_break: COLORS.WARNING,
  tied: COLORS.WARNING,
};

const InningsEndDialog = ({
  state,
  matchData,
  isCreator,
  scoring,

  variant = 'fullscreen',  // 'fullscreen' | 'modal' | 'banner'
  visible = true,          // only used for variant='modal'

  onStartNextInnings,
  onEndMatch,
  onStartSuperOver,
  onEndAsTie,
  onUndoLastBall,
  onViewScorecard,
  onClose,
}) => {
  const insets = useSafeAreaInsets();
  const mode = getInningsEndMode(state);
  const [confirmText, setConfirmText] = useState('');
  // Tied-mode: which team bats first in the super over
  const [tiedBatFirst, setTiedBatFirst] = useState(null);

  // Entrance animation — for modal + banner variants
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.92)).current;

  useEffect(() => {
    if (variant === 'modal' && !visible) {
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.92);
      return;
    }
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 70, friction: 9 }),
    ]).start();
  }, [visible, variant, mode]);

  // Reset transient state whenever the dialog (re-)opens or mode changes
  useEffect(() => {
    if (visible) {
      setConfirmText('');
      setTiedBatFirst(null);
    }
  }, [visible, mode]);

  if (!mode || !state) return null;
  if (variant === 'modal' && !visible) return null;

  // Type-to-confirm rules — applied consistently regardless of run count so
  // the user sees the same dialog every time:
  //  • Starting 2nd innings (innings_break_1)         → ALWAYS require
  //  • End match (innings_break_2 / super_over_break) → ALWAYS require
  //  • Starting Super Over (tied)                     → ALWAYS require
  const requiresConfirmation =
    mode === 'innings_break_1' ||
    mode === 'innings_break_2' ||
    mode === 'super_over_break' ||
    mode === 'tied';
  const matchCode = (matchData?.match_code || String(matchData?.id || '')).toUpperCase();
  const confirmOk = !requiresConfirmation || (confirmText.trim().toUpperCase() === matchCode);
  // Tied flow extra gate: must pick a team to bat first before super over starts
  const tiedReady = mode !== 'tied' || tiedBatFirst != null;

  const heroGradient = HERO_GRADIENT[mode];
  const heroBorder = HERO_BORDER[mode];
  const heroIcon = ICON_BY_MODE[mode];
  const heroIconColor = HERO_ICON_COLOR[mode];
  const title = TITLE_BY_MODE[mode];
  const battingTeamName = state.batting_team_name || matchData?.team_a_name || 'Team';

  // Subtitle text varies by mode. For end-of-match modes (innings_break_2 /
  // super_over_break) we prefer the result_summary if the backend has
  // already computed it (i.e. user reopened the app on a finished match).
  const subtitle = (() => {
    if (mode === 'tied') return 'Both teams scored the same — Super Over decides the winner';
    if (mode === 'innings_break_1') return 'First innings complete. Get ready for the chase.';
    if (mode === 'innings_break_2' || mode === 'super_over_break') {
      return state.result_summary || 'All done. Confirm to lock in the result.';
    }
    return state.message || `Innings ${state.innings_number || ''} completed`.trim();
  })();

  // Primary action handler
  const handlePrimary = () => {
    if (mode === 'innings_break_1') return onStartNextInnings && onStartNextInnings();
    if (mode === 'innings_break_2' || mode === 'super_over_break') {
      if (!confirmOk) return;
      return onEndMatch && onEndMatch();
    }
    if (mode === 'tied') {
      if (!confirmOk || !tiedReady) return;
      return onStartSuperOver && onStartSuperOver(tiedBatFirst);
    }
    return null;
  };

  // Undo is now offered everywhere — including on a tied result, so the
  // scorer can revert a wrong final ball before the Super Over begins.
  const showUndo = true;

  // ── Inner content (shared across all variants) ─────────────────────────
  const Content = (
    <Animated.View
      style={[
        styles.card,
        variant === 'banner' && styles.cardBanner,
        {
          opacity: fadeAnim,
          transform: [{ scale: scaleAnim }],
        },
      ]}
    >
      {/* Subtle gradient overlay across the top of the card for depth */}
      <LinearGradient
        colors={['rgba(30,136,229,0.10)', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.cardGlow}
        pointerEvents="none"
      />

      {/* Close (X) — only on modal variant */}
      {variant === 'modal' && onClose && (
        <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <MaterialCommunityIcons name="close" size={18} color={COLORS.TEXT_MUTED} />
        </TouchableOpacity>
      )}

      {/* Hero icon — gradient ring + glow */}
      <View style={styles.heroWrap}>
        <LinearGradient colors={heroGradient} style={[styles.heroRing, { borderColor: heroBorder }]}>
          <View style={styles.heroInner}>
            <MaterialCommunityIcons
              name={heroIcon}
              size={variant === 'banner' ? 30 : 40}
              color={heroIconColor}
            />
          </View>
        </LinearGradient>
      </View>

      {/* Title + subtitle */}
      <Text style={[styles.title, variant === 'banner' && styles.titleBanner]}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>

      {/* Score box — gradient + accent bar.
          For tied mode we show "Both teams scored: X" instead of one team. */}
      <LinearGradient
        colors={mode === 'tied'
          ? ['rgba(255,152,0,0.10)', 'rgba(255,152,0,0.02)']
          : ['rgba(30,136,229,0.10)', 'rgba(30,136,229,0.02)']}
        style={[styles.scoreBox, mode === 'tied' && styles.scoreBoxTied]}
      >
        <View style={[styles.accentBar, mode === 'tied' && { backgroundColor: COLORS.WARNING }]} />
        <Text style={styles.teamName} numberOfLines={1}>
          {mode === 'tied' ? 'Both teams scored' : battingTeamName}
        </Text>
        <View style={styles.scoreRow}>
          <Text style={styles.score}>{state.total_runs || 0}</Text>
          {mode !== 'tied' && (
            <>
              <Text style={styles.scoreSlash}>/</Text>
              <Text style={styles.scoreWickets}>{state.total_wickets || 0}</Text>
            </>
          )}
        </View>
        <Text style={styles.overs}>
          {mode === 'tied' ? 'Match Tied' : `${state.total_overs || 0} overs`}
        </Text>
        {state.target != null && state.target > 0 && mode === 'innings_break_1' && (
          <View style={styles.targetPill}>
            <MaterialCommunityIcons name="target" size={12} color={COLORS.ACCENT_LIGHT} />
            <Text style={styles.targetText}>Target: {state.target}</Text>
          </View>
        )}
      </LinearGradient>

      {/* Tied mode: pick which team bats first in the Super Over */}
      {mode === 'tied' && isCreator && matchData?.team_a_id && matchData?.team_b_id && (
        <View style={styles.teamPickerWrap}>
          <Text style={styles.teamPickerLabel}>Who bats first in the Super Over?</Text>
          {[
            { id: matchData.team_a_id, name: matchData.team_a_name || 'Team A', color: matchData.team_a_color },
            { id: matchData.team_b_id, name: matchData.team_b_name || 'Team B', color: matchData.team_b_color },
          ].map((team) => {
            const selected = tiedBatFirst === team.id;
            return (
              <TouchableOpacity
                key={team.id}
                style={[styles.teamCard, selected && styles.teamCardSelected]}
                onPress={() => setTiedBatFirst(team.id)}
                activeOpacity={0.75}
              >
                <View style={[styles.teamCardAvatar, { backgroundColor: team.color || COLORS.ACCENT }]}>
                  <Text style={styles.teamCardAvatarText}>{(team.name || '?').charAt(0).toUpperCase()}</Text>
                </View>
                <Text style={[styles.teamCardName, selected && styles.teamCardNameSelected]} numberOfLines={1}>
                  {team.name}
                </Text>
                {selected && (
                  <View style={styles.teamCardBadge}>
                    <Text style={styles.teamCardBadgeText}>BATS 1st</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Type-to-confirm input — guards against accidental innings start /
          match end / super over. The label adapts to the current action. */}
      {requiresConfirmation && isCreator && (
        <View style={styles.confirmWrap}>
          <Text style={styles.confirmLabel}>
            Type <Text style={styles.confirmCode}>{matchCode || 'CODE'}</Text>
            {' '}to{' '}
            {mode === 'innings_break_1' ? 'start 2nd innings'
              : mode === 'tied' ? 'start the super over'
              : 'end the match'}
          </Text>
          <TextInput
            style={[styles.confirmInput, confirmOk && styles.confirmInputOk]}
            placeholder={matchCode || 'CODE'}
            placeholderTextColor={COLORS.TEXT_HINT}
            value={confirmText}
            onChangeText={setConfirmText}
            autoCapitalize="characters"
            autoCorrect={false}
          />
        </View>
      )}

      {/* Primary action — creator only.
          For tied mode the button is gated on both the type-to-confirm input
          AND the team-to-bat-first selection. */}
      {isCreator && (
        <TouchableOpacity
          style={[
            styles.primaryBtnWrap,
            (!confirmOk || !tiedReady || scoring) && { opacity: 0.45 },
          ]}
          onPress={handlePrimary}
          disabled={!confirmOk || !tiedReady || scoring}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={mode === 'innings_break_1' ? GRADIENTS.BUTTON : ['#FFA726', '#F57C00']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.primaryBtnInner}
          >
            {scoring ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <MaterialCommunityIcons
                  name={
                    mode === 'innings_break_1' ? 'play-circle'
                      : mode === 'tied' ? 'lightning-bolt'
                      : 'check-circle'
                  }
                  size={18}
                  color="#fff"
                />
                <Text style={styles.primaryBtnText}>{PRIMARY_LABEL[mode]}</Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
      )}

      {/* Tied: secondary "End as Tie" — accept the tie without playing super over */}
      {isCreator && mode === 'tied' && onEndAsTie && (
        <TouchableOpacity
          style={styles.tieBtn}
          onPress={onEndAsTie}
          disabled={scoring}
          activeOpacity={0.8}
        >
          <Text style={styles.tieBtnText}>End as Tie</Text>
        </TouchableOpacity>
      )}

      {/* Undo (Wrong Entry) — creator only, available in every end-of-innings
          state including tied (so the scorer can revert a wrong final ball
          before the Super Over begins). */}
      {isCreator && showUndo && onUndoLastBall && (
        <TouchableOpacity
          style={styles.undoBtn}
          onPress={onUndoLastBall}
          disabled={scoring}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons name="undo-variant" size={15} color={COLORS.ACCENT_LIGHT} />
          <Text style={styles.undoBtnText}>Undo Last Ball</Text>
          <Text style={styles.undoBtnHint}>(wrong entry)</Text>
        </TouchableOpacity>
      )}

      {/* Viewer message */}
      {!isCreator && (
        <View style={styles.waitingPill}>
          <ActivityIndicator size="small" color={COLORS.ACCENT_LIGHT} />
          <Text style={styles.waitingText}>
            {mode === 'tied'
              ? 'Waiting for scorer…'
              : mode === 'innings_break_1'
                ? 'Waiting for scorer to start 2nd innings…'
                : 'Waiting for scorer to end the match…'}
          </Text>
        </View>
      )}

      {/* View scorecard — tertiary, available everywhere */}
      {onViewScorecard && (
        <TouchableOpacity onPress={onViewScorecard} style={styles.viewScorecardBtn} activeOpacity={0.7}>
          <Text style={styles.viewScorecardText}>View Scorecard</Text>
          <MaterialCommunityIcons name="arrow-right" size={14} color={COLORS.ACCENT} />
        </TouchableOpacity>
      )}
    </Animated.View>
  );

  // ── Render variants ────────────────────────────────────────────────────
  if (variant === 'modal') {
    return (
      <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
        <Animated.View
          style={[
            styles.modalOverlay,
            { opacity: fadeAnim, paddingTop: insets.top, paddingBottom: insets.bottom },
          ]}
        >
          {Content}
        </Animated.View>
      </Modal>
    );
  }

  if (variant === 'banner') {
    return <View style={styles.bannerWrap}>{Content}</View>;
  }

  // fullscreen — pad by safe-area insets so the card visually centers in the
  // area between the status bar / notch and the home indicator, not the raw
  // screen rectangle (which would push it slightly above center on notched
  // devices).
  return (
    <View style={[styles.fullscreenWrap, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {/* Background gradient — subtle blue radial vibe */}
      <LinearGradient
        colors={[COLORS.BG, COLORS.BG_DEEP, COLORS.BG]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {Content}
    </View>
  );
};


const styles = StyleSheet.create({
  // ── Layout wrappers ────────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.78)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  fullscreenWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: COLORS.BG,
  },
  bannerWrap: {
    paddingHorizontal: 12,
    marginTop: 14,
    marginBottom: 4,
  },

  // ── Card ───────────────────────────────────────────────────────────────
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: COLORS.CARD,
    borderRadius: 22,
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(30,136,229,0.18)',
    overflow: 'hidden',
    position: 'relative',
    ...Platform.select({
      ios: {
        shadowColor: COLORS.ACCENT,
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.25,
        shadowRadius: 28,
      },
      android: { elevation: 14 },
    }),
  },
  cardBanner: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 14,
    borderRadius: 18,
  },
  cardGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 110,
  },
  closeBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    zIndex: 10,
  },

  // ── Hero icon ──────────────────────────────────────────────────────────
  heroWrap: {
    alignItems: 'center',
    marginBottom: 14,
    marginTop: 4,
  },
  heroRing: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  heroInner: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },

  // ── Text ───────────────────────────────────────────────────────────────
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.TEXT,
    marginBottom: 6,
    textAlign: 'center',
    letterSpacing: -0.4,
  },
  titleBanner: {
    fontSize: 19,
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.TEXT_SECONDARY,
    marginBottom: 18,
    textAlign: 'center',
    lineHeight: 19,
    paddingHorizontal: 8,
  },

  // ── Score box ──────────────────────────────────────────────────────────
  scoreBox: {
    width: '100%',
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(30,136,229,0.25)',
    overflow: 'hidden',
    position: 'relative',
  },
  scoreBoxTied: {
    borderColor: 'rgba(255,152,0,0.4)',
  },
  accentBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: COLORS.ACCENT,
  },
  teamName: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.TEXT_MUTED,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
  },
  score: {
    fontSize: 42,
    fontWeight: '900',
    color: COLORS.TEXT,
    letterSpacing: -1.5,
    lineHeight: 46,
  },
  scoreSlash: {
    fontSize: 28,
    fontWeight: '300',
    color: COLORS.TEXT_MUTED,
    marginHorizontal: 4,
  },
  scoreWickets: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.TEXT_SECONDARY,
  },
  overs: {
    fontSize: 12,
    color: COLORS.TEXT_MUTED,
    fontWeight: '600',
    marginTop: 2,
    letterSpacing: 0.3,
  },
  targetPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(30,136,229,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(30,136,229,0.35)',
  },
  targetText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.ACCENT_LIGHT,
    letterSpacing: 0.3,
  },

  // ── Tied: team picker ──────────────────────────────────────────────────
  teamPickerWrap: {
    width: '100%',
    marginBottom: 14,
  },
  teamPickerLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.TEXT_SECONDARY,
    marginBottom: 8,
    letterSpacing: 0.3,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  teamCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderWidth: 1.5,
    borderColor: COLORS.BORDER,
  },
  teamCardSelected: {
    borderColor: COLORS.WARNING,
    backgroundColor: 'rgba(255,152,0,0.10)',
  },
  teamCardAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamCardAvatarText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 14,
  },
  teamCardName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.TEXT_SECONDARY,
  },
  teamCardNameSelected: {
    color: COLORS.TEXT,
  },
  teamCardBadge: {
    backgroundColor: COLORS.WARNING,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  teamCardBadgeText: {
    color: '#000',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },

  // ── Confirmation input ─────────────────────────────────────────────────
  confirmWrap: {
    width: '100%',
    marginBottom: 14,
  },
  confirmLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.TEXT_SECONDARY,
    marginBottom: 8,
    textAlign: 'center',
  },
  confirmCode: {
    color: COLORS.ACCENT_LIGHT,
    fontWeight: '900',
    letterSpacing: 1,
  },
  confirmInput: {
    borderWidth: 1.5,
    borderColor: COLORS.BORDER,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontSize: 16,
    color: COLORS.TEXT,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 2,
  },
  confirmInputOk: {
    borderColor: COLORS.ACCENT,
    backgroundColor: 'rgba(30,136,229,0.10)',
  },

  // ── Primary button ─────────────────────────────────────────────────────
  primaryBtnWrap: {
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: COLORS.ACCENT,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 16,
      },
      android: { elevation: 8 },
    }),
  },
  primaryBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.4,
  },

  // ── Tied: End as Tie button ────────────────────────────────────────────
  tieBtn: {
    marginTop: 10,
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    backgroundColor: COLORS.SURFACE,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  tieBtnText: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 14,
    fontWeight: '700',
  },

  // ── Undo button ────────────────────────────────────────────────────────
  undoBtn: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 11,
    paddingHorizontal: 18,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(30,136,229,0.30)',
    backgroundColor: 'rgba(30,136,229,0.06)',
  },
  undoBtnText: {
    fontSize: 13,
    color: COLORS.ACCENT_LIGHT,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  undoBtnHint: {
    fontSize: 11,
    color: COLORS.TEXT_MUTED,
    fontWeight: '600',
    marginLeft: 2,
  },

  // ── Viewer waiting state ───────────────────────────────────────────────
  waitingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: 'rgba(30,136,229,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(30,136,229,0.25)',
    marginTop: 4,
  },
  waitingText: {
    fontSize: 12,
    color: COLORS.TEXT_SECONDARY,
    fontWeight: '600',
  },

  // ── View scorecard tertiary action ─────────────────────────────────────
  viewScorecardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 14,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  viewScorecardText: {
    fontSize: 13,
    color: COLORS.ACCENT,
    fontWeight: '700',
  },
});

export default InningsEndDialog;
