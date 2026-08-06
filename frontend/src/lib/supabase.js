import { createClient } from '@supabase/supabase-js'
import { oauthRedirectUrl } from './authFlow'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Task AI authentication configuration is missing required VITE_SUPABASE_* variables.')
  throw new Error('Authentication is temporarily unavailable.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
})

export async function signUpWithEmail(email, password, firstName, lastName, phone, jurisdiction) {
  return supabase.auth.signUp({
    email,
    password,
    options: {
      data: { first_name: firstName, last_name: lastName, phone, jurisdiction },
      emailRedirectTo: oauthRedirectUrl(),
    },
  })
}

export async function getProfileJurisdiction(userId) {
  if (!userId) return null
  const { data, error } = await supabase
    .from('profiles')
    .select('jurisdiction')
    .eq('id', userId)
    .maybeSingle()
  if (error) throw error
  return data?.jurisdiction || null
}

export async function updateProfileJurisdiction(userId, jurisdiction) {
  const { error } = await supabase.from('profiles').update({ jurisdiction }).eq('id', userId)
  if (error) throw error
  return jurisdiction
}

export async function signInWithEmail(email, password) {
  return supabase.auth.signInWithPassword({ email, password })
}

export async function signInWithGoogle() {
  return supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: oauthRedirectUrl() },
  })
}

export async function signOut() {
  return supabase.auth.signOut()
}

export async function getCurrentUser() {
  const { data } = await supabase.auth.getUser()
  return data.user
}
