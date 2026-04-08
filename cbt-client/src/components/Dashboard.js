import { DataService } from '../services/data'
import { AuthService } from '../services/auth'
import { WeeklyRecapComponent } from './WeeklyRecap'
import { TourGuide } from '../utils/TourGuide'
import { SubscriptionService } from '../services/subscriptionService'
import { SubscriptionManager } from '../utils/subscriptionManager'
import { ExamCard } from './ExamCard'

export const DashboardComponent = {
  profile: null,
  onStartExam: null,

  async render(profile, onStartExam, onOpenAdmin, onReadNews) {
    // Handle Tier Transitions & Daily Resets
    const updatedUser = profile ? await SubscriptionService.handleTierTransition(profile) : null
    this.profile = updatedUser || profile || { username: 'Student', id: 'anon' }
    this.onStartExam = onStartExam
    this.onOpenAdmin = onOpenAdmin
    this.onReadNews = onReadNews
    const container = document.getElementById('dashboard-container')
    container.style.display = 'block'
    
    let history = []
    let mastery = []
    let isSystemFree = false

    try {
        // Preliminary data fetch for synchronous render injection
        const analytics = await DataService.getUserAnalytics(profile.id)
        history = analytics.history || []
        mastery = analytics.mastery || []
        

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
    let totalCorrect = 0
    let accuracy = 0
    let trendStr = "<i data-lucide='target' style='width: 14px; height: 14px; vertical-align: middle;'></i> Target: 80%"
    
    if (history && history.length > 0) {
        let recentQuestions = 0
        let recentCorrect = 0
        let pastQuestions = 0
        let pastCorrect = 0
        
        const sevenDaysAgo = new Date()
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

        history.forEach(s => {
            if (s && s.created_at) {
                const sDate = new Date(s.created_at)
                if (sDate.toDateString() === today) todayQuestions += (s.total_questions || 0)
                
                totalQuestions += (s.total_questions || 0)
                totalCorrect += (s.correct_answers || 0)
                
                if (sDate >= sevenDaysAgo) {
                    recentQuestions += (s.total_questions || 0)
                    recentCorrect += (s.correct_answers || 0)
                } else {
                    pastQuestions += (s.total_questions || 0)
                    pastCorrect += (s.correct_answers || 0)
                }
            }
        })
        accuracy = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0
        
        if (pastQuestions > 0 && recentQuestions > 0) {
            const recentAcc = Math.round((recentCorrect / recentQuestions) * 100)
            const pastAcc = Math.round((pastCorrect / pastQuestions) * 100)
            const diff = recentAcc - pastAcc
            if (diff > 0) trendStr = `<span style="color:var(--success)">📈 +${diff}% this week</span>`
            else if (diff < 0) trendStr = `<span style="color:var(--error)">📉 ${diff}% this week</span>`
            else trendStr = `<span style="color:var(--text-secondary)">🔄 Stable this week</span>`
        }
    }
    
    const dailyGoalLimit = 50
    const dailyGoalPct = Math.min((todayQuestions / dailyGoalLimit) * 100, 100)
    
    // Determine Achievements
    const badges = [];
    if (profile.streak_count >= 7) badges.push({ emoji: '<i data-lucide="flame" style="width: 16px; height: 16px; color: var(--warning);"></i>', title: '7-Day Streak' });
    if (totalQuestions >= 500) badges.push({ emoji: '<i data-lucide="shield" style="width: 16px; height: 16px; color: var(--accent-secondary);"></i>', title: 'Veteran' });
    if (accuracy >= 80 && history.length >= 5) badges.push({ emoji: '<i data-lucide="target" style="width: 16px; height: 16px; color: var(--primary);"></i>', title: 'Sharpshooter' });
    if (profile.is_activated) badges.push({ emoji: '<i data-lucide="gem" style="width: 16px; height: 16px; color: var(--accent-primary);"></i>', title: 'Activated' });

    // Determine Weak Subject (Threshold: min 5 attempts, < 50% average)
    let weakSubject = null
    if (mastery && mastery.length > 0) {
        try {
            const potentialWeakSubjects = mastery.filter(m => m.total_attempted >= 5 && m.average < 50)
            if (potentialWeakSubjects.length > 0) {
                weakSubject = potentialWeakSubjects.reduce((prev, curr) => (prev.average < curr.average) ? prev : curr)
            }
        } catch (e) {
            console.error("Weak subject determination failed", e)
        }
    }

    container.innerHTML = `
      <div id="dashboard-content" class="dashboard-scroll-area">
        
        <!-- DASHBOARD WELCOME -->
        <div class="mb-md" style="padding-top: 0.5rem;">
          <h1 style="font-family: 'Outfit'; font-size: 2.2rem; margin: 0; font-weight: 800; color: var(--text-primary); display: flex; align-items: center; gap: 0.75rem;">Welcome, ${this.profile.username || 'Student'} <i data-lucide="sun" style="width: 32px; height: 32px; color: var(--warning);"></i></h1>
          <p style="font-size: 1.05rem; color: var(--text-secondary); margin-top: 0.4rem; font-weight: 500;">Let's make today count. Continue your mastery journey.</p>
        </div>

        <!-- FEATURED: AI Workout (Primary CTA) -->
        <div class="glass card scale-in mb-lg" style="border-left: 6px solid var(--accent-primary); background: linear-gradient(135deg, rgba(37, 99, 235, 0.08) 0%, var(--surface-color) 100%);">
          <div class="mobile-stack" style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
            <div>
                <h3 style="font-family: 'Outfit'; font-size: 1.45rem; margin-bottom: 0.2rem; display: flex; align-items: center; gap: 0.6rem; color: var(--accent-primary); font-weight: 800;"><i data-lucide="sparkles"></i> AI Custom Workout</h3>
                <p id="ai-workout-hint" style="font-size: 0.95rem; color: var(--text-secondary); font-weight: 500;">Targeting your mastery gaps automatically...</p>
            </div>
            <span class="badge" style="background: var(--accent-primary); font-size: 0.75rem; font-weight: 800; padding: 0.4rem 0.8rem; border-radius: 20px; box-shadow: 0 4px 10px rgba(37, 99, 235, 0.3); text-transform: uppercase; width: fit-content;">Recommended</span>
          </div>
          <button id="start-ai-workout" class="btn-dominant" style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 0.75rem; min-height: 56px; font-size: 1.15rem; margin-top: 0.5rem;">
            <i data-lucide="rocket" style="width: 22px; height: 22px;"></i> Start Personalized Session
          </button>
        </div>

        <div id="resume-container" style="display: none;" class="mb-lg">
              <div class="glass card scale-in card-medium mobile-stack" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap;">
                <div style="display: flex; align-items: center; gap: 1rem; min-width: 200px;">
                  <div style="color: var(--accent-secondary);"><i data-lucide="clock" style="width: 32px; height: 32px;"></i></div>
                  <div>
                    <h3 style="margin-bottom: 0.25rem; font-family: 'Outfit'; color: var(--accent-secondary); font-weight: 800;">Continue Your Session</h3>
                    <p id="resume-info" style="font-size: 0.9rem; color: var(--text-secondary); font-weight: 500;">Pick up exactly where you left off.</p>
                  </div>
                </div>
                <div style="display: flex; gap: 1rem; margin-top: 1rem;">
                  <button id="discard-resume" class="btn-secondary" style="border: none; background: transparent; opacity: 0.7; font-weight: 600;">Discard</button>
                  <button id="confirm-resume" class="btn-primary" style="background: var(--accent-secondary); box-shadow: 0 4px 12px rgba(147, 51, 234, 0.3);">Resume Now</button>
                </div>
              </div>
        </div>

        <!-- Dynamic Tier-Based UI -->
        ${(() => {
          const subState = SubscriptionManager.getUserSubscriptionState(profile, isSystemFree);
          const ActivationCard = () => `
            <div class="glass card card-freemium scale-in mb-lg mobile-stack" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1.5rem; border: 2px solid rgba(37, 99, 235, 0.3);">
              <div style="flex: 1; min-width: 280px;">
                <h4 style="font-family: 'Outfit'; color: var(--text-primary); margin-bottom: 0.5rem; font-size: 1.25rem; font-weight: 800; display: flex; align-items: center; gap: 0.6rem;"><i data-lucide="unlock" style="color: var(--accent-primary);"></i> Activate Full Access <span class="badge" style="background: rgba(37, 99, 235, 0.1); color: var(--accent-primary); font-size: 0.65rem; padding: 0.25rem 0.6rem; border-radius: 12px; font-weight: 900; letter-spacing: 0.05em;">LIFETIME</span></h4>
                <p style="font-size: 0.95rem; color: var(--text-secondary); font-weight: 500; line-height: 1.5;">Pay ₦1,500 once to unlock more features + 30 days Premium access.</p>
              </div>
              <button class="btn-dominant" style="height: 48px; padding: 0 1.5rem; font-size: 1rem;" onclick="document.getElementById('upgrade-modal').style.display='flex'">
                Activate Lifetime – ₦1,500
              </button>
            </div>
          `;

          const RenewalCard = () => `
            <div class="glass card card-medium scale-in mb-lg mobile-stack" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1.5rem; border: 2px solid rgba(139, 92, 246, 0.3);">
              <div style="flex: 1; min-width: 280px;">
                <h4 style="font-family: 'Outfit'; color: var(--text-primary); margin-bottom: 0.5rem; font-size: 1.25rem; font-weight: 800; display: flex; align-items: center; gap: 0.6rem;"><i data-lucide="rocket" style="color: var(--accent-secondary);"></i> Renew Premium Access <span class="badge" style="background: rgba(139, 92, 246, 0.1); color: var(--accent-secondary); font-size: 0.65rem; padding: 0.25rem 0.6rem; border-radius: 12px; font-weight: 900; letter-spacing: 0.05em;">RECOMMENDED</span></h4>
                <p style="font-size: 0.95rem; color: var(--text-secondary); font-weight: 500; line-height: 1.5;">Get AI explanations, unlimited exams and full access for ₦1,000/month.</p>
              </div>
              <button class="btn-dominant" style="background: var(--accent-secondary); box-shadow: 0 6px 16px rgba(139, 92, 246, 0.3); height: 48px; padding: 0 1.5rem; font-size: 1rem;" onclick="document.getElementById('upgrade-modal').style.display='flex'">
                Renew Premium – ₦1,000/mo
              </button>
            </div>
          `;

          if (subState.tier === "premium") {
            if (subState.daysRemaining <= 5) {
              return `
                <div class="glass card card-expiring scale-in mb-lg mobile-stack" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1.5rem; border: 2px solid rgba(245, 158, 11, 0.4);">
                  <div style="flex: 1;">
                    <h4 style="font-family: 'Outfit'; color: var(--warning); margin: 0 0 0.5rem 0; font-size: 1.15rem; font-weight: 800; display: flex; align-items: center; gap: 0.6rem;"><i data-lucide="alert-triangle"></i> Expiring Soon</h4>
                    <p style="font-size: 0.95rem; color: var(--text-secondary); margin: 0; font-weight: 500;">Your Premium expires in ${subState.daysRemaining} days. Renew to avoid losing access.</p>
                  </div>
                  <button class="btn-primary" style="background: var(--warning); box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3); padding: 0.5rem 1.25rem; font-size: 1rem; color: #111 !important;" onclick="document.getElementById('upgrade-modal').style.display='flex'">
                    Renew Premium – ₦1,000
                  </button>
                </div>
              `;
            } else {
              return `
                <div class="glass card card-premium scale-in mb-lg mobile-stack" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1.5rem; border: 2px solid rgba(16, 185, 129, 0.3);">
                  <div style="display: flex; align-items: center; gap: 1rem;">
                    <div style="color: var(--success);"><i data-lucide="crown" style="width: 32px; height: 32px;"></i></div>
                    <div>
                      <h4 style="font-family: 'Outfit'; color: var(--success); margin: 0; font-size: 1.15rem; font-weight: 800; display: flex; align-items: center; gap: 0.5rem;">Premium Access Active <span class="badge" style="background: rgba(16, 185, 129, 0.1); color: var(--success); font-size: 0.65rem; padding: 0.25rem 0.6rem; border-radius: 12px; font-weight: 900; letter-spacing: 0.05em;">PRO</span></h4>
                      <p style="font-size: 0.95rem; color: var(--text-secondary); margin: 0; font-weight: 500;">Expires in ${subState.daysRemaining} days. All pro features unlocked.</p>
                    </div>
                  </div>
                </div>
              `;
            }
          }

          if (subState.isExpired) {
            return `
              <div class="glass card card-expired scale-in mb-lg mobile-stack" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1.5rem; border: 2px solid rgba(239, 68, 68, 0.4);">
                <div style="flex: 1;">
                  <h4 style="font-family: 'Outfit'; color: var(--error); margin: 0 0 0.5rem 0; font-size: 1.15rem; font-weight: 800; display: flex; align-items: center; gap: 0.6rem;"><i data-lucide="alert-circle"></i> Premium Expired</h4>
                  <p style="font-size: 0.95rem; color: var(--text-secondary); margin: 0; font-weight: 500;">Your access has expired – you are currently on the Medium plan.</p>
                </div>
                <button class="btn-primary" style="background: var(--error); padding: 0.5rem 1.25rem; font-size: 1rem;" onclick="document.getElementById('upgrade-modal').style.display='flex'">
                  Renew Premium – ₦1,000
                </button>
              </div>
            `;
          }

          if (subState.shouldShowActivateCTA) return ActivationCard();
          if (subState.shouldShowRenewCTA) return RenewalCard();
          
          return '';
        })()}

        <header class="dashboard-header fade-in">
        
        <!-- QUICK ACTION SECTION -->
        <div class="glass card scale-in mb-lg" style="text-align: center; padding: 2.5rem 1.5rem; border: 2px solid rgba(37, 99, 235, 0.4); background: linear-gradient(180deg, rgba(37, 99, 235, 0.04) 0%, var(--surface-color) 100%);">
          <h2 style="font-family: 'Outfit'; font-size: 2rem; margin-bottom: 0.4rem; color: var(--text-primary); font-weight: 800;">Ready to level up?</h2>
          <p style="color: var(--text-secondary); margin-bottom: 2rem; font-size: 1.05rem; font-weight: 500;">Select your mode and start mastering your subjects.</p>
          <div class="mobile-stack" style="display: flex; justify-content: center; gap: 1rem; flex-wrap: wrap;">
             <button id="quick-practice-btn" class="btn-primary" data-tooltip="Practice by topic to improve faster" style="padding: 0 1.5rem; width: 100%; min-width: 0 !important; font-size: 1.05rem;"><i data-lucide="target"></i> Practice Mode</button>
             <button id="quick-exam-btn" class="btn-secondary" data-tooltip="Simulate real exam conditions" style="padding: 0 1.5rem; width: 100%; min-width: 0 !important; font-weight: 800; border-radius: var(--radius-md);"><i data-lucide="trophy"></i> Full Mock Exam</button>
             <button id="start-saved" class="glass-btn" style="padding: 0 1.5rem; border-color: var(--accent-primary); display: none; width: 100%; min-width: 0 !important;"><i data-lucide="bookmark"></i> Saved (<span id="bookmark-count">0</span>)</button>
          </div>
        </div>

         <!-- PROGRESS & GOALS -->
         <div class="dashboard-responsive-grid mb-xl" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.5rem;">
            <div class="glass card" style="border-top: 4px solid var(--primary); padding-bottom: 1.5rem;">
              <h3 style="margin-bottom: 1.25rem; color: var(--text-secondary); font-size: 0.95rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;">Your Progress Overview</h3>
              
              <div style="display: flex; gap: 1.5rem; align-items: center; margin-bottom: 2rem;">
                 <!-- Readiness Gauge -->
                 <div id="readiness-gauge-container" style="position: relative; width: 85px; height: 85px; flex-shrink: 0;">
                    <svg viewBox="0 0 36 36" style="width: 100%; height: 100%; transform: rotate(-90deg);">
                      <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="rgba(59, 130, 246, 0.1)" stroke-width="3" />
                      <path id="readiness-progress-path" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="var(--primary)" stroke-width="3" stroke-dasharray="0, 100" stroke-linecap="round" style="transition: stroke-dasharray 1s ease;" />
                    </svg>
                    <div id="readiness-percentage" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-weight: 900; font-size: 1rem; color: var(--primary);">0%</div>
                 </div>
                 
                 <div style="flex: 1;">
                    <div id="readiness-label" style="font-size: 0.75rem; font-weight: 800; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.35rem;">Exam Readiness</div>
                    <div id="readiness-subject" style="font-family: 'Outfit'; font-size: 1.15rem; font-weight: 800; color: var(--text-primary);">...</div>
                    <div id="readiness-status" style="font-size: 0.8rem; font-weight: 700; color: var(--success); margin-top: 0.2rem;">Beginner</div>
                 </div>
              </div>

              <div class="mobile-stack" style="display: flex; justify-content: space-between; align-items: center; padding: 1rem; background: rgba(255,255,255,0.03); border-radius: var(--radius-md);">
                <div>
                  <div style="font-size: 1.8rem; font-family: 'Outfit'; font-weight: 900; color: var(--primary); line-height: 1;">${totalQuestions}</div>
                  <div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 0.4rem; font-weight: 600;">Questions Attempted</div>
                </div>
                <div>
                   <div style="font-size: 1.8rem; font-family: 'Outfit'; font-weight: 900; color: var(--primary); line-height: 1;">${history.length > 0 ? accuracy + '%' : '--'}</div>
                   <div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 0.4rem; font-weight: 600;">Overall Accuracy</div>
                </div>
              </div>
              
              <div class="mobile-stack" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: 1.5rem;">
                <button id="view-leaderboard" class="btn-secondary" style="border-radius: var(--radius-md); font-size: 0.75rem; border-color: var(--accent-primary); min-height: 40px;"><i data-lucide="trophy" style="width: 15px; height: 15px;"></i> GLOBAL RANK</button>
                <button id="performance-insights-btn" class="btn-secondary" style="border-radius: var(--radius-md); font-size: 0.75rem; border-color: var(--accent-secondary); min-height: 40px;"><i data-lucide="bar-chart-2" style="width: 15px; height: 15px;"></i> INSIGHTS</button>
              </div>
            </div>

           <div class="glass card" style="padding: 1.5rem; border-top: 4px solid var(--success);">
             <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem;">
                <h3 style="font-size: 0.95rem; color: var(--text-secondary); font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;">Daily Practice Goal</h3>
                <span class="badge" style="background: rgba(16, 185, 129, 0.1); color: var(--success); font-size: 0.9rem; font-weight: 900; padding: 0.25rem 0.75rem;">${todayQuestions} / ${dailyGoalLimit}</span>
             </div>
             ${history.length === 0 ? `
              <div style="padding: 2rem 1rem; text-align: center; background: rgba(0,0,0,0.1); border-radius: var(--radius-md); border: 1px dashed var(--glass-border);">
                <p style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 1.5rem; font-weight: 500;">You haven’t started practicing yet.</p>
                <button id="empty-start-btn" class="btn-primary" style="padding: 0 1.5rem;">Start Practice Now</button>
              </div>
             ` : `
              <p style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 1.25rem; font-weight: 500; line-height: 1.5;">Finish <strong>${dailyGoalLimit} questions</strong> today to stay on track for your exam.</p>
              <div style="width: 100%; height: 16px; background: rgba(0,0,0,0.2); border-radius: 8px; overflow: hidden; border: 1px solid var(--glass-border); padding: 2px;">
                  <div style="height: 100%; width: ${dailyGoalPct}%; background: var(--success); border-radius: 6px; box-shadow: 0 0 10px rgba(16, 185, 129, 0.4); transition: width 0.8s cubic-bezier(0.34, 1.56, 0.64, 1);"></div>
              </div>
              <p style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 1rem; text-align: center; font-style: italic;">${dailyGoalPct >= 100 ? 'Goal reached! Outstanding work! 🔥' : 'Keep pushing, you\'re almost there!'}</p>
             `}
           </div>
         </div>

        <!-- AI PERFORMANCE ANALYSIS -->
        ${history.length < 5 ? `
          <div class="glass card mb-lg" style="padding: 1.5rem 2rem; border-left: 5px solid var(--accent-secondary); background: linear-gradient(90deg, rgba(139, 92, 246, 0.05) 0%, transparent 100%); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap;">
             <div style="flex: 1; min-width: 250px;">
               <h3 style="font-size: 1.2rem; font-weight: 800; margin-bottom: 0.5rem; color: var(--accent-secondary); display: flex; align-items: center; gap: 0.75rem;"><i data-lucide="bot"></i> AI Analytics Calibration</h3>
               <p style="font-size: 0.95rem; color: var(--text-secondary); font-weight: 500; margin-bottom: 0;">Complete <strong>${5 - history.length} more sessions</strong> to unlock personalized AI performance insights.</p>
             </div>
             <div class="loader-spinner" style="width:32px; height:32px; border-width:4px; border-color: var(--accent-secondary) transparent transparent transparent;"></div>
          </div>
        ` : `
          <div class="glass card mb-lg" style="padding: 1.75rem 2rem; border-left: 5px solid var(--primary); background: linear-gradient(90deg, rgba(37, 99, 235, 0.05) 0%, transparent 100%);">
             <h3 style="font-size: 1.25rem; font-weight: 800; margin-bottom: 1rem; color: var(--primary); display: flex; align-items: center; gap: 0.75rem;"><i data-lucide="brain"></i> AI Performance Analysis</h3>
             <p style="font-size: 1.05rem; color: var(--text-secondary); line-height: 1.6; font-weight: 500; margin-bottom: 1.25rem;">
                ${(() => {
                    const sorted = [...(mastery || [])].sort((a,b) => b.average - a.average);
                    if (sorted.length === 0) return "You've completed sessions but haven't recorded topic mastery yet. Keep practicing!";
                    
                    const best = sorted[0];
                    const worst = sorted[sorted.length - 1];
                    let insight = "Based on your last " + history.length + " trials, your strongest area is <strong>" + best.subject + "</strong> (" + best.average + "%). ";
                    
                    if (worst && worst.subject !== best.subject) {
                        insight += "However, your mastery in <strong>" + worst.subject + "</strong> is currently at " + worst.average + "%. ";
                        if (worst.average < 40) {
                             insight += "This is a critical weak point. You should dedicate your next few sessions strictly to " + worst.subject + " before attempting full mock exams.";
                        } else if (worst.average < 70) {
                             insight += "You have a decent foundation, but targeted practice in " + worst.subject + " will significantly boost your overall ranking.";
                        } else {
                             insight += "You are performing exceptionally well across the board. Focus on speed and edge-case questions to guarantee an excellent score.";
                        }
                    } else {
                        insight += "Keep up the consistent practice to build enough data for a multi-subject comparison.";
                    }
                    return insight;
                })()}
             </p>
             ${(weakSubject) ? `
             <div>
                <button id="practice-weak-btn" data-subject="${weakSubject.subject}" class="btn-primary" style="padding: 0 1.5rem; height: 40px; font-size: 0.85rem;"><i data-lucide="target" style="width: 16px; height: 16px;"></i> Target ${weakSubject.subject}</button>
             </div>
             ` : ''}
          </div>
        `}

        <!-- EXPLORE FEATURES -->
        <div class="scale-in mb-xl" style="width: 100%;">
          <details class="details-premium">
            <summary class="summary-premium">
              <span style="display: flex; align-items: center; gap: 0.75rem;"><i data-lucide="rocket"></i> Explore CBT Elite Features</span>
              <span style="font-size: 0.85rem; font-weight: 500;">Reveal Features \u25BC</span>
            </summary>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem; padding: 2rem; border-top: 1px solid var(--glass-border);">
              <div class="feature-item">
                <div style="color: var(--primary);"><i data-lucide="target" style="width: 28px; height: 28px;"></i></div>
                <div>
                  <h4 style="font-size: 1rem; margin-bottom: 0.4rem; font-weight: 800;">Practice Mode</h4>
                  <p style="font-size: 0.85rem; color: var(--text-secondary); line-height: 1.5;">Practice questions by topic and improve your mastery level step-by-step.</p>
                </div>
              </div>
              <div class="feature-item">
                <div style="color: var(--accent-secondary);"><i data-lucide="trophy" style="width: 28px; height: 28px;"></i></div>
                <div>
                  <h4 style="font-size: 1rem; margin-bottom: 0.4rem; font-weight: 800;">Full Mock Exams</h4>
                  <p style="font-size: 0.85rem; color: var(--text-secondary); line-height: 1.5;">Simulate real exam conditions with timed standard assessments.</p>
                </div>
              </div>
              <div class="feature-item">
                <div style="color: var(--success);"><i data-lucide="bar-chart-2" style="width: 28px; height: 28px;"></i></div>
                <div>
                  <h4 style="font-size: 1rem; margin-bottom: 0.4rem; font-weight: 800;">Performance Insights</h4>
                  <p style="font-size: 0.85rem; color: var(--text-secondary); line-height: 1.5;">Detailed analytics helps you track progress and identify weak spots.</p>
                </div>
              </div>
              <div class="feature-item">
                <div style="color: var(--accent-primary);"><i data-lucide="brain" style="width: 28px; height: 28px;"></i></div>
                <div>
                  <h4 style="font-size: 1rem; margin-bottom: 0.4rem; font-weight: 800;">AI Correction & Theory</h4>
                  <p style="font-size: 0.85rem; color: var(--text-secondary); line-height: 1.5;">Get human-like explanations and professional grading for theory work.</p>
                </div>
              </div>
              <div class="feature-item" id="feature-review-item">
                <div style="color: var(--warning);"><i data-lucide="pin" style="width: 28px; height: 28px;"></i></div>
                <div>
                  <h4 style="font-size: 1rem; margin-bottom: 0.4rem; font-weight: 800;">Review Questions</h4>
                  <p style="font-size: 0.85rem; color: var(--text-secondary); line-height: 1.5;">After every test, go back and see precisely where you went wrong.</p>
                </div>
              </div>
              <div class="feature-item">
                <div style="color: var(--text-secondary);"><i data-lucide="newspaper" style="width: 28px; height: 28px;"></i></div>
                <div>
                  <h4 style="font-size: 1rem; margin-bottom: 0.4rem; font-weight: 800;">News & Updates</h4>
                  <p style="font-size: 0.85rem; color: var(--text-secondary); line-height: 1.5;">Stay ahead with the latest news regarding JAMB, WAEC, and NECO.</p>
                </div>
              </div>
            </div>
          </details>
        </div>
        
        <div style="margin-top: 2rem; border-top: 1px dashed var(--glass-border); padding-top: 2.5rem;">
            <div class="dashboard-tabs" style="display: flex; gap: 1.25rem; margin-bottom: 2rem;">
              <button id="view-practice" class="nav-tab active" style="flex: 1; height: 52px; font-weight: 800;"><i data-lucide="target" style="width: 20px; height: 20px;"></i> Practice</button>
              <button id="view-exam" class="nav-tab" style="flex: 1; height: 52px; font-weight: 800;"><i data-lucide="trophy" style="width: 20px; height: 20px;"></i> Exams</button>
            </div>
            
            <!-- (Resume Container moved to top) -->

            <!-- Practice Mode Section -->
            <div id="practice-section">
              <h2 style="font-family: 'Outfit'; font-size: 1.25rem; margin-bottom: 1rem;">Choose Your Exam Type</h2>
              <div class="dashboard-grid">
                ${ExamCard({
                  title: 'JAMB Practice',
                  description: 'Topic-based objective practice',
                  colorClass: 'jamb',
                  icon: '<i data-lucide="target" style="width: 24px; height: 24px;"></i>',
                  dataExamTarget: 'JAMB',
                  extraClass: 'practice-tier'
                })}
                ${ExamCard({
                  title: 'WAEC Practice',
                  description: 'Objective & Theory support',
                  colorClass: 'waec',
                  icon: '<i data-lucide="book" style="width: 24px; height: 24px;"></i>',
                  dataExamTarget: 'WAEC',
                  extraClass: 'practice-tier'
                })}
                ${ExamCard({
                  title: 'NECO Practice',
                  description: 'Objective & Theory support',
                  colorClass: 'neco',
                  icon: '<i data-lucide="pen-tool" style="width: 24px; height: 24px;"></i>',
                  dataExamTarget: 'NECO',
                  extraClass: 'practice-tier'
                })}
              </div>

              <!-- Practice Config -->
              <div id="practice-config" class="glass card scale-in" style="display: none; margin-top: 2rem; padding: 2.5rem;">
                <h3 id="practice-title" style="margin-bottom: 2rem; font-family: 'Outfit'; font-weight: 800; font-size: 1.35rem; color: var(--primary);">Configure Session</h3>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.5rem;">
                  <div>
                    <label style="display: block; font-size: 0.9rem; margin-bottom: 0.6rem; font-weight: 700; color: var(--text-primary);">Course / Subject</label>
                    <select id="p-subject" class="glass-select" style="width: 100%; height: 48px; border-radius: var(--radius-md);"></select>
                  </div>
                  <div id="p-topic-wrapper">
                    <label style="display: block; font-size: 0.9rem; margin-bottom: 0.6rem; font-weight: 700; color: var(--text-primary);">Specific Topic</label>
                    <select id="p-topic" class="glass-select" style="width: 100%; height: 48px; border-radius: var(--radius-md);">
                      <option value="">All Topics (Recommended)</option>
                    </select>
                  </div>
                  <div id="p-type-wrapper" style="display: none;">
                    <label style="display: block; font-size: 0.9rem; margin-bottom: 0.6rem; font-weight: 700; color: var(--text-primary);">Question Type</label>
                    <select id="p-type" class="glass-select" style="width: 100%; height: 48px; border-radius: var(--radius-md);">
                      <option value="objective">Objective (CBT)</option>
                      <option value="theory">Theory (Standard)</option>
                    </select>
                  </div>
                </div>
                <button id="p-start-btn" class="btn-dominant" style="margin-top: 2.5rem; width: 100%;">Start Practice Session</button>
              </div>
            </div>

            <!-- Exam Mode Section -->
            <div id="exam-section" style="display: none;">
              <h2 style="font-family: 'Outfit'; font-size: 1.25rem; margin-bottom: 1rem;">Structured Mock Exams</h2>
              <div class="dashboard-grid">
                ${ExamCard({
                  title: 'JAMB Mock',
                  description: '180 Questions | 120 Mins',
                  colorClass: 'jamb',
                  icon: '<i data-lucide="target" style="width: 24px; height: 24px;"></i>',
                  dataExamTarget: 'JAMB',
                  extraClass: 'exam-tier'
                })}
                ${ExamCard({
                  title: 'WAEC Mock',
                  description: 'Standard Full Exam',
                  colorClass: 'waec',
                  icon: '<i data-lucide="book" style="width: 24px; height: 24px;"></i>',
                  dataExamTarget: 'WAEC',
                  extraClass: 'exam-tier'
                })}
                ${ExamCard({
                  title: 'NECO Mock',
                  description: 'Standard Full Exam',
                  colorClass: 'neco',
                  icon: '<i data-lucide="pen-tool" style="width: 24px; height: 24px;"></i>',
                  dataExamTarget: 'NECO',
                  extraClass: 'exam-tier'
                })}
              </div>

              <!-- Exam Config -->
              <div id="exam-config" class="glass card scale-in" style="display: none; margin-top: 2rem; padding: 2.5rem;">
                <h3 id="exam-title" style="margin-bottom: 2rem; font-family: 'Outfit'; font-weight: 800; font-size: 1.35rem; color: var(--accent-secondary);">Setup Mock Exam</h3>
                
                <div id="jamb-exam-config" style="display: none;">
                    <p style="margin-bottom: 1.25rem; color: var(--accent-secondary); font-weight: 600;">English is mandatory. Select 3 additional subjects to complete your set.</p>
                    <div id="jamb-sub-list" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 1rem; max-height: 250px; overflow-y: auto; padding: 1.25rem; background: rgba(0,0,0,0.2); border-radius: var(--radius-md); border: 1px solid var(--glass-border);">
                    </div>
                </div>

                <div id="waec-neco-exam-config" style="display: none;">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
                        <div>
                            <label style="display: block; font-size: 0.9rem; margin-bottom: 0.6rem; font-weight: 700; color: var(--text-primary);">Subject</label>
                            <select id="e-subject" class="glass-select" style="width: 100%; height: 48px; border-radius: var(--radius-md);"></select>
                        </div>
                        <div>
                            <label style="display: block; font-size: 0.9rem; margin-bottom: 0.6rem; font-weight: 700; color: var(--text-primary);">Assessment Format</label>
                            <select id="e-type" class="glass-select" style="width: 100%; height: 48px; border-radius: var(--radius-md);">
                                <option value="objective">Objective (Recommended)</option>
                                <option value="theory">Theory (Graded by AI)</option>
                            </select>
                        </div>
                    </div>
                </div>
                <button id="e-start-btn" class="btn-dominant" style="margin-top: 2.5rem; width: 100%; background: var(--accent-gradient);">Begin Full Mock Exam</button>
              </div>
            </div>
        </div>

        <!-- PERFORMANCE INSIGHTS -->
        <div id="analytics-section" style="margin-top: 4rem;">
          <h2 style="font-family: 'Outfit'; font-size: 1.5rem; font-weight: 800; margin-bottom: 2rem; display: flex; align-items: center; gap: 0.75rem;">
            <i data-lucide="bar-chart-2" style="color: var(--success); width: 28px; height: 28px;"></i> Personalized Analysis
          </h2>
          <div class="analytics-grid" style="gap: 1.5rem;">
            <div class="glass card" style="padding: 1.5rem; display: flex; flex-direction: column; min-height: 350px;">
              <h4 style="margin-bottom: 1.5rem; color: var(--accent-primary); font-size: 1rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.02em;">Score History (Last 50 trials)</h4>
              <div style="flex: 1; min-height: 250px; display: flex; align-items: center; justify-content: center;">
                <canvas id="score-history-chart" style="width: 100% !important; height: auto !important;"></canvas>
              </div>
            </div>
            <div class="glass card" style="padding: 1.5rem; display: flex; flex-direction: column; min-height: 350px;">
              <h4 style="margin-bottom: 1.5rem; color: var(--success); font-size: 1rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.02em;">Subject Mastery (%)</h4>
              <div style="flex: 1; min-height: 280px; display: flex; align-items: center; justify-content: center;">
                <canvas id="subject-mastery-chart" style="width: 100% !important; height: auto !important; max-width: 400px; margin: 0 auto;"></canvas>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Leaderboard Modal -->
      <div id="leaderboard-modal" class="modal-overlay" style="display: none;">
        <div class="modal-content glass" style="max-width: 500px; width: 100%; position: relative; padding: 2.5rem; border-radius: var(--radius-lg);">
          <button id="close-leaderboard" class="btn-secondary" style="position: absolute; top: 1.25rem; right: 1.25rem; width: 40px; height: 40px; padding: 0; min-width: auto; border-radius: 50%; display: flex; align-items: center; justify-content: center;"><i data-lucide="x" style="width: 20px; height: 20px;"></i></button>
          <h2 style="font-family: 'Outfit'; margin-bottom: 2.5rem; font-weight: 900; text-align: center; display: flex; justify-content: center; align-items: center; gap: 0.75rem; color: var(--accent-primary); font-size: 1.75rem;"><i data-lucide="trophy" style="width: 28px; height: 28px;"></i> Global Rankings</h2>
          <div id="leaderboard-list">
            <div style="text-align: center; padding: 3rem; color: var(--text-secondary);">
              <div class="loader-spinner mb-md" style="margin: 0 auto; width: 32px; height: 32px;"></div>
              <p style="font-weight: 500;">Retrieving elite data...</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Upgrade Modal -->
      <div id="upgrade-modal" class="modal-overlay" style="display: none;">
        <div class="modal-content glass" style="max-width: 480px; width: 100%; position: relative; padding: 3rem; text-align: center; border-radius: var(--radius-lg);">
          <button id="close-upgrade" class="btn-secondary" style="position: absolute; top: 1.25rem; right: 1.25rem; width: 40px; height: 40px; padding: 0; min-width: auto; border-radius: 50%; display: flex; align-items: center; justify-content: center;"><i data-lucide="x" style="width: 20px; height: 20px;"></i></button>
          <div style="margin-bottom: 1.5rem; display: flex; justify-content: center;">
            ${profile.is_activated 
              ? '<div style="background: rgba(37, 99, 235, 0.1); padding: 1.25rem; border-radius: 50%;"><i data-lucide="rocket" style="width: 56px; height: 56px; color: var(--accent-primary);"></i></div>' 
              : '<div style="background: rgba(147, 51, 234, 0.1); padding: 1.25rem; border-radius: 50%;"><i data-lucide="sparkles" style="width: 56px; height: 56px; color: var(--accent-secondary);"></i></div>'}
          </div>
          <h2 style="font-family: 'Outfit'; margin-bottom: 0.75rem; font-weight: 900; color: var(--text-primary); font-size: 1.75rem;">${profile.is_activated ? 'Renew Pro Access' : 'CBT Elite Pro'}</h2>
          <p style="color: var(--text-secondary); margin-bottom: 2.5rem; font-size: 1rem; font-weight: 500; line-height: 1.6;">
            ${profile.is_activated 
               ? 'Your subscription keeps the AI explanations running. Renew to maintain your competitive edge.' 
               : 'A one-time activation unlocks the full syllabus forever, plus 30 days of unlimited AI corrections.'}
          </p>
          
          <div style="display: flex; flex-direction: column; gap: 1rem;">
            ${!profile.is_activated ? `
              <div class="glass card scale-in" style="padding: 1.75rem; border: 2px solid var(--accent-primary); background: linear-gradient(135deg, rgba(37, 99, 235, 0.05) 0%, transparent 100%); width: 100%;">
                <h4 style="margin-bottom: 0.5rem; color: var(--text-primary); font-weight: 800; font-size: 1rem; text-transform: uppercase; letter-spacing: 0.05em;">LIFETIME ACTIVATION</h4>
                <div style="font-size: 3rem; font-weight: 900; color: var(--accent-primary); margin-bottom: 0.75rem; font-family: 'Outfit';">₦1,500</div>
                <ul style="text-align: left; font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 2rem; list-style: none; padding: 0; display: flex; flex-direction: column; gap: 0.75rem; font-weight: 500;">
                  <li style="display: flex; align-items: center; gap: 0.5rem;"><i data-lucide="check-circle" style="width: 18px; color: var(--success);"></i> 30 Days Pro Access</li>
                  <li style="display: flex; align-items: center; gap: 0.5rem;"><i data-lucide="check-circle" style="width: 18px; color: var(--success);"></i> Complete Syllabus Access</li>
                  <li style="display: flex; align-items: center; gap: 0.5rem;"><i data-lucide="check-circle" style="width: 18px; color: var(--success);"></i> Personal Performance AI</li>
                </ul>
                <button id="pay-lifetime-btn" class="btn-dominant" style="width: 100%; height: 56px;">ACTIVATE NOW</button>
              </div>
            ` : `
              <div class="glass card scale-in" style="padding: 1.75rem; border: 2px solid var(--accent-secondary); background: linear-gradient(135deg, rgba(147, 51, 234, 0.05) 0%, transparent 100%); width: 100%;">
                <h4 style="margin-bottom: 0.5rem; color: var(--text-primary); font-weight: 800; font-size: 1rem; text-transform: uppercase; letter-spacing: 0.05em;">RENEW PRO PLAN</h4>
                <div style="font-size: 3rem; font-weight: 900; color: var(--accent-secondary); margin-bottom: 0.75rem; font-family: 'Outfit';">₦1,000</div>
                <ul style="text-align: left; font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 2rem; list-style: none; padding: 0; display: flex; flex-direction: column; gap: 0.75rem; font-weight: 500;">
                  <li style="display: flex; align-items: center; gap: 0.5rem;"><i data-lucide="check-circle" style="width: 18px; color: var(--success);"></i> Unlimited AI Corrections</li>
                  <li style="display: flex; align-items: center; gap: 0.5rem;"><i data-lucide="check-circle" style="width: 18px; color: var(--success);"></i> Unlimited Full Mock Exams</li>
                  <li style="display: flex; align-items: center; gap: 0.5rem;"><i data-lucide="check-circle" style="width: 18px; color: var(--success);"></i> Expert Theory AI Grading</li>
                </ul>
                <button id="pay-monthly-btn" class="btn-dominant" style="width: 100%; height: 56px; background: var(--accent-secondary);">RENEW SUBSCRIPTION</button>
              </div>
            `}
          </div>
        </div>
      </div>

      <!-- Help & Guide Modal -->
      <div id="help-modal" class="modal-overlay" style="display: none;">
        <div class="modal-content glass" style="max-width: 520px; width: 100%; position: relative; padding: 3rem; max-height: 85vh; overflow-y: auto; border-radius: var(--radius-lg);">
          <button id="close-help" class="btn-secondary" style="position: absolute; top: 1.25rem; right: 1.25rem; width: 40px; height: 40px; padding: 0; min-width: auto; border-radius: 50%; display: flex; align-items: center; justify-content: center;"><i data-lucide="x" style="width: 20px; height: 20px;"></i></button>
          <h2 style="font-family: 'Outfit'; margin-bottom: 2.5rem; font-weight: 900; display: flex; justify-content: center; align-items: center; gap: 0.75rem; color: var(--accent-primary); font-size: 1.75rem;"><i data-lucide="book-open"></i> Mastery Guide</h2>
          <div style="display: flex; flex-direction: column; gap: 1.5rem;">
             <div style="padding: 1.25rem; background: rgba(37, 99, 235, 0.05); border-radius: var(--radius-md); border-left: 4px solid var(--primary);">
               <h4 style="color: var(--primary); display: flex; align-items: center; gap: 0.6rem; font-weight: 800;"><i data-lucide="target" style="width: 20px; height: 20px;"></i> Targeted Practice</h4>
               <p style="font-size: 0.9rem; color: var(--text-secondary); margin-top: 0.5rem; line-height: 1.5; font-weight: 500;">Select specific topics to isolate and fix your knowledge gaps. The AI monitors your progress here.</p>
             </div>
             <div style="padding: 1.25rem; background: rgba(147, 51, 234, 0.05); border-radius: var(--radius-md); border-left: 4px solid var(--accent-secondary);">
               <h4 style="color: var(--accent-secondary); display: flex; align-items: center; gap: 0.6rem; font-weight: 800;"><i data-lucide="trophy" style="width: 20px; height: 20px;"></i> Mock Examinations</h4>
               <p style="font-size: 0.9rem; color: var(--text-secondary); margin-top: 0.5rem; line-height: 1.5; font-weight: 500;">Simulate actual JAMB/WAEC standard time and question counts to build exam endurance.</p>
             </div>
             <div style="padding: 1.25rem; background: rgba(16, 185, 129, 0.05); border-radius: var(--radius-md); border-left: 4px solid var(--success);">
               <h4 style="color: var(--success); display: flex; align-items: center; gap: 0.6rem; font-weight: 800;"><i data-lucide="sparkles" style="width: 20px; height: 20px;"></i> AI Tutor (Review)</h4>
               <p style="font-size: 0.9rem; color: var(--text-secondary); margin-top: 0.5rem; line-height: 1.5; font-weight: 500;">After any session, click "Review Correction" to have the AI explain the "Why" behind the correct answer.</p>
             </div>
          </div>
        </div>
      </div>
    `

    // Dynamically render the newly injected string icons into robust SVGs across the container DOM
    const renderLucide = () => {
      if (window.lucide) {
        window.lucide.createIcons({ root: container });
      } else {
        setTimeout(renderLucide, 100);
      }
    };
    renderLucide();

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
                    <table class="premium-table">
                      <thead>
                        <tr>
                          <th>RANK</th>
                          <th>ELITE STUDENT</th>
                          <th style="text-align: right;">QUESTIONS</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${data.map((entry, i) => `
                          <tr style="${entry.users?.username === profile.username ? 'background: var(--primary)1A; border-left: 3px solid var(--primary);' : ''}">
                            <td>
                              <div class="rank-badge ${i < 3 ? 'rank-' + (i + 1) : ''}">${i + 1}</div>
                            </td>
                            <td style="display: flex; align-items: center; gap: 1rem;">
                              <div class="user-avatar">
                                ${entry.users?.username?.charAt(0).toUpperCase() || '?'}
                              </div>
                              <span style="font-weight: 800; font-family: 'Outfit'; color: var(--text-primary);">${entry.users?.username || 'Anonymous'}</span>
                            </td>
                            <td style="text-align: right; font-weight: 900; color: var(--primary); font-family: 'Outfit'; font-size: 1.1rem;">${entry.total_questions_answered || 0}</td>
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
            const pSec = document.getElementById('practice-section')
            const eSec = document.getElementById('exam-section')
            const pTab = document.getElementById('view-practice')
            const eTab = document.getElementById('view-exam')
            
            if (pTab && eTab && pSec && eSec) {
                pTab.classList.add('active'); eTab.classList.remove('active')
                pSec.style.display = 'block'; eSec.style.display = 'none'
                pSec.scrollIntoView({ behavior: 'smooth' })
                
                // Sync Bottom Nav Highlight
                const navItems = document.querySelectorAll('.nav-item, .bottom-nav-item')
                navItems.forEach(nav => nav.classList.remove('active'))
                document.querySelectorAll('[data-view="exams"]').forEach(v => v.classList.add('active'))
            }
        }
    }
    if (quickExamBtn) {
        quickExamBtn.onclick = () => {
            const pSec = document.getElementById('practice-section')
            const eSec = document.getElementById('exam-section')
            const pTab = document.getElementById('view-practice')
            const eTab = document.getElementById('view-exam')
            
            if (pTab && eTab && pSec && eSec) {
                eTab.classList.add('active'); pTab.classList.remove('active')
                eSec.style.display = 'block'; pSec.style.display = 'none'
                eSec.scrollIntoView({ behavior: 'smooth' })
                
                // Sync Bottom Nav Highlight
                const navItems = document.querySelectorAll('.nav-item, .bottom-nav-item')
                navItems.forEach(nav => nav.classList.remove('active'))
                document.querySelectorAll('[data-view="exams"]').forEach(v => v.classList.add('active'))
            }
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


    // Store intervals for cleanup if necessary
    this.activeIntervals = []

    // Await core data initialization and refresh icons for dynamic content
    await initData()
    renderLucide()
    
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
                aiWorkoutBtn.innerHTML = '<span style="display:flex; align-items:center; gap:0.5rem;"><i data-lucide="rocket" style="width: 18px; height: 18px;"></i> Start Personalized Session</span>'
            }
        }
    }
  },

  async renderCharts(userId) {
    const { history, mastery, error } = await DataService.getUserAnalytics(userId)
    const analyticsSection = document.getElementById('analytics-section')
    if (error || (!history.length && !mastery.length)) {
      analyticsSection.innerHTML = `
        <h2 style="font-family: 'Outfit'; font-size: 1.25rem; margin-bottom: 1.5rem; display: flex; align-items: center; gap: 0.5rem;"><i data-lucide="bar-chart-2" style="color: var(--success); width: 24px; height: 24px;"></i> Performance Insights</h2>
        <div class="empty-state-card glass cta-pulse" style="display: flex; flex-direction: column; align-items: center;">
           <div style="margin-bottom: 1.5rem; color: var(--accent-primary);"><i data-lucide="rocket" style="width: 48px; height: 48px;"></i></div>
           <h3 style="font-size: 1.25rem; color: var(--text-primary); margin-bottom: 0.75rem;">Ready for your first session?</h3>
           <p style="font-size: 0.95rem; color: var(--text-secondary); max-width: 400px; margin-bottom: 2rem;">Take your first practice test or mock exam to unlock personalized performance charts, subject mastery scores, and your readiness evaluation.</p>
           <button class="primary" onclick="window.scrollTo({top: 0, behavior: 'smooth'})">Start Practicing Now</button>
        </div>
      `
      return
    }
    analyticsSection.style.opacity = '1'

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

    // 3. Exam Readiness Gauge Initialization
    const initReadinessGauge = async () => {
      const gaugePath = document.getElementById('readiness-progress-path')
      const gaugeText = document.getElementById('readiness-percentage')
      const gaugeSub = document.getElementById('readiness-subject')
      const gaugeStat = document.getElementById('readiness-status')
      
      if (!gaugePath || !mastery || mastery.length === 0) {
        if (gaugeSub) gaugeSub.textContent = "Start Practicing";
        return
      }

      // Find top subject by total attempted or average
      const topSub = mastery.reduce((prev, curr) => (prev.total_attempted > curr.total_attempted) ? prev : curr)
      gaugeSub.textContent = topSub.subject
      
      const { data: score, error } = await DataService.getReadinessScore(profile.id, topSub.subject)
      
      if (!error) {
        gaugePath.style.strokeDasharray = `${score}, 100`
        gaugeText.textContent = `${score}%`
        
        if (score < 30) {
          gaugeStat.textContent = "Beginner"
          gaugeStat.style.color = "var(--text-secondary)"
        } else if (score < 70) {
          gaugeStat.textContent = "Intermediate"
          gaugeStat.style.color = "var(--accent-secondary)"
        } else {
          gaugeStat.textContent = "Ready for JAMB"
          gaugeStat.style.color = "var(--success)"
        }
      }
    }
    
    initReadinessGauge()
  },

  hide() {
    document.getElementById('dashboard-container').style.display = 'none'
  }
}


