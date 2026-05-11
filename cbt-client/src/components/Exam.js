import { DataService } from '../services/data'
import { supabase } from '../utils/supabase'
import { sanitizeContent } from '../utils/sanitize'
import { TimerService } from '../services/TimerService'
import { ExamSessionManager } from '../services/ExamSessionManager'
import { QuestionRenderer } from '../services/QuestionRenderer'
import { SubscriptionService } from '../services/subscriptionService'
import { SubscriptionManager } from '../utils/subscriptionManager'
import { AiService } from '../services/aiService'
import { CalculatorComponent } from './Calculator'
import { AITutorSidebar } from './AITutorSidebar'
import { ModalService } from '../services/ModalService'
import { SoundService } from '../services/SoundService'
import renderMathInElement from 'katex/dist/contrib/auto-render.mjs'

export class Exam {
  constructor(questions, user, subject = null, examType = null, mode = 'practice', isReview = false, pastAnswers = {}, intendedSubjects = [], clashId = null, questionSource = 'ai') {
    this.session = new ExamSessionManager(questions, pastAnswers, !isReview, examType === 'JAMB')
    this.clashId = clashId // Phase 2: Competition sync
    this.questionSource = questionSource; // ai | past
    
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

    if (questions.length === 50) {
      initialTime = 45 * 60
    } else if (this.mode === 'exam') {
      if (this.examType === 'JAMB') {
        initialTime = 120 * 60 // 2 hours
      } else {
        // Phase 17: WAEC / NECO Exam sessions
        initialTime = isTheory ? (12 * 60) : (30 * 60) 
      }
    } else if (this.mode === 'practice' || this.mode === 'mission' || this.mode === 'review' || this.mode === 'repair') {
      // Mission, Review, and Repair share the practice timer (20 mins)
      initialTime = 20 * 60
    }

    this.initialTime = initialTime
    this.remainingTime = initialTime

    this._handleBeforeUnload = (e) => {
      if (!this.isReviewMode) {
        e.preventDefault();
        e.returnValue = '';
      }
    }
    window.addEventListener('beforeunload', this._handleBeforeUnload);

    // Fetch granular config for feature unlocks
    this.systemConfig = {
      explanations_free_access: false,
      exams_free_access: false,
      ai_tutor_free_access: false
    }
    // 🔑 Initialise _explanationsFreeAccess to false; will be updated once config loads
    this._explanationsFreeAccess = false

    // Configuration fetch moved to async render() to prevent race conditions
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
          questionSource: this.questionSource,
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
    
    this.systemConfig = {
      explanations_free_access: false,
      exams_free_access: false,
      ai_tutor_free_access: false
    };

    try {
        const { data: configs } = await DataService.getGlobalConfigs(['explanations_free_access', 'exams_free_access', 'ai_tutor_free_access']);
        if (configs) {
            configs.forEach(c => {
                if (this.systemConfig.hasOwnProperty(c.key)) {
                    this.systemConfig[c.key] = c.value === true || c.value === 'true';
                }
            });
        }
        this._explanationsFreeAccess = this.systemConfig.explanations_free_access || this.systemConfig.ai_tutor_free_access;
    } catch (err) {
        console.warn("Failed to fetch global config:", err);
    }
    
    if (this.isReviewMode && this.profile?.id) {
        try {
            this.userAnalytics = await DataService.getUserAnalytics(this.profile.id);
        } catch (e) {
            console.warn("Failed to load user analytics for AI tutor:", e);
        }
    }

    if (resumeState) {
      this.session.userAnswers = resumeState.userAnswers || {}
      this.session.currentIndex = resumeState.currentIndex || 0
      this.activeJambSubject = resumeState.activeJambSubject || this.activeJambSubject
      this.questionSource = resumeState.questionSource || this.questionSource
      this.remainingTime = resumeState.remainingTime || this.initialTime
    } else if (!this.isReviewMode) {
      // Enforcement: Session Limits
      try {
        if (!SubscriptionService.canStartSession(this.profile, this.mode, this.systemConfig)) {
          const limitStr = (this.profile.tier === 'medium' ? '5 (Activated)' : '3 (Free)')
          ModalService.alert("Limit Reached", `\u26A0 You've used your daily limit of ${limitStr} ${this.mode} sessions. Upgrade to Premium for unlimited access.`, 'error');
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
          <div class="exam-header-primary" style="display: flex; flex-direction: column; gap: 0.2rem; padding: 0.35rem 0.5rem; align-items: stretch; height: auto;">
            <!-- Line 1: Source, Exam Type, Calc, Timer -->
            <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
              <div style="display: flex; align-items: center; gap: 0.4rem;">
                <button id="exam-back-btn" class="header-icon-btn" title="Go Back" style="padding: 0; width: 24px; height: 24px;">
                  <i data-lucide="chevron-left" style="width: 18px; height: 18px;"></i>
                </button>
                <span id="source-label" style="font-size: 0.62rem; font-weight: 900; letter-spacing: 0.04em; text-transform: uppercase; padding: 0.15rem 0.5rem; border-radius: 4px; flex-shrink: 0;">...</span>
                <span id="display-exam-type" class="badge-exam" style="margin: 0; font-size: 0.62rem !important; padding: 0.2rem 0.6rem; min-width: 110px; text-align: center; white-space: nowrap;">...</span>
              </div>
              <div style="display: flex; align-items: center; gap: 0.35rem;">
                <button id="toggle-calc" class="header-icon-btn" title="Open Calculator" style="padding: 0; width: 34px; height: 34px; background: rgba(255,255,255,0.06); border-radius: 8px; flex-shrink: 0; border: 1px solid var(--glass-border); display: flex; align-items: center; justify-content: center;">
                  <i data-lucide="calculator" stroke-width="2.5" style="width: 18px; height: 18px; color: var(--text-primary);"></i>
                </button>
                <div id="timer" class="timer-mini" style="color: #10B981; font-size: 0.85rem; padding: 0.25rem 0.6rem; border-radius: 8px; background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.1); font-family: 'Monaco', monospace; font-weight: 900; box-shadow: 0 2px 8px rgba(0,0,0,0.3); min-width: 60px; text-align: center; flex-shrink: 0;">00:00</div>
                <button id="toggle-tutor" class="header-icon-btn" title="AI Tutor" style="color: #f59e0b; display: ${this.isReviewMode ? 'flex' : 'none'}; padding: 0; width: auto; height: auto; margin-left: 0.1rem; background: none; border: none; flex-shrink: 0;">
                  <i data-lucide="bot" stroke-width="2.5" style="width: 28px; height: 28px;"></i>
                </button>
              </div>
            </div>

            <!-- Line 2: Subject, Count, Topic -->
            <div class="exam-header-secondary" style="display: flex; justify-content: space-between; align-items: center; width: 100%; padding-left: 28px; font-size: 0.65rem;">
              <div style="display: flex; align-items: center; gap: 0.4rem; color: var(--text-secondary); font-weight: 700;">
                <span id="display-subject" class="meta-subject">...</span>
                <span style="opacity: 0.5;">•</span>
                <div id="q-meta" class="q-counter-mini" style="font-size: 0.65rem; background: transparent; padding: 0; border: none; box-shadow: none;">1 of 0</div>
              </div>
              <span id="display-topic" class="meta-topic" style="background: #2563EB; color: #FFFFFF !important; font-weight: 800; font-size: 0.45rem; padding: 0.15rem 0.5rem; border-radius: 4px; max-width: 150px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-align: right; box-shadow: 0 1px 2px rgba(0,0,0,0.2);">...</span>
            </div>
          </div>
        </div>

        <div class="exam-content-wrapper" id="exam-wrapper">
          <!-- Left side: Pinned Content (Passage) -->
          <div id="pinned-content-area" class="glass">
             <div id="q-group-content-pinned" class="passage-container"></div>
          </div>

          <!-- Main Content -->
          <div class="exam-main glass">
            <!-- Subject Selection Tabs (JAMB Mock Only) -->
            <div id="jamb-tabs-container" style="display: none; justify-content: flex-start; gap: 0.5rem; margin-bottom: 1rem; overflow-x: auto; padding: 0.4rem 0.5rem; position: sticky; top: 2px; z-index: 1000; background: var(--bg-color); border-bottom: 2px solid var(--accent-primary); scrollbar-width: none; border-radius: 0 0 10px 10px; min-height: 40px;"></div>

            <div id="question-area" style="flex: 1;">
              <!-- Inline passage for mobile or fallback -->
              <div id="q-group-content-inline" class="passage-container glass card"></div>
              
              <div id="q-diagram" style="display: none; margin-bottom: 2.5rem;"></div>
              
              <div id="q-text" style="font-size: var(--base-font-size, 1.2rem); line-height: 1.6; margin-bottom: 2.5rem; font-weight: 600; color: var(--text-primary); font-family: 'Outfit';">...</div>

              <div id="options-container" style="display: flex; flex-direction: column; gap: 1.25rem;"></div>
              
              <div id="explanation-container" class="glass card scale-in" style="margin-top: 3.5rem; padding: 2.5rem; display: none; border-left: 6px solid var(--primary); background: linear-gradient(90deg, rgba(37, 99, 235, 0.05) 0%, transparent 100%);"></div>
            </div>

            <div class="exam-footer" style="margin-top: 3rem; padding-top: 1.5rem; border-top: 1px solid var(--glass-border); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1.5rem;">
              <div style="display: flex; gap: 1rem;">
                <button id="prev-btn" class="btn-secondary" style="height: 54px; padding: 0 1.5rem; font-weight: 800;">PREVIOUS</button>
                <button id="next-btn" class="btn-primary" style="height: 54px; padding: 0 2rem; font-weight: 900; min-width: 160px;">NEXT QUESTION <i data-lucide="chevron-right" style="width: 18px; margin-left: 0.5rem;"></i></button>
              </div>
              
              <div style="display: flex; gap: 0.75rem; align-items: center; flex-wrap: wrap;">
                <button id="report-btn" class="btn-secondary" style="border: none; color: var(--error); font-size: 0.75rem; font-weight: 800; background: transparent; opacity: 0.7;">REPORT</button>
                <button id="toggle-bookmark" class="btn-secondary" style="height: 44px; border-radius: var(--radius-md); font-weight: 800; padding: 0 0.75rem; font-size: 0.75rem;">💾 SAVE</button>
                ${this.isReviewMode ? '<button id="exam-exit-review" class="btn-primary" style="height: 44px; padding: 0 1rem; white-space: nowrap;">EXIT REVIEW</button>' : '<button id="finish-btn" class="btn-primary" style="height: 48px; padding: 0 1.25rem; background: var(--accent-secondary); font-weight: 900; white-space: nowrap;">FINISH EXAM</button>'}
                <button id="toggle-map-footer" class="btn-secondary" title="View Question Map" style="height: 44px; width: 44px; border-radius: 12px; padding: 0; display: flex; align-items: center; justify-content: center; background: rgba(37,99,235,0.1); border-color: rgba(37,99,235,0.2);">
                  <i data-lucide="layout-grid" style="width: 20px; height: 20px; color: var(--accent-primary);"></i>
                </button>
              </div>
            </div>
          </div>

          <!-- Sidebar Navigation (Restored) -->
          <div class="drawer-overlay" id="exam-drawer-overlay"></div>
          
          <div class="exam-sidebar glass" id="exam-sidebar">
            <div style="font-weight: 900; margin-bottom: 1.5rem; font-size: 0.85rem; letter-spacing: 0.15em; text-transform: uppercase; color: var(--text-secondary); font-family: 'Outfit';">Question Map</div>
            <div id="question-grid"></div>
            
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
          <div id="report-details-section" style="display: none; margin-top: 1.25rem; animation: fadeIn 0.3s ease;">
            <div style="font-size: 0.75rem; color: var(--accent-primary); font-weight: 800; text-transform: uppercase; margin-bottom: 0.5rem; letter-spacing: 0.05em;">Selected: <span id="report-reason-label" style="color: var(--text-primary);"></span></div>
            <textarea id="report-details-input" class="glass-input" placeholder="Any additional details? (Optional)" style="width: 100%; min-height: 80px; padding: 1rem; font-size: 0.9rem; border-radius: 12px; resize: vertical; margin-bottom: 1rem;"></textarea>
            <button id="submit-report-btn" class="btn-primary" style="width: 100%; height: 48px; font-weight: 900; border-radius: 12px;">SUBMIT REPORT</button>
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
        </div>
      </div>
    `

    // Start Services
    if (!this.isReviewMode && this.mode !== 'saved') {
      TimerService.start(this.remainingTime, (time) => {
        const timerDiv = document.getElementById('timer')
        if (timerDiv) {
          timerDiv.textContent = TimerService.formatTime(time)
          
          if (time === 300) {
              ModalService.showToast("Wait! You have exactly 5 minutes remaining!", 'warning');
              timerDiv.classList.add('pulse-timer');
          }
          
          if (time <= 300) {
              timerDiv.style.color = 'var(--error)'
              timerDiv.classList.add('pulse-timer-fast');
          } else if (time <= 600) {
              timerDiv.style.color = '#F59E0B' // Amber
          } else {
              timerDiv.style.color = 'var(--success)'
          }
          
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
    
    // Set Source Label — styled badge
    const sourceLabel = document.getElementById('source-label');
    if (sourceLabel) {
        if (this.questionSource === 'past') {
            sourceLabel.textContent = '📜 Past Q';
            sourceLabel.style.color = '#ffffff';
            sourceLabel.style.background = 'rgba(124, 58, 237, 0.75)'; // purple
            sourceLabel.style.border = '1px solid rgba(124,58,237,0.4)';
        } else {
            sourceLabel.textContent = '⚡ Elite AI';
            sourceLabel.style.color = '#ffffff';
            sourceLabel.style.background = 'rgba(37, 99, 235, 0.75)'; // blue
            sourceLabel.style.border = '1px solid rgba(37,99,235,0.4)';
        }
    }

    if (window.lucide) window.lucide.createIcons();
  }

  attachListeners(onFinish, onBack) {
    const backBtn = document.getElementById('exam-back-btn')
    if (backBtn) {
      backBtn.onclick = async (e) => {
        e.preventDefault()
        if (!this.isReviewMode) {
          const confirmed = await ModalService.confirm("Exit Session?", "Are you sure you want to exit? Any unsaved progress will be lost.");
          if (!confirmed) return;
        }
        
        // Stop timer and clean up
        TimerService.stop()
        window.removeEventListener('keydown', this._handleKeyDown)
        window.removeEventListener('beforeunload', this._handleBeforeUnload)
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

    document.getElementById('next-btn').onclick = async () => {
      // Subject-switch confirmation ONLY in full JAMB exam/mock mode — never in practice
      if (this.examType === 'JAMB' && this.mode === 'exam' && !this.isReviewMode) {
        const currentQ = this.session.getCurrentQuestion();
        const nextQ = this.session.questions[this.session.currentIndex + 1];
        if (nextQ && nextQ.subject && currentQ.subject && nextQ.subject !== currentQ.subject) {
          const confirmed = await ModalService.confirm("Switch Subject?", `End of ${currentQ.subject}. Switch to ${nextQ.subject}?`);
          if (!confirmed) return;
        }
      }
      if (this.session.next()) this.updateUI()
    }
    document.getElementById('prev-btn').onclick = async () => {
      // Subject-switch confirmation ONLY in full JAMB exam/mock mode — never in practice
      if (this.examType === 'JAMB' && this.mode === 'exam' && !this.isReviewMode) {
        const currentQ = this.session.getCurrentQuestion();
        const prevQ = this.session.questions[this.session.currentIndex - 1];
        if (prevQ && prevQ.subject && currentQ.subject && prevQ.subject !== currentQ.subject) {
          const confirmed = await ModalService.confirm("Go Back?", `Return to ${prevQ.subject}?`);
          if (!confirmed) return;
        }
      }
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
      toggleCalc.onclick = () => CalculatorComponent.toggle()
    }

    const toggleTutor = document.getElementById('toggle-tutor')
    if (toggleTutor) {
      toggleTutor.onclick = () => {
        if (!this.isReviewMode) {
          ModalService.showToast("AI Tutor is only available during Review to ensure exam integrity.", "info");
          return;
        }
        const q = this.session.getCurrentQuestion()
        AITutorSidebar.toggle(q, this.profile)
      }
    }

    const toggleMapBtn = document.getElementById('toggle-map-footer')
    const sidebar = document.getElementById('exam-sidebar')
    const overlay = document.getElementById('exam-drawer-overlay')

    if (sidebar && overlay) {
      if (toggleMapBtn) {
        toggleMapBtn.onclick = () => {
          sidebar.classList.add('drawer-open')
          overlay.classList.add('drawer-open')
        }
      }

      // Close via overlay tap
      overlay.onclick = () => {
        sidebar.classList.remove('drawer-open')
        overlay.classList.remove('drawer-open')
      }
    }


    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  updateUI() {
    const q = this.session.getCurrentQuestion()
    if (!q) return

    // Meta Info
    const examTypeBadge = document.getElementById('display-exam-type')
    const subjectBadge = document.getElementById('display-subject')
    
    if (this.questionSource === 'past') {
        const year = q.exam_year || q.year;
        const yearSuffix = year ? ` (${year})` : '';
        examTypeBadge.textContent = `${q.exam_type || this.examType || "CBT"}${yearSuffix}`;
        subjectBadge.textContent = q.subject || this.subject || "Practice";
    } else {
        examTypeBadge.textContent = q.exam_type || this.examType || "Elite Assessment"
        subjectBadge.textContent = q.subject || this.subject || "AI Practice"
    }

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
          <div class="passage-body" style="font-size: var(--base-font-size, 1.1rem); line-height: 1.7;">
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
    
    // 🔥 ELITE POWER-UPS: Eliminate 2 (Only in Practice Mode)
    const optionsContainer = document.getElementById('options-container');
    const isMockExam = this.mode === 'exam' || this.mode === 'mock';
    if (!this.isReviewMode && !isMockExam && optionsContainer && this.profile) {
        const powerUpsDiv = document.createElement('div');
        powerUpsDiv.style = "margin-top: 1rem; border-top: 1px solid var(--glass-border); padding-top: 1rem; display: flex; gap: 0.75rem;";
        const uses = this.profile.eliminate_2_uses || 0;
        const btnText = uses > 0 ? `ELIMINATE 2 (${uses} left)` : `ELIMINATE 2 (-50 <i data-lucide="coins" style="width: 10px;"></i>)`;
        
        powerUpsDiv.innerHTML = `
            <button id="eliminate-2-btn" class="glass-btn" style="padding: 0.6rem 1rem; font-size: 0.7rem; font-weight: 800; border-radius: 12px; display: flex; align-items: center; gap: 0.5rem; color: var(--accent-primary);">
                <i data-lucide="zap" style="width: 14px; fill: var(--accent-primary);"></i> ${btnText}
            </button>
        `;
        optionsContainer.appendChild(powerUpsDiv);
        if (window.lucide) window.lucide.createIcons({ root: powerUpsDiv });

        const eliminateBtn = document.getElementById('eliminate-2-btn');
        eliminateBtn.onclick = async () => {
            const hasUses = (this.profile.eliminate_2_uses || 0) > 0;
            if (!hasUses && (this.profile.elite_coins || 0) < 50) {
                ModalService.showToast("Not enough uses or coins! Visit the Store.", "error");
                return;
            }

            // Deduct uses or coins locally and on server
            if (hasUses) {
                this.profile.eliminate_2_uses -= 1;
                await DataService.usePowerUp(this.profile.id, 'eliminate_2');
            } else {
                this.profile.elite_coins -= 50;
                await DataService.purchaseEliteItem(this.profile.id, 'eliminate_2_use', 50);
            }

            // Find incorrect options that are NOT current choice
            const optionBtns = Array.from(optionsContainer.querySelectorAll('button.option-btn'));
            const incorrectBtns = optionBtns.filter(btn => {
                const ans = q.answers.find(a => a.id === btn.dataset.id);
                return ans && !ans.is_correct;
            });

            // Randomly hide 2 incorrect ones
            const toHide = incorrectBtns.sort(() => 0.5 - Math.random()).slice(0, 2);
            toHide.forEach(btn => {
                 btn.style.opacity = '0.3';
                 btn.style.pointerEvents = 'none';
                 btn.style.transform = 'scale(0.95)';
                 btn.querySelector('.option-holder').style.background = 'rgba(255,255,255,0.05)';
                 btn.querySelector('.option-holder').innerHTML = '✕';
            });

            eliminateBtn.disabled = true;
            eliminateBtn.style.opacity = '0.5';
            eliminateBtn.innerHTML = 'Power-up Used!';
            ModalService.showToast("Two wrong answers eliminated!", "success");
        };
    }

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
            const q = this.session.getCurrentQuestion();
            const selectedId = btn.dataset.id;
            
            // Sound Effects Logic
            const isMock = this.mode === 'exam' || this.mode === 'mock';
            if (!this.isReviewMode && !isMock) {
              const correctAns = q.answers?.find(a => a.is_correct);
              if (correctAns) {
                if (selectedId === correctAns.id) SoundService.playCorrect();
                else SoundService.playWrong();
              } else {
                SoundService.playClick();
              }
            } else {
              SoundService.playClick();
            }

            this.session.setAnswer(this.session.currentIndex, selectedId)
            this.saveState()
            
            // 🔥 CLASH HARDENING: Instant Sync for competitions
            if (this.clashId && this.profile?.id) {
                const ans = this.session.userAnswers;
                const answered = Object.keys(ans).length;
                const total = this.session.questions.length;
                DataService.syncClashProgress(this.clashId, this.profile.id, ans, answered, total)
                    .catch(e => console.error("Clash Sync Failed:", e));
            }

            this.updateUI()
            this.renderSidebar()

            // Auto-Advance Logic — respects the global setting from Settings page (all modes)
            if (localStorage.getItem('auto_advance') !== 'false' && !this.isReviewMode) {
              const indexAtClick = this.session.currentIndex;
              setTimeout(() => {
                // Only advance if user hasn't manually navigated already
                if (this.session.currentIndex === indexAtClick && this.session.next()) {
                  this.updateUI();
                }
              }, 700);
            }
          }
        })
      }
    }

    // Explanation visibility
    const expDiv = document.getElementById('explanation-container')
    if (this.isReviewMode) {
      expDiv.style.display = 'block'

      // Always re-read from live systemConfig so admin toggles take effect immediately
      const isFreeAccess = this.systemConfig.explanations_free_access === true ||
                           this.systemConfig.ai_tutor_free_access === true

      const subState = SubscriptionManager.getUserSubscriptionState(this.profile, isFreeAccess)
      const aiStatus = SubscriptionService.canUseAI(this.profile, this.systemConfig)

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
          SubscriptionService.useAICredit(this.profile, this.systemConfig).then(success => {
            if (success) this._deductedQuestions.add(qId)
          })
        } else if (isPremium && aiStatus.canUse && !this._deductedQuestions.has(qId)) {
          SubscriptionService.useAICredit(this.profile, this.systemConfig).then(() => this._deductedQuestions.add(qId))
        }

        let ctaHtml = '';
        if (!isPremium && (isFreeAccess || aiStatus.canUse)) {
           if (subState.shouldShowActivateCTA) {
              ctaHtml = `
                <div style="margin-top: 2rem; padding: 1.5rem; background: rgba(37, 99, 235, 0.05); border-radius: 12px; border: 1px dashed var(--accent-primary); text-align: left; width: 100%;">
                  <h5 style="font-size: 1.1rem; color: var(--text-primary); margin-bottom: 0.4rem; font-family: 'Outfit'; font-weight: 800;">🚀 GO PREMIUM FOR UNLIMITED</h5>
                  <p style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 1.25rem; font-weight: 500;">Activate for ₦1,500 to unlock unlimited explanations and AI insights.</p>
                  <button class="btn-secondary" style="height: 40px; font-size: 0.8rem; border-color: var(--accent-primary); color: var(--accent-primary); font-weight: 800;" onclick="document.getElementById('upgrade-modal').style.display='flex'">ACTIVATE NOW</button>
                </div>
              `;
           } else if (subState.shouldShowRenewCTA) {
              ctaHtml = `
                <div style="margin-top: 2rem; padding: 1.5rem; background: rgba(147, 51, 234, 0.05); border-radius: 12px; border: 1px dashed var(--accent-secondary); text-align: left; width: 100%;">
                  <h5 style="font-size: 1.1rem; color: var(--text-primary); margin-bottom: 0.4rem; font-family: 'Outfit'; font-weight: 800;">⚡ RENEW ELITE ACCESS</h5>
                  <p style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 1.25rem; font-weight: 500;">Renew Premium to maintain your unlimited AI study track.</p>
                  <button class="btn-secondary" style="height: 40px; font-size: 0.8rem; border-color: var(--accent-secondary); color: var(--accent-secondary); font-weight: 800;" onclick="document.getElementById('upgrade-modal').style.display='flex'">RENEW PREMIUM</button>
                </div>
              `;
           }
        }

        let mainContentHtml = '';
        if (q.question_type === 'theory') {
          const graded = q.graded || {}
          mainContentHtml = `
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
          mainContentHtml = `
            <div style="font-weight: 900; color: var(--accent-primary); margin-bottom: 1rem; display: flex; justify-content: space-between; font-family: 'Outfit'; font-size: 0.85rem; letter-spacing: 0.1em; text-transform: uppercase;">
              <span>EXPLANATION</span>
              ${aiStatus.usage ? `<span style="color: var(--accent-secondary); opacity: 0.8;">${aiStatus.usage}/30 DAILY AI USED</span>` : ''}
            </div>
            <div style="color: var(--text-secondary); font-size: 1.1rem; line-height: 1.7; font-family: 'Outfit'; font-weight: 500;">${sanitizeContent(q.explanation || 'No explanation available for this question.')}</div>
          `
        }

        expDiv.innerHTML = `
          ${mainContentHtml}
          <div id="ai-response-area" style="margin-top: 1.5rem; display: none; border-top: 1px solid var(--glass-border); padding-top: 1.5rem; animation: fadeIn 0.4s ease;"></div>
          <div style="margin-top: 2rem; display: flex; gap: 0.75rem; flex-wrap: wrap;">
             <button id="ask-ai-tutor-btn-dynamic" class="btn-dominant" style="height: 48px; border-radius: 12px; font-weight: 800; font-size: 0.85rem; padding: 0 1.5rem; display: ${aiStatus.canUse ? 'flex' : 'none'}; align-items: center; gap: 0.5rem; background: var(--accent-gradient); border: none; box-shadow: 0 4px 15px rgba(124, 58, 237, 0.3);">
                <i data-lucide="sparkles" style="width: 18px; height: 18px;"></i>
                ELITE AI: DEEP DIVE
             </button>
             ${ctaHtml}
          </div>
        `

        const aiDynamicBtn = document.getElementById('ask-ai-tutor-btn-dynamic')
        if (aiDynamicBtn) {
            aiDynamicBtn.onclick = async () => {
                const qType = q.question_type;
                const userChoiceId = qType === 'theory' ? (q.graded?.user_answer || "Theory Response") : this.session.userAnswers[this.session.currentIndex];
                const correctChoiceId = qType === 'theory' ? q.model_answer : q.answers?.find(a => a.is_correct)?.id;

                if (!subState.canUseAI && !this.systemConfig.ai_tutor_free_access) {
                    ModalService.alert("Premium Feature", "Elite AI is a Premium feature. Upgrade to unlock deep dives and infinite learning!", 'info');
                    document.getElementById('upgrade-modal').style.display = 'flex';
                    return;
                }

                aiDynamicBtn.disabled = true;
                aiDynamicBtn.innerHTML = '<div class="loader-spinner" style="width:18px;height:18px;"></div> CONSULTING AI...';
                
                const responseArea = document.getElementById('ai-response-area');
                responseArea.style.display = 'block';
                responseArea.innerHTML = `
                  <div style="padding: 1.5rem; background: rgba(124, 58, 237, 0.05); border-radius: 16px; border: 1.5px solid var(--accent-secondary); position: relative;">
                    <div style="font-family: 'Outfit'; font-weight: 900; color: var(--accent-secondary); font-size: 0.75rem; margin-bottom: 0.75rem; text-transform: uppercase; letter-spacing: 0.1em; display: flex; align-items: center; gap: 0.5rem;">
                       <i data-lucide="sparkles" style="width: 14px;"></i> ELITE AI TUTOR
                    </div>
                    <p style="color: var(--text-secondary); font-size: 1rem; line-height: 1.6; font-weight: 500; font-family: 'Outfit';">Elite AI is analyzing your specific history and performance structure...</p>
                  </div>
                `;
                if (window.lucide) window.lucide.createIcons({ root: responseArea });

                try {
                  const explanation = await AiService.getDeepExplanation(q, userChoiceId, correctChoiceId, this.userAnalytics);
                  
                  responseArea.innerHTML = `
                    <div style="padding: 2rem; background: rgba(124, 58, 237, 0.07); border-radius: 16px; border: 1.5px solid var(--accent-secondary); box-shadow: 0 10px 30px rgba(0,0,0,0.2);">
                      <div style="font-family: 'Outfit'; font-weight: 900; color: var(--accent-secondary); font-size: 0.8rem; margin-bottom: 1.25rem; text-transform: uppercase; letter-spacing: 0.15em; display: flex; align-items: center; gap: 0.6rem;">
                         <i data-lucide="sparkles" style="width: 16px;"></i> ELITE AI (TAILORED INSIGHT)
                      </div>
                      <div style="color: var(--text-primary); font-size: 1.1rem; line-height: 1.8; font-weight: 500; font-family: 'Outfit'; white-space: pre-wrap;">${sanitizeContent(explanation)}</div>
                      <div style="margin-top: 1.5rem; text-align: right; font-size: 0.75rem; color: var(--text-secondary); opacity: 0.6;">Powered by Adaptive Memory</div>
                    </div>
                  `;
                  if (window.lucide) window.lucide.createIcons({ root: responseArea });
                  responseArea.scrollIntoView({ behavior: 'smooth', block: 'end' });
                  
                  if (!this._deductedQuestions.has(q.id)) {
                    SubscriptionService.useAICredit(this.profile, this.systemConfig).then(() => this._deductedQuestions.add(q.id));
                  }
                } catch (err) {
                  responseArea.innerHTML = `<div style="color: var(--error); padding: 1rem; border: 1px solid var(--error); border-radius: 12px; font-weight: 600;">⚠️ ${err.message}</div>`;
                } finally {
                  aiDynamicBtn.disabled = false;
                  aiDynamicBtn.innerHTML = '<i data-lucide="sparkles" style="width: 18px; height: 18px;"></i> ELITE AI: DEEP DIVE';
                  if (window.lucide) window.lucide.createIcons({ root: aiDynamicBtn });
                }
            };
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
        if (typeof renderMathInElement === 'function') {
            const mathContainer = document.querySelector('.exam-main') || document.getElementById('exam-container');
            if (mathContainer) {
                renderMathInElement(mathContainer, {
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
    container.innerHTML = this.jambSubjects.map(sub => {
      const isCurrent = sub === this.activeJambSubject;
      return `
      <button class="jamb-tab-btn" data-subject="${sub}" style="flex-shrink: 0; white-space: nowrap; padding: 0.35rem 0.85rem; border-radius: 20px; font-size: 0.75rem; font-weight: 900; border: 2px solid ${isCurrent ? 'var(--accent-primary)' : 'var(--glass-border)'}; background: ${isCurrent ? 'var(--accent-primary)' : 'rgba(255,255,255,0.08)'}; color: ${isCurrent ? 'white' : 'var(--text-primary)'} !important; cursor: pointer; transition: all 0.2s; font-family: 'Outfit'; line-height: 1;">
        ${sub.toUpperCase()}
      </button>
    `}).join('')

    container.querySelectorAll('.jamb-tab-btn').forEach(btn => {
      btn.onclick = () => {
        const targetSub = btn.dataset.subject
        if (targetSub !== this.activeJambSubject) {
           this.activeJambSubject = targetSub
           this.renderJambTabs()
           const firstIndex = this.session.questions.findIndex(q => {
              const name = (q.subject || q.subjects?.subject_name || '').toLowerCase()
              if (targetSub === 'Use of English' && name.includes('english')) return true
              return (q.subject || q.subjects?.subject_name) === targetSub
           })
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
    let selectedReason = null;

    const resetModal = () => {
      document.getElementById('report-details-section').style.display = 'none';
      document.getElementById('report-details-input').value = '';
      selectedReason = null;
    };

    const closeModal = () => {
      modal.style.display = 'none';
      resetModal();
    };

    const closeBtn = document.getElementById('close-report')
    closeBtn.onclick = closeModal

    const closeX = document.getElementById('close-report-x')
    if (closeX) closeX.onclick = closeModal

    modal.querySelectorAll('.reason-btn').forEach(btn => {
      btn.onclick = () => {
        selectedReason = btn.textContent;
        document.getElementById('report-reason-label').textContent = selectedReason;
        document.getElementById('report-details-section').style.display = 'block';
        
        // Hide the reason buttons for a cleaner UI
        modal.querySelectorAll('.reason-btn').forEach(b => b.style.display = 'none');
      }
    })
    
    document.getElementById('submit-report-btn').onclick = async () => {
        const details = document.getElementById('report-details-input').value.trim();
        const submitBtn = document.getElementById('submit-report-btn');
        submitBtn.disabled = true;
        submitBtn.textContent = 'SUBMITTING...';
        if (this.profile && this.profile.id) {
          try {
            await DataService.reportQuestion(this.profile.id, this.session.getCurrentQuestion().id, selectedReason, details)
            ModalService.showToast("Report submitted. Thank you!", 'success')
          } catch (err) {
            console.error("Report failed:", err)
            ModalService.showToast("Failed to submit report.", 'error')
          }
        }
        submitBtn.disabled = false;
        submitBtn.textContent = 'SUBMIT REPORT';
        
        modal.querySelectorAll('.reason-btn').forEach(b => b.style.display = 'block');
        closeModal();
    };
  }

  finish(callback, force = false) {
    if (force) {
      TimerService.stop()
      window.removeEventListener('keydown', this._handleKeyDown)
      window.removeEventListener('beforeunload', this._handleBeforeUnload)

      // Capture session data BEFORE clearing session
      const summary = this.session ? this.session.getSummary() : null;
      const userAnswers = summary ? { ...summary.userAnswers } : {}
      const timeTaken = summary ? summary.timeTaken : 0
      const actualQuestions = this.session ? [...this.session.questions] : []
      
      // Save to Database
      if (!this.isReviewMode && this.profile && summary) {
        DataService.saveExamSession(
            this.profile.id, 
            {
                total_questions: summary.total,
                answered_questions: summary.answered_questions,
                correct_answers: summary.correct,
                score_percentage: summary.score_percentage,
                time_taken_seconds: summary.timeTaken,
                session_type: this.mode,
                subject: this.subject || 'General',
                subject_name: this.subject || 'General'
            },
            actualQuestions,
            userAnswers,
            false,
            this.questionSource
        );
      }

      // 🔥 CLASH HARDENING: Submit final results to the competition table
      if (this.clashId && this.profile?.id && summary) {
          const score = summary.correct;
          DataService.submitClashResults(this.clashId, this.profile.id, score, timeTaken)
              .catch(e => console.error("Final Clash Submission Failed:", e));
      }

      this.session = null
      document.getElementById('exam-container').style.display = 'none'
      if (callback) callback(userAnswers, timeTaken, actualQuestions, this.clashId)
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

  render(questions, profile, onFinish, isReview = false, pastAnswers = {}, mode = 'practice', subject = '', examType = '', onBack = null, resumeState = null, intendedSubjects = [], clashId = null, questionSource = 'ai') {
    this._instance = new Exam(questions, profile, subject, examType, mode, isReview, pastAnswers, intendedSubjects, clashId, questionSource)
    this._instance.render((userAnswers, timeTaken, actualQuestions, cid) => {
        if (onFinish) onFinish(userAnswers, timeTaken, actualQuestions, cid)
    }, onBack, resumeState)
  },

  hide() {
    const container = document.getElementById('exam-container')
    if (container) container.style.display = 'none'
  }
}
