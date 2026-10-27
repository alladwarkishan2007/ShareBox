import { escapeHTML } from '../utils/sanitize.js';

class ModalManager {
  constructor() {
    this.container = null;
    this.activeCloseHandler = null;
  }

  ensureContainer() {
    if (!this.container) {
      this.container = document.getElementById('modal-container');
      if (!this.container) {
        this.container = document.createElement('div');
        this.container.id = 'modal-container';
        this.container.className = 'modal-container';
        document.body.appendChild(this.container);
      }
    }
    return this.container;
  }

  open({ title, contentHTML, footerHTML, onConfirm, onCancel, confirmText = 'Confirm', cancelText = 'Cancel', showCancel = true }) {
    const container = this.ensureContainer();

    container.innerHTML = `
      <div class="modal-backdrop" aria-hidden="true"></div>
      <div class="modal-dialog" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div class="modal-header">
          <h3 id="modal-title" class="text-lg font-bold">${escapeHTML(title)}</h3>
          <button class="btn btn-icon modal-close-btn" aria-label="Close dialog">✕</button>
        </div>
        <div class="modal-body">
          ${contentHTML}
        </div>
        ${footerHTML ? `<div class="modal-footer">${footerHTML}</div>` : `
          <div class="modal-footer">
            ${showCancel ? `<button class="btn btn-secondary modal-cancel-btn">${escapeHTML(cancelText)}</button>` : ''}
            <button class="btn btn-primary modal-confirm-btn">${escapeHTML(confirmText)}</button>
          </div>
        `}
      </div>
    `;

    container.classList.add('active');
    container.setAttribute('aria-hidden', 'false');

    const closeBtn = container.querySelector('.modal-close-btn');
    const cancelBtn = container.querySelector('.modal-cancel-btn');
    const confirmBtn = container.querySelector('.modal-confirm-btn');
    const backdrop = container.querySelector('.modal-backdrop');

    const handleClose = () => {
      this.close();
      if (onCancel) onCancel();
    };

    if (closeBtn) closeBtn.addEventListener('click', handleClose);
    if (cancelBtn) cancelBtn.addEventListener('click', handleClose);
    if (backdrop) backdrop.addEventListener('click', handleClose);

    if (confirmBtn) {
      confirmBtn.addEventListener('click', async () => {
        if (onConfirm) {
          confirmBtn.disabled = true;
          try {
            await onConfirm();
            this.close();
          } catch (err) {
            confirmBtn.disabled = false;
          }
        } else {
          this.close();
        }
      });
    }

    const handleKeydown = (e) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeydown, { once: true });
  }

  close() {
    if (this.container) {
      this.container.classList.remove('active');
      this.container.setAttribute('aria-hidden', 'true');
      this.container.innerHTML = '';
    }
  }
}

export const modal = new ModalManager();
