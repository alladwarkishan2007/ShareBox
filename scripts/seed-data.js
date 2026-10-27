/**
 * ShareBox Seed Script
 * Pre-populates Firestore with default campus landmarks, standard events, and demo requests.
 * Can be run via browser console or Node.js environment with emulator.
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { DEFAULT_LANDMARKS } from '../src/config/constants.js';

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || 'fake-api-key',
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || 'sharebox-app.firebaseapp.com',
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || 'sharebox-app',
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || 'sharebox-app.appspot.com',
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '123456789012',
  appId: process.env.VITE_FIREBASE_APP_ID || '1:123456789012:web:abcdef'
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export async function seedDatabase() {
  console.log('[Seed] Seeding Campus Landmarks...');
  for (const lm of DEFAULT_LANDMARKS) {
    await setDoc(doc(db, 'landmarks', lm.id), {
      name: lm.name,
      category: lm.category,
      lat: lm.lat,
      lng: lm.lng,
      order: lm.order,
      createdAt: serverTimestamp()
    });
  }

  console.log('[Seed] Seeding Default Campus Community...');
  await setDoc(doc(db, 'events', 'campus-general'), {
    id: 'campus-general',
    title: 'Campus General Community',
    description: 'Permanent platform community for daily campus-wide equipment and resource sharing.',
    type: 'Other',
    venue: 'Campus Wide',
    joinCode: 'CAMPUS',
    rules: 'Be respectful, return items on time in identical condition, and immediately report any accidental damage.',
    createdBy: 'system',
    isActive: true,
    memberCount: 1,
    createdAt: serverTimestamp()
  });

  console.log('[Seed] Seeding Sample Hackathon Event...');
  const now = new Date();
  const startAt = new Date(now.getTime() + 86400000);
  const endAt = new Date(now.getTime() + 86400000 * 3);

  await setDoc(doc(db, 'events', 'hackathon-2026'), {
    id: 'hackathon-2026',
    title: 'Annual Campus Hackathon 2026',
    description: '48-hour hardware and software innovation sprint for student teams.',
    type: 'Technical',
    venue: 'Main Auditorium & Innovation Lab',
    joinCode: 'HACK26',
    rules: 'All borrowed hardware and components must be returned by Sunday 5:00 PM in the same condition. Late returns or broken parts will result in temporary borrowing restriction.',
    startAt: Timestamp.fromDate(startAt),
    endAt: Timestamp.fromDate(endAt),
    createdBy: 'system',
    isActive: true,
    memberCount: 1,
    createdAt: serverTimestamp()
  });

  console.log('[Seed] Seeding Sample Item Requests...');
  const neededByTime = new Date(now.getTime() + 4 * 3600000); // in 4 hours
  const returnTime = new Date(now.getTime() + 24 * 3600000);  // in 24 hours

  await setDoc(doc(db, 'requests', 'req-arduino-sample'), {
    id: 'req-arduino-sample',
    eventId: 'campus-general',
    requesterId: 'demo-student-1',
    requesterName: 'Sarah Jenkins',
    helperId: null,
    helperName: null,
    type: 'request',
    itemName: 'Arduino Uno + Breadboard',
    category: 'Electronics',
    description: 'Need an Arduino Uno and half-size breadboard for IoT sensor calibration lab this afternoon.',
    quantity: 1,
    urgency: 'High',
    neededBy: Timestamp.fromDate(neededByTime),
    expectedReturnAt: Timestamp.fromDate(returnTime),
    photoURL: null,
    status: 'open',
    meetingPoint: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  await setDoc(doc(db, 'requests', 'req-adapter-sample'), {
    id: 'req-adapter-sample',
    eventId: 'hackathon-2026',
    requesterId: 'demo-student-2',
    requesterName: 'Devon Patel',
    helperId: null,
    helperName: null,
    type: 'request',
    itemName: 'USB-C to HDMI 4K Adapter',
    category: 'Cables/Chargers',
    description: 'Urgent: Presenting pitch deck in 30 minutes in Hall B. Need a working USB-C to HDMI adapter.',
    quantity: 1,
    urgency: 'Urgent',
    neededBy: Timestamp.fromDate(new Date(now.getTime() + 30 * 60000)),
    expectedReturnAt: Timestamp.fromDate(new Date(now.getTime() + 2 * 3600000)),
    photoURL: null,
    status: 'open',
    meetingPoint: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  console.log('[Seed] Seeding completed successfully!');
}

// Auto-run if executed directly via Node
if (typeof process !== 'undefined' && process.argv && process.argv[1]?.includes('seed-data.js')) {
  seedDatabase().then(() => process.exit(0)).catch(err => {
    console.error('[Seed Error]', err);
    process.exit(1);
  });
}
