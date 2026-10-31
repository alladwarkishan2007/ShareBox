import { toast } from './components/toast.js';
import { isUserApproved, isUserOrganizer, isUserAdmin } from './utils/guards.js';
import { renderNavbar } from './components/navbar.js';
import { store } from './services/store.js';

class Router {
  constructor() {
    this.routes = {};
    this.currentRoute = null;
    this.currentUser = null;
    this.userData = null;
    this.unreadNotifCount = 0;
    this.appContainer = null;
  }

  setUnreadNotifCount(count) {
    this.unreadNotifCount = count;
    renderNavbar(this.currentUser, this.userData, this.unreadNotifCount);
  }

  init(routes) {
    this.routes = routes;
    this.appContainer = document.getElementById('app');

    // On fresh new tab open or root access, ensure Home page ('#/') is the default view
    if (!window.location.hash || window.location.hash === '#' || window.location.hash === '#/') {
      window.location.hash = '#/';
    }

    window.addEventListener('hashchange', () => this.handleRoute());
    window.addEventListener('load', () => this.handleRoute());
  }

  setAuthState(user, userData) {
    this.currentUser = user;
    this.userData = userData;
    this.handleRoute();
  }

  navigate(hash) {
    window.location.hash = hash;
  }

  matchRoute(hash) {
    const cleanHash = hash.replace(/^#/, '') || '/';
    const [pathPart, queryPart] = cleanHash.split('?');
    const queryParams = new URLSearchParams(queryPart || '');

    for (const pattern in this.routes) {
      const patternParts = pattern.split('/');
      const pathParts = pathPart.split('/');

      if (patternParts.length !== pathParts.length) continue;

      let match = true;
      const params = {};

      for (let i = 0; i < patternParts.length; i++) {
        if (patternParts[i].startsWith(':')) {
          const paramName = patternParts[i].slice(1);
          params[paramName] = decodeURIComponent(pathParts[i]);
        } else if (patternParts[i] !== pathParts[i]) {
          match = false;
          break;
        }
      }

      if (match) {
        return {
          routeDef: this.routes[pattern],
          params,
          queryParams
        };
      }
    }

    return {
      routeDef: this.routes['*'],
      params: {},
      queryParams
    };
  }

  async handleRoute() {
    if (!this.appContainer) {
      this.appContainer = document.getElementById('app');
    }

    const currentHash = window.location.hash || '#/';
    
    // Always keep navbar active link state in sync with current route
    renderNavbar(this.currentUser, this.userData, this.unreadNotifCount);

    const match = this.matchRoute(currentHash);

    if (!match || !match.routeDef) return;

    const { routeDef, params, queryParams } = match;

    // Guard 1: Requires Authentication
    if (routeDef.requiresAuth && !this.currentUser) {
      // If a fresh tab without an active session tries to access a protected page, direct to Home page
      const hasActiveSession = typeof sessionStorage !== 'undefined' && sessionStorage.getItem('sharebox_session_uid');
      if (!hasActiveSession) {
        this.navigate('#/');
        return;
      }
      toast.info('Please sign in to access this page.');
      this.navigate('#/login');
      return;
    }

    // Guard 2: Guest Only (e.g. login/signup when already signed in)
    if (routeDef.guestOnly && this.currentUser) {
      if (isUserAdmin(this.userData)) {
        this.navigate('#/admin');
      } else if (isUserOrganizer(this.userData)) {
        this.navigate('#/organizer');
      } else {
        this.navigate('#/dashboard');
      }
      return;
    }

    // Guard 3: Block Check
    if (routeDef.requiresAuth && this.userData?.status === 'blocked') {
      toast.error('Your account has been blocked by college administration.');
      this.navigate('#/login');
      return;
    }

    // Guard 3.5: Pending Approval Check
    if (routeDef.requiresAuth && routeDef.allowPending === false && this.userData?.status === 'pending' && !isUserAdmin(this.userData)) {
      this.appContainer.innerHTML = `
        <div class="container empty-state" style="max-width: 580px; padding-top: var(--space-8); text-align: center;">
          <div style="width: 64px; height: 64px; border-radius: 50%; background: #fef3c7; color: #d97706; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px;">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
          </div>
          <h2 class="text-xl font-bold" style="color: #92400e;">Membership Approval Pending</h2>
          <p class="text-sm text-muted" style="margin-top: 8px; line-height: 1.5;">
            Your account has been registered and is awaiting administrator approval. You will be added to the campus directory as soon as an admin approves your request.
          </p>
          <div style="margin-top: 24px;" class="flex gap-2 justify-center flex-wrap">
            <button id="pending-check-status-btn" class="btn btn-primary btn-sm">
              Check Status
            </button>
            <a href="#/profile" class="btn btn-secondary btn-sm">View Profile</a>
            <button id="pending-logout-btn" class="btn btn-secondary btn-sm">Sign Out</button>
          </div>
        </div>
      `;

      const checkBtn = this.appContainer.querySelector('#pending-check-status-btn');
      if (checkBtn) {
        checkBtn.addEventListener('click', async () => {
          checkBtn.disabled = true;
          checkBtn.textContent = 'Checking...';
          try {
            const fresh = await store.getDoc('users', this.currentUser.uid);
            if (fresh && fresh.status === 'approved') {
              this.userData = fresh;
              toast.success('Your membership has been approved! Welcome to ShareBox.');
              this.handleRoute();
            } else {
              toast.info('Your membership request is still awaiting administrator approval.');
              checkBtn.disabled = false;
              checkBtn.textContent = 'Check Status';
            }
          } catch (e) {
            checkBtn.disabled = false;
            checkBtn.textContent = 'Check Status';
          }
        });
      }

      const logoutBtn = this.appContainer.querySelector('#pending-logout-btn');
      if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
          window.dispatchEvent(new CustomEvent('sharebox:logout'));
        });
      }

      return;
    }

    // Guard 4: Organizer Role Check
    if (routeDef.requiresOrganizer && !isUserOrganizer(this.userData)) {
      toast.error('Organizer or Administrator privileges required.');
      this.navigate('#/dashboard');
      return;
    }

    // Guard 5: Admin Role Check
    if (routeDef.requiresAdmin && !isUserAdmin(this.userData)) {
      toast.error('Platform Administrator access required.');
      this.navigate('#/dashboard');
      return;
    }

    // Render Route View
    try {
      this.appContainer.innerHTML = `
        <div class="container" style="padding-top: var(--space-8);">
          <div class="skeleton" style="height: 48px; width: 60%; margin-bottom: 24px;"></div>
          <div class="skeleton" style="height: 180px; width: 100%;"></div>
        </div>
      `;

      if (typeof routeDef.component === 'function') {
        await routeDef.component(this.appContainer, {
          user: this.currentUser,
          userData: this.userData,
          params,
          queryParams
        });
      }
    } catch (err) {
      console.error('[Router Error]', err);
      this.appContainer.innerHTML = `
        <div class="container empty-state">
          <h2 style="color: var(--color-danger);">Failed to load page</h2>
          <p>${err.message}</p>
          <a href="#/dashboard" class="btn btn-primary" style="margin-top: 16px;">Return to Feed</a>
        </div>
      `;
    }
  }
}

export const router = new Router();
