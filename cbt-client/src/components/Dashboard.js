import { DataService } from '../services/data'
import { supabase } from '../utils/supabase'
import { AuthService } from '../services/auth'
import { WeeklyRecapComponent } from './WeeklyRecap'
import { EliteStoreComponent } from './EliteStore'
import { SessionsHistoryComponent } from './SessionsHistory'
import { TourGuide } from '../utils/TourGuide'
import { MasteryEngine } from '../utils/masteryEngine'
import { SubscriptionService } from '../services/subscriptionService'
import { SubscriptionManager } from '../utils/subscriptionManager'
import { ExamCard } from './ExamCard'
import { AnimationUtils } from '../utils/animations'
import { ModalService } from '../services/ModalService'
import Chart from 'chart.js/auto'

export const DashboardComponent = {
  profile: null,
  onStartExam: null,
  activeTab: 'home',
  state: {}, // Holds all calculated UI data
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
      <div class="dashboard-scroll-area" style="padding-top: calc(var(--header-height) + 1.25rem); padding-bottom: 140px;">
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
    
    // 🔥 FIX: Reset scroll position to top immediately
    window.scrollTo(0, 0);
    const mainContentArea = document.querySelector('.main-content-area');
    if (mainContentArea) mainContentArea.scrollTop = 0;

    // Handle Tier Transitions & Daily Resets
    const updatedUser = profile ? await SubscriptionService.handleTierTransition(profile) : null
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

    let analytics = { history: [], mastery: [] }
    let weakSubject = null
    
    console.log("Dashboard: Rendering for profile ID:", this.profile.id)
    
    try {
        analytics = await DataService.getUserAnalytics(this.profile.id) || { history: [], mastery: [] }
        console.log("Dashboard: Fetched analytics data:", analytics)
        history = analytics.history || []
        mastery = analytics.mastery || []
        
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
        
        // Fetch Flashcards due
        const { count: flashcardsDue } = await supabase
            .from('flashcards')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', this.profile.id)
            .eq('status', 'active')
            .lte('next_review_at', new Date().toISOString());
        this.flashcardsDueCount = flashcardsDue || 0;

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
        const isSystemFree = systemConfig.explanations_free_access // For legacy checks
        // Sync League Status & Check for Tier Changes
        const lastTier = localStorage.getItem('elite_last_league_tier')
        if (this.profile.id === 'anon') {
            console.warn("Dashboard: Skipping league sync for anonymous session");
            this.leagueData = { tier: 'Bronze' };
            if (this.profile) this.profile.league_tier = 'Bronze';
        } else {
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
        }
        console.log("Dashboard: League synced", this.leagueData)
    } catch (err) {
        console.error("Dashboard data fetch failed:", err)
    }

    // Initialize Tour Guide
    TourGuide.init([
      { 
        title: "Welcome to CBT Elite", 
        text: "The ultimate AI-powered preparation for JAMB, WAEC, and NECO. We combine smart practice, competitive leagues, and deep analytics to help you excel."
      },
      { 
        element: "#quick-practice-btn", 
        title: "Smart Practice", 
        text: "Start here to build your foundation. Our AI Tutor is ready to explain difficult concepts step-by-step.",
        onBefore: () => this.setActiveTab('home')
      },
      { 
        element: "#quick-exam-btn", 
        title: "Standard Mock Exams", 
        text: "Simulate real exam conditions with full-length JAMB, WAEC, and NECO mock trials.",
        onBefore: () => this.setActiveTab('home')
      },
      { 
        element: "#open-store-btn", 
        title: "Elite Economy", 
        text: "Earn coins by hitting daily targets. Spend them in the Store to buy Streak Freezes and Power-ups!",
        onBefore: () => this.setActiveTab('home')
      },
      { 
        element: ".streak-flame-container", 
        title: "Consistency is Key", 
        text: "Build your streak by solving 50+ questions daily to unlock exclusive badges and bonuses.",
        onBefore: () => this.setActiveTab('home')
      },
      { 
        element: "#analytics-section", 
        title: "Deep Insights", 
        text: "Track your progress and identify weak spots. You can find this in the Progress tab at the bottom.",
        onBefore: () => this.setActiveTab('progress')
      },
      { 
        element: "#open-league-btn", 
        title: "Competitive Leagues", 
        text: "Join a clan and compete for the top spot. Find the League Hub in the Compete tab at the bottom.",
        onBefore: () => this.setActiveTab('compete')
      },
      { 
        element: "#mastery-center-section",
        title: "The Mastery Center", 
        text: "Revisit and master every mistake you've ever made. Located at the bottom of your Progress tab.",
        onBefore: () => this.setActiveTab('progress')
      },
      { 
        title: "Elite Potential Unlocked", 
        text: "You're now equipped with the ultimate tools. Reach for your dreams—your journey starts now!",
        onBefore: () => this.setActiveTab('home')
      }
    ], {
      onFinish: () => {
        this.setActiveTab('home');
        DataService.markTourAsSeen(this.profile.id);
        sessionStorage.removeItem('isFreshSignup');
      }
    });
    
    console.log("DASH_TRACE_1: Starting XP calculation")
    // Calculate Progress and Daily Goal
    const watNow = DataService.getWATDate()
    const today = watNow.toDateString() // "Wed Apr 22 2026" in WAT
    const day = watNow.getDay();
    const hour = watNow.getHours();
    const min = watNow.getMinutes();
    let v2_todayQuestions = 0
    let v2_todayCorrect = 0
    let v2_totalQuestions = 0
    let v2_totalCorrect = 0
    let v2_overallTime = 0
    
    console.log("DASH_TRACE_2: Iterating history. Length:", history.length)
    try {
        if (history && history.length > 0) {
            history.forEach((s, idx) => {
                    if (!s.created_at) return;
                    const sUTC = new Date(s.created_at)
                    if (isNaN(sUTC.getTime())) return;
                    
                    // Convert session UTC time to WAT for comparison
                    const sDate = new Date(sUTC.toLocaleString("en-US", {timeZone: "Africa/Lagos"}))
                    const sessionCount = s.answered_questions ?? s.total_questions ?? 0
                    if (sDate.toDateString() === today) {
                        v2_todayQuestions += sessionCount
                        v2_todayCorrect += (s.correct_answers || 0)
                    }
                    v2_totalQuestions += sessionCount
                    v2_totalCorrect += (s.correct_answers || 0)
                    v2_overallTime += (s.time_taken || s.time_taken_seconds || 0)
            })
        }
    } catch (e) {
        console.error("Dashboard: Error calculating XP history", e)
    }

    console.log("DASH_TRACE_3: Calculation done. Today:", v2_todayQuestions)

    // 🚀 FIX: Fallback to aggregated stats if history total is 0 (prevents "0m" bug)
    const finalOverallTime = Math.max(v2_overallTime, (analytics.stats?.overall?.time || 0));

    const accuracy = v2_totalQuestions > 0 ? Math.round((v2_totalCorrect / v2_totalQuestions) * 100) : 0
    const studyTimeHours = (finalOverallTime / 3600).toFixed(1)
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
    if (accuracy >= 80 && history.length >= 5) badges.push({ emoji: '<i data-lucide="target" style="width: 16px; height: 16px; color: var(--primary);"></i>', title: 'Sharpshooter' });
    if (this.profile.activation_status) badges.push({ emoji: '<i data-lucide="gem" style="width: 16px; height: 16px; color: var(--accent-primary);"></i>', title: 'Activated' });


    const badgesHTML = badges.length > 0 ? `
      <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--glass-border);">
        ${badges.map(b => `<span class="badge glass" title="${b.title}" style="display: flex; align-items: center; gap: 0.35rem; padding: 0.35rem 0.6rem; font-size: 0.65rem; border: 1px solid var(--glass-border); background: rgba(255,255,255,0.03);">${b.emoji} ${b.title}</span>`).join('')}
      </div>
    ` : '';

    // SAT/SUN 7:00 PM - 7:30 PM is Clash Time
    const isClashWindow = (day === 6 || day === 0) && hour === 19 && min < 30;
    // After 7:30 PM is Results Time
    const isResultsWindow = (day === 6 || day === 0) && (hour > 19 || (hour === 19 && min >= 30));

    const LEAGUE_STYLES = {
        'Bronze': { color: '#cd7f32', icon: 'shield' },
        'Silver': { color: '#c0c0c0', icon: 'shield-check' },
        'Gold': { color: '#f59e0b', icon: 'award' },
        'Diamond': { color: '#38bdf8', icon: 'gem' },
        'Elite': { color: '#8b5cf6', icon: 'crown' }
    };
    const style = LEAGUE_STYLES[this.profile.league_tier] || LEAGUE_STYLES['Bronze'];

    // Populate State for rendering
    this.state = {
        profile: this.profile,
        systemConfig,
        currentDailyCount,
        totalSolved: Math.max(v2_totalQuestions, this.profile?.total_questions_answered || 0),
        currentMilestone,
        nextMilestone,
        accuracy,
        studyTimeHours,
        examsCompleted,
        badgesHTML,
        isClashWindow,
        isResultsWindow,
        day,
        hour,
        min,
        style,
        history,
        mastery,
        weakSubject,
        weakTopics: MasteryEngine.getWeakTopics(mastery),
        strongestSubject: MasteryEngine.getStrongestSubject(this.state?.subjectMastery || []),
        dailyMission: MasteryEngine.generateDailyMission(MasteryEngine.getWeakTopics(mastery), this.unresolvedMistakeIds)
    };

    this.updateUI();
  },

  updateUI() {
    const container = document.getElementById('dashboard-container');
    if (!container) return;
    
    // 🚀 UNIFIED DASHBOARD: We always use the tabbed structure to keep content organized
    // Desktop users now use the sidebar for tabs, mobile users use the bottom nav.
    container.innerHTML = `
      <div id="dashboard-content" class="dashboard-tab-container">
        <div id="tab-content-area" class="tab-content-scroll">
            <!-- Tab content injected here -->
        </div>
      </div>
    `;
    this.renderCurrentTab();
  },

  setActiveTab(tab) {
    if (this.activeTab === tab) return;
    this.activeTab = tab;
    this.renderCurrentTab();
    
    // Sync All Navigation Items (Sidebar and Bottom Nav)
    document.querySelectorAll('.nav-item, .bottom-nav-item').forEach(item => {
        if (item.dataset.view === 'dashboard') {
          const isMatch = item.dataset.tab === tab;
          item.classList.toggle('active', isMatch);
        } else {
          // Non-dashboard items should not be active when we are on a dashboard tab
          item.classList.remove('active');
        }
    });
  },

  renderCurrentTab() {
    const contentArea = document.getElementById('tab-content-area');
    if (!contentArea) return;
    
    contentArea.innerHTML = this.renderActiveTabContent();
    contentArea.scrollTop = 0;
    
    if (window.lucide) window.lucide.createIcons({ root: contentArea });
    
    this.attachListeners(this.activeTab);
    
    if (this.activeTab === 'progress') {
        const analytics = { history: this.state.history, mastery: this.state.mastery };
        this.renderCharts(this.profile.id, analytics);
    }
    
    if (this.activeTab === 'compete' || this.activeTab === 'home') {
        this.updateLeagueTimer();
        if (this.activeTab === 'compete') this.updateLeagueMiniRank(this.profile.id);
    }
  },

  renderActiveTabContent() {
    switch(this.activeTab) {
        case 'home': return this.renderHomeTab();
        case 'progress': return this.renderProgressTab();
        case 'compete': return this.renderCompeteTab();
        case 'improve': return this.renderImproveTab();
        case 'archive': return this.renderArchiveTab();
        default: return this.renderHomeTab();
    }
  },

  renderHomeTab() {
    const { profile, systemConfig } = this.state;
    return `
        <!-- DASHBOARD HEADER -->
        <div style="margin-bottom: 0.75rem;">
          <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem;">
            <h1 style="font-family: 'Outfit'; margin: 0; font-weight: 900; color: var(--text-primary); display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; font-size: 1.6rem; line-height: 1.1;">
              Hello, ${profile.username || 'Student'} 
              <i data-lucide="sun" style="width: 20px; height: 20px; color: var(--warning);"></i>
            </h1>
            <div id="header-tier" class="tier-mini" title="Your Account Tier" style="display: flex; align-items: center; gap: 0.35rem; background: ${profile.activation_status ? 'var(--accent-secondary)' : 'rgba(255,255,255,0.05)'};">
              <i data-lucide="award" style="width: 16px; height: 16px;"></i> <span id="tier-text">${profile.activation_status ? 'PREMIUM' : 'FREE'}</span>
            </div>
          </div>
          <p style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 0.15rem; font-weight: 800; letter-spacing: 0.02em;">Let's make today count.</p>
        </div>

        <!-- ELITE ECONOMY WIDGET -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; margin-bottom: 0.75rem;">
          <div id="economy-coins-widget" class="glass card" style="padding: 0.35rem 0.6rem; display: flex; align-items: center; gap: 0.4rem; cursor: pointer; border-left: 2px solid #f59e0b; background: rgba(245, 158, 11, 0.08); min-height: 44px; border-radius: 12px;">
            <div style="width: 20px; height: 20px; background: rgba(245, 158, 11, 0.2); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #f59e0b; flex-shrink: 0;">
              <i data-lucide="coins" style="width: 12px;"></i>
            </div>
            <div style="overflow: hidden;">
              <div style="font-size: 0.5rem; color: var(--text-secondary); font-weight: 900; text-transform: uppercase; white-space: nowrap; letter-spacing: 0.05em;">Elite Coins</div>
              <div id="economy-coins-val" style="font-family: 'Outfit'; font-size: 0.9rem; font-weight: 900; color: var(--text-primary); line-height: 1;">${profile.elite_coins || 0}</div>
            </div>
          </div>
          <div id="economy-freeze-widget" class="glass card scale-in" style="padding: 0.35rem 0.6rem; display: flex; align-items: center; gap: 0.4rem; cursor: pointer; border-left: 2px solid var(--accent-secondary); background: rgba(139, 92, 246, 0.08); min-height: 44px; border-radius: 12px;">
            <div style="width: 20px; height: 20px; background: rgba(139, 92, 246, 0.2); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: var(--accent-secondary); flex-shrink: 0;">
              <i data-lucide="snowflake" style="width: 12px;"></i>
            </div>
            <div style="overflow: hidden;">
              <div style="font-size: 0.5rem; color: var(--text-secondary); font-weight: 900; text-transform: uppercase; white-space: nowrap; letter-spacing: 0.05em;">Streak Freeze</div>
              <div id="economy-freeze-val" style="font-family: 'Outfit'; font-size: 0.9rem; font-weight: 900; color: var(--text-primary); line-height: 1;">${profile.streak_freeze_count || 0}</div>
            </div>
          </div>
        </div>

        <!-- PAST QUESTIONS ARCHIVE (BOOSTER) -->
        <div id="open-archive-btn" class="glass card scale-in mb-sm" style="margin-bottom: 0.75rem; padding: 0.65rem 0.85rem; cursor: pointer; border: 1.5px solid var(--accent-secondary); background: linear-gradient(135deg, rgba(124, 58, 237, 0.08) 0%, var(--surface-color) 100%); display: flex; align-items: center; gap: 0.75rem; position: relative; overflow: hidden; border-radius: 12px;">
            <div style="width: 32px; height: 32px; background: rgba(124, 58, 237, 0.2); border-radius: 8px; display: flex; align-items: center; justify-content: center; color: var(--accent-secondary); flex-shrink: 0;">
                <i data-lucide="library" style="width: 16px; height: 16px;"></i>
            </div>
            <div style="flex: 1;">
                <h4 style="margin: 0; font-family: 'Outfit'; font-weight: 900; font-size: 0.85rem; color: var(--text-primary); display: flex; align-items: center; gap: 0.4rem;">
                    Past Questions Archive
                    <span style="font-size: 0.5rem; background: var(--accent-secondary); color: white; padding: 1px 5px; border-radius: 4px; font-weight: 900; text-transform: uppercase;">Real Exams</span>
                </h4>
                <p style="margin: 0; font-size: 0.65rem; color: var(--text-secondary); font-weight: 700; line-height: 1.2;">
                   Practice with official papers from 2010 till date.
                </p>
            </div>
            <i data-lucide="chevron-right" style="width: 14px; color: var(--accent-secondary); opacity: 0.5;"></i>
        </div>

        <!-- QUICK ACTION SECTION -->
        <div class="glass card scale-in mb-md" style="text-align: center; padding: 0.85rem 0.75rem; border: 1.5px solid rgba(14, 165, 233, 0.3); background: linear-gradient(180deg, rgba(14, 165, 233, 0.04) 0%, var(--surface-color) 100%);">
          <div style="display: flex; justify-content: center; gap: 0.5rem; flex-wrap: wrap; width: 100%; margin-bottom: 0.5rem;">
             <button id="quick-practice-btn" class="btn-primary" style="padding: 0; flex: 1; height: 44px; min-width: 120px; font-size: 1rem; font-weight: 900; box-shadow: 0 6px 16px rgba(37, 99, 235, 0.3);"><i data-lucide="target" style="width:20px;"></i> PRACTICE</button>
             <button id="quick-exam-btn" class="btn-secondary" style="padding: 0; flex: 1; height: 44px; min-width: 120px; font-weight: 900; font-size: 1rem; border: 2px solid var(--accent-secondary);"><i data-lucide="trophy" style="width:20px;"></i> MOCK EXAM</button>
          </div>
          <button id="quick-challenge-btn" class="btn-dominant" style="width: 100%; height: 48px; font-size: 1.05rem; font-weight: 900; background: var(--accent-gradient); border-radius: 12px; display: flex; align-items: center; justify-content: center; gap: 0.5rem; box-shadow: 0 6px 20px rgba(139, 92, 246, 0.3);">
             ⚔️ MULTIPLAYER CHALLENGE
          </button>
        </div>

        <!-- 🧠 SMART DAILY MISSION (NEW) -->
        ${this.renderDailyMission()}

        <!-- 🏆 LEAGUE & CLAN ANNOUNCEMENT -->
        <div class="glass card scale-in mb-md" id="home-league-announcement" style="padding: 1.25rem 1rem; cursor: pointer; border-left: 4px solid var(--accent-primary); background: linear-gradient(135deg, rgba(37, 99, 235, 0.08) 0%, var(--surface-color) 100%); display: flex; align-items: center; gap: 1rem; position: relative; overflow: hidden;">
            <div style="width: 48px; height: 48px; background: rgba(37, 99, 235, 0.2); border-radius: 14px; display: flex; align-items: center; justify-content: center; color: var(--accent-primary); flex-shrink: 0; box-shadow: 0 8px 16px rgba(37, 99, 235, 0.15);">
                <i data-lucide="shield-check" style="width: 24px; height: 24px;"></i>
            </div>
            <div style="flex: 1;">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.25rem;">
                   <h4 style="margin: 0; font-family: 'Outfit'; font-weight: 900; font-size: 0.95rem; color: var(--text-primary); display: flex; align-items: center; gap: 0.4rem;">
                       Clan & League HUB
                   </h4>
                   <span id="home-clash-timer" style="font-size: 0.65rem; font-weight: 900; color: var(--accent-primary); background: rgba(37, 99, 235, 0.1); padding: 0.15rem 0.5rem; border-radius: 6px; font-variant-numeric: tabular-nums;">--:--:--</span>
                </div>
                <p style="margin: 0; font-size: 0.8rem; color: var(--text-secondary); font-weight: 600; line-height: 1.4; display: block; width: 100%;">
                   Join the Clan Competition every Saturday to qualify for the Elite competition on Sunday.
                </p>
                <div style="margin-top: 1rem;">
                   <button class="btn-primary" style="width: 100%; height: 42px; font-size: 0.85rem; font-weight: 900; border-radius: 12px; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.2);">
                      ENTER LEAGUE HUB
                   </button>
                </div>
            </div>
        </div>

        <!-- Daily Streak Card -->
        <div class="glass card scale-in" style="padding: 1rem; background: linear-gradient(135deg, rgba(245, 158, 11, 0.05) 0%, var(--surface-color) 100%); border-radius: 16px; border: 1px solid rgba(245, 158, 11, 0.2); display: flex; align-items: center; justify-content: space-between; gap: 1rem; min-height: 100px;">
          <div style="display: flex; align-items: center; gap: 1rem;">
             <div class="streak-flame-container ${profile.streak_count > 0 ? 'active' : ''}" style="width: 48px; height: 48px; background: rgba(245, 158, 11, 0.1); border-radius: 12px; display: flex; align-items: center; justify-content: center;">
               <i data-lucide="flame" style="width: 24px; height: 24px; color: ${profile.streak_count > 0 ? 'var(--warning)' : 'var(--text-secondary)'};"></i>
             </div>
             <div>
                <div id="streak-count-val" style="font-family: 'Outfit'; font-size: 1.25rem; font-weight: 900; color: var(--text-primary); line-height: 1;">${profile.streak_count || 0} Days</div>
                <div style="font-size: 0.65rem; font-weight: 800; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em;">Current Streak</div>
             </div>
          </div>
          <div style="text-align: right;">
             <p style="font-size: 0.75rem; color: var(--text-secondary); margin: 0; font-weight: 600; line-height: 1.2;">
               ${profile.streak_count > 0 ? "You're on fire!" : "Start today!"}
             </p>
          </div>
        </div>


        <!-- Help Guide CTA -->
        <div class="glass card scale-in" style="margin-top: 1rem; background: linear-gradient(135deg, #5B21B6 0%, #3730A3 100%); border: none; padding: 1.5rem; display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: 1rem; text-align: center;">
           <div style="color: #ffffff;">
              <h3 style="font-family: 'Outfit'; font-weight: 900; font-size: 1.25rem; margin-bottom: 0.25rem; color: #ffffff;">Need a headstart?</h3>
              <p style="font-size: 0.9rem; color: rgba(255,255,255,0.9); margin-bottom: 1rem;">Unleash the full power of CBT Elite.</p>
              <button id="help-guide-btn" class="btn-secondary" style="background: white; color: #3730A3; border: none; font-weight: 800; width: 100%; height: 44px; border-radius: 10px;">Launch Tour</button>
           </div>
        </div>
    `;
  },

  renderArchiveTab() {
    return `
      <div style="padding-bottom: 2rem;">
        <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1.5rem;">
          <button onclick="DashboardComponent.setActiveTab('home')" style="background: rgba(255,255,255,0.05); border: none; color: var(--text-primary); width: 36px; height: 36px; border-radius: 10px; cursor: pointer; display: flex; align-items: center; justify-content: center;">
            <i data-lucide="arrow-left" style="width: 18px;"></i>
          </button>
          <div>
            <h2 style="margin: 0; font-family: 'Outfit'; font-weight: 900; font-size: 1.4rem;">Real Past Questions</h2>
            <p style="margin: 0; font-size: 0.8rem; color: var(--text-secondary); font-weight: 700;">Select your exam and subject to begin.</p>
          </div>
        </div>

        <!-- SELECTION FLOW -->
        <div id="archive-selection-container">
           ${this.renderArchiveSelection()}
        </div>
      </div>
    `;
  },

  renderArchiveSelection() {
    const exams = [
      { id: 'JAMB', name: 'JAMB (UTME)', icon: 'award' },
      { id: 'WAEC', name: 'WAEC (WASSCE)', icon: 'book-open' },
      { id: 'NECO', name: 'NECO (SSCE)', icon: 'scroll' }
    ];

    return `
      <div style="display: grid; gap: 1.5rem;">
        <!-- STEP 1: EXAM TYPE -->
        <section>
          <label style="font-size: 0.7rem; font-weight: 900; color: var(--accent-secondary); text-transform: uppercase; letter-spacing: 0.1em; display: block; margin-bottom: 0.75rem;">Step 1: Choose Exam Body</label>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)); gap: 0.75rem;">
            ${exams.map(e => `
              <div class="archive-exam-opt glass card" data-id="${e.id}" style="padding: 1.25rem 0.5rem; text-align: center; cursor: pointer; border: 1.5px solid transparent; transition: all 0.2s;">
                <i data-lucide="${e.icon}" style="width: 24px; height: 24px; margin-bottom: 0.5rem; color: var(--text-secondary);"></i>
                <div style="font-size: 0.75rem; font-weight: 800; font-family: 'Outfit';">${e.id}</div>
              </div>
            `).join('')}
          </div>
        </section>

        <!-- STEP 2: SUBJECT -->
        <section id="archive-subject-section" style="opacity: 0.4; pointer-events: none;">
          <label style="font-size: 0.7rem; font-weight: 900; color: var(--accent-secondary); text-transform: uppercase; letter-spacing: 0.1em; display: block; margin-bottom: 0.75rem;">Step 2: Choose Subject</label>
          <select id="archive-subject-select" class="glass-select" style="width: 100%; height: 52px; font-weight: 800;">
            <option value="">Select Subject...</option>
          </select>
        </section>

        <!-- STEP 3: YEAR -->
        <section id="archive-year-section" style="opacity: 0.4; pointer-events: none;">
          <label style="font-size: 0.7rem; font-weight: 900; color: var(--accent-secondary); text-transform: uppercase; letter-spacing: 0.1em; display: block; margin-bottom: 0.75rem;">Step 3: Choose Year</label>
          <div id="archive-years-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(70px, 1fr)); gap: 0.5rem;">
            <!-- Years injected here -->
          </div>
        </section>

        <button id="start-archive-session" class="btn-primary" style="width: 100%; height: 56px; margin-top: 1rem; opacity: 0.3; pointer-events: none; font-weight: 900; font-family: 'Outfit'; font-size: 1.1rem; border-radius: 14px;">
          START ARCHIVE SESSION
        </button>
      </div>
    `;
  },

  renderProgressTab() {
    const { currentDailyCount, currentMilestone, nextMilestone, accuracy, studyTimeHours, examsCompleted, badgesHTML } = this.state;
    return `
        <!-- Daily Goal Card -->
        <div class="glass card mb-md" style="padding: 1.25rem 1rem; display: flex; flex-direction: column; min-height: 220px; justify-content: space-between; border-top: 3px solid ${currentMilestone ? currentMilestone.color : 'var(--accent-primary)'};">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
            <h3 style="color: var(--text-secondary); font-size: 0.7rem; font-weight: 900; text-transform: uppercase; letter-spacing: 0.08em; margin: 0;">Daily Star Target</h3>
            <div style="display: flex; gap: 4px;">
                ${this.MILESTONES.map(m => `
                    <div title="${m.title}" style="color: ${currentDailyCount >= m.target ? m.color : 'var(--text-secondary)'} !important; opacity: ${currentDailyCount >= m.target ? '1' : '0.2'} !important;">
                         <i data-lucide="${m.badge}" style="width: 14px; height: 14px;"></i>
                    </div>
                `).join('')}
            </div>
          </div>
          
          <div style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.75rem;">
            <div style="position: relative; width: 100px; height: 100px;">
              <svg viewBox="0 0 36 36" style="width: 100%; height: 100%; transform: rotate(-90deg);">
                <circle cx="18" cy="18" r="16" fill="none" stroke="rgba(255,255,255,0.03)" stroke-width="2.5" />
                ${this.MILESTONES.map((m, idx) => {
                    const milestoneStart = idx === 0 ? 0 : this.MILESTONES[idx-1].target;
                    const milestoneRange = m.target - milestoneStart;
                    const progressInMilestone = Math.max(0, Math.min(milestoneRange, currentDailyCount - milestoneStart));
                    const pct = (progressInMilestone / milestoneRange) * (100 / this.MILESTONES.length);
                    const offset = (idx * (100 / this.MILESTONES.length));
                    return `
                        <circle cx="18" cy="18" r="16" fill="none" stroke="${currentDailyCount >= m.target ? m.color : 'rgba(255,255,255,0.05)'}" stroke-width="3" stroke-dasharray="${(currentDailyCount >= m.target ? 100 / this.MILESTONES.length : pct) - 1}, 100" stroke-dashoffset="-${offset}" stroke-linecap="round" />
                    `;
                }).join('')}
              </svg>
              <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center;">
                <div style="font-family: 'Outfit'; font-size: 1.5rem; font-weight: 900; color: var(--text-primary);">${currentDailyCount}</div>
                <div style="font-size: 0.6rem; font-weight: 800; color: var(--text-secondary); text-transform: uppercase;">Solved</div>
              </div>
            </div>
            <div style="font-size: 0.75rem; color: var(--text-secondary); font-weight: 600;">
                ${nextMilestone ? `${nextMilestone.target - currentDailyCount} more for ${nextMilestone.title}` : 'Legendary status attained!'}
            </div>
          </div>
          <div style="margin-top: 0.75rem; display: flex; justify-content: center; gap: 0.5rem;">
            <button class="goal-toggle badge glass ${parseInt(localStorage.getItem('elite_daily_goal') || '50') === 50 ? 'active' : ''}" data-target="50" style="padding: 0.4rem 0.8rem; font-size: 0.7rem;">50</button>
            <button class="goal-toggle badge glass ${parseInt(localStorage.getItem('elite_daily_goal') || '50') === 100 ? 'active' : ''}" data-target="100" style="padding: 0.4rem 0.8rem; font-size: 0.7rem;">100</button>
            <button class="goal-toggle badge glass ${parseInt(localStorage.getItem('elite_daily_goal') || '50') === 150 ? 'active' : ''}" data-target="150" style="padding: 0.4rem 0.8rem; font-size: 0.7rem;">150+</button>
          </div>
        </div>

        <!-- Study Stats Card -->
        <div class="glass card study-stats-card mb-md" style="padding: 1.25rem 1rem;">
          <h3 style="color: var(--text-secondary); font-size: 0.7rem; font-weight: 900; text-transform: uppercase; margin-bottom: 1rem;">Study Stats</h3>
          <div class="stats-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
            <div class="stat-item">
              <div class="stat-label" style="font-size: 0.65rem; color: var(--text-secondary);"><i data-lucide="book-open" style="width: 10px;"></i> SOLVED</div>
              <div class="stat-value" style="font-size: 1.2rem; font-weight: 900;">${this.state.totalSolved}</div>
            </div>
            <div class="stat-item">
              <div class="stat-label" style="font-size: 0.65rem; color: var(--text-secondary);"><i data-lucide="target" style="width: 10px;"></i> ACCURACY</div>
              <div class="stat-value" style="font-size: 1.2rem; font-weight: 900; color: var(--success);">${accuracy}%</div>
            </div>
            <div class="stat-item">
              <div class="stat-label" style="font-size: 0.65rem; color: var(--text-secondary);"><i data-lucide="trophy" style="width: 10px;"></i> EXAMS</div>
              <div class="stat-value" style="font-size: 1.2rem; font-weight: 900; color: var(--accent-secondary);">${examsCompleted}</div>
            </div>
            <div class="stat-item">
              <div class="stat-label" style="font-size: 0.65rem; color: var(--text-secondary);"><i data-lucide="clock" style="width: 10px;"></i> TIME</div>
              <div class="stat-value" style="font-size: 1.2rem; font-weight: 900; color: var(--warning);">${studyTimeHours}h</div>
            </div>
          </div>
          <div style="margin-top: 1rem; border-top: 1px solid var(--glass-border); padding-top: 1rem;">
              <div style="display: flex; flex-wrap: wrap; gap: 4px; justify-content: center;">${badgesHTML}</div>
          </div>
        </div>

        <!-- ELITE INSIGHTS QUICK LAUNCH -->
        <div class="glass card scale-in mb-md" style="padding: 1rem; border-left: 4px solid var(--accent-secondary); background: linear-gradient(90deg, rgba(139, 92, 246, 0.05) 0%, transparent 100%); cursor: pointer;" id="launch-elite-insights-btn">
          <div style="display: flex; justify-content: space-between; align-items: center;">
             <div>
                <h3 style="font-family: 'Outfit'; font-size: 1.1rem; font-weight: 800; color: var(--text-primary); margin: 0; display: flex; align-items: center; gap: 0.4rem;">
                   <i data-lucide="sparkles" style="color: var(--accent-secondary); width: 18px;"></i> Elite Insights
                </h3>
                <p style="font-size: 0.8rem; color: var(--text-secondary); margin: 0.2rem 0 0 0; font-weight: 500;">AI Predictions & Mastery Analysis</p>
             </div>
             <div style="background: rgba(139, 92, 246, 0.1); width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: var(--accent-secondary);">
                <i data-lucide="chevron-right" style="width: 18px;"></i>
             </div>
          </div>
        </div>

        <!-- SCORE TREND CHART -->
        <div id="analytics-section">
          <h2 style="font-family: 'Outfit'; font-size: 1.1rem; font-weight: 900; margin-bottom: 0.75rem; display: flex; align-items: center; justify-content: space-between;">
            <span style="display: flex; align-items: center; gap: 0.5rem;"><i data-lucide="line-chart" style="width: 20px;"></i> Performance Trend</span>
            <button id="view-history-btn" class="glass-btn" style="font-size: 0.65rem; padding: 0.4rem 0.75rem; border-radius: 8px;">VIEW HISTORY</button>
          </h2>
          <div class="glass card scale-in" id="accuracy-trend-card" style="padding: 1rem; min-height: 220px; border-bottom: 3px solid var(--accent-primary);">
            <div style="flex: 1; width: 100%; height: 160px;"><canvas id="score-history-chart"></canvas></div>
          </div>
        </div>

        <!-- 🧠 MASTERY HUB -->
        <div style="margin-top: 2rem; border-top: 2px solid var(--glass-border); padding-top: 2rem;">
            ${this.renderRepairCenter()}
            ${this.renderMasteryCenter()}
        </div>
    `;
  },

  renderCompeteTab() {
    const { isClashWindow, isResultsWindow, style, day, hour, min } = this.state;
    const clanName = this.leagueData?.clan_name || (this.profile?.department + ' Elites');
    const tier = this.profile?.league_tier || 'Bronze';
    const dept = this.profile?.department || 'General';

    return `
        <!-- Elite Clan Hub -->
        <div id="open-league-btn" class="glass card mb-md" style="padding: 1.5rem 1rem; display: flex; flex-direction: column; min-height: 220px; justify-content: space-between; border-top: 4px solid ${style.color}; background: linear-gradient(180deg, ${style.color}05 0%, var(--surface-color) 100%);">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <h3 style="color: var(--text-secondary); font-size: 0.75rem; font-weight: 900; text-transform: uppercase; letter-spacing: 0.05em; margin: 0;">League Hub</h3>
            <div style="font-size: 0.7rem; font-weight: 800; color: ${style.color}; display: flex; align-items: center; gap: 0.25rem;">
                <i data-lucide="users" style="width: 12px;"></i> <span>GRP-20</span>
            </div>
          </div>
          
          <div style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.5rem;">
            <div style="width: 56px; height: 56px; background: ${style.color}15; border-radius: 16px; display: flex; align-items: center; justify-content: center; border: 2.5px solid ${style.color}40;">
                <i data-lucide="${style.icon}" style="width: 28px; height: 28px; color: ${style.color};"></i>
            </div>
            <div style="text-align: center;">
                <div style="font-family: 'Outfit'; font-size: 1.25rem; font-weight: 900; color: var(--text-primary); line-height: 1.1;">${clanName}</div>
                <div style="font-size: 0.7rem; color: var(--text-secondary); font-weight: 800; text-transform: uppercase; margin-top: 0.25rem;">${dept} • ${tier}</div>
            </div>
            
            ${isClashWindow ? `
            <div style="text-align: center; margin-bottom: 0.5rem;">
                <span style="font-size: 0.6rem; color: ${style.color}; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; display: flex; align-items: center; justify-content: center; gap: 0.25rem;">
                    ${day === 0 ? '<i data-lucide="crown" style="width:10px;"></i> Championship Round' : '<i data-lucide="zap" style="width:10px;"></i> Qualifying Round'}
                </span>
            </div>
            <button id="start-clash-btn" class="btn-dominant" style="width: 100%; height: 48px; background: linear-gradient(90deg, ${style.color}, var(--accent-primary)); border-radius: 12px;">START CLASH</button>
            ${day === 6 ? `<p style="font-size: 0.65rem; color: var(--text-secondary); text-align: center; margin-top: 0.5rem; font-weight: 700;">Top 3 promote to Elite League</p>` : ''}
          ` : isResultsWindow ? `
            <button id="view-clash-results-btn" class="btn-dominant" style="width: 100%; height: 48px; background: linear-gradient(90deg, var(--success), var(--accent-primary)); border-radius: 12px;">LEADERBOARD</button>
          ` : `
            <div style="background: rgba(255,255,255,0.03); border-radius: 12px; padding: 0.75rem; border: 1px solid var(--glass-border);">
               <div style="display: flex; justify-content: space-between; align-items: center;">
                  <div style="display: flex; flex-direction: column;">
                    <span style="font-size: 0.6rem; font-weight: 800; color: var(--text-secondary); text-transform: uppercase;">Next Clash</span>
                    <span style="font-size: 0.85rem; font-weight: 900; color: var(--text-primary);">${ (day === 6 && (hour > 19 || (hour === 19 && min >= 30))) || (day === 0 && hour < 19) ? 'SUN 7PM' : 'SAT 7PM'}</span>
                  </div>
                  <div style="text-align: right;">
                    <span id="league-timer" style="font-size: 0.8rem; font-weight: 900; color: ${style.color};">--:--:--</span>
                  </div>
               </div>
            </div>
          `}
          </div>
        </div>

        <!-- Rankings Section -->
        <div id="open-leaderboard-btn" class="glass card mb-md" style="padding: 1.25rem 1rem; border-bottom: 4px solid var(--success); cursor: pointer;">
          <div style="display: flex; align-items: center; gap: 1rem;">
            <div style="background: rgba(16, 185, 129, 0.1); width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; color: var(--success);"><i data-lucide="bar-chart-3" style="width:20px;"></i></div>
            <div style="flex: 1;">
                <h4 style="font-family: 'Outfit'; font-weight: 900; font-size: 1rem; margin: 0;">Global Rankings</h4>
                <div id="global-rank-indicator" style="font-size: 0.75rem; font-weight: 700; color: var(--text-secondary);">Loading your rank...</div>
            </div>
            <i data-lucide="chevron-right" style="width: 16px; color: var(--text-secondary);"></i>
          </div>
        </div>

        <div id="open-clan-rankings-btn" class="glass card" style="padding: 1.25rem 1rem; border-bottom: 4px solid var(--accent-secondary); cursor: pointer;">
          <div style="display: flex; align-items: center; gap: 1rem;">
            <div style="background: rgba(139, 92, 246, 0.1); width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; color: var(--accent-secondary);"><i data-lucide="trophy" style="width:20px;"></i></div>
            <div style="flex: 1;">
                <h4 style="font-family: 'Outfit'; font-weight: 900; font-size: 1rem; margin: 0;">Clan Rankings</h4>
                <div style="font-size: 0.75rem; font-weight: 700; color: var(--text-secondary);">Last Saturday's Results</div>
            </div>
            <i data-lucide="chevron-right" style="width: 16px; color: var(--text-secondary);"></i>
          </div>
        </div>

        <div style="margin-top: 1.5rem; text-align: center;">
            <button class="btn-primary" id="change-clan-btn" style="width: 100%; height: 48px; border-radius: 12px; background: var(--accent-primary); font-weight: 900;">
                <i data-lucide="graduation-cap" style="width:18px; margin-right: 8px;"></i> SELECT DEPARTMENT
            </button>
        </div>
    `;
  },

  renderImproveTab() {
    return `
        <!-- ELITE REPAIR CENTER -->
        ${this.unresolvedMistakeIds.length > 0 ? `
        <div id="repair-center-card" class="glass card scale-in mb-md" style="padding: 1.5rem; border: 2.5px solid #ef4444; background: linear-gradient(135deg, rgba(239, 68, 68, 0.05) 0%, var(--surface-color) 100%); border-radius: 20px;">
          <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem;">
            <div style="background: rgba(239, 68, 68, 0.15); width: 48px; height: 48px; border-radius: 14px; display: flex; align-items: center; justify-content: center; color: #ef4444;">
              <i data-lucide="shield-alert" style="width: 28px;"></i>
            </div>
            <div>
              <h3 style="font-family: 'Outfit'; font-size: 1.25rem; font-weight: 900; color: var(--text-primary); margin: 0;">Mastery Center</h3>
              <p style="font-size: 0.8rem; color: #ef4444; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em;">${this.unresolvedMistakeIds.length} WEAK POINTS</p>
            </div>
          </div>
          
          <div style="margin-bottom: 1.5rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.6rem;">
                <span style="font-size: 0.7rem; font-weight: 800; color: var(--text-secondary); text-transform: uppercase;">Fixing Progress</span>
                <span style="font-size: 0.8rem; font-weight: 900; color: #ef4444;">--%</span>
            </div>
            <div style="height: 12px; background: rgba(255,255,255,0.05); border-radius: 6px; overflow: hidden; border: 1px solid var(--glass-border);">
                <div style="width: ${Math.max(15, 100 - (this.unresolvedMistakeIds.length * 2)) }%; height: 100%; background: linear-gradient(90deg, #ef4444, #f59e0b);"></div>
            </div>
          </div>

          <p style="font-size: 0.9rem; color: var(--text-secondary); line-height: 1.6; margin-bottom: 1.5rem;">
            Bridge knowledge gaps and master your exams by fixing these mistakes now.
          </p>
          <button id="repair-mistakes-btn" class="btn-dominant" style="width: 100%; height: 52px; background: linear-gradient(90deg, #ef4444 0%, #b91c1c 100%); border-radius: 14px; font-weight: 900; font-size: 1rem; box-shadow: 0 8px 20px rgba(239, 68, 68, 0.25);">
            <i data-lucide="zap" style="width: 20px;"></i> MASTER MISTAKES
          </button>
        </div>
        ` : `
        <div class="glass card scale-in" style="padding: 3rem 1.5rem; text-align: center; border-radius: 20px; border: 1.5px dashed var(--glass-border);">
            <div style="width: 64px; height: 64px; background: rgba(16, 185, 129, 0.1); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: var(--success); margin: 0 auto 1.5rem;">
                <i data-lucide="check-circle" style="width: 32px; height: 32px;"></i>
            </div>
            <h3 style="font-family: 'Outfit'; font-weight: 900; font-size: 1.5rem; margin-bottom: 0.5rem;">All Clear!</h3>
            <p style="color: var(--text-secondary); font-size: 1rem;">No weak points detected. You're performing at an elite level.</p>
        </div>
        `}
        
        <!-- 🎴 DAILY FLASHCARDS (SRS) -->
        <div id="flashcards-section" style="margin-top: 2rem;">
          <h2 style="font-family: 'Outfit'; font-size: 1.1rem; font-weight: 900; margin-bottom: 0.75rem; display: flex; align-items: center; gap: 0.5rem;">
            <i data-lucide="layers" style="width: 20px; color: var(--accent-secondary);"></i> Active Review
          </h2>
          <div id="flashcards-card" class="glass card scale-in" style="padding: 1.25rem; border: 1.5px solid var(--accent-secondary); background: linear-gradient(135deg, rgba(139, 92, 246, 0.05) 0%, var(--surface-color) 100%); border-radius: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div>
                <div style="font-family: 'Outfit'; font-size: 1.75rem; font-weight: 900; color: var(--text-primary); line-height: 1;">${this.flashcardsDueCount}</div>
                <div style="font-size: 0.7rem; font-weight: 800; color: var(--text-secondary); text-transform: uppercase; margin-top: 0.25rem;">Cards Due Today</div>
              </div>
              <button id="start-flashcards-btn" class="btn-primary" ${this.flashcardsDueCount === 0 ? 'disabled' : ''} style="height: 44px; padding: 0 1.25rem; font-weight: 900; border-radius: 10px;">
                REVIEW NOW
              </button>
            </div>
          </div>
        </div>

        <!-- Weakness analysis will go here in next version -->
        <div id="weakness-analysis-container"></div>
    `;
  },

  hide() {
    const container = document.getElementById('dashboard-container');
    if (container) container.style.display = 'none';
  },

  attachListeners(scope) {
    const { profile, systemConfig } = this.state;

    // Helper: open modal with scroll reset
    const openModal = (el) => {
        if (!el) return;
        el.style.display = 'flex';
        requestAnimationFrame(() => { 
            el.scrollTop = 0; 
            const content = el.querySelector('.modal-content');
            if (content) content.scrollTop = 0;
            window.scrollTo(0, 0);
            if (document.body) document.body.scrollTop = 0;
        });
    }

    const triggerPayment = async (baseAmountPlan) => {
        try {
            if (!window.PaystackPop) {
                await new Promise((resolve, reject) => {
                    const script = document.createElement('script');
                    script.src = 'https://js.paystack.co/v1/inline.js';
                    script.onload = resolve;
                    script.onerror = reject;
                    document.head.appendChild(script);
                });
            }
            
            const handler = window.PaystackPop.setup({
                key: import.meta.env.VITE_PAYSTACK_PUBLIC_KEY || 'pk_test_placeholder', 
                email: profile.email,
                amount: baseAmountPlan * 100,
                currency: 'NGN',
                callback: async (response) => {
                    ModalService.showToast("Verifying payment...", "info");
                    setTimeout(() => location.reload(), 2000);
                },
                onClose: () => ModalService.showToast('Transaction cancelled.', 'info')
            });
            handler.openIframe();
        } catch (err) {
            ModalService.alert("Connection Error", "Could not load payment processor.", 'error');
        }
    }

    // --- GLOBAL MODAL LISTENERS ---
    const upgradeBtns = document.querySelectorAll('[onclick*="upgrade-modal"]');
    upgradeBtns.forEach(btn => {
        btn.onclick = (e) => {
            e.preventDefault();
            const modal = document.getElementById('upgrade-modal');
            if (modal) openModal(modal);
        };
    });

    const payLifetime = document.getElementById('pay-lifetime');
    const payMonthly = document.getElementById('pay-monthly');
    if (payLifetime) payLifetime.onclick = () => triggerPayment(1500);
    if (payMonthly) payMonthly.onclick = () => triggerPayment(1000);

    // --- SHARED ACTIONS ---
    const actions = {
        'quick-practice-btn': () => window.navigateTo('practice', profile),
        'quick-exam-btn': () => window.navigateTo('exams', profile),
        'quick-challenge-btn': () => window.navigateTo('challenge', profile),
        'help-guide-btn': () => { if (window.HelpGuide) window.HelpGuide.show(); else if (window.TourGuide) window.TourGuide.start(); },
        'goto-improve-tab-btn': () => this.setActiveTab('improve'),
        'open-store-btn': () => {
            EliteStoreComponent.render(profile, (updatedProfile) => {
                document.querySelectorAll('#economy-coins-val').forEach(el => el.innerText = updatedProfile.elite_coins);
                document.querySelectorAll('#economy-freeze-val').forEach(el => el.innerText = updatedProfile.streak_freeze_count || 0);
            });
        },
        'open-leaderboard-btn': () => {
            const lbModal = document.getElementById('leaderboard-modal');
            if (lbModal) {
                openModal(lbModal);
                this.loadLeaderboard(profile);
            }
        },
        'close-leaderboard': () => {
            const lbModal = document.getElementById('leaderboard-modal');
            if (lbModal) lbModal.style.display = 'none';
        },
        'close-leaderboard-top': () => {
            const lbModal = document.getElementById('leaderboard-modal');
            if (lbModal) lbModal.style.display = 'none';
        },
        'launch-elite-insights-btn': () => {
            if (typeof window.navigateTo === 'function') {
                window.navigateTo('analytics', profile);
            }
        },
        'view-history-btn': () => window.navigateTo('history', profile),
        'repair-mistakes-btn': async () => {
            if (this.unresolvedMistakeIds.length > 0) {
                ModalService.showToast("Loading Repair Center...", "info");
                try {
                    const { data: mq } = await supabase
                        .from('questions')
                        .select('*, subjects(subject_name), question_answers(*), question_explanations(explanation), question_groups(*)')
                        .in('id', this.unresolvedMistakeIds);
                    
                    if (mq && mq.length > 0) {
                        const formatted = DataService._formatQuestions(mq);
                        this.onStartExam(formatted, 'repair', 'Repair Center', 'Mastery');
                    } else {
                        ModalService.alert("Repair Center Empty", "No active mistakes to fix right now. Keep practicing!", "info");
                    }
                } catch (err) {
                    console.error("Failed to load repair questions", err);
                    ModalService.alert("Error", "Could not load your mistakes. Please try again later.", "error");
                }
            }
        },
        'open-league-btn': () => {
            const leagueModal = document.getElementById('league-table-modal');
            if (leagueModal) {
                openModal(leagueModal);
                this.loadLeagueModalTable(profile);
            }
        },
        'close-league': () => {
            const leagueModal = document.getElementById('league-table-modal');
            if (leagueModal) leagueModal.style.display = 'none';
        },
        'start-clash-btn': (e) => {
            e.stopPropagation();
            this.handleClashStart();
        },
        'change-clan-btn': (e) => {
            e.stopPropagation();
            this.showDepartmentPicker(profile);
        },
        'mastery-center-card': () => this.setActiveTab('improve'),
        'view-history-btn': () => this.showHistory(),
        'open-mastery-modal-btn': () => this.showMasteryModal(),
        'open-clan-rankings-btn': () => this.showClanRankings(),
        'help-guide-btn': () => {
            console.log("Tour: Launching from Dashboard CTA");
            TourGuide.start();
        }
    };

    Object.entries(actions).forEach(([id, handler]) => {
        const els = document.querySelectorAll(`#${id}`);
        els.forEach(el => el.onclick = handler);
    });

    // --- TAB SPECIFIC LOGIC ---
    if (scope === 'progress' || scope === 'full') {
        document.querySelectorAll('.goal-toggle').forEach(btn => {
            btn.onclick = () => {
                const target = btn.dataset.target;
                localStorage.setItem('elite_daily_goal', target);
                this.state.currentMilestone = this.MILESTONES.slice().reverse().find(m => this.state.currentDailyCount >= m.target);
                this.state.nextMilestone = this.MILESTONES.find(m => this.state.currentDailyCount < m.target);
                this.renderCurrentTab();
            }
        });
    }

    if (scope === 'home' || scope === 'full') {
        const initSaved = async () => {
            if (profile.id === 'anon') return;
            const { count } = await DataService.getBookmarkCount(profile.id);
            const bBtn = document.getElementById('start-saved');
            if (bBtn && count > 0) {
                bBtn.style.display = 'flex';
                bBtn.onclick = async () => {
                    const { data } = await DataService.getBookmarks(profile.id);
                    if (data && data.length > 0) this.onStartExam(data, 'saved', 'Saved', 'Collection');
                };
            }
        };
        initSaved();
    }

    // --- MASTERY CENTER LISTENERS ---
    const homeImproveBtn = document.getElementById('home-improve-btn');
    if (homeImproveBtn) {
        homeImproveBtn.onclick = () => this.setActiveTab('progress');
    }

    // Note: The practice-topic-btn listener is now attached inside showMasteryModal since they render inside the modal

    const startMissionBtn = document.getElementById('start-mission-btn');
    if (startMissionBtn) {
        startMissionBtn.onclick = () => this.handleDailyMission();
    }

    const startFlashcardsBtn = document.getElementById('start-flashcards-btn');
    if (startFlashcardsBtn) {
        startFlashcardsBtn.onclick = () => this.handleFlashcardsReview();
    }

    const homeLeagueBtn = document.getElementById('home-league-announcement');
    if (homeLeagueBtn) {
        homeLeagueBtn.onclick = () => this.setActiveTab('compete');
    }

    const openArchiveBtn = document.getElementById('open-archive-btn');
    if (openArchiveBtn) {
        openArchiveBtn.onclick = () => this.setActiveTab('archive');
    }

    // --- ARCHIVE LISTENERS ---
    if (scope === 'archive') {
        const examOpts = document.querySelectorAll('.archive-exam-opt');
        const subSelect = document.getElementById('archive-subject-select');
        const startBtn = document.getElementById('start-archive-session');
        
        let selectedExam = null;
        let selectedSubject = null;
        let selectedYear = null;

        examOpts.forEach(opt => {
            opt.onclick = async () => {
                examOpts.forEach(o => {
                    o.style.borderColor = 'transparent';
                    o.style.background = 'rgba(255,255,255,0.02)';
                });
                opt.style.borderColor = 'var(--accent-secondary)';
                opt.style.background = 'rgba(124, 58, 237, 0.1)';
                selectedExam = opt.dataset.id;
                
                // Unlock subjects
                const subSection = document.getElementById('archive-subject-section');
                subSection.style.opacity = '1';
                subSection.style.pointerEvents = 'auto';
                
                // Load Subjects
                subSelect.innerHTML = '<option value="">Loading Subjects...</option>';
                const { data: subjects } = await DataService.getSubjects();
                subSelect.innerHTML = '<option value="">Select Subject...</option>' + 
                    subjects.map(s => `<option value="${s.id}">${s.subject_name}</option>`).join('');
            };
        });

        subSelect.onchange = async () => {
            selectedSubject = subSelect.value;
            if (!selectedSubject) return;

            const yearSection = document.getElementById('archive-year-section');
            const yearsGrid = document.getElementById('archive-years-grid');
            yearSection.style.opacity = '1';
            yearSection.style.pointerEvents = 'auto';
            
            yearsGrid.innerHTML = '<div style="font-size: 0.7rem; color: var(--text-secondary);">Loading years...</div>';
            const { data: years } = await DataService.getArchiveYears(selectedExam, selectedSubject);
            
            if (years && years.length > 0) {
                yearsGrid.innerHTML = `
                  <div class="archive-year-opt glass-btn" data-year="all" style="padding: 0.5rem; font-size: 0.7rem; font-weight: 800; text-align: center; border-radius: 8px; border: 1px solid var(--glass-border); cursor: pointer;">ALL</div>
                ` + years.map(y => `
                  <div class="archive-year-opt glass-btn" data-year="${y}" style="padding: 0.5rem; font-size: 0.7rem; font-weight: 800; text-align: center; border-radius: 8px; border: 1px solid var(--glass-border); cursor: pointer;">${y}</div>
                `).join('');

                yearsGrid.querySelectorAll('.archive-year-opt').forEach(opt => {
                    opt.onclick = () => {
                        yearsGrid.querySelectorAll('.archive-year-opt').forEach(o => {
                            o.style.background = 'transparent';
                            o.style.borderColor = 'var(--glass-border)';
                        });
                        opt.style.background = 'var(--accent-secondary)';
                        opt.style.borderColor = 'var(--accent-secondary)';
                        selectedYear = opt.dataset.year;
                        
                        startBtn.style.opacity = '1';
                        startBtn.style.pointerEvents = 'auto';
                    };
                });
            } else {
                yearsGrid.innerHTML = '<div style="grid-column: 1/-1; padding: 1rem; background: rgba(239, 68, 68, 0.05); color: #ef4444; font-size: 0.75rem; font-weight: 700; text-align: center; border-radius: 12px;">No past questions found for this combination.</div>';
            }
        };

        startBtn.onclick = async () => {
            startBtn.disabled = true;
            startBtn.textContent = '🚀 PREPARING ARCHIVE...';
            
            const filters = {
                exam_type: selectedExam,
                subject_id: selectedSubject,
                is_past_question: true,
                randomize: true,
                limit: 50
            };
            if (selectedYear !== 'all') filters.exam_year = parseInt(selectedYear);

            const { data: questions, error } = await DataService.getQuestions(filters);
            if (error || !questions || questions.length === 0) {
                ModalService.alert("Archive Empty", "No questions found for this selection yet. We are currently backfilling the archive!", "info");
                startBtn.disabled = false;
                startBtn.textContent = 'START ARCHIVE SESSION';
                return;
            }

            const subName = subSelect.options[subSelect.selectedIndex].text;
            const title = `${selectedExam} ${selectedYear === 'all' ? 'Archive' : selectedYear}`;
            this.onStartExam(questions, 'exam', subName, title, { questionSource: 'past' });
        };
    }
  },

  showDepartmentPicker(profile) {
    const departments = ['Science', 'Arts', 'Commercial', 'General'];
    const currentDept = profile?.department || 'General';
    const pickerOverlay = document.createElement('div');
    pickerOverlay.id = 'dept-picker-overlay';
    pickerOverlay.style = "position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.85); z-index:999999; display:flex; justify-content:center; align-items:center; backdrop-filter:blur(8px);";
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
    `;
    document.body.appendChild(pickerOverlay);
    document.getElementById('close-dept-picker').onclick = () => pickerOverlay.remove();
    pickerOverlay.querySelectorAll('.dept-opt-btn').forEach(btn => {
        btn.onclick = () => {
            const selected = btn.dataset.dept;
            if (selected === currentDept) {
                pickerOverlay.remove();
                return;
            }
            btn.textContent = 'UPDATING...';
            AuthService.updateProfile({ ...profile, department: selected }).then(({ error }) => {
                if (error) { ModalService.alert("Update Failed", error.message, 'error'); return; }
                pickerOverlay.remove();
                location.reload();
            });
        }
    });
  },

  async renderCharts(userId, providedAnalytics = null) {
    if (userId === 'anon') return;
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
      <div style="padding: 0.25rem;">
        <table class="premium-table" style="width:100%; border-collapse:collapse; background: rgba(0,0,0,0.1); border-radius: 12px; overflow: hidden; table-layout: fixed;">
          <thead>
            <tr style="text-align:left; color:var(--text-secondary); font-size:0.6rem; border-bottom: 1px solid var(--glass-border); text-transform: uppercase; letter-spacing: 0.05em;">
              <th style="padding: 0.75rem 0.5rem; width: 50px;">RANK</th>
              <th style="padding: 0.75rem 0.5rem;">STUDENT</th>
              <th style="padding: 0.75rem 0.5rem; text-align:right; width: 85px;">SCORE</th>
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
                  <td style="padding:0.75rem 0.5rem; font-weight: 900; font-size: 0.75rem; color: ${i < 3 ? 'var(--warning)' : 'var(--text-secondary)'}; white-space: nowrap;">${rankIcon}</td>
                  <td style="padding:0.75rem 0.5rem; font-weight:700; font-size: 0.75rem; color: ${isUser ? 'var(--accent-primary)' : 'var(--text-primary)'}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                    <div style="display: flex; align-items: center; gap: 0.35rem;">
                        ${u.username || 'Anon'} 
                        ${userMilestone ? `<i data-lucide="${userMilestone.badge}" title="${userMilestone.title}" style="width: 12px; height: 12px; color: ${userMilestone.color};"></i>` : ''}
                        ${isUser ? '<span style="font-size:0.55rem; opacity:0.6;">(YOU)</span>' : ''}
                    </div>
                  </td>
                  <td style="padding:0.75rem 0.5rem; text-align:right; color: var(--success); font-weight:900; font-size: 0.75rem;">${(entry.total_score || 0).toLocaleString()}</td>
                </tr>
              `
            }).join('')}
          </tbody>
        </table>
        <p style="font-size: 0.65rem; color: var(--text-secondary); text-align: center; margin-top: 1.5rem; font-weight: 600; opacity: 0.8;">Rankings are based on accumulated correct answers.</p>
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
    const globalIndicator = document.getElementById('global-rank-indicator')
    
    if (data && data.length > 0) {
        const myEntry = data.find(u => u.user_id === userId)
        if (myEntry) {
            if (indicator) {
                indicator.textContent = `#${myEntry.rank} of ${data.length} in group`
                if (myEntry.rank <= 10) indicator.style.color = 'var(--success)'
                if (myEntry.rank >= 45) indicator.style.color = 'var(--error)'
            }
        }
    }

    // Also Fetch Global Rank for the small card
    try {
        const { data: globalData } = await DataService.getLeaderboard()
        if (globalIndicator && globalData) {
            // lookup logic was bugged (was looking for d.username which didn't exist at top level)
            // Fix: We updated DataService to include top-level username
            const myGlobalIndex = globalData.findIndex(d => d.username === this.profile.username)
            if (myGlobalIndex !== -1) {
                globalIndicator.textContent = `Score: ${globalData[myGlobalIndex].total_score || 0} (#${myGlobalIndex + 1})`
                globalIndicator.style.color = 'var(--success)'
            } else {
                globalIndicator.textContent = "Unranked (Outside Top 50)"
                globalIndicator.style.color = 'var(--text-secondary)'
            }
        }
    } catch (e) {
        console.warn("Dashboard: Global rank fetch failed", e)
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
    const homeTimerEl = document.getElementById('home-clash-timer')
    
    const timeString = days > 0 ? `${days}d ${hours}h left` : `${hours}h ${mins}m left`;
    
    if (timerEl) timerEl.textContent = timeString;
    if (homeTimerEl) homeTimerEl.textContent = timeString;
    
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

  async showClanRankings() {
    ModalService.showToast("Fetching Clan Rankings...", "info");
    
    try {
        const { data, error } = await DataService.getLatestClashLeaderboard(this.profile.id, this.profile.department);
        
        if (error || !data || data.length === 0) {
            ModalService.alert("Clan Rankings", error || "No recent clan clash data found for your department.", "info");
            return;
        }

        const content = `
            <div style="display: grid; gap: 0.75rem;">
                ${data.map(entry => {
                    const isMe = entry.is_me;
                    const isTop3 = entry.rank <= 3;
                    return `
                        <div class="glass card scale-in" style="padding: 1rem; border-left: 4px solid ${isTop3 ? 'var(--warning)' : 'var(--glass-border)'}; background: ${isMe ? 'rgba(139, 92, 246, 0.08)' : 'rgba(255,255,255,0.02)'};">
                            <div style="display: flex; align-items: center; gap: 1rem;">
                                <div style="width: 24px; font-weight: 900; color: ${isTop3 ? 'var(--warning)' : 'var(--text-secondary)'}; font-size: 0.9rem;">#${entry.rank}</div>
                                <div style="flex: 1;">
                                    <div style="font-weight: 800; color: ${isMe ? 'var(--accent-primary)' : 'var(--text-primary)'}; font-size: 0.95rem;">
                                        ${entry.username || 'Student'} ${isMe ? '<span style="font-size: 0.65rem; opacity: 0.6; margin-left: 4px;">(YOU)</span>' : ''}
                                    </div>
                                    <div style="font-size: 0.65rem; color: var(--text-secondary); font-weight: 700;">${Math.floor(entry.time_taken / 60)}m ${entry.time_taken % 60}s taken</div>
                                </div>
                                <div style="text-align: right;">
                                    <div style="font-family: 'Outfit'; font-weight: 900; color: var(--success); font-size: 1rem;">${entry.score}</div>
                                    <div style="font-size: 0.6rem; color: var(--text-secondary); font-weight: 800; text-transform: uppercase;">SCORE</div>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;

        ModalService.alert("Clan Rankings: " + (this.profile.department || 'General'), content);
    } catch (err) {
        ModalService.alert("Error", "Could not load rankings. Please try again later.", "error");
    }
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
  },

  renderRepairCenter() {
    const count = this.unresolvedMistakeIds.length;
    if (count === 0) return '';

    return `
      <div id="repair-center-section" class="mb-lg">
        <h2 style="font-family: 'Outfit'; font-size: 1.1rem; font-weight: 900; margin-bottom: 0.75rem; display: flex; align-items: center; gap: 0.5rem;">
          <i data-lucide="shield-alert" style="width: 20px; color: #ef4444;"></i> Repair Center
        </h2>
        <div class="glass card scale-in" style="padding: 1.25rem; border: 2px solid #ef4444; background: linear-gradient(135deg, rgba(239, 68, 68, 0.05) 0%, var(--surface-color) 100%); border-radius: 20px;">
          <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem;">
            <div style="background: rgba(239, 68, 68, 0.15); width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; color: #ef4444;">
              <i data-lucide="zap" style="width: 24px;"></i>
            </div>
            <div>
              <div style="font-weight: 900; color: var(--text-primary); font-size: 1rem;">Unresolved Mistakes</div>
              <div style="font-size: 0.75rem; color: #ef4444; font-weight: 800; text-transform: uppercase;">${count} WEAK POINTS</div>
            </div>
          </div>
          <button id="repair-mistakes-btn" class="btn-dominant" style="width: 100%; height: 48px; background: linear-gradient(90deg, #ef4444 0%, #b91c1c 100%); border-radius: 12px; font-weight: 900;">
            FIX MISTAKES NOW
          </button>
        </div>
      </div>
    `;
  },

  renderMasteryPreview() {
    const { weakTopics, strongestSubject } = this.state;
    const weakCount = weakTopics?.length || 0;

    if (weakCount === 0) {
      return `
        <div class="glass card scale-in mb-md" style="padding: 1rem; border-left: 3px solid var(--success); background: rgba(16, 185, 129, 0.03); border-radius: 16px;">
          <div style="display: flex; align-items: center; gap: 0.75rem;">
            <div style="width: 32px; height: 32px; background: rgba(16, 185, 129, 0.15); border-radius: 8px; display: flex; align-items: center; justify-content: center; color: var(--success);">
              <i data-lucide="check-circle" style="width: 18px;"></i>
            </div>
            <div>
              <div style="font-weight: 800; color: var(--text-primary); font-size: 0.9rem;">Mastery Status</div>
              <p style="font-size: 0.75rem; color: var(--text-secondary); margin: 0;">You're doing great. Keep practicing!</p>
            </div>
          </div>
        </div>
      `;
    }

    return `
      <div class="glass card scale-in mb-md" style="padding: 1rem; border-left: 3px solid var(--warning); background: linear-gradient(90deg, rgba(245, 158, 11, 0.05) 0%, transparent 100%); border-radius: 16px;">
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 1rem;">
          <div style="display: flex; align-items: center; gap: 0.75rem;">
            <div style="width: 36px; height: 36px; background: rgba(245, 158, 11, 0.15); border-radius: 10px; display: flex; align-items: center; justify-content: center; color: var(--warning);">
              <i data-lucide="brain-circuit" style="width: 20px;"></i>
            </div>
            <div>
              <div style="font-weight: 900; color: var(--text-primary); font-size: 0.95rem;">Mastery Preview</div>
              <div style="display: flex; align-items: center; gap: 0.5rem; margin-top: 0.1rem; flex-wrap: wrap;">
                <span class="badge" style="background: rgba(245, 158, 11, 0.2); color: #f59e0b; font-size: 0.6rem; padding: 0.1rem 0.4rem; border: 1px solid rgba(245, 158, 11, 0.3); font-weight: 800;">
                  ${weakCount} WEAK TOPICS
                </span>
                ${strongestSubject ? `<span style="font-size: 0.65rem; color: var(--text-secondary); font-weight: 600;">Strongest in ${strongestSubject.subject}</span>` : ''}
              </div>
            </div>
          </div>
          <button id="home-improve-btn" class="glass-btn" style="padding: 0.5rem 0.85rem; font-size: 0.75rem; color: var(--accent-primary); border-color: rgba(139, 92, 246, 0.3); white-space: nowrap;">
            Improve Now →
          </button>
        </div>
      </div>
    `;
  },

  renderMasteryCenter() {
    const { weakTopics } = this.state;
    
    if (!weakTopics || weakTopics.length === 0) {
      return `
        <div class="glass card mb-lg" style="padding: 2rem 1.5rem; text-align: center; border: 1.5px dashed var(--glass-border); border-radius: 20px;">
          <div style="width: 48px; height: 48px; background: rgba(16, 185, 129, 0.1); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: var(--success); margin: 0 auto 1rem;">
            <i data-lucide="shield-check" style="width: 24px;"></i>
          </div>
          <h3 style="font-weight: 900; color: var(--text-primary); margin: 0 0 0.5rem;">Elite Performance</h3>
          <p style="font-size: 0.85rem; color: var(--text-secondary); margin: 0;">No weak areas detected. Maintain your streak and keep pushing!</p>
        </div>
      `;
    }

    return `
      <div id="mastery-center-section" class="glass card scale-in mb-lg" style="padding: 1.5rem; display: flex; justify-content: space-between; align-items: center; border-left: 4px solid var(--accent-secondary); border-radius: 16px;">
        <div>
          <h3 style="font-family: 'Outfit'; font-size: 1.1rem; font-weight: 900; margin: 0 0 0.25rem; display: flex; align-items: center; gap: 0.5rem; color: var(--text-primary);">
            <i data-lucide="brain" style="width: 20px; color: var(--accent-secondary);"></i> Mastery Center
          </h3>
          <p style="font-size: 0.75rem; color: var(--text-secondary); margin: 0;">${weakTopics.length} weak areas detected.</p>
        </div>
        <button id="open-mastery-modal-btn" class="btn-primary" style="padding: 0.5rem 1rem; font-size: 0.8rem; border-radius: 12px; font-weight: 800;">
          OPEN
        </button>
      </div>
    `;
  },

  showHistory() {
    SessionsHistoryComponent.render(this.profile, () => {
        // The SessionsHistoryComponent handles restoring the dashboard container display.
        // We can just optionally refresh if needed.
    });
  },

  showMasteryModal() {
    const { weakTopics } = this.state;
    if (!weakTopics || weakTopics.length === 0) return;

    const topTopics = weakTopics.slice(0, 5); // Show top 5 weak areas

    const content = `
        <div style="display: grid; gap: 0.75rem;">
          ${topTopics.map(t => {
            const priority = MasteryEngine.getPriorityLabel(t.accuracy);
            return `
              <div class="glass card scale-in" style="padding: 1rem; border-left: 4px solid ${priority.class === 'critical' ? 'var(--error)' : 'var(--warning)'}; background: linear-gradient(135deg, rgba(255,255,255,0.02) 0%, transparent 100%); border-radius: 16px;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem; gap: 1rem;">
                  <div>
                    <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem; flex-wrap: wrap;">
                      <span style="font-size: 0.6rem; font-weight: 900; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em;">${t.subject}</span>
                      <span class="badge ${priority.class}" style="font-size: 0.55rem; padding: 0.1rem 0.4rem;">${priority.label}</span>
                    </div>
                    <div style="font-weight: 800; color: var(--text-primary); font-size: 0.95rem; line-height: 1.3;">${t.topic}</div>
                  </div>
                  <div style="text-align: right; white-space: nowrap;">
                    <div style="font-family: 'Outfit'; font-weight: 900; font-size: 1.1rem; color: ${priority.class === 'critical' ? 'var(--error)' : 'var(--warning)'};">${t.accuracy}%</div>
                    <div style="font-size: 0.6rem; color: var(--text-secondary); font-weight: 700;">${t.attempts} attempts</div>
                  </div>
                </div>
                
                <button class="practice-topic-btn btn-primary" data-topic="${t.topic}" data-subject="${t.subject}" style="width: 100%; height: 36px; font-size: 0.8rem; font-weight: 800; border-radius: 10px;">
                  Practice Topic →
                </button>
              </div>
            `;
          }).join('')}
        </div>
    `;

    ModalService.alert("Mastery Center", content);

    // Re-attach listeners for the buttons inside the modal
    setTimeout(() => {
        const practiceTopicBtns = document.querySelectorAll('.practice-topic-btn');
        practiceTopicBtns.forEach(btn => {
            btn.onclick = async (e) => {
                const topic = btn.dataset.topic;
                const subject = btn.dataset.subject;
                
                ModalService.closeModal(); // Close the modal
                ModalService.showToast(`Loading ${topic} Practice...`, 'info');
                
                // 1. Fetch Subject Object to get ID
                const { data: subjects } = await DataService.getSubjects();
                const subjectObj = subjects.find(s => s.subject_name === subject);
                
                if (!subjectObj) {
                    ModalService.alert("Subject Not Found", `Could not find subject: ${subject}`, 'error');
                    return;
                }

                // 2. Fetch Questions with Topic filter
                const { data: questions, error } = await DataService.getQuestions({
                    subject_id: subjectObj.id,
                    topic: topic,
                    limit: 10,
                    randomize: true
                });

                if (error || !questions || questions.length === 0) {
                    ModalService.alert("Topic Error", `No active questions found for ${topic}. Try another topic!`, 'warning');
                    return;
                }

                // 3. Start Exam (Practice Mode)
                this.onStartExam(questions, 'practice', subject, topic);
            };
        });
    }, 100);
  },

  renderDailyMission() {
    const { dailyMission } = this.state;
    if (!dailyMission || dailyMission.totalCount === 0) return '';

    return `
      <div id="daily-mission-card" class="glass card scale-in mb-lg" style="padding: 1.5rem; border: 1px solid rgba(37, 99, 235, 0.4); background: linear-gradient(135deg, rgba(37, 99, 235, 0.08) 0%, var(--surface-color) 100%); border-radius: 20px; position: relative; overflow: hidden; box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12);">
        
        <div style="display: flex; align-items: center; gap: 0.6rem; margin-bottom: 1rem;">
          <div style="width: 8px; height: 8px; border-radius: 50%; background: var(--accent-primary); box-shadow: 0 0 10px var(--accent-primary);"></div>
          <span style="font-size: 0.7rem; color: var(--accent-primary); font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em;">AI Daily Path</span>
        </div>
        
        <h2 style="font-family: 'Outfit'; font-size: 1.4rem; font-weight: 800; color: var(--text-primary); margin: 0 0 0.5rem; line-height: 1.2;">Today's Mission</h2>
        <p style="font-size: 0.8rem; color: var(--text-secondary); margin: 0 0 1.5rem; max-width: 100%; line-height: 1.4;">
          Master your weakest areas with a personalized mix of <strong style="color: var(--text-primary);">${dailyMission.totalCount} high-priority questions.</strong>
        </p>
        
        <button id="start-mission-btn" class="btn-primary" style="width: 100%; height: 48px; font-size: 0.95rem; font-weight: 800; border-radius: 12px; display: flex; align-items: center; justify-content: center; gap: 0.5rem; transition: all 0.2s ease;">
          <i data-lucide="play" style="width: 18px; fill: currentColor;"></i> START MISSION
        </button>
      </div>
    `;
  },

  async handleDailyMission() {
    const { dailyMission } = this.state;
    if (!dailyMission) return;

    ModalService.showToast("Assembling your mission...", "info");

    try {
        let allQuestions = [];

        // 1. Fetch Topic Questions
        for (const t of dailyMission.topics) {
            const { data: subjects } = await DataService.getSubjects();
            const subjectObj = subjects.find(s => s.subject_name === t.subject);
            if (subjectObj) {
                const { data: q } = await DataService.getQuestions({
                    subject_id: subjectObj.id,
                    topic: t.topic,
                    limit: t.limit,
                    randomize: true
                });
                if (q) allQuestions = [...allQuestions, ...q];
            }
        }

        // 2. Fetch Mistake Questions and normalise through the same formatter
        if (dailyMission.mistakes.length > 0) {
            const { data: mq } = await supabase
                .from('questions')
                .select('*, subjects(subject_name), question_answers(*), question_explanations(explanation), question_groups(*)')
                .in('id', dailyMission.mistakes);
            if (mq) allQuestions = [...allQuestions, ...DataService._formatQuestions(mq)];
        }

        if (allQuestions.length === 0) {
            ModalService.alert("Mission Empty", "Not enough data yet. Complete more practice sessions to unlock your Daily Mission!", "info");
            return;
        }

        // 3. Start Exam
        this.onStartExam(allQuestions, 'mission', "Today's Mission", "Personalized Path");

    } catch (err) {
        console.error("Daily Mission Failed:", err);
        ModalService.alert("Mission Error", "Could not assemble your mission. Please try again later.", "error");
    }
  },

  async handleFlashcardsReview() {
    ModalService.showToast("Fetching cards...", "info");
    try {
        const { data: cards } = await supabase
            .from('flashcards')
            .select('*, questions(*, subjects(subject_name), question_answers(*), question_explanations(explanation), question_groups(*))')
            .eq('user_id', this.profile.id)
            .eq('status', 'active')
            .lte('next_review_at', new Date().toISOString())
            .limit(10);

        if (!cards || cards.length === 0) {
            ModalService.alert("No Cards Due", "You're all caught up! New cards will appear as you make mistakes in practice.", "info");
            return;
        }

        const questions = cards.map(c => ({
            ...DataService._formatQuestions([c.questions])[0],
            flashcardId: c.id
        }));

        this.onStartExam(questions, 'review', "Active Review", "SRS Flashcards");

    } catch (err) {
        console.error("SRS fetch failed:", err);
        ModalService.alert("Error", "Could not load flashcards. Try again later.", "error");
    }
  }
}
