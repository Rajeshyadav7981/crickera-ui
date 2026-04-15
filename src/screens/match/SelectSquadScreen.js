import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator,
  InteractionManager,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { matchesAPI, teamsAPI } from '../../services/api';
import { COLORS } from '../../theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import BackButton from '../../components/BackButton';
import StepIndicator from '../../components/StepIndicator';
import Skeleton from '../../components/Skeleton';

const PRIMARY = COLORS.ACCENT;
const BG = COLORS.BG;
const CARD_BORDER = COLORS.BORDER;
const CHECKBOX_BORDER = COLORS.BORDER_LIGHT;
const TEXT_PRIMARY = COLORS.TEXT;
const TEXT_SECONDARY = COLORS.TEXT_SECONDARY;
const WHITE = COLORS.WHITE;

const getInitials = (name) => {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const SelectSquadScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const { matchId, match, teams } = route.params;
  const [currentTeamIdx, setCurrentTeamIdx] = useState(0);
  const [teamPlayers, setTeamPlayers] = useState({});
  const [selected, setSelected] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const teamIds = [match.team_a_id, match.team_b_id];
  const currentTeamId = teamIds[currentTeamIdx];
  const currentTeam = teams?.find(t => t.id === currentTeamId) || { name: `Team ${currentTeamId}` };

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      loadPlayers();
    });
    return () => task.cancel();
  }, []);

  const loadPlayers = async () => {
    try {
      for (const tid of teamIds) {
        const res = await teamsAPI.get(tid);
        const players = res.data.players || [];
        setTeamPlayers(prev => ({ ...prev, [tid]: players }));
        // Pre-select first 11 players (or all if team has <= 11)
        setSelected(prev => ({
          ...prev,
          [tid]: players.slice(0, 11).map(p => p.player_id),
        }));
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to load team players');
    } finally {
      setLoading(false);
    }
  };

  const togglePlayer = (playerId) => {
    const list = selected[currentTeamId] || [];
    if (list.includes(playerId)) {
      setSelected(prev => ({ ...prev, [currentTeamId]: list.filter(id => id !== playerId) }));
    } else {
      if (list.length >= 11) return Alert.alert('Max 11', 'You can select max 11 players');
      setSelected(prev => ({ ...prev, [currentTeamId]: [...list, playerId] }));
    }
  };

  const handleNext = async () => {
    const sel = selected[currentTeamId] || [];
    if (sel.length < 2) return Alert.alert('Error', 'Select at least 2 players');

    setSaving(true);
    try {
      await matchesAPI.setSquad(matchId, {
        team_id: currentTeamId,
        players: sel.map((id, i) => ({ player_id: id, batting_order: i + 1 })),
      });

      if (currentTeamIdx === 0) {
        setCurrentTeamIdx(1);
      } else {
        navigation.replace('SelectOpeners', { matchId, match, teams, selected });
      }
    } catch (e) {
      Alert.alert('Error', e.response?.data?.detail || 'Failed to set squad');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <View style={{ paddingHorizontal: 16, paddingTop: 20 }}>
          {[1,2,3,4,5,6].map(i => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10, marginBottom: 8 }}>
              <Skeleton width={24} height={24} borderRadius={12} />
              <Skeleton width={40} height={40} borderRadius={20} />
              <View style={{ flex: 1 }}>
                <Skeleton width="60%" height={14} />
                <Skeleton width="30%" height={10} style={{ marginTop: 4 }} />
              </View>
              <Skeleton width={40} height={20} borderRadius={8} />
            </View>
          ))}
        </View>
      </View>
    );
  }

  const players = teamPlayers[currentTeamId] || [];
  const sel = selected[currentTeamId] || [];
  const maxSquad = Math.min(11, players.length);
  const isSquadReady = sel.length >= 2 && sel.length <= 11;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <BackButton onPress={() => navigation.goBack()} />
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Select Squad</Text>
          <Text style={styles.headerSubtitle}>{currentTeam.name}</Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      <StepIndicator
        steps={['Create', 'Toss', 'Squad', 'Openers', 'Scoring']}
        currentStep={2}
      />

      {/* Info Bar */}
      <View style={styles.infoBar}>
        <Text style={styles.infoText}>
          {sel.length < 2
            ? `Select at least ${2 - sel.length} more player${2 - sel.length !== 1 ? 's' : ''}`
            : sel.length < maxSquad
              ? `${sel.length} selected — can add ${maxSquad - sel.length} more`
              : `Playing XI ready`
          }
        </Text>
        <View style={styles.countBadge}>
          <Text style={styles.countBadgeText}>{sel.length}/{maxSquad}</Text>
        </View>
      </View>

      {/* Player List */}
      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        {players.map((p) => {
          const isSelected = sel.includes(p.player_id);
          return (
            <TouchableOpacity
              key={p.player_id}
              style={[styles.playerCard, isSelected && styles.playerCardSelected]}
              onPress={() => togglePlayer(p.player_id)}
              activeOpacity={0.7}
            >
              {/* Checkbox */}
              <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                {isSelected && <MaterialCommunityIcons name="check" size={16} color={COLORS.ACCENT} />}
              </View>

              {/* Avatar */}
              <View style={[styles.avatar, isSelected && styles.avatarSelected]}>
                <Text style={[styles.avatarText, isSelected && styles.avatarTextSelected]}>
                  {getInitials(p.full_name)}
                </Text>
              </View>

              {/* Player Info */}
              <View style={styles.playerInfo}>
                <Text style={styles.playerName}>{p.full_name}</Text>
                <Text style={styles.playerRole}>{p.role?.replace('_', ' ') || 'Player'}</Text>
              </View>

              {/* Jersey Badge */}
              {p.jersey_number != null && (
                <View style={styles.jerseyBadge}>
                  <Text style={styles.jerseyText}>#{p.jersey_number}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
        {/* Bottom spacer so last card isn't hidden behind the fixed footer */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Bottom Fixed Area */}
      <View style={[styles.bottomArea, { paddingBottom: insets.bottom + 12 }]}>
        <Text style={styles.selectedCount}>
          {sel.length}/{maxSquad} selected
        </Text>
        <TouchableOpacity
          style={[styles.confirmBtn, !isSquadReady && styles.confirmBtnDisabled]}
          onPress={handleNext}
          disabled={saving || !isSquadReady}
          activeOpacity={0.8}
        >
          <Text style={styles.confirmBtnText}>
            {saving
              ? 'Saving...'
              : currentTeamIdx === 0
                ? 'Confirm Squad'
                : 'Confirm Squad'}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: BG,
  },

  /* Header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: COLORS.CARD,
    borderBottomWidth: 1,
    borderBottomColor: CARD_BORDER,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.SURFACE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backArrow: {
    fontSize: 20,
    color: TEXT_PRIMARY,
    fontWeight: '600',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: TEXT_PRIMARY,
  },
  headerSubtitle: {
    fontSize: 13,
    fontWeight: '600',
    color: PRIMARY,
    marginTop: 2,
  },
  headerRight: {
    width: 36,
  },

  /* Info Bar */
  infoBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 10,
    backgroundColor: COLORS.CARD,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  infoText: {
    fontSize: 13,
    fontWeight: '500',
    color: TEXT_SECONDARY,
    flex: 1,
  },
  countBadge: {
    backgroundColor: PRIMARY,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginLeft: 10,
  },
  countBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: WHITE,
  },

  /* Player List */
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },

  /* Player Card */
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
    backgroundColor: COLORS.ACCENT_SOFT,
    borderColor: COLORS.ACCENT_SOFT_BORDER,
  },

  /* Checkbox */
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: CHECKBOX_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: PRIMARY,
    borderColor: PRIMARY,
  },
  checkIcon: {
    color: WHITE,
    fontSize: 14,
    fontWeight: '700',
    marginTop: -1,
  },

  /* Avatar */
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.SURFACE,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  avatarSelected: {
    backgroundColor: COLORS.ACCENT_SOFT,
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.TEXT_SECONDARY,
  },
  avatarTextSelected: {
    color: COLORS.ACCENT_LIGHT,
  },

  /* Player Info */
  playerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  playerName: {
    fontSize: 15,
    fontWeight: '600',
    color: TEXT_PRIMARY,
  },
  playerRole: {
    fontSize: 12,
    color: TEXT_SECONDARY,
    marginTop: 2,
    textTransform: 'capitalize',
  },

  /* Jersey Badge */
  jerseyBadge: {
    backgroundColor: COLORS.SURFACE,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  jerseyText: {
    fontSize: 13,
    fontWeight: '600',
    color: TEXT_SECONDARY,
  },

  /* Bottom Fixed Area */
  bottomArea: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.CARD,
    borderTopWidth: 1,
    borderTopColor: CARD_BORDER,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  selectedCount: {
    fontSize: 14,
    fontWeight: '600',
    color: TEXT_SECONDARY,
    textAlign: 'center',
    marginBottom: 10,
  },
  confirmBtn: {
    backgroundColor: PRIMARY,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  confirmBtnDisabled: {
    opacity: 0.5,
  },
  confirmBtnText: {
    color: WHITE,
    fontSize: 16,
    fontWeight: '700',
  },
});

export default SelectSquadScreen;
