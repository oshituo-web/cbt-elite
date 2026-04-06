import { supabase } from '../utils/supabase'

export const AuthService = {
  async signUp(email, password) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
      }
    })
    return { data, error }
  },

  async resendConfirmationEmail(email) {
    const { data, error } = await supabase.auth.resend({
      type: 'signup',
      email,
    })
    return { data, error }
  },

  async signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    return { data, error }
  },

  async signInWithGoogle() {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        }
      }
    })
    return { data, error }
  },

  async sendPasswordResetEmail(email) {
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}#reset-password`,
    })
    return { data, error }
  },

  async updatePassword(newPassword) {
    const { data, error } = await supabase.auth.updateUser({
      password: newPassword
    })
    return { data, error }
  },

  async signOut() {
    const { error } = await supabase.auth.signOut()
    return { error }
  },

  async getCurrentUser() {
    try {
      const { data: { user }, error } = await supabase.auth.getUser()
      if (error) throw error
      return user
    } catch (e) {
      console.error("AuthService.getCurrentUser failure:", e)
      return null
    }
  },

  async getProfile(userId) {
    // 💡 Robust UUID Validation to prevent 400 Bad Request
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!userId || typeof userId !== 'string' || !uuidRegex.test(userId)) {
      console.warn("AuthService.getProfile: Invalid UUID format", userId)
      return { data: null, error: { message: "Invalid UUID format", status: 400 } }
    }
    
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .limit(1)
      .maybeSingle()
    return { data, error }
  },

  async updateProfile(profile) {
    const { data, error } = await supabase
      .from('users')
      .upsert(profile)
      .select()
    return { data, error }
  },

  async isUsernameAvailable(username) {
    const { data, error } = await supabase
      .from('users')
      .select('username')
      .eq('username', username)
      .maybeSingle()
    
    return !data && !error
  }
}
