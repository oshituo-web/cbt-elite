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
    this.onStartExam = onStartExam
    this.onOpenAdmin = onOpenAdmin
    this.onReadNews = onReadNews
    
    const container = document.getElementById('dashboard-container')
    container.style.display = 'block'
    
    // 🔥 FIX: Reset scroll position to top immediately
    window.scrollTo(0, 0);
    document.body.scrollTop = 0;
    container.scrollTop = 0;

    // Handle Tier Transitions & Daily Resets
    const updatedUser = profile ? await SubscriptionService.handleTierTransition(profile) : null
    this.profile = updatedUser || profile || { username: 'Student', id: 'anon' }
    
    let history = []
    let mastery = []
    let isSystemFree = false

    try {
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
    
    if (history && history.length > 0) {
        history.forEach(s => {
            if (s && s.created_at) {
                const sDate = new Date(s.created_at)
                if (sDate.toDateString() === today) todayQuestions += (s.total_questions || 0)
                totalQuestions += (s.total_questions || 0)
                totalCorrect += (s.correct_answers || 0)
            }
        })
        accuracy = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0
    }
    
    const dailyGoalLimit = 50
    const dailyGoalPct = Math.min((todayQuestions / dailyGoalLimit) * 100, 100)
    
    // Determine Achievements
    const badges = [];
    if (profile.streak_count >= 7) badges.push({ emoji: '<i data-lucide="flame" style="width: 16px; height: 16px; color: var(--warning);"></i>', title: '7-Day Streak' });
    if (totalQuestions >= 500) badges.push({ emoji: '<i data-lucide="shield" style="width: 16px; height: 16px; color: var(--accent-secondary);"></i>', title: 'Veteran' });
    if (accuracy >= 80 && history.length >= 5) badges.push({ emoji: '<i data-lucide="target" style="width: 16px; height: 16px; color: var(--primary);"></i>', title: 'Sharpshooter' });
    if (profile.activation_status) badges.push({ emoji: '<i data-lucide="gem" style="width: 16px; height: 16px; color: var(--accent-primary);"></i>', title: 'Activated' });

    // Determine Weak Subject
    let weakSubject = null
    if (mastery && mastery.length > 0) {
        try {
            const potentialWeakSubjects = mastery.filter(m => m.total_attempted >= 2 && (m.average || 0) < 50)
            if (potentialWeakSubjects.length > 0) {
                weakSubject = potentialWeakSubjects.reduce((prev, curr) => ((prev.average || 0) < (curr.average || 0)) ? prev : curr)
            }
        } catch (e) { console.error(e) }
    }

    container.innerHTML = `
      <div id="dashboard-content" class="dashboard-scroll-area">
        
        <!-- DASHBOARD WELCOME -->
        <div class="mb-md" style="padding-top: 0.5rem;">
          <h1 class="responsive-h1" style="font-family: 'Outfit'; margin: 0; font-weight: 800; color: var(--text-primary); display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
            Welcome, ${this.profile.username || 'Student'} 
            <i data-lucide="sun" style="width: 28px; height: 28px; color: var(--warning);"></i>
          </h1>
          <p style="font-size: 0.95rem; color: var(--text-secondary); margin-top: 0.3rem; font-weight: 500;">Let's make today count.</p>
        </div>

        <!-- QUICK ACTION SECTION -->
        <div class="glass card scale-in mb-lg" style="text-align: center; padding: 1.5rem 1rem; border: 2px solid rgba(37, 99, 235, 0.4); background: linear-gradient(180deg, rgba(37, 99, 235, 0.04) 0%, var(--surface-color) 100%);">
          <h2 style="font-family: 'Outfit'; font-size: 1.5rem; margin-bottom: 0.25rem; color: var(--text-primary); font-weight: 800;">Elite Mastery</h2>
          <p style="color: var(--text-secondary); margin-bottom: 1.5rem; font-size: 0.9rem;">Select your mode to begin.</p>
          <div style="display: flex; justify-content: center; gap: 0.75rem; flex-wrap: wrap; width: 100%;">
             <button id="quick-practice-btn" class="btn-primary" style="padding: 0 1.25rem; flex: 1; min-width: 140px; font-size: 0.95rem;"><i data-lucide="target" style="width:18px;"></i> Practice</button>
             <button id="quick-exam-btn" class="btn-secondary" style="padding: 0 1.25rem; flex: 1; min-width: 140px; font-weight: 800;"><i data-lucide="trophy" style="width:18px;"></i> Mock Exam</button>
             <button id="start-saved" class="glass-btn" style="padding: 0 1.25rem; border-color: var(--accent-primary); display: none; flex: 1; min-width: 140px;"><i data-lucide="bookmark" style="width:18px;"></i> Saved (<span id="bookmark-count">0</span>)</button>
          </div>
        </div>

        <!-- Dynamic Tier-Based UI -->
        ${(() => {
          const subState = SubscriptionManager.getUserSubscriptionState(profile, isSystemFree);
          if (subState.tier === "premium" && subState.daysRemaining > 5) return '';

          return `
            <div class="glass card scale-in mb-lg" style="padding: 1.25rem; border: 1.5px solid ${subState.isExpired ? 'var(--error)' : (subState.daysRemaining <= 5 && subState.tier === 'premium' ? 'var(--warning)' : 'var(--accent-primary)')};">
              <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
                <div style="flex: 1; min-width: 200px;">
                  <h4 style="font-family: 'Outfit'; font-size: 1.1rem; font-weight: 800; margin-bottom: 0.25rem;">
                    ${subState.isExpired ? 'Premium Expired' : (subState.daysRemaining <= 5 && subState.tier === 'premium' ? 'Expiring Soon' : 'Activate Full Access')}
                  </h4>
                  <p style="font-size: 0.85rem; color: var(--text-secondary); margin: 0;">
                    ${subState.isExpired ? 'Renew now to restore full AI access.' : (subState.daysRemaining <= 5 && subState.tier === 'premium' ? `Your access ends in ${subState.daysRemaining} days.` : 'Unlock all subjects and AI explanations.')}
                  </p>
                </div>
                <button class="btn-dominant" style="height: 44px; padding: 0 1.25rem; font-size: 0.9rem; min-width: 140px; background: ${subState.isExpired ? 'var(--error)' : (subState.daysRemaining <= 5 && subState.tier === 'premium' ? 'var(--warning)' : 'var(--primary)')};" onclick="document.getElementById('upgrade-modal').style.display='flex'">
                  ${subState.isActivated ? 'Renew Now' : 'Upgrade – ₦1,500'}
                </button>
              </div>
            </div>
          `;
        })()}

         <!-- PROGRESS & ANALYTICS (Standardized Grid) -->
         <div class="dashboard-responsive-grid mb-lg" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.25rem;">
            
            <!-- Progress Card -->
            <div class="glass card" style="padding: 1.5rem; display: flex; flex-direction: column; min-height: 280px; justify-content: space-between;">
              <h3 style="color: var(--text-secondary); font-size: 0.85rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 1rem;">Progress Overview</h3>
              
              <div style="display: flex; gap: 1.5rem; align-items: center; justify-content: center; flex: 1;">
                 <div id="readiness-gauge-container" style="position: relative; width: 80px; height: 80px; flex-shrink: 0;">
                    <svg viewBox="0 0 36 36" style="width: 100%; height: 100%; transform: rotate(-90deg);">
                      <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="rgba(59, 130, 246, 0.1)" stroke-width="3" />
                      <path id="readiness-progress-path" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="var(--primary)" stroke-width="3" stroke-dasharray="0, 100" stroke-linecap="round" />
                    </svg>
                    <div id="readiness-percentage" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-weight: 900; font-size: 1rem; color: var(--primary);">0%</div>
                 </div>
                 <div style="text-align: left;">
                    <div id="readiness-label" style="font-size: 0.7rem; font-weight: 800; color: var(--text-secondary); text-transform: uppercase;">Top Subject</div>
                    <div id="readiness-subject" style="font-family: 'Outfit'; font-size: 1.1rem; font-weight: 800; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 150px;">...</div>
                    <div id="readiness-status" style="font-size: 0.8rem; font-weight: 700; color: var(--success);">Beginner</div>
                 </div>
              </div>

              <div style="display: flex; justify-content: space-around; padding: 1rem; background: rgba(255,255,255,0.03); border-radius: 12px; margin-top: 1rem;">
                <div style="text-align: center;">
                  <div style="font-size: 1.5rem; font-family: 'Outfit'; font-weight: 900; color: var(--primary);">${totalQuestions}</div>
                  <div style="font-size: 0.75rem; color: var(--text-secondary);">Attempted</div>
                </div>
                <div style="text-align: center;">
                   <div style="font-size: 1.5rem; font-family: 'Outfit'; font-weight: 900; color: var(--primary);">${history.length > 0 ? accuracy + '%' : '--'}</div>
                   <div style="font-size: 0.75rem; color: var(--text-secondary);">Accuracy</div>
                </div>
              </div>
            </div>

            <!-- AI Insight Card -->
            <div class="glass card" style="padding: 1.5rem; display: flex; flex-direction: column; min-height: 280px; justify-content: space-between; border-left: 4px solid var(--accent-secondary);">
              <h3 style="color: var(--text-secondary); font-size: 0.85rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 1rem;">AI Performance Analysis</h3>
              
              <div style="flex: 1; display: flex; align-items: center;">
                <p style="font-size: 0.95rem; color: var(--text-secondary); line-height: 1.5; font-weight: 500; margin: 0;">
                  ${(() => {
                      if (history.length < 5) return `Keep practicing! Complete <strong>${5 - history.length} more sessions</strong> to unlock deep AI analysis of your mastery gaps.`;
                      
                      const sorted = [...(mastery || [])].sort((a,b) => (b.average || 0) - (a.average || 0));
                      if (sorted.length === 0) return "Analyzing your initial sessions... Keep up the pace to build your performance profile!";
                      
                      const best = sorted[0];
                      const worst = sorted[sorted.length - 1];
                      let insight = `Your strength is <strong>${best.subject}</strong> (${best.average}%). `;
                      if (worst && worst.subject !== best.subject) {
                          insight += `Mastery in <strong>${worst.subject}</strong> is at ${worst.average}%. Focused practice here is advised.`;
                      }
                      return insight;
                  })()}
                </p>
              </div>

              <div style="margin-top: 1rem; display: flex; gap: 0.5rem;">
                ${(weakSubject) ? `
                  <button id="practice-weak-btn" class="btn-primary" style="padding: 0 1rem; height: 40px; font-size: 0.75rem; flex: 1;"><i data-lucide="target" style="width: 14px;"></i> Target ${weakSubject.subject}</button>
                ` : `
                  <button id="start-ai-workout" class="btn-dominant" style="padding: 0 1rem; height: 40px; font-size: 0.75rem; flex: 1;"><i data-lucide="sparkles" style="width: 14px;"></i> AI Workout</button>
                `}
                <button id="full-analysis-btn" class="btn-secondary" style="padding: 0 1rem; height: 40px; font-size: 0.75rem; flex: 1; border-color: var(--accent-primary); color: var(--accent-primary);"><i data-lucide="bar-chart-2" style="width: 14px;"></i> ANALYSIS</button>
              </div>
            </div>
         </div>

        <!-- QUICK ACTIONS GRID -->
        <div class="dashboard-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 1rem;">
          <div id="quick-practice-btn-grid" class="glass card scale-in" style="cursor: pointer; padding: 1rem; border-bottom: 3px solid var(--primary); align-items: center; flex-direction: row; gap: 0.75rem;">
            <div style="background: rgba(37, 99, 235, 0.1); padding: 0.5rem; border-radius: 10px; color: var(--primary);"><i data-lucide="target" style="width:20px;"></i></div>
            <div style="text-align: left;"><h4 style="font-weight: 800; font-size: 0.9rem; margin: 0;">Practice</h4></div>
          </div>
          <div id="quick-exam-btn-grid" class="glass card scale-in" style="cursor: pointer; padding: 1rem; border-bottom: 3px solid var(--accent-secondary); align-items: center; flex-direction: row; gap: 0.75rem;">
            <div style="background: rgba(147, 51, 234, 0.1); padding: 0.5rem; border-radius: 10px; color: var(--accent-secondary);"><i data-lucide="trophy" style="width:20px;"></i></div>
            <div style="text-align: left;"><h4 style="font-weight: 800; font-size: 0.9rem; margin: 0;">Exams</h4></div>
          </div>
          <div id="view-leaderboard-grid" class="glass card scale-in" style="cursor: pointer; padding: 1rem; border-bottom: 3px solid var(--success); align-items: center; flex-direction: row; gap: 0.75rem;">
            <div style="background: rgba(16, 185, 129, 0.1); padding: 0.5rem; border-radius: 10px; color: var(--success);"><i data-lucide="bar-chart-3" style="width:20px;"></i></div>
            <div style="text-align: left;"><h4 style="font-weight: 800; font-size: 0.9rem; margin: 0;">Rankings</h4></div>
          </div>
        </div>

        <!-- ANALYTICS CHARTS -->
        <div id="analytics-section" style="margin-top: 2.5rem;">
          <h2 style="font-family: 'Outfit'; font-size: 1.25rem; font-weight: 900; margin-bottom: 1.25rem; display: flex; align-items: center; gap: 0.5rem;">
            <i data-lucide="bar-chart-2" style="color: var(--success); width: 24px;"></i> Analytics
          </h2>
          <div class="analytics-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.25rem;">
            <div class="glass card" style="padding: 1rem; min-height: 250px; width: 100%; overflow: hidden;">
              <h4 style="margin-bottom: 1rem; color: var(--accent-primary); font-size: 0.8rem; font-weight: 800; text-transform: uppercase;">Score Trend</h4>
              <div style="flex: 1; width: 100%; height: 180px;"><canvas id="score-history-chart"></canvas></div>
            </div>
            <div class="glass card" style="padding: 1rem; min-height: 250px; width: 100%; overflow: hidden;">
              <h4 style="margin-bottom: 1rem; color: var(--success); font-size: 0.8rem; font-weight: 800; text-transform: uppercase;">Subject Mastery</h4>
              <div style="flex: 1; width: 100%; height: 180px;"><canvas id="subject-mastery-chart"></canvas></div>
            </div>
          </div>
        </div>

        <!-- Help Guide CTA -->
        <div class="glass card" style="margin-top: 2.5rem; background: var(--accent-gradient); border: none; padding: 1.5rem; display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: 1rem; text-align: center;">
           <div style="flex: 1; min-width: 200px; color: white;">
              <h3 style="font-family: 'Outfit'; font-weight: 900; font-size: 1.25rem; margin-bottom: 0.25rem;">Need a headstart?</h3>
              <p style="opacity: 0.9; font-size: 0.85rem; margin-bottom: 1rem;">Unleash the full power of CBT Elite.</p>
              <button id="help-guide-btn" class="btn-secondary" style="background: white; color: var(--primary); border: none; font-weight: 800; width: 100%; height: 40px; font-size: 0.85rem;">Launch Tour</button>
           </div>
        </div>

        <!-- FOOTER -->
        <footer style="margin-top: 4rem; padding: 2rem 1rem; text-align: center; border-top: 1px solid var(--glass-border); opacity: 0.6;">
          <p style="font-size: 0.75rem; color: var(--text-secondary); line-height: 1.6;">© 2026 CBT Elite Platform</p>
        </footer>
      </div>

      <!-- Leaderboard Modal -->
      <div id="leaderboard-modal" class="modal-overlay" style="display: none;">
        <div class="modal-content glass" style="max-width: 500px; width: 92%; position: relative; padding: 1.5rem 1rem; border-radius: 20px;">
          <button id="close-leaderboard" class="btn-secondary" style="position: absolute; top: 0.75rem; right: 0.75rem; width: 32px; height: 32px; padding: 0; min-width: auto; border-radius: 50%;">&times;</button>
          <h2 style="font-family: 'Outfit'; margin-bottom: 1.5rem; font-weight: 900; text-align: center; color: var(--accent-primary); font-size: 1.35rem;">Global Rankings</h2>
          <div id="leaderboard-list"></div>
        </div>
      </div>

      <!-- Upgrade Modal -->
      <div id="upgrade-modal" class="modal-overlay" style="display: none;">
        <div class="modal-content glass" style="max-width: 480px; width: 92%; position: relative; padding: 2rem 1rem; text-align: center; border-radius: 20px; max-height: 90vh; overflow-y: auto;">
          <button id="close-upgrade" class="btn-secondary" style="position: absolute; top: 0.75rem; right: 0.75rem; width: 32px; height: 32px; padding: 0; min-width: auto; border-radius: 50%;">&times;</button>
          <h2 style="font-family: 'Outfit'; margin-bottom: 0.5rem; font-weight: 900; color: var(--text-primary); font-size: 1.5rem;">CBT Elite Pro</h2>
          <p style="color: var(--text-secondary); margin-bottom: 1.5rem; font-size: 0.9rem;">Unlock AI-powered learning.</p>
          <div style="display: flex; flex-direction: column; gap: 1rem;">
            <div class="glass card" style="padding: 1.25rem; border: 2px solid var(--accent-primary); background: rgba(37, 99, 235, 0.05);">
              <h4 style="font-weight: 800; font-size: 0.85rem; text-transform: uppercase;">LIFETIME ACCESS</h4>
              <div style="font-size: 2rem; font-weight: 900; color: var(--accent-primary); margin: 0.4rem 0;">₦1,500</div>
              <button id="pay-lifetime-btn" class="btn-dominant" style="width: 100%; height: 48px;">ACTIVATE NOW</button>
            </div>
            <div class="glass card" style="padding: 1.25rem; border: 2px solid var(--accent-secondary); background: rgba(147, 51, 234, 0.05);">
              <h4 style="font-weight: 800; font-size: 0.85rem; text-transform: uppercase;">MONTHLY RENEWAL</h4>
              <div style="font-size: 2rem; font-weight: 900; color: var(--accent-secondary); margin: 0.4rem 0;">₦1,000</div>
              <button id="pay-monthly-btn" class="btn-dominant" style="width: 100%; height: 48px; background: var(--accent-secondary);">RENEW NOW</button>
            </div>
          </div>
        </div>
      </div>
    `

    const renderLucide = () => {
      if (window.lucide) window.lucide.createIcons({ root: container });
      else setTimeout(renderLucide, 100);
    };
    renderLucide();

    const pSec = document.getElementById('practice-section')
    const eSec = document.getElementById('exam-section')
    const pTab = document.getElementById('view-practice')
    const eTab = document.getElementById('view-exam')

    if (pTab && eTab) {
        pTab.onclick = () => {
            pTab.classList.add('active'); eTab.classList.remove('active')
            if (pSec) pSec.style.display = 'block'
            if (eSec) eSec.style.display = 'none'
        }
        eTab.onclick = () => {
            eTab.classList.add('active'); pTab.classList.remove('active')
            if (eSec) eSec.style.display = 'block'
            if (pSec) pSec.style.display = 'none'
        }
    }

    const adminBtn = document.getElementById('admin-panel-btn')
    if (adminBtn) adminBtn.onclick = () => this.onOpenAdmin()

    const upgradeModal = document.getElementById('upgrade-modal')
    const closeUpgrade = document.getElementById('close-upgrade')
    const payLifetime = document.getElementById('pay-lifetime-btn')
    const payMonthly = document.getElementById('pay-monthly-btn')

    if (closeUpgrade) closeUpgrade.onclick = () => upgradeModal.style.display = 'none'

    const triggerPayment = (amount, planName) => {
        const handler = PaystackPop.setup({
            key: import.meta.env.VITE_PAYSTACK_PUBLIC_KEY || 'pk_test_placeholder', 
            email: profile.email,
            amount: amount,
            currency: 'NGN',
            callback: async (response) => {
                const isFirstTime = !profile.activation_status
                let rpcError;
                if (isFirstTime) {
                   const { error } = await DataService.activateUserLifetime(profile.id)
                   rpcError = error
                } else {
                   const { error } = await DataService.subscribeUser(profile.id, 'monthly')
                   rpcError = error
                }
                if (!rpcError) {
                    alert(`Congratulations! Account ${isFirstTime ? 'Activated' : 'Renewed'}.`)
                    location.reload()
                } else { alert("Upgrade failed. Contact support.") }
            },
            onClose: () => alert('Transaction cancelled.')
        })
        handler.openIframe()
    }

    if (payLifetime) payLifetime.onclick = () => triggerPayment(150000, 'activation')
    if (payMonthly) payMonthly.onclick = () => triggerPayment(100000, 'monthly')

    const quickPracticeGrid = document.getElementById('quick-practice-btn-grid')
    const quickExamGrid = document.getElementById('quick-exam-btn-grid')
    const leaderboardGrid = document.getElementById('view-leaderboard-grid')

    if (quickPracticeGrid) quickPracticeGrid.onclick = () => window.navigateTo('practice', profile)
    if (quickExamGrid) quickExamGrid.onclick = () => window.navigateTo('exams', profile)
    
    const leaderboardModal = document.getElementById('leaderboard-modal')
    const closeLeaderboard = document.getElementById('close-leaderboard')
    if (leaderboardGrid) {
        leaderboardGrid.onclick = () => {
            if (leaderboardModal) leaderboardModal.style.display = 'flex'
            this.loadLeaderboard(profile)
        }
    }
    if (closeLeaderboard) closeLeaderboard.onclick = () => leaderboardModal.style.display = 'none'

    const initData = async () => {
      try {
        const { count: bCount } = await DataService.getBookmarkCount(profile.id)
        const bCountEl = document.getElementById('bookmark-count')
        if (bCountEl) bCountEl.textContent = bCount || 0
        if (bCount > 0) {
            const bBtn = document.getElementById('start-saved')
            if (bBtn) {
                bBtn.style.display = 'flex'
                bBtn.onclick = async () => {
                    const { data } = await DataService.getBookmarks(profile.id)
                    if (data && data.length > 0) this.onStartExam(data, 'saved', 'Saved', 'Collection')
                }
            }
        }
        this.renderCharts(profile.id)
      } catch (err) { console.error(err) }
    }

    const helpBtn = document.getElementById('help-guide-btn')
    if (helpBtn) helpBtn.onclick = () => TourGuide.start()

    const fullAnalysisBtn = document.getElementById('full-analysis-btn')
    if (fullAnalysisBtn) {
        fullAnalysisBtn.onclick = () => {
            const section = document.getElementById('analytics-section')
            if (section) section.scrollIntoView({ behavior: 'smooth' })
        }
    }

    const quickPracticeBtn = document.getElementById('quick-practice-btn')
    const quickExamBtn = document.getElementById('quick-exam-btn')
    if (quickPracticeBtn) quickPracticeBtn.onclick = () => window.navigateTo('practice', profile)
    if (quickExamBtn) quickExamBtn.onclick = () => window.navigateTo('exams', profile)

    await initData()
    renderLucide()
    
    const playHaptic = () => { if (typeof navigator.vibrate === 'function') navigator.vibrate(10) }
    document.querySelectorAll('button').forEach(btn => {
        if (!btn.dataset.haptic) {
            btn.dataset.haptic = "true"
            btn.addEventListener('click', playHaptic)
        }
    })

    const aiWorkoutBtn = document.getElementById('start-ai-workout')
    if (aiWorkoutBtn) {
        aiWorkoutBtn.onclick = async () => {
            aiWorkoutBtn.disabled = true
            aiWorkoutBtn.innerHTML = '<div class="loader-spinner" style="width:16px;height:16px;"></div> Analyzing...'
            const questions = await DataService.getRecommendedQuestions(profile.id)
            if (questions && questions.length > 0) {
                this.onStartExam(questions, 'practice', 'AI Workout', 'Personalized')
            } else {
                alert("Need more data! Try some regular practices first.")
                aiWorkoutBtn.disabled = false
                aiWorkoutBtn.innerHTML = 'AI Workout'
            }
        }
    }

    const weakPracticeBtn = document.getElementById('practice-weak-btn')
    if (weakPracticeBtn && weakSubject) {
        weakPracticeBtn.onclick = () => {
             window.navigateTo('practice', profile)
             setTimeout(() => {
                 const pSub = document.getElementById('p-subject')
                 if (pSub) {
                     for(let i=0; i < pSub.options.length; i++) {
                         if (pSub.options[i].text.toLowerCase() === weakSubject.subject.toLowerCase() || pSub.options[i].text.includes(weakSubject.subject)) {
                             pSub.selectedIndex = i; pSub.dispatchEvent(new Event('change')); break;
                         }
                     }
                 }
                 const config = document.getElementById('practice-config'); if (config) config.scrollIntoView({ behavior: 'smooth' })
             }, 800)
        }
    }
  },

  async renderCharts(userId) {
    const { history, mastery, error } = await DataService.getUserAnalytics(userId)
    const historyCtx = document.getElementById('score-history-chart')?.getContext('2d')
    if (historyCtx && history.length > 0) {
        if (this._historyChart) this._historyChart.destroy()
        this._historyChart = new Chart(historyCtx, {
            type: 'line',
            data: {
                labels: history.map((_, i) => i + 1),
                datasets: [{
                    label: 'Score %',
                    data: history.map(h => h.score_percentage),
                    borderColor: '#2563EB',
                    backgroundColor: 'rgba(37, 99, 235, 0.1)',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, max: 100 } } }
        })
    }

    const masteryCanvas = document.getElementById('subject-mastery-chart')
    if (masteryCanvas && mastery.length > 0) {
        const masteryCtx = masteryCanvas.getContext('2d')
        if (this._masteryChart) this._masteryChart.destroy()
        this._masteryChart = new Chart(masteryCtx, {
            type: 'radar',
            data: {
                labels: mastery.map(m => m.subject),
                datasets: [{
                    label: 'Mastery %',
                    data: mastery.map(m => m.average),
                    backgroundColor: 'rgba(16, 185, 129, 0.2)',
                    borderColor: '#10B981'
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, scales: { r: { min: 0, max: 100 } } }
        })
    }

    const gaugePath = document.getElementById('readiness-progress-path')
    const gaugeText = document.getElementById('readiness-percentage')
    const gaugeSub = document.getElementById('readiness-subject')
    if (gaugePath && mastery.length > 0) {
        const topSub = mastery.reduce((prev, curr) => (prev.total_attempted > curr.total_attempted) ? prev : curr)
        if (gaugeSub) gaugeSub.textContent = topSub.subject
        const { data: score } = await DataService.getReadinessScore(userId, topSub.subject)
        gaugePath.style.strokeDasharray = `${score || 0}, 100`
        if (gaugeText) gaugeText.textContent = `${score || 0}%`
    }
  },

  async loadLeaderboard(profile) {
    const leaderboardList = document.getElementById('leaderboard-list')
    if (!leaderboardList) return
    leaderboardList.innerHTML = '<div style="text-align:center;padding:2rem;"><div class="loader-spinner"></div></div>'
    const { data } = await DataService.getLeaderboard()
    if (!data || data.length === 0) {
      leaderboardList.innerHTML = '<div style="text-align:center;padding:2rem;">No data yet.</div>'
      return
    }
    leaderboardList.innerHTML = `
      <div style="overflow-x:auto;">
        <table class="premium-table" style="width:100%;border-collapse:collapse;">
          <thead><tr style="text-align:left;color:var(--text-secondary);font-size:0.75rem;"><th>RANK</th><th>STUDENT</th><th style="text-align:right;">ANSWERS</th></tr></thead>
          <tbody>
            ${data.map((entry, i) => `
              <tr style="border-bottom:1px solid var(--glass-border);${entry.users?.username === profile.username ? 'background:rgba(37,99,235,0.1);' : ''}">
                <td style="padding:0.75rem 0;">${i + 1}</td>
                <td style="padding:0.75rem 0;font-weight:700;">${entry.users?.username || 'Anon'}</td>
                <td style="padding:0.75rem 0;text-align:right;color:var(--primary);font-weight:900;">${entry.total_questions_answered || 0}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `
  },

  hide() {
    document.getElementById('dashboard-container').style.display = 'none'
  }
}
