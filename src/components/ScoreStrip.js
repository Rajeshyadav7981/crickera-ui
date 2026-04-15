import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { COLORS } from '../theme';

const ScoreStrip = ({ teamName, score, wickets, overs, target, isLive = false, style }) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isLive) {
      const anim = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.4, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        ])
      );
      anim.start();
      return () => anim.stop();
    }
  }, [isLive]);

  const needsRuns = target != null ? target - score : null;

  return (
    <View style={[styles.container, style]}>
      <View style={styles.left}>
        <View style={styles.nameRow}>
          {isLive && <Animated.View style={[styles.liveDot, { opacity: pulseAnim }]} />}
          <Text style={styles.teamName} numberOfLines={1}>{teamName || 'Team'}</Text>
        </View>
        {overs != null && <Text style={styles.overs}>({overs} ov)</Text>}
      </View>
      <View style={styles.right}>
        <Text style={styles.score}>{score ?? 0}</Text>
        <Text style={styles.wickets}>/{wickets ?? 0}</Text>
      </View>
      {needsRuns != null && needsRuns > 0 && (
        <Text style={styles.target}>Need {needsRuns} runs</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.CARD,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  left: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  teamName: { fontSize: 15, fontWeight: '700', color: COLORS.TEXT },
  overs: { fontSize: 11, color: COLORS.TEXT_MUTED, marginTop: 2 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.LIVE },
  right: { flexDirection: 'row', alignItems: 'baseline' },
  score: { fontSize: 28, fontWeight: '900', color: COLORS.TEXT },
  wickets: { fontSize: 18, fontWeight: '600', color: COLORS.TEXT_MUTED },
  target: { fontSize: 11, fontWeight: '600', color: COLORS.ACCENT_LIGHT, position: 'absolute', right: 14, bottom: 4 },
});

export default React.memo(ScoreStrip);
