import { useCallback, useEffect, useMemo } from 'react';
import { AppState } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { favoritesAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

const KEY = ['favorites', 'ids'];
const SYNC_DELAY_MS = 250;

const persisted = { matchIds: new Set(), tournamentIds: new Set() };
const pendingTimers = new Map();
const pendingTargets = new Map();
let queryClientRef = null;

const runSync = async (kind, numId) => {
  const key = `${kind}:${numId}`;
  pendingTimers.delete(key);
  pendingTargets.delete(key);
  const qc = queryClientRef;
  if (!qc) return;

  const current = qc.getQueryData(KEY) || { matchIds: new Set(), tournamentIds: new Set() };
  const localSet = kind === 'match' ? current.matchIds : current.tournamentIds;
  const persistedSet = kind === 'match' ? persisted.matchIds : persisted.tournamentIds;
  const wantFav = localSet.has(numId);
  const hasFav = persistedSet.has(numId);
  if (wantFav === hasFav) return;

  try {
    if (kind === 'match') {
      if (wantFav) await favoritesAPI.addMatch(numId);
      else await favoritesAPI.removeMatch(numId);
    } else {
      if (wantFav) await favoritesAPI.addTournament(numId);
      else await favoritesAPI.removeTournament(numId);
    }
    if (wantFav) persistedSet.add(numId); else persistedSet.delete(numId);
    qc.invalidateQueries({ queryKey: ['favorites', kind === 'match' ? 'matches' : 'tournaments'] });
  } catch (e) {
    qc.setQueryData(KEY, (prev) => {
      const base = prev || { matchIds: new Set(), tournamentIds: new Set() };
      const matchIds = new Set(base.matchIds);
      const tournamentIds = new Set(base.tournamentIds);
      const s = kind === 'match' ? matchIds : tournamentIds;
      if (hasFav) s.add(numId); else s.delete(numId);
      return { matchIds, tournamentIds };
    });
  }
};

const scheduleSync = (kind, id) => {
  const numId = Number(id);
  const key = `${kind}:${numId}`;
  const existing = pendingTimers.get(key);
  if (existing) clearTimeout(existing);
  pendingTargets.set(key, { kind, numId });
  const timer = setTimeout(() => { runSync(kind, numId); }, SYNC_DELAY_MS);
  pendingTimers.set(key, timer);
};

export const flushPendingFavorites = async () => {
  if (pendingTimers.size === 0) return;
  const targets = [];
  pendingTimers.forEach((timer, key) => {
    clearTimeout(timer);
    const t = pendingTargets.get(key);
    if (t) targets.push(t);
  });
  pendingTimers.clear();
  pendingTargets.clear();
  await Promise.all(targets.map(({ kind, numId }) => runSync(kind, numId)));
};

let appStateSub = null;
const ensureAppStateListener = () => {
  if (appStateSub) return;
  appStateSub = AppState.addEventListener('change', (next) => {
    if (next === 'background' || next === 'inactive') {
      flushPendingFavorites();
    }
  });
};


export const useFavoriteIds = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  queryClientRef = qc;

  useEffect(() => { ensureAppStateListener(); }, []);

  const query = useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const res = await favoritesAPI.ids();
      const fresh = {
        matchIds: new Set(res.data?.match_ids || []),
        tournamentIds: new Set(res.data?.tournament_ids || []),
      };
      persisted.matchIds = new Set(fresh.matchIds);
      persisted.tournamentIds = new Set(fresh.tournamentIds);
      return fresh;
    },
    enabled: !!user?.id,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  });

  const data = query.data || { matchIds: new Set(), tournamentIds: new Set() };

  const isMatchFavorite = useCallback(
    (id) => data.matchIds.has(Number(id)),
    [data.matchIds],
  );
  const isTournamentFavorite = useCallback(
    (id) => data.tournamentIds.has(Number(id)),
    [data.tournamentIds],
  );

  const flipLocal = useCallback((kind, id, isFav) => {
    const numId = Number(id);
    qc.setQueryData(KEY, (prev) => {
      const base = prev || { matchIds: new Set(), tournamentIds: new Set() };
      const matchIds = new Set(base.matchIds);
      const tournamentIds = new Set(base.tournamentIds);
      if (kind === 'match') {
        if (isFav) matchIds.add(numId); else matchIds.delete(numId);
      } else {
        if (isFav) tournamentIds.add(numId); else tournamentIds.delete(numId);
      }
      return { matchIds, tournamentIds };
    });
  }, [qc]);

  const toggleMatch = useCallback((id) => {
    const numId = Number(id);
    const next = !data.matchIds.has(numId);
    flipLocal('match', numId, next);
    scheduleSync('match', numId);
    return next;
  }, [data.matchIds, flipLocal]);

  const toggleTournament = useCallback((id) => {
    const numId = Number(id);
    const next = !data.tournamentIds.has(numId);
    flipLocal('tournament', numId, next);
    scheduleSync('tournament', numId);
    return next;
  }, [data.tournamentIds, flipLocal]);

  return useMemo(() => ({
    matchIds: data.matchIds,
    tournamentIds: data.tournamentIds,
    isMatchFavorite,
    isTournamentFavorite,
    toggleMatch,
    toggleTournament,
    isLoading: query.isLoading,
  }), [data.matchIds, data.tournamentIds, isMatchFavorite, isTournamentFavorite, toggleMatch, toggleTournament, query.isLoading]);
};

export const useFavoriteMatches = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['favorites', 'matches'],
    queryFn: async () => {
      const res = await favoritesAPI.listMatches();
      return res.data || [];
    },
    enabled: !!user?.id,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });
};

export const useFavoriteTournaments = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['favorites', 'tournaments'],
    queryFn: async () => {
      const res = await favoritesAPI.listTournaments();
      return res.data || [];
    },
    enabled: !!user?.id,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });
};
