import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Svg, { Rect, Line, Text as SvgText, G } from 'react-native-svg';
import { COLORS } from '../../theme';

const { width: SCREEN_W } = Dimensions.get('window');

const ManhattanChart = ({
  overs = [], // Array of { over: number, runs: number, wickets: number }
  width = SCREEN_W - 32,
  height = 180,
  barColor = COLORS.ACCENT,
  wicketColor = COLORS.DANGER,
  style,
}) => {
  if (!overs.length) return null;

  const chartPadding = { top: 16, right: 12, bottom: 28, left: 30 };
  const chartW = width - chartPadding.left - chartPadding.right;
  const chartH = height - chartPadding.top - chartPadding.bottom;
  const maxRuns = Math.max(...overs.map(o => o.runs), 6);
  const barWidth = Math.max(4, Math.min(20, (chartW / overs.length) - 2));
  const barGap = (chartW - barWidth * overs.length) / (overs.length + 1);

  // Y-axis gridlines
  const ySteps = 4;
  const yStep = Math.ceil(maxRuns / ySteps);

  return (
    <View style={[styles.container, style]}>
      <Text style={styles.title}>Runs per Over</Text>
      <Svg width={width} height={height}>
        {/* Y-axis gridlines and labels */}
        {Array.from({ length: ySteps + 1 }, (_, i) => {
          const val = i * yStep;
          const y = chartPadding.top + chartH - (val / maxRuns) * chartH;
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

        {/* Bars */}
        {overs.map((o, i) => {
          const x = chartPadding.left + barGap + i * (barWidth + barGap);
          const barH = (o.runs / maxRuns) * chartH;
          const y = chartPadding.top + chartH - barH;
          const hasWicket = o.wickets > 0;

          return (
            <G key={`bar-${i}`}>
              <Rect
                x={x} y={y} width={barWidth} height={barH}
                rx={2} fill={hasWicket ? wicketColor : barColor}
                opacity={0.85}
              />
              {/* Over number label */}
              {(i % Math.max(1, Math.floor(overs.length / 10)) === 0 || i === overs.length - 1) && (
                <SvgText
                  x={x + barWidth / 2}
                  y={chartPadding.top + chartH + 14}
                  fill={COLORS.TEXT_MUTED}
                  fontSize={8}
                  textAnchor="middle"
                >
                  {o.over}
                </SvgText>
              )}
              {/* Wicket indicator */}
              {hasWicket && (
                <SvgText
                  x={x + barWidth / 2} y={y - 4}
                  fill={wicketColor} fontSize={8} fontWeight="bold"
                  textAnchor="middle"
                >
                  W
                </SvgText>
              )}
            </G>
          );
        })}
      </Svg>
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: barColor }]} />
          <Text style={styles.legendText}>Runs</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: wicketColor }]} />
          <Text style={styles.legendText}>Wicket in over</Text>
        </View>
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
  legend: { flexDirection: 'row', gap: 16, marginTop: 8, justifyContent: 'center' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 2 },
  legendText: { fontSize: 10, color: COLORS.TEXT_MUTED },
});

export default React.memo(ManhattanChart);
