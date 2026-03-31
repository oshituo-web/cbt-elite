import { DataService } from '../services/data'
import { AuthService } from '../services/auth'
import { WeeklyRecapComponent } from './WeeklyRecap'

export const DashboardComponent = {
  profile: null,
  onStartExam: null,

  async render(profile, onStartExam, onOpenAdmin, onReadNews) {
    this.profile = profile
    this.onStartExam = onStartExam
    this.onOpenAdmin = onOpenAdmin
    this.onReadNews = onReadNews
    const container = document.getElementById('dashboard-container')
    container.style.display = 'block'
    
    let history = []
    let mastery = []
    let newsItems = []

    try {
        // Preliminary data fetch for synchronous render injection
        const analytics = await DataService.getUserAnalytics(profile.id)
        history = analytics.history || []
        mastery = analytics.mastery || []
        
        const news = await DataService.getNewsUpdates(5)
        newsItems = news.data || []
    } catch (err) {
        console.error("Dashboard data fetch failed:", err)
    }
    
    // Calculate Progress and Daily Goal
    const today = new Date().toDateString()
    let todayQuestions = 0
    let totalQuestions = 0
    let totalScore = 0
    let accuracy = 0
    
    if (history && history.length > 0) {
        history.forEach(s => {
            if (s && s.created_at) {
                const hDate = new Date(s.created_at).toDateString()
                if (hDate === today) todayQuestions += (s.total_questions || 0)
                totalQuestions += (s.total_questions || 0)
                totalScore += (s.score_percentage || 0)
            }
        })
        accuracy = history.length > 0 ? Math.round(totalScore / history.length) : 0
    }
    
    const dailyGoalLimit = 50
    const dailyGoalPct = Math.min((todayQuestions / dailyGoalLimit) * 100, 100)
    
    // Determine Weak Subject
    let weakSubject = null
    if (mastery && mastery.length > 0) {
        try {
            weakSubject = mastery.reduce((prev, curr) => (prev.average < curr.average) ? prev : curr)
        } catch (e) {
            console.error("Weak subject determination failed", e)
        }
    }

    container.innerHTML = `
      <header class="flex-between" style="padding: 1.5rem 0; border-bottom: 1px solid var(--glass-border);">
        <h1 style="font-family: 'Outfit'; font-size: 1.5rem; color: var(--accent-primary);">CBT Elite</h1>

        <div style="display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 1rem;">
          <button id="help-guide-btn" class="glass" style="padding: 0; font-size: 1.25rem; border-radius: 50%; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; border: 1px solid var(--accent-secondary); color: var(--accent-secondary);">❔</button>
          <button id="theme-toggle" class="glass" style="padding: 0; font-size: 1.25rem; border-radius: 50%; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center;">🌓</button>
          ${(profile.role !== 'student' || profile.username === 'tester') ? '<button id="admin-panel-btn" class="btn-admin">Admin Control</button>' : ''}
          <div style="display: flex; gap: 1rem; align-items: center;">
            <div id="streak-badge" style="display: flex; align-items: center; gap: 0.4rem; background: rgba(255, 107, 0, 0.15); color: #FF6B00; padding: 0.3rem 0.8rem; border-radius: 20px; font-weight: 800; font-size: 0.8rem; border: 1px solid rgba(255, 107, 0, 0.3);">
               🔥 ${profile.streak_count || 0} DAY STREAK
            </div>
            <div id="user-tier-badge" style="padding: 0.25rem 0.65rem; border-radius: 6px; font-size: 0.75rem; font-weight: 900; letter-spacing: 0.05em; background: ${profile.tier === 'premium' ? 'var(--accent-secondary)' : '#475569'}; color: #fff; box-shadow: 0 2px 5px rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1);">
              ${profile.tier || 'FREE'}
            </div>
            <span style="font-size: 0.875rem;">Welcome, <strong>${profile.username}</strong></span>
            <button id="logout-btn" class="btn-secondary" style="padding: 0.5rem 1rem; font-size: 0.875rem;">Logout</button>
          </div>
        </div>
      </header>

      <div id="dashboard-content" style="margin-top: 2rem;">
        
        <!-- 🔥 1. Quick Action Section -->
        <div class="glass card" style="text-align: center; padding: 3rem 1.5rem; border: 2px solid var(--accent-primary); background: linear-gradient(135deg, var(--bg-secondary) 0%, var(--bg-color) 100%);">
          <h2 style="font-family: 'Outfit'; font-size: 2rem; margin-bottom: 0.5rem; color: var(--text-primary);">Start Practicing Now</h2>
          <p style="color: var(--text-secondary); margin-bottom: 2rem;">Select your preferred mode to continue training.</p>
          <div style="display: flex; justify-content: center; gap: 1rem; flex-wrap: wrap;">
             <button id="quick-practice-btn" class="primary" style="padding: 1.25rem 2rem; font-size: 1.25rem; font-weight: 800; min-width: 200px;">🎯 Practice Mode</button>
             <button id="quick-exam-btn" class="secondary" style="padding: 1.25rem 2rem; border: 2px solid var(--accent-secondary); background: transparent; color: var(--text-primary); font-size: 1.25rem; font-weight: 800; min-width: 200px; border-radius: 8px;">🏆 Mock Exam</button>
             <button id="start-saved" class="glass" style="padding: 1.25rem 2rem; border: 2.5px solid var(--accent-primary); font-size: 1.1rem; display: none; align-items: center; gap: 0.5rem; justify-content: center; min-width: 200px; font-weight: 700;">🔖 Saved (<span id="bookmark-count">0</span>)</button>
          </div>
        </div>

        <!-- 🚀 2. Premium Upgrade Section -->
        ${profile.tier !== 'premium' ? `
        <div class="glass card" style="margin-top: 1.5rem; padding: 2rem; border-left: 6px solid var(--accent-secondary); display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 1.5rem; background: var(--accent-secondary)0D;">
           <div>
             <h3 style="font-family: 'Outfit'; font-size: 1.5rem; color: var(--accent-secondary); margin-bottom: 0.5rem;">Unlock Premium CBT Elite</h3>
             <ul style="font-size: 0.9rem; color: var(--text-secondary); line-height: 1.6; list-style: none; padding: 0;">
                <li><strong style="color: var(--success);">✔</strong> Unlimited Subject Practice</li>
                <li><strong style="color: var(--success);">✔</strong> Detailed AI Corrections & Step-by-Step Tutors</li>
                <li><strong style="color: var(--success);">✔</strong> Full WAEC / JAMB Mock Engine Access (Unlimited)</li>
             </ul>
           </div>
           <div style="text-align: right;">
             <div style="font-size: 0.85rem; margin-bottom: 0.5rem; opacity: 0.8;">${profile.ai_credits || 5} Free AI Credits Remaining</div>
             <button id="upgrade-hero-btn" class="primary" style="background: var(--accent-secondary); box-shadow: 0 4px 15px var(--accent-secondary)4D;">Upgrade Now</button>
           </div>
        </div>
        ` : ''}

        <!-- 📊 3. Progress Summary & 🎯 4. Daily Goal Tracker -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.5rem; margin-top: 1.5rem;">
           <div class="glass card" style="padding: 1.5rem; border-top: 4px solid var(--primary);">
             <h3 style="margin-bottom: 1rem; color: var(--text-secondary); font-size: 0.9rem;">Your Progress Overview</h3>
             <div style="display: flex; justify-content: space-between; align-items: flex-end;">
               <div>
                  <div style="font-size: 2.5rem; font-family: 'Outfit'; font-weight: 800; color: #3B82F6; line-height: 1;">${totalQuestions}</div>
                  <div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 0.25rem;">Total Questions</div>
               </div>
                <div style="text-align: right;">
                   <div style="font-size: 1.5rem; font-family: 'Outfit'; font-weight: 800; color: #3B82F6; line-height: 1;">${history.length > 0 ? accuracy + '%' : '--'}</div>
                   <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.25rem;">
                      Avg Accuracy <span style="opacity: 0.6; font-size: 0.65rem;">(Global: 68%)</span>
                   </div>
                </div>
             </div>
             <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-top: 1.5rem;">
                <button id="view-leaderboard" class="glass" style="padding: 0.5rem; font-size: 0.75rem; font-weight: 800; border: 1px solid var(--accent-primary); color: var(--accent-primary); border-radius: 6px;">🏆 GLOBAL RANKINGS</button>
                <button id="performance-insights-btn" class="glass" style="padding: 0.5rem; font-size: 0.75rem; font-weight: 800; border: 1px solid var(--accent-secondary); color: var(--accent-secondary); border-radius: 6px;">📊 PERFORMANCE INSIGHTS</button>
              </div>
           </div>

           <div class="glass card" style="padding: 1.5rem; border-top: 4px solid var(--success);">
             <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                <h3 style="font-size: 0.9rem; color: var(--text-secondary);">Daily Practice Goal</h3>
                <span style="font-size: 0.8rem; font-weight: 800; color: var(--success);">${todayQuestions} / ${dailyGoalLimit}</span>
             </div>
             <p style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 1rem;">Complete ${dailyGoalLimit} questions every day to master the syllabus.</p>
             <div style="width: 100%; height: 12px; background: var(--bg-secondary); border-radius: 6px; overflow: hidden; border: 1px solid var(--glass-border);">
                <div style="height: 100%; width: ${dailyGoalPct}%; background: var(--success); border-radius: 6px; transition: width 0.5s ease;"></div>
             </div>
           </div>
        </div>

        <!-- ⚠️ 5. Weak Subject Alert -->
        ${weakSubject ? `
        <div class="glass card" style="margin-top: 1.5rem; padding: 1.25rem 1.5rem; border-left: 4px solid var(--warning); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; background: var(--warning)0D;">
          <div>
             <h3 style="font-size: 1rem; margin-bottom: 0.25rem; color: var(--warning); display: flex; align-items: center; gap: 0.5rem;">⚠️ Weak Area Detected: ${weakSubject.subject}</h3>
             <p style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 0.5rem;">Your average score in this subject is ${weakSubject.average}%. Focus on this area to boost your overall ranking.</p>
             <div style="font-size: 0.75rem; color: var(--accent-primary); font-style: italic; background: rgba(59, 130, 246, 0.05); padding: 0.5rem; border-radius: 4px; display: inline-block;">
                🤖 AI Pro Tip: ${weakSubject.subject === 'English' ? 'Focus on Comprehension and Lexis.' : 'Review your fundamental definitions and recent past questions.'}
             </div>
          </div>
          <button id="practice-weak-btn" data-subject="${weakSubject.subject}" class="primary" style="background: #2563EB; padding: 0.75rem 1.5rem; font-size: 0.9rem; font-weight: 800; box-shadow: 0 4px 10px rgba(37, 99, 235, 0.3);">Practice Now</button>
        </div>
        ` : ''}

        <!-- 📰 6. News & Updates System -->
        <div class="glass card" style="margin-top: 1.5rem; padding: 1.5rem;">
          <h2 style="font-family: 'Outfit'; font-size: 1.25rem; margin-bottom: 1.25rem; display: flex; justify-content: space-between; align-items: center;">
            <span>📢 Exam Updates & News</span>
          </h2>
          <div id="news-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem;">
             ${(!newsItems || newsItems.length === 0) ? '<p style="font-size: 0.85rem; color: var(--text-secondary);">No updates available at this time.</p>' : 
                 newsItems.map(news => `
                    <div class="news-ui-card" data-news='${JSON.stringify({ ...news, content: (news.content || "").replace(/'/g, "&#39;") })}' style="padding: 1rem; background: var(--bg-secondary)4D; border: 1px solid var(--glass-border); border-radius: 8px; cursor: pointer; transition: transform 0.2s; border-left: 3px solid var(--primary);">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                            <div style="font-size: 0.65rem; padding: 0.2rem 0.5rem; background: var(--primary)33; color: var(--primary); display: inline-block; border-radius: 4px; font-weight: 800;">${news.category || 'NEWS'}</div>
                            ${news.attachment_url ? `<span style="font-size: 0.8rem; color: #60a5fa;" title="Contains PDF Attachment">📎</span>` : ''}
                        </div>
                        <h4 style="font-family: 'Outfit'; margin-bottom: 0.5rem; font-size: 1rem; line-height: 1.3;">${news.title}</h4>
                        <p style="font-size: 0.8rem; color: var(--text-secondary); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${news.summary || news.content}</p>
                    </div>
                 `).join('')}
          </div>
        </div>

        <!-- 📚 7. Exam Selection (Existing) -->
        <div style="margin-top: 3rem; border-top: 1px dashed var(--glass-border); padding-top: 2rem;">
            <div class="dashboard-tabs" style="display: flex; gap: 1rem; margin-bottom: 1.5rem;">
              <button id="view-practice" class="nav-tab active" style="flex: 1;">🎯 Practice Mode</button>
              <button id="view-exam" class="nav-tab" style="flex: 1;">🏆 Exam Mode</button>
            </div>
            
            <div id="resume-container" style="display: none; margin-bottom: 2rem;">
              <div class="glass card" style="border-left: 4px solid var(--accent-secondary); background: var(--bg-secondary); display: flex; justify-content: space-between; align-items: center; padding: 1.5rem;">
                <div>
                  <h3 style="margin-bottom: 0.25rem;">Resume Unfinished Session</h3>
                  <p id="resume-info" style="font-size: 0.85rem; color: var(--text-secondary);">You have a pending exam from 2 minutes ago.</p>
                </div>
                <div style="display: flex; gap: 0.75rem;">
                  <button id="discard-resume" class="btn-secondary" style="font-size: 0.8rem;">Discard</button>
                  <button id="confirm-resume" class="btn-primary">Resume Now</button>
                </div>
              </div>
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

              <!-- Practice Config -->
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
                <div class="glass card exam-tier" data-exam="JAMB" style="border-top: 4px solid var(--primary); cursor: pointer;">
                  <h3>JAMB Mock</h3>
                  <p style="font-size: 0.875rem; color: var(--text-primary);">180 Questions | 120 Mins</p>
                </div>
                <div class="glass card exam-tier" data-exam="WAEC" style="border-top: 4px solid var(--accent-secondary); cursor: pointer;">
                  <h3>WAEC Mock</h3>
                  <p style="font-size: 0.875rem; color: var(--text-primary);">Standard Full Exam</p>
                </div>
                <div class="glass card exam-tier" data-exam="NECO" style="border-top: 4px solid var(--success); cursor: pointer;">
                  <h3>NECO Mock</h3>
                  <p style="font-size: 0.875rem; color: var(--text-primary);">Standard Full Exam</p>
                </div>
              </div>

              <!-- Exam Config -->
              <div id="exam-config" class="glass card" style="display: none; margin-top: 2rem; padding: 2rem;">
                <h3 id="exam-title" style="margin-bottom: 1.5rem;">Setup Mock Exam</h3>
                
                <div id="jamb-exam-config" style="display: none;">
                    <p style="margin-bottom: 1rem; color: var(--primary);">English is mandatory. Select 3 additional subjects.</p>
                    <div id="jamb-sub-list" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; max-height: 200px; overflow-y: auto; padding: 1rem; background: var(--bg-color); border-radius: 8px;">
                    </div>
                </div>

                <div id="waec-neco-exam-config" style="display: none;">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
                        <div>
                            <label style="display: block; font-size: 0.875rem; margin-bottom: 0.5rem; color: var(--text-primary);">Subject</label>
                            <select id="e-subject" class="glass-select" style="width: 100%;"></select>
                        </div>
                        <div>
                            <label style="display: block; font-size: 0.875rem; margin-bottom: 0.5rem; color: var(--text-primary);">Type</label>
                            <select id="e-type" class="glass-select" style="width: 100%;">
                                <option value="objective">Objective</option>
                                <option value="theory">Theory</option>
                            </select>
                        </div>
                    </div>
                </div>
                <button id="e-start-btn" class="primary" style="margin-top: 2rem; width: 100%;">Begin Mock Exam</button>
              </div>
            </div>
        </div>

        <!-- 📈 8. Performance Insights Section -->
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

      <!-- Leaderboard Modal -->
      <div id="leaderboard-modal" class="modal-overlay" style="display: none; align-items: center; justify-content: center; padding: 1rem; z-index: 1000;">
        <div class="modal-content glass" style="max-width: 500px; width: 100%; position: relative; padding: 2rem;">
          <button id="close-leaderboard" style="position: absolute; top: 1rem; right: 1rem; background: none; border: none; font-size: 1.5rem; cursor: pointer; color: var(--text-primary);">&times;</button>
          <h2 style="font-family: 'Outfit'; margin-bottom: 1.5rem; text-align: center; color: var(--accent-primary);">🏆 Global Rankings</h2>
          <div id="leaderboard-list" style="margin-top: 1rem;">
            <div style="text-align: center; padding: 2rem; color: var(--text-secondary);">Loading rankings...</div>
          </div>
        </div>
      </div>

      <!-- Upgrade Modal (Moved to 🚀 Premium Section logic visually but physically kept modal logic intact) -->
      <div id="upgrade-modal" class="modal-overlay" style="display: none; align-items: center; justify-content: center; padding: 1rem; z-index: 1000;">
        <div class="modal-content glass" style="max-width: 450px; width: 100%; position: relative; padding: 2.5rem; text-align: center;">
          <button id="close-upgrade" style="position: absolute; top: 1rem; right: 1rem; background: none; border: none; font-size: 1.5rem; cursor: pointer; color: var(--text-primary);">&times;</button>
          <div style="font-size: 3rem; margin-bottom: 1rem;">🚀</div>
          <h2 style="font-family: 'Outfit'; margin-bottom: 0.5rem; color: var(--accent-secondary);">Go Premium</h2>
          <p style="color: var(--text-secondary); margin-bottom: 2rem; font-size: 0.95rem;">Unlock the complete curriculum, unlimited AI explanations, and theory grading.</p>
          
          <div class="glass" style="padding: 1.5rem; border: 2px solid var(--accent-secondary); border-radius: 12px; margin-bottom: 2rem; background: var(--accent-secondary)0D;">
             <div style="font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.5rem;">BEST VALUE</div>
             <div style="font-size: 2rem; font-weight: 800; font-family: 'Outfit';">₦2,500 <span style="font-size: 1rem; font-weight: 400; opacity: 0.7;">/ lifetime</span></div>
             <ul style="text-align: left; margin: 1rem 0; font-size: 0.85rem; padding-left: 1rem;">
               <li>📌 Full Access to JAMB/WAEC/NECO</li>
               <li>🤖 500 AI Assistant Credits</li>
               <li>📈 Advanced Mastery Analytics</li>
             </ul>
          </div>
          
          <button id="paystack-btn" class="primary" style="width: 100%; padding: 1rem; font-size: 1rem;">Secure Upgrade with Paystack</button>
          <p style="font-size: 0.7rem; color: var(--text-secondary); margin-top: 1rem;">Instant activation upon successful payment.</p>
        </div>
      </div>

      <!-- Help & Guide Modal -->
      <div id="help-modal" class="modal-overlay" style="display: none; align-items: center; justify-content: center; padding: 1rem; z-index: 1000;">
        <div class="modal-content glass" style="max-width: 500px; width: 100%; position: relative; padding: 2.5rem; max-height: 85vh; overflow-y: auto;">
          <button id="close-help" style="position: absolute; top: 1rem; right: 1rem; background: none; border: none; font-size: 1.5rem; cursor: pointer; color: var(--text-primary);">&times;</button>
          <h2 style="font-family: 'Outfit'; margin-bottom: 2rem; text-align: center; color: var(--accent-primary);">📖 How to Use CBT Elite</h2>
          <div style="display: flex; flex-direction: column; gap: 1.5rem;">
             <!-- Simplified Help Content -->
             <div style="padding: 1rem; background: var(--bg-secondary)33; border-radius: 8px;">
               <h4 style="color: var(--accent-primary);">🎯 Start Practice</h4>
               <p style="font-size: 0.85rem;">Select your exam type and pick specific topics to master your weak zones.</p>
             </div>
             <div style="padding: 1rem; background: var(--bg-secondary)33; border-radius: 8px;">
               <h4 style="color: var(--primary);">🏆 Mock Exams</h4>
               <p style="font-size: 0.85rem;">Simulate real exam formats. E.g. JAMB mimics the true 180 questioning format using rigorous timing.</p>
             </div>
             <div style="padding: 1rem; background: var(--warning)1A; border: 1px dashed var(--warning); border-radius: 8px;">
               <h4 style="color: var(--warning);">💡 AI Assistant</h4>
               <p style="font-size: 0.85rem;">If you get a question wrong, click "View Explanation" to have AI step you through the formula.</p>
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

    const upgradeHeroBtn = document.getElementById('upgrade-hero-btn')
    const upgradeModal = document.getElementById('upgrade-modal')
    const closeUpgrade = document.getElementById('close-upgrade')
    const payBtn = document.getElementById('paystack-btn')

    if (upgradeHeroBtn) {
       upgradeHeroBtn.onclick = () => upgradeModal.style.display = 'flex'
    }
    if (closeUpgrade) {
       closeUpgrade.onclick = () => upgradeModal.style.display = 'none'
    }

    if (payBtn) {
      payBtn.onclick = () => {
        // IMPORTANT: USER should update this KEY in settings or env
        const PAYSTACK_PUBLIC_KEY = 'pk_test_placeholder_key_replace_me' 
        
        const handler = PaystackPop.setup({
          key: PAYSTACK_PUBLIC_KEY,
          email: profile.email,
          amount: 250000, // 2500 Naira
          currency: 'NGN',
          callback: async (response) => {
            payBtn.disabled = true
            payBtn.textContent = 'Verifying Transaction...'
            
            // Logic: Upgrade user upon success
            const { error } = await DataService.upgradeUserTier(profile.id, 'premium', 500)
            if (!error) {
               alert("✨ Congratulations! Your account has been upgraded to PREMIUM.")
               location.reload()
            } else {
               alert("Upgrade synchronization failed. Please contact support with ref: " + response.reference)
            }
          },
          onClose: () => {
            alert('Transaction cancelled. Your practice session remains free tier.')
          }
        });
        handler.openIframe();
      }
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
            document.getElementById('p-topic-wrapper').style.display = 'block'
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
            pSub?.appendChild(opt.cloneNode(true))
            eSub?.appendChild(opt)

            if (s.subject_name.toLowerCase() !== 'english') {
                const label = document.createElement('label')
                label.style.display = 'flex'; label.style.alignItems = 'center'; label.style.gap = '0.5rem'; label.style.fontSize = '0.8rem';
                label.innerHTML = `<input type="checkbox" class="jamb-sub-check" value="${s.id}" data-name="${s.subject_name}"> ${s.subject_name}`
                jambList?.appendChild(label)
            }
        })

        // Topic loader for JAMB Practice
        pSub?.addEventListener('change', async () => {
            const { data: topics } = await DataService.getTopics(pSub.value)
            const pTopic = document.getElementById('p-topic')
            if (pTopic) {
                pTopic.innerHTML = '<option value="">All Topics</option>'
                if (topics) topics.forEach(t => pTopic.appendChild(new Option(t, t)))
            }
        })

        // Start Practice
        document.getElementById('p-start-btn')?.addEventListener('click', async () => {
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
        })

        // Start Mock Exam
        document.getElementById('e-start-btn')?.addEventListener('click', async () => {
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
        })

        // Bookmarks
        const { count: bCount } = await DataService.getBookmarkCount(profile.id)
        const bCountEl = document.getElementById('bookmark-count')
        if (bCountEl) bCountEl.textContent = bCount || 0
        
        if (bCount > 0) {
            const bBtn = document.getElementById('start-saved')
            if (bBtn) {
                bBtn.style.display = 'flex'
                bBtn.disabled = false
                bBtn.onclick = async () => {
                    bBtn.textContent = 'Gathering Bookmarks...'
                    const { data } = await DataService.getBookmarks(profile.id)
                    bBtn.innerHTML = `🔖 Saved (<span id="bookmark-count">${bCount}</span>)`
                    if (data && data.length > 0) {
                        this.onStartExam(data, 'saved', 'Saved Questions', 'Collection')
                    } else {
                        alert("No questions found in bookmarks.")
                    }
                }
            }
        }

        // Leaderboard
        const leaderboardBtn = document.getElementById('view-leaderboard')
        const leaderboardModal = document.getElementById('leaderboard-modal')
        const leaderboardList = document.getElementById('leaderboard-list')
        const closeLeaderboard = document.getElementById('close-leaderboard')

        if (leaderboardBtn) {
            leaderboardBtn.onclick = async () => {
              if (leaderboardModal) leaderboardModal.style.display = 'flex'
              if (leaderboardList) leaderboardList.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--text-secondary);">Loading rankings...</div>'
              
              const { data, error } = await DataService.getLeaderboard()
              if (error || !data || data.length === 0) {
                if (leaderboardList) leaderboardList.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--text-secondary);">No rankings available yet. Be the first!</div>'
                return
              }
    
              if (leaderboardList) {
                  leaderboardList.innerHTML = `
                    <table style="width: 100%; border-collapse: collapse;">
                      <thead>
                        <tr style="border-bottom: 2px solid var(--glass-border); text-align: left; color: var(--text-secondary); font-size: 0.8rem;">
                          <th style="padding: 0.75rem;">RANK</th>
                          <th style="padding: 0.75rem;">USER</th>
                          <th style="padding: 0.75rem; text-align: right;">QUESTIONS</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${data.map((entry, i) => `
                          <tr style="border-bottom: 1px solid var(--glass-border); ${entry.users?.username === profile.username ? 'background: var(--primary)1A;' : ''}">
                            <td style="padding: 1rem; font-weight: 700;">#${i + 1}</td>
                            <td style="padding: 1rem; display: flex; align-items: center; gap: 0.75rem;">
                              <div class="glass" style="width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.6rem; font-weight: 900; background: var(--border-color);">
                                ${entry.users?.username?.charAt(0).toUpperCase() || '?'}
                              </div>
                              <span style="font-weight: 600;">${entry.users?.username || 'Anonymous'}</span>
                            </td>
                            <td style="padding: 1rem; text-align: right; font-weight: 700; color: var(--primary);">${entry.total_questions_answered || 0}</td>
                          </tr>
                        `).join('')}
                      </tbody>
                    </table>
                  `
              }
            }
        }

        if (closeLeaderboard) {
            closeLeaderboard.onclick = () => {
              if (leaderboardModal) leaderboardModal.style.display = 'none'
            }
        }

        // Performance Insights Recap
        const insightsBtn = document.getElementById('performance-insights-btn')
        if (insightsBtn) {
            insightsBtn.onclick = async () => {
                const { history, mastery } = await DataService.getUserAnalytics(profile.id)
                const { data: stats } = await DataService.getGlobalStats(profile.id)
                WeeklyRecapComponent.render(history?.[0] || {}, stats, mastery)
            }
        }

        // Resume Session Logic
        const resumeContainer = document.getElementById('resume-container')
        const savedStateJson = localStorage.getItem('cbt_active_exam')
        if (savedStateJson) {
           try {
             const state = JSON.parse(savedStateJson)
             // Only show if it's less than 24 hours old
             if (Date.now() - state.timestamp < 24 * 60 * 60 * 1000) {
                resumeContainer.style.display = 'block'
                const timeAgo = Math.round((Date.now() - state.timestamp) / 60000)
                document.getElementById('resume-info').textContent = `${state.examType} ${state.mode}: Last activity ${timeAgo}m ago.`
                
                document.getElementById('confirm-resume').onclick = () => {
                  this.onStartExam(state.questions, state.mode, state.subject, state.examType, state, false)
                }
                
                document.getElementById('discard-resume').onclick = () => {
                   localStorage.removeItem('cbt_active_exam')
                   resumeContainer.style.display = 'none'
                }
             } else {
               localStorage.removeItem('cbt_active_exam')
             }
           } catch(e) { 
             localStorage.removeItem('cbt_active_exam')
           }
        }
        
        window.onclick = (e) => {
          if (e.target === leaderboardModal) leaderboardModal.style.display = 'none'
        }

        // Phase 3: Charts
        this.renderCharts(profile.id)

      } catch (err) {
        console.error("Dashboard init error:", err)
      }
    }

    // Help Modal Logic
    const helpBtn = document.getElementById('help-guide-btn')
    const helpModal = document.getElementById('help-modal')
    const helpClose = document.getElementById('close-help')
    if (helpBtn) helpBtn.onclick = () => helpModal.style.display = 'flex'
    if (helpClose) helpClose.onclick = () => helpModal.style.display = 'none'

    // 🔥 Quick Action Listeners
    const quickPracticeBtn = document.getElementById('quick-practice-btn')
    const quickExamBtn = document.getElementById('quick-exam-btn')
    const weakPracticeBtn = document.getElementById('practice-weak-btn')

    if (quickPracticeBtn) {
        quickPracticeBtn.onclick = () => {
            document.getElementById('view-practice')?.click()
            document.getElementById('practice-section')?.scrollIntoView({ behavior: 'smooth' })
        }
    }
    if (quickExamBtn) {
        quickExamBtn.onclick = () => {
            document.getElementById('view-exam')?.click()
            document.getElementById('exam-section')?.scrollIntoView({ behavior: 'smooth' })
        }
    }
    if (weakPracticeBtn) {
        weakPracticeBtn.onclick = () => {
             // Find matching tier card and trigger it
             const targetTier = document.querySelector('.practice-tier[data-exam="JAMB"]') // default mapping
             if (targetTier) targetTier.click()
             document.getElementById('view-practice')?.click()
             // Auto-select weak subject if possible after initData runs
             setTimeout(() => {
                 const pSub = document.getElementById('p-subject')
                 if (pSub) {
                     for(let i=0; i < pSub.options.length; i++) {
                         if (pSub.options[i].text.toLowerCase() === weakSubject.subject.toLowerCase() || pSub.options[i].text.includes(weakSubject.subject)) {
                             pSub.selectedIndex = i
                             pSub.dispatchEvent(new Event('change'))
                             break;
                         }
                     }
                 }
                 document.getElementById('practice-config').scrollIntoView({ behavior: 'smooth' })
             }, 500)
        }
    }

    // 📰 News Reader Logic
    const newsCards = document.querySelectorAll('.news-ui-card')
    newsCards.forEach(card => {
        card.onclick = () => {
            const articleData = JSON.parse(card.dataset.news)
            if (this.onReadNews) this.onReadNews(articleData)
        }
    })

    // Store intervals for cleanup if necessary
    this.activeIntervals = []

    initData()
  },

  async renderCharts(userId) {
    const { history, mastery, error } = await DataService.getUserAnalytics(userId)
    if (error || (!history.length && !mastery.length)) {
      // Show empty state if no data
      document.getElementById('analytics-section').style.opacity = '0.5'
      return
    }
    document.getElementById('analytics-section').style.opacity = '1'

    // Get current theme colors
    const style = getComputedStyle(document.body)
    const isLightMode = document.body.classList.contains('light-mode')
    
    const textPrimary = style.getPropertyValue('--text-primary').trim() || '#F9FAFB'
    const successColor = style.getPropertyValue('--success').trim() || '#10B981'
    const primaryColor = style.getPropertyValue('--primary').trim() || '#2563EB'
    const borderColor = style.getPropertyValue('--border-color').trim() || '#334155'
    
    // Grid color logic for better contrast in light mode
    // Grid color logic for better contrast in light mode and dark mode
    const chartGridColor = isLightMode ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.25)'

    // 1. Score History Chart
    const historyCtx = document.getElementById('score-history-chart').getContext('2d')
    new Chart(historyCtx, {
      type: 'line',
      data: {
        labels: history.map((_, i) => i + 1),
        datasets: [{
          label: 'Score %',
          data: history.map(h => h.score_percentage),
          borderColor: successColor,
          backgroundColor: isLightMode ? successColor + '33' : successColor + '1A', 
          fill: true,
          tension: 0.4,
          borderWidth: 3,
          pointRadius: 4,
          pointBackgroundColor: isLightMode ? successColor : '#fff'
        }]
      },
      options: {
        responsive: true,
        plugins: { 
          legend: { display: false },
          tooltip: {
            backgroundColor: isLightMode ? '#fff' : '#1E293B',
            titleColor: isLightMode ? '#111827' : '#F9FAFB',
            bodyColor: isLightMode ? '#4B5563' : '#CBD5F5',
            borderColor: isLightMode ? '#E5E7EB' : 'transparent',
            borderWidth: 1
          }
        },
        scales: {
          y: { 
            beginAtZero: true, 
            max: 100, 
            grid: { color: chartGridColor }, 
            ticks: { color: textPrimary, font: { weight: 'bold' } }
          },
          x: { 
            grid: { display: false }, 
            ticks: { color: textPrimary }
          }
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
          backgroundColor: isLightMode ? primaryColor + '4D' : primaryColor + '33', // 30% vs 20%
          borderColor: primaryColor,
          borderWidth: 3,
          pointBackgroundColor: primaryColor,
          pointBorderColor: '#fff',
          pointBorderWidth: 1
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          r: {
            angleLines: { color: chartGridColor },
            grid: { color: chartGridColor },
            pointLabels: { 
              color: '#3B82F6', 
              font: { size: 14, weight: '900' },
              padding: 15
            },
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


