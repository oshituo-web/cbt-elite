import { DataService } from './data'

export const SubscriptionService = {
  // Logic: Demote if premium expired, and reset daily counts if date changed
  async handleTierTransition(user) {
    if (!user) return null
    
    let updates = {}
    const now = new Date()
    const premiumUntil = user.premium_until ? new Date(user.premium_until) : null

    // 1. Check Tier Transition
    if (user.tier === 'premium' && premiumUntil && premiumUntil < now) {
      updates.tier = user.is_activated ? 'medium' : 'freemium'
    }

    // 2. Check Daily Reset (AI Usage and Sessions)
    const todayStr = now.toISOString().split('T')[0]
    if (user.last_ai_reset_date !== todayStr) {
      updates.ai_daily_usage = 0
      updates.last_ai_reset_date = todayStr
    }
    
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

  canStartSession(user, type = 'practice') {
    if (!user) return false
    if (user.tier === 'premium') return true
    
    const dailyLimit = (user.tier === 'medium') 
      ? (type === 'practice' ? 5 : 2) 
      : (type === 'practice' ? 3 : 1)

    return (user.daily_sessions || 0) < dailyLimit
  },

  async incrementSessionCount(user) {
    if (!user || user.tier === 'premium') return
    const { error } = await DataService.updateUser(user.id, { 
      daily_sessions: (user.daily_sessions || 0) + 1 
    })
    return !error
  },

  canUseAI(user) {
    if (!user) return { canUse: false, reason: 'Please login to use AI' }
    if (user.tier === 'freemium' || user.tier === 'free') {
       return { canUse: false, reason: 'Activate your account for \u20A61,500 to unlock AI access' }
    }
    
    if (user.tier === 'premium') {
      const usage = user.ai_daily_usage || 0
      if (usage >= 30) {
        return { canUse: false, reason: "You've reached today's AI limit (30/day). Please continue tomorrow." }
      }
      return { canUse: true, usage: usage + 1, limit: 30 }
    }

    if (user.tier === 'medium') {
      const credits = user.ai_credits || 0
      if (credits <= 0) {
        return { canUse: false, reason: 'You have 0 AI credits left this month. Renew Premium for \u20A61,000 for unlimited AI.' }
      }
      return { canUse: true, credits: credits }
    }

    return { canUse: false, reason: 'Upgrade to use AI' }
  },

  async useAICredit(user) {
    if (!user) return false
    
    if (user.tier === 'premium') {
      await DataService.updateUser(user.id, { 
        ai_daily_usage: (user.ai_daily_usage || 0) + 1 
      })
      return true
    }

    if (user.tier === 'medium') {
      const { error } = await DataService.updateUser(user.id, { 
        ai_credits: Math.max(0, (user.ai_credits || 0) - 1) 
      })
      return !error
    }

    return false
  }
}
