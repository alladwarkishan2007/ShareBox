import { router } from './router.js';
import { renderNavbar } from './components/navbar.js';
import { toast } from './components/toast.js';
import { authService } from './services/auth.service.js';
import { notificationsService } from './services/notifications.service.js';

// Page Views
import { renderLandingPage } from './pages/landing.page.js';
import { renderLoginPage } from './pages/auth/login.page.js';
import { renderSignupPage } from './pages/auth/signup.page.js';
import { renderDashboardPage } from './pages/dashboard.page.js';
import { renderCreateRequestPage } from './pages/requests/create-request.page.js';
import { renderRequestDetailPage } from './pages/requests/request-detail.page.js';
import { renderMyRequestsPage } from './pages/requests/my-requests.page.js';
import { renderEventsListPage } from './pages/events/events-list.page.js';
import { renderCreateEventPage } from './pages/events/create-event.page.js';
import { renderEventDetailPage } from './pages/events/event-detail.page.js';
import { renderProfilePage } from './pages/profile.page.js';
import { renderNotificationsPage } from './pages/notifications.page.js';
import { renderOrganizerDashboardPage } from './pages/organizer-dashboard.page.js';
import { renderAdminDashboardPage } from './pages/admin-dashboard.page.js';
import { renderNotFoundPage } from './pages/not-found.page.js';

let currentUser = null;
let currentProfile = null;
let notificationsUnsubscribe = null;
let unreadNotifCount = 0;

// Route Map
const routes = {
  '/': { component: renderLandingPage },
  '/login': { component: renderLoginPage, guestOnly: true },
  '/signup': { component: renderSignupPage, guestOnly: true },
  '/dashboard': { component: renderDashboardPage, requiresAuth: true, allowPending: false },
  '/requests/new': { component: renderCreateRequestPage, requiresAuth: true },
  '/requests/:id': { component: renderRequestDetailPage, requiresAuth: true },
  '/my-requests': { component: renderMyRequestsPage, requiresAuth: true },
  '/events': { component: renderEventsListPage, requiresAuth: true },
  '/events/new': { component: renderCreateEventPage, requiresAuth: true, requiresOrganizer: true },
  '/events/:id': { component: renderEventDetailPage, requiresAuth: true },
  '/profile': { component: renderProfilePage, requiresAuth: true, allowPending: true },
  '/notifications': { component: renderNotificationsPage, requiresAuth: true },
  '/organizer': { component: renderOrganizerDashboardPage, requiresAuth: true, requiresOrganizer: true },
  '/admin': { component: renderAdminDashboardPage, requiresAuth: true, requiresAdmin: true },
  '*': { component: renderNotFoundPage }
};

// Global App Initialization
async function initApp() {
  // Initialize Router
  router.init(routes);

  // Listen for global logout events
  window.addEventListener('sharebox:logout', async () => {
    try {
      if (notificationsUnsubscribe) notificationsUnsubscribe();
      await authService.logout();
      toast.info('Signed out successfully.');
      router.navigate('#/login');
    } catch (err) {
      toast.error('Failed to log out: ' + err.message);
    }
  });

  // Listen for Auth State changes
  authService.onAuthChange((user, profile) => {
    currentUser = user;
    currentProfile = profile;
    renderNavbar(currentUser, currentProfile, unreadNotifCount);
    router.setAuthState(currentUser, currentProfile);

    // Teardown previous listeners
    if (notificationsUnsubscribe) notificationsUnsubscribe();

    if (currentUser) {
      // 1. Setup Live Notification Badge Listener
      notificationsUnsubscribe = notificationsService.subscribeNotifications(currentUser.uid, (notifs) => {
        unreadNotifCount = notifs.filter(n => !n.read).length;
        router.setUnreadNotifCount(unreadNotifCount);
      });
    }
  });
}

// Start application once DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
