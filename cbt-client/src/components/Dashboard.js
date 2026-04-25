import { DataService } from '../services/data'
import { supabase } from '../utils/supabase'
import { AuthService } from '../services/auth'
import { WeeklyRecapComponent } from './WeeklyRecap'
import { EliteStoreComponent } from './EliteStore'
import { TourGuide } from '../utils/TourGuide'
import { SubscriptionService } from '../services/subscriptionService'
import { SubscriptionManager } from '../utils/subscriptionManager'
import { ExamCard } from './ExamCard'
import { AnimationUtils } from '../utils/animations'
import { ModalService } from '../services/ModalService'
import Chart from 'chart.js/auto'

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
      this.renderSkeletons()
      await this._render(profile, onStartExam, onOpenAdmin, onReadNews)
    } catch (err) {
      console.error("CRITICAL DASHBOARD ERROR:", err)
      const container = document.getElementById('dashboard-container')
      if (container) {
          container.style.display = 'block'
          container.innerHTML = `
            <div style="padding: 2rem; background: rgba(239, 68, 68, 0.1); border: 2px solid #ef4444; border-radius: 20px; color: #ef4444; margin: 2rem;">
                <h2 style="font-family: 'Outfit'; margin-top: 0;">⚠️ Dashboard Render Error</h2>
                <p style="font-weight: 800;">${err.message}</p>
                <pre style="background: rgba(0,0,0,0.5); padding: 1rem; border-radius: 10px; font-size: 0.7rem; overflow: auto; max-height: 200px;">${err.stack}</pre>
                <button onclick="location.reload()" class="btn-primary" style="margin-top: 1rem;">RELOAD APP</button>
            </div>
          `
      }
    }
  },

  renderSkeletons() {
    const container = document.getElementById('dashboard-container')
    if (!container) return
    container.style.display = 'block'
    container.innerHTML = `
      <div class="dashboard-scroll-area" style="padding-top: calc(var(--header-height) + 1.25rem);">
        <div style="margin-bottom: 2rem;">
            <div class="skeleton-box" style="width: 200px; height: 1.8rem; margin-bottom: 0.5rem;"></div>
            <div class="skeleton-box" style="width: 150px; height: 0.8rem;"></div>
        </div>
        <div class="dashboard-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.25rem;">
            <div class="glass card skeleton-card" style="padding: 1.5rem;">
                <div class="skeleton-box" style="width: 100px; height: 0.7rem; margin-bottom: 1rem;"></div>
                <div style="display: flex; flex-direction: column; align-items: center; gap: 1rem;">
                    <div class="skeleton-box" style="width: 100px; height: 100px; border-radius: 50%;"></div>
                    <div class="skeleton-box" style="width: 150px; height: 1.2rem;"></div>
                </div>
            </div>
            <div class="glass card skeleton-card" style="padding: 1.5rem;">
                <div class="skeleton-box" style="width: 100px; height: 0.7rem; margin-bottom: 1rem;"></div>
                <div style="display: flex; flex-direction: column; align-items: center; gap: 1rem;">
                    <div class="skeleton-box" style="width: 100px; height: 100px; border-radius: 50%;"></div>
                    <div class="skeleton-box" style="width: 150px; height: 1.2rem;"></div>
                </div>
            </div>
            <div class="glass card skeleton-card" style="padding: 1.5rem;">
                <div class="skeleton-box" style="width: 100px; height: 0.7rem; margin-bottom: 1rem;"></div>
                <div style="flex: 1; display: flex; flex-direction: column; gap: 1rem; justify-content: center;">
                    <div class="skeleton-box" style="width: 100%; height: 1rem;"></div>
                    <div class="skeleton-box" style="width: 100%; height: 1rem;"></div>
                    <div class="skeleton-box" style="width: 100%; height: 1rem;"></div>
                </div>
            </div>
        </div>
      </div>
    `
  },

  async _render(profile, onStartExam, onOpenAdmin, onReadNews) {
    this.onStartExam = onStartExam
    this.onOpenAdmin = onOpenAdmin
    this.onReadNews = onReadNews
    this.unresolvedMistakeIds = [] 
    
    const container = document.getElementById('dashboard-container')
    container.style.display = 'block'
    
    // 🔥 FIX: Reset scroll position to top immediately - target the actual scroll container
    window.scrollTo(0, 0);
    document.body.scrollTop = 0;
    container.scrollTop = 0;
    const mainContentArea = document.querySelector('.main-content-area');
    if (mainContentArea) mainContentArea.scrollTop = 0;

    // Handle Tier Transitions & Daily Resets
    const updatedUser = profile ? await SubscriptionService.handleTierTransition(profile) : null
    // --- 🚀 HARDENING: Merge objects to prevent dropping fields like elite_coins ---
    this.profile = { ...(profile || {}), ...(updatedUser || {}) }
    if (!this.profile.username) this.profile.username = 'Student'
    if (!this.profile.id) this.profile.id = 'anon'
    
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
        // 🔥 FIX: Sync the profile fields fetched during analytics back into this.profile
        if (analytics.profile) {
            this.profile = { ...this.profile, ...analytics.profile }
            console.log("Dashboard: Profile synced from DB", this.profile)
        }
        
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
        
        // --- 🔥 FIX: Sanitize Tiers to prevent Subscription levels leaking into Leagues ---
        const VALID_LEAGUE_TIERS = ['Bronze', 'Silver', 'Gold', 'Diamond', 'Elite'];
        let currentTier = (leagueSync && leagueSync.tier) ? leagueSync.tier : 'Bronze';
        
        // If the server returns a subscription tier (free/medium/premium), map to Bronze
        const subsTiers = ['free', 'freemium', 'medium', 'premium'];
        if (subsTiers.includes(currentTier.toLowerCase()) || !VALID_LEAGUE_TIERS.includes(currentTier)) {
            currentTier = 'Bronze';
        }

        this.leagueData = { ...(leagueSync || {}), tier: currentTier };
        if (this.profile) this.profile.league_tier = currentTier;
        
        if (lastTier && lastTier !== currentTier && VALID_LEAGUE_TIERS.includes(lastTier)) {
            const isPromotion = this._isPromotion(lastTier, currentTier);
            this.showTierChangeModal(lastTier, currentTier, isPromotion);
        }
        localStorage.setItem('elite_last_league_tier', currentTier);
        console.log("Dashboard: League synced", this.leagueData)
    } catch (err) {
        console.error("Dashboard data fetch failed:", err)
    }

    // Initialize Tour Guide
    TourGuide.init([
      { title: "Get Started with CBT Elite", text: "Your all-in-one platform to prepare for JAMB, WAEC, and NECO." },
      { element: "#quick-practice-btn", title: "Practice Mode", text: "Start here. Practice Mode helps you improve topic by topic." },
      { element: "#quick-exam-btn", title: "Exam Mode", text: "Simulate real exams with timers and scoring." },
      { element: "#analytics-section", title: "Performance Insights", text: "Track your scores and identify weak subjects." },
      { element: "#economy-coins-val", title: "Elite Economy", text: "Earn coins by practicing. Spend them in the Store on Power-ups and Streaks!" },
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
    const watNow = DataService.getWATDate()
    const today = watNow.toDateString() // "Wed Apr 22 2026" in WAT
    let v2_todayQuestions = 0
    let v2_totalQuestions = 0
    let v2_totalCorrect = 0
    let v2_overallTime = 0
    
    try {
        if (history && history.length > 0) {
            history.forEach(s => {
                    const sUTC = new Date(s.created_at)
                    // Convert session UTC time to WAT for comparison
                    const sDate = new Date(sUTC.toLocaleString("en-US", {timeZone: "Africa/Lagos"}))
                    const sessionCount = s.answered_questions ?? s.total_questions ?? 0
                    if (sDate.toDateString() === today) v2_todayQuestions += sessionCount
                    v2_totalQuestions += sessionCount
                    v2_totalCorrect += (s.correct_answers || 0)
                    v2_overallTime += (s.time_taken || s.time_taken_seconds || 0)
            })
        }
    } catch (e) {
        console.error("Dashboard: Error calculating XP history", e)
    }

    // 🚀 FIX: Fallback to aggregated stats if history total is 0 (prevents "0m" bug)
    const finalOverallTime = Math.max(v2_overallTime, (analytics.stats?.overall?.time || 0));

    const accuracy = v2_totalQuestions > 0 ? Math.round((v2_totalCorrect / v2_totalQuestions) * 100) : 0
    const studyTimeMinutes = Math.floor(finalOverallTime / 60)
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
    
    // 🚀 HARDENING: Synchronize profile count with freshly calculated session data
    this.profile.daily_questions_count = v2_todayQuestions;
    const currentDailyCount = v2_todayQuestions;

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

    console.log("Dashboard: Preparing time-based states")
    // --- Time-Based Windows (Clash Hub) ---
    let now;
    try {
        now = (DataService && typeof DataService.getWATDate === 'function') ? DataService.getWATDate() : new Date();
    } catch (e) {
        now = new Date();
    }
    const day = now.getDay();
    const hour = now.getHours();
    const min = now.getMinutes();

    // SAT/SUN 7:00 PM - 7:30 PM is Clash Time
    const isClashWindow = (day === 6 || day === 0) && hour === 19 && min < 30;
    // After 7:30 PM is Results Time
    const isResultsWindow = (day === 6 || day === 0) && (hour > 19 || (hour === 19 && min >= 30));

    console.log("Dashboard: Preparing to inject HTML")
    container.innerHTML = `
      <div id="dashboard-content" class="dashboard-scroll-area" style="padding-top: calc(var(--header-height) + 1.25rem);">
        
        <!-- DASHBOARD HEADER -->
        <div style="margin-bottom: 0.75rem;">
          <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem;">
            <h1 style="font-family: 'Outfit'; margin: 0; font-weight: 900; color: var(--text-primary); display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; font-size: 1.6rem; line-height: 1.1;">
              Hello, ${this.profile.username || 'Student'} 
              <i data-lucide="sun" style="width: 20px; height: 20px; color: var(--warning);"></i>
            </h1>
            <div id="header-tier" class="tier-mini" title="Your Account Tier" style="display: flex; align-items: center; gap: 0.35rem; background: ${this.profile.activation_status ? 'var(--accent-secondary)' : 'rgba(255,255,255,0.05)'};">
              <i data-lucide="award" style="width: 16px; height: 16px;"></i> <span id="tier-text">${this.profile.activation_status ? 'PREMIUM' : 'FREE'}</span>
            </div>
          </div>
          <p style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 0.15rem; font-weight: 800; letter-spacing: 0.02em;">Let's make today count.</p>
        </div>

        <!-- ELITE ECONOMY WIDGET (Enhanced Labels) -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; margin-bottom: 0.75rem;">
          <div class="glass card" style="padding: 0.35rem 0.6rem; display: flex; align-items: center; gap: 0.4rem; border-left: 2px solid #f59e0b; background: rgba(245, 158, 11, 0.08); min-height: 44px; border-radius: 12px;">
            <div style="width: 20px; height: 20px; background: rgba(245, 158, 11, 0.2); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #f59e0b; flex-shrink: 0;">
              <i data-lucide="coins" style="width: 12px;"></i>
            </div>
            <div style="overflow: hidden;">
              <div style="font-size: 0.5rem; color: var(--text-secondary); font-weight: 900; text-transform: uppercase; white-space: nowrap; letter-spacing: 0.05em;">Elite Coins</div>
              <div id="economy-coins-val" style="font-family: 'Outfit'; font-size: 0.9rem; font-weight: 900; color: var(--text-primary); line-height: 1;">${this.profile.elite_coins || 0}</div>
            </div>
          </div>
          
          <div id="open-store-btn" class="glass card scale-in" style="padding: 0.35rem 0.6rem; display: flex; align-items: center; gap: 0.4rem; cursor: pointer; border-left: 2px solid var(--accent-secondary); background: rgba(139, 92, 246, 0.08); min-height: 44px; border-radius: 12px;">
            <div style="width: 20px; height: 20px; background: rgba(139, 92, 246, 0.2); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: var(--accent-secondary); flex-shrink: 0;">
              <i data-lucide="snowflake" style="width: 12px;"></i>
            </div>
            <div style="overflow: hidden;">
              <div style="font-size: 0.5rem; color: var(--text-secondary); font-weight: 900; text-transform: uppercase; white-space: nowrap; letter-spacing: 0.05em;">Streak Freeze</div>
              <div id="economy-freeze-val" style="font-family: 'Outfit'; font-size: 0.9rem; font-weight: 900; color: var(--text-primary); line-height: 1;">${this.profile.streak_freeze_count || 0}</div>
            </div>
          </div>
        </div>

        <!-- QUICK ACTION SECTION (Compact) -->
        <div class="glass card scale-in mb-md" style="text-align: center; padding: 0.85rem 0.75rem; border: 1.5px solid rgba(14, 165, 233, 0.3); background: linear-gradient(180deg, rgba(14, 165, 233, 0.04) 0%, var(--surface-color) 100%);">
          <div style="display: flex; justify-content: center; gap: 0.5rem; flex-wrap: wrap; width: 100%;">
             <button id="quick-practice-btn" class="btn-primary" style="padding: 0 1rem; flex: 1; height: 40px; min-width: 120px; font-size: 0.85rem;"><i data-lucide="target" style="width:16px;"></i> Practice</button>
             <button id="quick-exam-btn" class="btn-secondary" style="padding: 0 1rem; flex: 1; height: 40px; min-width: 120px; font-weight: 800; font-size: 0.85rem;"><i data-lucide="trophy" style="width:16px;"></i> Mock Exam</button>
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
          <div class="dashboard-responsive-grid mb-md" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 0.75rem;">
            
            <!-- Daily Streak Card (Compact) -->
            <div class="glass card scale-in" style="padding: 0.75rem 0.85rem; display: flex; flex-direction: column; min-height: 210px; justify-content: space-between; border-top: 4px solid var(--warning); background: linear-gradient(180deg, rgba(245, 158, 11, 0.05) 0%, var(--surface-color) 100%); border-radius: 16px;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <h3 style="color: var(--text-secondary); font-size: 0.7rem; font-weight: 900; text-transform: uppercase; letter-spacing: 0.08em; margin: 0;">Learning Streak</h3>
                <span class="badge" style="background: rgba(245, 158, 11, 0.1); color: var(--warning); font-size: 0.65rem; font-weight: 800;">ACTIVE</span>
              </div>
              <div style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.15rem;">
                <div class="streak-flame-container ${this.profile.streak_count > 0 ? 'active' : ''}">
                  <i data-lucide="flame" style="width: 32px; height: 32px; color: ${this.profile.streak_count > 0 ? 'var(--warning)' : 'var(--text-secondary)'}; filter: drop-shadow(0 0 10px rgba(245, 158, 11, 0.3));"></i>
                </div>
                <div id="streak-count-val" style="font-family: 'Outfit'; font-size: 2rem; font-weight: 900; color: var(--text-primary); line-height: 1;">${this.profile.streak_count || 0}</div>
                <div style="font-size: 0.8rem; font-weight: 800; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em;">Day Streak</div>
              </div>
              <p style="font-size: 0.8rem; color: var(--text-secondary); text-align: center; margin: 0; font-weight: 500;">
                ${this.profile.streak_count > 0 ? "You're on fire! Keep it up." : "Start a session to begin your streak."}
              </p>
              <button id="open-leaderboard-btn" class="glass-btn" style="margin-top: 1rem; font-size: 0.7rem; padding: 0.4rem; border: 1px solid var(--glass-border); color: var(--text-secondary); width: 100%; border-radius: 8px;">
                <i data-lucide="trophy" style="width:14px; margin-right: 4px;"></i> VIEW GLOBAL RANKINGS
              </button>
            </div>

            <!-- Elite Clan Hub (Department-Based) -->
            ${(() => {
                const dept = this.profile?.department || 'General';
                const tier = this.profile?.league_tier || 'Bronze';
                const isSuperElite = tier === 'Elite';
                
                const deptStyles = {
                    'Science': { color: '#00f2ff', name: 'Science Clan', icon: 'flask-conical', sub: 'Maths, Phys, Chem' },
                    'Arts': { color: '#f471ff', name: 'Arts Clan', icon: 'palette', sub: 'Lit, Gov, CRS' },
                    'Commercial': { color: '#ffd700', name: 'Commercial Clan', icon: 'trending-up', sub: 'Econ, Accnt, Comm' },
                    'General': { color: '#8b5cf6', name: 'Elite Clan', icon: 'graduation-cap', sub: 'All Subjects' }
                };
                const style = deptStyles[dept] || deptStyles['General'];
                const clanName = this.leagueData?.clan_name || (dept + ' Elites');

                return `
                <div id="open-league-btn" class="glass card scale-in" style="padding: 0.75rem 0.85rem; display: flex; flex-direction: column; min-height: 210px; justify-content: space-between; border-top: 3px solid ${style.color}; background: linear-gradient(180deg, ${style.color}05 0%, var(--surface-color) 100%); cursor: pointer; position: relative; overflow: hidden;">
                  ${isSuperElite ? `<div style="position: absolute; top: 0; right: 0; background: var(--accent-primary); color: white; padding: 2px 8px; font-size: 0.55rem; font-weight: 900; border-bottom-left-radius: 8px;">SUPER ELITE</div>` : ''}
                  
                  <div style="display: flex; justify-content: space-between; align-items: center;">
                    <h3 style="color: var(--text-secondary); font-size: 0.7rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; margin: 0;">League Hub</h3>
                    <div style="font-size: 0.65rem; font-weight: 800; color: ${style.color}; display: flex; align-items: center; gap: 0.2rem;">
                        <i data-lucide="users" style="width: 10px;"></i> <span id="clan-size-indicator">GRP-20</span>
                    </div>
                  </div>
                  
                  <div style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.3rem; margin: 0.5rem 0;">
                    <div style="width: 44px; height: 44px; background: ${style.color}15; border-radius: 12px; display: flex; align-items: center; justify-content: center; border: 2px solid ${style.color}40;">
                        <i data-lucide="${style.icon}" style="width: 20px; height: 20px; color: ${style.color};"></i>
                    </div>
                    <div style="text-align: center;">
                        <div style="font-family: 'Outfit'; font-size: 1rem; font-weight: 900; color: var(--text-primary); line-height: 1.1;">${clanName}</div>
                        <div style="font-size: 0.55rem; color: var(--text-secondary); font-weight: 800; text-transform: uppercase;">${dept} • ${tier}</div>
                    </div>
                  </div>

                  ${isClashWindow ? `
                    <button id="start-clash-btn" class="btn-dominant scale-in" style="width: 100%; height: 40px; font-size: 0.8rem; font-weight: 900; background: linear-gradient(90deg, ${style.color}, var(--accent-primary)); border: none;">
                        START CLASH
                    </button>
                  ` : isResultsWindow ? `
                    <button id="view-clash-results-btn" class="btn-dominant scale-in" style="width: 100%; height: 40px; font-size: 0.8rem; font-weight: 900; background: linear-gradient(90deg, var(--success), var(--accent-primary));">
                        LEADERBOARD
                    </button>
                  ` : `
                    <div style="background: rgba(255,255,255,0.03); border-radius: 10px; padding: 0.6rem; border: 1px solid var(--glass-border);">
                       <div style="display: flex; justify-content: space-between; align-items: center;">
                          <div style="display: flex; flex-direction: column;">
                            <span style="font-size: 0.55rem; font-weight: 800; color: var(--text-secondary); text-transform: uppercase;">Next Clash</span>
                            <span style="font-size: 0.7rem; font-weight: 900; color: var(--text-primary);">${isSuperElite ? 'SUN 7PM' : 'SAT 7PM'}</span>
                          </div>
                          <div style="text-align: right;">
                            <span id="league-timer" style="font-size: 0.65rem; font-weight: 900; color: ${style.color};">--:--:--</span>
                          </div>
                       </div>
                    </div>
                  `}

                  <!-- RANKING BUTTON INTEGRATED -->
                  <div style="margin-top: 0.75rem; display: flex; gap: 0.35rem; width: 100%;">
                    <button id="open-league-btn" class="glass-btn btn-secondary" style="flex: 0.45; font-size: 0.6rem; padding: 0.4rem 0.2rem; border: 1px solid var(--glass-border); color: var(--text-secondary); border-radius: 8px; font-weight: 800; display: flex; align-items: center; justify-content: center; gap: 0.25rem;">
                        <i data-lucide="bar-chart-2" style="width:12px;"></i> RANKINGS
                    </button>
                    <button class="glass-btn btn-primary" id="change-clan-btn" style="flex: 0.55; font-size: 0.65rem; padding: 0.4rem 0.2rem; border: none; color: white !important; border-radius: 8px; font-weight: 900; background: var(--accent-primary); display: flex; align-items: center; justify-content: center; gap: 0.25rem; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.2);">
                        <i data-lucide="graduation-cap" style="width:14px; flex-shrink: 0;"></i> <span style="white-space: nowrap;">SELECT DEPT</span>
                    </button>
                  </div>
                </div>
                `;
            })()}

            <!-- Daily Goal Card (Compacted) -->
            <div class="glass card" style="padding: 0.75rem 0.85rem; display: flex; flex-direction: column; min-height: 210px; justify-content: space-between; border-top: 3px solid ${currentMilestone ? currentMilestone.color : 'var(--accent-primary)'};">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                <h3 style="color: var(--text-secondary); font-size: 0.7rem; font-weight: 800; text-transform: uppercase;">Star Target</h3>
                <div style="display: flex; gap: 4px;">
                    ${this.MILESTONES.map(m => `
                        <div title="${m.title}" style="color: ${currentDailyCount >= m.target ? m.color : 'var(--text-secondary)'} !important; opacity: ${currentDailyCount >= m.target ? '1' : '0.2'} !important; transition: all 0.3s ease;">
                             <i data-lucide="${m.badge}" style="width: 14px; height: 14px; ${currentDailyCount >= m.target ? `filter: drop-shadow(0 0 4px ${m.color});` : ''}"></i>
                        </div>
                    `).join('')}
                </div>
              </div>
              
              <div style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.5rem;">
                <!-- Multi-Level Circular Progress -->
                <div style="position: relative; width: 80px; height: 80px;">
                  <svg viewBox="0 0 36 36" style="width: 100%; height: 100%; transform: rotate(-90deg);">
                    <circle cx="18" cy="18" r="16" fill="none" stroke="rgba(255,255,255,0.03)" stroke-width="2.5" />
                    ${(() => {
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
                    <div id="daily-solved-val" style="font-family: 'Outfit'; font-size: 1.6rem; font-weight: 900; color: var(--text-primary); line-height: 1;">${currentDailyCount}</div>
                    <div style="font-size: 0.6rem; font-weight: 800; color: var(--text-secondary); text-transform: uppercase;">Solved</div>
                  </div>
                </div>
                
                <div style="text-align: center;">
                  <div style="font-size: 0.65rem; color: var(--text-secondary); font-weight: 600;">
                    ${nextMilestone ? `${nextMilestone.target - currentDailyCount} more for ${nextMilestone.title}` : 'Legendary status attained!'}
                  </div>
                </div>
              </div>

              <div style="margin-top: 0.5rem; display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.03); padding: 0.4rem 0.6rem; border-radius: 8px; border: 1px solid var(--glass-border);">
                 <div style="display: flex; align-items: center; gap: 0.4rem;">
                    <button class="goal-toggle badge glass" data-target="50" style="font-size: 0.6rem; padding: 0.1rem 0.4rem; border: ${dailyGoalLimit === 50 ? '1px solid var(--accent-primary)' : '0'};">50</button>
                    <button class="goal-toggle badge glass" data-target="100" style="font-size: 0.6rem; padding: 0.1rem 0.4rem; border: ${dailyGoalLimit === 100 ? '1px solid var(--accent-primary)' : '0'};">100</button>
                 </div>
                 <div style="font-size: 0.75rem; font-weight: 900; color: ${currentMilestone ? currentMilestone.color : 'var(--text-primary)'};">${currentMilestone ? currentMilestone.title : 'Novice'}</div>
              </div>
            </div>

            <!-- Readiness Progress Card (Compact) -->
            <div class="glass card" style="padding: 0.85rem 1rem; display: flex; flex-direction: column; min-height: 200px; justify-content: space-between; border-radius: 16px;">
              <h3 style="color: var(--text-secondary); font-size: 0.7rem; font-weight: 900; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 0.5rem;">Study Stats</h3>
              
              <div style="display: flex; gap: 1rem; align-items: center; justify-content: center; flex: 1;">
                 <div id="readiness-gauge-container" style="position: relative; width: 64px; height: 64px; flex-shrink: 0;">
                    <svg viewBox="0 0 36 36" style="width: 100%; height: 100%; transform: rotate(-90deg);">
                      <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="rgba(59, 130, 246, 0.1)" stroke-width="3" />
                      <path id="readiness-progress-path" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="var(--primary)" stroke-width="3" stroke-dasharray="0, 100" stroke-linecap="round" />
                    </svg>
                    <div id="readiness-percentage" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-weight: 900; font-size: 0.9rem; color: var(--primary);">0%</div>
                 </div>
                 <div style="text-align: left; min-width: 0;">
                      <div id="readiness-label" style="font-size: 0.55rem; font-weight: 900; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em;">Primary Track</div>
                    <div id="readiness-subject" style="font-family: 'Outfit'; font-size: 0.85rem; font-weight: 900; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 110px;">...</div>
                    <div id="readiness-status" style="font-size: 0.7rem; font-weight: 800; color: var(--success); letter-spacing: 0.02em;">Elite Level</div>
                 </div>
              </div>

              <div style="background: rgba(255,255,255,0.03); border-radius: 12px; margin-top: 0.75rem; padding: 0.65rem; display: flex; justify-content: space-between; align-items: center; gap: 0.25rem; border: 1px solid var(--glass-border);">
                <div style="flex: 1; text-align: center;">
                  <div style="font-family: 'Outfit'; font-weight: 900; font-size: 0.9rem; color: var(--text-primary);">
                      <span style="color: var(--primary);">${v2_totalQuestions}</span> <span style="opacity: 0.3; font-weight: 300; margin: 0 0.2rem;">|</span> <span style="color: var(--success);">${accuracy}%</span>
                  </div>
                  <div style="font-size: 0.55rem; color: var(--text-secondary); font-weight: 800; text-transform: uppercase; letter-spacing: 0.02em;">Solved <span style="opacity: 0.5;">|</span> Accuracy</div>
                </div>
                <div style="width: 1px; height: 16px; background: var(--glass-border);"></div>
                <div style="flex: 1; text-align: center;">
                  <div style="font-family: 'Outfit'; font-weight: 900; font-size: 0.9rem; color: var(--text-primary);">
                      <span style="color: var(--accent-secondary);">${examsCompleted}</span> <span style="opacity: 0.3; font-weight: 300; margin: 0 0.2rem;">|</span> <span style="color: var(--warning);">${studyTimeMinutes}m</span>
                  </div>
                  <div style="font-size: 0.55rem; color: var(--text-secondary); font-weight: 800; text-transform: uppercase; letter-spacing: 0.02em;">Exams <span style="opacity: 0.5;">|</span> Time</div>
                </div>
              </div>
              ${badgesHTML}
              <!-- AI Insight Card Removed as per feedback -->
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
              
              <div style="margin-bottom: 1.25rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                    <span style="font-size: 0.65rem; font-weight: 800; color: var(--text-secondary); text-transform: uppercase;">Fixing Accuracy</span>
                    <span style="font-size: 0.7rem; font-weight: 900; color: #ef4444;">MASTER LEVEL</span>
                </div>
                <div style="height: 10px; background: rgba(255,255,255,0.05); border-radius: 5px; overflow: hidden; border: 1px solid var(--glass-border);">
                    <div style="width: ${Math.max(15, 100 - (this.unresolvedMistakeIds.length * 2)) }%; height: 100%; background: linear-gradient(90deg, #ef4444, #f59e0b); transition: width 1s ease;"></div>
                </div>
              </div>

              <p style="font-size: 0.8rem; color: var(--text-secondary); line-height: 1.5; margin-bottom: 1.25rem;">
                These are questions you missed recently. Fixing them is the fastest way to master your JAMB, WAEC, and NECO exams.
              </p>
              <button id="repair-mistakes-btn" class="btn-dominant" style="width: 100%; height: 48px; background: linear-gradient(90deg, #ef4444 0%, #b91c1c 100%); border-radius: 12px; font-weight: 800; display: flex; align-items: center; justify-content: center; gap: 0.5rem; box-shadow: 0 4px 15px rgba(239, 68, 68, 0.3);">
                <i data-lucide="zap" style="width: 18px;"></i> MASTER MISTAKES
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
                    <p style="font-size: 0.75rem; color: var(--text-secondary); font-weight: 700; margin-top: 0.25rem;">WEEKLY COMPETITION · GROUP OF 20</p>
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

        <!-- SCORE TREND CHART -->
        <div id="analytics-section" style="margin-top: 1.5rem;">
          <h2 style="font-family: 'Outfit'; font-size: 1.25rem; font-weight: 900; margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem;">
            <i data-lucide="line-chart" style="color: var(--primary); width: 24px;"></i> Performance Trend
            <button id="view-history-btn" class="btn-secondary" style="border-radius: 8px; font-size: 0.7rem; font-weight: 800; padding: 0.4rem 0.75rem;">VIEW FULL HISTORY</button>
          </h2>
          <div class="glass card scale-in" id="accuracy-trend-card" style="padding: 1rem; min-height: 260px; width: 100%; overflow: hidden; cursor: pointer; transition: transform 0.2s; border-bottom: 3px solid var(--accent-primary);" onmouseover="this.style.transform='translateY(-4px)'" onmouseout="this.style.transform='translateY(0)'">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                <h4 style="color: var(--accent-primary); font-size: 0.75rem; font-weight: 800; text-transform: uppercase; margin: 0;">Accuracy Trend</h4>
                <div style="display: flex; align-items: center; gap: 0.4rem; font-size: 0.65rem; color: var(--text-secondary); font-weight: 700;">
                    LAST 10 SESSIONS <i data-lucide="chevron-right" style="width: 12px;"></i>
                </div>
            </div>
            <div style="flex: 1; width: 100%; height: 170px;"><canvas id="score-history-chart"></canvas></div>
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

    let activeDiscount = 0;
    
    // Update Upgrade Modal Dynamic Prices
    const lifetimeDisplay = document.getElementById('lifetime-price-display');
    const monthlyDisplay = document.getElementById('monthly-price-display');
    const formatNaira = (n) => typeof n === 'number' ? '₦' + n.toLocaleString() : n;
    
    if (lifetimeDisplay) lifetimeDisplay.innerText = formatNaira(systemConfig.pricing_lifetime);
    if (monthlyDisplay) monthlyDisplay.innerText = formatNaira(systemConfig.pricing_monthly);

    const applyPromoBtn = document.getElementById('apply-promo-btn')
    if (applyPromoBtn) {
        applyPromoBtn.onclick = async () => {
            const code = document.getElementById('promo-code-input').value.trim()
            if (!code) return
            applyPromoBtn.disabled = true
            applyPromoBtn.textContent = "..."
            
            // Check promo code via RPC
            const { data, error } = await window.supabase.rpc('validate_promo_code', { p_code: code })
            const msgEl = document.getElementById('promo-msg')
            msgEl.style.display = 'block'
            
            if (error || !data || data.discount_percent === undefined) {
                 msgEl.style.color = 'var(--error)'
                 msgEl.textContent = "Invalid or expired promo code."
                 activeDiscount = 0
            } else {
                 msgEl.style.color = 'var(--success)'
                 msgEl.textContent = `Promo Applied: ${data.discount_percent}% off!`
                 activeDiscount = data.discount_percent

                 // Update UI pricing
                 const newLife = systemConfig.pricing_lifetime * (1 - (activeDiscount/100))
                 const newMonth = systemConfig.pricing_monthly * (1 - (activeDiscount/100))
                 if (lifetimeDisplay) lifetimeDisplay.innerHTML = `${formatNaira(newLife)} <span style="text-decoration: line-through; font-size:1rem; opacity:0.5;">${formatNaira(systemConfig.pricing_lifetime)}</span>`
                 if (monthlyDisplay) monthlyDisplay.innerHTML = `${formatNaira(newMonth)} <span style="text-decoration: line-through; font-size:1rem; opacity:0.5;">${formatNaira(systemConfig.pricing_monthly)}</span>`
            }
            applyPromoBtn.disabled = false
            applyPromoBtn.textContent = "Apply"
        }
    }

    const loadPaystackScript = () => {
        return new Promise((resolve, reject) => {
            if (window.PaystackPop) return resolve();
            const script = document.createElement('script');
            script.src = 'https://js.paystack.co/v1/inline.js';
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('Failed to load Paystack script'));
            document.head.appendChild(script);
        });
    };

    const triggerPayment = async (baseAmountPlan, planName) => {
        try {
            await loadPaystackScript();
            
            // Multiply by 100 since Paystack expects Kobo
            // Apply activeDiscount
            const finalAmountKobo = (baseAmountPlan * (1 - (activeDiscount / 100))) * 100

            const handler = window.PaystackPop.setup({
                key: import.meta.env.VITE_PAYSTACK_PUBLIC_KEY || 'pk_test_placeholder', 
                email: profile.email,
                amount: finalAmountKobo,
                currency: 'NGN',
                callback: async (response) => {
                    const isFirstTime = !profile.activation_status;
                    
                    // Show processing UI while the secure backend webhook does the actual database upgrade
                    ModalService.showToast("Verifying payment securely...", "info");
                    
                    setTimeout(async () => {
                        await ModalService.alert("Success!", \`Congratulations! Account \${isFirstTime ? 'Activated' : 'Renewed'}.\`, 'success');
                        location.reload();
                    }, 2500);
                },
                onClose: () => ModalService.showToast('Transaction cancelled.', 'info')
            })
            handler.openIframe()
        } catch (err) {
            console.error(err);
            await ModalService.alert("Connection Error", "Could not load payment processor. Please check your internet connection.", 'error');
        }
    }

    // Convert string prices to numbers if needed
    const priceLifetimeNum = parseInt(String(systemConfig.pricing_lifetime).replace(/[^0-9]/g, ''), 10) || 1500;
    const priceMonthlyNum = parseInt(String(systemConfig.pricing_monthly).replace(/[^0-9]/g, ''), 10) || 1000;

    if (payLifetime) payLifetime.onclick = () => triggerPayment(priceLifetimeNum, 'activation')
    if (payMonthly) payMonthly.onclick = () => triggerPayment(priceMonthlyNum, 'monthly')

    console.log("DASH_TRACE_2: Attaching quick action listeners")
    const DASH_quickPracticeGrid = document.getElementById('quick-practice-btn-grid')
    const DASH_quickExamGrid = document.getElementById('quick-exam-btn-grid')
    const DASH_quickPracticeBtn = document.getElementById('quick-practice-btn')
    const DASH_quickExamBtn = document.getElementById('quick-exam-btn')

    if (DASH_quickPracticeGrid) DASH_quickPracticeGrid.onclick = () => window.navigateTo('practice', profile)
    if (DASH_quickExamGrid) DASH_quickExamGrid.onclick = () => window.navigateTo('exams', profile)
    if (DASH_quickPracticeBtn) DASH_quickPracticeBtn.onclick = () => window.navigateTo('practice', profile)
    if (DASH_quickExamBtn) DASH_quickExamBtn.onclick = () => window.navigateTo('exams', profile)

    // Elite Store Listeners
    const openStoreBtns = [
        document.getElementById('open-store-btn'),
        document.getElementById('economy-coins-val')?.parentElement?.parentElement
    ];
    openStoreBtns.forEach(btn => {
        if (btn) {
            btn.style.cursor = 'pointer';
            btn.onclick = (e) => {
                e.stopPropagation();
                EliteStoreComponent.render(this.profile, (updatedProfile) => {
                    // Update coins in UI
                    const coinVal = document.getElementById('economy-coins-val');
                    if (coinVal) coinVal.innerText = updatedProfile.elite_coins;
                    const freezeVal = document.getElementById('economy-freeze-val');
                    if (freezeVal) freezeVal.innerText = updatedProfile.streak_freeze_count || 0;
                });
            };
        }
    });

    console.log("DASH_TRACE_3: Attaching leaderboard listeners")
    const openLeaderboard = document.getElementById('open-leaderboard-btn')
    const leaderboardModal = document.getElementById('leaderboard-modal')
    const closeLeaderboard = document.getElementById('close-leaderboard')

    // 🔧 Shared helper: show a modal overlay and always scroll it to the very top
    //    so users never see blank space above the content on small screens.
    const openModal = (el) => {
        if (!el) return;
        el.style.display = 'flex';
        // Reset scroll to top after the browser has painted the flex layout
        requestAnimationFrame(() => { 
            el.scrollTop = 0; 
            const content = el.querySelector('.modal-content');
            if (content) content.scrollTop = 0;
            // Also reset window and body scroll
            window.scrollTo(0, 0);
            if (document.body) document.body.scrollTop = 0;
        });
    }
    
    if (openLeaderboard && leaderboardModal) {
        openLeaderboard.onclick = () => {
            openModal(leaderboardModal)
            this.loadLeaderboard(profile)
        }
    }
    if (closeLeaderboard) closeLeaderboard.onclick = () => leaderboardModal.style.display = 'none'
    const closeLeaderboardTop = document.getElementById('close-leaderboard-top')
    if (closeLeaderboardTop) closeLeaderboardTop.onclick = () => leaderboardModal.style.display = 'none'

    // Elite Clan Hub Logic
    const openLeague = document.getElementById('open-league-btn')
    const leagueModal = document.getElementById('league-table-modal')
    const closeLeague = document.getElementById('close-league')
    const startClashBtn = document.getElementById('start-clash-btn')
    const viewLeagueBtn = document.getElementById('view-league-table')
    const changeClanBtn = document.getElementById('change-clan-btn')
    
    if (startClashBtn) {
        startClashBtn.onclick = (e) => {
            e.stopPropagation()
            this.handleClashStart()
        }
    }

    if (viewLeagueBtn) {
        viewLeagueBtn.onclick = (e) => {
            e.stopPropagation()
            const leagueModalEl = document.getElementById('league-table-modal');
            openModal(leagueModalEl)
            this.loadLeagueModalTable(profile)
        }
    }

    if (changeClanBtn) {
        changeClanBtn.onclick = (e) => {
            e.stopPropagation()
            const departments = ['Science', 'Arts', 'Commercial', 'General']
            const currentDept = profile?.department || 'General'
            
            // Create a custom Elite Picker Modal
            const pickerOverlay = document.createElement('div')
            pickerOverlay.id = 'dept-picker-overlay'
            pickerOverlay.style = "position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.85); z-index:999999; display:flex; justify-content:center; align-items:center; backdrop-filter:blur(8px);"
            
            pickerOverlay.innerHTML = `
                <div class="glass card scale-in" style="width:90%; max-width:400px; padding:2rem; border-radius:24px; border: 2px solid var(--accent-primary); text-align:center;">
                    <h3 style="font-family:'Outfit'; font-weight:900; margin-bottom:0.5rem; font-size:1.4rem;">Select Department</h3>
                    <p style="color:var(--text-secondary); font-size:0.8rem; margin-bottom:1.5rem;">Choose your academic path to join the right Clan.</p>
                    <div style="display:grid; gap:0.75rem;">
                        ${departments.map(d => `
                            <button class="dept-opt-btn glass-btn" data-dept="${d}" style="width:100%; padding:1rem; border-radius:12px; font-weight:800; border:1px solid ${d === currentDept ? 'var(--accent-primary)' : 'var(--glass-border)'}; background: ${d === currentDept ? 'rgba(37, 99, 235, 0.1)' : 'transparent'}; color: ${d === currentDept ? 'var(--accent-primary)' : 'var(--text-primary)'};">
                                ${d.toUpperCase()} ${d === currentDept ? ' (CURRENT)' : ''}
                            </button>
                        `).join('')}
                    </div>
                    <button id="close-dept-picker" class="btn-secondary" style="margin-top:1.5rem; width:100%; height:48px; font-weight:800; border-radius:12px;">CANCEL</button>
                </div>
            `
            document.body.appendChild(pickerOverlay)
            
            document.getElementById('close-dept-picker').onclick = () => pickerOverlay.remove()
            
            pickerOverlay.querySelectorAll('.dept-opt-btn').forEach(btn => {
                btn.onclick = () => {
                    const selected = btn.dataset.dept
                    if (selected === currentDept) {
                        pickerOverlay.remove()
                        return
                    }
                    
                    btn.textContent = 'UPDATING...'
                    AuthService.updateProfile({ ...profile, department: selected }).then(({ error }) => {
                        if (error) {
                            btn.textContent = selected.toUpperCase()
                            ModalService.alert("Update Failed", error.message, 'error');
                            return;
                        }
                        pickerOverlay.remove()
                        location.reload()
                    }).catch(err => {
                        btn.textContent = selected.toUpperCase()
                        ModalService.alert("Update Failed", err.message, 'error');
                    })
                }
            })
        }
    }
    
    if (openLeague && leagueModal) {
        openLeague.onclick = () => {
            openModal(leagueModal)
            this.loadLeagueModalTable(profile)
        }
    }
    const viewClashResultsBtn = document.getElementById('view-clash-results-btn')
    if (viewClashResultsBtn) {
        viewClashResultsBtn.onclick = (e) => {
            e.stopPropagation()
            openModal(leagueModal)
            this.loadClashLeaderboard()
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
        this.renderCharts(this.profile.id, analytics)
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
                ModalService.alert("Purchase Failed", error, 'error')
                buyFreezeBtn.disabled = false
                buyFreezeBtn.textContent = 'PURCHASE'
            } else {
                await ModalService.alert("Streak Protected", "Streak Freeze Activated! Your progress is now protected.", 'success')
                location.reload()
            }
        }
    }

    const storeModal = document.getElementById('elite-store-modal')
    const openStore = document.getElementById('open-store-btn')
    const closeStore = document.getElementById('close-store')
    const closeStoreTop = document.getElementById('close-store-top')
    if (openStore && storeModal) {
        openStore.onclick = () => openModal(storeModal)
    }
    if (closeStore) closeStore.onclick = () => storeModal.style.display = 'none'
    if (closeStoreTop) closeStoreTop.onclick = () => storeModal.style.display = 'none'

    // AI Summary removed as per feedback

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
                    this.onStartExam(questions, 'practice', 'Mistake Mastery', 'Focused Improvement')
                } else {
                    ModalService.showToast("Mistakes resolved! Try some new questions.", 'success')
                    this.render(profile)
                }
            } catch (err) {
                console.error("Repair session failed:", err)
                ModalService.alert("Operation Failed", "Failed to load mistakes. Please try again.", 'error')
            } finally {
                repairBtn.disabled = false
                repairBtn.innerHTML = '<i data-lucide="zap" style="width: 18px;"></i> MASTER MISTAKES'
            }
        }
    }

    await initData()
    renderLucide()
    
    // 🚀 ELITE ANIMATIONS: Trigger smooth counter roll-ups
    setTimeout(() => {
        AnimationUtils.animateValue(document.getElementById('economy-coins-val'), 0, this.profile.elite_coins || 0, 1500);
        AnimationUtils.animateValue(document.getElementById('economy-freeze-val'), 0, this.profile.streak_freeze_count || 0, 1500);
        AnimationUtils.animateValue(document.getElementById('streak-count-val'), 0, this.profile.streak_count || 0, 1500);
        AnimationUtils.animateValue(document.getElementById('daily-solved-val'), 0, currentDailyCount || 0, 1500);
    }, 100);

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
                ModalService.alert("Analytics Gap", "Need more data! Try some regular practices first.", 'info')
                aiWorkoutBtn.disabled = false
                aiWorkoutBtn.innerHTML = 'AI Workout'
            }
        }
    }

    // Attach Click Handler to Trend Card
    const trendCard = document.getElementById('accuracy-trend-card')
    const viewHistoryBtn = document.getElementById('view-history-btn')
    const openHistory = () => {
        import('./SessionsHistory').then(({ SessionsHistoryComponent }) => {
            SessionsHistoryComponent.render(profile, () => {
                // Refresh dashboard to show the updated state if user returned
                this.render(profile, onStartExam, onOpenAdmin, onReadNews)
            })
        })
    }
    if (trendCard) trendCard.onclick = openHistory
    if (viewHistoryBtn) viewHistoryBtn.onclick = openHistory

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

  async renderCharts(userId, providedAnalytics = null) {
    const { history, mastery, error } = providedAnalytics || await DataService.getUserAnalytics(userId)
    const historyCtx = document.getElementById('score-history-chart')?.getContext('2d')
    if (historyCtx) {
        // Limit to last 10 sessions for the dashboard chart as per requirement
        const displayHistory = (history || []).slice(0, 10).reverse();

        // Hide chart if no history
        if (displayHistory.length === 0) {
            console.warn("Dashboard: Empty history for chart")
            if (historyCtx.canvas) {
                const parent = historyCtx.canvas.parentElement;
                if (parent) parent.innerHTML = `
                  <div style="height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; color: var(--text-secondary); text-align: center; padding: 1rem;">
                    <i data-lucide="line-chart" style="width: 32px; height: 32px; opacity: 0.3; margin-bottom: 0.5rem;"></i>
                    <p style="font-size: 0.8rem; font-weight: 500;">No history data yet.<br>Complete a session to see your trend!</p>
                  </div>
                `;
            }
            if (window.lucide) window.lucide.createIcons();
            return;
        }

        if (this._historyChart) this._historyChart.destroy()
        
        // Define Gradient
        const gradient = historyCtx.createLinearGradient(0, 0, 0, 200)
        gradient.addColorStop(0, 'rgba(37, 99, 235, 0.25)')
        gradient.addColorStop(1, 'rgba(37, 99, 235, 0)')

        const isDarkMode = document.body.classList.contains('dark-mode');
        const textColor = isDarkMode ? '#f8fafc' : '#0369A1';
        const gridColor = isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)';

        this._historyChart = new Chart(historyCtx, {
            type: 'line',
            data: {
                labels: displayHistory.map((h, i) => {
                    const date = h.created_at ? new Date(h.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' }) : `S-${i+1}`
                    return date
                }),
                datasets: [{
                    label: 'Session Accuracy',
                    data: displayHistory.map(h => h.score_percentage),
                    borderColor: isDarkMode ? '#38bdf8' : '#2563EB',
                    backgroundColor: gradient,
                    fill: true,
                    tension: 0.45,
                    pointRadius: 4,
                    pointBackgroundColor: isDarkMode ? '#38bdf8' : '#2563EB',
                    borderWidth: 3
                }]
            },
            options: { 
                responsive: true, 
                maintainAspectRatio: false, 
                plugins: {
                    legend: { display: false }
                },
                scales: { 
                    y: { 
                        beginAtZero: true, 
                        max: 100,
                        grid: { color: gridColor },
                        ticks: { color: textColor, font: { family: 'Outfit', size: 11, weight: 'bold' } }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { color: textColor, font: { family: 'Outfit', size: 11, weight: 'bold' } }
                    }
                } 
            }
        })
    }

    // Subject Mastery logic removed as per feedback

    const gaugePath = document.getElementById('readiness-progress-path')
    const gaugeText = document.getElementById('readiness-percentage')
    const gaugeSub = document.getElementById('readiness-subject')
    const gaugeStatus = document.getElementById('readiness-status')

    if (gaugePath && mastery.length > 0) {
        const topSub = mastery.reduce((prev, curr) => (prev.total_attempted > curr.total_attempted) ? prev : curr)
        if (gaugeSub) gaugeSub.textContent = topSub.subject
        const { data: score } = await DataService.getReadinessScore(userId, topSub.subject)
        
        // Update Gauge
        gaugePath.style.strokeDasharray = `${score || 0}, 100`
        if (gaugeText) gaugeText.textContent = `${score || 0}%`

        // 🚀 DYNAMIC ELITE LEVEL: Map readiness score to premium labels
        if (gaugeStatus) {
            let statusText = "Novice";
            let statusColor = "var(--text-secondary)";
            
            if (score >= 75) {
                statusText = "Elite Level";
                statusColor = "var(--success)";
            } else if (score >= 60) {
                statusText = "Expert";
                statusColor = "var(--primary)";
            } else if (score >= 40) {
                statusText = "Competent";
                statusColor = "var(--warning)";
            }
            
            gaugeStatus.textContent = statusText;
            gaugeStatus.style.color = statusColor;
        }
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
                        ${userMilestone ? `<i data-lucide="${userMilestone.icon}" title="${userMilestone.title}" style="width: 14px; height: 14px; color: ${userMilestone.color};"></i>` : ''}
                        ${isUser ? '<span style="font-size:0.6rem; opacity:0.6;">(YOU)</span>' : ''}
                    </div>
                  </td>
                  <td style="padding:1rem; text-align:right; color: var(--success); font-weight:900;">${entry.total_questions_answered.toLocaleString()}</td>
                </tr>
              `
            }).join('')}
          </tbody>
        </table>
        <p style="font-size: 0.7rem; color: var(--text-secondary); text-align: center; margin-top: 1.5rem; font-weight: 600;">Rankings are aggregated all-time.</p>
      </div>
    `
    if (window.lucide) {
      window.lucide.createIcons()
    }
  },

  hide() {
    document.getElementById('dashboard-container').style.display = 'none'
  },

  triggerCelebration(milestone) {
    const modal = document.getElementById('celebration-modal');
    if (!modal) return;

    const nameEl = document.getElementById('celebration-name');
    const starsEl = document.getElementById('celebration-stars');
    const textEl = document.getElementById('celebration-text');
    const icon = document.getElementById('celebration-icon');
    const closeBtn = document.getElementById('close-celebration-btn');

    if (nameEl) { nameEl.textContent = milestone.title; nameEl.style.color = milestone.color; }
    if (starsEl) starsEl.textContent = `${milestone.starCount}★`;
    if (textEl) textEl.textContent = `Incredible! You've solved ${milestone.target} questions today. You are officially a Daily ${milestone.title}!`;
    if (icon) { icon.setAttribute('data-lucide', milestone.badge); icon.style.color = milestone.color; }

    // Use shared openModal helper
    const openModal = typeof this.openModal === 'function' ? this.openModal : (el) => {
        if (!el) return;
        el.style.display = 'flex';
        requestAnimationFrame(() => { 
            el.scrollTop = 0; 
            const content = el.querySelector('.modal-content');
            if (content) content.scrollTop = 0;
            window.scrollTo(0, 0);
            if (document.body) document.body.scrollTop = 0;
        });
    };
    openModal(modal);
    
    if (window.lucide) window.lucide.createIcons({ root: modal });

    // ── CELEBRATION 2.0: Escalating FX per milestone tier ──────────────────
    if (typeof confetti === 'function') {
        if (milestone.id === 'enthusiast') {
            // Tier 1: Single premium burst (50 questions)
            confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 }, colors: [milestone.color, '#ffffff', '#BAE6FD'] });

        } else if (milestone.id === 'master') {
            // Tier 2: Side cannons + centre burst (100 questions)
            const fire = (opts) => confetti({ ...opts, colors: [milestone.color, '#ffffff', '#ffd700', '#BAE6FD'] });
            // Centre burst
            fire({ particleCount: 120, spread: 90, origin: { x: 0.5, y: 0.6 } });
            // Left cannon
            setTimeout(() => fire({ particleCount: 80, angle: 60, spread: 55, origin: { x: 0, y: 0.6 } }), 300);
            // Right cannon
            setTimeout(() => fire({ particleCount: 80, angle: 120, spread: 55, origin: { x: 1, y: 0.6 } }), 300);
            // Second wave
            setTimeout(() => fire({ particleCount: 80, spread: 80, origin: { x: 0.5, y: 0.5 } }), 700);

        } else if (milestone.id === 'legend') {
            // Tier 3: Full fireworks (150 questions)
            const colors = [milestone.color, '#ffd700', '#ff6b6b', '#ffffff', '#BAE6FD'];
            const fire = (opts) => confetti({ ...opts, colors });
            // Carpet bomb sequence
            const origins = [
                { x: 0.2, y: 0.7 }, { x: 0.5, y: 0.6 }, { x: 0.8, y: 0.7 },
                { x: 0.35, y: 0.5 }, { x: 0.65, y: 0.5 },
            ];
            origins.forEach((origin, i) => {
                setTimeout(() => fire({ particleCount: 100, spread: 100, origin }), i * 200);
            });
            // Final mega burst
            setTimeout(() => fire({ particleCount: 200, spread: 120, origin: { x: 0.5, y: 0.5 }, startVelocity: 45 }), 1200);
        }

        // ── Screen flash pulse ────────────────────────────────────────────────
        const flashEl = document.createElement('div');
        flashEl.style.cssText = `position:fixed;top:0;left:0;right:0;bottom:0;z-index:9999998;pointer-events:none;background:${milestone.color};opacity:0;transition:opacity 0.15s ease;`;
        document.body.appendChild(flashEl);
        requestAnimationFrame(() => {
            flashEl.style.opacity = '0.15';
            setTimeout(() => { flashEl.style.opacity = '0'; setTimeout(() => flashEl.remove(), 200); }, 150);
        });

        // ── Goal card glow pulse ──────────────────────────────────────────────
        const goalCard = document.querySelector('[style*="Star Target"]')?.closest('.glass.card');
        if (goalCard) {
            goalCard.style.transition = 'box-shadow 0.3s ease';
            goalCard.style.boxShadow = `0 0 30px ${milestone.color}60, 0 0 60px ${milestone.color}30`;
            setTimeout(() => { goalCard.style.boxShadow = ''; }, 2500);
        }

        // 🔊 CHIME!
        AnimationUtils.playLevelUpSound();
    }

    if (closeBtn) {
      closeBtn.onclick = () => {
          modal.style.display = 'none';
          this.checkForCelebration();
      };
    }
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
    let now;
    try {
        now = (typeof DataService.getWATDate === 'function') ? DataService.getWATDate() : new Date();
    } catch (e) {
        now = new Date();
    }
    const day = now.getDay();
    const hour = now.getHours();
    
    // Target next competition:
    // If it's Saturday before 7pm, target Saturday 7pm
    // If it's Saturday after 7pm but before Sunday 7pm, target Sunday 7pm
    // Otherwise, target next Saturday 7pm
    
    let target = new Date(now);
    if (day === 6 && hour < 19) {
        target.setHours(19, 0, 0, 0);
    } else if (day === 0 && hour < 19) {
        target.setHours(19, 0, 0, 0);
    } else {
        // Target next competition day
        const daysToSat = (6 - day + 7) % 7 || 7;
        target.setDate(now.getDate() + daysToSat);
        target.setHours(19, 0, 0, 0);
    }
    
    const diff = target - now;
    if (diff <= 0) {
        const timerEl = document.getElementById('league-timer');
        if (timerEl) timerEl.textContent = `LIVE NOW!`;
        return;
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const mins = Math.floor((diff / (1000 * 60)) % 60);
    
    const timerEl = document.getElementById('league-timer')
    if (timerEl) {
        if (days > 0) timerEl.textContent = `${days}d ${hours}h left`;
        else timerEl.textContent = `${hours}h ${mins}m left`;
    }
    
    const progressEl = document.getElementById('league-week-progress')
    if (progressEl) {
        // Monday = 1, Sunday = 7.
        const currentDayOfWeek = now.getDay() || 7
        const weekProgress = ((currentDayOfWeek - 1) * 24 + now.getHours() + (now.getMinutes()/60)) / (7 * 24) * 100
        progressEl.style.width = `${Math.min(100, Math.max(0, weekProgress))}%`
    }
  },

  async loadClashLeaderboard() {
    const list = document.getElementById('league-modal-list')
    if (!list) return
    list.innerHTML = '<div style="text-align:center;padding:3rem;"><div class="loader-spinner"></div></div>'
    
    document.getElementById('league-modal-title').textContent = `Clan Clash Results`
    const icon = document.getElementById('league-modal-icon')
    if (icon) icon.setAttribute('data-lucide', 'trophy')
    
    try {
        const { clashId } = await DataService.getWeeklyClash(this.profile.id)
        if (!clashId) throw new Error("No recent clash found");
        
        const { data } = await DataService.getClashLeaderboard(clashId)
        if (!data || data.length === 0) {
            list.innerHTML = '<div style="text-align:center;padding:2rem;">No results recorded for this clash yet.</div>'
            return
        }

        list.innerHTML = data.map((entry, i) => {
            const isUser = entry.is_me
            const isTop3 = entry.rank <= 3
            
            return `
                <div style="display: flex; align-items: center; gap: 1rem; padding: 1rem 1.5rem; border-bottom: 1px solid rgba(255,255,255,0.03); ${isUser ? 'background: rgba(16, 185, 129, 0.08);' : ''}">
                    <div style="width: 24px; font-weight: 900; color: ${isTop3 ? '#ffd700' : 'var(--text-secondary)'}; font-size: 0.9rem;">${entry.rank}</div>
                    <div style="flex: 1; display: flex; align-items: center; gap: 0.75rem;">
                        <div style="width: 32px; height: 32px; background: rgba(255,255,255,0.05); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; font-weight: 800; color: var(--text-secondary); border: 1px solid var(--glass-border);">
                            ${entry.username ? entry.username.substring(0,1).toUpperCase() : '?'}
                        </div>
                        <div>
                            <div style="font-weight: 800; color: ${isUser ? 'var(--success)' : 'var(--text-primary)'}; font-size: 0.9rem;">
                                ${entry.username || 'Student'} ${isUser ? '<span style="font-size: 0.65rem; opacity: 0.6; margin-left: 4px;">(YOU)</span>' : ''}
                            </div>
                            <div style="font-size: 0.65rem; color: var(--text-secondary); font-weight: 700;">${Math.floor(entry.time_taken / 60)}m ${entry.time_taken % 60}s taken</div>
                        </div>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-family: 'Outfit'; font-weight: 900; color: var(--text-primary); font-size: 1rem;">${entry.score}</div>
                        <div style="font-size: 0.6rem; color: var(--text-secondary); font-weight: 800; text-transform: uppercase;">SCORE</div>
                    </div>
                </div>
            `
        }).join('')
    } catch (err) {
        list.innerHTML = `<div style="text-align:center;padding:2rem;color:var(--error);">${err.message}</div>`
    }
    if (window.lucide) window.lucide.createIcons({ root: document.getElementById('league-modal-header') })
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

  async handleClashStart() {
    try {
        const { data, duration, clashId, error } = await DataService.getWeeklyClash(this.profile.id)
        if (error || !data || data.length === 0) {
            ModalService.alert("Elite Clash", error || "Wait for it! The Elite Clash questions are still being finalized. Check back in a few moments.", 'info');
            return
        }

        const confirmClash = await ModalService.confirm(
            "🚀 Elite Clash Ready!",
            `<div style="text-align:center;">
                <div style="display:grid; gap:0.5rem; background:rgba(255,255,255,0.04); border-radius:12px; padding:1rem; margin:0.75rem 0; border:1px solid rgba(255,255,255,0.08);">
                    <div style="display:flex; justify-content:space-between; font-size:0.9rem;"><span style="color:var(--text-secondary); font-weight:700;">FORMAT</span><span style="font-weight:900;">${data.length} Questions</span></div>
                    <div style="display:flex; justify-content:space-between; font-size:0.9rem;"><span style="color:var(--text-secondary); font-weight:700;">TIME LIMIT</span><span style="font-weight:900;">${duration} Minutes</span></div>
                </div>
                <p style="font-size:0.85rem; color:var(--text-secondary); margin:0;">Your performance decides your rank for the week. Ready to dominate?</p>
            </div>`,
            "LET'S GO! 🔥",
            "Not Yet"
        )

        if (confirmClash) {
            this.onStartExam(data, 'clash', 'Elite Clash', 'Weekly Competition', {
                durationMinutes: duration,
                clashId: clashId
            })
        }
    } catch (err) {
        console.error("Clash Start Failed:", err)
        ModalService.alert("System Error", "System error. Please refresh and try again.", 'error');
    }
  },

  _isPromotion(oldTier, newTier) {
    const tiers = ['Bronze', 'Silver', 'Gold', 'Diamond', 'Elite']
    return tiers.indexOf(newTier) > tiers.indexOf(oldTier)
  },

  showTierChangeModal(oldTier, newTier, isPromotion) {
    const title = isPromotion ? 'PROMOTED! 🎉' : 'DEMOTED 📉'
    const tierName = newTier || 'Bronze'
    const text = isPromotion 
        ? `Incredible work! You've climbed from ${oldTier} to the ${tierName} League.`
        : `Tough week! You've dropped to the ${tierName} League. Time to fight back!`

    const tierColors = {
        'Bronze': '#cd7f32', 'Silver': '#c0c0c0', 'Gold': '#ffd700',
        'Diamond': '#00f2ff', 'Elite': '#8b5cf6'
    }
    const tierColor = tierColors[tierName] || 'var(--accent-primary)'
    
    // Reuse the celebration modal structure
    const modal = document.getElementById('celebration-modal')
    if (!modal) return
    
    const titleEl = document.getElementById('celebration-title')
    const nameEl = document.getElementById('celebration-name')
    const textEl = document.getElementById('celebration-text')
    const closeBtn = document.getElementById('close-celebration-btn')

    if (titleEl) titleEl.textContent = title
    if (nameEl) { nameEl.textContent = `${tierName} League`; nameEl.style.color = tierColor; }
    if (textEl) textEl.textContent = text
    
    // Update modal border color to match tier
    const modalCard = modal.querySelector('.glass.card') || modal.querySelector('[style]')
    if (modalCard) modalCard.style.borderColor = isPromotion ? tierColor : 'var(--error)'
    
    if (closeBtn) {
        closeBtn.onclick = () => {
            modal.style.display = 'none'
        }
    }
    
    const icon = document.getElementById('celebration-icon')
    if (icon) {
        icon.setAttribute('data-lucide', isPromotion ? 'trending-up' : 'trending-down')
        icon.style.color = isPromotion ? tierColor : 'var(--error)'
    }
    
    // Use shared openModal helper
    const openModal = typeof this.openModal === 'function' ? this.openModal : (el) => {
        if (!el) return;
        el.style.display = 'flex';
        requestAnimationFrame(() => { 
            el.scrollTop = 0; 
            const content = el.querySelector('.modal-content');
            if (content) content.scrollTop = 0;
            window.scrollTo(0, 0);
            if (document.body) document.body.scrollTop = 0;
        });
    };
    openModal(modal);
    
    if (window.lucide) window.lucide.createIcons({ root: modal })

    // ── CELEBRATION 2.0: Promotion confetti ───────────────────────────────────
    if (isPromotion && typeof confetti === 'function') {
        const fire = (opts) => confetti({ ...opts, colors: [tierColor, '#ffffff', '#ffd700', '#BAE6FD'] })
        // Dual side cannons
        fire({ particleCount: 80, angle: 60, spread: 60, origin: { x: 0, y: 0.7 } })
        fire({ particleCount: 80, angle: 120, spread: 60, origin: { x: 1, y: 0.7 } })
        // Centre burst after 300ms
        setTimeout(() => fire({ particleCount: 120, spread: 90, origin: { x: 0.5, y: 0.6 } }), 300)
        // Screen flash in tier color
        const flashEl = document.createElement('div')
        flashEl.style.cssText = `position:fixed;top:0;left:0;right:0;bottom:0;z-index:9999998;pointer-events:none;background:${tierColor};opacity:0;transition:opacity 0.15s ease;`
        document.body.appendChild(flashEl)
        requestAnimationFrame(() => {
            flashEl.style.opacity = '0.12'
            setTimeout(() => { flashEl.style.opacity = '0'; setTimeout(() => flashEl.remove(), 200) }, 150)
        })
        AnimationUtils.playLevelUpSound()
    }
  }
}
