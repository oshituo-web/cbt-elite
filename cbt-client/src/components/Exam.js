import { DataService } from '../services/data'
import { TimerService } from '../services/TimerService'
import { ExamSessionManager } from '../services/ExamSessionManager'
import { QuestionRenderer } from '../services/QuestionRenderer'
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
      this.jambSubjects = [...new Set(questions.map(q => q.subject))].map(s => s || 'General')
      this.activeJambSubject = this.jambSubjects[0]
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
  }

  async render(onFinish, onBack) {
    const container = document.getElementById('exam-container')
    container.style.display = 'block'
    
    container.innerHTML = `
      <div class="exam-layout">
        <!-- Phase 5: Persistent Top Bar -->
        <div class="exam-top-bar glass">
          <div class="top-bar-left">
            <span id="display-exam-type" class="badge" style="background: var(--primary); color: #ffffff; padding: 0.25rem 0.75rem; border-radius: 6px; font-weight: 700;">...</span>
            <span id="display-subject" class="subject-title">...</span>
          </div>
          
          <div class="top-bar-center">
            <div id="q-meta" class="q-counter">1 of 0</div>
          </div>

          <div class="top-bar-right">
            <button id="toggle-calc" class="btn-secondary" style="padding: 0.5rem 1rem; font-size: 0.85rem; border-radius: 10px;">
              🧮 Calculator
            </button>
            <div id="timer" class="timer-display">00:00</div>
          </div>
        </div>

        <div class="exam-content-wrapper">
          <!-- Main Content -->
          <div class="exam-main glass">
            <!-- Subject Tabs placed at the top of content area -->
            <div id="jamb-tabs-container" style="display: none; justify-content: flex-start; gap: 0.75rem; margin-bottom: 1.5rem; overflow-x: auto; padding-bottom: 0.5rem; scrollbar-width: thin; -webkit-overflow-scrolling: touch;"></div>

            <div id="question-area">
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
                <button id="toggle-bookmark" class="btn-secondary" style="padding: 0.5rem 1rem;">🔖 Bookmark</button>
                ${this.isReviewMode ? '<button id="exam-exit-review" class="btn-primary">Exit Review</button>' : '<button id="finish-btn" class="finish-btn">Finish Exam</button>'}
              </div>
            </div>
          </div>


        <!-- Sidebar Navigation -->
        <div class="exam-sidebar glass">
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
      TimerService.start(this.initialTime, (time) => {
        const timerDiv = document.getElementById('timer')
        if (timerDiv) {
          timerDiv.textContent = TimerService.formatTime(time)
          if (time <= 300) timerDiv.style.color = 'var(--error)'
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
    document.getElementById('display-topic').textContent = q.topic || "General"

    if (this.examType === 'JAMB' && q.subject !== this.activeJambSubject) {
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

    // Diagram Handling
    const diagramDiv = document.getElementById('q-diagram')
    if (q.diagram_url) {
        diagramDiv.style.display = 'block'
        diagramDiv.innerHTML = `<div class="diagram-container"><img src="${q.diagram_url}" alt="Question Diagram" class="blur-up" onload="this.classList.add('loaded')"></div>`
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
    textSpan.textContent = q.question_text || q.question
    
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
      if (q.question_type === 'theory') {
        const graded = q.graded || {}
        expDiv.innerHTML = `
          <div style="font-weight: 700; color: var(--accent-primary); margin-bottom: 0.5rem;">Grading Details:</div>
          <div style="margin-bottom: 1rem;">
              <strong style="color: var(--success);">Model Answer:</strong>
              <p style="margin-top: 0.25rem;">${q.model_answer}</p>
          </div>
          <div>
              <strong style="color: var(--accent-secondary);">AI Feedback (Score: ${graded.score || 0}/5):</strong>
              <p style="margin-top: 0.25rem;">${graded.feedback || 'Wait for grading...'}</p>
          </div>
        `
      } else {
        expDiv.innerHTML = `
          <div style="font-weight: 700; color: var(--accent-primary); margin-bottom: 0.5rem;">Explanation:</div>
          <div style="color: var(--text-secondary);">${q.explanation || 'No explanation available for this question.'}</div>
        `
      }
    } else {
      expDiv.style.display = 'none'
    }

    this.renderJambTabs()
    this.renderSidebar()
    this.updateBookmarkUI()
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
        this.updateUI()
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
    btn.innerHTML = isBookmarked ? '⭐ Bookmarked' : '🔖 Bookmark'
    btn.style.color = isBookmarked ? 'var(--accent-secondary)' : 'white'
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

  render(questions, profile, onFinish, isReview = false, pastAnswers = {}, mode = 'practice', subject = '', examType = '', onBack = null) {
    this._instance = new Exam(questions, profile, subject, examType, mode, isReview, pastAnswers)
    return this._instance.render((userAnswers, timeTaken, actualQuestions) => {
        if (onFinish) onFinish(userAnswers, timeTaken, actualQuestions)
    }, onBack)
  },

  hide() {
    document.getElementById('exam-container').style.display = 'none'
  }
}
