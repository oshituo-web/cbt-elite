import { DataService } from '../services/data'
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
            <h1 style="font-family: 'Outfit'; font-size: 1.75rem; font-weight: 900; color: var(--text-primary); margin: 0;">Practice Center</h1>
            <p style="color: var(--text-secondary); font-size: 0.9rem;">Master subjects at your own pace.</p>
          </div>
        </header>

        <!-- Practice Configuration -->
        <div id="practice-config" class="glass card scale-in" style="padding: 2rem 1.5rem; max-width: 800px; margin: 0 auto; width: 100%; box-sizing: border-box;">
          <h3 style="font-family: 'Outfit'; font-weight: 800; font-size: 1.35rem; color: var(--accent-primary); margin-bottom: 1.5rem;">Configure Session</h3>
          
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

            <div>
              <label style="display: block; font-size: 0.85rem; margin-bottom: 0.5rem; font-weight: 700;">Questions</label>
              <select id="p-limit" class="glass-select" style="width: 100%; height: 48px; border-radius: 10px; border: 1.5px solid var(--glass-border); background: var(--card-bg); color: var(--text-primary); padding: 0 0.75rem;">
                <option value="10">10 Questions (Quick)</option>
                <option value="20" selected>20 Questions (Standard)</option>
                <option value="40">40 Questions (Intense)</option>
              </select>
            </div>
          </div>

          <button id="p-start-btn" class="btn-dominant" style="margin-top: 2rem; width: 100%; height: 52px; background: var(--primary);">Start Practice Session</button>
        </div>
      </div>
    `

    this.setupListeners()
  },

  async setupListeners() {
    const pSub = document.getElementById('p-subject')
    const pTopic = document.getElementById('p-topic')
    const pLimit = document.getElementById('p-limit')
    const startBtn = document.getElementById('p-start-btn')
    const backBtn = document.getElementById('practice-back-btn')

    // Load Subjects
    pSub.innerHTML = '<option>Loading...</option>'
    const { data: subjects } = await DataService.getSubjects()
    pSub.innerHTML = subjects.map(s => `<option value="${s.subject_name}">${s.subject_name}</option>`).join('')

    pSub.onchange = async () => {
      pTopic.innerHTML = '<option value="">Loading topics...</option>'
      const { data: topics } = await DataService.getTopics(subjects.find(s => s.subject_name === pSub.value).id)
      pTopic.innerHTML = '<option value="">All Topics</option>' + topics.map(t => `<option value="${t}">${t}</option>`).join('')
    }
    // Trigger initial load
    if (pSub.value) pSub.dispatchEvent(new Event('change'))

    startBtn.onclick = async () => {
      const subject = pSub.value
      const topic = pTopic.value
      const limit = parseInt(pLimit.value)
      
      startBtn.innerHTML = 'Finding Questions...'; startBtn.disabled = true
      
      try {
        const { data: questions } = await DataService.getPracticeQuestions(subject, topic, limit)
        
        if (questions && questions.length > 0) {
          this.onStartPractice(questions, 'practice', subject, '')
        } else {
          alert("No questions found for this selection.");
          startBtn.innerHTML = 'Start Practice Session'; startBtn.disabled = false
        }
      } catch (err) {
        alert("Error loading questions.");
        startBtn.innerHTML = 'Start Practice Session'; startBtn.disabled = false
      }
    }

    if (backBtn) backBtn.onclick = () => window.navigateTo('dashboard')
  },

  hide() {
    const container = document.getElementById('practice-container')
    if (container) container.style.display = 'none'
  }
}
