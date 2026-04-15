import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator,
  InteractionManager,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { matchesAPI } from '../../services/api';
import { COLORS } from '../../theme';
import Skeleton from '../../components/Skeleton';
import StepIndicator from '../../components/StepIndicator';

const PRIMARY = COLORS.ACCENT;
const BG = COLORS.BG;
const CARD_BORDER = COLORS.BORDER;
const SELECTED_BG = COLORS.ACCENT_SOFT;
const SELECTED_BORDER = COLORS.ACCENT;

const getInitials = (name) => {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return parts[0][0].toUpperCase();
};

const CheckCircle = ({ selected }) => (
  <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
    {selected && <Text style={styles.checkIcon}>{'✓'}</Text>}
  </View>
);

const RadioCircle = ({ selected }) => (
  <View style={[styles.radioOuter, selected && styles.radioOuterSelected]}>
    {selected && <View style={styles.radioInner} />}
  </View>
);

const PlayerCard = ({ player, selected, onPress, mode = 'checkbox' }) => {
  const initials = getInitials(player.full_name);
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={[styles.playerCard, selected && styles.playerCardSelected]}
    >
      {mode === 'checkbox' ? <CheckCircle selected={selected} /> : <RadioCircle selected={selected} />}
      <View style={styles.avatarCircle}>
        <Text style={styles.avatarText}>{initials}</Text>
      </View>
      <View style={styles.playerInfo}>
        <Text style={styles.playerName} numberOfLines={1}>{player.full_name}</Text>
        <Text style={styles.playerRole}>{player.role || 'Player'}</Text>
      </View>
    </TouchableOpacity>
  );
};

const SelectOpenersScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const { matchId, match, teams, selected, isSuperOver, soBatFirstId } = route.params;
  const [battingTeamId, setBattingTeamId] = useState(null);
  const [squad, setSquad] = useState([]);
  const [bowlingSquad, setBowlingSquad] = useState([]);
  const [selectedBatsmen, setSelectedBatsmen] = useState([]);
  const [bowler, setBowler] = useState(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    const tossWinner = match.toss_winner_id;
    const tossDecision = match.toss_decision;
    let batTeam, bowlTeam;

    if (isSuperOver) {
      // Use the user-selected bat-first team from the super over prompt
      if (soBatFirstId) {
        batTeam = soBatFirstId;
      } else {
        // Fallback: team that batted 2nd in main match bats first
        if (tossDecision === 'bat') {
          batTeam = tossWinner === match.team_a_id ? match.team_b_id : match.team_a_id;
        } else {
          batTeam = tossWinner;
        }
      }
      bowlTeam = batTeam === match.team_a_id ? match.team_b_id : match.team_a_id;
    } else {
      // Determine 1st innings batting team from toss
      if (tossDecision === 'bat') {
        batTeam = tossWinner;
        bowlTeam = tossWinner === match.team_a_id ? match.team_b_id : match.team_a_id;
      } else {
        bowlTeam = tossWinner;
        batTeam = tossWinner === match.team_a_id ? match.team_b_id : match.team_a_id;
      }
      // For 2nd innings: swap teams (1st innings team now bowls)
      if ((match.current_innings || 0) >= 1) {
        const temp = batTeam;
        batTeam = bowlTeam;
        bowlTeam = temp;
      }
    }

    setBattingTeamId(batTeam);
    const task = InteractionManager.runAfterInteractions(() => {
      loadSquads(batTeam, bowlTeam);
    });
    return () => task.cancel();
  }, []);

  const loadSquads = async (batId, bowlId) => {
    try {
      const [batRes, bowlRes] = await Promise.all([
        matchesAPI.getSquad(matchId, batId),
        matchesAPI.getSquad(matchId, bowlId),
      ]);
      setSquad(batRes.data);
      setBowlingSquad(bowlRes.data);
    } catch (e) {
      Alert.alert('Error', 'Failed to load squads');
    } finally {
      setLoading(false);
    }
  };

  const toggleBatsman = (playerId) => {
    setSelectedBatsmen((prev) => {
      if (prev.includes(playerId)) {
        return prev.filter((id) => id !== playerId);
      }
      if (prev.length >= 2) return prev;
      return [...prev, playerId];
    });
  };

  const handleStart = async () => {
    if (selectedBatsmen.length < 2 || !bowler) {
      return Alert.alert('Error', 'Select 2 opening batsmen and 1 opening bowler');
    }
    setStarting(true);
    try {
      await matchesAPI.startInnings(matchId, {
        batting_team_id: battingTeamId,
        striker_id: selectedBatsmen[0],
        non_striker_id: selectedBatsmen[1],
        bowler_id: bowler,
      });
      navigation.replace('LiveScoring', { matchId });
    } catch (e) {
      Alert.alert('Error', e.response?.data?.detail || 'Failed to start innings');
    } finally {
      setStarting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={{ paddingHorizontal: 16, paddingTop: 20 }}>
          <Skeleton width={120} height={16} style={{ marginBottom: 12 }} />
          {[1,2,3,4,5,6].map(i => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10, marginBottom: 8 }}>
              <Skeleton width={24} height={24} borderRadius={12} />
              <Skeleton width={40} height={40} borderRadius={20} />
              <View style={{ flex: 1 }}>
                <Skeleton width="60%" height={14} />
                <Skeleton width="30%" height={10} style={{ marginTop: 4 }} />
              </View>
            </View>
          ))}
        </View>
      </View>
    );
  }

  const batTeam = teams?.find((t) => t.id === battingTeamId) || { name: 'Batting Team' };
  const bowlTeam = teams?.find((t) => t.id !== battingTeamId) || { name: 'Bowling Team' };
  const canStart = selectedBatsmen.length === 2 && bowler !== null;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
          <View style={styles.backCircle}>
            <Text style={styles.backArrow}>{'<'}</Text>
          </View>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{isSuperOver ? 'Super Over' : 'Select Openers'}</Text>
          <Text style={styles.headerSubtitle}>{batTeam.name}</Text>
        </View>
        {/* Spacer to balance the back button */}
        <View style={styles.headerSpacer} />
      </View>

      {!isSuperOver && (
        <StepIndicator
          steps={['Create', 'Toss', 'Squad', 'Openers', 'Scoring']}
          currentStep={3}
        />
      )}

      {/* Info text */}
      <View style={styles.infoContainer}>
        <Text style={styles.infoText}>Select 2 opening batsmen and the opening bowler</Text>
      </View>

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Opening Batsmen Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Opening Batsmen</Text>
          <Text style={[styles.sectionCounter, selectedBatsmen.length === 2 && styles.sectionCounterDone]}>
            {selectedBatsmen.length === 2 ? '2 batsmen selected' : 'Select 2 batsmen'}
          </Text>
        </View>

        {squad.map((p) => (
          <PlayerCard
            key={p.player_id}
            player={p}
            selected={selectedBatsmen.includes(p.player_id)}
            onPress={() => toggleBatsman(p.player_id)}
            mode="checkbox"
          />
        ))}

        {/* Opening Bowler Section */}
        <View style={[styles.sectionHeader, { marginTop: 28 }]}>
          <Text style={styles.sectionTitle}>Opening Bowler</Text>
          <Text style={[styles.sectionCounter, bowler && styles.sectionCounterDone]}>
            {bowler ? '1 bowler selected' : 'Select 1 bowler'}
          </Text>
        </View>

        {bowlingSquad.map((p) => (
          <PlayerCard
            key={p.player_id}
            player={p}
            selected={bowler === p.player_id}
            onPress={() => setBowler(bowler === p.player_id ? null : p.player_id)}
            mode="radio"
          />
        ))}

        {/* Bottom padding for scroll above fixed button */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Fixed bottom button */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <TouchableOpacity
          style={[styles.startBtn, !canStart && styles.startBtnDisabled]}
          onPress={handleStart}
          disabled={starting || !canStart}
          activeOpacity={0.8}
        >
          <Text style={styles.startBtnText}>
            {starting ? 'Starting...' : isSuperOver ? 'Start Super Over' : 'Start Innings'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: BG,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.CARD,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backArrow: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.TEXT,
    marginLeft: -1,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.TEXT,
  },
  headerSubtitle: {
    fontSize: 13,
    fontWeight: '600',
    color: PRIMARY,
    marginTop: 2,
  },
  headerSpacer: {
    width: 40,
  },

  // Info
  infoContainer: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 12,
  },
  infoText: {
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
    textAlign: 'center',
  },

  // Scroll
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
  },

  // Section
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.TEXT,
  },
  sectionCounter: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.TEXT_MUTED,
  },
  sectionCounterDone: {
    color: PRIMARY,
    fontWeight: '600',
  },

  // Player card
  playerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.CARD,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
  },
  playerCardSelected: {
    backgroundColor: SELECTED_BG,
    borderColor: SELECTED_BORDER,
  },

  // Checkbox
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.BORDER_LIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  checkboxSelected: {
    backgroundColor: PRIMARY,
    borderColor: PRIMARY,
  },
  checkIcon: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    marginTop: -1,
  },

  // Radio
  radioOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.BORDER_LIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  radioOuterSelected: {
    borderColor: PRIMARY,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: PRIMARY,
  },

  // Avatar
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.ACCENT_SOFT,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.ACCENT_LIGHT,
  },

  // Player info
  playerInfo: {
    flex: 1,
  },
  playerName: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.TEXT,
  },
  playerRole: {
    fontSize: 12,
    color: COLORS.TEXT_MUTED,
    marginTop: 2,
  },

  // Bottom bar
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.BG,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.BORDER,
  },
  startBtn: {
    backgroundColor: PRIMARY,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  startBtnDisabled: {
    opacity: 0.4,
  },
  startBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default SelectOpenersScreen;
