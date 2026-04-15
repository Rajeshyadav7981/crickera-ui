/**
 * Centralized icon system using @expo/vector-icons.
 * Consistent colors, sizes, and icon set across the app.
 */
import React from 'react';
import { MaterialCommunityIcons, Ionicons, MaterialIcons, Feather } from '@expo/vector-icons';
import { COLORS } from '../theme';

// Default icon color — light muted for dark theme
const DEFAULT_COLOR = COLORS.TEXT_SECONDARY;
const ACTIVE_COLOR = COLORS.ACCENT_LIGHT;

/**
 * App-wide icon map. All icons in one place for consistency.
 * Uses MaterialCommunityIcons (largest set with cricket/sports icons).
 */
const ICON_MAP = {
  // Tab bar
  home: { set: 'mci', name: 'home-outline', activeName: 'home' },
  tournaments: { set: 'mci', name: 'trophy-outline', activeName: 'trophy' },
  community: { set: 'mci', name: 'account-group-outline', activeName: 'account-group' },
  profile: { set: 'mci', name: 'account-outline', activeName: 'account' },

  // Quick actions
  cricket: { set: 'mci', name: 'cricket' },
  trophy: { set: 'mci', name: 'trophy' },
  team: { set: 'mci', name: 'account-group' },
  stats: { set: 'mci', name: 'chart-bar' },
  match: { set: 'mci', name: 'cricket' },

  // Player roles
  batsman: { set: 'mci', name: 'cricket' },
  bowler: { set: 'mci', name: 'baseball' },
  allRounder: { set: 'mci', name: 'star-circle-outline' },
  wicketKeeper: { set: 'mci', name: 'hand-back-left' },

  // Sections / UI
  location: { set: 'mci', name: 'map-marker-outline' },
  venue: { set: 'mci', name: 'stadium-variant' },
  calendar: { set: 'mci', name: 'calendar-outline' },
  clock: { set: 'mci', name: 'clock-outline' },
  edit: { set: 'feather', name: 'edit-2' },
  settings: { set: 'ionicons', name: 'settings-outline' },
  help: { set: 'mci', name: 'help-circle-outline' },
  logout: { set: 'mci', name: 'logout' },
  share: { set: 'feather', name: 'share-2' },
  search: { set: 'feather', name: 'search' },

  // Match detail
  toss: { set: 'mci', name: 'circle-double' },
  scorecard: { set: 'mci', name: 'clipboard-text-outline' },
  commentary: { set: 'mci', name: 'comment-text-outline' },
  info: { set: 'mci', name: 'information-outline' },

  // Community
  heart: { set: 'mci', name: 'heart-outline' },
  heartFilled: { set: 'mci', name: 'heart' },
  comment: { set: 'mci', name: 'comment-outline' },
  bookmark: { set: 'mci', name: 'bookmark-outline' },
  bookmarkFilled: { set: 'mci', name: 'bookmark' },
  image: { set: 'mci', name: 'image-outline' },
  poll: { set: 'mci', name: 'poll' },
  link: { set: 'mci', name: 'link-variant' },
  send: { set: 'feather', name: 'send' },

  // Status / Feedback
  warning: { set: 'mci', name: 'alert-circle-outline' },
  sync: { set: 'mci', name: 'sync' },
  wifi: { set: 'mci', name: 'wifi' },
  wifiOff: { set: 'mci', name: 'wifi-off' },

  // Misc
  phone: { set: 'feather', name: 'phone' },
  email: { set: 'feather', name: 'mail' },
  check: { set: 'mci', name: 'check-circle' },
  close: { set: 'mci', name: 'close' },
  back: { set: 'mci', name: 'chevron-left' },
  forward: { set: 'mci', name: 'chevron-right' },
  down: { set: 'mci', name: 'chevron-down' },
  up: { set: 'mci', name: 'chevron-up' },
  notification: { set: 'mci', name: 'bell-outline' },
  door: { set: 'mci', name: 'door-open' },
  run: { set: 'mci', name: 'run-fast' },
  chart: { set: 'mci', name: 'chart-line' },

  // Greeting
  sun: { set: 'mci', name: 'weather-sunny' },
  sunCloud: { set: 'mci', name: 'weather-partly-cloudy' },
  sunset: { set: 'mci', name: 'weather-sunset' },
  moon: { set: 'mci', name: 'weather-night' },
};

const SETS = {
  mci: MaterialCommunityIcons,
  ionicons: Ionicons,
  material: MaterialIcons,
  feather: Feather,
};

/**
 * Render an icon by key name.
 * @param {string} name - Key from ICON_MAP
 * @param {number} size - Icon size (default 22)
 * @param {string} color - Override color
 * @param {boolean} active - Use active variant + active color
 */
const Icon = ({ name, size = 22, color, active = false, style }) => {
  const config = ICON_MAP[name];
  if (!config) return null;

  const IconComponent = SETS[config.set];
  if (!IconComponent) return null;

  const iconName = active && config.activeName ? config.activeName : config.name;
  const iconColor = color || (active ? ACTIVE_COLOR : DEFAULT_COLOR);

  return <IconComponent name={iconName} size={size} color={iconColor} style={style} />;
};

const MemoIcon = React.memo(Icon);
export { MemoIcon as Icon, ICON_MAP, ACTIVE_COLOR, DEFAULT_COLOR };
export default MemoIcon;
