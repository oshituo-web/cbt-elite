import { AuthService } from '../services/auth'

export const AuthComponent = {
  render(onAuthSuccess) {
    const container = document.getElementById('auth-container')
    container.style.display = 'block'
    container.innerHTML = `
      <div class="auth-card glass card" style="max-width: 400px; margin: 100px auto;">
        <h2 id="auth-title" style="text-align: center; font-family: 'Outfit'; margin-top: 0;">Welcome Back</h2>
        <p id="auth-subtitle" style="text-align: center; color: var(--text-secondary); margin-bottom: 2rem;">Log in to your CBT practice account</p>
        
        <div id="auth-error" style="color: var(--error); font-size: 0.875rem; text-align: center; margin-bottom: 1.5rem; padding: 0.75rem; background: rgba(255,82,82,0.1); border-radius: 8px; display: none; line-height: 1.4;"></div>
        <div id="auth-success" style="color: var(--success); font-size: 0.875rem; text-align: center; margin-bottom: 1.5rem; padding: 1rem; background: rgba(0,200,83,0.1); border-radius: 8px; display: none; line-height: 1.4;"></div>

        <form id="auth-form" style="display: flex; flex-direction: column; gap: 1rem;">
          <input type="email" id="email" placeholder="Email" required style="padding: 0.75rem; border-radius: 8px; border: 1px solid var(--glass-border); background: rgba(0,0,0,0.2); color: white;">
          <div style="position: relative;">
            <input type="password" id="password" placeholder="Password" required style="padding: 0.75rem; padding-right: 3rem; border-radius: 8px; border: 1px solid var(--glass-border); background: rgba(0,0,0,0.2); color: white; width: 100%;">
            <button type="button" id="toggle-password" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: none; border: none; color: var(--accent-primary); cursor: pointer; font-size: 0.75rem;">Show</button>
          </div>
          <button type="submit" class="primary">Sign In</button>
          <button type="button" id="toggle-auth" style="background: none; color: var(--accent-primary); font-size: 0.875rem;">Need an account? Sign Up</button>
        </form>

        <div style="margin: 1.5rem 0; display: flex; align-items: center; gap: 10px;">
          <div style="flex: 1; height: 1px; background: var(--glass-border);"></div>
          <span style="color: var(--text-secondary); font-size: 0.75rem;">OR</span>
          <div style="flex: 1; height: 1px; background: var(--glass-border);"></div>
        </div>

        <button id="google-signin" style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 10px; background: white; color: black;">
          <img src="https://www.google.com/favicon.ico" style="width: 18px;">
          Sign in with Google
        </button>
      </div>
    `

    let isSignUp = false
    const form = document.getElementById('auth-form')
    const toggleBtn = document.getElementById('toggle-auth')
    const errorDiv = document.getElementById('auth-error')
    const googleBtn = document.getElementById('google-signin')

    toggleBtn.onclick = () => {
      isSignUp = !isSignUp
      document.getElementById('auth-title').textContent = isSignUp ? 'Create Elite Account' : 'Welcome Back'
      document.getElementById('auth-subtitle').textContent = isSignUp ? 'Join thousands of students practicing for success' : 'Log in to your CBT practice account'
      form.querySelector('button[type="submit"]').textContent = isSignUp ? 'Create Account & Sign Up' : 'Sign In'
      toggleBtn.textContent = isSignUp ? 'Already have an account? Sign In' : 'Need an account? Sign Up'
      errorDiv.style.display = 'none'
      document.getElementById('auth-success').style.display = 'none'
      document.getElementById('email').focus()
    }

    const passToggle = document.getElementById('toggle-password')
    const passInput = document.getElementById('password')
    passToggle.onclick = () => {
      const isPass = passInput.type === 'password'
      passInput.type = isPass ? 'text' : 'password'
      passToggle.textContent = isPass ? 'Hide' : 'Show'
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
        document.getElementById('auth-success').style.display = 'none'
      } else if (isSignUp && !data.session) {
        // Registration successful but email confirmation required
        const successDiv = document.getElementById('auth-success')
        successDiv.innerHTML = `
          <div style="text-align: center;">
            <strong>Success!</strong><br>
            We've sent a confirmation link to <strong>${email}</strong>.<br>
            <p style="margin-top: 1rem; font-size: 0.8rem; color: var(--text-secondary);">Didn't receive it?</p>
            <button id="resend-email" style="background: none; color: var(--accent-primary); font-size: 0.875rem; text-decoration: underline; cursor: pointer;">Resend Confirmation Link</button>
          </div>
        `
        successDiv.style.display = 'block'
        errorDiv.style.display = 'none'
        form.reset()

        document.getElementById('resend-email').onclick = async () => {
          const btn = document.getElementById('resend-email')
          btn.textContent = 'Sending...'
          btn.disabled = true
          
          const { error: resendError } = await AuthService.resendConfirmationEmail(email)
          
          if (resendError) {
            errorDiv.textContent = resendError.message
            errorDiv.style.display = 'block'
            btn.textContent = 'Resend Confirmation Link'
            btn.disabled = false
          } else {
            btn.textContent = 'Email Sent! Check again.'
            setTimeout(() => {
              btn.textContent = 'Resend Confirmation Link'
              btn.disabled = false
            }, 5000)
          }
        }
      } else {
        onAuthSuccess(data.user)
      }
    }

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
