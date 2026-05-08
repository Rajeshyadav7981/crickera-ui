/**
 * Shared date formatting utilities.
 * Replaces duplicate formatting scattered across 14+ screens.
 */

/**
 * "8 Jun" or "8 Jun 2025" — for match cards, tournament cards.
 */
export const formatDate = (dateStr) => {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    const now = new Date();
    const sameYear = d.getFullYear() === now.getFullYear();
    return d.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      ...(sameYear ? {} : { year: 'numeric' }),
    });
  } catch {
    return dateStr;
  }
};

/**
 * "8/6" — compact day/month for Recent Form cards.
 */
export const formatShortDate = (dateStr) => {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    if (isNaN(d)) return null;
    return `${d.getDate()}/${d.getMonth() + 1}`;
  } catch {
    return null;
  }
};

/**
 * "8 June 2025" — full date for profile DOB, tournament details.
 */
export const formatFullDate = (dateStr) => {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return dateStr;
  }
};

/**
 * "Today", "Yesterday", "Tomorrow", or "8 Jun" — for HomeTab, feed.
 */
export const cricketDateLabel = (dateStr) => {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const diff = Math.round((target - today) / 86400000);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
    if (diff === -1) return 'Yesterday';
    return formatDate(dateStr);
  } catch {
    return dateStr;
  }
};

/**
 * "2h ago", "3d ago", "just now" — relative time for posts, comments.
 */
export const timeAgo = (dateStr) => {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d)) return '';
    const diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return formatDate(dateStr);
  } catch {
    return '';
  }
};

/**
 * Calculate age from DOB string "YYYY-MM-DD".
 */
export const calculateAge = (dob) => {
  if (!dob) return null;
  try {
    const d = new Date(dob);
    if (isNaN(d)) return null;
    return Math.floor((Date.now() - d.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  } catch {
    return null;
  }
};

/**
 * Format overs: 4.300000001 → "4.3", 10.0 → "10"
 */
export const formatOvers = (ov) => {
  if (ov == null) return '0';
  const rounded = Math.round(ov * 10) / 10;
  return rounded % 1 === 0 ? String(Math.floor(rounded)) : rounded.toFixed(1);
};

/**
 * Format decimal stats: 7.5000001 → "7.50"
 */
export const formatDecimal = (val) => {
  if (val == null || val === '-') return '-';
  return typeof val === 'number' ? val.toFixed(2) : val;
};
