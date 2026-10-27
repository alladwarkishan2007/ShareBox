import { authService } from '../services/auth.service.js';
import { store } from '../services/store.js';
import { toast } from '../components/toast.js';
import { escapeHTML } from '../utils/sanitize.js';
import { checkUserRestriction } from '../utils/guards.js';

export async function renderProfilePage(container, { user, userData }) {
  const profile = userData || await authService.getUserProfile(user.uid) || {};
  const restriction = checkUserRestriction(profile);

  // Fetch stats
  const allRequests = await store.getDocs('requests');
  const lentCount = allRequests.filter(r => r.helperId === user.uid && ['handed_over', 'returned', 'completed'].includes(r.status)).length;
  const borrowedCount = allRequests.filter(r => r.requesterId === user.uid && ['handed_over', 'returned', 'completed'].includes(r.status)).length;

  container.innerHTML = `
    <div class="container" style="max-width: 680px; padding-top: var(--space-6);">
      <!-- Restriction Notice if Active -->
      ${restriction.isRestricted ? `
        <div class="card" style="border-left: 4px solid var(--color-danger); margin-bottom: var(--space-6); background: var(--color-danger-light);">
          <div class="card-body">
            <h3 class="text-md font-bold" style="color: var(--color-danger); margin-bottom: 4px;">Active Borrowing Restriction</h3>
            <p class="text-xs" style="color: #991b1b;">
              Your ability to post new requests or accept items has been temporarily restricted by event organizers/administrators.
              Remaining duration: <strong>${restriction.remainingDays} day(s)</strong>.
            </p>
          </div>
        </div>
      ` : ''}

      <div class="card">
        <div class="card-header">
          <div class="flex items-center gap-3">
            <div style="width: 48px; height: 48px; border-radius: 50%; background: var(--color-primary-light); color: var(--color-primary); display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: bold;">
              ${escapeHTML((profile.name || user.email)[0].toUpperCase())}
            </div>
            <div>
              <h1 class="text-lg font-bold">${escapeHTML(profile.name || 'Student Member')}</h1>
              <p class="text-xs text-muted">${escapeHTML(profile.email || user.email)}</p>
            </div>
          </div>
          <div class="flex flex-col items-end gap-1">
            <span class="badge" style="background: var(--bg-subtle); color: var(--text-main); text-transform: uppercase;">
              ${escapeHTML(profile.role || 'Member')}
            </span>
            <span class="badge ${profile.status === 'blocked' ? 'badge-status-cancelled' : 'badge-status-completed'}">
              ${profile.status === 'blocked' ? 'Blocked' : 'Active'}
            </span>
          </div>
        </div>

        <div class="card-body">
          <!-- Accountability Stats -->
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 24px; text-align: center;">
            <div style="background: var(--bg-subtle); padding: 12px; border-radius: var(--radius-md);">
              <div class="text-xl font-bold" style="color: var(--color-primary);">${lentCount}</div>
              <div class="text-xs text-muted">Items Lent</div>
            </div>
            <div style="background: var(--bg-subtle); padding: 12px; border-radius: var(--radius-md);">
              <div class="text-xl font-bold" style="color: var(--color-success);">${borrowedCount}</div>
              <div class="text-xs text-muted">Items Borrowed</div>
            </div>
            <div style="background: var(--bg-subtle); padding: 12px; border-radius: var(--radius-md);">
              <div class="text-xl font-bold" style="color: ${profile.warningsCount > 0 ? 'var(--color-danger)' : 'var(--text-main)'};">
                ${profile.warningsCount || 0}
              </div>
              <div class="text-xs text-muted">Warnings Count</div>
            </div>
          </div>

          <!-- Edit Profile Form -->
          <form id="profile-edit-form">
            <h3 class="text-sm font-bold" style="margin-bottom: 12px;">Personal & Academic Information</h3>

            <div class="form-group">
              <label class="form-label" for="profile-name">Full Name <span class="required">*</span></label>
              <input type="text" id="profile-name" class="form-input" value="${escapeHTML(profile.name || '')}" required>
            </div>

            <div class="flex gap-4">
              <div class="form-group flex-1">
                <label class="form-label" for="profile-dept">Department <span class="required">*</span></label>
                <input type="text" id="profile-dept" class="form-input" value="${escapeHTML(profile.department || '')}" required>
              </div>

              <div class="form-group flex-1">
                <label class="form-label" for="profile-year">Year / Academic Standing</label>
                <input type="text" id="profile-year" class="form-input" value="${escapeHTML(profile.year || '')}">
              </div>
            </div>

            <div class="form-group">
              <label class="form-label" for="profile-phone">Phone Number (Optional)</label>
              <input type="tel" id="profile-phone" class="form-input" value="${escapeHTML(profile.phone || '')}" placeholder="+1 (555) 000-0000">
            </div>

            <div class="flex justify-end" style="margin-top: var(--space-4);">
              <button type="submit" id="profile-save-btn" class="btn btn-primary">
                Save Changes
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;

  const form = container.querySelector('#profile-edit-form');
  const saveBtn = container.querySelector('#profile-save-btn');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = form.querySelector('#profile-name').value.trim();
    const department = form.querySelector('#profile-dept').value.trim();
    const year = form.querySelector('#profile-year').value.trim();
    const phone = form.querySelector('#profile-phone').value.trim();

    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    try {
      await authService.updateUserProfile(user.uid, { name, department, year, phone });
      toast.success('Profile updated successfully!');
    } catch (err) {
      toast.error(err.message || 'Failed to update profile.');
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save Changes';
    }
  });
}
