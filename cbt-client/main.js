import { AuthService } from './src/services/auth'
import { AuthComponent } from './src/components/Auth'
import { ProfileSetupComponent } from './src/components/ProfileSetup'
import { DashboardComponent } from './src/components/Dashboard'
import { ExamComponent } from './src/components/Exam'
import { ResultsComponent } from './src/components/Results'
import { AdminComponent } from './src/components/Admin'
import './src/styles/main.css'

async function initApp() {
  // Global Theme Initialization
  const savedTheme = localStorage.getItem('theme') || 'dark'
  if (savedTheme === 'light') {
    document.body.classList.add('light-mode')
  } else {
    document.body.classList.remove('light-mode')
  }
  localStorage.setItem('theme', savedTheme)

  const user = await AuthService.getCurrentUser()
  
  if (!user) {
    showAuth()
    return
  }

  // Check for profile
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
  DashboardComponent.render(profile, (questions, mode, subject, examType) => {
    DashboardComponent.hide()
    showExam(questions, profile, false, {}, mode, subject, examType)
  }, () => {
    DashboardComponent.hide()
    showAdmin(profile)
  })
}

function showAdmin(profile) {
  hideAll()
  AdminComponent.render(profile, () => showDashboard(profile))
}

function showExam(questions, profile, isReview = false, pastAnswers = {}, mode = 'practice', subject = '', examType = '') {
  hideAll()
  ExamComponent.render(questions, profile, (userAnswers, timeTaken, actualQuestions) => {
    showResults(actualQuestions || questions, userAnswers, profile, mode, subject, examType, timeTaken)
  }, isReview, pastAnswers, mode, subject, examType, () => showDashboard(profile))
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
}

initApp()
