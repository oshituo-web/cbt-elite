import { DataService } from '../services/data'
import { supabase } from '../utils/supabase'
import { SubscriptionService } from '../services/subscriptionService'
import { ExamCard } from './ExamCard'
import { ModalService } from '../services/ModalService'

export const PracticeDashboardComponent = {
  profile: null,
  onStartPractice: null,

  async render(profile, onStartPractice) {
    this.profile = profile
    this.onStartPractice = onStartPractice
    
    const container = document.getElementById('practice-container')
    if (!container) {
      const mainView = document.getElementById('main-view')
      const div = document.createElement('div')
      div.id = 'practice-container'
      div.className = 'practice-view-container'
      mainView.appendChild(div)
    }
    
    document.querySelectorAll('#main-view > div').forEach(div => div.style.display = 'none')
    const practiceContainer = document.getElementById('practice-container')
    practiceContainer.style.display = 'block'

    practiceContainer.innerHTML = `
      <div class="container animate-fadeIn" style="width: 100%; max-width: 1200px; padding: 1.5rem 1rem; box-sizing: border-box;">
        <header style="margin-bottom: 2rem; display: flex; align-items: center; gap: 1rem; flex-wrap: wrap;">
          <button id="practice-back-btn" class="header-icon-btn" title="Go Back" style="display: flex; align-items: center; gap: 0.5rem; width: auto; padding: 0.5rem 0.75rem; border-radius: 12px; background: rgba(0,0,0,0.05);">
            <i data-lucide="arrow-left" style="width: 20px;"></i>
            <span style="font-weight: 800; font-size: 0.85rem; letter-spacing: 0.05em;">EXIT</span>
          </button>
          <div style="flex: 1; min-width: 200px;">
            <h1 style="font-family: 'Outfit'; font-size: 1.5rem; font-weight: 900; color: var(--text-primary); margin: 0;">Practice Center</h1>
            <p style="color: var(--text-secondary); font-size: 0.85rem; line-height: 1.4;">Master subjects with focused 25-question standard pools.</p>
          </div>
        </header>

        <!-- DUAL SOURCE SELECTOR -->
        <div class="glass card scale-in" style="margin-bottom: 2rem; padding: 1.25rem; display: flex; align-items: center; justify-content: space-between; gap: 1.5rem; flex-wrap: wrap; background: rgba(124, 58, 237, 0.03); border: 1.5px solid var(--glass-border);">
            <div style="flex: 1; min-width: 250px;">
                <h3 style="font-family: 'Outfit'; font-size: 1.1rem; font-weight: 800; color: var(--text-primary); margin: 0 0 0.25rem 0;">Question Source</h3>
                <p style="font-size: 0.75rem; color: var(--text-secondary); margin: 0;">Choose between AI-generated or Real Past Questions.</p>
            </div>
            <div style="display: flex; background: rgba(0,0,0,0.2); padding: 4px; border-radius: 12px; border: 1px solid var(--glass-border);">
                <button id="source-ai-btn" class="source-toggle-btn active" style="padding: 0.6rem 1.25rem; border-radius: 9px; font-size: 0.75rem; font-weight: 900; border: none; cursor: pointer; transition: all 0.2s;">
                    ELITE AI
                </button>
                <button id="source-past-btn" class="source-toggle-btn" style="padding: 0.6rem 1.25rem; border-radius: 9px; font-size: 0.75rem; font-weight: 900; border: none; cursor: pointer; transition: all 0.2s;">
                    PAST QUESTIONS
                </button>
            </div>
        </div>

        <div class="dashboard-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.5rem; width: 100%;">
          ${ExamCard({
            title: 'JAMB Practice',
            description: 'Focused practice on JAMB standard questions',
            color: 'jamb',
            icon: '🎯',
            dataExamTarget: 'JAMB',
            extraClass: 'practice-tier'
          })}
          ${ExamCard({
            title: 'WAEC Practice',
            description: 'Focused practice on WAEC standard questions',
            color: 'waec',
            icon: '📘',
            dataExamTarget: 'WAEC',
            extraClass: 'practice-tier'
          })}
          ${ExamCard({
            title: 'NECO Practice',
            description: 'Focused practice on NECO standard questions',
            color: 'neco',
            icon: '📝',
            dataExamTarget: 'NECO',
            extraClass: 'practice-tier'
          })}
        </div>

        <!-- Practice Configuration Overlay -->
        <div id="practice-config" class="glass card scale-in" style="display: none; padding: 1.25rem; max-width: 800px; margin: 1.25rem auto 0 auto; width: 100%; box-sizing: border-box;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem; gap: 1rem;">
            <div>
              <h3 id="practice-title" style="font-family: 'Outfit'; font-weight: 800; font-size: 1.15rem; color: var(--accent-primary);">Configure Session</h3>
              <p style="font-size: 0.8rem; color: var(--text-secondary); line-height: 1.4;">Select subject and topic to begin.</p>
            </div>
            <button id="close-practice-config" class="btn-secondary" style="width: 36px; height: 36px; border-radius: 50%; padding: 0; min-width: auto;">&times;</button>
          </div>
          
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1.5rem;">
            <div>
              <label for="p-subject" style="display: block; font-size: 0.85rem; margin-bottom: 0.5rem; font-weight: 700;">Select Subject</label>
              <select id="p-subject" class="glass-select" style="width: 100%; height: 48px; border-radius: 10px; border: 1.5px solid var(--glass-border); background: var(--card-bg); color: var(--text-primary); padding: 0 0.75rem;"></select>
            </div>
            
            <div>
              <label for="p-topic" style="display: block; font-size: 0.85rem; margin-bottom: 0.5rem; font-weight: 700;">Filter by Topic (Optional)</label>
              <select id="p-topic" class="glass-select" style="width: 100%; height: 48px; border-radius: 10px; border: 1.5px solid var(--glass-border); background: var(--card-bg); color: var(--text-primary); padding: 0 0.75rem;">
                <option value="">All Topics</option>
              </select>
            </div>
          </div>

          <button id="p-start-btn" class="btn-dominant" style="margin-top: 1.5rem; width: 100%; height: 50px; background: var(--primary); font-weight: 900; letter-spacing: 0.05em;">BLAST!</button>
          
          <div class="mobile-only" style="height: 80px; display: none;"></div>
        </div>
      </div>
    `

    if (window.lucide) window.lucide.createIcons({ root: practiceContainer })
    this.setupListeners()
  },

  async setupListeners() {
    const practiceContainer = document.getElementById('practice-container')
    const configSection = document.getElementById('practice-config')
    const closeBtn = document.getElementById('close-practice-config')
    const pSub = document.getElementById('p-subject')
    const pTopic = document.getElementById('p-topic')
    const startBtn = document.getElementById('p-start-btn')
    const backBtn = document.getElementById('practice-back-btn')
    const titleElement = document.getElementById('practice-title')
    let selectedPracticeType = ''
    let selectedSource = 'ai'

    const aiToggle = document.getElementById('source-ai-btn')
    const pastToggle = document.getElementById('source-past-btn')

    const updateToggleUI = () => {
        if (selectedSource === 'ai') {
            aiToggle.classList.add('active');
            pastToggle.classList.remove('active');
            aiToggle.style.background = 'var(--accent-primary)';
            aiToggle.style.color = 'white';
            pastToggle.style.background = 'transparent';
            pastToggle.style.color = 'var(--text-secondary)';
        } else {
            pastToggle.classList.add('active');
            aiToggle.classList.remove('active');
            pastToggle.style.background = 'var(--accent-secondary)';
            pastToggle.style.color = 'white';
            aiToggle.style.background = 'transparent';
            aiToggle.style.color = 'var(--text-secondary)';
        }
    }
    updateToggleUI();

    aiToggle.onclick = () => { selectedSource = 'ai'; updateToggleUI(); }
    pastToggle.onclick = () => { selectedSource = 'past'; updateToggleUI(); }

    practiceContainer.querySelectorAll('.practice-tier').forEach(tier => {
      tier.onclick = async () => {
        selectedPracticeType = tier.dataset.exam
        titleElement.textContent = `${selectedPracticeType} Practice Session`
        configSection.style.display = 'block'
        configSection.scrollIntoView({ behavior: 'smooth', block: 'start' })

        // Load Subjects dynamically upon selecting a type
        pSub.innerHTML = '<option>Loading...</option>'
        const { data: subjects } = await DataService.getSubjects()
        // If it's JAMB, we might filter subjects or keep all. Since JAMB practice is typically objective. We list all subjects.
        pSub.innerHTML = subjects.map(s => `<option value="${s.subject_name}">${s.subject_name}</option>`).join('')
        pSub.dispatchEvent(new Event('change'))
      }
    })

    if (closeBtn) closeBtn.onclick = () => configSection.style.display = 'none'

    pSub.onchange = async () => {
      pTopic.innerHTML = '<option value="">Loading topics...</option>'
      const { data: subjects } = await DataService.getSubjects()
      const match = subjects.find(s => s.subject_name === pSub.value)
      if (match) {
        const { data: topics } = await DataService.getTopics(match.id)
        pTopic.innerHTML = '<option value="">All Topics</option>' + topics.map(t => `<option value="${t}">${t}</option>`).join('')
      }
    }

    startBtn.onclick = async () => {
      startBtn.innerHTML = 'Preparing...'; startBtn.disabled = true
      
      const subject = pSub.value
      const topic = pTopic.value
      // Note: number of questions for practice is strictly pegged to 25.
      const limit = 25 
      
      try {
        // Fetch system config for subscription check
        const { data: configs, error: configError } = await DataService.getGlobalConfigs([
          'explanations_free_access',
          'exams_free_access',
          'ai_tutor_free_access',
          'daily_practice_limit_free',
          'daily_practice_limit_medium'
        ])
        if (configError) throw new Error("Failed to load configuration");

        const systemConfig = {}
        if (configs) {
          configs.forEach(c => {
            systemConfig[c.key] = c.value
          })
        }

        if (!SubscriptionService.canStartSession(this.profile, 'practice', systemConfig)) {
          startBtn.innerHTML = 'Start Session'; startBtn.disabled = false
          return ModalService.alert("Limit Reached", "Daily practice limit reached. Upgrade to Premium for unlimited access!", 'error')
        }

        startBtn.innerHTML = 'Finding Questions...'; 
        const { data: questions } = await DataService.getPracticeQuestions(subject, topic, limit, selectedPracticeType, selectedSource)
        
        if (questions && questions.length > 0) {
          // Pass the selected practice type backwards to be accessible in session metadata
          this.onStartPractice(questions, 'practice', subject, selectedPracticeType, { questionSource: selectedSource })
        } else {
          ModalService.alert("No Questions", `No questions found for ${selectedPracticeType} ${subject}.`, 'info');
          startBtn.innerHTML = 'Start Session'; startBtn.disabled = false
        }
      } catch (err) {
        console.error("Practice Load Failed:", err);
        ModalService.alert("Load Failed", `Error loading questions: ${err.message || 'Connection timeout'}. Please check your internet and try again.`, 'error');
        startBtn.innerHTML = 'Start Session'; startBtn.disabled = false
      }
    }

    if (backBtn) backBtn.onclick = () => window.navigateTo('dashboard')
  },

  hide() {
    const container = document.getElementById('practice-container')
    if (container) container.style.display = 'none'
  }
}
