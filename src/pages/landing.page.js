import { escapeHTML } from '../utils/sanitize.js';

export async function renderLandingPage(container, { user } = {}) {
  container.innerHTML = `
    <div class="hero-section">
      <div class="container">
        <div style="display: flex; align-items: center; justify-content: center; gap: 1rem; margin-bottom: var(--space-4); flex-wrap: wrap;">
          <div class="hero-logo-box" title="ShareBox Platform" style="margin-bottom: 0;">
            <svg width="44" height="44" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20 7h-4V4c0-1.1-.9-2-2-2h-4c-1.1 0-2 .9-2 2v3H4c-1.1 0-2 .9-2 2v11c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2zm-6-3v3h-4V4h4zm6 16H4V9h16v11z"/>
            </svg>
          </div>
          <h1 class="hero-title" style="margin-bottom: 0;">ShareBox</h1>
        </div>
        <p class="hero-subtitle">
          The smart, autonomous campus resource and equipment coordination platform. Never lose or scramble for cables, tools, or hardware during college events again.
        </p>
        <div class="hero-actions" style="display: flex; gap: 12px; justify-content: center; align-items: center; flex-wrap: wrap;">
          ${user ? `
            <a href="#/dashboard" class="btn btn-primary btn-lg">Go to Feed & Dashboard</a>
            <a href="#/requests/new" class="btn btn-secondary btn-lg">+ Post Request</a>
          ` : `
            <a href="#/signup" class="btn btn-primary btn-lg">Join Campus Platform</a>
            <a href="#/login" class="btn btn-secondary btn-lg">Sign In</a>
          `}
        </div>

        <div class="feature-grid">
          <div class="card feature-card">
            <div class="card-body">
              <div class="feature-icon" style="width: 48px; height: 48px; border-radius: 12px; background: #fef3c7; color: #d97706; display: flex; align-items: center; justify-content: center; margin-bottom: 14px;">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
              </div>
              <h3 class="text-md font-bold" style="margin-bottom: 8px;">Real-Time Item Requests</h3>
              <p class="text-sm">Post what you need for your workshop, lab, or hackathon. Fellow campus members accept instantly with race-free transaction safety.</p>
            </div>
          </div>

          <div class="card feature-card">
            <div class="card-body">
              <div class="feature-icon" style="width: 48px; height: 48px; border-radius: 12px; background: #e0f2fe; color: #0284c7; display: flex; align-items: center; justify-content: center; margin-bottom: 14px;">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
              </div>
              <h3 class="text-md font-bold" style="margin-bottom: 8px;">Privacy-First Meeting Points</h3>
              <p class="text-sm">Coordinate handovers using one-time location assistance and campus landmarks. Zero continuous tracking, zero live location storage.</p>
            </div>
          </div>

          <div class="card feature-card">
            <div class="card-body">
              <div class="feature-icon" style="width: 48px; height: 48px; border-radius: 12px; background: #dcfce7; color: #16a34a; display: flex; align-items: center; justify-content: center; margin-bottom: 14px;">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
              </div>
              <h3 class="text-md font-bold" style="margin-bottom: 8px;">Damage & Penalty System</h3>
              <p class="text-sm">Two-way verified condition logs, damage reporting, borrower rebuttal, and organizer-enforced borrowing restrictions keep everyone accountable.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}
