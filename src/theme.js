// CreckStars Theme System
// Like CSS custom properties — COLORS/GRADIENTS are mutable refs
// that ThemeContext updates. All screens auto-reflect the current theme.

// ══════ DARK PALETTE ══════
const DARK_COLORS = {
  BG: '#0D0D0D', BG_LIGHT: '#111111', BG_DEEP: '#0A1628',
  CARD: '#1A1A1A', CARD_ELEVATED: '#222222',
  SURFACE: '#2A2A2A', SURFACE_LIGHT: '#333333', SURFACE_HIGHLIGHT: '#1F2937',
  BORDER: '#2C2C2C', BORDER_LIGHT: '#3A3A3A',
  TEXT: '#FFFFFF', TEXT_SECONDARY: '#B0B0B0', TEXT_MUTED: '#777777', TEXT_HINT: '#555555',
  ACCENT: '#1E88E5', ACCENT_LIGHT: '#42A5F5', ACCENT_DARK: '#1565C0',
  ACCENT_SOFT: 'rgba(30,136,229,0.15)', ACCENT_SOFT_BORDER: 'rgba(30,136,229,0.3)',
  DANGER: '#E53935', DANGER_LIGHT: '#FF5252', DANGER_SOFT: 'rgba(229,57,53,0.15)',
  LIVE: '#FF3B30', LIVE_BG: 'rgba(255,59,48,0.15)',
  SUCCESS: '#4CAF50', SUCCESS_LIGHT: '#22C55E', SUCCESS_BG: 'rgba(76,175,80,0.15)',
  WARNING: '#FF9800', WARNING_LIGHT: '#F59E0B', WARNING_BG: 'rgba(255,152,0,0.15)',
  INFO: '#2196F3', INFO_LIGHT: '#3B82F6', INFO_BG: 'rgba(33,150,243,0.15)',
  COMPLETED: '#9E9E9E', COMPLETED_BG: 'rgba(158,158,158,0.15)',
  GREEN: '#4CAF50', GREEN_LIGHT: '#16A34A', RED: '#EF4444', RED_DARK: '#B91C1C',
  GOLD: '#FFD700', PURPLE: '#8B5CF6', INDIGO: '#6366F1', INDIGO_LIGHT: '#818CF8',
  WHITE: '#FFFFFF', BLACK: '#000000',
  OVERLAY: 'rgba(0,0,0,0.7)', OVERLAY_DEEP: 'rgba(0,0,0,0.78)', SHADOW: '#000000',
  // Surface tints — frequently used overlays/glows
  WHITE_06: 'rgba(255,255,255,0.06)',
  WHITE_08: 'rgba(255,255,255,0.08)',
  WHITE_04: 'rgba(255,255,255,0.04)',
  BLACK_30: 'rgba(0,0,0,0.30)',
  BLACK_40: 'rgba(0,0,0,0.40)',
  BLACK_60: 'rgba(0,0,0,0.60)',
};

// ══════ LIGHT PALETTE ══════
const LIGHT_COLORS = {
  BG: '#F5F6FA', BG_LIGHT: '#FFFFFF', BG_DEEP: '#E8EEF5',
  CARD: '#FFFFFF', CARD_ELEVATED: '#F8F9FC',
  SURFACE: '#EEF0F6', SURFACE_LIGHT: '#E4E6EF', SURFACE_HIGHLIGHT: '#E2E8F0',
  BORDER: '#E0E2EA', BORDER_LIGHT: '#D0D2DA',
  TEXT: '#1A1A2E', TEXT_SECONDARY: '#4A4A6A', TEXT_MUTED: '#8080A0', TEXT_HINT: '#B0B0C8',
  ACCENT: '#1E88E5', ACCENT_LIGHT: '#1976D2', ACCENT_DARK: '#1565C0',
  ACCENT_SOFT: 'rgba(30,136,229,0.08)', ACCENT_SOFT_BORDER: 'rgba(30,136,229,0.2)',
  DANGER: '#D32F2F', DANGER_LIGHT: '#E53935', DANGER_SOFT: 'rgba(211,47,47,0.08)',
  LIVE: '#D32F2F', LIVE_BG: 'rgba(211,47,47,0.08)',
  SUCCESS: '#2E7D32', SUCCESS_LIGHT: '#16A34A', SUCCESS_BG: 'rgba(46,125,50,0.08)',
  WARNING: '#E65100', WARNING_LIGHT: '#F59E0B', WARNING_BG: 'rgba(230,81,0,0.08)',
  INFO: '#1565C0', INFO_LIGHT: '#3B82F6', INFO_BG: 'rgba(21,101,192,0.08)',
  COMPLETED: '#757575', COMPLETED_BG: 'rgba(117,117,117,0.08)',
  GREEN: '#2E7D32', GREEN_LIGHT: '#16A34A', RED: '#DC2626', RED_DARK: '#991B1B',
  GOLD: '#D4A017', PURPLE: '#7C3AED', INDIGO: '#4F46E5', INDIGO_LIGHT: '#6366F1',
  WHITE: '#FFFFFF', BLACK: '#000000',
  OVERLAY: 'rgba(0,0,0,0.4)', OVERLAY_DEEP: 'rgba(0,0,0,0.55)', SHADOW: 'rgba(0,0,0,0.1)',
  WHITE_06: 'rgba(0,0,0,0.04)',
  WHITE_08: 'rgba(0,0,0,0.06)',
  WHITE_04: 'rgba(0,0,0,0.03)',
  BLACK_30: 'rgba(0,0,0,0.18)',
  BLACK_40: 'rgba(0,0,0,0.25)',
  BLACK_60: 'rgba(0,0,0,0.40)',
};

const DARK_GRADIENTS = {
  SCREEN: ['#0D0D0D', '#111111', '#0D0D0D'],
  HEADER: ['#1A1A1A', '#0D0D0D'],
  CARD: ['#1F1F1F', '#1A1A1A'],
  CARD_HOVER: ['#282828', '#1F1F1F'],
  PRIMARY: ['#1E88E5', '#1565C0'],
  PRIMARY_LIGHT: ['#42A5F5', '#1E88E5'],
  PRIMARY_SOFT: ['rgba(30,136,229,0.2)', 'rgba(30,136,229,0.05)'],
  RED: ['#E53935', '#C62828'],
  RED_LIGHT: ['#FF5252', '#E53935'],
  RED_SOFT: ['rgba(229,57,53,0.2)', 'rgba(229,57,53,0.05)'],
  DARK_FADE: ['rgba(0,0,0,0.8)', 'rgba(0,0,0,0.3)', 'transparent'],
  DARK_UP: ['transparent', 'rgba(0,0,0,0.6)', 'rgba(0,0,0,0.9)'],
  BUTTON: ['#1E88E5', '#1565C0'],
  BUTTON_DARK: ['#333333', '#222222'],
  LIVE_PULSE: ['#FF3B30', '#E53935'],
  // Cricket-screen surface gradients (used by HomeTab/MatchDetail/TournamentDetail)
  HERO_DARK: ['#0D0D0D', '#1A1A2E', '#16213E'],   // top-of-screen hero header
  LOADER:    ['#0A1628', '#0F2847', '#0A1628'],   // splash / loader background
  SLATE_CARD:['#1E293B', '#0F172A'],              // slate-blue card surfaces
  QUICK_ACTION: ['#1F2937', '#111827'],           // quick action button surface
};

const LIGHT_GRADIENTS = {
  SCREEN: ['#F5F6FA', '#FFFFFF', '#F5F6FA'],
  HEADER: ['#FFFFFF', '#F5F6FA'],
  CARD: ['#FFFFFF', '#F8F9FC'],
  CARD_HOVER: ['#F0F1F5', '#FFFFFF'],
  PRIMARY: ['#1E88E5', '#1565C0'],
  PRIMARY_LIGHT: ['#42A5F5', '#1E88E5'],
  PRIMARY_SOFT: ['rgba(30,136,229,0.1)', 'rgba(30,136,229,0.02)'],
  RED: ['#E53935', '#C62828'],
  RED_LIGHT: ['#FF5252', '#E53935'],
  RED_SOFT: ['rgba(229,57,53,0.1)', 'rgba(229,57,53,0.02)'],
  DARK_FADE: ['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.1)', 'transparent'],
  DARK_UP: ['transparent', 'rgba(0,0,0,0.15)', 'rgba(0,0,0,0.3)'],
  BUTTON: ['#1E88E5', '#1565C0'],
  BUTTON_DARK: ['#E4E6EF', '#D0D2DA'],
  LIVE_PULSE: ['#D32F2F', '#C62828'],
  HERO_DARK: ['#FFFFFF', '#F5F6FA', '#EEF0F6'],
  LOADER:    ['#F5F6FA', '#E8EEF5', '#F5F6FA'],
  SLATE_CARD:['#FFFFFF', '#F8F9FC'],
  QUICK_ACTION: ['#F8F9FC', '#EEF0F6'],
};

// ══════ MUTABLE EXPORTS (like CSS variables) ══════
// These objects are mutated in-place by applyTheme().
// Every file that imports COLORS/GRADIENTS reads the current values.
export const COLORS = { ...DARK_COLORS };
export const GRADIENTS = { ...DARK_GRADIENTS };

/**
 * Apply a theme globally. Called by ThemeContext when theme changes.
 * Mutates COLORS and GRADIENTS in-place so all existing imports update.
 */
export const applyTheme = (isDark) => {
  const src = isDark ? DARK_COLORS : LIGHT_COLORS;
  const grad = isDark ? DARK_GRADIENTS : LIGHT_GRADIENTS;
  Object.keys(src).forEach(k => { COLORS[k] = src[k]; });
  Object.keys(grad).forEach(k => { GRADIENTS[k] = grad[k]; });
};

// STATUS_CONFIG reads from COLORS at call time (not import time)
// so it auto-reflects the current theme
export const STATUS_CONFIG = {
  get live() { return { bg: COLORS.LIVE_BG, text: COLORS.LIVE, chipBg: COLORS.LIVE, chipText: '#fff', label: 'LIVE' }; },
  get in_progress() { return { bg: COLORS.LIVE_BG, text: COLORS.LIVE, chipBg: COLORS.LIVE, chipText: '#fff', label: 'LIVE' }; },
  get upcoming() { return { bg: COLORS.INFO_BG, text: COLORS.INFO, chipBg: COLORS.INFO, chipText: '#fff', label: 'UPCOMING' }; },
  get completed() { return { bg: COLORS.COMPLETED_BG, text: COLORS.COMPLETED, chipBg: COLORS.COMPLETED, chipText: '#fff', label: 'COMPLETED' }; },
  get toss() { return { bg: COLORS.WARNING_BG, text: COLORS.WARNING, chipBg: COLORS.WARNING, chipText: '#fff', label: 'TOSS' }; },
  get squad_set() { return { bg: COLORS.WARNING_BG, text: COLORS.WARNING, chipBg: COLORS.WARNING, chipText: '#fff', label: 'SQUAD SET' }; },
  get created() { return { bg: COLORS.COMPLETED_BG, text: COLORS.TEXT_MUTED, chipBg: COLORS.SURFACE, chipText: COLORS.TEXT_SECONDARY, label: 'CREATED' }; },
  get draft() { return { bg: COLORS.COMPLETED_BG, text: COLORS.TEXT_MUTED, chipBg: COLORS.SURFACE, chipText: COLORS.TEXT_SECONDARY, label: 'DRAFT' }; },
  get scheduled() { return { bg: COLORS.WARNING_BG, text: COLORS.WARNING, chipBg: COLORS.WARNING, chipText: '#fff', label: 'SCHEDULED' }; },
};

export const getStatusInfo = (status) => {
  const s = STATUS_CONFIG[status] || {};
  return {
    label: s.label || (status || '').replace(/_/g, ' ').toUpperCase(),
    bg: s.chipBg || COLORS.SURFACE,
    color: s.chipText || COLORS.TEXT_SECONDARY,
    badgeBg: s.bg || COLORS.SURFACE,
    badgeText: s.text || COLORS.TEXT_MUTED,
  };
};

// ══════ DESIGN TOKENS ══════
// Spacing scale (multiples of 4)
export const SPACING = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32, huge: 40,
};

// Border radius scale
export const RADIUS = {
  xs: 4, sm: 8, md: 10, lg: 12, xl: 14, xxl: 16, pill: 999,
};

// Type scale — sizes only; weights inline since not many variations
export const TYPE = {
  hero: 32,
  h1: 24,
  h2: 20,
  h3: 18,
  body: 15,
  bodySm: 14,
  caption: 13,
  small: 12,
  micro: 11,
  tiny: 10,
};

// Button preset gradients
export const BUTTON_GRADIENTS = {
  primary: ['#1E88E5', '#1565C0'],         // blue (matches ACCENT → ACCENT_DARK)
  warning: ['#FFA726', '#F57C00'],         // amber
  danger:  ['#EF4444', '#B91C1C'],         // red
  success: ['#22C55E', '#16A34A'],         // green
};

// Soft glow gradients (for hero icon rings, score boxes etc.)
export const GLOW_GRADIENTS = {
  primary: ['rgba(30,136,229,0.32)', 'rgba(30,136,229,0.04)'],
  warning: ['rgba(255,152,0,0.32)', 'rgba(255,152,0,0.04)'],
  danger:  ['rgba(229,57,53,0.32)', 'rgba(229,57,53,0.04)'],
  success: ['rgba(34,197,94,0.32)', 'rgba(34,197,94,0.04)'],
};

// Shared shadow
export const CARD_SHADOW = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.3,
  shadowRadius: 8,
  elevation: 6,
};

export const CARD_SHADOW_LIGHT = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.2,
  shadowRadius: 4,
  elevation: 3,
};

// Expose palettes for ThemeContext and design reference
export { DARK_COLORS, LIGHT_COLORS, DARK_GRADIENTS, LIGHT_GRADIENTS };
