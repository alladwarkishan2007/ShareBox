import { toast } from './components/toast.js';
import { isUserApproved, isUserOrganizer, isUserAdmin } from './utils/guards.js';
import { renderNavbar } from './components/navbar.js';

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
