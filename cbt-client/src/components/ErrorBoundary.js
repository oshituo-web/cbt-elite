export const ErrorBoundary = {
  showError(errorMsg, errorDetails = '') {
    // Prevent multiple error modals from stacking
    if (document.getElementById('error-boundary-modal')) return;

    const modal = document.createElement('div');
    modal.id = 'error-boundary-modal';
    modal.className = 'modal-overlay';
    modal.style.display = 'flex';
    modal.style.zIndex = '999999';

    modal.innerHTML = `
      <div class="modal-content glass" style="max-width: 450px; padding: 2.5rem; text-align: center; border-radius: 24px; border-left: 4px solid var(--error);">
        <div style="background: rgba(239, 68, 68, 0.1); width: 64px; height: 64px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 1.5rem auto;">
          <i data-lucide="alert-triangle" style="color: var(--error); width: 32px; height: 32px;"></i>
        </div>
        <h2 style="font-family: 'Outfit'; font-weight: 800; color: var(--text-primary); margin-bottom: 1rem;">Oops! Something went wrong</h2>
        <p style="font-size: 0.95rem; color: var(--text-secondary); margin-bottom: 0.5rem;">
          We encountered an unexpected error. Please try reloading the application.
        </p>
        ${errorDetails ? `<p style="font-size: 0.75rem; color: var(--text-secondary); opacity: 0.7; margin-bottom: 1.5rem; font-family: monospace; word-break: break-all;">${errorDetails}</p>` : ''}
        
        <div style="display: flex; gap: 1rem; justify-content: center; margin-top: 2rem;">
          <button id="error-reload-btn" class="btn-primary" style="background: var(--error); padding: 0 1.5rem; height: 48px; border-radius: 12px; font-weight: 800; flex: 1;">
            <i data-lucide="refresh-cw" style="width: 18px; margin-right: 0.5rem;"></i> RELOAD APP
          </button>
          <button id="error-dismiss-btn" class="btn-secondary" style="padding: 0 1.5rem; height: 48px; border-radius: 12px; font-weight: 800;">
            DISMISS
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    if (window.lucide) {
      window.lucide.createIcons({ root: modal });
    }

    document.getElementById('error-reload-btn').onclick = () => {
      window.location.reload(true);
    };

    document.getElementById('error-dismiss-btn').onclick = () => {
      modal.remove();
    };
  }
};
