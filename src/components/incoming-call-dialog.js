import { escapeHTML } from '../utils/sanitize.js';

export class IncomingCallDialog {
  constructor() {
    this.dialogEl = null;
    this.audioContext = null;
    this.ringInterval = null;
  }

  show({ callerName, onAccept, onDecline }) {
    this.close();

    this.dialogEl = document.createElement('div');
    this.dialogEl.className = 'modal-container active';
    this.dialogEl.style.zIndex = 'var(--z-call)';

    this.dialogEl.innerHTML = `
      <div class="modal-backdrop"></div>
      <div class="modal-dialog text-center" style="max-width: 360px; padding: var(--space-6);">
        <div class="call-avatar" style="margin: 0 auto var(--space-4);">
          <div class="call-pulse"></div>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
        </div>

        <h3 class="text-lg font-bold">${escapeHTML(callerName || 'Campus Member')}</h3>
        <p class="text-sm text-muted" style="margin-bottom: var(--space-6);">Incoming Voice Call...</p>

        <div class="flex justify-center gap-4">
          <button id="decline-call-btn" class="btn btn-danger btn-lg" style="border-radius: var(--radius-full); width: 110px;">
            Decline
          </button>
          <button id="accept-call-btn" class="btn btn-success btn-lg" style="border-radius: var(--radius-full); width: 110px;">
            Accept
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(this.dialogEl);
    this.startRingTone();

    this.dialogEl.querySelector('#accept-call-btn').addEventListener('click', () => {
      this.close();
      if (onAccept) onAccept();
    });

    this.dialogEl.querySelector('#decline-call-btn').addEventListener('click', () => {
      this.close();
      if (onDecline) onDecline();
    });
  }

  startRingTone() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      this.audioContext = new AudioCtx();

      const playBeep = () => {
        if (!this.audioContext || this.audioContext.state === 'closed') return;
        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, this.audioContext.currentTime); // A4
        gain.gain.setValueAtTime(0.1, this.audioContext.currentTime);

        osc.connect(gain);
        gain.connect(this.audioContext.destination);

        osc.start();
        osc.stop(this.audioContext.currentTime + 0.8);
      };

      playBeep();
      this.ringInterval = setInterval(playBeep, 2000);
    } catch (e) {
      console.warn('Audio ringtone error:', e);
    }
  }

  stopRingTone() {
    if (this.ringInterval) clearInterval(this.ringInterval);
    if (this.audioContext) {
      try { this.audioContext.close(); } catch (e) {}
      this.audioContext = null;
    }
  }

  close() {
    this.stopRingTone();
    if (this.dialogEl) {
      this.dialogEl.remove();
      this.dialogEl = null;
    }
  }
}

export const incomingCallDialog = new IncomingCallDialog();
