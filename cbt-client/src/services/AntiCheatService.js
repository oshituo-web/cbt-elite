export const AntiCheatService = {
  logs: [],
  onSuspiciousActivity: null,
  lastBlurTime: null,

  init(onActivity) {
    this.logs = [];
    this.onSuspiciousActivity = onActivity;
    this.lastBlurTime = null;
    this.setupListeners();
    this.setupSecurityBlockers();
  },

  setupSecurityBlockers() {
    // 1. Block Context Menu (Right Click)
    this._contextHandler = (e) => e.preventDefault();
    document.addEventListener('contextmenu', this._contextHandler);

    // 2. Block Copy/Paste/Cut
    this._clipboardHandler = (e) => {
      e.preventDefault();
      this.logActivity('clipboard_access_blocked');
    };
    document.addEventListener('copy', this._clipboardHandler);
    document.addEventListener('paste', this._clipboardHandler);
    document.addEventListener('cut', this._clipboardHandler);

    // 3. Block DevTools and Selection Shortcuts
    this._keyboardHandler = (e) => {
      // F12 or Ctrl+Shift+I or Ctrl+Shift+J or Ctrl+U (View Source)
      if (
        e.key === 'F12' || 
        (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'i' || e.key === 'j')) ||
        (e.ctrlKey && (e.key === 'U' || e.key === 'u'))
      ) {
        e.preventDefault();
        this.logActivity('devtools_prevented');
      }
      // Block Ctrl+C, Ctrl+V, Ctrl+A (Select All)
      if (e.ctrlKey && (e.key === 'c' || e.key === 'v' || e.key === 'a' || e.key === 'C' || e.key === 'V' || e.key === 'A')) {
        e.preventDefault();
        this.logActivity('keyboard_shortcut_blocked');
      }
    };
    document.addEventListener('keydown', this._keyboardHandler);
  },

  setupListeners() {
    window.addEventListener('blur', () => {
      this.lastBlurTime = Date.now();
      this.logActivity('window_blur');
    });

    window.addEventListener('focus', () => {
      let duration = 0;
      if (this.lastBlurTime) {
        duration = Math.floor((Date.now() - this.lastBlurTime) / 1000);
        this.lastBlurTime = null;
      }
      this.logActivity('window_focus', { duration_seconds: duration });
    });

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.logActivity('tab_switch_hidden');
      }
    });

    // Handle paste events globally if needed, or provided via explicit calls
  },

  logActivity(type, extra = {}) {
    const event = {
      type,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      ...extra
    };
    this.logs.push(event);
    console.warn(`[AntiCheat] Suspicious Activity: ${type}`);
    if (this.onSuspiciousActivity) this.onSuspiciousActivity(event);
  },

  getLogs() {
    return this.logs;
  },

  destroy() {
    this.onSuspiciousActivity = null;
    document.removeEventListener('contextmenu', this._contextHandler);
    document.removeEventListener('copy', this._clipboardHandler);
    document.removeEventListener('paste', this._clipboardHandler);
    document.removeEventListener('cut', this._clipboardHandler);
    document.removeEventListener('keydown', this._keyboardHandler);
  }
};
