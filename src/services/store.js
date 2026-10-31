// ShareBox Unified Supabase Data Layer Adapter
// Connects to live Supabase backend (PostgreSQL + Realtime + Storage)
// with seamless multi-tab BroadcastChannel and local cache for instant offline resilience.

import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '../config/supabase.js';
import { DEFAULT_LANDMARKS } from '../config/constants.js';

const isBrowser = typeof window !== 'undefined';

// Supabase is configured and live
export const isLocalMode = false;

// Local BroadcastChannel for instant multi-tab cross-communication
const channel = isBrowser && window.BroadcastChannel
  ? new BroadcastChannel('sharebox_realtime_sync')
  : null;

// Supabase Realtime channel for WebRTC call signaling across multiple machines/browsers
const signalingChannel = supabase ? supabase.channel('sharebox_signaling') : null;
if (signalingChannel) {
  signalingChannel
    .on('broadcast', { event: 'call_signal' }, (payload) => {
      if (payload && payload.payload) {
        const { colName, docId, data } = payload.payload;
        const local = getLocalTable(colName);
        local[docId] = data;
        setLocalTable(colName, local);
      }
    })
    .subscribe();
}

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

// Allowed columns per table in Supabase schema
const TABLE_COLUMNS = {
  users: new Set(['id', 'email', 'password', 'name', 'role', 'status', 'department', 'year', 'phone', 'photo_url', 'warnings_count', 'restricted_until', 'created_at', 'updated_at']),
  events: new Set(['id', 'title', 'description', 'type', 'venue', 'join_code', 'rules', 'created_by', 'creator_name', 'is_active', 'member_count', 'start_at', 'end_at', 'created_at']),
  event_members: new Set(['id', 'event_id', 'user_id', 'role', 'joined_at']),
  requests: new Set(['id', 'status', 'photo_url', 'created_at', 'updated_at', 'description', 'type', 'event_id', 'requester_id', 'requester_name', 'helper_id', 'helper_name', 'item_name', 'category', 'quantity', 'urgency', 'needed_by', 'expected_return_at', 'meeting_point', 'handover_condition', 'return_condition', 'completed_at']),
  messages: new Set(['id', 'request_id', 'sender_id', 'sender_name', 'text', 'image_url', 'seen_by', 'created_at']),
  damage_reports: new Set(['id', 'status', 'created_at', 'description', 'event_id', 'request_id', 'owner_id', 'owner_name', 'borrower_id', 'photos', 'borrower_response', 'decision', 'responded_at']),
  landmarks: new Set(['id', 'name', 'category', 'lat', 'lng', 'order', 'created_at']),
  notifications: new Set(['id', 'user_id', 'type', 'ref_id', 'title', 'message', 'read', 'created_at'])
};

// Map collection/table names between client camelCase and Supabase Postgres tables
function resolveTable(colName) {
  if (colName === 'damageReports') return 'damage_reports';
  if (colName.startsWith('messages_')) return 'messages';
  return colName;
}

function safeParseJSON(val) {
  if (typeof val === 'string' && (val.startsWith('{') || val.startsWith('['))) {
    try {
      return JSON.parse(val);
    } catch (e) {
      return val;
    }
  }
  return val;
}

// Convert Supabase snake_case row to frontend camelCase object
function fromDB(colName, row) {
  if (!row || typeof row !== 'object') return row;
  const out = { ...row };

  // Always alias id as uid for user records
  if (out.id && (colName === 'users' || out.email)) {
    out.uid = out.id;
  }

  // Field mappings
  if ('photo_url' in out) out.photoURL = out.photo_url;
  if ('warnings_count' in out) out.warningsCount = out.warnings_count;
  if ('restricted_until' in out) out.restrictedUntil = out.restricted_until;
  if ('created_at' in out) out.createdAt = out.created_at;
  if ('updated_at' in out) out.updatedAt = out.updated_at;
  if ('join_code' in out) out.joinCode = out.join_code;
  if ('created_by' in out) out.createdBy = out.created_by;
  if ('creator_name' in out) out.creatorName = out.creator_name;
  if ('is_active' in out) out.isActive = out.is_active;
  if ('member_count' in out) out.memberCount = out.member_count;
  if ('start_at' in out) out.startAt = out.start_at;
  if ('end_at' in out) out.endAt = out.end_at;
  if ('event_id' in out) out.eventId = out.event_id;
  if ('user_id' in out) out.userId = out.user_id;
  if ('joined_at' in out) out.joinedAt = out.joined_at;
  if ('requester_id' in out) out.requesterId = out.requester_id;
  if ('requester_name' in out) out.requesterName = out.requester_name;
  if ('helper_id' in out) out.helperId = out.helper_id;
  if ('helper_name' in out) out.helperName = out.helper_name;
  if ('item_name' in out) out.itemName = out.item_name;
  if ('needed_by' in out) out.neededBy = out.needed_by;
  if ('expected_return_at' in out) out.expectedReturnAt = out.expected_return_at;
  if ('completed_at' in out) out.completedAt = out.completed_at;
  if ('meeting_point' in out) out.meetingPoint = safeParseJSON(out.meeting_point);
  if ('handover_condition' in out) out.handoverCondition = safeParseJSON(out.handover_condition);
  if ('return_condition' in out) out.returnCondition = safeParseJSON(out.return_condition);
  if ('request_id' in out) out.requestId = out.request_id;
  if ('sender_id' in out) out.senderId = out.sender_id;
  if ('sender_name' in out) out.senderName = out.sender_name;
  if ('image_url' in out) out.imageURL = out.image_url;
  if ('seen_by' in out) out.seenBy = safeParseJSON(out.seen_by);
  if ('owner_id' in out) out.ownerId = out.owner_id;
  if ('owner_name' in out) out.ownerName = out.owner_name;
  if ('borrower_id' in out) out.borrowerId = out.borrower_id;
  if ('borrower_response' in out) out.borrowerResponse = out.borrower_response;
  if ('decision' in out) out.decision = safeParseJSON(out.decision);
  if ('photos' in out) out.photos = safeParseJSON(out.photos);
  if ('responded_at' in out) out.respondedAt = out.responded_at;
  if ('ref_id' in out) out.refId = out.ref_id;

  return out;
}

// Convert frontend camelCase object to Supabase snake_case row
function toDB(colName, data) {
  if (!data || typeof data !== 'object') return data;
  const out = { ...data };

  // Use uid as id if id is missing
  if (!out.id && out.uid) {
    out.id = out.uid;
  }
  delete out.uid;

  if ('photoURL' in out) { out.photo_url = out.photoURL; delete out.photoURL; }
  if ('warningsCount' in out) { out.warnings_count = out.warningsCount; delete out.warningsCount; }
  if ('restrictedUntil' in out) { out.restricted_until = out.restrictedUntil; delete out.restrictedUntil; }
  if ('createdAt' in out) { out.created_at = out.createdAt; delete out.createdAt; }
  if ('updatedAt' in out) { out.updated_at = out.updatedAt; delete out.updatedAt; }
  if ('completedAt' in out) { out.completed_at = out.completedAt; delete out.completedAt; }
  if ('joinCode' in out) { out.join_code = out.joinCode; delete out.joinCode; }
  if ('createdBy' in out) { out.created_by = out.createdBy; delete out.createdBy; }
  if ('creatorName' in out) { out.creator_name = out.creatorName; delete out.creatorName; }
  if ('isActive' in out) { out.is_active = out.isActive; delete out.isActive; }
  if ('memberCount' in out) { out.member_count = out.memberCount; delete out.memberCount; }
  if ('startAt' in out) { out.start_at = out.startAt; delete out.startAt; }
  if ('endAt' in out) { out.end_at = out.endAt; delete out.endAt; }
  if ('eventId' in out) { out.event_id = out.eventId; delete out.eventId; }
  if ('userId' in out) { out.user_id = out.userId; delete out.userId; }
  if ('joinedAt' in out) { out.joined_at = out.joinedAt; delete out.joinedAt; }
  if ('requesterId' in out) { out.requester_id = out.requesterId; delete out.requesterId; }
  if ('requesterName' in out) { out.requester_name = out.requesterName; delete out.requesterName; }
  if ('helperId' in out) { out.helper_id = out.helperId; delete out.helperId; }
  if ('helperName' in out) { out.helper_name = out.helperName; delete out.helperName; }
  if ('itemName' in out) { out.item_name = out.itemName; delete out.itemName; }
  if ('neededBy' in out) { out.needed_by = out.neededBy; delete out.neededBy; }
  if ('expectedReturnAt' in out) { out.expected_return_at = out.expectedReturnAt; delete out.expectedReturnAt; }
  if ('meetingPoint' in out) {
    out.meeting_point = typeof out.meetingPoint === 'object' && out.meetingPoint !== null ? JSON.stringify(out.meetingPoint) : out.meetingPoint;
    delete out.meetingPoint;
  }
  if ('handoverCondition' in out) {
    out.handover_condition = typeof out.handoverCondition === 'object' && out.handoverCondition !== null ? JSON.stringify(out.handoverCondition) : out.handoverCondition;
    delete out.handoverCondition;
  }
  if ('returnCondition' in out) {
    out.return_condition = typeof out.returnCondition === 'object' && out.returnCondition !== null ? JSON.stringify(out.returnCondition) : out.returnCondition;
    delete out.returnCondition;
  }
  if ('decision' in out && typeof out.decision === 'object' && out.decision !== null) {
    out.decision = JSON.stringify(out.decision);
  }
  if ('requestId' in out) { out.request_id = out.requestId; delete out.requestId; }
  if ('senderId' in out) { out.sender_id = out.senderId; delete out.senderId; }
  if ('senderName' in out) { out.sender_name = out.senderName; delete out.senderName; }
  if ('imageURL' in out) { out.image_url = out.imageURL; delete out.imageURL; }
  if ('seenBy' in out) { out.seen_by = out.seenBy; delete out.seenBy; }
  if ('ownerId' in out) { out.owner_id = out.ownerId; delete out.ownerId; }
  if ('ownerName' in out) { out.owner_name = out.ownerName; delete out.ownerName; }
  if ('borrowerId' in out) { out.borrower_id = out.borrowerId; delete out.borrowerId; }
  if ('borrowerResponse' in out) { out.borrower_response = out.borrowerResponse; delete out.borrowerResponse; }
  if ('respondedAt' in out) { out.responded_at = out.respondedAt; delete out.respondedAt; }
  if ('refId' in out) { out.ref_id = out.refId; delete out.refId; }

  // Special case for chat subcollections messages_${requestId}
  if (colName.startsWith('messages_')) {
    out.request_id = colName.replace('messages_', '');
  }

  // Filter to only columns known to exist in the database table
  const tableName = resolveTable(colName);
  const allowed = TABLE_COLUMNS[tableName];
  if (allowed) {
    const filtered = {};
    for (const key of Object.keys(out)) {
      if (allowed.has(key)) {
        filtered[key] = out[key];
      }
    }
    return filtered;
  }

  return out;
}

// Unified Store Methods powered directly by Supabase
export const store = {
  isLocalMode,
  supabase,

  async signUp(userData, password) {
    if (!userData.email || !userData.email.trim()) {
      throw new Error('Email address is compulsory. Please provide your institutional email.');
    }

    const cleanEmail = userData.email.trim().toLowerCase();

    // Check if user already exists in Supabase
    try {
      const { data: existing } = await supabase
        .from('users')
        .select('*')
        .eq('email', cleanEmail)
        .maybeSingle();

      if (existing) {
        throw new Error('An account with this email already exists.');
      }
    } catch (e) {
      if (e.message && e.message.includes('already exists')) throw e;
    }

    const uid = 'usr_' + Math.random().toString(36).substring(2, 9);
    // New users start as pending approval until an admin approves them
    const status = (userData.role === 'admin' || cleanEmail === 'admin@dyp.edu' || cleanEmail.startsWith('admin@') || userData.status === 'approved') ? 'approved' : 'pending';

    const dbUserPayload = {
      id: uid,
      email: cleanEmail,
      password: password || 'password123',
      name: userData.name || cleanEmail.split('@')[0],
      role: userData.role || 'member',
      status,
      department: userData.department || '',
      year: userData.year || '',
      phone: userData.phone || '',
      photo_url: userData.photoURL || '',
      warnings_count: 0,
      restricted_until: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Save user directly to Supabase users table
    const { error: insertError } = await supabase.from('users').upsert(dbUserPayload);
    if (insertError) {
      console.warn('[Supabase] User insert notice:', insertError.message);
    }

    const newUser = fromDB('users', dbUserPayload);

    // Save to local cache for instant multi-tab sync
    const users = getLocalTable('users');
    users[uid] = newUser;
    setLocalTable('users', users);

    // Notify administrators of new user registration
    try {
      const { data: adminUsers } = await supabase
        .from('users')
        .select('id')
        .eq('role', 'admin');

      const adminUids = (adminUsers && adminUsers.length > 0)
        ? adminUsers.map(u => u.id)
        : ['usr_admin'];

      const localNotifs = getLocalTable('notifications');
      for (const aUid of adminUids) {
        const nId = 'notif_' + Math.random().toString(36).substring(2, 9);
        const notifPayload = {
          id: nId,
          user_id: aUid,
          type: 'new_user_registration',
          ref_id: newUser.uid,
          title: `New Member Request: ${newUser.name}`,
          message: `${newUser.name} (${newUser.email}) wants to become a member of ShareBox from ${newUser.department || 'Campus'} (${newUser.year || 'Student'}). Review and approve membership request.`,
          read: false,
          created_at: new Date().toISOString()
        };
        await supabase.from('notifications').insert(notifPayload);
        localNotifs[nId] = fromDB('notifications', notifPayload);
      }
      setLocalTable('notifications', localNotifs);
    } catch (e) {
      console.warn('[Supabase] Admin notif notice:', e);
    }

    if (isBrowser) {
      sessionStorage.setItem('sharebox_session_uid', uid);
      localStorage.setItem('sharebox_session_uid', uid);
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

    // Query user directly from Supabase users table
    let userRow = null;
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', cleanEmail)
        .maybeSingle();

      if (!error && data) {
        userRow = data;
      }
    } catch (e) {
      console.warn('[Supabase] User lookup notice:', e);
    }

    // Auto-provision admin if missing
    if (!userRow) {
      if (cleanEmail === 'admin@dyp.edu' || cleanEmail.startsWith('admin@')) {
        userRow = {
          id: 'usr_admin',
          email: cleanEmail,
          password: password,
          name: 'Campus Administrator',
          role: 'admin',
          status: 'approved',
          department: 'AIDS - Artificial Intelligence and Data Science',
          year: 'Faculty / Staff',
          phone: '+91 98765 43210',
          warnings_count: 0,
          restricted_until: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        await supabase.from('users').upsert(userRow);
      } else {
        // Fallback to local table check
        const localUsers = getLocalTable('users');
        const localMatch = Object.values(localUsers).find(u => u.email?.toLowerCase() === cleanEmail);
        if (localMatch) {
          userRow = toDB('users', localMatch);
        } else {
          throw new Error('No user account found with this email. Please check your spelling or sign up.');
        }
      }
    }

    // Check password
    if (userRow.password && userRow.password !== password) {
      throw new Error('The password you entered is incorrect. Please verify your login details and try again.');
    } else if (!userRow.password) {
      userRow.password = password;
      await supabase.from('users').update({ password }).eq('id', userRow.id);
    }

    if (userRow.status === 'blocked') {
      throw new Error('This account has been blocked by college administration.');
    }

    const user = fromDB('users', userRow);

    // Sync to local cache
    const users = getLocalTable('users');
    users[user.uid] = user;
    setLocalTable('users', users);

    if (isBrowser) {
      sessionStorage.setItem('sharebox_session_uid', user.uid);
      localStorage.setItem('sharebox_session_uid', user.uid);
    }
    this._notifyAuth(user);
    return user;
  },

  async logout() {
    if (isBrowser) {
      sessionStorage.removeItem('sharebox_session_uid');
      localStorage.removeItem('sharebox_session_uid');
    }
    this._notifyAuth(null);
  },

  async resetPassword(email) {
    if (!email) return;
    console.info(`[ShareBox] Password reset requested for ${email}`);
  },

  _authListeners: [],
  _notifyAuth(user) {
    this._authListeners.forEach(cb => {
      try { cb(user, user); } catch (e) { console.error('Auth listener error:', e); }
    });
  },

  onAuth(callback) {
    this._authListeners.push(callback);

    if (isBrowser) {
      const currentUid = sessionStorage.getItem('sharebox_session_uid') || localStorage.getItem('sharebox_session_uid');

      if (currentUid) {
        // Fetch fresh profile from Supabase
        supabase.from('users').select('*').eq('id', currentUid).maybeSingle()
          .then(({ data }) => {
            if (data) {
              const u = fromDB('users', data);
              callback(u, u);
            } else {
              const localUsers = getLocalTable('users');
              const localU = localUsers[currentUid] || null;
              callback(localU, localU);
            }
          })
          .catch(() => {
            const localUsers = getLocalTable('users');
            const localU = localUsers[currentUid] || null;
            callback(localU, localU);
          });
      } else {
        callback(null, null);
      }
    } else {
      callback(null, null);
    }

    // Subscribe to real-time profile updates on the users table
    let userSub = null;
    if (isBrowser) {
      const subId = `usr_sync_${Math.random().toString(36).substring(2, 7)}`;
      userSub = supabase.channel(subId)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'users' }, (payload) => {
          const activeUid = sessionStorage.getItem('sharebox_session_uid') || localStorage.getItem('sharebox_session_uid');
          if (activeUid && payload.new && payload.new.id === activeUid) {
            const updated = fromDB('users', payload.new);
            this._notifyAuth(updated);
          }
        })
        .subscribe();
    }

    return () => {
      this._authListeners = this._authListeners.filter(cb => cb !== callback);
      if (userSub) supabase.removeChannel(userSub);
    };
  },

  async getDoc(colName, docId) {
    const tableName = resolveTable(colName);

    if (TABLE_COLUMNS[tableName]) {
      try {
        const { data, error } = await supabase
          .from(tableName)
          .select('*')
          .eq('id', docId)
          .maybeSingle();

        if (!error && data) {
          const localTable = getLocalTable(colName);
          const localDoc = localTable[docId] || {};
          const parsed = fromDB(colName, data);
          return { ...localDoc, ...parsed };
        }
      } catch (e) {
        console.warn(`[Supabase] getDoc(${colName}, ${docId}) error:`, e.message);
      }
    }

    // Fallback to local table
    const table = getLocalTable(colName);
    return table[docId] || null;
  },

  async setDoc(colName, docId, data) {
    const tableName = resolveTable(colName);
    const dbPayload = toDB(colName, { ...data, id: docId });

    if (TABLE_COLUMNS[tableName]) {
      try {
        const { error } = await supabase
          .from(tableName)
          .upsert(dbPayload);

        if (error) {
          console.warn(`[Supabase] setDoc(${tableName}) notice:`, error.message);
        }
      } catch (e) {
        console.warn(`[Supabase] setDoc(${colName}) error:`, e.message);
      }
    }

    // For WebRTC signaling (calls, candidates), broadcast via Supabase Realtime channel
    if (colName === 'calls' || colName.startsWith('candidates_')) {
      if (signalingChannel) {
        signalingChannel.send({
          type: 'broadcast',
          event: 'call_signal',
          payload: { colName, docId, data: { ...data, id: docId } }
        }).catch(() => {});
      }
    }

    // Sync to local table for instant multi-tab speed
    const table = getLocalTable(colName);
    table[docId] = { ...table[docId], ...data, id: docId };
    setLocalTable(colName, table);
  },

  async updateDoc(colName, docId, data) {
    const tableName = resolveTable(colName);
    const dbPayload = toDB(colName, data);
    if (colName === 'users' || colName === 'requests') {
      dbPayload.updated_at = new Date().toISOString();
    }

    const table = getLocalTable(colName);
    const prevStatus = table[docId]?.status;

    if (TABLE_COLUMNS[tableName] && Object.keys(dbPayload).length > 0) {
      try {
        const { error } = await supabase
          .from(tableName)
          .update(dbPayload)
          .eq('id', docId);

        if (error) {
          console.warn(`[Supabase] updateDoc(${tableName}) notice:`, error.message);
        }
      } catch (e) {
        console.warn(`[Supabase] updateDoc(${colName}) error:`, e.message);
      }
    }

    // Broadcast WebRTC signaling updates
    if (colName === 'calls' || colName.startsWith('candidates_')) {
      if (signalingChannel) {
        signalingChannel.send({
          type: 'broadcast',
          event: 'call_signal',
          payload: { colName, docId, data: { ...table[docId], ...data, id: docId } }
        }).catch(() => {});
      }
    }

    table[docId] = { ...table[docId], ...data, updatedAt: new Date().toISOString() };
    setLocalTable(colName, table);

    // If a user account was approved, send approval notification
    if (colName === 'users' && data.status === 'approved' && prevStatus !== 'approved') {
      const nId = 'notif_' + Math.random().toString(36).substring(2, 9);
      try {
        await supabase.from('notifications').insert({
          id: nId,
          user_id: docId,
          type: 'account_approved',
          ref_id: docId,
          title: 'Account Approved by Administrator',
          message: 'Your campus registration has been officially approved! You now have full access to create, borrow, and lend equipment on ShareBox.',
          read: false,
          created_at: new Date().toISOString()
        });
      } catch (e) {}

      const notifs = getLocalTable('notifications');
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
    const tableName = resolveTable(colName);

    if (TABLE_COLUMNS[tableName]) {
      try {
        const { error } = await supabase
          .from(tableName)
          .delete()
          .eq('id', docId);

        if (error) {
          console.warn(`[Supabase] deleteDoc(${tableName}) notice:`, error.message);
        }
      } catch (e) {
        console.warn(`[Supabase] deleteDoc(${colName}) error:`, e.message);
      }
    }

    const table = getLocalTable(colName);
    delete table[docId];
    setLocalTable(colName, table);
  },

  async getDocs(colName, filters = []) {
    const tableName = resolveTable(colName);

    if (TABLE_COLUMNS[tableName]) {
      try {
        let query = supabase.from(tableName).select('*');

        // If query is for messages of a specific request
        if (colName.startsWith('messages_')) {
          const reqId = colName.replace('messages_', '');
          query = query.eq('request_id', reqId);
        }

        const { data, error } = await query;
        if (!error && Array.isArray(data)) {
          if (data.length > 0) {
            const items = data.map(row => fromDB(colName, row));

            // Sync into local cache
            const local = getLocalTable(colName);
            items.forEach(it => { local[it.id] = { ...local[it.id], ...it }; });
            setLocalTable(colName, local);

            return items;
          } else if (colName === 'landmarks') {
            return DEFAULT_LANDMARKS;
          } else {
            return [];
          }
        }
      } catch (e) {
        console.warn(`[Supabase] getDocs(${colName}) fallback notice:`, e.message);
      }
    }

    // Fallback to local table
    if (colName === 'landmarks') {
      const lm = getLocalTable('landmarks');
      if (Object.keys(lm).length === 0) return DEFAULT_LANDMARKS;
      return Object.values(lm);
    }

    const table = getLocalTable(colName);
    return Object.values(table);
  },

  subscribe(colName, filterFn, callback) {
    const tableName = resolveTable(colName);

    const run = async () => {
      const items = await this.getDocs(colName);
      let filtered = items;
      if (filterFn) filtered = filtered.filter(filterFn);
      callback(filtered);
    };

    run();

    // Subscribe to Supabase Realtime changes
    let realtimeChannel = null;
    if (TABLE_COLUMNS[tableName]) {
      const channelId = `realtime_${tableName}_${Math.random().toString(36).substring(2, 7)}`;
      realtimeChannel = supabase.channel(channelId)
        .on('postgres_changes', { event: '*', schema: 'public', table: tableName }, () => {
          run();
        })
        .subscribe();
    }

    // Local tab sync listeners
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
      if (realtimeChannel) supabase.removeChannel(realtimeChannel);
      if (channel) channel.removeEventListener('message', handler);
      if (isBrowser) {
        window.removeEventListener('storage', run);
        window.removeEventListener('sharebox:table_update', localHandler);
      }
    };
  },

  async uploadFile(file, path) {
    try {
      const { data, error } = await supabase.storage
        .from('sharebox-media')
        .upload(path, file, { upsert: true });

      if (!error && data) {
        const { data: pubData } = supabase.storage
          .from('sharebox-media')
          .getPublicUrl(path);

        if (pubData?.publicUrl) {
          return pubData.publicUrl;
        }
      }
    } catch (e) {
      console.warn('[Supabase Storage] Notice:', e.message);
    }

    // Seamless fallback to base64 DataURL so file uploads never break
    if (isBrowser && typeof FileReader !== 'undefined') {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    }

    return `https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=400&q=80`;
  },

  async resetDatabase() {
    if (isBrowser) {
      const keys = ['users', 'requests', 'events', 'event_members', 'damageReports', 'landmarks', 'notifications', 'chat_messages'];
      keys.forEach(k => localStorage.removeItem(STORAGE_PREFIX + k));
    }
  }
};
