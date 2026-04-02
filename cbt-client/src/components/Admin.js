import { DataService } from '../services/data'
import { SubscriptionService } from '../services/subscriptionService'
import { supabase } from '../utils/supabase'

export const AdminComponent = {
  render(profile, onBack) {
    const container = document.getElementById('admin-container')
    container.style.display = 'block'
    this._adminProfile = profile // Store for auditing
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
          <button class="nav-tab" data-tab="marketing">💰 Marketing</button>
          <button class="nav-tab" data-tab="news">📰 Manage News</button>
          <button class="nav-tab" data-tab="analytics" style="color: var(--accent-primary);">📈 Platform Analytics</button>
          ${(profile.role === 'admin' || profile.role === 'super-admin' || profile.email === 'oshituo@gmail.com') ? '<button class="nav-tab" data-tab="audit">📜 Audit Logs</button>' : ''}
          ${(profile.role === 'admin' || profile.role === 'super-admin' || profile.email === 'oshituo@gmail.com') ? '<button class="nav-tab" data-tab="staff">👥 Staff</button>' : ''}
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
            <div class="glass card" style="padding: 2rem; margin-bottom: 2rem;">
              <h3 style="margin-bottom: 1.5rem;">Global Score Distribution</h3>
              <canvas id="global-scores-chart" height="300"></canvas>
            </div>
            <div class="glass card" style="padding: 2rem;">
              <h3 style="margin-bottom: 1.5rem;">Estimated Revenue Growth (User Tiers)</h3>
              <canvas id="revenue-growth-chart" height="300"></canvas>
            </div>
          </div>

          <!-- Questions Tab -->
          <div id="admin-questions-tab">
            <div style="display: flex; flex-direction: column; gap: 1rem; margin-bottom: 2rem;">
              <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
                <h2>Database Questions</h2>
                <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                  <button id="bulk-import-btn" class="btn-secondary" style="padding: 0.5rem 1rem;">📦 Bulk Import (.csv)</button>
                  <button id="add-question-btn" class="primary" style="padding: 0.5rem 1rem;">+ Add Question</button>
                  <input type="file" id="bulk-import-input" accept=".csv" style="display: none;">
                </div>
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

          <!-- Marketing Tab -->
          <div id="admin-marketing-tab" style="display: none;">
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 2rem;">
              <!-- Promo Codes -->
              <div>
                <h2 style="margin-bottom: 1.5rem;">Promo Codes</h2>
                <div class="glass card" style="padding: 1.5rem; margin-bottom: 2rem;">
                  <h3 style="font-size: 1rem; margin-bottom: 1rem;">Create New Code</h3>
                  <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                    <input type="text" id="promo-code-input" placeholder="CODE (e.g. SAVE50)" class="glass-input">
                    <input type="number" id="promo-percent-input" placeholder="Discount %" class="glass-input">
                    <input type="date" id="promo-expiry-input" class="glass-input">
                    <button id="add-promo-btn" class="primary" style="padding: 0.75rem;">Create Code</button>
                  </div>
                </div>
                <div id="promo-codes-list">Loading codes...</div>
              </div>
              
              <!-- Global Settings & Broadcast -->
              <div>
                <h2 style="margin-bottom: 1.5rem;">System Controls</h2>
                
                <!-- NEW: Explanations Toggle -->
                <div class="glass card" style="padding: 1.5rem; margin-bottom: 1.5rem; border-left: 4px solid var(--accent-secondary);">
                  <h3 style="font-size: 1rem; margin-bottom: 0.5rem;">🔓 Explanations Access</h3>
                  <p style="font-size: 0.8rem; color: #ccc; margin-bottom: 1rem;">Turn this ON to allow ALL users (including Free) to view question explanations.</p>
                  <div style="display: flex; align-items: center; gap: 1rem;">
                    <button id="toggle-explanations-btn" class="glass" style="padding: 0.6rem 1.2rem; font-weight: 700; border-color: var(--accent-secondary); color: var(--accent-secondary);">Loading...</button>
                  </div>
                </div>

                <div class="glass card" style="padding: 1.5rem;">
                  <h3 style="font-size: 1rem; margin-bottom: 0.5rem;">Announcement Banner</h3>
                  <p style="font-size: 0.8rem; color: #ccc; margin-bottom: 1rem;">This message will appear at the top of all user dashboards.</p>
                  <textarea id="broadcast-message-input" class="glass-input" style="width: 100%; min-height: 120px; margin-bottom: 1rem;" placeholder="Enter message or leave blank to clear..."></textarea>
                  <button id="save-broadcast-btn" class="primary" style="width: 100%; padding: 0.75rem;">Push Broadcast</button>
                </div>
              </div>
            </div>
          </div>

          <!-- News Management Tab -->
          <div id="admin-news-tab" style="display: none;">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; margin-bottom: 2rem;">
              <h2>Manage News & Updates</h2>
              <button id="add-news-btn" class="primary" style="padding: 0.5rem 1rem;">+ Add Article</button>
            </div>
            <div id="admin-news-list">Loading news...</div>
          </div>

          <!-- Audit Logs Tab (Super Admin Only) -->
          <div id="admin-audit-tab" style="display: none;">
            <h2>Administrative Audit Logs</h2>
            <div id="audit-logs-list" style="margin-top: 1rem; font-family: monospace; font-size: 0.8rem;">Loading logs...</div>
          </div>

          <!-- Staff Tab (Super Admin Only) -->
          <div id="admin-staff-tab" style="display: none;">
            <h2>Staff Management</h2>
            <div class="glass card" style="padding: 1.5rem; margin-top: 1rem;">
              <p style="font-size: 0.85rem; color: #ccc; margin-bottom: 1rem;">Promote a user by Gmail address.</p>
              <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                <input type="email" id="staff-email-input" placeholder="User email..." class="glass-input" style="flex: 1; min-width: 200px;">
                <select id="staff-role-select" class="glass-select">
                  <option value="moderator">Moderator</option>
                  <option value="admin">Admin</option>
                  <option value="user">Revoke (User)</option>
                </select>
                <button id="assign-staff-btn" class="primary">Assign Role</button>
              </div>
            </div>
            <div id="staff-list" style="margin-top: 1.5rem;"></div>
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
        document.getElementById('admin-marketing-tab').style.display = target === 'marketing' ? 'block' : 'none'
        if(document.getElementById('admin-news-tab')) document.getElementById('admin-news-tab').style.display = target === 'news' ? 'block' : 'none'
        document.getElementById('admin-analytics-tab').style.display = target === 'analytics' ? 'block' : 'none'
        if (document.getElementById('admin-audit-tab')) {
            document.getElementById('admin-audit-tab').style.display = target === 'audit' ? 'block' : 'none'
        }
        if (document.getElementById('admin-staff-tab')) {
          document.getElementById('admin-staff-tab').style.display = target === 'staff' ? 'block' : 'none'
        }

        if (target === 'questions') this.loadQuestions()
        else if (target === 'syllabus') this.loadSyllabus()
        else if (target === 'users') this.loadUsers()
        else if (target === 'reports') this.loadReports()
        else if (target === 'marketing') this.loadMarketing()
        else if (target === 'news') this.loadNews()
        else if (target === 'analytics') this.loadGlobalAnalytics()
        else if (target === 'audit') this.loadAuditLogs()
        else if (target === 'staff') this.loadStaff()
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

    // Staff Events
    const assignBtn = document.getElementById('assign-staff-btn')
    if (assignBtn) {
      assignBtn.onclick = async () => {
        const email = document.getElementById('staff-email-input').value.trim()
        const role = document.getElementById('staff-role-select').value
        if (!email) return alert('Enter an email address.')
        
        assignBtn.disabled = true
        assignBtn.textContent = 'Updating...'
        const { error } = await DataService.updateUserRole(email, role)
        if (error) {
            alert('Error: ' + error.message)
        } else {
            await DataService.logAdminAction(this._adminProfile.email, 'Assign Role', email, role)
            alert(`Successfully assigned ${role} role to ${email}`)
            document.getElementById('staff-email-input').value = ''
            this.loadStaff()
        }
        assignBtn.textContent = 'Assign Role'
        assignBtn.disabled = false
      }
    }

    // Marketing Events
    const saveBroadcastBtn = document.getElementById('save-broadcast-btn')
    if (saveBroadcastBtn) {
        saveBroadcastBtn.onclick = async () => {
            const msg = document.getElementById('broadcast-message-input').value.trim()
            saveBroadcastBtn.textContent = 'Pushing...'
            saveBroadcastBtn.disabled = true
            const { error } = await DataService.updateSystemConfig('broadcast_message', msg)
            if (error) alert('Error: ' + error.message)
            else {
                await DataService.logAdminAction(this._adminProfile.email, 'Update Broadcast', 'global', msg.substring(0, 50))
                alert('Broadcast updated successfully!')
            }
            saveBroadcastBtn.textContent = 'Push Broadcast'
            saveBroadcastBtn.disabled = false
        }
    }

    const toggleExplBtn = document.getElementById('toggle-explanations-btn')
    if (toggleExplBtn) {
        toggleExplBtn.onclick = async () => {
            const currentState = toggleExplBtn.dataset.state === 'true'
            const newState = !currentState
            toggleExplBtn.disabled = true
            toggleExplBtn.textContent = 'Updating...'
            
            const { error } = await DataService.updateSystemConfig('explanations_free_access', newState)
            if (error) alert('Error: ' + error.message)
            else {
                await DataService.logAdminAction(this._adminProfile.email, 'Toggle Explanations Free', 'global', `New State: ${newState}`)
                this.loadMarketing()
            }
            toggleExplBtn.disabled = false
        }
    }

    const addPromoBtn = document.getElementById('add-promo-btn')
    if (addPromoBtn) {
        addPromoBtn.onclick = async () => {
            const code = document.getElementById('promo-code-input').value.trim().toUpperCase()
            const percent = parseInt(document.getElementById('promo-percent-input').value)
            const expiry = document.getElementById('promo-expiry-input').value
            
            if (!code || isNaN(percent)) return alert('Enter code and valid percentage.')
            
            addPromoBtn.textContent = 'Creating...'
            addPromoBtn.disabled = true
            const { error } = await DataService.addPromoCode(code, percent, expiry)
            if (error) alert('Error: ' + error.message)
            else {
                await DataService.logAdminAction(this._adminProfile.email, 'Create Promo', code, `${percent}% off`)
                alert('Promo code created!')
                document.getElementById('promo-code-input').value = ''
                document.getElementById('promo-percent-input').value = ''
                this.loadMarketing()
            }
            addPromoBtn.textContent = 'Create Code'
            addPromoBtn.disabled = false
        }
    }
    // Bulk Import Logic
    const bulkBtn = document.getElementById('bulk-import-btn')
    const bulkInput = document.getElementById('bulk-import-input')
    if (bulkBtn && bulkInput) {
      bulkBtn.onclick = () => bulkInput.click()
      bulkInput.onchange = (e) => {
        const file = e.target.files[0]
        if (file) this.handleBulkUpload(file)
      }
    }
  },

  handleBulkUpload(file) {
    const btn = document.getElementById('bulk-import-btn')
    btn.textContent = '⏳ Processing...'
    btn.disabled = true

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const rows = results.data
        if (rows.length === 0) {
            btn.textContent = '📦 Bulk Import (.csv)'
            btn.disabled = false
            return alert('CSV is empty or invalid.')
        }

        const questions = rows.map(row => ({
          question_text: row.question_text || row.question,
          exam_type: row.exam_type || 'JAMB',
          subject: row.subject || 'General',
          topic: row.topic || '',
          explanation: row.explanation || '',
          diagram_url: row.diagram_url || null,
          answers: [
            { text: row.option_a, is_correct: String(row.correct_option).trim().toUpperCase() === 'A' },
            { text: row.option_b, is_correct: String(row.correct_option).trim().toUpperCase() === 'B' },
            { text: row.option_c, is_correct: String(row.correct_option).trim().toUpperCase() === 'C' },
            { text: row.option_d, is_correct: String(row.correct_option).trim().toUpperCase() === 'D' }
          ].filter(a => a.text)
        })).filter(q => q.question_text)

        if (questions.length === 0) {
            btn.textContent = '📦 Bulk Import (.csv)'
            btn.disabled = false
            return alert('No valid questions found in CSV.')
        }

        const { error, count } = await DataService.bulkAddQuestions(questions)
        if (error) alert('Import Error: ' + error)
        else {
            await DataService.logAdminAction(this._adminProfile.email, 'Bulk Import', 'questions', `Imported ${count} questions`)
            alert(`Success! Imported ${count} questions.`)
        }
        
        btn.textContent = '📦 Bulk Import (.csv)'
        btn.disabled = false
        this.loadQuestions()
      }
    })
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
          <button class="btn-secondary edit-q-btn" data-id="${q.id}" style="padding: 0.4rem 0.8rem; font-size: 0.75rem;">✏️ Edit</button>
          <button class="btn-secondary delete-q-btn" data-id="${q.id}" style="padding: 0.4rem 0.8rem; font-size: 0.75rem; color: #ff6b6b; border-color: rgba(255, 107, 107, 0.3);">🗑️ Delete</button>
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
          await DataService.logAdminAction(this._adminProfile.email, 'Delete Question', id, 'Manual deletion')
          this.loadQuestions()
        }
      }
    })

    document.querySelectorAll('.edit-q-btn').forEach(btn => {
      btn.onclick = () => {
        const id = btn.getAttribute('data-id')
        const question = questions.find(q => q.id === id)
        this.openEditModal(question)
      }
    })

    // Phase 2: Render LaTeX Math (KaTeX)
    if (window.renderMathInElement) {
        window.renderMathInElement(list, {
            delimiters: [
                {left: "$$", right: "$$", display: true},
                {left: "$", right: "$", display: false},
                {left: "\\(", right: "\\)", display: false},
                {left: "\\[", right: "\\]", display: true}
            ],
            throwOnError: false
        });
    }
  },

  openEditModal(question) {
    const modalHtml = `
      <div id="q-edit-overlay" style="position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.8); z-index:9999; display:flex; justify-content:center; align-items:center; padding:1rem;">
        <div class="glass card" style="width: 100%; max-width: 600px; max-height: 90vh; overflow-y: auto; padding: 1.5rem; border: 1px solid var(--accent-primary);">
          <h3 style="margin-bottom: 1rem; font-family: 'Outfit';">Edit Question</h3>
          <p style="font-size: 0.8rem; color: #aaa; margin-bottom: 0.5rem;">Question Text</p>
          <textarea id="edit-q-text" class="glass-input" style="width: 100%; min-height: 120px; margin-bottom: 1.5rem; font-size: 0.9rem;">${question.question_text}</textarea>
          <div style="display: flex; gap: 1rem;">
            <button id="save-q-edit" class="primary" style="flex:1;">Save Changes</button>
            <button id="cancel-q-edit" class="btn-secondary" style="flex:1;">Cancel</button>
          </div>
        </div>
      </div>
    `
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

    // Phase 2: Render LaTeX Math (KaTeX) in Modal
    if (window.renderMathInElement) {
        window.renderMathInElement(document.getElementById('q-edit-overlay'), {
            delimiters: [
                {left: "$$", right: "$$", display: true},
                {left: "$", right: "$", display: false}
            ],
            throwOnError: false
        });
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
          <span class="badge" style="margin-left: 0.5rem; font-size: 0.7rem; padding: 2px 6px; background: ${SubscriptionService.resolveUserTier(u) === 'premium' ? 'var(--accent-secondary)' : (SubscriptionService.resolveUserTier(u) === 'medium' ? 'var(--accent-primary)' : '#666')}">${SubscriptionService.resolveUserTier(u).toUpperCase()}</span>
          ${u.is_activated ? '<span class="badge" style="margin-left: 0.25rem; font-size: 0.65rem; padding: 1px 5px; background: var(--success); opacity: 0.9;">LIFETIME</span>' : ''}
          <span class="badge" style="margin-left: 0.5rem; font-size: 0.7rem; padding: 2px 6px; background: var(--accent-primary); opacity: 0.8;">${u.role || 'user'}</span>
        </div>
        <div style="display: flex; align-items: center; gap: 1rem;">
          <div style="font-size: 0.8rem; color: #ffffff;">Credits: ${u.ai_credits || 0}</div>
          <button class="btn-secondary edit-user-btn" data-id="${u.id}" style="padding: 4px 8px; font-size: 0.75rem;">Edit User</button>
        </div>
      </div>
    `).join('')

    // Attach User Edit Listeners
    document.querySelectorAll('.edit-user-btn').forEach(btn => {
      btn.onclick = () => {
        const id = btn.getAttribute('data-id')
        const user = users.find(u => u.id === id)
        if (user) this.openUserEditModal(user)
      }
    })
  },

  openUserEditModal(user) {
    const modalHtml = `
      <div id="user-edit-overlay" style="position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.8); z-index:9999; display:flex; justify-content:center; align-items:center; padding:1rem;">
        <div class="glass card" style="width: 100%; max-width: 500px; padding: 2rem; border: 1px solid var(--accent-primary);">
          <h3 style="margin-bottom: 1.5rem; font-family: 'Outfit';">Edit User: ${user.username || user.email}</h3>
          
          <div style="margin-bottom: 1.25rem;">
            <p style="font-size: 0.8rem; color: #ccc; margin-bottom: 0.5rem;">Subscription Tier</p>
            <select id="edit-user-tier" class="glass-select" style="width: 100%;">
              <option value="freemium" ${user.tier === 'freemium' || user.tier === 'free' ? 'selected' : ''}>Freemium (Basic)</option>
              <option value="medium" ${user.tier === 'medium' ? 'selected' : ''}>Medium (Activated)</option>
              <option value="premium" ${user.tier === 'premium' ? 'selected' : ''}>Premium (Monthly Pro)</option>
            </select>
          </div>

          <div style="margin-bottom: 1.5rem; display: flex; align-items: center; gap: 0.75rem;">
            <input type="checkbox" id="edit-user-activated" ${user.is_activated ? 'checked' : ''} style="width: 18px; height: 18px;">
            <label for="edit-user-activated" style="font-size: 0.85rem; color: #fff; cursor: pointer;">Lifetime Activated (₦1,500 Paid)</label>
          </div>

          <div style="margin-bottom: 1.25rem;">
            <p style="font-size: 0.8rem; color: #ccc; margin-bottom: 0.5rem;">Premium Expiration (premium_until)</p>
            <input type="datetime-local" id="edit-user-premium-until" class="glass-input" value="${user.premium_until ? new Date(user.premium_until).toISOString().slice(0, 16) : ''}" style="width: 100%;">
          </div>

          <div style="margin-bottom: 1.25rem; display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
            <div>
              <p style="font-size: 0.8rem; color: #ccc; margin-bottom: 0.5rem;">AI Monthly Credits</p>
              <input type="number" id="edit-user-credits" class="glass-input" value="${user.ai_credits || 0}" style="width: 100%;">
            </div>
            <div>
              <p style="font-size: 0.8rem; color: #ccc; margin-bottom: 0.5rem;">Today's AI Usage</p>
              <input type="number" id="edit-user-ai-usage" class="glass-input" value="${user.ai_daily_usage || 0}" style="width: 100%;">
            </div>
          </div>

          <div style="display: flex; gap: 1rem; margin-bottom: 1rem;">
            <button id="save-user-edit" class="primary" style="flex:1;">Save User</button>
            <button id="cancel-user-edit" class="btn-secondary" style="flex:1;">Cancel</button>
          </div>
          <button id="flag-user-btn" class="glass" style="width: 100%; border-color: var(--error); color: var(--error); padding: 0.75rem;">🚩 Flag for Suspicious Activity</button>
        </div>
      </div>
    `
    document.body.insertAdjacentHTML('beforeend', modalHtml)

    document.getElementById('cancel-user-edit').onclick = () => document.getElementById('user-edit-overlay').remove()
    document.getElementById('save-user-edit').onclick = async () => {
      const tier = document.getElementById('edit-user-tier').value
      const is_activated = document.getElementById('edit-user-activated').checked
      const ai_credits = parseInt(document.getElementById('edit-user-credits').value)
      const ai_daily_usage = parseInt(document.getElementById('edit-user-ai-usage').value)
      const premium_until_val = document.getElementById('edit-user-premium-until').value
      const premium_until = premium_until_val ? new Date(premium_until_val).toISOString() : null
      
      const saveBtn = document.getElementById('save-user-edit')
      saveBtn.textContent = 'Saving...'
      saveBtn.disabled = true
      
      const { error } = await DataService.updateUser(user.id, { tier, is_activated, ai_credits, ai_daily_usage, premium_until })
      if (error) {
        alert('Error: ' + error.message)
        saveBtn.textContent = 'Save User'
        saveBtn.disabled = false
      } else {
        // Log Action
        await DataService.logAdminAction(this._adminProfile.email, 'Update User', user.id, `Tier: ${tier}, Credits: ${ai_credits}`)
        document.getElementById('user-edit-overlay').remove()
        this.loadUsers()
      }
    }

    document.getElementById('flag-user-btn').onclick = async () => {
        const reason = prompt('Reason for flagging (e.g. "Cheating - high scores"):')
        if (!reason) return
        const btn = document.getElementById('flag-user-btn')
        btn.disabled = true
        btn.textContent = 'Flagging...'
        const { error } = await DataService.flagUser(user.id, reason)
        if (error) alert('Error: ' + error.message)
        else {
            await DataService.logAdminAction(this._adminProfile.email, 'Flag User', user.id, reason)
            alert('User has been flagged.')
            document.getElementById('user-edit-overlay').remove()
            this.loadUsers()
        }
    }
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
        
        hierarchy[examName][subjectName].push({ 
          id: item.id, 
          topic: item.topic,
          importance: item.importance || 1 
        })
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
                      <div style="display: flex; align-items: center; gap: 0.75rem; flex: 1;">
                        <span title="Importance (1-5)">
                            <select class="glass-select topic-weight-select" data-id="${t.id}" style="padding: 1px 4px; font-size: 0.7rem; border-color: rgba(255,255,255,0.1); width: auto;">
                                ${[1,2,3,4,5].map(w => `<option value="${w}" ${t.importance == w ? 'selected' : ''}>${w}⭐</option>`).join('')}
                            </select>
                        </span>
                        <span>${t.topic}</span>
                      </div>
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

    // Update topic weight
    document.querySelectorAll('.topic-weight-select').forEach(sel => {
        sel.onchange = async () => {
            const id = sel.getAttribute('data-id')
            const weight = parseInt(sel.value)
            sel.disabled = true
            const { error } = await DataService.updateSyllabusTopic(id, { importance: weight })
            if (error) {
                alert('Error updating weight: ' + error.message)
                sel.disabled = false
            } else {
                sel.disabled = false
            }
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
    const { data } = await DataService.getQuestionReports()
    
    if (!data || data.length === 0) {
      list.innerHTML = '<div style="padding: 2rem; text-align: center; color: #888;">No question reports found.</div>'
      return
    }
    
    list.innerHTML = data.map(r => `
      <div class="glass" style="padding: 1.25rem; margin-bottom: 1rem; border-left: 4px solid ${r.status === 'resolved' ? 'var(--success)' : r.status === 'dismissed' ? '#666' : 'var(--error)'};">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 0.5rem;">
          <div>
            <strong style="color: ${r.status === 'resolved' ? 'var(--success)' : 'var(--error)'}; text-transform: uppercase; font-size: 0.75rem;">${r.reason}</strong>
            <span class="badge" style="margin-left: 0.5rem; background: rgba(255,255,255,0.1); font-size: 0.65rem;">${r.status || 'pending'}</span>
          </div>
          <span style="font-size: 0.7rem; color: #aaa;">${new Date(r.created_at).toLocaleDateString()}</span>
        </div>
        <p style="font-size: 0.9rem; margin: 0.75rem 0;">${r.details || 'No details provided.'}</p>
        <div style="font-size: 0.75rem; color: #888; background: rgba(0,0,0,0.2); padding: 0.5rem; border-radius: 4px; margin-bottom: 1rem;">
          <strong>Target Question:</strong> ${r.questions?.question_text.substring(0, 100)}...
        </div>
        
        ${r.status === 'pending' || !r.status ? `
          <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
            <button class="primary resolve-report-btn" data-id="${r.id}" style="padding: 0.4rem 0.8rem; font-size: 0.75rem;">Mark Resolved</button>
            <button class="btn-secondary deactivate-question-btn" data-qid="${r.questions?.id}" data-rid="${r.id}" style="padding: 0.4rem 0.8rem; font-size: 0.75rem; color: var(--error);">Deactivate Question</button>
            <button class="btn-secondary dismiss-report-btn" data-id="${r.id}" style="padding: 0.4rem 0.8rem; font-size: 0.75rem;">Dismiss</button>
          </div>
        ` : `<div style="font-size: 0.75rem; color: var(--success); font-style: italic;">Verified and ${r.status}</div>`}
      </div>
    `).join('')

    // Attach Listeners
    document.querySelectorAll('.resolve-report-btn').forEach(btn => {
      btn.onclick = async () => {
        const id = btn.getAttribute('data-id')
        btn.textContent = '...'
        await DataService.updateReportStatus(id, 'resolved')
        this.loadReports()
      }
    })
    document.querySelectorAll('.dismiss-report-btn').forEach(btn => {
      btn.onclick = async () => {
        const id = btn.getAttribute('data-id')
        btn.textContent = '...'
        await DataService.updateReportStatus(id, 'dismissed')
        this.loadReports()
      }
    })
    document.querySelectorAll('.deactivate-question-btn').forEach(btn => {
      btn.onclick = async () => {
        if (!confirm('Are you sure you want to deactivate this question? It will no longer appear in exams.')) return
        const qid = btn.getAttribute('data-qid')
        const rid = btn.getAttribute('data-rid')
        btn.textContent = '...'
        await DataService.deactivateQuestion(qid)
        await DataService.updateReportStatus(rid, 'resolved (question deactivated)')
        this.loadReports()
      }
    })
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

    // Phase 5: Revenue Chart
    const revenueContainer = document.getElementById('revenue-growth-chart')
    if (revenueContainer) {
        const { data: users } = await DataService.getRevenueStats()
        const tierCounts = { free: 0, premium: 0 }
        users.forEach(u => {
            if (u.tier === 'premium') tierCounts.premium++
            else tierCounts.free++
        })

        if (this._revenueChart) this._revenueChart.destroy()
        this._revenueChart = new Chart(revenueContainer.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: ['Free Tier (0 NGN)', 'Premium Tier (1500 NGN)'],
                datasets: [{
                    data: [tierCounts.free, tierCounts.premium],
                    backgroundColor: ['rgba(255, 255, 255, 0.1)', 'rgba(79, 70, 229, 0.6)'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                plugins: { legend: { position: 'bottom', labels: { color: '#ccc' } } }
            }
        })
    }
  },

  async loadAuditLogs() {
    const list = document.getElementById('audit-logs-list')
    list.innerHTML = 'Loading system logs...'
    const { data, error } = await DataService.getAuditLogs()
    
    if (error) {
        list.innerHTML = `<div style="color: var(--error);">Error: ${error.message}</div>`
        return
    }

    if (!data || data.length === 0) {
        list.innerHTML = 'No logs available.'
    } else {
        list.innerHTML = data.map(log => `
            <div style="padding: 0.5rem; border-bottom: 1px solid rgba(255,255,255,0.05); color: #ccc;">
                <span style="color: var(--accent-primary); font-weight: 700;">[${new Date(log.created_at).toLocaleTimeString()}]</span>
                <span style="color: #fff;">${log.admin_email}:</span>
                <span style="color: var(--success);">${log.action}</span>
                <span style="font-size: 0.7rem; opacity: 0.7;">(ID: ${log.target_id || 'N/A'})</span>
                <div style="font-size: 0.7rem; margin-top: 2px; opacity: 0.5;">${log.details}</div>
            </div>
        `).join('')
    }
  },

  async loadStaff() {
    const list = document.getElementById('staff-list')
    if (!list) return
    list.innerHTML = 'Loading staff list...'
    const { data: users } = await DataService.getAllUsers()
    
    // Filter for anyone with a role or the super admin
    const staff = users.filter(u => 
      (u.role && u.role !== 'user') || 
      u.email === 'oshituo@gmail.com'
    )
    
    list.innerHTML = `
      <h3 style="margin-bottom: 1rem; font-family: 'Outfit'; font-size: 1rem;">Current Staff Members</h3>
      ${staff.map(s => `
        <div class="glass" style="padding: 1rem; margin-bottom: 0.5rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
          <div>
            <strong>${s.username || 'Staff'}</strong> (${s.email})
            <span class="badge" style="margin-left: 0.5rem; background: var(--accent-primary); padding: 2px 6px; font-size: 0.7rem;">${s.role || (s.email === 'oshituo@gmail.com' ? 'super-admin' : 'user')}</span>
          </div>
          ${(s.role !== 'super-admin' && s.email !== 'oshituo@gmail.com') ? `
            <div style="font-size: 0.75rem; color: #aaa;">Use the form above to change role</div>
          ` : '<em style="font-size: 0.75rem; color: var(--accent-secondary);">System Owner</em>'}
        </div>
      `).join('')}
    `
  },

  async loadNews() {
    const list = document.getElementById('admin-news-list')
    if (!list) return
    list.innerHTML = 'Loading news...'
    
    // Add new article button listener
    document.getElementById('add-news-btn').onclick = () => {
      this.openNewsEditModal()
    }

    const { data: news, error } = await DataService.getNewsUpdates(50) // load up to 50 for admin
    
    if (error) {
       list.innerHTML = `<div style="color: var(--error);">Error: ${error.message}</div>`
       return
    }

    if (!news || news.length === 0) {
      list.innerHTML = '<div style="color: #ffffff;">No news items found.</div>'
      return
    }

    list.innerHTML = news.map(n => `
      <div class="glass" style="padding: 1.5rem; margin-bottom: 1rem; border-left: 4px solid var(--accent-primary);">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem;">
          <div style="flex: 1; min-width: 250px;">
            <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
               <span class="badge" style="background: rgba(59, 130, 246, 0.2); color: #3B82F6; font-size: 0.7rem;">${n.category}</span>
               <span style="font-size: 0.75rem; color: #aaa;">${new Date(n.created_at).toLocaleDateString()}</span>
            </div>
            <strong style="font-size: 1.1rem; display: block; margin-bottom: 0.5rem;">${n.title}</strong>
            <p style="font-size: 0.85rem; color: #ccc;">${n.summary}</p>
          </div>
          <div style="display: flex; gap: 0.5rem;">
            <button class="btn-secondary edit-news-btn" data-id="${n.id}" style="padding: 0.4rem 0.8rem; font-size: 0.75rem;">✏️ Edit</button>
            <button class="btn-secondary delete-news-btn" data-id="${n.id}" style="padding: 0.4rem 0.8rem; font-size: 0.75rem; color: #ff6b6b; border-color: rgba(255, 107, 107, 0.3);">🗑️ Delete</button>
          </div>
        </div>
      </div>
    `).join('')

    // Attach Listeners
    document.querySelectorAll('.edit-news-btn').forEach(btn => {
      btn.onclick = () => {
        const id = btn.getAttribute('data-id')
        const item = news.find(n => n.id === id)
        if (item) this.openNewsEditModal(item)
      }
    })

    document.querySelectorAll('.delete-news-btn').forEach(btn => {
      btn.onclick = async () => {
        if (!confirm('Are you sure you want to permanently delete this news update?')) return
        const id = btn.getAttribute('data-id')
        btn.textContent = '...'
        btn.disabled = true
        const { error } = await DataService.adminDeleteNews(id)
        if (error) {
          alert('Failed to delete: ' + error.message)
          btn.textContent = 'Delete'
          btn.disabled = false
        } else {
          this.loadNews()
        }
      }
    })
  },

  openNewsEditModal(news = null) {
    const isEditing = !!news
    const modalHtml = `
      <div id="news-edit-overlay" style="position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.8); z-index:9999; display:flex; justify-content:center; align-items:center; padding:1rem;">
        <div class="glass card" style="width: 100%; max-width: 700px; max-height: 90vh; overflow-y: auto; padding: 2rem; border: 1px solid var(--accent-primary);">
          <h3 style="margin-bottom: 1.5rem; font-family: 'Outfit';">${isEditing ? 'Edit News Article' : 'Draft New Article'}</h3>
          
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
            <div>
               <p style="font-size: 0.8rem; color: #ccc; margin-bottom: 0.25rem;">Title</p>
               <input type="text" id="edit-news-title" class="glass-input" value="${news ? news.title.replace(/"/g, '&quot;') : ''}" style="width: 100%;">
            </div>
            <div>
               <p style="font-size: 0.8rem; color: #ccc; margin-bottom: 0.25rem;">Category</p>
               <select id="edit-news-category" class="glass-select" style="width: 100%;">
                 <option value="JAMB" ${news && news.category === 'JAMB' ? 'selected' : ''}>JAMB</option>
                 <option value="WAEC" ${news && news.category === 'WAEC' ? 'selected' : ''}>WAEC</option>
                 <option value="NECO" ${news && news.category === 'NECO' ? 'selected' : ''}>NECO</option>
                 <option value="Admission" ${news && news.category === 'Admission' ? 'selected' : ''}>Admission</option>
                 <option value="Trending" ${news && news.category === 'Trending' ? 'selected' : ''}>Trending / Tech</option>
                 <option value="General" ${news && news.category === 'General' ? 'selected' : ''}>General</option>
               </select>
            </div>
          </div>

          <p style="font-size: 0.8rem; color: #ccc; margin-bottom: 0.25rem;">Short Summary (Visible on Dashboard Cards)</p>
          <textarea id="edit-news-summary" class="glass-input" style="width: 100%; min-height: 80px; margin-bottom: 1rem; font-size: 0.9rem;">${news ? news.summary : ''}</textarea>

          <p style="font-size: 0.8rem; color: #ccc; margin-bottom: 0.25rem;">Full Article Content (Visible in Reader Mode)</p>
          <textarea id="edit-news-content" class="glass-input" style="width: 100%; min-height: 150px; margin-bottom: 1.5rem; font-size: 0.9rem;">${news ? news.content : ''}</textarea>

          <div style="margin-bottom: 1.5rem; background: rgba(0,0,0,0.2); padding: 1rem; border-radius: 8px;">
            <p style="font-size: 0.8rem; color: var(--accent-primary); margin-bottom: 0.5rem; font-weight: bold;">📎 Optional PDF Attachment (e.g. Timetable)</p>
            ${news && news.attachment_url ? `<div style="font-size: 0.8rem; margin-bottom: 0.5rem;">Current Attachment: <a href="${news.attachment_url}" target="_blank" style="color: #60a5fa; text-decoration: underline;">${news.attachment_name || 'View File'}</a></div>` : ''}
            <input type="file" id="edit-news-attachment" accept=".pdf" class="glass-input" style="width: 100%; font-size: 0.8rem; padding: 0.4rem;">
          </div>

          <div style="display: flex; gap: 1rem;">
            <button id="save-news-edit" class="primary" style="flex:1;">${isEditing ? 'Save Changes' : 'Publish Article'}</button>
            <button id="cancel-news-edit" class="btn-secondary" style="flex:1;">Cancel</button>
          </div>
        </div>
      </div>
    `
    document.body.insertAdjacentHTML('beforeend', modalHtml)
    
    document.getElementById('cancel-news-edit').onclick = () => document.getElementById('news-edit-overlay').remove()
    document.getElementById('save-news-edit').onclick = async () => {
      const title = document.getElementById('edit-news-title').value.trim()
      const category = document.getElementById('edit-news-category').value
      const summary = document.getElementById('edit-news-summary').value.trim()
      const content = document.getElementById('edit-news-content').value.trim()
      
      if (!title || !summary || !content) return alert('All fields are required.')
      
      const fileInput = document.getElementById('edit-news-attachment')
      const file = fileInput.files[0]

      const saveBtn = document.getElementById('save-news-edit')
      saveBtn.textContent = file ? 'Uploading...' : (isEditing ? 'Saving...' : 'Publishing...')
      saveBtn.disabled = true
      
      let attachment_url = news ? news.attachment_url : null
      let attachment_name = news ? news.attachment_name : null

      if (file) {
        if (file.type !== 'application/pdf') {
            alert('Only PDF files are allowed.')
            saveBtn.textContent = isEditing ? 'Save Changes' : 'Publish Article'
            saveBtn.disabled = false
            return
        }
        const { url, error } = await DataService.adminUploadNewsAttachment(file)
        if (error) {
            alert('File Upload failed: ' + error.message)
            saveBtn.textContent = isEditing ? 'Save Changes' : 'Publish Article'
            saveBtn.disabled = false
            return
        }
        attachment_url = url
        attachment_name = file.name
      }
      
      saveBtn.textContent = isEditing ? 'Saving...' : 'Publishing...'

      let res;
      if (isEditing) {
         res = await DataService.adminUpdateNews(news.id, { title, category, summary, content, attachment_url, attachment_name })
      } else {
         res = await DataService.adminCreateNews({ title, category, summary, content, attachment_url, attachment_name })
      }

      if (res.error) {
        alert('Error saving news: ' + res.error.message)
        saveBtn.textContent = isEditing ? 'Save Changes' : 'Publish Article'
        saveBtn.disabled = false
      } else {
        document.getElementById('news-edit-overlay').remove()
        this.loadNews()
      }
    }
  },

  async loadMarketing() {
    const codeList = document.getElementById('promo-codes-list')
    if (codeList) {
        codeList.innerHTML = 'Loading codes...'
        const { data } = await DataService.getPromoCodes()
        if (!data || data.length === 0) {
            codeList.innerHTML = '<p style="font-size: 0.8rem; color: #888;">No active codes.</p>'
        } else {
            codeList.innerHTML = data.map(c => `
                <div style="font-size: 0.85rem; padding: 0.5rem; background: rgba(255,255,255,0.05); margin-bottom: 0.25rem; border-radius: 4px; display: flex; justify-content: space-between;">
                    <span><strong>${c.code}</strong> - ${c.percent}%</span>
                    <button class="delete-promo-btn" data-id="${c.id}" style="background: none; border: none; color: #ff6b6b; cursor: pointer;">🗑️</button>
                </div>
            `).join('')
            
            document.querySelectorAll('.delete-promo-btn').forEach(btn => {
                btn.onclick = async () => {
                    await DataService.deletePromoCode(btn.dataset.id)
                    this.loadMarketing()
                }
            })
        }
    }

    const broadcastInput = document.getElementById('broadcast-message-input')
    if (broadcastInput) {
        const { data } = await DataService.getSystemConfig('broadcast_message')
        if (data) broadcastInput.value = data.value || ''
    }

    const toggleExplBtn = document.getElementById('toggle-explanations-btn')
    if (toggleExplBtn) {
        const { data } = await DataService.getSystemConfig('explanations_free_access')
        const isFree = data?.value === true || data?.value === 'true'
        toggleExplBtn.dataset.state = isFree
        toggleExplBtn.textContent = isFree ? '✅ ENABLED (Free)' : '🔒 DISABLED (Locked)'
        toggleExplBtn.style.background = isFree ? 'rgba(76, 175, 80, 0.15)' : 'rgba(255, 255, 255, 0.1)'
        toggleExplBtn.style.color = isFree ? '#4caf50' : 'var(--accent-secondary)'
    }
  }
}

