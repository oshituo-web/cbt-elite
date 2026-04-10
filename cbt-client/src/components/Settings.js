import { AuthService } from '../services/auth'

export const SettingsComponent = {
  profile: null,

  render(profile, onBack) {
    this.profile = profile
    
    const container = document.getElementById('settings-container')
    document.querySelectorAll('#main-view > div').forEach(div => div.style.display = 'none')
    container.style.display = 'block'
    
    const isLight = document.body.classList.contains('light-mode')

    container.innerHTML = `
      <div class="container animate-fadeIn">
        <header style="margin-top: 2rem; margin-bottom: 2.5rem; display: flex; align-items: center; justify-content: space-between;">
           <div>
             <h1 style="font-family: 'Outfit'; font-size: 2.25rem; font-weight: 900; color: var(--text-primary); margin-bottom: 0.25rem;">App Settings</h1>
             <p style="color: var(--text-secondary); font-weight: 500;">Customize your elite learning experience.</p>
           </div>
           <button id="settings-back-btn" class="btn-secondary" style="border-radius: 50%; width: 44px; height: 44px; padding: 0;">&times;</button>
        </header>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.5rem;">
          
          <!-- Appearance Section -->
          <div class="glass card" style="padding: 1.75rem;">
            <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem;">
               <div style="background: rgba(124, 58, 237, 0.1); padding: 0.6rem; border-radius: 10px; color: var(--accent-primary);">
                 <i data-lucide="palette"></i>
               </div>
               <h3 style="font-family: 'Outfit'; font-weight: 800; font-size: 1.15rem; margin: 0;">Appearance</h3>
            </div>
            
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 1rem; background: rgba(0,0,0,0.1); border-radius: 12px; border: 1px solid var(--glass-border);">
               <div>
                  <p style="margin: 0; font-weight: 700; font-size: 0.95rem;">Light Mode</p>
                  <p style="margin: 0; font-size: 0.75rem; color: var(--text-secondary);">Toggle platform brightness</p>
               </div>
               <button id="theme-toggle-settings" class="btn-secondary" style="height: 38px; min-width: 80px;">
                 ${isLight ? '<i data-lucide="sun"></i> ON' : '<i data-lucide="moon"></i> OFF'}
               </button>
            </div>
          </div>

          <!-- Account Section -->
          <div class="glass card" style="padding: 1.75rem;">
            <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem;">
               <div style="background: rgba(16, 185, 129, 0.1); padding: 0.6rem; border-radius: 10px; color: var(--success);">
                 <i data-lucide="user"></i>
               </div>
               <h3 style="font-family: 'Outfit'; font-weight: 800; font-size: 1.15rem; margin: 0;">Account Tier</h3>
            </div>
            
            <div style="padding: 1rem; background: rgba(16, 185, 129, 0.05); border: 1.5px solid var(--success); border-radius: 12px; text-align: center; margin-bottom: 1rem;">
               <span style="font-size: 0.65rem; font-weight: 900; letter-spacing: 0.1em; color: var(--success); text-transform: uppercase;">CURRENT PLAN</span>
               <h2 style="font-family: 'Outfit'; font-weight: 900; color: var(--text-primary); margin: 0.25rem 0;">${(profile.is_activated ? 'Premium Pro' : 'Free Tier').toUpperCase()}</h2>
            </div>
            
            <p style="font-size: 0.8rem; color: var(--text-secondary); line-height: 1.5; font-weight: 500;">
               Student ID: <code style="background: rgba(0,0,0,0.2); padding: 2px 4px; border-radius: 4px;">${profile.id.substring(0, 8)}...</code>
            </p>
          </div>

          <!-- Notifications Section -->
          <div class="glass card" style="padding: 1.75rem;">
             <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem;">
               <div style="background: rgba(249, 115, 22, 0.1); padding: 0.6rem; border-radius: 10px; color: #F97316;">
                 <i data-lucide="bell"></i>
               </div>
               <h3 style="font-family: 'Outfit'; font-weight: 800; font-size: 1.15rem; margin: 0;">Push Alerts</h3>
            </div>
            <div style="display: flex; flex-direction: column; gap: 0.75rem;">
               <button class="btn-secondary" style="justify-content: space-between; width: 100%; opacity: 0.5; cursor: not-allowed;">
                 <span>Exam Reminders</span> <span style="font-size: 0.65rem; background: var(--glass-border); padding: 2px 6px; border-radius: 10px;">PRO</span>
               </button>
               <button class="btn-secondary" style="justify-content: space-between; width: 100%; opacity: 0.5; cursor: not-allowed;">
                 <span>Weekly Report</span> <span style="font-size: 0.65rem; background: var(--glass-border); padding: 2px 6px; border-radius: 10px;">PRO</span>
               </button>
            </div>
          </div>
        </div>

        <div style="margin-top: 3rem; background: rgba(239, 68, 68, 0.05); padding: 2rem; border-radius: 16px; border: 1px solid rgba(239, 68, 68, 0.1);">
           <h4 style="color: var(--error); font-weight: 800; margin-bottom: 0.5rem; font-family: 'Outfit';">Danger Zone</h4>
           <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 1.5rem;">Deleting your account will permanently erase your exam history, performance analytics, and bookmarks.</p>
           <button id="delete-data-btn" class="btn-secondary" style="color: var(--error); border-color: rgba(239, 68, 68, 0.2); width: 100%; max-width: 250px;">Delete Exam Data</button>
        </div>
      </div>
    `

    if (window.lucide) window.lucide.createIcons({ root: container })

    this.setupListeners(onBack)
  },

  setupListeners(onBack) {
    const themeBtn = document.getElementById('theme-toggle-settings')
    if (themeBtn) {
      themeBtn.onclick = () => {
        document.body.classList.toggle('light-mode')
        const isL = document.body.classList.contains('light-mode')
        localStorage.setItem('theme', isL ? 'light' : 'dark')
        themeBtn.innerHTML = isL ? '<i data-lucide="sun"></i> ON' : '<i data-lucide="moon"></i> OFF'
        if (window.lucide) window.lucide.createIcons({ root: themeBtn })
      }
    }

    const backBtn = document.getElementById('settings-back-btn')
    if (backBtn) {
      backBtn.onclick = () => onBack()
    }

    const deleteBtn = document.getElementById('delete-data-btn')
    if (deleteBtn) {
      deleteBtn.onclick = () => {
        if (confirm('Are you absolutely sure? This will wipe your performance history offline as well.')) {
           alert('Feature disabled in demo mode.')
        }
      }
    }
  }
}
