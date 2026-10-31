import { store } from './store.js';
import { DEFAULT_CAMPUS_COORDS, DEFAULT_LANDMARKS } from '../config/constants.js';

class LocationService {
  /**
   * Fetches one-time user location using browser Geolocation API.
   * Privacy Principle: Never invokes watchPosition. Never stores raw live GPS coordinates.
   */
  async getOneTimePosition() {
    return new Promise((resolve, reject) => {
      if (!('geolocation' in navigator)) {
        return reject(new Error('Geolocation is not supported by your browser.'));
      }

      const options = {
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 0
      };

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy
          });
        },
        (error) => {
          let message = 'Location access failed.';
          if (error.code === error.PERMISSION_DENIED) {
            message = 'Location access was denied. You can select a campus landmark manually.';
          } else if (error.code === error.POSITION_UNAVAILABLE) {
            message = 'GPS signal is weak or unavailable indoors.';
          } else if (error.code === error.TIMEOUT) {
            message = 'Location request timed out.';
          }
          reject(new Error(message));
        },
        options
      );
    });
  }

  async getCampusLandmarks() {
    const landmarks = await store.getDocs('landmarks');
    if (landmarks.length > 0) {
      return landmarks.sort((a, b) => (a.order || 0) - (b.order || 0));
    }
    return DEFAULT_LANDMARKS;
  }

  getCampusLandmarksSync() {
    const landmarks = store.getLocalDocs('landmarks');
    if (landmarks.length > 0) {
      return landmarks.sort((a, b) => (a.order || 0) - (b.order || 0));
    }
    return DEFAULT_LANDMARKS;
  }

  getDefaultCentroid() {
    return DEFAULT_CAMPUS_COORDS;
  }
}

export const locationService = new LocationService();
