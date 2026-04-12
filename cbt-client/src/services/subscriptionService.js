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

    // 2. Check Daily Reset (Sessions)
    const todayStr = now.toISOString().split('T')[0]
    if (user.last_session_date !== todayStr) {
      updates.daily_sessions = 0
      updates.last_session_date = todayStr
    }

    if (Object.keys(updates).length > 0) {
      const { data, error } = await DataService.updateUser(user.id, updates)
      if (!error && data?.[0]) return data[0]
    }

    return user
  },

  canStartSession(user, type = 'practice', isSystemFree = false) {
    if (!user) return false
    const tier = this.resolveUserTier(user, isSystemFree)
    
    if (isSystemFree || tier === 'premium') return true
    
    const dailyLimit = (tier === 'medium') 
      ? (type === 'practice' ? 8 : 3) 
      : (type === 'practice' ? 3 : 1)

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

  canUseAI(user, isSystemFree = false) {
    if (!user) return { canUse: false, reason: 'Please login to use AI' }
    if (isSystemFree) return { canUse: true, usage: 0, limit: 'Unlimited' }

    const tier = this.resolveUserTier(user)

    if (tier === 'freemium') {
       return { canUse: false, reason: 'Activate your account for \u20A61,500 to unlock AI access' }
    }
    
    if (tier === 'premium') {
      return { canUse: true, reason: 'Premium Unlimited' }
    }

    if (tier === 'medium') {
      const credits = user.ai_credits || 0
      if (credits <= 0) {
        return { canUse: false, reason: 'You have 0 AI credits left. Renew Premium for \u20A61,000 for unlimited AI.' }
      }
      return { canUse: true, credits: credits }
    }

    return { canUse: false, reason: 'Upgrade to use AI' }
  },

  async useAICredit(user) {
    if (!user) return false
    const tier = this.resolveUserTier(user)
    
    if (tier === 'premium') return true // Unlimited for premium (rate limited by Edge Function)

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
