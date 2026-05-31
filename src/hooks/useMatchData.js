/**
 * React-Query hooks for match-scoped data.
 *
 * Why these exist:
 *   Pre-hook, LiveScoring / MatchDetail / Scorecard / Commentary each had their
 *   own useState + useEffect plumbing. Switching tabs or revisiting a screen
 *   re-fetched data that the previous mount had just returned. The backend
 *   already has Redis caches, but every duplicate request still costs an
 *   HTTP round-trip and a full React re-render → that's the "lag" feel.
 *
 * What you get:
 *   • In-flight dedup — N components asking for the same data make ONE request
 *   • stale-while-revalidate — instant paint from cache, background refetch
 *   • WS-driven invalidation via the helpers below — score events refresh
 *     the precise keys that changed, nothing else
 *   • Same response shapes the screens already consume — drop-in replacement
 *
 * Cache-key conventions follow USER_KEYS / FAVORITE_KEYS patterns elsewhere.
 */
import { useQuery, useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { matchesAPI, scoringAPI } from '../services/api';

// ── Key factory ─────────────────────────────────────────────────────────────
// Every key starts with ['match', id, …] so a single invalidate({queryKey:['match',id]})
// can blow away every cached subtree for a given match in one call.

export const MATCH_KEYS = {
  match:      (matchId) => ['match', matchId, 'meta'],
  liveState:  (matchId) => ['match', matchId, 'liveState'],
  scorecard:  (matchId) => ['match', matchId, 'scorecard'],
  squad:      (matchId, teamId) => ['match', matchId, 'squad', teamId],
  broadcast:  (matchId) => ['match', matchId, 'broadcast'],
  commentary: (matchId, innNum) => ['match', matchId, 'commentary', innNum],
  all:        (matchId) => ['match', matchId],
};

// Internal helper — when a payload includes a status flag, we tune the stale
// window: live matches refetch frequently, completed matches barely ever.
const liveAwareStale = (status, liveMs, doneMs) =>
  (status === 'completed' || status === 'abandoned') ? doneMs : liveMs;

// ── Match metadata ──────────────────────────────────────────────────────────
// Loaded once per match. Things in here (overs, teams, codes, name) almost
// never change after toss, so we cache for 60 s and only force a refetch
// on WS innings_end / match_end events.

export const useMatch = (matchId, options = {}) => {
  return useQuery({
    queryKey: MATCH_KEYS.match(matchId),
    queryFn: async () => {
      const res = await matchesAPI.get(matchId);
      return res.data;
    },
    enabled: !!matchId,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    ...options,
  });
};

// ── Live state ──────────────────────────────────────────────────────────────
// The polling/poll-fallback target. Backend caches this for 5 s; we mirror
// that on the client with a 3 s stale window so back-to-back consumers
// dedupe but a real refresh comes through quickly.

export const useLiveState = (matchId, options = {}) => {
  return useQuery({
    queryKey: MATCH_KEYS.liveState(matchId),
    queryFn: async () => {
      const res = await scoringAPI.liveState(matchId);
      return res.data;
    },
    enabled: !!matchId,
    staleTime: 3_000,
    gcTime: 60_000,
    ...options,
  });
};

// ── Scorecard ──────────────────────────────────────────────────────────────
// Heavy query. Backend caches for 60 s live / 600 s completed; we keep a
// matching client-side stale window so two screens (MatchDetail summary tab
// + scorecard tab) hitting it at the same time share one request.

export const useScorecard = (matchId, options = {}) => {
  return useQuery({
    queryKey: MATCH_KEYS.scorecard(matchId),
    queryFn: async () => {
      const res = await scoringAPI.scorecard(matchId);
      return res.data;
    },
    enabled: !!matchId,
    staleTime: 10_000,
    gcTime: 5 * 60_000,
    select: (data) => data,
    ...options,
  });
};

// ── Squad ───────────────────────────────────────────────────────────────────
// Big win: the bowler / new-batsman pickers in LiveScoring open repeatedly.
// Squad is essentially locked after innings starts, so a 10-min cache
// eliminates the picker open-lag entirely.

export const useSquad = (matchId, teamId, options = {}) => {
  return useQuery({
    queryKey: MATCH_KEYS.squad(matchId, teamId),
    queryFn: async () => {
      const res = await matchesAPI.getSquad(matchId, teamId);
      return res.data || [];
    },
    enabled: !!matchId && !!teamId,
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
    ...options,
  });
};

// ── Broadcast (admin-set scrolling message) ────────────────────────────────

export const useBroadcast = (matchId, options = {}) => {
  return useQuery({
    queryKey: MATCH_KEYS.broadcast(matchId),
    queryFn: async () => {
      const res = await scoringAPI.getBroadcast(matchId);
      return res.data?.message || null;
    },
    enabled: !!matchId,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    ...options,
  });
};

// ── Commentary (paginated) ─────────────────────────────────────────────────
// Each innings has its own page list. We use useInfiniteQuery so callers can
// fetchNextPage() without juggling offsets manually.

const COMM_PAGE_SIZE = 30;

export const useCommentary = (matchId, inningsNumber, options = {}) => {
  return useInfiniteQuery({
    queryKey: MATCH_KEYS.commentary(matchId, inningsNumber),
    queryFn: async ({ pageParam = 0 }) => {
      const res = await scoringAPI.commentary(
        matchId, inningsNumber, COMM_PAGE_SIZE, pageParam,
      );
      return { items: res.data || [], offset: pageParam };
    },
    enabled: !!matchId && !!inningsNumber,
    initialPageParam: 0,
    getNextPageParam: (lastPage) => {
      if (!lastPage.items || lastPage.items.length < COMM_PAGE_SIZE) return undefined;
      return lastPage.offset + lastPage.items.length;
    },
    staleTime: 20_000,
    gcTime: 5 * 60_000,
    ...options,
  });
};

// ── Invalidation helpers ───────────────────────────────────────────────────
// Use these from WS listeners AND from write-side handlers so:
//   • the writer sees their own change immediately (no waiting for WS bounce)
//   • the viewer sees the change as soon as their WS notifies them
// Each helper is a stable callback so React doesn't re-bind WS listeners.

export const useMatchInvalidators = (matchId) => {
  const qc = useQueryClient();

  const invalidateLive = useCallback(() => {
    if (!matchId) return;
    qc.invalidateQueries({ queryKey: MATCH_KEYS.liveState(matchId) });
    qc.invalidateQueries({ queryKey: MATCH_KEYS.scorecard(matchId) });
  }, [qc, matchId]);

  const invalidateInnings = useCallback((innNum) => {
    if (!matchId) return;
    qc.invalidateQueries({ queryKey: MATCH_KEYS.liveState(matchId) });
    qc.invalidateQueries({ queryKey: MATCH_KEYS.scorecard(matchId) });
    qc.invalidateQueries({ queryKey: MATCH_KEYS.match(matchId) });
    if (innNum) {
      qc.invalidateQueries({ queryKey: MATCH_KEYS.commentary(matchId, innNum) });
    }
  }, [qc, matchId]);

  const invalidateMatch = useCallback(() => {
    if (!matchId) return;
    // exact:false so every sub-key under ['match', id, …] is wiped
    qc.invalidateQueries({ queryKey: MATCH_KEYS.all(matchId) });
  }, [qc, matchId]);

  const invalidateSquad = useCallback((teamId) => {
    if (!matchId) return;
    if (teamId) {
      qc.invalidateQueries({ queryKey: MATCH_KEYS.squad(matchId, teamId) });
    } else {
      // No team given → wipe both teams' squads
      qc.invalidateQueries({ queryKey: ['match', matchId, 'squad'] });
    }
  }, [qc, matchId]);

  const invalidateBroadcast = useCallback(() => {
    if (!matchId) return;
    qc.invalidateQueries({ queryKey: MATCH_KEYS.broadcast(matchId) });
  }, [qc, matchId]);

  return { invalidateLive, invalidateInnings, invalidateMatch, invalidateSquad, invalidateBroadcast };
};
