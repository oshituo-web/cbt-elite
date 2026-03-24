import { AuthService } from '../services/auth'

export const ProfileSetupComponent = {
  render(user, onComplete) {
    const container = document.getElementById('auth-container')
    container.style.display = 'block'
    container.innerHTML = `
      <div class="auth-card glass card" style="max-width: 400px; margin: 100px auto;">
        <h2 style="text-align: center; font-family: 'Outfit';">Set Your Username</h2>
        <p style="text-align: center; color: var(--text-secondary); margin-bottom: 2rem;">Choose a unique handle for the leaderboard</p>
        
        <div id="setup-error" style="color: var(--error); font-size: 0.875rem; text-align: center; margin-bottom: 1rem; display: none;"></div>

        <form id="setup-form" style="display: flex; flex-direction: column; gap: 1rem;">
          <div style="position: relative;">
            <input type="text" id="username" placeholder="Username" required style="width: 100%; padding: 0.75rem; border-radius: 8px; border: 1px solid var(--glass-border); background: rgba(0,0,0,0.2); color: white;">
            <div id="availability-check" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); font-size: 0.75rem;"></div>
          </div>
          <input type="text" id="full_name" placeholder="Full Name" value="${user.user_metadata?.full_name || ''}" style="padding: 0.75rem; border-radius: 8px; border: 1px solid var(--glass-border); background: rgba(0,0,0,0.2); color: white;">
          <button type="submit" class="primary" id="save-profile" disabled>Save Profile</button>
          <button type="button" class="glass" id="back-to-login" style="margin-top: 0.5rem;">← Back to Login</button>
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
        onComplete(data[0])
      }
    }

    document.getElementById('back-to-login').onclick = () => {
      AuthService.logout()
      location.reload()
    }
  }
}
