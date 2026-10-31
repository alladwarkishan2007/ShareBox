// ShareBox Global Constants & Enumerations

export const COLLEGE_EMAIL_DOMAIN = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_COLLEGE_EMAIL_DOMAIN) || 'college.edu';

export const ITEM_CATEGORIES = [
  'Electronics',
  'Stationery',
  'Tools',
  'Cables/Chargers',
  'Costume/Props',
  'Books',
  'Other'
];

export const REQUEST_STATUS = {
  OPEN: 'open',
  ACCEPTED: 'accepted',
  HANDED_OVER: 'handed_over',
  RETURNED: 'returned',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  EXPIRED: 'expired',
  DAMAGE_REPORTED: 'damage_reported'
};

export const REQUEST_URGENCY = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  URGENT: 'Urgent'
};

export const EVENT_TYPES = [
  'Technical',
  'Workshop',
  'Seminar',
  'Competition',
  'Cultural',
  'Other'
];

export const USER_ROLES = {
  MEMBER: 'member',
  ORGANIZER: 'organizer',
  ADMIN: 'admin'
};

export const USER_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  BLOCKED: 'blocked',
  REJECTED: 'rejected'
};

// WebRTC ICE Configuration
export const RTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

// Default Campus Geolocation Coordinates (Centroid)
export const DEFAULT_CAMPUS_COORDS = {
  lat: 12.9716,
  lng: 77.5946,
  zoom: 17
};

// Standard Predefined Campus Landmarks
export const DEFAULT_LANDMARKS = [
  { id: 'lib', name: 'Central Library', category: 'Academic', lat: 12.9719, lng: 77.5948, order: 1 },
  { id: 'caf', name: 'Campus Cafeteria', category: 'Food', lat: 12.9712, lng: 77.5942, order: 2 },
  { id: 'aud', name: 'Main Auditorium', category: 'Recreation', lat: 12.9723, lng: 77.5939, order: 3 },
  { id: 'ece', name: 'Engineering Block A', category: 'Academic', lat: 12.9710, lng: 77.5952, order: 4 },
  { id: 'adm', name: 'Admin Building', category: 'Admin', lat: 12.9715, lng: 77.5935, order: 5 },
  { id: 'gat', name: 'Main Campus Gate', category: 'Gate', lat: 12.9705, lng: 77.5940, order: 6 }
];
