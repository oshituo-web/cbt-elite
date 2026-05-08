import { AuthService } from './src/services/auth'
import { IndexedDbService } from './src/services/indexedDbService'
import { DataService } from './src/services/data'
import { NotificationService } from './src/services/NotificationService'
import { supabase } from './src/utils/supabase'
import './src/styles/main.css'

// 🛡️ FIX CRIT-07: SW force-unregister removed. The APP_VERSION cache-bust below
// handles stale cache invalidation correctly without destroying offline functionality.

// 🚀 PERMANENT CACHE SOLUTION: Version Syncing
const APP_VERSION = 'v14';
console.log(`[System] App version ${APP_VERSION} starting...`);
const savedVersion = localStorage.getItem('cbt_elite_version');

// 🛡️ FIX CRIT-08: Version Syncing with surgical key removal (NOT localStorage.clear())
// localStorage.clear() would destroy: auth tokens, device tokens, referral codes, settings.
if (savedVersion && savedVersion !== APP_VERSION) {
    console.log(`[Version Sync] Updating from ${savedVersion} to ${APP_VERSION}`);

    // Only remove cache-tracking keys — preserve auth, settings, and user state
    const keysToRemove = ['seen_news_ids', 'cbt_elite_saved_pass'];
    keysToRemove.forEach(k => localStorage.removeItem(k));

    localStorage.setItem('cbt_elite_version', APP_VERSION);
    
    // Clear all SW caches and reload
    if ('caches' in window) {
        caches.keys().then(names => {
            for (let name of names) caches.delete(name);
        });
    }
    setTimeout(() => location.reload(true), 1000);
} else {
    localStorage.setItem('cbt_elite_version', APP_VERSION);
}

import { TourGuide } from './src/utils/TourGuide'
import { HelpGuide } from './src/components/HelpGuide'
import { ErrorBoundary } from './src/components/ErrorBoundary'
window.HelpGuide = HelpGuide; // expose globally so Dashboard.js can call it
window.TourGuide = TourGuide;

// Local Font Imports (Bundled for performance)
import "@fontsource/inter/index.css"
import "@fontsource/outfit/index.css"

// Modular Library Imports (Bundled)
import * as lucide from 'lucide'
import confetti from 'canvas-confetti'
import 'katex/dist/katex.min.css'

// Global confetti access for legacy component compatibility
window.confetti = confetti;
window.DataService = DataService;
window.supabase = supabase;

// Wrap Lucide to automatically include icons object (ESM requirement)
const originalCreateIcons = lucide.createIcons;
window.lucide = {
    ...lucide,
    createIcons: (options = {}) => originalCreateIcons({ icons: lucide.icons, ...options })
};

let dashboardLoaded = false;
let currentProfile = null;
window.currentProfile = null;

/**
 * 🧭 Centralized URL-based Navigation Handler
 */
window.navigateTo = async function(view, profile = currentProfile, pushState = true) {
  if (!view || !profile) return;
  
  // 🔐 Admin Authorization: Two-layer guard
  // Layer 1: Client-side fast reject (UI hint only — NOT a security boundary)
  // Layer 2: Server-side DB verification via is_admin() RPC (authoritative)
  if (view === 'admin') {
    const emailHint = profile.email === 'oshituo@gmail.com';
    if (!emailHint) {
      console.warn(`[Auth] Unauthorized admin attempt by ${profile.email || profile.username} — client check failed.`);
      window.navigateTo('dashboard', profile);
      return;
    }
    // Layer 2: Verify via the database — cannot be bypassed by modifying the profile object in memory
    const { data: adminCheck, error: adminErr } = await supabase.rpc('is_admin');
    if (adminErr || !adminCheck) {
      console.error(`[Auth] Server-side admin verification FAILED for ${profile.email}. Access denied.`, adminErr);
      window.navigateTo('dashboard', profile);
      return;
    }
  }
  
  // 1. Update active states and handle routing metadata
  const pathMap = {
    'dashboard': '/dashboard',
    'exams': '/exams',
    'practice': '/practice',
    'admin': '/admin',
    'settings': '/settings',
    'profile': '/profile',
    'analytics': '/analytics',
    'challenge': '/challenge'
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
  // We map sub-pages to their logical parent nav icons to keep them highlighted
  let navView = view;
  let activeTab = profile?.activeTab || 'home';
  
  if (view === 'analytics' || view === 'recap') navView = 'progress'; 
  if (view === 'profile' || view === 'settings') navView = 'more';

  const allNavItems = document.querySelectorAll('.nav-item, .bottom-nav-item, .more-menu-item');
  
  allNavItems.forEach(item => {
    item.classList.remove('active');
    
    const itemView = item.dataset.view;
    const itemTab = item.dataset.tab;

    // 1. Handle "More" view (Drawer)
    if (view === 'more') {
      if (itemView === 'more') item.classList.add('active');
      return;
    }

    // 2. Handle Dashboard View with Tabs
    if (view === 'dashboard') {
      if (itemView === 'dashboard' && itemTab === activeTab) {
        item.classList.add('active');
      }
      return;
    }

    // 3. Handle Sub-pages mapping to parent tabs (e.g. Analytics -> Progress)
    if (navView === 'progress' && itemTab === 'progress') {
       item.classList.add('active');
       return;
    }

    // 4. Handle Direct View Matches
    if (itemView === navView && !itemTab) {
      item.classList.add('active');
    }
  });


  // 3. Handle Modular Views
  switch (view) {
    case 'dashboard':
      // Support passing specific tab if provided (e.g., from setupNavigation)
      const tab = profile?.activeTab || 'home';
      await showDashboard(profile, tab);
      break;
      
    case 'admin':
      await showAdmin(profile);
      break;
      
    case 'exams':
      await showExamsDashboard(profile);
      break;

    case 'practice':
      await showPracticeDashboard(profile);
      break;
      
    case 'profile':
      await showProfile(profile);
      break;
      
    case 'settings':
      await showSettings(profile);
      break;
      
    case 'analytics':
      await showAnalytics(profile);
      break;
      
    case 'recap':
      await showWeeklyRecap(profile);
      break;
      
    case 'more':
      toggleMoreDrawer();
      break;

    case 'challenge':
      await showChallengeDashboard(profile);
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

async function showExamsDashboard(profile) {
   currentProfile = profile;
   hideAll();
   const { ExamsDashboardComponent } = await import('./src/components/ExamsDashboard');
   ExamsDashboardComponent.render(profile, (questions, mode, subject, examType, extraConfig = null) => {
     showExam(questions, profile, false, {}, mode, subject, examType, null, extraConfig?.intendedSubjects || [], null, extraConfig?.questionSource || 'ai');
   });
}

async function showPracticeDashboard(profile) {
  currentProfile = profile;
  hideAll();
  const { PracticeDashboardComponent } = await import('./src/components/PracticeDashboard');
  PracticeDashboardComponent.render(profile, (questions, mode, subject, examType, extraConfig = null) => {
    showExam(questions, profile, false, {}, mode, subject, examType, null, [], null, extraConfig?.questionSource || 'ai');
  });
}

async function showSettings(profile) {
   currentProfile = profile;
   hideAll();
   const { SettingsComponent } = await import('./src/components/Settings');
   SettingsComponent.render(profile, () => window.navigateTo('dashboard', profile));
}

function handleInitialRoute(profile) {
  const path = window.location.pathname;
  if (path === '/exams') window.navigateTo('exams', profile, false);
  else if (path === '/practice') window.navigateTo('practice', profile, false);
  else if (path === '/admin' && profile.email === 'oshituo@gmail.com') window.navigateTo('admin', profile, false);
  else if (path === '/settings') window.navigateTo('settings', profile, false);
  else window.navigateTo('dashboard', profile, false);
}

function toggleMoreDrawer() {
  const drawer = document.getElementById('more-drawer');
  const overlay = document.getElementById('sidebar-overlay');
  if (drawer && overlay) {
    const isActive = drawer.classList.toggle('active');
    overlay.classList.toggle('active');
    
    if (!isActive) {
      document.querySelectorAll('.nav-item, .bottom-nav-item').forEach(item => {
        if (item.dataset.view === 'more') {
          item.classList.remove('active');
        }
      });
    }
  }
}

async function initApp() {
  // 🧭 0. GLOBAL ERROR LOGGING & BOUNDARY
  window.onerror = (msg, url, lineNo, columnNo, error) => {
    console.error(`[Global Error] ${msg} at ${lineNo}:${columnNo}`, error);
    // Ignore cross-origin script errors or harmless extension errors
    if (msg.toLowerCase().indexOf('script error') > -1) return false;
    
    ErrorBoundary.showError(msg, error?.message || '');
    return false;
  };

  window.onunhandledrejection = (event) => {
    console.error('[Unhandled Promise Rejection]', event.reason);
    // Show boundary for critical promise failures, but we might want to skip minor ones
    if (event.reason && event.reason.message && event.reason.message.includes('fetch')) {
       // Typically handled by network retries, but if it bubbles up here:
       ErrorBoundary.showError('Network connectivity issue detected.', event.reason.message);
    }
  };

  try {
    // 1. RENDER ICONS IMMEDIATELY (using bundled library)
    if (window.lucide) {
      window.lucide.createIcons();
    }

    // 🧭 Capture Referral Code from URL
    const urlParams = new URLSearchParams(window.location.search);
    const refCode = urlParams.get('ref');
    if (refCode) {
        localStorage.setItem('elite_referral_code', refCode);
        console.log("main.js: Referral code captured:", refCode);
    }

    // Initialize layout visibility
    const header = document.getElementById('app-header');
    const sidebar = document.getElementById('app-sidebar');
    const bottomNav = document.getElementById('bottom-nav');
    
    if (header) header.style.display = 'flex';
    // Sidebar visibility is controlled by CSS media queries:
    // - Desktop (>=1024px): display:flex via @media (min-width: 1024px)
    // - Mobile (<1024px): display:none — do NOT set inline style here
    if (sidebar) sidebar.removeAttribute('style'); // Clear any lingering inline styles
    if (bottomNav) bottomNav.style.display = 'flex';

    // Global Theme Initialization (Corrected for .dark-mode architecture)
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.body.classList.toggle('dark-mode', savedTheme === 'dark');
    
    // Initialize Font Size Scaling
    const savedFontSize = localStorage.getItem('font_size') || 'medium';
    const fontMap = { small: '14px', medium: '16px', large: '18px' };
    document.documentElement.style.setProperty('--base-font-size', fontMap[savedFontSize]);
    
    // Register event listeners immediately
    setupGlobalActions({ id: 'anon', username: 'Student' });

    // 🔐 2. START AUTH & DATA FLOW (Robust OAuth detection)
    console.log(`main.js: Initializing Auth Flow... (URL: ${window.location.href.split('#')[0]}${window.location.hash ? '#[FRAGMENT PRESENT]' : ''})`);

    // Create a promise that resolves when we get a session OR a timeout occurs
    const sessionPromise = new Promise((resolve) => {
        const timeout = setTimeout(() => {
            console.log("main.js: Auth timeout reached, checking current session...");
            supabase.auth.getSession().then(({ data }) => resolve(data.session));
        }, 2000); // 2 second window for OAuth processing

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            console.log(`[Auth] State Change: ${event}`);
            if (session) {
                clearTimeout(timeout);
                subscription.unsubscribe();
                resolve(session);
            }
        });
    });

    const session = await sessionPromise;
    const user = session?.user;
    
    if (!user || !user.id) {
      console.log("main.js: No user session confirmed, showing Auth component.");
      showAuth();
      return;
    }

    console.log(`[Auth] Session active for ${user.email} (${user.id})`);

    // ⚡ Parallel Fetch: Profile, Offline Sync, and Initial Route
    const [profileResult] = await Promise.all([
      AuthService.getProfile(user.id),
      syncOfflineData(),
      checkBroadcast()
    ]);

    const profile = profileResult?.data;
    if (profile && user.email) profile.email = user.email;
    
    if (profile) {
      console.log(`[Auth] Profile confirmed for @${profile.username}`);
    } else {
      console.log("[Auth] No profile found for authenticated user. Moving to Setup.");
    }

    // 🔐 SINGLE DEVICE ENFORCEMENT CHECK
    if (profile && profile.current_session_token) {
      const localToken = localStorage.getItem('cbt_elite_device_token')
      if (profile.current_session_token !== localToken) {
        console.warn('Session override detected. Logging out local device.')
        await AuthService.signOut()
        window.location.hash = 'session-overlap'
        showAuth()
        return
      }
      
      // Start Session Heartbeat to enforce single-device rules and track activity
      setInterval(async () => {
        try {
          // 0. Session Health Check
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) return; // Stop if user is logged out

          // 1. Single Device Check
          const { data: latestProfile } = await AuthService.getProfile(user.id);
          if (latestProfile && latestProfile.current_session_token !== localToken) {
            console.warn('Session override detected via heartbeat. Logging out local device.')
            await AuthService.signOut()
            window.location.hash = 'session-overlap'
            window.location.reload()
            return
          }

          // 2. Activity Tracking (Updates every 60s while tab is open)
          await DataService.updateUser(user.id, { last_active_at: new Date().toISOString() });
          
        } catch (e) {
          // Graceful failure: don't alert the student if internet flickers
          if (e.message !== 'Failed to fetch') {
            console.warn("Heartbeat background sync paused:", e.message)
          }
        }
      }, 60000); // Check every 60 seconds
    }

    // Update UI with real data
    setupGlobalActions(profile || { id: user.id, username: 'Student', email: user.email });
    
    // 🚀 NEW USER FLOW: Check-then-Create (Auto-registration)
    if (!profile || !profile.username) {
        console.log("[Auth] New user detected. Triggering auto-registration...");
        const newProfile = await AuthService.autoRegister(user);
        
        if (newProfile) {
            console.log(`[Auth] Auto-registration successful for @${newProfile.username}`);
            sessionStorage.setItem('isFreshSignup', 'true'); // Trigger the onboarding tour
            currentProfile = newProfile;
            updateHeaderProfile(newProfile);
            handleInitialRoute(newProfile);
        } else {
            console.warn("[Auth] Auto-registration failed. Falling back to manual setup.");
            showProfileSetup(user);
        }
    } else {
        // 🛡️ STREAK RESET CHECK ON LOAD
        const today = new Date().toLocaleString("en-CA", {timeZone: "Africa/Lagos"}).split(",")[0];
        const lastDate = profile.last_session_date;
        
        if (lastDate) {
            const diffDays = Math.floor((new Date(today) - new Date(lastDate)) / (1000 * 60 * 60 * 24));
            console.log("Streak Load Check:", { today, lastDate, diffDays });
            
            if (diffDays > 1) {
                console.log("Streak Reset: Day missed.");
                profile.streak_count = 0;
                AuthService.updateProfile({ id: profile.id, streak_count: 0 });
            }
        }

        updateHeaderProfile(profile);
        handleInitialRoute(profile);
    }

  } catch (globalError) {
    console.error("GLOBAL INIT CRASH:", globalError);
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
  const userIcon = document.querySelector('#profile-trigger i[data-lucide="user-circle"]');
  currentProfile = profile;

  if (avatar) {
    if (profile.avatar_url) {
      avatar.innerHTML = `<img src="${profile.avatar_url}" style="width: 100%; height: 100%; object-fit: cover;">`;
      avatar.style.display = 'flex';
      if (userIcon) userIcon.style.display = 'none';
    } else {
      avatar.textContent = (profile.username || 'S').charAt(0).toUpperCase();
      avatar.style.display = 'flex';
      if (userIcon) userIcon.style.display = 'none';
    }
  }
  if (username) username.textContent = profile.username || 'Student'
  
  if (streakText) streakText.textContent = `${profile.streak_count || 0}`
  
  if (tierHeader) {
    let tier = 'FREE';
    if (profile.activation_status) {
      tier = 'PREMIUM';
    } else {
      const rawTier = (profile.tier || 'FREE').toUpperCase();
      if (rawTier === 'FREEMIUM') tier = 'FREE';
      else if (rawTier === 'MEDIUM') tier = 'MEDIUM';
      else tier = rawTier;
    }
    
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
  const bottomAdminBtn = document.getElementById('bottom-admin-btn');
  const isAdmin = profile && profile.email === 'oshituo@gmail.com';
  
  if (sidebarAdminBtn) {
    sidebarAdminBtn.style.setProperty('display', isAdmin ? 'flex' : 'none', 'important');
  }
  if (bottomAdminBtn) {
    bottomAdminBtn.style.setProperty('display', isAdmin ? 'flex' : 'none', 'important');
  }

  // 9. Attach Global News Action
  const newsBtn = document.getElementById('global-news-btn')
  const newsDrawer = document.getElementById('news-drawer')
  const closeNewsBtn = document.getElementById('close-news-drawer')

  const toggleNewsDrawer = async (activeTab = 'news') => {
    if (!newsDrawer) return;
    const isActive = newsDrawer.classList.contains('active')
    const overlay = document.getElementById('sidebar-overlay');
    
    if (isActive && newsDrawer.dataset.currentTab === activeTab) {
      newsDrawer.classList.remove('active');
      if (overlay) overlay.classList.remove('active');
      return;
    }

    newsDrawer.dataset.currentTab = activeTab;

    // Specifically close the more drawer if it's open
    const moreDrawer = document.getElementById('more-drawer');
    if (moreDrawer) moreDrawer.classList.remove('active');

    newsDrawer.classList.add('active');
    if (overlay) overlay.classList.add('active');
    
    // Update Header
    const headerTitle = newsDrawer.querySelector('.drawer-header h3');
    if (headerTitle) {
      headerTitle.innerHTML = activeTab === 'news' ? '📢 Exam News & Updates' : '🔔 Your Notifications';
    }

    // Add Tab Switcher if not exists
    let tabSwitcher = newsDrawer.querySelector('.drawer-tabs');
    if (!tabSwitcher) {
      tabSwitcher = document.createElement('div');
      tabSwitcher.className = 'drawer-tabs';
      tabSwitcher.style.cssText = 'display:flex; padding:0 1.5rem; gap:1rem; border-bottom:1px solid var(--glass-border); background:rgba(0,0,0,0.05);';
      tabSwitcher.innerHTML = `
        <button class="drawer-tab ${activeTab === 'news' ? 'active' : ''}" data-tab="news" style="padding:0.75rem 0; background:none; border:none; color:var(--text-secondary); font-weight:800; font-size:0.8rem; cursor:pointer; border-bottom:2px solid transparent;">NEWS</button>
        <button class="drawer-tab ${activeTab === 'notifications' ? 'active' : ''}" data-tab="notifications" style="padding:0.75rem 0; background:none; border:none; color:var(--text-secondary); font-weight:800; font-size:0.8rem; cursor:pointer; border-bottom:2px solid transparent;">ALERTS</button>
      `;
      newsDrawer.insertBefore(tabSwitcher, document.getElementById('news-drawer-content'));
      
      tabSwitcher.querySelectorAll('.drawer-tab').forEach(tab => {
        tab.onclick = () => {
          tabSwitcher.querySelectorAll('.drawer-tab').forEach(t => {
            t.style.color = 'var(--text-secondary)';
            t.style.borderBottomColor = 'transparent';
          });
          tab.style.color = 'var(--accent-primary)';
          tab.style.borderBottomColor = 'var(--accent-primary)';
          renderDrawerContent(tab.dataset.tab);
        };
      });
    }

    // Initial Render
    renderDrawerContent(activeTab);

    async function renderDrawerContent(tab) {
      const contentArea = document.getElementById('news-drawer-content');
      if (!contentArea) return;
      
      contentArea.innerHTML = '<div style="display:flex;justify-content:center;padding:2rem;"><div class="loader-spinner"></div></div>';
      
      if (tab === 'news') {
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
                    <p style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.5rem;">${item.content.replace(/<[^>]*>/g, '').substring(0, 100)}...</p>
                 </div>
               `).join('')

               contentArea.querySelectorAll('.news-item-card').forEach(card => {
                 card.onclick = () => {
                    const nid = card.dataset.newsId;
                    newsDrawer.classList.remove('active');
                    if (overlay) overlay.classList.remove('active');
                    import('./src/components/NewsArticle').then(({ NewsArticleComponent }) => {
                      NewsArticleComponent.render(nid, () => window.navigateTo('dashboard', profile));
                    });
                 }
               });
             }
         } catch (e) { contentArea.innerHTML = '<p>Error loading news.</p>'; }
      } else {
        // Render Smart Notifications
        const history = NotificationService.getHistory();
        if (history.length === 0) {
          contentArea.innerHTML = '<div style="text-align:center; padding:3rem 1.5rem; color:var(--text-secondary);"><i data-lucide="bell-off" style="width:40px; height:40px; margin-bottom:1rem; opacity:0.3;"></i><p>No notifications yet.</p></div>';
          if (window.lucide) window.lucide.createIcons({ root: contentArea });
        } else {
          contentArea.innerHTML = `
            <div style="padding: 1rem; display: flex; justify-content: flex-end;">
               <button id="mark-all-read" style="background:none; border:none; color:var(--accent-primary); font-size:0.75rem; font-weight:700; cursor:pointer;">Mark all as read</button>
            </div>
            ${history.map(n => `
              <div class="notif-item glass ${n.read ? '' : 'unread'}" style="margin-bottom:0.75rem; padding:1.25rem; cursor:pointer; position:relative; ${n.read ? 'opacity:0.8' : 'border-left:3px solid var(--error)'}" data-notif-id="${n.id}">
                 <div style="display:flex; gap:1rem; align-items:flex-start;">
                    <div style="width:36px; height:36px; border-radius:10px; background:rgba(var(--accent-primary-rgb), 0.1); display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                       <i data-lucide="${
                         n.type === 'streak' ? 'flame' : 
                         n.type === 'reward' ? 'coins' : 
                         n.type === 'competition' ? 'trophy' : 
                         n.type === 'performance' ? 'brain' : 
                         n.type === 'progression' ? 'target' : 
                         'bell'
                       }" style="width:18px; color:var(--accent-primary);"></i>
                    </div>
                    <div>
                       <h4 style="margin:0; font-size:0.9rem; font-weight:900;">${n.title}</h4>
                       <p style="margin:0.25rem 0 0 0; font-size:0.8rem; color:var(--text-secondary); line-height:1.4;">${n.message}</p>
                       <span style="display:block; margin-top:0.5rem; font-size:0.65rem; color:var(--text-secondary); opacity:0.7;">${new Date(n.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                    </div>
                 </div>
              </div>
            `).join('')}
          `;
          
          if (window.lucide) window.lucide.createIcons({ root: contentArea });

          contentArea.querySelector('#mark-all-read').onclick = () => {
            NotificationService.markAllAsRead();
            renderDrawerContent('notifications');
          };

          contentArea.querySelectorAll('.notif-item').forEach(card => {
            card.onclick = () => {
              const notif = history.find(h => h.id === card.dataset.notifId);
              if (notif) {
                NotificationService.markAsRead(notif.id);
                newsDrawer.classList.remove('active');
                if (overlay) overlay.classList.remove('active');
                window.navigateTo(notif.action, profile);
              }
            };
          });
        }
      }
    }
  }

  if (newsBtn && newsDrawer) {
    newsBtn.dataset.init = "true"
    newsBtn.onclick = () => toggleNewsDrawer('notifications');
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
    moreNewsBtn.onclick = () => toggleNewsDrawer('news');
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
      setTimeout(() => HelpGuide.show(), 300);
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

  // Sidebar overlay (click to close all drawers & mobile sidebar)
  const sidebarOverlay = document.getElementById('sidebar-overlay');
  if (sidebarOverlay) {
    sidebarOverlay.onclick = () => {
      newsDrawer?.classList.remove('active');
      moreDrawer?.classList.remove('active');
      sidebarOverlay.classList.remove('active');
      // Close mobile sidebar overlay
      document.getElementById('app-sidebar')?.classList.remove('active', 'mobile-open');
    };
  }

  
  if (sidebarToggle && sidebar && !sidebarToggle.dataset.init) {
    sidebarToggle.dataset.init = "true"
    sidebarToggle.onclick = () => {
      const isMobile = window.innerWidth < 1024;
      if (isMobile) {
        // On mobile: toggle as a slide-in overlay
        const isActive = sidebar.classList.toggle('mobile-open');
        const overlay = document.getElementById('sidebar-overlay');
        if (overlay) overlay.classList.toggle('active', isActive);
      } else {
        // On desktop: collapse/expand
        sidebar.classList.toggle('collapsed');
        const mainArea = document.querySelector('.main-content-area');
        if (mainArea) {
          mainArea.style.marginLeft = sidebar.classList.contains('collapsed')
            ? 'var(--sidebar-collapsed-width)'
            : 'var(--sidebar-width)';
        }
      }
    }
  }

  // 2. Global Theme Toggle (Corrected for .dark-mode architecture)
  const themeToggle = document.getElementById('global-theme-toggle')
  if (themeToggle && !themeToggle.dataset.init) {
    themeToggle.dataset.init = "true"
    themeToggle.onclick = () => {
      document.body.classList.toggle('dark-mode')
      const isDark = document.body.classList.contains('dark-mode')
      localStorage.setItem('theme', isDark ? 'dark' : 'light')
      // Update icon for instant feedback
      themeToggle.innerHTML = isDark ? '<i data-lucide="moon"></i>' : '<i data-lucide="sun"></i>'
      if (window.lucide) window.lucide.createIcons({ root: themeToggle })
    }
  }

  // 3. Global Help Guide
  const helpBtns = [document.getElementById('global-help-btn'), document.getElementById('header-help-btn')]
  helpBtns.forEach(btn => {
    if (btn && !btn.dataset.init) {
      btn.dataset.init = "true"
      btn.onclick = () => {
        HelpGuide.show()
      }
    }
  })

  // 4. Header Notification Button
  const headerNotifBtn = document.getElementById('header-notification-btn')
  if (headerNotifBtn && !headerNotifBtn.dataset.init) {
    headerNotifBtn.dataset.init = "true"
    headerNotifBtn.onclick = () => {
      toggleNewsDrawer('notifications')
    }
  }
}

function setupNavigation(profile) {
  currentProfile = profile; 
  window.currentProfile = profile;
  // Only target nav items that have an explicit data-view attribute
  // (excludes custom-handled buttons like more-help-btn, more-news-btn, more-logout-btn)
  const navItems = document.querySelectorAll('.nav-item[data-view], .bottom-nav-item[data-view], .more-menu-item[data-view], #profile-trigger')
  navItems.forEach(item => {
    item.onclick = (e) => {
      e.preventDefault();
      const view = item.dataset.view || 'profile';
      const tab = item.dataset.tab;
      
      if (view) {
        // If it's a more-menu-item, close the drawer first
        if (item.classList.contains('more-menu-item')) {
          toggleMoreDrawer();
        }
        
        // Pass tab state through profile object temporarily for navigateTo
        const navigationProfile = { ...profile, activeTab: tab };
        window.navigateTo(view, navigationProfile);
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

async function showAuth() {
  hideAll(false, true)
  const { AuthComponent } = await import('./src/components/Auth');
  AuthComponent.render((user) => {
    AuthComponent.hide()
    initApp()
  })
}

async function showProfileSetup(user) {
  hideAll()
  const { ProfileSetupComponent } = await import('./src/components/ProfileSetup');
  ProfileSetupComponent.render(user, (profile) => {
    // Note: ProfileSetup doesn't have a hide(), it just renders over
    showDashboard(profile)
  })
}

async function showProfile(profile) {
  currentProfile = profile;
  hideAll();
  const { ProfileComponent } = await import('./src/components/Profile');
  ProfileComponent.render(profile, () => window.navigateTo('dashboard', profile));
}

window.updateHeaderProfile = updateHeaderProfile;

async function showDashboard(profile, tab = 'home') {
   if (!profile) return;
   
   // 🔄 REFRESH: Always fetch latest profile data before showing dashboard to ensure coins/streaks are accurate
   const { data: latestProfile } = await DataService.getProfile(profile.id);
   const activeProfile = latestProfile || profile;
   // 📧 Preserve email from the original profile — it comes from auth.users, not public.users
   if (!activeProfile.email && profile.email) activeProfile.email = profile.email;
   
   console.log("main.js: showDashboard called for", activeProfile.username, "with tab:", tab);
   currentProfile = activeProfile;
   const dashContainer = document.getElementById('dashboard-container');
   
   hideAll();
   dashContainer.style.display = 'block';
  
  // Initialize Notifications
  initNotifications(activeProfile);
  
  // Finalize Dashboard rendering with the freshest profile
  const { DashboardComponent } = await import('./src/components/Dashboard');

  // 🔄 Update header immediately so streak/coins in topbar are always in sync
  updateHeaderProfile(activeProfile);

  // Set active tab BEFORE render to ensure correct initial state
  DashboardComponent.activeTab = tab;

    DashboardComponent.render(activeProfile, (questions, mode, subject, examType, extraConfig = null) => {
    DashboardComponent.hide()
    const resumeState = extraConfig?.resumeState || null;
    const intendedSubjects = extraConfig?.intendedSubjects || [];
    const clashId = extraConfig?.clashId || null;
    const questionSource = extraConfig?.questionSource || 'ai';
    showExam(questions, activeProfile, false, {}, mode, subject, examType, resumeState, intendedSubjects, clashId, questionSource)
  }, () => {
    DashboardComponent.hide()
    showAdmin(activeProfile)
  }, (article) => {
    showNewsArticle(article, activeProfile)
  })
  
  dashboardLoaded = true
}

async function showAnalytics(profile) {
  currentProfile = profile;
  hideAll();
  const { AnalyticsComponent } = await import('./src/components/Analytics');
  AnalyticsComponent.render(profile, 
    () => window.navigateTo('dashboard', profile),
    (questions, mode, subject, examType, extraConfig = null) => showExam(questions, profile, false, {}, mode, subject, examType, null, [], null, extraConfig?.questionSource || 'ai')
  );
}

async function showChallengeDashboard(profile) {
  currentProfile = profile;
  hideAll();
  // Ensure the challenge container exists
  let container = document.getElementById('challenge-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'challenge-container';
    document.getElementById('app')?.appendChild(container) || document.body.appendChild(container);
  }
  container.style.display = 'block';
  // Temporarily repurpose dashboard-container since ChallengeDashboard uses it
  document.getElementById('dashboard-container').style.display = 'block';
  const { ChallengeDashboard } = await import('./src/components/ChallengeDashboard');
  ChallengeDashboard.render(profile, () => window.navigateTo('dashboard', profile));
}

async function showWeeklyRecap(profile) {
  currentProfile = profile;
  const { DataService } = await import('./src/services/data');
  const { WeeklyRecapComponent } = await import('./src/components/WeeklyRecap');
  const { mastery, stats, weekly } = await DataService.getUserAnalytics(profile.id);
  WeeklyRecapComponent.render(weekly, stats, mastery);
}

async function showNewsArticle(article, profile) {
  hideAll()
  const { NewsArticleComponent } = await import('./src/components/NewsArticle');
  NewsArticleComponent.render(article, () => showDashboard(profile))
}

async function showAdmin(profile) {
  hideAll()
  const { AdminComponent } = await import('./src/components/Admin');
  AdminComponent.render(profile, () => showDashboard(profile))
  
  // Mark sidebar active
  document.querySelectorAll('[data-view]').forEach(v => v.classList.remove('active'))
  document.querySelectorAll('[data-view="admin"]').forEach(v => v.classList.add('active'))
}

async function showExam(questions, profile, isReview = false, pastAnswers = {}, mode = 'practice', subject = '', examType = '', resumeState = null, intendedSubjects = [], clashId = null, questionSource = 'ai') {
  hideAll(true) // Pass true to hide layout for focus
  const { ExamComponent } = await import('./src/components/Exam');
  ExamComponent.render(questions, profile, (userAnswers, timeTaken, actualQuestions, cid) => {
    showResults(actualQuestions || questions, userAnswers, profile, mode, subject, examType, timeTaken, cid, questionSource)
  }, isReview, pastAnswers, mode, subject, examType, () => showDashboard(profile), resumeState, intendedSubjects, clashId, questionSource)
}

async function showResults(questions, userAnswers, profile, mode = 'practice', subject = '', examType = '', timeTaken = 0, clashId = null, questionSource = 'ai') {
  hideAll()
  const { ResultsComponent } = await import('./src/components/Results');
  ResultsComponent.render(questions, userAnswers, (newQs, newMode, newSubj, newExam) => {
    showExam(newQs || questions, profile, false, {}, newMode || mode, newSubj || subject, newExam || examType, null, [], null, questionSource) 
  }, () => {
    showExam(questions, profile, true, userAnswers, mode, subject, examType, null, [], null, questionSource)
  }, profile, mode, subject, examType, timeTaken, () => showDashboard(profile), questionSource)
}

function hideAll(isExam = false, forceHideLayout = false) {
  const containers = [
    'auth-container', 'dashboard-container', 'exam-container', 
    'admin-container', 'settings-container', 'news-article-container',
    'practice-container', 'exams-container', 'analytics-container',
    'profile-container'
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
  const isAuth = forceHideLayout || document.getElementById('auth-container').style.display !== 'none'
  
  if (isExam || isAuth) {
    if (header) header.style.display = 'none'
    // Force-hide sidebar with inline style in exam/auth mode
    if (sidebar) sidebar.style.display = 'none'
    if (bottomNav) bottomNav.style.display = 'none'
    document.body.classList.add('in-exam')
  } else {
    if (header) header.style.display = 'flex'
    // Let CSS media queries control sidebar: visible on desktop, hidden on mobile.
    // Removing the inline style allows the CSS @media (min-width: 1024px) rule
    // (display: flex !important) and the mobile default (display: none) to take effect.
    if (sidebar) sidebar.removeAttribute('style')
    // Bottom nav: show normally (CSS !important on mobile handles this correctly)
    if (bottomNav) bottomNav.style.removeProperty('display')
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
            // 🛡️ SECURITY: Build banner via DOM API — never inject config.value as innerHTML (XSS risk)
            const bannerContent = document.createElement('div');
            bannerContent.className = 'banner-content';

            const icon = document.createElement('span');
            icon.className = 'banner-icon';
            icon.textContent = '📢';

            const text = document.createElement('span');
            text.className = 'banner-text';
            text.textContent = config.value; // ✅ Safe: textContent never executes scripts

            const closeBtn = document.createElement('button');
            closeBtn.className = 'banner-close';
            closeBtn.textContent = '✕';
            closeBtn.onclick = () => banner.remove();

            bannerContent.append(icon, text, closeBtn);
            banner.innerHTML = ''; // Clear first
            banner.appendChild(bannerContent);
        } else if (banner) {
            banner.remove()
        }
    } catch (e) {
        console.error("Broadcast check failed", e)
    }
}
async function initNotifications(profile) {
    if (!profile) return;
    try {
        NotificationService.init(profile);
    } catch (err) {
        console.warn("Notification system failed to initialize:", err);
    }
}

function updateBellState(count) {
    const badges = [
        document.getElementById('notification-badge'),
        document.getElementById('more-notification-badge')
    ];
    
    badges.forEach(badge => {
        if (!badge) return;
        if (count > 0) {
            badge.textContent = count > 9 ? '9+' : count;
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }
    });
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
                true, // isSyncing flag
                session.question_source || 'ai'
            )
            
            if (!error) {
                await IndexedDbService.markSessionSynced(session.id)
                successCount++
            }
        }

        if (successCount > 0) {
            console.log(`[Sync] Successfully uploaded ${successCount} sessions.`)
            // 🛡️ FIX WARN-05: Purge synced records to prevent IndexedDB growing indefinitely
            await IndexedDbService.clearSyncedSessions()
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
    <div class="modal-content glass" style="width: min(600px, 92vw); max-height: 90vh; overflow-y: auto; padding: 0; border-radius: 24px;">
      <div style="background: linear-gradient(135deg, #1e40af 0%, #5b21b6 100%); padding: 2rem; color: white; position: relative;">
        <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.5rem;">
          <img src="/brand-icon.png" alt="CBT Elite" style="width: 36px; height: 36px; border-radius: 8px;">
          <h2 style="font-family: 'Outfit'; font-weight: 900; margin: 0;">CBT Elite</h2>
        </div>
        <p style="opacity: 0.9; font-weight: 500; margin: 0;">Nigeria's Most Advanced Exam Prep Platform</p>
        <button id="close-about-modal" style="position: absolute; top: 1.5rem; right: 1.5rem; background: rgba(255,255,255,0.2); border: none; color: white; width: 32px; height: 32px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 1.2rem;">&times;</button>
      </div>

      <div style="padding: 2rem; color: var(--text-primary);">
        <!-- Mission -->
        <div style="margin-bottom: 1.75rem;">
          <h3 style="color: var(--accent-primary); font-family: 'Outfit'; font-weight: 800; margin-bottom: 0.75rem; font-size: 1rem;">🎯 Our Mission</h3>
          <p style="line-height: 1.7; font-size: 0.95rem; color: var(--text-secondary);">CBT Elite is built to transform how Nigerian students prepare for JAMB, WAEC, and NECO. We combine AI-powered question generation, real exam simulations, deep performance analytics, and a competitive league system — all in one sleek, mobile-first platform designed to give every student a real shot at excellence.</p>
        </div>

        <!-- Feature Grid -->
        <h3 style="color: var(--accent-primary); font-family: 'Outfit'; font-weight: 800; margin-bottom: 1rem; font-size: 1rem;">✨ Platform Features</h3>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 1rem; margin-bottom: 1.75rem;">
          <div class="glass card" style="padding: 1rem; border: 1px solid var(--glass-border);">
            <div style="font-size: 1.4rem; margin-bottom: 0.4rem;">🧠</div>
            <h4 style="margin-bottom: 0.3rem; color: var(--text-primary); font-size: 0.9rem;">AI Practice Engine</h4>
            <p style="font-size: 0.8rem; color: var(--text-secondary);">AI-generated questions tailored to your weak areas and target exams.</p>
          </div>
          <div class="glass card" style="padding: 1rem; border: 1px solid var(--glass-border);">
            <div style="font-size: 1.4rem; margin-bottom: 0.4rem;">📚</div>
            <h4 style="margin-bottom: 0.3rem; color: var(--text-primary); font-size: 0.9rem;">Past Questions Bank</h4>
            <p style="font-size: 0.8rem; color: var(--text-secondary);">Thousands of verified JAMB, WAEC & NECO past questions with expert explanations.</p>
          </div>
          <div class="glass card" style="padding: 1rem; border: 1px solid var(--glass-border);">
            <div style="font-size: 1.4rem; margin-bottom: 0.4rem;">🏆</div>
            <h4 style="margin-bottom: 0.3rem; color: var(--text-primary); font-size: 0.9rem;">Competitive Leagues</h4>
            <p style="font-size: 0.8rem; color: var(--text-secondary);">Join clans, climb league tables, and clash with friends in live competitions.</p>
          </div>
          <div class="glass card" style="padding: 1rem; border: 1px solid var(--glass-border);">
            <div style="font-size: 1.4rem; margin-bottom: 0.4rem;">📊</div>
            <h4 style="margin-bottom: 0.3rem; color: var(--text-primary); font-size: 0.9rem;">Deep Analytics</h4>
            <p style="font-size: 0.8rem; color: var(--text-secondary);">Track subject mastery, daily streaks, weak topics, and accuracy trends.</p>
          </div>
          <div class="glass card" style="padding: 1rem; border: 1px solid var(--glass-border);">
            <div style="font-size: 1.4rem; margin-bottom: 0.4rem;">🔬</div>
            <h4 style="margin-bottom: 0.3rem; color: var(--text-primary); font-size: 0.9rem;">Topic Deep Dives</h4>
            <p style="font-size: 0.8rem; color: var(--text-secondary);">Master every topic with AI-guided deep dives, notes, and micro-sessions.</p>
          </div>
          <div class="glass card" style="padding: 1rem; border: 1px solid var(--glass-border);">
            <div style="font-size: 1.4rem; margin-bottom: 0.4rem;">🌙</div>
            <h4 style="margin-bottom: 0.3rem; color: var(--text-primary); font-size: 0.9rem;">Mobile-First Design</h4>
            <p style="font-size: 0.8rem; color: var(--text-secondary);">Dark mode, bottom navigation, and a premium app-like experience on any device.</p>
          </div>
        </div>

        <!-- Legal Links -->
        <div style="border-top: 1px solid var(--glass-border); padding-top: 1.5rem; margin-bottom: 1.25rem;">
          <h3 style="color: var(--accent-primary); font-family: 'Outfit'; font-weight: 800; margin-bottom: 0.75rem; font-size: 1rem;">📜 Legal</h3>
          <div style="display: flex; flex-wrap: wrap; gap: 0.75rem;">
            <a href="/terms" target="_blank" style="font-size: 0.85rem; font-weight: 700; color: var(--accent-primary); text-decoration: none; background: rgba(37,99,235,0.08); border: 1px solid rgba(37,99,235,0.2); padding: 0.4rem 0.9rem; border-radius: 20px;">Terms of Use</a>
            <a href="/privacy" target="_blank" style="font-size: 0.85rem; font-weight: 700; color: var(--accent-primary); text-decoration: none; background: rgba(37,99,235,0.08); border: 1px solid rgba(37,99,235,0.2); padding: 0.4rem 0.9rem; border-radius: 20px;">Privacy Policy</a>
            <a href="mailto:cbtellite@gmail.com" style="font-size: 0.85rem; font-weight: 700; color: var(--accent-primary); text-decoration: none; background: rgba(37,99,235,0.08); border: 1px solid rgba(37,99,235,0.2); padding: 0.4rem 0.9rem; border-radius: 20px;">Contact Support</a>
          </div>
        </div>

        <!-- Footer -->
        <div style="border-top: 1px solid var(--glass-border); padding-top: 1.25rem;">
          <p style="font-size: 0.82rem; color: var(--text-secondary);">
            Version 3.0.0 &mdash; Built for Excellence.
            <a href="#" id="force-update-link" style="color: var(--accent-primary); margin-left: 8px; font-weight: 700; text-decoration: underline; cursor: pointer;">Force Update</a>
            <br>
            &copy; 2026 CBT Elite Learning Systems. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const closeBtn = document.getElementById('close-about-modal');
  closeBtn.onclick = () => modal.remove();
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

  // Force Update Logic
  document.getElementById('force-update-link')?.addEventListener('click', async (e) => {
    e.preventDefault();
    if (confirm("Force update will clear application cache and reload. Continue?")) {
      try {
        if (navigator.serviceWorker) {
          const registrations = await navigator.serviceWorker.getRegistrations();
          for (const registration of registrations) {
            await registration.unregister();
          }
        }
        // Clear all caches
        if (window.caches) {
          const cacheNames = await caches.keys();
          await Promise.all(cacheNames.map(name => caches.delete(name)));
        }
        window.location.reload(true);
      } catch (err) {
        window.location.reload(true);
      }
    }
  });
}

