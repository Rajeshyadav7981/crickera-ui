import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { usersAPI } from '../services/api';

// ═══════════════════════════════════════
// Query Key Factory
// ═══════════════════════════════════════

export const USER_KEYS = {
  all: ['users'],
  search: (q) => ['users', 'search', q],
  mentionSearch: (q) => ['users', 'mention', q],
  profile: (username) => ['users', 'profile', username],
  followers: (userId) => ['users', 'followers', userId],
  following: (userId) => ['users', 'following', userId],
};

// ═══════════════════════════════════════
// Search Hooks
// ═══════════════════════════════════════

export const useUserSearch = (query, options = {}) => {
  const trimmed = query?.trim() || '';
  return useQuery({
    queryKey: USER_KEYS.search(trimmed),
    queryFn: async ({ signal }) => {
      const res = await usersAPI.search(trimmed, { signal });
      return res.data || [];
    },
    enabled: trimmed.length >= 1,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    ...options,
  });
};

export const useMentionSearch = (query, options = {}) => {
  const trimmed = query?.trim()?.toLowerCase() || '';
  return useQuery({
    queryKey: USER_KEYS.mentionSearch(trimmed),
    queryFn: async ({ signal }) => {
      const res = await usersAPI.mentionSearch(trimmed, 10, { signal });
      return res.data || [];
    },
    enabled: true,
    staleTime: 30_000,
    gcTime: 3 * 60_000,
    ...options,
  });
};

// ═══════════════════════════════════════
// Profile Hook
// ═══════════════════════════════════════

export const useUserProfile = (username, options = {}) => {
  return useQuery({
    queryKey: USER_KEYS.profile(username),
    queryFn: async ({ signal }) => {
      const res = await usersAPI.getProfile(username, { signal });
      return res.data;
    },
    enabled: !!username,
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
    ...options,
  });
};

// ═══════════════════════════════════════
// Follow Mutations
// ═══════════════════════════════════════

export const useFollowUser = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId) => usersAPI.follow(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users', 'profile'] });
      queryClient.invalidateQueries({ queryKey: ['users', 'followers'] });
      queryClient.invalidateQueries({ queryKey: ['users', 'following'] });
    },
  });
};

export const useUnfollowUser = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId) => usersAPI.unfollow(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users', 'profile'] });
      queryClient.invalidateQueries({ queryKey: ['users', 'followers'] });
      queryClient.invalidateQueries({ queryKey: ['users', 'following'] });
    },
  });
};

// ═══════════════════════════════════════
// Recent Searches (AsyncStorage)
// ═══════════════════════════════════════

const RECENT_KEY = 'recent_user_searches';
const MAX_RECENT = 10;

export const useRecentSearches = () => {
  const [recent, setRecent] = useState([]);

  useEffect(() => {
    AsyncStorage.getItem(RECENT_KEY).then(data => {
      if (data) {
        try { setRecent(JSON.parse(data)); } catch {}
      }
    });
  }, []);

  const addRecent = useCallback(async (user) => {
    const updated = [
      { id: user.id, username: user.username, full_name: user.full_name, profile: user.profile },
      ...recent.filter(u => u.id !== user.id),
    ].slice(0, MAX_RECENT);
    setRecent(updated);
    await AsyncStorage.setItem(RECENT_KEY, JSON.stringify(updated));
  }, [recent]);

  const clearRecent = useCallback(async () => {
    setRecent([]);
    await AsyncStorage.removeItem(RECENT_KEY);
  }, []);

  return { recent, addRecent, clearRecent };
};
