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
      // Create if missing
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
      <div class="container animate-fadeIn">
        <header style="margin-bottom: 2.5rem; display: flex; align-items: center; justify-content: space-between;">
          <div>
            <h1 style="font-family: 'Outfit'; font-size: 2rem; font-weight: 900; color: var(--text-primary);">Targeted Practice</h1>
            <p style="color: var(--text-secondary); font-weight: 500;">Master the syllabus one topic at a time.</p>
          </div>
          <div class="badge" style="background: rgba(124, 58, 237, 0.1); color: var(--accent-primary); border: 1px solid rgba(124, 58, 237, 0.2);"><i data-lucide="target"></i> Focus Mode</div>
        </header>

        <div class="dashboard-grid">
          ${ExamCard({
            title: 'JAMB Practice',
            description: 'UTME past questions simulation',
            color: 'jamb',
            icon: '🎯',
            dataExamTarget: 'JAMB',
            extraClass: 'practice-tier'
          })}
          ${ExamCard({
            title: 'WAEC Practice',
            description: 'SSCE syllabus practice',
            color: 'waec',
            icon: '📘',
            dataExamTarget: 'WAEC',
            extraClass: 'practice-tier'
          })}
          ${ExamCard({
            title: 'NECO Practice',
            description: 'SSCE syllabus practice',
            color: 'neco',
            icon: '📝',
            dataExamTarget: 'NECO',
            extraClass: 'practice-tier'
          })}
        </div>

        <!-- Practice Config Overlay (Dynamic) -->
        <div id="practice-config" class="glass card scale-in" style="display: none; margin-top: 3rem; padding: 2.5rem; max-width: 800px; margin-left: auto; margin-right: auto;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 2rem;">
            <div>
              <h3 id="practice-title" style="font-family: 'Outfit'; font-weight: 800; font-size: 1.5rem; color: var(--primary);">Configure Session</h3>
              <p style="font-size: 0.9rem; color: var(--text-secondary);">Customize your practice logic below.</p>
            </div>
            <button id="close-practice-config" class="btn-secondary" style="width: 40px; height: 40px; border-radius: 50%; padding: 0;">&times;</button>
          </div>
          
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1.5rem;">
            <div>
              <label style="display: block; font-size: 0.9rem; margin-bottom: 0.6rem; font-weight: 700; color: var(--text-primary);"><i data-lucide="book" style="width: 14px;"></i> Select Subject</label>
              <select id="p-subject" class="glass-select" style="width: 100%; height: 52px; border-radius: 12px; border: 1.5px solid var(--glass-border); background: var(--card-bg); color: var(--text-primary); padding: 0 1rem;"></select>
            </div>
            <div id="p-topic-wrapper">
              <label style="display: block; font-size: 0.9rem; margin-bottom: 0.6rem; font-weight: 700; color: var(--text-primary);"><i data-lucide="layers" style="width: 14px;"></i> Specific Topic</label>
              <select id="p-topic" class="glass-select" style="width: 100%; height: 52px; border-radius: 12px; border: 1.5px solid var(--glass-border); background: var(--card-bg); color: var(--text-primary); padding: 0 1rem;">
                <option value="">All Topics (Recommended)</option>
              </select>
            </div>
          </div>
          <button id="p-start-btn" class="btn-dominant" style="margin-top: 2.5rem; width: 100%; height: 56px;">Start Practice Session</button>
        </div>
        
        <!-- Legal Compliance Footer -->
        <footer style="margin-top: 5rem; padding: 2rem; border-top: 1px dashed var(--glass-border); text-align: center; opacity: 0.6;">
           <p style="font-size: 0.8rem; color: var(--text-secondary);">CBT Elite is not affiliated with JAMB, WAEC, or NECO.</p>
        </footer>
      </div>
    `

    if (window.lucide) window.lucide.createIcons({ root: practiceContainer })

    this.setupListeners()
  },

  async setupListeners() {
    const practiceContainer = document.getElementById('practice-container')
    const configSection = document.getElementById('practice-config')
    const closeBtn = document.getElementById('close-practice-config')
    const startBtn = document.getElementById('p-start-btn')
    const subSelect = document.getElementById('p-subject')
    const topicSelect = document.getElementById('p-topic')
    const titleHeader = document.getElementById('practice-title')

    let selectedExam = ''

    // 1. Handle Card Clicks
    practiceContainer.querySelectorAll('.practice-tier').forEach(tier => {
      tier.onclick = async () => {
        selectedExam = tier.dataset.exam
        titleHeader.textContent = `Configure ${selectedExam} Practice`
        
        // Show loader in dropdown
        subSelect.innerHTML = '<option>Loading subjects...</option>'
        configSection.style.display = 'block'
        configSection.scrollIntoView({ behavior: 'smooth', block: 'start' })

        try {
          const { data: subjects } = await DataService.getSubjects(selectedExam)
          subSelect.innerHTML = subjects.map(s => `<option value="${s.subject}">${s.subject}</option>`).join('')
          
          // Trigger first topic load
          subSelect.onchange()
        } catch (err) {
          subSelect.innerHTML = '<option>Error loading subjects</option>'
        }
      }
    })

    // 2. Handle Subject Change (Fetch Topics)
    subSelect.onchange = async () => {
      const sub = subSelect.value
      topicSelect.innerHTML = '<option value="">All Topics (Recommended)</option>'
      
      try {
        const { data: topics } = await DataService.getTopics(sub)
        if (topics) {
          topicSelect.innerHTML += topics.map(t => `<option value="${t.topic}">${t.topic}</option>`).join('')
        }
      } catch (err) {
        console.warn("Failed to load topics", err)
      }
    }

    // 3. Close Config
    if (closeBtn) closeBtn.onclick = () => configSection.style.display = 'none'

    // 4. Start Practice
    startBtn.onclick = async () => {
      const subject = subSelect.value
      const topic = topicSelect.value
      
      if (!subject) return alert('Please select a subject')

      startBtn.innerHTML = '<div class="loader-spinner" style="width:20px;height:20px;"></div> Starting...'
      startBtn.disabled = true

      try {
        const { data: questions, error } = await DataService.getPracticeQuestions(subject, topic, 20)
        if (error || !questions || questions.length === 0) {
          throw new Error(error?.message || 'No questions found for this selection.')
        }
        
        this.onStartPractice(questions, 'practice', subject, selectedExam)
      } catch (err) {
        alert(err.message)
        startBtn.innerHTML = 'Start Practice Session'
        startBtn.disabled = false
      }
    }
  },

  hide() {
    const container = document.getElementById('practice-container')
    if (container) container.style.display = 'none'
  }
}
