import { AuthService } from '../services/auth'

export const ProfileSetupComponent = {
  render(user, onComplete) {
    const container = document.getElementById('auth-container')
    container.style.display = 'block'
    container.innerHTML = `
      <div class="auth-card glass card scale-in" style="width: min(440px, 92vw); margin: 3rem auto; padding: 2.5rem 1.5rem;">
        <div style="text-align: center; margin-bottom: 3rem;">
          <h2 style="font-family: 'Outfit'; font-weight: 900; font-size: 2rem; color: var(--text-primary); margin-bottom: 0.5rem;">Secure Your Handle</h2>
          <p style="color: var(--text-secondary); font-weight: 600; font-size: 1rem; line-height: 1.4;">Choose a unique identity for the elite leaderboard</p>
        </div>
        
        <div id="setup-error" class="glass" style="color: var(--error); font-size: 0.9rem; font-weight: 700; text-align: center; margin-bottom: 1.5rem; padding: 1rem; background: rgba(239, 68, 68, 0.08); border-radius: 12px; display: none; border: 1px solid rgba(239, 68, 68, 0.2); font-family: 'Outfit';"></div>

        <form id="setup-form" style="display: flex; flex-direction: column; gap: 1.75rem;">
          <div style="position: relative;">
            <label for="username" style="font-size: 0.75rem; font-weight: 800; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.1em; font-family: 'Outfit'; display: block; margin-bottom: 0.75rem;">Global Username</label>
            <input type="text" id="username" placeholder="Elite Explorer" required class="glass-input" style="height: 56px; border-radius: 12px; font-weight: 700; font-family: 'Outfit'; border-width: 2px; width: 100%; padding-right: 6rem;">
            <div id="availability-check" style="position: absolute; right: 16px; bottom: 18px; font-size: 0.75rem; font-weight: 900; font-family: 'Outfit'; text-transform: uppercase; letter-spacing: 0.05em;"></div>
          </div>
          
          <div>
            <label for="full_name" style="font-size: 0.75rem; font-weight: 800; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.1em; font-family: 'Outfit'; display: block; margin-bottom: 0.75rem;">Full Name</label>
            <input type="text" id="full_name" placeholder="John Doe" value="${user.user_metadata?.full_name || ''}" class="glass-input" style="height: 56px; border-radius: 12px; font-weight: 700; font-family: 'Outfit'; border-width: 2px; width: 100%;">
          </div>

          <div style="margin-top: 1rem; display: flex; flex-direction: column; gap: 1rem;">
            <button type="submit" class="btn-primary" id="save-profile" disabled style="height: 60px; font-size: 1.1rem; font-weight: 900; font-family: 'Outfit';">Complete Setup</button>
            <button type="button" class="btn-secondary" id="back-to-login" style="height: 52px; font-size: 0.95rem; font-weight: 800; font-family: 'Outfit'; border-style: dashed; border-width: 2px;">Back to Login</button>
          </div>
        </form>
      </div>
    `

    const form = document.getElementById('setup-form')
    const usernameInput = document.getElementById('username')
    const availabilityDiv = document.getElementById('availability-check')
    const saveBtn = document.getElementById('save-profile')
    const errorDiv = document.getElementById('setup-error')

    let timeout = null
    usernameInput.oninput = () => {
      saveBtn.disabled = true
      availabilityDiv.textContent = 'Checking...'
      clearTimeout(timeout)
      
      const username = usernameInput.value.trim().toLowerCase()
      if (username.length < 3) {
        availabilityDiv.textContent = 'Too short'
        return
      }

      timeout = setTimeout(async () => {
        const available = await AuthService.isUsernameAvailable(username)
        if (available) {
          availabilityDiv.textContent = '✅ Available'
          availabilityDiv.style.color = 'var(--success)'
          saveBtn.disabled = false
        } else {
          availabilityDiv.textContent = '❌ Taken'
          availabilityDiv.style.color = 'var(--error)'
        }
      }, 500)
    }

    form.onsubmit = async (e) => {
      e.preventDefault()
      const username = usernameInput.value.trim().toLowerCase()
      const full_name = document.getElementById('full_name').value.trim()

      const { data, error } = await AuthService.updateProfile({
        id: user.id,
        username,
        full_name,
        email: user.email,
        role: 'student'
      })

      if (error) {
        errorDiv.textContent = error.message
        errorDiv.style.display = 'block'
      } else {
        // Mark this as a fresh signup so the tour triggers once
        sessionStorage.setItem('isFreshSignup', 'true')
        onComplete(data[0])
      }
    }

    document.getElementById('back-to-login').onclick = () => {
      AuthService.signOut()
      location.reload()
    }
  }
}
