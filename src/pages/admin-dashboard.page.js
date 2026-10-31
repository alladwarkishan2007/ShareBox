import { store } from '../services/store.js';
import { locationService } from '../services/location.service.js';
import { reportsService } from '../services/reports.service.js';
import { notificationsService } from '../services/notifications.service.js';
import { modal } from '../components/modal.js';
import { toast } from '../components/toast.js';
import { escapeHTML } from '../utils/sanitize.js';
import { isValidEmail } from '../utils/validators.js';

export async function renderAdminDashboardPage(container, { user }) {
  let activeTab = 'users'; // 'users' | 'requests' | 'events' | 'reports' | 'landmarks' | 'system'
  let userFilter = 'approved'; // 'approved' | 'pending' | 'admins' | 'restricted' | 'all'
  let userSearchTerm = '';
  let showAllPasswords = false;
  let reqFilter = 'all'; // 'all' | 'open' | 'accepted' | 'completed'
  let reportFilter = 'all'; // 'all' | 'pending' | 'resolved'

  const renderContent = async () => {
    const allUsers = await store.getDocs('users');
    const allRequests = await store.getDocs('requests');
    const allEvents = await store.getDocs('events');
    const allReports = await store.getDocs('damageReports');
    const landmarks = await locationService.getCampusLandmarks();

    const totalReqs = allRequests.length;
    const completedReqs = allRequests.filter(r => r.status === 'completed').length;
    const openReqs = allRequests.filter(r => r.status === 'open').length;
    const completionRate = totalReqs > 0 ? Math.round((completedReqs / totalReqs) * 100) : 100;
    const pendingUsers = allUsers.filter(u => u.status === 'pending');
    const approvedUsers = allUsers.filter(u => u.status === 'approved' || (!u.status && u.role === 'admin'));
    const staffUsers = allUsers.filter(u => ['admin', 'organizer'].includes(u.role)).length;
    const restrictedUsers = allUsers.filter(u => u.status === 'blocked' || (u.restrictedUntil && new Date(u.restrictedUntil) > new Date())).length;
    const pendingDisputes = allReports.filter(r => r.status !== 'resolved').length;

    // Sort newest registrations first
    allUsers.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    container.innerHTML = `
      <div style="width: 100%; max-width: 100%; padding: var(--space-6) var(--space-6); padding-bottom: var(--space-12); box-sizing: border-box;">
        <!-- Liquid-Glass Title Header Banner -->
        <div class="glass-header-box flex justify-between items-center flex-wrap gap-4" style="margin-bottom: var(--space-6);">
          <div>
            <div class="flex items-center gap-2">
              <div style="width: 36px; height: 36px; border-radius: 10px; background: rgba(37, 99, 235, 0.12); color: var(--color-primary); display: flex; align-items: center; justify-content: center;">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="3" width="7" height="7"></rect>
                  <rect x="14" y="3" width="7" height="7"></rect>
                  <rect x="14" y="14" width="7" height="7"></rect>
                  <rect x="3" y="14" width="7" height="7"></rect>
                </svg>
              </div>
              <h1 class="text-xl font-bold" style="margin: 0; color: #0f172a;">Campus Administration Console</h1>
            </div>
            <p class="text-xs text-muted" style="margin-top: 4px; margin-bottom: 0;">Autonomous coordination for equipment directory, member approvals, campus events, and disputes.</p>
          </div>
          <div class="flex items-center gap-2">
            <span class="badge" style="background: rgba(37, 99, 235, 0.1); color: var(--color-primary); border: 1px solid rgba(37, 99, 235, 0.25); font-weight: 700; padding: 6px 12px; border-radius: 9999px;">
              Admin Session Active
            </span>
          </div>
        </div>

        <!-- Liquid-Glass Navigation Dock -->
        <div class="liquid-glass-dock flex gap-2 flex-wrap items-center">
          <button class="tab-btn btn liquid-glass-tab ${activeTab === 'users' ? 'btn-primary' : 'btn-secondary'}" data-tab="users" style="padding: 0.65rem 1.25rem; font-size: 0.95rem; font-weight: 700; border-radius: var(--radius-lg); ${activeTab === 'users' ? 'background: #2563eb; color: #ffffff; border-color: #2563eb; box-shadow: 0 4px 14px rgba(37, 99, 235, 0.35);' : 'background: rgba(255, 255, 255, 0.6); color: #1e40af; border-color: rgba(191, 219, 254, 0.7);'}">
            <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: ${activeTab === 'users' ? '#ffffff' : '#2563eb'}; margin-right: 6px;"></span>Users (${approvedUsers.length})${pendingUsers.length > 0 ? ` <span class="badge" style="background: #f59e0b; color: #ffffff; font-size: 11px; padding: 2px 7px; border-radius: 10px; margin-left: 6px;">${pendingUsers.length} pending</span>` : ''}
          </button>
          <button class="tab-btn btn liquid-glass-tab ${activeTab === 'requests' ? 'btn-primary' : 'btn-secondary'}" data-tab="requests" style="padding: 0.65rem 1.25rem; font-size: 0.95rem; font-weight: 700; border-radius: var(--radius-lg); ${activeTab === 'requests' ? 'background: #059669; color: #ffffff; border-color: #059669; box-shadow: 0 4px 14px rgba(5, 150, 105, 0.35);' : 'background: rgba(255, 255, 255, 0.6); color: #047857; border-color: rgba(167, 243, 208, 0.7);'}">
            <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: ${activeTab === 'requests' ? '#ffffff' : '#059669'}; margin-right: 6px;"></span>Requests (${allRequests.length})
          </button>
          <button class="tab-btn btn liquid-glass-tab ${activeTab === 'events' ? 'btn-primary' : 'btn-secondary'}" data-tab="events" style="padding: 0.65rem 1.25rem; font-size: 0.95rem; font-weight: 700; border-radius: var(--radius-lg); ${activeTab === 'events' ? 'background: #7c3aed; color: #ffffff; border-color: #7c3aed; box-shadow: 0 4px 14px rgba(124, 58, 237, 0.35);' : 'background: rgba(255, 255, 255, 0.6); color: #6d28d9; border-color: rgba(221, 214, 254, 0.7);'}">
            <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: ${activeTab === 'events' ? '#ffffff' : '#7c3aed'}; margin-right: 6px;"></span>Events (${allEvents.length})
          </button>
          <button class="tab-btn btn liquid-glass-tab ${activeTab === 'reports' ? 'btn-primary' : 'btn-secondary'}" data-tab="reports" style="padding: 0.65rem 1.25rem; font-size: 0.95rem; font-weight: 700; border-radius: var(--radius-lg); ${activeTab === 'reports' ? 'background: #dc2626; color: #ffffff; border-color: #dc2626; box-shadow: 0 4px 14px rgba(220, 38, 38, 0.35);' : 'background: rgba(255, 255, 255, 0.6); color: #b91c1c; border-color: rgba(254, 202, 202, 0.7);'}">
            <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: ${activeTab === 'reports' ? '#ffffff' : '#dc2626'}; margin-right: 6px;"></span>Disputes (${allReports.length})
          </button>
          <button class="tab-btn btn liquid-glass-tab ${activeTab === 'landmarks' ? 'btn-primary' : 'btn-secondary'}" data-tab="landmarks" style="padding: 0.65rem 1.25rem; font-size: 0.95rem; font-weight: 700; border-radius: var(--radius-lg); ${activeTab === 'landmarks' ? 'background: #d97706; color: #ffffff; border-color: #d97706; box-shadow: 0 4px 14px rgba(217, 119, 6, 0.35);' : 'background: rgba(255, 255, 255, 0.6); color: #b45309; border-color: rgba(253, 230, 138, 0.7);'}">
            <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: ${activeTab === 'landmarks' ? '#ffffff' : '#d97706'}; margin-right: 6px;"></span>Landmarks (${landmarks.length})
          </button>
        </div>

        <!-- Main Dynamic Tab Panel Container -->
        <div id="admin-tab-content"></div>

        <!-- Liquid-Glass Database Utilities Footer -->
        <div class="liquid-glass-dock" style="margin-top: var(--space-8); padding: var(--space-4) var(--space-6);">
          <div class="flex justify-between items-center flex-wrap gap-3">
            <span class="text-xs text-muted font-medium">Platform Database Maintenance & Archival</span>
            <div class="flex gap-2">
              <button id="export-db-btn" class="btn btn-secondary btn-sm glass-btn">Export Database</button>
              <button id="reset-db-btn" class="btn btn-danger btn-sm" style="background: #dc2626; color: white;">Reset to Seed State</button>
            </div>
          </div>
        </div>
      </div>
    `;

    const tabArea = container.querySelector('#admin-tab-content');

    // ==========================================
    // TAB 1: USERS & PASSWORDS DIRECTORY
    // ==========================================
    if (activeTab === 'users') {
      tabArea.innerHTML = `
        ${pendingUsers.length > 0 ? `
          <div class="liquid-glass-alert flex justify-between items-center flex-wrap gap-3" style="padding: var(--space-4) var(--space-5); margin-bottom: var(--space-5);">
            <div>
              <span style="font-weight: 800; color: #92400e;">⚠️ ${pendingUsers.length} Membership Request${pendingUsers.length > 1 ? 's' : ''} Awaiting Review:</span>
              <span class="text-xs" style="color: #b45309; margin-left: 6px;">New campus applicants must be approved before access is granted.</span>
            </div>
            <button id="quick-review-pending-btn" class="btn btn-xs" style="background: #f59e0b; color: white; font-weight: 700; border: none; padding: 6px 14px; cursor: pointer; border-radius: var(--radius-md); box-shadow: 0 2px 8px rgba(245, 158, 11, 0.35);">
              Review Pending (${pendingUsers.length})
            </button>
          </div>
        ` : ''}

        <div class="admin-section-glow glow-users">
          <div class="admin-glass-panel" style="border-top: 3px solid #2563eb;">
            <div class="admin-glass-header flex justify-between items-center flex-wrap gap-3" style="background: rgba(239, 246, 255, 0.85); border-bottom: 1px solid rgba(191, 219, 254, 0.8);">
              <div class="flex items-center gap-3">
                <span style="display: inline-block; width: 12px; height: 12px; border-radius: 50%; background: #2563eb; box-shadow: 0 0 12px rgba(37, 99, 235, 0.8);"></span>
                <h2 class="text-lg font-bold" style="color: #1e3a8a; margin: 0; font-size: 1.25rem;">Users & Credentials Directory</h2>
              </div>
              <div class="flex gap-2 items-center flex-wrap">
                <div style="position: relative; width: 260px;">
                  <input type="text" id="admin-user-search" class="form-input" placeholder="Search members..." value="${escapeHTML(userSearchTerm)}" style="padding: 0.45rem 0.75rem 0.45rem 2rem; font-size: var(--font-xs); background: rgba(255, 255, 255, 0.9); border: 1px solid #bfdbfe; border-radius: var(--radius-md);">
                  <svg style="position: absolute; left: 8px; top: 50%; transform: translateY(-50%); color: var(--text-muted); pointer-events: none;" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                </div>
                <button id="toggle-all-pwd-btn" class="btn btn-secondary btn-sm glass-btn" style="background: rgba(255, 255, 255, 0.85); border: 1px solid #bfdbfe; color: #1e3a8a; font-weight: 600;">
                  ${showAllPasswords ? 'Hide Passwords' : 'Show Passwords'}
                </button>
              </div>
            </div>

            <!-- Quick Filters Bar -->
            <div class="admin-glass-filter-bar" style="background: rgba(239, 246, 255, 0.65); border-bottom: 1px solid rgba(191, 219, 254, 0.8);">
              <button class="user-filter-chip btn btn-xs ${userFilter === 'approved' ? 'btn-primary' : 'btn-secondary glass-btn'}" data-filter="approved">
                Active Directory (${approvedUsers.length})
              </button>
              <button class="user-filter-chip btn btn-xs ${userFilter === 'pending' ? 'btn-primary' : 'btn-secondary glass-btn'}" data-filter="pending" style="${pendingUsers.length > 0 ? 'border: 1.5px solid #f59e0b; color: #92400e; font-weight: 700;' : ''}">
                Pending Approvals (${pendingUsers.length})
              </button>
              <button class="user-filter-chip btn btn-xs ${userFilter === 'rejected' ? 'btn-primary' : 'btn-secondary glass-btn'}" data-filter="rejected">
                Disapproved (${allUsers.filter(u => u.status === 'rejected').length})
              </button>
              <button class="user-filter-chip btn btn-xs ${userFilter === 'admins' ? 'btn-primary' : 'btn-secondary glass-btn'}" data-filter="admins">
                Admins & Organizers (${staffUsers})
              </button>
              <button class="user-filter-chip btn btn-xs ${userFilter === 'restricted' ? 'btn-primary' : 'btn-secondary glass-btn'}" data-filter="restricted">
                Restricted (${restrictedUsers})
              </button>
              <button class="user-filter-chip btn btn-xs ${userFilter === 'all' ? 'btn-primary' : 'btn-secondary glass-btn'}" data-filter="all">
                All Accounts (${allUsers.length})
              </button>
              <span id="user-count-badge" class="text-xs" style="margin-left: auto; color: #1e40af; font-weight: 600;">
                Loading...
              </span>
            </div>

            <!-- Users Section Frosted Blue Glass Table -->
            <div class="table-users-wrap">
              <table class="table-users">
                <thead>
                  <tr>
                    <th style="width: 20%;">
                      <span style="display: inline-block; width: 9px; height: 9px; border-radius: 50%; background: #2563eb; margin-right: 6px;"></span>Member Profile
                    </th>
                    <th style="width: 26%;">
                      <span style="display: inline-block; width: 9px; height: 9px; border-radius: 50%; background: #16a34a; margin-right: 6px;"></span>Email
                    </th>
                    <th style="width: 16%;">
                      <span style="display: inline-block; width: 9px; height: 9px; border-radius: 50%; background: #64748b; margin-right: 6px;"></span>Plaintext Password
                    </th>
                    <th style="width: 14%;">
                      <span style="display: inline-block; width: 9px; height: 9px; border-radius: 50%; background: #ea580c; margin-right: 6px;"></span>Branch & Year
                    </th>
                    <th style="width: 8%;">
                      Role
                    </th>
                    <th style="width: 7%;">
                      Status
                    </th>
                    <th style="text-align: right; width: 9%;">
                      Admin Actions
                    </th>
                  </tr>
                </thead>
                <tbody id="admin-users-tbody"></tbody>
              </table>
            </div>
          </div>
        </div>
      `;

      const searchInput = tabArea.querySelector('#admin-user-search');
      const tbody = tabArea.querySelector('#admin-users-tbody');
      const countBadge = tabArea.querySelector('#user-count-badge');

      // Function to render user table rows dynamically
      const renderUserTableRows = (usersList) => {
        if (usersList.length === 0) {
          tbody.innerHTML = `
            <tr>
              <td colspan="7" style="padding: var(--space-8); text-align: center;" class="text-muted">
                <div>No members match the current filter or search criteria</div>
                <div class="text-xs" style="margin-top: 4px;">Try clearing the search box or selecting "All Members".</div>
              </td>
            </tr>
          `;
          countBadge.textContent = '0 members shown';
          return;
        }

        countBadge.textContent = `Showing ${usersList.length} of ${allUsers.length} members`;

        tbody.innerHTML = usersList.map((u, idx) => {
          const uid = u.uid || u.id;
          const pwd = u.password || 'password123';
          const isPending = u.status === 'pending';
          const isBlocked = u.status === 'blocked';
          const isRestricted = u.restrictedUntil && new Date(u.restrictedUntil) > new Date();
          const isNew = u.createdAt && (Date.now() - new Date(u.createdAt).getTime() < 48 * 3600 * 1000);

          const rowBg = isPending ? 'rgba(254, 243, 199, 0.75)' : isBlocked ? 'rgba(254, 226, 226, 0.75)' : (idx % 2 === 0 ? 'rgba(255, 255, 255, 0.75)' : 'rgba(239, 246, 255, 0.6)');
          const rowBorderLeft = isPending ? '4px solid #f59e0b' : isBlocked ? '4px solid var(--color-danger)' : '4px solid transparent';

          return `
            <tr style="background: ${rowBg}; border-left: ${rowBorderLeft}; border-bottom: 1px solid rgba(191, 219, 254, 0.5);">
              <!-- Member Profile -->
              <td style="padding: var(--space-3) var(--space-4); border-right: 1px solid rgba(191, 219, 254, 0.4);">
                <div style="display: flex; align-items: center; gap: 10px;">
                  <div style="width: 34px; height: 34px; border-radius: 50%; background: ${isPending ? '#fef3c7' : '#dbeafe'}; color: ${isPending ? '#b45309' : '#1d4ed8'}; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 13px; flex-shrink: 0; border: 1.5px solid ${isPending ? '#fde68a' : '#bfdbfe'}; box-shadow: 0 2px 6px rgba(37, 99, 235, 0.15);">
                    ${escapeHTML((u.name || u.email || 'M')[0].toUpperCase())}
                  </div>
                  <div>
                    <div style="font-weight: 700; display: flex; align-items: center; gap: 6px; color: #0f172a;">
                      ${escapeHTML(u.name || 'Member')}
                      ${isPending ? `<span class="badge" style="background: #f59e0b; color: white; font-size: 9px; padding: 1px 5px; font-weight: 700;">REQUEST</span>` : isNew ? `<span class="badge" style="background: var(--color-success); color: white; font-size: 9px; padding: 1px 4px; font-weight: 700;">NEW</span>` : ''}
                    </div>
                    <div class="text-xs" style="color: #475569; font-weight: 500;">${escapeHTML(u.phone || 'No phone')}</div>
                  </div>
                </div>
              </td>

              <!-- Email Capsule -->
              <td style="padding: var(--space-3) var(--space-4); border-right: 1px solid rgba(191, 219, 254, 0.4);">
                <div style="font-size: var(--font-xs); font-family: monospace; color: #166534; background: rgba(240, 253, 244, 0.9); border: 1px solid #86efac; padding: 4px 10px; border-radius: var(--radius-sm); word-break: break-all; display: inline-block; font-weight: 600;" title="${escapeHTML(u.email)}">
                  ${escapeHTML(u.email)}
                </div>
              </td>

              <!-- Plaintext Password Capsule -->
              <td style="padding: var(--space-3) var(--space-4); border-right: 1px solid rgba(191, 219, 254, 0.4);">
                <div class="flex items-center gap-2">
                  <span class="user-pwd-display font-mono text-xs" data-uid="${escapeHTML(uid)}" data-pwd="${escapeHTML(pwd)}" style="background: rgba(241, 245, 249, 0.95); border: 1px solid #cbd5e1; color: #0f172a; font-weight: 700; padding: 4px 8px; border-radius: var(--radius-sm); letter-spacing: ${showAllPasswords ? 'normal' : '2px'};">
                    ${showAllPasswords ? escapeHTML(pwd) : '••••••••'}
                  </span>
                  <button type="button" class="btn btn-secondary btn-xs toggle-single-pwd-btn glass-btn" data-uid="${escapeHTML(uid)}" style="font-size: 10px; padding: 2px 7px; background: rgba(255, 255, 255, 0.85); border: 1px solid #cbd5e1; color: #1e3a8a; font-weight: 600;">
                    ${showAllPasswords ? 'Hide' : 'Show'}
                  </button>
                </div>
              </td>

              <!-- Department & Year -->
              <td style="padding: var(--space-3) var(--space-4); font-size: var(--font-xs); border-right: 1px solid var(--border-subtle);">
                <div style="color: #9a3412; font-weight: 500;">${escapeHTML(u.department || 'General Branch')}</div>
                <div class="text-muted">${escapeHTML(u.year ? `Year ${u.year}` : 'Standard')}</div>
              </td>

              <!-- Role Pill -->
              <td style="padding: var(--space-3) var(--space-4); border-right: 1px solid var(--border-subtle);">
                <button class="badge change-role-btn" data-uid="${escapeHTML(uid)}" data-current-role="${escapeHTML(u.role || 'member')}" title="Click to modify role" style="cursor: pointer; border: 1px solid var(--border-subtle); background: ${u.role === 'admin' ? 'var(--color-primary)' : u.role === 'organizer' ? '#7e22ce' : 'var(--bg-subtle)'}; color: ${u.role === 'admin' || u.role === 'organizer' ? 'white' : 'inherit'};">
                  ${escapeHTML(u.role ? u.role.toUpperCase() : 'MEMBER')}
                </button>
              </td>

              <!-- Status Badge (Pending vs Active vs Blocked vs Disapproved) -->
              <td style="padding: var(--space-3) var(--space-4); border-right: 1px solid var(--border-subtle);">
                ${isPending ? `
                  <span class="badge" style="background: #fef3c7; color: #92400e; font-weight: 700; border: 1px solid #fde68a;">
                    <span class="status-dot status-dot-warning" style="background: #f59e0b;"></span> Pending
                  </span>
                ` : u.status === 'rejected' ? `
                  <span class="badge" style="background: rgba(239, 68, 68, 0.15); color: #b91c1c; font-weight: 700; border: 1px solid rgba(239, 68, 68, 0.3);">
                    <span class="status-dot status-dot-danger"></span> Disapproved
                  </span>
                ` : isBlocked ? `
                  <span class="badge" style="background: #fee2e2; color: #991b1b;">
                    <span class="status-dot status-dot-danger"></span> Blocked
                  </span>
                ` : `
                  <span class="badge" style="background: #ecfdf5; color: #047857;">
                    <span class="status-dot status-dot-success"></span> Active
                  </span>
                `}
                ${isRestricted ? `<div class="text-xs text-danger" style="margin-top: 2px;">Restricted</div>` : ''}
              </td>

              <!-- Action Buttons -->
              <td style="padding: var(--space-3) var(--space-4); text-align: right; white-space: nowrap;">
                <div class="flex gap-1 justify-end flex-wrap items-center">
                  ${isPending ? `
                    <button class="btn btn-success btn-xs approve-user-btn" data-uid="${escapeHTML(uid)}" title="Approve Membership and add to Active Directory" style="font-weight: 700; background: #16a34a; color: white;">
                      ✓ Approve
                    </button>
                  ` : ''}
                  <button class="btn btn-secondary btn-xs edit-user-btn" data-uid="${escapeHTML(uid)}" title="Edit User & Credentials">
                    Edit
                  </button>
                  ${u.status !== 'rejected' && u.role !== 'admin' ? `
                    <button class="btn btn-xs reject-user-btn" data-uid="${escapeHTML(uid)}" title="Disapprove and permanently bar this email from re-registering" style="background: rgba(220, 38, 38, 0.12); color: #dc2626; border: 1px solid rgba(220, 38, 38, 0.3); font-weight: 600; padding: 2px 7px;">
                      Reject
                    </button>
                  ` : ''}
                  ${!isBlocked ? `
                    <button class="btn btn-xs block-user-btn" data-uid="${escapeHTML(uid)}" title="Block Access" style="background: #000000; color: #ffffff; border: 1px solid #000000; font-weight: 600;">
                      Block
                    </button>
                  ` : `
                    <button class="btn btn-success btn-xs unblock-user-btn" data-uid="${escapeHTML(uid)}" title="Restore Access">
                      Unblock
                    </button>
                  `}
                  ${(isRestricted || (u.warningsCount || 0) > 0) ? `
                    <button class="btn btn-secondary btn-xs clear-penalty-btn" data-uid="${escapeHTML(uid)}" title="Clear Restrictions and Warnings">
                      Clear Penalty
                    </button>
                  ` : ''}
                  <button class="btn btn-danger btn-xs delete-user-btn" data-uid="${escapeHTML(uid)}" title="Permanently Delete Account">
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          `;
        }).join('');

        // Attach action listeners for table row buttons
        attachUserRowListeners();
      };

      // Filter and Search computation
      const filterUsers = () => {
        return allUsers.filter(u => {
          // Status/role filter
          if (userFilter === 'approved' && u.status !== 'approved' && !(u.role === 'admin')) return false;
          if (userFilter === 'pending' && u.status !== 'pending') return false;
          if (userFilter === 'rejected' && u.status !== 'rejected') return false;
          if (userFilter === 'admins' && !['admin', 'organizer'].includes(u.role)) return false;
          if (userFilter === 'restricted' && u.status !== 'blocked' && !(u.restrictedUntil && new Date(u.restrictedUntil) > new Date())) return false;

          // Search term
          if (!userSearchTerm) return true;
          const q = userSearchTerm.toLowerCase();
          return (
            (u.name && u.name.toLowerCase().includes(q)) ||
            (u.email && u.email.toLowerCase().includes(q)) ||
            (u.department && u.department.toLowerCase().includes(q)) ||
            (u.role && u.role.toLowerCase().includes(q)) ||
            (u.phone && u.phone.toLowerCase().includes(q))
          );
        });
      };

      // Quick Review Pending Banner Button Handler
      const quickPendingBtn = tabArea.querySelector('#quick-review-pending-btn');
      if (quickPendingBtn) {
        quickPendingBtn.addEventListener('click', () => {
          userFilter = 'pending';
          tabArea.querySelectorAll('.user-filter-chip').forEach(c => {
            const isTarget = c.getAttribute('data-filter') === 'pending';
            c.className = `user-filter-chip btn btn-xs ${isTarget ? 'btn-primary' : 'btn-secondary'}`;
          });
          renderUserTableRows(filterUsers());
        });
      }

      // Smooth search listener: never re-renders the input element!
      if (searchInput) {
        searchInput.addEventListener('input', (e) => {
          userSearchTerm = e.target.value.trim();
          renderUserTableRows(filterUsers());
        });
      }

      // Filter chips click handler
      tabArea.querySelectorAll('.user-filter-chip').forEach(chip => {
        chip.addEventListener('click', () => {
          userFilter = chip.getAttribute('data-filter');
          // Update active filter chip styles
          tabArea.querySelectorAll('.user-filter-chip').forEach(c => {
            const isTarget = c.getAttribute('data-filter') === userFilter;
            c.className = `user-filter-chip btn btn-xs ${isTarget ? 'btn-primary' : 'btn-secondary'}`;
          });
          renderUserTableRows(filterUsers());
        });
      });

      // Toggle All Passwords Button
      const toggleAllBtn = tabArea.querySelector('#toggle-all-pwd-btn');
      if (toggleAllBtn) {
        toggleAllBtn.addEventListener('click', () => {
          showAllPasswords = !showAllPasswords;
          toggleAllBtn.textContent = showAllPasswords ? 'Hide All Passwords' : 'Show All Passwords';
          tabArea.querySelectorAll('.user-pwd-display').forEach(span => {
            const raw = span.getAttribute('data-pwd');
            span.textContent = showAllPasswords ? raw : '••••••••';
            span.style.letterSpacing = showAllPasswords ? 'normal' : '2px';
          });
          tabArea.querySelectorAll('.toggle-single-pwd-btn').forEach(b => {
            b.textContent = showAllPasswords ? 'Hide' : 'Show';
          });
        });
      }

      // Attach row-level listeners (called whenever rows are rendered)
      const attachUserRowListeners = () => {
        // Approve User
        tbody.querySelectorAll('.approve-user-btn').forEach(btn => {
          btn.addEventListener('click', async () => {
            const uid = btn.getAttribute('data-uid');
            const target = allUsers.find(u => (u.uid || u.id) === uid);
            btn.disabled = true;
            btn.textContent = 'Approving...';
            try {
              await store.updateDoc('users', uid, { status: 'approved' });
              await notificationsService.create({
                userId: uid,
                type: 'account_approved',
                title: 'Membership Approved!',
                message: 'Your ShareBox account has been approved by the platform administrator. You now have full access to the campus equipment directory and requests.',
                refId: null
              });
              toast.success(`Approved ${target?.name || 'Member'}! Added to Active User Directory.`);
              if (target) target.status = 'approved';
              renderContent();
            } catch (err) {
              toast.error('Failed to approve member: ' + err.message);
              btn.disabled = false;
              btn.textContent = '✓ Approve';
            }
          });
        });

        // Reject / Disapprove User from Directory
        tbody.querySelectorAll('.reject-user-btn').forEach(btn => {
          btn.addEventListener('click', async () => {
            const uid = btn.getAttribute('data-uid');
            const target = allUsers.find(u => (u.uid || u.id) === uid);
            if (!target) return;

            const confirmed = confirm(`Are you sure you want to reject/disapprove ${target.name} (${target.email})?\n\nThis will revoke their access and permanently bar their email from registering again.`);
            if (!confirmed) return;

            btn.disabled = true;
            btn.textContent = 'Rejecting...';
            try {
              if (target.email) {
                store.disapproveEmail(target.email);
              }
              await store.updateDoc('users', uid, { status: 'rejected' });
              await notificationsService.create({
                userId: uid,
                type: 'account_rejected',
                title: 'Membership Status Update',
                message: 'Your ShareBox account has been disapproved by the administrator. Contact administration if you have questions.',
                refId: null
              });
              toast.info(`Disapproved ${target.name}. Email permanently barred from re-registering.`);
              target.status = 'rejected';
              renderContent();
            } catch (err) {
              toast.error('Failed to reject user: ' + err.message);
              btn.disabled = false;
              btn.textContent = 'Reject';
            }
          });
        });

        // Individual Password Toggle
        tbody.querySelectorAll('.toggle-single-pwd-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            const uid = btn.getAttribute('data-uid');
            const span = tbody.querySelector(`.user-pwd-display[data-uid="${uid}"]`);
            if (span) {
              const raw = span.getAttribute('data-pwd');
              const isHidden = span.textContent.trim() === '••••••••';
              span.textContent = isHidden ? raw : '••••••••';
              span.style.letterSpacing = isHidden ? 'normal' : '2px';
              btn.textContent = isHidden ? 'Hide' : 'Show';
            }
          });
        });

        // Block User
        tbody.querySelectorAll('.block-user-btn').forEach(btn => {
          btn.addEventListener('click', async () => {
            const uid = btn.getAttribute('data-uid');
            if (confirm('Block this user from accessing ShareBox?')) {
              try {
                await store.updateDoc('users', uid, { status: 'blocked' });
                toast.warning('User account blocked.');
                renderContent();
              } catch (e) {
                toast.error(e.message);
              }
            }
          });
        });

        // Unblock User
        tbody.querySelectorAll('.unblock-user-btn').forEach(btn => {
          btn.addEventListener('click', async () => {
            const uid = btn.getAttribute('data-uid');
            try {
              await store.updateDoc('users', uid, { status: 'approved' });
              toast.success('User access restored.');
              renderContent();
            } catch (e) {
              toast.error(e.message);
            }
          });
        });

        // Clear Penalties & Restrictions
        tbody.querySelectorAll('.clear-penalty-btn').forEach(btn => {
          btn.addEventListener('click', async () => {
            const uid = btn.getAttribute('data-uid');
            if (confirm('Clear all borrowing restrictions and warning points for this user?')) {
              try {
                await store.updateDoc('users', uid, { restrictedUntil: null, warningsCount: 0 });
                toast.success('Restrictions and warnings cleared!');
                renderContent();
              } catch (e) {
                toast.error(e.message);
              }
            }
          });
        });

        // Delete User Permanently
        tbody.querySelectorAll('.delete-user-btn').forEach(btn => {
          btn.addEventListener('click', async () => {
            const uid = btn.getAttribute('data-uid');
            if (confirm('Are you sure you want to PERMANENTLY delete this user account? This cannot be undone.')) {
              try {
                await store.deleteDoc('users', uid);
                toast.success('User account deleted.');
                renderContent();
              } catch (e) {
                toast.error(e.message);
              }
            }
          });
        });

        // Change Role Button
        tbody.querySelectorAll('.change-role-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            const uid = btn.getAttribute('data-uid');
            const currentRole = btn.getAttribute('data-current-role');
            const targetUser = allUsers.find(u => (u.uid === uid || u.id === uid));
            if (!targetUser) return;

            modal.open({
              title: `Change Role for ${targetUser.name}`,
              contentHTML: `
                <div class="form-group">
                  <label class="form-label" for="select-user-role">Assign Platform Role <span class="required">*</span></label>
                  <select id="select-user-role" class="form-select">
                    <option value="member" ${currentRole === 'member' ? 'selected' : ''}>Student Member (Standard borrowing & lending)</option>
                    <option value="organizer" ${currentRole === 'organizer' ? 'selected' : ''}>Event Organizer (Create campus events, coordinate equipment)</option>
                    <option value="admin" ${currentRole === 'admin' ? 'selected' : ''}>Platform Administrator (Full system controls & oversight)</option>
                  </select>
                </div>
              `,
              confirmText: 'Save Role',
              onConfirm: async () => {
                const newRole = document.getElementById('select-user-role').value;
                await store.updateDoc('users', uid, { role: newRole });
                toast.success(`Role updated to "${newRole.toUpperCase()}"!`);
                renderContent();
              }
            });
          });
        });

        // Edit User & Password Modal
        tbody.querySelectorAll('.edit-user-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            const uid = btn.getAttribute('data-uid');
            const target = allUsers.find(u => (u.uid === uid || u.id === uid));
            if (!target) return;

            modal.open({
              title: `Edit User: ${target.name}`,
              contentHTML: `
                <div class="form-group">
                  <label class="form-label" for="edit-name">Full Name <span class="required">*</span></label>
                  <input type="text" id="edit-name" class="form-input" value="${escapeHTML(target.name || '')}" required>
                </div>
                <div class="form-group">
                  <label class="form-label" for="edit-email">Email Address <span class="required" style="color: var(--color-danger); font-weight: bold;">* (Compulsory)</span></label>
                  <input type="email" id="edit-email" class="form-input" value="${escapeHTML(target.email || '')}" required>
                </div>
                <div class="form-group">
                  <label class="form-label" for="edit-pwd">Account Password <span class="required">*</span></label>
                  <input type="text" id="edit-pwd" class="form-input font-mono" value="${escapeHTML(target.password || 'password123')}" required>
                </div>
                <div class="flex gap-4">
                  <div class="form-group flex-1">
                    <label class="form-label" for="edit-role">Role</label>
                    <select id="edit-role" class="form-select">
                      <option value="member" ${target.role === 'member' ? 'selected' : ''}>Member</option>
                      <option value="organizer" ${target.role === 'organizer' ? 'selected' : ''}>Organizer</option>
                      <option value="admin" ${target.role === 'admin' ? 'selected' : ''}>Admin</option>
                    </select>
                  </div>
                  <div class="form-group flex-1">
                    <label class="form-label" for="edit-status">Status</label>
                    <select id="edit-status" class="form-select">
                      <option value="approved" ${target.status === 'approved' ? 'selected' : ''}>Active (Approved)</option>
                      <option value="pending" ${target.status === 'pending' ? 'selected' : ''}>Pending Approval</option>
                      <option value="blocked" ${target.status === 'blocked' ? 'selected' : ''}>Blocked</option>
                    </select>
                  </div>
                </div>
                <div class="flex gap-4">
                  <div class="form-group flex-1">
                    <label class="form-label" for="edit-dept">Department</label>
                    <input type="text" id="edit-dept" class="form-input" value="${escapeHTML(target.department || '')}">
                  </div>
                  <div class="form-group flex-1">
                    <label class="form-label" for="edit-phone">Phone</label>
                    <input type="text" id="edit-phone" class="form-input" value="${escapeHTML(target.phone || '')}">
                  </div>
                </div>
              `,
              confirmText: 'Save Changes',
              onConfirm: async () => {
                const name = document.getElementById('edit-name').value.trim();
                const email = document.getElementById('edit-email').value.trim();
                const password = document.getElementById('edit-pwd').value;
                const role = document.getElementById('edit-role').value;
                const status = document.getElementById('edit-status').value;
                const department = document.getElementById('edit-dept').value.trim();
                const phone = document.getElementById('edit-phone').value.trim();

                if (!name) { toast.error('Name is required.'); throw new Error(); }
                if (!email) { toast.error('Email is compulsory.'); throw new Error(); }
                if (!isValidEmail(email)) { toast.error('Valid email is required.'); throw new Error(); }
                if (!password) { toast.error('Password is required.'); throw new Error(); }

                await store.updateDoc('users', uid, {
                  name,
                  email,
                  password,
                  role,
                  status,
                  department,
                  phone
                });

                toast.success('User updated successfully!');
                renderContent();
              }
            });
          });
        });
      };

      // Initial render of user rows
      renderUserTableRows(filterUsers());
    }

    // ==========================================
    // TAB 2: ALL CAMPUS REQUESTS & ITEMS (WITH CLICKABLE REDIRECT TO DETAILS)
    // ==========================================
    else if (activeTab === 'requests') {
      const filteredRequests = allRequests.filter(r => {
        if (reqFilter === 'open') return r.status === 'open';
        if (reqFilter === 'accepted') return ['accepted', 'handed_over', 'returned'].includes(r.status);
        if (reqFilter === 'completed') return r.status === 'completed';
        return true;
      });

      tabArea.innerHTML = `
        <div class="admin-section-glow glow-requests">
          <div class="admin-glass-panel" style="border-top: 3px solid #059669;">
            <div class="admin-glass-header flex justify-between items-center flex-wrap gap-2" style="background: rgba(236, 253, 245, 0.85); border-bottom: 1px solid rgba(167, 243, 208, 0.8);">
              <div class="flex items-center gap-3">
                <span style="display: inline-block; width: 12px; height: 12px; border-radius: 50%; background: #059669; box-shadow: 0 0 12px rgba(5, 150, 105, 0.8);"></span>
                <h2 class="text-lg font-bold" style="color: #065f46; margin: 0; font-size: 1.25rem;">Campus Equipment Requests</h2>
              </div>
              <span class="badge" style="background: rgba(5, 150, 105, 0.15); color: #047857; border: 1.5px solid rgba(5, 150, 105, 0.3); font-weight: 700; padding: 4px 10px; border-radius: var(--radius-sm);">
                ${allRequests.length} Total Requests
              </span>
            </div>

            <!-- Status Filter Pills Bar -->
            <div class="admin-glass-filter-bar" style="background: rgba(236, 253, 245, 0.65); border-bottom: 1px solid rgba(167, 243, 208, 0.8);">
              <button class="req-filter-btn btn btn-xs ${reqFilter === 'all' ? 'btn-primary' : 'btn-secondary glass-btn'}" data-req-filter="all">
                All (${allRequests.length})
              </button>
              <button class="req-filter-btn btn btn-xs ${reqFilter === 'open' ? 'btn-primary' : 'btn-secondary glass-btn'}" data-req-filter="open">
                Open (${openReqs})
              </button>
              <button class="req-filter-btn btn btn-xs ${reqFilter === 'accepted' ? 'btn-primary' : 'btn-secondary glass-btn'}" data-req-filter="accepted">
                In-Progress (${allRequests.filter(r => ['accepted', 'handed_over', 'returned'].includes(r.status)).length})
              </button>
              <button class="req-filter-btn btn btn-xs ${reqFilter === 'completed' ? 'btn-primary' : 'btn-secondary glass-btn'}" data-req-filter="completed">
                Completed (${completedReqs})
              </button>
            </div>

            <!-- Requests Section Frosted Green Glass Table -->
            <div class="table-requests-wrap">
              <table class="table-requests">
                <thead>
                  <tr>
                    <th style="width: 28%;"><span style="display: inline-block; width: 9px; height: 9px; border-radius: 50%; background: #059669; margin-right: 6px;"></span>Equipment / Item Name</th>
                    <th style="width: 14%;"><span style="display: inline-block; width: 9px; height: 9px; border-radius: 50%; background: #10b981; margin-right: 6px;"></span>Category & Qty</th>
                    <th style="width: 20%;"><span style="display: inline-block; width: 9px; height: 9px; border-radius: 50%; background: #047857; margin-right: 6px;"></span>Requester & Helper</th>
                    <th style="width: 12%;">Needed By</th>
                    <th style="width: 10%;">Status</th>
                    <th style="text-align: right; width: 16%;">Admin Control</th>
                  </tr>
                </thead>
                <tbody>
                  ${filteredRequests.length === 0 ? `
                    <tr><td colspan="6" style="padding: var(--space-8); text-align: center; color: #047857; font-weight: 500;">No campus requests found under this filter.</td></tr>
                  ` : filteredRequests.map((r, idx) => `
                    <tr style="border-bottom: 1px solid rgba(167, 243, 208, 0.5);">
                      <!-- Item Title with Direct Clickable Redirect -->
                      <td style="padding: var(--space-3) var(--space-4); border-right: 1px solid rgba(167, 243, 208, 0.4);">
                        <a href="#/requests/${escapeHTML(r.id)}" class="item-link" title="Click to view details of ${escapeHTML(r.itemName)}" style="color: #047857; font-weight: 700; text-decoration: underline; font-size: 0.95rem;">
                          ${escapeHTML(r.itemName || 'Equipment')}
                        </a>
                        <div class="text-xs" style="max-width: 250px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 2px; color: #475569;">
                          ${escapeHTML(r.description || 'No description provided')}
                        </div>
                      </td>
                      <td style="padding: var(--space-3) var(--space-4); border-right: 1px solid rgba(167, 243, 208, 0.4);">
                        <span class="badge" style="background: rgba(255, 255, 255, 0.9); border: 1px solid #a7f3d0; color: #065f46; font-weight: 600;">${escapeHTML(r.category || 'General')}</span>
                        <div class="text-xs" style="margin-top: 3px; color: #334155;">Qty: <strong style="color: #065f46;">${r.quantity || 1}</strong></div>
                      </td>
                      <td style="padding: var(--space-3) var(--space-4); font-size: var(--font-xs); border-right: 1px solid rgba(167, 243, 208, 0.4);">
                        <div style="color: #0f172a;">Requester: <strong style="color: #065f46;">${escapeHTML(r.requesterName || 'Student')}</strong></div>
                        ${r.helperName ? `<div style="color: #059669; font-weight: 600; margin-top: 2px;">Helper: ${escapeHTML(r.helperName)}</div>` : '<div style="color: #64748b; margin-top: 2px;">No helper assigned yet</div>'}
                      </td>
                      <td style="padding: var(--space-3) var(--space-4); font-size: var(--font-xs); border-right: 1px solid rgba(167, 243, 208, 0.4); color: #334155; font-weight: 600;">
                        ${r.neededBy ? new Date(r.neededBy).toLocaleDateString() : 'ASAP'}
                      </td>
                      <td style="padding: var(--space-3) var(--space-4); border-right: 1px solid rgba(167, 243, 208, 0.4);">
                        <span class="badge badge-status-${escapeHTML(r.status || 'open')}">
                          ${escapeHTML(r.status || 'OPEN')}
                        </span>
                      </td>
                      <td style="padding: var(--space-3) var(--space-4); text-align: right; white-space: nowrap;">
                        <div class="flex gap-1 justify-end flex-wrap items-center">
                          <a href="#/requests/${escapeHTML(r.id)}" class="btn btn-secondary btn-xs glass-btn" style="border: 1px solid #a7f3d0; background: rgba(255, 255, 255, 0.85); color: #065f46; font-weight: 600;">
                            View
                          </a>
                          ${r.status !== 'completed' ? `
                            <button class="btn btn-success btn-xs force-complete-req-btn" data-id="${escapeHTML(r.id)}" title="Force Mark Completed">
                              Complete
                            </button>
                          ` : ''}
                          ${r.status !== 'open' ? `
                            <button class="btn btn-secondary btn-xs force-reopen-req-btn glass-btn" data-id="${escapeHTML(r.id)}" title="Re-open Request to Feed" style="border: 1px solid #cbd5e1; background: rgba(255, 255, 255, 0.85);">
                              Reopen
                            </button>
                          ` : ''}
                          <button class="btn btn-danger btn-xs delete-req-btn" data-id="${escapeHTML(r.id)}" title="Permanently Delete Request">
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      `;

      // Filter clicks
      tabArea.querySelectorAll('.req-filter-btn').forEach(b => {
        b.addEventListener('click', () => {
          reqFilter = b.getAttribute('data-req-filter');
          renderContent();
        });
      });

      // Force Complete Request
      tabArea.querySelectorAll('.force-complete-req-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.getAttribute('data-id');
          await store.updateDoc('requests', id, { status: 'completed' });
          toast.success('Request marked as completed.');
          renderContent();
        });
      });

      // Force Reopen Request
      tabArea.querySelectorAll('.force-reopen-req-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.getAttribute('data-id');
          await store.updateDoc('requests', id, { status: 'open', helperId: null, helperName: null });
          toast.info('Request reopened to campus feed.');
          renderContent();
        });
      });

      // Delete Request
      tabArea.querySelectorAll('.delete-req-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.getAttribute('data-id');
          if (confirm('Permanently delete this item request record?')) {
            await store.deleteDoc('requests', id);
            toast.success('Request deleted.');
            renderContent();
          }
        });
      });
    }

    // ==========================================
    // TAB 3: CAMPUS EVENTS MANAGEMENT
    // ==========================================
    else if (activeTab === 'events') {
      tabArea.innerHTML = `
        <div class="admin-section-glow glow-events">
          <div class="admin-glass-panel" style="border-top: 3px solid #7c3aed;">
            <div class="admin-glass-header flex justify-between items-center flex-wrap gap-2" style="background: rgba(245, 243, 255, 0.85); border-bottom: 1px solid rgba(221, 214, 254, 0.8);">
              <div class="flex items-center gap-3">
                <span style="display: inline-block; width: 12px; height: 12px; border-radius: 50%; background: #7c3aed; box-shadow: 0 0 12px rgba(124, 58, 237, 0.8);"></span>
                <h2 class="text-lg font-bold" style="color: #5b21b6; margin: 0; font-size: 1.25rem;">Campus Events & Hackathons</h2>
              </div>
              <button id="admin-create-event-btn" class="btn btn-primary btn-sm" style="background: #7c3aed; border-color: #6d28d9; box-shadow: 0 4px 14px rgba(124, 58, 237, 0.35);">+ Create Event</button>
            </div>

            <!-- Events Section Frosted Violet Glass Table -->
            <div class="table-events-wrap">
              <table class="table-events">
                <thead>
                  <tr>
                    <th style="width: 32%;"><span style="display: inline-block; width: 9px; height: 9px; border-radius: 50%; background: #7c3aed; margin-right: 6px;"></span>Event Title & Description</th>
                    <th style="width: 15%;"><span style="display: inline-block; width: 9px; height: 9px; border-radius: 50%; background: #a855f7; margin-right: 6px;"></span>Type / Category</th>
                    <th style="width: 18%;">Venue</th>
                    <th style="width: 13%;">Join Code</th>
                    <th style="width: 10%;">Members</th>
                    <th style="text-align: right; width: 12%;">Admin Actions</th>
                  </tr>
                </thead>
                <tbody>
                  ${allEvents.length === 0 ? `
                    <tr><td colspan="6" style="padding: var(--space-8); text-align: center; color: #6d28d9; font-weight: 500;">No campus events registered yet.</td></tr>
                  ` : allEvents.map(e => `
                    <tr style="border-bottom: 1px solid rgba(221, 214, 254, 0.5);">
                      <td style="padding: var(--space-3) var(--space-4); border-right: 1px solid rgba(221, 214, 254, 0.4);">
                        <a href="#/events/${escapeHTML(e.id)}" style="color: #5b21b6; font-weight: 700; text-decoration: underline; font-size: 0.95rem;">
                          ${escapeHTML(e.title)}
                        </a>
                        <div class="text-xs" style="margin-top: 2px; color: #475569;">${escapeHTML(e.description || 'Campus coordination event.')}</div>
                      </td>
                      <td style="padding: var(--space-3) var(--space-4); border-right: 1px solid rgba(221, 214, 254, 0.4);">
                        <span class="badge" style="background: rgba(255, 255, 255, 0.9); border: 1px solid #c4b5fd; color: #6d28d9; font-weight: 600;">${escapeHTML(e.type || 'Event')}</span>
                      </td>
                      <td style="padding: var(--space-3) var(--space-4); font-size: var(--font-xs); border-right: 1px solid rgba(221, 214, 254, 0.4); color: #0f172a; font-weight: 500;">
                        ${escapeHTML(e.venue || 'Campus Main')}
                      </td>
                      <td style="padding: var(--space-3) var(--space-4); font-size: var(--font-xs); border-right: 1px solid rgba(221, 214, 254, 0.4);">
                        <span class="font-mono" style="background: rgba(255, 255, 255, 0.95); border: 1px solid #c4b5fd; color: #5b21b6; font-weight: 700; padding: 2px 7px; border-radius: var(--radius-sm); letter-spacing: 1px;">
                          ${escapeHTML(e.joinCode || 'N/A')}
                        </span>
                      </td>
                      <td style="padding: var(--space-3) var(--space-4); font-size: var(--font-xs); border-right: 1px solid rgba(221, 214, 254, 0.4); color: #0f172a; font-weight: 600;">
                        ${e.memberCount || 1} registered
                      </td>
                      <td style="padding: var(--space-3) var(--space-4); text-align: right; white-space: nowrap;">
                        <div class="flex gap-1 justify-end flex-wrap items-center">
                          <a href="#/events/${escapeHTML(e.id)}" class="btn btn-secondary btn-xs glass-btn" style="border: 1px solid #c4b5fd; background: rgba(255, 255, 255, 0.85); color: #5b21b6; font-weight: 600;">
                            View Feed
                          </a>
                          <button class="btn btn-danger btn-xs delete-event-btn" data-id="${escapeHTML(e.id)}" title="Delete Event">
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      `;

      // Admin Create Event Modal
      const createEvtBtn = tabArea.querySelector('#admin-create-event-btn');
      if (createEvtBtn) {
        createEvtBtn.addEventListener('click', () => {
          modal.open({
            title: 'Admin: Create New Campus Event',
            contentHTML: `
              <div class="form-group">
                <label class="form-label" for="evt-title">Event Title <span class="required">*</span></label>
                <input type="text" id="evt-title" class="form-input" placeholder="e.g. Robocon Workshop 2026" required>
              </div>
              <div class="form-group">
                <label class="form-label" for="evt-type">Type</label>
                <select id="evt-type" class="form-select">
                  <option value="Hackathon">Hackathon</option>
                  <option value="Cultural Fest">Cultural Fest</option>
                  <option value="Workshop">Workshop</option>
                  <option value="Sports Tournament">Sports Tournament</option>
                  <option value="Exhibition">Exhibition / Project Expo</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label" for="evt-venue">Campus Venue</label>
                <input type="text" id="evt-venue" class="form-input" placeholder="Main Auditorium" required>
              </div>
              <div class="form-group">
                <label class="form-label" for="evt-code">Join Code (Students use this)</label>
                <input type="text" id="evt-code" class="form-input font-mono" value="CAMPUS26" required>
              </div>
              <div class="form-group">
                <label class="form-label" for="evt-desc">Event Description</label>
                <textarea id="evt-desc" class="form-textarea" rows="2" placeholder="Equipment sharing details..."></textarea>
              </div>
            `,
            confirmText: 'Publish Event',
            onConfirm: async () => {
              const title = document.getElementById('evt-title').value.trim();
              const type = document.getElementById('evt-type').value;
              const venue = document.getElementById('evt-venue').value.trim();
              const joinCode = document.getElementById('evt-code').value.trim().toUpperCase();
              const description = document.getElementById('evt-desc').value.trim();

              if (!title) { toast.error('Title is required.'); throw new Error(); }

              const id = 'evt_' + Math.random().toString(36).substring(2, 9);
              await store.setDoc('events', id, {
                id,
                title,
                type,
                venue,
                joinCode,
                description,
                createdBy: user?.uid || 'usr_admin',
                creatorName: 'Campus Administrator',
                isActive: true,
                memberCount: 1,
                createdAt: new Date().toISOString()
              });

              toast.success(`Published event "${title}"!`);
              renderContent();
            }
          });
        });
      }

      // Delete Event
      tabArea.querySelectorAll('.delete-event-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.getAttribute('data-id');
          if (confirm('Delete this event and all associated sharing data?')) {
            await store.deleteDoc('events', id);
            toast.success('Event deleted.');
            renderContent();
          }
        });
      });
    }

    // ==========================================
    // TAB 4: DAMAGE DISPUTES & PENALTIES
    // ==========================================
    else if (activeTab === 'reports') {
      const filteredReports = allReports.filter(r => {
        if (reportFilter === 'pending') return r.status !== 'resolved';
        if (reportFilter === 'resolved') return r.status === 'resolved';
        return true;
      });

      tabArea.innerHTML = `
        <div class="admin-section-glow glow-reports">
          <div class="admin-glass-panel" style="border-top: 3px solid #dc2626;">
            <div class="admin-glass-header flex justify-between items-center flex-wrap gap-2" style="background: rgba(254, 242, 242, 0.85); border-bottom: 1px solid rgba(254, 202, 202, 0.8);">
              <div class="flex items-center gap-3">
                <span style="display: inline-block; width: 12px; height: 12px; border-radius: 50%; background: #dc2626; box-shadow: 0 0 12px rgba(220, 38, 38, 0.8);"></span>
                <h2 class="text-lg font-bold" style="color: #991b1b; margin: 0; font-size: 1.25rem;">Equipment Damage Disputes</h2>
              </div>
              <span class="badge" style="background: rgba(220, 38, 38, 0.15); color: #dc2626; border: 1.5px solid rgba(220, 38, 38, 0.3); font-weight: 700; padding: 4px 10px; border-radius: var(--radius-sm);">
                ${pendingDisputes} Pending Review
              </span>
            </div>

            <!-- Filter Pills Bar -->
            <div class="admin-glass-filter-bar" style="background: rgba(254, 242, 242, 0.65); border-bottom: 1px solid rgba(254, 202, 202, 0.8);">
              <button class="rep-filter-btn btn btn-xs ${reportFilter === 'all' ? 'btn-primary' : 'btn-secondary glass-btn'}" data-rep-filter="all">
                All (${allReports.length})
              </button>
              <button class="rep-filter-btn btn btn-xs ${reportFilter === 'pending' ? 'btn-primary' : 'btn-secondary glass-btn'}" data-rep-filter="pending">
                Pending (${pendingDisputes})
              </button>
              <button class="rep-filter-btn btn btn-xs ${reportFilter === 'resolved' ? 'btn-primary' : 'btn-secondary glass-btn'}" data-rep-filter="resolved">
                Resolved (${allReports.filter(r => r.status === 'resolved').length})
              </button>
            </div>

            <!-- Disputes Section Frosted Red Glass Table -->
            <div class="table-reports-wrap">
              <table class="table-reports">
                <thead>
                  <tr>
                    <th style="width: 18%;"><span style="display: inline-block; width: 9px; height: 9px; border-radius: 50%; background: #dc2626; margin-right: 6px;"></span>Dispute & Request</th>
                    <th style="width: 12%;">Status</th>
                    <th style="width: 32%;">Owner's Damage Claim</th>
                    <th style="width: 22%;">Borrower's Rebuttal</th>
                    <th style="text-align: right; width: 16%;">Admin Decision</th>
                  </tr>
                </thead>
                <tbody>
                  ${filteredReports.length === 0 ? `
                    <tr><td colspan="5" style="padding: var(--space-8); text-align: center; color: #991b1b; font-weight: 500;">No damage reports match the current filter.</td></tr>
                  ` : filteredReports.map(r => {
                    const isResolved = r.status === 'resolved';
                    return `
                      <tr style="border-bottom: 1px solid rgba(254, 202, 202, 0.5); border-left: 4px solid ${isResolved ? 'var(--color-success)' : 'var(--color-danger)'};">
                        <td style="padding: var(--space-3) var(--space-4); border-right: 1px solid rgba(254, 202, 202, 0.4);">
                          <div style="font-weight: 700; color: #991b1b;">Dispute #${escapeHTML(r.id)}</div>
                          <div style="margin-top: 3px; font-size: var(--font-xs);">
                            Req: <a href="#/requests/${escapeHTML(r.requestId)}" style="color: var(--color-primary); font-weight: 600; text-decoration: underline;">#${escapeHTML(r.requestId)}</a>
                          </div>
                          <div class="text-xs text-muted" style="margin-top: 2px;">${new Date(r.createdAt).toLocaleDateString()}</div>
                        </td>
                        <td style="padding: var(--space-3) var(--space-4); border-right: 1px solid rgba(254, 202, 202, 0.4);">
                          <span class="badge ${isResolved ? 'badge-status-completed' : 'badge-status-open'}">
                            ${escapeHTML(r.status ? r.status.toUpperCase() : 'SUBMITTED')}
                          </span>
                        </td>
                        <td style="padding: var(--space-3) var(--space-4); border-right: 1px solid rgba(254, 202, 202, 0.4); font-size: var(--font-xs);">
                          <div style="background: rgba(255, 255, 255, 0.9); padding: var(--space-2) var(--space-3); border-radius: var(--radius-sm); border: 1px solid rgba(254, 202, 202, 0.8); color: #0f172a; line-height: 1.4;">
                            ${escapeHTML(r.description || 'No description filed')}
                          </div>
                        </td>
                        <td style="padding: var(--space-3) var(--space-4); border-right: 1px solid rgba(254, 202, 202, 0.4); font-size: var(--font-xs);">
                          ${r.borrowerResponse ? `
                            <div style="background: rgba(240, 253, 244, 0.9); padding: var(--space-2) var(--space-3); border-radius: var(--radius-sm); border: 1px solid #bbf7d0; color: #166534; line-height: 1.4;">
                              ${escapeHTML(r.borrowerResponse)}
                            </div>
                          ` : '<span style="color: #64748b; font-style: italic;">No rebuttal filed</span>'}
                        </td>
                        <td style="padding: var(--space-3) var(--space-4); text-align: right; white-space: nowrap;">
                          <div class="flex gap-1 justify-end flex-wrap items-center">
                            <a href="#/requests/${escapeHTML(r.requestId)}" class="btn btn-secondary btn-xs glass-btn" style="border: 1px solid rgba(254, 202, 202, 0.8); background: rgba(255, 255, 255, 0.85); color: #991b1b; font-weight: 600;">
                              Details
                            </a>
                            <button class="btn btn-primary btn-xs resolve-dispute-btn" data-id="${escapeHTML(r.id)}" data-req="${escapeHTML(r.requestId)}" data-borrower="${escapeHTML(r.borrowerId)}" style="background: #dc2626; border-color: #b91c1c;">
                              ${isResolved ? 'Verdict' : 'Decide'}
                            </button>
                            <button class="btn btn-danger btn-xs delete-report-btn" data-id="${escapeHTML(r.id)}">
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      `;

      // Filter clicks
      tabArea.querySelectorAll('.rep-filter-btn').forEach(b => {
        b.addEventListener('click', () => {
          reportFilter = b.getAttribute('data-rep-filter');
          renderContent();
        });
      });

      // Resolve Dispute Modal
      tabArea.querySelectorAll('.resolve-dispute-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const reportId = btn.getAttribute('data-id');

          modal.open({
            title: `Administrative Decision: Dispute #${reportId}`,
            contentHTML: `
              <div class="form-group">
                <label class="form-label" for="decision-action">Action / Penalty Verdict <span class="required">*</span></label>
                <select id="decision-action" class="form-select">
                  <option value="dismissed">Dismiss Report (No fault found / Accidental wear)</option>
                  <option value="warning">Issue Official Warning to Borrower</option>
                  <option value="restriction">Impose Borrowing Restriction</option>
                  <option value="compensation_required">Require Direct Compensation Note</option>
                </select>
              </div>
              <div class="form-group" id="restriction-days-group">
                <label class="form-label" for="decision-days">Restriction Duration (Days)</label>
                <select id="decision-days" class="form-select">
                  <option value="7">7 Days</option>
                  <option value="14">14 Days</option>
                  <option value="30">30 Days</option>
                  <option value="60">60 Days</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label" for="decision-note">Official Findings & Resolution Note</label>
                <textarea id="decision-note" class="form-textarea" rows="3" placeholder="Explain the rationale for this finding..."></textarea>
              </div>
            `,
            confirmText: 'Execute Decision',
            onConfirm: async () => {
              const action = document.getElementById('decision-action').value;
              const restrictionDays = action === 'restriction' ? parseInt(document.getElementById('decision-days').value, 10) : 0;
              const note = document.getElementById('decision-note').value;

              await reportsService.resolveReport({
                reportId,
                reviewerUser: user || { uid: 'usr_admin', name: 'Campus Administrator', role: 'admin' },
                action,
                restrictionDays,
                note
              });

              toast.success('Dispute decision issued and applied!');
              renderContent();
            }
          });
        });
      });

      // Delete Report
      tabArea.querySelectorAll('.delete-report-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.getAttribute('data-id');
          if (confirm('Delete this damage report permanently?')) {
            await store.deleteDoc('damageReports', id);
            toast.success('Report deleted.');
            renderContent();
          }
        });
      });
    }

    // ==========================================
    // TAB 5: CAMPUS LANDMARKS
    // ==========================================
    else if (activeTab === 'landmarks') {
      tabArea.innerHTML = `
        <div class="admin-section-glow glow-landmarks">
          <div class="admin-glass-panel" style="border-top: 3px solid #d97706;">
            <div class="admin-glass-header flex justify-between items-center flex-wrap gap-2" style="background: rgba(255, 251, 235, 0.85); border-bottom: 1px solid rgba(253, 230, 138, 0.8);">
              <div class="flex items-center gap-3">
                <span style="display: inline-block; width: 12px; height: 12px; border-radius: 50%; background: #d97706; box-shadow: 0 0 12px rgba(217, 119, 6, 0.8);"></span>
                <h2 class="text-lg font-bold" style="color: #92400e; margin: 0; font-size: 1.25rem;">Campus Meeting Landmarks</h2>
              </div>
              <button id="add-landmark-btn" class="btn btn-primary btn-sm" style="background: #d97706; border-color: #b45309; box-shadow: 0 4px 14px rgba(217, 119, 6, 0.35);">+ Add Landmark</button>
            </div>

            <!-- Landmarks Section Frosted Amber Glass Table -->
            <div class="table-landmarks-wrap">
              <table class="table-landmarks">
                <thead>
                  <tr>
                    <th style="width: 35%;"><span style="display: inline-block; width: 9px; height: 9px; border-radius: 50%; background: #d97706; margin-right: 6px;"></span>Landmark Name</th>
                    <th style="width: 25%;"><span style="display: inline-block; width: 9px; height: 9px; border-radius: 50%; background: #f59e0b; margin-right: 6px;"></span>Category</th>
                    <th style="width: 25%;">Coordinates</th>
                    <th style="text-align: right; width: 15%;">Admin Actions</th>
                  </tr>
                </thead>
                <tbody>
                  ${landmarks.length === 0 ? `
                    <tr><td colspan="4" style="padding: var(--space-8); text-align: center; color: #92400e; font-weight: 500;">No meeting landmarks configured.</td></tr>
                  ` : landmarks.map(lm => `
                    <tr style="border-bottom: 1px solid rgba(253, 230, 138, 0.5);">
                      <td style="padding: var(--space-3) var(--space-4); border-right: 1px solid rgba(253, 230, 138, 0.4);">
                        <div style="font-weight: 700; color: #92400e; font-size: 0.95rem;">${escapeHTML(lm.name)}</div>
                        <div class="text-xs" style="color: #64748b; margin-top: 2px;">Campus handover waypoint</div>
                      </td>
                      <td style="padding: var(--space-3) var(--space-4); border-right: 1px solid rgba(253, 230, 138, 0.4);">
                        <span class="badge" style="background: rgba(255, 255, 255, 0.9); border: 1px solid #fde68a; color: #b45309; font-weight: 600;">${escapeHTML(lm.category)}</span>
                      </td>
                      <td style="padding: var(--space-3) var(--space-4); font-size: var(--font-xs); border-right: 1px solid rgba(253, 230, 138, 0.4);">
                        <span class="font-mono" style="background: rgba(255, 255, 255, 0.95); border: 1px solid #fde68a; color: #78350f; font-weight: 700; padding: 3px 8px; border-radius: var(--radius-sm);">
                          Lat: ${lm.lat}, Lng: ${lm.lng}
                        </span>
                      </td>
                      <td style="padding: var(--space-3) var(--space-4); text-align: right; white-space: nowrap;">
                        <button class="btn btn-danger btn-xs delete-lm-btn" data-id="${escapeHTML(lm.id)}" title="Delete Landmark">
                          Delete
                        </button>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      `;

      // Add Landmark Modal
      const addLmBtn = tabArea.querySelector('#add-landmark-btn');
      if (addLmBtn) {
        addLmBtn.addEventListener('click', () => {
          modal.open({
            title: 'Add New Campus Landmark',
            contentHTML: `
              <div class="form-group">
                <label class="form-label" for="lm-name">Landmark Name <span class="required">*</span></label>
                <input type="text" id="lm-name" class="form-input" placeholder="e.g. Innovation Center, North Gate" required>
              </div>
              <div class="form-group">
                <label class="form-label" for="lm-cat">Category <span class="required">*</span></label>
                <select id="lm-cat" class="form-select" required>
                  <option value="Academic">Academic</option>
                  <option value="Food">Food / Canteen</option>
                  <option value="Recreation">Recreation / Sports</option>
                  <option value="Gate">Campus Gate</option>
                  <option value="Admin">Admin Building</option>
                </select>
              </div>
              <div class="flex gap-4">
                <div class="form-group flex-1">
                  <label class="form-label" for="lm-lat">Latitude</label>
                  <input type="number" step="0.000001" id="lm-lat" class="form-input" value="12.9716" required>
                </div>
                <div class="form-group flex-1">
                  <label class="form-label" for="lm-lng">Longitude</label>
                  <input type="number" step="0.000001" id="lm-lng" class="form-input" value="77.5946" required>
                </div>
              </div>
            `,
            confirmText: 'Add Landmark',
            onConfirm: async () => {
              const name = document.getElementById('lm-name').value.trim();
              const category = document.getElementById('lm-cat').value;
              const lat = parseFloat(document.getElementById('lm-lat').value);
              const lng = parseFloat(document.getElementById('lm-lng').value);

              if (!name) { toast.error('Landmark name is required.'); throw new Error(); }

              const id = 'lm_' + Math.random().toString(36).substring(2, 7);
              await store.setDoc('landmarks', id, {
                id,
                name,
                category,
                lat,
                lng,
                order: landmarks.length + 1
              });
              toast.success(`Added landmark "${name}"!`);
              renderContent();
            }
          });
        });
      }

      // Delete Landmark
      tabArea.querySelectorAll('.delete-lm-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.getAttribute('data-id');
          if (confirm('Delete this landmark from meeting options?')) {
            await store.deleteDoc('landmarks', id);
            toast.success('Landmark deleted.');
            renderContent();
          }
        });
      });
    }

    // Export DB Handler
    const exportBtn = container.querySelector('#export-db-btn');
    if (exportBtn) {
      exportBtn.addEventListener('click', async () => {
        const dump = {
          exportedAt: new Date().toISOString(),
          users: allUsers,
          requests: allRequests,
          events: allEvents,
          reports: allReports,
          landmarks: landmarks
        };
        const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `sharebox_backup_${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('Database backup exported successfully!');
      });
    }

    // Reset DB to Seeds Handler
    const resetBtn = container.querySelector('#reset-db-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', async () => {
        if (confirm('WARNING: This will wipe custom test data and restore baseline seed accounts (Admin, Organizer, Student) with password "password123". Continue?')) {
          await store.resetDatabase();
          toast.success('Database reset to clean seed state!');
          renderContent();
        }
      });
    }

    // Main Tab button bindings
    container.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        activeTab = btn.getAttribute('data-tab');
        renderContent();
      });
    });
  };

  await renderContent();
}
