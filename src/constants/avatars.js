// Preset avatars — chosen instead of uploading images to backend storage.
// A user's profile photo (and a tournament's logo) is stored as a short KEY
// string (e.g. "avatar:b3" / "tav:2") in the same field that used to hold an
// uploaded image URL. Nothing is uploaded; the app renders these locally.
//
// Each entry renders by preference: image (future branded asset) > emoji > icon.
// Profile avatars use person emojis (men & women, varied hairstyles); tournament
// logos use cricket-themed MaterialCommunityIcons glyphs.
//
// All gradients stay on-brand: blue → dark (the app is blue #1E88E5 on black),
// with each avatar a slightly different blue shade/depth so they're still
// distinguishable.
//
// Keys are intentionally STABLE so any profile already saved with a key keeps
// working — only what the key renders may change. Never rename a key.
//
// FUTURE: to swap in real branded portrait assets, set
// `image: require('../../assets/avatars/foo.png')` on an entry — the renderers
// prefer `image` when present and fall back to emoji/icon.

// 14 people avatars — 9 men + 5 women, young, different hairstyles/looks.
// (Cricket audience skews male, so the set is intentionally men-heavy.)
export const PROFILE_AVATARS = [
  { key: 'avatar:b1', emoji: '👦',    colors: ['#64B5F6', '#1976D2'], image: null }, // young, short hair
  { key: 'avatar:b2', emoji: '👨',    colors: ['#42A5F5', '#1565C0'], image: null }, // man
  { key: 'avatar:b3', emoji: '👨‍🦱', colors: ['#2196F3', '#0D47A1'], image: null }, // curly hair
  { key: 'avatar:b4', emoji: '👨‍🦰', colors: ['#1E88E5', '#0A1F44'], image: null }, // red hair
  { key: 'avatar:b5', emoji: '🧔',    colors: ['#3B82F6', '#1E293B'], image: null }, // beard
  { key: 'avatar:b6', emoji: '👨‍🦲', colors: ['#0EA5E9', '#0C4A6E'], image: null }, // bald
  { key: 'avatar:b7', emoji: '👨‍🎓', colors: ['#4F8FE0', '#0D1B2A'], image: null }, // graduate
  { key: 'avatar:b8', emoji: '👲',    colors: ['#5B8DEF', '#0F172A'], image: null }, // cap
  { key: 'avatar:b9', emoji: '👳‍♂️', colors: ['#60A5FA', '#1E40AF'], image: null }, // turban
  { key: 'avatar:g1', emoji: '👧',    colors: ['#38BDF8', '#0369A1'], image: null }, // young girl
  { key: 'avatar:g2', emoji: '👩',    colors: ['#7FB4F0', '#1565C0'], image: null }, // straight hair
  { key: 'avatar:g3', emoji: '👩‍🦱', colors: ['#5EA8F0', '#123A6B'], image: null }, // curly hair
  { key: 'avatar:g4', emoji: '👩‍🦰', colors: ['#74B3F2', '#1E3A8A'], image: null }, // red hair
  { key: 'avatar:g5', emoji: '🧕',    colors: ['#4DA0E8', '#0A2540'], image: null }, // headscarf
];

// 6 cricket-themed tournament logo presets (vector icons), blue/black gradients.
export const TOURNAMENT_AVATARS = [
  { key: 'tav:1', icon: 'trophy',      colors: ['#42A5F5', '#0D47A1'], image: null },
  { key: 'tav:2', icon: 'cricket',     colors: ['#1E88E5', '#0A1628'], image: null },
  { key: 'tav:3', icon: 'medal',       colors: ['#2196F3', '#1565C0'], image: null },
  { key: 'tav:4', icon: 'target',      colors: ['#3B82F6', '#1E3A8A'], image: null },
  { key: 'tav:5', icon: 'fire',        colors: ['#38BDF8', '#075985'], image: null },
  { key: 'tav:6', icon: 'star-circle', colors: ['#5B8DEF', '#0F172A'], image: null },
];

const _byKey = {};
[...PROFILE_AVATARS, ...TOURNAMENT_AVATARS].forEach((a) => { _byKey[a.key] = a; });

// True for any preset-avatar key (profile or tournament).
export const isAvatarKey = (v) =>
  typeof v === 'string' && (v.startsWith('avatar:') || v.startsWith('tav:'));

// Resolve a stored key to its avatar entry, or null if it's not a preset key.
export const getAvatar = (key) => (isAvatarKey(key) ? _byKey[key] || null : null);
