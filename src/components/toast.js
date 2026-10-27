import { escapeHTML } from '../utils/sanitize.js';
import { getPlainEnglishError } from '../utils/errors.js';

class ToastManager {
  constructor() {
    this.container = null;
  }

  ensureContainer() {
    if (!this.container) {
      this.container = document.getElementById('toast-container');
      if (!this.container) {
        this.container = document.createElement('div');
        this.container.id = 'toast-container';
        this.container.className = 'toast-container';
        this.container.setAttribute('role', 'region');
        this.container.setAttribute('aria-live', 'polite');
        document.body.appendChild(this.container);
      }
    }
    return this.container;
  }

  show(message, type = 'info', duration = 4500) {
    const container = this.ensureContainer();

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.setAttribute('role', 'alert');

    const iconMap = {
      success: '✓',
      error: '⚠️',
      warning: 'ℹ️',
      info: 'ℹ️'
    };

    const displayText = typeof message === 'string' ? message : message?.message || 'Action failed.';

    toast.innerHTML = `
      <span class="toast-icon" style="font-weight: bold; font-size: 16px;">${iconMap[type] || 'ℹ️'}</span>
      <div style="flex: 1; display: flex; flex-direction: column; gap: 2px;">
        ${type === 'error' ? `<strong style="font-size: 12px; color: var(--color-danger); text-transform: uppercase; letter-spacing: 0.04em;">Problem Encountered</strong>` : ''}
        <span class="toast-message" style="font-size: 13px; line-height: 1.35;">${escapeHTML(displayText)}</span>
      </div>
      <button class="toast-close" style="opacity: 0.6; cursor: pointer; padding: 0 4px; font-size: 16px; align-self: flex-start;" aria-label="Close notification">×</button>
    `;

    const closeBtn = toast.querySelector('.toast-close');
    let timerId;

    const removeToast = () => {
      if (timerId) clearTimeout(timerId);
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.2s ease-out';
      setTimeout(() => toast.remove(), 200);
    };

    closeBtn.addEventListener('click', removeToast);
    timerId = setTimeout(removeToast, duration);

    container.appendChild(toast);
  }

  success(msg, duration) { this.show(msg, 'success', duration); }
  error(err, duration = 6000) {
    const plainEnglish = getPlainEnglishError(err);
    this.show(plainEnglish, 'error', duration);
  }
  warning(msg, duration) { this.show(msg, 'warning', duration); }
  info(msg, duration) { this.show(msg, 'info', duration); }
}

export const toast = new ToastManager();
