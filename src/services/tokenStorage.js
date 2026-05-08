// Secure storage wrapper for auth tokens.
//
// Why: tokens kept in AsyncStorage sit in plain-text app storage and are
// trivially readable on rooted Android devices or via adb pull of the app's
// data dir. expo-secure-store backs onto iOS Keychain / Android Keystore,
// which is the right home for bearer credentials.
//
// Web doesn't have SecureStore — it falls back to AsyncStorage there. Mobile
// is our shipping target, so this is the path that matters.
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SECURE_KEYS = ['token', 'refreshToken'];

let _secureStore = null;
if (Platform.OS !== 'web') {
  try {
    // Lazy require so a missing native module on web or in Expo Go without
    // the prebuild doesn't crash the bundle at import time.
    _secureStore = require('expo-secure-store');
  } catch (e) {
    if (__DEV__) console.warn('[tokenStorage] expo-secure-store unavailable, falling back to AsyncStorage:', e?.message);
    _secureStore = null;
  }
}

const _useSecure = (key) => _secureStore != null && SECURE_KEYS.includes(key);

export async function getSecureItem(key) {
  if (_useSecure(key)) {
    return _secureStore.getItemAsync(key);
  }
  return AsyncStorage.getItem(key);
}

export async function setSecureItem(key, value) {
  if (_useSecure(key)) {
    return _secureStore.setItemAsync(key, value);
  }
  return AsyncStorage.setItem(key, value);
}

export async function removeSecureItem(key) {
  if (_useSecure(key)) {
    return _secureStore.deleteItemAsync(key);
  }
  return AsyncStorage.removeItem(key);
}

// Convenience: remove a mix of secure and plain keys in one call (mirrors
// the AsyncStorage.multiRemove call-sites we replaced).
export async function removeAuthItems(keys) {
  await Promise.all(keys.map(async (k) => {
    try {
      if (_useSecure(k)) {
        await _secureStore.deleteItemAsync(k);
      } else {
        await AsyncStorage.removeItem(k);
      }
    } catch {}
  }));
}

// One-shot migration for users who installed a pre-SecureStore build: move
// any legacy token/refreshToken out of AsyncStorage into SecureStore and
// wipe the plain-text copy. Safe to call repeatedly (idempotent).
let _migrated = false;
export async function migrateLegacyTokens() {
  if (_migrated || !_secureStore) return;
  _migrated = true;
  await Promise.all(SECURE_KEYS.map(async (k) => {
    try {
      const legacy = await AsyncStorage.getItem(k);
      if (!legacy) return;
      const existing = await _secureStore.getItemAsync(k);
      if (!existing) await _secureStore.setItemAsync(k, legacy);
      await AsyncStorage.removeItem(k);
    } catch (e) {
      if (__DEV__) console.warn('[tokenStorage] migration failed for', k, e?.message);
    }
  }));
}
