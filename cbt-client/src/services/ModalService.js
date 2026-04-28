/**
 * ModalService.js
 * Centralized high-fidelity modal management for the Elite platform.
 * Replaces native alert(), confirm(), and prompt().
 */

export const ModalService = {
  /**
   * Shows a premium alert modal.
   */
  async alert(title, message, type = 'info') {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay fade-in';
      overlay.style = "position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.85); z-index:9999999; display:flex; justify-content:center; align-items:center; backdrop-filter:blur(8px); padding: 1.5rem;";
      
      const accentColor = type === 'error' ? 'var(--error)' : type === 'success' ? 'var(--success)' : 'var(--accent-primary)';
      const icon = type === 'error' ? 'shield-alert' : type === 'success' ? 'check-circle' : 'info';

      overlay.innerHTML = `
        <div class="glass card scale-in" style="width:100%; max-width:420px; padding:2rem; border-radius:28px; border: 2px solid ${accentColor}; text-align:center; box-shadow: 0 20px 50px rgba(0,0,0,0.4);">
          <div style="width:60px; height:60px; background:${accentColor}15; color:${accentColor}; border-radius:50%; display:flex; align-items:center; justify-content:center; margin:0 auto 1.5rem; border: 1.5px solid ${accentColor}30;">
             <i data-lucide="${icon}" style="width:30px; height:30px;"></i>
          </div>
          <h3 style="font-family:'Outfit'; font-weight:900; font-size:1.5rem; color:var(--text-primary); margin-bottom:0.75rem;">${title}</h3>
          <p style="font-size:0.95rem; color:var(--text-secondary); line-height:1.6; margin-bottom:2rem;">${message}</p>
          <button id="elite-alert-ok" class="btn-primary" style="width:100%; height:54px; font-weight:900; border-radius:14px; background:${accentColor}; border:none; box-shadow: 0 4px 15px ${accentColor}40;">GREAT</button>
        </div>
      `;

      document.body.appendChild(overlay);
      if (window.lucide) window.lucide.createIcons({ root: overlay });

      document.getElementById('elite-alert-ok').onclick = () => {
        overlay.classList.add('fade-out');
        setTimeout(() => {
          overlay.remove();
          resolve();
        }, 200);
      };
    });
  },

  /**
   * Shows a premium confirmation modal.
   * @returns {Promise<boolean>}
   */
  async confirm(title, message, confirmText = 'YES, PROCEED', cancelText = 'CANCEL') {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay fade-in';
      overlay.style = "position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.85); z-index:9999999; display:flex; justify-content:center; align-items:center; backdrop-filter:blur(10px); padding: 1.5rem;";
      
      overlay.innerHTML = `
        <div class="glass card scale-in" style="width:100%; max-width:440px; padding:2rem; border-radius:28px; border: 2px solid var(--accent-primary); text-align:center; box-shadow: 0 25px 60px rgba(0,0,0,0.5);">
          <div style="width:60px; height:60px; background:rgba(37,99,235,0.1); color:var(--accent-primary); border-radius:50%; display:flex; align-items:center; justify-content:center; margin:0 auto 1.5rem;">
             <i data-lucide="help-circle" style="width:30px; height:30px;"></i>
          </div>
          <h3 style="font-family:'Outfit'; font-weight:900; font-size:1.5rem; color:var(--text-primary); margin-bottom:0.75rem;">${title}</h3>
          <p style="font-size:0.95rem; color:var(--text-secondary); line-height:1.6; margin-bottom:2rem;">${message}</p>
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem;">
             <button id="elite-confirm-cancel" class="btn-secondary" style="height:54px; font-weight:800; border-radius:14px; border:1.5px solid var(--glass-border);">${cancelText}</button>
             <button id="elite-confirm-yes" class="btn-primary" style="height:54px; font-weight:900; border-radius:14px; background:var(--accent-primary); border:none;">${confirmText}</button>
          </div>
        </div>
      `;

      document.body.appendChild(overlay);
      if (window.lucide) window.lucide.createIcons({ root: overlay });

      const cleanup = (result) => {
        overlay.classList.add('fade-out');
        setTimeout(() => {
          overlay.remove();
          resolve(result);
        }, 200);
      };

      document.getElementById('elite-confirm-yes').onclick = () => cleanup(true);
      document.getElementById('elite-confirm-cancel').onclick = () => cleanup(false);
    });
  },

  /**
   * Shows a non-blocking toast notification.
   */
  showToast(message, type = 'info', duration = 4000) {
    const container = document.getElementById('elite-toast-container') || (() => {
        const div = document.createElement('div');
        div.id = 'elite-toast-container';
        div.style = "position:fixed; bottom:2rem; left:50%; transform:translateX(-50%); z-index:99999999; display:flex; flex-direction:column; gap:0.75rem; width: 90%; max-width: 400px; pointer-events:none;";
        document.body.appendChild(div);
        return div;
    })();

    const toast = document.createElement('div');
    const color = type === 'error' ? '#ef4444' : type === 'success' ? '#10b981' : 'var(--accent-primary)';
    const icon = type === 'error' ? 'alert-circle' : type === 'success' ? 'check-circle' : 'bell';

    toast.className = 'glass scale-in';
    toast.style = `pointer-events:auto; padding:0.85rem 1.25rem; border-radius:16px; border-left:4px solid ${color}; display:flex; align-items:center; gap:0.75rem; box-shadow:0 10px 25px rgba(0,0,0,0.2); background:rgba(0,0,0,0.8); backdrop-filter:blur(10px);`;
    
    toast.innerHTML = `
      <i data-lucide="${icon}" style="width:18px; color:${color};"></i>
      <div style="flex:1; font-size:0.85rem; color:white; font-weight:600;">${message}</div>
      <button style="background:none; border:none; color:white; opacity:0.5; cursor:pointer; padding:4px;" onclick="this.parentElement.remove()">
        <i data-lucide="x" style="width:14px;"></i>
      </button>
    `;

    container.appendChild(toast);
    if (window.lucide) window.lucide.createIcons({ root: toast });

    setTimeout(() => {
      if (toast && toast.parentElement) {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px) scale(0.95)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
      }
    }, duration);
  },

  /**
   * Shows a custom HTML modal.
   */
  showCustom(html, options = {}) {
    this.hide(); // Close any existing custom modals

    const overlay = document.createElement('div');
    overlay.id = 'elite-custom-modal';
    overlay.className = 'modal-overlay fade-in';
    overlay.style = `position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.85); z-index:9999999; display:flex; justify-content:center; align-items:center; backdrop-filter:blur(12px); padding: ${options.padding || '1.5rem'};`;
    
    const allowScroll = options.allowScroll !== false;
    
    overlay.innerHTML = `
      <div class="glass card scale-in" style="width:100%; max-width:${options.maxWidth || '500px'}; max-height: 90vh; overflow-y: ${allowScroll ? 'auto' : 'hidden'}; border-radius:24px; border: 1px solid var(--glass-border); box-shadow: 0 30px 80px rgba(0,0,0,0.6); position: relative; display: flex; flex-direction: column;">
        <button id="elite-modal-close" style="position: absolute; top: 1.5rem; right: 1.5rem; background: rgba(255,255,255,0.1); border: none; color: white; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; z-index: 100;">
          <i data-lucide="x" style="width: 18px;"></i>
        </button>
        ${html}
      </div>
    `;

    document.body.appendChild(overlay);
    if (window.lucide) window.lucide.createIcons({ root: overlay });

    document.getElementById('elite-modal-close').onclick = () => this.hide();
    
    if (options.onRender) options.onRender();
  },

  hide() {
    const existing = document.getElementById('elite-custom-modal');
    if (existing) {
      existing.classList.add('fade-out');
      setTimeout(() => existing.remove(), 200);
    }
  }
};
