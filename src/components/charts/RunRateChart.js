import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Svg, { Polyline, Line, Circle, Text as SvgText, G, Rect } from 'react-native-svg';
import { COLORS } from '../../theme';

const { width: SCREEN_W } = Dimensions.get('window');

const RunRateChart = ({
  data = [], // Array of { over, runRate, requiredRate? }
  width = SCREEN_W - 32,
  height = 160,
  lineColor = COLORS.ACCENT,
  requiredColor = COLORS.DANGER,
  style,
}) => {
  if (!data.length) return null;

  const chartPadding = { top: 16, right: 12, bottom: 28, left: 34 };
  const chartW = width - chartPadding.left - chartPadding.right;
  const chartH = height - chartPadding.top - chartPadding.bottom;

  const maxRate = Math.max(
    ...data.map(d => Math.max(d.runRate || 0, d.requiredRate || 0)),
    6
  );

  const xScale = (i) => chartPadding.left + (i / (data.length - 1 || 1)) * chartW;
  const yScale = (rate) => chartPadding.top + chartH - (rate / maxRate) * chartH;

  const hasRequired = data.some(d => d.requiredRate != null);

  // Build points
  const actualPoints = data.map((d, i) => `${xScale(i)},${yScale(d.runRate)}`).join(' ');
  const requiredPoints = hasRequired
    ? data.filter(d => d.requiredRate != null).map((d, i) => `${xScale(data.indexOf(d))},${yScale(d.requiredRate)}`).join(' ')
    : '';

  // Y gridlines
  const ySteps = 4;
  const yStep = Math.ceil(maxRate / ySteps);

  return (
    <View style={[styles.container, style]}>
      <Text style={styles.title}>Run Rate</Text>
      <Svg width={width} height={height}>
        {/* Y gridlines */}
        {Array.from({ length: ySteps + 1 }, (_, i) => {
          const val = i * yStep;
          const y = yScale(val);
          return (
            <G key={`y-${i}`}>
              <Line x1={chartPadding.left} y1={y} x2={width - chartPadding.right} y2={y}
                stroke={COLORS.BORDER} strokeWidth={0.5} />
              <SvgText x={chartPadding.left - 6} y={y + 4}
                fill={COLORS.TEXT_MUTED} fontSize={9} textAnchor="end">
                {val.toFixed(1)}
              </SvgText>
            </G>
          );
        })}

        {/* Actual run rate line */}
        <Polyline
          points={actualPoints}
          fill="none"
          stroke={lineColor}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Required run rate line */}
        {requiredPoints && (
          <Polyline
            points={requiredPoints}
            fill="none"
            stroke={requiredColor}
            strokeWidth={1.5}
            strokeDasharray="6,4"
            strokeLinecap="round"
          />
        )}

        {/* X labels */}
        {data.filter((_, i) => i % Math.max(1, Math.floor(data.length / 8)) === 0 || i === data.length - 1).map((d, i) => (
          <SvgText
            key={`x-${i}`}
            x={xScale(data.indexOf(d))} y={chartPadding.top + chartH + 16}
            fill={COLORS.TEXT_MUTED} fontSize={8} textAnchor="middle"
          >
            {d.over}
          </SvgText>
        ))}
      </Svg>

      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendLine, { backgroundColor: lineColor }]} />
          <Text style={styles.legendText}>Current RR</Text>
        </View>
        {hasRequired && (
          <View style={styles.legendItem}>
            <View style={[styles.legendLine, styles.legendDashed, { backgroundColor: requiredColor }]} />
            <Text style={styles.legendText}>Required RR</Text>
          </View>
        )}
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
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendLine: { width: 14, height: 3, borderRadius: 1.5 },
  legendDashed: { borderStyle: 'dashed' },
  legendText: { fontSize: 10, color: COLORS.TEXT_MUTED },
});

export default React.memo(RunRateChart);
