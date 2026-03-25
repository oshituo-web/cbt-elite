import { DataService } from '../services/data'
import { supabase } from '../utils/supabase'

export const AdminComponent = {
  render(profile, onBack) {
    const container = document.getElementById('admin-container')
    container.style.display = 'block'
    container.innerHTML = `
      <header style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; padding: 1.5rem 0; border-bottom: 2px solid var(--accent-primary);">
        <h1 style="font-family: 'Outfit'; font-size: 1.5rem;">Admin Control Panel</h1>
        <div style="display: flex; gap: 1rem; align-items: center; flex-wrap: wrap;">
          <button id="admin-back-home" class="btn-secondary">← Back to Dashboard</button>
          <span>Logged as: <strong>${profile.role}</strong></span>
        </div>
      </header>

      <div id="admin-grid" class="admin-layout-grid" style="margin-top: 2rem;">
        <nav id="admin-nav" class="admin-nav">
          <button class="nav-tab active" data-tab="questions">Manage Questions</button>
          <button class="nav-tab" data-tab="syllabus">Manage Syllabus</button>
          <button class="nav-tab" data-tab="users">Manage Users</button>
          <button class="nav-tab" data-tab="reports">Question Reports</button>
          <button class="nav-tab" data-tab="analytics" style="color: var(--accent-primary);">📈 Platform Analytics</button>
        </nav>
        
        <main id="admin-main">
          <!-- Analytics Tab (Phase 3) -->
          <div id="admin-analytics-tab" style="display: none;">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; margin-bottom: 2rem;">
              <h2>Platform Analytics</h2>
              <div id="analytics-refresh" class="btn-secondary" style="padding: 0.5rem 1rem; cursor: pointer; font-size: 0.8rem;">Refresh Data</div>
            </div>
            <div id="analytics-summary" class="admin-stats-grid" style="margin-bottom: 2rem;">
              <!-- Quick Stats Cards -->
            </div>
            <div class="glass card" style="padding: 2rem;">
              <h3 style="margin-bottom: 1.5rem;">Global Score Distribution</h3>
              <canvas id="global-scores-chart" height="300"></canvas>
            </div>
          </div>

          <!-- Questions Tab -->
          <div id="admin-questions-tab">
            <div style="display: flex; flex-direction: column; gap: 1rem; margin-bottom: 2rem;">
              <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
                <h2>Database Questions</h2>
                <button id="add-question-btn" class="primary" style="padding: 0.5rem 1rem;">+ Add Question</button>
              </div>
              <div class="admin-filters-grid">
                <input type="text" id="question-search" placeholder="Search text..." class="glass-input">
                <select id="filter-exam" class="glass-select"><option value="">All Exams</option></select>
                <select id="filter-subject" class="glass-select"><option value="">All Subjects</option></select>
                <select id="filter-topic" class="glass-select"><option value="">All Topics</option></select>
              </div>
            </div>
            <div id="pagination-controls-top" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; margin-bottom: 1rem;">
              <span id="question-count-display" style="font-size: 0.875rem;"></span>
              <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
                <button id="prev-page-top" class="btn-secondary">Previous Page</button>
                <button id="next-page-top" class="btn-secondary">Next Page</button>
              </div>
            </div>
            <div id="questions-list" style="display: flex; flex-direction: column; gap: 1rem;">Loading...</div>
          </div>

          <!-- Syllabus Tab -->
          <div id="admin-syllabus-tab" style="display: none;">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; margin-bottom: 1rem;">
              <h2>Exam Syllabus</h2>
              <button id="add-syllabus-btn" class="primary">+ Add Topic</button>
            </div>
            <div id="syllabus-list">Loading...</div>
          </div>

          <!-- Users Tab -->
          <div id="admin-users-tab" style="display: none;">
            <h2>Manage Users</h2>
            <div id="users-list" style="margin-top: 1rem;">Loading...</div>
          </div>

          <!-- User Reports Tab -->
          <div id="admin-reports-tab" style="display: none;">
            <h2>Question Reports</h2>
            <div id="reports-list" style="margin-top: 1rem;">Loading...</div>
          </div>

        </main>
      </div>
    `

    this.setupEvents(onBack)
    this.loadQuestions()
  },

  async setupEvents(onBack) {
    document.getElementById('admin-back-home').onclick = onBack

    // Tab Logic
    const tabs = document.querySelectorAll('.nav-tab')
    tabs.forEach(tab => {
      tab.onclick = () => {
        tabs.forEach(t => t.classList.remove('active'))
        tab.classList.add('active')
        const target = tab.dataset.tab
        document.getElementById('admin-questions-tab').style.display = target === 'questions' ? 'block' : 'none'
        document.getElementById('admin-syllabus-tab').style.display = target === 'syllabus' ? 'block' : 'none'
        document.getElementById('admin-users-tab').style.display = target === 'users' ? 'block' : 'none'
        document.getElementById('admin-reports-tab').style.display = target === 'reports' ? 'block' : 'none'

        document.getElementById('admin-analytics-tab').style.display = target === 'analytics' ? 'block' : 'none'

        if (target === 'questions') this.loadQuestions()
        else if (target === 'syllabus') this.loadSyllabus()
        else if (target === 'users') this.loadUsers()
        else if (target === 'reports') this.loadReports()
        else if (target === 'analytics') this.loadGlobalAnalytics()
      }
    })

    document.getElementById('analytics-refresh').onclick = () => this.loadGlobalAnalytics()


    // Question Filters
    const search = document.getElementById('question-search')
    const exFilt = document.getElementById('filter-exam')
    const subFilt = document.getElementById('filter-subject')
    const topFilt = document.getElementById('filter-topic')

    const updateTopics = async () => {
      if (!topFilt) return // Safety check
      topFilt.innerHTML = '<option value="">All Topics</option>'
      if (subFilt.value) {
        // Find subject ID
        const { data: subjects } = await DataService.getSubjects()
        const subId = subjects.find(s => s.subject_name === subFilt.value)?.id
        
        // Find exam ID
        const { data: exams } = await DataService.getExams()
        const examId = exams.find(e => e.exam_name === exFilt.value)?.id

        if (subId) {
          const { data: topics } = await DataService.getTopics(subId, examId)
          topics.forEach(t => {
             const topicName = typeof t === 'string' ? t : t.topic
             topFilt.appendChild(new Option(topicName, topicName))
          })
        }
      }
    }

    const triggerSelectLoad = async () => {
      const { data: exams } = await DataService.getExams()
      const { data: subjects } = await DataService.getSubjects()
      
      exFilt.innerHTML = '<option value="">All Exams</option>'
      subFilt.innerHTML = '<option value="">All Subjects</option>'
      
      exams.forEach(e => exFilt.appendChild(new Option(e.exam_name, e.exam_name)))
      subjects.forEach(s => subFilt.appendChild(new Option(s.subject_name, s.subject_name)))
    }
    triggerSelectLoad()

    const triggerFilter = () => {
      this.loadQuestions({
        search: search.value || undefined,
        exam_type: exFilt.value || undefined,
        subject: subFilt.value || undefined,
        topic: topFilt.value || undefined
      })
    }

    search.oninput = triggerFilter
    exFilt.onchange = async () => {
      await updateTopics()
      triggerFilter()
    }
    subFilt.onchange = async () => {
      await updateTopics()
      triggerFilter()
    }
    topFilt.onchange = triggerFilter

  },



  async loadQuestions(filters = {}, offset = 0) {
    const list = document.getElementById('questions-list')
    const counter = document.getElementById('question-count-display')
    list.innerHTML = 'Loading questions...'
    
    const { data: questions, count, error } = await DataService.getQuestions({ ...filters, offset, limit: 20 })
    
    if (error) {
      list.innerHTML = `<div style="color: var(--error);">Failed to load questions: ${error.message || error}</div>`
      counter.textContent = "Error loading"
      return
    }

    if (!questions || questions.length === 0) {
      list.innerHTML = '<div style="color: #888; text-align: center; padding: 2rem;">No questions found.</div>'
      counter.innerHTML = `<span style="font-size: 1.1rem; font-weight: 700; color: var(--accent-primary);">Total Questions: 0</span>`
      return
    }

    counter.innerHTML = `
      <div style="background: rgba(59, 130, 246, 0.1); padding: 0.5rem 1rem; border-radius: 8px; border-left: 4px solid var(--accent-primary);">
        <span style="font-size: 1.1rem; font-weight: 800; color: #ffffff;">Total Questions: ${count || 0}</span>
        <span style="font-size: 0.8rem; color: #ffffff; margin-left: 1rem;">(Showing 20)</span>
      </div>
    `
    
    list.innerHTML = questions.map(q => `
      <div class="glass q-item" style="padding: 1.25rem; display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem; border-left: 3px solid var(--accent-primary); margin-bottom: 0.75rem;">
        <div style="flex: 1; min-width: 0; word-break: break-word;">
          <div style="font-size: 0.95rem; font-weight: 700; margin-bottom: 0.5rem; line-height: 1.4;">${q.question_text.substring(0, 150)}...</div>
          <div style="font-size: 0.75rem; color: #ccc; display: flex; gap: 0.5rem; flex-wrap: wrap;">
            <span class="badge" style="background: rgba(255,255,255,0.1); padding: 2px 6px;">${q.exam_type}</span>
            <span class="badge" style="background: rgba(255,255,255,0.1); padding: 2px 6px;">${q.subject}</span>
            <span class="badge" style="background: rgba(255,255,255,0.1); padding: 2px 6px;">${q.topic}</span>
          </div>
        </div>
        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; flex-shrink: 0;">
          <button class="btn-secondary edit-q-btn" data-id="${q.id}" style="padding: 0.4rem 0.8rem; font-size: 0.75rem;">Edit</button>
          <button class="btn-secondary delete-q-btn" data-id="${q.id}" style="padding: 0.4rem 0.8rem; font-size: 0.75rem; color: #ff6b6b; border-color: rgba(255, 107, 107, 0.3);">Delete</button>
        </div>
      </div>
    `).join('')

    // Attach Listeners
    document.querySelectorAll('.delete-q-btn').forEach(btn => {
      btn.onclick = async () => {
        if (!confirm('Warning: Are you sure you want to permanently delete this question from the database?')) return
        const id = btn.getAttribute('data-id')
        btn.textContent = '...'
        btn.disabled = true
        const { error } = await DataService.deleteQuestion(id)
        if (error) {
          alert('Failed to delete: ' + error.message)
          btn.textContent = 'Delete'
          btn.disabled = false
        } else {
          this.loadQuestions()
        }
      }
    })

    document.querySelectorAll('.edit-q-btn').forEach(btn => {
      btn.onclick = () => {
        const id = btn.getAttribute('data-id')
        const question = questions.find(q => q.id === id)
        if (question) this.openEditModal(question)
      }
    })
  },

  openEditModal(question) {
    const modalHtml = \`
      <div id="q-edit-overlay" style="position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.8); z-index:9999; display:flex; justify-content:center; align-items:center; padding:1rem;">
        <div class="glass card" style="width: 100%; max-width: 600px; max-height: 90vh; overflow-y: auto; padding: 1.5rem; border: 1px solid var(--accent-primary);">
          <h3 style="margin-bottom: 1rem; font-family: 'Outfit';">Edit Question</h3>
          <p style="font-size: 0.8rem; color: #aaa; margin-bottom: 0.5rem;">Question Text</p>
          <textarea id="edit-q-text" class="glass-input" style="width: 100%; min-height: 120px; margin-bottom: 1.5rem; font-size: 0.9rem;">\${question.question_text}</textarea>
          <div style="display: flex; gap: 1rem;">
            <button id="save-q-edit" class="primary" style="flex:1;">Save Changes</button>
            <button id="cancel-q-edit" class="btn-secondary" style="flex:1;">Cancel</button>
          </div>
        </div>
      </div>
    \`
    document.body.insertAdjacentHTML('beforeend', modalHtml)
    
    document.getElementById('cancel-q-edit').onclick = () => document.getElementById('q-edit-overlay').remove()
    document.getElementById('save-q-edit').onclick = async () => {
      const newText = document.getElementById('edit-q-text').value
      if (!newText.trim()) return alert('Question text cannot be empty.')
      
      const saveBtn = document.getElementById('save-q-edit')
      saveBtn.textContent = 'Saving...'
      saveBtn.disabled = true
      
      const { error } = await DataService.updateQuestion(question.id, { question_text: newText })
      if (error) {
        alert('Error updating question: ' + error.message)
        saveBtn.textContent = 'Save Changes'
        saveBtn.disabled = false
      } else {
        document.getElementById('q-edit-overlay').remove()
        this.loadQuestions()
      }
    }
  },

  async loadUsers() {
    const list = document.getElementById('users-list')
    list.innerHTML = 'Loading users...'
    const { data: users, error } = await DataService.getAllUsers()
    
    if (error) {
      list.innerHTML = `<div style="color: var(--error);">Error: ${error.message || error}</div>`
      return
    }
    
    if (!users || users.length === 0) {
      list.innerHTML = '<div style="color: #ffffff;">No users found.</div>'
      return
    }

    list.innerHTML = users.map(u => `
      <div class="glass" style="padding: 1rem; margin-bottom: 0.5rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
        <div style="flex: 1; min-width: 200px; word-break: break-all;">
          <strong>${u.username || 'Unknown'}</strong> (${u.email})
          <span class="badge" style="margin-left: 0.5rem; font-size: 0.7rem; padding: 2px 6px; background: ${u.tier === 'premium' ? 'var(--accent-secondary)' : '#666'}">${u.tier || 'free'}</span>
        </div>
        <div style="font-size: 0.8rem; color: #ffffff;">Credits: ${u.ai_credits || 0}</div>
      </div>
    `).join('')
  },

  async loadSyllabus() {
    const list = document.getElementById('syllabus-list')
    list.innerHTML = 'Loading syllabus...'
    
    try {
      const { data: fullSyllabus, error } = await DataService.getFullSyllabus()
      if (error) throw error

      // Group by Exam -> Subject -> Topics
      const hierarchy = {}
      fullSyllabus.forEach(item => {
        const examName = item.exams?.exam_name || 'Uncategorized'
        const subjectName = item.subjects?.subject_name || 'Generic'
        
        if (!hierarchy[examName]) hierarchy[examName] = {}
        if (!hierarchy[examName][subjectName]) hierarchy[examName][subjectName] = []
        
        hierarchy[examName][subjectName].push({ id: item.id, topic: item.topic })
      })

      // Fetch all Exams and Subjects for the "Add Topic" drop downs if needed, 
      // but simpler to just show them in situ.
      
      list.innerHTML = Object.entries(hierarchy).map(([examName, subjects]) => `
        <div class="exam-group" style="margin-bottom: 1rem;">
          <div class="glass syllabus-header exam-toggle" style="padding: 1rem; cursor: pointer; display: flex; justify-content: space-between; flex-wrap: wrap; gap: 0.5rem; background: rgba(59, 130, 246, 0.1); border-left: 4px solid var(--accent-primary);">
            <strong style="font-size: 1.1rem; color: var(--accent-primary);">${examName}</strong>
            <span>▼</span>
          </div>
          <div class="subjects-container" style="display: none; padding-left: 1rem; margin-top: 0.5rem;">
            ${Object.entries(subjects).map(([subName, topics]) => `
              <div class="subject-group" style="margin-bottom: 0.5rem;">
                <div class="glass syllabus-header subject-toggle" style="padding: 0.75rem; cursor: pointer; display: flex; justify-content: space-between; flex-wrap: wrap; gap: 0.5rem; background: rgba(255, 255, 255, 0.03);">
                  <span style="font-weight: 600;">${subName}</span>
                  <span style="font-size: 0.8rem; color: #ffffff;">${topics.length} Topics ▼</span>
                </div>
                <div class="topics-container" style="display: none; padding: 0.5rem; border-left: 1px solid var(--glass-border); margin-left: 0.5rem;">
                  <div style="display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 0.75rem;">
                    <input type="text" placeholder="New topic name..." class="glass-input add-topic-input" style="flex: 1; min-width: 150px; padding: 0.4rem; font-size: 0.8rem;">
                    <button class="primary add-topic-btn" data-exam="${examName}" data-subject="${subName}" style="padding: 0.4rem 0.8rem; font-size: 0.8rem;">Add</button>
                  </div>
                  ${topics.map(t => `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.4rem 0.75rem; margin-bottom: 2px; background: rgba(255,255,255,0.02); border-radius: 4px; font-size: 0.85rem;">
                      <span>${t.topic}</span>
                      <button class="delete-topic-btn" data-id="${t.id}" style="background: none; border: none; cursor: pointer; font-size:1rem; opacity: 0.6; padding: 0;">🗑️</button>
                    </div>
                  `).join('')}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `).join('')

      this.setupSyllabusListeners()
    } catch (err) {
      list.innerHTML = `<div style="color: var(--error);">Error: ${err.message}</div>`
    }
  },

  setupSyllabusListeners() {
    // Exam toggles
    document.querySelectorAll('.exam-toggle').forEach(el => {
      el.onclick = () => {
        const next = el.nextElementSibling
        next.style.display = next.style.display === 'none' ? 'block' : 'none'
        el.querySelector('span').textContent = next.style.display === 'none' ? '▼' : '▲'
      }
    })

    // Subject toggles
    document.querySelectorAll('.subject-toggle').forEach(el => {
      el.onclick = () => {
        const next = el.nextElementSibling
        next.style.display = next.style.display === 'none' ? 'block' : 'none'
      }
    })

    // Delete topic
    document.querySelectorAll('.delete-topic-btn').forEach(btn => {
      btn.onclick = async (e) => {
        if (!confirm('Are you sure you want to delete this topic?')) return
        const id = btn.getAttribute('data-id')
        const { error } = await DataService.deleteSyllabusTopic(id)
        if (error) alert('Error deleting: ' + error.message)
        else this.loadSyllabus()
      }
    })

    // Add topic
    document.querySelectorAll('.add-topic-btn').forEach(btn => {
      btn.onclick = async (e) => {
        const input = btn.previousElementSibling
        const topicName = input.value.trim()
        if (!topicName) return
        
        const examName = btn.getAttribute('data-exam')
        const subjectName = btn.getAttribute('data-subject')
        
        // Find IDs
        const { data: exams } = await DataService.getExams()
        const { data: subjects } = await DataService.getSubjects()
        
        const examId = exams.find(e => e.exam_name === examName)?.id
        const subjectId = subjects.find(s => s.subject_name === subjectName)?.id
        
        if (!examId || !subjectId) {
          alert('Error: Exam or Subject ID not found.')
          return
        }

        const { error } = await DataService.addSyllabusTopic(examId, subjectId, topicName)
        if (error) alert('Error adding topic: ' + error.message)
        else this.loadSyllabus()
      }
    })
  },

  async loadReports() {
    const list = document.getElementById('reports-list')
    list.innerHTML = 'Loading reports...'
    const { data } = await supabase.from('question_reports').select('*, questions(question_text)').order('created_at', { ascending: false })
    list.innerHTML = data.map(r => `
      <div class="glass" style="padding: 1rem; margin-bottom: 1rem;">
        <div style="display: flex; justify-content: space-between;">
          <strong style="color: var(--error);">${r.reason}</strong>
          <span style="font-size: 0.7rem; color: #ffffff;">${new Date(r.created_at).toLocaleDateString()}</span>
        </div>
        <p style="font-size: 0.85rem; margin-top: 0.5rem;">${r.details || 'No details'}</p>
        <div style="font-size: 0.75rem; color: #ffffff; margin-top: 4px;">Q: ${r.questions?.question_text.substring(0, 50)}...</div>
      </div>
    `).join('')
  },

  async loadGlobalAnalytics() {
    const summary = document.getElementById('analytics-summary')
    const chartContainer = document.getElementById('global-scores-chart')
    summary.innerHTML = 'Loading platform data...'

    const { stats, sessions, error } = await DataService.getGlobalAnalytics()
    if (error) {
      summary.innerHTML = `<div style="color: var(--error);">Error: ${error}</div>`
      return
    }

    summary.innerHTML = `
      <div class="glass card" style="text-align: center;">
        <div style="font-size: 0.8rem; color: #ffffff;">Total Students</div>
        <div style="font-size: 2rem; font-weight: 700; color: var(--accent-primary);">${stats.totalUsers}</div>
      </div>
      <div class="glass card" style="text-align: center;">
        <div style="font-size: 0.8rem; color: #ffffff;">Database Size</div>
        <div style="font-size: 2rem; font-weight: 700; color: var(--success);">${stats.totalQuestions} Questions</div>
      </div>
      <div class="glass card" style="text-align: center;">
        <div style="font-size: 0.8rem; color: #ffffff;">Avg Performance</div>
        <div style="font-size: 2rem; font-weight: 700; color: #ffeb3b;">${stats.averagePerformance}%</div>
      </div>
    `

    // Process distribution (0-10, 11-20...)
    const brackets = new Array(10).fill(0)
    sessions.forEach(s => {
      const idx = Math.min(Math.floor(s.score_percentage / 10), 9)
      brackets[idx]++
    })

    if (this._globalChart) this._globalChart.destroy()
    this._globalChart = new Chart(chartContainer.getContext('2d'), {
      type: 'bar',
      data: {
        labels: ['0-10%', '11-20%', '21-30%', '31-40%', '41-50%', '51-60%', '61-70%', '71-80%', '81-90%', '91-100%'],
        datasets: [{
          label: 'Number of Students',
          data: brackets,
          backgroundColor: 'rgba(76, 175, 80, 0.5)',
          borderColor: '#4caf50',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' } },
          x: { grid: { display: false } }
        }
      }
    })
  }
}

