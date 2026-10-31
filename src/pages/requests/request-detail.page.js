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

  // Authentication objects
  const handoverAuth = request.handoverAuth || {
    code: '----',
    requesterConfirmed: false,
    helperConfirmed: false,
    confirmedAt: null
  };
  const returnAuth = request.returnAuth || {
    code: '----',
    requesterConfirmed: false,
    helperConfirmed: false,
    confirmedAt: null
  };
  const completionAuth = request.completionAuth || {
    requesterConfirmed: false,
    helperConfirmed: false,
    confirmedAt: null
  };

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

              <!-- Dual-Sided Handover & Return Action Center -->
              ${isAcceptedOrBeyond && isParticipant ? `
                <div style="background: var(--bg-subtle); padding: var(--space-4); border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
                  <div class="flex justify-between items-center mb-3">
                    <h4 class="text-sm font-bold" style="margin: 0;">Dual-Sided Action Center</h4>
                    <span class="badge" style="background: #e2e8f0; color: #334155; font-size: 11px; text-transform: uppercase;">
                      Stage: ${escapeHTML(request.status.replace('_', ' '))}
                    </span>
                  </div>

                  <!-- ============================================== -->
                  <!-- STAGE 1: ACCEPTED -> HANDOVER (Mutual Verification) -->
                  <!-- ============================================== -->
                  ${request.status === 'accepted' ? `
                    <div class="flex flex-col gap-3">
                      <!-- Coordination Window & Inactivity Timer Banner -->
                      <div class="flex justify-between items-center flex-wrap gap-2" style="background: #fffbeb; border: 1px solid #fde68a; padding: 8px 12px; border-radius: var(--radius-sm);">
                        <div class="flex items-center gap-2">
                          <span style="font-size: 16px;">⏱️</span>
                          <span class="text-xs font-semibold" style="color: #92400e;">
                            Handover Coordination Window:
                          </span>
                        </div>
                        <span id="handover-timer-badge" class="badge" style="background: #fef3c7; color: #b45309; font-weight: 700; font-family: var(--font-mono);">
                          ${(() => {
                            if (!request.handoverDeadline) return '30m active';
                            const diffMs = new Date(request.handoverDeadline) - new Date();
                            if (diffMs <= 0) return 'Expired (Reopen available)';
                            const mins = Math.floor(diffMs / 60000);
                            const secs = Math.floor((diffMs % 60000) / 1000);
                            return `${mins}m ${secs}s remaining`;
                          })()}
                        </span>
                      </div>

                      <!-- Two-Sided Status Pills -->
                      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                        <div style="background: #ffffff; padding: 8px; border-radius: var(--radius-sm); border: 1px solid ${handoverAuth.helperConfirmed ? '#86efac' : '#cbd5e1'};">
                          <div class="text-xs text-muted">Lender Handover:</div>
                          <div class="text-xs font-bold" style="color: ${handoverAuth.helperConfirmed ? '#16a34a' : '#d97706'};">
                            ${handoverAuth.helperConfirmed ? '✓ Confirmed by Lender' : '⏳ Pending Confirmation'}
                          </div>
                        </div>
                        <div style="background: #ffffff; padding: 8px; border-radius: var(--radius-sm); border: 1px solid ${handoverAuth.requesterConfirmed ? '#86efac' : '#cbd5e1'};">
                          <div class="text-xs text-muted">Borrower Receipt:</div>
                          <div class="text-xs font-bold" style="color: ${handoverAuth.requesterConfirmed ? '#16a34a' : '#d97706'};">
                            ${handoverAuth.requesterConfirmed ? '✓ Confirmed by Borrower' : '⏳ Pending Confirmation'}
                          </div>
                        </div>
                      </div>

                      <!-- Borrower's View: Holds Handover PIN & Confirmation -->
                      ${isBorrower ? `
                        <div style="background: #eff6ff; border: 1.5px dashed #3b82f6; border-radius: var(--radius-md); padding: 12px;">
                          <div class="flex justify-between items-center flex-wrap gap-2">
                            <div>
                              <div class="text-xs font-bold" style="color: #1e40af;">YOUR HANDOVER AUTHENTICATION PIN</div>
                              <div style="font-size: 26px; font-weight: 800; letter-spacing: 5px; color: #1d4ed8; font-family: var(--font-mono); margin: 2px 0;">
                                ${escapeHTML(handoverAuth.code || '----')}
                              </div>
                              <div class="text-xs text-muted">
                                Show this PIN to <strong>${escapeHTML(partnerName)}</strong> when you meet in person to take possession.
                              </div>
                            </div>
                            <div>
                              ${handoverAuth.requesterConfirmed ? `
                                <span class="badge" style="background: #dcfce7; color: #15803d; font-weight: 700; padding: 6px 10px;">
                                  ✓ You Confirmed Receipt
                                </span>
                              ` : `
                                <button id="borrower-confirm-handover-btn" class="btn btn-primary btn-sm">
                                  ✓ I Received Equipment
                                </button>
                              `}
                            </div>
                          </div>
                        </div>
                      ` : ''}

                      <!-- Lender's View: Enters Borrower's PIN or Confirms Handover -->
                      ${isLender ? `
                        <div style="background: #eff6ff; border: 1.5px dashed #3b82f6; border-radius: var(--radius-md); padding: 12px;">
                          <div class="text-xs font-bold" style="color: #1e40af; margin-bottom: 6px;">
                            ENTER BORROWER'S 4-DIGIT HANDOVER PIN
                          </div>
                          <div class="flex gap-2 items-center flex-wrap">
                            <input type="text" id="handover-pin-input" class="form-input font-mono" maxlength="4" placeholder="PIN" style="width: 100px; text-align: center; font-size: 18px; font-weight: bold; letter-spacing: 3px;">
                            <button id="verify-handover-pin-btn" class="btn btn-primary btn-sm">
                              Verify PIN & Complete Handover
                            </button>
                            <span class="text-xs text-muted">or</span>
                            ${handoverAuth.helperConfirmed ? `
                              <span class="badge" style="background: #dcfce7; color: #15803d; font-weight: 700; padding: 6px 10px;">
                                ✓ You Confirmed Handover
                              </span>
                            ` : `
                              <button id="lender-confirm-handover-btn" class="btn btn-secondary btn-sm">
                                Confirm Physical Handover
                              </button>
                            `}
                          </div>
                          <div class="text-xs text-muted" style="margin-top: 6px;">
                            Ask <strong>${escapeHTML(partnerName)}</strong> for their 4-digit Handover PIN upon in-person exchange to verify both sides.
                          </div>
                        </div>
                      ` : ''}

                      <!-- Safety Controls: Stop Helping & Reopen if Inactive -->
                      <div class="flex justify-between items-center flex-wrap gap-2" style="margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--border-subtle);">
                        ${isHelper ? `
                          <div class="text-xs text-muted">Cannot provide this item anymore?</div>
                          <button id="stop-helping-btn" class="btn btn-outline btn-xs" style="color: #dc2626; border-color: #fca5a5; font-weight: 700;">
                            🛑 Stop Helping (Reopen Request)
                          </button>
                        ` : ''}
                        ${isOwner ? `
                          <div class="text-xs text-muted">Helper unresponsive or cannot meet?</div>
                          <button id="reopen-inactive-btn" class="btn btn-outline btn-xs" style="color: #d97706; border-color: #fde68a; font-weight: 700;">
                            ⚠️ Helper Inactive? Reopen Request
                          </button>
                        ` : ''}
                      </div>
                    </div>
                  ` : ''}

                  <!-- ============================================== -->
                  <!-- STAGE 2: HANDED_OVER -> RETURN (Mutual Verification) -->
                  <!-- ============================================== -->
                  ${request.status === 'handed_over' ? `
                    <div class="flex flex-col gap-3">
                      <!-- Two-Sided Status Pills -->
                      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                        <div style="background: #ffffff; padding: 8px; border-radius: var(--radius-sm); border: 1px solid ${returnAuth.requesterConfirmed ? '#86efac' : '#cbd5e1'};">
                          <div class="text-xs text-muted">Borrower Return:</div>
                          <div class="text-xs font-bold" style="color: ${returnAuth.requesterConfirmed ? '#16a34a' : '#d97706'};">
                            ${returnAuth.requesterConfirmed ? '✓ Marked Returned by Borrower' : '⏳ In Borrower Custody'}
                          </div>
                        </div>
                        <div style="background: #ffffff; padding: 8px; border-radius: var(--radius-sm); border: 1px solid ${returnAuth.helperConfirmed ? '#86efac' : '#cbd5e1'};">
                          <div class="text-xs text-muted">Lender Verification:</div>
                          <div class="text-xs font-bold" style="color: ${returnAuth.helperConfirmed ? '#16a34a' : '#d97706'};">
                            ${returnAuth.helperConfirmed ? '✓ Physical Return Verified' : '⏳ Awaiting Physical Return'}
                          </div>
                        </div>
                      </div>

                      <!-- Lender's View: Holds Return PIN & Receives Return -->
                      ${isLender ? `
                        <div style="background: #f5f3ff; border: 1.5px dashed #8b5cf6; border-radius: var(--radius-md); padding: 12px;">
                          <div class="flex justify-between items-center flex-wrap gap-2">
                            <div>
                              <div class="text-xs font-bold" style="color: #6b21a8;">YOUR RETURN VERIFICATION PIN</div>
                              <div style="font-size: 26px; font-weight: 800; letter-spacing: 5px; color: #7c3aed; font-family: var(--font-mono); margin: 2px 0;">
                                ${escapeHTML(returnAuth.code || '----')}
                              </div>
                              <div class="text-xs text-muted">
                                Give this PIN to <strong>${escapeHTML(partnerName)}</strong> once you physically receive your equipment back.
                              </div>
                            </div>
                            <div class="flex gap-2 items-center">
                              ${returnAuth.helperConfirmed ? `
                                <span class="badge" style="background: #dcfce7; color: #15803d; font-weight: 700; padding: 6px 10px;">
                                  ✓ You Confirmed Receipt Back
                                </span>
                              ` : `
                                <button id="lender-confirm-return-btn" class="btn btn-primary btn-sm">
                                  ✓ I Received Item Back
                                </button>
                              `}
                              <button id="report-damage-btn" class="btn btn-danger btn-sm">
                                Report Damage
                              </button>
                            </div>
                          </div>
                        </div>
                      ` : ''}

                      <!-- Borrower's View: Enters Lender's Return PIN or Marks Returned -->
                      ${isBorrower ? `
                        <div style="background: #f5f3ff; border: 1.5px dashed #8b5cf6; border-radius: var(--radius-md); padding: 12px;">
                          <div class="text-xs font-bold" style="color: #6b21a8; margin-bottom: 6px;">
                            ENTER LENDER'S 4-DIGIT RETURN PIN
                          </div>
                          <div class="flex gap-2 items-center flex-wrap">
                            <input type="text" id="return-pin-input" class="form-input font-mono" maxlength="4" placeholder="PIN" style="width: 100px; text-align: center; font-size: 18px; font-weight: bold; letter-spacing: 3px;">
                            <button id="verify-return-pin-btn" class="btn btn-primary btn-sm">
                              Verify PIN & Complete Return
                            </button>
                            <span class="text-xs text-muted">or</span>
                            ${returnAuth.requesterConfirmed ? `
                              <span class="badge" style="background: #dcfce7; color: #15803d; font-weight: 700; padding: 6px 10px;">
                                ✓ You Marked Returned
                              </span>
                            ` : `
                              <button id="borrower-mark-returned-btn" class="btn btn-secondary btn-sm">
                                I Have Returned This Item
                              </button>
                            `}
                          </div>
                          <div class="text-xs text-muted" style="margin-top: 6px;">
                            Ask <strong>${escapeHTML(partnerName)}</strong> for their 4-digit Return PIN once you hand the equipment back.
                          </div>
                        </div>
                      ` : ''}
                    </div>
                  ` : ''}

                  <!-- ============================================== -->
                  <!-- STAGE 3: RETURNED -> COMPLETED (Two-Sided Sign-Off) -->
                  <!-- ============================================== -->
                  ${request.status === 'returned' ? `
                    <div class="flex flex-col gap-3">
                      <div class="text-xs text-muted">
                        Equipment is physically returned. Both parties must sign off to complete the transaction.
                      </div>

                      <!-- Two-Sided Status Pills -->
                      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                        <div style="background: #ffffff; padding: 8px; border-radius: var(--radius-sm); border: 1px solid ${completionAuth.helperConfirmed ? '#86efac' : '#cbd5e1'};">
                          <div class="text-xs text-muted">Lender Condition Check:</div>
                          <div class="text-xs font-bold" style="color: ${completionAuth.helperConfirmed ? '#16a34a' : '#d97706'};">
                            ${completionAuth.helperConfirmed ? '✓ Good Condition Confirmed' : '⏳ Awaiting Inspection'}
                          </div>
                        </div>
                        <div style="background: #ffffff; padding: 8px; border-radius: var(--radius-sm); border: 1px solid ${completionAuth.requesterConfirmed ? '#86efac' : '#cbd5e1'};">
                          <div class="text-xs text-muted">Borrower Sign-Off:</div>
                          <div class="text-xs font-bold" style="color: ${completionAuth.requesterConfirmed ? '#16a34a' : '#d97706'};">
                            ${completionAuth.requesterConfirmed ? '✓ Closure Confirmed' : '⏳ Awaiting Sign-Off'}
                          </div>
                        </div>
                      </div>

                      <div class="flex gap-2 flex-wrap items-center">
                        ${isLender ? `
                          ${completionAuth.helperConfirmed ? `
                            <span class="badge" style="background: #dcfce7; color: #15803d; font-weight: 700; padding: 6px 12px;">
                              ✓ You Confirmed Good Condition
                            </span>
                          ` : `
                            <button id="lender-confirm-completion-btn" class="btn btn-success btn-sm">
                              ✓ Received in Good Condition (Sign-Off)
                            </button>
                            <button id="report-damage-btn" class="btn btn-danger btn-sm">
                              Report Damage
                            </button>
                          `}
                        ` : ''}

                        ${isBorrower ? `
                          ${completionAuth.requesterConfirmed ? `
                            <span class="badge" style="background: #dcfce7; color: #15803d; font-weight: 700; padding: 6px 12px;">
                              ✓ You Confirmed Return Closure
                            </span>
                          ` : `
                            <button id="borrower-confirm-completion-btn" class="btn btn-primary btn-sm">
                              ✓ Confirm Transaction Closure (Sign-Off)
                            </button>
                          `}
                        ` : ''}
                      </div>
                    </div>
                  ` : ''}

                  <!-- ============================================== -->
                  <!-- STAGE 4: COMPLETED -->
                  <!-- ============================================== -->
                  ${request.status === 'completed' ? `
                    <div style="background: #ecfdf5; border: 1px solid #a7f3d0; padding: 12px; border-radius: var(--radius-sm); color: #047857;">
                      <div style="font-weight: 700; font-size: 0.95rem;">✓ Transaction Fully Verified & Completed!</div>
                      <div class="text-xs" style="margin-top: 4px;">
                        Both lender and borrower authenticated each stage of this equipment exchange.
                      </div>
                    </div>
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
        toast.success('You have accepted this request! Real-time chat & handover coordination are now open.');
        refreshPage();
      } catch (err) {
        toast.error(err.message);
        acceptBtn.disabled = false;
        acceptBtn.textContent = 'I have this item (Accept Request)';
      }
    });
  }

  // 2. Stop Helping Handler (Helper voluntarily steps down)
  const stopHelpingBtn = container.querySelector('#stop-helping-btn');
  if (stopHelpingBtn) {
    stopHelpingBtn.addEventListener('click', async () => {
      const confirmed = confirm('Are you sure you want to stop helping with this request?\n\nThe request will immediately return to OPEN so another student can help.');
      if (!confirmed) return;

      stopHelpingBtn.disabled = true;
      stopHelpingBtn.textContent = 'Reopening...';
      try {
        await requestsService.withdrawHelp(request.id, user);
        toast.info('You have stepped down. The request is now open for other students.');
        refreshPage();
      } catch (err) {
        toast.error(err.message);
        stopHelpingBtn.disabled = false;
        stopHelpingBtn.textContent = '🛑 Stop Helping (Reopen Request)';
      }
    });
  }

  // 3. Reopen Inactive Request Handler (Requester releases unresponsive helper)
  const reopenInactiveBtn = container.querySelector('#reopen-inactive-btn');
  if (reopenInactiveBtn) {
    reopenInactiveBtn.addEventListener('click', async () => {
      const confirmed = confirm('Has the helper been unresponsive or unable to meet?\n\nThis will release the helper and reopen your request for other campus members.');
      if (!confirmed) return;

      reopenInactiveBtn.disabled = true;
      reopenInactiveBtn.textContent = 'Reopening...';
      try {
        await requestsService.reopenUnresponsiveRequest(request.id, user);
        toast.info('Request has been reopened. Other campus members can now accept it.');
        refreshPage();
      } catch (err) {
        toast.error(err.message);
        reopenInactiveBtn.disabled = false;
        reopenInactiveBtn.textContent = '⚠️ Helper Inactive? Reopen Request';
      }
    });
  }

  // 4. Cancel Request Handler (Requester cancels whole post)
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

  // 5. Handover Authentication Handlers
  const borrowerConfirmHandoverBtn = container.querySelector('#borrower-confirm-handover-btn');
  if (borrowerConfirmHandoverBtn) {
    borrowerConfirmHandoverBtn.addEventListener('click', async () => {
      borrowerConfirmHandoverBtn.disabled = true;
      borrowerConfirmHandoverBtn.textContent = 'Confirming...';
      try {
        const res = await requestsService.authenticateHandover(request.id, user);
        if (res.bothConfirmed) {
          toast.success('Handover fully verified by both parties!');
        } else {
          toast.info('You confirmed receipt! Awaiting lender confirmation to start borrowing period.');
        }
        refreshPage();
      } catch (err) {
        toast.error(err.message);
        borrowerConfirmHandoverBtn.disabled = false;
        borrowerConfirmHandoverBtn.textContent = '✓ I Received Equipment';
      }
    });
  }

  const lenderConfirmHandoverBtn = container.querySelector('#lender-confirm-handover-btn');
  if (lenderConfirmHandoverBtn) {
    lenderConfirmHandoverBtn.addEventListener('click', async () => {
      lenderConfirmHandoverBtn.disabled = true;
      lenderConfirmHandoverBtn.textContent = 'Confirming...';
      try {
        const res = await requestsService.authenticateHandover(request.id, user);
        if (res.bothConfirmed) {
          toast.success('Handover fully verified by both parties!');
        } else {
          toast.info('You confirmed handover! Awaiting borrower receipt confirmation.');
        }
        refreshPage();
      } catch (err) {
        toast.error(err.message);
        lenderConfirmHandoverBtn.disabled = false;
        lenderConfirmHandoverBtn.textContent = 'Confirm Physical Handover';
      }
    });
  }

  const verifyHandoverPinBtn = container.querySelector('#verify-handover-pin-btn');
  if (verifyHandoverPinBtn) {
    verifyHandoverPinBtn.addEventListener('click', async () => {
      const pinInput = container.querySelector('#handover-pin-input');
      const pin = pinInput ? pinInput.value.trim() : '';
      if (!pin || pin.length < 4) {
        toast.error('Please enter the 4-digit Handover PIN from the borrower.');
        return;
      }

      verifyHandoverPinBtn.disabled = true;
      verifyHandoverPinBtn.textContent = 'Verifying...';
      try {
        const res = await requestsService.authenticateHandover(request.id, user, { pin });
        toast.success('PIN verified! Item handover authenticated by both parties.');
        refreshPage();
      } catch (err) {
        toast.error(err.message);
        verifyHandoverPinBtn.disabled = false;
        verifyHandoverPinBtn.textContent = 'Verify PIN & Complete Handover';
      }
    });
  }

  // 6. Return Authentication Handlers
  const borrowerMarkReturnedBtn = container.querySelector('#borrower-mark-returned-btn');
  if (borrowerMarkReturnedBtn) {
    borrowerMarkReturnedBtn.addEventListener('click', async () => {
      borrowerMarkReturnedBtn.disabled = true;
      borrowerMarkReturnedBtn.textContent = 'Marking...';
      try {
        const res = await requestsService.authenticateReturn(request.id, user);
        if (res.bothConfirmed) {
          toast.success('Return fully verified by both parties!');
        } else {
          toast.info('You marked item returned! Awaiting lender to verify physical receipt.');
        }
        refreshPage();
      } catch (err) {
        toast.error(err.message);
        borrowerMarkReturnedBtn.disabled = false;
        borrowerMarkReturnedBtn.textContent = 'I Have Returned This Item';
      }
    });
  }

  const lenderConfirmReturnBtn = container.querySelector('#lender-confirm-return-btn');
  if (lenderConfirmReturnBtn) {
    lenderConfirmReturnBtn.addEventListener('click', async () => {
      lenderConfirmReturnBtn.disabled = true;
      lenderConfirmReturnBtn.textContent = 'Confirming...';
      try {
        const res = await requestsService.authenticateReturn(request.id, user);
        if (res.bothConfirmed) {
          toast.success('Return fully verified by both parties!');
        } else {
          toast.info('You confirmed return receipt! Awaiting borrower confirmation.');
        }
        refreshPage();
      } catch (err) {
        toast.error(err.message);
        lenderConfirmReturnBtn.disabled = false;
        lenderConfirmReturnBtn.textContent = '✓ I Received Item Back';
      }
    });
  }

  const verifyReturnPinBtn = container.querySelector('#verify-return-pin-btn');
  if (verifyReturnPinBtn) {
    verifyReturnPinBtn.addEventListener('click', async () => {
      const pinInput = container.querySelector('#return-pin-input');
      const pin = pinInput ? pinInput.value.trim() : '';
      if (!pin || pin.length < 4) {
        toast.error('Please enter the 4-digit Return PIN from the lender.');
        return;
      }

      verifyReturnPinBtn.disabled = true;
      verifyReturnPinBtn.textContent = 'Verifying...';
      try {
        const res = await requestsService.authenticateReturn(request.id, user, { pin });
        toast.success('PIN verified! Equipment return authenticated by both parties.');
        refreshPage();
      } catch (err) {
        toast.error(err.message);
        verifyReturnPinBtn.disabled = false;
        verifyReturnPinBtn.textContent = 'Verify PIN & Complete Return';
      }
    });
  }

  // 7. Completion Sign-Off Handlers
  const lenderConfirmCompletionBtn = container.querySelector('#lender-confirm-completion-btn');
  if (lenderConfirmCompletionBtn) {
    lenderConfirmCompletionBtn.addEventListener('click', async () => {
      lenderConfirmCompletionBtn.disabled = true;
      lenderConfirmCompletionBtn.textContent = 'Confirming...';
      try {
        const res = await requestsService.authenticateCompletion(request.id, user);
        if (res.bothConfirmed) {
          toast.success('Transaction fully completed and closed!');
        } else {
          toast.info('You confirmed good condition! Awaiting borrower sign-off to finalize.');
        }
        refreshPage();
      } catch (err) {
        toast.error(err.message);
        lenderConfirmCompletionBtn.disabled = false;
        lenderConfirmCompletionBtn.textContent = '✓ Received in Good Condition (Sign-Off)';
      }
    });
  }

  const borrowerConfirmCompletionBtn = container.querySelector('#borrower-confirm-completion-btn');
  if (borrowerConfirmCompletionBtn) {
    borrowerConfirmCompletionBtn.addEventListener('click', async () => {
      borrowerConfirmCompletionBtn.disabled = true;
      borrowerConfirmCompletionBtn.textContent = 'Confirming...';
      try {
        const res = await requestsService.authenticateCompletion(request.id, user);
        if (res.bothConfirmed) {
          toast.success('Transaction fully completed and closed!');
        } else {
          toast.info('You confirmed transaction closure! Awaiting lender inspection sign-off.');
        }
        refreshPage();
      } catch (err) {
        toast.error(err.message);
        borrowerConfirmCompletionBtn.disabled = false;
        borrowerConfirmCompletionBtn.textContent = '✓ Confirm Transaction Closure (Sign-Off)';
      }
    });
  }

  // 8. Report Damage Modal
  const reportDamageBtn = container.querySelector('#report-damage-btn');
  if (reportDamageBtn) {
    reportDamageBtn.addEventListener('click', () => {
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

  // 9. Rebuttal Form Handler
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

  // 10. Meeting Point Propose & Confirm
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

  // 11. Mount Real-Time Chat
  if (isAcceptedOrBeyond && isParticipant) {
    const chatWrapper = container.querySelector('#chat-wrapper');
    if (chatWrapper) {
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

  // 12. Active Countdown Timer for Handover Coordination Window
  const timerBadge = container.querySelector('#handover-timer-badge');
  if (timerBadge && request.status === 'accepted' && request.handoverDeadline) {
    const timerInterval = setInterval(() => {
      if (!document.body.contains(timerBadge)) {
        clearInterval(timerInterval);
        return;
      }
      const diffMs = new Date(request.handoverDeadline) - new Date();
      if (diffMs <= 0) {
        timerBadge.textContent = 'Expired (Reopen available)';
        timerBadge.style.background = '#fee2e2';
        timerBadge.style.color = '#dc2626';
        clearInterval(timerInterval);
      } else {
        const mins = Math.floor(diffMs / 60000);
        const secs = Math.floor((diffMs % 60000) / 1000);
        timerBadge.textContent = `${mins}m ${secs}s remaining`;
      }
    }, 1000);
  }
}
