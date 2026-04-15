// Tournament format catalog — drives the "pick a format" step in
// TournamentSetupScreen.
//
// Today the only supported format is `league_knockout` (progressive league
// then a manually-added knockout cascade). The catalog is a list, not a
// constant, because adding a new format later (pure_knockout, double_round_robin,
// etc.) is one entry here. The picker UI walks this list and renders one
// card per entry — the seam is in place for future formats.

export const TOURNAMENT_FORMATS = [
  {
    key: 'league_knockout',
    label: 'League + Knockout',
    desc:
      'Round-robin first, then knockouts. You add each knockout round after ' +
      'the league completes and pick which teams advance.',
    icon: 'trophy-outline',
    // Which round in roundRegistry.ROUND_CATALOG is the league phase.
    leagueRound: 'league_matches',
    // Whether the league phase supports >1 group (multi-pool round-robin).
    supportsMultiGroup: true,
  },
];

export const formatByKey = (key) =>
  TOURNAMENT_FORMATS.find((f) => f.key === key) || null;
