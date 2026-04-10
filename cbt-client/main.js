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
    'profile': '/profile'
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
    navigateTo(event.state.view, currentProfile, false);
  } else {
    // Fallback to initial route
    handleInitialRoute(currentProfile);
  }
};

function showExamsDashboard(profile) {
   currentProfile = profile;
   hideAll();
   ExamsDashboardComponent.render(profile, (questions, mode, subject, examType) => {
     showExam(questions, profile, false, {}, mode, subject, examType);
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
   SettingsComponent.render(profile, () => navigateTo('dashboard', profile));
}

function handleInitialRoute(profile) {
  const path = window.location.pathname;
  if (path === '/exams') navigateTo('exams', profile, false);
  else if (path === '/practice') navigateTo('practice', profile, false);
  else if (path === '/admin' && (profile.role === 'admin' || profile.role === 'super-admin')) navigateTo('admin', profile, false);
  else if (path === '/settings') navigateTo('settings', profile, false);
  else navigateTo('dashboard', profile, false);
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
    const user = await AuthService.getCurrentUser();
    
    if (!user) {
      showAuth();
      return;
    }

    if (!user?.id) {
      console.error("User identified but ID missing. Re-authenticating.");
      showAuth();
      return;
    }

    try {
        const { data: profile } = await AuthService.getProfile(user.id);
        
        // Re-setup actions with real data
        setupGlobalActions(profile || { id: user.id, username: 'Student' });

        if (!profile || !profile.username) {
            showProfileSetup(user);
        } else {
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
    const tier = profile.is_activated ? 'PREMIUM' : (profile.tier || 'FREE').toUpperCase()
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
        navigateTo('dashboard'); // Helper to clean state
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
                     const article = newsItems.find(n => n.id === nid)
                     if (article) {
                       newsDrawer.classList.remove('active')
                       if (overlay) overlay.classList.remove('active');
                       import('./src/components/NewsArticle').then(({ NewsArticleComponent }) => {
                         const dash = document.getElementById('dashboard-container')
                         if (dash) dash.style.display = 'none'
                         NewsArticleComponent.render(article, () => {
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
  
  const moreLogoutBtn = document.getElementById('more-logout-btn');
  if (moreLogoutBtn) {
    moreLogoutBtn.onclick = () => {
      toggleMoreDrawer();
      setTimeout(() => navigateTo('logout', profile), 300);
    }
  }

  // Handle clicks on items inside More Drawer
  const moreMenuItems = document.querySelectorAll('.more-menu-item[data-view]');
  moreMenuItems.forEach(item => {
    item.onclick = (e) => {
      const view = item.dataset.view;
      toggleMoreDrawer();
      setTimeout(() => navigateTo(view, profile), 300);
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
  currentProfile = profile; // Store for navigateTo helper
  const navItems = document.querySelectorAll('.nav-item, .bottom-nav-item, .more-menu-item')
  navItems.forEach(item => {
    item.onclick = (e) => {
      e.preventDefault();
      const view = item.dataset.view
      window.navigateTo(view, profile);
    }
  })

  const logoutBtn = document.getElementById('logout-btn')
  if (logoutBtn) {
    logoutBtn.onclick = async () => {
      if (confirm('Are you sure you want to sign out?')) {
        await AuthService.signOut()
        location.reload()
      }
    }
  }
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
  currentProfile = profile
  const dashContainer = document.getElementById('dashboard-container')
  
  hideAll()
  dashContainer.style.display = 'block'
  
  // Initialize Notifications
  initNotifications(profile)
  
  // Finalize Dashboard rendering
  DashboardComponent.render(profile, (questions, mode, subject, examType, resumeState = null) => {
    DashboardComponent.hide()
    showExam(questions, profile, false, {}, mode, subject, examType, resumeState)
  }, () => {
    DashboardComponent.hide()
    showAdmin(profile)
  }, (article) => {
    showNewsArticle(article, profile)
  })
  
  dashboardLoaded = true
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

function showExam(questions, profile, isReview = false, pastAnswers = {}, mode = 'practice', subject = '', examType = '', resumeState = null) {
  hideAll(true) // Pass true to hide layout for focus
  ExamComponent.render(questions, profile, (userAnswers, timeTaken, actualQuestions) => {
    showResults(actualQuestions || questions, userAnswers, profile, mode, subject, examType, timeTaken)
  }, isReview, pastAnswers, mode, subject, examType, () => showDashboard(profile), resumeState)
}

function showResults(questions, userAnswers, profile, mode = 'practice', subject = '', examType = '', timeTaken = 0) {
  hideAll()
  ResultsComponent.render(questions, userAnswers, () => {
    showExam(questions, profile, false, {}, mode, subject, examType) // Retake same questions
  }, () => {
    showExam(questions, profile, true, userAnswers, mode, subject, examType) // Review mode
  }, profile, mode, subject, examType, timeTaken, () => showDashboard(profile))
}

function hideAll(isExam = false) {
  const containers = [
    'auth-container', 'dashboard-container', 'exam-container', 
    'admin-container', 'settings-container', 'news-article-container',
    'practice-container', 'exams-container'
  ];
  
  containers.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });

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
                session.userAnswers
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
