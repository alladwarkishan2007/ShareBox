/**
 * Plain English Error Formatter
 * Converts technical Firebase codes, network faults, and validation exceptions
 * into clear, user-friendly explanations.
 */

export function getPlainEnglishError(error) {
  if (!error) return 'An unexpected error occurred. Please try again.';

  const rawMessage = typeof error === 'string' ? error : error.message || '';
  const code = error.code || '';

  // 1. Firebase Auth error codes
  if (code === 'auth/api-key-not-valid' || rawMessage.includes('api-key-not-valid') || rawMessage.includes('invalid-api-key') || rawMessage.toLowerCase().includes('api key')) {
    return 'The Firebase cloud service is not configured with a valid API key. Please configure your Firebase credentials in the .env file or continue exploring using local offline mode.';
  }
  if (code === 'auth/invalid-credential' || rawMessage.includes('auth/invalid-credential')) {
    return 'Incorrect email or password. Please verify your login details and try again.';
  }
  if (code === 'auth/wrong-password' || rawMessage.includes('wrong-password')) {
    return 'The password you entered is incorrect. Please verify your login details and try again.';
  }
  if (code === 'auth/user-not-found' || rawMessage.includes('user-not-found')) {
    return 'No account was found with this email. Please check your spelling or sign up for a new account.';
  }
  if (code === 'auth/email-already-in-use' || rawMessage.includes('email-already-in-use') || rawMessage.includes('already exists')) {
    return 'This email address is already registered. Try signing in.';
  }
  if (code === 'auth/weak-password' || rawMessage.includes('weak-password')) {
    return 'Your password is too short or weak. Please choose a password with at least 6 characters.';
  }
  if (code === 'auth/invalid-email' || rawMessage.includes('invalid-email')) {
    return 'The email format looks incorrect. Please enter a standard email like name@example.com.';
  }
  if (code === 'auth/too-many-requests' || rawMessage.includes('too-many-requests')) {
    return 'Too many unsuccessful attempts. For security reasons, access is temporarily locked. Please wait a few minutes and try again.';
  }
  if (code === 'auth/network-request-failed' || rawMessage.includes('network-request-failed')) {
    return 'Unable to reach the server. Please check your internet connection and try again.';
  }

  // 2. Firestore & Permission errors
  if (code === 'permission-denied' || rawMessage.includes('permission-denied')) {
    return 'Permission denied: You do not have authorization to modify or view this resource.';
  }
  if (rawMessage.includes('restricted') || rawMessage.includes('Restricted')) {
    return 'Your account currently has an active borrowing restriction resulting from a damage report.';
  }
  if (rawMessage.includes('blocked') || rawMessage.includes('Blocked')) {
    return 'Your account has been suspended by the campus administrator.';
  }
  if (rawMessage.includes('expired') || rawMessage.includes('Expired')) {
    return 'This request has expired because the needed-by time has already passed.';
  }
  if (rawMessage.includes('already been accepted')) {
    return 'Another student just accepted this item a moment ago. Please refresh the feed for new requests.';
  }
  if (rawMessage.includes('Microphone access denied')) {
    return 'Microphone access was blocked. Please enable microphone permissions in your browser address bar to start voice calling.';
  }
  if (rawMessage.includes('Location access')) {
    return 'Location access was not granted. You can still pick a meeting spot by selecting from campus landmarks or dragging the map marker.';
  }

  // 3. Fallback clean message
  // Strip raw code prefixes like "Firebase: Error (auth/...)" if present
  const cleaned = rawMessage
    .replace(/^Firebase:\s*Error\s*\([^)]*\):\s*/i, '')
    .replace(/^Error:\s*/i, '')
    .trim();

  return cleaned || 'Something went wrong. Please check your input and try again.';
}
