import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { COLORS } from '../../theme';

const FallOfWicketsChart = ({ wickets = [], style }) => {
  // wickets: Array of { wicketNumber, score, overs, batsmanName }
  if (!wickets.length) return null;

  return (
    <View style={[styles.container, style]}>
      <Text style={styles.title}>Fall of Wickets</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {wickets.map((w, i) => (
          <View key={i} style={styles.wicketItem}>
            <View style={styles.wicketCircle}>
              <Text style={styles.wicketNum}>{w.wicketNumber || i + 1}</Text>
            </View>
            <Text style={styles.wicketScore}>{w.score}</Text>
            <Text style={styles.wicketOvers}>({w.overs} ov)</Text>
            {w.batsmanName && (
              <Text style={styles.wicketName} numberOfLines={1}>{w.batsmanName}</Text>
            )}
            {/* Connector line */}
            {i < wickets.length - 1 && <View style={styles.connector} />}
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.CARD, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: COLORS.BORDER,
  },
  title: { fontSize: 14, fontWeight: '700', color: COLORS.TEXT, marginBottom: 12 },
  scroll: { flexDirection: 'row', gap: 4, alignItems: 'flex-start', paddingRight: 16 },
  wicketItem: { alignItems: 'center', width: 60, position: 'relative' },
  wicketCircle: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: COLORS.DANGER_SOFT, alignItems: 'center', justifyContent: 'center',
    marginBottom: 6,
  },
  wicketNum: { fontSize: 12, fontWeight: '800', color: COLORS.DANGER },
  wicketScore: { fontSize: 13, fontWeight: '800', color: COLORS.TEXT },
  wicketOvers: { fontSize: 9, color: COLORS.TEXT_MUTED, marginTop: 1 },
  wicketName: { fontSize: 8, color: COLORS.TEXT_SECONDARY, marginTop: 2, textAlign: 'center' },
  connector: {
    position: 'absolute', top: 13, right: -4,
    width: 8, height: 1.5, backgroundColor: COLORS.BORDER,
  },
});

export default React.memo(FallOfWicketsChart);
