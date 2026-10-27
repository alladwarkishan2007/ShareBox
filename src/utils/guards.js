import { USER_ROLES, USER_STATUS } from '../config/constants.js';
import { toDate } from './dates.js';

/**
 * Checks if a user has an active borrowing restriction.
 * @param {object} userData
 * @returns {{ isRestricted: boolean, remainingDays: number, until: Date | null }}
 */
export function checkUserRestriction(userData) {
  if (!userData || !userData.restrictedUntil) {
    return { isRestricted: false, remainingDays: 0, until: null };
  }

  const restrictedDate = toDate(userData.restrictedUntil);
  if (!restrictedDate) {
    return { isRestricted: false, remainingDays: 0, until: null };
  }

  const now = new Date();
  if (restrictedDate > now) {
    const diffDays = Math.ceil((restrictedDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return { isRestricted: true, remainingDays: diffDays, until: restrictedDate };
  }

  return { isRestricted: false, remainingDays: 0, until: restrictedDate };
}

/**
 * Checks if the user is approved to use the application.
 */
export function isUserApproved(userData) {
  return userData && userData.status === USER_STATUS.APPROVED;
}

/**
 * Checks if the user has organizer or admin privileges.
 */
export function isUserOrganizer(userData) {
  return userData && (userData.role === USER_ROLES.ORGANIZER || userData.role === USER_ROLES.ADMIN);
}

/**
 * Checks if the user has platform administrator privileges.
 */
export function isUserAdmin(userData) {
  return userData && userData.role === USER_ROLES.ADMIN;
}
