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
    })
    return { data, error }
  },

  async signOut() {
    const { error } = await supabase.auth.signOut()
    return { error }
  },

  async getCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser()
    return user
  },

  async getProfile(userId) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()
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
      .single()
    
    // If error is PGRST116 (no rows found), the username is available
    if (error && error.code === 'PGRST116') return true
    return false
  }
}
