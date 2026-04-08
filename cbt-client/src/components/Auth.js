import { AuthService } from '../services/auth'

export const AuthComponent = {
  render(onAuthSuccess) {
    const container = document.getElementById('auth-container')
    container.style.display = 'block'
    container.innerHTML = `
      <div class="auth-card glass card scale-in" style="width: min(440px, 92vw); margin: 3rem auto; padding: 2.5rem 1.5rem; position: relative;">
        <div style="text-align: center; margin-bottom: 3.5rem;">
          <h2 id="auth-title" style="font-family: 'Outfit'; font-weight: 900; font-size: 2.4rem; color: var(--text-primary); margin-bottom: 0.5rem; letter-spacing: -0.02em;">Welcome Back</h2>
          <p id="auth-subtitle" style="color: var(--text-secondary); font-weight: 600; font-size: 1.1rem; line-height: 1.4;">Access your elite study dashboard</p>
        </div>
        
        <div id="auth-error" class="glass" style="color: var(--error); font-size: 0.95rem; font-weight: 700; text-align: center; margin-bottom: 2rem; padding: 1.25rem; background: rgba(239, 68, 68, 0.08); border-radius: 12px; display: none; line-height: 1.5; border: 1px solid rgba(239, 68, 68, 0.2); font-family: 'Outfit';"></div>
        <div id="auth-success" class="glass" style="color: var(--success); font-size: 0.95rem; font-weight: 700; text-align: center; margin-bottom: 2rem; padding: 1.25rem; background: rgba(16, 185, 129, 0.08); border-radius: 12px; display: none; line-height: 1.5; border: 1px solid rgba(16, 185, 129, 0.2); font-family: 'Outfit';"></div>

        <form id="auth-form" style="display: flex; flex-direction: column; gap: 1.75rem;">
          <div style="display: flex; flex-direction: column; gap: 0.75rem;">
            <label for="email" style="font-size: 0.8rem; font-weight: 800; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.1em; font-family: 'Outfit';">Email Address</label>
            <input type="email" id="email" placeholder="name@example.com" required class="glass-input" style="height: 56px; border-radius: 12px; font-weight: 700; font-family: 'Outfit'; border-width: 2px;">
          </div>

          <div style="display: flex; flex-direction: column; gap: 0.75rem;">
            <label for="password" style="font-size: 0.8rem; font-weight: 800; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.1em; font-family: 'Outfit';">Password</label>
            <div style="position: relative;">
              <input type="password" id="password" placeholder="••••••••" required class="glass-input" style="height: 56px; border-radius: 12px; padding-right: 4rem; font-weight: 700; font-family: 'Outfit'; border-width: 2px;">
              <button type="button" id="toggle-password" style="position: absolute; right: 16px; top: 50%; transform: translateY(-50%); background: none; border: none; color: var(--primary); cursor: pointer; font-size: 0.75rem; font-weight: 900; font-family: 'Outfit';">SHOW</button>
            </div>
          </div>


          <div id="forgot-password-link" style="text-align: right; margin-top: -0.75rem;">
            <button type="button" id="btn-forgot-password" style="background: none; border: none; color: var(--primary); font-size: 0.9rem; cursor: pointer; font-weight: 800; padding: 0.5rem; font-family: 'Outfit';">Forgot Password?</button>
          </div>

          <button type="submit" class="btn-primary" style="height: 60px; font-size: 1.1rem; font-weight: 900; font-family: 'Outfit'; box-shadow: var(--shadow-lg);">Login to Elite</button>
          
          <button type="button" id="toggle-auth" style="background: none; color: var(--text-primary); font-size: 0.95rem; font-weight: 700; margin-top: 0.5rem; border: none; cursor: pointer; opacity: 0.8; transition: opacity 0.2s; font-family: 'Outfit';">Don't have an account? <span style="color: var(--primary); font-weight: 900;">Sign Up</span></button>
        </form>

        <div style="margin: 3.5rem 0 2.5rem 0; display: flex; align-items: center; gap: 16px;">
          <div style="flex: 1; height: 1px; background: var(--glass-border);"></div>
          <span style="color: var(--text-secondary); font-size: 0.7rem; font-weight: 900; letter-spacing: 0.2em; font-family: 'Outfit';">OR LOGIN WITH</span>
          <div style="flex: 1; height: 1px; background: var(--glass-border);"></div>
        </div>

        <button id="google-signin" class="glass card" style="width: 100%; height: 56px; display: flex; align-items: center; justify-content: center; gap: 1rem; background: rgba(255, 255, 255, 0.05); color: var(--text-primary); border: 2px solid var(--glass-border); border-radius: 12px; cursor: pointer; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);">
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" style="width: 18px;">
          <span style="font-weight: 800; font-family: 'Outfit'; font-size: 1rem;">Google Account</span>
        </button>
      </div>
    `

    let isSignUp = false
    const form = document.getElementById('auth-form')
    const toggleBtn = document.getElementById('toggle-auth')
    const errorDiv = document.getElementById('auth-error')
    const successDiv = document.getElementById('auth-success')
    const googleBtn = document.getElementById('google-signin')
    const forgotLink = document.getElementById('forgot-password-link')

    toggleBtn.onclick = () => {
      isSignUp = !isSignUp
      document.getElementById('auth-title').textContent = isSignUp ? 'Join CBT Elite' : 'Welcome Back'
      document.getElementById('auth-subtitle').textContent = isSignUp ? 'Master JAMB, WAEC & NECO with premium practice tools.' : 'Access your elite study dashboard'
      form.querySelector('button[type="submit"]').textContent = isSignUp ? 'Start My Success Journey' : 'Login to Elite'
      toggleBtn.innerHTML = isSignUp ? 'Already have an account? <span style="color: var(--primary); font-weight: 900;">Login</span>' : 'Don\'t have an account? <span style="color: var(--primary); font-weight: 900;">Sign Up</span>'
      
      forgotLink.style.display = isSignUp ? 'none' : 'block'
      
      errorDiv.style.display = 'none'
      successDiv.style.display = 'none'
    }

    // Password Toggle
    const passToggle = document.getElementById('toggle-password')
    const passInput = document.getElementById('password')
    passToggle.onclick = () => {
      const isPass = passInput.type === 'password'
      passInput.type = isPass ? 'text' : 'password'
      passToggle.textContent = isPass ? 'HIDE' : 'SHOW'
    }

    // Forgot Password Logic
    document.getElementById('btn-forgot-password').onclick = async () => {
      const email = document.getElementById('email').value
      if (!email) {
        errorDiv.textContent = 'Enter your email above first.'
        errorDiv.style.display = 'block'
        return
      }
      
      const { error } = await AuthService.sendPasswordResetEmail(email)
      if (error) {
        errorDiv.textContent = error.message
        errorDiv.style.display = 'block'
      } else {
        successDiv.textContent = 'Success! Check your inbox for a reset link.'
        successDiv.style.display = 'block'
        errorDiv.style.display = 'none'
      }
    }

    form.onsubmit = async (e) => {
      e.preventDefault()
      const email = document.getElementById('email').value
      const password = document.getElementById('password').value
      
      const { data, error } = isSignUp 
        ? await AuthService.signUp(email, password)
        : await AuthService.signIn(email, password)

      if (error) {
        errorDiv.textContent = error.message
        errorDiv.style.display = 'block'
        successDiv.style.display = 'none'
      } else if (isSignUp && !data.session) {
        // Registration successful but email confirmation required
        successDiv.innerHTML = `
          <div style="text-align: center; padding: 1rem;">
             <div style="font-size: 3rem; margin-bottom: 1.5rem;">📬</div>
            <h4 style="font-family: 'Outfit'; font-weight: 900; margin-bottom: 0.5rem; font-size: 1.25rem;">Verify Your Account</h4>
            <p style="margin-bottom: 2rem; font-weight: 600; font-size: 1rem; color: var(--text-secondary); line-height: 1.5;">We’ve sent a premium activation link to your email. Please check your inbox.</p>
            <button id="resend-email" class="btn-secondary" style="width: 100%; border-radius: 12px; font-weight: 900; font-family: 'Outfit'; height: 52px; border-width: 2px;">Resend Email</button>
          </div>
        `
        successDiv.style.display = 'block'
        errorDiv.style.display = 'none'
        form.reset()

        document.getElementById('resend-email').onclick = async () => {
          const btn = document.getElementById('resend-email')
          const originalText = btn.innerHTML
          btn.innerHTML = 'Sending...'
          btn.disabled = true
          await AuthService.resendConfirmationEmail(email)
          btn.innerHTML = '✅ Sent!'
          setTimeout(() => {
            btn.innerHTML = originalText
            btn.disabled = false
          }, 5000)
        }
      } else {
        onAuthSuccess(data.user)
      }
    }

    // Google Sign In
    googleBtn.onclick = async () => {
      const { error } = await AuthService.signInWithGoogle()
      if (error) {
        errorDiv.textContent = error.message
        errorDiv.style.display = 'block'
      }
    }

  },

  hide() {
    document.getElementById('auth-container').style.display = 'none'
  }
}
