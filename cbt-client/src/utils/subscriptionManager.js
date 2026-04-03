export const SubscriptionManager = {
  getUserSubscriptionState(user, isSystemFree = false) {
    const state = {
      tier: 'freemium',
      isActivated: false,
      premiumUntil: null,
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

    state.isActivated = !!user.is_activated;
    state.premiumUntil = user.premium_until ? new Date(user.premium_until) : null;

    if (!state.isActivated) {
      state.tier = 'freemium';
      state.shouldShowActivateCTA = true;
      state.shouldShowRenewCTA = false;
    } else {
      const now = new Date();
      if (state.premiumUntil && now < state.premiumUntil) {
        state.tier = 'premium';
        
        // Calculate days remaining
        const diffTime = Math.abs(state.premiumUntil - now);
        state.daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (state.daysRemaining <= 5) {
          state.shouldShowRenewCTA = true;
        } else {
          state.shouldShowRenewCTA = false;
        }
        state.shouldShowActivateCTA = false;
      } else {
        state.tier = 'medium';
        if (state.premiumUntil) {
           state.isExpired = true;
        }
        state.shouldShowRenewCTA = true;
        state.shouldShowActivateCTA = false;
      }
    }

    return state;
  }
};
