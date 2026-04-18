import { DataService } from './data'
import { SubscriptionManager } from '../utils/subscriptionManager'

export const SubscriptionService = {
  // Logic: Demote if premium expired, and reset daily counts if date changed
  async handleTierTransition(user) {
    if (!user) return null
    
    let updates = {}
    const now = new Date()

    // 1. Check Tier Transition
    const resolvedTier = this.resolveUserTier(user)
    if (user.tier !== resolvedTier) {
      // NOTE: We cannot update 'tier' directly due to DB trigger. 
      // If the tier needs to change to 'medium' due to expiry, 
      // the system should ideally handle this via a DB cron or when the user re-authenticates.
      // For now, we'll let the frontend resolve it dynamically.
    }

    // 2. Check Daily Reset (Sessions, Questions, Streaks)
    const todayStr = now.toISOString().split('T')[0]
    
    // Reset daily sessions if date changed
    if (user.last_session_date !== todayStr) {
      updates.daily_sessions = 0
      updates.last_session_date = todayStr
    }

    // Reset daily questions if date changed
    if (user.last_daily_reset_date !== todayStr) {
      updates.daily_questions_count = 0
      updates.last_daily_reset_date = todayStr
    }



    if (Object.keys(updates).length > 0) {
      const { data, error } = await DataService.updateUser(user.id, updates)
      if (!error && data?.[0]) return data[0]
    }

    return user
  },

  canStartSession(user, type = 'practice', config = {}) {
    if (!user) return false
    
    // Check if any specific system-wide free access is enabled
    const isExamsFree = config.exams_free_access === true || config.exams_free_access === 'true'
    const isExplFree = config.explanations_free_access === true || config.explanations_free_access === 'true'
    const isAIFree = config.ai_tutor_free_access === true || config.ai_tutor_free_access === 'true'

    // If ANY of these are true, we treat the platform as being in promotional "Free Access" mode
    const isSystemFree = isExamsFree || isExplFree || isAIFree
    
    const tier = this.resolveUserTier(user, isSystemFree)
    if (isSystemFree || tier === 'premium') return true
    
    // Dynamic Limits with hardcoded fallbacks
    const limits = {
      practice: {
        medium: parseInt(config.daily_practice_limit_medium || 8),
        free: parseInt(config.daily_practice_limit_free || 3)
      },
      exam: {
        medium: parseInt(config.daily_exam_limit_medium || 3),
        free: parseInt(config.daily_exam_limit_free || 1)
      }
    }

    const dailyLimit = (tier === 'medium') 
      ? limits[type].medium 
      : limits[type].free

    return (user.daily_sessions || 0) < dailyLimit
  },

  async incrementSessionCount(user) {
    const tier = this.resolveUserTier(user)
    if (tier === 'premium') return
    
    const { error } = await DataService.updateUser(user.id, { 
      daily_sessions: (user.daily_sessions || 0) + 1 
    })
    return !error
  },

  canUseAI(user, config = {}) {
    if (!user) return { canUse: false, reason: 'Please login to use AI' }
    
    // Check global free access toggles
    const isFree = (config.ai_tutor_free_access === true || config.ai_tutor_free_access === 'true') || 
                   (config.explanations_free_access === true || config.explanations_free_access === 'true')
    
    if (isFree) return { canUse: true, usage: 0, limit: 'Unlimited' }

    const tier = this.resolveUserTier(user)

    if (tier === 'freemium') {
       return { 
         canUse: false, 
         reason: `Upgrade your account to Premium to unlock AI Tutor features.` 
       }
    }
    
    if (tier === 'premium') {
      return { canUse: true, reason: 'Premium Unlimited' }
    }

    if (tier === 'medium') {
      const credits = user.ai_credits || 0
      if (credits <= 0) {
        return { 
          canUse: false, 
          reason: `You have 0 AI credits remaining. Renew your Premium subscription for full unlimited access.` 
        }
      }
      return { canUse: true, credits: credits }
    }

    return { canUse: false, reason: 'Upgrade to use AI' }
  },

  async useAICredit(user, config = {}) {
    if (!user) return false
    
    const isFree = (config.ai_tutor_free_access === true || config.ai_tutor_free_access === 'true') || 
                   (config.explanations_free_access === true || config.explanations_free_access === 'true')
    if (isFree) return true

    const tier = this.resolveUserTier(user)
    
    // Premium has unlimited usage
    if (tier === 'premium') return true 

    // Medium uses database credits
    if (tier === 'medium') {
      const { error } = await DataService.useAICredit(user.id)
      return !error
    }

    return false
  },

  resolveUserTier(user, isSystemFree = false) {
    const state = SubscriptionManager.getUserSubscriptionState(user, isSystemFree);
    return state.tier;
  }
}
