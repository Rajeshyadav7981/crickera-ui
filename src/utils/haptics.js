// Haptic "sound effects" for live scoring — vibration feedback on six / four /
// wicket / runs / win. Uses expo-haptics, loaded defensively so the app never
// crashes if the native module isn't installed yet (run `npx expo install
// expo-haptics` and rebuild to enable). All calls are no-ops when disabled or
// when the module is unavailable.
import AsyncStorage from '@react-native-async-storage/async-storage';

let Haptics = null;
try { Haptics = require('expo-haptics'); } catch { Haptics = null; }

const KEY = 'haptics_enabled';
let _enabled = true; // default ON; overwritten by initHaptics() from storage

// Load the persisted on/off preference. Call once at app startup so scoring
// triggers respect the user's choice app-wide.
export const initHaptics = async () => {
  try {
    const v = await AsyncStorage.getItem(KEY);
    if (v !== null) _enabled = v === '1';
  } catch {}
  return _enabled;
};

export const isHapticsEnabled = () => _enabled;

export const setHapticsEnabled = async (on) => {
  _enabled = !!on;
  try { await AsyncStorage.setItem(KEY, _enabled ? '1' : '0'); } catch {}
};

const impact = (style) => {
  if (!_enabled || !Haptics?.impactAsync || !style) return;
  try { Haptics.impactAsync(style); } catch {}
};
const notify = (type) => {
  if (!_enabled || !Haptics?.notificationAsync || !type) return;
  try { Haptics.notificationAsync(type); } catch {}
};

// Named effects mapped to escalating intensity. Six is the biggest (double
// heavy buzz); win is a celebratory burst.
export const haptics = {
  run: () => impact(Haptics?.ImpactFeedbackStyle?.Light),
  four: () => impact(Haptics?.ImpactFeedbackStyle?.Medium),
  six: () => {
    impact(Haptics?.ImpactFeedbackStyle?.Heavy);
    setTimeout(() => impact(Haptics?.ImpactFeedbackStyle?.Heavy), 120);
  },
  wicket: () => notify(Haptics?.NotificationFeedbackType?.Error),
  win: () => {
    notify(Haptics?.NotificationFeedbackType?.Success);
    setTimeout(() => impact(Haptics?.ImpactFeedbackStyle?.Heavy), 160);
    setTimeout(() => impact(Haptics?.ImpactFeedbackStyle?.Heavy), 340);
  },
};
