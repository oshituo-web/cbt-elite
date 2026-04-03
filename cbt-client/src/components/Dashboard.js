import { DataService } from '../services/data'
import { AuthService } from '../services/auth'
import { WeeklyRecapComponent } from './WeeklyRecap'
import { TourGuide } from '../utils/TourGuide'
import { SubscriptionService } from '../services/subscriptionService'
import { SubscriptionManager } from '../utils/subscriptionManager'

export const DashboardComponent = {
  profile: null,
  onStartExam: null,

  async render(profile, onStartExam, onOpenAdmin, onReadNews) {
    // Handle Tier Transitions & Daily Resets
    const updatedUser = await SubscriptionService.handleTierTransition(profile)
    this.profile = updatedUser || profile
    this.onStartExam = onStartExam
    this.onOpenAdmin = onOpenAdmin
    this.onReadNews = onReadNews
    const container = document.getElementById('dashboard-container')
    container.style.display = 'block'
    
    let history = []
    let mastery = []
    let newsItems = []
    let isSystemFree = false

    try {
        // Preliminary data fetch for synchronous render injection
        const analytics = await DataService.getUserAnalytics(profile.id)
        history = analytics.history || []
        mastery = analytics.mastery || []
        
        const news = await DataService.getNewsUpdates(5)
        newsItems = news.data || []

        const configResp = await DataService.getSystemConfig('explanations_free_access')
        isSystemFree = configResp.data?.value === true || configResp.data?.value === 'true'
    } catch (err) {
        console.error("Dashboard data fetch failed:", err)
    }

    // Initialize Tour Guide
    TourGuide.init([
      { title: "Welcome to CBT Elite", text: "Your all-in-one platform to prepare for JAMB, WAEC, and NECO." },
      { element: "#quick-practice-btn", title: "Practice Mode", text: "Start here. Practice Mode helps you improve topic by topic." },
      { element: "#quick-exam-btn", title: "Exam Mode", text: "Simulate real exams with timers and scoring." },
      { element: "#analytics-section", title: "Performance Insights", text: "Track your scores and identify weak subjects." },
      { element: "#upgrade-hero-btn", title: "Upgrade Section", text: "Unlock AI explanations and unlimited access with Premium." },
      { element: "#feature-review-item", title: "Review Questions", text: "After any test or practice, tap 'Review Questions' to see correct answers and detailed explanations." },
      { title: "You're all set", text: "You're ready to start your journey. Good luck!" }
    ], {
      onFinish: () => {
        DataService.markTourAsSeen(profile.id)
        sessionStorage.removeItem('isFreshSignup')
      }
    });
    
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
    
    // Determine Achievements
    const badges = [];
    if (profile.streak_count >= 7) badges.push({ emoji: '🔥', title: '7-Day Streak' });
    if (totalQuestions >= 500) badges.push({ emoji: '🛡️', title: 'Veteran' });
    if (accuracy >= 80 && history.length >= 5) badges.push({ emoji: '🎯', title: 'Sharpshooter' });
    if (profile.is_activated) badges.push({ emoji: '💎', title: 'Activated' });

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
            <div id="user-tier-badge" style="padding: 0.25rem 0.65rem; border-radius: 6px; font-size: 0.75rem; font-weight: 900; letter-spacing: 0.05em; background: ${SubscriptionService.resolveUserTier(profile, isSystemFree) === 'premium' ? 'var(--accent-secondary)' : '#475569'}; color: var(--text-primary); box-shadow: 0 2px 5px rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1);">
              ${SubscriptionService.resolveUserTier(profile, isSystemFree).toUpperCase()}
            </div>
            
            <!-- 🏆 New Achievement Badges -->
            <div id="achievement-badges" style="display: flex; gap: 0.5rem; margin-right: 0.5rem;">
              ${badges.map(b => `<span title="${b.title}" style="cursor: help; opacity: 0.9; font-size: 1.1rem;">${b.emoji}</span>`).join('')}
            </div>

            <span style="font-size: 0.875rem;">Welcome, <strong>${profile.username}</strong></span>
            <button id="logout-btn" class="btn-secondary" style="padding: 0.5rem 1rem; font-size: 0.875rem;">Logout</button>
          </div>
        </div>
      </header>

      <div id="dashboard-content" class="dashboard-scroll-area">
        
        <!-- 🔖 0. FEATURED: High-Priority Resume Card -->
        <div class="glass card scale-in" style="margin-bottom: 2rem; border-left: 5px solid var(--accent-primary);">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
            <div>
                <h3 style="font-family: 'Outfit'; margin-bottom: 0.25rem;">\u2728 AI Custom Workout</h3>
                <p id="ai-workout-hint" style="font-size: 0.8rem; color: var(--text-secondary);">Targeting your mastery gaps automatically...</p>
            </div>
            <span class="badge" style="background: var(--accent-primary); font-size: 0.7rem;">RECOMMENDED</span>
          </div>
          <button id="start-ai-workout" class="primary" style="width: 100%; padding: 0.8rem; display: flex; align-items: center; justify-content: center; gap: 0.5rem; color: #ffffff !important;">
            <span style="color: #ffffff !important;">\uD83D\uDE80 Start Personalized Session</span>
          </button>
        </div>

        <div id="resume-container" style="display: none; margin-bottom: 2rem;">
              <div class="glass card scale-in" style="border-left: 5px solid var(--accent-secondary); background: linear-gradient(135deg, rgba(147, 51, 234, 0.1) 0%, var(--bg-secondary) 100%); display: flex; justify-content: space-between; align-items: center; padding: 1rem; box-shadow: 0 10px 20px rgba(0,0,0,0.2);">
                <div style="display: flex; align-items: center; gap: 1rem;">
                  <div style="font-size: 2rem;">⏳</div>
                  <div>
                    <h3 style="margin-bottom: 0.25rem; font-family: 'Outfit'; color: var(--accent-secondary);">Continue Your Session</h3>
                    <p id="resume-info" style="font-size: 0.85rem; color: var(--text-secondary);">Pick up exactly where you left off.</p>
                  </div>
                </div>
                <div style="display: flex; gap: 0.75rem;">
                  <button id="discard-resume" class="btn-secondary" style="font-size: 0.8rem; border: none; background: transparent; opacity: 0.6;">Discard</button>
                  <button id="confirm-resume" class="btn-primary" style="background: var(--accent-secondary); box-shadow: 0 4px 12px rgba(147, 51, 234, 0.4);">Resume Now</button>
                </div>
              </div>
        </div>

        <!-- Dynamic Tier-Based UI -->
        ${(() => {
          const subState = SubscriptionManager.getUserSubscriptionState(profile, isSystemFree);
          const ActivationCard = () => `
            <div class="glass card scale-in" style="margin-bottom: 2rem; padding: 1rem 1.25rem; border: 1.5px solid var(--accent-primary); background: linear-gradient(90deg, rgba(59, 130, 246, 0.05) 0%, rgba(147, 51, 234, 0.05) 100%); border-radius: 16px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
              <div style="flex: 1; min-width: 250px;">
                <h4 style="font-family: 'Outfit'; color: var(--text-primary); margin-bottom: 0.25rem; font-size: 1.1rem;">🔓 Activate Full Access</h4>
                <p style="font-size: 0.85rem; color: var(--text-secondary);">Pay ₦1,500 once to unlock more features + 30 days Premium access.</p>
              </div>
              <button class="primary" style="padding: 0.75rem 1.5rem; font-size: 0.9rem;" onclick="document.getElementById('upgrade-modal').style.display='flex'">
                Activate Lifetime Access – ₦1,500
              </button>
            </div>
          `;

          const RenewalCard = () => `
            <div class="glass card scale-in" style="margin-bottom: 2rem; padding: 1rem 1.25rem; border: 1.5px solid var(--accent-secondary); background: linear-gradient(90deg, rgba(147, 51, 234, 0.05) 0%, rgba(59, 130, 246, 0.05) 100%); border-radius: 16px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
              <div style="flex: 1; min-width: 250px;">
                <h4 style="font-family: 'Outfit'; color: var(--text-primary); margin-bottom: 0.25rem; font-size: 1.1rem;">🚀 Renew Premium Access</h4>
                <p style="font-size: 0.85rem; color: var(--text-secondary);">Get AI explanations, unlimited exams and full access for ₦1,000/month.</p>
              </div>
              <button class="primary" style="padding: 0.75rem 1.5rem; font-size: 0.9rem; background: var(--accent-secondary);" onclick="document.getElementById('upgrade-modal').style.display='flex'">
                Renew Premium – ₦1,000/month
              </button>
            </div>
          `;

          if (subState.tier === "premium") {
            if (subState.daysRemaining <= 5) {
              return `
                <div class="glass card scale-in" style="margin-bottom: 2rem; padding: 1rem 1.5rem; border: 1px solid var(--warning); background: rgba(255, 152, 0, 0.05); border-radius: 12px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
                  <div style="flex: 1;">
                    <h4 style="font-family: 'Outfit'; color: var(--warning); margin: 0 0 0.25rem 0; font-size: 1rem;">⚠️ Expiring Soon</h4>
                    <p style="font-size: 0.75rem; color: var(--text-secondary); margin: 0;">Your Premium expires in ${subState.daysRemaining} days. Renew to avoid losing premium access.</p>
                  </div>
                  <button class="primary" style="padding: 0.5rem 1rem; font-size: 0.8rem; background: var(--warning);" onclick="document.getElementById('upgrade-modal').style.display='flex'">
                    Renew Premium – ₦1,000/month
                  </button>
                </div>
              `;
            } else {
              return `
                <div class="glass card scale-in" style="margin-bottom: 2rem; padding: 1rem 1.5rem; border: 1px solid var(--success); background: rgba(34, 197, 94, 0.05); border-radius: 12px; display: flex; align-items: center; gap: 1rem;">
                  <div style="font-size: 1.5rem;">👑</div>
                  <div>
                    <h4 style="font-family: 'Outfit'; color: var(--success); margin: 0; font-size: 1rem;">Premium Active</h4>
                    <p style="font-size: 0.75rem; color: var(--text-secondary); margin: 0;">Your Premium expires in ${subState.daysRemaining} days.</p>
                  </div>
                </div>
              `;
            }
          }

          if (subState.isExpired) {
            return `
              <div class="glass card scale-in" style="margin-bottom: 2rem; padding: 1rem 1.5rem; border: 1px solid var(--error); background: rgba(239, 68, 68, 0.05); border-radius: 12px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
                <div style="flex: 1;">
                  <h4 style="font-family: 'Outfit'; color: var(--error); margin: 0 0 0.25rem 0; font-size: 1rem;">⚠️ Premium Expired</h4>
                  <p style="font-size: 0.75rem; color: var(--text-secondary); margin: 0;">Premium expired – you are now on Medium plan.</p>
                </div>
                <button class="primary" style="padding: 0.5rem 1rem; font-size: 0.8rem; background: var(--error);" onclick="document.getElementById('upgrade-modal').style.display='flex'">
                  Renew Premium – ₦1,000/month
                </button>
              </div>
            `;
          }

          if (subState.shouldShowActivateCTA) return ActivationCard();
          if (subState.shouldShowRenewCTA) return RenewalCard();
          
          return '';
        })()}

        <header class="dashboard-header fade-in">
        
        <!-- 🔥 1. Quick Action Section -->
        <div class="glass card" style="text-align: center; padding: 3rem 1.5rem; border: 2px solid var(--accent-primary); background: linear-gradient(135deg, var(--bg-secondary) 0%, var(--bg-color) 100%);">
          <h2 style="font-family: 'Outfit'; font-size: 2rem; margin-bottom: 0.5rem; color: var(--text-primary);">Start Practicing Now</h2>
          <p style="color: var(--text-secondary); margin-bottom: 2rem;">Select your preferred mode to continue training.</p>
          <div style="display: flex; justify-content: center; gap: 1rem; flex-wrap: wrap;">
             <button id="quick-practice-btn" class="primary" data-tooltip="Practice by topic to improve faster" style="padding: 1.25rem 2rem; font-size: 1.25rem; font-weight: 800; min-width: 200px;">🎯 Practice Mode</button>
             <button id="quick-exam-btn" class="secondary" data-tooltip="Simulate real exam conditions" style="padding: 1.25rem 2rem; border: 2px solid var(--accent-secondary); background: transparent; color: var(--text-primary); font-size: 1.25rem; font-weight: 800; min-width: 200px; border-radius: 8px;">🏆 Mock Exam</button>
             <button id="start-saved" class="glass" style="padding: 1.25rem 2rem; border: 2.5px solid var(--accent-primary); font-size: 1.1rem; display: none; align-items: center; gap: 0.5rem; justify-content: center; min-width: 200px; font-weight: 700;">🔖 Saved (<span id="bookmark-count">0</span>)</button>
          </div>
        </div>

        <!-- 🧭 2. Dashboard Guide Entry (Replayable) -->
        <div class="glass card" style="margin-top: 1.5rem; padding: 1rem; display: flex; align-items: center; justify-content: space-between; border-left: 4px solid var(--primary);">
           <div style="display: flex; align-items: center; gap: 1rem;">
             <div style="font-size: 1.5rem;">📖</div>
             <div>
               <h3 style="font-size: 1rem; margin: 0;">New to CBT Elite?</h3>
               <p style="font-size: 0.8rem; color: var(--text-secondary); margin: 0;">Learn how to use the platform effectively.</p>
             </div>
           </div>
           <button id="start-guide-btn" class="btn-secondary" style="padding: 0.5rem 1rem; font-size: 0.85rem; border-color: var(--primary); color: var(--primary);">Start Guide</button>
        </div>


        <!-- 📊 3. Progress Summary & 🎯 4. Daily Goal Tracker -->
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; margin-top: 1.5rem;">
           <div class="glass card" style="padding: 1rem; border-top: 4px solid var(--primary);">
             <h3 style="margin-bottom: 0.5rem; color: var(--text-secondary); font-size: 0.85rem;">Your Progress Overview</h3>
             <div style="display: flex; justify-content: space-between; align-items: flex-end;">
               <div>
                  <div style="font-size: 1.75rem; font-family: 'Outfit'; font-weight: 800; color: #3B82F6; line-height: 1;">${totalQuestions}</div>
                  <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.25rem;">Total Questions</div>
               </div>
                <div style="text-align: right;">
                   <div style="font-size: 1.25rem; font-family: 'Outfit'; font-weight: 800; color: #3B82F6; line-height: 1;">${history.length > 0 ? accuracy + '%' : '--'}</div>
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

           <div class="glass card" style="padding: 1rem; border-top: 4px solid var(--success);">
             <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                <h3 style="font-size: 0.9rem; color: var(--text-secondary);">Daily Practice Goal</h3>
                <span style="font-size: 0.8rem; font-weight: 800; color: var(--success);">${todayQuestions} / ${dailyGoalLimit}</span>
             </div>
             ${history.length === 0 ? `
              <div class="empty-state-card" style="padding: 1rem;">
                <p style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 0.75rem;">You haven’t started practicing yet.</p>
                <button id="empty-start-btn" class="btn-primary" style="padding: 0.4rem 1rem; font-size: 0.8rem;">Start Practice</button>
              </div>
             ` : `
              <p style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 1rem;">Complete ${dailyGoalLimit} questions every day to master the syllabus.</p>
              <div style="width: 100%; height: 12px; background: var(--bg-secondary); border-radius: 6px; overflow: hidden; border: 1px solid var(--glass-border);">
                  <div style="height: 100%; width: ${dailyGoalPct}%; background: var(--success); border-radius: 6px; transition: width 0.5s ease;"></div>
              </div>
             `}
           </div>
        </div>

        <!-- 📈 Analytics Section (Score History & Mastery) -->
        <div id="analytics-section" style="margin-top: 1.5rem; transition: opacity 0.3s ease;">
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1rem;">
            <div class="glass card" style="padding: 1rem; display: flex; flex-direction: column;">
              <h4 style="margin-bottom: 1.25rem; color: var(--accent-primary); font-size: 0.9rem;">Score History (Past 50 Sessions)</h4>
              <div style="flex: 1; min-height: 250px; display: flex; align-items: center; justify-content: center;">
                <canvas id="score-history-chart" style="width: 100% !important; height: auto !important; max-height: 250px;"></canvas>
              </div>
            </div>
            <div class="glass card" style="padding: 1rem; display: flex; flex-direction: column;">
              <h4 style="margin-bottom: 1.25rem; color: var(--success); font-size: 0.9rem;">Subject Mastery (%)</h4>
              <div style="flex: 1; min-height: 250px; display: flex; align-items: center; justify-content: center;">
                <canvas id="subject-mastery-chart" style="width: 100% !important; height: auto !important; max-width: 300px; max-height: 250px; margin: 0 auto;"></canvas>
              </div>
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
        <div class="glass card" style="margin-top: 1.5rem; padding: 1rem;">
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

        <!-- 🧭 7. Explore CBT Elite (Feature Map) -->
        <div class="scale-in" style="margin-top: 1.5rem; width: 100%;">
          <details style="width: 100%;">
            <summary class="primary" style="font-family: 'Outfit'; font-size: 1.1rem; color: #ffffff !important; background: var(--primary); padding: 1rem 1.5rem; border-radius: 8px; cursor: pointer; width: 100%; font-weight: 700; list-style: none; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);">
              <span style="display: flex; align-items: center; gap: 0.5rem; color: #ffffff !important;"><span>🚀</span> Explore CBT Elite Features</span>
              <span style="font-size: 0.85rem; opacity: 0.9; font-weight: normal; color: #ffffff !important;">Click to reveal ▼</span>
            </summary>
            <div class="glass card" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1.5rem; padding: 1.5rem; margin-top: 0.5rem; border-left: 4px solid var(--primary);">
              <div style="display: flex; gap: 1rem;">
                <div style="font-size: 1.25rem;">🎯</div>
                <div>
                  <h4 style="font-size: 0.9rem; margin-bottom: 0.25rem;">Practice Mode</h4>
                  <p style="font-size: 0.75rem; color: var(--text-secondary);">Practice questions by topic and improve gradually</p>
                </div>
              </div>
              <div style="display: flex; gap: 1rem;">
                <div style="font-size: 1.25rem;">🏆</div>
                <div>
                  <h4 style="font-size: 0.9rem; margin-bottom: 0.25rem;">Exam Mode</h4>
                  <p style="font-size: 0.75rem; color: var(--text-secondary);">Take full CBT exams with real timing</p>
                </div>
              </div>
              <div style="display: flex; gap: 1rem;">
                <div style="font-size: 1.25rem;">📊</div>
                <div>
                  <h4 style="font-size: 0.9rem; margin-bottom: 0.25rem;">Performance Insights</h4>
                  <p style="font-size: 0.75rem; color: var(--text-secondary);">See your progress and score trends</p>
                </div>
              </div>
              <div style="display: flex; gap: 1rem;">
                <div style="font-size: 1.25rem;">🧠</div>
                <div>
                  <h4 style="font-size: 0.9rem; margin-bottom: 0.25rem;">AI Explanations</h4>
                  <p style="font-size: 0.75rem; color: var(--text-secondary);">Get detailed corrections after answering (Premium)</p>
                </div>
              </div>
              <div style="display: flex; gap: 1rem;" id="feature-review-item">
                <div style="font-size: 1.25rem;">📌</div>
                <div>
                  <h4 style="font-size: 0.9rem; margin-bottom: 0.25rem;">Review Questions</h4>
                  <p style="font-size: 0.75rem; color: var(--text-secondary);">After finishing a test, tap 'Review Questions' to see corrections</p>
                </div>
              </div>
              <div style="display: flex; gap: 1rem;">
                <div style="font-size: 1.25rem;">📰</div>
                <div>
                  <h4 style="font-size: 0.9rem; margin-bottom: 0.25rem;">News & Updates</h4>
                  <p style="font-size: 0.75rem; color: var(--text-secondary);">Stay informed about JAMB, WAEC, and NECO</p>
                </div>
              </div>
            </div>
          </details>
        </div>

        <!-- 📚 8. Exam Selection (Existing) -->
        <div style="margin-top: 3rem; border-top: 1px dashed var(--glass-border); padding-top: 2rem;">
            <div class="dashboard-tabs" style="display: flex; gap: 1rem; margin-bottom: 1.5rem;">
              <button id="view-practice" class="nav-tab active" style="flex: 1;">🎯 Practice Mode</button>
              <button id="view-exam" class="nav-tab" style="flex: 1;">🏆 Exam Mode</button>
            </div>
            
            <!-- (Resume Container moved to top) -->

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
            <div class="glass card" style="padding: 1rem; display: flex; flex-direction: column;">
              <h4 style="margin-bottom: 1.25rem; color: var(--accent-primary); font-size: 0.9rem;">Score History (Past 50 Sessions)</h4>
              <div style="flex: 1; min-height: 250px; display: flex; align-items: center; justify-content: center;">
                <canvas id="score-history-chart" style="width: 100% !important; height: auto !important;"></canvas>
              </div>
            </div>
            <div class="glass card" style="padding: 1rem; display: flex; flex-direction: column;">
              <h4 style="margin-bottom: 1.25rem; color: var(--success); font-size: 0.9rem;">Subject Mastery (%)</h4>
              <div style="flex: 1; min-height: 280px; display: flex; align-items: center; justify-content: center;">
                <canvas id="subject-mastery-chart" style="width: 100% !important; height: auto !important; max-width: 400px; margin: 0 auto;"></canvas>
              </div>
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

      <!-- Upgrade Modal -->
      <div id="upgrade-modal" class="modal-overlay" style="display: none; align-items: center; justify-content: center; padding: 1rem; z-index: 1000;">
        <div class="modal-content glass" style="max-width: 450px; width: 100%; position: relative; padding: 2.5rem; text-align: center;">
          <button id="close-upgrade" style="position: absolute; top: 1rem; right: 1rem; background: none; border: none; font-size: 1.5rem; cursor: pointer; color: var(--text-primary);">&times;</button>
          <div style="font-size: 3rem; margin-bottom: 1rem;">${profile.is_activated ? '🚀' : '✨'}</div>
          <h2 style="font-family: 'Outfit'; margin-bottom: 0.5rem; color: var(--accent-secondary);">${profile.is_activated ? 'Renew Premium' : 'Activate Account'}</h2>
          <p style="color: var(--text-secondary); margin-bottom: 2rem; font-size: 0.95rem;">
            ${profile.is_activated 
               ? 'Renew your monthly subscription to continue enjoying Unlimited AI and Mock Exams.' 
               : 'Complete your one-time lifetime activation to unlock the full syllabus and 30 days of Premium access.'}
          </p>
          
          <div style="display: flex; flex-direction: column; gap: 1rem; margin-bottom: 2rem;">
            ${!profile.is_activated ? `
              <div class="glass card" style="padding: 1rem; border: 2px solid var(--accent-primary); background: rgba(59, 130, 246, 0.05);">
                <h4 style="margin-bottom: 0.5rem; color: var(--text-primary);">Lifetime Activation</h4>
                <div style="font-size: 2.5rem; font-weight: 800; color: var(--accent-primary); margin-bottom: 0.5rem;">₦1,500</div>
                <ul style="text-align: left; font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 1.5rem; list-style: none; padding: 0;">
                  <li>✔ Includes 30 Days Premium</li>
                  <li>✔ Lifetime Medium Access</li>
                  <li>✔ 15 Monthly AI Credits</li>
                </ul>
                <button id="pay-lifetime-btn" class="primary" style="width: 100%; padding: 0.75rem;">Activate Now</button>
              </div>
            ` : `
              <div class="glass card" style="padding: 1rem; border: 2px solid var(--accent-secondary); background: rgba(147, 51, 234, 0.05);">
                <h4 style="margin-bottom: 0.5rem; color: var(--text-primary);">Monthly Pro</h4>
                <div style="font-size: 2.5rem; font-weight: 800; color: var(--accent-secondary); margin-bottom: 0.5rem;">₦1,000</div>
                <ul style="text-align: left; font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 1.5rem; list-style: none; padding: 0;">
                  <li>✔ Unlimited AI Explanations</li>
                  <li>✔ Unlimited Mock Exams</li>
                  <li>✔ AI Theory Grading</li>
                </ul>
                <button id="pay-monthly-btn" class="primary" style="width: 100%; padding: 0.75rem; background: var(--accent-secondary);">Renew Pro</button>
              </div>
            `}
          </div>
          
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

    if (document.getElementById('start-guide-btn')) {
      document.getElementById('start-guide-btn').onclick = () => TourGuide.start();
    }

    if (document.getElementById('empty-start-btn')) {
      document.getElementById('empty-start-btn').onclick = () => {
        document.getElementById('view-practice').click();
        document.getElementById('dashboard-content').scrollIntoView({ behavior: 'smooth' });
      }
    }

    // Auto-trigger onboarding ONLY for new users that JUST signed up
    // Auto-trigger onboarding ONLY for new users that JUST signed up
    const isFreshSignup = sessionStorage.getItem('isFreshSignup') === 'true'
    if (!profile.has_seen_tour && isFreshSignup) {
      setTimeout(() => TourGuide.start(), 1500);
    }

    const upgradeHeroBtn = document.getElementById('upgrade-hero-btn')
    const upgradeModal = document.getElementById('upgrade-modal')
    const closeUpgrade = document.getElementById('close-upgrade')
    const payLifetime = document.getElementById('pay-lifetime-btn')
    const payMonthly = document.getElementById('pay-monthly-btn')

    if (upgradeHeroBtn) {
       upgradeHeroBtn.onclick = () => upgradeModal.style.display = 'flex'
    }
    if (closeUpgrade) {
       closeUpgrade.onclick = () => upgradeModal.style.display = 'none'
    }

    const triggerPayment = (amount, planName) => {
        const handler = PaystackPop.setup({
            key: 'pk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', 
            email: profile.email,
            amount: amount,
            currency: 'NGN',
            callback: async (response) => {
                // Logic: 1,500 = Activation + 30 Days. 1,000 = 30 Days.
                const isFirstTime = !profile.is_activated
                const { error } = await DataService.updateUser(profile.id, { 
                    tier: 'premium',
                    is_activated: true, // Permanent
                    ai_credits: isFirstTime ? 15 : profile.ai_credits, // Set 15 on first activation
                    premium_until: new Date(Date.now() + 30*24*60*60*1000).toISOString()
                })
                if (!error) {
                    alert(`\u2728 Congratulations! Your account has been ${isFirstTime ? 'ACTIVATED and upgraded' : 'RENEWED'} to PREMIUM.`)
                    location.reload()
                } else {
                    alert("Upgrade synchronization failed. Please contact support.")
                }
            },
            onClose: () => {
                alert('Transaction cancelled.')
            }
        })
        handler.openIframe()
    }

    if (payLifetime) payLifetime.onclick = () => triggerPayment(150000, 'activation')
    if (payMonthly) payMonthly.onclick = () => triggerPayment(100000, 'monthly')

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
                console.error("Dashboard Practice session start failed:", err)
                btn.textContent = 'Start Practice Session'
                const errorStr = `Session Error: ${err.message || err.name || 'Unknown'}\n\nStack: ${err.stack || 'No stack trace available'}`
                alert("An error occurred while preparing the session.\n\n" + errorStr)
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
    
    // Phase 3: Sync Offline Pool in background
    DataService.syncOfflinePool().catch(e => console.warn("Offline pool sync not possible:", e))

    // Phase 3: AI Workout Logic
    const aiWorkoutBtn = document.getElementById('start-ai-workout')
    const aiWorkoutHint = document.getElementById('ai-workout-hint')
    if (aiWorkoutBtn) {
        aiWorkoutBtn.onclick = async () => {
            aiWorkoutBtn.disabled = true
            aiWorkoutBtn.innerHTML = '<div class="loader-spinner" style="width:16px; height:16px; border-width:2px;"></div> Analyzing Gaps...'
            
            const questions = await DataService.getRecommendedQuestions(profile.id)
            if (questions && questions.length > 0) {
                this.onStartExam(questions, 'practice', 'AI Workout', 'Personalized')
            } else {
                alert("AI needs more of your performance data to build a workout. Try a few regular practices first!")
                aiWorkoutBtn.disabled = false
                aiWorkoutBtn.innerHTML = '<span>\uD83D\uDE80 Start Personalized Session</span>'
            }
        }
    }
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
          backgroundColor: isLightMode ? primaryColor + '4D' : primaryColor + '33', 
          borderColor: primaryColor,
          borderWidth: 3,
          pointBackgroundColor: primaryColor,
          pointBorderColor: '#fff',
          pointBorderWidth: 1,
          fill: true // Ensure background is filled for the radar
        }]
      },
      options: {
        responsive: true,
        plugins: { 
          legend: { display: false },
          tooltip: {
            backgroundColor: isLightMode ? '#fff' : '#1E293B',
            borderWidth: 1,
            displayColors: false
          }
        },
        scales: {
          r: {
            angleLines: { color: chartGridColor, lineWidth: 1 },
            grid: { color: chartGridColor, circular: true },
            pointLabels: { 
              color: isLightMode ? '#2563EB' : '#60A5FA', 
              font: { 
                size: window.innerWidth < 600 ? 11 : 13, 
                weight: '700',
                family: 'Outfit'
              },
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


