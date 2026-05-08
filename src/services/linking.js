import * as Linking from 'expo-linking';

const prefix = Linking.createURL('/');

/**
 * Base URL for shareable web links.
 * Hits backend /share/* which attempts to open the app via Android App Links /
 * intent URI, or falls back to a download page.
 *
 * Set EXPO_PUBLIC_SHARE_BASE_URL in EAS build env to override. The default
 * points at production so a release build never ships a LAN IP in share links.
 */
const PRODUCTION_SHARE_BASE = 'https://creckstars.duckdns.org';
const SHARE_BASE = process.env.EXPO_PUBLIC_SHARE_BASE_URL || PRODUCTION_SHARE_BASE;

export const linkingConfig = {
  prefixes: [
    prefix,
    'creckstars://',
    // Also handle web URLs from share links (so the app intercepts them when installed)
    `${SHARE_BASE}/share`,
  ],
  config: {
    screens: {
      MainTabs: {
        screens: {
          Home: 'home',
          Tournaments: 'tournaments',
          Community: 'community',
          Profile: 'profile',
        },
      },
      MatchDetail: {
        // Matches both creckstars://match/:matchId AND https://server/share/match/:matchId
        path: 'match/:matchId',
        parse: { matchId: Number },
      },
      LiveScoring: {
        path: 'match/:matchId/live',
        parse: { matchId: Number },
      },
      Scorecard: {
        path: 'match/:matchId/scorecard',
        parse: { matchId: Number },
      },
      TournamentDetail: {
        path: 'tournament/:tournamentId',
        parse: { tournamentId: Number },
      },
      TeamDetail: {
        path: 'team/:teamId',
        parse: { teamId: Number },
      },
      PlayerProfile: {
        path: 'player/:playerId',
        parse: { playerId: Number },
      },
    },
  },
};

// ─── Shareable web links (hit backend /share/* with HTML fallback) ────────────
// These are the URLs you put in Share.share() — they work for everyone:
//   - App installed: Android App Links open the app directly
//   - App not installed: Browser shows a branded download page

export const getMatchLink = (matchId) => `${SHARE_BASE}/share/match/${matchId}`;
export const getScorecardLink = (matchId) => `${SHARE_BASE}/share/match/${matchId}/scorecard`;
export const getTournamentLink = (tournamentId) => `${SHARE_BASE}/share/tournament/${tournamentId}`;
export const getTeamLink = (teamId) => `${SHARE_BASE}/share/team/${teamId}`;
export const getPlayerLink = (playerId) => `${SHARE_BASE}/share/player/${playerId}`;
