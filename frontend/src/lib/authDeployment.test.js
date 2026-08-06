import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const app = fs.readFileSync(new URL('../App.jsx', import.meta.url), 'utf8')
const callback = fs.readFileSync(new URL('../pages/AuthCallback.jsx', import.meta.url), 'utf8')
const supabase = fs.readFileSync(new URL('./supabase.js', import.meta.url), 'utf8')
const vercel = fs.readFileSync(new URL('../../vercel.json', import.meta.url), 'utf8')

test('router and Vercel both serve the OAuth callback route', () => {
  assert.match(app, /path="\/auth\/callback"/)
  assert.match(vercel, /"source": "\/auth\/callback"/)
})

test('callback exchanges PKCE codes, verifies session, and routes to the app', () => {
  assert.match(callback, /exchangeCodeForSession/)
  assert.match(callback, /supabase\.auth\.getSession/)
  assert.match(callback, /MAIN_APP_PATH/)
  assert.match(callback, /loginErrorUrl/)
})

test('Supabase configuration is Vite-only and contains no hardcoded project credentials', () => {
  assert.match(supabase, /VITE_SUPABASE_URL/)
  assert.match(supabase, /VITE_SUPABASE_ANON_KEY/)
  assert.doesNotMatch(supabase, /https:\/\/[^'"`]+\.supabase\.co/)
  assert.match(supabase, /redirectTo: oauthRedirectUrl\(\)/)
})
