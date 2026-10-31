/**
 * Phase 2 End-to-End Core Flows Automated Verification
 * Tests registration, email validation, event joining, atomic acceptance,
 * chat messaging, meeting point agreement, and WebRTC signaling state machine.
 */

import { authService } from '../src/services/auth.service.js';
import { eventsService } from '../src/services/events.service.js';
import { requestsService } from '../src/services/requests.service.js';
import { chatService } from '../src/services/chat.service.js';
import { store } from '../src/services/store.js';
import { isValidEmail } from '../src/utils/validators.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ✕ FAIL: ${message}`);
    failed++;
  }
}

async function runTests() {
  console.log('\n--- Running Phase 2 Core Feature Tests ---\n');

  // Pre-test cleanup for idempotency
  for (const email of ['alice@gmail.com', 'bob.johnson@outlook.com']) {
    const { data: u } = await store.supabase.from('users').select('id').eq('email', email).maybeSingle();
    if (u) {
      await store.supabase.from('notifications').delete().eq('user_id', u.id);
      await store.supabase.from('notifications').delete().eq('ref_id', u.id);
      await store.supabase.from('requests').delete().eq('requester_id', u.id);
      await store.supabase.from('requests').delete().eq('helper_id', u.id);
      await store.supabase.from('event_members').delete().eq('user_id', u.id);
      await store.supabase.from('events').delete().eq('created_by', u.id);
      await store.supabase.from('users').delete().eq('id', u.id);
    }
  }

  // Test 1: Standard Email Format Validation
  console.log('[Test 1] Standard Email Format Validation');
  assert(isValidEmail('student@college.edu'), 'Accepts valid college email');
  assert(isValidEmail('student@gmail.com'), 'Accepts valid gmail address');
  assert(isValidEmail('alice.dev@company.org'), 'Accepts valid org address');
  assert(!isValidEmail('invalid-email-string'), 'Rejects string without @ or domain');
  assert(!isValidEmail('@nodomain.com'), 'Rejects missing local part');

  // Test 2: User Sign Up with AIDS Department
  console.log('\n[Test 2] Registration Flow with AIDS Department');
  const userA = await authService.signUp({
    name: 'Alice Smith',
    email: 'alice@gmail.com',
    password: 'password123',
    department: 'AIDS - Artificial Intelligence and Data Science',
    year: '3rd Year'
  });
  assert(userA && userA.department === 'AIDS - Artificial Intelligence and Data Science', 'Alice registered with AIDS Department');

  const userB = await authService.signUp({
    name: 'Bob Johnson',
    email: 'bob.johnson@outlook.com',
    password: 'password123',
    department: 'Electronics & Communication',
    year: '4th Year'
  });
  assert(userB && userB.email === 'bob.johnson@outlook.com', 'Bob registered with standard email');

  // Test 3: Organizer Creates Event & Member Joins with Code
  console.log('\n[Test 3] Event Creation & Join Code Verification');
  const eventId = await eventsService.createEvent({
    title: 'Hardware Hackathon 2026',
    description: 'Hardware building sprint',
    type: 'Technical',
    venue: 'Lab 4',
    joinCode: 'HARD26',
    rules: 'Return all tools by Sunday.'
  }, userA);
  assert(eventId, `Event created with ID: ${eventId}`);

  const joined = await eventsService.joinEvent(eventId, userB.uid, 'HARD26');
  assert(joined === true, 'Bob successfully joined event with correct join code');

  let codeFailed = false;
  try {
    await eventsService.joinEvent(eventId, 'someone-else', 'WRONGCODE');
  } catch (e) {
    codeFailed = true;
  }
  assert(codeFailed, 'Rejects invalid join code');

  // Test 4: Item Request Scoping
  console.log('\n[Test 4] Item Request Creation & Scoping');
  const reqId = await requestsService.createRequest({
    eventId,
    itemName: 'Soldering Iron + Solder Wire',
    category: 'Tools',
    urgency: 'Urgent',
    quantity: 1,
    description: 'Need for assembling custom PCB',
    neededBy: new Date(Date.now() + 3600000).toISOString(),
    expectedReturnAt: new Date(Date.now() + 86400000).toISOString()
  }, userA);
  assert(reqId, `Request created with ID: ${reqId}`);

  // Test 5: Atomic Acceptance & Double-Acceptance Prevention
  console.log('\n[Test 5] Transaction-Safe Acceptance');
  const acceptResult = await requestsService.acceptRequest(reqId, userB);
  assert(acceptResult === true, 'Bob accepted the request');

  const updatedReq = await requestsService.getRequestById(reqId);
  assert(updatedReq.status === 'accepted' && updatedReq.helperId === userB.uid, 'Request status is accepted with Bob as helper');

  let secondAcceptBlocked = false;
  try {
    const userC = { uid: 'usr_charlie', name: 'Charlie', email: 'charlie@gmail.com' };
    await requestsService.acceptRequest(reqId, userC);
  } catch (e) {
    secondAcceptBlocked = true;
  }
  assert(secondAcceptBlocked, 'Second simultaneous accept attempt rejected');

  // Test 6: Real-Time Chat Message Exchange
  console.log('\n[Test 6] In-App Chat Messaging');
  const msg1 = await chatService.sendMessage(reqId, userA, 'Hi Bob, thanks for accepting! Where can we meet?');
  assert(msg1 && msg1.text.includes('Where can we meet?'), 'Alice sent chat message');

  const msg2 = await chatService.sendMessage(reqId, userB, 'Hey Alice! I am at the Library entrance.');
  assert(msg2 && msg2.text.includes('Library entrance'), 'Bob replied in chat');

  // Test 7: Privacy-First Meeting Point Propose & Confirm
  console.log('\n[Test 7] Meeting Point Coordination');
  const proposedPoint = await requestsService.proposeMeetingPoint(reqId, {
    lat: 12.9719,
    lng: 77.5948,
    label: 'Central Library Steps',
    time: '14:30'
  }, userB);
  assert(proposedPoint && proposedPoint.label === 'Central Library Steps', 'Bob proposed meeting point at Library');

  const confirmedPoint = await requestsService.confirmMeetingPoint(reqId, userA);
  assert(confirmedPoint && confirmedPoint.confirmed === true, 'Alice confirmed meeting point');

  // Test 8: WebRTC Signaling Document Lifecycle
  console.log('\n[Test 8] WebRTC Signaling Document Lifecycle');
  const callId = `call_${reqId}`;
  await store.setDoc('calls', callId, {
    id: callId,
    requestId: reqId,
    callerId: userA.uid,
    callerName: userA.name,
    calleeId: userB.uid,
    status: 'calling',
    offer: { type: 'offer', sdp: 'v=0\r\no=- 12345 2 IN IP4 127.0.0.1...' },
    answer: null,
    createdAt: new Date().toISOString()
  });

  const activeCall = await store.getDoc('calls', callId);
  assert(activeCall.status === 'calling', 'Call signaling document initiated');

  await store.updateDoc('calls', callId, {
    status: 'accepted',
    answer: { type: 'answer', sdp: 'v=0\r\no=- 67890 2 IN IP4 127.0.0.1...' }
  });
  const answeredCall = await store.getDoc('calls', callId);
  assert(answeredCall.status === 'accepted' && answeredCall.answer !== null, 'Callee answered signaling');

  await store.updateDoc('calls', callId, { status: 'ended' });
  const endedCall = await store.getDoc('calls', callId);
  assert(endedCall.status === 'ended', 'Call ended and signaling state marked ended');

  // Post-test cleanup: delete test users and their notifications so admin inbox stays clean
  for (const uId of [userA.uid, userB.uid]) {
    await store.supabase.from('notifications').delete().eq('user_id', uId);
    await store.supabase.from('notifications').delete().eq('ref_id', uId);
    await store.supabase.from('requests').delete().eq('requester_id', uId);
    await store.supabase.from('requests').delete().eq('helper_id', uId);
    await store.supabase.from('event_members').delete().eq('user_id', uId);
    await store.supabase.from('users').delete().eq('id', uId);
  }
  await store.supabase.from('events').delete().eq('id', eventId);
  await store.supabase.from('calls').delete().eq('id', callId);

  console.log(`\n========================================`);
  console.log(`Phase 2 Tests Complete: ${passed} Passed, ${failed} Failed`);
  console.log(`========================================\n`);

  if (failed > 0) process.exit(1);
  process.exit(0);
}

runTests().catch(err => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
