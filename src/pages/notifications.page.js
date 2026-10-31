import { notificationsService } from '../services/notifications.service.js';
import { store } from '../services/store.js';
import { formatRelativeTime } from '../utils/dates.js';
import { escapeHTML } from '../utils/sanitize.js';
import { toast } from '../components/toast.js';

export async function renderNotificationsPage(container, { user }) {
  container.innerHTML = `
    <div class="container glass-container" style="max-width: 720px; padding-top: var(--space-6); padding-bottom: var(--space-8);">
      <div class="glass-header-box flex justify-between items-center gap-4 flex-wrap">
        <div>
          <div class="flex items-center gap-2">
            <div style="width: 32px; height: 32px; border-radius: 8px; background: rgba(37, 99, 235, 0.12); color: var(--color-primary); display: flex; align-items: center; justify-content: center;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
              </svg>
            </div>
            <h1 class="text-xl font-bold" style="margin: 0;">In-App Notifications</h1>
          </div>
          <p class="text-xs text-muted" style="margin-top: 4px; margin-bottom: 0;">Real-time alerts for member requests, handovers, messages, and campus coordination.</p>
        </div>

        <div class="flex items-center gap-2 flex-wrap">
          <button id="mark-all-read-btn" class="btn btn-secondary btn-sm glass-btn" title="Mark all notifications as read">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            Mark All Read
          </button>
          <button id="clear-all-notifs-btn" class="btn btn-sm" style="background: #dc2626 !important; color: #ffffff !important; border: 1px solid #b91c1c; font-weight: 700; box-shadow: 0 4px 12px rgba(220, 38, 38, 0.35); padding: 6px 14px; border-radius: 8px;" title="Permanently clear all notifications">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
            Clear All
          </button>
        </div>
      </div>

      <div id="notifications-list" class="flex flex-col gap-3">
        <div class="skeleton" style="height: 80px; border-radius: var(--radius-lg);"></div>
        <div class="skeleton" style="height: 80px; border-radius: var(--radius-lg);"></div>
      </div>
    </div>
  `;

  const listContainer = container.querySelector('#notifications-list');
  const markAllBtn = container.querySelector('#mark-all-read-btn');
  const clearAllBtn = container.querySelector('#clear-all-notifs-btn');

  // Mark all as read listener
  markAllBtn.addEventListener('click', async () => {
    try {
      markAllBtn.disabled = true;
      markAllBtn.textContent = 'Marking...';
      await notificationsService.markAllAsRead(user.uid);
      toast.success('All notifications marked as read.');
    } catch (e) {
      toast.error(e.message);
    } finally {
      markAllBtn.disabled = false;
      markAllBtn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        Mark All Read
      `;
    }
  });

  // Clear all notifications listener
  clearAllBtn.addEventListener('click', async () => {
    const confirmed = window.confirm('Are you sure you want to clear all your notifications? This cannot be undone.');
    if (!confirmed) return;

    try {
      clearAllBtn.disabled = true;
      clearAllBtn.textContent = 'Clearing...';
      await notificationsService.clearAll(user.uid);
      toast.success('All notifications cleared.');
    } catch (e) {
      toast.error('Failed to clear notifications: ' + e.message);
    } finally {
      clearAllBtn.disabled = false;
      clearAllBtn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        </svg>
        Clear All
      `;
    }
  });

  // Subscribe to live notification updates
  notificationsService.subscribeNotifications(user.uid, async (notifs) => {
    listContainer.innerHTML = '';

    if (notifs.length === 0) {
      listContainer.innerHTML = `
        <div class="glass-empty-card">
          <div style="width: 56px; height: 56px; border-radius: 50%; background: rgba(37, 99, 235, 0.08); color: var(--color-primary); display: flex; align-items: center; justify-content: center; margin: 0 auto 16px;">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
            </svg>
          </div>
          <h3 class="text-md font-bold" style="color: var(--text-main); margin-bottom: 4px;">All caught up!</h3>
          <p class="text-xs text-muted" style="max-width: 380px; margin: 0 auto;">You have no notifications right now. New activity and updates will appear here in real time.</p>
        </div>
      `;
      return;
    }

    // Check applicant status so approved/rejected users don't show pending action buttons
    let allUsers = [];
    try {
      allUsers = await store.getDocs('users');
    } catch (e) {}
    const userMap = new Map();
    allUsers.forEach(u => userMap.set(u.uid || u.id, u));

    notifs.forEach(n => {
      const card = document.createElement('div');
      card.className = `card glass-card ${!n.read ? 'glass-card-unread' : ''}`;

      const targetApplicant = n.refId ? userMap.get(n.refId) : null;
      const isAlreadyApproved = targetApplicant && targetApplicant.status === 'approved';
      const isAlreadyRejected = targetApplicant && targetApplicant.status === 'rejected';

      card.innerHTML = `
        <div class="card-body flex justify-between items-start gap-4">
          <div class="flex-1">
            <div class="flex items-center gap-2 flex-wrap">
              <h3 class="text-sm font-bold" style="color: var(--text-main); margin: 0;">${escapeHTML(n.title)}</h3>
              ${!n.read ? `<span class="glass-badge-new">New</span>` : ''}
            </div>
            <p class="text-xs text-muted" style="margin-top: 6px; margin-bottom: 6px; line-height: 1.45;">${escapeHTML(n.message)}</p>
            <div class="flex items-center gap-1 text-xs text-subtle">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
              <span>${formatRelativeTime(n.createdAt)}</span>
            </div>
          </div>

          <div class="flex flex-col gap-1 items-end flex-shrink-0">
            ${n.type === 'account_approved' ? `
              <a href="#/dashboard" class="btn btn-success btn-sm notif-link glass-btn btn-go-to-feed-sm" data-id="${escapeHTML(n.id)}" style="background: rgba(22, 163, 74, 0.15); color: #15803d; border: 1px solid rgba(22, 163, 74, 0.3); font-weight: 700;">
                Go to Feed
              </a>
            ` : n.type === 'new_user_registration' ? `
              ${isAlreadyApproved ? `
                <div class="flex gap-2 items-center flex-wrap justify-end action-btn-group">
                  <span class="badge" style="background: rgba(22, 163, 74, 0.15); color: #15803d; font-weight: 700; padding: 4px 10px; border-radius: 8px; border: 1px solid rgba(22, 163, 74, 0.3);">
                    ✓ Approved
                  </span>
                  <a href="#/admin" class="btn btn-secondary btn-sm notif-link glass-btn" data-id="${escapeHTML(n.id)}">
                    Directory
                  </a>
                </div>
              ` : isAlreadyRejected ? `
                <div class="flex gap-2 items-center flex-wrap justify-end action-btn-group">
                  <span class="badge" style="background: rgba(239, 68, 68, 0.15); color: #dc2626; font-weight: 700; padding: 4px 10px; border-radius: 8px; border: 1px solid rgba(239, 68, 68, 0.3);">
                    ✕ Disapproved
                  </span>
                  <a href="#/admin" class="btn btn-secondary btn-sm notif-link glass-btn" data-id="${escapeHTML(n.id)}">
                    Directory
                  </a>
                </div>
              ` : `
                <div class="flex gap-2 items-center flex-wrap justify-end action-btn-group">
                  <button class="btn btn-success btn-sm approve-member-btn glass-btn" data-uid="${escapeHTML(n.refId || '')}" data-notif-id="${escapeHTML(n.id)}" style="background: #16a34a; color: white; font-weight: 700;">
                    ✓ Approve
                  </button>
                  <button class="btn btn-danger btn-sm disapprove-member-btn glass-btn" data-uid="${escapeHTML(n.refId || '')}" data-notif-id="${escapeHTML(n.id)}" style="background: #dc2626; color: white; font-weight: 700;">
                    ✕ Disapprove
                  </button>
                  <a href="#/admin" class="btn btn-secondary btn-sm notif-link glass-btn" data-id="${escapeHTML(n.id)}">
                    Directory
                  </a>
                </div>
              `}
            ` : n.refId ? `
              <a href="#/requests/${escapeHTML(n.refId)}" class="btn btn-secondary btn-sm notif-link glass-btn" data-id="${escapeHTML(n.id)}">
                View
              </a>
            ` : ''}

            <div class="flex items-center gap-1" style="margin-top: 4px;">
              ${!n.read ? `
                <button class="btn btn-sm mark-single-read-btn glass-btn" data-id="${escapeHTML(n.id)}" style="font-size: 11px; padding: 3px 8px; color: var(--color-primary); background: rgba(37, 99, 235, 0.08); border-color: rgba(37, 99, 235, 0.2);">
                  Mark read
                </button>
              ` : ''}
              <button class="btn btn-sm delete-single-notif-btn glass-btn" data-id="${escapeHTML(n.id)}" title="Delete notification" style="font-size: 11px; padding: 4px 6px; color: var(--color-danger); background: transparent; border-color: transparent;">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
              </button>
            </div>
          </div>
        </div>
      `;

      // Approve member button handler
      const approveBtn = card.querySelector('.approve-member-btn');
      if (approveBtn) {
        approveBtn.addEventListener('click', async (e) => {
          e.preventDefault();
          e.stopPropagation();
          const targetUid = approveBtn.getAttribute('data-uid');
          const notifId = approveBtn.getAttribute('data-notif-id');
          if (!targetUid) return;

          approveBtn.disabled = true;
          approveBtn.textContent = 'Approving...';
          const disapproveBtn = card.querySelector('.disapprove-member-btn');
          if (disapproveBtn) disapproveBtn.disabled = true;

          try {
            await store.updateDoc('users', targetUid, { status: 'approved' });

            await notificationsService.create({
              userId: targetUid,
              type: 'account_approved',
              title: 'Membership Approved!',
              message: 'Your ShareBox account has been approved by the campus administrator. You are now an active member and can participate in equipment sharing.',
              refId: null
            });

            await notificationsService.markAsRead(notifId);
            toast.success('Member approved! Added to active user directory.');

            const parentDiv = approveBtn.closest('.action-btn-group');
            if (parentDiv) {
              parentDiv.innerHTML = `
                <span class="badge" style="background: rgba(22, 163, 74, 0.15); color: #15803d; font-weight: 700; padding: 4px 10px; border-radius: 8px; border: 1px solid rgba(22, 163, 74, 0.3);">
                  ✓ Approved
                </span>
                <a href="#/admin" class="btn btn-secondary btn-sm glass-btn">
                  View Directory
                </a>
              `;
            }
          } catch (err) {
            toast.error('Failed to approve member: ' + err.message);
            approveBtn.disabled = false;
            approveBtn.textContent = '✓ Approve';
            if (disapproveBtn) disapproveBtn.disabled = false;
          }
        });
      }

      // Disapprove member button handler
      const disapproveBtn = card.querySelector('.disapprove-member-btn');
      if (disapproveBtn) {
        disapproveBtn.addEventListener('click', async (e) => {
          e.preventDefault();
          e.stopPropagation();
          const targetUid = disapproveBtn.getAttribute('data-uid');
          const notifId = disapproveBtn.getAttribute('data-notif-id');
          if (!targetUid) return;

          const confirmed = window.confirm('Are you sure you want to disapprove this membership request?');
          if (!confirmed) return;

          disapproveBtn.disabled = true;
          disapproveBtn.textContent = 'Disapproving...';
          const approveBtn = card.querySelector('.approve-member-btn');
          if (approveBtn) approveBtn.disabled = true;

          try {
            // Retrieve candidate email to permanently bar from re-registration
            const targetUser = await store.getDoc('users', targetUid);
            if (targetUser?.email) {
              store.disapproveEmail(targetUser.email);
            }

            await store.updateDoc('users', targetUid, { status: 'rejected' });

            await notificationsService.create({
              userId: targetUid,
              type: 'account_rejected',
              title: 'Membership Application Update',
              message: 'Your registration request could not be approved at this time. Please contact the college administrator or the DYP administration office for further details.',
              refId: null
            });

            // Dismiss the notification permanently so it never shows up in admin notifications again
            await notificationsService.deleteNotification(notifId);
            toast.info('Member request disapproved. Email permanently barred from registering again.');

            // Smoothly remove card from UI
            card.style.transition = 'all 0.3s ease';
            card.style.opacity = '0';
            card.style.transform = 'scale(0.95)';
            setTimeout(() => {
              card.remove();
              if (listContainer.children.length === 0) {
                listContainer.innerHTML = `
                  <div class="glass-empty-card">
                    <div style="width: 56px; height: 56px; border-radius: 50%; background: rgba(37, 99, 235, 0.08); color: var(--color-primary); display: flex; align-items: center; justify-content: center; margin: 0 auto 16px;">
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75">
                        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                        <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                      </svg>
                    </div>
                    <h3 class="text-md font-bold" style="color: var(--text-main); margin-bottom: 4px;">All caught up!</h3>
                    <p class="text-xs text-muted" style="max-width: 380px; margin: 0 auto;">You have no notifications right now.</p>
                  </div>
                `;
              }
            }, 300);
          } catch (err) {
            toast.error('Failed to disapprove member: ' + err.message);
            disapproveBtn.disabled = false;
            disapproveBtn.textContent = '✕ Disapprove';
            if (approveBtn) approveBtn.disabled = false;
          }
        });
      }

      // View link handler
      const viewLink = card.querySelector('.notif-link');
      if (viewLink) {
        viewLink.addEventListener('click', async (e) => {
          if (!n.read) {
            e.preventDefault();
            const targetHref = viewLink.getAttribute('href');
            await notificationsService.markAsRead(n.id);
            window.location.hash = targetHref;
          }
        });
      }

      // Mark single notification read handler
      const markBtn = card.querySelector('.mark-single-read-btn');
      if (markBtn) {
        markBtn.addEventListener('click', async () => {
          await notificationsService.markAsRead(n.id);
        });
      }

      // Delete single notification handler
      const deleteBtn = card.querySelector('.delete-single-notif-btn');
      if (deleteBtn) {
        deleteBtn.addEventListener('click', async () => {
          try {
            await notificationsService.deleteNotification(n.id);
            toast.success('Notification removed.');
          } catch (err) {
            toast.error('Failed to remove notification: ' + err.message);
          }
        });
      }

      listContainer.appendChild(card);
    });
  });
}
