import { store } from '../../services/store.js';
import { renderRequestCard } from '../../components/request-card.js';
import { toast } from '../../components/toast.js';
import { requestsService } from '../../services/requests.service.js';

export async function renderMyRequestsPage(container, { user }) {
  let activeTab = 'requested'; // 'requested' | 'lent' | 'history'

  const renderContent = async () => {
    await requestsService.purgeExpiredRequests();
    const allRequests = await store.getDocs('requests');

    let filtered = [];
    if (activeTab === 'requested') {
      filtered = allRequests.filter(r => r.requesterId === user.uid && !['completed', 'cancelled'].includes(r.status));
    } else if (activeTab === 'lent') {
      filtered = allRequests.filter(r => r.helperId === user.uid && !['completed', 'cancelled'].includes(r.status));
    } else {
      filtered = allRequests.filter(r => (r.requesterId === user.uid || r.helperId === user.uid) && ['completed', 'cancelled'].includes(r.status));
    }

    container.innerHTML = `
      <div class="container" style="padding-top: var(--space-6);">
        <div class="flex justify-between items-center" style="margin-bottom: var(--space-6);">
          <div>
            <h1 class="text-xl font-bold">My Equipment & Requests</h1>
            <p class="text-sm text-muted">Track items you need and resources you have shared with the campus.</p>
          </div>
          <a href="#/requests/new" class="btn btn-primary btn-sm">+ Post Request</a>
        </div>

        <!-- Navigation Tabs -->
        <div class="flex gap-2" style="border-bottom: 2px solid var(--border-subtle); margin-bottom: var(--space-6);">
          <button class="tab-btn btn btn-sm ${activeTab === 'requested' ? 'btn-primary' : 'btn-secondary'}" data-tab="requested">
            Requested by Me
          </button>
          <button class="tab-btn btn btn-sm ${activeTab === 'lent' ? 'btn-primary' : 'btn-secondary'}" data-tab="lent">
            Lent by Me
          </button>
          <button class="tab-btn btn btn-sm ${activeTab === 'history' ? 'btn-primary' : 'btn-secondary'}" data-tab="history">
            Past History
          </button>
        </div>

        <div id="my-items-grid" class="requests-grid"></div>
      </div>
    `;

    const grid = container.querySelector('#my-items-grid');
    if (filtered.length === 0) {
      grid.innerHTML = `
        <div class="empty-state card" style="grid-column: 1 / -1;">
          <h3 class="text-md font-bold">No items found in this tab</h3>
          <p class="text-sm text-muted">
            ${activeTab === 'requested' ? 'You have not posted any active item requests.' : activeTab === 'lent' ? 'You have not accepted any items to lend yet.' : 'No completed equipment handovers yet.'}
          </p>
        </div>
      `;
    } else {
      filtered.forEach(req => {
        const card = renderRequestCard(req, user, async (r) => {
          try {
            await requestsService.acceptRequest(r.id, user);
            toast.success('Accepted!');
            renderContent();
          } catch (e) {
            toast.error(e.message);
          }
        });
        grid.appendChild(card);
      });
    }

    // Tab bindings
    const tabBtns = container.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        activeTab = btn.getAttribute('data-tab');
        renderContent();
      });
    });
  };

  await renderContent();
}
