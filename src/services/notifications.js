import { Platform } from 'react-native';
import Constants from 'expo-constants';
import api from './api';

// Lazy-loaded — only imported when actually registering (avoids Expo Go SDK 53+ errors at startup)
let Notifications = null;
let _initialized = false;
let _currentMatchId = null;

function _initNotifications() {
  if (_initialized) return;
  _initialized = true;
  try {
    Notifications = require('expo-notifications');
    // Android notification channel
    if (Platform.OS === 'android') {
      Notifications.setNotificationChannelAsync('match-updates', {
        name: 'Match Updates',
        importance: Notifications.AndroidImportance.HIGH,
        sound: 'default',
        vibrationPattern: [0, 250, 250, 250],
      });
    }
    // Handle foreground notifications
    Notifications.setNotificationHandler({
      handleNotification: async (notification) => {
        const data = notification.request.content.data;
        const isViewingMatch = _currentMatchId && data?.match_id === _currentMatchId;
        return {
          shouldShowAlert: !isViewingMatch,
          shouldPlaySound: !isViewingMatch,
          shouldSetBadge: true,
        };
      },
    });
  } catch {
    Notifications = null;
  }
}

export const setCurrentMatch = (matchId) => {
  _currentMatchId = matchId;
};

export const clearCurrentMatch = () => {
  _currentMatchId = null;
};

/**
 * Register for push notifications and send token to backend.
 * Call this on app startup after login.
 */
export async function registerForPushNotifications() {
  _initNotifications();
  if (!Notifications) return null;

  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;

    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      return null;
    }

    // Get projectId from Constants (Expo config)
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ||
      Constants.easConfig?.projectId ||
      undefined;

    // Get Expo push token
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId,
    });

    const token = tokenData.data;

    // Send to backend
    await api.post('/api/notifications/push-token', {
      token,
      device_type: Platform.OS,
    });

    return token;
  } catch (e) {
    // Silently fail in Expo Go — push notifications require dev build
    if (__DEV__) console.log('Push notifications unavailable (Expo Go):', e.message);
    return null;
  }
}

/**
 * Remove push token from backend (call on logout).
 */
export async function unregisterPushToken(token) {
  try {
    if (token) {
      await api.delete('/api/notifications/push-token', { data: { token } });
    }
  } catch {}
}

/**
 * Subscribe to notifications for a match.
 */
export async function subscribeToMatch(matchId) {
  try {
    await api.post(`/api/notifications/subscribe/${matchId}`);
  } catch {}
}

/**
 * Unsubscribe from a match.
 */
export async function unsubscribeFromMatch(matchId) {
  try {
    await api.delete(`/api/notifications/subscribe/${matchId}`);
  } catch {}
}

/**
 * Set up notification tap handler — navigates to match.
 * Call this once in your root component with a navigation ref.
 */
export function setupNotificationTapHandler(navigationRef) {
  _initNotifications();
  if (!Notifications) return () => {};

  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data;
    if (data?.match_id && navigationRef?.current) {
      navigationRef.current.navigate('MatchDetail', { matchId: data.match_id });
    }
  });
  return () => subscription.remove();
}
