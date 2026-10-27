import { EVENT_TYPES } from '../../config/constants.js';
import { eventsService } from '../../services/events.service.js';
import { toast } from '../../components/toast.js';
import { escapeHTML } from '../../utils/sanitize.js';

export async function renderCreateEventPage(container, { user }) {
  container.innerHTML = `
    <div class="container" style="max-width: 640px; padding-top: var(--space-6);">
      <div class="card">
        <div class="card-header">
          <h2 class="text-lg font-bold">Create Campus Event</h2>
        </div>
        <div class="card-body">
          <form id="create-event-form">
            <div class="form-group">
              <label class="form-label" for="event-title">Event Title <span class="required">*</span></label>
              <input type="text" id="event-title" class="form-input" placeholder="e.g. Robocon Workshop 2026" required>
            </div>

            <div class="flex gap-4">
              <div class="form-group flex-1">
                <label class="form-label" for="event-type">Event Type <span class="required">*</span></label>
                <select id="event-type" class="form-select" required>
                  ${EVENT_TYPES.map(t => `<option value="${escapeHTML(t)}">${escapeHTML(t)}</option>`).join('')}
                </select>
              </div>

              <div class="form-group flex-1">
                <label class="form-label" for="event-join-code">Join Code <span class="required">*</span></label>
                <input type="text" id="event-join-code" class="form-input" placeholder="e.g. ROBO26" maxlength="8" style="text-transform: uppercase;" required>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label" for="event-venue">Venue / Location <span class="required">*</span></label>
              <input type="text" id="event-venue" class="form-input" placeholder="e.g. Robotics Lab, Block C" required>
            </div>

            <div class="flex gap-4">
              <div class="form-group flex-1">
                <label class="form-label" for="event-start">Start Date & Time</label>
                <input type="datetime-local" id="event-start" class="form-input">
              </div>

              <div class="form-group flex-1">
                <label class="form-label" for="event-end">End Date & Time</label>
                <input type="datetime-local" id="event-end" class="form-input">
              </div>
            </div>

            <div class="form-group">
              <label class="form-label" for="event-desc">Description</label>
              <textarea id="event-desc" class="form-textarea" rows="3" placeholder="Briefly describe the event purpose..."></textarea>
            </div>

            <div class="form-group">
              <label class="form-label" for="event-rules">Event Resource & Borrowing Rules <span class="required">*</span></label>
              <textarea id="event-rules" class="form-textarea" rows="4" placeholder="Detail the guidelines for borrowed items and penalty policies..." required>All borrowed tools and components must be returned before the event conclusion. Failure to return items or unresolved damage will lead to campus-wide borrowing suspension.</textarea>
              <span class="form-hint">These rules will be referenced during damage report reviews.</span>
            </div>

            <div class="flex justify-end gap-3" style="margin-top: var(--space-4);">
              <a href="#/events" class="btn btn-secondary">Cancel</a>
              <button type="submit" id="create-event-submit-btn" class="btn btn-primary">
                Publish Event
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;

  const form = container.querySelector('#create-event-form');
  const submitBtn = container.querySelector('#create-event-submit-btn');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const title = form.querySelector('#event-title').value.trim();
    const type = form.querySelector('#event-type').value;
    const joinCode = form.querySelector('#event-join-code').value.trim();
    const venue = form.querySelector('#event-venue').value.trim();
    const startAt = form.querySelector('#event-start').value || null;
    const endAt = form.querySelector('#event-end').value || null;
    const description = form.querySelector('#event-desc').value.trim();
    const rules = form.querySelector('#event-rules').value.trim();

    if (!title || !joinCode || !venue || !rules) {
      toast.error('Please fill in all required fields.');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating...';

    try {
      const eventId = await eventsService.createEvent({
        title,
        type,
        joinCode,
        venue,
        startAt,
        endAt,
        description,
        rules
      }, user);

      toast.success('Event created successfully!');
      window.location.hash = `#/events/${eventId}`;
    } catch (err) {
      toast.error(err.message || 'Failed to create event.');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Publish Event';
    }
  });
}
