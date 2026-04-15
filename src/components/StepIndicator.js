import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS } from '../theme';
import Icon from './Icon';

/**
 * Reusable step indicator with progress line, numbered dots, and tick marks.
 *
 * Usage:
 *   <StepIndicator
 *     steps={['Create Match', 'Toss', 'Select Squad', 'Select Openers', 'Start Match']}
 *     currentStep={2}
 *     onStepPress={(index) => handleGoToStep(index)}
 *   />
 *
 * Props:
 *   steps        - Array of step label strings
 *   currentStep  - Current active step index (0-based)
 *   onStepPress  - Called with step index when a completed step is tapped (for undo/go-back)
 *   compact      - Show smaller dots without labels (for tight spaces)
 */
const StepIndicator = ({ steps = [], currentStep = 0, onStepPress, compact = false }) => {
  if (!steps.length) return null;

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        {steps.map((label, i) => {
          const done = i < currentStep;
          const active = i === currentStep;
          const upcoming = i > currentStep;
          const canPress = done && onStepPress;

          return (
            <TouchableOpacity
              key={i}
              style={styles.step}
              onPress={() => canPress && onStepPress(i)}
              disabled={!canPress}
              activeOpacity={canPress ? 0.7 : 1}
            >
              <View style={[
                styles.dot,
                compact && styles.dotCompact,
                done && styles.dotDone,
                active && styles.dotActive,
              ]}>
                {done ? (
                  <Text style={styles.tickText}>✓</Text>
                ) : (
                  <Text style={[
                    styles.dotText,
                    compact && styles.dotTextCompact,
                    active && styles.dotTextActive,
                  ]}>
                    {i + 1}
                  </Text>
                )}
              </View>
              {!compact && (
                <Text style={[
                  styles.label,
                  done && styles.labelDone,
                  active && styles.labelActive,
                ]} numberOfLines={1}>
                  {label}
                </Text>
              )}
            </TouchableOpacity>
          );
        })}

        {/* Progress line behind dots */}
        <View style={[styles.line, compact && styles.lineCompact]}>
          <View style={[
            styles.lineFill,
            { width: `${(currentStep / Math.max(steps.length - 1, 1)) * 100}%` },
          ]} />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.CARD,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER,
  },
  row: {
    flexDirection: 'row',
    position: 'relative',
  },
  step: {
    flex: 1,
    alignItems: 'center',
    zIndex: 1,
  },
  dot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: COLORS.SURFACE,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  dotCompact: { width: 24, height: 24, borderRadius: 12, marginBottom: 0 },
  dotDone: {
    backgroundColor: COLORS.ACCENT,
    borderColor: COLORS.ACCENT,
  },
  dotActive: {
    backgroundColor: COLORS.SURFACE_LIGHT || COLORS.SURFACE,
    borderColor: COLORS.ACCENT,
  },
  dotText: { fontSize: 12, fontWeight: '700', color: COLORS.TEXT_MUTED },
  dotTextCompact: { fontSize: 10 },
  dotTextActive: { color: COLORS.ACCENT, fontWeight: '800' },
  tickText: { fontSize: 14, fontWeight: '800', color: COLORS.TEXT },
  label: { fontSize: 9, fontWeight: '500', color: COLORS.TEXT_MUTED, textAlign: 'center' },
  labelDone: { color: COLORS.ACCENT },
  labelActive: { color: COLORS.TEXT, fontWeight: '700' },
  line: {
    position: 'absolute',
    left: 40,
    right: 40,
    top: 14,
    height: 2,
    backgroundColor: COLORS.BORDER,
    borderRadius: 1,
  },
  lineCompact: { top: 11 },
  lineFill: {
    height: 2,
    backgroundColor: COLORS.ACCENT,
    borderRadius: 1,
  },
});

export default React.memo(StepIndicator);
