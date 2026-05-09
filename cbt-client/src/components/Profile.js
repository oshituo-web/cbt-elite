import { AuthService } from '../services/auth'
import { DataService } from '../services/data'
import { ModalService } from '../services/ModalService'
import { sanitizeContent } from '../utils/sanitize'

export const ProfileComponent = {
  profile: null,

  async render(profile, onBack) {
    this.profile = profile
    
    // Ensure we have the email (from Auth user)
    if (!profile.email) {
        const user = await AuthService.getCurrentUser();
        if (user) profile.email = user.email;
    }

    const container = document.getElementById('settings-container'); // Reuse settings container for simplicity or create a profile-container
    if (!container) {
        const main = document.getElementById('main-view');
        const profileDiv = document.createElement('div');
        profileDiv.id = 'profile-container';
        main.appendChild(profileDiv);
    }
    
    const targetContainer = document.getElementById('profile-container') || container;
    document.querySelectorAll('#main-view > div').forEach(div => div.style.display = 'none');
    targetContainer.style.display = 'block';

    const avatarChar = profile.username ? profile.username.charAt(0).toUpperCase() : '?';
    const avatarUrl = profile.avatar_url || null;

    targetContainer.innerHTML = `
      <div class="container animate-fadeIn" style="max-width: 800px; margin: 0 auto; padding: 2rem 1rem;">
        <header style="margin-bottom: 2.5rem; display: flex; align-items: center; justify-content: space-between;">
           <div>
             <h1 style="font-family: 'Outfit'; font-size: 2.25rem; font-weight: 900; color: var(--text-primary); margin-bottom: 0.25rem;">My Profile</h1>
             <p style="color: var(--text-secondary); font-weight: 500;">Manage your identity and preferences.</p>
           </div>
           <button id="profile-back-btn" class="header-icon-btn" title="Exit" style="width: 48px; height: 48px; display: flex; align-items: center; justify-content: center; border-radius: 14px; background: rgba(255,255,255,0.08); border: 1px solid var(--glass-border); color: var(--text-primary);">
              <i data-lucide="arrow-left" style="width: 24px; stroke-width: 3px;"></i>
           </button>
        </header>

        <div style="display: grid; grid-template-columns: 1fr; gap: 2rem;">
          
          <!-- Avatar Section -->
          <div class="glass card" style="padding: 2rem; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 1.5rem;">
             <div style="position: relative;">
                <div id="profile-avatar-display" style="width: 120px; height: 120px; border-radius: 50%; background: var(--accent-primary); display: flex; align-items: center; justify-content: center; font-size: 3rem; font-weight: 900; color: white; border: 4px solid var(--glass-border); overflow: hidden; box-shadow: var(--shadow-lg);">
                   ${avatarUrl ? `<img src="${avatarUrl}" style="width: 100%; height: 100%; object-fit: cover;">` : avatarChar}
                </div>
                <label for="avatar-upload" class="avatar-upload-trigger" style="position: absolute; bottom: 0; right: 0; background: var(--primary); color: white; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; border: 3px solid var(--bg-primary); transition: transform 0.2s;">
                   <i data-lucide="camera" style="width: 18px;"></i>
                   <input type="file" id="avatar-upload" accept="image/*" style="display: none;">
                </label>
             </div>
             <div>
                <h3 id="display-username" style="font-family: 'Outfit'; font-weight: 800; font-size: 1.5rem; margin: 0;">${sanitizeContent(profile.username)}</h3>
                <span style="font-size: 0.7rem; font-weight: 900; letter-spacing: 0.1em; color: var(--accent-secondary); text-transform: uppercase; background: rgba(59, 130, 246, 0.1); padding: 4px 10px; border-radius: 20px; margin-top: 0.5rem; display: inline-block;">
                   ${(profile.is_activated ? 'Premium Pro' : (profile.tier || 'Free Tier')).toUpperCase()}
                </span>
             </div>
          </div>

          <!-- Details Form -->
          <div class="glass card" style="padding: 2rem;">
             <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
                
                <div style="grid-column: span 2;">
                   <label style="display: block; font-size: 0.75rem; font-weight: 800; color: var(--text-secondary); text-transform: uppercase; margin-bottom: 0.5rem;">Email Address</label>
                   <input type="email" value="${profile.email || ''}" disabled style="width: 100%; padding: 0.8rem 1rem; border-radius: 12px; background: rgba(0,0,0,0.1); border: 1px solid var(--glass-border); color: var(--text-secondary); cursor: not-allowed;">
                   <p style="font-size: 0.65rem; color: var(--text-secondary); margin-top: 0.4rem;">Email cannot be changed for security reasons.</p>
                </div>

                <div>
                   <label style="display: block; font-size: 0.75rem; font-weight: 800; color: var(--text-secondary); text-transform: uppercase; margin-bottom: 0.5rem;">Full Name</label>
                   <input type="text" id="profile-full-name" value="${profile.full_name || ''}" placeholder="Enter your full name" style="width: 100%; padding: 0.8rem 1rem; border-radius: 12px; background: var(--glass-bg); border: 1px solid var(--glass-border); color: var(--text-primary); outline: none; transition: border-color 0.2s;">
                </div>

                <div>
                   <label style="display: block; font-size: 0.75rem; font-weight: 800; color: var(--text-secondary); text-transform: uppercase; margin-bottom: 0.5rem;">Username</label>
                   <input type="text" id="profile-username" value="${profile.username || ''}" placeholder="Choose a unique username" style="width: 100%; padding: 0.8rem 1rem; border-radius: 12px; background: var(--glass-bg); border: 1px solid var(--glass-border); color: var(--text-primary); outline: none; transition: border-color 0.2s;">
                </div>

                <div style="grid-column: span 2;">
                   <label style="display: block; font-size: 0.75rem; font-weight: 800; color: var(--text-secondary); text-transform: uppercase; margin-bottom: 0.5rem;">Department</label>
                   <select id="profile-department" style="width: 100%; padding: 0.8rem 1rem; border-radius: 12px; background: var(--glass-bg); border: 1px solid var(--glass-border); color: var(--text-primary); outline: none; cursor: pointer;">
                      <option value="Science" ${profile.department === 'Science' ? 'selected' : ''}>Science</option>
                      <option value="Commercial" ${profile.department === 'Commercial' ? 'selected' : ''}>Commercial</option>
                      <option value="Arts" ${profile.department === 'Arts' ? 'selected' : ''}>Arts</option>
                   </select>
                   <p style="font-size: 0.65rem; color: var(--text-secondary); margin-top: 0.4rem;">This syncs with your weekly clan competitions.</p>
                </div>

                <div style="grid-column: span 2;">
                   <label style="display: block; font-size: 0.75rem; font-weight: 800; color: var(--text-secondary); text-transform: uppercase; margin-bottom: 0.5rem;">Target Exam</label>
                   <select id="profile-exam-type" style="width: 100%; padding: 0.8rem 1rem; border-radius: 12px; background: var(--glass-bg); border: 1px solid var(--glass-border); color: var(--text-primary); outline: none; cursor: pointer;">
                      <option value="JAMB" ${profile.preferred_exam_type === 'JAMB' ? 'selected' : ''}>JAMB (UTME)</option>
                      <option value="WAEC" ${profile.preferred_exam_type === 'WAEC' ? 'selected' : ''}>WAEC (WASSCE)</option>
                      <option value="NECO" ${profile.preferred_exam_type === 'NECO' ? 'selected' : ''}>NECO (SSCE)</option>
                   </select>
                   <p style="font-size: 0.65rem; color: var(--text-secondary); margin-top: 0.4rem;">Determines your AI Daily Missions and Mastery path.</p>
                </div>

             </div>

             <div style="margin-top: 2.5rem; display: flex; gap: 1rem;">
                <button id="profile-save-btn" class="btn-primary" style="flex: 1; height: 50px; font-weight: 800; font-size: 1rem; border-radius: 14px;">Save Changes</button>
             </div>
          </div>

        </div>
      </div>
    `

    if (window.lucide) window.lucide.createIcons({ root: targetContainer })

    this.setupListeners(onBack)
  },

  setupListeners(onBack) {
    const saveBtn = document.getElementById('profile-save-btn')
    const backBtn = document.getElementById('profile-back-btn')
    const avatarInput = document.getElementById('avatar-upload')
    
    if (backBtn) {
      backBtn.onclick = () => onBack()
    }

    if (avatarInput) {
      avatarInput.onchange = async (e) => {
        const file = e.target.files[0]
        if (!file) return

        // 🖼️ Preview immediately
        const reader = new FileReader()
        reader.onload = (event) => {
          const display = document.getElementById('profile-avatar-display')
          if (display) display.innerHTML = `<img src="${event.target.result}" style="width: 100%; height: 100%; object-fit: cover;">`
        }
        reader.readAsDataURL(file)

        // 📤 Upload to Storage
        ModalService.toast('Uploading avatar...', 'info')
        try {
            const fileName = `avatars/${this.profile.id}_${Date.now()}.png`
            const { data, error } = await DataService.supabase.storage
                .from('avatars')
                .upload(fileName, file, { upsert: true })
            
            if (error) {
                // If bucket doesn't exist, try creating it (though normally done via dashboard)
                if (error.message.includes('bucket not found')) {
                    throw new Error("Avatar storage not configured. Please contact admin.")
                }
                throw error
            }

            const { data: { publicUrl } } = DataService.supabase.storage
                .from('avatars')
                .getPublicUrl(fileName)
            
            this.profile.avatar_url = publicUrl
            ModalService.toast('Avatar uploaded successfully!', 'success')
        } catch (err) {
            console.error("Avatar upload error:", err)
            ModalService.alert("Upload Failed", err.message, 'error')
        }
      }
    }

    if (saveBtn) {
      saveBtn.onclick = async () => {
        const newFullName = document.getElementById('profile-full-name').value.trim().replace(/<[^>]*>?/gm, '').substring(0, 50)
        const newUsername = document.getElementById('profile-username').value.trim().toLowerCase()
        const newDept = document.getElementById('profile-department').value
        const newExamType = document.getElementById('profile-exam-type').value

        // 🔐 SECURITY HARDENING: Validation
        const usernameRegex = /^[a-z0-9_]{3,20}$/
        if (!usernameRegex.test(newUsername)) {
            ModalService.alert("Invalid Username", "Username must be 3-20 characters and contain only letters, numbers, and underscores.", 'warning')
            return
        }

        saveBtn.disabled = true
        saveBtn.innerHTML = '<span class="loader-spinner" style="width:20px;height:20px;border-width:2px;"></span> Saving...'

        try {
            const updates = {
                id: this.profile.id,
                full_name: newFullName,
                username: newUsername,
                department: newDept,
                preferred_exam_type: newExamType,
                avatar_url: this.profile.avatar_url,
                updated_at: new Date().toISOString()
            }

            const { error } = await AuthService.updateProfile(updates)
            
            if (error) throw error

            ModalService.toast('Profile updated!', 'success')
            
            // Update local state and header
            Object.assign(this.profile, updates)
            if (window.updateHeaderProfile) window.updateHeaderProfile(this.profile)
            
            // Refresh title and username display
            const displayUsername = document.getElementById('display-username')
            if (displayUsername) displayUsername.textContent = newUsername

        } catch (err) {
            console.error("Profile save error:", err)
            ModalService.alert("Save Failed", err.message, 'error')
        } finally {
            saveBtn.disabled = false
            saveBtn.innerHTML = 'Save Changes'
        }
      }
    }
  }
}
