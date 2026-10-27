// Date & Timestamp Formatting Utilities

/**
 * Normalizes Firestore Timestamps, ISO strings, or Date objects into a JS Date.
 */
export function toDate(timestamp) {
  if (!timestamp) return null;
  if (timestamp.toDate && typeof timestamp.toDate === 'function') {
    return timestamp.toDate();
  }
  if (timestamp.seconds) {
    return new Date(timestamp.seconds * 1000);
  }
  return new Date(timestamp);
}

/**
 * Formats a timestamp into human-readable relative time (e.g. "5m ago", "in 2 hours").
 */
export function formatRelativeTime(timestamp) {
  const date = toDate(timestamp);
  if (!date || isNaN(date.getTime())) return '';

  const now = new Date();
  const diffInSeconds = Math.round((date - now) / 1000);
  const isPast = diffInSeconds < 0;
  const absSeconds = Math.abs(diffInSeconds);

  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

  if (absSeconds < 60) return isPast ? 'just now' : 'in a few seconds';
  if (absSeconds < 3600) return rtf.format(Math.round(diffInSeconds / 60), 'minute');
  if (absSeconds < 86400) return rtf.format(Math.round(diffInSeconds / 3600), 'hour');
  if (absSeconds < 2592000) return rtf.format(Math.round(diffInSeconds / 86400), 'day');
  return rtf.format(Math.round(diffInSeconds / 2592000), 'month');
}

/**
 * Formats a timestamp to full readable string (e.g. "Oct 6, 2026, 2:30 PM").
 */
export function formatDateTime(timestamp) {
  const date = toDate(timestamp);
  if (!date || isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }).format(date);
}

/**
 * Returns true if the given date is in the past.
 */
export function isPastDate(timestamp) {
  const date = toDate(timestamp);
  if (!date) return false;
  return date.getTime() < Date.now();
}

/**
 * Returns true if expected return deadline is within the given threshold in hours.
 */
export function isNearDeadline(timestamp, hoursThreshold = 2) {
  const date = toDate(timestamp);
  if (!date) return false;
  const diffHours = (date.getTime() - Date.now()) / (1000 * 60 * 60);
  return diffHours > 0 && diffHours <= hoursThreshold;
}
