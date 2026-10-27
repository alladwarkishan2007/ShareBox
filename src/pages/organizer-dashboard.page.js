import { eventsService } from '../services/events.service.js';
import { reportsService } from '../services/reports.service.js';
import { store } from '../services/store.js';
import { modal } from '../components/modal.js';
import { toast } from '../components/toast.js';
import { escapeHTML } from '../utils/sanitize.js';
import { formatDateTime } from '../utils/dates.js';

export async function renderOrganizerDashboardPage(container, { user, userData }) {
  let activeTab = 'reports'; // 'reports' | 'events'

  const renderContent = async () => {
    const allEvents = await eventsService.getEvents();
    const myEvents = allEvents.filter(e => e.createdBy === user.uid || userData?.role === 'admin');
    const myEventIds = myEvents.map(e => e.id);

    const allReports = await store.getDocs('damageReports');
    const eventReports = allReports.filter(r => myEventIds.includes(r.eventId) || userData?.role === 'admin');

    container.innerHTML = `
      <div class="container" style="padding-top: var(--space-6);">
        <div class="flex justify-between items-center" style="margin-bottom: var(--space-6);">
          <div>
            <h1 class="text-xl font-bold">Organizer Hub</h1>
            <p class="text-sm text-muted">Manage your campus events, enforce borrowing rules, and resolve damage reports.</p>
          </div>
          <a href="#/events/new" class="btn btn-primary btn-sm">+ Create New Event</a>
        </div>

        <!-- Navigation Tabs -->
        <div class="flex gap-2" style="border-bottom: 2px solid var(--border-subtle); margin-bottom: var(--space-6);">
          <button class="tab-btn btn btn-sm ${activeTab === 'reports' ? 'btn-primary' : 'btn-secondary'}" data-tab="reports">
            Damage Reports & Disputes (${eventReports.filter(r => r.status !== 'resolved').length} Pending)
          </button>
          <button class="tab-btn btn btn-sm ${activeTab === 'events' ? 'btn-primary' : 'btn-secondary'}" data-tab="events">
            My Events (${myEvents.length})
          </button>
        </div>

        <div id="organizer-content"></div>
      </div>
    `;

    const contentArea = container.querySelector('#organizer-content');

    if (activeTab === 'reports') {
      if (eventReports.length === 0) {
        contentArea.innerHTML = `
          <div class="card empty-state">
            <h3 class="text-md font-bold">No Damage Reports Filed</h3>
            <p class="text-xs text-muted">All equipment handovers in your events are running smoothly with no disputes!</p>
          </div>
        `;
      } else {
        contentArea.innerHTML = `
          <div class="flex flex-col gap-4">
            ${eventReports.map(rep => {
              const matchedEvent = myEvents.find(e => e.id === rep.eventId);
              const isResolved = rep.status === 'resolved';

              return `
                <div class="card" style="border-left: 4px solid ${isResolved ? 'var(--color-success)' : 'var(--color-danger)'};">
                  <div class="card-header flex justify-between items-center">
                    <div>
                      <span class="text-xs text-muted">Event: <strong>${escapeHTML(matchedEvent?.title || rep.eventId)}</strong></span>
                      <h3 class="text-sm font-bold" style="margin-top: 2px;">Report #${escapeHTML(rep.id)}</h3>
                    </div>
                    <span class="badge ${isResolved ? 'badge-status-completed' : 'badge-status-damage_reported'}">
                      ${escapeHTML(rep.status.toUpperCase())}
                    </span>
                  </div>

                  <div class="card-body flex flex-col gap-3">
                    <div style="background: #f8fafc; border: 1px solid var(--border-subtle); border-left: 3px solid var(--color-primary); padding: 8px 12px; border-radius: var(--radius-sm); font-size: var(--font-xs);">
                      <strong style="color: var(--color-primary); display: block; margin-bottom: 2px;">Event Accountability Rule Reference:</strong>
                      <p style="margin: 0;">${escapeHTML(matchedEvent?.rules || 'Standard college equipment care policy.')}</p>
                    </div>

                    <div>
                      <h4 class="text-xs font-bold text-muted">Owner's Damage Statement (${escapeHTML(rep.ownerName)}):</h4>
                      <p class="text-sm" style="margin-top: 2px;">${escapeHTML(rep.description)}</p>
                    </div>

                    ${rep.photos && rep.photos.length > 0 ? `
                      <div class="flex gap-2" style="flex-wrap: wrap;">
                        ${rep.photos.map(p => `
                          <img src="${escapeHTML(p)}" alt="Evidence" style="width: 80px; height: 80px; object-fit: cover; border-radius: 6px;">
                        `).join('')}
                      </div>
                    ` : ''}

                    <div style="background: var(--color-info-light); padding: 8px 12px; border-radius: var(--radius-sm);">
                      <h4 class="text-xs font-bold" style="color: var(--color-info);">Borrower's Statement:</h4>
                      <p class="text-sm" style="margin-top: 2px; color: #0369a1;">
                        ${rep.borrowerResponse ? escapeHTML(rep.borrowerResponse) : '<em>No rebuttal submitted yet.</em>'}
                      </p>
                    </div>

                    ${isResolved && rep.decision ? `
                      <div style="background: #f0fdf4; border: 1px solid #bbf7d0; padding: 10px; border-radius: var(--radius-sm); font-size: var(--font-xs);">
                        <strong style="color: #15803d;">Decision: ${escapeHTML(rep.decision.action.toUpperCase())}</strong>
                        ${rep.decision.restrictionDays > 0 ? `<div>Borrowing Restriction: <strong>${rep.decision.restrictionDays} day(s)</strong></div>` : ''}
                        <div>Notes: ${escapeHTML(rep.decision.note || 'None')}</div>
                        <div class="text-muted" style="margin-top: 4px;">Resolved by: ${escapeHTML(rep.decision.reviewerName)} at ${formatDateTime(rep.decision.decidedAt)}</div>
                      </div>
                    ` : ''}
                  </div>

                  ${!isResolved ? `
                    <div class="card-footer flex justify-between items-center">
                      <a href="#/requests/${escapeHTML(rep.requestId)}" class="btn btn-secondary btn-sm">View Item Request</a>
                      <button class="btn btn-primary btn-sm resolve-report-btn" data-id="${escapeHTML(rep.id)}">
                        Adjudicate & Apply Penalty
                      </button>
                    </div>
                  ` : ''}
                </div>
              `;
            }).join('')}
          </div>
        `;

        // Resolve Report Buttons
        contentArea.querySelectorAll('.resolve-report-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            const reportId = btn.getAttribute('data-id');
            const targetReport = eventReports.find(r => r.id === reportId);

            modal.open({
              title: `Adjudicate Damage Dispute #${reportId}`,
              contentHTML: `
                <div class="form-group">
                  <label class="form-label" for="action-select">Action / Penalty <span class="required">*</span></label>
                  <select id="action-select" class="form-select" required>
                    <option value="warning">Formal Warning (Increment Warnings Count)</option>
                    <option value="restriction">Temporary Borrowing Restriction (Suspension)</option>
                    <option value="compensation_required">Mandatory Compensation Note</option>
                    <option value="dismissed">Dismiss Dispute (Accidental wear & tear)</option>
                  </select>
                </div>

                <div class="form-group" id="days-group" style="display: none;">
                  <label class="form-label" for="restriction-days">Restriction Duration (Days)</label>
                  <input type="number" id="restriction-days" class="form-input" min="1" max="90" value="7">
                  <span class="form-hint">User will be blocked from creating requests or accepting items for this duration.</span>
                </div>

                <div class="form-group">
                  <label class="form-label" for="decision-notes">Decision Notes & Rationale</label>
                  <textarea id="decision-notes" class="form-textarea" rows="3" placeholder="Explain the rationale referencing event rules..."></textarea>
                </div>
              `,
              confirmText: 'Apply Decision',
              onConfirm: async () => {
                const actionSelect = document.getElementById('action-select');
                const daysInput = document.getElementById('restriction-days');
                const notesInput = document.getElementById('decision-notes');

                const action = actionSelect.value;
                const restrictionDays = action === 'restriction' ? Number(daysInput.value) || 7 : 0;
                const note = notesInput.value.trim();

                try {
                  await reportsService.resolveReport({
                    reportId,
                    reviewerUser: user,
                    action,
                    restrictionDays,
                    note
                  });
                  toast.success('Dispute resolved and penalties applied!');
                  renderContent();
                } catch (e) {
                  toast.error(e.message);
                  throw e;
                }
              }
            });

            // Dynamic show/hide of restriction days input
            setTimeout(() => {
              const sel = document.getElementById('action-select');
              const daysGrp = document.getElementById('days-group');
              if (sel && daysGrp) {
                sel.addEventListener('change', () => {
                  daysGrp.style.display = sel.value === 'restriction' ? 'block' : 'none';
                });
              }
            }, 50);
          });
        });
      }
    } else {
      // Events Tab
      contentArea.innerHTML = `
        <div class="requests-grid">
          ${myEvents.map(e => `
            <div class="card">
              <div class="card-body">
                <span class="badge" style="background: var(--bg-subtle); margin-bottom: 4px;">${escapeHTML(e.type)}</span>
                <h3 class="text-base font-bold">${escapeHTML(e.title)}</h3>
                <p class="text-xs text-muted" style="margin-top: 4px;">${escapeHTML(e.description || 'Campus Event')}</p>
                <div class="text-xs text-muted" style="margin-top: 8px;">
                  <div>Venue: <strong>${escapeHTML(e.venue)}</strong></div>
                  <div>Members: <strong>${e.memberCount || 1}</strong></div>
                  <div>Join Code: <strong style="font-family: var(--font-mono);">${escapeHTML(e.joinCode)}</strong></div>
                </div>
              </div>
              <div class="card-footer flex gap-2">
                <a href="#/events/${escapeHTML(e.id)}" class="btn btn-secondary btn-sm flex-1">Open Event Feed</a>
                <button class="btn btn-primary btn-sm view-event-members-btn" data-event-id="${escapeHTML(e.id)}" data-event-title="${escapeHTML(e.title)}">
                  Members (${e.memberCount || 1})
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      `;

      // Event Members modal handler
      contentArea.querySelectorAll('.view-event-members-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const eventId = btn.getAttribute('data-event-id');
          const eventTitle = btn.getAttribute('data-event-title');
          const members = await eventsService.getEventMembers(eventId);

          modal.open({
            title: `Event Members: ${eventTitle}`,
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
      });
    }

    // Tab bindings
    container.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        activeTab = btn.getAttribute('data-tab');
        renderContent();
      });
    });
  };

  await renderContent();
}
