import { DataService } from '../services/data'
import { sanitizeContent } from '../utils/sanitize'
import { TimerService } from '../services/TimerService'
import { ExamSessionManager } from '../services/ExamSessionManager'
import { QuestionRenderer } from '../services/QuestionRenderer'
import { SubscriptionService } from '../services/subscriptionService'
import { SubscriptionManager } from '../utils/subscriptionManager'
export class Exam {
  constructor(questions, user, subject = null, examType = null, mode = 'practice', isReview = false, pastAnswers = {}, intendedSubjects = []) {
    this.session = new ExamSessionManager(questions, pastAnswers, !isReview)
    
    // Phase 4: Keyboard Shortcuts
    this._handleKeyDown = (e) => {
      if (document.activeElement.tagName === 'TEXTAREA') return // Don't intercept when typing in theory
      
      if (e.key >= '1' && e.key <= '4') {
        const idx = parseInt(e.key) - 1
        const btns = document.querySelectorAll('.option-btn')
        if (btns[idx]) btns[idx].click()
      } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
        document.getElementById('next-btn')?.click()
      } else if (e.key === 'ArrowLeft') {
        document.getElementById('prev-btn')?.click()
      }
    }
    window.addEventListener('keydown', this._handleKeyDown)

    this.user = user
    this.subject = subject
    this.examType = examType
    this.mode = mode
    this.isReviewMode = isReview
    this.profile = user
    this.bookmarks = []
    
    if (this.examType === 'JAMB') {
      try {
        if (intendedSubjects && intendedSubjects.length > 0) {
          this.jambSubjects = intendedSubjects;
        } else {
          // Dynamic fallback with normalization
          const subjects = questions
            .map(q => {
               const name = q.subject || q.subjects?.subject_name || 'General';
               // Normalize common variants
               if (name.toLowerCase().includes('english')) return 'Use of English';
               return name;
            })
            .filter(Boolean)
          this.jambSubjects = [...new Set(subjects)]
        }
        this.activeJambSubject = this.jambSubjects[0] || 'General'
      } catch (err) {
        console.error("Exam constructor failed to map JAMB subjects:", err)
        this.jambSubjects = ['General']
        this.activeJambSubject = 'General'
      }
    }

    // Timer Initialization
    let initialTime = 0
    const isTheory = questions.some(q => q.question_type === 'theory')

    if (this.mode === 'exam') {
      if (this.examType === 'JAMB') {
        initialTime = 120 * 60 // 2 hours
      } else {
        // Phase 17: WAEC / NECO Exam sessions
        initialTime = isTheory ? (12 * 60) : (30 * 60) 
      }
    } else if (this.mode === 'practice') {
      // Phase 17: Practice sessions
      initialTime = 20 * 60 // 20 minutes strictly as requested
    }

    this.initialTime = initialTime
    this.remainingTime = initialTime
  }

  saveState() {
    if (this.isReviewMode) return
    try {
        const state = {
          questions: this.session.questions,
          userAnswers: this.session.userAnswers,
          currentIndex: this.session.currentIndex,
          remainingTime: TimerService.getRemainingTime(),
          subject: this.subject,
          examType: this.examType,
          mode: this.mode,
          activeJambSubject: this.activeJambSubject,
          timestamp: Date.now()
        }
        localStorage.setItem('cbt_active_exam', JSON.stringify(state))
    } catch (err) {
        console.warn("Could not save exam state to localStorage (Quota likely exceeded):", err)
    }
  }

  static clearState() {
    try {
        localStorage.removeItem('cbt_active_exam')
    } catch (err) {
        console.warn("Failed to clear localStorage:", err)
    }
  }

  async render(onFinish, onBack, resumeState = null) {
    const container = document.getElementById('exam-container')
    container.style.display = 'block'
    
    // 🔥 FIX: Reset scroll position to top immediately
    window.scrollTo(0, 0);
    document.body.scrollTop = 0;
    container.scrollTop = 0;
    document.body.classList.add('in-exam')
    
    this._explanationsFreeAccess = false;
    try {
        const configResp = await DataService.getSystemConfig('explanations_free_access');
        this._explanationsFreeAccess = configResp.data?.value === true || configResp.data?.value === 'true';
    } catch (err) {
        console.warn("Failed to fetch global config:", err);
    }
    
    if (resumeState) {
      this.session.userAnswers = resumeState.userAnswers || {}
      this.session.currentIndex = resumeState.currentIndex || 0
      this.activeJambSubject = resumeState.activeJambSubject || this.activeJambSubject
      this.remainingTime = resumeState.remainingTime || this.initialTime
    } else if (!this.isReviewMode) {
      // Enforcement: Session Limits
      try {
        if (!SubscriptionService.canStartSession(this.profile, this.mode, this._explanationsFreeAccess)) {
          const limitStr = (this.profile.tier === 'medium' ? '5 (Activated)' : '3 (Free)')
          alert(`\u26A0 Limit reached! You've used your daily limit of ${limitStr} ${this.mode} sessions. Upgrade to Premium for unlimted access.`)
          onBack()
          return
        }
        await SubscriptionService.incrementSessionCount(this.profile)
      } catch (err) {
        console.warn("Subscription check failed, allowing session to start in bypass mode:", err)
      }
    }
    
    container.innerHTML = `
      <div class="exam-layout fade-in">
        <!-- Persistent Top Bar -->
        <!-- 🏷️ Phase 12: New Dual-Layer Organized Header -->
        <div class="exam-header-wrapper glass">
          <div class="exam-header-primary">
            <div class="header-left">
              <button id="exam-back-btn" class="header-icon-btn" title="Go Back">
                <i data-lucide="chevron-left"></i>
              </button>
              <span id="display-exam-type" class="badge-exam">...</span>
            </div>

            <div class="header-center">
              <div id="q-meta" class="q-counter-mini">1 of 0</div>
            </div>

            <div class="header-right">
              <button id="mobile-map-toggle" class="header-icon-btn" title="View Reference Map">
                <i data-lucide="map"></i>
              </button>
              <button id="toggle-calc" class="header-icon-btn" title="Open Calculator">
                <i data-lucide="calculator"></i>
              </button>
              <div id="timer" class="timer-mini">00:00</div>
            </div>
          </div>

          <div class="exam-header-meta">
            <div style="display: flex; align-items: center; gap: 0.75rem;">
               <i data-lucide="book-open" style="width: 14px; height: 14px; opacity: 0.7;"></i>
               <span id="display-subject" class="meta-subject">...</span>
            </div>
            <span id="display-topic" class="meta-topic">...</span>
          </div>
        </div>

        <div class="exam-content-wrapper" id="exam-wrapper">
          <!-- Left side: Pinned Content (Passage) -->
          <div id="pinned-content-area" class="glass">
             <div id="q-group-content-pinned" class="passage-container"></div>
          </div>

          <!-- Main Content -->
          <div class="exam-main glass">
            <!-- Subject Tabs placed at the top of content area -->
            <div id="jamb-tabs-container" style="display: none; justify-content: flex-start; gap: 0.75rem; margin-bottom: 2rem; overflow-x: auto; padding-bottom: 0.75rem;"></div>

            <div id="question-area" style="flex: 1;">
              <!-- Inline passage for mobile or fallback -->
              <div id="q-group-content-inline" class="passage-container glass card"></div>
              
              <div id="q-diagram" style="display: none; margin-bottom: 2.5rem;"></div>
              
              <div id="q-text" style="font-size: 1.35rem; line-height: 1.6; margin-bottom: 3rem; font-weight: 600; color: var(--text-primary); font-family: 'Outfit';">...</div>

              <div id="options-container" style="display: flex; flex-direction: column; gap: 1.25rem;"></div>
              
              <div id="explanation-container" class="glass card scale-in" style="margin-top: 3.5rem; padding: 2.5rem; display: none; border-left: 6px solid var(--primary); background: linear-gradient(90deg, rgba(37, 99, 235, 0.05) 0%, transparent 100%);"></div>
            </div>

            <div class="exam-footer" style="margin-top: 5rem; padding-top: 2rem; border-top: 1px solid var(--glass-border); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1.5rem;">
              <div style="display: flex; gap: 1rem;">
                <button id="prev-btn" class="btn-secondary" style="height: 52px; padding: 0 1.5rem; font-weight: 800;">PREVIOUS</button>
                <button id="next-btn" class="btn-primary" style="height: 52px; padding: 0 2rem; font-weight: 900;">NEXT QUESTION</button>
              </div>
              
              <div style="display: flex; gap: 1rem; align-items: center; flex-wrap: wrap;">
                <button id="report-btn" class="btn-secondary" style="border: none; color: var(--error); font-size: 0.8rem; font-weight: 800; background: transparent; opacity: 0.7;">REPORT ISSUE</button>
                <button id="toggle-bookmark" class="btn-secondary" style="height: 48px; border-radius: var(--radius-md); font-weight: 800; padding: 0 1.25rem;">💾 SAVE</button>
                ${this.isReviewMode ? '<button id="exam-exit-review" class="btn-primary" style="height: 48px; padding: 0 1.5rem;">EXIT REVIEW</button>' : '<button id="finish-btn" class="btn-primary" style="height: 52px; padding: 0 2.5rem; background: var(--accent-secondary); font-weight: 900;">FINISH EXAM</button>'}
              </div>
            </div>
          </div>

          <!-- Sidebar Navigation -->
          <div class="drawer-overlay" id="exam-drawer-overlay"></div>
          <div class="exam-sidebar glass" id="exam-sidebar" style="padding: 2rem; border-left: 1px solid var(--glass-border);">
            <div style="font-weight: 900; margin-bottom: 1.5rem; font-size: 0.85rem; letter-spacing: 0.15em; text-transform: uppercase; color: var(--text-secondary); font-family: 'Outfit';">Question Map</div>
            <div id="question-grid" style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 0.6rem;"></div>
            
            <div style="margin-top: auto; padding-top: 2rem;">
              <div class="progress-v2-container" style="margin-bottom: 0.75rem;">
                 <div id="progress-bar" class="progress-v2-fill primary" style="width: 0%;"></div>
              </div>
              <div style="display: flex; justify-content: space-between; font-size: 0.8rem; font-weight: 800; font-family: 'Outfit';">
                 <span style="color: var(--text-secondary);">SESSION PROGRESS</span>
                 <span id="progress-text" style="color: var(--primary);">0%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Report Modal -->
      <div id="report-modal" class="modal-overlay" style="display: none;">
        <div class="modal-content glass" style="width: min(480px, 92vw); padding: 2rem;">
          <h3 style="margin-bottom: 0.5rem; font-family: 'Outfit'; font-weight: 900; font-size: 1.5rem; display: flex; justify-content: space-between; align-items: center;">
            Report Issue <i data-lucide="x" id="close-report-x" style="cursor: pointer; color: var(--error); width: 28px; height: 28px;"></i>
          </h3>
          <p style="font-size: 1rem; color: var(--text-secondary); font-weight: 500; margin-bottom: 2rem;">What's wrong with this question?</p>
          <div style="display: flex; flex-direction: column; gap: 0.75rem;">
            <button class="reason-btn glass" style="text-align: left; padding: 1.25rem; border-radius: 12px; font-weight: 700; color: var(--text-primary); transition: all 0.2s;">Typo / Grammar error</button>
            <button class="reason-btn glass" style="text-align: left; padding: 1.25rem; border-radius: 12px; font-weight: 700; color: var(--text-primary); transition: all 0.2s;">Incorrect Answer / Missing Option</button>
            <button class="reason-btn glass" style="text-align: left; padding: 1.25rem; border-radius: 12px; font-weight: 700; color: var(--text-primary); transition: all 0.2s;">Image missing / broken</button>
            <button class="reason-btn glass" style="text-align: left; padding: 1.25rem; border-radius: 12px; font-weight: 700; color: var(--text-primary); transition: all 0.2s;">Other</button>
          </div>
          <button id="close-report" class="btn-secondary" style="margin-top: 2rem; width: 100%; height: 52px; font-weight: 800;">CLOSE</button>
        </div>
      </div>
      
      <!-- Finish Modal -->
      <div id="finish-modal" class="modal-overlay" style="display: none;">
        <div class="modal-content glass" style="width: min(480px, 92vw); text-align: center; padding: 2.5rem 1.5rem;">
          <div style="background: rgba(147, 51, 234, 0.1); width: 80px; height: 80px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 1.5rem;">
             <i data-lucide="flag" style="width: 40px; height: 40px; color: var(--accent-secondary);"></i>
          </div>
          <h2 style="margin-bottom: 1rem; font-family: 'Outfit'; font-weight: 900; color: var(--text-primary); font-size: 1.75rem;">End Session?</h2>
          <p style="font-size: 1.1rem; color: var(--text-secondary); font-weight: 500; margin-bottom: 3rem;">Are you sure you want to finalize and submit? You cannot undo this action.</p>
          <div style="display: flex; gap: 1.25rem;">
            <button id="cancel-finish" class="btn-secondary" style="flex: 1; height: 56px; font-weight: 800;">KEEP WORKING</button>
            <button id="confirm-finish" class="btn-primary" style="flex: 1; height: 56px; font-weight: 900; background: var(--accent-secondary);">SUBMIT NOW</button>
          </div>
        </div>
      </div>

      <!-- Floating Calculator -->
      <div id="exam-calculator" class="calculator-modal glass scale-in" style="display: none; border: 2px solid var(--accent-primary); border-radius: var(--radius-lg); overflow: hidden; box-shadow: var(--shadow-xl);">
        <div class="calc-header" style="background: var(--accent-primary); padding: 1rem 1.5rem; color: white; font-weight: 900; font-family: 'Outfit'; font-size: 0.9rem; letter-spacing: 0.1em; display: flex; justify-content: space-between; align-items: center;">
          <span>ELITE CALCULATOR</span>
          <button id="close-calc" style="background: none; border: none; color: white; font-size: 1.5rem; cursor: pointer;">×</button>
        </div>
        <div class="calc-display" id="calc-display" style="padding: 1.5rem; background: rgba(0,0,0,0.2); font-family: 'Outfit'; font-weight: 900; font-size: 2.5rem; text-align: right; color: var(--text-primary);">0</div>
        <div class="calc-buttons" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1px; background: var(--glass-border); padding: 1px;">
          <button class="calc-btn clear" data-val="C" style="padding: 1.25rem; font-weight: 800; background: var(--surface-color); border: none; font-size: 1.2rem; color: var(--error);">C</button>
          <button class="calc-btn op" data-val="/" style="padding: 1.25rem; font-weight: 800; background: var(--surface-color); border: none; font-size: 1.2rem; color: var(--primary);">÷</button>
          <button class="calc-btn op" data-val="*" style="padding: 1.25rem; font-weight: 800; background: var(--surface-color); border: none; font-size: 1.2rem; color: var(--primary);">×</button>
          <button class="calc-btn clear" data-val="DEL" style="padding: 1.25rem; font-weight: 800; background: var(--surface-color); border: none; font-size: 1.2rem; color: var(--error);">⌫</button>
          
          <button class="calc-btn" data-val="7" style="padding: 1.25rem; font-weight: 800; background: var(--surface-color); border: none; font-size: 1.2rem;">7</button>
          <button class="calc-btn" data-val="8" style="padding: 1.25rem; font-weight: 800; background: var(--surface-color); border: none; font-size: 1.2rem;">8</button>
          <button class="calc-btn" data-val="9" style="padding: 1.25rem; font-weight: 800; background: var(--surface-color); border: none; font-size: 1.2rem;">9</button>
          <button class="calc-btn op" data-val="-" style="padding: 1.25rem; font-weight: 800; background: var(--surface-color); border: none; font-size: 1.2rem; color: var(--primary);">-</button>
          
          <button class="calc-btn" data-val="4" style="padding: 1.25rem; font-weight: 800; background: var(--surface-color); border: none; font-size: 1.2rem;">4</button>
          <button class="calc-btn" data-val="5" style="padding: 1.25rem; font-weight: 800; background: var(--surface-color); border: none; font-size: 1.2rem;">5</button>
          <button class="calc-btn" data-val="6" style="padding: 1.25rem; font-weight: 800; background: var(--surface-color); border: none; font-size: 1.2rem;">6</button>
          <button class="calc-btn op" data-val="+" style="padding: 1.25rem; font-weight: 800; background: var(--surface-color); border: none; font-size: 1.2rem; color: var(--primary);">+</button>
          
          <button class="calc-btn" data-val="1" style="padding: 1.25rem; font-weight: 800; background: var(--surface-color); border: none; font-size: 1.2rem;">1</button>
          <button class="calc-btn" data-val="2" style="padding: 1.25rem; font-weight: 800; background: var(--surface-color); border: none; font-size: 1.2rem;">2</button>
          <button class="calc-btn" data-val="3" style="padding: 1.25rem; font-weight: 800; background: var(--surface-color); border: none; font-size: 1.2rem;">3</button>
          <button class="calc-btn eq" data-val="=" style="grid-row: span 2; background: var(--accent-primary); color: white; border: none; font-weight: 900; font-size: 1.5rem;">=</button>
          
          <button class="calc-btn" style="grid-column: span 2; padding: 1.25rem; font-weight: 800; background: var(--surface-color); border: none; font-size: 1.2rem;" data-val="0">0</button>
          <button class="calc-btn" data-val="." style="padding: 1.25rem; font-weight: 800; background: var(--surface-color); border: none; font-size: 1.2rem;">.</button>
        </div>
      </div>
    `

    // Start Services
    if (!this.isReviewMode && this.mode !== 'saved') {
      TimerService.start(this.remainingTime, (time) => {
        const timerDiv = document.getElementById('timer')
        if (timerDiv) {
          timerDiv.textContent = TimerService.formatTime(time)
          if (time <= 300) timerDiv.style.color = 'var(--error)'
          // Save state every 30 seconds to persist timer
          if (time % 30 === 0) this.saveState()
        }
      }, () => this.finish(onFinish, true))


    } else if (this.isReviewMode) {
      document.getElementById('timer').textContent = "REVIEW"
    }

    if (!this.isReviewMode) {
      this.loadBookmarks().catch(err => console.error("Error loading bookmarks:", err))
    }

    this.updateUI()
    this.attachListeners(onFinish, onBack)
    if (window.lucide) window.lucide.createIcons();
  }

  attachListeners(onFinish, onBack) {
    const backBtn = document.getElementById('exam-back-btn')
    if (backBtn) {
      backBtn.onclick = (e) => {
        e.preventDefault()
        if (!this.isReviewMode) {
          if (!confirm("Are you sure you want to exit? Any unsaved progress for this session will be lost.")) return;
        }
        
        // Stop timer and clean up
        TimerService.stop()
        window.removeEventListener('keydown', this._handleKeyDown)
        document.getElementById('exam-container').style.display = 'none'
        
        if (onBack) {
          onBack()
        } else {
          // Fallback if callback missing
          import('../../main').then(m => {
            if (window.navigateTo) window.navigateTo('dashboard')
            else location.reload()
          }).catch(() => location.reload())
        }
      }
    }

    document.getElementById('next-btn').onclick = () => {
      if (this.session.next()) this.updateUI()
    }
    document.getElementById('prev-btn').onclick = () => {
      if (this.session.prev()) this.updateUI()
    }
    
    const finishBtn = document.getElementById('finish-btn')
    if (finishBtn) {
      finishBtn.onclick = () => {
        const modal = document.getElementById('finish-modal')
        modal.style.display = 'flex'
        
        document.getElementById('cancel-finish').onclick = () => modal.style.display = 'none'
        document.getElementById('confirm-finish').onclick = () => {
          modal.style.display = 'none'
          this.finish(onFinish, true)
        }
      }
    }

    const exitBtn = document.getElementById('exam-exit-review')
    if (exitBtn) {
      exitBtn.onclick = () => {
        document.getElementById('exam-container').style.display = 'none'
        if (onBack) onBack()
        else location.reload()
      }
    }

    const bookmarkBtn = document.getElementById('toggle-bookmark')
    if (bookmarkBtn) {
      bookmarkBtn.onclick = async () => {
        const q = this.session.getCurrentQuestion()
        if (!q || !this.profile) return
        
        bookmarkBtn.textContent = 'Saving...'
        bookmarkBtn.disabled = true
        
        try {
          const { bookmarked } = await DataService.toggleBookmark(this.profile.id, q.id)
          if (bookmarked) {
            if (!this.bookmarks.includes(q.id)) this.bookmarks.push(q.id)
          } else {
            this.bookmarks = this.bookmarks.filter(id => id !== q.id)
          }
          this.updateBookmarkUI()
        } catch (err) {
          console.error("Bookmark toggle failed:", err)
        } finally {
          bookmarkBtn.disabled = false
          this.updateBookmarkUI()
        }
      }
    }

    const reportBtn = document.getElementById('report-btn')
    const explainContainer = document.getElementById('explanation-container')
    if (reportBtn) reportBtn.onclick = () => this.showReportModal()

    const toggleCalc = document.getElementById('toggle-calc')
    if (toggleCalc) {
      toggleCalc.onclick = () => {
        const calc = document.getElementById('exam-calculator')
        calc.style.display = calc.style.display === 'none' ? 'block' : 'none'
      }
    }

    const closeCalc = document.getElementById('close-calc')
    if (closeCalc) {
      closeCalc.onclick = () => {
        document.getElementById('exam-calculator').style.display = 'none'
      }
    }

    const mapToggle = document.getElementById('mobile-map-toggle')
    const sidebar = document.getElementById('exam-sidebar')
    const overlay = document.getElementById('exam-drawer-overlay')
    if (mapToggle && sidebar && overlay) {
      mapToggle.onclick = () => {
        sidebar.classList.add('drawer-open')
        overlay.classList.add('drawer-open')
      }
      overlay.onclick = () => {
        sidebar.classList.remove('drawer-open')
        overlay.classList.remove('drawer-open')
      }
    }

    document.querySelectorAll('.calc-btn').forEach(btn => {
      btn.onclick = () => this.handleCalculator(btn.dataset.val)
    })
  }

  handleCalculator(val) {
    const display = document.getElementById('calc-display')
    if (!display) return

    if (!this._calcState) {
      this._calcState = { current: '0', operator: null, previous: null, reset: false }
    }

    if (val === 'C') {
      this._calcState = { current: '0', operator: null, previous: null, reset: false }
    } else if (val === 'DEL') {
      this._calcState.current = this._calcState.current.length > 1 ? this._calcState.current.slice(0, -1) : '0'
    } else if (val === '=') {
      if (this._calcState.operator && this._calcState.previous !== null) {
        const res = this._solve(this._calcState.previous, this._calcState.current, this._calcState.operator)
        this._calcState.current = String(res)
        this._calcState.operator = null
        this._calcState.previous = null
        this._calcState.reset = true
      }
    } else if (['+', '-', '*', '/'].includes(val)) {
      if (this._calcState.operator && this._calcState.previous !== null) {
        this._calcState.previous = this._solve(this._calcState.previous, this._calcState.current, this._calcState.operator)
      } else {
        this._calcState.previous = this._calcState.current
      }
      this._calcState.operator = val
      this._calcState.reset = true
    } else {
      if (this._calcState.current === '0' || this._calcState.reset) {
        this._calcState.current = val
        this._calcState.reset = false
      } else {
        if (val === '.' && this._calcState.current.includes('.')) return
        this._calcState.current += val
      }
    }

    display.textContent = this._calcState.current
  }

  _solve(a, b, op) {
    const n1 = parseFloat(a)
    const n2 = parseFloat(b)
    if (op === '+') return n1 + n2
    if (op === '-') return n1 - n2
    if (op === '*') return n1 * n2
    if (op === '/') return n2 !== 0 ? n1 / n2 : 'Error'
    return n2
  }

  updateUI() {
    const q = this.session.getCurrentQuestion()
    if (!q) return

    // Meta Info
    document.getElementById('display-subject').textContent = q.subject || this.subject || "CBT Practice"
    document.getElementById('display-exam-type').textContent = q.exam_type || this.examType || "Elite Assessment"
    const topicBadge = document.getElementById('display-topic')
    if (topicBadge) {
        topicBadge.textContent = q.topic || "General"
        topicBadge.style.display = q.topic ? 'inline-block' : 'none'
    }

    if (this.examType === 'JAMB' && q.subject && q.subject !== this.activeJambSubject) {
        this.activeJambSubject = q.subject;
        this.renderJambTabs();
    }

    if (this.examType === 'JAMB') {
        const localQuestions = this.session.questions.filter(question => question.subject === this.activeJambSubject)
        const localIndex = localQuestions.findIndex(question => question.id === q.id)
        document.getElementById('q-meta').textContent = `${localIndex + 1} of ${localQuestions.length}`
    } else {
        document.getElementById('q-meta').textContent = `${this.session.currentIndex + 1} of ${this.session.questions.length}`
    }

    // Passage / Question Group Handling
    const pinnedArea = document.getElementById('pinned-content-area')
    const inlineArea = document.getElementById('q-group-content-inline')
    const pinnedContent = document.getElementById('q-group-content-pinned')

    if (q.question_groups && q.question_groups.content) {
        const isDesktop = window.innerWidth > 900
        
        if (isDesktop) {
            pinnedArea.style.display = 'block'
            inlineArea.style.display = 'none'
        } else {
            pinnedArea.style.display = 'none'
            inlineArea.style.display = 'block'
        }
        
        let headerText = 'Reference Passage'
        if (q.question_groups.type === 'instruction') headerText = 'Instruction'
        if (q.question_groups.type === 'data_set') headerText = 'Data Set / Case Study'
        if (q.question_groups.type === 'map' || q.question_groups.type === 'graph') headerText = 'Reference Materials'
        
        const formattedContent = q.question_groups.content.replace(/\\n/g, '<br>').replace(/\n/g, '<br>')
        const fullHTML = `
          <div class="passage-header">
            <i data-lucide="book-open" style="width: 14px; height: 14px; vertical-align: middle; margin-right: 0.4rem;"></i> ${headerText}
          </div>
          <div class="passage-body">
            ${sanitizeContent(formattedContent)}
          </div>`
        
        if (pinnedContent) pinnedContent.innerHTML = fullHTML
        if (inlineArea) inlineArea.innerHTML = fullHTML
        if (window.lucide) window.lucide.createIcons();
    } else {
        pinnedArea.style.display = 'none'
        inlineArea.style.display = 'none'
    }

    // Diagram Handling
    const diagramDiv = document.getElementById('q-diagram')
    if (q.diagram_type === 'svg' && q.diagram_svg) {
        diagramDiv.style.display = 'block'
        const cleanSvg = q.diagram_svg.includes('<svg') ? q.diagram_svg : `<svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg">${q.diagram_svg}</svg>`
        diagramDiv.innerHTML = `
          <div class="glass card" style="padding: 2.5rem; background: rgba(255,255,255,0.03); border: 1px solid var(--glass-border); border-radius: 12px; display: flex; justify-content: center;">
            ${cleanSvg}
          </div>`
    } else if (q.diagram_url && q.diagram_url.length > 5) {
        diagramDiv.style.display = 'block'
        diagramDiv.innerHTML = `
          <div class="diagram-container" style="text-align: center; position: relative;">
            <img src="${q.diagram_url}" 
                 alt="Visual Aid" 
                 class="blur-up glass" 
                 style="max-width: 100%; border-radius: 16px; border: 4px solid var(--glass-border); box-shadow: var(--shadow-lg);" 
                 onload="this.classList.add('loaded')"
                 onerror="this.parentElement.innerHTML = '<div class=\\'glass\\' style=\\'padding: 2rem; color: var(--error);\\'>⚠️ Visual aid could not be loaded.</div>'">
            <div style="margin-top: 1rem; font-size: 0.8rem; font-weight: 700; opacity: 0.8; font-family: 'Outfit';">
                <a href="${q.diagram_url}" target="_blank" style="color: var(--primary); text-decoration: none; display: flex; align-items: center; justify-content: center; gap: 0.4rem;">
                  <i data-lucide="maximize" style="width: 14px; height: 14px;"></i> VIEW FULL SCALE
                </a>
            </div>
          </div>`
        if (window.lucide) window.lucide.createIcons();
    } else {
        diagramDiv.style.display = 'none'
    }
    const qTextDiv = document.getElementById('q-text')
    qTextDiv.innerHTML = '' // Clear
    
    // Create styled number
    const numberSpan = document.createElement('span')
    numberSpan.style.color = 'var(--accent-primary)'
    numberSpan.style.fontWeight = '900'
    numberSpan.style.marginRight = '0.75rem'
    numberSpan.style.fontFamily = 'Outfit'
    
    let displayNumText = this.session.currentIndex + 1;
    if (this.examType === 'JAMB') {
        const localQs = this.session.questions.filter(question => question.subject === this.activeJambSubject)
        displayNumText = localQs.findIndex(question => question.id === q.id) + 1;
    }
    numberSpan.textContent = `${displayNumText}.`
    
    // Create text node for question
    const textSpan = document.createElement('span')
    textSpan.style.color = 'var(--text-primary)'
    textSpan.style.fontFamily = 'Outfit'
    textSpan.innerHTML = sanitizeContent(q.question_text || q.question)
    
    qTextDiv.appendChild(numberSpan)
    qTextDiv.appendChild(textSpan)


    // Question Rendering
    QuestionRenderer.render('options-container', q, this.session.userAnswers, this.session.currentIndex, this.isReviewMode)
    
    // Attach input listeners for the rendered content
    if (!this.isReviewMode) {
      const theoryInput = document.getElementById('theory-input')
      if (theoryInput) {
        theoryInput.oninput = (e) => {
          this.session.setAnswer(this.session.currentIndex, e.target.value)
          this.saveState()
          this.renderSidebar()
        }
        theoryInput.onpaste = (e) => {
          e.preventDefault()

          const warning = document.getElementById('paste-warning')
          if (warning) {
            warning.style.display = 'block'
            setTimeout(() => { if (warning) warning.style.display = 'none' }, 3000)
          }
        }
      } else {
        document.querySelectorAll('.option-btn').forEach(btn => {
          btn.onclick = () => {
            this.session.setAnswer(this.session.currentIndex, btn.dataset.id)
            this.saveState()
            this.updateUI()
            this.renderSidebar()
          }
        })
      }
    }

    // Explanation visibility
    const expDiv = document.getElementById('explanation-container')
    if (this.isReviewMode) {
      expDiv.style.display = 'block'
      
      const subState = SubscriptionManager.getUserSubscriptionState(this.profile, this._explanationsFreeAccess)
      const aiStatus = SubscriptionService.canUseAI(this.profile, this._explanationsFreeAccess)
      const isFreeAccess = this._explanationsFreeAccess

      if (subState.shouldShowActivateCTA && !isFreeAccess) {
        expDiv.innerHTML = `
          <div style="text-align: center; padding: 1rem;">
            <div style="font-size: 2.5rem; margin-bottom: 1rem;">🔒</div>
            <h4 style="margin-bottom: 0.75rem; color: var(--accent-secondary); font-family: 'Outfit'; font-weight: 800;">Activate Full Access</h4>
            <p style="font-size: 1rem; color: var(--text-secondary); margin-bottom: 2rem; font-weight: 500;">Activate for ₦1,500 to unlock elite explanations</p>
            <button class="btn-primary" style="padding: 0 2rem; height: 48px;" onclick="document.getElementById('upgrade-modal').style.display='flex'">
              Activate – ₦1,500
            </button>
          </div>
        `
      } else if (subState.shouldShowRenewCTA && !isFreeAccess && !aiStatus.canUse) {
        expDiv.innerHTML = `
          <div style="text-align: center; padding: 1rem;">
            <div style="font-size: 2.5rem; margin-bottom: 1rem;">🚀</div>
            <h4 style="margin-bottom: 0.75rem; color: var(--accent-secondary); font-family: 'Outfit'; font-weight: 800;">Renew Premium Access</h4>
            <p style="font-size: 1rem; color: var(--text-secondary); margin-bottom: 2rem; font-weight: 500;">Renew Premium to continue enjoying AI corrections</p>
            <button class="btn-primary" style="background: var(--accent-secondary); padding: 0 2rem; height: 48px;" onclick="document.getElementById('upgrade-modal').style.display='flex'">
              Renew – ₦1,000/month
            </button>
          </div>
        `
      } else {
        // If allowed, we might need to deduct credit if it's the first view of this question's explanation in this session
        const qId = q.id
        if (!this._deductedQuestions) this._deductedQuestions = new Set()
        
        const isPremium = subState.tier === 'premium'
        if (!isPremium && !isFreeAccess && aiStatus.canUse && !this._deductedQuestions.has(qId)) {
          SubscriptionService.useAICredit(this.profile).then(success => {
            if (success) this._deductedQuestions.add(qId)
          })
        } else if (isPremium && aiStatus.canUse && !this._deductedQuestions.has(qId)) {
          SubscriptionService.useAICredit(this.profile).then(() => this._deductedQuestions.add(qId))
        }

        if (q.question_type === 'theory') {
          const graded = q.graded || {}
          expDiv.innerHTML = `
            <div style="font-weight: 900; color: var(--accent-primary); margin-bottom: 1.5rem; display: flex; justify-content: space-between; font-family: 'Outfit'; font-size: 0.9rem; letter-spacing: 0.1em; text-transform: uppercase;">
              <span>Grading Details</span>
              ${isPremium ? '<span style="color: var(--success); opacity: 0.8;">✨ AI GRADED</span>' : ''}
            </div>
            <div style="margin-bottom: 2rem; padding: 1.5rem; background: rgba(0,0,0,0.1); border-radius: 12px;">
                <strong style="color: var(--success); display: block; margin-bottom: 0.5rem; font-family: 'Outfit';">MODEL ANSWER</strong>
                <p style="font-size: 1.05rem; line-height: 1.6;">${sanitizeContent(q.model_answer || 'No model answer provided.')}</p>
            </div>
            <div style="padding: 1.5rem; border: 1px solid var(--accent-secondary); border-radius: 12px;">
                <strong style="color: var(--accent-secondary); display: block; margin-bottom: 0.5rem; font-family: 'Outfit';">AI FEEDBACK (Score: ${graded.score || 0}/5)</strong>
                <p style="font-size: 1.05rem; line-height: 1.6;">${sanitizeContent(graded.feedback || 'Wait for grading...')}</p>
            </div>
          `
        } else {
          let ctaHtml = '';
          if (!isPremium && (isFreeAccess || aiStatus.canUse)) {
             if (subState.shouldShowActivateCTA) {
                ctaHtml = `
                  <div style="margin-top: 2rem; padding: 1.5rem; background: rgba(37, 99, 235, 0.05); border-radius: 12px; border: 1px dashed var(--accent-primary); text-align: left;">
                    <h5 style="font-size: 1.1rem; color: var(--text-primary); margin-bottom: 0.4rem; font-family: 'Outfit'; font-weight: 800;">🚀 GO PREMIUM FOR UNLIMITED</h5>
                    <p style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 1.25rem; font-weight: 500;">Activate for ₦1,500 to unlock unlimited explanations and AI insights.</p>
                    <button class="btn-secondary" style="height: 40px; font-size: 0.8rem; border-color: var(--accent-primary); color: var(--accent-primary); font-weight: 800;" onclick="document.getElementById('upgrade-modal').style.display='flex'">ACTIVATE NOW</button>
                  </div>
                `;
             } else if (subState.shouldShowRenewCTA) {
                ctaHtml = `
                  <div style="margin-top: 2rem; padding: 1.5rem; background: rgba(147, 51, 234, 0.05); border-radius: 12px; border: 1px dashed var(--accent-secondary); text-align: left;">
                    <h5 style="font-size: 1.1rem; color: var(--text-primary); margin-bottom: 0.4rem; font-family: 'Outfit'; font-weight: 800;">⚡ RENEW ELITE ACCESS</h5>
                    <p style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 1.25rem; font-weight: 500;">Renew Premium to maintain your unlimited AI study track.</p>
                    <button class="btn-secondary" style="height: 40px; font-size: 0.8rem; border-color: var(--accent-secondary); color: var(--accent-secondary); font-weight: 800;" onclick="document.getElementById('upgrade-modal').style.display='flex'">RENEW PREMIUM</button>
                  </div>
                `;
             }
          }

          expDiv.innerHTML = `
            <div style="font-weight: 900; color: var(--accent-primary); margin-bottom: 1rem; display: flex; justify-content: space-between; font-family: 'Outfit'; font-size: 0.85rem; letter-spacing: 0.1em; text-transform: uppercase;">
              <span>EXPLANATION</span>
              ${aiStatus.usage ? `<span style="color: var(--accent-secondary); opacity: 0.8;">${aiStatus.usage}/30 DAILY AI USED</span>` : ''}
            </div>
            <div style="color: var(--text-secondary); font-size: 1.1rem; line-height: 1.7; font-family: 'Outfit'; font-weight: 500;">${sanitizeContent(q.explanation || 'No explanation available for this question.')}</div>
            ${ctaHtml}
          `
        }
      }
      if (window.lucide) window.lucide.createIcons();
    } else {
      expDiv.style.display = 'none'
    }

    this.renderJambTabs()
    this.renderSidebar()
    this.updateBookmarkUI()

    // Phase 2: Render LaTeX Math (KaTeX)
    try {
        if (window.renderMathInElement) {
            const mathContainer = document.querySelector('.exam-main') || document.getElementById('exam-container');
            if (mathContainer) {
                window.renderMathInElement(mathContainer, {
                    delimiters: [
                        {left: "$$", right: "$$", display: true},
                        {left: "$", right: "$", display: false},
                        {left: "\\(", right: "\\)", display: false},
                        {left: "\\[", right: "\\]", display: true}
                    ],
                    throwOnError: false
                });
            }
        }
    } catch (e) {
        console.warn("KaTeX rendering failed:", e);
    }
  }

  renderJambTabs() {
    const container = document.getElementById('jamb-tabs-container')
    if (!container || this.examType !== 'JAMB') return
    container.style.display = 'flex'
    container.innerHTML = this.jambSubjects.map(sub => `
      <button class="jamb-tab-btn" data-subject="${sub}" style="flex-shrink: 0; white-space: nowrap; padding: 0.75rem 1.75rem; border-radius: 30px; font-size: 0.9rem; font-weight: 800; border: 2px solid ${sub === this.activeJambSubject ? 'var(--accent-primary)' : 'var(--glass-border)'}; background: ${sub === this.activeJambSubject ? 'var(--accent-primary)' : 'rgba(255,255,255,0.03)'}; color: ${sub === this.activeJambSubject ? 'white' : 'var(--text-secondary)'}; cursor: pointer; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); font-family: 'Outfit';">
        ${sub}
      </button>
    `).join('')

    container.querySelectorAll('.jamb-tab-btn').forEach(btn => {
      btn.onclick = () => {
        const targetSub = btn.dataset.subject
        if (targetSub !== this.activeJambSubject) {
           this.activeJambSubject = targetSub
           this.renderJambTabs()
           const firstIndex = this.session.questions.findIndex(question => question.subject === targetSub)
           if (firstIndex !== -1) {
              this.session.currentIndex = firstIndex
              this.updateUI()
           }
        }
      }
    })
  }

  renderSidebar() {
    const grid = document.getElementById('question-grid')
    if (!grid) return
    
    let html = ''
    this.session.questions.forEach((question, i) => {
      if (this.examType === 'JAMB' && question.subject !== this.activeJambSubject) return;
      
      const isCurrent = i === this.session.currentIndex
      const isAnswered = this.session.userAnswers[i] && this.session.userAnswers[i] !== ""
      const isBookmarked = this.bookmarks.includes(question.id)
      
      const style = {
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid var(--glass-border)',
        color: 'var(--text-secondary)',
        transform: 'none'
      }

      if (isAnswered) {
        style.background = 'var(--primary)';
        style.color = 'white';
        style.border = 'none';
      }

      if (isCurrent) {
        style.border = '2px solid var(--accent-primary)';
        style.transform = 'scale(1.1)';
        style.zIndex = '2';
        if (!isAnswered) style.color = 'var(--accent-primary)';
      }
      
      if (this.isReviewMode) {
        if (isAnswered) {
          const selectedId = this.session.userAnswers[i]
          const isCorrect = question.answers?.find(a => a.is_correct)?.id === selectedId
          style.background = isCorrect ? 'var(--success)' : 'var(--error)';
          style.color = 'white';
        } else {
          style.background = 'rgba(239, 68, 68, 0.1)';
          style.color = 'var(--error)';
          style.border = '1px dashed var(--error)';
        }
      }
      
      const inlineStyle = `background: ${style.background}; color: ${style.color}; border: ${style.border}; transform: ${style.transform}; position: relative; font-family: 'Outfit'; font-weight: 800; width: 100%; aspect-ratio: 1; border-radius: 8px; cursor: pointer; transition: all 0.2s;`
      
      let displayNum = i + 1;
      if (this.examType === 'JAMB') {
         const localQs = this.session.questions.filter(q => q.subject === this.activeJambSubject)
         displayNum = localQs.findIndex(q => q.id === question.id) + 1;
      }

      html += `<button class="q-grid-item" data-index="${i}" style="${inlineStyle}">${displayNum}${isBookmarked ? '<span style="position: absolute; top: -4px; right: -4px; font-size: 10px;">⭐</span>' : ''}</button>`
    })
    
    grid.innerHTML = html

    grid.onclick = (e) => {
      const btn = e.target.closest('.q-grid-item')
      if (btn) {
        const idx = btn.dataset.index
        this.session.currentIndex = parseInt(idx)
        this.saveState()
        this.updateUI()
        // Close mobile drawer on selection
        const sidebar = document.getElementById('exam-sidebar')
        const overlay = document.getElementById('exam-drawer-overlay')
        if (sidebar) sidebar.classList.remove('drawer-open')
        if (overlay) overlay.classList.remove('drawer-open')
      }
    }

    const progress = this.session.getProgress()
    const bar = document.getElementById('progress-bar')
    if (bar) bar.style.width = `${progress.percentage}%`
    document.getElementById('progress-text').textContent = `${progress.percentage}%`
  }

  async loadBookmarks() {
    if (!this.user) return
    try {
      const { data } = await DataService.getBookmarks(this.user.id)
      if (data && Array.isArray(data)) {
        this.bookmarks = data.map(q => q.id).filter(Boolean)
        this.updateBookmarkUI()
      }
    } catch (err) {
      console.error("Bookmark load error:", err)
    }
  }

  updateBookmarkUI() {
    const btn = document.getElementById('toggle-bookmark')
    if (!btn) return
    const q = this.session.getCurrentQuestion()
    const isBookmarked = this.bookmarks.includes(q.id)
    btn.innerHTML = isBookmarked ? '⭐ Saved' : '💾 Save Question'
    btn.style.color = isBookmarked ? 'var(--accent-secondary)' : 'var(--text-primary)'
  }

  showReportModal() {
    const modal = document.getElementById('report-modal')
    modal.style.display = 'flex'
    
    const closeBtn = document.getElementById('close-report')
    closeBtn.onclick = () => modal.style.display = 'none'

    const closeX = document.getElementById('close-report-x')
    if (closeX) closeX.onclick = () => modal.style.display = 'none'

    modal.querySelectorAll('.reason-btn').forEach(btn => {
      btn.onclick = async () => {
        const reason = btn.textContent
        const details = prompt("Any additional details? (Optional)")
        if (this.profile && this.profile.id) {
          try {
            await DataService.reportQuestion(this.profile.id, this.session.getCurrentQuestion().id, reason, details)
            alert("Report submitted. Thank you!")
          } catch (err) {
            console.error("Report failed:", err)
          }
        }
        modal.style.display = 'none'
      }
    })
  }

  finish(callback, force = false) {
    if (force) {
      TimerService.stop()
      window.removeEventListener('keydown', this._handleKeyDown)

      // Capture session data BEFORE clearing session
      const userAnswers = this.session ? { ...this.session.userAnswers } : {}
      const timeTaken = this.session ? this.session.getTimeTaken() : 0
      const actualQuestions = this.session ? [...this.session.questions] : []
      this.session = null
      document.getElementById('exam-container').style.display = 'none'
      if (callback) callback(userAnswers, timeTaken, actualQuestions)
    }
  }

  async finishExam(onComplete) {
    window.removeEventListener('keydown', this._handleKeyDown)
    const stats = this.session.getSummary()
    // Additional logic for finishing the exam, e.g., submitting results
    if (onComplete) onComplete(stats)
  }
}

// Adapter object so main.js can call ExamComponent.render(...) statically
export const ExamComponent = {
  _instance: null,

  render(questions, profile, onFinish, isReview = false, pastAnswers = {}, mode = 'practice', subject = '', examType = '', onBack = null, resumeState = null, intendedSubjects = []) {
    this._instance = new Exam(questions, profile, subject, examType, mode, isReview, pastAnswers, intendedSubjects)
    this._instance.render((userAnswers, timeTaken, actualQuestions) => {
        if (onFinish) onFinish(userAnswers, timeTaken, actualQuestions)
    }, onBack, resumeState)
  },

  hide() {
    const container = document.getElementById('exam-container')
    if (container) container.style.display = 'none'
  }
}
