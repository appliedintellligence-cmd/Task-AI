import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const app = fs.readFileSync(new URL('../App.jsx', import.meta.url), 'utf8')
const callback = fs.readFileSync(new URL('../pages/AuthCallback.jsx', import.meta.url), 'utf8')
const login = fs.readFileSync(new URL('../pages/Login.jsx', import.meta.url), 'utf8')
const supabase = fs.readFileSync(new URL('./supabase.js', import.meta.url), 'utf8')
const vercel = fs.readFileSync(new URL('../../vercel.json', import.meta.url), 'utf8')

test('router and Vercel both serve the OAuth callback route', () => {
  assert.match(app, /path="\/auth\/callback"/)
  assert.match(vercel, /"source": "\/auth\/callback"/)
})

test('callback exchanges PKCE codes, verifies session, and routes to the root', () => {
  assert.match(callback, /exchangeCodeForSession/)
  assert.match(callback, /supabase\.auth\.getSession/)
  assert.match(callback, /navigate\('\/', \{ replace: true \}\)/)
  assert.match(callback, /loginErrorUrl/)
  assert.match(callback, /Signing you in\.\.\./)
})

test('Supabase configuration is Vite-only and contains no hardcoded project credentials', () => {
  assert.match(supabase, /VITE_SUPABASE_URL/)
  assert.match(supabase, /VITE_SUPABASE_ANON_KEY/)
  assert.doesNotMatch(supabase, /https:\/\/[^'"`]+\.supabase\.co/)
  assert.match(supabase, /redirectTo: oauthRedirectUrl\(\)/)
  assert.doesNotMatch(supabase, /VITE_API_URL/)
})

test('registration reports configuration, network and Supabase errors without logging secrets', () => {
  assert.match(supabase, /supabaseConfigurationError/)
  assert.match(supabase, /supabaseAuthEndpoint\('signup'\)/)
  assert.match(supabase, /message: result\.error\.message/)
  assert.doesNotMatch(supabase, /console\.(?:info|error)\([^\n]*(?:password|supabaseAnonKey)/)
  assert.match(login, /error\?\.message === 'Failed to fetch'/)
  assert.match(login, /Could not reach the registration service/)
})
