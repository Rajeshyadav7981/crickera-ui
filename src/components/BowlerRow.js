import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS } from '../theme';

const BowlerRow = ({ bowler, isCurrent = false, onPress, compact = false }) => {
  if (!bowler) return null;

  const name = bowler.player_name || bowler.name || 'Unknown';
  const overs = bowler.overs_bowled ?? bowler.overs ?? '0';
  const maidens = bowler.maidens ?? 0;
  const runs = bowler.runs_conceded ?? bowler.runs ?? 0;
  const wickets = bowler.wickets ?? 0;
  const econ = bowler.economy_rate != null ? bowler.economy_rate.toFixed(1) : '0.0';

  const Content = (
    <View style={[styles.row, compact && styles.rowCompact]}>
      <View style={styles.nameCol}>
        <View style={styles.nameRow}>
          {isCurrent && <View style={styles.currentDot} />}
          <Text style={[styles.name, isCurrent && styles.nameActive]} numberOfLines={1}>
            {name}
          </Text>
        </View>
      </View>
      <Text style={styles.stat}>{overs}</Text>
      {!compact && <Text style={styles.stat}>{maidens}</Text>}
      <Text style={styles.stat}>{runs}</Text>
      <Text style={[styles.stat, styles.wickets]}>{wickets}</Text>
      <Text style={[styles.stat, styles.econ]}>{econ}</Text>
    </View>
  );

  if (onPress) {
    return <TouchableOpacity onPress={onPress} activeOpacity={0.7}>{Content}</TouchableOpacity>;
  }
  return Content;
};

export const BowlerHeader = ({ compact = false }) => (
  <View style={[styles.row, styles.headerRow, compact && styles.rowCompact]}>
    <Text style={[styles.headerText, styles.nameCol]}>Bowler</Text>
    <Text style={[styles.headerText, styles.stat]}>O</Text>
    {!compact && <Text style={[styles.headerText, styles.stat]}>M</Text>}
    <Text style={[styles.headerText, styles.stat]}>R</Text>
    <Text style={[styles.headerText, styles.stat]}>W</Text>
    <Text style={[styles.headerText, styles.stat]}>ER</Text>
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
  currentDot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: COLORS.SUCCESS,
  },
  stat: { width: 36, textAlign: 'center', fontSize: 13, fontWeight: '500', color: COLORS.TEXT_SECONDARY },
  wickets: { fontWeight: '800', color: COLORS.TEXT },
  econ: { color: COLORS.TEXT_MUTED },
  headerText: { fontSize: 10, fontWeight: '700', color: COLORS.TEXT_MUTED, letterSpacing: 0.5 },
});

export default React.memo(BowlerRow);
