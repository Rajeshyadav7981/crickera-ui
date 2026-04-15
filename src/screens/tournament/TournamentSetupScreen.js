import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert,
  ActivityIndicator, TextInput, InteractionManager,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tournamentsAPI, teamsAPI } from '../../services/api';
import { COLORS } from '../../theme';
import { MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { useLocation } from '../../hooks/useLocation';
import {
  ROUND_CATALOG,
  byName as roundByName,
  nextRoundFor,
  pairTeams,
} from './roundRegistry';
import {
  TOURNAMENT_FORMATS,
  formatByKey,
} from './tournamentFormats';

const PRIMARY = COLORS.ACCENT;
const BG = COLORS.BG;
const DARK = COLORS.TEXT;
const BORDER = COLORS.BORDER;
const MUTED = COLORS.TEXT_MUTED;

/**
 * TournamentSetupScreen — single supported flow: league_knockout (progressive).
 *
 * Two entry modes:
 *
 *   1. INITIAL setup (route.params.addNextStage falsy)
 *      Wizard: [Teams] → [League Round]
 *      The League Round step shows the round name, the pool of teams (with
 *      drag-to-reorder for seeding), and one button that creates the league
 *      stage + fixtures in a single API chain. Then we route to
 *      TournamentDetail.
 *
 *   2. ADD-NEXT-STAGE setup (route.params.addNextStage === true)
 *      Single screen. Auto-picks the next knockout round from
 *      `roundRegistry.nextRoundFor(qualifiedTeams.length)`. Shows the
 *      cross-seeded pairs and lets the admin swap teams between pairs
 *      before creating the round. Then we return to TournamentDetail.
 *
 * Adding a new round type later is a single registry entry — see
 * roundRegistry.js. None of the code below references specific round
 * names directly.
 */
const TournamentSetupScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const { location: userLocation } = useLocation();
  const {
    tournamentId, tournamentName, existingTeams,
    qualifiedTeams, addNextStage,
  } = route.params || {};

  // Mode flag — drives which screen we render.
  const isAddNextStage = !!addNextStage;

  // ===== Shared state =====
  const [loading, setLoading] = useState(false);
  const [tournamentTeams, setTournamentTeams] = useState(
    isAddNextStage && qualifiedTeams?.length > 0 ? qualifiedTeams : (existingTeams || []),
  );
  const [allTeams, setAllTeams] = useState([]);
  const [teamSearch, setTeamSearch] = useState('');
  const [searchMode, setSearchMode] = useState('name');
  const [teamsLoading, setTeamsLoading] = useState(false);

  // ===== Initial-flow state =====
  // Steps: 0 = Teams, 1 = Format, 2 = League Round
  const [step, setStep] = useState(0);
  // Selected format key (from tournamentFormats.js). Defaults to the first
  // catalog entry — today that's `league_knockout`. When more formats land
  // later, the picker step lets the user choose.
  const [formatKey, setFormatKey] = useState(TOURNAMENT_FORMATS[0]?.key || 'league_knockout');
  const [roundName, setRoundName] = useState('League Matches');
  // PRIMARY KNOB: how many teams the admin wants in each group. Group count
  // is *derived* from this — see `numGroups` below — so the admin never picks
  // a count that doesn't fit the team pool.
  const [teamsPerGroup, setTeamsPerGroup] = useState(4);
  // Top N teams qualifying *from each group*. Capped at teamsPerGroup - 1
  // so at least one team in every group is eliminated.
  const [topNPerGroup, setTopNPerGroup] = useState(2);
  // groupAssignments: array of arrays of team ids — one inner array per group.
  // Editable: admin can swap a team between groups before creating fixtures.
  const [groupAssignments, setGroupAssignments] = useState([]); // [[id,id,...], ...]
  // For the "swap team between groups" picker: { fromGroup, teamId } | null
  const [groupSwapFor, setGroupSwapFor] = useState(null);

  // Derived: group count = ceil(totalTeams / teamsPerGroup), at least 1.
  const numGroups = Math.max(
    1,
    Math.ceil(tournamentTeams.length / Math.max(1, teamsPerGroup)),
  );

  // ===== Add-next-stage state =====
  // The round the admin has chosen to create. Defaults to the auto-pick from
  // the registry but the admin can override on the round picker below.
  const [chosenRoundName, setChosenRoundName] = useState(null);
  // Local draft of (teamA, teamB) pairs the admin can edit before submitting.
  // (Only used when the chosen round is a knockout — league-kind rounds use
  // the shared group config block instead.)
  const [pairsDraft, setPairsDraft] = useState([]); // [[idA, idB], ...]
  const [swapPickerFor, setSwapPickerFor] = useState(null); // { pairIdx, slot } | null

  // ===== Effects =====
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      loadTeams();
    });
    return () => task.cancel();
  }, []);

  // When the team count changes, pick a sensible default `teamsPerGroup`
  // AND clamp it to a value that produces no 1-team remainder group.
  //
  // Helper: is `n` a valid teams-per-group for `total` total teams?
  const isValidTpg = (n, total) => {
    if (n < 2 || n > total) return false;
    const groups = Math.ceil(total / n);
    if (groups === 1) return true;
    const remainder = total - (groups - 1) * n;
    return remainder >= 2;
  };

  // The group config (teams per group, group distribution, top-N clamping)
  // is shared between two render branches:
  //   - Initial flow: League Round step
  //   - Add-next-stage flow: when the admin picks a league-kind round
  //     (Super League, etc.) the same controls render below the picker.
  // So these effects run in BOTH modes — only one branch is visible at a
  // time, and `tournamentTeams` is the right list in each (full roster
  // initially, qualified roster in add-next-stage).
  useEffect(() => {
    const n = tournamentTeams.length;
    if (n === 0) return;
    // Preferred defaults by size bucket
    let desired;
    if (n <= 4) desired = n;
    else if (n <= 12) desired = 4;
    else desired = 5;
    // If desired isn't valid for this team count, walk upward then downward
    // until we find a valid option.
    if (!isValidTpg(desired, n)) {
      let found = null;
      for (let d = desired + 1; d <= n && !found; d++) if (isValidTpg(d, n)) found = d;
      for (let d = desired - 1; d >= 2 && !found; d--) if (isValidTpg(d, n)) found = d;
      desired = found || n;
    }
    setTeamsPerGroup(desired);
  }, [tournamentTeams.length]);

  // Auto-distribute teams across groups via STRICT FILL whenever team list
  // or per-group size changes:
  //   Group A gets the first `teamsPerGroup` teams,
  //   Group B gets the next `teamsPerGroup` teams,
  //   … the last group gets the remainder.
  useEffect(() => {
    const tpg = Math.max(1, teamsPerGroup);
    const groups = Array.from({ length: numGroups }, () => []);
    tournamentTeams.forEach((t, idx) => {
      const gi = Math.min(numGroups - 1, Math.floor(idx / tpg));
      groups[gi].push(t.id);
    });
    setGroupAssignments(groups);
  }, [tournamentTeams, numGroups, teamsPerGroup]);

  // Clamp top-N-per-group whenever the group layout changes. The cap is the
  // SMALLEST group's size (so at most "everyone from the smallest group"
  // qualifies).
  useEffect(() => {
    if (!groupAssignments.length) return;
    const minGroupSize = Math.min(...groupAssignments.map((g) => g.length || 0));
    if (minGroupSize < 1) return;
    if (topNPerGroup > minGroupSize) setTopNPerGroup(minGroupSize);
  }, [groupAssignments, topNPerGroup]);

  // For add-next-stage: seed the chosen round from the registry's auto-pick
  // whenever the team count changes (only if user hasn't already picked one).
  useEffect(() => {
    if (!isAddNextStage) return;
    if (chosenRoundName) return;
    const auto = nextRoundFor(tournamentTeams.length);
    if (auto) setChosenRoundName(auto.name);
  }, [tournamentTeams.length, isAddNextStage, chosenRoundName]);

  // Build the pairs draft from the currently-chosen round (knockout only).
  // For league-kind rounds we don't draft pairs — the round-robin generator
  // creates every pairing on the backend.
  useEffect(() => {
    if (!isAddNextStage) return;
    const round = chosenRoundName ? roundByName(chosenRoundName) : nextRoundFor(tournamentTeams.length);
    if (!round || round.kind !== 'knockout') {
      setPairsDraft([]);
      return;
    }
    // Cap teams to the round's max (e.g. 6 teams chosen for QF — backend
    // bye logic will fill in seeds, but for the preview we just take the
    // first N where N = min(teamCount, round.maxTeams or teamCount)).
    const cap = round.maxTeams || tournamentTeams.length;
    const ids = tournamentTeams.slice(0, cap).map((t) => t.id);
    setPairsDraft(pairTeams(round.pairStrategy, ids));
  }, [tournamentTeams, chosenRoundName, isAddNextStage]);


  const loadTeams = async () => {
    setTeamsLoading(true);
    try {
      const params = {};
      if (userLocation) {
        params.lat = userLocation.latitude;
        params.lng = userLocation.longitude;
      }
      const res = await teamsAPI.list(params);
      setAllTeams(res.data || []);
    } catch (_) {}
    setTeamsLoading(false);
  };

  // ===== Team management =====
  const addTeamToTournament = async (team) => {
    if (tournamentTeams.find((t) => t.id === team.id)) return;
    try {
      await tournamentsAPI.addTeam(tournamentId, team.id);
      setTournamentTeams((prev) => [...prev, team]);
    } catch (e) {
      Alert.alert('Error', e.response?.data?.detail || 'Failed to add team');
    }
  };

  const removeTeamFromTournament = async (teamId) => {
    try {
      await tournamentsAPI.removeTeam(tournamentId, teamId);
      setTournamentTeams((prev) => prev.filter((t) => t.id !== teamId));
    } catch (e) {
      Alert.alert('Error', e.response?.data?.detail || 'Failed to remove team');
    }
  };

  const teamById = useCallback(
    (id) => tournamentTeams.find((t) => t.id === id),
    [tournamentTeams],
  );

  const filteredAvailable = useMemo(() => {
    const taken = new Set(tournamentTeams.map((t) => t.id));
    const q = teamSearch.trim().toLowerCase();
    return allTeams.filter((t) => {
      if (taken.has(t.id)) return false;
      if (!q) return true;
      if (searchMode === 'code') return (t.team_code || '').toLowerCase() === q;
      return (
        (t.name || '').toLowerCase().includes(q) ||
        (t.short_name || '').toLowerCase().includes(q)
      );
    });
  }, [allTeams, tournamentTeams, teamSearch, searchMode]);

  // ===== Initial flow: group editing =====
  // Move a team out of one group into another (or swap with a team there).
  const moveTeamToGroup = (fromIdx, teamId, toIdx) => {
    setGroupAssignments((prev) => {
      const next = prev.map((g) => [...g]);
      next[fromIdx] = next[fromIdx].filter((id) => id !== teamId);
      next[toIdx] = [...next[toIdx], teamId];
      return next;
    });
    setGroupSwapFor(null);
  };

  const reorderInGroup = (groupIdx, teamIdx, dir) => {
    setGroupAssignments((prev) => {
      const next = prev.map((g) => [...g]);
      const arr = next[groupIdx];
      const swap = teamIdx + dir;
      if (swap < 0 || swap >= arr.length) return prev;
      [arr[teamIdx], arr[swap]] = [arr[swap], arr[teamIdx]];
      return next;
    });
  };

  // ===== Initial flow: create the league round =====
  const createLeagueRound = async () => {
    if (tournamentTeams.length < 2) {
      return Alert.alert('Need teams', 'Add at least 2 teams before creating the league round');
    }
    // Validate every group has at least 2 teams (need a pair to play)
    const tooSmall = groupAssignments.findIndex((g) => g.length < 2);
    if (tooSmall >= 0) {
      return Alert.alert(
        'Group too small',
        `Group ${String.fromCharCode(65 + tooSmall)} only has ${groupAssignments[tooSmall].length} team(s). Pick a different "teams per group" or add more teams.`,
      );
    }
    // Qualifying count must be ≤ smallest group size
    const minGroupSize = Math.min(...groupAssignments.map((g) => g.length));
    if (topNPerGroup > minGroupSize) {
      return Alert.alert(
        'Top N too high',
        `Smallest group has ${minGroupSize} teams — qualifying count must be at most ${minGroupSize}.`,
      );
    }
    setLoading(true);
    try {
      const cleanName =
        (roundName || 'League Matches')
          .trim()
          .replace(/\s+/g, '_')
          .toLowerCase() || 'league_matches';

      // 1. Create the league stage with qualification rule (top N per group)
      const stageRes = await tournamentsAPI.setupStages(tournamentId, [{
        name: cleanName,
        qualification_rule: { top_n: topNPerGroup, from: 'each_group' },
      }]);
      const stages = stageRes.data?.stages || [];
      if (!stages.length) throw new Error('Stage creation failed');
      const stageId = stages[0].id;

      // 2. Create one group per pool with its assigned team ids
      const groupsPayload = groupAssignments.map((teamIds, i) => ({
        name: numGroups === 1
          ? (roundName || 'League')
          : `Group ${String.fromCharCode(65 + i)}`,
        team_ids: teamIds,
      }));
      await tournamentsAPI.setupGroups(tournamentId, stageId, groupsPayload);

      // 3. Generate round-robin fixtures per group (backend uses Circle Method)
      await tournamentsAPI.generateMatches(tournamentId, stageId);

      navigation.replace('TournamentDetail', { tournamentId });
    } catch (e) {
      Alert.alert(
        'Setup failed',
        e.response?.data?.detail || e.message || 'Could not create the league round',
      );
    } finally {
      setLoading(false);
    }
  };

  // ===== Add-next-stage flow: pair swap =====
  const swapTeams = (aPair, aSlot, bPair, bSlot) => {
    setPairsDraft((prev) => {
      const next = prev.map((p) => [...p]);
      const tmp = next[aPair][aSlot];
      next[aPair][aSlot] = next[bPair][bSlot];
      next[bPair][bSlot] = tmp;
      return next;
    });
    setSwapPickerFor(null);
  };

  // ===== Add-next-stage flow: create the round =====
  const createNextRound = async () => {
    const round = chosenRoundName
      ? roundByName(chosenRoundName)
      : nextRoundFor(tournamentTeams.length);
    if (!round) {
      return Alert.alert(
        'Cannot pick a round',
        `No round in the catalog matches ${tournamentTeams.length} teams.`,
      );
    }

    // ── LEAGUE-KIND BRANCH ──────────────────────────────────────────────
    // Reuses the shared group config (teamsPerGroup → numGroups → top-N
    // per group). Same backend chain as the initial league round.
    if (round.kind === 'league') {
      if (tournamentTeams.length < 3) {
        return Alert.alert(
          'Need more teams',
          'A league round needs at least 3 teams.',
        );
      }
      const tooSmall = groupAssignments.findIndex((g) => g.length < 2);
      if (tooSmall >= 0) {
        return Alert.alert(
          'Group too small',
          `Group ${String.fromCharCode(65 + tooSmall)} only has ${groupAssignments[tooSmall].length} team(s). Pick a different "teams per group".`,
        );
      }
      const minGroupSize = Math.min(...groupAssignments.map((g) => g.length));
      if (topNPerGroup > minGroupSize) {
        return Alert.alert(
          'Top N too high',
          `Smallest group has ${minGroupSize} teams — qualifying count must be at most ${minGroupSize}.`,
        );
      }
      setLoading(true);
      try {
        const stageRes = await tournamentsAPI.setupStages(tournamentId, [{
          name: round.name,
          qualification_rule: { top_n: topNPerGroup, from: 'each_group' },
        }]);
        const stages = stageRes.data?.stages || [];
        if (!stages.length) throw new Error('Stage creation failed');
        const stageId = stages[0].id;

        const groupsPayload = groupAssignments.map((teamIds, i) => ({
          name: numGroups === 1
            ? round.label
            : `${round.label} ${String.fromCharCode(65 + i)}`,
          team_ids: teamIds,
        }));
        await tournamentsAPI.setupGroups(tournamentId, stageId, groupsPayload);
        await tournamentsAPI.generateMatches(tournamentId, stageId);

        navigation.replace('TournamentDetail', { tournamentId });
      } catch (e) {
        Alert.alert(
          'Failed to create round',
          e.response?.data?.detail || e.message || 'Could not create the league round',
        );
      } finally {
        setLoading(false);
      }
      return;
    }

    // ── KNOCKOUT-KIND BRANCH ────────────────────────────────────────────
    if (pairsDraft.length === 0) {
      return Alert.alert('No pairs', 'Need at least one pair to create this round.');
    }
    setLoading(true);
    try {
      // Flatten the pairs back into a seed-ordered team list. The backend's
      // generate_group_matches uses the same pair_strategy from the registry,
      // so as long as we feed it the team list in the order pairs[0][0],
      // pairs[0][1], pairs[1][0], pairs[1][1], ..., the cross-seed will
      // re-pair them exactly the way the admin arranged them.
      //
      // Cross-seed pairs (1vN, 2vN-1, ...) — to reproduce a custom pair list,
      // build the team_ids list as: [a0, a1, a2, ..., aK, bK, ..., b2, b1, b0]
      // where ai is pairs[i][0] (top half) and bi is pairs[i][1] (bottom half).
      const top = pairsDraft.map((p) => p[0]);
      const bot = pairsDraft.map((p) => p[1]).reverse();
      const orderedIds = [...top, ...bot];

      // 1. Create the stage
      const stageRes = await tournamentsAPI.setupStages(tournamentId, [{ name: round.name }]);
      const stages = stageRes.data?.stages || [];
      if (!stages.length) throw new Error('Stage creation failed');
      const stageId = stages[0].id;

      // 2. Assign teams in our chosen seed order
      await tournamentsAPI.setupGroups(tournamentId, stageId, [
        { name: round.label, team_ids: orderedIds },
      ]);

      // 3. Generate fixtures (backend cross-seeds → exact pairs we drafted)
      await tournamentsAPI.generateMatches(tournamentId, stageId);

      navigation.replace('TournamentDetail', { tournamentId });
    } catch (e) {
      Alert.alert(
        'Failed to create round',
        e.response?.data?.detail || e.message || 'Could not create the next round',
      );
    } finally {
      setLoading(false);
    }
  };

  // =================================================================
  // RENDER — Add Next Stage flow (single screen)
  // =================================================================
  const renderAddNextStage = () => {
    const teamCount = tournamentTeams.length;
    const round = chosenRoundName ? roundByName(chosenRoundName) : nextRoundFor(teamCount);
    const autoPicked = nextRoundFor(teamCount);

    // All rounds whose MINIMUM team requirement is met. We deliberately
    // ignore the max for knockouts (admin can drop seeds, e.g. picking
    // "Final" with 8 teams takes top 2). League-kind rounds — including
    // `league_matches` itself — are offered so the admin can run another
    // round-robin (same shape, fresh qualification number). The auto-pick
    // badge highlights the registry's suggestion.
    const roundOptions = ROUND_CATALOG.filter((r) => {
      if (teamCount < r.minTeams) return false;
      return true;
    });

    return (
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120 }}>
        <Text style={styles.subHeading}>Pick the Round</Text>
        <Text style={styles.helperText}>
          {roundOptions.length > 0
            ? `${teamCount} qualified teams. Pick which round to create — auto-picked is highlighted.`
            : `No round in the catalog matches ${teamCount} teams. Add or remove teams below.`}
        </Text>

        {roundOptions.length > 0 && (
          <View style={styles.roundPickerList}>
            {roundOptions.map((r) => {
              const active = (chosenRoundName || autoPicked?.name) === r.name;
              const isAuto = autoPicked?.name === r.name;
              return (
                <TouchableOpacity
                  key={r.name}
                  style={[styles.roundPickerCard, active && styles.roundPickerCardActive]}
                  onPress={() => setChosenRoundName(r.name)}
                  activeOpacity={0.7}
                >
                  <View style={styles.roundPickerIcon}>
                    <MaterialCommunityIcons
                      name={r.name === 'final' ? 'trophy' : 'lightning-bolt'}
                      size={18}
                      color={active ? PRIMARY : MUTED}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <Text style={[styles.roundPickerTitle, active && { color: PRIMARY }]}>
                        {r.label}
                      </Text>
                      {isAuto && (
                        <View style={styles.autoBadge}>
                          <Text style={styles.autoBadgeText}>AUTO</Text>
                        </View>
                      )}
                      {r.maxTeams != null && teamCount > r.maxTeams && (
                        <View style={styles.dropBadge}>
                          <Text style={styles.dropBadgeText}>
                            takes top {r.maxTeams}
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.roundPickerMeta}>
                      {r.minTeams === r.maxTeams
                        ? `${r.minTeams} teams`
                        : `${r.minTeams}–${r.maxTeams ?? '∞'} teams`}
                      {' · '}
                      {r.pairStrategy.replace('_', ' ')}
                    </Text>
                  </View>
                  <View style={[styles.radioOuter, active && styles.radioOuterActive]}>
                    {active && <View style={styles.radioInner} />}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {!round && (
          <View style={styles.warnCard}>
            <Text style={styles.warnText}>
              No round in the catalog matches {teamCount} teams.
              Add or remove teams below.
            </Text>
          </View>
        )}

        {/* Qualified teams editor */}
        <Text style={[styles.subHeading, { marginTop: 16 }]}>
          Teams ({tournamentTeams.length})
        </Text>
        <View style={styles.teamChipsRow}>
          {tournamentTeams.map((t) => (
            <View key={t.id} style={styles.teamChip}>
              <View style={[styles.teamChipDot, { backgroundColor: t.color || PRIMARY }]} />
              <Text style={styles.teamChipName}>{t.short_name || t.name}</Text>
              <TouchableOpacity
                onPress={() => removeTeamFromTournament(t.id)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.teamChipRemove}>x</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>

        {/* League-kind preview: full group config (same as initial flow) */}
        {round && round.kind === 'league' && (
          <>
            <Text style={[styles.subHeading, { marginTop: 16 }]}>
              {round.label} Setup
            </Text>
            <Text style={styles.helperText}>
              Configure how the {tournamentTeams.length} qualified teams are
              split into groups and how many advance to the next round.
            </Text>
            {renderLeagueConfig({ roundLabelForGroups: round.label })}
          </>
        )}

        {/* Pairs preview & swap UI (knockout only) */}
        {round && round.kind === 'knockout' && pairsDraft.length > 0 && (
          <>
            <Text style={[styles.subHeading, { marginTop: 16 }]}>Matchups</Text>
            <Text style={styles.helperText}>
              Tap any team to move it to a different match. The team it gets
              swapped with takes its place in the original match.
            </Text>
            {pairsDraft.map((pair, pairIdx) => {
              const a = teamById(pair[0]);
              const b = teamById(pair[1]);
              const isSelectedA =
                swapPickerFor && swapPickerFor.pairIdx === pairIdx && swapPickerFor.slot === 0;
              const isSelectedB =
                swapPickerFor && swapPickerFor.pairIdx === pairIdx && swapPickerFor.slot === 1;
              return (
                <View key={pairIdx} style={styles.pairRow}>
                  <Text style={styles.pairLabel}>
                    {round.label.split(' ').map((w) => w[0]).join('')}
                    {pairsDraft.length > 1 ? ` ${pairIdx + 1}` : ''}
                  </Text>
                  <TouchableOpacity
                    style={[styles.pairTeam, isSelectedA && styles.pairTeamSelected]}
                    onPress={() =>
                      setSwapPickerFor(
                        isSelectedA ? null : { pairIdx, slot: 0 },
                      )
                    }
                    activeOpacity={0.7}
                  >
                    <View style={[styles.teamChipDot, { backgroundColor: a?.color || PRIMARY }]} />
                    <Text style={styles.pairTeamName} numberOfLines={1}>
                      {a?.short_name || a?.name || '—'}
                    </Text>
                    <MaterialCommunityIcons
                      name="swap-horizontal"
                      size={14}
                      color={isSelectedA ? COLORS.TEXT : MUTED}
                    />
                  </TouchableOpacity>
                  <Text style={styles.pairVs}>vs</Text>
                  <TouchableOpacity
                    style={[styles.pairTeam, isSelectedB && styles.pairTeamSelected]}
                    onPress={() =>
                      setSwapPickerFor(
                        isSelectedB ? null : { pairIdx, slot: 1 },
                      )
                    }
                    activeOpacity={0.7}
                  >
                    <View style={[styles.teamChipDot, { backgroundColor: b?.color || PRIMARY }]} />
                    <Text style={styles.pairTeamName} numberOfLines={1}>
                      {b?.short_name || b?.name || '—'}
                    </Text>
                    <MaterialCommunityIcons
                      name="swap-horizontal"
                      size={14}
                      color={isSelectedB ? COLORS.TEXT : MUTED}
                    />
                  </TouchableOpacity>
                </View>
              );
            })}

            {/* Swap-with picker — appears under the pair list once a team is selected */}
            {swapPickerFor && (() => {
              const sel = teamById(pairsDraft[swapPickerFor.pairIdx][swapPickerFor.slot]);
              return (
                <View style={styles.swapPicker}>
                  <Text style={styles.swapPickerTitle}>
                    Move{' '}
                    <Text style={{ color: PRIMARY }}>{sel?.short_name || sel?.name}</Text>
                    {' '}— swap with…
                  </Text>
                  {pairsDraft.flatMap((pair, pIdx) =>
                    pair.map((tid, sIdx) => {
                      if (pIdx === swapPickerFor.pairIdx && sIdx === swapPickerFor.slot) return null;
                      const t = teamById(tid);
                      // Compute the resulting matchup for clarity
                      const otherInTargetPair = teamById(pair[1 - sIdx]);
                      const otherInSourcePair = teamById(
                        pairsDraft[swapPickerFor.pairIdx][1 - swapPickerFor.slot],
                      );
                      return (
                        <TouchableOpacity
                          key={`${pIdx}-${sIdx}`}
                          style={styles.swapPickerOption}
                          onPress={() => swapTeams(swapPickerFor.pairIdx, swapPickerFor.slot, pIdx, sIdx)}
                        >
                          <View style={[styles.teamChipDot, { backgroundColor: t?.color || PRIMARY }]} />
                          <View style={{ flex: 1 }}>
                            <Text style={styles.swapPickerOptionText}>
                              {t?.short_name || t?.name || '—'}
                            </Text>
                            <Text style={styles.swapPickerOptionMeta}>
                              currently in{' '}
                              {round.label}{pairsDraft.length > 1 ? ` ${pIdx + 1}` : ''} vs{' '}
                              {otherInTargetPair?.short_name || otherInTargetPair?.name || '—'}
                            </Text>
                          </View>
                          <MaterialCommunityIcons name="arrow-right" size={16} color={PRIMARY} />
                        </TouchableOpacity>
                      );
                    }),
                  )}
                  <TouchableOpacity style={styles.swapPickerCancel} onPress={() => setSwapPickerFor(null)}>
                    <Text style={styles.swapPickerCancelText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              );
            })()}
          </>
        )}

        {/* Add more teams (rare, but allowed) */}
        <Text style={[styles.subHeading, { marginTop: 20 }]}>Add Team</Text>
        {renderTeamPicker()}
      </ScrollView>
    );
  };

  // =================================================================
  // RENDER — Initial flow: Teams step
  // =================================================================
  const renderTeamsStep = () => (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120 }}>
      <Text style={styles.subHeading}>Tournament Teams ({tournamentTeams.length})</Text>
      {tournamentTeams.length === 0 ? (
        <View style={styles.emptyCard}>
          <MaterialCommunityIcons name="account-group" size={40} color={MUTED} />
          <Text style={styles.emptyText}>No teams yet</Text>
          <Text style={styles.emptySubtext}>Search and add teams below</Text>
        </View>
      ) : (
        <View style={styles.teamChipsRow}>
          {tournamentTeams.map((t) => (
            <View key={t.id} style={styles.teamChip}>
              <View style={[styles.teamChipDot, { backgroundColor: t.color || PRIMARY }]} />
              <Text style={styles.teamChipName}>{t.short_name || t.name}</Text>
              <TouchableOpacity
                onPress={() => removeTeamFromTournament(t.id)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.teamChipRemove}>x</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}
      <Text style={[styles.subHeading, { marginTop: 20 }]}>Add Teams</Text>
      {renderTeamPicker()}
    </ScrollView>
  );

  const renderTeamPicker = () => (
    <>
      <View style={styles.searchFilterRow}>
        {['name', 'code'].map((mode) => (
          <TouchableOpacity
            key={mode}
            style={[styles.searchFilterBtn, searchMode === mode && styles.searchFilterBtnActive]}
            onPress={() => { setSearchMode(mode); setTeamSearch(''); }}
            activeOpacity={0.7}
          >
            <Feather name={mode === 'name' ? 'search' : 'hash'} size={12} color={searchMode === mode ? '#fff' : MUTED} />
            <Text style={[styles.searchFilterText, searchMode === mode && styles.searchFilterTextActive]}>
              {mode === 'name' ? 'Name' : 'Code'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.searchBar}>
        <Feather name={searchMode === 'code' ? 'hash' : 'search'} size={14} color={MUTED} style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          value={teamSearch}
          onChangeText={setTeamSearch}
          placeholder={searchMode === 'code' ? 'Enter team code (e.g. T4KX9R)' : 'Search by team name...'}
          placeholderTextColor={MUTED}
          autoCapitalize={searchMode === 'code' ? 'characters' : 'none'}
        />
      </View>
      <TouchableOpacity
        style={styles.createNewRow}
        onPress={() => navigation.navigate('CreateTeam', { tournamentId })}
      >
        <View style={styles.createNewIcon}><Text style={{ color: COLORS.TEXT, fontWeight: '700' }}>+</Text></View>
        <Text style={styles.createNewText}>Create New Team</Text>
      </TouchableOpacity>
      {teamsLoading ? (
        <ActivityIndicator size="small" color={PRIMARY} style={{ marginTop: 20 }} />
      ) : (
        filteredAvailable.slice(0, 20).map((t) => (
          <TouchableOpacity
            key={t.id}
            style={styles.teamRow}
            onPress={() => addTeamToTournament(t)}
            activeOpacity={0.7}
          >
            <View style={[styles.teamRowDot, { backgroundColor: t.color || BORDER }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.teamRowName}>{t.name}</Text>
              <Text style={styles.teamRowShort}>{[t.short_name, t.team_code].filter(Boolean).join(' \u00B7 ')}</Text>
            </View>
            <View style={styles.addBtnSmall}>
              <Text style={styles.addBtnSmallText}>+ Add</Text>
            </View>
          </TouchableOpacity>
        ))
      )}
    </>
  );

  // =================================================================
  // RENDER — Initial flow: League Round step
  // =================================================================
  // =================================================================
  // RENDER — Initial flow: Format step
  // =================================================================
  const renderFormatStep = () => (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120 }}>
      <Text style={styles.subHeading}>Tournament Format</Text>
      <Text style={styles.helperText}>
        Pick how the tournament is structured. More formats will land here over
        time — for now, only League + Knockout is supported.
      </Text>
      {TOURNAMENT_FORMATS.map((fmt) => {
        const active = formatKey === fmt.key;
        return (
          <TouchableOpacity
            key={fmt.key}
            style={[styles.presetCard, active && styles.presetCardActive]}
            onPress={() => setFormatKey(fmt.key)}
            activeOpacity={0.7}
          >
            <View style={styles.presetIcon}>
              <MaterialCommunityIcons
                name={fmt.icon}
                size={20}
                color={active ? PRIMARY : MUTED}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.presetTitle, active && { color: PRIMARY }]}>{fmt.label}</Text>
              <Text style={styles.presetDesc}>{fmt.desc}</Text>
            </View>
            <View style={[styles.radioOuter, active && styles.radioOuterActive]}>
              {active && <View style={styles.radioInner} />}
            </View>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );

  // Compact stepper that walks an explicit `options` array. Pressing − or +
  // jumps to the previous/next option (so invalid values are auto-skipped).
  // Works for any team count — UI footprint stays constant whether there are
  // 5 or 95 valid options. Tap the centre to cycle, hold to do nothing.
  const renderStepper = ({ value, options, onChange, prefix, suffix }) => {
    const idx = options.indexOf(value);
    const canDec = idx > 0;
    const canInc = idx >= 0 && idx < options.length - 1;
    const goPrev = () => canDec && onChange(options[idx - 1]);
    const goNext = () => canInc && onChange(options[idx + 1]);
    const minOpt = options[0];
    const maxOpt = options[options.length - 1];
    return (
      <View style={styles.stepper}>
        <TouchableOpacity
          style={[styles.stepperBtn, !canDec && styles.stepperBtnDisabled]}
          onPress={goPrev}
          disabled={!canDec}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <MaterialCommunityIcons name="minus" size={18} color={canDec ? COLORS.TEXT : MUTED} />
        </TouchableOpacity>
        <View style={styles.stepperValueWrap}>
          <Text style={styles.stepperValue}>
            {prefix ? `${prefix} ` : ''}{value}{suffix ? ` ${suffix}` : ''}
          </Text>
          <Text style={styles.stepperHint}>
            {idx + 1} of {options.length} · range {prefix ? `${prefix} ` : ''}{minOpt}{prefix ? '' : ''} – {prefix ? `${prefix} ` : ''}{maxOpt}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.stepperBtn, !canInc && styles.stepperBtnDisabled]}
          onPress={goNext}
          disabled={!canInc}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <MaterialCommunityIcons name="plus" size={18} color={canInc ? COLORS.TEXT : MUTED} />
        </TouchableOpacity>
      </View>
    );
  };

  // Shared league-round configuration block — used by BOTH the initial
  // League Round step AND the add-next-stage flow when the admin picks a
  // league-kind round (Super League). Renders:
  //   - Teams per Group stepper (with derived group count)
  //   - Top N per Group stepper (capped at min group size)
  //   - Group preview cards with seed reorder + cross-group swap
  //   - Group-swap "Move to…" picker modal
  // Reads/writes: teamsPerGroup, topNPerGroup, groupAssignments, groupSwapFor
  // Caller passes `roundLabelForGroups` so single-group cards can show the
  // round name (e.g. "Super League") instead of just "Group A".
  const renderLeagueConfig = ({ roundLabelForGroups }) => {
    const totalTeams = tournamentTeams.length;
    const matchCount = groupAssignments.reduce(
      (sum, g) => sum + Math.max(0, (g.length * (g.length - 1)) / 2),
      0,
    );
    const totalQualifying = numGroups * topNPerGroup;
    const projectedNext = nextRoundFor(totalQualifying);

    const tpgOptions = [];
    for (let n = 2; n <= totalTeams; n++) {
      const groups = Math.ceil(totalTeams / n);
      const remainder = totalTeams - (groups - 1) * n;
      if (remainder >= 2 || groups === 1) tpgOptions.push(n);
    }

    const minGroupSize = groupAssignments.length
      ? Math.min(...groupAssignments.map((g) => g.length || 0))
      : teamsPerGroup;
    const topNOptions = [];
    for (let n = 1; n <= Math.max(1, minGroupSize); n++) topNOptions.push(n);

    return (
      <>
        {/* Teams per group → group count is derived */}
        <Text style={[styles.subHeading, { marginTop: 18 }]}>Teams per Group</Text>
        <Text style={styles.helperText}>
          How many teams each group should have. Group count is calculated
          for you —{' '}
          <Text style={{ color: COLORS.ACCENT_LIGHT, fontWeight: '700' }}>
            {numGroups} {numGroups === 1 ? 'group' : 'groups'}
          </Text>
          {groupAssignments.length > 0 && (
            <Text> · layout [{groupAssignments.map((g) => g.length).join(', ')}]</Text>
          )}
          . Options that would leave a 1-team group are hidden.
        </Text>
        {renderStepper({
          value: teamsPerGroup,
          options: tpgOptions,
          onChange: setTeamsPerGroup,
          suffix: 'teams',
        })}

        {/* Top N per group */}
        <Text style={[styles.subHeading, { marginTop: 18 }]}>Teams Qualifying per Group</Text>
        <Text style={styles.helperText}>
          {numGroups === 1
            ? `${topNPerGroup} teams will advance from this round.`
            : `Top ${topNPerGroup} from each group → ${totalQualifying} teams total.`}
          {projectedNext ? ` Next round → ${projectedNext.label}.` : ''}
        </Text>
        {renderStepper({
          value: topNPerGroup,
          options: topNOptions,
          onChange: setTopNPerGroup,
          prefix: 'Top',
        })}

        {/* Group preview with swap */}
        <Text style={[styles.subHeading, { marginTop: 18 }]}>
          Groups ({matchCount} matches total)
        </Text>
        <Text style={styles.helperText}>
          Tap a team to move it to another group, or use the arrows to set seed
          order within a group.
        </Text>
        {groupAssignments.map((teamIds, gi) => (
          <View key={gi} style={styles.groupCard}>
            <View style={styles.groupCardHeader}>
              <Text style={styles.groupCardTitle}>
                {numGroups === 1
                  ? (roundLabelForGroups || 'League')
                  : `Group ${String.fromCharCode(65 + gi)}`}
              </Text>
              <Text style={styles.groupCardCount}>{teamIds.length} teams</Text>
            </View>
            {teamIds.map((tid, ti) => {
              const t = teamById(tid);
              if (!t) return null;
              return (
                <View key={tid} style={styles.poolRow}>
                  <Text style={styles.poolSeed}>{ti + 1}</Text>
                  <View style={[styles.teamChipDot, { backgroundColor: t.color || PRIMARY }]} />
                  <Text style={styles.poolName} numberOfLines={1}>{t.name}</Text>
                  <View style={styles.moveButtons}>
                    <TouchableOpacity
                      style={[styles.moveBtn, ti === 0 && { opacity: 0.3 }]}
                      onPress={() => reorderInGroup(gi, ti, -1)}
                      disabled={ti === 0}
                    >
                      <MaterialCommunityIcons name="chevron-up" size={16} color={MUTED} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.moveBtn, ti === teamIds.length - 1 && { opacity: 0.3 }]}
                      onPress={() => reorderInGroup(gi, ti, 1)}
                      disabled={ti === teamIds.length - 1}
                    >
                      <MaterialCommunityIcons name="chevron-down" size={16} color={MUTED} />
                    </TouchableOpacity>
                    {numGroups > 1 && (
                      <TouchableOpacity
                        style={[styles.moveBtn, { backgroundColor: COLORS.ACCENT_SOFT }]}
                        onPress={() => setGroupSwapFor({ fromGroup: gi, teamId: tid })}
                      >
                        <MaterialCommunityIcons name="swap-horizontal" size={14} color={PRIMARY} />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        ))}

        {/* Group-swap picker */}
        {groupSwapFor && (
          <View style={styles.swapPicker}>
            <Text style={styles.swapPickerTitle}>
              Move "{teamById(groupSwapFor.teamId)?.short_name || teamById(groupSwapFor.teamId)?.name}" to…
            </Text>
            {groupAssignments.map((_, gi) => {
              if (gi === groupSwapFor.fromGroup) return null;
              return (
                <TouchableOpacity
                  key={gi}
                  style={styles.swapPickerOption}
                  onPress={() => moveTeamToGroup(groupSwapFor.fromGroup, groupSwapFor.teamId, gi)}
                >
                  <Text style={styles.swapPickerOptionText}>Group {String.fromCharCode(65 + gi)}</Text>
                  <Text style={styles.swapPickerOptionMeta}>{groupAssignments[gi].length} teams</Text>
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity style={styles.swapPickerCancel} onPress={() => setGroupSwapFor(null)}>
              <Text style={styles.swapPickerCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}
      </>
    );
  };

  // =================================================================
  // RENDER — Initial flow: League Round step (multi-group capable)
  // =================================================================
  const renderLeagueRoundStep = () => {
    const fmt = formatByKey(formatKey);
    return (
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120 }}>
        {/* Format header — reflects the picker choice */}
        <View style={styles.formatHeader}>
          <View style={styles.formatHeaderIcon}>
            <MaterialCommunityIcons name={fmt?.icon || 'trophy-outline'} size={20} color={PRIMARY} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.formatHeaderTitle}>{fmt?.label || 'League + Knockout'}</Text>
            <Text style={styles.formatHeaderDesc}>{fmt?.desc}</Text>
          </View>
        </View>

        <Text style={styles.subHeading}>Round Name</Text>
        <Text style={styles.helperText}>
          Default is "League Matches". Customize if you like — e.g. "Pool Games".
        </Text>
        <View style={styles.inputBox}>
          <MaterialCommunityIcons name="format-title" size={16} color={MUTED} />
          <TextInput
            style={styles.inputText}
            value={roundName}
            onChangeText={setRoundName}
            placeholder="League Matches"
            placeholderTextColor={MUTED}
            maxLength={40}
          />
        </View>

        {renderLeagueConfig({ roundLabelForGroups: roundName || 'League' })}

        <View style={styles.infoCard}>
          <MaterialCommunityIcons name="information-outline" size={14} color={COLORS.ACCENT_LIGHT} />
          <Text style={styles.infoText}>
            Only the league round is created now. After all league matches finish,
            you'll see a <Text style={{ fontWeight: '700' }}>Create Next Stage</Text> button on the
            tournament page where you can add the next knockout round and pick which
            teams advance.
          </Text>
        </View>
      </ScrollView>
    );
  };

  // =================================================================
  // Bottom action bar
  // =================================================================
  const renderBottomBar = () => {
    if (isAddNextStage) {
      const round = nextRoundFor(tournamentTeams.length);
      return (
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
          <TouchableOpacity style={styles.backNavBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backNavBtnText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.nextBtn, (!round || loading) && { opacity: 0.5 }]}
            onPress={createNextRound}
            disabled={!round || loading}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.TEXT} />
            ) : (
              <Text style={styles.nextBtnText}>
                Create {round ? round.label : 'Round'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      );
    }

    // Initial wizard: Teams (0) → Format (1) → League Round (2)
    return (
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
        {step > 0 && (
          <TouchableOpacity style={styles.backNavBtn} onPress={() => setStep(step - 1)}>
            <Text style={styles.backNavBtnText}>
              <MaterialCommunityIcons name="chevron-left" size={16} color={DARK} /> Back
            </Text>
          </TouchableOpacity>
        )}
        {step === 0 && (
          <TouchableOpacity
            style={[styles.nextBtn, tournamentTeams.length < 2 && { opacity: 0.5 }]}
            onPress={() => setStep(1)}
            disabled={tournamentTeams.length < 2}
          >
            <Text style={styles.nextBtnText}>Next →</Text>
          </TouchableOpacity>
        )}
        {step === 1 && (
          <TouchableOpacity
            style={[styles.nextBtn, !formatKey && { opacity: 0.5 }]}
            onPress={() => setStep(2)}
            disabled={!formatKey}
          >
            <Text style={styles.nextBtnText}>Next →</Text>
          </TouchableOpacity>
        )}
        {step === 2 && (
          <TouchableOpacity
            style={[styles.nextBtn, (loading || tournamentTeams.length < 2) && { opacity: 0.5 }]}
            onPress={createLeagueRound}
            disabled={loading || tournamentTeams.length < 2}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.TEXT} />
            ) : (
              <Text style={styles.nextBtnText}>Create League Round</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    );
  };

  // =================================================================
  // Header + step indicator
  // =================================================================
  const renderHeader = () => {
    const title = isAddNextStage ? 'Add Next Round' : (tournamentName || 'Tournament Setup');
    const stepLabels = ['Add Teams', 'Pick Format', 'Create League Round'];
    const subtitle = isAddNextStage
      ? 'Pick teams and matchups'
      : `Step ${step + 1} of 3 — ${stepLabels[step]}`;
    return (
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="chevron-left" size={20} color={DARK} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
          <Text style={styles.headerSubtitle}>{subtitle}</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.screen}>
      {renderHeader()}
      {isAddNextStage
        ? renderAddNextStage()
        : step === 0
          ? renderTeamsStep()
          : step === 1
            ? renderFormatStep()
            : renderLeagueRoundStep()}
      {renderBottomBar()}
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },

  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12,
    backgroundColor: COLORS.CARD, borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.SURFACE,
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  headerTitle: { fontSize: 16, fontWeight: '700', color: DARK },
  headerSubtitle: { fontSize: 12, color: MUTED, marginTop: 1 },

  subHeading: { fontSize: 16, fontWeight: '700', color: DARK, marginBottom: 8, marginTop: 12 },
  helperText: { fontSize: 13, color: MUTED, marginBottom: 12, lineHeight: 18 },

  /* Team chips */
  teamChipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  teamChip: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.CARD,
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1, borderColor: BORDER, gap: 6,
  },
  teamChipDot: { width: 10, height: 10, borderRadius: 5 },
  teamChipName: { fontSize: 13, fontWeight: '600', color: DARK },
  teamChipRemove: { fontSize: 14, color: MUTED, fontWeight: '700', marginLeft: 2 },

  /* Search */
  searchFilterRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  searchFilterBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    backgroundColor: COLORS.SURFACE, borderWidth: 1, borderColor: BORDER,
  },
  searchFilterBtnActive: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  searchFilterText: { fontSize: 12, fontWeight: '600', color: MUTED },
  searchFilterTextActive: { color: '#fff' },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.SURFACE,
    borderRadius: 10, borderWidth: 1, borderColor: BORDER, height: 44,
    paddingHorizontal: 12, marginBottom: 12,
  },
  searchInput: { flex: 1, fontSize: 14, color: DARK },

  createNewRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: BORDER, gap: 12,
  },
  createNewIcon: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: PRIMARY,
    alignItems: 'center', justifyContent: 'center',
  },
  createNewText: { fontSize: 14, fontWeight: '600', color: PRIMARY },

  teamRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: BORDER, gap: 12,
  },
  teamRowDot: { width: 32, height: 32, borderRadius: 16 },
  teamRowName: { fontSize: 14, fontWeight: '600', color: DARK },
  teamRowShort: { fontSize: 11, color: MUTED, marginTop: 1 },
  addBtnSmall: {
    backgroundColor: COLORS.ACCENT_SOFT, borderRadius: 6,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  addBtnSmallText: { fontSize: 12, fontWeight: '600', color: PRIMARY },

  /* Empty */
  emptyCard: {
    backgroundColor: COLORS.CARD, borderRadius: 12, borderWidth: 1, borderColor: BORDER,
    alignItems: 'center', paddingVertical: 28, marginBottom: 8,
  },
  emptyText: { fontSize: 14, fontWeight: '600', color: DARK },
  emptySubtext: { fontSize: 12, color: MUTED, marginTop: 4 },

  /* Preset card (format picker step) */
  presetCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.CARD, borderRadius: 14,
    borderWidth: 1.5, borderColor: BORDER,
    padding: 14, marginBottom: 10,
  },
  presetCardActive: {
    borderColor: PRIMARY, backgroundColor: COLORS.ACCENT_SOFT,
  },
  presetIcon: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.SURFACE,
    alignItems: 'center', justifyContent: 'center',
  },
  presetTitle: { fontSize: 15, fontWeight: '700', color: DARK },
  presetDesc: { fontSize: 12, color: MUTED, marginTop: 3, lineHeight: 16 },
  radioOuter: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: BORDER,
    alignItems: 'center', justifyContent: 'center',
  },
  radioOuterActive: { borderColor: PRIMARY },
  radioInner: { width: 12, height: 12, borderRadius: 6, backgroundColor: PRIMARY },

  /* Group card (multi-group league preview) */
  groupCard: {
    backgroundColor: COLORS.CARD, borderRadius: 12,
    borderWidth: 1, borderColor: BORDER,
    overflow: 'hidden', marginBottom: 10,
  },
  groupCardHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: COLORS.SURFACE,
    paddingHorizontal: 14, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  groupCardTitle: { fontSize: 14, fontWeight: '700', color: DARK },
  groupCardCount: { fontSize: 12, color: MUTED },

  /* Format header */
  formatHeader: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    backgroundColor: COLORS.ACCENT_SOFT, borderRadius: 14,
    borderWidth: 1, borderColor: COLORS.ACCENT_SOFT_BORDER,
    padding: 14, marginTop: 4, marginBottom: 18,
  },
  formatHeaderIcon: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.CARD,
    alignItems: 'center', justifyContent: 'center',
  },
  formatHeaderTitle: { fontSize: 16, fontWeight: '800', color: DARK },
  formatHeaderDesc: { fontSize: 12, color: COLORS.TEXT_SECONDARY, marginTop: 4, lineHeight: 16 },

  /* Stepper picker — fixed footprint regardless of option count */
  stepper: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.SURFACE, borderRadius: 14,
    borderWidth: 1, borderColor: BORDER,
    padding: 6, marginTop: 4,
  },
  stepperBtn: {
    width: 44, height: 44, borderRadius: 10,
    backgroundColor: COLORS.CARD, borderWidth: 1, borderColor: BORDER,
    alignItems: 'center', justifyContent: 'center',
  },
  stepperBtnDisabled: { opacity: 0.35 },
  stepperValueWrap: { flex: 1, alignItems: 'center' },
  stepperValue: { fontSize: 18, fontWeight: '800', color: DARK },
  stepperHint: { fontSize: 11, color: MUTED, marginTop: 2 },

  /* Round name input */
  inputBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.SURFACE, borderWidth: 1, borderColor: BORDER,
    borderRadius: 12, paddingHorizontal: 14, height: 48, gap: 10,
  },
  inputText: { flex: 1, fontSize: 15, fontWeight: '600', color: DARK },

  /* Pool list (initial league round) */
  poolList: {
    backgroundColor: COLORS.CARD, borderRadius: 12, borderWidth: 1, borderColor: BORDER,
    overflow: 'hidden', marginTop: 4,
  },
  poolRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  poolSeed: {
    width: 22, textAlign: 'center', fontSize: 12, fontWeight: '700', color: MUTED,
  },
  poolName: { flex: 1, fontSize: 14, fontWeight: '600', color: DARK },
  moveButtons: { flexDirection: 'row', gap: 4 },
  moveBtn: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.SURFACE,
    alignItems: 'center', justifyContent: 'center',
  },

  /* Round picker (add-next-stage) */
  roundPickerList: { marginBottom: 12 },
  roundPickerCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.CARD, borderRadius: 12,
    borderWidth: 1.5, borderColor: BORDER,
    padding: 12, marginBottom: 8,
  },
  roundPickerCardActive: {
    borderColor: PRIMARY, backgroundColor: COLORS.ACCENT_SOFT,
  },
  roundPickerIcon: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.SURFACE,
    alignItems: 'center', justifyContent: 'center',
  },
  roundPickerTitle: { fontSize: 14, fontWeight: '700', color: DARK },
  roundPickerMeta: { fontSize: 11, color: MUTED, marginTop: 2 },
  autoBadge: {
    backgroundColor: COLORS.ACCENT, borderRadius: 4,
    paddingHorizontal: 5, paddingVertical: 1,
  },
  autoBadgeText: { fontSize: 9, fontWeight: '800', color: COLORS.TEXT, letterSpacing: 0.5 },
  dropBadge: {
    backgroundColor: COLORS.WARNING_BG, borderRadius: 4,
    paddingHorizontal: 5, paddingVertical: 1,
    borderWidth: 1, borderColor: 'rgba(255,152,0,0.3)',
  },
  dropBadgeText: { fontSize: 9, fontWeight: '700', color: COLORS.WARNING },

  /* Add-next-stage round card */
  roundCard: {
    backgroundColor: COLORS.ACCENT_SOFT, borderRadius: 12,
    borderWidth: 1, borderColor: COLORS.ACCENT_SOFT_BORDER,
    padding: 14, marginTop: 4,
  },
  roundCardTitle: { fontSize: 16, fontWeight: '700', color: DARK },
  warnCard: {
    backgroundColor: COLORS.WARNING_BG, borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(255,152,0,0.3)',
    padding: 14, marginTop: 4,
  },
  warnText: { fontSize: 13, color: COLORS.WARNING, fontWeight: '600' },

  /* Pair rows (knockout matchups) */
  pairRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.CARD, borderRadius: 12,
    borderWidth: 1, borderColor: BORDER,
    padding: 10, marginBottom: 8,
  },
  pairLabel: {
    width: 38, fontSize: 11, fontWeight: '700', color: MUTED, textAlign: 'center',
  },
  pairTeam: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10,
    backgroundColor: COLORS.SURFACE, borderWidth: 1, borderColor: BORDER,
  },
  pairTeamSelected: {
    backgroundColor: COLORS.ACCENT, borderColor: COLORS.ACCENT,
  },
  pairTeamName: { flex: 1, fontSize: 13, fontWeight: '600', color: DARK },
  pairVs: { fontSize: 11, fontWeight: '700', color: MUTED, paddingHorizontal: 4 },

  /* Swap-with picker */
  swapPicker: {
    backgroundColor: COLORS.CARD, borderRadius: 12,
    borderWidth: 1, borderColor: PRIMARY, padding: 12, marginTop: 4, marginBottom: 8,
  },
  swapPickerTitle: { fontSize: 13, fontWeight: '700', color: DARK, marginBottom: 8 },
  swapPickerOption: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10,
    backgroundColor: COLORS.SURFACE, borderWidth: 1, borderColor: BORDER,
    marginBottom: 6,
  },
  swapPickerOptionText: { fontSize: 13, fontWeight: '600', color: DARK },
  swapPickerOptionMeta: { fontSize: 11, color: MUTED, marginTop: 2 },
  swapPickerCancel: { paddingVertical: 10, alignItems: 'center' },
  swapPickerCancelText: { fontSize: 13, fontWeight: '600', color: COLORS.ACCENT_LIGHT },

  /* Info card */
  infoCard: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start',
    backgroundColor: COLORS.ACCENT_SOFT, borderRadius: 12,
    borderWidth: 1, borderColor: COLORS.ACCENT_SOFT_BORDER,
    padding: 12, marginTop: 16,
  },
  infoText: {
    flex: 1, fontSize: 12, color: COLORS.TEXT_SECONDARY, lineHeight: 16,
  },

  /* Bottom bar */
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', paddingHorizontal: 16, paddingTop: 12, gap: 10,
    backgroundColor: COLORS.CARD, borderTopWidth: 1, borderTopColor: BORDER,
  },
  backNavBtn: {
    backgroundColor: COLORS.SURFACE, borderRadius: 12,
    paddingVertical: 14, paddingHorizontal: 20,
  },
  backNavBtnText: { fontSize: 14, fontWeight: '600', color: DARK },
  nextBtn: {
    flex: 1, backgroundColor: PRIMARY, borderRadius: 12,
    paddingVertical: 14, alignItems: 'center',
  },
  nextBtnText: { color: COLORS.TEXT, fontSize: 15, fontWeight: '700' },
});

export default TournamentSetupScreen;
