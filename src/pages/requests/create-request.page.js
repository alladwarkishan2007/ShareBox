import { ITEM_CATEGORIES, REQUEST_URGENCY } from '../../config/constants.js';
import { requestsService } from '../../services/requests.service.js';
import { eventsService } from '../../services/events.service.js';
import { validateRequestPayload } from '../../utils/validators.js';
import { toast } from '../../components/toast.js';
import { escapeHTML } from '../../utils/sanitize.js';
import { checkUserRestriction } from '../../utils/guards.js';

export async function renderCreateRequestPage(container, { user, userData }) {
  // Check user restriction
  const restriction = checkUserRestriction(userData);
  if (restriction.isRestricted) {
    container.innerHTML = `
      <div class="container empty-state" style="padding-top: var(--space-12);">
        <div style="width: 56px; height: 56px; margin: 0 auto 12px auto; border-radius: 50%; background: #fee2e2; color: #dc2626; display: flex; align-items: center; justify-content: center;">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line></svg>
        </div>
        <h2 class="text-xl font-bold" style="color: var(--color-danger);">Borrowing Restricted</h2>
        <p class="text-sm text-muted" style="max-width: 480px;">
          You currently have an active borrowing restriction resulting from a damage report or code-of-conduct violation.
          Remaining duration: <strong>${restriction.remainingDays} more day(s)</strong>.
        </p>
        <a href="#/dashboard" class="btn btn-secondary" style="margin-top: 16px;">Back to Feed</a>
      </div>
    `;
    return;
  }

  // Fetch events user can post to
  const events = await eventsService.getEvents();

  // Set default needed-by time to 2 hours from now
  const defaultNeededBy = new Date(Date.now() + 2 * 3600000).toISOString().slice(0, 16);
  const defaultReturn = new Date(Date.now() + 24 * 3600000).toISOString().slice(0, 16);

  container.innerHTML = `
    <div class="container" style="max-width: 680px; padding-top: var(--space-6);">
      <div class="card">
        <div class="card-header">
          <h2 class="text-lg font-bold">Post an Item Request</h2>
        </div>
        <div class="card-body">
          <form id="create-request-form">
            <!-- Event Scope -->
            <div class="form-group">
              <label class="form-label" for="req-event">Event / Community Scope <span class="required">*</span></label>
              <select id="req-event" class="form-select" required>
                <option value="campus-general">Campus General (All Campus Members)</option>
                ${events.filter(e => e.id !== 'campus-general').map(e => `
                  <option value="${escapeHTML(e.id)}">${escapeHTML(e.title)} (${escapeHTML(e.type)})</option>
                `).join('')}
              </select>
            </div>

            <!-- Item Name -->
            <div class="form-group">
              <label class="form-label" for="req-item-name">Item Name <span class="required">*</span></label>
              <input type="text" id="req-item-name" class="form-input" placeholder="e.g. Raspberry Pi 4, HDMI Adapter, Lab Coat" required>
            </div>

            <div class="flex gap-4">
              <!-- Category -->
              <div class="form-group flex-1">
                <label class="form-label" for="req-category">Category <span class="required">*</span></label>
                <select id="req-category" class="form-select" required>
                  <option value="" disabled selected>Select Category</option>
                  ${ITEM_CATEGORIES.map(cat => `<option value="${escapeHTML(cat)}">${escapeHTML(cat)}</option>`).join('')}
                </select>
              </div>

              <!-- Urgency -->
              <div class="form-group flex-1">
                <label class="form-label" for="req-urgency">Urgency Level <span class="required">*</span></label>
                <select id="req-urgency" class="form-select" required>
                  ${Object.values(REQUEST_URGENCY).map(urg => `
                    <option value="${escapeHTML(urg)}" ${urg === 'Medium' ? 'selected' : ''}>${escapeHTML(urg)}</option>
                  `).join('')}
                </select>
              </div>

              <!-- Quantity -->
              <div class="form-group" style="width: 100px;">
                <label class="form-label" for="req-quantity">Quantity</label>
                <input type="number" id="req-quantity" class="form-input" min="1" max="10" value="1">
              </div>
            </div>

            <!-- Description -->
            <div class="form-group">
              <label class="form-label" for="req-desc">Description & Purpose <span class="required">*</span></label>
              <textarea id="req-desc" class="form-textarea" rows="3" placeholder="Explain what you need it for and any specific technical requirements..." required></textarea>
            </div>

            <!-- Timestamps -->
            <div class="flex gap-4">
              <div class="form-group flex-1">
                <label class="form-label" for="req-needed-by">Needed By <span class="required">*</span></label>
                <input type="datetime-local" id="req-needed-by" class="form-input" value="${defaultNeededBy}" required>
              </div>

              <div class="form-group flex-1">
                <label class="form-label" for="req-return-time">Expected Return Time</label>
                <input type="datetime-local" id="req-return-time" class="form-input" value="${defaultReturn}">
              </div>
            </div>

            <!-- Optional Condition Photo -->
            <div class="form-group">
              <label class="form-label" for="req-photo">Item Reference Photo (Optional, Max 5MB)</label>
              <input type="file" id="req-photo" class="form-input" accept="image/*">
            </div>

            <div class="flex justify-end gap-3" style="margin-top: var(--space-4);">
              <a href="#/dashboard" class="btn btn-secondary">Cancel</a>
              <button type="submit" id="submit-req-btn" class="btn btn-primary">
                Publish Post
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;

  const form = container.querySelector('#create-request-form');
  const submitBtn = container.querySelector('#submit-req-btn');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const eventId = form.querySelector('#req-event').value;
    const itemName = form.querySelector('#req-item-name').value;
    const category = form.querySelector('#req-category').value;
    const urgency = form.querySelector('#req-urgency').value;
    const quantity = form.querySelector('#req-quantity').value;
    const description = form.querySelector('#req-desc').value;
    const neededBy = form.querySelector('#req-needed-by').value;
    const expectedReturnAt = form.querySelector('#req-return-time').value;
    const photoFile = form.querySelector('#req-photo').files[0] || null;

    const payload = {
      type: 'request',
      eventId,
      itemName,
      category,
      urgency,
      quantity,
      description,
      neededBy,
      expectedReturnAt
    };

    const validation = validateRequestPayload(payload);
    if (!validation.valid) {
      toast.error(validation.errors[0]);
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Publishing...';

    try {
      const requestId = await requestsService.createRequest(payload, user, photoFile);
      toast.success('Your post is live in the event feed!');
      window.location.hash = `#/requests/${requestId}`;
    } catch (err) {
      toast.error(err.message || 'Failed to create post.');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Publish Post';
    }
  });
}
