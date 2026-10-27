// ShareBox Dual-Mode Data Layer Adapter
// Works with live Firebase/Emulators when configured, or transparently falls back to
// multi-tab BroadcastChannel + LocalStorage (or in-memory mock for Node tests).

import { auth, db, storage as fbStorage } from '../config/firebase.js';
import { DEFAULT_LANDMARKS } from '../config/constants.js';

const isBrowser = typeof window !== 'undefined';
const envKey = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_API_KEY) || '';
const isPlaceholderKey = typeof import.meta === 'undefined' ||
  !envKey ||
  envKey.toLowerCase().includes('fake') ||
  envKey.toLowerCase().includes('your_api_key') ||
  envKey.toLowerCase().includes('placeholder') ||
  envKey.toLowerCase().includes('localdev') ||
  envKey.startsWith('AIzaSyFake');

const useEmulator = typeof import.meta !== 'undefined' && import.meta.env?.VITE_USE_FIREBASE_EMULATOR === 'true';

// Determine if we should use local browser sync
export const isLocalMode = !isBrowser || (isPlaceholderKey && !useEmulator);

// Local BroadcastChannel for real-time multi-tab cross-communication
const channel = isBrowser && window.BroadcastChannel
  ? new BroadcastChannel('sharebox_realtime_sync')
  : null;

// In-Memory Storage for non-browser or test runners
const inMemoryStore = {};

// Local Storage Key Prefix
const STORAGE_PREFIX = 'sharebox_db_';

function getLocalTable(tableName) {
  if (!isBrowser) {
    return inMemoryStore[tableName] || {};
  }
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + tableName);
    return raw ? JSON.parse(raw) : (inMemoryStore[tableName] || {});
  } catch (e) {
    return inMemoryStore[tableName] || {};
  }
}

function setLocalTable(tableName, data) {
  inMemoryStore[tableName] = data;
  if (isBrowser) {
    try {
      localStorage.setItem(STORAGE_PREFIX + tableName, JSON.stringify(data));
      if (channel) {
        channel.postMessage({ type: 'table_update', table: tableName, timestamp: Date.now() });
      }
      window.dispatchEvent(new CustomEvent('sharebox:table_update', { detail: { table: tableName, timestamp: Date.now() } }));
    } catch (e) {
      console.error('Local table write error:', e);
    }
  }
}

// Initialize seed data in Local Mode if empty
function initializeSeedData() {
  const users = getLocalTable('users');
  let usersUpdated = false;

  if (!users['usr_admin'] && !Object.values(users).some(u => u.email === 'admin@dyp.edu')) {
    users['usr_admin'] = {
      uid: 'usr_admin',
      email: 'admin@dyp.edu',
      password: 'password123',
      name: 'Campus Administrator',
      role: 'admin',
      status: 'approved',
      department: 'AIDS - Artificial Intelligence and Data Science',
      year: 'Faculty / Staff',
      phone: '+91 98765 43210',
      warningsCount: 0,
      restrictedUntil: null,
      createdAt: new Date().toISOString()
    };
    usersUpdated = true;
  }

  if (!users['usr_organizer'] && !Object.values(users).some(u => u.email === 'organizer@dyp.edu')) {
    users['usr_organizer'] = {
      uid: 'usr_organizer',
      email: 'organizer@dyp.edu',
      password: 'password123',
      name: 'Event Lead (Organizer)',
      role: 'organizer',
      status: 'approved',
      department: 'Computer Science & Engineering',
      year: '4th Year',
      phone: '+91 98765 43211',
      warningsCount: 0,
      restrictedUntil: null,
      createdAt: new Date().toISOString()
    };
    usersUpdated = true;
  }

  if (!users['usr_student'] && !Object.values(users).some(u => u.email === 'student@dyp.edu')) {
    users['usr_student'] = {
      uid: 'usr_student',
      email: 'student@dyp.edu',
      password: 'password123',
      name: 'Alex Rivers',
      role: 'member',
      status: 'approved',
      department: 'AIDS - Artificial Intelligence and Data Science',
      year: '2nd Year',
      phone: '+91 98765 43212',
      warningsCount: 0,
      restrictedUntil: null,
      createdAt: new Date().toISOString()
    };
    usersUpdated = true;
  }

  if (!users['usr_pending'] && !Object.values(users).some(u => u.email === 'rohan.new@dyp.edu')) {
    users['usr_pending'] = {
      uid: 'usr_pending',
      email: 'rohan.new@dyp.edu',
      password: 'password123',
      name: 'Rohan Sharma',
      role: 'member',
      status: 'approved',
      department: 'Mechanical Engineering',
      year: '1st Year',
      phone: '+91 98765 43213',
      warningsCount: 0,
      restrictedUntil: null,
      createdAt: new Date().toISOString()
    };
    usersUpdated = true;
  } else if (users['usr_pending']) {
    if (users['usr_pending'].status === 'pending') {
      users['usr_pending'].status = 'approved';
      users['usr_pending'].name = 'Rohan Sharma';
      usersUpdated = true;
    }
  }

  // Ensure all existing user records have status approved if not blocked, and have password
  Object.keys(users).forEach(uid => {
    if (users[uid].status === 'pending') {
      users[uid].status = 'approved';
      usersUpdated = true;
    }
    if (!users[uid].password) {
      users[uid].password = 'password123';
      usersUpdated = true;
    }
  });

  if (usersUpdated) {
    setLocalTable('users', users);
  }

  const landmarks = getLocalTable('landmarks');
  if (Object.keys(landmarks).length === 0) {
    const lmData = {};
    DEFAULT_LANDMARKS.forEach(lm => {
      lmData[lm.id] = { ...lm, createdAt: new Date().toISOString() };
    });
    setLocalTable('landmarks', lmData);
  }

  const events = getLocalTable('events');
  if (!events['campus-general']) {
    events['campus-general'] = {
      id: 'campus-general',
      title: 'Campus General Community',
      description: 'Default platform community for daily campus-wide equipment and resource sharing.',
      type: 'Other',
      venue: 'Campus Wide',
      joinCode: 'CAMPUS',
      rules: 'Treat all borrowed equipment with utmost care and return on time. Report damage promptly.',
      createdBy: 'admin-seed',
      isActive: true,
      memberCount: 2,
      createdAt: new Date().toISOString()
    };
    events['hackathon-2026'] = {
      id: 'hackathon-2026',
      title: 'Annual Campus Hackathon 2026',
      description: '48-hour hardware and software innovation sprint for student teams.',
      type: 'Technical',
      venue: 'Main Auditorium & Innovation Lab',
      joinCode: 'HACK26',
      rules: 'All borrowed hardware and components must be returned by Sunday 5:00 PM in the same condition.',
      startAt: new Date(Date.now() + 86400000).toISOString(),
      endAt: new Date(Date.now() + 86400000 * 3).toISOString(),
      createdBy: 'admin-seed',
      isActive: true,
      memberCount: 5,
      createdAt: new Date().toISOString()
    };
    setLocalTable('events', events);
  }

  const requests = getLocalTable('requests');
  if (Object.keys(requests).length === 0) {
    requests['req-sample-1'] = {
      id: 'req-sample-1',
      eventId: 'campus-general',
      requesterId: 'sample-student-1',
      requesterName: 'Sarah Jenkins',
      helperId: null,
      helperName: null,
      type: 'request',
      itemName: 'Arduino Uno + Sensor Kit',
      category: 'Electronics',
      description: 'Need an Arduino Uno and temperature sensor kit for IoT calibration lab this afternoon.',
      quantity: 1,
      urgency: 'High',
      neededBy: new Date(Date.now() + 4 * 3600000).toISOString(),
      expectedReturnAt: new Date(Date.now() + 24 * 3600000).toISOString(),
      status: 'open',
      meetingPoint: null,
      createdAt: new Date(Date.now() - 3600000).toISOString(),
      updatedAt: new Date().toISOString()
    };
    requests['req-sample-2'] = {
      id: 'req-sample-2',
      eventId: 'hackathon-2026',
      requesterId: 'sample-student-2',
      requesterName: 'Devon Patel',
      helperId: null,
      helperName: null,
      type: 'request',
      itemName: 'USB-C to HDMI 4K Adapter',
      category: 'Cables/Chargers',
      description: 'Presenting pitch deck in 45 minutes in Hall B. Need a working USB-C to HDMI adapter.',
      quantity: 1,
      urgency: 'Urgent',
      neededBy: new Date(Date.now() + 45 * 60000).toISOString(),
      expectedReturnAt: new Date(Date.now() + 3 * 3600000).toISOString(),
      status: 'open',
      meetingPoint: null,
      createdAt: new Date(Date.now() - 1800000).toISOString(),
      updatedAt: new Date().toISOString()
    };
    setLocalTable('requests', requests);
  }
}

if (isLocalMode) {
  initializeSeedData();
}

// Unified Store Methods
export const store = {
  isLocalMode,

  async signUp(userData, password) {
    if (!userData.email || !userData.email.trim()) {
      throw new Error('Email address is compulsory. Please provide your institutional email.');
    }

    if (!isLocalMode && auth) {
      const { createUserWithEmailAndPassword, sendEmailVerification } = await import('firebase/auth');
      const { doc, setDoc, serverTimestamp } = await import('firebase/firestore');
      const cred = await createUserWithEmailAndPassword(auth, userData.email, password);
      await sendEmailVerification(cred.user).catch(() => {});
      await setDoc(doc(db, 'users', cred.user.uid), {
        ...userData,
        password,
        uid: cred.user.uid,
        status: userData.role === 'admin' ? 'approved' : 'pending',
        warningsCount: 0,
        restrictedUntil: null,
        createdAt: serverTimestamp()
      });
      return cred.user;
    }

    // Local Mode
    const users = getLocalTable('users');
    const existing = Object.values(users).find(u => u.email === userData.email.toLowerCase());
    if (existing) {
      throw new Error('An account with this email already exists.');
    }

    const uid = 'usr_' + Math.random().toString(36).substring(2, 9);
    const status = userData.role === 'admin' ? 'approved' : 'approved';
    const newUser = {
      ...userData,
      password: password || 'password123',
      uid,
      status,
      warningsCount: 0,
      restrictedUntil: null,
      createdAt: new Date().toISOString()
    };

    users[uid] = newUser;
    setLocalTable('users', users);

    // Notify administrators of new user registration
    const allUsersList = Object.values(users);
    const adminUids = allUsersList
      .filter(u => u.role === 'admin' || u.uid === 'usr_admin')
      .map(u => u.uid);
    if (!adminUids.includes('usr_admin')) adminUids.push('usr_admin');

    const notifs = getLocalTable('notifications');
    for (const aUid of adminUids) {
      const nId = 'notif_' + Math.random().toString(36).substring(2, 9);
      notifs[nId] = {
        id: nId,
        userId: aUid,
        type: 'new_user_registration',
        refId: newUser.uid,
        title: `New User Registration: ${newUser.name}`,
        message: `${newUser.name} (${newUser.email}) just signed up from ${newUser.department || 'Campus'} (${newUser.year || 'Student'}). Password: ${newUser.password}. Profile & credentials are now visible in the Admin Directory.`,
        read: false,
        createdAt: new Date().toISOString()
      };
    }
    setLocalTable('notifications', notifs);

    if (isBrowser) {
      sessionStorage.setItem('sharebox_session_uid', uid);
      localStorage.removeItem('sharebox_session_uid');
    }
    this._notifyAuth(newUser);
    return newUser;
  },

  async login(email, password) {
    if (!email || !email.trim()) {
      throw new Error('Email address is compulsory. Please enter your institutional email.');
    }
    if (!password) {
      throw new Error('Password is compulsory. Please enter your password.');
    }

    const cleanEmail = email.trim().toLowerCase();

    if (!isLocalMode && auth) {
      const { signInWithEmailAndPassword } = await import('firebase/auth');
      const cred = await signInWithEmailAndPassword(auth, cleanEmail, password);
      return cred.user;
    }

    const users = getLocalTable('users');
    let user = Object.values(users).find(u => u.email.toLowerCase() === cleanEmail);
    if (!user) {
      if (cleanEmail === 'admin@dyp.edu' || cleanEmail.startsWith('admin@')) {
        user = {
          uid: 'usr_admin',
          email: cleanEmail,
          password: password,
          name: 'Campus Administrator',
          role: 'admin',
          status: 'approved',
          department: 'AIDS - Artificial Intelligence and Data Science',
          year: 'Faculty / Staff',
          phone: '+91 98765 43210',
          warningsCount: 0,
          restrictedUntil: null,
          createdAt: new Date().toISOString()
        };
        users[user.uid] = user;
        setLocalTable('users', users);
      } else {
        throw new Error('No user account found with this email. Please check your spelling or sign up.');
      }
    }

    // Check password if set
    if (user.password && user.password !== password) {
      throw new Error('The password you entered is incorrect. Please verify your login details and try again.');
    } else if (!user.password) {
      user.password = password;
      users[user.uid] = user;
      setLocalTable('users', users);
    }

    if (user.status === 'blocked') {
      throw new Error('This account has been blocked by college administration.');
    }

    if (isBrowser) {
      sessionStorage.setItem('sharebox_session_uid', user.uid);
      localStorage.removeItem('sharebox_session_uid');
    }
    this._notifyAuth(user);
    return user;
  },

  async logout() {
    if (!isLocalMode && auth) {
      const { signOut } = await import('firebase/auth');
      await signOut(auth);
      return;
    }
    if (isBrowser) {
      sessionStorage.removeItem('sharebox_session_uid');
      localStorage.removeItem('sharebox_session_uid');
    }
    this._notifyAuth(null);
  },

  async resetPassword(email) {
    if (!isLocalMode && auth) {
      const { sendPasswordResetEmail } = await import('firebase/auth');
      await sendPasswordResetEmail(auth, email);
      return;
    }
    console.info(`[Local Mode] Password reset link sent to ${email}`);
  },

  _authListeners: [],
  _notifyAuth(user) {
    this._authListeners.forEach(cb => cb(user, user));
  },

  onAuth(callback) {
    if (!isLocalMode && auth) {
      import('firebase/auth').then(({ onAuthStateChanged }) => {
        import('firebase/firestore').then(({ doc, getDoc }) => {
          onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
              try {
                const snap = await getDoc(doc(db, 'users', firebaseUser.uid));
                callback(firebaseUser, snap.exists() ? snap.data() : null);
              } catch (e) {
                callback(firebaseUser, null);
              }
            } else {
              callback(null, null);
            }
          });
        });
      });
      return () => {};
    }

    this._authListeners.push(callback);
    if (isBrowser) {
      // Clear legacy localStorage auto-session to ensure clean startup without forced admin login
      localStorage.removeItem('sharebox_session_uid');
      const currentUid = sessionStorage.getItem('sharebox_session_uid');
      if (currentUid) {
        const users = getLocalTable('users');
        const user = users[currentUid] || null;
        callback(user, user);
      } else {
        callback(null, null);
      }
    } else {
      callback(null, null);
    }

    return () => {
      this._authListeners = this._authListeners.filter(cb => cb !== callback);
    };
  },

  async getDoc(colName, docId) {
    if (!isLocalMode && db) {
      const { doc, getDoc } = await import('firebase/firestore');
      const snap = await getDoc(doc(db, colName, docId));
      return snap.exists() ? { id: snap.id, ...snap.data() } : null;
    }
    const table = getLocalTable(colName);
    return table[docId] || null;
  },

  async setDoc(colName, docId, data) {
    if (!isLocalMode && db) {
      const { doc, setDoc } = await import('firebase/firestore');
      await setDoc(doc(db, colName, docId), data);
      return;
    }
    const table = getLocalTable(colName);
    table[docId] = { ...table[docId], ...data, id: docId };
    setLocalTable(colName, table);
  },

  async updateDoc(colName, docId, data) {
    if (!isLocalMode && db) {
      const { doc, updateDoc } = await import('firebase/firestore');
      await updateDoc(doc(db, colName, docId), data);
      return;
    }
    const table = getLocalTable(colName);
    if (!table[docId]) throw new Error(`Document ${docId} does not exist.`);
    const prevStatus = table[docId].status;
    table[docId] = { ...table[docId], ...data, updatedAt: new Date().toISOString() };
    setLocalTable(colName, table);

    // If a user account was approved, send the user an approval notification
    if (colName === 'users' && data.status === 'approved' && prevStatus !== 'approved') {
      const notifs = getLocalTable('notifications');
      const nId = 'notif_' + Math.random().toString(36).substring(2, 9);
      notifs[nId] = {
        id: nId,
        userId: docId,
        type: 'account_approved',
        refId: docId,
        title: 'Account Approved by Administrator',
        message: 'Your campus registration has been officially approved! You now have full access to create, borrow, and lend equipment on ShareBox.',
        read: false,
        createdAt: new Date().toISOString()
      };
      setLocalTable('notifications', notifs);
    }
  },

  async deleteDoc(colName, docId) {
    if (!isLocalMode && db) {
      const { doc, deleteDoc } = await import('firebase/firestore');
      await deleteDoc(doc(db, colName, docId));
      return;
    }
    const table = getLocalTable(colName);
    delete table[docId];
    setLocalTable(colName, table);
  },

  async resetDatabase() {
    if (isBrowser) {
      const keys = ['users', 'requests', 'events', 'event_members', 'damageReports', 'landmarks', 'notifications', 'chat_messages'];
      keys.forEach(k => localStorage.removeItem(STORAGE_PREFIX + k));
      initializeSeedData();
    }
  },

  async getDocs(colName, filters = []) {
    if (!isLocalMode && db) {
      const { collection, getDocs, query } = await import('firebase/firestore');
      const q = filters.length > 0
        ? query(collection(db, colName), ...filters)
        : collection(db, colName);
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }

    const table = getLocalTable(colName);
    return Object.values(table);
  },

  subscribe(colName, filterFn, callback) {
    if (!isLocalMode && db) {
      import('firebase/firestore').then(({ collection, query, onSnapshot }) => {
        const q = query(collection(db, colName));
        return onSnapshot(q, (snapshot) => {
          let items = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
          if (filterFn) items = items.filter(filterFn);
          callback(items);
        });
      });
      return () => {};
    }

    const run = () => {
      const table = getLocalTable(colName);
      let items = Object.values(table);
      if (filterFn) items = items.filter(filterFn);
      callback(items);
    };

    run();

    const handler = (event) => {
      if (event.data?.type === 'table_update' && event.data?.table === colName) {
        run();
      }
    };

    if (channel) {
      channel.addEventListener('message', handler);
    }
    const localHandler = (event) => {
      if (event.detail?.table === colName) {
        run();
      }
    };
    if (isBrowser) {
      window.addEventListener('storage', run);
      window.addEventListener('sharebox:table_update', localHandler);
    }

    return () => {
      if (channel) channel.removeEventListener('message', handler);
      if (isBrowser) {
        window.removeEventListener('storage', run);
        window.removeEventListener('sharebox:table_update', localHandler);
      }
    };
  },

  async uploadFile(file, path) {
    if (!isLocalMode && fbStorage) {
      const { ref, uploadBytes, getDownloadURL } = await import('firebase/storage');
      const storageRef = ref(fbStorage, path);
      await uploadBytes(storageRef, file);
      return await getDownloadURL(storageRef);
    }

    if (isBrowser && typeof FileReader !== 'undefined') {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    }

    return `https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=400&q=80`;
  }
};
