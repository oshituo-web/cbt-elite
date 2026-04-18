import { describe, it, expect } from 'vitest'
import { SubscriptionManager } from '../src/utils/subscriptionManager.js'

describe('SubscriptionManager', () => {
    it('returns freemium tier for unactivated users', () => {
         const state = SubscriptionManager.getUserSubscriptionState({ activation_status: false })
         expect(state.tier).toBe('freemium')
         expect(state.isPremium).toBe(false)
    })
    
    it('returns lifetime tier for activated users with no premium_until', () => {
         const state = SubscriptionManager.getUserSubscriptionState({ activation_status: true, premium_until: null })
         expect(state.tier).toBe('lifetime')
         expect(state.isPremium).toBe(true)
    })
    
    it('returns monthly tier for users with future premium_until', () => {
         const futureDate = new Date(Date.now() + 86400000 * 5).toISOString()
         const state = SubscriptionManager.getUserSubscriptionState({ activation_status: true, premium_until: futureDate })
         expect(state.tier).toBe('monthly')
         expect(state.isPremium).toBe(true)
    })
    
    it('returns medium tier for users with expired premium_until', () => {
         const pastDate = new Date(Date.now() - 86400000 * 2).toISOString() // expired 2 days ago
         const state = SubscriptionManager.getUserSubscriptionState({ activation_status: true, premium_until: pastDate })
         expect(state.tier).toBe('medium')
         expect(state.isPremium).toBe(false)
    })

    it('gracefully handles missing user object', () => {
         const state = SubscriptionManager.getUserSubscriptionState(null)
         expect(state.tier).toBe('freemium')
    })
})
