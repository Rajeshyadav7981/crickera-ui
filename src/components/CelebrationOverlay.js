import React, { useEffect, useRef, useMemo, memo } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions, Easing } from 'react-native';
import { COLORS, FONTS } from '../theme';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// Sixer Celebrations tokens — mirrors `Sixer Celebrations Design System/colors_and_type.css`.
// Kept inline so we ship zero JSON at runtime; JSON files stay as design reference only.
const TOKENS = {
  blueBolt: '#2D6BFF',
  blueElectric: '#4FC3FF',
  blueIce: '#B8E0FF',
  amberStrike: '#FFB020',
  amberGold: '#FFD466',
  redOut: '#FF3D5A',
  greenBoundary: '#22C55E',
  purpleSix: '#A855F7',
  inkChalk: '#F5F7FF',
};

// 2000ms total, matching the Sixer spec's 5-beat structure.
const BEATS = { entry: 200, hold1: 200, drama: 500, hold2: 700, exit: 400 };
const TOTAL_MS = BEATS.entry + BEATS.hold1 + BEATS.drama + BEATS.hold2 + BEATS.exit;

// Event config — one hero word, one support line, one color family. From SKILL.md vocabulary.
const EVENTS = {
  four: { hero: 'FOUR', support: 'cracking shot', hero_color: TOKENS.greenBoundary, glow: TOKENS.greenBoundary, particle_palette: [TOKENS.greenBoundary, TOKENS.blueIce, TOKENS.inkChalk] },
  six: { hero: 'SIX', support: 'into the stands', hero_color: TOKENS.purpleSix, glow: TOKENS.purpleSix, particle_palette: [TOKENS.purpleSix, TOKENS.blueElectric, TOKENS.inkChalk] },
  fifty: { hero: 'FIFTY', support: 'half-century', hero_color: TOKENS.amberGold, glow: TOKENS.amberStrike, particle_palette: [TOKENS.amberGold, TOKENS.amberStrike, TOKENS.inkChalk] },
  hundred: { hero: 'HUNDRED', support: 'ton up', hero_color: TOKENS.amberGold, glow: TOKENS.amberStrike, particle_palette: [TOKENS.amberGold, TOKENS.blueBolt, TOKENS.inkChalk] },
  hattrick: { hero: 'HAT-TRICK', support: 'three in three', hero_color: TOKENS.amberStrike, glow: TOKENS.redOut, particle_palette: [TOKENS.amberStrike, TOKENS.redOut, TOKENS.inkChalk] },
  match_won: { hero: 'WINNER', support: 'champions', hero_color: TOKENS.blueBolt, glow: TOKENS.blueElectric, particle_palette: [TOKENS.blueBolt, TOKENS.blueElectric, TOKENS.amberGold, TOKENS.inkChalk] },
  wicket: { hero: 'OUT', support: 'gone', hero_color: TOKENS.redOut, glow: TOKENS.redOut, particle_palette: [TOKENS.redOut, TOKENS.amberStrike] },
  wicket_bowled: { hero: 'BOWLED', support: 'timber', hero_color: TOKENS.redOut, glow: TOKENS.redOut, particle_palette: [TOKENS.redOut, TOKENS.amberStrike] },
  wicket_caught: { hero: 'CAUGHT', support: 'safe hands', hero_color: TOKENS.redOut, glow: TOKENS.redOut, particle_palette: [TOKENS.redOut, TOKENS.amberStrike] },
  wicket_lbw: { hero: 'LBW', support: 'plumb in front', hero_color: TOKENS.redOut, glow: TOKENS.redOut, particle_palette: [TOKENS.redOut, TOKENS.amberStrike] },
  wicket_runout: { hero: 'RUN OUT', support: 'direct hit', hero_color: TOKENS.redOut, glow: TOKENS.redOut, particle_palette: [TOKENS.redOut, TOKENS.amberStrike] },
};

const CENTER_X = SCREEN_W / 2;
const CENTER_Y = SCREEN_H * 0.38;
const CONFETTI_COUNT = 14;

const buildConfetti = (palette) => {
  const items = [];
  for (let i = 0; i < CONFETTI_COUNT; i++) {
    const angle = (Math.PI * 2 * i) / CONFETTI_COUNT + (Math.random() - 0.5) * 0.4;
    const dist = 120 + Math.random() * 140;
    items.push({
      id: i,
      dx: Math.cos(angle) * dist,
      dy: Math.sin(angle) * dist - 40,
      rot: (Math.random() - 0.5) * 720,
      color: palette[i % palette.length],
      size: 6 + Math.random() * 8,
    });
  }
  return items;
};

const ShockwaveRing = memo(({ anim, color }) => {
  const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [0.2, 3.2] });
  const opacity = anim.interpolate({ inputRange: [0, 0.1, 1], outputRange: [0, 0.9, 0] });
  return (
    <Animated.View
      style={[
        styles.ring,
        { borderColor: color, transform: [{ scale }], opacity },
      ]}
    />
  );
});

const Confetti = memo(({ anim, items }) => {
  return items.map((p) => {
    const tx = anim.interpolate({ inputRange: [0, 1], outputRange: [0, p.dx] });
    const ty = anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, p.dy * 0.5, p.dy + 160] });
    const rot = anim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${p.rot}deg`] });
    const opacity = anim.interpolate({ inputRange: [0, 0.1, 0.8, 1], outputRange: [0, 1, 1, 0] });
    return (
      <Animated.View
        key={p.id}
        style={[
          styles.confetti,
          {
            width: p.size,
            height: p.size * 1.6,
            backgroundColor: p.color,
            opacity,
            transform: [{ translateX: tx }, { translateY: ty }, { rotate: rot }],
          },
        ]}
      />
    );
  });
});

const CelebrationOverlay = ({ type, visible, onFinish }) => {
  const heroScale = useRef(new Animated.Value(0.6)).current;
  const heroOpacity = useRef(new Animated.Value(0)).current;
  const heroTranslateY = useRef(new Animated.Value(30)).current;
  const supportOpacity = useRef(new Animated.Value(0)).current;
  const supportTranslateY = useRef(new Animated.Value(20)).current;
  const haloOpacity = useRef(new Animated.Value(0)).current;
  const ringAnim = useRef(new Animated.Value(0)).current;
  const confettiAnim = useRef(new Animated.Value(0)).current;
  const running = useRef(false);

  const cfg = EVENTS[type] || EVENTS.four;
  const confettiItems = useMemo(() => buildConfetti(cfg.particle_palette), [type]);

  useEffect(() => {
    if (!visible || !type || running.current) return;
    running.current = true;

    heroScale.setValue(0.6);
    heroOpacity.setValue(0);
    heroTranslateY.setValue(30);
    supportOpacity.setValue(0);
    supportTranslateY.setValue(20);
    haloOpacity.setValue(0);
    ringAnim.setValue(0);
    confettiAnim.setValue(0);

    const popEase = Easing.bezier(0.2, 0.9, 0.25, 1.25);
    const outFast = Easing.bezier(0.16, 1, 0.3, 1);

    Animated.parallel([
      // Entry beat
      Animated.timing(heroOpacity, { toValue: 1, duration: BEATS.entry, easing: outFast, useNativeDriver: true }),
      Animated.sequence([
        Animated.timing(heroScale, { toValue: 1.15, duration: BEATS.entry, easing: popEase, useNativeDriver: true }),
        Animated.timing(heroScale, { toValue: 1.0, duration: BEATS.hold1, easing: outFast, useNativeDriver: true }),
      ]),
      Animated.timing(heroTranslateY, { toValue: 0, duration: BEATS.entry, easing: popEase, useNativeDriver: true }),
      Animated.timing(haloOpacity, { toValue: 1, duration: BEATS.entry, easing: outFast, useNativeDriver: true }),
      Animated.timing(ringAnim, { toValue: 1, duration: BEATS.entry + BEATS.hold1 + BEATS.drama, easing: outFast, useNativeDriver: true }),
      // Drama: support line + confetti kick in after the entry
      Animated.sequence([
        Animated.delay(BEATS.entry + BEATS.hold1),
        Animated.parallel([
          Animated.timing(supportOpacity, { toValue: 1, duration: 200, easing: outFast, useNativeDriver: true }),
          Animated.timing(supportTranslateY, { toValue: 0, duration: 200, easing: outFast, useNativeDriver: true }),
          Animated.timing(confettiAnim, { toValue: 1, duration: BEATS.drama + BEATS.hold2, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        ]),
      ]),
      // Exit
      Animated.sequence([
        Animated.delay(TOTAL_MS - BEATS.exit),
        Animated.parallel([
          Animated.timing(heroOpacity, { toValue: 0, duration: BEATS.exit, easing: outFast, useNativeDriver: true }),
          Animated.timing(heroScale, { toValue: 0.9, duration: BEATS.exit, easing: outFast, useNativeDriver: true }),
          Animated.timing(supportOpacity, { toValue: 0, duration: BEATS.exit, easing: outFast, useNativeDriver: true }),
          Animated.timing(haloOpacity, { toValue: 0, duration: BEATS.exit, easing: outFast, useNativeDriver: true }),
        ]),
      ]),
    ]).start(() => {
      running.current = false;
      onFinish?.();
    });
  }, [visible, type]);

  if (!visible || !type) return null;

  return (
    <View style={styles.container} pointerEvents="none">
      {/* Radial halo — single-color glow behind the hero word */}
      <Animated.View
        style={[
          styles.halo,
          {
            backgroundColor: cfg.glow,
            opacity: haloOpacity.interpolate({ inputRange: [0, 1], outputRange: [0, 0.35] }),
          },
        ]}
      />

      {/* Shockwave ring */}
      <View style={styles.ringWrap} pointerEvents="none">
        <ShockwaveRing anim={ringAnim} color={cfg.glow} />
      </View>

      {/* Confetti burst */}
      <View style={styles.confettiWrap} pointerEvents="none">
        <Confetti anim={confettiAnim} items={confettiItems} />
      </View>

      {/* Hero word */}
      <Animated.View
        style={[
          styles.heroWrap,
          {
            opacity: heroOpacity,
            transform: [{ translateY: heroTranslateY }, { scale: heroScale }],
          },
        ]}
      >
        <Text
          style={[
            styles.hero,
            {
              color: cfg.hero_color,
              textShadowColor: cfg.glow,
            },
          ]}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {cfg.hero}
        </Text>
      </Animated.View>

      {/* Support line */}
      <Animated.View
        style={[
          styles.supportWrap,
          {
            opacity: supportOpacity,
            transform: [{ translateY: supportTranslateY }],
          },
        ]}
      >
        <Text style={styles.support}>{cfg.support}</Text>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'flex-start',
    zIndex: 100,
  },
  halo: {
    position: 'absolute',
    top: CENTER_Y - SCREEN_W * 0.6,
    left: CENTER_X - SCREEN_W * 0.6,
    width: SCREEN_W * 1.2,
    height: SCREEN_W * 1.2,
    borderRadius: SCREEN_W * 0.6,
  },
  ringWrap: {
    position: 'absolute',
    top: CENTER_Y - 50,
    left: CENTER_X - 50,
    width: 100,
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
  },
  confettiWrap: {
    position: 'absolute',
    top: CENTER_Y,
    left: CENTER_X,
    width: 0,
    height: 0,
  },
  confetti: {
    position: 'absolute',
    borderRadius: 2,
  },
  heroWrap: {
    position: 'absolute',
    top: CENTER_Y - 60,
    left: 24,
    right: 24,
    alignItems: 'center',
  },
  hero: {
    fontSize: 88,
    fontWeight: '900',
    letterSpacing: -1.5,
    textAlign: 'center',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 24,
  },
  supportWrap: {
    position: 'absolute',
    top: CENTER_Y + 60,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  support: {
    fontFamily: FONTS.family,    fontSize: 15,
    fontWeight: '500',
    color: COLORS.TEXT_SECONDARY || '#B0B0B0',
    letterSpacing: 1.2,
    textTransform: 'lowercase',
  },
});

export default memo(CelebrationOverlay);
