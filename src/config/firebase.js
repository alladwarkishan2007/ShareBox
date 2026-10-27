let auth = null;
let db = null;
let storage = null;
let app = null;

const isBrowser = typeof window !== 'undefined';

if (isBrowser) {
  try {
    const { initializeApp } = await import('firebase/app');
    const { getAuth, connectAuthEmulator } = await import('firebase/auth');
    const { getFirestore, connectFirestoreEmulator } = await import('firebase/firestore');
    const { getStorage, connectStorageEmulator } = await import('firebase/storage');

    const firebaseConfig = {
      apiKey: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_API_KEY) || 'fake-api-key',
      authDomain: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_AUTH_DOMAIN) || 'sharebox-app.firebaseapp.com',
      projectId: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_PROJECT_ID) || 'sharebox-app',
      storageBucket: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_STORAGE_BUCKET) || 'sharebox-app.appspot.com',
      messagingSenderId: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_MESSAGING_SENDER_ID) || '123456789012',
      appId: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_APP_ID) || '1:123456789012:web:abcdef'
    };

    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    storage = getStorage(app);

    const useEmulator = typeof import.meta !== 'undefined' && import.meta.env?.VITE_USE_FIREBASE_EMULATOR === 'true';

    if (useEmulator) {
      const authHost = import.meta.env.VITE_AUTH_EMULATOR_HOST || 'localhost:9099';
      const firestoreHost = import.meta.env.VITE_FIRESTORE_EMULATOR_HOST || 'localhost:8080';
      const storageHost = import.meta.env.VITE_STORAGE_EMULATOR_HOST || 'localhost:9199';

      try {
        connectAuthEmulator(auth, `http://${authHost}`, { disableWarnings: true });
        const [fHost, fPort] = firestoreHost.split(':');
        connectFirestoreEmulator(db, fHost, parseInt(fPort, 10));
        const [sHost, sPort] = storageHost.split(':');
        connectStorageEmulator(storage, sHost, parseInt(sPort, 10));
        console.info('[ShareBox] Connected to Firebase Local Emulators');
      } catch (err) {
        console.warn('[ShareBox] Emulator connection notice:', err.message);
      }
    }
  } catch (e) {
    console.warn('[ShareBox] Firebase modular dynamic load notice:', e.message);
  }
}

export { auth, db, storage, app };
export default app;
