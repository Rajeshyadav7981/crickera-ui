import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { COLORS } from '../theme';

const getBallColor = (ball) => {
  const b = String(ball).toUpperCase();
  if (b === 'W') return { bg: COLORS.DANGER, text: '#fff' };
  if (b === '4') return { bg: COLORS.SUCCESS, text: '#fff' };
  if (b === '6') return { bg: COLORS.PURPLE, text: '#fff' };
  if (b === '0') return { bg: COLORS.SURFACE, text: COLORS.TEXT_MUTED };
  if (b.includes('WD') || b.includes('NB') || b.includes('LB') || b.includes('BYE'))
    return { bg: 'rgba(255,152,0,0.2)', text: COLORS.WARNING };
  return { bg: COLORS.ACCENT_SOFT, text: COLORS.ACCENT_LIGHT };
};

const OverSummary = ({ balls = [], overNumber, showNext = false, style }) => (
  <View style={[styles.container, style]}>
    {overNumber != null && (
      <Text style={styles.overLabel}>Over {overNumber}</Text>
    )}
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
      {balls.map((ball, i) => {
        const { bg, text } = getBallColor(ball);
        return (
          <View key={i} style={[styles.ball, { backgroundColor: bg }]}>
            <Text style={[styles.ballText, { color: text }]}>
              {String(ball).length > 2 ? String(ball).substring(0, 2) : ball}
            </Text>
          </View>
        );
      })}
      {showNext && (
        <View style={[styles.ball, styles.nextBall]}>
          <View style={styles.nextDot} />
        </View>
      )}
    </ScrollView>
  </View>
);

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.CARD,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  overLabel: {
    fontSize: 11, fontWeight: '700', color: COLORS.TEXT_MUTED,
    marginBottom: 8, letterSpacing: 0.5,
  },
  scrollContent: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  ball: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  ballText: { fontSize: 13, fontWeight: '800' },
  nextBall: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: COLORS.ACCENT,
    borderStyle: 'dashed',
  },
  nextDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: COLORS.ACCENT,
  },
});

export default React.memo(OverSummary);
