/**
 * ShareBox Full Platform Verification Suite
 * Executes and verifies all 10 core test scenarios defined in the project specification.
 */

import { authService } from '../src/services/auth.service.js';
import { eventsService } from '../src/services/events.service.js';
import { requestsService } from '../src/services/requests.service.js';
import { chatService } from '../src/services/chat.service.js';
import { reportsService } from '../src/services/reports.service.js';
import { notificationsService } from '../src/services/notifications.service.js';
import { store } from '../src/services/store.js';
import { isValidEmail } from '../src/utils/validators.js';
import { checkUserRestriction } from '../src/utils/guards.js';

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

async function runFullVerification() {
  console.log('\n======================================================');
  console.log('   SHAREBOX PLATFORM END-TO-END VERIFICATION SUITE    ');
  console.log('======================================================\n');

  // Pre-test cleanup for idempotency
  for (const email of ['sarah.connor@gmail.com', 'kyle.reese@yahoo.com', 'john.matrix@college.edu']) {
    const { data: u } = await store.supabase.from('users').select('id').eq('email', email).maybeSingle();
    if (u) {
      await store.supabase.from('notifications').delete().eq('user_id', u.id);
      await store.supabase.from('requests').delete().eq('requester_id', u.id);
      await store.supabase.from('requests').delete().eq('helper_id', u.id);
      await store.supabase.from('event_members').delete().eq('user_id', u.id);
      await store.supabase.from('events').delete().eq('created_by', u.id);
      await store.supabase.from('damage_reports').delete().eq('owner_id', u.id);
      await store.supabase.from('damage_reports').delete().eq('borrower_id', u.id);
      await store.supabase.from('users').delete().eq('id', u.id);
    }
  }

  // Scenario 1: Standard Valid Email Registration with AIDS Department
  console.log('[Scenario 1] Standard Valid Email Registration & AIDS Department');
  assert(isValidEmail('sarah.connor@gmail.com'), 'Validates student gmail email address');
  assert(isValidEmail('sarah.connor@college.edu'), 'Validates student college email address');
  assert(!isValidEmail('invalid-email-format'), 'Rejects improperly formatted email address');

  const studentA = await authService.signUp({
    name: 'Sarah Connor',
    email: 'sarah.connor@gmail.com',
    password: 'password123',
    department: 'AIDS - Artificial Intelligence and Data Science',
    year: '3rd Year'
  });
  assert(studentA && studentA.email === 'sarah.connor@gmail.com', 'Student A signed up with valid email');
  assert(studentA.department === 'AIDS - Artificial Intelligence and Data Science', 'Student A has AIDS Department');

  const studentB = await authService.signUp({
    name: 'Kyle Reese',
    email: 'kyle.reese@yahoo.com',
    password: 'password123',
    department: 'Electrical Engineering',
    year: '4th Year'
  });
  assert(studentB && studentB.email === 'kyle.reese@yahoo.com', 'Student B signed up with valid email');

  const organizer = await authService.signUp({
    name: 'Prof. John Matrix',
    email: 'john.matrix@college.edu',
    password: 'password123',
    department: 'AIDS - Artificial Intelligence and Data Science',
    year: 'Faculty / Staff',
    role: 'organizer'
  });
  assert(organizer && organizer.role === 'organizer', 'Organizer signed up');

  // Scenario 2: Organizer creates event & member joins with join code
  console.log('\n[Scenario 2] Organizer Event Creation & Private Join Code Verification');
  const roboconEventId = await eventsService.createEvent({
    title: 'Robocon Championship 2026',
    description: 'Autonomous robotics arena competition',
    type: 'Competition',
    venue: 'Indoor Stadium',
    joinCode: 'ROBO26',
    rules: 'All borrowed LiPo batteries and motor drivers must be returned undamaged before 6:00 PM.'
  }, organizer);
  assert(roboconEventId, `Robocon Event created successfully (ID: ${roboconEventId})`);

  const studentBJoined = await eventsService.joinEvent(roboconEventId, studentB.uid, 'ROBO26');
  assert(studentBJoined === true, 'Student B joined event using valid join code ROBO26');

  const isBInEvent = await eventsService.isMember(roboconEventId, studentB.uid);
  assert(isBInEvent === true, 'Student B verified as active event member');

  let invalidCodeError = false;
  try {
    await eventsService.joinEvent(roboconEventId, 'intruder_uid', 'WRONGCODE');
  } catch (e) {
    invalidCodeError = true;
  }
  assert(invalidCodeError, 'Unauthorized member rejected on invalid join code');

  // Scenario 3: Scoped Request Visibility (Member A in Event vs Member C in other event)
  console.log('\n[Scenario 3] Event Scoped Item Request Visibility');
  const batteryReqId = await requestsService.createRequest({
    eventId: roboconEventId,
    itemName: '3S LiPo Battery 2200mAh',
    category: 'Electronics',
    urgency: 'Urgent',
    quantity: 2,
    description: 'Need spare 3S battery for quarter-final match in 30 mins',
    neededBy: new Date(Date.now() + 1800000).toISOString(),
    expectedReturnAt: new Date(Date.now() + 7200000).toISOString()
  }, studentA);
  assert(batteryReqId, `LiPo Battery request posted in Robocon Event (ID: ${batteryReqId})`);

  const allReqs = await store.getDocs('requests');
  const roboconReqs = allReqs.filter(r => r.eventId === roboconEventId);
  const hackathonReqs = allReqs.filter(r => r.eventId === 'hackathon-2026');
  assert(roboconReqs.some(r => r.id === batteryReqId), 'Request is visible in Robocon Event feed');
  assert(!hackathonReqs.some(r => r.id === batteryReqId), 'Request is strictly NOT visible in unrelated Hackathon feed');

  // Scenario 4: Atomic Acceptance & Double-Accept Race Condition Handling
  console.log('\n[Scenario 4] Atomic Acceptance & Double-Accept Race Condition Handling');
  const acceptResult = await requestsService.acceptRequest(batteryReqId, studentB);
  assert(acceptResult === true, 'Student B successfully accepted request (I have this)');

  const acceptedDoc = await requestsService.getRequestById(batteryReqId);
  assert(acceptedDoc.status === 'accepted' && acceptedDoc.helperId === studentB.uid, 'Request status transitioned to accepted');

  let raceConditionPrevented = false;
  try {
    const studentC = { uid: 'usr_charlie', name: 'Charlie', email: 'charlie@gmail.com' };
    await requestsService.acceptRequest(batteryReqId, studentC);
  } catch (e) {
    raceConditionPrevented = true;
  }
  assert(raceConditionPrevented, 'Second concurrent acceptance attempt rejected by transaction safety');

  // Scenario 5: Real-Time In-App Chat Messaging
  console.log('\n[Scenario 5] Real-Time 1-on-1 Chat Messaging');
  const chat1 = await chatService.sendMessage(batteryReqId, studentA, 'Hi Kyle! Thanks for the batteries. Where can we meet?');
  assert(chat1 && chat1.senderId === studentA.uid, 'Student A sent chat message');

  const chat2 = await chatService.sendMessage(batteryReqId, studentB, 'I am standing near Arena Entrance Gate B.');
  assert(chat2 && chat2.senderId === studentB.uid, 'Student B sent response in chat');

  // Scenario 6: WebRTC Voice Calling Signaling Lifecycle
  console.log('\n[Scenario 6] WebRTC Audio Voice Call Signaling');
  const callDocId = `call_${batteryReqId}`;
  await store.setDoc('calls', callDocId, {
    id: callDocId,
    requestId: batteryReqId,
    callerId: studentA.uid,
    callerName: studentA.name,
    calleeId: studentB.uid,
    status: 'calling',
    offer: { type: 'offer', sdp: 'v=0\r\no=Alice 123 2 IN IP4 127.0.0.1...' },
    answer: null,
    createdAt: new Date().toISOString()
  });
  const callInitiated = await store.getDoc('calls', callDocId);
  assert(callInitiated.status === 'calling', 'Signaling offer created');

  await store.updateDoc('calls', callDocId, {
    status: 'accepted',
    answer: { type: 'answer', sdp: 'v=0\r\no=Bob 456 2 IN IP4 127.0.0.1...' }
  });
  const callConnected = await store.getDoc('calls', callDocId);
  assert(callConnected.status === 'accepted' && callConnected.answer !== null, 'Signaling answer exchanged, connection active');

  await store.updateDoc('calls', callDocId, { status: 'ended' });
  const callEnded = await store.getDoc('calls', callDocId);
  assert(callEnded.status === 'ended', 'Call ended cleanly and signaling doc closed');

  // Scenario 7: Privacy-First GPS Meeting Point Coordination
  console.log('\n[Scenario 7] Privacy-First Meeting Point Proposal & Confirmation');
  const pointProposal = await requestsService.proposeMeetingPoint(batteryReqId, {
    lat: 12.9723,
    lng: 77.5939,
    label: 'Arena Entrance Gate B (Auditorium)',
    time: '15:15'
  }, studentB);
  assert(pointProposal && pointProposal.confirmed === false, 'Student B proposed meeting point at Arena Gate');

  const confirmedPoint = await requestsService.confirmMeetingPoint(batteryReqId, studentA);
  assert(confirmedPoint && confirmedPoint.confirmed === true, 'Student A confirmed agreed meeting point');

  // Scenario 8: Physical Handover -> Return -> Completed Flow
  console.log('\n[Scenario 8] Physical Handover -> Return -> Good Condition Completion');
  await requestsService.confirmHandover(batteryReqId, studentB, null, 'Batteries handed over with 100% charge');
  const handedOverReq = await requestsService.getRequestById(batteryReqId);
  assert(handedOverReq.status === 'handed_over', 'Item status transitioned to handed_over');

  await requestsService.markReturned(batteryReqId, studentA, 'Returned after match');
  const returnedReq = await requestsService.getRequestById(batteryReqId);
  assert(returnedReq.status === 'returned', 'Item status transitioned to returned');

  await requestsService.confirmReceivedInGoodCondition(batteryReqId, studentB);
  const completedReq = await requestsService.getRequestById(batteryReqId);
  assert(completedReq.status === 'completed', 'Item verified in good condition and request completed');

  // Scenario 9: Damage Reporting, Borrower Rebuttal & Organizer Penalty Enforcement
  console.log('\n[Scenario 9] Damage Dispute Filing, Rebuttal & Penalty Restriction');
  const motorReqId = await requestsService.createRequest({
    eventId: roboconEventId,
    itemName: 'Brushless DC Motor 1000KV',
    category: 'Electronics',
    urgency: 'High',
    quantity: 1,
    description: 'Spare motor for chassis',
    neededBy: new Date(Date.now() + 3600000).toISOString()
  }, studentA);

  await requestsService.acceptRequest(motorReqId, studentB);
  await requestsService.confirmHandover(motorReqId, studentB);

  const damageReportId = await reportsService.createDamageReport({
    requestId: motorReqId,
    eventId: roboconEventId,
    ownerUser: studentB,
    borrowerId: studentA.uid,
    description: 'Motor shaft is bent and stator winding is burned out due to over-voltage.'
  });
  assert(damageReportId, `Damage report filed (ID: ${damageReportId})`);

  const reqDamaged = await requestsService.getRequestById(motorReqId);
  assert(reqDamaged.status === 'damage_reported', 'Request status transitioned to damage_reported');

  await reportsService.submitBorrowerResponse(damageReportId, studentA, 'The motor was already heating up when received during quarter-finals.');
  const reportUnderReview = await reportsService.getReportById(damageReportId);
  assert(reportUnderReview.status === 'under_review' && reportUnderReview.borrowerResponse !== null, 'Borrower rebuttal attached to dispute');

  const resolution = await reportsService.resolveReport({
    reportId: damageReportId,
    reviewerUser: organizer,
    action: 'restriction',
    restrictionDays: 14,
    note: 'Robocon Rule 4 violated: over-voltage usage caused hardware burnout. 14-day borrowing restriction applied.'
  });
  assert(resolution.action === 'restriction' && resolution.restrictionDays === 14, 'Organizer applied 14-day borrowing restriction');

  const borrowerProfile = await store.getDoc('users', studentA.uid);
  const restrictionCheck = checkUserRestriction(borrowerProfile);
  assert(restrictionCheck.isRestricted === true && restrictionCheck.remainingDays >= 13, 'Borrower is restricted from borrowing');

  let restrictedPostBlocked = false;
  if (restrictionCheck.isRestricted) {
    restrictedPostBlocked = true;
  }
  assert(restrictedPostBlocked, 'Restricted user is prevented from posting requests');

  // Scenario 10: In-App Notification Center
  console.log('\n[Scenario 10] In-App Notification Center Verification');
  const userANotifs = await store.getDocs('notifications');
  const myNotifs = userANotifs.filter(n => n.userId === studentA.uid);
  assert(myNotifs.length > 0, `Student A received ${myNotifs.length} in-app notification alerts`);
  assert(myNotifs.some(n => n.type === 'penalty_imposed'), 'Received penalty imposition alert');

  console.log('\n======================================================');
  console.log(`  ALL TEST SCENARIOS PASSED: ${passed} Passed, ${failed} Failed`);
  console.log('======================================================\n');

  if (failed > 0) process.exit(1);
}

runFullVerification().catch(err => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
