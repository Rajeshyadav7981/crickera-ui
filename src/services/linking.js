import * as Linking from 'expo-linking';

const prefix = Linking.createURL('/');

/**
 * Base URL for shareable web links.
 * These hit the backend /share/* routes which attempt to open the app
 * via Android App Links / intent URI, or show a download page as fallback.
 *
 * In production, set EXPO_PUBLIC_SHARE_BASE_URL to your public domain
 * (e.g. https://creckstars.com). For local dev, it points to the backend server.
 */
const SHARE_BASE = process.env.EXPO_PUBLIC_SHARE_BASE_URL || 'http://192.168.1.79:7981';

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
