import { escapeHTML } from '../utils/sanitize.js';
import { ITEM_CATEGORIES, REQUEST_URGENCY, REQUEST_STATUS } from '../config/constants.js';
import { requestsService } from '../services/requests.service.js';
import { eventsService } from '../services/events.service.js';
import { renderRequestCard } from '../components/request-card.js';
import { toast } from '../components/toast.js';

export async function renderDashboardPage(container, { user, userData }) {
  const events = await eventsService.getEvents();

  let activeFilters = {
    eventId: 'all',
    category: '',
    urgency: '',
    status: '',
    sort: 'newest',
    search: ''
  };

  container.innerHTML = `
    <div class="container">
      <div class="dashboard-layout">
        <!-- Sidebar Filters -->
        <aside class="feed-filters">
          <div>
            <h3 class="text-sm font-bold" style="margin-bottom: 6px;">Event Scope</h3>
            <select id="filter-event" class="form-select">
              <option value="all">All Events & Campus</option>
              <option value="campus-general">Campus General</option>
              ${events.filter(e => e.id !== 'campus-general').map(e => `
                <option value="${escapeHTML(e.id)}">${escapeHTML(e.title)}</option>
              `).join('')}
            </select>
          </div>

          <div>
            <h3 class="text-sm font-bold" style="margin-bottom: 6px;">Filter by Category</h3>
            <select id="filter-category" class="form-select">
              <option value="">All Categories</option>
              ${ITEM_CATEGORIES.map(cat => `<option value="${escapeHTML(cat)}">${escapeHTML(cat)}</option>`).join('')}
            </select>
          </div>

          <div>
            <h3 class="text-sm font-bold" style="margin-bottom: 6px;">Filter by Urgency</h3>
            <select id="filter-urgency" class="form-select">
              <option value="">All Urgencies</option>
              ${Object.values(REQUEST_URGENCY).map(urg => `<option value="${escapeHTML(urg)}">${escapeHTML(urg)}</option>`).join('')}
            </select>
          </div>

          <div>
            <h3 class="text-sm font-bold" style="margin-bottom: 6px;">Request Status</h3>
            <select id="filter-status" class="form-select">
              <option value="">All Statuses</option>
              <option value="open" selected>Open (Available)</option>
              <option value="accepted">Accepted (In Progress)</option>
              <option value="handed_over">Handed Over</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          <div>
            <h3 class="text-sm font-bold" style="margin-bottom: 6px;">Sort By</h3>
            <select id="filter-sort" class="form-select">
              <option value="newest">Newest First</option>
              <option value="urgency">Most Urgent First</option>
            </select>
          </div>
        </aside>

        <!-- Main Feed Column -->
        <section class="flex-1 flex flex-col gap-4">
          <div class="flex justify-between items-center gap-4">
            <input type="search" id="feed-search" class="form-input flex-1" placeholder="Search items needed (e.g. HDMI cable, Arduino, lab coat)...">
            <a href="#/requests/new" class="btn btn-primary" style="white-space: nowrap;">+ Post Request</a>
          </div>

          <div class="flex justify-between items-center text-xs text-muted" style="padding: 0 4px;">
            <span id="feed-items-count">Loading requests...</span>
          </div>

          <div id="requests-container" class="requests-grid">
            <div class="skeleton" style="height: 160px; grid-column: 1 / -1;"></div>
          </div>
        </section>
      </div>
    </div>
  `;

  const reqContainer = container.querySelector('#requests-container');
  const countLabel = container.querySelector('#feed-items-count');

  // Subscription Manager
  let unsubscribeFeed = null;

  const updateFeedSubscription = () => {
    if (unsubscribeFeed) unsubscribeFeed();

    unsubscribeFeed = requestsService.subscribeFeed(activeFilters.eventId, activeFilters, (items) => {
      reqContainer.innerHTML = '';
      countLabel.textContent = `Showing ${items.length} item(s)`;

      if (items.length === 0) {
        reqContainer.innerHTML = `
          <div class="empty-state card" style="grid-column: 1 / -1;">
            <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
            <h3 class="text-md font-bold">No matching item requests found</h3>
            <p class="text-xs text-muted">Try changing your filters, or post the item you are searching for!</p>
            <a href="#/requests/new" class="btn btn-primary btn-sm" style="margin-top: 8px;">Create Request</a>
          </div>
        `;
        return;
      }

      items.forEach(req => {
        const card = renderRequestCard(req, user, async (r) => {
          try {
            await requestsService.acceptRequest(r.id, user);
            toast.success(`You accepted "${r.itemName}"! Direct chat is now open.`);
            window.location.hash = `#/requests/${r.id}`;
          } catch (e) {
            toast.error(e.message);
          }
        });
        reqContainer.appendChild(card);
      });
    });
  };

  // Initial load
  activeFilters.status = 'open'; // default to open
  updateFeedSubscription();

  // Filter Bindings
  container.querySelector('#filter-event').addEventListener('change', (e) => {
    activeFilters.eventId = e.target.value;
    updateFeedSubscription();
  });

  container.querySelector('#filter-category').addEventListener('change', (e) => {
    activeFilters.category = e.target.value;
    updateFeedSubscription();
  });

  container.querySelector('#filter-urgency').addEventListener('change', (e) => {
    activeFilters.urgency = e.target.value;
    updateFeedSubscription();
  });

  container.querySelector('#filter-status').addEventListener('change', (e) => {
    activeFilters.status = e.target.value;
    updateFeedSubscription();
  });

  container.querySelector('#filter-sort').addEventListener('change', (e) => {
    activeFilters.sort = e.target.value;
    updateFeedSubscription();
  });

  // Debounced Search Input
  let searchTimer = null;
  container.querySelector('#feed-search').addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      activeFilters.search = e.target.value.trim();
      updateFeedSubscription();
    }, 250);
  });
}
