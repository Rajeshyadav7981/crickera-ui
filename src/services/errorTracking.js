import { Platform } from 'react-native';
import Constants from 'expo-constants';
import api from './api';

const APP_VERSION = Constants.expoConfig?.version || '1.0.0';

let errorQueue = [];
let flushTimer = null;

const flush = async () => {
  if (errorQueue.length === 0) return;
  const batch = [...errorQueue];
  errorQueue = [];
  try {
    await api.post('/api/errors/batch', { errors: batch }).catch(() => {});
  } catch {
    // Silent — don't crash the app trying to report a crash
  }
};

const scheduleFlush = () => {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flush();
  }, 5000); // Batch errors, send every 5s
};

export const trackError = (error, context = {}) => {
  const entry = {
    type: 'error',
    message: error?.message || String(error),
    stack: error?.stack?.substring(0, 500) || null,
    context,
    platform: Platform.OS,
    version: APP_VERSION,
    timestamp: new Date().toISOString(),
  };
  errorQueue.push(entry);
  scheduleFlush();

  if (__DEV__) {
    console.warn('[ErrorTracker]', entry.message, context);
  }
};


if (!__DEV__) {
  const originalHandler = ErrorUtils.getGlobalHandler();
  ErrorUtils.setGlobalHandler((error, isFatal) => {
    trackError(error, { fatal: isFatal, handler: 'global' });
    flush(); // Flush immediately for fatal errors
    if (originalHandler) originalHandler(error, isFatal);
  });
}
