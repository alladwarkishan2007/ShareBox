import { callService } from '../services/call.service.js';
import { escapeHTML } from '../utils/sanitize.js';

export class CallModal {
  constructor() {
    this.modalEl = null;
    this.timerInterval = null;
    this.durationSeconds = 0;
    this.audioEl = null;
  }

  show({ partnerName, isCaller = false, onHangUp }) {
    this.close();

    this.modalEl = document.createElement('div');
    this.modalEl.className = 'call-overlay';

    this.modalEl.innerHTML = `
      <div class="call-card">
        <div class="call-avatar">
          <div class="call-pulse"></div>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>
        </div>

        <div>
          <h3 class="text-lg font-bold">${escapeHTML(partnerName || 'Peer Member')}</h3>
          <p id="call-status-label" class="text-sm text-muted">${isCaller ? 'Calling...' : 'Connecting...'}</p>
          <p id="call-duration-timer" class="text-md font-bold" style="margin-top: 4px; color: var(--color-primary);">00:00</p>
        </div>

        <div class="flex items-center justify-center gap-4" style="margin-top: var(--space-2);">
          <button id="call-mute-btn" class="btn btn-secondary btn-icon" style="width: 48px; height: 48px; border-radius: 50%;" title="Mute Microphone">
            <svg id="mute-icon-svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>
          </button>

          <button id="call-hangup-btn" class="btn btn-danger btn-icon" style="width: 54px; height: 54px; border-radius: 50%;" title="End Call">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91"></path><line x1="23" y1="1" x2="1" y2="23"></line></svg>
          </button>
        </div>
      </div>
      <audio id="remote-call-audio" autoplay style="display: none;"></audio>
    `;

    document.body.appendChild(this.modalEl);
    this.audioEl = this.modalEl.querySelector('#remote-call-audio');

    // Mute toggle
    const muteBtn = this.modalEl.querySelector('#call-mute-btn');
    let isMuted = false;
    muteBtn.addEventListener('click', () => {
      isMuted = callService.toggleMute();
      muteBtn.innerHTML = isMuted 
        ? `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="1" y1="1" x2="23" y2="23"></line><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"></path><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>`
        : `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>`;
      muteBtn.style.backgroundColor = isMuted ? 'var(--color-danger-light)' : 'var(--bg-subtle)';
    });

    // Hangup
    const hangupBtn = this.modalEl.querySelector('#call-hangup-btn');
    hangupBtn.addEventListener('click', () => {
      this.close();
      if (onHangUp) onHangUp();
    });
  }

  setConnected(stream) {
    if (this.audioEl && stream) {
      this.audioEl.srcObject = stream;
    }

    if (this.modalEl) {
      const statusLabel = this.modalEl.querySelector('#call-status-label');
      if (statusLabel) statusLabel.textContent = 'Voice Call Active';

      // Start duration timer
      this.durationSeconds = 0;
      const timerLabel = this.modalEl.querySelector('#call-duration-timer');
      if (this.timerInterval) clearInterval(this.timerInterval);

      this.timerInterval = setInterval(() => {
        this.durationSeconds++;
        const mins = String(Math.floor(this.durationSeconds / 60)).padStart(2, '0');
        const secs = String(this.durationSeconds % 60).padStart(2, '0');
        if (timerLabel) timerLabel.textContent = `${mins}:${secs}`;
      }, 1000);
    }
  }

  close() {
    if (this.timerInterval) clearInterval(this.timerInterval);
    if (this.audioEl) {
      this.audioEl.srcObject = null;
      this.audioEl = null;
    }
    if (this.modalEl) {
      this.modalEl.remove();
      this.modalEl = null;
    }
  }
}

export const callModal = new CallModal();
