// Round registry — single source of truth for every tournament round type.
//
// Mirror of backend/src/services/round_registry.py. Kept in sync by hand
// (rounds change rarely; both files are tiny).
//
// Adding a new round in the future = append one entry here AND in the
// backend file. Nothing else in the frontend needs editing — TournamentSetup,
// TournamentDetail, and the team-swap UX all read from this list.

export const ROUND_CATALOG = [
  {
    name: 'league_matches',
    label: 'League Matches',
    kind: 'league',
    minTeams: 2,
    maxTeams: null,
    pairStrategy: 'round_robin',
    pickWhen: () => false, // never auto-picked as a knockout cascade
  },
  {
    // Second round-robin played by the qualified teams from the league
    // phase. CricHeroes calls this "Super 4" / "Super 6" / "Super 8" — same
    // mechanics as league_matches, distinct stage_name so it shows up
    // separately in the timeline.
    name: 'super_league',
    label: 'Super League',
    kind: 'league',
    minTeams: 3,
    maxTeams: null,
    pairStrategy: 'round_robin',
    pickWhen: () => false, // never auto-picked
  },
  {
    name: 'round_of_16',
    label: 'Round of 16',
    kind: 'knockout',
    minTeams: 16,
    maxTeams: 16,
    pairStrategy: 'cross_seed',
    pickWhen: (n) => n === 16,
  },
  {
    name: 'quarter_final',
    label: 'Quarter Final',
    kind: 'knockout',
    minTeams: 5,
    maxTeams: 8,
    pairStrategy: 'cross_seed',
    pickWhen: (n) => n >= 5 && n <= 8,
  },
  {
    name: 'semi_final',
    label: 'Semi Final',
    kind: 'knockout',
    minTeams: 3,
    maxTeams: 4,
    pairStrategy: 'cross_seed',
    pickWhen: (n) => n >= 3 && n <= 4,
  },
  {
    name: 'final',
    label: 'Final',
    kind: 'knockout',
    minTeams: 2,
    maxTeams: 2,
    pairStrategy: 'cross_seed',
    pickWhen: (n) => n === 2,
  },
];

export const byName = (name) =>
  ROUND_CATALOG.find((r) => r.name === name) || null;

export const isKnockout = (name) => byName(name)?.kind === 'knockout';

// Auto-pick the next knockout round given how many teams qualified.
// Returns null if no round in the catalog matches.
export const nextRoundFor = (qualifiedCount) => {
  for (const r of ROUND_CATALOG) {
    if (r.kind !== 'knockout') continue;
    if (r.pickWhen(qualifiedCount)) return r;
  }
  return null;
};

// ---------------------------------------------------------------------------
// Pair strategies — used by the team-swap UX to render the right preview
// (groups view for league/round-robin, pairs view for cross-seed bracket).
// ---------------------------------------------------------------------------

export const pairTeams = (strategy, teamIds) => {
  if (strategy === 'cross_seed') {
    const pairs = [];
    for (let i = 0; i < Math.floor(teamIds.length / 2); i++) {
      pairs.push([teamIds[i], teamIds[teamIds.length - 1 - i]]);
    }
    return pairs;
  }
  if (strategy === 'round_robin') {
    const pairs = [];
    for (let i = 0; i < teamIds.length; i++) {
      for (let j = i + 1; j < teamIds.length; j++) {
        pairs.push([teamIds[i], teamIds[j]]);
      }
    }
    return pairs;
  }
  throw new Error(`Unknown pair strategy: ${strategy}`);
};
