import { escapeHTML } from '../utils/sanitize.js';
import { renderStatusBadge, renderUrgencyBadge } from './status-badge.js';
import { formatRelativeTime } from '../utils/dates.js';

export function renderRequestCard(request, currentUser, onAccept) {
  const isOwner = currentUser && request.requesterId === currentUser.uid;
  const isOpen = request.status === 'open';
  const isHelper = currentUser && request.helperId === currentUser.uid;

  const card = document.createElement('div');
  card.className = 'card';
  card.id = `request-${escapeHTML(request.id)}`;

  const borderLeft = request.urgency === 'high' && isOpen 
    ? '4px solid var(--color-danger)' 
    : isOpen 
    ? '4px solid var(--color-primary)' 
    : request.status === 'accepted' 
    ? '4px solid var(--color-warning)' 
    : request.status === 'completed' 
    ? '4px solid var(--color-success)' 
    : '4px solid var(--border-subtle)';
  card.style.borderLeft = borderLeft;
  card.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.05)';
  card.style.transition = 'transform 0.15s ease, box-shadow 0.15s ease';

  card.style.display = 'flex';
  card.style.flexDirection = 'column';
  card.style.justifyContent = 'space-between';

  card.innerHTML = `
    <div class="card-body flex flex-col gap-3" style="flex: 1;">
      <div class="flex justify-between items-start gap-2">
        <div style="flex: 1;">
          <h3 class="text-base font-bold text-main" style="line-height: 1.3; margin-bottom: 2px;">
            <a href="#/requests/${escapeHTML(request.id)}" style="color: inherit; text-decoration: none;">
              ${escapeHTML(request.itemName)}
            </a>
          </h3>
          <span class="text-xs text-muted">Category: <strong>${escapeHTML(request.category)}</strong></span>
        </div>
        <div class="flex flex-col items-end gap-1" style="flex-shrink: 0;">
          ${renderUrgencyBadge(request.urgency)}
          ${renderStatusBadge(request.status)}
        </div>
      </div>

      <p class="text-sm text-muted" style="display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; margin: 0;">
        ${escapeHTML(request.description)}
      </p>

      ${request.photoURL ? `
        <div style="height: 120px; border-radius: var(--radius-md); overflow: hidden; background: var(--bg-subtle);">
          <img src="${escapeHTML(request.photoURL)}" alt="${escapeHTML(request.itemName)}" style="width: 100%; height: 100%; object-fit: cover;">
        </div>
      ` : ''}

      <div class="flex justify-between items-center text-xs text-muted" style="padding-top: var(--space-2); border-top: 1px solid var(--border-subtle); margin-top: auto;">
        <span>By: <strong>${escapeHTML(request.requesterName || 'Student')}</strong></span>
        <span>Needed: <strong>${escapeHTML(formatRelativeTime(request.neededBy))}</strong></span>
      </div>
    </div>

    <div class="card-footer flex justify-between items-center">
      <a href="#/requests/${escapeHTML(request.id)}" class="btn btn-secondary btn-sm">
        View Details
      </a>

      ${isOpen && !isOwner && currentUser ? `
        <button class="btn btn-primary btn-sm accept-btn" data-id="${escapeHTML(request.id)}">
          I have this
        </button>
      ` : ''}

      ${isOpen && isOwner ? `
        <span class="text-xs text-muted">Awaiting helper...</span>
      ` : ''}

      ${request.status === 'accepted' ? `
        <span class="text-xs" style="color: var(--color-warning); font-weight: 500;">
          ${isOwner ? `Accepted by ${escapeHTML(request.helperName || 'Helper')}` : isHelper ? 'You are helping!' : 'In progress'}
        </span>
      ` : ''}
    </div>
  `;

  const acceptBtn = card.querySelector('.accept-btn');
  if (acceptBtn && onAccept) {
    acceptBtn.addEventListener('click', () => {
      onAccept(request);
    });
  }

  return card;
}
