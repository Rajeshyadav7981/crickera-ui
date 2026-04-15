import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Share,
  InteractionManager, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scoringAPI, matchesAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { COLORS } from '../../theme';
import Icon from '../../components/Icon';
import Avatar from '../../components/Avatar';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Skeleton from '../../components/Skeleton';
import ManhattanChart from '../../components/charts/ManhattanChart';
import WormChart from '../../components/charts/WormChart';
import FallOfWicketsChart from '../../components/charts/FallOfWicketsChart';


const PRIMARY = COLORS.ACCENT;
const BG = COLORS.BG;
const BANNER_BG = COLORS.CARD;
const CARD_BORDER = COLORS.BORDER;
const TABLE_HEADER_BG = COLORS.SURFACE;
const WHITE = COLORS.WHITE;
const GRAY_500 = COLORS.TEXT_SECONDARY;
const GRAY_400 = COLORS.TEXT_MUTED;
const DARK = COLORS.TEXT;
const GOLD = COLORS.GOLD;

// ── Pure helper functions (defined outside component to avoid re-creation) ──
const formatBattingStats = (b) => {
  if (!b) return '';
  return `${b.runs} (${b.balls_faced}) | ${b.fours || 0}x4 ${b.sixes || 0}x6 | SR ${(b.strike_rate || 0).toFixed(1)}`;
};

const formatBowlingStats = (bw) => {
  if (!bw) return '';
  return `${bw.wickets}/${bw.runs_conceded} (${bw.overs_bowled} ov) | Econ ${(bw.economy_rate || 0).toFixed(1)}`;
};

const getTeamInitial = (name) => {
  if (!name) return '?';
  return name.split(' ').map((w) => w[0]).join('').substring(0, 2).toUpperCase();
};

const TEAM_COLORS = [COLORS.INFO_LIGHT, COLORS.RED, COLORS.WARNING_LIGHT, COLORS.PURPLE];
const getTeamColor = (index) => TEAM_COLORS[index % TEAM_COLORS.length];

const ScorecardScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const { matchId } = route.params;
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [matchInfo, setMatchInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeInnings, setActiveInnings] = useState(0);
  const [reverting, setReverting] = useState(false);

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      loadScorecard();
    });
    return () => task.cancel();
  }, []);

  const loadScorecard = async () => {
    try {
      const [scRes, mRes] = await Promise.all([
        scoringAPI.scorecard(matchId),
        matchesAPI.get(matchId).catch(() => null),
      ]);
      setData(scRes.data);
      if (mRes?.data) setMatchInfo(mRes.data);
    } catch (e) {} finally {
      setLoading(false);
    }
  };

  const isCreator = user?.id === matchInfo?.created_by;
  const isCompleted = data?.status === 'completed';
  // Only show revert for interrupted matches (abandoned, no result, walkover, forfeit)
  // NOT for matches that finished naturally with all overs/wickets/target
  const resultType = matchInfo?.result_type || null;
  const isInterrupted = isCompleted && resultType && resultType !== 'normal';

  const handleRevertMatch = () => {
    const isAbandoned = resultType === 'no_result' || resultType === 'abandoned';
    const title = isAbandoned ? 'Revert Abandoned Match' : 'Revert Match';
    const message = isAbandoned
      ? 'This will reopen the match so you can resume scoring. The "No Result" status will be removed.'
      : 'This will reopen the match and set it back to live.';

    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Revert & Resume',
        style: 'destructive',
        onPress: async () => {
          setReverting(true);
          try {
            await scoringAPI.revert(matchId);
            navigation.replace('LiveScoring', { matchId });
          } catch (e) {
            Alert.alert('Error', e.response?.data?.detail || 'Failed to revert match');
          } finally {
            setReverting(false);
          }
        },
      },
    ]);
  };

  const onInningsChange = useCallback((i) => {
    setActiveInnings(i);
  }, []);

  const goToPlayer = useCallback((playerId) => {
    if (playerId) navigation.navigate('PlayerProfile', { playerId });
  }, [navigation]);

  const handleShare = useCallback(async () => {
    if (!data) return;
    try {
      const { getScorecardLink } = require('../../services/linking');
      const innings = data.innings || [];
      const scores = innings.map((inn) =>
        `${inn.batting_team_name || 'Team'}: ${inn.total_runs}/${inn.total_wickets} (${inn.total_overs} ov)`
      ).join('\n');
      const pom = data.top_performers?.player_of_match;
      const pomLine = pom ? `\nPlayer of the Match: ${pom.player_name}` : '';
      const link = getScorecardLink(matchId);
      await Share.share({
        message: `Match Summary\n${data.result || ''}\n${scores}${pomLine}\n${link}`,
        url: link,
      });
    } catch (e) {}
  }, [data, matchId]);

  /* ---------- helpers ---------- */
  const getResultText = () => {
    if (data?.result) return data.result;
    if (data?.status === 'completed') return 'Match completed';
    return data?.status || '';
  };

  // ── All hooks must be before early returns (Rules of Hooks) ──
  const { tabs, mainInnings, teams, winnerIdx } = useMemo(() => {
    if (!data?.innings?.length) return { tabs: [], mainInnings: [], teams: [], winnerIdx: -1 };
    const allInnings = data.innings || [];
    const main = allInnings.filter(i => !i.is_super_over);
    const superOverInnings = allInnings.filter(i => i.is_super_over);
    const superOverPairs = [];
    for (let i = 0; i < superOverInnings.length; i += 2) {
      superOverPairs.push(superOverInnings.slice(i, i + 2));
    }
    const builtTabs = [];
    main.forEach((inn, i) => {
      builtTabs.push({
        key: `inn-${inn.innings_number}`,
        label: i === 0 ? '1st Innings' : '2nd Innings',
        shortLabel: i === 0 ? '1st Inn' : '2nd Inn',
        innings: inn,
        isSuperOver: false,
      });
    });
    superOverPairs.forEach((pair, i) => {
      const soNum = superOverPairs.length > 1 ? ` ${i + 1}` : '';
      builtTabs.push({
        key: `so-${i}`,
        label: `Super Over${soNum}`,
        shortLabel: `SO${soNum}`,
        pair,
        isSuperOver: true,
      });
    });
    const builtTeams = main.map((inn, idx) => ({
      name: inn.batting_team_name || `Team ${idx + 1}`,
      score: `${inn.total_runs}/${inn.total_wickets}`,
      overs: `${inn.total_overs} ov`,
      color: getTeamColor(idx),
      initial: getTeamInitial(inn.batting_team_name),
    }));
    let wIdx = -1;
    if (main.length > 1 && data.winner_id) {
      wIdx = main.findIndex(i => i.batting_team_id === data.winner_id);
      if (wIdx === -1) wIdx = main.findIndex(i => i.bowling_team_id === data.winner_id);
    }
    if (wIdx === -1 && main.length > 1) {
      wIdx = main[0].total_runs >= main[1].total_runs ? 0 : 1;
    }
    return { tabs: builtTabs, mainInnings: main, teams: builtTeams, winnerIdx: wIdx };
  }, [data]);

  const activeTab = tabs[activeInnings] || tabs[0];
  const activeInningsData = activeTab?.innings || null;

  const manhattanOvers = useMemo(() => {
    if (!activeInningsData?.over_by_over?.length) return null;
    return activeInningsData.over_by_over.map((o, i) => ({
      over: i + 1, runs: o.runs || 0, wickets: o.wickets || 0,
    }));
  }, [activeInningsData?.over_by_over]);

  const wormData = useMemo(() => {
    if (mainInnings.length < 2) return null;
    const result = mainInnings.map((inn, idx) => {
      let cum = 0;
      const d = (inn.over_by_over || []).map((o) => { cum += o.runs || 0; return { cumulativeRuns: cum }; });
      return { teamName: inn.batting_team_name || `Innings ${idx + 1}`, color: idx === 0 ? COLORS.INFO_LIGHT : COLORS.RED, data: d };
    });
    return result.some(d => d.data.length > 0) ? result : null;
  }, [mainInnings]);

  const battingCard = useMemo(() => {
    if (!activeInningsData?.batting) return null;
    return activeInningsData.batting.map((b, i) => ({ ...b, _key: i }));
  }, [activeInningsData?.batting]);

  const bowlingCard = useMemo(() => {
    if (!activeInningsData?.bowling) return null;
    return activeInningsData.bowling.map((b, i) => ({ ...b, _key: i }));
  }, [activeInningsData?.bowling]);

  /* ---------- loading / empty ---------- */
  if (loading) return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Skeleton width={36} height={36} borderRadius={18} />
        <Skeleton width={150} height={18} />
        <Skeleton width={36} height={36} borderRadius={18} />
      </View>
      <View style={{ padding: 16 }}>
        <Skeleton width="100%" height={100} borderRadius={16} style={{ marginBottom: 14 }} />
        <Skeleton width="100%" height={160} borderRadius={16} style={{ marginBottom: 14 }} />
        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 14 }}>
          <Skeleton width="48%" height={120} borderRadius={16} />
          <Skeleton width="48%" height={120} borderRadius={16} />
        </View>
        <Skeleton width="100%" height={40} borderRadius={12} style={{ marginBottom: 14 }} />
        {[1,2,3,4,5].map(i => (
          <View key={i} style={{ flexDirection: 'row', padding: 10, gap: 10 }}>
            <Skeleton width="40%" height={14} />
            <Skeleton width="12%" height={14} />
            <Skeleton width="12%" height={14} />
            <Skeleton width="12%" height={14} />
            <Skeleton width="12%" height={14} />
          </View>
        ))}
      </View>
    </View>
  );
  if (!data || !data.innings?.length) return (
    <View style={styles.center}>
      <Text style={{ fontSize: 15, color: GRAY_500 }}>No scorecard available</Text>
      <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 20 }}>
        <Text style={{ color: PRIMARY, fontWeight: '700', fontSize: 15 }}>Go Back</Text>
      </TouchableOpacity>
    </View>
  );

  const innings = activeInningsData;
  const tp = data.top_performers;
  const pom = tp?.player_of_match;

  return (
    <View style={styles.container}>
      {/* ====== HEADER ====== */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => {
          // If we can go back (came from MatchDetail), go back. Otherwise go home.
          if (navigation.canGoBack()) navigation.goBack();
          else navigation.navigate('MainTabs');
        }} style={styles.headerBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Icon name="back" size={22} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Match Summary</Text>
        <TouchableOpacity onPress={handleShare} style={styles.headerBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Icon name="share" size={18} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} removeClippedSubviews={true} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* ====== SCORE HERO CARD (same style as MatchDetail Summary) ====== */}
        <View style={styles.scoreHero}>
          {/* Status badge */}
          <View style={styles.heroStatusRow}>
            <View style={[styles.heroBadge, data?.status === 'completed' ? { backgroundColor: COLORS.SUCCESS_BG } : { backgroundColor: COLORS.LIVE_BG }]}>
              <Text style={[styles.heroBadgeText, data?.status === 'completed' ? { color: COLORS.SUCCESS } : { color: COLORS.LIVE }]}>
                {data?.status === 'completed' ? 'COMPLETED' : data?.status === 'live' ? 'LIVE' : (data?.status || '').toUpperCase()}
              </Text>
            </View>
            {data?.overs && <Text style={styles.heroMatchInfo}>{data.overs} overs</Text>}
          </View>

          {/* Team scores */}
          {teams.map((team, idx) => {
            const isWinner = idx === winnerIdx;
            return (
              <View key={idx} style={styles.heroTeamRow}>
                <View style={styles.heroTeamLeft}>
                  <View style={[styles.heroFlagChip, { backgroundColor: team.color }]}>
                    <Text style={styles.heroFlagText}>{team.initial}</Text>
                  </View>
                  <Text style={[styles.heroTeamName, isWinner && styles.heroTeamNameWinner]} numberOfLines={1}>{team.name}</Text>
                  {isWinner && <Icon name="check" size={14} color={COLORS.SUCCESS} />}
                </View>
                <Text style={[styles.heroTeamScore, isWinner && styles.heroTeamScoreWinner]}>
                  {team.score} <Text style={styles.heroTeamOvers}>({team.overs})</Text>
                </Text>
              </View>
            );
          })}

          {/* Result */}
          {getResultText() !== '' && (
            <View style={styles.heroResultBar}>
              <Text style={styles.heroResultText}>{getResultText()}</Text>
            </View>
          )}

          {/* Revert match — creator only, interrupted matches (abandoned/no-result/walkover/forfeit) */}
          {isCreator && isInterrupted && (
            <TouchableOpacity
              style={[styles.revertBtn, reverting && { opacity: 0.5 }]}
              onPress={handleRevertMatch}
              disabled={reverting}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons name="undo-variant" size={16} color={COLORS.WARNING} />
              <Text style={styles.revertBtnText}>
                {reverting ? 'Reverting...' : 'Revert & Resume Match'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ====== PLAYER OF THE MATCH ====== */}
        {pom && data?.status === 'completed' && (
          <TouchableOpacity style={styles.pomCard} activeOpacity={0.7} onPress={() => goToPlayer(pom.player_id)}>
            <View style={styles.pomBadge}>
              <MaterialCommunityIcons name="trophy" size={14} color={GOLD} />
              <Text style={styles.pomBadgeText}>PLAYER OF THE MATCH</Text>
            </View>
            <View style={styles.pomContent}>
              <View style={styles.pomAvatarContainer}>
                <Avatar
                  name={pom.player_name}
                  size={64}
                  color={GOLD}
                  showRing
                  type="player"
                />
                <View style={styles.pomStarBadge}>
                  <MaterialCommunityIcons name="star" size={14} color={GOLD} />
                </View>
              </View>
              <View style={styles.pomDetails}>
                <Text style={styles.pomName}>{pom.player_name}</Text>
                {pom.batting && (
                  <View style={styles.pomStatRow}>
                    <MaterialCommunityIcons name="cricket" size={13} color={COLORS.ACCENT_LIGHT} />
                    <Text style={styles.pomStatText}>{formatBattingStats(pom.batting)}</Text>
                  </View>
                )}
                {pom.bowling && pom.bowling.wickets > 0 && (
                  <View style={styles.pomStatRow}>
                    <MaterialCommunityIcons name="baseball" size={13} color={COLORS.WARNING} />
                    <Text style={styles.pomStatText}>{formatBowlingStats(pom.bowling)}</Text>
                  </View>
                )}
              </View>
            </View>
          </TouchableOpacity>
        )}

        {/* ====== TOP PERFORMERS ====== */}
        {tp && data?.status === 'completed' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Top Performers</Text>
            {tp.best_batters?.length > 0 && (
              <>
                <View style={styles.perfSectionHeader}>
                  <MaterialCommunityIcons name="cricket" size={15} color={COLORS.ACCENT_LIGHT} />
                  <Text style={styles.perfSectionTitle}>Best Batters</Text>
                </View>
                {tp.best_batters.map((b, i) => (
                  <TouchableOpacity key={i} style={styles.perfRow} onPress={() => goToPlayer(b.player_id)} activeOpacity={0.6}>
                    <View style={styles.perfRank}><Text style={styles.perfRankText}>{i + 1}</Text></View>
                    <View style={styles.perfInfo}>
                      <Text style={styles.perfName}>{b.player_name}</Text>
                      <Text style={styles.perfTeam}>{b.team_name}</Text>
                    </View>
                    <View style={styles.perfStats}>
                      <Text style={styles.perfMainStat}>{b.runs}</Text>
                      <Text style={styles.perfSubStat}>({b.balls_faced}b) SR {(b.strike_rate || 0).toFixed(0)}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </>
            )}
            {tp.best_bowlers?.length > 0 && (
              <>
                <View style={[styles.perfSectionHeader, { marginTop: 12 }]}>
                  <MaterialCommunityIcons name="baseball" size={15} color={COLORS.WARNING} />
                  <Text style={styles.perfSectionTitle}>Best Bowlers</Text>
                </View>
                {tp.best_bowlers.map((bw, i) => (
                  <TouchableOpacity key={i} style={styles.perfRow} onPress={() => goToPlayer(bw.player_id)} activeOpacity={0.6}>
                    <View style={styles.perfRank}><Text style={styles.perfRankText}>{i + 1}</Text></View>
                    <View style={styles.perfInfo}>
                      <Text style={styles.perfName}>{bw.player_name}</Text>
                      <Text style={styles.perfTeam}>{bw.team_name}</Text>
                    </View>
                    <View style={styles.perfStats}>
                      <Text style={styles.perfMainStat}>{bw.wickets}/{bw.runs_conceded}</Text>
                      <Text style={styles.perfSubStat}>({bw.overs_bowled} ov) Econ {(bw.economy_rate || 0).toFixed(1)}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </>
            )}
          </View>
        )}

        {/* ====== INNINGS TABS ====== */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 14 }} contentContainerStyle={styles.inningsTabScroll}>
          {tabs.map((tab, i) => {
            const isActive = activeInnings === i;
            const isSO = tab.isSuperOver;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[styles.inningsTab, isActive && (isSO ? styles.inningsTabActiveSO : styles.inningsTabActive)]}
                onPress={() => setActiveInnings(i)}
                activeOpacity={0.7}
              >
                {isSO && <MaterialCommunityIcons name="lightning-bolt" size={12} color={isActive ? '#fff' : COLORS.WARNING} style={{ marginRight: 3 }} />}
                <Text style={[styles.inningsTabText, isActive && styles.inningsTabTextActive, isSO && !isActive && { color: COLORS.WARNING }]}>
                  {tab.shortLabel || tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ====== SELECTED TAB CONTENT ====== */}
        {activeTab && !activeTab.isSuperOver && innings && (
          <>
            {/* Innings Top Performer Strip */}
            {tp?.innings_top?.[activeInnings] && (
              <View style={styles.inningsTopStrip}>
                {tp.innings_top[activeInnings].top_batter?.runs > 0 && (
                  <TouchableOpacity style={styles.inningsTopItem} onPress={() => goToPlayer(tp.innings_top[activeInnings].top_batter?.player_id)}>
                    <MaterialCommunityIcons name="cricket" size={14} color={COLORS.ACCENT_LIGHT} />
                    <Text style={styles.inningsTopName} numberOfLines={1}>{tp.innings_top[activeInnings].top_batter?.player_name}</Text>
                    <Text style={styles.inningsTopStat}>{tp.innings_top[activeInnings].top_batter?.runs}({tp.innings_top[activeInnings].top_batter?.balls_faced})</Text>
                  </TouchableOpacity>
                )}
                {tp.innings_top[activeInnings].top_bowler?.wickets > 0 && (
                  <TouchableOpacity style={styles.inningsTopItem} onPress={() => goToPlayer(tp.innings_top[activeInnings].top_bowler?.player_id)}>
                    <MaterialCommunityIcons name="baseball" size={14} color={COLORS.WARNING} />
                    <Text style={styles.inningsTopName} numberOfLines={1}>{tp.innings_top[activeInnings].top_bowler?.player_name}</Text>
                    <Text style={styles.inningsTopStat}>{tp.innings_top[activeInnings].top_bowler?.wickets}/{tp.innings_top[activeInnings].top_bowler?.runs_conceded}</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* Batting Scorecard */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Batting</Text>
              <View style={styles.tableHeaderRow}>
                <Text style={[styles.thCell, styles.cellName]}>Batsman</Text>
                <Text style={[styles.thCell, styles.cellStat]}>R</Text>
                <Text style={[styles.thCell, styles.cellStat]}>B</Text>
                <Text style={[styles.thCell, styles.cellStat]}>4s</Text>
                <Text style={[styles.thCell, styles.cellStat]}>6s</Text>
                <Text style={[styles.thCell, styles.cellStat]}>SR</Text>
              </View>
              {innings.batting?.map((b, i) => (
                <TouchableOpacity key={i} style={styles.tableDataRow} onPress={() => goToPlayer(b.player_id)} activeOpacity={0.6}>
                  <View style={[styles.cellName]}>
                    <Text style={styles.batsmanName}>{b.player_name}</Text>
                    <Text style={styles.dismissalText}>{b.is_out ? b.how_out : 'not out'}</Text>
                  </View>
                  <Text style={[styles.tdCell, styles.cellStat, styles.runsBold]}>{b.runs}</Text>
                  <Text style={[styles.tdCell, styles.cellStat]}>{b.balls_faced}</Text>
                  <Text style={[styles.tdCell, styles.cellStat]}>{b.fours}</Text>
                  <Text style={[styles.tdCell, styles.cellStat]}>{b.sixes}</Text>
                  <Text style={[styles.tdCell, styles.cellStat]}>{b.strike_rate?.toFixed(1)}</Text>
                </TouchableOpacity>
              ))}
              <View style={styles.extrasRow}>
                <Text style={styles.extrasLabel}>Extras</Text>
                <Text style={styles.extrasValue}>{innings.total_extras || 0}</Text>
              </View>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalValue}>{innings.total_runs}/{innings.total_wickets} ({innings.total_overs} ov)</Text>
              </View>
            </View>

            {/* Bowling Scorecard */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Bowling</Text>
              <View style={styles.tableHeaderRow}>
                <Text style={[styles.thCell, styles.cellName]}>Bowler</Text>
                <Text style={[styles.thCell, styles.cellStat]}>Ov</Text>
                <Text style={[styles.thCell, styles.cellStat]}>Md</Text>
                <Text style={[styles.thCell, styles.cellStat]}>R</Text>
                <Text style={[styles.thCell, styles.cellStat]}>W</Text>
                <Text style={[styles.thCell, styles.cellStatWide]}>Econ</Text>
              </View>
              {innings.bowling?.map((b, i) => (
                <TouchableOpacity key={i} style={styles.tableDataRow} onPress={() => goToPlayer(b.player_id)} activeOpacity={0.6}>
                  <View style={[styles.cellName]}>
                    <Text style={styles.bowlerName}>{b.player_name}</Text>
                  </View>
                  <Text style={[styles.tdCell, styles.cellStat]}>{b.overs_bowled}</Text>
                  <Text style={[styles.tdCell, styles.cellStat]}>{b.maidens}</Text>
                  <Text style={[styles.tdCell, styles.cellStat]}>{b.runs_conceded}</Text>
                  <Text style={[styles.tdCell, styles.cellStat, styles.runsBold]}>{b.wickets}</Text>
                  <Text style={[styles.tdCell, styles.cellStatWide]}>{b.economy_rate?.toFixed(1)}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Fall of Wickets */}
            {innings.fall_of_wickets?.length > 0 && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Fall of Wickets</Text>
                <View style={styles.fowContainer}>
                  {innings.fall_of_wickets.map((f, i) => (
                    <TouchableOpacity key={i} style={styles.fowChip} onPress={() => goToPlayer(f.player_id)} activeOpacity={0.7}>
                      <Text style={styles.fowScore}>{f.runs_at_fall}/{f.wicket_number}</Text>
                      <Text style={styles.fowPlayer} numberOfLines={1}>{f.player_name}</Text>
                      <Text style={styles.fowOvers}>({f.overs_at_fall} ov)</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* ====== CHARTS - Manhattan, Worm, Partnerships ====== */}
            {manhattanOvers && (
              <View style={styles.chartsSection}>
                <ManhattanChart
                  overs={manhattanOvers}
                  style={{ marginBottom: 14 }}
                />
              </View>
            )}

            {/* Worm Chart - show when we have 2 innings */}
            {wormData && activeInnings === mainInnings.length - 1 && (
              <WormChart innings={wormData} style={{ marginHorizontal: 16, marginBottom: 14 }} />
            )}

            {/* Partnership Chart removed — available in MatchDetail Scorecard tab */}
          </>
        )}

        {/* ====== SUPER OVER DETAIL VIEW ====== */}
        {activeTab && activeTab.isSuperOver && activeTab.pair && (
          <View style={styles.soSection}>
            {activeTab.pair.map((si, idx) => (
              <View key={idx} style={styles.soInningsCard}>
                <View style={styles.soInningsHeader}>
                  <MaterialCommunityIcons name="lightning-bolt" size={14} color={COLORS.WARNING} />
                  <Text style={styles.soInningsTeam}>{si.batting_team_name}</Text>
                  <Text style={styles.soInningsScore}>{si.total_runs}/{si.total_wickets} ({si.total_overs} ov)</Text>
                </View>

                {/* SO Batting */}
                <View style={[styles.tableHeaderRow, { backgroundColor: 'rgba(255,152,0,0.06)' }]}>
                  <Text style={[styles.thCell, styles.cellName]}>Batsman</Text>
                  <Text style={[styles.thCell, styles.cellStat]}>R</Text>
                  <Text style={[styles.thCell, styles.cellStat]}>B</Text>
                  <Text style={[styles.thCell, styles.cellStat]}>4s</Text>
                  <Text style={[styles.thCell, styles.cellStat]}>6s</Text>
                  <Text style={[styles.thCell, styles.cellStat]}>SR</Text>
                </View>
                {si.batting?.map((b, i) => (
                  <TouchableOpacity key={i} style={styles.tableDataRow} onPress={() => goToPlayer(b.player_id)} activeOpacity={0.6}>
                    <View style={[styles.cellName]}>
                      <Text style={styles.batsmanName}>{b.player_name}</Text>
                      <Text style={styles.dismissalText}>{b.is_out ? b.how_out : 'not out'}</Text>
                    </View>
                    <Text style={[styles.tdCell, styles.cellStat, styles.runsBold]}>{b.runs}</Text>
                    <Text style={[styles.tdCell, styles.cellStat]}>{b.balls_faced}</Text>
                    <Text style={[styles.tdCell, styles.cellStat]}>{b.fours}</Text>
                    <Text style={[styles.tdCell, styles.cellStat]}>{b.sixes}</Text>
                    <Text style={[styles.tdCell, styles.cellStat]}>{b.strike_rate?.toFixed(1)}</Text>
                  </TouchableOpacity>
                ))}
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Total</Text>
                  <Text style={styles.totalValue}>{si.total_runs}/{si.total_wickets} ({si.total_overs} ov)</Text>
                </View>

                {/* SO Bowling */}
                <View style={[styles.tableHeaderRow, { backgroundColor: 'rgba(255,152,0,0.06)', marginTop: 2 }]}>
                  <Text style={[styles.thCell, styles.cellName]}>Bowler</Text>
                  <Text style={[styles.thCell, styles.cellStat]}>O</Text>
                  <Text style={[styles.thCell, styles.cellStat]}>R</Text>
                  <Text style={[styles.thCell, styles.cellStat]}>W</Text>
                  <Text style={[styles.thCell, styles.cellStatWide]}>Econ</Text>
                </View>
                {si.bowling?.map((bw, i) => (
                  <TouchableOpacity key={i} style={styles.tableDataRow} onPress={() => goToPlayer(bw.player_id)} activeOpacity={0.6}>
                    <View style={[styles.cellName]}>
                      <Text style={styles.bowlerName}>{bw.player_name}</Text>
                    </View>
                    <Text style={[styles.tdCell, styles.cellStat]}>{bw.overs_bowled}</Text>
                    <Text style={[styles.tdCell, styles.cellStat]}>{bw.runs_conceded}</Text>
                    <Text style={[styles.tdCell, styles.cellStat, styles.runsBold]}>{bw.wickets}</Text>
                    <Text style={[styles.tdCell, styles.cellStatWide]}>{bw.economy_rate?.toFixed(1)}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  /* Layout */
  container: { flex: 1, backgroundColor: BG },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: BG },
  chartsSection: { paddingHorizontal: 16, marginTop: 8 },

  /* Header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: COLORS.CARD,
    borderBottomWidth: 1,
    borderBottomColor: CARD_BORDER,
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.SURFACE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: DARK },

  /* Result Banner */
  /* Score Hero Card */
  scoreHero: {
    backgroundColor: COLORS.CARD,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: CARD_BORDER,
  },
  heroStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  heroBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 10,
  },
  heroBadgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  heroMatchInfo: { fontSize: 12, color: GRAY_400, fontWeight: '600' },
  heroTeamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: CARD_BORDER,
  },
  heroTeamLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  heroFlagChip: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroFlagText: { color: WHITE, fontSize: 11, fontWeight: '800' },
  heroTeamName: { fontSize: 14, fontWeight: '600', color: GRAY_500, flexShrink: 1 },
  heroTeamNameWinner: { color: WHITE, fontWeight: '800' },
  heroTeamScore: { fontSize: 20, fontWeight: '900', color: WHITE, marginLeft: 10 },
  heroTeamScoreWinner: { color: WHITE },
  heroTeamOvers: { fontSize: 12, fontWeight: '500', color: GRAY_400 },
  heroResultBar: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 0.5,
    borderTopColor: CARD_BORDER,
    alignItems: 'center',
  },
  heroResultText: { fontSize: 13, fontWeight: '700', color: COLORS.SUCCESS, textAlign: 'center' },

  /* Revert abandoned match */
  revertBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginTop: 12, paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10,
    backgroundColor: COLORS.WARNING + '15', borderWidth: 1, borderColor: COLORS.WARNING + '40',
  },
  revertBtnText: { fontSize: 13, fontWeight: '700', color: COLORS.WARNING },

  /* Player of the Match Card */
  pomCard: {
    backgroundColor: COLORS.CARD_ELEVATED,
    marginHorizontal: 16,
    marginTop: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(255,215,0,0.3)',
    overflow: 'hidden',
  },
  pomBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,215,0,0.08)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,215,0,0.15)',
  },
  pomBadgeText: { fontSize: 11, fontWeight: '800', color: GOLD, letterSpacing: 1.5 },
  pomContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 14,
  },
  pomAvatarContainer: {
    position: 'relative',
  },
  pomAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.SURFACE,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,215,0,0.4)',
  },
  pomStarBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: COLORS.CARD_ELEVATED,
    borderWidth: 1.5,
    borderColor: GOLD,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pomDetails: {
    flex: 1,
  },
  pomName: {
    fontSize: 17,
    fontWeight: '800',
    color: WHITE,
    marginBottom: 6,
  },
  pomStatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 3,
  },
  pomStatText: { fontSize: 12, color: GRAY_500 },

  /* Innings Tabs (horizontal scroll) */
  inningsTabScroll: {
    paddingHorizontal: 16,
    gap: 8,
    justifyContent: 'center',
    flexGrow: 1,
  },
  inningsTab: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: COLORS.SURFACE,
    flexDirection: 'row',
    alignItems: 'center',
  },
  inningsTabActive: {
    backgroundColor: PRIMARY,
  },
  inningsTabActiveSO: {
    backgroundColor: COLORS.WARNING,
  },
  inningsTabText: { fontSize: 13, fontWeight: '700', color: GRAY_400 },
  inningsTabTextActive: { color: WHITE },

  /* Super Over Section */
  soSection: {
    marginTop: 10,
    gap: 12,
  },
  soInningsCard: {
    backgroundColor: COLORS.CARD,
    marginHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,152,0,0.25)',
    overflow: 'hidden',
  },
  soInningsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(255,152,0,0.08)',
  },
  soInningsTeam: { flex: 1, fontSize: 14, fontWeight: '700', color: DARK },
  soInningsScore: { fontSize: 16, fontWeight: '800', color: COLORS.WARNING },

  /* Top Performers */
  perfSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: COLORS.SURFACE,
    borderTopWidth: 1,
    borderTopColor: CARD_BORDER,
  },
  perfSectionTitle: { fontSize: 12, fontWeight: '700', color: GRAY_400, textTransform: 'uppercase', letterSpacing: 0.5 },
  perfRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER,
  },
  perfRank: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.SURFACE,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  perfRankText: { fontSize: 11, fontWeight: '700', color: GRAY_400 },
  perfInfo: { flex: 1 },
  perfName: { fontSize: 13, fontWeight: '600', color: DARK },
  perfTeam: { fontSize: 11, color: GRAY_400, marginTop: 1 },
  perfStats: { alignItems: 'flex-end' },
  perfMainStat: { fontSize: 15, fontWeight: '800', color: DARK },
  perfSubStat: { fontSize: 10, color: GRAY_400, marginTop: 1 },

  /* Innings Top Strip */
  inningsTopStrip: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 10,
    gap: 10,
  },
  inningsTopItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.CARD,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  inningsTopName: { flex: 1, fontSize: 12, fontWeight: '600', color: DARK },
  inningsTopStat: { fontSize: 12, fontWeight: '700', color: PRIMARY },

  /* Cards */
  card: {
    backgroundColor: COLORS.CARD,
    marginHorizontal: 16,
    marginTop: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    overflow: 'hidden',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: DARK,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
  },

  /* Table Header */
  tableHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: TABLE_HEADER_BG,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: CARD_BORDER,
    borderBottomWidth: 1,
    borderBottomColor: CARD_BORDER,
  },
  thCell: { fontSize: 11, fontWeight: '700', color: GRAY_400, textTransform: 'uppercase' },
  cellName: { flex: 1 },
  cellStat: { width: 34, textAlign: 'center' },
  cellStatWide: { width: 42, textAlign: 'center' },

  /* Table Data */
  tableDataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER,
  },
  tdCell: { fontSize: 13, color: COLORS.TEXT_SECONDARY },
  runsBold: { fontWeight: '700', color: DARK },
  batsmanName: { fontSize: 13, fontWeight: '600', color: DARK },
  dismissalText: { fontSize: 11, color: GRAY_400, fontStyle: 'italic', marginTop: 1 },
  bowlerName: { fontSize: 13, fontWeight: '600', color: DARK },

  /* Extras & Total */
  extrasRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER,
  },
  extrasLabel: { fontSize: 13, color: GRAY_500 },
  extrasValue: { fontSize: 13, color: GRAY_500 },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: TABLE_HEADER_BG,
  },
  totalLabel: { fontSize: 14, fontWeight: '800', color: DARK },
  totalValue: { fontSize: 14, fontWeight: '800', color: DARK },

  /* Fall of Wickets */
  fowContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  fowChip: {
    backgroundColor: COLORS.SURFACE,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: CARD_BORDER,
  },
  fowScore: { fontSize: 13, fontWeight: '700', color: DARK },
  fowPlayer: { fontSize: 10, color: GRAY_500, marginTop: 2, maxWidth: 70 },
  fowOvers: { fontSize: 10, color: GRAY_400, marginTop: 1 },
});

export default ScorecardScreen;
