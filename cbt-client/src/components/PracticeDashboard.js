import { DataService } from '../services/data'
import { supabase } from '../utils/supabase'
import { SubscriptionService } from '../services/subscriptionService'
import { ExamCard } from './ExamCard'

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
          <button id="practice-back-btn" class="btn-secondary" style="width: 40px; height: 40px; padding: 0; border-radius: 50%; display: flex; align-items: center; justify-content: center;" title="Back">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          </button>
          <div style="flex: 1; min-width: 200px;">
            <h1 style="font-family: 'Outfit'; font-size: 1.5rem; font-weight: 900; color: var(--text-primary); margin: 0;">Practice Center</h1>
            <p style="color: var(--text-secondary); font-size: 0.85rem; line-height: 1.4;">Master subjects with focused 25-question standard pools.</p>
          </div>
        </header>

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
              <label style="display: block; font-size: 0.85rem; margin-bottom: 0.5rem; font-weight: 700;">Select Subject</label>
              <select id="p-subject" class="glass-select" style="width: 100%; height: 48px; border-radius: 10px; border: 1.5px solid var(--glass-border); background: var(--card-bg); color: var(--text-primary); padding: 0 0.75rem;"></select>
            </div>
            
            <div>
              <label style="display: block; font-size: 0.85rem; margin-bottom: 0.5rem; font-weight: 700;">Filter by Topic (Optional)</label>
              <select id="p-topic" class="glass-select" style="width: 100%; height: 48px; border-radius: 10px; border: 1.5px solid var(--glass-border); background: var(--card-bg); color: var(--text-primary); padding: 0 0.75rem;">
                <option value="">All Topics</option>
              </select>
            </div>
          </div>

          <button id="p-start-btn" class="btn-dominant" style="margin-top: 2rem; width: 100%; height: 50px; background: var(--primary);">Start Session</button>
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
          return alert("Daily practice limit reached. Upgrade to Premium for unlimited access!")
        }

        startBtn.innerHTML = 'Finding Questions...'; 
        const { data: questions } = await DataService.getPracticeQuestions(subject, topic, limit, selectedPracticeType)
        
        if (questions && questions.length > 0) {
          // Pass the selected practice type backwards to be accessible in session metadata
          this.onStartPractice(questions, 'practice', subject, selectedPracticeType)
        } else {
          alert(`No questions found for ${selectedPracticeType} ${subject}.`);
          startBtn.innerHTML = 'Start Session'; startBtn.disabled = false
        }
      } catch (err) {
        console.error("Practice Load Failed:", err);
        alert(`Error loading questions: ${err.message || 'Connection timeout'}. Please check your internet and try again.`);
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
