import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { scoringAPI } from './api';

let Notifications = null;
try {
  Notifications = require('expo-notifications');
  // Quick check if it actually works (Expo Go SDK 53+ doesn't support it)
  if (!Notifications.getPermissionsAsync) Notifications = null;
} catch { Notifications = null; }

const QUEUE_KEY = 'offline_scoring_queue';
const MAX_QUEUE_SIZE = 500; // Prevent AsyncStorage bloat

class OfflineScoringQueue {
  constructor() {
    this._queue = [];
    this._isOnline = true;
    this._syncing = false;
    this._listeners = [];
    this._unsubscribe = null;
    // Count of entries we had to drop because the queue hit MAX_QUEUE_SIZE.
    // Surfaced via _notifyListeners so a banner/toast can react.
    this._droppedSinceReset = 0;
  }

  get droppedSinceReset() {
    return this._droppedSinceReset;
  }

  acknowledgeDrops() {
    this._droppedSinceReset = 0;
    this._notifyListeners();
  }

  _evictOldest() {
    const dropped = this._queue.shift();
    this._droppedSinceReset += 1;
    // Local notification so the scorer definitely sees this — queue overflow
    // means a delivery was silently lost without this.
    if (Notifications) {
      Notifications.scheduleNotificationAsync({
        content: {
          title: 'Offline Queue Full',
          body: 'A queued scoring action was dropped (500+ pending). Reconnect to sync soon.',
          sound: false,
        },
        trigger: null,
      }).catch(() => {});
    }
    if (__DEV__) {
      console.warn('[offlineQueue] dropped oldest entry at cap', dropped?.id);
    }
  }

  async init() {
    try {
      const stored = await AsyncStorage.getItem(QUEUE_KEY);
      if (stored) this._queue = JSON.parse(stored);
    } catch {}

    this._unsubscribe = NetInfo.addEventListener((state) => {
      const wasOffline = !this._isOnline;
      this._isOnline = state.isConnected && state.isInternetReachable !== false;

      // Auto-sync when coming back online
      if (wasOffline && this._isOnline && this._queue.length > 0) {
        this.sync();
      }

      this._notifyListeners();
    });

    const state = await NetInfo.fetch();
    this._isOnline = state.isConnected && state.isInternetReachable !== false;
  }

  destroy() {
    if (this._unsubscribe) {
      this._unsubscribe();
      this._unsubscribe = null;
    }
  }

  get isOnline() {
    return this._isOnline;
  }

  get queueLength() {
    return this._queue.length;
  }

  get isSyncing() {
    return this._syncing;
  }

  async enqueue(matchId, data) {
    const entry = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      matchId,
      data,
      timestamp: Date.now(),
      retries: 0,
    };

    if (this._isOnline) {
      try {
        const result = await scoringAPI.score(matchId, data);
        return { success: true, result: result.data };
      } catch (error) {
        // If network error, queue it; otherwise throw
        if (!error.response) {
          if (this._queue.length >= MAX_QUEUE_SIZE) {
            this._evictOldest();
          }
          this._queue.push(entry);
          await this._persist();
          this._notifyListeners();
          return { success: false, queued: true };
        }
        throw error;
      }
    } else {
      // Offline - queue the action (with oldest-first eviction if cap reached)
      if (this._queue.length >= MAX_QUEUE_SIZE) {
        this._evictOldest();
      }
      this._queue.push(entry);
      await this._persist();
      this._notifyListeners();

      if (Notifications && this._queue.length === 1) {
        Notifications.scheduleNotificationAsync({
          content: {
            title: 'Offline Mode',
            body: 'Scoring actions are being queued. They will sync when you\'re back online.',
            sound: false,
          },
          trigger: null,
        }).catch(() => {});
      }

      return { success: false, queued: true };
    }
  }

  async sync() {
    if (this._syncing || !this._isOnline || this._queue.length === 0) return;

    this._syncing = true;
    this._notifyListeners();

    const failed = [];

    while (this._queue.length > 0) {
      const entry = this._queue[0];

      try {
        await scoringAPI.score(entry.matchId, entry.data);
        this._queue.shift();
        await this._persist();
      } catch (error) {
        if (!error.response) {
          // Network error - stop syncing
          break;
        }
        // Server error - skip this entry after max retries
        entry.retries += 1;
        if (entry.retries >= 3) {
          this._queue.shift();
          failed.push(entry);
        } else {
          break;
        }
        await this._persist();
      }
    }

    this._syncing = false;
    this._notifyListeners();

    if (Notifications && (this._queue.length === 0)) {
      Notifications.scheduleNotificationAsync({
        content: {
          title: 'Sync Complete',
          body: failed.length > 0
            ? `Synced with ${failed.length} failed action(s)`
            : 'All offline scoring actions synced successfully.',
          sound: false,
        },
        trigger: null,
      }).catch(() => {});
    }

    return { synced: true, failed };
  }

  async clear(matchId) {
    if (matchId) {
      this._queue = this._queue.filter(e => e.matchId !== matchId);
    } else {
      this._queue = [];
    }
    await this._persist();
    this._notifyListeners();
  }

  addListener(callback) {
    this._listeners.push(callback);
    return () => {
      this._listeners = this._listeners.filter(l => l !== callback);
    };
  }

  _notifyListeners() {
    const state = {
      isOnline: this._isOnline,
      queueLength: this._queue.length,
      isSyncing: this._syncing,
      droppedSinceReset: this._droppedSinceReset,
    };
    this._listeners.forEach(l => l(state));
  }

  async _persist() {
    try {
      await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(this._queue));
    } catch {}
  }
}

const offlineQueue = new OfflineScoringQueue();
export default offlineQueue;
