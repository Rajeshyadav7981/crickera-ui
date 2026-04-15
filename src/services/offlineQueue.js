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
  }

  // Initialize: load persisted queue and start listening for network changes
  async init() {
    try {
      const stored = await AsyncStorage.getItem(QUEUE_KEY);
      if (stored) this._queue = JSON.parse(stored);
    } catch {}

    // Listen for connectivity changes
    this._unsubscribe = NetInfo.addEventListener((state) => {
      const wasOffline = !this._isOnline;
      this._isOnline = state.isConnected && state.isInternetReachable !== false;

      // Auto-sync when coming back online
      if (wasOffline && this._isOnline && this._queue.length > 0) {
        this.sync();
      }

      this._notifyListeners();
    });

    // Check initial state
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

  // Add a scoring action to the queue
  async enqueue(matchId, data) {
    const entry = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      matchId,
      data,
      timestamp: Date.now(),
      retries: 0,
    };

    if (this._isOnline) {
      // Try to send immediately
      try {
        const result = await scoringAPI.score(matchId, data);
        return { success: true, result: result.data };
      } catch (error) {
        // If network error, queue it; otherwise throw
        if (!error.response) {
          if (this._queue.length >= MAX_QUEUE_SIZE) {
            this._queue.shift();
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
        this._queue.shift(); // Drop oldest entry
      }
      this._queue.push(entry);
      await this._persist();
      this._notifyListeners();

      // Show local notification so scorer knows it's queued
      if (Notifications && this._queue.length === 1) {
        Notifications.scheduleNotificationAsync({
          content: {
            title: 'Offline Mode',
            body: 'Scoring actions are being queued. They will sync when you\'re back online.',
            sound: false,
          },
          trigger: null, // immediately
        }).catch(() => {});
      }

      return { success: false, queued: true };
    }
  }

  // Sync queued actions
  async sync() {
    if (this._syncing || !this._isOnline || this._queue.length === 0) return;

    this._syncing = true;
    this._notifyListeners();

    const failed = [];

    while (this._queue.length > 0) {
      const entry = this._queue[0];

      try {
        await scoringAPI.score(entry.matchId, entry.data);
        this._queue.shift(); // Remove on success
        await this._persist();
      } catch (error) {
        if (!error.response) {
          // Network error - stop syncing
          break;
        }
        // Server error - skip this entry after max retries
        entry.retries += 1;
        if (entry.retries >= 3) {
          this._queue.shift(); // Drop after 3 retries
          failed.push(entry);
        } else {
          break; // Stop and retry later
        }
        await this._persist();
      }
    }

    this._syncing = false;
    this._notifyListeners();

    // Local notification when sync completes
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

  // Clear queue (e.g., when match ends)
  async clear(matchId) {
    if (matchId) {
      this._queue = this._queue.filter(e => e.matchId !== matchId);
    } else {
      this._queue = [];
    }
    await this._persist();
    this._notifyListeners();
  }

  // Subscribe to queue changes
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
