import { ITEM_CATEGORIES, REQUEST_URGENCY } from '../config/constants.js';

/**
 * Validates whether an email has a standard valid format.
 * Accepts any valid email address (e.g. user@example.com, student@gmail.com, student@college.edu).
 * @param {string} email
 * @returns {boolean}
 */
export function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const normalized = email.trim().toLowerCase();
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
  return emailPattern.test(normalized);
}

// Alias for backward compatibility
export const isValidCollegeEmail = isValidEmail;

/**
 * Validates password strength (minimum 6 characters for Firebase Auth).
 * @param {string} password
 * @returns {{ valid: boolean, message?: string }}
 */
export function validatePassword(password) {
  if (!password || password.length < 6) {
    return { valid: false, message: 'Password must be at least 6 characters long.' };
  }
  return { valid: true };
}

/**
 * Validates item request payload before submission.
 * @param {object} payload
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateRequestPayload(payload) {
  const errors = [];

  if (!payload.itemName || payload.itemName.trim().length < 3) {
    errors.push('Item name must be at least 3 characters.');
  }

  if (!payload.category || !ITEM_CATEGORIES.includes(payload.category)) {
    errors.push('Please select a valid item category.');
  }

  if (!payload.urgency || !Object.values(REQUEST_URGENCY).includes(payload.urgency)) {
    errors.push('Please select a valid urgency level.');
  }

  if (!payload.neededBy) {
    errors.push('Needed-by date & time is required.');
  } else if (new Date(payload.neededBy) <= new Date()) {
    errors.push('Needed-by time must be in the future.');
  }

  if (payload.expectedReturnAt && new Date(payload.expectedReturnAt) <= new Date(payload.neededBy)) {
    errors.push('Expected return time must be after the needed-by time.');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
