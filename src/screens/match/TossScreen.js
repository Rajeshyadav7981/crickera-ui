import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { matchesAPI } from '../../services/api';
import { COLORS } from '../../theme';
import StepIndicator from '../../components/StepIndicator';

const TOSS_COLORS = {
  primary: COLORS.ACCENT,
  background: COLORS.BG,
  cardBg: COLORS.CARD,
  cardBorder: COLORS.BORDER,
  selectedBorder: COLORS.ACCENT,
  selectedBg: COLORS.ACCENT_SOFT,
  textPrimary: COLORS.TEXT,
  textSecondary: COLORS.TEXT_SECONDARY,
  white: COLORS.WHITE,
  disabledOpacity: 0.5,
  teamAColor: '#3B82F6',
  teamBColor: COLORS.RED,
};

const OVERS_PRESETS = [5, 10, 15, 20, 25, 30, 40, 50];

const TossScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const { matchId, match, teams } = route.params;
  const [winner, setWinner] = useState(null);
  const [decision, setDecision] = useState(null);
  const [loading, setLoading] = useState(false);
  // Per-match overs override. Defaults to whatever was set at fixture
  // generation (tournament default for tournament matches, or whatever the
  // user picked in QuickMatch). User can change here before the toss.
  const [overs, setOvers] = useState(String(match?.overs || 20));
  const [oversCustom, setOversCustom] = useState(false);

  const teamA = teams?.find(t => t.id === match.team_a_id) || { id: match.team_a_id, name: `Team ${match.team_a_id}` };
  const teamB = teams?.find(t => t.id === match.team_b_id) || { id: match.team_b_id, name: `Team ${match.team_b_id}` };

  const oversInt = parseInt(overs, 10);
  const isOversValid = Number.isFinite(oversInt) && oversInt >= 1 && oversInt <= 50;
  const isFormComplete = winner && decision && isOversValid;

  const handleToss = async () => {
    if (!winner || !decision) return Alert.alert('Error', 'Select toss winner and decision');
    if (!isOversValid) return Alert.alert('Invalid overs', 'Overs must be between 1 and 50');
    setLoading(true);
    try {
      // If the user changed overs from the original, persist it before recording the toss.
      if (oversInt !== match.overs) {
        await matchesAPI.update(matchId, { overs: oversInt });
      }
      await matchesAPI.toss(matchId, { toss_winner_id: winner.id, toss_decision: decision });
      navigation.replace('SelectSquad', {
        matchId,
        match: { ...match, overs: oversInt, toss_winner_id: winner.id, toss_decision: decision },
        teams,
      });
    } catch (e) {
      Alert.alert('Error', e.response?.data?.detail || 'Failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backArrow}>{'‹'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Toss</Text>
        <View style={styles.headerSpacer} />
      </View>

      <StepIndicator
        steps={['Create', 'Toss', 'Squad', 'Openers', 'Scoring']}
        currentStep={1}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Teams Card */}
        <View style={styles.teamsCard}>
          <View style={styles.teamDisplay}>
            <View style={[styles.teamColorCircle, { backgroundColor: TOSS_COLORS.teamAColor }]} />
            <Text style={styles.teamDisplayName} numberOfLines={1}>{teamA.name}</Text>
          </View>
          <View style={styles.vsContainer}>
            <Text style={styles.vsText}>vs</Text>
          </View>
          <View style={styles.teamDisplay}>
            <View style={[styles.teamColorCircle, { backgroundColor: TOSS_COLORS.teamBColor }]} />
            <Text style={styles.teamDisplayName} numberOfLines={1}>{teamB.name}</Text>
          </View>
        </View>

        {/* Match overs — defaults to tournament/match value, user can override */}
        <Text style={styles.sectionLabel}>Match Overs</Text>
        <Text style={styles.helperText}>
          Default from {match?.tournament_id ? 'the tournament' : 'match creation'}.
          Tap a preset or enter a custom value (1–50).
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.oversRow}
        >
          {OVERS_PRESETS.map((n) => {
            const active = !oversCustom && oversInt === n;
            return (
              <TouchableOpacity
                key={n}
                style={[styles.oversChip, active && styles.oversChipActive]}
                onPress={() => { setOvers(String(n)); setOversCustom(false); }}
              >
                <Text style={[styles.oversChipText, active && styles.oversChipTextActive]}>
                  {n}
                </Text>
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity
            style={[
              styles.oversChip,
              oversCustom && styles.oversChipActive,
            ]}
            onPress={() => setOversCustom(true)}
          >
            <Text style={[styles.oversChipText, oversCustom && styles.oversChipTextActive]}>
              Custom
            </Text>
          </TouchableOpacity>
        </ScrollView>
        {oversCustom && (
          <View style={styles.oversInputBox}>
            <TextInput
              style={styles.oversInput}
              value={overs}
              onChangeText={(t) => setOvers(t.replace(/[^0-9]/g, '').slice(0, 2))}
              keyboardType="number-pad"
              placeholder="e.g. 20"
              placeholderTextColor={TOSS_COLORS.textSecondary}
              maxLength={2}
            />
            <Text style={styles.oversInputSuffix}>overs</Text>
          </View>
        )}
        {!isOversValid && (
          <Text style={styles.oversWarning}>Overs must be between 1 and 50</Text>
        )}

        {/* Who won the toss? */}
        <Text style={styles.sectionLabel}>Who won the toss?</Text>
        <View style={styles.teamSelectionRow}>
          {[teamA, teamB].map((t, index) => {
            const isSelected = winner?.id === t.id;
            const teamColor = index === 0 ? TOSS_COLORS.teamAColor : TOSS_COLORS.teamBColor;
            return (
              <TouchableOpacity
                key={t.id}
                style={[
                  styles.teamSelectCard,
                  isSelected && styles.teamSelectCardActive,
                ]}
                onPress={() => setWinner(t)}
                activeOpacity={0.7}
              >
                <View style={[styles.teamSelectCircle, { backgroundColor: teamColor }]} />
                <Text
                  style={[
                    styles.teamSelectName,
                    isSelected && styles.teamSelectNameActive,
                  ]}
                  numberOfLines={2}
                >
                  {t.name}
                </Text>
                {isSelected && (
                  <View style={styles.checkMark}>
                    <Text style={styles.checkMarkText}>✓</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Chose to... */}
        <Text style={styles.sectionLabel}>Chose to...</Text>
        <View style={styles.decisionRow}>
          <TouchableOpacity
            style={[
              styles.decisionButton,
              decision === 'bat' && styles.decisionButtonActive,
            ]}
            onPress={() => setDecision('bat')}
            activeOpacity={0.7}
          >
            <Text style={styles.decisionIcon}>🏏</Text>
            <Text
              style={[
                styles.decisionLabel,
                decision === 'bat' && styles.decisionLabelActive,
              ]}
            >
              Bat
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.decisionButton,
              decision === 'bowl' && styles.decisionButtonActive,
            ]}
            onPress={() => setDecision('bowl')}
            activeOpacity={0.7}
          >
            <Text style={styles.decisionIcon}>🎾</Text>
            <Text
              style={[
                styles.decisionLabel,
                decision === 'bowl' && styles.decisionLabelActive,
              ]}
            >
              Bowl
            </Text>
          </TouchableOpacity>
        </View>

        {/* Spacer to push button down */}
        <View style={{ flex: 1, minHeight: 32 }} />
      </ScrollView>

      {/* Start Match Button */}
      <View style={[styles.bottomButtonContainer, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity
          style={[
            styles.startMatchButton,
            !isFormComplete && styles.startMatchButtonDisabled,
          ]}
          onPress={handleToss}
          disabled={loading || !isFormComplete}
          activeOpacity={0.8}
        >
          <Text style={styles.startMatchButtonText}>
            {loading ? 'Starting...' : 'Start Match'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: TOSS_COLORS.background,
  },

  /* Header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: TOSS_COLORS.cardBg,
    borderWidth: 1,
    borderColor: TOSS_COLORS.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backArrow: {
    fontSize: 24,
    color: TOSS_COLORS.textPrimary,
    marginTop: -2,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: TOSS_COLORS.textPrimary,
  },
  headerSpacer: {
    width: 40,
  },

  /* Scroll */
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    flexGrow: 1,
  },

  /* Teams Card */
  teamsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: TOSS_COLORS.cardBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: TOSS_COLORS.cardBorder,
    paddingVertical: 20,
    paddingHorizontal: 16,
    marginTop: 8,
  },
  teamDisplay: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  teamColorCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  teamDisplayName: {
    fontSize: 14,
    fontWeight: '600',
    color: TOSS_COLORS.textPrimary,
    textAlign: 'center',
  },
  vsContainer: {
    paddingHorizontal: 16,
  },
  vsText: {
    fontSize: 14,
    fontWeight: '600',
    color: TOSS_COLORS.textSecondary,
  },

  /* Section Label */
  sectionLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: TOSS_COLORS.textPrimary,
    marginTop: 28,
    marginBottom: 14,
  },
  helperText: {
    fontSize: 12,
    color: TOSS_COLORS.textSecondary,
    marginTop: -8,
    marginBottom: 12,
    lineHeight: 16,
  },

  /* Overs picker */
  oversRow: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 4,
    paddingRight: 16,
  },
  oversChip: {
    minWidth: 56,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: TOSS_COLORS.cardBg,
    borderWidth: 1.5,
    borderColor: TOSS_COLORS.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  oversChipActive: {
    backgroundColor: TOSS_COLORS.primary,
    borderColor: TOSS_COLORS.primary,
  },
  oversChipText: {
    fontSize: 14,
    fontWeight: '700',
    color: TOSS_COLORS.textSecondary,
  },
  oversChipTextActive: {
    color: TOSS_COLORS.white,
  },
  oversInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: TOSS_COLORS.cardBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: TOSS_COLORS.cardBorder,
  },
  oversInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: TOSS_COLORS.textPrimary,
    padding: 0,
  },
  oversInputSuffix: {
    fontSize: 13,
    fontWeight: '600',
    color: TOSS_COLORS.textSecondary,
  },
  oversWarning: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.RED,
  },

  /* Team Selection */
  teamSelectionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  teamSelectCard: {
    flex: 1,
    backgroundColor: TOSS_COLORS.cardBg,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: TOSS_COLORS.cardBorder,
    paddingVertical: 24,
    paddingHorizontal: 12,
    alignItems: 'center',
    gap: 10,
  },
  teamSelectCardActive: {
    borderColor: TOSS_COLORS.selectedBorder,
    backgroundColor: TOSS_COLORS.selectedBg,
  },
  teamSelectCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  teamSelectName: {
    fontSize: 15,
    fontWeight: '600',
    color: TOSS_COLORS.textPrimary,
    textAlign: 'center',
  },
  teamSelectNameActive: {
    color: COLORS.ACCENT_LIGHT,
  },
  checkMark: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: TOSS_COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMarkText: {
    color: TOSS_COLORS.white,
    fontSize: 13,
    fontWeight: '700',
  },

  /* Decision Buttons */
  decisionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  decisionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: TOSS_COLORS.cardBg,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: TOSS_COLORS.cardBorder,
    paddingVertical: 16,
    gap: 8,
  },
  decisionButtonActive: {
    borderColor: TOSS_COLORS.primary,
    backgroundColor: TOSS_COLORS.primary,
  },
  decisionIcon: {
    fontSize: 20,
  },
  decisionLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: TOSS_COLORS.textPrimary,
  },
  decisionLabelActive: {
    color: TOSS_COLORS.white,
  },

  /* Start Match Button */
  bottomButtonContainer: {
    paddingHorizontal: 20,
    paddingTop: 8,
    backgroundColor: TOSS_COLORS.background,
  },
  startMatchButton: {
    backgroundColor: TOSS_COLORS.primary,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startMatchButtonDisabled: {
    opacity: TOSS_COLORS.disabledOpacity,
  },
  startMatchButtonText: {
    color: TOSS_COLORS.white,
    fontSize: 17,
    fontWeight: '700',
  },
});

export default TossScreen;
