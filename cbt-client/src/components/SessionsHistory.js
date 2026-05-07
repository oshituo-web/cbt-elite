import { DataService } from '../services/data'
import { ModalService } from '../services/ModalService'

export const SessionsHistoryComponent = {
  profile: null,
  allSessions: [],
  filteredSessions: [],
  onBack: null,

  async render(profile, onBack) {
    this.profile = profile
    this.onBack = onBack
    
    const container = document.getElementById('dashboard-container')
    if (!container) return
    
    // Hide dashboard, show history view
    container.style.display = 'none'
    
    let historyContainer = document.getElementById('sessions-history-container')
    if (!historyContainer) {
      historyContainer = document.createElement('div')
      historyContainer.id = 'sessions-history-container'
      historyContainer.className = 'main-content-area'
      container.parentNode.appendChild(historyContainer)
    }
    historyContainer.style.display = 'block'
    
    historyContainer.innerHTML = `
      <div class="sessions-history-view" style="padding: 2rem; max-width: 900px; margin: 0 auto; min-height: 100vh;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2.5rem;">
            <div>
                <h1 style="font-family: 'Outfit'; font-weight: 900; margin: 0; font-size: 1.75rem; color: var(--text-primary);">Session History</h1>
                <p style="color: var(--text-secondary); margin: 0.25rem 0 0 0; font-size: 0.9rem;">Review your past performance and growth.</p>
            </div>
            <button id="close-history-btn" class="header-icon-btn" title="Exit" style="width: 48px; height: 48px; display: flex; align-items: center; justify-content: center; border-radius: 14px; background: rgba(255,255,255,0.08); border: 1px solid var(--glass-border); color: var(--text-primary);">
                <i data-lucide="arrow-left" style="width: 24px; stroke-width: 3px;"></i>
            </button>
        </div>

        <!-- Filters -->
        <div class="glass card" style="padding: 1.5rem; margin-bottom: 2rem; border-radius: 20px;">
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.25rem; align-items: end;">
                <div>
                    <label style="display: block; font-size: 0.7rem; font-weight: 800; color: var(--text-secondary); text-transform: uppercase; margin-bottom: 0.5rem;">Start Date</label>
                    <input type="date" id="history-start-date" class="glass-input" style="width: 100%;">
                </div>
                <div>
                    <label style="display: block; font-size: 0.7rem; font-weight: 800; color: var(--text-secondary); text-transform: uppercase; margin-bottom: 0.5rem;">End Date</label>
                    <input type="date" id="history-end-date" class="glass-input" style="width: 100%;">
                </div>
                <button id="apply-history-filter" class="btn-primary" style="height: 48px; border-radius: 12px; font-weight: 800;">
                    <i data-lucide="search" style="width: 18px;"></i> FILTER
                </button>
            </div>
        </div>

        <div id="sessions-list-container">
            <div style="text-align:center; padding: 3rem;"><div class="loader-spinner"></div></div>
        </div>
      </div>
    `

    if (window.lucide) window.lucide.createIcons({ root: historyContainer })

    document.getElementById('close-history-btn').onclick = () => {
      historyContainer.style.display = 'none'
      container.style.display = 'block'
      if (this.onBack) this.onBack()
    }

    await this.loadSessions()
    this.setupFilters()
  },

  async loadSessions() {
    try {
        const { history, error } = await DataService.getUserAnalytics(this.profile.id)
        if (error) throw error
        
        this.allSessions = history || []
        this.renderSessionsList(this.allSessions)
    } catch (err) {
        console.error("Failed to load sessions:", err)
        document.getElementById('sessions-list-container').innerHTML = `<p style="color: var(--error); text-align: center;">Failed to load history.</p>`
    }
  },

  setupFilters() {
    const applyBtn = document.getElementById('apply-history-filter')
    applyBtn.onclick = () => {
        const start = document.getElementById('history-start-date').value
        const end = document.getElementById('history-end-date').value
        
        if (!start && !end) {
            this.renderSessionsList(this.allSessions)
            return
        }

        const filtered = this.allSessions.filter(s => {
            const date = new Date(s.created_at)
            let match = true
            if (start) {
                const sDate = new Date(start)
                sDate.setHours(0,0,0,0)
                match = match && (date >= sDate)
            }
            if (end) {
                const eDate = new Date(end)
                eDate.setHours(23,59,59,999)
                match = match && (date <= eDate)
            }
            return match
        })
        
        this.renderSessionsList(filtered)
    }
  },

  renderSessionsList(sessions) {
    const list = document.getElementById('sessions-list-container')
    if (sessions.length === 0) {
        list.innerHTML = `
          <div style="text-align: center; padding: 4rem; opacity: 0.5;">
            <i data-lucide="calendar-x" style="width: 48px; height: 48px; margin-bottom: 1rem;"></i>
            <p style="font-weight: 600;">No sessions found for this period.</p>
          </div>
        `
        if (window.lucide) window.lucide.createIcons({ root: list })
        return
    }

    list.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 1rem;">
        ${sessions.map((s, i) => {
            const date = new Date(s.created_at).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
            const time = new Date(s.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
            const accuracy = s.score_percentage || 0
            const color = accuracy >= 75 ? 'var(--success)' : accuracy >= 50 ? 'var(--warning)' : 'var(--error)'
            
            return `
              <div class="glass card session-item scale-in" style="animation-delay: ${i * 0.05}s; padding: 1.25rem; display: flex; justify-content: space-between; align-items: center; border-left: 4px solid ${color};">
                <div style="flex: 1;">
                    <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem;">
                        <h4 style="margin: 0; font-weight: 800; color: var(--text-primary);">${date}</h4>
                        <span style="font-size: 0.65rem; color: var(--text-secondary); font-weight: 600; background: rgba(255,255,255,0.05); padding: 2px 6px; border-radius: 4px;">${time}</span>
                    </div>
                    <div style="font-size: 0.8rem; color: var(--text-secondary);">
                        ${s.answered_questions} Questions • ${Math.floor(s.time_taken_seconds / 60)}m ${s.time_taken_seconds % 60}s
                    </div>
                </div>
                <div style="text-align: right; margin-right: 1.5rem;">
                    <div style="font-size: 1.1rem; font-weight: 900; color: ${color};">${accuracy}%</div>
                    <div style="font-size: 0.6rem; color: var(--text-secondary); text-transform: uppercase; font-weight: 800;">Accuracy</div>
                </div>
                <button class="btn-secondary review-btn" data-session-idx="${this.allSessions.indexOf(s)}" style="padding: 0.5rem 1rem; border-radius: 8px; font-size: 0.75rem; font-weight: 800;">
                    REVIEW
                </button>
              </div>
            `
        }).join('')}
      </div>
    `

    list.querySelectorAll('.review-btn').forEach(btn => {
        btn.onclick = () => {
            const idx = btn.dataset.sessionIdx
            const session = this.allSessions[idx]
            this.reviewSession(session)
        }
    })

    if (window.lucide) window.lucide.createIcons({ root: list })
  },

  async reviewSession(session) {
    ModalService.alert("Session Details", `
      <div style="text-align: left; padding: 1rem 0;">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem;">
            <div class="glass" style="padding: 0.75rem; border-radius: 10px;">
                <label style="font-size: 0.6rem; opacity: 0.6;">SCORE</label>
                <div style="font-weight: 900; font-size: 1.25rem;">${session.correct_answers} / ${session.total_questions}</div>
            </div>
            <div class="glass" style="padding: 0.75rem; border-radius: 10px;">
                <label style="font-size: 0.6rem; opacity: 0.6;">ACCURACY</label>
                <div style="font-weight: 900; font-size: 1.25rem; color: var(--accent-primary);">${session.score_percentage}%</div>
            </div>
        </div>
        <p style="font-size: 0.85rem; color: var(--text-secondary);">Individual subject analysis for this session is stored in your Elite Insights dashboard.</p>
      </div>
    `)
  }
}
