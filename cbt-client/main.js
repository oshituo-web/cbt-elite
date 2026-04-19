import { AuthService } from './src/services/auth'
import { AuthComponent } from './src/components/Auth'
import { ProfileSetupComponent } from './src/components/ProfileSetup'
import { DashboardComponent } from './src/components/Dashboard'
import { PracticeDashboardComponent } from './src/components/PracticeDashboard'
import { ExamsDashboardComponent } from './src/components/ExamsDashboard'
import { SettingsComponent } from './src/components/Settings'
import { ExamComponent } from './src/components/Exam'
import { ResultsComponent } from './src/components/Results'
import { AdminComponent } from './src/components/Admin'
import { NewsArticleComponent } from './src/components/NewsArticle'
import { AnalyticsComponent } from './src/components/Analytics'
import { WeeklyRecapComponent } from './src/components/WeeklyRecap'
import { TopicDeepDiveComponent } from './src/components/TopicDeepDive'
import { IndexedDbService } from './src/services/indexedDbService'
import { DataService } from './src/services/data'
import { TourGuide } from './src/utils/TourGuide'
import './src/styles/main.css'

let dashboardLoaded = false;
let currentProfile = null;

/**
 * 🧭 Centralized URL-based Navigation Handler
 */
window.navigateTo = function(view, profile = currentProfile, pushState = true) {
  if (!view || !profile) return;
  
  // 1. Update active states and handle routing metadata
  const pathMap = {
    'dashboard': '/dashboard',
    'exams': '/exams',
    'practice': '/practice',
    'admin': '/admin',
    'settings': '/settings',
    'profile': '/profile',
    'analytics': '/analytics'
  };

  const path = pathMap[view] || '/dashboard';
  if (pushState) {
    history.pushState({ view, profileId: profile.id }, '', path);
  }
  
  // 1. Close all drawers/overlays first to ensure clean state
  const moreDrawer = document.getElementById('more-drawer');
  const newsDrawer = document.getElementById('news-drawer');
  const overlay = document.getElementById('sidebar-overlay');
  
  if (view !== 'more') {
    if (moreDrawer) moreDrawer.classList.remove('active');
    if (overlay) overlay.classList.remove('active');
  }

  // 2. Update Active State for all navigation elements
  const allNavItems = document.querySelectorAll('.nav-item, .bottom-nav-item, .more-menu-item');
  allNavItems.forEach(item => {
    item.classList.toggle('active', item.dataset.view === view);
  });


  // 3. Handle Modular Views
  switch (view) {
    case 'dashboard':
      showDashboard(profile);
      break;
      
    case 'admin':
      showAdmin(profile);
      break;
      
    case 'exams':
      showExamsDashboard(profile);
      break;

    case 'practice':
      showPracticeDashboard(profile);
      break;
      
    case 'profile':
      showDashboard(profile);
      // Logic remained same but now it's a dedicated URL /profile
      break;
      
    case 'settings':
      showSettings(profile);
      break;
      
    case 'analytics':
      showAnalytics(profile);
      break;
      
    case 'recap':
      showWeeklyRecap(profile);
      break;
      
    case 'more':
      toggleMoreDrawer();
      break;
      
    case 'logout':
      if (confirm('Are you sure you want to sign out?')) {
        AuthService.signOut().then(() => {
           history.pushState(null, '', '/');
           location.reload();
        });
      }
      break;
      
    default:
      showDashboard(profile);
  }
}

// Global popstate for browser back/forward buttons
window.onpopstate = (event) => {
  if (event.state && event.state.view) {
    window.navigateTo(event.state.view, currentProfile, false);
  } else {
    // Fallback to initial route
    handleInitialRoute(currentProfile);
  }
};

function showExamsDashboard(profile) {
   currentProfile = profile;
   hideAll();
   ExamsDashboardComponent.render(profile, (questions, mode, subject, examType, intendedSubjects = []) => {
     showExam(questions, profile, false, {}, mode, subject, examType, null, intendedSubjects);
   });
}

function showPracticeDashboard(profile) {
  currentProfile = profile;
  hideAll();
  PracticeDashboardComponent.render(profile, (questions, mode, subject, examType) => {
    showExam(questions, profile, false, {}, mode, subject, examType);
  });
}

function showSettings(profile) {
   currentProfile = profile;
   hideAll();
   SettingsComponent.render(profile, () => window.navigateTo('dashboard', profile));
}

function handleInitialRoute(profile) {
  const path = window.location.pathname;
  if (path === '/exams') window.navigateTo('exams', profile, false);
  else if (path === '/practice') window.navigateTo('practice', profile, false);
  else if (path === '/admin' && (profile.role === 'admin' || profile.role === 'super-admin')) window.navigateTo('admin', profile, false);
  else if (path === '/settings') window.navigateTo('settings', profile, false);
  else window.navigateTo('dashboard', profile, false);
}

function toggleMoreDrawer() {
  const drawer = document.getElementById('more-drawer');
  const overlay = document.getElementById('sidebar-overlay');
  if (drawer && overlay) {
    drawer.classList.toggle('active');
    overlay.classList.toggle('active');
  }
}

async function initApp() {
  // 🧭 0. GLOBAL ERROR LOGGING
  window.onerror = (msg, url, lineNo, columnNo, error) => {
    console.error(`[Global Error] ${msg} at ${lineNo}:${columnNo}`, error);
    return false;
  };

  try {
    // 1. RENDER ICONS AND SETUP GLOBAL ACTIONS (with retry for async CDN)
    const initIcons = () => {
      if (window.lucide) {
        window.lucide.createIcons();
      } else {
        setTimeout(initIcons, 100);
      }
    };
    initIcons();

    // This prevents WSOD if Supabase hangs or a cross-origin error occurs
    const header = document.getElementById('app-header');
    const sidebar = document.getElementById('app-sidebar');
    const bottomNav = document.getElementById('bottom-nav');
    
    if (header) header.style.display = 'flex';
    if (sidebar) sidebar.style.display = 'flex';
    if (bottomNav) bottomNav.style.display = 'flex';

    // Global Theme Initialization
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.body.classList.toggle('light-mode', savedTheme === 'light');
    
    // Register event listeners immediately
    setupGlobalActions({ username: 'Student' });

    // Setup Offline Listeners
    window.addEventListener('online', () => syncOfflineData());
    syncOfflineData(); 

    // 🔐 2. START AUTH FLOW (Progressive)
    console.log("main.js: Checking current user...")
    const user = await AuthService.getCurrentUser();
    console.log("main.js: Current user result:", user ? user.id : "No user")
    
    if (!user) {
      console.log("main.js: Showing Auth")
      showAuth();
      return;
    }

    if (!user?.id) {
      console.error("User identified but ID missing. Re-authenticating.");
      showAuth();
      return;
    }

    try {
        console.log("main.js: Fetching profile for", user.id)
        const { data: profile } = await AuthService.getProfile(user.id);
        console.log("main.js: Profile found:", profile ? profile.username : "No profile data")
        
        // Re-setup actions with real data
        setupGlobalActions(profile || { id: user.id, username: 'Student' });

        if (!profile || !profile.username) {
            console.log("main.js: Profile incomplete, showing setup")
            showProfileSetup(user);
        } else {
            console.log("main.js: Profile ready, updating UI and routing")
            updateHeaderProfile(profile);
            handleInitialRoute(profile);
        }
        
        // Broadcast check can happen in background
        checkBroadcast();
    } catch (profileError) {
        console.error("Profile fetch crashed:", profileError);
        showDashboard({ id: user.id, username: 'Student' });
    }

  } catch (globalError) {
    console.error("GLOBAL INIT CRASH:", globalError);
    // If we crash at the very top, at least show the auth if not logged in
    showAuth();
  }
}

function updateHeaderProfile(profile) {
  const avatar = document.getElementById('header-avatar')
  const username = document.getElementById('header-username')
  const adminBtn = document.getElementById('sidebar-admin-btn')
  const streakHeader = document.getElementById('header-streak')
  const tierHeader = document.getElementById('header-tier')

  const streakText = document.getElementById('streak-text')
  const tierText = document.getElementById('tier-text')

  if (avatar) avatar.textContent = profile.username.charAt(0).toUpperCase()
  if (username) username.textContent = profile.username
  
  const isAdmin = profile.role === 'admin' || profile.role === 'super-admin';
  if (adminBtn) adminBtn.style.display = isAdmin ? 'flex' : 'none'
  
  const bottomAdminBtn = document.getElementById('bottom-admin-btn');
  if (bottomAdminBtn) bottomAdminBtn.style.display = isAdmin ? 'flex' : 'none'
  
  if (streakText) streakText.textContent = `${profile.streak_count || 0}`
  
  if (tierHeader) {
    const tier = profile.activation_status ? 'PREMIUM' : (profile.tier || 'FREE').toUpperCase()
    if (tierText) tierText.textContent = tier
    tierHeader.style.background = tier === 'PREMIUM' ? 'var(--accent-secondary)' : 'rgba(255,255,255,0.05)'
  }

  // Check for new notifications
  initNotifications(profile)

  // Setup Navigation Listeners once
  setupNavigation(profile)
}

function setupGlobalActions(profile) {
  // 1. Sidebar Toggle
  const sidebarToggle = document.getElementById('sidebar-toggle')
  const sidebar = document.getElementById('app-sidebar')
  const sidebarAdminBtn = document.getElementById('sidebar-admin-btn')
  if (sidebarAdminBtn && profile.role !== 'admin' && profile.role !== 'super-admin') {
    sidebarAdminBtn.style.display = 'none'
  }
  
  const bottomAdminBtn = document.getElementById('bottom-admin-btn');
  if (bottomAdminBtn && profile.role !== 'admin' && profile.role !== 'super-admin') {
    bottomAdminBtn.style.display = 'none'
  }

  // 9. Attach Global News Action
  const newsBtn = document.getElementById('global-news-btn')
  const newsDrawer = document.getElementById('news-drawer')
  const closeNewsBtn = document.getElementById('close-news-drawer')

  if (newsBtn && newsDrawer && !newsBtn.dataset.init) {
    newsBtn.dataset.init = "true"
    newsBtn.onclick = async () => {
      const isActive = newsDrawer.classList.contains('active')
      const overlay = document.getElementById('sidebar-overlay');
      
      if (isActive) {
        newsDrawer.classList.remove('active');
        if (overlay) overlay.classList.remove('active');
      } else {
        // Close other drawers first
        window.navigateTo('dashboard'); // Helper to clean state
        newsDrawer.classList.add('active');
        if (overlay) overlay.classList.add('active');
        
        // Fetch and Render News
        const contentArea = document.getElementById('news-drawer-content')
        if (contentArea) {
           contentArea.innerHTML = '<div style="display:flex;justify-content:center;padding:2rem;"><div class="loader-spinner"></div></div>'
           try {
               const { DataService } = await import('./src/services/data')
               const { data: newsItems } = await DataService.getNewsUpdates(15)
               
               if (!newsItems || newsItems.length === 0) {
                 contentArea.innerHTML = '<p style="padding: 1.5rem; text-align: center; color: var(--text-secondary);">No new updates at this time.</p>'
               } else {
                 contentArea.innerHTML = newsItems.map(item => `
                   <div class="news-item-card glass" style="margin-bottom: 0.75rem; padding: 1rem; cursor: pointer; border-left: 3px solid var(--accent-primary);" data-news-id="${item.id}">
                      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
                         <span style="font-size: 0.65rem; font-weight: 800; color: var(--accent-primary); text-transform: uppercase;">${item.category || 'EXAM UPDATE'}</span>
                         <span style="font-size: 0.65rem; color: var(--text-secondary);">${new Date(item.created_at).toLocaleDateString()}</span>
                      </div>
                      <h4 style="font-size: 0.9rem; margin: 0; color: var(--text-primary); line-height: 1.4;">${item.title}</h4>
                      <p style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.5rem; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${item.content.replace(/<[^>]*>/g, '').substring(0, 100)}...</p>
                   </div>
                 `).join('')

                 contentArea.querySelectorAll('.news-item-card').forEach(card => {
                   card.onclick = () => {
                     const nid = card.dataset.newsId
                     if (nid) {
                       newsDrawer.classList.remove('active')
                       if (overlay) overlay.classList.remove('active');
                       import('./src/components/NewsArticle').then(({ NewsArticleComponent }) => {
                         const dash = document.getElementById('dashboard-container')
                         if (dash) dash.style.display = 'none'
                         // 🔥 FIX: Pass ID, not object
                         NewsArticleComponent.render(nid, () => {
                           if (dash) dash.style.display = 'block'
                         })
                       })
                     }
                   }
                 })
                 
                 const seenIds = JSON.parse(localStorage.getItem('seen_news_ids') || '[]')
                 const newIds = newsItems.map(n => n.id)
                 const updatedSeen = [...new Set([...seenIds, ...newIds])]
                 localStorage.setItem('seen_news_ids', JSON.stringify(updatedSeen))
                 updateBellState(0)
               }
           } catch (err) {
               console.error("News load error:", err)
               contentArea.innerHTML = '<p style="padding: 1.5rem; text-align: center; color: var(--error);">Failed to load news updates.</p>'
           }
        }
      }
    }
  }

  if (closeNewsBtn) {
    closeNewsBtn.onclick = () => {
      newsDrawer.classList.remove('active');
      const overlay = document.getElementById('sidebar-overlay');
      if (overlay) overlay.classList.remove('active');
    };
  }

  // 10. More Drawer Handlers
  const moreDrawer = document.getElementById('more-drawer');
  const closeMoreBtn = document.getElementById('close-more-drawer');
  if (closeMoreBtn) closeMoreBtn.onclick = () => toggleMoreDrawer();
  
  const moreNewsBtn = document.getElementById('more-news-btn');
  if (moreNewsBtn) {
    moreNewsBtn.onclick = () => {
      toggleMoreDrawer();
      setTimeout(() => newsBtn?.click(), 300);
    }
  }
  // Wire up Logout button in More drawer
  const moreLogoutBtn = document.getElementById('more-logout-btn');
  if (moreLogoutBtn) {
    moreLogoutBtn.onclick = () => {
      toggleMoreDrawer();
      setTimeout(() => window.navigateTo('logout', profile), 300);
    }
  }

  // Wire up Contact Us button in More drawer
  const moreContactBtn = document.getElementById('more-contact-btn');
  if (moreContactBtn && !moreContactBtn.dataset.init) {
    moreContactBtn.dataset.init = "true";
    moreContactBtn.onclick = (e) => {
      e.preventDefault();
      toggleMoreDrawer();
      const subject = encodeURIComponent(`Inquiry from ${profile?.username || 'User'}`);
      const body = encodeURIComponent(`Hello CBT Elite Team,\n\n[Your message here]\n\nRegards,\n${profile?.username || 'User'}`);
      window.location.href = `mailto:cbtellite@gmail.com?subject=${subject}&body=${body}`;
    }
  }

  // Wire up About Us button in More drawer
  const moreAboutBtn = document.getElementById('more-about-btn');
  if (moreAboutBtn && !moreAboutBtn.dataset.init) {
    moreAboutBtn.dataset.init = "true";
    moreAboutBtn.onclick = (e) => {
      e.preventDefault();
      toggleMoreDrawer();
      showAboutModal();
    }
  }

  // Wire up Help button in More drawer
  const moreHelpBtn = document.getElementById('more-help-btn');
  if (moreHelpBtn) {
    moreHelpBtn.onclick = () => {
      toggleMoreDrawer();
      setTimeout(() => TourGuide.start(profile), 300);
    }
  }


  // Handle clicks on items inside More Drawer (Profile, Settings)
  const moreMenuItems = document.querySelectorAll('.more-menu-item[data-view]');
  moreMenuItems.forEach(item => {
    item.onclick = (e) => {
      const view = item.dataset.view;
      toggleMoreDrawer();
      setTimeout(() => window.navigateTo(view, profile), 300);
    }
  });

  // Sidebar overlay (click to close all)
  const sidebarOverlay = document.getElementById('sidebar-overlay');
  if (sidebarOverlay) {
    sidebarOverlay.onclick = () => {
      newsDrawer?.classList.remove('active');
      moreDrawer?.classList.remove('active');
      sidebarOverlay.classList.remove('active');
      document.getElementById('app-sidebar')?.classList.remove('active');
    };
  }

  
  if (sidebarToggle && sidebar && !sidebarToggle.dataset.init) {
    sidebarToggle.dataset.init = "true"
    sidebarToggle.onclick = () => {
      sidebar.classList.toggle('collapsed')
    }
  }

  // 2. Global Theme Toggle
  const themeToggle = document.getElementById('global-theme-toggle')
  if (themeToggle && !themeToggle.dataset.init) {
    themeToggle.dataset.init = "true"
    themeToggle.onclick = () => {
      document.body.classList.toggle('light-mode')
      localStorage.setItem('theme', document.body.classList.contains('light-mode') ? 'light' : 'dark')
    }
  }

  // 3. Global Help Guide
  const helpBtn = document.getElementById('global-help-btn')
  if (helpBtn && !helpBtn.dataset.init) {
    helpBtn.dataset.init = "true"
    helpBtn.onclick = () => {
      TourGuide.start(profile)
    }
  }
}

function setupNavigation(profile) {
  currentProfile = profile; 
  // Only target elements with data-view to prevent overwriting specific handlers
  const navItems = document.querySelectorAll('.nav-item[data-view], .bottom-nav-item[data-view], .more-menu-item[data-view]')
  navItems.forEach(item => {
    item.onclick = (e) => {
      e.preventDefault();
      const view = item.dataset.view
      if (view) {
        // If it's a more-menu-item, close the drawer first
        if (item.classList.contains('more-menu-item')) {
          toggleMoreDrawer();
        }
        window.navigateTo(view, profile);
      }
    }
  })

  // Wire up both logout buttons
  const logoutBtns = ['logout-btn', 'more-logout-btn'];
  logoutBtns.forEach(id => {
    const btn = document.getElementById(id);
    if (btn) {
      btn.onclick = async () => {
        if (confirm('Are you sure you want to sign out?')) {
          await AuthService.signOut()
          location.reload()
        }
      }
    }
  });
}

function showAuth() {
  hideAll()
  AuthComponent.render((user) => {
    AuthComponent.hide()
    initApp()
  })
}

function showProfileSetup(user) {
  hideAll()
  ProfileSetupComponent.render(user, (profile) => {
    AuthComponent.hide()
    showDashboard(profile)
  })
}

function showDashboard(profile) {
   console.log("main.js: showDashboard called for", profile?.username)
   currentProfile = profile
   const dashContainer = document.getElementById('dashboard-container')
   
   hideAll()
   dashContainer.style.display = 'block'
  
  // Initialize Notifications
  initNotifications(profile)
  
  // Finalize Dashboard rendering
  DashboardComponent.render(profile, (questions, mode, subject, examType, extraConfig = null) => {
    DashboardComponent.hide()
    const resumeState = extraConfig?.resumeState || null;
    const intendedSubjects = extraConfig?.intendedSubjects || [];
    const clashId = extraConfig?.clashId || null;
    showExam(questions, profile, false, {}, mode, subject, examType, resumeState, intendedSubjects, clashId)
  }, () => {
    DashboardComponent.hide()
    showAdmin(profile)
  }, (article) => {
    showNewsArticle(article, profile)
  })
  
  dashboardLoaded = true
}

function showAnalytics(profile) {
  currentProfile = profile;
  hideAll();
  AnalyticsComponent.render(profile, 
    () => window.navigateTo('dashboard', profile),
    (questions, mode, subject, examType) => showExam(questions, profile, false, {}, mode, subject, examType)
  );
}

async function showWeeklyRecap(profile) {
  currentProfile = profile;
  // Fetch real data for the recap
  const { mastery, stats } = await DataService.getUserAnalytics(profile.id);
  WeeklyRecapComponent.render(null, stats, mastery);
}

function showNewsArticle(article, profile) {
  hideAll()
  NewsArticleComponent.render(article, () => showDashboard(profile))
}

function showAdmin(profile) {
  hideAll()
  AdminComponent.render(profile, () => showDashboard(profile))
  
  // Mark sidebar active
  document.querySelectorAll('[data-view]').forEach(v => v.classList.remove('active'))
  document.querySelectorAll('[data-view="admin"]').forEach(v => v.classList.add('active'))
}

function showExam(questions, profile, isReview = false, pastAnswers = {}, mode = 'practice', subject = '', examType = '', resumeState = null, intendedSubjects = [], clashId = null) {
  hideAll(true) // Pass true to hide layout for focus
  ExamComponent.render(questions, profile, (userAnswers, timeTaken, actualQuestions, cid) => {
    showResults(actualQuestions || questions, userAnswers, profile, mode, subject, examType, timeTaken, cid)
  }, isReview, pastAnswers, mode, subject, examType, () => showDashboard(profile), resumeState, intendedSubjects, clashId)
}

function showResults(questions, userAnswers, profile, mode = 'practice', subject = '', examType = '', timeTaken = 0, clashId = null) {
  hideAll()
  ResultsComponent.render(questions, userAnswers, (newQs, newMode, newSubj, newExam) => {
    showExam(newQs || questions, profile, false, {}, newMode || mode, newSubj || subject, newExam || examType) // Retake same questions or load custom focus questions
  }, () => {
    showExam(questions, profile, true, userAnswers, mode, subject, examType) // Review mode
  }, profile, mode, subject, examType, timeTaken, () => showDashboard(profile))
}

function hideAll(isExam = false) {
  const containers = [
    'auth-container', 'dashboard-container', 'exam-container', 
    'admin-container', 'settings-container', 'news-article-container',
    'practice-container', 'exams-container', 'analytics-container'
  ];
  
  containers.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });

  const gl = document.getElementById('global-loader');
  if (gl) gl.style.display = 'none';

  // Close News Drawer on any navigation
  const newsDrawer = document.getElementById('news-drawer')
  if (newsDrawer) newsDrawer.classList.remove('active')

  // Layout Visibility
  const header = document.getElementById('app-header')
  const sidebar = document.getElementById('app-sidebar')
  const bottomNav = document.getElementById('bottom-nav')
  const isAuth = document.getElementById('auth-container').style.display !== 'none'
  
  if (isExam || isAuth) {
    if (header) header.style.display = 'none'
    if (sidebar) sidebar.style.display = 'none'
    if (bottomNav) bottomNav.style.display = 'none'
    document.body.classList.add('in-exam')
  } else {
    if (header) header.style.display = 'flex'
    if (sidebar) sidebar.style.display = 'flex'
    if (bottomNav) bottomNav.style.display = 'flex'
    document.body.classList.remove('in-exam')
  }
}

async function checkBroadcast() {
    try {
        const { DataService } = await import('./src/services/data')
        const { data: config } = await DataService.getSystemConfig('broadcast_message')
        
        let banner = document.getElementById('global-broadcast-banner')
        if (config && config.value && config.value.trim()) {
            if (!banner) {
                banner = document.createElement('div')
                banner.id = 'global-broadcast-banner'
                banner.className = 'broadcast-banner'
                const appRoot = document.getElementById('app')
                if (appRoot) appRoot.prepend(banner)
                else document.body.prepend(banner)
            }
            banner.innerHTML = `
                <div class="banner-content">
                    <span class="banner-icon">📢</span>
                    <span class="banner-text">${config.value}</span>
                    <button class="banner-close" onclick="this.parentElement.parentElement.remove()">✕</button>
                </div>
            `
        } else if (banner) {
            banner.remove()
        }
    } catch (e) {
        console.error("Broadcast check failed", e)
    }
}
async function initNotifications(profile) {
    if (!profile) return
    try {
        const { DataService } = await import('./src/services/data')
        const { data: newsItems } = await DataService.getNewsUpdates(5)
        if (!newsItems) return

        const seenIds = JSON.parse(localStorage.getItem('seen_news_ids') || '[]')
        const unseenCount = newsItems.filter(item => !seenIds.includes(item.id)).length
        
        updateBellState(unseenCount)
    } catch (e) {
        console.warn("Notification check failed:", e)
    }
}

function updateBellState(count) {
    const badge = document.getElementById('notification-badge')
    if (!badge) return
    
    if (count > 0) {
        badge.textContent = count > 9 ? '9+' : count
        badge.style.display = 'flex'
    } else {
        badge.style.display = 'none'
    }
}

async function syncOfflineData() {
    try {
        const { IndexedDbService } = await import('./src/services/indexedDbService')
        const { DataService } = await import('./src/services/data')
        const sessions = await IndexedDbService.getUnsyncedSessions()
        if (sessions.length === 0) return

        console.log(`[Sync] Found ${sessions.length} unsynced sessions. Uploading...`)
        let successCount = 0
        
        for (const session of sessions) {
            const { error } = await DataService.saveExamSession(
                session.userId, 
                session.sessionData, 
                session.questions, 
                session.userAnswers,
                true // isSyncing flag
            )
            
            if (!error) {
                await IndexedDbService.markSessionSynced(session.id)
                successCount++
            }
        }

        if (successCount > 0) {
            console.log(`[Sync] Successfully uploaded ${successCount} sessions.`)
        }
    } catch (e) {
        console.warn("[Sync] Background sync failed:", e)
    }
}

initApp();

function showAboutModal() {
  const existing = document.getElementById('about-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'about-modal';
  modal.className = 'modal-overlay';
  modal.style.display = 'flex';
  modal.style.zIndex = '10000';

  modal.innerHTML = `
    <div class="modal-content glass" style="width: min(600px, 92vw); max-height: 85vh; overflow-y: auto; padding: 0; border-radius: 24px;">
      <div style="background: var(--primary); padding: 2rem; color: white; position: relative;">
        <h2 style="font-family: 'Outfit'; font-weight: 900; margin-bottom: 0.5rem;">About CBT Elite</h2>
        <p style="opacity: 0.9; font-weight: 500;">The Future of Exam Preparation</p>
        <button id="close-about-modal" style="position: absolute; top: 1.5rem; right: 1.5rem; background: rgba(255,255,255,0.2); border: none; color: white; width: 32px; height: 32px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 1.2rem;">&times;</button>
      </div>
      <div style="padding: 2.5rem; color: var(--text-primary);">
        <div style="margin-bottom: 2rem;">
          <h3 style="color: var(--accent-primary); font-family: 'Outfit'; margin-bottom: 1rem;">Our Mission</h3>
          <p style="line-height: 1.7; font-size: 1.05rem; color: var(--text-secondary);">CBT Elite is Nigeria's most advanced examination preparation platform. We specialize in providing high-quality, AI-powered study tools for JAMB, WAEC, and NECO candidates. Our mission is to empower students with the technology they need to excel in their academic pursuits through realistic simulations and deep analytics.</p>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.5rem; margin-bottom: 2rem;">
          <div class="glass card" style="padding: 1.25rem; border: 1px solid var(--glass-border);">
            <h4 style="margin-bottom: 0.5rem; color: var(--primary);">AI-Powered</h4>
            <p style="font-size: 0.9rem; color: var(--text-secondary);">Personalized explanations and performance tracking driven by advanced AI.</p>
          </div>
          <div class="glass card" style="padding: 1.25rem; border: 1px solid var(--glass-border);">
            <h4 style="margin-bottom: 0.5rem; color: var(--primary);">Realistic</h4>
            <p style="font-size: 0.9rem; color: var(--text-secondary);">Exam interfaces designed to mimic actual JAMB and WAEC software perfectly.</p>
          </div>
        </div>

        <div style="border-top: 1px solid var(--glass-border); padding-top: 1.5rem;">
          <p style="font-size: 0.9rem; color: var(--text-secondary); font-style: italic;">
            Version 2.1.0 - Built for Excellence.
            <br>
            &copy; 2026 CBT Elite Learning Systems.
          </p>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const closeBtn = document.getElementById('close-about-modal');
  closeBtn.onclick = () => modal.remove();
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
}

