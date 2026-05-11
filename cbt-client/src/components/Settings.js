import { AuthService } from '../services/auth'
import { ModalService } from '../services/ModalService'
import { SoundService } from '../services/SoundService'
import { NotificationService } from '../services/NotificationService'

export const SettingsComponent = {
  profile: null,

  render(profile, onBack) {
    this.profile = profile
    
    const container = document.getElementById('settings-container')
    document.querySelectorAll('#main-view > div').forEach(div => div.style.display = 'none')
    container.style.display = 'block'

    const isDark = document.body.classList.contains('dark-mode')
    const notifEnabled = localStorage.getItem('push_notifications') === 'true'
    const soundEnabled = localStorage.getItem('sound_effects') !== 'false'
    const autoAdvance = localStorage.getItem('auto_advance') !== 'false'
    const fontSize = localStorage.getItem('font_size') || 'medium'

    container.innerHTML = `
      <div class="container animate-fadeIn" style="max-width: 860px; padding-bottom: 4rem;">
        <header style="margin-top: 1.5rem; margin-bottom: 2rem; display: flex; align-items: center; gap: 1rem;">
          <button id="settings-back-btn" class="header-icon-btn" title="Exit" style="width: 48px; height: 48px; display: flex; align-items: center; justify-content: center; border-radius: 14px; background: rgba(255,255,255,0.08); border: 1px solid var(--glass-border); color: var(--text-primary);">
            <i data-lucide="arrow-left" style="width: 24px; stroke-width: 3px;"></i>
          </button>
          <div>
            <h1 style="font-family: 'Outfit'; font-size: 1.85rem; font-weight: 900; color: var(--text-primary); margin: 0;">App Settings</h1>
            <p style="color: var(--text-secondary); font-weight: 500; font-size: 0.85rem; margin: 0.2rem 0 0 0;">Customize your elite learning experience.</p>
          </div>
        </header>

        <div style="display: flex; flex-direction: column; gap: 1.25rem;">

          <!-- ── APPEARANCE ────────────────────────────────── -->
          <div class="glass card" style="padding: 1.5rem;">
            <div class="settings-section-header">
              <div class="settings-section-icon" style="background: rgba(124, 58, 237, 0.12); color: var(--accent-primary);">
                <i data-lucide="palette"></i>
              </div>
              <h3 style="font-family: 'Outfit'; font-weight: 800; font-size: 1.05rem; margin: 0;">Appearance</h3>
            </div>
            <div class="settings-rows">
              <div class="settings-row">
                <div>
                  <p class="settings-row-label">Dark Mode</p>
                  <p class="settings-row-desc">Toggle platform brightness</p>
                </div>
                <button id="theme-toggle-settings" class="toggle-switch ${isDark ? 'active' : ''}" data-on="Dark" data-off="Light">
                  <span class="toggle-knob"></span>
                </button>
              </div>
              <div class="settings-row">
                <div>
                  <p class="settings-row-label">Text Size</p>
                  <p class="settings-row-desc">Adjust question text size</p>
                </div>
                <select id="font-size-select" class="settings-select">
                  <option value="small" ${fontSize === 'small' ? 'selected' : ''}>Small</option>
                  <option value="medium" ${fontSize === 'medium' ? 'selected' : ''}>Medium</option>
                  <option value="large" ${fontSize === 'large' ? 'selected' : ''}>Large</option>
                </select>
              </div>
            </div>
          </div>

          <!-- ── NOTIFICATIONS ─────────────────────────────── -->
          <div class="glass card" style="padding: 1.5rem;">
            <div class="settings-section-header">
              <div class="settings-section-icon" style="background: rgba(249, 115, 22, 0.12); color: #F97316;">
                <i data-lucide="bell"></i>
              </div>
              <h3 style="font-family: 'Outfit'; font-weight: 800; font-size: 1.05rem; margin: 0;">Push Notifications</h3>
            </div>
            <div class="settings-rows">
              <div class="settings-row">
                <div>
                  <p class="settings-row-label">Enable Push Alerts</p>
                  <p class="settings-row-desc">Streaks, clashes, news & reminders</p>
                </div>
                <button id="push-notif-toggle" class="toggle-switch ${notifEnabled ? 'active' : ''}" data-on="On" data-off="Off">
                  <span class="toggle-knob"></span>
                </button>
              </div>
              <div id="notif-status" style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.5rem; padding: 0 0.25rem;"></div>
            </div>
          </div>

          <!-- ── SESSION BEHAVIOUR ─────────────────────────── -->
          <div class="glass card" style="padding: 1.5rem;">
            <div class="settings-section-header">
              <div class="settings-section-icon" style="background: rgba(16, 185, 129, 0.12); color: var(--success);">
                <i data-lucide="sliders-horizontal"></i>
              </div>
              <h3 style="font-family: 'Outfit'; font-weight: 800; font-size: 1.05rem; margin: 0;">Session Behaviour</h3>
            </div>
            <div class="settings-rows">
              <div class="settings-row">
                <div>
                  <p class="settings-row-label">Sound Effects</p>
                  <p class="settings-row-desc">Play sounds for correct/wrong answers</p>
                </div>
                <button id="sound-toggle" class="toggle-switch ${soundEnabled ? 'active' : ''}" data-on="On" data-off="Off">
                  <span class="toggle-knob"></span>
                </button>
              </div>
              <div class="settings-row">
                <div>
                  <p class="settings-row-label">Auto-Advance Questions</p>
                  <p class="settings-row-desc">Move to next question after answering</p>
                </div>
                <button id="auto-advance-toggle" class="toggle-switch ${autoAdvance ? 'active' : ''}" data-on="On" data-off="Off">
                  <span class="toggle-knob"></span>
                </button>
              </div>
            </div>
          </div>

          <!-- ── ACCOUNT ────────────────────────────────────── -->
          <div class="glass card" style="padding: 1.5rem;">
            <div class="settings-section-header">
              <div class="settings-section-icon" style="background: rgba(37, 99, 235, 0.12); color: #60A5FA;">
                <i data-lucide="user-circle"></i>
              </div>
              <h3 style="font-family: 'Outfit'; font-weight: 800; font-size: 1.05rem; margin: 0;">Account</h3>
            </div>
            <div class="settings-rows">
              <div class="settings-row">
                <div>
                  <p class="settings-row-label">Logged in as</p>
                  <p class="settings-row-desc">${profile.email || 'Unknown'}</p>
                </div>
                <span style="font-size: 0.65rem; font-weight: 900; letter-spacing: 0.08em; color: ${profile.is_activated ? 'var(--success)' : 'var(--text-secondary)'}; background: ${profile.is_activated ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.05)'}; padding: 3px 8px; border-radius: 20px; text-transform: uppercase;">
                  ${profile.is_activated ? '✓ PREMIUM' : 'FREE'}
                </span>
              </div>
              <div class="settings-row">
                <div>
                  <p class="settings-row-label">Student ID</p>
                  <p class="settings-row-desc" style="font-family: monospace; font-size: 0.8rem;">${profile.id.substring(0, 16)}...</p>
                </div>
                <button id="copy-id-btn" class="btn-secondary" style="height: 34px; font-size: 0.7rem; padding: 0 0.75rem;">Copy</button>
              </div>
            </div>
          </div>

          <!-- ── SIGN OUT ───────────────────────────────────── -->
          <div class="glass card" style="padding: 1.5rem; border: 1px solid rgba(239, 68, 68, 0.2);">
            <div class="settings-section-header">
              <div class="settings-section-icon" style="background: rgba(239, 68, 68, 0.1); color: #F87171;">
                <i data-lucide="log-out"></i>
              </div>
              <h3 style="font-family: 'Outfit'; font-weight: 800; font-size: 1.05rem; margin: 0; color: #F87171;">Session</h3>
            </div>
            <div class="settings-rows">
              <div class="settings-row">
                <div>
                  <p class="settings-row-label">Sign Out</p>
                  <p class="settings-row-desc">Securely log out of your account</p>
                </div>
                <button id="settings-logout-btn" class="btn-secondary" style="color: #F87171; border-color: rgba(239, 68, 68, 0.3); height: 38px; font-size: 0.8rem;">
                  <i data-lucide="log-out" style="width: 14px; margin-right: 4px;"></i> Sign Out
                </button>
              </div>
              <div class="settings-row">
                <div>
                  <p class="settings-row-label" style="color: var(--error);">Delete Exam Data</p>
                  <p class="settings-row-desc">Permanently erase your performance history</p>
                </div>
                <button id="delete-data-btn" class="btn-secondary" style="color: var(--error); border-color: rgba(239, 68, 68, 0.2); height: 38px; font-size: 0.8rem;">Delete</button>
              </div>
            </div>
          </div>

        </div>
      </div>

      <style>
        .settings-section-header { display: flex; align-items: center; gap: 0.85rem; margin-bottom: 1.25rem; }
        .settings-section-icon { padding: 0.55rem; border-radius: 10px; display: flex; align-items: center; justify-content: center; }
        .settings-section-icon svg { width: 18px; height: 18px; }
        .settings-rows { display: flex; flex-direction: column; gap: 0; }
        .settings-row { display: flex; justify-content: space-between; align-items: center; padding: 0.85rem 0; border-bottom: 1px solid var(--glass-border); }
        .settings-row:last-child { border-bottom: none; padding-bottom: 0; }
        .settings-row-label { margin: 0; font-weight: 700; font-size: 0.9rem; color: var(--text-primary); }
        .settings-row-desc { margin: 0.1rem 0 0 0; font-size: 0.72rem; color: var(--text-secondary); }
        .settings-select { background: var(--surface-color); color: var(--text-primary); border: 1px solid var(--glass-border); border-radius: 8px; padding: 0.4rem 0.75rem; font-family: 'Outfit'; font-weight: 600; font-size: 0.8rem; cursor: pointer; }
        
        /* Toggle Switch */
        .toggle-switch { position: relative; width: 52px; height: 28px; border-radius: 14px; border: none; background: var(--glass-border); cursor: pointer; transition: background 0.3s; flex-shrink: 0; padding: 0; }
        .toggle-switch.active { background: var(--accent-primary); }
        .toggle-knob { position: absolute; top: 4px; left: 4px; width: 20px; height: 20px; background: white; border-radius: 50%; transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1); box-shadow: 0 2px 6px rgba(0,0,0,0.3); display: block; }
        .toggle-switch.active .toggle-knob { transform: translateX(24px); }
      </style>
    `

    if (window.lucide) window.lucide.createIcons({ root: container })
    this.setupListeners(onBack)
  },

  setupListeners(onBack) {
    const container = document.getElementById('settings-container')

    // ── Back ─────────────────────────────────────────────────
    document.getElementById('settings-back-btn')?.addEventListener('click', () => onBack())

    // ── Dark Mode Toggle ──────────────────────────────────────
    document.getElementById('theme-toggle-settings')?.addEventListener('click', (e) => {
      const btn = e.currentTarget
      const isDark = document.body.classList.toggle('dark-mode')
      document.body.classList.toggle('light-mode', !isDark)
      localStorage.setItem('theme', isDark ? 'dark' : 'light')
      btn.classList.toggle('active', isDark)
    })

    // ── Font Size ─────────────────────────────────────────────
    document.getElementById('font-size-select')?.addEventListener('change', (e) => {
      const size = e.target.value
      localStorage.setItem('font_size', size)
      const root = document.documentElement
      const map = { small: '14px', medium: '16px', large: '18px' }
      root.style.setProperty('--base-font-size', map[size])
      ModalService.showToast?.(`Text size set to ${size}`) || console.log('Font size set:', size)
    })

    // ── Push Notifications ────────────────────────────────────
    const pushToggle = document.getElementById('push-notif-toggle')
    const notifStatus = document.getElementById('notif-status')
    pushToggle?.addEventListener('click', async () => {
      const isActive = pushToggle.classList.contains('active')
      if (!isActive) {
        // Request permission
        if (!('Notification' in window)) {
          if (notifStatus) notifStatus.textContent = '⚠️ Push notifications are not supported in this browser.'
          return
        }
        const permission = await Notification.requestPermission()
        if (permission === 'granted') {
          // Subscribe to Web Push via VAPID
          await NotificationService.subscribeToPush(this.profile?.id);

          localStorage.setItem('push_notifications', 'true')
          pushToggle.classList.add('active')
          if (notifStatus) notifStatus.innerHTML = '✅ Push alerts enabled. You\'ll be notified about streaks, clashes, and exam news.'
          // Send a test notification
          new Notification('CBT Elite 🎯', {
            body: 'Push alerts are now active! You\'re all set.',
            icon: '/pwa-icon.svg'
          })
        } else if (permission === 'denied') {
          if (notifStatus) notifStatus.innerHTML = '🚫 Permission denied. Please allow notifications in your browser settings.'
        } else {
          if (notifStatus) notifStatus.textContent = 'Notification permission was dismissed.'
        }
      } else {
        // Turn off (can't programmatically revoke, but we can disable locally)
        localStorage.setItem('push_notifications', 'false')
        pushToggle.classList.remove('active')
        if (notifStatus) notifStatus.textContent = 'Push alerts disabled.'
      }
    })

    // Show current status on load
    if (notifStatus) {
      if (!('Notification' in window)) {
        notifStatus.textContent = '⚠️ Not supported in this browser.'
      } else if (Notification.permission === 'denied') {
        notifStatus.innerHTML = '🚫 Blocked by browser. Go to browser settings → Site permissions → Allow notifications.'
      } else if (Notification.permission === 'granted' && localStorage.getItem('push_notifications') === 'true') {
        notifStatus.innerHTML = '✅ Active — you\'ll receive streak reminders and clash alerts.'
      }
    }

    // ── Sound Effects Toggle ──────────────────────────────────
    document.getElementById('sound-toggle')?.addEventListener('click', (e) => {
      const btn = e.currentTarget
      const isActive = btn.classList.toggle('active')
      localStorage.setItem('sound_effects', isActive ? 'true' : 'false')
      if (isActive) SoundService.playCorrect();
      else SoundService.playClick();
    })

    // ── Auto-Advance Toggle ───────────────────────────────────
    document.getElementById('auto-advance-toggle')?.addEventListener('click', (e) => {
      const btn = e.currentTarget
      const isActive = btn.classList.toggle('active')
      localStorage.setItem('auto_advance', isActive ? 'true' : 'false')
      ModalService.showToast(`Auto-advance ${isActive ? 'Enabled' : 'Disabled'}`, isActive ? 'success' : 'info');
    })

    // ── Copy Student ID ───────────────────────────────────────
    document.getElementById('copy-id-btn')?.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(this.profile?.id || '')
        const btn = document.getElementById('copy-id-btn')
        if (btn) { btn.textContent = 'Copied!'; setTimeout(() => btn.textContent = 'Copy', 2000) }
      } catch { }
    })

    // ── Sign Out ──────────────────────────────────────────────
    document.getElementById('settings-logout-btn')?.addEventListener('click', async () => {
      const confirmed = await ModalService.confirm('Sign Out?', 'Are you sure you want to sign out of your account?')
      if (confirmed) {
        await AuthService.signOut()
        window.location.reload()
      }
    })

    // ── Delete Exam Data ──────────────────────────────────────
    document.getElementById('delete-data-btn')?.addEventListener('click', async () => {
      const confirmed = await ModalService.confirm(
        'Delete Exam Data?',
        'This will permanently erase your performance history and analytics. This action cannot be undone.'
      )
      if (confirmed) {
        ModalService.alert('Account Security', 'Data deletion for your account tier must be requested via the Support channel to prevent accidental loss. Contact us at cbtellite@gmail.com.', 'info')
      }
    })
  }
}
