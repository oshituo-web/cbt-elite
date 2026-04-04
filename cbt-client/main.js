import { AuthService } from './src/services/auth'
import { AuthComponent } from './src/components/Auth'
import { ProfileSetupComponent } from './src/components/ProfileSetup'
import { DashboardComponent } from './src/components/Dashboard'
import { ExamComponent } from './src/components/Exam'
import { ResultsComponent } from './src/components/Results'
import { AdminComponent } from './src/components/Admin'
import { NewsArticleComponent } from './src/components/NewsArticle'
import { IndexedDbService } from './src/services/indexedDbService'
import { DataService } from './src/services/data'
import './src/styles/main.css'

async function initApp() {
  // Global Theme Initialization
  const savedTheme = localStorage.getItem('theme') || 'light'
  if (savedTheme === 'light') {
    document.body.classList.add('light-mode')
  } else {
    document.body.classList.remove('light-mode')
  }
  localStorage.setItem('theme', savedTheme)
  
  // Phase 3: Setup Offline Listeners
  window.addEventListener('online', () => syncOfflineData())
  syncOfflineData() // Initial attempt

  const user = await AuthService.getCurrentUser()
  
  if (!user) {
    showAuth()
    return
  }

  // Phase 4: Check for Global Broadcast
  checkBroadcast()

  // Check for profile
  if (!user?.id) {
    console.error("User identified but ID missing. Re-authenticating.")
    showAuth()
    return
  }

  const { data: profile, error } = await AuthService.getProfile(user.id)
  
  if (error || !profile || !profile.username) {
    showProfileSetup(user)
  } else {
    showDashboard(profile)
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
  hideAll()
  DashboardComponent.render(profile, (questions, mode, subject, examType, resumeState = null) => {
    DashboardComponent.hide()
    showExam(questions, profile, false, {}, mode, subject, examType, resumeState)
  }, () => {
    DashboardComponent.hide()
    showAdmin(profile)
  }, (article) => {
    showNewsArticle(article, profile)
  })
}

function showNewsArticle(article, profile) {
  hideAll()
  NewsArticleComponent.render(article, () => showDashboard(profile))
}

function showAdmin(profile) {
  hideAll()
  AdminComponent.render(profile, () => showDashboard(profile))
}

function showExam(questions, profile, isReview = false, pastAnswers = {}, mode = 'practice', subject = '', examType = '', resumeState = null) {
  hideAll()
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

function hideAll() {
  document.getElementById('auth-container').style.display = 'none'
  document.getElementById('dashboard-container').style.display = 'none'
  document.getElementById('exam-container').style.display = 'none'
  document.getElementById('admin-container').style.display = 'none'
  if (document.getElementById('news-article-container')) {
    document.getElementById('news-article-container').style.display = 'none'
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
                document.body.prepend(banner)
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
async function syncOfflineData() {
    try {
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

initApp()
