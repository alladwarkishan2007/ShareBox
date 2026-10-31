import { notificationsService } from '../services/notifications.service.js';
import { store } from '../services/store.js';
import { formatRelativeTime } from '../utils/dates.js';
import { escapeHTML } from '../utils/sanitize.js';
import { toast } from '../components/toast.js';

export async function renderNotificationsPage(container, { user }) {
  container.innerHTML = `
    <div class="container" style="max-width: 680px; padding-top: var(--space-6);">
      <div class="flex justify-between items-center" style="margin-bottom: var(--space-6);">
        <div>
          <h1 class="text-xl font-bold">In-App Notifications</h1>
          <p class="text-sm text-muted">Real-time alerts for accepted requests, messages, handovers, and disputes.</p>
        </div>
        <button id="mark-all-read-btn" class="btn btn-secondary btn-sm">
          Mark All as Read
        </button>
      </div>

      <div id="notifications-list" class="flex flex-col gap-3">
        <div class="skeleton" style="height: 80px;"></div>
        <div class="skeleton" style="height: 80px;"></div>
      </div>
    </div>
  `;

  const listContainer = container.querySelector('#notifications-list');
  const markAllBtn = container.querySelector('#mark-all-read-btn');

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
      markAllBtn.textContent = 'Mark All as Read';
    }
  });

  notificationsService.subscribeNotifications(user.uid, (notifs) => {
    listContainer.innerHTML = '';

    if (notifs.length === 0) {
      listContainer.innerHTML = `
        <div class="card empty-state">
          <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
          </svg>
          <h3 class="text-md font-bold">No notifications yet</h3>
          <p class="text-xs text-muted">You will receive alerts here when other students interact with your requests.</p>
        </div>
      `;
      return;
    }

    notifs.forEach(n => {
      const card = document.createElement('div');
      card.className = 'card';
      if (!n.read) {
        card.style.borderLeft = '4px solid var(--color-primary)';
        card.style.backgroundColor = 'var(--color-primary-light)';
      }

      card.innerHTML = `
        <div class="card-body flex justify-between items-start gap-4">
          <div class="flex-1">
            <div class="flex items-center gap-2">
              <h3 class="text-sm font-bold">${escapeHTML(n.title)}</h3>
              ${!n.read ? `<span class="badge" style="background: var(--color-primary); color: white; font-size: 10px;">New</span>` : ''}
            </div>
            <p class="text-xs text-muted" style="margin-top: 4px;">${escapeHTML(n.message)}</p>
            <span class="text-xs text-subtle" style="margin-top: 6px; display: inline-block;">${formatRelativeTime(n.createdAt)}</span>
          </div>

          <div class="flex flex-col gap-1 items-end">
            ${n.type === 'account_approved' ? `
              <a href="#/dashboard" class="btn btn-success btn-sm notif-link" data-id="${escapeHTML(n.id)}">
                Go to Feed
              </a>
            ` : n.type === 'new_user_registration' ? `
              <div class="flex gap-2 items-center flex-wrap justify-end">
                <button class="btn btn-success btn-sm approve-member-btn" data-uid="${escapeHTML(n.refId || '')}" data-notif-id="${escapeHTML(n.id)}" style="background: #16a34a; color: white; font-weight: 700;">
                  ✓ Approve
                </button>
                <a href="#/admin" class="btn btn-secondary btn-sm notif-link" data-id="${escapeHTML(n.id)}">
                  Directory
                </a>
              </div>
            ` : n.refId ? `
              <a href="#/requests/${escapeHTML(n.refId)}" class="btn btn-secondary btn-sm notif-link" data-id="${escapeHTML(n.id)}">
                View
              </a>
            ` : ''}
            ${!n.read ? `
              <button class="btn btn-sm mark-single-read-btn" data-id="${escapeHTML(n.id)}" style="font-size: 11px; padding: 2px 6px;">
                Mark read
              </button>
            ` : ''}
          </div>
        </div>
      `;

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

            const parentDiv = approveBtn.parentElement;
            if (parentDiv) {
              parentDiv.innerHTML = `
                <span class="badge" style="background: #ecfdf5; color: #047857; font-weight: 700; padding: 4px 10px; border: 1px solid #a7f3d0;">
                  ✓ Approved
                </span>
                <a href="#/admin" class="btn btn-secondary btn-sm">
                  View Directory
                </a>
              `;
            }
          } catch (err) {
            toast.error('Failed to approve member: ' + err.message);
            approveBtn.disabled = false;
            approveBtn.textContent = '✓ Approve';
          }
        });
      }

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

      const markBtn = card.querySelector('.mark-single-read-btn');
      if (markBtn) {
        markBtn.addEventListener('click', async () => {
          await notificationsService.markAsRead(n.id);
        });
      }

      listContainer.appendChild(card);
    });
  });
}
