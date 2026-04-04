import { DataService } from '../services/data'
import { sanitizeContent } from '../utils/sanitize'
import { TimerService } from '../services/TimerService'
import { ExamSessionManager } from '../services/ExamSessionManager'
import { QuestionRenderer } from '../services/QuestionRenderer'
import { SubscriptionService } from '../services/subscriptionService'
import { SubscriptionManager } from '../utils/subscriptionManager'
export class Exam {
  constructor(questions, user, subject = null, examType = null, mode = 'practice', isReview = false, pastAnswers = {}) {
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
        const subjects = questions
          .map(q => q.subject || q.subjects?.subject_name || 'General')
          .filter(Boolean)
        this.jambSubjects = [...new Set(subjects)]
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
      initialTime = isTheory ? (6 * 60) : (20 * 60) 
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
      <div class="exam-layout">
        <!-- Phase 5: Persistent Top Bar -->
        <div class="exam-top-bar glass">
          <div class="top-bar-left">
            <button id="exam-back-btn" class="btn-secondary" style="padding: 0.4rem 0.6rem; border-radius: 8px; margin-right: 0.5rem;" title="Go Back">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            </button>
            <button id="mobile-map-toggle" class="btn-secondary mobile-only" style="padding: 0.4rem 0.6rem; border-radius: 8px; margin-right: 0.5rem; font-size: 0.8rem;" title="Question Map">🗺️ Map</button>
            <span id="display-exam-type" class="badge" style="background: var(--primary); color: #ffffff; padding: 0.25rem 0.75rem; border-radius: 6px; font-weight: 700; font-size: 0.8rem;">...</span>
            <span id="display-subject" class="subject-title">...</span>
          </div>
          
          <div class="top-bar-center">
            <div id="q-meta" class="q-counter">1 of 0</div>
            <span id="display-topic" class="badge" style="background: var(--accent-secondary); color: #ffffff; padding: 0.25rem 0.75rem; border-radius: 6px; font-weight: 600; font-size: 0.7rem; margin-left: 0.5rem; display: none;">...</span>
          </div>

          <div class="top-bar-right">
            <button id="toggle-calc" class="btn-secondary" style="padding: 0.5rem 0.75rem; font-size: 0.75rem; border-radius: 8px;">
              🧮 Calc
            </button>
            <div id="timer" class="timer-display">00:00</div>
          </div>
        </div>

        <div class="exam-content-wrapper" id="exam-wrapper" style="display: flex; gap: 1rem; flex: 1; overflow: hidden; height: calc(100vh - 80px);">
          <!-- Left side: Pinned Content (Passage) -->
          <div id="pinned-content-area" class="glass" style="display: none; flex: 1; overflow-y: auto; padding: 1.5rem; border-right: 1px solid var(--glass-border); min-width: 300px; scrollbar-width: thin;">
             <div id="q-group-content-pinned" class="passage-container" style="font-size: 1.1rem; line-height: 1.8; color: var(--text-primary);"></div>
          </div>

          <!-- Main Content -->
          <div class="exam-main glass" style="flex: 1.2; overflow-y: auto; padding: 1.5rem 2rem; scrollbar-width: thin; display: flex; flex-direction: column;">
            <!-- Subject Tabs placed at the top of content area -->
            <div id="jamb-tabs-container" style="display: none; justify-content: flex-start; gap: 0.75rem; margin-bottom: 1.5rem; overflow-x: auto; padding-bottom: 0.5rem; scrollbar-width: thin; -webkit-overflow-scrolling: touch;"></div>

            <div id="question-area" style="flex: 1;">
              <!-- Inline passage for mobile or fallback -->
              <div id="q-group-content-inline" class="passage-container glass" style="display: none; margin-bottom: 2rem; padding: 1.5rem; font-size: 1.05rem; line-height: 1.8; border-left: 4px solid var(--accent-primary); background: var(--bg-secondary);"></div>
              <div id="q-diagram" style="display: none;"></div>
              <div id="q-text" style="font-size: 1.15rem; line-height: 1.6; margin-bottom: 2rem; font-weight: 500;">...</div>

              <div id="options-container" style="display: flex; flex-direction: column; gap: 1rem;"></div>
              <div id="explanation-container" class="glass" style="margin-top: 2rem; padding: 1.5rem; display: none; border-left: 4px solid var(--primary);"></div>
            </div>

            <div class="exam-footer" style="margin-top: auto; padding-top: 1.5rem; border-top: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
              <div style="display: flex; gap: 0.75rem;">
                <button id="prev-btn" class="btn-secondary">Previous</button>
                <button id="next-btn" class="btn-primary">Next Question</button>
              </div>
              
              <div style="display: flex; gap: 0.75rem; align-items: center;">
                <button id="report-btn" class="btn-secondary" style="padding: 0.5rem; color: var(--error); font-size: 0.8rem; background: transparent; border: none;">Report Issue</button>
                <button id="toggle-bookmark" class="btn-secondary" style="padding: 0.5rem 1rem;">💾 Save Question</button>
                ${this.isReviewMode ? '<button id="exam-exit-review" class="btn-primary">Exit Review</button>' : '<button id="finish-btn" class="finish-btn">Finish Exam</button>'}
              </div>
            </div>
          </div>

          <!-- Sidebar Navigation for Desktop and Drawer for Mobile -->
          <div class="drawer-overlay" id="exam-drawer-overlay"></div>
          <div class="exam-sidebar glass" id="exam-sidebar">
            <div style="font-weight: 700; margin-bottom: 1rem; font-size: 0.9rem; letter-spacing: 0.05em; text-transform: uppercase;">Question Map</div>
            <div id="question-grid" style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 0.5rem;"></div>
            
            <div style="margin-top: auto; padding-top: 1.5rem;">
              <div class="progress-container" style="height: 6px; background: rgba(0,0,0,0.1); border-radius: 3px; overflow: hidden; margin-bottom: 0.5rem;">
                 <div id="progress-bar" style="height: 100%; background: var(--accent-primary); width: 0%; transition: width 0.3s;"></div>
              </div>
              <div style="display: flex; justify-content: space-between; font-size: 0.7rem;">
                 <span>PROGRESS</span>
                 <span id="progress-text">0%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div id="report-modal" class="modal-overlay" style="display: none; align-items: flex-start; padding-top: 3rem;">
        <div class="modal-content glass" style="max-width: 450px;">
          <h3 style="margin-bottom: 0.5rem; display: flex; justify-content: space-between; align-items: center;">
            Report Question <span id="close-report-x" style="cursor: pointer; color: var(--error);">✖</span>
          </h3>
          <p style="font-size: 0.9rem; color: var(--text-primary); opacity: 0.9; margin-bottom: 1.5rem;">What's wrong with this question?</p>
          <div style="display: flex; flex-direction: column; gap: 0.5rem;">
            <button class="reason-btn glass" style="text-align: left; padding: 1rem; border-radius: 8px; color: var(--text-primary);">Typo / Grammar error</button>
            <button class="reason-btn glass" style="text-align: left; padding: 1rem; border-radius: 8px; color: var(--text-primary);">Incorrect Answer / Missing Option</button>
            <button class="reason-btn glass" style="text-align: left; padding: 1rem; border-radius: 8px; color: var(--text-primary);">Image missing / broken</button>
            <button class="reason-btn glass" style="text-align: left; padding: 1rem; border-radius: 8px; color: var(--text-primary);">Other</button>
          </div>
          <button id="close-report" class="btn-secondary" style="margin-top: 1.5rem; width: 100%; border-radius: 8px;">Cancel</button>
        </div>
      </div>
      
      <div id="finish-modal" class="modal-overlay" style="display: none; align-items: flex-start; padding-top: 3rem;">
        <div class="modal-content glass" style="max-width: 450px; text-align: center;">
          <h2 style="margin-bottom: 1rem; color: var(--text-primary);">End Session?</h2>
          <p style="font-size: 1rem; color: var(--text-primary); opacity: 0.9; margin-bottom: 2.5rem;">Are you sure you want to finish and submit your answers? You cannot undo this action.</p>
          <div style="display: flex; gap: 1rem;">
            <button id="cancel-finish" class="btn-secondary" style="flex: 1; border-radius: 8px; font-weight: bold;">Keep Working</button>
            <button id="confirm-finish" class="finish-btn" style="flex: 1; border-radius: 8px; font-weight: bold; font-size: 1.1rem;">Submit Now</button>
          </div>
        </div>
      </div>

      <!-- Floating Calculator -->
      <div id="exam-calculator" class="calculator-modal" style="display: none;">
        <div class="calc-header">
          <span>Calculator</span>
          <button id="close-calc">×</button>
        </div>
        <div class="calc-display" id="calc-display">0</div>
        <div class="calc-buttons">
          <button class="calc-btn clear" data-val="C">C</button>
          <button class="calc-btn op" data-val="/">/</button>
          <button class="calc-btn op" data-val="*">×</button>
          <button class="calc-btn clear" data-val="DEL">⌫</button>
          
          <button class="calc-btn" data-val="7">7</button>
          <button class="calc-btn" data-val="8">8</button>
          <button class="calc-btn" data-val="9">9</button>
          <button class="calc-btn op" data-val="-">-</button>
          
          <button class="calc-btn" data-val="4">4</button>
          <button class="calc-btn" data-val="5">5</button>
          <button class="calc-btn" data-val="6">6</button>
          <button class="calc-btn op" data-val="+">+</button>
          
          <button class="calc-btn" data-val="1">1</button>
          <button class="calc-btn" data-val="2">2</button>
          <button class="calc-btn" data-val="3">3</button>
          <button class="calc-btn eq" data-val="=">=</button>
          
          <button class="calc-btn" style="grid-column: span 2;" data-val="0">0</button>
          <button class="calc-btn" data-val=".">.</button>
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
  }

  attachListeners(onFinish, onBack) {
    const backBtn = document.getElementById('exam-back-btn')
    if (backBtn) {
      backBtn.onclick = () => {
        if (!this.isReviewMode && !confirm("Are you sure you want to exit? Any unsaved progress will be lost.")) return;
        document.getElementById('exam-container').style.display = 'none'
        if (onBack) onBack()
        else location.reload()
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
        const fullHTML = `<div style="font-weight: 700; margin-bottom: 0.75rem; color: var(--accent-primary); letter-spacing: 0.05em; text-transform: uppercase; font-size: 0.85rem;">${headerText}</div><div>${sanitizeContent(formattedContent)}</div>`
        
        if (pinnedContent) pinnedContent.innerHTML = fullHTML
        if (inlineArea) inlineArea.innerHTML = fullHTML
    } else {
        pinnedArea.style.display = 'none'
        inlineArea.style.display = 'none'
        if (pinnedContent) pinnedContent.innerHTML = ''
        if (inlineArea) inlineArea.innerHTML = ''
    }

    // Diagram Handling
    const diagramDiv = document.getElementById('q-diagram')
    if (q.diagram_type === 'svg' && q.diagram_svg) {
        diagramDiv.style.display = 'block'
        const cleanSvg = q.diagram_svg.includes('<svg') ? q.diagram_svg : `<svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg">${q.diagram_svg}</svg>`
        diagramDiv.innerHTML = `
          <div class="diagram-container svg-diagram" style="background: #fff; padding: 1.5rem; border-radius: 12px; margin-bottom: 2rem; display: flex; justify-content: center; box-shadow: inset 0 0 10px rgba(0,0,0,0.05); border: 1px solid var(--border-color);">
            ${cleanSvg}
          </div>`
    } else if (q.diagram_url && q.diagram_url.length > 5) {
        diagramDiv.style.display = 'block'
        const isGraph = q.diagram_type === 'graph'
        diagramDiv.innerHTML = `
          <div class="diagram-container ${isGraph ? 'graph-diagram' : ''}" style="margin-bottom: 2rem; text-align: center;">
            <img src="${q.diagram_url}" 
                 alt="Question Diagram" 
                 class="blur-up" 
                 style="max-width: 100%; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.15); border: 2px solid #fff;" 
                 onload="this.classList.add('loaded')"
                 onerror="this.parentElement.innerHTML = '<div class=\\'glass\\' style=\\'padding: 2rem; color: var(--error);\\'>⚠️ Visual aid could not be loaded. Please check your connection or report this question.</div>'">
            <div style="margin-top: 0.5rem; font-size: 0.75rem; opacity: 0.7;">
                <a href="${q.diagram_url}" target="_blank" style="color: var(--primary); text-decoration: none;">🔍 View Full Diagram</a>
            </div>
          </div>`
    } else {
        diagramDiv.style.display = 'none'
    }
    const qTextDiv = document.getElementById('q-text')
    qTextDiv.innerHTML = '' // Clear
    
    // Create styled number
    const numberSpan = document.createElement('span')
    numberSpan.style.color = 'var(--accent-primary)'
    numberSpan.style.fontWeight = '800'
    numberSpan.style.marginRight = '0.5rem'
    
    let displayNumText = this.session.currentIndex + 1;
    if (this.examType === 'JAMB') {
        const localQs = this.session.questions.filter(question => question.subject === this.activeJambSubject)
        displayNumText = localQs.findIndex(question => question.id === q.id) + 1;
    }
    numberSpan.textContent = `${displayNumText}.`
    
    // Create text node for question
    const textSpan = document.createElement('span')
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
          <div class="premium-lock-container">
            <div class="lock-icon">🔒</div>
            <h4 style="margin-bottom: 0.5rem; color: var(--accent-secondary);">Activate Full Access</h4>
            <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 1rem;">Activate for ₦1,500 to unlock explanations</p>
            <button class="primary" style="padding: 0.5rem 1.5rem; font-size: 0.85rem;" onclick="location.reload()">
              Activate Lifetime Access – ₦1,500
            </button>
          </div>
        `
      } else if (subState.shouldShowRenewCTA && !isFreeAccess && !aiStatus.canUse) {
        expDiv.innerHTML = `
          <div class="premium-lock-container">
            <div class="lock-icon">🚀</div>
            <h4 style="margin-bottom: 0.5rem; color: var(--accent-secondary);">Renew Premium Access</h4>
            <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 1rem;">Renew Premium (₦1,000) to unlock AI explanations</p>
            <button class="primary" style="padding: 0.5rem 1.5rem; font-size: 0.85rem;" onclick="location.reload()">
              Renew Premium – ₦1,000/month
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
            if (success) {
               this._deductedQuestions.add(qId)
            }
          })
        } else if (isPremium && aiStatus.canUse && !this._deductedQuestions.has(qId)) {
          SubscriptionService.useAICredit(this.profile).then(() => this._deductedQuestions.add(qId))
        }

        if (q.question_type === 'theory') {
          const graded = q.graded || {}
          expDiv.innerHTML = `
            <div style="font-weight: 700; color: var(--accent-primary); margin-bottom: 0.5rem; display: flex; justify-content: space-between;">
              <span>Grading Details:</span>
              ${isPremium ? '<span style="font-size: 0.75rem; color: var(--success); opacity: 0.8;">\u2728 AI THEORY ENABLED</span>' : ''}
            </div>
            <div style="margin-bottom: 1rem;">
                <strong style="color: var(--success);">Model Answer:</strong>
                <p style="margin-top: 0.25rem;">${sanitizeContent(q.model_answer || '')}</p>
            </div>
            <div>
                <strong style="color: var(--accent-secondary);">AI Feedback (Score: ${graded.score || 0}/5):</strong>
                <p style="margin-top: 0.25rem;">${sanitizeContent(graded.feedback || 'Wait for grading...')}</p>
            </div>
          `
        } else {
          let ctaHtml = '';
          if (!isPremium && (isFreeAccess || aiStatus.canUse)) {
             if (subState.shouldShowActivateCTA) {
                ctaHtml = `
                  <div style="margin-top: 1.5rem; padding: 1rem; background: rgba(59, 130, 246, 0.05); border-radius: 8px; border: 1px dashed var(--accent-primary); text-align: center;">
                    <p style="font-size: 0.85rem; color: var(--text-primary); margin-bottom: 0.5rem; font-weight: 600;">\uD83D\uDE80 Go Premium for Unlimited Access</p>
                    <p style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 0.75rem;">Activate for ₦1,500 to unlock unlimited explanations.</p>
                    <button class="btn-secondary" style="font-size: 0.75rem; padding: 0.4rem 1rem; border-color: var(--accent-primary); color: var(--accent-primary);" onclick="location.reload()">Activate Lifetime Access – ₦1,500</button>
                  </div>
                `;
             } else if (subState.shouldShowRenewCTA) {
                ctaHtml = `
                  <div style="margin-top: 1.5rem; padding: 1rem; background: rgba(var(--accent-secondary-rgb, 255, 152, 0), 0.1); border-radius: 8px; border: 1px dashed var(--accent-secondary); text-align: center;">
                    <p style="font-size: 0.85rem; color: var(--text-primary); margin-bottom: 0.5rem; font-weight: 600;">\uD83D\uDE80 Go Premium for Unlimited Access</p>
                    <p style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 0.75rem;">Renew Premium (₦1,000) to unlock AI explanations.</p>
                    <button class="btn-secondary" style="font-size: 0.75rem; padding: 0.4rem 1rem; border-color: var(--accent-secondary); color: var(--accent-secondary);" onclick="location.reload()">Renew Premium – ₦1,000/month</button>
                  </div>
                `;
             }
          }

          expDiv.innerHTML = `
            <div style="font-weight: 700; color: var(--accent-primary); margin-bottom: 0.5rem; display: flex; justify-content: space-between;">
              <span>Explanation:</span>
              ${aiStatus.credits ? `<span style="font-size: 0.75rem; color: var(--accent-secondary); opacity: 0.8;">${aiStatus.credits} Credits Left</span>` : ''}
              ${aiStatus.usage ? `<span style="font-size: 0.75rem; color: var(--accent-secondary); opacity: 0.8;">${aiStatus.usage}/30 Daily AI Used</span>` : ''}
            </div>
            <div style="color: var(--text-secondary);">${sanitizeContent(q.explanation || 'No explanation available for this question.')}</div>
            ${ctaHtml}
          `
        }
      }
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
        console.warn("KaTeX rendering failed but skipping to enable navigation:", e);
    }
  }

  renderJambTabs() {
    const container = document.getElementById('jamb-tabs-container')
    if (!container || this.examType !== 'JAMB') return
    container.style.display = 'flex'
    container.innerHTML = this.jambSubjects.map(sub => `
      <button class="jamb-tab-btn" data-subject="${sub}" style="flex-shrink: 0; white-space: nowrap; padding: 0.6rem 1.25rem; border-radius: 20px; font-size: 0.9rem; font-weight: 700; border: 1px solid var(--accent-primary); background: ${sub === this.activeJambSubject ? 'var(--accent-primary)' : 'transparent'}; color: ${sub === this.activeJambSubject ? 'white' : 'var(--accent-primary)'}; cursor: pointer; transition: all 0.2s; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
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
      
      const statusClasses = []
      if (isCurrent) statusClasses.push('current')
      
      if (this.isReviewMode) {
        if (isAnswered) {
          const selectedId = this.session.userAnswers[i]
          const isCorrect = question.answers?.find(a => a.is_correct)?.id === selectedId
          statusClasses.push(isCorrect ? 'correct' : 'incorrect')
        } else {
          statusClasses.push('unattempted')
        }
      } else {
        if (isAnswered) statusClasses.push('answered')
      }
      
      const statusClass = statusClasses.join(' ')
      
      let displayNum = i + 1;
      if (this.examType === 'JAMB') {
         const localQs = this.session.questions.filter(q => q.subject === this.activeJambSubject)
         displayNum = localQs.findIndex(q => q.id === question.id) + 1;
      }

      html += `<button class="q-grid-item ${statusClass}" data-index="${i}">${displayNum}${isBookmarked ? '⭐' : ''}</button>`
    })
    
    grid.innerHTML = html

    grid.onclick = (e) => {
      const idx = e.target.dataset.index
      if (idx !== undefined) {
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
    document.getElementById('progress-bar').style.width = `${progress.percentage}%`
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

  render(questions, profile, onFinish, isReview = false, pastAnswers = {}, mode = 'practice', subject = '', examType = '', onBack = null, resumeState = null) {
    this._instance = new Exam(questions, profile, subject, examType, mode, isReview, pastAnswers)
    return this._instance.render((userAnswers, timeTaken, actualQuestions) => {
        if (onFinish) onFinish(userAnswers, timeTaken, actualQuestions)
    }, onBack, resumeState)
  },

  hide() {
    document.getElementById('exam-container').style.display = 'none'
  }
}
