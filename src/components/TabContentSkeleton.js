import React from 'react';
import { View, StyleSheet } from 'react-native';
import Skeleton, { MatchCardSkeleton, ListSkeleton } from './Skeleton';
import { COLORS } from '../theme';

// Scorecard-style: an innings header + batting table + bowling table.
const ScorecardSkeleton = () => (
  <View style={s.tabPad}>
    {/* Innings header */}
    <View style={s.card}>
      <Skeleton width={140} height={16} borderRadius={6} />
      <Skeleton width={200} height={24} style={{ marginTop: 10 }} />
      <Skeleton width={100} height={12} style={{ marginTop: 6 }} />
    </View>
    {/* Batting rows */}
    <View style={s.card}>
      <Skeleton width={80} height={14} borderRadius={4} />
      {[0, 1, 2, 3, 4].map((i) => (
        <View key={i} style={s.row}>
          <Skeleton width={140} height={14} />
          <Skeleton width={30} height={14} />
          <Skeleton width={30} height={14} />
          <Skeleton width={40} height={14} />
        </View>
      ))}
    </View>
    {/* Bowling rows */}
    <View style={s.card}>
      <Skeleton width={80} height={14} borderRadius={4} />
      {[0, 1, 2].map((i) => (
        <View key={i} style={s.row}>
          <Skeleton width={140} height={14} />
          <Skeleton width={30} height={14} />
          <Skeleton width={30} height={14} />
          <Skeleton width={30} height={14} />
        </View>
      ))}
    </View>
  </View>
);

// Commentary-style: over header + ball-by-ball rows.
const CommentarySkeleton = () => (
  <View style={s.tabPad}>
    {[0, 1, 2].map((i) => (
      <View key={i} style={s.card}>
        <View style={s.spaceBetween}>
          <Skeleton width={80} height={16} borderRadius={4} />
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {[0, 1, 2, 3, 4, 5].map((j) => (
              <Skeleton key={j} width={24} height={24} borderRadius={12} />
            ))}
          </View>
        </View>
        {[0, 1, 2].map((k) => (
          <View key={k} style={s.ballRow}>
            <Skeleton width={24} height={24} borderRadius={12} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Skeleton width="60%" height={14} />
              <Skeleton width="90%" height={12} style={{ marginTop: 5 }} />
            </View>
          </View>
        ))}
      </View>
    ))}
  </View>
);

// Standings / points-table style: table with rows of equal columns.
const StandingsSkeleton = () => (
  <View style={s.tabPad}>
    <View style={s.card}>
      <View style={s.standingsHead}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} width={i === 0 ? 120 : 28} height={12} />
        ))}
      </View>
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <View key={i} style={s.standingsRow}>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Skeleton width={28} height={28} borderRadius={14} />
            <Skeleton width={120} height={14} />
          </View>
          {[0, 1, 2, 3, 4].map((j) => (
            <Skeleton key={j} width={24} height={14} />
          ))}
        </View>
      ))}
    </View>
  </View>
);

// Leaderboard: ranked list with avatar + name + stat chips.
const LeaderboardSkeleton = () => (
  <View style={s.tabPad}>
    {[0, 1, 2, 3, 4, 5, 6].map((i) => (
      <View key={i} style={s.leaderRow}>
        <Skeleton width={24} height={14} />
        <Skeleton width={40} height={40} borderRadius={20} style={{ marginLeft: 12 }} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Skeleton width="50%" height={14} />
          <Skeleton width="30%" height={10} style={{ marginTop: 4 }} />
        </View>
        <Skeleton width={50} height={24} borderRadius={6} />
      </View>
    ))}
  </View>
);

// Info tab — stacked meta blocks (venue, teams, officials, rules).
const InfoSkeleton = () => (
  <View style={s.tabPad}>
    {[0, 1, 2, 3].map((i) => (
      <View key={i} style={s.card}>
        <Skeleton width={100} height={14} borderRadius={4} />
        <Skeleton width="80%" height={16} style={{ marginTop: 10 }} />
        <Skeleton width="60%" height={14} style={{ marginTop: 6 }} />
      </View>
    ))}
  </View>
);

// Matches tab (tournament) — list of match cards.
const MatchesSkeleton = () => <ListSkeleton count={4} Card={MatchCardSkeleton} />;

// Summary (match detail) — top score strip + quick stats + recent balls.
const SummarySkeleton = () => (
  <View style={s.tabPad}>
    <View style={s.card}>
      <View style={s.spaceBetween}>
        <Skeleton width={160} height={22} />
        <Skeleton width={80} height={22} />
      </View>
      <Skeleton width="100%" height={14} style={{ marginTop: 10 }} />
      <Skeleton width="70%" height={14} style={{ marginTop: 6 }} />
    </View>
    <View style={s.card}>
      <Skeleton width={120} height={14} />
      <View style={[s.row, { marginTop: 10 }]}>
        <Skeleton width={70} height={48} borderRadius={8} />
        <Skeleton width={70} height={48} borderRadius={8} />
        <Skeleton width={70} height={48} borderRadius={8} />
        <Skeleton width={70} height={48} borderRadius={8} />
      </View>
    </View>
  </View>
);

const VARIANTS = {
  scorecard: ScorecardSkeleton,
  commentary: CommentarySkeleton,
  standings: StandingsSkeleton,
  leaderboard: LeaderboardSkeleton,
  info: InfoSkeleton,
  matches: MatchesSkeleton,
  summary: SummarySkeleton,
};

const TabContentSkeleton = ({ variant = 'summary' }) => {
  const Variant = VARIANTS[variant] || SummarySkeleton;
  return <Variant />;
};

const s = StyleSheet.create({
  tabPad: { paddingVertical: 10 },
  card: {
    backgroundColor: COLORS.CARD,
    marginHorizontal: 12,
    marginBottom: 10,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    gap: 6,
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  spaceBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  ballRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.BORDER,
    marginTop: 6,
  },
  standingsHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER,
  },
  standingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER_LIGHT,
    gap: 10,
  },
  leaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.CARD,
    marginHorizontal: 12,
    marginBottom: 8,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
});

export default React.memo(TabContentSkeleton);
