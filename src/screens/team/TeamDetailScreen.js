import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator,
  InteractionManager,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { teamsAPI } from '../../services/api';
import { COLORS } from '../../theme';
import BackButton from '../../components/BackButton';
import Skeleton from '../../components/Skeleton';

const TeamDetailScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const { teamId } = route.params;
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const res = await teamsAPI.get(teamId);
      setData(res.data);
    } catch (e) {
      Alert.alert('Error', 'Failed to load team');
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => {
    const task = InteractionManager.runAfterInteractions(() => { load(); });
    return () => task.cancel();
  }, []));

  if (loading) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Skeleton width={40} height={40} borderRadius={20} />
          <Skeleton width={150} height={18} />
          <Skeleton width={40} height={40} borderRadius={20} />
        </View>
        <View style={{ paddingHorizontal: 20 }}>
          <Skeleton width="100%" height={140} borderRadius={16} style={{ marginTop: 8 }} />
          <View style={{ flexDirection: 'row', marginTop: 12, gap: 10 }}>
            <Skeleton width="30%" height={70} borderRadius={16} />
            <Skeleton width="30%" height={70} borderRadius={16} />
            <Skeleton width="30%" height={70} borderRadius={16} />
          </View>
          <Skeleton width={80} height={16} style={{ marginTop: 24, marginBottom: 12 }} />
          {[1,2,3,4,5].map(i => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12, marginBottom: 8 }}>
              <Skeleton width={44} height={44} borderRadius={22} />
              <View style={{ flex: 1 }}>
                <Skeleton width="60%" height={14} />
                <Skeleton width="30%" height={10} style={{ marginTop: 4 }} />
              </View>
              <Skeleton width={20} height={20} borderRadius={4} />
            </View>
          ))}
        </View>
      </View>
    );
  }

  if (!data) {
    return (
      <View style={styles.center}>
        <Text style={{ color: COLORS.TEXT_SECONDARY, fontSize: 15 }}>Team not found</Text>
      </View>
    );
  }

  const teamColor = data.team.color || COLORS.SUCCESS;
  const isOwner = user?.id === data.team.created_by;
  const playerCount = data.players?.length || 0;
  const matchCount = data.team.matches_played || 0;
  const winCount = data.team.wins || 0;

  const getRoleBadgeColor = (role) => {
    switch (role?.toLowerCase()) {
      case 'batsman': return 'rgba(37,99,235,0.15)';
      case 'bowler': return 'rgba(220,38,38,0.15)';
      case 'all-rounder': return 'rgba(22,163,74,0.15)';
      case 'wicket-keeper': return 'rgba(217,119,6,0.15)';
      default: return COLORS.SURFACE;
    }
  };

  const getRoleTextColor = (role) => {
    switch (role?.toLowerCase()) {
      case 'batsman': return '#60A5FA';
      case 'bowler': return '#F87171';
      case 'all-rounder': return '#4ADE80';
      case 'wicket-keeper': return '#FBBF24';
      default: return COLORS.TEXT_SECONDARY;
    }
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text style={styles.headerTitle} numberOfLines={1}>{data.team.name}</Text>
        {isOwner ? (
          <TouchableOpacity
            onPress={() => navigation.navigate('EditTeam', { teamId })}
            style={styles.editCircle}
            activeOpacity={0.7}
          >
            <Text style={styles.editIcon}>{'\u270E'}</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 36 }} />
        )}
      </View>

      <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Team Hero Card */}
        <View style={styles.heroCard}>
          <View style={[styles.accentStrip, { backgroundColor: teamColor }]} />
          <View style={styles.heroBody}>
            <View style={[styles.heroIcon, { backgroundColor: teamColor }]}>
              <Text style={styles.heroInitial}>{data.team.name?.charAt(0)}</Text>
            </View>
            <Text style={styles.heroName}>{data.team.name}</Text>
            {data.team.short_name ? (
              <View style={[styles.shortNameBadge, { backgroundColor: teamColor + '25' }]}>
                <Text style={[styles.shortNameText, { color: teamColor }]}>{data.team.short_name}</Text>
              </View>
            ) : null}
            {data.team.team_code ? (
              <View style={styles.teamCodeRow}>
                <Text style={styles.teamCodeLabel}>CODE</Text>
                <Text style={styles.teamCodeValue}>{data.team.team_code}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Stats Row */}
        <View style={styles.statsCard}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{playerCount}</Text>
            <Text style={styles.statLabel}>Players</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{matchCount}</Text>
            <Text style={styles.statLabel}>Matches</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{winCount}</Text>
            <Text style={styles.statLabel}>Wins</Text>
          </View>
        </View>

        {/* Players Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Players</Text>
          <Text style={styles.sectionCount}>{playerCount}</Text>
        </View>

        {playerCount === 0 && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No players added yet</Text>
          </View>
        )}

        {data.players.map((p) => (
          <TouchableOpacity
            key={p.player_id}
            style={styles.playerCard}
            onPress={() => navigation.navigate('PlayerProfile', { playerId: p.player_id })}
            activeOpacity={0.7}
          >
            <View style={[styles.playerAvatar, { backgroundColor: teamColor + '25' }]}>
              <Text style={[styles.playerInitial, { color: teamColor }]}>{p.first_name?.charAt(0)}</Text>
            </View>
            <View style={styles.playerInfo}>
              <Text style={styles.playerName} numberOfLines={1}>{p.full_name}</Text>
              <View style={styles.playerMeta}>
                <View style={[styles.roleBadge, { backgroundColor: getRoleBadgeColor(p.role) }]}>
                  <Text style={[styles.roleText, { color: getRoleTextColor(p.role) }]}>
                    {p.role || 'Player'}
                  </Text>
                </View>
                {p.is_captain && (
                  <View style={[styles.tagBadge, { backgroundColor: COLORS.ACCENT_SOFT }]}>
                    <Text style={[styles.tagText, { color: COLORS.ACCENT }]}>C</Text>
                  </View>
                )}
                {p.is_vice_captain && (
                  <View style={[styles.tagBadge, { backgroundColor: COLORS.WARNING_BG }]}>
                    <Text style={[styles.tagText, { color: COLORS.WARNING }]}>VC</Text>
                  </View>
                )}
                {p.is_wicket_keeper && (
                  <View style={styles.tagBadge}>
                    <Text style={styles.tagText}>WK</Text>
                  </View>
                )}
                {p.jersey_number ? (
                  <Text style={styles.jerseyText}>#{p.jersey_number}</Text>
                ) : null}
              </View>
            </View>
            {/* Quick role actions for owner */}
            {isOwner && (
              <TouchableOpacity
                style={{ paddingHorizontal: 8 }}
                onPress={() => {
                  const options = [];
                  if (!p.is_captain) options.push({ text: 'Make Captain', onPress: async () => {
                    try { await teamsAPI.updatePlayerRole(teamId, p.player_id, { is_captain: true }); load(); } catch {} }});
                  if (!p.is_vice_captain) options.push({ text: 'Make Vice Captain', onPress: async () => {
                    try { await teamsAPI.updatePlayerRole(teamId, p.player_id, { is_vice_captain: true }); load(); } catch {} }});
                  if (p.is_captain) options.push({ text: 'Remove Captain', onPress: async () => {
                    try { await teamsAPI.updatePlayerRole(teamId, p.player_id, { is_captain: false }); load(); } catch {} }});
                  if (p.is_vice_captain) options.push({ text: 'Remove Vice Captain', onPress: async () => {
                    try { await teamsAPI.updatePlayerRole(teamId, p.player_id, { is_vice_captain: false }); load(); } catch {} }});
                  options.push({ text: 'Cancel', style: 'cancel' });
                  Alert.alert(p.full_name, 'Update role', options);
                }}
              >
                <Text style={styles.chevron}>&#8942;</Text>
              </TouchableOpacity>
            )}
            {!isOwner && <Text style={styles.chevron}>{'\u203A'}</Text>}
          </TouchableOpacity>
        ))}

        {/* Add Player Button */}
        {isOwner && (
          <TouchableOpacity
            style={styles.addPlayerBtn}
            onPress={() => navigation.navigate('AddPlayer', { teamId })}
            activeOpacity={0.8}
          >
            <Text style={styles.addPlayerBtnText}>Add Player</Text>
          </TouchableOpacity>
        )}

        <View style={{ height: 30 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.BG,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.BG,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  backCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.CARD,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backArrow: {
    fontSize: 18,
    color: COLORS.TEXT,
    marginTop: -1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.TEXT,
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 12,
  },
  editCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.CARD,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editIcon: {
    fontSize: 16,
    color: COLORS.TEXT,
  },
  headerSpacer: {
    width: 40,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  // Hero Card
  heroCard: {
    backgroundColor: COLORS.CARD,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    overflow: 'hidden',
    marginTop: 8,
  },
  accentStrip: {
    height: 6,
    width: '100%',
  },
  heroBody: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 20,
  },
  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  heroInitial: {
    color: COLORS.WHITE,
    fontSize: 26,
    fontWeight: '700',
  },
  heroName: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.TEXT,
    textAlign: 'center',
  },
  shortNameBadge: {
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 20,
  },
  shortNameText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1,
  },
  teamCodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    backgroundColor: COLORS.SURFACE,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  teamCodeLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.TEXT_MUTED,
    letterSpacing: 1,
  },
  teamCodeValue: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.ACCENT_LIGHT,
    letterSpacing: 1.5,
  },
  // Stats
  statsCard: {
    backgroundColor: COLORS.CARD,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    marginTop: 12,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.TEXT,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.TEXT_SECONDARY,
    marginTop: 4,
    fontWeight: '500',
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: COLORS.BORDER,
  },
  // Players Section
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.TEXT,
  },
  sectionCount: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.TEXT_SECONDARY,
    marginLeft: 8,
    backgroundColor: COLORS.SURFACE,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    overflow: 'hidden',
  },
  emptyCard: {
    backgroundColor: COLORS.CARD,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    color: COLORS.TEXT_MUTED,
    fontSize: 14,
    fontStyle: 'italic',
  },
  playerCard: {
    backgroundColor: COLORS.CARD,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    padding: 14,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  playerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playerInitial: {
    fontSize: 17,
    fontWeight: '700',
  },
  playerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  playerName: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.TEXT,
  },
  playerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 6,
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  roleText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  tagBadge: {
    backgroundColor: 'rgba(217,119,6,0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  tagText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FBBF24',
  },
  jerseyText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.TEXT_MUTED,
  },
  chevron: {
    fontSize: 22,
    color: COLORS.TEXT_MUTED,
    marginLeft: 4,
  },
  // Add Player Button
  addPlayerBtn: {
    backgroundColor: COLORS.ACCENT,
    borderRadius: 16,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  addPlayerBtnText: {
    color: COLORS.WHITE,
    fontSize: 16,
    fontWeight: '700',
  },
});

export default TeamDetailScreen;
