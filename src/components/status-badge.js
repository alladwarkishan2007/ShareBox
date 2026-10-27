import { escapeHTML } from '../utils/sanitize.js';

/**
 * Returns HTML string for a request status badge.
 */
export function renderStatusBadge(status) {
  const normalized = (status || 'open').toLowerCase();
  const labelMap = {
    open: 'Open',
    accepted: 'Accepted',
    handed_over: 'Handed Over',
    returned: 'Returned',
    completed: 'Completed',
    cancelled: 'Cancelled',
    expired: 'Expired',
    damage_reported: 'Damage Reported'
  };

  const label = labelMap[normalized] || normalized;
  return `<span class="badge badge-status-${escapeHTML(normalized)}">${escapeHTML(label)}</span>`;
}

/**
 * Returns HTML string for an urgency badge.
 */
export function renderUrgencyBadge(urgency) {
  const normalized = (urgency || 'medium').toLowerCase();
  return `<span class="badge badge-urgency-${escapeHTML(normalized)}">${escapeHTML(urgency || 'Medium')}</span>`;
}
