import { eventsService } from '../../services/events.service.js';
import { store } from '../../services/store.js';
import { toast } from '../../components/toast.js';
import { modal } from '../../components/modal.js';
import { escapeHTML } from '../../utils/sanitize.js';
import { isUserOrganizer, isUserAdmin } from '../../utils/guards.js';
import { formatDateTime } from '../../utils/dates.js';

export async function renderEventsListPage(container, { user, userData }) {
  const events = await eventsService.getEvents();
  const isOrg = isUserOrganizer(userData);
  const isAdmin = isUserAdmin(userData);

  container.innerHTML = `
    <div class="container" style="padding-top: var(--space-6);">
      <div class="flex justify-between items-center" style="margin-bottom: var(--space-6);">
        <div>
          <h1 class="text-xl font-bold">Campus Communities & Events</h1>
          <p class="text-sm text-muted">Join private event feeds using a join code, or browse campus-wide activities.</p>
        </div>
        <div class="flex gap-2">
          <button id="enter-code-btn" class="btn btn-secondary btn-sm">Enter Join Code</button>
          ${(isOrg || isAdmin) ? `<a href="#/events/new" class="btn btn-primary btn-sm">+ Create Event</a>` : ''}
        </div>
      </div>

      <div class="requests-grid">
        ${events.map(event => `
          <div class="card flex flex-col justify-between">
            <div class="card-body">
              <div class="flex justify-between items-start gap-2" style="margin-bottom: 6px;">
                <span class="badge" style="background: var(--bg-subtle); color: var(--text-main);">${escapeHTML(event.type)}</span>
                <span class="text-xs text-muted">${event.memberCount || 1} members</span>
              </div>

              <h3 class="text-base font-bold" style="margin-bottom: 6px;">
                <a href="#/events/${escapeHTML(event.id)}" style="color: inherit; text-decoration: none;">
                  ${escapeHTML(event.title)}
                </a>
              </h3>

              <p class="text-xs text-muted" style="display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; margin-bottom: 12px;">
                ${escapeHTML(event.description)}
              </p>

              <div class="text-xs text-muted flex flex-col gap-1">
                <div>Venue: <strong>${escapeHTML(event.venue)}</strong></div>
                ${event.startAt ? `<div>Date & Time: <strong>${formatDateTime(event.startAt)}</strong></div>` : ''}
              </div>
            </div>

            <div class="card-footer flex justify-between items-center gap-2 flex-wrap">
              <a href="#/events/${escapeHTML(event.id)}" class="btn btn-secondary btn-sm">
                View Event Feed
              </a>
              <div class="flex items-center gap-2">
                ${event.joinCode ? `
                  <span class="text-xs" style="font-family: var(--font-mono); background: var(--bg-muted); padding: 2px 6px; border-radius: 4px;">
                    Code: ${escapeHTML(event.joinCode)}
                  </span>
                ` : ''}
                ${isAdmin ? `
                  <button class="btn btn-danger btn-xs admin-delete-event-card-btn" data-id="${escapeHTML(event.id)}" title="Delete Event (Admin)">
                    Delete
                  </button>
                ` : ''}
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  // Enter Join Code Button
  const enterCodeBtn = container.querySelector('#enter-code-btn');
  enterCodeBtn.addEventListener('click', () => {
    modal.open({
      title: 'Join Private Campus Event',
      contentHTML: `
        <div class="form-group">
          <label class="form-label" for="modal-join-code">6-Character Event Join Code</label>
          <input type="text" id="modal-join-code" class="form-input" placeholder="e.g. HACK26" style="text-transform: uppercase;" maxlength="10">
          <span class="form-hint">Ask your event organizer or club lead for the access code.</span>
        </div>
      `,
      confirmText: 'Join Event',
      onConfirm: async () => {
        const input = document.getElementById('modal-join-code');
        const code = input ? input.value.trim().toUpperCase() : '';
        if (!code) {
          toast.error('Please enter a join code.');
          throw new Error('Code empty');
        }

        const match = events.find(e => e.joinCode && e.joinCode.toUpperCase() === code);
        if (!match) {
          toast.error('No active event found with this join code.');
          throw new Error('Code invalid');
        }

        try {
          await eventsService.joinEvent(match.id, user.uid, code);
          toast.success(`Joined ${match.title}!`);
          window.location.hash = `#/events/${match.id}`;
        } catch (e) {
          toast.error(e.message);
          throw e;
        }
      }
    });
  });

  if (isAdmin) {
    container.querySelectorAll('.admin-delete-event-card-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        if (confirm('Permanently delete this campus event? This will remove the event community.')) {
          try {
            await store.deleteDoc('events', id);
            toast.success('Event deleted successfully.');
            renderEventsListPage(container, { user, userData });
          } catch (err) {
            toast.error(err.message);
          }
        }
      });
    });
  }
}

