/**
 * ShareBox User Registration & Admin Approval Flow Test
 * Verifies that:
 * 1. New users sign up with status: 'pending'
 * 2. Admin receives a 'new_user_registration' notification with user details
 * 3. The user is not in the active approved directory while pending
 * 4. When approved, user status becomes 'approved', user is added to active directory,
 *    and user receives 'account_approved' notification.
 */

import { authService } from '../src/services/auth.service.js';
import { notificationsService } from '../src/services/notifications.service.js';
import { store } from '../src/services/store.js';

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

async function testApprovalFlow() {
  console.log('\n======================================================');
  console.log('   SHAREBOX NEW USER APPROVAL WORKFLOW TEST           ');
  console.log('======================================================\n');

  const testEmail = 'pending.applicant.' + Math.random().toString(36).substring(2, 7) + '@dyp.edu';

  // Step 1: User signs up
  console.log('[Step 1] New User Signup');
  const newUser = await authService.signUp({
    name: 'Priya Sharma',
    email: testEmail,
    password: 'password123',
    department: 'Computer Science & Engineering',
    year: '2nd Year',
    phone: '+91 91234 56789'
  });

  assert(newUser && newUser.uid, 'New user successfully registered');
  assert(newUser.status === 'pending', `New user status is 'pending' (actual: ${newUser.status})`);

  // Step 2: Admin notification verification
  console.log('\n[Step 2] Admin Notification Delivery');
  const allNotifs = await store.getDocs('notifications');
  const adminNotifs = allNotifs.filter(n => n.type === 'new_user_registration' && n.refId === newUser.uid);
  assert(adminNotifs.length > 0, 'Admin received registration notification');
  assert(adminNotifs[0].title.includes('New Member Request'), `Notification title contains 'New Member Request' (actual: ${adminNotifs[0]?.title})`);
  assert(adminNotifs[0].message.includes('Priya Sharma') && adminNotifs[0].message.includes('wants to become a member'), 'Notification message mentions user request');

  // Step 3: Check Active Directory vs Pending List
  console.log('\n[Step 3] Active Directory vs Pending Separation');
  let allUsers = await store.getDocs('users');
  let approvedUsers = allUsers.filter(u => u.status === 'approved' || (!u.status && u.role === 'admin'));
  let pendingUsers = allUsers.filter(u => u.status === 'pending');

  assert(!approvedUsers.some(u => (u.uid || u.id) === newUser.uid), 'Pending user is NOT in Active Directory');
  assert(pendingUsers.some(u => (u.uid || u.id) === newUser.uid), 'Pending user IS in Pending Approvals list');

  // Step 4: Admin approves the user
  console.log('\n[Step 4] Admin Approval Action');
  await store.updateDoc('users', newUser.uid, { status: 'approved' });
  await notificationsService.create({
    userId: newUser.uid,
    type: 'account_approved',
    title: 'Membership Approved!',
    message: 'Your ShareBox account has been approved by the platform administrator.',
    refId: null
  });

  // Verify status in DB
  const freshUser = await store.getDoc('users', newUser.uid);
  assert(freshUser.status === 'approved', 'User status updated to approved');

  // Verify directory membership
  allUsers = await store.getDocs('users');
  approvedUsers = allUsers.filter(u => u.status === 'approved' || (!u.status && u.role === 'admin'));
  pendingUsers = allUsers.filter(u => u.status === 'pending');

  assert(approvedUsers.some(u => (u.uid || u.id) === newUser.uid), 'Approved user is NOW added to Active Directory');
  assert(!pendingUsers.some(u => (u.uid || u.id) === newUser.uid), 'Approved user is REMOVED from Pending list');

  // Verify user received welcome notification
  const userNotifs = (await store.getDocs('notifications')).filter(n => n.userId === newUser.uid && n.type === 'account_approved');
  assert(userNotifs.length > 0, 'User received account_approved notification alert');

  // Step 5: Disapproval Workflow & Clear All Notifications Verification
  console.log('\n[Step 5] Admin Disapproval Action & Clear Notifications');
  const rejectApplicant = await authService.signUp({
    name: 'Rejected Candidate',
    email: 'reject.' + Math.random().toString(36).substring(2, 7) + '@dyp.edu',
    password: 'password123',
    department: 'Civil Engineering',
    year: '1st Year'
  });

  assert(rejectApplicant && rejectApplicant.status === 'pending', 'Reject candidate registered with status pending');

  // Disapprove
  await store.updateDoc('users', rejectApplicant.uid, { status: 'rejected' });
  await notificationsService.create({
    userId: rejectApplicant.uid,
    type: 'account_rejected',
    title: 'Membership Application Update',
    message: 'Your registration request could not be approved at this time.',
    refId: null
  });

  const freshRejected = await store.getDoc('users', rejectApplicant.uid);
  assert(freshRejected.status === 'rejected', 'User status updated to rejected');

  // Verify rejection notification received
  const rejectNotifs = (await store.getDocs('notifications')).filter(n => n.userId === rejectApplicant.uid && n.type === 'account_rejected');
  assert(rejectNotifs.length > 0, 'User received account_rejected notification alert');

  // Test Clear All Notifications for the rejected user
  await notificationsService.clearAll(rejectApplicant.uid);
  const clearedNotifs = (await store.getDocs('notifications')).filter(n => n.userId === rejectApplicant.uid);
  assert(clearedNotifs.length === 0, 'clearAll successfully removed all user notifications');

  // Cleanup test users
  await store.supabase.from('notifications').delete().eq('ref_id', newUser.uid);
  await store.supabase.from('notifications').delete().eq('user_id', newUser.uid);
  await store.supabase.from('users').delete().eq('id', newUser.uid);
  await store.supabase.from('notifications').delete().eq('ref_id', rejectApplicant.uid);
  await store.supabase.from('notifications').delete().eq('user_id', rejectApplicant.uid);
  await store.supabase.from('users').delete().eq('id', rejectApplicant.uid);

  console.log('\n======================================================');
  console.log(`  APPROVAL & DISAPPROVAL TESTS: ${passed} Passed, ${failed} Failed`);
  console.log('======================================================\n');

  if (failed > 0) process.exit(1);
  process.exit(0);
}

testApprovalFlow().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
