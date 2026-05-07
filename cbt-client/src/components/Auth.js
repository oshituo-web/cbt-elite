import { AuthService } from '../services/auth'

export const AuthComponent = {
  render(onAuthSuccess) {
    const container = document.getElementById('auth-container')
    container.style.display = 'block'
    document.body.style.overflow = 'hidden'
    container.innerHTML = `
      <div class="auth-split-wrapper" style="animation: fadeIn 0.4s ease;">
        <div class="auth-hero">
          <div class="auth-hero-graphic"></div>
          <div class="auth-hero-glass-box box-1"></div>
          <div class="auth-hero-glass-box box-2"></div>
          
          <div style="position: relative; z-index: 2;">
             <h1 style="font-family: 'Outfit'; font-size: min(4rem, 6vw); font-weight: 900; line-height: 1.1; margin-bottom: 1rem; color: var(--text-primary);">Master Your<br><span style="color: var(--accent-primary);">Examinations</span></h1>
             <p style="font-size: 1.2rem; color: var(--text-secondary); max-width: 400px; font-weight: 500;">Join thousands of top-performing students smashing their exam targets using AI-driven practice and elite competition.</p>
          </div>
          
          <div class="testimonial-container" id="auth-testimonials"></div>
        </div>
        
        <div class="auth-content-area">
          <div class="auth-card glass card scale-in" style="width: 100%; max-width: 440px; position: relative; border-radius: 24px;">
            <div style="text-align: center; margin-bottom: 2.5rem;">
              <h2 id="auth-title" style="font-family: 'Outfit'; font-weight: 900; font-size: 2.2rem; color: var(--text-primary); margin-bottom: 0.5rem; letter-spacing: -0.02em; display: flex; align-items: center; justify-content: center; gap: 0.5rem;">Welcome to <span style="display: flex; align-items: center; gap: 0.4rem; color: var(--accent-primary);"><i data-lucide="graduation-cap" style="width: 2.2rem; height: 2.2rem;"></i> CBT Elite</span></h2>
              <p id="auth-subtitle" style="color: var(--text-secondary); font-weight: 600; font-size: 1.1rem; line-height: 1.4;">Access your elite study dashboard</p>
            </div>
            
            <div id="auth-error" class="glass" style="color: var(--error); font-size: 0.95rem; font-weight: 700; text-align: center; margin-bottom: 2rem; padding: 1.25rem; background: rgba(239, 68, 68, 0.08); border-radius: 12px; display: none; line-height: 1.5; border: 1px solid rgba(239, 68, 68, 0.2); font-family: 'Outfit';"></div>
            <div id="auth-success" class="glass" style="color: var(--success); font-size: 0.95rem; font-weight: 700; text-align: center; margin-bottom: 2rem; padding: 1.25rem; background: rgba(16, 185, 129, 0.08); border-radius: 12px; display: none; line-height: 1.5; border: 1px solid rgba(16, 185, 129, 0.2); font-family: 'Outfit';"></div>

            <button id="google-signin" class="glass card" style="width: 100%; height: 52px; display: flex; align-items: center; justify-content: center; gap: 1rem; background: rgba(255, 255, 255, 0.05); color: var(--text-primary); border: 2px solid var(--glass-border); border-radius: 12px; cursor: pointer; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); margin: 0; padding: 0;">
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" style="width: 18px;">
              <span style="font-weight: 800; font-family: 'Outfit'; font-size: 0.95rem;">Continue with Google</span>
            </button>

            <div style="margin: 2rem 0; display: flex; align-items: center; gap: 16px;">
              <div style="flex: 1; height: 1px; background: var(--glass-border);"></div>
              <span style="color: var(--text-secondary); font-size: 0.7rem; font-weight: 900; letter-spacing: 0.2em; font-family: 'Outfit';">OR LOGIN WITH EMAIL</span>
              <div style="flex: 1; height: 1px; background: var(--glass-border);"></div>
            </div>

            <form id="auth-form" style="display: flex; flex-direction: column; gap: 1.5rem;">
              <div style="display: flex; flex-direction: column; gap: 0.6rem;">
                <label for="email" style="font-size: 0.75rem; font-weight: 800; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.1em; font-family: 'Outfit';">Email Address</label>
                <input type="email" id="email" placeholder="name@example.com" required autocomplete="email" class="glass-input" style="height: 52px; border-radius: 12px; font-weight: 700; font-family: 'Outfit'; border-width: 2px; transition: all 0.3s;">
              </div>

              <div style="display: flex; flex-direction: column; gap: 0.6rem;">
                <label for="password" style="font-size: 0.75rem; font-weight: 800; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.1em; font-family: 'Outfit';">Password</label>
                <div style="position: relative;">
                  <input type="password" id="password" placeholder="••••••••" required autocomplete="current-password" class="glass-input" style="height: 52px; border-radius: 12px; padding-right: 4rem; font-weight: 700; font-family: 'Outfit'; border-width: 2px; width: 100%; transition: border-color 0.3s; box-sizing: border-box;">
                  <button type="button" id="toggle-password" style="position: absolute; right: 16px; top: 50%; transform: translateY(-50%); background: none; border: none; color: var(--primary); cursor: pointer; font-size: 0.7rem; font-weight: 900; font-family: 'Outfit';">SHOW</button>
                </div>
              </div>


              <div style="display: flex; justify-content: space-between; align-items: center; margin-top: -0.5rem;">
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                  <input type="checkbox" id="remember-me" style="width: 16px; height: 16px; border-radius: 4px; accent-color: var(--accent-primary); cursor: pointer;">
                  <label for="remember-me" style="font-size: 0.85rem; font-weight: 700; color: var(--text-secondary); cursor: pointer; font-family: 'Outfit';">Remember Me</label>
                </div>
                <div id="forgot-password-link" style="text-align: right;">
                  <button type="button" id="btn-forgot-password" style="background: none; border: none; color: var(--primary); font-size: 0.85rem; cursor: pointer; font-weight: 800; padding: 0.5rem 0; font-family: 'Outfit'; transition: opacity 0.2s;">Forgot Password?</button>
                </div>
              </div>

              <button type="submit" class="btn-primary" style="height: 56px; font-size: 1.05rem; font-weight: 900; font-family: 'Outfit'; box-shadow: var(--shadow-lg); border-radius: 14px;">Login to Elite</button>
              
              <button type="button" id="toggle-auth" style="background: none; color: var(--text-primary); font-size: 0.95rem; font-weight: 700; margin-top: 0.5rem; border: none; cursor: pointer; opacity: 0.8; transition: opacity 0.2s; font-family: 'Outfit';">Don't have an account? <span style="color: var(--primary); font-weight: 900;">Sign Up</span></button>
            </form>
          </div>
        </div>
      </div>
    `

    let isSignUp = false
    const form = document.getElementById('auth-form')
    const toggleBtn = document.getElementById('toggle-auth')
    const errorDiv = document.getElementById('auth-error')
    const successDiv = document.getElementById('auth-success')
    const googleBtn = document.getElementById('google-signin')
    const forgotLink = document.getElementById('forgot-password-link')
    const rememberMeCheck = document.getElementById('remember-me')

    // Handle incoming session overlap errors
    if (window.location.hash === '#session-overlap') {
      errorDiv.textContent = 'Session terminated: safely logged in from another device.'
      errorDiv.style.display = 'block'
      window.history.replaceState(null, '', window.location.pathname)
    }

    // 🛡️ SECURITY FIX: Only remember email — NEVER cache passwords in localStorage.
    // Supabase handles session persistence automatically via its own secure token storage.
    setTimeout(() => {
      const cachedEmail = localStorage.getItem('cbt_elite_saved_email')
      if (cachedEmail) {
        document.getElementById('email').value = cachedEmail
        rememberMeCheck.checked = true
      }
      // Clean up any legacy plaintext passwords that may have been stored previously
      localStorage.removeItem('cbt_elite_saved_pass')
    }, 50)

    toggleBtn.onclick = () => {
      isSignUp = !isSignUp
      document.getElementById('auth-title').innerHTML = isSignUp 
        ? 'Join <span style="display: flex; align-items: center; gap: 0.4rem; color: var(--accent-primary);"><i data-lucide="graduation-cap" style="width: 2.2rem; height: 2.2rem;"></i> CBT Elite</span>' 
        : 'Welcome to <span style="display: flex; align-items: center; gap: 0.4rem; color: var(--accent-primary);"><i data-lucide="graduation-cap" style="width: 2.2rem; height: 2.2rem;"></i> CBT Elite</span>'
      document.getElementById('auth-subtitle').textContent = isSignUp ? 'Unlock premium practice tools and master your exams.' : 'Access your elite study dashboard'
      form.querySelector('button[type="submit"]').textContent = isSignUp ? 'Start My Success Journey' : 'Login to Elite'
      toggleBtn.innerHTML = isSignUp ? 'Already have an account? <span style="color: var(--primary); font-weight: 900;">Login</span>' : 'Don\'t have an account? <span style="color: var(--primary); font-weight: 900;">Sign Up</span>'
      
      forgotLink.style.display = isSignUp ? 'none' : 'block'
      
      errorDiv.style.display = 'none'
      successDiv.style.display = 'none'
      if (window.lucide) window.lucide.createIcons()
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
      const rememberMe = rememberMeCheck.checked
      
      const { data, error } = isSignUp 
        ? await AuthService.signUp(email, password)
        : await AuthService.signIn(email, password)

      if (error) {
        errorDiv.textContent = error.message
        errorDiv.style.display = 'block'
        successDiv.style.display = 'none'

        // Trigger shake validation animation
        const passInput = document.getElementById('password')
        const emailInput = document.getElementById('email')
        passInput.classList.remove('input-error')
        emailInput.classList.remove('input-error')
        // Force DOM reflow to restart animation reliably
        void passInput.offsetWidth
        passInput.classList.add('input-error')
        emailInput.classList.add('input-error')

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
        // 🛡️ SECURITY FIX: Only cache email — never store passwords in localStorage
        if (rememberMe) {
          localStorage.setItem('cbt_elite_saved_email', email)
        } else {
          localStorage.removeItem('cbt_elite_saved_email')
        }
        // Always ensure no legacy password is stored
        localStorage.removeItem('cbt_elite_saved_pass')

        // Generate and sync Single Session device token
        if (data && data.user) {
          errorDiv.style.display = 'none'
          const newToken = crypto.randomUUID()
          localStorage.setItem('cbt_elite_device_token', newToken)
          await AuthService.updateProfile({ id: data.user.id, current_session_token: newToken })
        }

        onAuthSuccess(data.user)
      }
    }

    // Google Sign In
    googleBtn.onclick = async () => {
      // 🧭 OAuth triggers a page redirect. Code below this line will NOT execute 
      // in the same session once the redirect begins. The post-login flow 
      // (checking profiles, showing setup) is handled in main.js/initApp().
      const { error: authError } = await AuthService.signInWithGoogle()
      
      if (authError) {
        errorDiv.textContent = authError.message
        errorDiv.style.display = 'block'
      }
    }

    // Form Validation UI
    const emailInput = document.getElementById('email')
    const passwordInput = document.getElementById('password')

    if (emailInput) {
      emailInput.addEventListener('input', (e) => {
        e.target.classList.remove('input-error')
        if (e.target.checkValidity() && e.target.value.length > 5) {
          e.target.classList.add('input-valid')
        } else {
          e.target.classList.remove('input-valid')
        }
      })
    }

    if (passwordInput) {
      passwordInput.addEventListener('input', (e) => {
        e.target.classList.remove('input-error')
      })
    }
    
    // Testimonial Engine
    const testimonials = [
      { text: "CBT Elite transformed my preparation — my score jumped over 100 points!", author: "Sarah T., Medicine" },
      { text: "The AI explanations are like having a personal tutor 24/7.", author: "David O., Engineering" },
      { text: "I finally understand Physics! Thanks to the Elite Insights.", author: "Michael A., Computer Science" },
      { text: "Passed my exams with straight As using the custom mock tests.", author: "Grace E., Law" }
    ]
    
    const testContainer = document.getElementById('auth-testimonials')
    if (testContainer) {
      testContainer.innerHTML = testimonials.map((t, i) => `
        <div class="testimonial-item ${i === 0 ? 'active' : ''}" data-index="${i}">
           <div style="display: flex; gap: 1rem; align-items: flex-start;">
             <i data-lucide="quote" style="width: 24px; color: var(--accent-secondary); flex-shrink: 0; opacity: 0.5;"></i>
             <div>
               <p style="font-size: 1.1rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.5rem; line-height: 1.4;">"${t.text}"</p>
               <span style="font-size: 0.85rem; font-weight: 800; color: var(--text-secondary); text-transform: uppercase;">— ${t.author}</span>
             </div>
           </div>
        </div>
      `).join('')
      
      let currTestIdx = 0
      AuthComponent._testimonialTimer = setInterval(() => {
        const items = testContainer.querySelectorAll('.testimonial-item')
        if(!items.length) return
        items[currTestIdx].classList.remove('active')
        currTestIdx = (currTestIdx + 1) % items.length
        items[currTestIdx].classList.add('active')
      }, 5000)
    }

    // Render icons on first load
    if (window.lucide) {
      setTimeout(() => window.lucide.createIcons(), 50);
    }

  },

  hide() {
    if (this._testimonialTimer) {
      clearInterval(this._testimonialTimer);
    }
    document.body.style.overflow = ''
    document.getElementById('auth-container').style.display = 'none'
  }
}
