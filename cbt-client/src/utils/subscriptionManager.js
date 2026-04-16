export const SubscriptionManager = {
  /**
   * 🗺️ Strict Tier Model Resolution
   * freemium: Not activated
   * medium: Activated but subscription expired (grace access)
   * premium: Activated and Active
   */
  getUserSubscriptionState(user, isSystemFree = false) {
    const state = {
      tier: 'freemium',
      isActivated: false,
      subscriptionExpiry: null,
      daysRemaining: 0,
      isExpired: false,
      shouldShowRenewCTA: false,
      shouldShowActivateCTA: false
    };

    if (isSystemFree) {
        state.tier = 'premium';
        state.isActivated = true;
        state.daysRemaining = 999;
        return state;
    }

    if (!user) {
      state.shouldShowActivateCTA = true;
      return state;
    }

    // Standardize database column mapping
    // Handle aliases like 'premium_until' or 'subscription_expiry'
    state.isActivated = !!(user.activation_status || user.is_activated);
    const expiryDate = user.subscription_expiry || user.premium_until || user.subscription_until;
    state.subscriptionExpiry = expiryDate ? new Date(expiryDate) : null;

    if (!state.isActivated) {
      state.tier = 'freemium';
      state.shouldShowActivateCTA = true;
      state.shouldShowRenewCTA = false;
    } else {
      const now = new Date();
      if (state.subscriptionExpiry && now < state.subscriptionExpiry) {
        state.tier = 'premium';
        
        const diffTime = Math.abs(state.subscriptionExpiry - now);
        state.daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        state.shouldShowRenewCTA = state.daysRemaining <= 5;
        state.shouldShowActivateCTA = false;
      } else {
        // Activated but expired = Medium Tier
        state.tier = 'medium'; 
        state.isExpired = !!state.subscriptionExpiry;
        state.shouldShowRenewCTA = true;
        state.shouldShowActivateCTA = false;
      }
    }

    return state;
  }
};
