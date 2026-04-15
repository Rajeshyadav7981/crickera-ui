import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Simple offline cache for API responses.
 * Stores data in AsyncStorage with timestamp.
 * Returns cached data instantly, then refreshes in background.
 *
 * Usage:
 *   const data = await offlineCache.get('home_matches');
 *   // Returns cached data or null
 *
 *   await offlineCache.set('home_matches', freshData);
 *   // Stores with timestamp
 */

const CACHE_PREFIX = 'cache:';
const MAX_AGE = 5 * 60 * 1000; // 5 minutes default

const offlineCache = {
  async get(key, maxAge = MAX_AGE) {
    try {
      const raw = await AsyncStorage.getItem(`${CACHE_PREFIX}${key}`);
      if (!raw) return null;
      const { data, timestamp } = JSON.parse(raw);
      if (Date.now() - timestamp > maxAge) return null; // Stale
      return data;
    } catch {
      return null;
    }
  },

  async set(key, data) {
    try {
      await AsyncStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify({
        data,
        timestamp: Date.now(),
      }));
    } catch {}
  },

  async getStale(key) {
    // Returns data even if expired — for offline fallback
    try {
      const raw = await AsyncStorage.getItem(`${CACHE_PREFIX}${key}`);
      if (!raw) return null;
      return JSON.parse(raw).data;
    } catch {
      return null;
    }
  },

  async clear(key) {
    try {
      await AsyncStorage.removeItem(`${CACHE_PREFIX}${key}`);
    } catch {}
  },
};

export default offlineCache;
