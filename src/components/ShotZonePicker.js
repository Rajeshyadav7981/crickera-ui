import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import {
  Modal, View, Text, StyleSheet, TouchableOpacity, TextInput,
  KeyboardAvoidingView, Platform, Pressable, Animated, Easing,
} from 'react-native';
import Svg, { Path, Circle, Rect, G, Line, Text as SvgText } from 'react-native-svg';
import { COLORS, FONTS } from '../theme';
import { ZONES, zoneLabelForRuns, buildCommentary } from '../utils/shotZones';

const BOARD = 280;
const CENTER = BOARD / 2;
const R_OUTER = BOARD / 2 - 8;
const R_INNER_RING = R_OUTER * 0.55;
const R_LABEL = R_OUTER * 0.78;

const polar = (cx, cy, r, angleDeg) => {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
};

const wedgePath = (cx, cy, r, startDeg, endDeg) => {
  // Handle wrap-around (e.g. 337.5 → 22.5)
  const sweep = ((endDeg - startDeg) + 360) % 360;
  const start = polar(cx, cy, r, startDeg);
  const end = polar(cx, cy, r, startDeg + sweep);
  const largeArc = sweep > 180 ? 1 : 0;
  return [
    'M', cx, cy,
    'L', start.x, start.y,
    'A', r, r, 0, largeArc, 1, end.x, end.y,
    'Z',
  ].join(' ');
};

const midAngle = (startDeg, endDeg) => {
  const sweep = ((endDeg - startDeg) + 360) % 360;
  return (startDeg + sweep / 2) % 360;
};

const ShotZonePicker = ({ visible, runs, isBoundary, isSix, battingHand = 'right', onConfirm, onSkip, onClose }) => {
  const [selectedZone, setSelectedZone] = useState(null);
  const [commentary, setCommentary] = useState('');
  // Auto-orient from striker's batting hand; override on tap.
  const [isLeftHander, setIsLeftHander] = useState(battingHand === 'left');
  // Ripple / tap-point indicator — small pulse that appears where the finger lands.
  const [tapPoint, setTapPoint] = useState(null); // { x, y }
  const rippleScale = useRef(new Animated.Value(0)).current;
  const rippleOpacity = useRef(new Animated.Value(0)).current;
  // Selected zone bounce — brief scale pulse on the whole board when a zone is picked.
  const boardScale = useRef(new Animated.Value(1)).current;

  // Reset on open + re-sync to striker's hand each time.
  useEffect(() => {
    if (visible) {
      setSelectedZone(null);
      setCommentary('');
      setIsLeftHander(battingHand === 'left');
      setTapPoint(null);
    }
  }, [visible, battingHand]);

  const handleZoneTap = useCallback(
    (zoneId) => {
      setSelectedZone(zoneId);
      const line = buildCommentary(zoneId, runs, isBoundary, isSix);
      setCommentary(line);
      // Quick bounce so the pick feels confirmed.
      boardScale.setValue(0.97);
      Animated.spring(boardScale, {
        toValue: 1,
        useNativeDriver: true,
        friction: 4,
        tension: 180,
      }).start();
    },
    [runs, isBoundary, isSix, boardScale]
  );

  const playRipple = useCallback(
    (x, y) => {
      setTapPoint({ x, y });
      rippleScale.setValue(0);
      rippleOpacity.setValue(0.55);
      Animated.parallel([
        Animated.timing(rippleScale, { toValue: 1, duration: 320, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(rippleOpacity, { toValue: 0, duration: 320, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ]).start();
    },
    [rippleScale, rippleOpacity]
  );

  // Board-level tap — fires on onPressIn so selection feels instant (no release latency).
  const onBoardPressIn = useCallback(
    (evt) => {
      const { locationX, locationY } = evt.nativeEvent;
      const dx = locationX - CENTER;
      const dy = locationY - CENTER;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 10 || dist > R_OUTER) return; // only the very center (stumps) and outside the boundary are dead
      // atan2 with (dx, -dy) gives 0° at north, growing clockwise.
      let angle = (Math.atan2(dx, -dy) * 180) / Math.PI;
      if (angle < 0) angle += 360;
      // Ground is rotated 180° (batsman at top, straight at bottom) — un-rotate tap.
      angle = (angle + 180) % 360;
      // For left-handed view, the wedges are visually mirrored; un-mirror the tap.
      const effective = isLeftHander ? (360 - angle) % 360 : angle;
      const zone = ZONES.find((z) => {
        const sweep = ((z.end - z.start) + 360) % 360 || 360;
        const norm = ((effective - z.start) + 360) % 360;
        return norm < sweep;
      });
      if (zone) {
        playRipple(locationX, locationY);
        handleZoneTap(zone.id);
      }
    },
    [isLeftHander, handleZoneTap, playRipple]
  );

  const handleConfirm = () => {
    const resolvedZone = selectedZone || 'straight';
    const resolvedCommentary =
      commentary.trim() ||
      (selectedZone ? buildCommentary(selectedZone, runs, isBoundary, isSix) : '');
    onConfirm({
      zone: resolvedZone,
      commentary: resolvedCommentary,
      battingHand: isLeftHander ? 'left' : 'right',
    });
  };

  const title = useMemo(() => {
    if (isSix) return 'SIX — where did it land?';
    if (isBoundary) return 'FOUR — where did it go?';
    if (runs === 1) return '1 run — where?';
    return `${runs} runs — where?`;
  }, [runs, isBoundary, isSix]);

  const heroColor = isSix ? '#A855F7' : isBoundary ? '#22C55E' : COLORS.ACCENT;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.backdrop}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.card}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: heroColor }]}>{title}</Text>
            <TouchableOpacity onPress={() => setIsLeftHander((v) => !v)} style={styles.flipBtn}>
              <Text style={styles.flipText}>{isLeftHander ? 'LH' : 'RH'}</Text>
              <Text style={styles.flipHint}>{battingHand === (isLeftHander ? 'left' : 'right') ? 'auto' : 'override'}</Text>
            </TouchableOpacity>
          </View>

          {/* Ground — single board-level Pressable handles all zone taps.
              onPressIn (not onPress) — zero release-latency, feels instant. */}
          <Pressable
            style={styles.boardWrap}
            onPressIn={onBoardPressIn}
            android_disableSound
            hitSlop={0}
          >
            <Animated.View style={{ transform: [{ scale: boardScale }] }}>
            <Svg width={BOARD} height={BOARD} viewBox={`0 0 ${BOARD} ${BOARD}`} pointerEvents="none">
              {/* Outer grass circle */}
              <Circle cx={CENTER} cy={CENTER} r={R_OUTER} fill="#0F5132" stroke="#22C55E" strokeWidth={2} />
              {/* 30-yard inner circle */}
              <Circle cx={CENTER} cy={CENTER} r={R_INNER_RING} fill="none" stroke="rgba(255,255,255,0.25)" strokeDasharray="4 6" strokeWidth={1} />

              {/* Wedge zones — rotated 180° so straight is at the bottom
                  (batsman drawn at the top, bowler at the bottom).
                  Mirrored horizontally for lefties. */}
              <G transform={isLeftHander ? `scale(-1 1) translate(${-BOARD} 0)` : undefined}>
                {ZONES.map((z) => {
                  const selected = selectedZone === z.id;
                  return (
                    <Path
                      key={z.id}
                      d={wedgePath(CENTER, CENTER, R_OUTER, (z.start + 180) % 360, (z.end + 180) % 360)}
                      fill={selected ? heroColor : 'rgba(255,255,255,0.06)'}
                      fillOpacity={selected ? 0.8 : 1}
                      stroke={selected ? '#FFFFFF' : 'rgba(255,255,255,0.22)'}
                      strokeWidth={selected ? 3 : 1}
                    />
                  );
                })}
              </G>

              {/* Pitch rectangle in the center (narrow strip, doesn't block the wedges) */}
              <Rect
                x={CENTER - 7}
                y={CENTER - 26}
                width={14}
                height={52}
                fill="#D4A574"
                stroke="rgba(0,0,0,0.3)"
                strokeWidth={1}
                rx={2}
              />
              {/* Crease lines */}
              <Line x1={CENTER - 11} y1={CENTER - 22} x2={CENTER + 11} y2={CENTER - 22} stroke="#fff" strokeWidth={1} />
              <Line x1={CENTER - 11} y1={CENTER + 22} x2={CENTER + 11} y2={CENTER + 22} stroke="#fff" strokeWidth={1} />

              {/* Batsman marker at top + bowler marker at bottom (so orientation is obvious) */}
              <Circle cx={CENTER} cy={CENTER - 18} r={5} fill="#F5F7FF" />
              <Circle cx={CENTER} cy={CENTER + 18} r={4} fill="#FFB020" />

              {/* Zone labels — rotated 180° to match wedges; mirrored for lefty */}
              <G transform={isLeftHander ? `scale(-1 1) translate(${-BOARD} 0)` : undefined}>
                {ZONES.map((z) => {
                  const angle = (midAngle(z.start, z.end) + 180) % 360;
                  const pt = polar(CENTER, CENTER, R_LABEL, angle);
                  return (
                    <ZoneLabel
                      key={z.id}
                      x={pt.x}
                      y={pt.y}
                      label={zoneLabelForRuns(z.id, isBoundary || isSix)}
                      mirror={isLeftHander}
                    />
                  );
                })}
              </G>
            </Svg>
            {/* Ripple indicator — appears where the finger lands, fades out */}
            {tapPoint ? (
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.ripple,
                  {
                    left: tapPoint.x - 30,
                    top: tapPoint.y - 30,
                    opacity: rippleOpacity,
                    transform: [{ scale: rippleScale }],
                  },
                ]}
              />
            ) : null}
            </Animated.View>

            {/* Side badges — off / leg (flipped for LH) */}
            <Text style={[styles.sideBadge, { left: 4, color: isLeftHander ? '#FFB020' : '#4FC3FF' }]} pointerEvents="none">
              {isLeftHander ? 'LEG' : 'OFF'}
            </Text>
            <Text style={[styles.sideBadge, { right: 4, color: isLeftHander ? '#4FC3FF' : '#FFB020' }]} pointerEvents="none">
              {isLeftHander ? 'OFF' : 'LEG'}
            </Text>
          </Pressable>

          {/* Commentary input */}
          <Text style={styles.inputLabel}>Commentary {selectedZone ? '(edit if you like)' : '(tap a zone to auto-fill)'}</Text>
          <TextInput
            style={styles.input}
            value={commentary}
            onChangeText={setCommentary}
            placeholder="e.g. cracking drive through the covers"
            placeholderTextColor={COLORS.TEXT_MUTED}
            maxLength={80}
          />

          {/* Footer */}
          <View style={styles.footer}>
            <PressScale onPress={onSkip} style={styles.skipBtn}>
              <Text style={styles.skipText}>Skip</Text>
            </PressScale>
            <PressScale
              onPress={handleConfirm}
              disabled={!selectedZone && !commentary}
              style={[
                styles.confirmBtn,
                { backgroundColor: heroColor, opacity: selectedZone || commentary ? 1 : 0.5 },
              ]}
            >
              <Text style={styles.confirmText}>Confirm</Text>
            </PressScale>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

// Foreign-object-free text label — render as a plain View over the Svg would be an option,
// but rendering inside Svg keeps coordinates in sync. Use SvgText via a thin wrapper.
const ZoneLabel = ({ x, y, label, mirror }) => {
  // When the parent G is mirrored, the inline text would read backwards.
  // We flip the text back with a local mirror so it stays readable.
  const transform = mirror ? `scale(-1 1) translate(${-2 * x} 0)` : undefined;
  return (
    <G transform={transform}>
      <SvgLabelBg x={x} y={y} label={label} />
    </G>
  );
};

const SvgLabelBg = ({ x, y, label }) => {
  const w = Math.max(48, label.length * 6.2);
  return (
    <G>
      <Rect x={x - w / 2} y={y - 9} width={w} height={18} rx={9} fill="rgba(0,0,0,0.55)" />
      <SvgTextWrapper x={x} y={y}>{label}</SvgTextWrapper>
    </G>
  );
};

// Small press-feedback wrapper — scales the whole pressable to 0.94 on press, native driver.
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const PressScale = ({ onPress, disabled, style, children }) => {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <AnimatedPressable
      disabled={disabled}
      onPress={onPress}
      onPressIn={() => Animated.spring(scale, { toValue: 0.94, useNativeDriver: true, speed: 60, bounciness: 4 }).start()}
      onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 60, bounciness: 4 }).start()}
      style={[style, { transform: [{ scale }] }]}
    >
      {children}
    </AnimatedPressable>
  );
};

const SvgTextWrapper = ({ x, y, children }) => (
  <SvgText x={x} y={y + 4} fill="#fff" fontSize={11} fontWeight="700" textAnchor="middle">
    {children}
  </SvgText>
);

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: COLORS.CARD,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  title: { fontFamily: FONTS.family, fontSize: 16, fontWeight: '900', letterSpacing: 0.5 },
  flipBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: COLORS.SURFACE,
    borderRadius: 10,
    alignItems: 'center',
  },
  flipText: { fontFamily: FONTS.family, color: COLORS.TEXT, fontSize: 13, fontWeight: '800' },
  flipHint: { fontFamily: FONTS.family, color: COLORS.TEXT_MUTED, fontSize: 9, marginTop: 1 },
  boardWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  ripple: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  sideBadge: {
    fontFamily: FONTS.family,    position: 'absolute',
    top: BOARD / 2 - 8,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
  },
  inputLabel: { fontFamily: FONTS.family, fontSize: 12, color: COLORS.TEXT_MUTED, marginBottom: 6, fontWeight: '600' },
  input: {
    fontFamily: FONTS.family,    backgroundColor: COLORS.SURFACE,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: COLORS.TEXT,
    fontSize: 14,
    borderWidth: 1,
    borderColor: COLORS.BORDER_LIGHT,
  },
  footer: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  skipBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: COLORS.SURFACE,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.BORDER_LIGHT,
  },
  skipText: { fontFamily: FONTS.family, color: COLORS.TEXT_SECONDARY, fontWeight: '700', fontSize: 14 },
  confirmBtn: {
    flex: 1.4,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
  },
  confirmText: { fontFamily: FONTS.family, color: '#fff', fontWeight: '900', fontSize: 14, letterSpacing: 0.5 },
});

export default React.memo(ShotZonePicker);
