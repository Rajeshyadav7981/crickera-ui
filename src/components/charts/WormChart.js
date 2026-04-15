import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Svg, { Polyline, Line, Circle, Text as SvgText, G, Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { COLORS } from '../../theme';

const { width: SCREEN_W } = Dimensions.get('window');

const WormChart = ({
  innings = [], // Array of { teamName, color, data: [{ over, cumulativeRuns }] }
  width = SCREEN_W - 32,
  height = 200,
  style,
}) => {
  if (!innings.length || !innings.some(i => i.data?.length)) return null;

  const chartPadding = { top: 16, right: 12, bottom: 28, left: 34 };
  const chartW = width - chartPadding.left - chartPadding.right;
  const chartH = height - chartPadding.top - chartPadding.bottom;

  const maxOvers = Math.max(...innings.map(i => i.data?.length || 0));
  const maxRuns = Math.max(...innings.flatMap(i => (i.data || []).map(d => d.cumulativeRuns)), 10);

  const xScale = (over) => chartPadding.left + (over / maxOvers) * chartW;
  const yScale = (runs) => chartPadding.top + chartH - (runs / maxRuns) * chartH;

  // Y-axis gridlines
  const ySteps = 4;
  const yStep = Math.ceil(maxRuns / ySteps);

  return (
    <View style={[styles.container, style]}>
      <Text style={styles.title}>Match Progression</Text>
      <Svg width={width} height={height}>
        {/* Y-axis gridlines */}
        {Array.from({ length: ySteps + 1 }, (_, i) => {
          const val = i * yStep;
          const y = yScale(val);
          return (
            <G key={`y-${i}`}>
              <Line x1={chartPadding.left} y1={y} x2={width - chartPadding.right} y2={y}
                stroke={COLORS.BORDER} strokeWidth={0.5} />
              <SvgText x={chartPadding.left - 6} y={y + 4}
                fill={COLORS.TEXT_MUTED} fontSize={9} textAnchor="end">
                {val}
              </SvgText>
            </G>
          );
        })}

        {/* X-axis labels */}
        {Array.from({ length: Math.min(maxOvers + 1, 11) }, (_, i) => {
          const over = Math.round((i / 10) * maxOvers);
          if (over > maxOvers) return null;
          return (
            <SvgText
              key={`x-${i}`}
              x={xScale(over)} y={chartPadding.top + chartH + 16}
              fill={COLORS.TEXT_MUTED} fontSize={8} textAnchor="middle"
            >
              {over}
            </SvgText>
          );
        })}

        {/* Lines */}
        {innings.map((inn, idx) => {
          if (!inn.data?.length) return null;
          const points = inn.data.map((d, i) =>
            `${xScale(i)},${yScale(d.cumulativeRuns)}`
          ).join(' ');

          return (
            <G key={idx}>
              <Polyline
                points={points}
                fill="none"
                stroke={inn.color || COLORS.ACCENT}
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* End dot */}
              {inn.data.length > 0 && (
                <Circle
                  cx={xScale(inn.data.length - 1)}
                  cy={yScale(inn.data[inn.data.length - 1].cumulativeRuns)}
                  r={4}
                  fill={inn.color || COLORS.ACCENT}
                />
              )}
            </G>
          );
        })}
      </Svg>

      {/* Legend */}
      <View style={styles.legend}>
        {innings.map((inn, i) => (
          <View key={i} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: inn.color || COLORS.ACCENT }]} />
            <Text style={styles.legendText} numberOfLines={1}>{inn.teamName}</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.CARD, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: COLORS.BORDER,
  },
  title: { fontSize: 14, fontWeight: '700', color: COLORS.TEXT, marginBottom: 8 },
  legend: { flexDirection: 'row', gap: 20, marginTop: 8, justifyContent: 'center' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: 140 },
  legendDot: { width: 10, height: 4, borderRadius: 2 },
  legendText: { fontSize: 10, color: COLORS.TEXT_MUTED },
});

export default React.memo(WormChart);
