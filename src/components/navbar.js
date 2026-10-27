import { escapeHTML } from '../utils/sanitize.js';
import { isUserOrganizer, isUserAdmin } from '../utils/guards.js';

export function renderNavbar(currentUser, userData, unreadNotificationsCount = 0) {
  const root = document.getElementById('navbar-root');
  if (!root) return;

  const currentHash = window.location.hash || '#/';

  if (!currentUser) {
    root.innerHTML = `
      <nav class="navbar" aria-label="Main Navigation">
        <div class="nav-container" style="width: 100%; max-width: 100%; padding: 0 var(--space-6); display: flex; align-items: center; justify-content: space-between; position: relative; box-sizing: border-box;">
          
          <!-- LEFT CORNER: Official College / University Main DYP Logo & Name (Compact & Small) -->
          <div class="nav-left-wrapper" style="display: flex; align-items: center;">
            <a href="#/" class="dyp-main-logo" title="D. Y. Patil College Group" style="display: inline-flex; align-items: center; gap: 0.5rem; text-decoration: none; padding: 0.2rem 0.6rem; border-radius: var(--radius-sm); border: 1px solid #d97706; background: #ffffff;">
              <div class="dyp-emblem" style="display: flex; align-items: center; justify-content: center;">
                <img src="https://imgs.search.brave.com/0w9ZP2VmCKtLaOLuLj0w34FkssYgIh9l-gWKkhqaSBk/rs:fit:500:0:1:0/g:ce/aHR0cHM6Ly9jZG4u/YnJhbmRmZXRjaC5p/by9pZDlMWndKSFFB/L3cvNDAwL2gvNDAw/L3RoZW1lL2Rhcmsv/aWNvbi5qcGVnP2M9/MWJ4aWQ2NE11cDdh/Y3pld1NBWU1YJnQ9/MTc4MTg2NTUxMjI3/NQ" alt="DY Patil Logo" style="height: 28px; width: 28px; border-radius: 4px; object-fit: contain; display: block;">
              </div>
              <div class="dyp-logo-details" style="display: flex; flex-direction: column; justify-content: center; line-height: 1.1;">
                <span class="dyp-brand-title" style="font-size: 0.85rem; font-weight: 800; letter-spacing: 0.06em; color: #0f2952; white-space: nowrap;">D Y PATIL</span>
                <span class="dyp-brand-sub" style="font-size: 0.52rem; font-weight: 700; color: #d97706; letter-spacing: 0.12em; text-transform: uppercase; white-space: nowrap;">COLLEGE GROUP</span>
              </div>
            </a>
          </div>

          <!-- CENTER: Website Logo & Name (Prominent & Big) -->
          <div class="nav-center-wrapper" style="position: absolute; left: 50%; transform: translateX(-50%); display: flex; align-items: center; pointer-events: auto;">
            <a href="#/" class="nav-brand" style="display: flex; align-items: center; gap: 0.75rem; color: var(--color-primary); text-decoration: none;">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor" style="filter: drop-shadow(0 2px 4px rgba(37, 99, 235, 0.25));">
                <path d="M20 7h-4V4c0-1.1-.9-2-2-2h-4c-1.1 0-2 .9-2 2v3H4c-1.1 0-2 .9-2 2v11c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2zm-6-3v3h-4V4h4zm6 16H4V9h16v11z"/>
              </svg>
              <span style="font-size: 1.75rem; font-weight: 900; letter-spacing: -0.03em; background: linear-gradient(135deg, var(--color-primary) 0%, #1d4ed8 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">ShareBox</span>
            </a>
          </div>

          <!-- RIGHT CORNER: Actions -->
          <div class="nav-links" style="display: flex; align-items: center; gap: var(--space-3);">
            <a href="#/login" class="nav-link ${currentHash === '#/login' ? 'active' : ''}">Sign In</a>
            <a href="#/signup" class="btn btn-primary btn-sm">Get Started</a>
          </div>
        </div>
      </nav>
    `;
    return;
  }

  const isOrg = isUserOrganizer(userData);
  const isAdmin = isUserAdmin(userData);
  const userInitial = (userData?.name || currentUser.email || 'U')[0].toUpperCase();

  root.innerHTML = `
    <nav class="navbar" aria-label="Main Navigation">
      <div class="nav-container" style="width: 100%; max-width: 100%; padding: 0 var(--space-6); display: flex; align-items: center; justify-content: space-between; position: relative; box-sizing: border-box;">
        
        <!-- LEFT CORNER: College Logo & Links (Compact DYP Logo) -->
        <div class="nav-left-wrapper flex items-center gap-4">
          <a href="#/dashboard" class="dyp-main-logo" title="D. Y. Patil College Group" style="display: inline-flex; align-items: center; gap: 0.5rem; text-decoration: none; padding: 0.2rem 0.6rem; border-radius: var(--radius-sm); border: 1px solid #d97706; background: #ffffff;">
            <div class="dyp-emblem" style="display: flex; align-items: center; justify-content: center;">
              <img src="https://imgs.search.brave.com/0w9ZP2VmCKtLaOLuLj0w34FkssYgIh9l-gWKkhqaSBk/rs:fit:500:0:1:0/g:ce/aHR0cHM6Ly9jZG4u/YnJhbmRmZXRjaC5p/by9pZDlMWndKSFFB/L3cvNDAwL2gvNDAw/L3RoZW1lL2Rhcmsv/aWNvbi5qcGVnP2M9/MWJ4aWQ2NE11cDdh/Y3pld1NBWU1YJnQ9/MTc4MTg2NTUxMjI3/NQ" alt="DY Patil Logo" style="height: 28px; width: 28px; border-radius: 4px; object-fit: contain; display: block;">
            </div>
            <div class="dyp-logo-details" style="display: flex; flex-direction: column; justify-content: center; line-height: 1.1;">
              <span class="dyp-brand-title" style="font-size: 0.85rem; font-weight: 800; letter-spacing: 0.06em; color: #0f2952; white-space: nowrap;">D Y PATIL</span>
              <span class="dyp-brand-sub" style="font-size: 0.52rem; font-weight: 700; color: #d97706; letter-spacing: 0.12em; text-transform: uppercase; white-space: nowrap;">COLLEGE GROUP</span>
            </div>
          </a>

          <div class="nav-links">
            <a href="#/dashboard" class="nav-link ${currentHash.startsWith('#/dashboard') ? 'active' : ''}">Feed</a>
            <a href="#/events" class="nav-link ${currentHash.startsWith('#/events') ? 'active' : ''}">Events</a>
            <a href="#/my-requests" class="nav-link ${currentHash.startsWith('#/my-requests') ? 'active' : ''}">My Items</a>
            ${isOrg ? `<a href="#/organizer" class="nav-link ${currentHash.startsWith('#/organizer') ? 'active' : ''}">Organizer</a>` : ''}
            ${isAdmin ? `<a href="#/admin" class="nav-link ${currentHash.startsWith('#/admin') ? 'active' : ''}">Admin</a>` : ''}
          </div>
        </div>

        <!-- CENTER: Website Logo & Name (Prominent & Big) -->
        <div class="nav-center-wrapper" style="position: absolute; left: 50%; transform: translateX(-50%); display: flex; align-items: center; pointer-events: auto;">
          <a href="#/dashboard" class="nav-brand" style="display: flex; align-items: center; gap: 0.75rem; color: var(--color-primary); text-decoration: none;">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor" style="filter: drop-shadow(0 2px 4px rgba(37, 99, 235, 0.25));">
              <path d="M20 7h-4V4c0-1.1-.9-2-2-2h-4c-1.1 0-2 .9-2 2v3H4c-1.1 0-2 .9-2 2v11c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2zm-6-3v3h-4V4h4zm6 16H4V9h16v11z"/>
            </svg>
            <span style="font-size: 1.75rem; font-weight: 900; letter-spacing: -0.03em; background: linear-gradient(135deg, var(--color-primary) 0%, #1d4ed8 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">ShareBox</span>
          </a>
        </div>

        <!-- RIGHT CORNER: Actions & User Menu -->
        <div class="nav-user" style="display: flex; align-items: center; gap: var(--space-3); flex-shrink: 0;">
          <a href="#/requests/new" class="btn btn-primary btn-sm" title="Post an item request">+ Post Request</a>
          <a href="#/notifications" class="nav-link flex items-center gap-1 ${currentHash.startsWith('#/notifications') ? 'active' : ''}" style="position: relative; display: flex; align-items: center; justify-content: center; padding: 6px 10px;" title="Notifications">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
            </svg>
            ${unreadNotificationsCount > 0 ? `
              <span class="badge" style="position: absolute; top: -2px; right: -2px; padding: 2px 5px; font-size: 10px; background: var(--color-danger); color: white;">
                ${unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
              </span>
            ` : ''}
          </a>
          <a href="#/profile" class="flex items-center gap-2 nav-link ${currentHash.startsWith('#/profile') ? 'active' : ''}" title="My Profile">
            <div style="width: 30px; height: 30px; border-radius: 50%; background: var(--color-primary-light); color: var(--color-primary); display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 13px;">
              ${escapeHTML(userInitial)}
            </div>
            <span class="text-sm font-medium" style="max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
              ${escapeHTML(userData?.name || currentUser.email.split('@')[0])}
            </span>
          </a>
          <button id="nav-logout-btn" class="btn btn-secondary btn-sm" title="Log out">Sign Out</button>
        </div>
      </div>
    </nav>
  `;

  const logoutBtn = root.querySelector('#nav-logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      window.dispatchEvent(new CustomEvent('sharebox:logout'));
    });
  }
}
