import { eventsService } from '../../services/events.service.js';
import { requestsService } from '../../services/requests.service.js';
import { store } from '../../services/store.js';
import { renderRequestCard } from '../../components/request-card.js';
import { modal } from '../../components/modal.js';
import { toast } from '../../components/toast.js';
import { escapeHTML } from '../../utils/sanitize.js';
import { formatDateTime } from '../../utils/dates.js';
import { isUserAdmin } from '../../utils/guards.js';

export async function renderEventDetailPage(container, { user, userData, params }) {
  const eventId = params.id;
  const event = await eventsService.getEventById(eventId);
  const isAdmin = isUserAdmin(userData);

  if (!event) {
    container.innerHTML = `
      <div class="container empty-state" style="padding-top: var(--space-12);">
        <h2 class="text-xl font-bold">Event Not Found</h2>
        <p class="text-sm text-muted">The event does not exist or has expired.</p>
        <a href="#/events" class="btn btn-primary" style="margin-top: 16px;">Browse Events</a>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="container" style="padding-top: var(--space-6);">
      <!-- Event Header Banner -->
      <div class="card" style="margin-bottom: var(--space-6);">
        <div class="card-body">
          <div class="flex justify-between items-start gap-3 flex-wrap">
            <div>
              <span class="badge" style="background: var(--bg-subtle); color: var(--color-primary); margin-bottom: 4px;">
                ${escapeHTML(event.type)}
              </span>
              <h1 class="text-xl font-bold">${escapeHTML(event.title)}</h1>
              <p class="text-sm text-muted" style="margin-top: 4px;">${escapeHTML(event.description || 'Community resource sharing.')}</p>
            </div>
            <div class="flex gap-2 flex-wrap">
              <button id="view-event-members-btn" class="btn btn-secondary btn-sm">
                Members (${event.memberCount || 1})
              </button>
              <a href="#/requests/new?eventId=${escapeHTML(event.id)}" class="btn btn-primary btn-sm">
                + Post in this Event
              </a>
              ${isAdmin ? `
                <button id="admin-delete-detail-btn" class="btn btn-danger btn-sm">
                  Delete Event
                </button>
              ` : ''}
            </div>
          </div>

          <div class="flex gap-6 text-xs text-muted" style="margin-top: var(--space-4); padding-top: var(--space-3); border-top: 1px solid var(--border-subtle); flex-wrap: wrap;">
            <div>Venue: <strong>${escapeHTML(event.venue)}</strong></div>
            <div>Members: <strong>${event.memberCount || 1}</strong></div>
            ${event.startAt ? `<div>Start: <strong>${formatDateTime(event.startAt)}</strong></div>` : ''}
            ${event.joinCode ? `<div>Join Code: <strong style="font-family: var(--font-mono);">${escapeHTML(event.joinCode)}</strong></div>` : ''}
          </div>

          <!-- Rules Section with distinct background color -->
          <div style="margin-top: var(--space-4); background: #f5f3ff; border: 1px solid #ddd6fe; border-left: 4px solid #7c3aed; padding: 12px 16px; border-radius: var(--radius-sm); font-size: var(--font-xs); color: #4c1d95;">
            <strong style="display: block; margin-bottom: 4px; font-size: 13px;">Event Guidelines & Accountability Rules</strong>
            <p style="margin: 0; line-height: 1.5; color: #5b21b6;">${escapeHTML(event.rules)}</p>
          </div>
        </div>
      </div>

      <!-- Event Filtered Requests Feed -->
      <div class="flex justify-between items-center" style="margin-bottom: var(--space-4);">
        <h2 class="text-base font-bold">Active Requests in ${escapeHTML(event.title)}</h2>
        <span id="event-feed-count" class="text-xs text-muted">Loading items...</span>
      </div>

      <div id="event-requests-container" class="requests-grid">
        <div class="skeleton" style="height: 140px; grid-column: 1 / -1;"></div>
      </div>
    </div>
  `;

  const reqContainer = container.querySelector('#event-requests-container');
  const countLabel = container.querySelector('#event-feed-count');

  requestsService.subscribeFeed(event.id, null, (items) => {
    reqContainer.innerHTML = '';
    countLabel.textContent = `${items.length} item(s) listed`;

    if (items.length === 0) {
      reqContainer.innerHTML = `
        <div class="empty-state card" style="grid-column: 1 / -1;">
          <h3 class="text-md font-bold">No active requests in this event yet</h3>
          <p class="text-xs text-muted">Need a cable, adapter, or hardware? Be the first to post!</p>
          <a href="#/requests/new?eventId=${escapeHTML(event.id)}" class="btn btn-primary btn-sm" style="margin-top: 8px;">Post Request</a>
        </div>
      `;
      return;
    }

    items.forEach(req => {
      const card = renderRequestCard(req, user, async (r) => {
        try {
          await requestsService.acceptRequest(r.id, user);
          toast.success('Accepted! Direct chat is now open.');
          window.location.hash = `#/requests/${r.id}`;
        } catch (e) {
          toast.error(e.message);
        }
      });
      reqContainer.appendChild(card);
    });
  });

  const adminDeleteBtn = container.querySelector('#admin-delete-detail-btn');
  if (adminDeleteBtn) {
    adminDeleteBtn.addEventListener('click', async () => {
      if (confirm(`Permanently delete event "${event.title}" and close its feed?`)) {
        try {
          await store.deleteDoc('events', eventId);
          toast.success('Event deleted successfully.');
          window.location.hash = '#/events';
        } catch (err) {
          toast.error(err.message);
        }
      }
    });
  }

  const viewMembersBtn = container.querySelector('#view-event-members-btn');
  if (viewMembersBtn) {
    viewMembersBtn.addEventListener('click', async () => {
      const members = await eventsService.getEventMembers(eventId);
      modal.open({
        title: `Event Members: ${event.title}`,
        contentHTML: `
          <div style="margin-bottom: 12px; font-size: 13px; color: var(--text-muted);">
            Participants registered in this event (displaying Name, Branch, and Platform Role):
          </div>
          <div style="overflow-x: auto; max-height: 400px; border: 1px solid var(--border-subtle); border-radius: var(--radius-sm);">
            <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 13px;">
              <thead>
                <tr style="background: #f1f5f9; border-bottom: 2px solid #cbd5e1;">
                  <th style="padding: 10px 14px; font-weight: 700; color: #1e293b;">Member Name</th>
                  <th style="padding: 10px 14px; font-weight: 700; color: #1e293b;">Branch / Department</th>
                  <th style="padding: 10px 14px; font-weight: 700; color: #1e293b;">Platform Role</th>
                </tr>
              </thead>
              <tbody>
                ${members.length === 0 ? `
                  <tr><td colspan="3" style="padding: 24px; text-align: center;" class="text-muted">No members registered yet.</td></tr>
                ` : members.map(m => `
                  <tr style="border-bottom: 1px solid var(--border-subtle);">
                    <td style="padding: 10px 14px; font-weight: 600; color: var(--text-main);">
                      ${escapeHTML(m.name)}
                    </td>
                    <td style="padding: 10px 14px; color: var(--text-muted);">
                      ${escapeHTML(m.branch)}
                    </td>
                    <td style="padding: 10px 14px;">
                      <span class="badge" style="background: ${m.role === 'admin' ? '#2563eb' : m.role === 'organizer' ? '#7c3aed' : '#f1f5f9'}; color: ${m.role === 'admin' || m.role === 'organizer' ? 'white' : '#475569'}; font-weight: bold; text-transform: uppercase; font-size: 10px;">
                        ${escapeHTML(m.role)}
                      </span>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `,
        showCancel: false,
        confirmText: 'Close'
      });
    });
  }
}

