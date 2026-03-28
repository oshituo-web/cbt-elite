import { AuthService } from '../services/auth'

export const AuthComponent = {
  render(onAuthSuccess) {
    const container = document.getElementById('auth-container')
    container.style.display = 'block'
    container.innerHTML = `
      <div class="auth-card glass card" style="max-width: 400px; margin: 80px auto; padding: 2.5rem;">
        <h2 id="auth-title" style="text-align: center; font-family: 'Outfit'; margin-top: 0; font-weight: 800; font-size: 1.75rem;">Welcome Back</h2>
        <p id="auth-subtitle" style="text-align: center; color: var(--text-secondary); margin-bottom: 2rem; font-weight: 500;">Log in to your CBT practice account</p>
        
        <div id="auth-error" style="color: var(--error); font-size: 0.875rem; text-align: center; margin-bottom: 1.5rem; padding: 0.75rem; background: rgba(239, 68, 68, 0.1); border-radius: 8px; display: none; line-height: 1.4; border: 1px solid rgba(239, 68, 68, 0.2);"></div>
        <div id="auth-success" style="color: var(--success); font-size: 0.875rem; text-align: center; margin-bottom: 1.5rem; padding: 1rem; background: rgba(16, 185, 129, 0.1); border-radius: 8px; display: none; line-height: 1.4; border: 1px solid rgba(16, 185, 129, 0.2);"></div>

        <form id="auth-form" style="display: flex; flex-direction: column; gap: 1.25rem;">
          <div style="display: flex; flex-direction: column; gap: 0.5rem;">
            <label for="email" style="font-size: 0.85rem; font-weight: 700; color: var(--text-primary);">Email Address</label>
            <input type="email" id="email" placeholder="name@example.com" required class="glass-input" style="width: 100%; border-width: 2px;">
          </div>

          <div style="display: flex; flex-direction: column; gap: 0.5rem;">
            <label for="password" style="font-size: 0.85rem; font-weight: 700; color: var(--text-primary);">Password</label>
            <div style="position: relative;">
              <input type="password" id="password" placeholder="••••••••" required class="glass-input" style="padding-right: 3.5rem; width: 100%; border-width: 2px;">
              <button type="button" id="toggle-password" style="position: absolute; right: 12px; top: 50%; transform: translateY(-50%); background: none; border: none; color: var(--primary); cursor: pointer; font-size: 0.8rem; font-weight: 800;">SHOW</button>
            </div>
          </div>


          <div id="forgot-password-link" style="text-align: right; margin-top: -0.5rem;">
            <button type="button" id="btn-forgot-password" style="background: none; border: none; color: var(--primary); font-size: 0.85rem; cursor: pointer; font-weight: 700; padding: 0;">Forgot Password?</button>
          </div>

          <button type="submit" class="primary" style="width: 100%; margin-top: 0.5rem;">Login</button>
          
          <button type="button" id="toggle-auth" style="background: none; color: var(--primary); font-size: 0.9rem; font-weight: 700; margin-top: 0.5rem; border: none; cursor: pointer;">Need an account? Sign Up</button>
        </form>

        <div style="margin: 2rem 0 1.5rem 0; display: flex; align-items: center; gap: 12px;">
          <div style="flex: 1; height: 1px; background: var(--border-color);"></div>
          <span style="color: var(--text-secondary); font-size: 0.75rem; font-weight: 800;">OR CONTINUE WITH</span>
          <div style="flex: 1; height: 1px; background: var(--border-color);"></div>
        </div>

        <button id="google-signin" class="btn-secondary" style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 12px; background: #FFFFFF; color: #111827; border: 2px solid #E5E7EB;">
          <img src="https://www.google.com/favicon.ico" style="width: 18px;">
          <span style="font-weight: 700;">Google</span>
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
      document.getElementById('auth-title').textContent = isSignUp ? 'Create Elite Account' : 'Welcome Back'
      document.getElementById('auth-subtitle').textContent = isSignUp ? 'Join thousands of students practicing for success' : 'Log in to your CBT practice account'
      form.querySelector('button[type="submit"]').textContent = isSignUp ? 'Create Account & Sign Up' : 'Login'
      toggleBtn.textContent = isSignUp ? 'Already have an account? Login' : 'Need an account? Sign Up'
      
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
        errorDiv.textContent = 'Please enter your email address first.'
        errorDiv.style.display = 'block'
        return
      }
      
      const { error } = await AuthService.sendPasswordResetEmail(email)
      if (error) {
        errorDiv.textContent = error.message
        errorDiv.style.display = 'block'
      } else {
        successDiv.textContent = 'Password reset link sent! Check your inbox.'
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
          <div style="text-align: center; padding: 0.5rem;">
            <p style="margin-bottom: 1rem; font-weight: 600;">We’ve sent a confirmation email.<br>Please check your inbox (and spam folder).</p>
            <button id="resend-email" class="btn-secondary" style="width: 100%; border-style: dashed; font-weight: 800;">👉 Resend Email</button>
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
