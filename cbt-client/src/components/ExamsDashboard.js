import { DataService } from '../services/data'
import { supabase } from '../utils/supabase'
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
              
              <div id="combo-templates" style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 1.5rem;">
                <span style="font-size: 0.7rem; color: var(--text-secondary); width: 100%; font-weight: 800; text-transform: uppercase;">Quick Select Combo</span>
                <button class="combo-btn glass" data-combo="Physics,Chemistry,Biology" style="padding: 0.5rem 0.85rem; font-size: 0.75rem; font-weight: 700; border-radius: 8px;">Medicine/Science</button>
                <button class="combo-btn glass" data-combo="Mathematics,Physics,Chemistry" style="padding: 0.5rem 0.85rem; font-size: 0.75rem; font-weight: 700; border-radius: 8px;">Engineering</button>
                <button class="combo-btn glass" data-combo="Literature,Government,CRS" style="padding: 0.5rem 0.85rem; font-size: 0.75rem; font-weight: 700; border-radius: 8px;">Law/Arts</button>
                <button class="combo-btn glass" data-combo="Economics,Government,Mathematics" style="padding: 0.5rem 0.85rem; font-size: 0.75rem; font-weight: 700; border-radius: 8px;">Social Sciences</button>
                <button class="combo-btn glass" data-combo="Mathematics,Economics,Financial Accounting" style="padding: 0.5rem 0.85rem; font-size: 0.75rem; font-weight: 700; border-radius: 8px;">Commercial</button>
              </div>

              <div id="jamb-sub-list" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 0.75rem; max-height: 250px; overflow-y: auto; padding: 1rem; background: rgba(0,0,0,0.2); border-radius: 12px; border: 1px solid var(--glass-border); width: 100%; box-sizing: border-box;">
                 <div class="loader-spinner"></div>
              </div>
          </div>

          <div id="waec-neco-exam-config" style="display: none;">
              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
                  <div>
                      <label for="e-subject" style="display: block; font-size: 0.85rem; margin-bottom: 0.5rem; font-weight: 700;">Subject</label>
                      <select id="e-subject" class="glass-select" style="width: 100%; height: 48px; border-radius: 10px; border: 1.5px solid var(--glass-border); background: var(--card-bg); color: var(--text-primary); padding: 0 0.75rem;"></select>
                  </div>
                  <div>
                      <label for="e-type" style="display: block; font-size: 0.85rem; margin-bottom: 0.5rem; font-weight: 700;">Format</label>
                      <select id="e-type" class="glass-select" style="width: 100%; height: 48px; border-radius: 10px; border: 1.5px solid var(--glass-border); background: var(--card-bg); color: var(--text-primary); padding: 0 0.75rem;">
                          <option value="objective">Objective</option>
                          <option value="theory">Theory (AI Graded)</option>
                      </select>
                  </div>
              </div>
          </div>

          <button id="e-start-btn" class="btn-dominant" style="margin-top: 1.5rem; width: 100%; height: 50px; background: var(--accent-gradient); font-weight: 900; letter-spacing: 0.05em;">BLAST!</button>
          
          <div class="mobile-only" style="height: 80px; display: none;"></div>
        </div>

        <!-- Mock History Section -->
        <div id="mock-history-section" style="margin-top: 4rem;">
            <h2 style="font-family: 'Outfit'; font-weight: 900; font-size: 1.25rem; color: var(--text-primary); margin-bottom: 1.5rem; display: flex; align-items: center; gap: 0.75rem;">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8v4l3 3"/><circle cx="12" cy="12" r="10"/></svg>
                Mock Performance History
            </h2>
            <div id="mock-history-list" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1.25rem;">
                <div style="grid-column: 1/-1; padding: 2rem; text-align: center; color: var(--text-secondary); font-size: 0.9rem;">
                    Loading your mock history...
                </div>
            </div>
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

          // Handle Combo Templates
          configSection.querySelectorAll('.combo-btn').forEach(btn => {
              btn.onclick = () => {
                  const combo = btn.dataset.combo.split(',');
                  const inputs = subList.querySelectorAll('input');
                  inputs.forEach(input => {
                      input.checked = combo.includes(input.value);
                      const lbl = input.closest('label');
                      lbl.style.background = input.checked ? 'rgba(139, 92, 246, 0.1)' : 'rgba(255,255,255,0.05)';
                      lbl.style.borderColor = input.checked ? 'var(--accent-secondary)' : 'var(--glass-border)';
                  });
              };
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
      startBtn.innerHTML = 'Preparing...'; startBtn.disabled = true;

      try {
        // Fetch system config for subscription check
        const { data: configs, error: configError } = await DataService.getGlobalConfigs([
          'explanations_free_access',
          'exams_free_access',
          'ai_tutor_free_access',
          'daily_exam_limit_free', 
          'daily_exam_limit_medium'
        ])
        if (configError) throw new Error("Failed to load configuration");

        const systemConfig = {}
        if (configs) {
          configs.forEach(c => {
            systemConfig[c.key] = c.value
          })
        }

        if (!SubscriptionService.canStartSession(this.profile, 'exam', systemConfig)) {
          startBtn.innerHTML = 'Begin Mock Exam'; startBtn.disabled = false
          return alert("Daily exam limit reached. Upgrade to Premium for unlimited mock exams!")
        }

        if (selectedExam === 'JAMB') {
          const selected = Array.from(subList.querySelectorAll('input:checked')).map(i => i.value)
          if (selected.length !== 3) {
            startBtn.innerHTML = 'Begin Mock Exam'; startBtn.disabled = false
            return alert('Select exactly 3 subjects.')
          }
          
          const fullLoad = ['Use of English', ...selected]
          console.log("Starting JAMB Exam with subjects:", fullLoad)
          const allQuestions = []
          
          startBtn.innerHTML = 'Loading Mocks...';
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
        } else {
          const subject = eSub.value
          const { data: questions, error } = await DataService.getPracticeQuestions(subject, '', selectedExam === 'WAEC' ? 50 : 60, selectedExam)
          if (error) throw new Error(error);
          
          if (!questions || questions.length === 0) {
            throw new Error(`No ${selectedExam} questions found for ${subject}`);
          }

          this.onStartExam(questions, 'exam', subject, selectedExam)
        }
      } catch (err) {
        console.error("Exam Load Failed:", err)
        alert(`Error loading questions: ${err.message || 'Connection failed'}. Please check your internet and try again.`)
        startBtn.innerHTML = 'Begin Mock Exam'; startBtn.disabled = false
      }
    }

    const backBtn = document.getElementById('exams-back-btn')
    if (backBtn) backBtn.onclick = () => window.navigateTo('dashboard')

    this.loadHistory()
  },

  async loadHistory() {
    const list = document.getElementById('mock-history-list')
    if (!list) return

    const { data: history, error } = await DataService.getMockHistory(this.profile.id, 'JAMB')
    if (error || !history || history.length === 0) {
        list.innerHTML = `
            <div style="grid-column: 1/-1; padding: 3rem; text-align: center; background: rgba(255,255,255,0.02); border-radius: 20px; border: 1px dashed var(--glass-border);">
                <p style="color: var(--text-secondary); font-size: 0.95rem; font-weight: 500;">No full mock sessions found yet.</p>
                <p style="color: var(--text-secondary); font-size: 0.8rem; margin-top: 0.5rem;">Complete a 180-question simulation to see your history here.</p>
            </div>
        `
        return
    }

    list.innerHTML = history.map(session => {
        const date = new Date(session.completed_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });
        const score = session.score_percentage || 0;
        const color = score >= 70 ? 'var(--success)' : score >= 50 ? 'var(--accent-primary)' : 'var(--error)';
        
        return `
            <div class="glass card scale-in" style="padding: 1.5rem; border-left: 4px solid ${color};">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
                    <span style="font-size: 0.7rem; font-weight: 800; color: var(--text-secondary); text-transform: uppercase;">${date}</span>
                    <span style="font-size: 0.8rem; font-weight: 900; color: ${color}; background: rgba(255,255,255,0.05); padding: 2px 8px; border-radius: 4px;">${score}%</span>
                </div>
                <h4 style="font-family: 'Outfit'; font-size: 1.1rem; color: var(--text-primary); margin: 0 0 0.5rem 0;">JAMB Mock Session</h4>
                <div style="font-size: 0.75rem; color: var(--text-secondary); display: flex; align-items: center; gap: 0.5rem;">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                    <span>${session.total_questions} Questions • ${Math.round(session.time_spent / 60)} mins</span>
                </div>
            </div>
        `
    }).join('')
  },

  hide() {
    const container = document.getElementById('exams-container')
    if (container) container.style.display = 'none'
  }
}
