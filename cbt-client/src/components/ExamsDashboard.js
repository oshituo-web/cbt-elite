import { DataService } from '../services/data'
import { ExamCard } from './ExamCard'

export const ExamsDashboardComponent = {
  profile: null,
  onStartExam: null,

  async render(profile, onStartExam) {
    this.profile = profile
    this.onStartExam = onStartExam
    
    const container = document.getElementById('exams-container')
    if (!container) {
      const mainView = document.getElementById('main-view')
      const div = document.createElement('div')
      div.id = 'exams-container'
      div.className = 'exams-view-container'
      mainView.appendChild(div)
    }
    
    document.querySelectorAll('#main-view > div').forEach(div => div.style.display = 'none')
    const examsContainer = document.getElementById('exams-container')
    examsContainer.style.display = 'block'

    examsContainer.innerHTML = `
      <div class="container animate-fadeIn">
        <header style="margin-bottom: 2.5rem; display: flex; align-items: center; justify-content: space-between;">
          <div>
            <h1 style="font-family: 'Outfit'; font-size: 2rem; font-weight: 900; color: var(--text-primary);">Standard Mock Exams</h1>
            <p style="color: var(--text-secondary); font-weight: 500;">Simulate real exam conditions with full syllabus coverage.</p>
          </div>
          <div class="badge" style="background: rgba(37, 99, 235, 0.1); color: var(--accent-primary); border: 1px solid rgba(37, 99, 235, 0.2);"><i data-lucide="award"></i> Certify Mode</div>
        </header>

        <div class="dashboard-grid">
          ${ExamCard({
            title: 'JAMB Mock',
            description: 'Full 180 questions timed simulation',
            color: 'jamb',
            icon: '🎯',
            dataExamTarget: 'JAMB',
            extraClass: 'exam-tier'
          })}
          ${ExamCard({
            title: 'WAEC Mock',
            description: 'Full SSCE standard simulation',
            color: 'waec',
            icon: '📘',
            dataExamTarget: 'WAEC',
            extraClass: 'exam-tier'
          })}
          ${ExamCard({
            title: 'NECO Mock',
            description: 'Full SSCE standard simulation',
            color: 'neco',
            icon: '📝',
            dataExamTarget: 'NECO',
            extraClass: 'exam-tier'
          })}
        </div>

        <!-- Exam Config Overlay -->
        <div id="exam-config" class="glass card scale-in" style="display: none; margin-top: 3rem; padding: 2.5rem; max-width: 800px; margin-left: auto; margin-right: auto;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 2rem;">
            <div>
              <h3 id="exam-title" style="font-family: 'Outfit'; font-weight: 800; font-size: 1.5rem; color: var(--accent-secondary);">Setup Mock Exam</h3>
              <p style="font-size: 0.9rem; color: var(--text-secondary);">Select your subjects for the simulation.</p>
            </div>
            <button id="close-exam-config" class="btn-secondary" style="width: 40px; height: 40px; border-radius: 50%; padding: 0;">&times;</button>
          </div>
          
          <!-- JAMB Specific: Mandatory English + 3 Subjects -->
          <div id="jamb-exam-config" style="display: none;">
              <p style="margin-bottom: 1.25rem; color: var(--accent-secondary); font-weight: 600;">English is mandatory. Select 3 additional subjects to complete your set.</p>
              <div id="jamb-sub-list" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 1rem; max-height: 300px; overflow-y: auto; padding: 1.25rem; background: rgba(0,0,0,0.2); border-radius: 12px; border: 1px solid var(--glass-border);">
                 <div class="loader-spinner"></div>
              </div>
          </div>

          <!-- WAEC/NECO Specific -->
          <div id="waec-neco-exam-config" style="display: none;">
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
                  <div>
                      <label style="display: block; font-size: 0.9rem; margin-bottom: 0.6rem; font-weight: 700; color: var(--text-primary);">Subject</label>
                      <select id="e-subject" class="glass-select" style="width: 100%; height: 52px; border-radius: 12px; border: 1.5px solid var(--glass-border); background: var(--card-bg); color: var(--text-primary); padding: 0 1rem;"></select>
                  </div>
                  <div>
                      <label style="display: block; font-size: 0.9rem; margin-bottom: 0.6rem; font-weight: 700; color: var(--text-primary);">Format</label>
                      <select id="e-type" class="glass-select" style="width: 100%; height: 52px; border-radius: 12px; border: 1.5px solid var(--glass-border); background: var(--card-bg); color: var(--text-primary); padding: 0 1rem;">
                          <option value="objective">Objective (Recommended)</option>
                          <option value="theory">Theory (Graded by AI)</option>
                      </select>
                  </div>
              </div>
          </div>

          <button id="e-start-btn" class="btn-dominant" style="margin-top: 2.5rem; width: 100%; height: 56px; background: var(--accent-gradient);">Begin Full Mock Exam</button>
        </div>
      </div>
    `

    if (window.lucide) window.lucide.createIcons({ root: examsContainer })

    this.setupListeners()
  },

  async setupListeners() {
    const examsContainer = document.getElementById('exams-container')
    const configSection = document.getElementById('exam-config')
    const closeBtn = document.getElementById('close-exam-config')
    const startBtn = document.getElementById('e-start-btn')
    
    const jambConfig = document.getElementById('jamb-exam-config')
    const waecNecoConfig = document.getElementById('waec-neco-exam-config')
    const subList = document.getElementById('jamb-sub-list')
    const eSub = document.getElementById('e-subject')
    
    let selectedExam = ''

    examsContainer.querySelectorAll('.exam-tier').forEach(tier => {
      tier.onclick = async () => {
        selectedExam = tier.dataset.exam
        configSection.style.display = 'block'
        configSection.scrollIntoView({ behavior: 'smooth', block: 'start' })

        if (selectedExam === 'JAMB') {
          jambConfig.style.display = 'block'
          waecNecoConfig.style.display = 'none'
          
          subList.innerHTML = '<div style="display:flex;justify-content:center;padding:1rem;grid-column:1/-1;"><div class="loader-spinner"></div></div>'
          const { data: subjects } = await DataService.getSubjects('JAMB')
          const filtered = subjects.filter(s => (s.subject_name || s.subject || '').toLowerCase() !== 'use of english')
          
          subList.innerHTML = filtered.map(s => {
              const name = s.subject_name || s.subject;
              return `
                  <label class="subject-checkbox-item ${this.profile.is_activated ? '' : 'locked'}">
                      <input type="checkbox" value="${name}" ${this.profile.is_activated ? '' : 'disabled'}>
                      <span>${name}</span>
                  </label>
              `
          }).join('')
        } else {
          jambConfig.style.display = 'none'
          waecNecoConfig.style.display = 'block'
          
          eSub.innerHTML = '<option>Loading...</option>'
          const { data: subjects } = await DataService.getSubjects(selectedExam)
          eSub.innerHTML = subjects.map(s => `<option value="${s.subject_name || s.subject}">${s.subject_name || s.subject}</option>`).join('')
        }
      }
    })

    if (closeBtn) closeBtn.onclick = () => configSection.style.display = 'none'

    startBtn.onclick = async () => {
      if (selectedExam === 'JAMB') {
        const selected = Array.from(subList.querySelectorAll('input:checked')).map(i => i.value)
        if (selected.length !== 3) return alert('Please select exactly 3 subjects to accompany Use of English.')
        
        startBtn.innerHTML = '<div class="loader-spinner" style="width:20px;height:20px;"></div> Preparing 4-Subject Set...'
        startBtn.disabled = true
        
        const fullLoad = ['Use of English', ...selected]
        const allQuestions = []
        
        try {
          for (const s of fullLoad) {
            const limit = s === 'Use of English' ? 60 : 40
            const { data } = await DataService.getPracticeQuestions(s, '', limit)
            allQuestions.push(...data)
          }
          this.onStartExam(allQuestions, 'exam', 'Full Set', 'JAMB')
        } catch (err) {
          alert("Failed to gather questions. Check connection.")
          startBtn.innerHTML = 'Begin Full Mock Exam'
          startBtn.disabled = false
        }
      } else {
        const subject = eSub.value
        const type = document.getElementById('e-type').value
        const limit = selectedExam === 'WAEC' ? 50 : 60
        
        startBtn.innerHTML = '<div class="loader-spinner" style="width:20px;height:20px;"></div> Preparing Mock...'
        startBtn.disabled = true
        
        try {
          const { data: questions } = await DataService.getPracticeQuestions(subject, '', limit)
          this.onStartExam(questions, 'exam', subject, selectedExam)
        } catch (err) {
          alert("Preparation failed.")
          startBtn.innerHTML = 'Begin Full Mock Exam'
          startBtn.disabled = false
        }
      }
    }
  },

  hide() {
    const container = document.getElementById('exams-container')
    if (container) container.style.display = 'none'
  }
}
