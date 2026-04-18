import { DataService } from '../services/data'
import { supabase } from '../utils/supabase'
import { AuthService } from '../services/auth'
import { WeeklyRecapComponent } from './WeeklyRecap'
import { TourGuide } from '../utils/TourGuide'
import { SubscriptionService } from '../services/subscriptionService'
import { SubscriptionManager } from '../utils/subscriptionManager'
import { ExamCard } from './ExamCard'

export const DashboardComponent = {
  profile: null,
  onStartExam: null,
  MILESTONES: [
    { id: 'enthusiast', target: 50, title: 'Enthusiast', badge: 'star', color: '#f59e0b', starCount: 1 },
    { id: 'master', target: 100, title: 'Master', badge: 'award', color: '#8b5cf6', starCount: 2 },
    { id: 'legend', target: 150, title: 'Legend', badge: 'crown', color: '#f97316', starCount: 3 }
  ],

  async render(profile, onStartExam, onOpenAdmin, onReadNews) {
    try {
      await this._render(profile, onStartExam, onOpenAdmin, onReadNews)
    } catch (err) {
      console.error("CRITICAL DASHBOARD ERROR:", err)
      const container = document.getElementById('dashboard-container')
      if (container) {
          container.style.display = 'block'
          container.innerHTML = `
            <div style="padding: 2rem; background: rgba(239, 68, 68, 0.1); border: 2px solid #ef4444; border-radius: 20px; color: #ef4444; margin: 2rem;">
                <h2 style="font-family: 'Outfit'; margin-top: 0;">⚠️ Dashbaord Render Error</h2>
                <p style="font-weight: 800;">${err.message}</p>
                <pre style="background: rgba(0,0,0,0.5); padding: 1rem; border-radius: 10px; font-size: 0.7rem; overflow: auto; max-height: 200px;">${err.stack}</pre>
                <button onclick="location.reload()" class="btn-primary" style="margin-top: 1rem;">RELOAD APP</button>
            </div>
          `
      }
    }
  },

  async _render(profile, onStartExam, onOpenAdmin, onReadNews) {
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
    let systemConfig = {
        explanations_free_access: false,
        exams_free_access: false,
        ai_tutor_free_access: false,
        daily_goal_target: 50,
        pricing_lifetime: '₦1,500',
        pricing_monthly: '₦1,000',
        ai_credits_initial_medium: 10
    }
    let isSystemFree = false

    let analytics = { history: [], mastery: [] }
    let weakSubject = null
    
    try {
        console.log("Dashboard: Starting data fetch for", this.profile.id)
        analytics = await DataService.getUserAnalytics(this.profile.id) || { history: [], mastery: [] }
        history = analytics.history || []
        mastery = analytics.mastery || []
        
        // Find weakest subject for "Targeted Practice"
        if (mastery.length > 0) {
            weakSubject = [...mastery].sort((a, b) => (a.accuracy || 0) - (b.accuracy || 0))[0]
        }

        const { data: unresolvedIds } = await DataService.getUnresolvedMistakeIds(this.profile.id)
        this.unresolvedMistakeIds = unresolvedIds || []
        
        console.log("Dashboard: Analytics loaded")
        // Fetch all toggles
        const { data: configs } = await supabase.from('system_config').select('key, value')
        if (configs) {
            configs.forEach(c => {
                if (systemConfig.hasOwnProperty(c.key)) {
                  const val = c.value;
                  if (val === 'true' || val === 'false') {
                    systemConfig[c.key] = (val === 'true')
                  } else if (!isNaN(val) && val !== '') {
                    systemConfig[c.key] = Number(val)
                  } else {
                    systemConfig[c.key] = val
                  }
                }
            })
        }
        isSystemFree = systemConfig.explanations_free_access // For legacy checks
        // Sync League Status & Check for Tier Changes
        const lastTier = localStorage.getItem('elite_last_league_tier')
        const { data: leagueSync } = await DataService.syncLeagueStatus(this.profile.id)
        this.leagueData = leagueSync || { tier: 'Bronze', group_id: null }
        
        if (lastTier && lastTier !== this.leagueData.tier) {
            const isPromotion = this._isPromotion(lastTier, this.leagueData.tier)
            this.showTierChangeModal(lastTier, this.leagueData.tier, isPromotion)
        }
        localStorage.setItem('elite_last_league_tier', this.leagueData.tier)
        console.log("Dashboard: League synced", this.leagueData)
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
        DataService.markTourAsSeen(this.profile.id)
        sessionStorage.removeItem('isFreshSignup')
      }
    });
    
    console.log("DASH_TRACE_1: Starting XP calculation")
    // Calculate Progress and Daily Goal
    const today = new Date().toDateString()
    let v2_todayQuestions = 0
    let v2_totalQuestions = 0
    let v2_totalCorrect = 0
    let v2_overallTime = 0
    
    try {
        if (history && history.length > 0) {
            history.forEach(s => {
                if (s && s.created_at) {
                    const sDate = new Date(s.created_at)
                    const sessionCount = s.answered_questions ?? s.total_questions ?? 0
                    if (sDate.toDateString() === today) v2_todayQuestions += sessionCount
                    v2_totalQuestions += (s.total_questions || 0)
                    v2_totalCorrect += (s.correct_answers || 0)
                    v2_overallTime += (s.time_taken_seconds || 0)
                }
            })
        }
    } catch (e) {
        console.error("Dashboard: Error calculating XP history", e)
    }

    const accuracy = v2_totalQuestions > 0 ? Math.round((v2_totalCorrect / v2_totalQuestions) * 100) : 0
    const studyTimeMinutes = Math.floor(v2_overallTime / 60)
    const examsCompleted = history.length

    // Fetch Target from storage (50 or 100)
    const dailyGoalLimit = parseInt(localStorage.getItem('elite_daily_goal') || '50')
    const dailyGoalPct = Math.min((v2_todayQuestions / dailyGoalLimit) * 100, 100)
    
    // Check for celebration (confetti)
    try {
        const lastCelebrated = localStorage.getItem('elite_last_goal_celebration')
        if (dailyGoalPct >= 100 && lastCelebrated !== today && typeof confetti === 'function') {
            setTimeout(() => {
                confetti({
                    particleCount: 150,
                    spread: 70,
                    origin: { y: 0.6 },
                    colors: ['#3b82f6', '#8b5cf6', '#f59e0b']
                });
                localStorage.setItem('elite_last_goal_celebration', today)
            }, 1000)
        }
    } catch (e) {
        console.error("Dashboard: Confetti failed", e)
    }
    
    const currentDailyCount = this.profile.daily_questions_count || 0;
    const currentMilestone = this.MILESTONES.slice().reverse().find(m => currentDailyCount >= m.target);
    const nextMilestone = this.MILESTONES.find(m => currentDailyCount < m.target);

    // Celebration Logic
    this.checkForCelebration();

    // Determine Achievements
    const badges = [];
    if (this.profile.streak_count >= 7) badges.push({ emoji: '<i data-lucide="flame" style="width: 16px; height: 16px; color: var(--warning);"></i>', title: '7-Day Streak' });
    if (v2_totalQuestions >= 500) badges.push({ emoji: '<i data-lucide="shield" style="width: 16px; height: 16px; color: var(--accent-secondary);"></i>', title: 'Veteran' });
    if (accuracy >= 80 && history.length >= 5) badges.push({ emoji: '<i data-lucide="target" style="width: 16px; height: 16px; color: var(--primary);"></i>', title: 'Sharpshooter' });
    if (this.profile.activation_status) badges.push({ emoji: '<i data-lucide="gem" style="width: 16px; height: 16px; color: var(--accent-primary);"></i>', title: 'Activated' });
    if (currentMilestone) {
        badges.push({ 
            emoji: `<i data-lucide="${currentMilestone.badge}" style="width: 16px; height: 16px; color: ${currentMilestone.color};"></i>`, 
            title: `Daily ${currentMilestone.title}` 
        });
    }

    const badgesHTML = badges.length > 0 ? `
      <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--glass-border);">
        ${badges.map(b => `<span class="badge glass" title="${b.title}" style="display: flex; align-items: center; gap: 0.35rem; padding: 0.35rem 0.6rem; font-size: 0.65rem; border: 1px solid var(--glass-border); background: rgba(255,255,255,0.03);">${b.emoji} ${b.title}</span>`).join('')}
      </div>
    ` : '';

    console.log("Dashboard: Preparing to inject HTML")
    container.innerHTML = `
      <div id="dashboard-content" class="dashboard-scroll-area">
        
        <!-- DASHBOARD WELCOME -->
        <div class="mb-sm" style="padding-top: 0;">
          <h1 class="responsive-h1" style="font-family: 'Outfit'; margin: 0; font-weight: 800; color: var(--text-primary); display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
            Welcome, ${this.profile.username || 'Student'} 
            <i data-lucide="sun" style="width: 28px; height: 28px; color: var(--warning);"></i>
          </h1>
          <p style="font-size: 0.95rem; color: var(--text-secondary); margin-top: 0.3rem; font-weight: 500;">Let's make today count.</p>
        </div>

        <!-- ELITE ECONOMY WIDGET -->
        <div style="display: flex; gap: 0.75rem; margin-bottom: 1.5rem; flex-wrap: wrap;">
          <div class="glass card" style="padding: 0.6rem 1rem; flex: 1; min-width: 140px; display: flex; align-items: center; gap: 0.75rem; border-left: 3px solid #f59e0b; background: rgba(245, 158, 11, 0.05);">
            <div style="width: 32px; height: 32px; background: rgba(245, 158, 11, 0.15); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #f59e0b;">
              <i data-lucide="coins" style="width: 18px;"></i>
            </div>
            <div>
              <div style="font-size: 0.65rem; color: var(--text-secondary); font-weight: 800; text-transform: uppercase;">Elite Coins</div>
              <div style="font-family: 'Outfit'; font-size: 1.1rem; font-weight: 900; color: var(--text-primary);">${this.profile.elite_coins || 0}</div>
            </div>
          </div>
          
          <div id="open-store-btn" class="glass card scale-in" style="padding: 0.6rem 1rem; flex: 1; min-width: 140px; display: flex; align-items: center; gap: 0.75rem; cursor: pointer; border-left: 3px solid var(--accent-secondary); background: rgba(139, 92, 246, 0.05); transition: transform 0.2s;">
            <div style="width: 32px; height: 32px; background: rgba(139, 92, 246, 0.15); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: var(--accent-secondary);">
              <i data-lucide="snowflake" style="width: 18px;"></i>
            </div>
            <div>
              <div style="font-size: 0.65rem; color: var(--text-secondary); font-weight: 800; text-transform: uppercase;">Streak Freezes</div>
              <div style="font-family: 'Outfit'; font-size: 1.1rem; font-weight: 900; color: var(--text-primary);">${this.profile.streak_freeze_count || 0} Active</div>
            </div>
          </div>
        </div>

        <!-- QUICK ACTION SECTION -->
        <div class="glass card scale-in mb-md" style="text-align: center; padding: 1.25rem 1rem; border: 2px solid rgba(37, 99, 235, 0.4); background: linear-gradient(180deg, rgba(37, 99, 235, 0.04) 0%, var(--surface-color) 100%);">
          <h2 style="font-family: 'Outfit'; font-size: 1.25rem; margin-bottom: 0.15rem; color: var(--text-primary); font-weight: 800;">Elite Mastery</h2>
          <p style="color: var(--text-secondary); margin-bottom: 1.25rem; font-size: 0.85rem; line-height: 1.4;">Select your mode to begin.</p>
          <div style="display: flex; justify-content: center; gap: 0.75rem; flex-wrap: wrap; width: 100%;">
             <button id="quick-practice-btn" class="btn-primary" style="padding: 0 1.25rem; flex: 1; min-width: 140px; font-size: 0.95rem;"><i data-lucide="target" style="width:18px;"></i> Practice</button>
             <button id="quick-exam-btn" class="btn-secondary" style="padding: 0 1.25rem; flex: 1; min-width: 140px; font-weight: 800;"><i data-lucide="trophy" style="width:18px;"></i> Mock Exam</button>
             <button id="start-saved" class="glass-btn" style="padding: 0 1.25rem; border-color: var(--accent-primary); display: none; flex: 1; min-width: 140px;"><i data-lucide="bookmark" style="width:18px;"></i> Saved (<span id="bookmark-count">0</span>)</button>
          </div>
        </div>

        <!-- Dynamic Tier-Based UI -->
        ${(() => {
          const subState = SubscriptionManager.getUserSubscriptionState(profile, isSystemFree);
          
          // Hidden for active premium users with plenty of time
          if (subState.tier === "premium" && subState.daysRemaining > 5) return '';

          let title = "Activate Full Access";
          let subtitle = "Unlock all subjects and AI explanations.";
          let btnText = `Upgrade – ${systemConfig.pricing_lifetime || '₦1,500'}`;
          let borderStyle = 'var(--accent-primary)';
          let btnBg = 'var(--primary)';

          if (subState.tier === 'medium') {
              title = "Membership Standard";
              subtitle = `Your Elite subscription expired. You have ${profile.ai_credits || 0} AI credits remaining.`;
              btnText = "Renew Premium";
              borderStyle = 'var(--accent-secondary)';
              btnBg = 'var(--accent-secondary)';
          } else if (subState.isExpired || (subState.tier === 'premium' && subState.daysRemaining <= 5)) {
              title = subState.daysRemaining <= 5 ? "Expiring Soon" : "Premium Expired";
              subtitle = subState.daysRemaining <= 5 
                ? `Your Elite access ends in ${subState.daysRemaining} days. Renew now to stay ahead.` 
                : "Renew now to restore unlimited sessions and AI features.";
              btnText = "Renew Now";
              borderStyle = subState.daysRemaining <= 5 ? 'var(--warning)' : 'var(--error)';
              btnBg = subState.daysRemaining <= 5 ? 'var(--warning)' : 'var(--error)';
          }

          return `
            <div class="glass card scale-in mb-md" style="padding: 1rem; border: 1.5px solid ${borderStyle}; background: linear-gradient(90deg, ${borderStyle}05 0%, transparent 100%);">
              <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
                <div style="flex: 1; min-width: 200px;">
                  <h4 style="font-family: 'Outfit'; font-size: 1.1rem; font-weight: 800; margin-bottom: 0.25rem;">${title}</h4>
                  <p style="font-size: 0.85rem; color: var(--text-secondary); margin: 0;">${subtitle}</p>
                </div>
                <button class="btn-dominant" style="height: 44px; padding: 0 1.25rem; font-size: 0.9rem; min-width: 140px; background: ${btnBg};" onclick="document.getElementById('upgrade-modal').style.display='flex'">
                  ${btnText}
                </button>
              </div>
            </div>
          `;
        })()}

         <!-- PROGRESS & ANALYTICS (Standardized Grid) -->
          <div class="dashboard-responsive-grid mb-md" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem;">
            
            <!-- Daily Streak Card -->
            <div class="glass card scale-in" style="padding: 1.25rem; display: flex; flex-direction: column; min-height: 260px; justify-content: space-between; border-top: 4px solid var(--warning); background: linear-gradient(180deg, rgba(245, 158, 11, 0.05) 0%, var(--surface-color) 100%);">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <h3 style="color: var(--text-secondary); font-size: 0.8rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; margin: 0;">Learning Streak</h3>
                <span class="badge" style="background: rgba(245, 158, 11, 0.1); color: var(--warning); font-size: 0.7rem;">Active</span>
              </div>
              <div style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.5rem;">
                <div class="streak-flame-container ${this.profile.streak_count > 0 ? 'active' : ''}">
                  <i data-lucide="flame" style="width: 64px; height: 64px; color: ${this.profile.streak_count > 0 ? 'var(--warning)' : 'var(--text-secondary)'}; filter: drop-shadow(0 0 10px rgba(245, 158, 11, 0.3));"></i>
                </div>
                <div style="font-family: 'Outfit'; font-size: 3.5rem; font-weight: 900; color: var(--text-primary); line-height: 1;">${this.profile.streak_count || 0}</div>
                <div style="font-size: 0.9rem; font-weight: 700; color: var(--text-secondary); text-transform: uppercase;">Day Streak</div>
              </div>
              <p style="font-size: 0.8rem; color: var(--text-secondary); text-align: center; margin: 0; font-weight: 500;">
                ${this.profile.streak_count > 0 ? "You're on fire! Keep it up." : "Start a session to begin your streak."}
              </p>
              <button id="open-leaderboard-btn" class="glass-btn" style="margin-top: 1rem; font-size: 0.7rem; padding: 0.4rem; border: 1px solid var(--glass-border); color: var(--text-secondary); width: 100%; border-radius: 8px;">
                <i data-lucide="trophy" style="width:14px; margin-right: 4px;"></i> VIEW GLOBAL RANKINGS
              </button>
            </div>

            <!-- League / Tier Card (Duolingo Style) -->
            ${(() => {
                const tierStyles = {
                    'Bronze': { color: '#cd7f32', icon: 'shield', bg: 'rgba(205, 127, 50, 0.05)' },
                    'Silver': { color: '#c0c0c0', icon: 'shield-check', bg: 'rgba(192, 192, 192, 0.05)' },
                    'Gold': { color: '#ffd700', icon: 'award', bg: 'rgba(255, 215, 0, 0.05)' },
                    'Diamond': { color: '#00f2ff', icon: 'gem', bg: 'rgba(0, 242, 255, 0.05)' },
                    'Elite': { color: '#8b5cf6', icon: 'crown', bg: 'rgba(139, 92, 246, 0.05)' }
                };
                const tier = this.leagueData?.tier || 'Bronze';
                const style = tierStyles[tier] || tierStyles['Bronze'];

                return `
                <div id="open-league-btn" class="glass card scale-in" style="padding: 1.25rem; display: flex; flex-direction: column; min-height: 260px; justify-content: space-between; border-top: 4px solid ${style.color}; background: linear-gradient(180deg, ${style.bg} 0%, var(--surface-color) 100%); cursor: pointer;">
                  <div style="display: flex; justify-content: space-between; align-items: center;">
                    <h3 style="color: var(--text-secondary); font-size: 0.8rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; margin: 0;">Weekly League</h3>
                    <div style="font-size: 0.7rem; font-weight: 800; color: ${style.color}; display: flex; align-items: center; gap: 0.25rem;">
                        <i data-lucide="users" style="width: 12px;"></i> GROUP OF 50
                    </div>
                  </div>
                  
                  <div style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.75rem;">
                    <div style="width: 70px; height: 70px; background: rgba(255,255,255,0.03); border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2px solid ${style.color}; position: relative;">
                        <i data-lucide="${style.icon}" style="width: 36px; height: 36px; color: ${style.color}; filter: drop-shadow(0 0 8px ${style.color}44);"></i>
                        <div style="position: absolute; bottom: -5px; right: -5px; background: ${style.color}; width: 24px; height: 24px; border-radius: 50%; border: 2px solid var(--surface-color); display: flex; align-items: center; justify-content: center;">
                             <i data-lucide="trending-up" style="width: 12px; color: #fff;"></i>
                        </div>
                    </div>
                    <div style="text-align: center;">
                        <div style="font-family: 'Outfit'; font-size: 1.5rem; font-weight: 900; color: var(--text-primary); margin-bottom: 0.1rem;">${tier} League</div>
                        <div id="league-rank-indicator" style="font-size: 0.75rem; color: var(--text-secondary); font-weight: 700;">Loading rank...</div>
                    </div>
                  </div>

                  <div style="background: rgba(255,255,255,0.03); border-radius: 12px; padding: 0.75rem; border: 1px solid var(--glass-border);">
                     <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem;">
                        <span style="font-size: 0.65rem; font-weight: 800; color: var(--text-secondary); text-transform: uppercase;">Time Left</span>
                        <span id="league-timer" style="font-size: 0.7rem; font-weight: 900; color: var(--text-primary);">04d 12h 05m</span>
                     </div>
                     <div class="progress-v2-container" style="height: 4px; background: rgba(255,255,255,0.05);">
                        <div id="league-week-progress" class="progress-v2-fill" style="width: 60%; background: ${style.color};"></div>
                     </div>
                  </div>
                  
                  <button class="glass-btn" style="margin-top: 1rem; font-size: 0.7rem; padding: 0.4rem; border: 1px solid var(--glass-border); color: var(--text-secondary); width: 100%; border-radius: 8px;">
                    <i data-lucide="list" style="width:14px; margin-right: 4px;"></i> VIEW FULL LEAGUE TABLE
                  </button>
                </div>
                `;
            })()}

            <!-- Daily Goal Card -->
            <div class="glass card" style="padding: 1rem 1.25rem; display: flex; flex-direction: column; min-height: 260px; justify-content: space-between; position: relative; overflow: hidden; border-top: 4px solid ${currentMilestone ? currentMilestone.color : 'var(--accent-primary)'};">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
                <h3 style="color: var(--text-secondary); font-size: 0.8rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; margin: 0;">Daily Star Target</h3>
                <div style="display: flex; gap: 4px;">
                    ${this.MILESTONES.map(m => `
                        <div title="${m.title}" style="color: ${currentDailyCount >= m.target ? m.color : 'rgba(255,255,255,0.1)'};">
                             <i data-lucide="${m.badge}" style="width: 16px; height: 16px; ${currentDailyCount >= m.target ? `filter: drop-shadow(0 0 4px ${m.color});` : ''}"></i>
                        </div>
                    `).join('')}
                </div>
              </div>
              
              <div style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1rem;">
                <!-- Multi-Level Circular Progress -->
                <div style="position: relative; width: 110px; height: 110px;">
                  <svg viewBox="0 0 36 36" style="width: 100%; height: 100%; transform: rotate(-90deg);">
                    <circle cx="18" cy="18" r="16" fill="none" stroke="rgba(255,255,255,0.03)" stroke-width="2.5" />
                    <!-- Progress towards next milestone -->
                    ${(() => {
                        const prevTarget = this.MILESTONES.slice().reverse().find(m => currentDailyCount >= m.target)?.target || 0;
                        const targetForSegment = nextMilestone ? nextMilestone.target : this.MILESTONES[this.MILESTONES.length-1].target;
                        
                        return this.MILESTONES.map((m, idx) => {
                            const milestoneStart = idx === 0 ? 0 : this.MILESTONES[idx-1].target;
                            const milestoneRange = m.target - milestoneStart;
                            const progressInMilestone = Math.max(0, Math.min(milestoneRange, currentDailyCount - milestoneStart));
                            const pct = (progressInMilestone / milestoneRange) * (100 / this.MILESTONES.length);
                            const offset = (idx * (100 / this.MILESTONES.length));
                            
                            return `
                                <circle cx="18" cy="18" r="16" fill="none" 
                                        stroke="${currentDailyCount >= m.target ? m.color : 'rgba(255,255,255,0.05)'}" 
                                        stroke-width="3" 
                                        stroke-dasharray="${(currentDailyCount >= m.target ? 100 / this.MILESTONES.length : pct) - 1}, 100" 
                                        stroke-dashoffset="-${offset}"
                                        stroke-linecap="round" 
                                        style="transition: all 1s ease-out; ${currentDailyCount >= m.target ? `filter: drop-shadow(0 0 4px ${m.color});` : ''}" />
                            `;
                        }).join('');
                    })()}
                  </svg>
                  <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center;">
                    <div style="font-family: 'Outfit'; font-size: 1.8rem; font-weight: 900; color: var(--text-primary); line-height: 1;">${currentDailyCount}</div>
                    <div style="font-size: 0.65rem; font-weight: 800; color: var(--text-secondary); text-transform: uppercase;">Solved</div>
                  </div>
                </div>
                
                <div style="text-align: center;">
                  <p style="font-size: 0.95rem; font-weight: 800; color: ${currentMilestone ? currentMilestone.color : 'var(--text-primary)'}; margin-bottom: 0.1rem;">
                    ${currentMilestone ? `🎉 ${currentMilestone.title} Status!` : 'Begin your climb!'}
                  </p>
                  <div style="font-size: 0.75rem; color: var(--text-secondary); font-weight: 600;">
                    ${nextMilestone ? `${nextMilestone.target - currentDailyCount} more for ${nextMilestone.title}` : 'Legendary status achieved!'}
                  </div>
                </div>
              </div>

              <div style="margin-top: 0.5rem; display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.03); padding: 0.5rem 0.75rem; border-radius: 12px; border: 1px solid var(--glass-border);">
                 <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <button class="goal-toggle badge glass" data-target="50" style="padding: 0.2rem 0.5rem; border: ${dailyGoalLimit === 50 ? '1px solid var(--accent-primary)' : '1px solid transparent'}; opacity: ${dailyGoalLimit === 50 ? '1' : '0.5'}; cursor: pointer;">50</button>
                    <button class="goal-toggle badge glass" data-target="100" style="padding: 0.2rem 0.5rem; border: ${dailyGoalLimit === 100 ? '1px solid var(--accent-primary)' : '1px solid transparent'}; opacity: ${dailyGoalLimit === 100 ? '1' : '0.5'}; cursor: pointer;">100</button>
                    <span style="font-size: 0.7rem; font-weight: 800; color: var(--text-secondary); text-transform: uppercase;">SET GOAL</span>
                 </div>
                 <div style="font-size: 0.85rem; font-weight: 900; color: ${currentMilestone ? currentMilestone.color : 'var(--text-primary)'};">${currentMilestone ? currentMilestone.title : 'Novice'}</div>
              </div>
            </div>

            <!-- Readiness Progress Card -->
            <div class="glass card" style="padding: 1rem 1.25rem; display: flex; flex-direction: column; min-height: 260px; justify-content: space-between;">
              <h3 style="color: var(--text-secondary); font-size: 0.8rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.75rem;">Study Stats</h3>
              
              <div style="display: flex; gap: 1.5rem; align-items: center; justify-content: center; flex: 1;">
                 <div id="readiness-gauge-container" style="position: relative; width: 80px; height: 80px; flex-shrink: 0;">
                    <svg viewBox="0 0 36 36" style="width: 100%; height: 100%; transform: rotate(-90deg);">
                      <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="rgba(59, 130, 246, 0.1)" stroke-width="3" />
                      <path id="readiness-progress-path" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="var(--primary)" stroke-width="3" stroke-dasharray="0, 100" stroke-linecap="round" />
                    </svg>
                    <div id="readiness-percentage" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-weight: 900; font-size: 1rem; color: var(--primary);">0%</div>
                 </div>
                 <div style="text-align: left;">
                      <div id="readiness-label" style="font-size: 0.65rem; font-weight: 800; color: var(--text-secondary); text-transform: uppercase;">Primary Track</div>
                    <div id="readiness-subject" style="font-family: 'Outfit'; font-size: 0.95rem; font-weight: 800; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 130px;">...</div>
                    <div id="readiness-status" style="font-size: 0.75rem; font-weight: 700; color: var(--success);">Elite Readiness</div>
                 </div>
              </div>

              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; background: rgba(255,255,255,0.03); border-radius: 12px; margin-top: 1rem; padding: 0.75rem;">
                <div style="text-align: center; border-right: 1px solid var(--glass-border);">
                  <div style="font-size: 1.1rem; font-family: 'Outfit'; font-weight: 900; color: var(--primary);">${v2_totalQuestions}</div>
                  <div style="font-size: 0.65rem; color: var(--text-secondary); font-weight: 800; text-transform: uppercase;">Solved</div>
                </div>
                <div style="text-align: center;">
                   <div style="font-size: 1.1rem; font-family: 'Outfit'; font-weight: 900; color: var(--success);">${accuracy}%</div>
                   <div style="font-size: 0.65rem; color: var(--text-secondary); font-weight: 800; text-transform: uppercase;">Avg Score</div>
                </div>
                <div style="text-align: center; border-right: 1px solid var(--glass-border); border-top: 1px solid var(--glass-border); padding-top: 0.5rem;">
                  <div style="font-size: 1.1rem; font-family: 'Outfit'; font-weight: 900; color: var(--accent-secondary);">${examsCompleted}</div>
                  <div style="font-size: 0.65rem; color: var(--text-secondary); font-weight: 800; text-transform: uppercase;">Exams</div>
                </div>
                <div style="text-align: center; border-top: 1px solid var(--glass-border); padding-top: 0.5rem;">
                   <div style="font-size: 1.1rem; font-family: 'Outfit'; font-weight: 900; color: var(--warning);">${studyTimeMinutes}m</div>
                   <div style="font-size: 0.65rem; color: var(--text-secondary); font-weight: 800; text-transform: uppercase;">Study Time</div>
                </div>
              </div>
              ${badgesHTML}
            </div>

            <!-- AI Insight Card -->
            <div class="glass card" style="padding: 1rem 1.25rem; display: flex; flex-direction: column; min-height: 260px; justify-content: space-between; border-left: 4px solid var(--accent-secondary);">
              <h3 style="color: var(--text-secondary); font-size: 0.8rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.75rem;">AI Performance Analysis</h3>
              
              <div style="flex: 1; display: flex; align-items: center;">
                <p id="dashboard-ai-summary" style="font-size: 0.95rem; color: var(--text-secondary); line-height: 1.5; font-weight: 500; margin: 0;">
                  <span class="loader-spinner" style="width:14px; height:14px; display:inline-block; margin-right: 8px;"></span>
                  Elite AI is calculating your mastery profile...
                </p>
              </div>

              <div style="margin-top: 1rem; display: flex; gap: 0.5rem;">
                ${(weakSubject) ? `
                  <button id="practice-weak-btn" class="btn-primary" style="padding: 0 1rem; height: 40px; font-size: 0.75rem; flex: 1;"><i data-lucide="target" style="width: 14px;"></i> Target ${weakSubject.subject}</button>
                  <button id="ai-insight-btn" class="btn-dominant" style="padding: 0 1rem; height: 40px; font-size: 0.75rem; flex: 1; background: var(--accent-secondary); border: none;"><i data-lucide="sparkles" style="width: 14px;"></i> AI INSIGHTS</button>
                ` : `
                  <button id="start-ai-workout" class="btn-dominant" style="padding: 0 1rem; height: 40px; font-size: 0.75rem; flex: 1;"><i data-lucide="sparkles" style="width: 14px;"></i> AI Workout</button>
                  <button id="ai-insight-btn" class="btn-dominant" style="padding: 0 1rem; height: 40px; font-size: 0.75rem; flex: 1; background: var(--accent-secondary); border: none;"><i data-lucide="sparkles" style="width: 14px;"></i> AI INSIGHTS</button>
                `}
                <button id="full-analysis-btn" class="btn-secondary" style="padding: 0 1rem; height: 40px; font-size: 0.75rem; flex: 1; border-color: var(--accent-primary); color: var(--accent-primary);"><i data-lucide="bar-chart-2" style="width: 14px;"></i> ANALYSIS</button>
              </div>
            </div>

            <!-- ELITE REPAIR CENTER CARD -->
            ${this.unresolvedMistakeIds.length > 0 ? `
            <div id="repair-center-card" class="glass card scale-in" style="padding: 1.5rem; border: 2px solid #ef4444; background: linear-gradient(135deg, rgba(239, 68, 68, 0.05) 0%, var(--surface-color) 100%);">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.25rem;">
                <div style="display: flex; align-items: center; gap: 0.75rem;">
                  <div style="background: rgba(239, 68, 68, 0.15); width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; color: #ef4444;">
                    <i data-lucide="shield-alert" style="width: 24px;"></i>
                  </div>
                  <div>
                    <h3 style="font-family: 'Outfit'; font-size: 1.1rem; font-weight: 800; color: var(--text-primary); margin: 0;">Elite Repair Center</h3>
                    <p style="font-size: 0.75rem; color: #ef4444; font-weight: 700; text-transform: uppercase;">${this.unresolvedMistakeIds.length} WEAK POINTS DETECTED</p>
                  </div>
                </div>
                <div style="font-size: 0.7rem; background: rgba(0,0,0,0.2); padding: 4px 8px; border-radius: 6px; font-weight: 800; color: var(--text-secondary);">SPACED REPETITION</div>
              </div>
              <p style="font-size: 0.85rem; color: var(--text-secondary); line-height: 1.5; margin-bottom: 1.5rem; font-weight: 500;">
                These are questions you missed recently. Fixing them is the fastest way to increase your JAMB score.
              </p>
              <button id="repair-mistakes-btn" class="btn-dominant" style="width: 100%; height: 48px; background: linear-gradient(90deg, #ef4444 0%, #b91c1c 100%); border-radius: 12px; font-weight: 800; display: flex; align-items: center; justify-content: center; gap: 0.5rem; box-shadow: 0 4px 15px rgba(239, 68, 68, 0.3);">
                <i data-lucide="zap" style="width: 18px;"></i> REPAIR NOW
              </button>
            </div>
            ` : ''}
         </div>

        <!-- QUICK ACTIONS GRID -->
        <div class="dashboard-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 0.75rem;">
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

        <div id="league-table-modal" class="modal-overlay" style="display: none;">
            <div class="modal-content glass" style="max-width: 500px; width: 92%; position: relative; padding: 0; border-radius: 24px; overflow: hidden; background: var(--surface-color); border: 2px solid var(--glass-border);">
                <!-- Header -->
                <div id="league-modal-header" style="padding: 1.5rem; background: linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, transparent 100%); border-bottom: 1px solid var(--glass-border); text-align: center; position: relative;">
                    <button id="close-league" class="btn-secondary" style="position: absolute; top: 1rem; right: 1rem; width: 32px; height: 32px; padding: 0; min-width: auto; border-radius: 50%;">&times;</button>
                    <div id="league-modal-icon-container" style="width: 50px; height: 50px; margin: 0 auto 0.75rem; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2px solid var(--accent-primary);">
                        <i id="league-modal-icon" data-lucide="shield" style="width: 24px; color: var(--accent-primary);"></i>
                    </div>
                    <h2 id="league-modal-title" style="font-family: 'Outfit'; font-weight: 900; margin: 0; color: var(--text-primary); font-size: 1.5rem;">Bronze League</h2>
                    <p style="font-size: 0.75rem; color: var(--text-secondary); font-weight: 700; margin-top: 0.25rem;">WEEKLY COMPETITION · GROUP OF 50</p>
                </div>
                <!-- Rankings List -->
                <div id="league-modal-list" style="max-height: 60vh; overflow-y: auto; padding: 0;">
                    <!-- Rows will be injected here -->
                </div>
                <!-- Footer Legend -->
                <div style="padding: 1rem; background: rgba(0,0,0,0.2); border-top: 1px solid var(--glass-border); display: flex; justify-content: center; gap: 1.5rem;">
                    <div style="display: flex; align-items: center; gap: 0.4rem; font-size: 0.65rem; color: var(--success); font-weight: 800;">
                        <div style="width: 8px; height: 8px; border-radius: 50%; background: var(--success);"></div> PROMOTION ZONE
                    </div>
                    <div style="display: flex; align-items: center; gap: 0.4rem; font-size: 0.65rem; color: var(--error); font-weight: 800;">
                        <div style="width: 8px; height: 8px; border-radius: 50%; background: var(--error);"></div> DANGER ZONE
                    </div>
                </div>
            </div>
        </div>

        <!-- ANALYTICS CHARTS -->
        <div id="analytics-section" style="margin-top: 1.5rem;">
          <h2 style="font-family: 'Outfit'; font-size: 1.25rem; font-weight: 900; margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem;">
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
        <div class="glass card scale-in" style="margin-top: 2.5rem; background: linear-gradient(135deg, #5B21B6 0%, #3730A3 100%); border: none; padding: 2rem 1.5rem; display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: 1.5rem; text-align: center; box-shadow: 0 10px 30px rgba(0,0,0,0.2);">
           <div style="flex: 1; min-width: 200px; color: #ffffff;">
              <h3 style="font-family: 'Outfit'; font-weight: 900; font-size: 1.5rem; margin-bottom: 0.35rem; color: #ffffff;">Need a headstart?</h3>
              <p style="font-size: 1rem; font-weight: 500; color: rgba(255,255,255,0.95); margin-bottom: 1.5rem; line-height: 1.5;">Unleash the full power of CBT Elite.</p>
              <button id="help-guide-btn" class="btn-secondary" style="background: white; color: #3730A3; border: none; font-weight: 800; width: 100%; max-width: 240px; height: 48px; font-size: 0.95rem; border-radius: 12px; margin: 0 auto; display: block;">Launch Tour</button>
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
              <div style="font-size: 2rem; font-weight: 900; color: var(--accent-primary); margin: 0.4rem 0;">${systemConfig.pricing_lifetime}</div>
              <button id="pay-lifetime-btn" class="btn-dominant" style="width: 100%; height: 48px;">ACTIVATE NOW</button>
            </div>
            <div class="glass card" style="padding: 1.25rem; border: 2px solid var(--accent-secondary); background: rgba(147, 51, 234, 0.05);">
              <h4 style="font-weight: 800; font-size: 0.85rem; text-transform: uppercase;">MONTHLY RENEWAL</h4>
              <div style="font-size: 2rem; font-weight: 900; color: var(--accent-secondary); margin: 0.4rem 0;">${typeof systemConfig.pricing_monthly === 'number' ? '₦' + systemConfig.pricing_monthly : systemConfig.pricing_monthly}</div>
              <p style="font-size: 0.7rem; color: var(--text-secondary); margin-bottom: 0.8rem;">Unlimited AI & Unlimited Sessions</p>
              <button id="pay-monthly-btn" class="btn-dominant" style="width: 100%; height: 48px; background: var(--accent-secondary);">RENEW NOW</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Celebration Modal (Option 2) -->
      <div id="celebration-modal" class="modal-overlay" style="display: none; z-index: 9999; background: rgba(0,0,0,0.92); backdrop-filter: blur(10px);">
        <div class="modal-content" style="max-width: 400px; width: 90%; background: transparent; padding: 0; box-shadow: none;">
          <div class="glass card scale-in" style="padding: 2.5rem 2rem; text-align: center; border: 2px solid var(--accent-primary); background: linear-gradient(135deg, rgba(88, 28, 135, 0.4) 0%, rgba(15, 23, 42, 0.8) 100%);">
            <div id="celebration-icon-container" style="width: 100px; height: 100px; margin: 0 auto 1.5rem; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.05); border-radius: 50%; border: 2px solid var(--accent-primary); position: relative;">
                <i id="celebration-icon" data-lucide="star" style="width: 50px; height: 50px; color: var(--warning);"></i>
                <div style="position: absolute; top: -10px; right: -10px; width: 32px; height: 32px; background: var(--accent-primary); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 0.8rem;" id="celebration-stars">1★</div>
            </div>
            <h2 id="celebration-title" style="font-family: 'Outfit'; font-weight: 900; font-size: 2rem; color: #fff; margin-bottom: 0.5rem; letter-spacing: -0.02em;">New Achievement!</h2>
            <p id="celebration-name" style="font-size: 1.25rem; font-weight: 800; color: var(--warning); margin-bottom: 1rem; text-transform: uppercase;"></p>
            <p id="celebration-text" style="color: var(--text-secondary); font-size: 0.95rem; line-height: 1.6; margin-bottom: 2rem;"></p>
            <button id="close-celebration-btn" class="btn-dominant" style="width: 100%; height: 54px; font-size: 1.1rem; border-radius: 16px;">CONTINUE SUCCESS</button>
          </div>
        </div>
      </div>

      <!-- ELITE STORE MODAL -->
      <div id="elite-store-modal" class="modal-overlay" style="display: none;">
        <div class="modal-content glass" style="max-width: 450px; width: 92%; position: relative; padding: 2rem 1.5rem; border-radius: 24px; text-align: center;">
          <button id="close-store" class="btn-secondary" style="position: absolute; top: 1rem; right: 1rem; width: 36px; height: 36px; padding: 0; min-width: auto; border-radius: 50%;">&times;</button>
          
          <div style="margin-bottom: 2rem;">
            <div style="background: rgba(245, 158, 11, 0.1); width: 64px; height: 64px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 1rem; border: 2px solid #f59e0b;">
              <i data-lucide="shopping-bag" style="color: #f59e0b; width: 32px; height: 32px;"></i>
            </div>
            <h2 style="font-family: 'Outfit'; font-weight: 900; font-size: 1.75rem; color: var(--text-primary); margin: 0;">Elite Store</h2>
            <p style="color: var(--text-secondary); font-size: 0.9rem; margin-top: 0.5rem;">Spend your hard-earned coins on power-ups.</p>
          </div>

          <div style="display: grid; gap: 1rem;">
            <!-- STREAK FREEZE ITEM -->
            <div class="glass card" style="padding: 1.25rem; border: 1.5px solid var(--accent-secondary); background: rgba(139, 92, 246, 0.05); display: flex; align-items: center; gap: 1rem; text-align: left;">
              <div style="width: 50px; height: 50px; background: rgba(139, 92, 246, 0.15); border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; color: var(--accent-secondary);">
                <i data-lucide="snowflake" style="width: 28px; height: 28px;"></i>
              </div>
              <div style="flex: 1;">
                <h4 style="font-family: 'Outfit'; font-weight: 800; font-size: 1rem; margin: 0;">Streak Freeze</h4>
                <p style="font-size: 0.75rem; color: var(--text-secondary); margin: 0.15rem 0 0.5rem 0;">Protects your daily streak for 24 hours if you miss a day.</p>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <span style="font-size: 0.9rem; font-weight: 900; color: #f59e0b; display: flex; align-items: center; gap: 0.25rem;">
                    <i data-lucide="coins" style="width: 14px;"></i> 100
                  </span>
                  <button id="buy-freeze-btn" class="btn-primary" style="height: 32px; padding: 0 1rem; font-size: 0.75rem; border-radius: 8px;">PURCHASE</button>
                </div>
              </div>
            </div>
            
            <p style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 1rem;">More items (Elite Shields, Profile Badges) coming soon!</p>
          </div>
        </div>
      </div>
    `

    let lucideRetries = 0;
    const renderLucide = () => {
      if (window.lucide) {
        window.lucide.createIcons();
        window.lucide.createIcons({ root: container });
      } else if (lucideRetries < 50) {
        lucideRetries++;
        setTimeout(renderLucide, 100);
      }
    };
    renderLucide();

    // Goal Toggle Persistence
    document.querySelectorAll('.goal-toggle').forEach(btn => {
        btn.onclick = (e) => {
            const target = e.target.dataset.target
            localStorage.setItem('elite_daily_goal', target)
            this.render(profile) // Re-render to update percentages
        }
    })

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
                   const { error } = await DataService.activateUserLifetime(this.profile.id)
                   rpcError = error
                } else {
                   const { error } = await DataService.subscribeUser(this.profile.id, 'monthly')
                   rpcError = error
                }
                 if (!rpcError) {
                     // If first time activation, also grant initial credits if configured
                     if (isFirstTime && systemConfig.ai_credits_initial_medium > 0) {
                        await DataService.updateUser(this.profile.id, { 
                          ai_credits: systemConfig.ai_credits_initial_medium 
                        })
                     }
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

    console.log("DASH_TRACE_2: Attaching quick action listeners")
    const DASH_quickPracticeGrid = document.getElementById('quick-practice-btn-grid')
    const DASH_quickExamGrid = document.getElementById('quick-exam-btn-grid')
    const DASH_quickPracticeBtn = document.getElementById('quick-practice-btn')
    const DASH_quickExamBtn = document.getElementById('quick-exam-btn')

    if (DASH_quickPracticeGrid) DASH_quickPracticeGrid.onclick = () => window.navigateTo('practice', profile)
    if (DASH_quickExamGrid) DASH_quickExamGrid.onclick = () => window.navigateTo('exams', profile)
    if (DASH_quickPracticeBtn) DASH_quickPracticeBtn.onclick = () => window.navigateTo('practice', profile)
    if (DASH_quickExamBtn) DASH_quickExamBtn.onclick = () => window.navigateTo('exams', profile)

    console.log("DASH_TRACE_3: Attaching leaderboard listeners")
    const openLeaderboard = document.getElementById('open-leaderboard-btn')
    const leaderboardModal = document.getElementById('leaderboard-modal')
    const closeLeaderboard = document.getElementById('close-leaderboard')
    
    if (openLeaderboard && leaderboardModal) {
        openLeaderboard.onclick = () => {
            leaderboardModal.style.display = 'flex'
            this.loadLeaderboard(profile)
        }
    }
    if (closeLeaderboard) closeLeaderboard.onclick = () => leaderboardModal.style.display = 'none'

    // Weekly League Logic
    const openLeague = document.getElementById('open-league-btn')
    const leagueModal = document.getElementById('league-table-modal')
    const closeLeague = document.getElementById('close-league')
    
    if (openLeague && leagueModal) {
        openLeague.onclick = () => {
            leagueModal.style.display = 'flex'
            this.loadLeagueModalTable(profile)
        }
    }
    if (closeLeague) closeLeague.onclick = () => leagueModal.style.display = 'none'

    // Update League Timer & Mini Rank
    this.updateLeagueMiniRank(this.profile.id)
    setInterval(() => this.updateLeagueTimer(), 60000)
    this.updateLeagueTimer()

    const initData = async () => {
      try {
        const { count: bCount } = await DataService.getBookmarkCount(this.profile.id)
        const bCountEl = document.getElementById('bookmark-count')
        if (bCountEl) bCountEl.textContent = bCount || 0
        if (bCount > 0) {
            const bBtn = document.getElementById('start-saved')
            if (bBtn) {
                bBtn.style.display = 'flex'
                bBtn.onclick = async () => {
                    const { data } = await DataService.getBookmarks(this.profile.id)
                    if (data && data.length > 0) this.onStartExam(data, 'saved', 'Saved', 'Collection')
                }
            }
        }
        this.renderCharts(this.profile.id)
      } catch (err) { console.error(err) }
    }


    const helpBtn = document.getElementById('help-guide-btn')
    if (helpBtn) helpBtn.onclick = () => TourGuide.start()

    // Elite Store Listeners
    const buyFreezeBtn = document.getElementById('buy-freeze-btn')
    if (buyFreezeBtn) {
        buyFreezeBtn.onclick = async () => {
            buyFreezeBtn.disabled = true
            buyFreezeBtn.textContent = 'Processing...'
            const { data, error } = await DataService.buyStreakFreeze(this.profile.id)
            if (error) {
                alert(error)
                buyFreezeBtn.disabled = false
                buyFreezeBtn.textContent = 'PURCHASE'
            } else {
                alert("Streak Freeze Activated! Your progress is now protected.")
                location.reload()
            }
        }
    }

    const storeModal = document.getElementById('elite-store-modal')
    const openStore = document.getElementById('open-store-btn')
    const closeStore = document.getElementById('close-store')
    if (openStore && storeModal) {
        openStore.onclick = () => storeModal.style.display = 'flex'
    }
    if (closeStore) closeStore.onclick = () => storeModal.style.display = 'none'

    // Lazy load the Dashboard AI Strategy Summary
    import('../services/aiService').then(async ({ AiService }) => {
        try {
            const shortSummary = await AiService.getAIPerformanceSummary(analytics, true);
            const el = document.getElementById('dashboard-ai-summary');
            if (el) el.innerHTML = shortSummary;
        } catch (e) {
            const el = document.getElementById('dashboard-ai-summary');
            if (el) el.innerHTML = "Keep practicing to build your performance profile!";
        }
    }).catch(e => console.error("AiService lazy load failed", e));

    console.log("DASH_TRACE_4: Final checks before AI Service load")
    const fullAnalysisBtn = document.getElementById('full-analysis-btn')
    if (fullAnalysisBtn) {
        fullAnalysisBtn.onclick = () => window.navigateTo('analytics', profile)
    }

    console.log("DASH_TRACE_5: Initializing repair mistakes listener")
    const repairBtn = document.getElementById('repair-mistakes-btn')
    if (repairBtn) {
        repairBtn.onclick = async () => {
            repairBtn.disabled = true
            repairBtn.innerHTML = '<div class="loader-spinner" style="width:16px;height:16px;"></div> Loading Mistakes...'
            try {
                const { data: questions, error } = await DataService.getQuestionsByIds(this.unresolvedMistakeIds)
                if (error) throw error
                if (questions && questions.length > 0) {
                    this.onStartExam(questions, 'practice', 'Elite Repair', 'Focused Improvement')
                } else {
                    alert("Mistakes resolved! Try some new questions.")
                    this.render(profile)
                }
            } catch (err) {
                console.error("Repair session failed:", err)
                alert("Failed to load mistakes. Please try again.")
            } finally {
                repairBtn.disabled = false
                repairBtn.innerHTML = '<i data-lucide="zap" style="width: 18px;"></i> REPAIR NOW'
            }
        }
    }

    await initData()
    renderLucide()
    this.checkForCelebration()

    const aiWorkoutBtn = document.getElementById('start-ai-workout')
    if (aiWorkoutBtn) {
        aiWorkoutBtn.onclick = async () => {
            aiWorkoutBtn.disabled = true
            aiWorkoutBtn.innerHTML = '<div class="loader-spinner" style="width:16px;height:16px;"></div> Analyzing...'
            const questions = await DataService.getRecommendedQuestions(this.profile.id)
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
      <div style="padding: 0.5rem;">
        <table class="premium-table" style="width:100%;border-collapse:collapse; background: rgba(0,0,0,0.1); border-radius: 16px; overflow: hidden;">
          <thead>
            <tr style="text-align:left;color:var(--text-secondary);font-size:0.75rem; border-bottom: 1px solid var(--glass-border);">
              <th style="padding: 1rem;">RANK</th>
              <th style="padding: 1rem;">STUDENT</th>
              <th style="padding: 1rem; text-align:right;">QUESTIONS</th>
            </tr>
          </thead>
          <tbody>
            ${data.map((entry, i) => {
              const u = entry.users || {};
              const isUser = u.username === profile.username;
              const rankIcon = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`;
              
              const userDailyCount = u.daily_questions_count || 0;
              const userMilestone = this.MILESTONES.slice().reverse().find(m => userDailyCount >= m.target);

              return `
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.03); ${isUser ? 'background: rgba(37,99,235,0.1);' : ''}">
                  <td style="padding:1rem; font-weight: 900; color: ${i < 3 ? 'var(--warning)' : 'var(--text-secondary)'};">${rankIcon}</td>
                  <td style="padding:1rem; font-weight:700; color: ${isUser ? 'var(--accent-primary)' : 'var(--text-primary)'};">
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        ${u.username || 'Anon'} 
                        ${userMilestone ? `<i data-lucide="${userMilestone.badge}" title="${userMilestone.title}" style="width: 14px; height: 14px; color: ${userMilestone.color};"></i>` : ''}
                        ${isUser ? '<span style="font-size:0.6rem; opacity:0.6;">(YOU)</span>' : ''}
                    </div>
                  </td>
                  <td style="padding:1rem; text-align:right; color: var(--success); font-weight:900;">${entry.total_questions_answered.toLocaleString()}</td>
                </tr>
              `
            }).join('')}
          </tbody>
        </table>
        <p style="font-size: 0.7rem; color: var(--text-secondary); text-align: center; margin-top: 1.5rem; font-weight: 600;">Rankings are updated weekly.</p>
      </div>
    `
  },

  hide() {
    document.getElementById('dashboard-container').style.display = 'none'
  },

  triggerCelebration(milestone) {
    const modal = document.getElementById('celebration-modal');
    if (!modal) return;

    document.getElementById('celebration-name').textContent = milestone.title;
    document.getElementById('celebration-name').style.color = milestone.color;
    document.getElementById('celebration-stars').textContent = `${milestone.starCount}★`;
    document.getElementById('celebration-text').textContent = `Incredible! You've solved ${milestone.target} questions today. You are officially a Daily ${milestone.title}!`;
    
    const icon = document.getElementById('celebration-icon');
    icon.setAttribute('data-lucide', milestone.badge);
    icon.style.color = milestone.color;
    
    modal.style.display = 'flex';
    if (window.lucide) window.lucide.createIcons({ root: modal });

    if (typeof confetti === 'function') {
        confetti({
            particleCount: 200,
            spread: 80,
            origin: { y: 0.6 },
            colors: [milestone.color, '#ffffff', '#2563eb']
        });
    }

    const closeBtn = document.getElementById('close-celebration-btn');
    closeBtn.onclick = () => {
        modal.style.display = 'none';
        this.checkForCelebration(); // Check for cumulative levels
    };
  },

  checkForCelebration() {
    if (!this.profile) return;
    const currentDailyCount = this.profile.daily_questions_count || 0;
    const today = new Date().toDateString();
    const celebratedLevels = JSON.parse(localStorage.getItem('elite_celebrated_levels') || '{}');
    
    if (celebratedLevels.date !== today) {
      celebratedLevels.date = today;
      celebratedLevels.levels = [];
    }

    const newLevel = this.MILESTONES.find(m => currentDailyCount >= m.target && !celebratedLevels.levels.includes(m.id));
    if (newLevel) {
      celebratedLevels.levels.push(newLevel.id);
      localStorage.setItem('elite_celebrated_levels', JSON.stringify(celebratedLevels));
      this.triggerCelebration(newLevel);
    }
  },

  async updateLeagueMiniRank(userId) {
    const { data } = await DataService.getLeagueTable(userId)
    const indicator = document.getElementById('league-rank-indicator')
    if (indicator && data && data.length > 0) {
        const myEntry = data.find(u => u.user_id === userId)
        if (myEntry) {
            indicator.textContent = `#${myEntry.rank} of ${data.length} in group`
            if (myEntry.rank <= 10) indicator.style.color = 'var(--success)'
            if (myEntry.rank >= 45) indicator.style.color = 'var(--error)'
        }
    }
  },

  updateLeagueTimer() {
    const now = new Date()
    const sun = new Date()
    sun.setDate(now.getDate() + (7 - now.getDay()) % 7)
    sun.setHours(23, 59, 59, 999)
    
    const diff = sun - now
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24)
    const mins = Math.floor((diff / (1000 * 60)) % 60)
    
    const timerEl = document.getElementById('league-timer')
    if (timerEl) timerEl.textContent = `${days}d ${hours}h ${mins}m left`
    
    const progressEl = document.getElementById('league-week-progress')
    if (progressEl) {
        const weekProgress = ((now.getDay() || 7) * 24 + now.getHours()) / (7 * 24) * 100
        progressEl.style.width = `${100 - weekProgress}%`
    }
  },

  async loadLeagueModalTable(profile) {
    const list = document.getElementById('league-modal-list')
    if (!list) return
    list.innerHTML = '<div style="text-align:center;padding:3rem;"><div class="loader-spinner"></div></div>'
    
    const { data } = await DataService.getLeagueTable(this.profile.id)
    if (!data || data.length === 0) {
        list.innerHTML = '<div style="text-align:center;padding:2rem;">No data found for your group.</div>'
        return
    }

    const tier = this.leagueData?.tier || 'Bronze'
    const tierStyles = {
        'Bronze': { color: '#cd7f32', icon: 'shield' },
        'Silver': { color: '#c0c0c0', icon: 'shield-check' },
        'Gold': { color: '#ffd700', icon: 'award' },
        'Diamond': { color: '#00f2ff', icon: 'gem' },
        'Elite': { color: '#8b5cf6', icon: 'crown' }
    }
    const style = tierStyles[tier] || tierStyles['Bronze']

    // Update Modal Header
    document.getElementById('league-modal-title').textContent = `${tier} League`
    const modalIcon = document.getElementById('league-modal-icon')
    modalIcon.setAttribute('data-lucide', style.icon)
    modalIcon.style.color = style.color
    document.getElementById('league-modal-icon-container').style.borderColor = style.color
    if (window.lucide) window.lucide.createIcons({ root: document.getElementById('league-modal-header') })

    list.innerHTML = data.map((entry, i) => {
        const isUser = entry.user_id === this.profile.id
        const isPromotion = entry.rank <= 10
        const isDemotion = entry.rank >= 45
        let borderColor = 'transparent'
        if (isPromotion) borderColor = 'rgba(16, 185, 129, 0.4)'
        if (isDemotion) borderColor = 'rgba(239, 68, 68, 0.4)'

        return `
            <div style="display: flex; align-items: center; gap: 1rem; padding: 1rem 1.5rem; border-bottom: 1px solid rgba(255,255,255,0.03); ${isUser ? 'background: rgba(139, 92, 246, 0.08);' : ''} border-left: 4px solid ${borderColor};">
                <div style="width: 24px; font-weight: 900; color: ${isPromotion ? 'var(--success)' : isDemotion ? 'var(--error)' : 'var(--text-secondary)'}; font-size: 0.9rem;">${entry.rank}</div>
                <div style="flex: 1; display: flex; align-items: center; gap: 0.75rem;">
                    <div style="width: 32px; height: 32px; background: rgba(255,255,255,0.05); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; font-weight: 800; color: var(--text-secondary); border: 1px solid var(--glass-border);">
                        ${entry.username ? entry.username.substring(0,1).toUpperCase() : '?'}
                    </div>
                    <div>
                        <div style="font-weight: 800; color: ${isUser ? 'var(--accent-primary)' : 'var(--text-primary)'}; font-size: 0.9rem;">
                            ${entry.username || 'Student'} ${isUser ? '<span style="font-size: 0.65rem; opacity: 0.6; margin-left: 4px;">(YOU)</span>' : ''}
                        </div>
                    </div>
                </div>
                <div style="text-align: right;">
                    <div style="font-family: 'Outfit'; font-weight: 900; color: var(--text-primary); font-size: 1rem;">${entry.weekly_score}</div>
                    <div style="font-size: 0.6rem; color: var(--text-secondary); font-weight: 800; text-transform: uppercase;">XP THIS WEEK</div>
                </div>
            </div>
        `
    }).join('')
  },

  _isPromotion(oldTier, newTier) {
    const tiers = ['Bronze', 'Silver', 'Gold', 'Diamond', 'Elite']
    return tiers.indexOf(newTier) > tiers.indexOf(oldTier)
  },

  showTierChangeModal(oldTier, newTier, isPromotion) {
    const title = isPromotion ? 'PROMOTE! 🎉' : 'DEMOTED 📉'
    const text = isPromotion 
        ? `Incredible work! You've climbed from ${oldTier} to the ${newTier} League.`
        : `Tough week! You've dropped to the ${oldTier} League. Time to fight back!`
    
    // Reuse the celebration modal structure
    const modal = document.getElementById('celebration-modal')
    if (!modal) return
    
    document.getElementById('celebration-title').textContent = title
    document.getElementById('celebration-name').textContent = `${newTier} League`
    document.getElementById('celebration-text').textContent = text
    
    const icon = document.getElementById('celebration-icon')
    if (icon) {
        icon.setAttribute('data-lucide', isPromotion ? 'trending-up' : 'trending-down')
        icon.style.color = isPromotion ? 'var(--success)' : 'var(--error)'
    }
    
    modal.style.display = 'flex'
    if (window.lucide) window.lucide.createIcons({ root: modal })
  }
}
