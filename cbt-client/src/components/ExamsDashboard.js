import { DataService } from '../services/data'
import { SubscriptionService } from '../services/subscriptionService'
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
      <div class="container animate-fadeIn" style="width: 100%; max-width: 1200px; padding: 1.5rem 1rem; box-sizing: border-box;">
        <header style="margin-bottom: 2rem; display: flex; align-items: center; gap: 1rem; flex-wrap: wrap;">
          <button id="exams-back-btn" class="btn-secondary" style="width: 40px; height: 40px; padding: 0; border-radius: 50%; display: flex; align-items: center; justify-content: center;" title="Back">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          </button>
          <div style="flex: 1; min-width: 200px;">
            <h1 style="font-family: 'Outfit'; font-size: 1.5rem; font-weight: 900; color: var(--text-primary); margin: 0;">Standard Mock Exams</h1>
            <p style="color: var(--text-secondary); font-size: 0.85rem; line-height: 1.4;">Simulate real exam conditions.</p>
          </div>
        </header>

        <div class="dashboard-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.5rem; width: 100%;">
          ${ExamCard({
            title: 'JAMB Mock',
            description: '180 questions timed simulation',
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
        <div id="exam-config" class="glass card scale-in" style="display: none; margin-top: 1.25rem; padding: 1.25rem; max-width: 800px; margin-left: auto; margin-right: auto; width: 100%; box-sizing: border-box;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem; gap: 1rem;">
            <div>
              <h3 id="exam-title" style="font-family: 'Outfit'; font-weight: 800; font-size: 1.15rem; color: var(--accent-secondary);">Setup Mock Exam</h3>
              <p style="font-size: 0.8rem; color: var(--text-secondary); line-height: 1.4;">Select subjects for simulation.</p>
            </div>
            <button id="close-exam-config" class="btn-secondary" style="width: 36px; height: 36px; border-radius: 50%; padding: 0; min-width: auto;">&times;</button>
          </div>
          
          <div id="jamb-exam-config" style="display: none;">
              <p style="margin-bottom: 1rem; color: var(--accent-secondary); font-weight: 600; font-size: 0.9rem;">English + 3 additional subjects.</p>
              <div id="jamb-sub-list" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 0.75rem; max-height: 250px; overflow-y: auto; padding: 1rem; background: rgba(0,0,0,0.2); border-radius: 12px; border: 1px solid var(--glass-border); width: 100%; box-sizing: border-box;">
                 <div class="loader-spinner"></div>
              </div>
          </div>

          <div id="waec-neco-exam-config" style="display: none;">
              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
                  <div>
                      <label style="display: block; font-size: 0.85rem; margin-bottom: 0.5rem; font-weight: 700;">Subject</label>
                      <select id="e-subject" class="glass-select" style="width: 100%; height: 48px; border-radius: 10px; border: 1.5px solid var(--glass-border); background: var(--card-bg); color: var(--text-primary); padding: 0 0.75rem;"></select>
                  </div>
                  <div>
                      <label style="display: block; font-size: 0.85rem; margin-bottom: 0.5rem; font-weight: 700;">Format</label>
                      <select id="e-type" class="glass-select" style="width: 100%; height: 48px; border-radius: 10px; border: 1.5px solid var(--glass-border); background: var(--card-bg); color: var(--text-primary); padding: 0 0.75rem;">
                          <option value="objective">Objective</option>
                          <option value="theory">Theory (AI Graded)</option>
                      </select>
                  </div>
              </div>
          </div>

          <button id="e-start-btn" class="btn-dominant" style="margin-top: 2rem; width: 100%; height: 50px; background: var(--accent-gradient);">Begin Mock Exam</button>
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
          subList.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:2rem;"><div class="loader-spinner"></div></div>'
          const { data: subjects } = await DataService.getSubjects()
          const filtered = subjects.filter(s => {
              const name = (s.subject_name || '').toLowerCase();
              return name !== 'use of english' && name !== 'english language' && name !== 'english';
          })
          
          // 🔥 MOBILE FIX: Use a more robust grid with larger touch targets
          subList.innerHTML = filtered.map(s => `
              <label style="display:flex; align-items:center; gap:0.75rem; font-size:0.9rem; padding:0.85rem; background:rgba(255,255,255,0.05); border:1px solid var(--glass-border); border-radius:12px; cursor:pointer; user-select:none; transition:all 0.2s;">
                  <input type="checkbox" value="${s.subject_name}" style="width:20px; height:20px; accent-color:var(--accent-secondary); cursor:pointer;">
                  <span style="font-weight:600; color:var(--text-primary);">${s.subject_name}</span>
              </label>
          `).join('')

          // Add click feedback for labels
          subList.querySelectorAll('label').forEach(lbl => {
              const input = lbl.querySelector('input');
              lbl.onclick = (e) => {
                  if (e.target !== input) {
                      // Only toggle if we are not at the limit OR we are unchecking
                      const checkedCount = subList.querySelectorAll('input:checked').length;
                      if (!input.checked && checkedCount >= 3) {
                          alert('You can only select exactly 3 subjects. English is automatically included.');
                          return;
                      }
                      input.checked = !input.checked;
                  } else {
                      // Check limit if clicked directly on input
                      const checkedCount = subList.querySelectorAll('input:checked').length;
                      if (input.checked && checkedCount > 3) {
                          input.checked = false;
                          alert('You can only select exactly 3 subjects. English is automatically included.');
                          return;
                      }
                  }
                  lbl.style.background = input.checked ? 'rgba(139, 92, 246, 0.1)' : 'rgba(255,255,255,0.05)';
                  lbl.style.borderColor = input.checked ? 'var(--accent-secondary)' : 'var(--glass-border)';
              }
          });
        } else {
          jambConfig.style.display = 'none'
          waecNecoConfig.style.display = 'block'
          eSub.innerHTML = '<option>Loading...</option>'
          const { data: subjects } = await DataService.getSubjects()
          eSub.innerHTML = subjects.map(s => `<option value="${s.subject_name}">${s.subject_name}</option>`).join('')
        }
      }
    })

    if (closeBtn) closeBtn.onclick = () => configSection.style.display = 'none'

    startBtn.onclick = async () => {
      // Fetch system config for subscription check
      const { data: configs } = await DataService.getGlobalConfigs(['exams_free_access'])
      const systemConfig = { exams_free_access: false }
      if (configs) {
        configs.forEach(c => {
          if (c.key === 'exams_free_access') systemConfig.exams_free_access = c.value === true || c.value === 'true'
        })
      }

      if (!SubscriptionService.canStartSession(this.profile, 'exam', systemConfig)) {
        return alert("Daily exam limit reached. Upgrade to Premium for unlimited mock exams!")
      }

      if (selectedExam === 'JAMB') {
        const selected = Array.from(subList.querySelectorAll('input:checked')).map(i => i.value)
        if (selected.length !== 3) return alert('Select exactly 3 subjects.')
        
        startBtn.innerHTML = 'Preparing...'; startBtn.disabled = true
        const fullLoad = ['Use of English', ...selected]
        console.log("Starting JAMB Exam with subjects:", fullLoad)
        const allQuestions = []
        
        try {
          for (const s of fullLoad) {
            const limit = s === 'Use of English' ? 60 : 40
            const { data, error } = await DataService.getPracticeQuestions(s, '', limit, 'JAMB')
            if (error) throw new Error(error);
            if (data) allQuestions.push(...data)
          }

          if (allQuestions.length === 0) {
            throw new Error("No questions found for the selected subjects");
          }

          this.onStartExam(allQuestions, 'exam', 'Full Mock', 'JAMB', fullLoad)
        } catch (err) {
          console.error("JAMB Load Failed:", err)
          alert(`Error loading questions: ${err.message || 'Connection failed'}. Please check your internet and try again.`)
          startBtn.innerHTML = 'Begin Mock Exam'; startBtn.disabled = false
        }
      } else {
        const subject = eSub.value
        startBtn.innerHTML = 'Preparing...'; startBtn.disabled = true
        try {
          const { data: questions, error } = await DataService.getPracticeQuestions(subject, '', selectedExam === 'WAEC' ? 50 : 60, selectedExam)
          if (error) throw new Error(error);
          
          if (!questions || questions.length === 0) {
            throw new Error(`No ${selectedExam} questions found for ${subject}`);
          }

          this.onStartExam(questions, 'exam', subject, selectedExam)
        } catch (err) {
          console.error("Exam Load Failed:", err)
          alert(`Error loading questions: ${err.message || 'Failed'}. Please check your internet and try again.`)
          startBtn.innerHTML = 'Begin Mock Exam'; startBtn.disabled = false
        }
      }
    }

    const backBtn = document.getElementById('exams-back-btn')
    if (backBtn) backBtn.onclick = () => window.navigateTo('dashboard')
  },

  hide() {
    const container = document.getElementById('exams-container')
    if (container) container.style.display = 'none'
  }
}
