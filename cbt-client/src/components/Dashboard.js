import { DataService } from '../services/data'
import { AuthService } from '../services/auth'
import { WeeklyRecapComponent } from './WeeklyRecap'

export const DashboardComponent = {
  profile: null,
  onStartExam: null,

  async render(profile, onStartExam, onOpenAdmin) {
    this.profile = profile
    this.onStartExam = onStartExam
    this.onOpenAdmin = onOpenAdmin
    const container = document.getElementById('dashboard-container')
    container.style.display = 'block'
    
    container.innerHTML = `
      <header class="flex-between" style="padding: 1.5rem 0; border-bottom: 1px solid var(--glass-border);">
        <h1 style="font-family: 'Outfit'; font-size: 1.5rem; color: var(--accent-primary);">CBT Elite</h1>

        <div style="display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 1rem;">
          <button id="theme-toggle" class="glass" style="padding: 0; font-size: 1.25rem; border-radius: 50%; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center;">🌓</button>
          ${(profile.role !== 'student' || profile.username === 'tester') ? '<button id="admin-panel-btn" class="btn-admin">Admin Control</button>' : ''}
          <div style="display: flex; gap: 1rem; align-items: center;">
            <span style="font-size: 0.875rem;">Welcome, <strong>${profile.username}</strong></span>
            <button id="logout-btn" class="btn-secondary" style="padding: 0.5rem 1rem; font-size: 0.875rem;">Logout</button>
          </div>
        </div>
      </header>

      <div id="dashboard-content" style="margin-top: 2rem;">
        <div class="dashboard-tabs" style="display: flex; gap: 1rem; margin-bottom: 2rem;">
          <button id="view-practice" class="nav-tab active" style="flex: 1;">🎯 Practice Mode</button>
          <button id="view-exam" class="nav-tab" style="flex: 1;">🏆 Exam Mode</button>
        </div>

        <!-- Practice Mode Section -->
        <div id="practice-section">
          <h2 style="font-family: 'Outfit'; font-size: 1.25rem; margin-bottom: 1rem;">Choose Your Exam Type</h2>
          <div class="dashboard-grid">

            <div class="glass card practice-tier" data-exam="JAMB" style="border-top: 4px solid var(--accent-primary); cursor: pointer;">

              <h3>JAMB Practice</h3>
              <p style="font-size: 0.875rem;">Topic-based objective practice</p>
            </div>
            <div class="glass card practice-tier" data-exam="WAEC" style="border-top: 4px solid var(--accent-secondary); cursor: pointer;">
              <h3>WAEC Practice</h3>
              <p style="font-size: 0.875rem;">Objective & Theory support</p>
            </div>
            <div class="glass card practice-tier" data-exam="NECO" style="border-top: 4px solid var(--success); cursor: pointer;">
              <h3>NECO Practice</h3>
              <p style="font-size: 0.875rem;">Objective & Theory support</p>
            </div>
          </div>

          <!-- Practice Config (hidden initially) -->
          <div id="practice-config" class="glass card" style="display: none; margin-top: 2rem; padding: 2rem;">
            <h3 id="practice-title" style="margin-bottom: 1.5rem;">Configure Practice</h3>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.5rem;">
              <div>
                <label style="display: block; font-size: 0.875rem; margin-bottom: 0.5rem;">Subject</label>
                <select id="p-subject" class="glass-select" style="width: 100%;"></select>
              </div>
              <div id="p-topic-wrapper">
                <label style="display: block; font-size: 0.875rem; margin-bottom: 0.5rem;">Topic</label>
                <select id="p-topic" class="glass-select" style="width: 100%;">
                  <option value="">All Topics</option>
                </select>
              </div>
              <div id="p-type-wrapper" style="display: none;">
                <label style="display: block; font-size: 0.875rem; margin-bottom: 0.5rem;">Question Type</label>
                <select id="p-type" class="glass-select" style="width: 100%;">
                  <option value="objective">Objective</option>
                  <option value="theory">Theory</option>
                </select>
              </div>
            </div>
            <button id="p-start-btn" class="primary" style="margin-top: 2rem; width: 100%;">Start Practice Session</button>
          </div>
        </div>

        <!-- Exam Mode Section -->
        <div id="exam-section" style="display: none;">
          <h2 style="font-family: 'Outfit'; font-size: 1.25rem; margin-bottom: 1rem;">Structured Mock Exams</h2>
          <div class="dashboard-grid">
            <div class="glass card exam-tier" data-exam="JAMB" style="border-top: 4px solid var(--accent-primary); cursor: pointer;">
              <h3>JAMB Mock</h3>
              <p style="font-size: 0.875rem; color: #ffffff;">180 Questions | 120 Mins</p>
            </div>
            <div class="glass card exam-tier" data-exam="WAEC" style="border-top: 4px solid var(--accent-secondary); cursor: pointer;">
              <h3>WAEC Mock</h3>
              <p style="font-size: 0.875rem; color: #ffffff;">Standard Full Exam</p>
            </div>
            <div class="glass card exam-tier" data-exam="NECO" style="border-top: 4px solid var(--success); cursor: pointer;">
              <h3>NECO Mock</h3>
              <p style="font-size: 0.875rem; color: #ffffff;">Standard Full Exam</p>
            </div>
          </div>

          <!-- Exam Config -->
          <div id="exam-config" class="glass card" style="display: none; margin-top: 2rem; padding: 2rem;">
            <h3 id="exam-title" style="margin-bottom: 1.5rem;">Setup Mock Exam</h3>
            
            <div id="jamb-exam-config" style="display: none;">
                <p style="margin-bottom: 1rem; color: var(--accent-primary);">English is mandatory. Select 3 additional subjects.</p>
                <div id="jamb-sub-list" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; max-height: 200px; overflow-y: auto; padding: 1rem; background: var(--surface-color); border-radius: 8px;">
                    <!-- Checkboxes for subjects -->
                </div>
            </div>

            <div id="waec-neco-exam-config" style="display: none;">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
                    <div>
                        <label style="display: block; font-size: 0.875rem; margin-bottom: 0.5rem;">Subject</label>
                        <select id="e-subject" class="glass" style="width: 100%; padding: 0.5rem;"></select>
                    </div>
                    <div>
                        <label style="display: block; font-size: 0.875rem; margin-bottom: 0.5rem;">Type</label>
                        <select id="e-type" class="glass" style="width: 100%; padding: 0.5rem;">
                            <option value="objective">Objective</option>
                            <option value="theory">Theory</option>
                        </select>
                    </div>
                </div>
            </div>

            <button id="e-start-btn" class="primary" style="margin-top: 2rem; width: 100%;">Begin Mock Exam</button>
          </div>
        </div>

        <!-- Saved & Rankings -->
        <div class="dashboard-grid" style="margin-top: 3rem;">
          <div class="glass card" style="border-left: 4px solid var(--accent-primary);">
            <h3>Saved Questions</h3>
            <div id="bookmark-count" style="font-size: 1.5rem; font-weight: bold; margin: 1rem 0;">0</div>
            <button class="glass" id="start-saved" disabled>Review Saved</button>
          </div>
          <div class="glass card" style="border-left: 4px solid var(--success);">
            <h3>Leadership</h3>
            <p style="margin: 1rem 0; font-size: 0.875rem; color: #ffffff;">See how you rank globally</p>
            <button class="glass" id="view-leaderboard">View Ranking</button>
          </div>
        </div>

        <!-- Phase 3: Analytics Section -->
        <div id="analytics-section" style="margin-top: 3rem;">
          <h2 style="font-family: 'Outfit'; font-size: 1.25rem; margin-bottom: 1.5rem; display: flex; align-items: center; gap: 0.5rem;">
            📊 Performance Insights
          </h2>
          <div class="analytics-grid">
            <div class="glass card" style="padding: 1.5rem;">
              <h4 style="margin-bottom: 1rem; color: var(--accent-primary);">Score History (Last 20 Sessions)</h4>
              <canvas id="score-history-chart" height="250"></canvas>
            </div>
            <div class="glass card" style="padding: 1.5rem;">
              <h4 style="margin-bottom: 1rem; color: var(--success);">Subject Mastery (%)</h4>
              <canvas id="subject-mastery-chart" height="250"></canvas>
            </div>
          </div>
        </div>
      </div>
    `


    // Siding Tabs Setup
    const pSec = document.getElementById('practice-section')
    const eSec = document.getElementById('exam-section')
    const pTab = document.getElementById('view-practice')
    const eTab = document.getElementById('view-exam')

    pTab.onclick = () => {
        pTab.classList.add('active'); eTab.classList.remove('active')
        pSec.style.display = 'block'; eSec.style.display = 'none'
    }

    eTab.onclick = () => {
        eTab.classList.add('active'); pTab.classList.remove('active')
        eSec.style.display = 'block'; pSec.style.display = 'none'
    }

    // Generic UI listeners
    document.getElementById('theme-toggle').onclick = () => {
      document.body.classList.toggle('light-mode')
      localStorage.setItem('theme', document.body.classList.contains('light-mode') ? 'light' : 'dark')
    }

    document.getElementById('logout-btn').onclick = async () => {
      await AuthService.signOut()
      location.reload()
    }

    if (document.getElementById('admin-panel-btn')) {
      document.getElementById('admin-panel-btn').onclick = () => this.onOpenAdmin()
    }

    // State for selections
    let selectedPracticeExam = null
    let selectedExamExam = null
    let allSubjects = []
    let allExams = []

    // Practice Config Toggling
    const pConfig = document.getElementById('practice-config')

    document.querySelectorAll('.practice-tier').forEach(tier => {

        tier.onclick = () => {
            selectedPracticeExam = tier.dataset.exam
            pConfig.style.display = 'block'
            document.getElementById('practice-title').textContent = `Structured ${selectedPracticeExam} Practice`
            document.getElementById('p-type-wrapper').style.display = (selectedPracticeExam === 'JAMB') ? 'none' : 'block'
            document.getElementById('p-topic-wrapper').style.display = (selectedPracticeExam === 'JAMB') ? 'block' : 'none'
            pConfig.scrollIntoView({ behavior: 'smooth' })
        }
    })

    // Exam Config Toggling
    const eConfig = document.getElementById('exam-config')
    document.querySelectorAll('.exam-tier').forEach(tier => {
        tier.onclick = () => {
            selectedExamExam = tier.dataset.exam
            eConfig.style.display = 'block'
            document.getElementById('exam-title').textContent = `${selectedExamExam} Mock Exam Setup`
            document.getElementById('jamb-exam-config').style.display = (selectedExamExam === 'JAMB') ? 'block' : 'none'
            document.getElementById('waec-neco-exam-config').style.display = (selectedExamExam === 'JAMB') ? 'none' : 'block'
            eConfig.scrollIntoView({ behavior: 'smooth' })
        }
    })

    // Fetch dynamic data
    const initData = async () => {
      try {
        const { data: examsRes } = await DataService.getExams()
        const { data: subjectsRes } = await DataService.getSubjects()
        allExams = examsRes || []
        allSubjects = subjectsRes || []

        const pSub = document.getElementById('p-subject')
        const eSub = document.getElementById('e-subject')
        const jambList = document.getElementById('jamb-sub-list')

        allSubjects.forEach(s => {
            const opt = new Option(s.subject_name, s.id)
            pSub.appendChild(opt.cloneNode(true))
            eSub.appendChild(opt)

            if (s.subject_name.toLowerCase() !== 'english') {
                const label = document.createElement('label')
                label.style.display = 'flex'; label.style.alignItems = 'center'; label.style.gap = '0.5rem'; label.style.fontSize = '0.8rem';
                label.innerHTML = `<input type="checkbox" class="jamb-sub-check" value="${s.id}" data-name="${s.subject_name}"> ${s.subject_name}`
                jambList.appendChild(label)
            }
        })

        // Topic loader for JAMB Practice
        pSub.onchange = async () => {
            if (selectedPracticeExam === 'JAMB') {
                const { data: topics } = await DataService.getTopics(pSub.value)
                const pTopic = document.getElementById('p-topic')
                pTopic.innerHTML = '<option value="">All Topics</option>'
                topics.forEach(t => pTopic.appendChild(new Option(t, t)))
            }
        }

        // Start Practice
        document.getElementById('p-start-btn').onclick = async () => {
            const subjectId = pSub.value
            const type = document.getElementById('p-type').value
            const topic = document.getElementById('p-topic').value
            if (!subjectId) return alert("Select a subject first")

            // Phase 17: Practice sessions
            const limit = type === 'theory' ? 3 : 25 
            const btn = document.getElementById('p-start-btn')
            btn.textContent = 'Preparing Session...'

            try {
                const { data: questions, error } = await DataService.getQuestions({
                    subject_id: subjectId,
                    exam_type: selectedPracticeExam,
                    topic: topic || undefined,
                    question_type: type,
                    limit: limit,
                    randomize: true
                })

                if (error) throw error

                btn.textContent = 'Start Practice Session'
                if (questions && questions.length > 0) {
                    this.onStartExam(questions, 'practice', pSub.options[pSub.selectedIndex].text, selectedPracticeExam)
                } else {
                    alert("No questions found for this selection.")
                }
            } catch (err) {
                console.error("Practice Start Error:", err)
                btn.textContent = 'Start Practice Session'
                alert("An error occurred while preparing the session. Please try again.")
            }
        }

        // Start Mock Exam
        document.getElementById('e-start-btn').onclick = async () => {
            const btn = document.getElementById('e-start-btn')
            btn.textContent = 'Constructing Mock...'

            if (selectedExamExam === 'JAMB') {
                const checks = document.querySelectorAll('.jamb-sub-check:checked')
                if (checks.length !== 3) return alert("Please select exactly 3 additional subjects for JAMB.")
                
                const english = allSubjects.find(s => s.subject_name.toLowerCase() === 'english')
                const subjects = [{ id: english.id, name: 'English', limit: 60 }]
                checks.forEach(c => subjects.push({ id: c.value, name: c.dataset.name, limit: 40 }))

                try {
                    let allQ = []
                    for (const sub of subjects) {
                        const { data, error } = await DataService.getQuestions({ subject_id: sub.id, exam_type: 'JAMB', limit: sub.limit, randomize: true })
                        if (error) throw error
                        if (data) allQ = [...allQ, ...data]
                    }
                    
                    btn.textContent = 'Begin Mock Exam'
                    if (allQ.length > 0) this.onStartExam(allQ, 'exam', 'Full Mock', 'JAMB')
                    else alert("Could not fetch exam questions.")
                } catch (err) {
                    console.error("JAMB Start Error:", err)
                    btn.textContent = 'Begin Mock Exam'
                    alert("Failed to construct the mock exam. Please verify your connection.")
                }

            } else {
                // WAEC / NECO
                const subId = eSub.value
                const type = document.getElementById('e-type').value
                if (!subId) return alert("Select a subject")

                // Phase 17: WAEC / NECO Exam sessions
                const limit = type === 'theory' ? 5 : 40 
                try {
                    const { data: questions, error } = await DataService.getQuestions({
                        subject_id: subId,
                        exam_type: selectedExamExam,
                        question_type: type,
                        limit: limit,
                        randomize: true
                    })

                    if (error) throw error

                    btn.textContent = 'Begin Mock Exam'
                    if (questions && questions.length > 0) {
                        this.onStartExam(questions, 'exam', eSub.options[eSub.selectedIndex].text, selectedExamExam)
                    } else {
                        alert("No questions found.")
                    }
                } catch (err) {
                    console.error("Mock Start Error:", err)
                    btn.textContent = 'Begin Mock Exam'
                    alert("Failed to prepare the mock exam. Please verify your connection.")
                }
            }
        }

        // Bookmarks
        const { count: bCount } = await DataService.getBookmarkCount(profile.id)
        if (document.getElementById('bookmark-count')) document.getElementById('bookmark-count').textContent = bCount || 0
        if (bCount > 0) {
            const bBtn = document.getElementById('start-saved')
            bBtn.disabled = false
            bBtn.onclick = async () => {
                const { data } = await DataService.getBookmarks(profile.id)
                if (data) this.onStartExam(data, 'saved', 'Saved Questions', 'Collection')
            }
        }

        // Leaderboard
        document.getElementById('view-leaderboard').onclick = async () => {
            const { data } = await DataService.getLeaderboard()
            if (data) alert("Leaderboard feature active! Top player: " + (data[0]?.users?.username || 'N/A'))
        }

        // Phase 3: Charts
        this.renderCharts(profile.id)

      } catch (err) {
        console.error("Dashboard init error:", err)
      }
    }

    initData()
  },

  async renderCharts(userId) {
    const { data: profile } = await DataService.getProfile(userId)

    const { history, mastery, error } = await DataService.getUserAnalytics(userId)

    if (error) return

    // 1. Score History Chart
    const historyCtx = document.getElementById('score-history-chart').getContext('2d')
    new Chart(historyCtx, {
      type: 'line',
      data: {
        labels: history.map((_, i) => i + 1),
        datasets: [{
          label: 'Score %',
          data: history.map(h => h.score_percentage),
          borderColor: '#4caf50',
          backgroundColor: 'rgba(76, 175, 80, 0.1)',
          fill: true,
          tension: 0.4,
          borderWidth: 3,
          pointRadius: 4,
          pointBackgroundColor: '#fff'
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, max: 100, grid: { color: 'rgba(255,255,255,0.05)' }, border: { display: false } },
          x: { grid: { display: false }, border: { display: false } }
        }
      }
    })

    // 2. Subject Mastery Chart
    const masteryCtx = document.getElementById('subject-mastery-chart').getContext('2d')
    new Chart(masteryCtx, {
      type: 'radar',
      data: {
        labels: mastery.map(m => m.subject),
        datasets: [{
          label: 'Mastery %',
          data: mastery.map(m => m.average),
          backgroundColor: 'rgba(33, 150, 243, 0.2)',
          borderColor: '#2196f3',
          borderWidth: 2,
          pointBackgroundColor: '#2196f3'
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          r: {
            angleLines: { color: 'rgba(255,255,255,0.1)' },
            grid: { color: 'rgba(255,255,255,0.1)' },
            pointLabels: { color: '#ffffff', font: { size: 10 } },
            ticks: { display: false },
            suggestedMin: 0,
            suggestedMax: 100
          }
        }
      }
    })
  },

  hide() {
    document.getElementById('dashboard-container').style.display = 'none'
  }
}


