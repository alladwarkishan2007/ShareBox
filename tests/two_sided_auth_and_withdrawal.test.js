import assert from 'assert';
import { store } from '../src/services/store.js';
import { requestsService } from '../src/services/requests.service.js';
import { REQUEST_STATUS } from '../src/config/constants.js';

async function runTests() {
  console.log('\n======================================================');
  console.log('   SHAREBOX TWO-SIDED AUTH & STOP-HELPING TEST SUITE  ');
  console.log('======================================================');

  const requester = {
    uid: 'test_user_borrower_1',
    name: 'Borrower Brian',
    email: 'brian@college.edu',
    role: 'member'
  };

  const helper1 = {
    uid: 'test_user_helper_1',
    name: 'Helper Harry',
    email: 'harry@college.edu',
    role: 'member'
  };

  const helper2 = {
    uid: 'test_user_helper_2',
    name: 'Helper Hannah',
    email: 'hannah@college.edu',
    role: 'member'
  };

  await store.setDoc('users', requester.uid, requester);
  await store.setDoc('users', helper1.uid, helper1);
  await store.setDoc('users', helper2.uid, helper2);

  // -------------------------------------------------------------------
  // TEST 1: Helper "Stop Helping" Button (Voluntary Withdrawal)
  // -------------------------------------------------------------------
  console.log('\n[Test 1] Helper Stop-Helping / Withdrawal Flow');
  const req1Id = await requestsService.createRequest({
    itemName: 'HDMI Adapter',
    category: 'Cables/Chargers',
    urgency: 'Medium',
    quantity: 1,
    description: 'Needed for presentation',
    neededBy: new Date(Date.now() + 7200000).toISOString()
  }, requester);

  let req1 = await requestsService.getRequestById(req1Id);
  assert(req1.status === REQUEST_STATUS.OPEN, 'Initial request is OPEN');

  // Helper 1 accepts the request
  await requestsService.acceptRequest(req1Id, helper1);
  req1 = await requestsService.getRequestById(req1Id);
  assert(req1.status === REQUEST_STATUS.ACCEPTED, 'Request transitioned to ACCEPTED');
  assert(req1.helperId === helper1.uid, 'Helper 1 assigned as helper');
  assert(req1.handoverAuth && req1.handoverAuth.code, 'Handover PIN generated');

  // Helper 1 realizes they cannot help and clicks "Stop Helping"
  await requestsService.withdrawHelp(req1Id, helper1);
  req1 = await requestsService.getRequestById(req1Id);
  assert(req1.status === REQUEST_STATUS.OPEN, '✓ PASS: Request successfully reverted to OPEN after helper stops helping');
  assert(req1.helperId === null, '✓ PASS: Helper ID cleared from request');
  assert(req1.helperName === null, '✓ PASS: Helper Name cleared from request');

  // Verify requester received notification
  const allNotifs1 = await store.getDocs('notifications');
  const requesterNotifs = allNotifs1.filter(n => n.userId === requester.uid);
  const withdrawnAlert = requesterNotifs.find(n => n.type === 'request_help_withdrawn');
  assert(withdrawnAlert, '✓ PASS: Requester received notification that helper stepped down and request reopened');

  // Helper 2 is now free to accept the reopened request!
  await requestsService.acceptRequest(req1Id, helper2);
  req1 = await requestsService.getRequestById(req1Id);
  assert(req1.status === REQUEST_STATUS.ACCEPTED && req1.helperId === helper2.uid, '✓ PASS: Helper 2 successfully accepted reopened request');

  // -------------------------------------------------------------------
  // TEST 2: Inactivity Reopening (Requester releases unresponsive helper)
  // -------------------------------------------------------------------
  console.log('\n[Test 2] Inactivity / Unresponsive Helper Reopening');
  const req2Id = await requestsService.createRequest({
    itemName: 'Lab Multimeter',
    category: 'Tools',
    urgency: 'High',
    quantity: 1,
    description: 'Circuit testing',
    neededBy: new Date(Date.now() + 7200000).toISOString()
  }, requester);

  await requestsService.acceptRequest(req2Id, helper1);
  let req2 = await requestsService.getRequestById(req2Id);
  assert(req2.status === REQUEST_STATUS.ACCEPTED, 'Request 2 accepted by Helper 1');

  // Requester clicks "Helper Inactive? Reopen Request"
  await requestsService.reopenUnresponsiveRequest(req2Id, requester);
  req2 = await requestsService.getRequestById(req2Id);
  assert(req2.status === REQUEST_STATUS.OPEN, '✓ PASS: Requester released unresponsive helper and reopened request');
  assert(req2.helperId === null, '✓ PASS: Inactive helper removed');

  // Inactive helper received notification
  const allNotifs2 = await store.getDocs('notifications');
  const helper1Notifs = allNotifs2.filter(n => n.userId === helper1.uid);
  const inactiveAlert = helper1Notifs.find(n => n.type === 'request_reopened_inactivity');
  assert(inactiveAlert, '✓ PASS: Helper received inactivity release notification');

  // -------------------------------------------------------------------
  // TEST 3: Loophole Prevention at Handover Stage (Two-Sided Authentication)
  // -------------------------------------------------------------------
  console.log('\n[Test 3] Loophole Prevention at Handover Stage');
  const req3Id = await requestsService.createRequest({
    itemName: 'Soldering Iron Kit',
    category: 'Tools',
    urgency: 'High',
    quantity: 1,
    description: 'Hardware lab',
    neededBy: new Date(Date.now() + 7200000).toISOString()
  }, requester);

  await requestsService.acceptRequest(req3Id, helper1);
  let req3 = await requestsService.getRequestById(req3Id);

  // Attempt A: Helper alone confirms handover WITHOUT borrower confirmation
  const res3A = await requestsService.authenticateHandover(req3Id, helper1);
  req3 = await requestsService.getRequestById(req3Id);
  assert(res3A.bothConfirmed === false, '✓ PASS: Handover is NOT complete when only helper confirms');
  assert(req3.status === REQUEST_STATUS.ACCEPTED, '✓ PASS: Request remains in ACCEPTED state preventing unilateral takeover');
  assert(req3.handoverAuth.helperConfirmed === true, 'Helper confirmed recorded');
  assert(req3.handoverAuth.requesterConfirmed === false, 'Borrower confirmation still pending');

  // Borrower confirms receipt
  const res3B = await requestsService.authenticateHandover(req3Id, requester);
  req3 = await requestsService.getRequestById(req3Id);
  assert(res3B.bothConfirmed === true, '✓ PASS: Handover verified when borrower also confirms');
  assert(req3.status === REQUEST_STATUS.HANDED_OVER, '✓ PASS: Request transitions to HANDED_OVER only after both sides confirmed');

  // -------------------------------------------------------------------
  // TEST 4: PIN-Based Instant In-Person Handover Verification
  // -------------------------------------------------------------------
  console.log('\n[Test 4] PIN-Based Handover Authentication');
  const req4Id = await requestsService.createRequest({
    itemName: 'Arduino UNO R3',
    category: 'Electronics',
    urgency: 'Medium',
    quantity: 1,
    description: 'Robotics sensor test',
    neededBy: new Date(Date.now() + 7200000).toISOString()
  }, requester);

  await requestsService.acceptRequest(req4Id, helper2);
  let req4 = await requestsService.getRequestById(req4Id);
  const correctPin = req4.handoverAuth.code;

  // Invalid PIN attempt
  let pinFailed = false;
  try {
    await requestsService.authenticateHandover(req4Id, helper2, { pin: '0000' });
  } catch (e) {
    pinFailed = true;
  }
  assert(pinFailed, '✓ PASS: Invalid Handover PIN rejected');

  // Correct PIN entered by helper
  const pinRes = await requestsService.authenticateHandover(req4Id, helper2, { pin: correctPin });
  req4 = await requestsService.getRequestById(req4Id);
  assert(pinRes.bothConfirmed === true, '✓ PASS: Valid Handover PIN simultaneously authenticates both parties');
  assert(req4.status === REQUEST_STATUS.HANDED_OVER, '✓ PASS: Request transitioned to HANDED_OVER via PIN verification');

  // -------------------------------------------------------------------
  // TEST 5: Loophole Prevention at Return Stage (Two-Sided Authentication)
  // -------------------------------------------------------------------
  console.log('\n[Test 5] Loophole Prevention at Return Stage');
  // Borrower alone marks returned
  const returnResA = await requestsService.authenticateReturn(req4Id, requester);
  req4 = await requestsService.getRequestById(req4Id);
  assert(returnResA.bothConfirmed === false, '✓ PASS: Return is NOT complete when only borrower marks returned');
  assert(req4.status === REQUEST_STATUS.HANDED_OVER, '✓ PASS: Status stays HANDED_OVER until lender verifies physical receipt');
  assert(req4.returnAuth.requesterConfirmed === true, 'Borrower return recorded');
  assert(req4.returnAuth.helperConfirmed === false, 'Lender verification pending');

  // Lender confirms physical receipt back
  const returnResB = await requestsService.authenticateReturn(req4Id, helper2);
  req4 = await requestsService.getRequestById(req4Id);
  assert(returnResB.bothConfirmed === true, '✓ PASS: Return verified when lender confirms physical receipt back');
  assert(req4.status === REQUEST_STATUS.RETURNED, '✓ PASS: Request transitioned to RETURNED');

  // -------------------------------------------------------------------
  // TEST 6: Loophole Prevention at Final Completion Stage
  // -------------------------------------------------------------------
  console.log('\n[Test 6] Loophole Prevention at Final Completion Stage');
  // Lender alone confirms good condition
  const compResA = await requestsService.authenticateCompletion(req4Id, helper2);
  req4 = await requestsService.getRequestById(req4Id);
  assert(compResA.bothConfirmed === false, '✓ PASS: Transaction is NOT complete when only one party signs off');
  assert(req4.status === REQUEST_STATUS.RETURNED, '✓ PASS: Request remains in RETURNED state awaiting partner sign-off');

  // Borrower confirms closure
  const compResB = await requestsService.authenticateCompletion(req4Id, requester);
  req4 = await requestsService.getRequestById(req4Id);
  assert(compResB.bothConfirmed === true, '✓ PASS: Transaction completion confirmed by both parties');
  assert(req4.status === REQUEST_STATUS.COMPLETED, '✓ PASS: Request successfully completed with two-sided authentication!');

  console.log('\n======================================================');
  console.log('   ALL TWO-SIDED AUTH & WITHDRAWAL TESTS PASSED!      ');
  console.log('======================================================\n');
  process.exit(0);
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
