import { requestsService } from '../../services/requests.service.js';
import { eventsService } from '../../services/events.service.js';
import { reportsService } from '../../services/reports.service.js';
import { createChatBox } from '../../components/chat-box.js';
import { MapPickerModal } from '../../components/map-picker.js';
import { modal } from '../../components/modal.js';
import { renderStatusBadge, renderUrgencyBadge } from '../../components/status-badge.js';
import { formatDateTime, formatRelativeTime } from '../../utils/dates.js';
import { toast } from '../../components/toast.js';
import { escapeHTML } from '../../utils/sanitize.js';
import { store } from '../../services/store.js';

export async function renderRequestDetailPage(container, { user, userData, params }) {
  let paramId = params.id;
  let request = await requestsService.getRequestById(paramId);
  let damageReport = null;

  // If not found by request ID directly, check if paramId was actually a damageReport ID
  if (!request) {
    const directReport = await store.getDoc('damageReports', paramId);
    if (directReport && directReport.requestId) {
      damageReport = directReport;
      request = await requestsService.getRequestById(directReport.requestId);
    }
  }

  if (!request) {
    container.innerHTML = `
      <div class="container empty-state" style="padding-top: var(--space-12);">
        <h2 class="text-xl font-bold">Request Not Found</h2>
        <p class="text-sm text-muted">The requested item post does not exist or has been removed.</p>
        <a href="#/dashboard" class="btn btn-primary" style="margin-top: 16px;">Back to Feed</a>
      </div>
    `;
    return;
  }

  const isOwner = user && request.requesterId === user.uid;
  const isHelper = user && request.helperId === user.uid;
  const isParticipant = isOwner || isHelper;

  // In ShareBox, the person posting the request is the Borrower who needs the item;
  // The helper who accepts the request is the Lender sharing the equipment.
  const isBorrower = isOwner;
  const isLender = isHelper;
  const partnerId = isOwner ? request.helperId : request.requesterId;
  const partnerName = isOwner ? request.helperName : request.requesterName;

  const isAcceptedOrBeyond = ['accepted', 'handed_over', 'returned', 'completed', 'damage_reported'].includes(request.status);

  // Fetch Event info
  const event = await eventsService.getEventById(request.eventId);

  // Always fetch any associated damage report for this request
  if (!damageReport) {
    const allReports = await store.getDocs('damageReports');
    damageReport = allReports.find(r => r.requestId === request.id) || null;
  }

  const statusSteps = ['open', 'accepted', 'handed_over', 'returned', 'completed'];
  const currentStepIndex = statusSteps.indexOf(request.status);

  container.innerHTML = `
    <div class="container" style="padding-top: var(--space-6);">
      <!-- Status Timeline Bar -->
      <div class="card" style="margin-bottom: var(--space-6); padding: var(--space-4);">
        <div class="flex justify-between items-center" style="position: relative;">
          ${statusSteps.map((step, idx) => {
            const isCompleted = currentStepIndex >= idx;
            const isCurrent = currentStepIndex === idx;
            return `
              <div class="flex flex-col items-center flex-1 text-center" style="position: relative; z-index: 2;">
                <div style="
                  width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
                  font-size: 13px; font-weight: bold; margin-bottom: 6px;
                  background: ${request.status === 'damage_reported' ? 'var(--color-danger)' : isCurrent ? 'var(--color-primary)' : isCompleted ? 'var(--color-success)' : 'var(--bg-muted)'};
                  color: ${isCompleted || isCurrent || request.status === 'damage_reported' ? 'white' : 'var(--text-muted)'};
                ">
                  ${request.status === 'damage_reported' ? '!' : isCompleted && !isCurrent ? '✓' : idx + 1}
                </div>
                <span class="text-xs font-medium" style="text-transform: capitalize; color: ${isCurrent ? 'var(--color-primary)' : 'var(--text-muted)'};">
                  ${escapeHTML(step.replace('_', ' '))}
                </span>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <div class="detail-layout">
        <!-- Left Column: Item Details, Handover Actions, Meeting Point -->
        <div class="flex flex-col gap-4">
          <div class="card">
            <div class="card-header">
              <div>
                <span class="text-xs text-muted">Event: <strong>${escapeHTML(event?.title || 'Campus')}</strong></span>
                <h1 class="text-xl font-bold" style="margin-top: 2px;">${escapeHTML(request.itemName)}</h1>
              </div>
              <div class="flex gap-2">
                ${renderUrgencyBadge(request.urgency)}
                ${renderStatusBadge(request.status)}
              </div>
            </div>

            <div class="card-body flex flex-col gap-4">
              ${request.photoURL ? `
                <div style="max-height: 260px; border-radius: var(--radius-md); overflow: hidden; background: var(--bg-subtle);">
                  <img src="${escapeHTML(request.photoURL)}" alt="${escapeHTML(request.itemName)}" style="width: 100%; height: 100%; object-fit: cover;">
                </div>
              ` : ''}

              <div>
                <h4 class="text-sm font-bold" style="margin-bottom: 4px;">Description & Notes</h4>
                <p class="text-sm text-main" style="white-space: pre-wrap;">${escapeHTML(request.description)}</p>
              </div>

              <div class="flex justify-between items-center text-xs text-muted" style="padding-top: var(--space-3); border-top: 1px solid var(--border-subtle);">
                <div>
                  <div>Posted by: <strong>${escapeHTML(request.requesterName)}</strong></div>
                  <div>Quantity: <strong>${escapeHTML(request.quantity)}</strong></div>
                </div>
                <div class="text-right">
                  <div>Needed By: <strong>${formatDateTime(request.neededBy)}</strong></div>
                  ${request.expectedReturnAt ? `<div>Return Deadline: <strong>${formatDateTime(request.expectedReturnAt)}</strong></div>` : ''}
                </div>
              </div>

              <!-- Accept Request Action Button (for helpers) -->
              ${request.status === 'open' && !isOwner ? `
                <div style="background: var(--color-primary-light); padding: var(--space-4); border-radius: var(--radius-md); border-left: 4px solid var(--color-primary);">
                  <h4 class="text-sm font-bold" style="color: var(--color-primary); margin-bottom: 4px;">Can you lend this item?</h4>
                  <p class="text-xs text-muted" style="margin-bottom: 12px;">
                    By tapping below, you agree to coordinate with ${escapeHTML(request.requesterName)} for a quick campus handover.
                  </p>
                  <button id="detail-accept-btn" class="btn btn-primary" style="width: 100%;">
                    I have this item (Accept Request)
                  </button>
                </div>
              ` : ''}

              <!-- Handover & Return Interactive Action Panel -->
              ${isAcceptedOrBeyond && isParticipant ? `
                <div style="background: var(--bg-subtle); padding: var(--space-4); border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
                  <h4 class="text-sm font-bold" style="margin-bottom: 8px;">Action Center</h4>

                  <!-- Step 1: Handover Confirmation -->
                  ${request.status === 'accepted' ? `
                    <p class="text-xs text-muted" style="margin-bottom: 12px;">
                      Met in person? Confirm that the item was physically handed over to start the borrowing timer.
                    </p>
                    <button id="mark-handover-btn" class="btn btn-primary btn-sm" style="width: 100%;">
                      Mark as Handed Over
                    </button>
                  ` : ''}

                  <!-- Step 2: Return Flow -->
                  ${request.status === 'handed_over' ? `
                    <div class="flex flex-col gap-2">
                      <p class="text-xs text-muted">
                        ${isBorrower ? 'Finished using the item? Return it to the lender and mark below.' : 'Waiting for borrower to return item.'}
                      </p>
                      ${isBorrower ? `
                        <button id="mark-returned-btn" class="btn btn-primary btn-sm">
                          I Have Returned This Item
                        </button>
                      ` : ''}
                      ${isLender ? `
                        <div class="flex gap-2" style="margin-top: 4px;">
                          <button id="confirm-good-btn" class="btn btn-success btn-sm flex-1">
                            Received in Good Condition
                          </button>
                          <button id="report-damage-btn" class="btn btn-danger btn-sm">
                            Report Damage
                          </button>
                        </div>
                      ` : ''}
                    </div>
                  ` : ''}

                  <!-- Step 3: Returned Inspection -->
                  ${request.status === 'returned' ? `
                    <div class="flex flex-col gap-2">
                      <p class="text-xs text-muted">
                        ${isLender ? 'Borrower has marked this item returned. Inspect the condition before closing.' : 'You marked this item returned. Awaiting owner inspection.'}
                      </p>
                      ${isLender ? `
                        <div class="flex gap-2">
                          <button id="confirm-good-btn" class="btn btn-success btn-sm flex-1">
                            Received in Good Condition (Complete)
                          </button>
                          <button id="report-damage-btn" class="btn btn-danger btn-sm">
                            Report Damage
                          </button>
                        </div>
                      ` : ''}
                    </div>
                  ` : ''}

                  ${request.status === 'completed' ? `
                    <p class="text-xs" style="color: var(--color-success); font-weight: bold;">
                      ✓ Transaction completed! Item returned in good condition.
                    </p>
                  ` : ''}
                </div>
              ` : ''}

              <!-- Cancel Action (for requester) -->
              ${['open', 'accepted'].includes(request.status) && isOwner ? `
                <div class="flex justify-end">
                  <button id="detail-cancel-btn" class="btn btn-secondary btn-sm" style="color: var(--color-danger);">
                    Cancel Request
                  </button>
                </div>
              ` : ''}
            </div>
          </div>

          <!-- Damage Report Card & Rebuttal Form -->
          ${damageReport ? `
            <div class="card" style="border-left: 4px solid var(--color-danger); border-top: 2px solid var(--color-danger); background: #fffbfb;">
              <div class="card-header" style="background: #fee2e2;">
                <h3 class="text-sm font-bold" style="color: #991b1b;">Damage / Missing Item Dispute</h3>
                <span class="badge badge-status-damage_reported">${escapeHTML(damageReport.status)}</span>
              </div>
              <div class="card-body flex flex-col gap-3">
                <div>
                  <h4 class="text-xs font-bold text-muted">Owner's Damage Report:</h4>
                  <p class="text-sm" style="margin-top: 2px;">${escapeHTML(damageReport.description)}</p>
                </div>

                ${damageReport.photos && damageReport.photos.length > 0 ? `
                  <div class="flex gap-2" style="flex-wrap: wrap;">
                    ${damageReport.photos.map(p => `
                      <img src="${escapeHTML(p)}" alt="Evidence" style="width: 80px; height: 80px; object-fit: cover; border-radius: 6px;">
                    `).join('')}
                  </div>
                ` : ''}

                <!-- Borrower Statement Section -->
                <div style="background: var(--bg-subtle); padding: 12px; border-radius: var(--radius-sm); margin-top: 4px;">
                  <h4 class="text-xs font-bold text-muted">Borrower's Response:</h4>
                  ${damageReport.borrowerResponse ? `
                    <div style="background: #ffffff; padding: 8px 12px; border-radius: 4px; border: 1px solid var(--border-subtle); margin-top: 4px;">
                      <p class="text-sm" style="margin: 0; color: var(--text-main);">${escapeHTML(damageReport.borrowerResponse)}</p>
                      ${damageReport.respondedAt ? `<span class="text-xs text-muted" style="margin-top: 4px; display: block;">Submitted: ${formatDateTime(damageReport.respondedAt)}</span>` : ''}
                    </div>
                  ` : (isBorrower || (user && damageReport.borrowerId === user.uid)) ? `
                    <form id="rebuttal-form" style="margin-top: 8px;">
                      <label class="form-label text-xs" for="rebuttal-text">Provide your statement / explanation for event organizers:</label>
                      <textarea id="rebuttal-text" class="form-textarea" rows="3" placeholder="Explain what occurred with the item and your perspective..." required style="width: 100%; box-sizing: border-box;"></textarea>
                      <button type="submit" class="btn btn-primary btn-sm" style="margin-top: 8px;">Submit Statement to Organizers</button>
                    </form>
                  ` : `
                    <p class="text-xs text-muted" style="font-style: italic; margin-top: 4px;">Awaiting borrower response statement...</p>
                  `}
                </div>

                <!-- Resolution Decision if Resolved -->
                ${damageReport.decision ? `
                  <div style="background: #f0fdf4; border: 1px solid #bbf7d0; padding: 10px; border-radius: var(--radius-sm);">
                    <h4 class="text-xs font-bold" style="color: #15803d;">Organizer Verdict: ${escapeHTML(damageReport.decision.action.toUpperCase())}</h4>
                    <p class="text-xs" style="margin-top: 2px;">${escapeHTML(damageReport.decision.note || 'No additional note.')}</p>
                    <span class="text-xs text-muted">Reviewed by: ${escapeHTML(damageReport.decision.reviewerName)} (${escapeHTML(damageReport.decision.reviewerRole)})</span>
                  </div>
                ` : `
                  <div class="text-xs text-muted" style="font-style: italic;">
                    Dispute is under review by event organizers and campus administration.
                  </div>
                `}
              </div>
            </div>
          ` : ''}

          <!-- Meeting Point Coordination Card -->
          ${isAcceptedOrBeyond ? `
            <div class="card" style="border-left: 4px solid #0284c7; border-top: 2px solid #0284c7; background: #f8fafc;">
              <div class="card-header" style="background: #e0f2fe;">
                <h3 class="text-sm font-bold" style="color: #0369a1;">Campus Meeting Point Coordination</h3>
                ${isParticipant ? `
                  <button id="propose-point-btn" class="btn btn-secondary btn-sm">
                    ${request.meetingPoint ? 'Change Meeting Point' : 'Suggest Meeting Point'}
                  </button>
                ` : ''}
              </div>
              <div class="card-body" id="meeting-point-container">
                ${request.meetingPoint ? `
                  <div class="flex justify-between items-start">
                    <div>
                      <h4 class="text-base font-bold">${escapeHTML(request.meetingPoint.label || 'Campus Location')}</h4>
                      <p class="text-xs text-muted">
                        Proposed by: <strong>${escapeHTML(request.meetingPoint.proposedByName || 'Peer')}</strong>
                        ${request.meetingPoint.time ? ` • Time: <strong>${escapeHTML(request.meetingPoint.time)}</strong>` : ''}
                      </p>
                      <span class="badge ${request.meetingPoint.confirmed ? 'badge-status-completed' : 'badge-status-accepted'}" style="margin-top: 6px;">
                        ${request.meetingPoint.confirmed ? 'Confirmed by both' : 'Awaiting Confirmation'}
                      </span>
                    </div>

                    ${!request.meetingPoint.confirmed && request.meetingPoint.proposedBy !== user.uid ? `
                      <button id="confirm-meeting-point-btn" class="btn btn-success btn-sm">
                        Confirm Point
                      </button>
                    ` : ''}
                  </div>
                ` : `
                  <div class="text-center text-xs text-muted" style="padding: var(--space-4) 0;">
                    No meeting point proposed yet. Tap <strong>Suggest Meeting Point</strong> to select a spot on the campus map.
                  </div>
                `}
              </div>
            </div>
          ` : ''}
        </div>

        <!-- Right Column: Real-Time Direct Chat -->
        <div class="flex flex-col gap-4">
          ${isAcceptedOrBeyond && isParticipant ? `
            <div id="chat-wrapper"></div>
          ` : `
            <div class="card" style="border-left: 4px solid #6366f1; background: #fafafa;">
              <div class="card-body text-center empty-state">
                <div style="width: 48px; height: 48px; margin: 0 auto 12px auto; border-radius: 50%; background: #e0e7ff; color: #4338ca; display: flex; align-items: center; justify-content: center;">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                </div>
                <h3 class="text-md font-bold">Real-Time Chat</h3>
                <p class="text-xs text-muted">
                  ${request.status === 'open' 
                    ? 'In-app real-time messaging will unlock as soon as a student accepts this request.'
                    : 'Chat is restricted to the requester and helper.'}
                </p>
              </div>
            </div>
          `}
        </div>
      </div>
    </div>
  `;

  // --- Handlers & Interactions ---

  const refreshPage = () => renderRequestDetailPage(container, { user, userData, params });

  // 1. Accept Request Handler
  const acceptBtn = container.querySelector('#detail-accept-btn');
  if (acceptBtn) {
    acceptBtn.addEventListener('click', async () => {
      acceptBtn.disabled = true;
      acceptBtn.textContent = 'Accepting...';
      try {
        await requestsService.acceptRequest(request.id, user);
        toast.success('You have accepted this request! Real-time chat is now open.');
        refreshPage();
      } catch (err) {
        toast.error(err.message);
        acceptBtn.disabled = false;
        acceptBtn.textContent = 'I have this item (Accept Request)';
      }
    });
  }

  // 2. Cancel Request Handler
  const cancelBtn = container.querySelector('#detail-cancel-btn');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', async () => {
      if (confirm('Are you sure you want to cancel this request?')) {
        try {
          await requestsService.cancelRequest(request.id, user.uid);
          toast.info('Request has been cancelled.');
          refreshPage();
        } catch (err) {
          toast.error(err.message);
        }
      }
    });
  }

  // 3. Mark Handed Over Modal
  const handoverBtn = container.querySelector('#mark-handover-btn');
  if (handoverBtn) {
    handoverBtn.addEventListener('click', () => {
      modal.open({
        title: 'Confirm Physical Handover',
        contentHTML: `
          <div class="form-group">
            <label class="form-label" for="handover-notes">Condition Notes (Optional)</label>
            <input type="text" id="handover-notes" class="form-input" placeholder="e.g. In working condition, includes 2 cables...">
          </div>
          <div class="form-group">
            <label class="form-label" for="handover-photo">Condition Photo (Optional)</label>
            <input type="file" id="handover-photo" class="form-input" accept="image/*">
            <span class="form-hint">Take a quick picture as proof of current item condition.</span>
          </div>
        `,
        confirmText: 'Confirm Handover',
        onConfirm: async () => {
          const notesInput = document.getElementById('handover-notes');
          const photoInput = document.getElementById('handover-photo');
          const notes = notesInput ? notesInput.value : '';
          const photoFile = photoInput?.files[0] || null;

          try {
            await requestsService.confirmHandover(request.id, user, photoFile, notes);
            toast.success('Item handover confirmed!');
            refreshPage();
          } catch (e) {
            toast.error(e.message);
            throw e;
          }
        }
      });
    });
  }

  // 4. Mark Returned Handler
  const returnedBtn = container.querySelector('#mark-returned-btn');
  if (returnedBtn) {
    returnedBtn.addEventListener('click', async () => {
      if (confirm('Confirm that you have returned this item to the owner?')) {
        try {
          await requestsService.markReturned(request.id, user);
          toast.success('Item marked as returned! Awaiting owner confirmation.');
          refreshPage();
        } catch (e) {
          toast.error(e.message);
        }
      }
    });
  }

  // 5. Confirm Good Condition Handler
  const confirmGoodBtn = container.querySelector('#confirm-good-btn');
  if (confirmGoodBtn) {
    confirmGoodBtn.addEventListener('click', async () => {
      if (confirm('Confirm receipt in good working condition? This completes the request.')) {
        try {
          await requestsService.confirmReceivedInGoodCondition(request.id, user);
          toast.success('Request marked as completed in good condition!');
          refreshPage();
        } catch (e) {
          toast.error(e.message);
        }
      }
    });
  }

  // 6. Report Damage Modal
  const reportDamageBtn = container.querySelector('#report-damage-btn');
  if (reportDamageBtn) {
    reportDamageBtn.addEventListener('click', () => {
      // The person who borrowed the item is the requester (or helper if type was offer)
      const borrowerUid = request.type === 'offer' ? request.helperId : request.requesterId;

      modal.open({
        title: 'Report Damage / Missing Item',
        contentHTML: `
          <div class="form-group">
            <label class="form-label" for="damage-desc">Description of Damage / Issue <span class="required">*</span></label>
            <textarea id="damage-desc" class="form-textarea" rows="3" placeholder="Describe the damage, scratches, broken parts, or missing components..." required></textarea>
          </div>
          <div class="form-group">
            <label class="form-label" for="damage-photos">Upload Photos of Damage (Optional)</label>
            <input type="file" id="damage-photos" class="form-input" accept="image/*" multiple>
            <span class="form-hint">Event organizers will review these photos against the event rules.</span>
          </div>
        `,
        confirmText: 'Submit Damage Report',
        onConfirm: async () => {
          const descInput = document.getElementById('damage-desc');
          const photoInput = document.getElementById('damage-photos');
          const desc = descInput ? descInput.value.trim() : '';
          const files = photoInput?.files ? Array.from(photoInput.files) : [];

          if (!desc) {
            toast.error('Please describe the damage.');
            throw new Error('Description required');
          }

          try {
            await reportsService.createDamageReport({
              requestId: request.id,
              eventId: request.eventId,
              ownerUser: user,
              borrowerId: borrowerUid,
              description: desc,
              photoFiles: files
            });
            toast.warning('Damage report filed. The borrower and organizers have been notified.');
            refreshPage();
          } catch (e) {
            toast.error(e.message);
            throw e;
          }
        }
      });
    });
  }

  // 7. Rebuttal Form Handler
  const rebuttalForm = container.querySelector('#rebuttal-form');
  if (rebuttalForm && damageReport) {
    rebuttalForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const text = container.querySelector('#rebuttal-text').value.trim();
      if (!text) return;

      try {
        await reportsService.submitBorrowerResponse(damageReport.id, user, text);
        toast.success('Your response was submitted to event organizers.');
        refreshPage();
      } catch (err) {
        toast.error(err.message);
      }
    });
  }

  // 8. Meeting Point Propose & Confirm
  const proposePointBtn = container.querySelector('#propose-point-btn');
  if (proposePointBtn) {
    proposePointBtn.addEventListener('click', () => {
      const picker = new MapPickerModal();
      picker.open({
        currentMeetingPoint: request.meetingPoint,
        onSelect: async (point) => {
          try {
            await requestsService.proposeMeetingPoint(request.id, point, user);
            toast.success('Meeting point proposed!');
            refreshPage();
          } catch (err) {
            toast.error(err.message);
          }
        }
      });
    });
  }

  const confirmPointBtn = container.querySelector('#confirm-meeting-point-btn');
  if (confirmPointBtn) {
    confirmPointBtn.addEventListener('click', async () => {
      try {
        await requestsService.confirmMeetingPoint(request.id, user);
        toast.success('Meeting point confirmed by both parties!');
        refreshPage();
      } catch (err) {
        toast.error(err.message);
      }
    });
  }

  // 9. Mount Real-Time Chat
  if (isAcceptedOrBeyond && isParticipant) {
    const chatWrapper = container.querySelector('#chat-wrapper');
    const chatBox = createChatBox({
      request,
      currentUser: user,
      otherUserName: partnerName,
      onLocationClick: () => {
        if (proposePointBtn) proposePointBtn.click();
      }
    });

    chatWrapper.appendChild(chatBox);
  }
}
