import { createClient } from '@supabase/supabase-js'
import { oauthRedirectUrl } from './authFlow'
import { LAST_ACTIVITY_STORAGE_KEY } from './sessionTimeout'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

function configurationError() {
  if (!supabaseUrl || !supabaseAnonKey) {
    return 'Authentication is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Vercel, then redeploy.'
  }
  try {
    const url = new URL(supabaseUrl)
    if (url.protocol !== 'https:' && url.hostname !== 'localhost') throw new Error('Invalid protocol')
  } catch {
    return 'Authentication is not configured correctly. Check VITE_SUPABASE_URL in Vercel, then redeploy.'
  }
  return null
}

export const supabaseConfigurationError = configurationError()

if (supabaseConfigurationError) {
  console.error('Task AI authentication configuration is missing required VITE_SUPABASE_* variables.')
}

export const supabase = supabaseConfigurationError ? null : createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
})

function requireSupabase() {
  if (supabaseConfigurationError || !supabase) throw new Error(supabaseConfigurationError)
  return supabase
}

export function supabaseAuthEndpoint(path = '') {
  if (!supabaseUrl) return 'Supabase Auth endpoint unavailable'
  try {
    return new URL(`/auth/v1/${path.replace(/^\//, '')}`, supabaseUrl).toString()
  } catch {
    return 'Supabase Auth endpoint unavailable'
  }
}

export async function signUpWithEmail(email, password, firstName, lastName, phone, jurisdiction) {
  const client = requireSupabase()
  const endpoint = supabaseAuthEndpoint('signup')
  console.info('Task AI registration request:', endpoint)
  try {
    const result = await client.auth.signUp({
      email,
      password,
      options: {
        data: { first_name: firstName, last_name: lastName, phone, jurisdiction },
        emailRedirectTo: oauthRedirectUrl(),
      },
    })
    if (result.error) {
      console.error('Task AI registration was rejected:', {
        endpoint,
        message: result.error.message,
        status: result.error.status,
        code: result.error.code,
      })
    }
    return result
  } catch (error) {
    console.error('Task AI registration request failed:', {
      endpoint,
      message: error?.message,
      name: error?.name,
    })
    throw error
  }
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
  return requireSupabase().auth.signInWithPassword({ email, password })
}

export async function signInWithGoogle() {
  return requireSupabase().auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: oauthRedirectUrl() },
  })
}

export async function signOut() {
  localStorage.removeItem(LAST_ACTIVITY_STORAGE_KEY)
  return requireSupabase().auth.signOut()
}

export async function getCurrentUser() {
  const { data } = await requireSupabase().auth.getUser()
  return data.user
}
