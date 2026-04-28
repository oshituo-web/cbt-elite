import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || import.meta.env.SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase credentials missing!')
}

// 💡 Singleton Pattern to prevent "Multiple GoTrueClient instances" warning
// Use globalThis to work in both main thread and Service Workers
if (!globalThis._supabaseInstance) {
    globalThis._supabaseInstance = createClient(supabaseUrl, supabaseAnonKey)
}

export const supabase = globalThis._supabaseInstance
