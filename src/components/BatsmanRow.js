import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS } from '../theme';

const BatsmanRow = ({ batsman, isStriker = false, onPress, compact = false }) => {
  if (!batsman) return null;

  const name = batsman.player_name || batsman.name || 'Unknown';
  const runs = batsman.runs ?? 0;
  const balls = batsman.balls_faced ?? batsman.balls ?? 0;
  const fours = batsman.fours ?? 0;
  const sixes = batsman.sixes ?? 0;
  const sr = balls > 0 ? ((runs / balls) * 100).toFixed(1) : '0.0';

  const Content = (
    <View style={[styles.row, compact && styles.rowCompact]}>
      <View style={styles.nameCol}>
        <View style={styles.nameRow}>
          {isStriker && <View style={styles.strikerDot} />}
          <Text style={[styles.name, isStriker && styles.nameActive]} numberOfLines={1}>
            {name}
          </Text>
        </View>
        {batsman.how_out && (
          <Text style={styles.howOut} numberOfLines={1}>{batsman.how_out}</Text>
        )}
      </View>
      <Text style={[styles.stat, styles.runs]}>{runs}</Text>
      <Text style={styles.stat}>{balls}</Text>
      {!compact && <Text style={styles.stat}>{fours}</Text>}
      {!compact && <Text style={styles.stat}>{sixes}</Text>}
      <Text style={[styles.stat, styles.sr]}>{sr}</Text>
    </View>
  );

  if (onPress) {
    return <TouchableOpacity onPress={onPress} activeOpacity={0.7}>{Content}</TouchableOpacity>;
  }
  return Content;
};

export const BatsmanHeader = ({ compact = false }) => (
  <View style={[styles.row, styles.headerRow, compact && styles.rowCompact]}>
    <Text style={[styles.headerText, styles.nameCol]}>Batsman</Text>
    <Text style={[styles.headerText, styles.stat]}>R</Text>
    <Text style={[styles.headerText, styles.stat]}>B</Text>
    {!compact && <Text style={[styles.headerText, styles.stat]}>4s</Text>}
    {!compact && <Text style={[styles.headerText, styles.stat]}>6s</Text>}
    <Text style={[styles.headerText, styles.stat]}>SR</Text>
  </View>
);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER,
  },
  rowCompact: { paddingVertical: 6, paddingHorizontal: 8 },
  headerRow: { backgroundColor: COLORS.SURFACE, borderBottomWidth: 0 },
  nameCol: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { fontSize: 13, fontWeight: '600', color: COLORS.TEXT, flexShrink: 1 },
  nameActive: { fontWeight: '800', color: COLORS.ACCENT_LIGHT },
  howOut: { fontSize: 10, color: COLORS.TEXT_MUTED, marginTop: 2 },
  strikerDot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: COLORS.ACCENT,
  },
  stat: { width: 36, textAlign: 'center', fontSize: 13, fontWeight: '500', color: COLORS.TEXT_SECONDARY },
  runs: { fontWeight: '800', color: COLORS.TEXT },
  sr: { color: COLORS.TEXT_MUTED },
  headerText: { fontSize: 10, fontWeight: '700', color: COLORS.TEXT_MUTED, letterSpacing: 0.5 },
});

export default React.memo(BatsmanRow);
