export const TOURNAMENT_FORMATS = [
  {
    key: 'league_knockout',
    label: 'League + Knockout',
    desc:
      'Round-robin first, then knockouts. You add each knockout round after ' +
      'the league completes and pick which teams advance.',
    icon: 'trophy-outline',
    leagueRound: 'league_matches',
    supportsMultiGroup: true,
  },
  {
    key: 'league',
    label: 'League Only',
    desc:
      'Round-robin only — every team plays every other team. No knockout phase.',
    icon: 'format-list-numbered',
    leagueRound: 'league_matches',
    supportsMultiGroup: true,
  },
  {
    key: 'knockout',
    label: 'Knockout Only',
    desc:
      'Straight knockout — pairs decided by your seeding. ' +
      '2 → Final, 3–4 → Semi Final, 5–8 → Quarter Final, 9–16 → Round of 16, 17+ → Preliminary Round (bye for odd counts).',
    icon: 'lightning-bolt',
  },
];

export const formatByKey = (key) =>
  TOURNAMENT_FORMATS.find((f) => f.key === key) || null;

export const knockoutRoundForTeams = (n) => {
  if (n === 2) return { name: 'final', label: 'Final' };
  if (n >= 3 && n <= 4) return { name: 'semi_final', label: 'Semi Final' };
  if (n >= 5 && n <= 8) return { name: 'quarter_final', label: 'Quarter Final' };
  if (n >= 9 && n <= 16) return { name: 'round_of_16', label: 'Round of 16' };
  if (n >= 17) return { name: 'preliminary_round', label: 'Preliminary Round' };
  return null;
};
