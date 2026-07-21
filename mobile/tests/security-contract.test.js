const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const api = fs.readFileSync(path.join(__dirname, '../services/api.ts'), 'utf8')
const supabase = fs.readFileSync(path.join(__dirname, '../services/supabase.ts'), 'utf8')

test('mobile refreshes signed photos through the authenticated job endpoint', () => {
  assert.match(api, /jobs\/\$\{encodeURIComponent\(jobId\)\}\/photo-url/)
  assert.match(api, /return request\([^\n]+\{\}, token\)/)
  assert.match(api, /if \(!jobId \|\| !token\)/)
})

test('mobile service configuration is environment-only', () => {
  assert.match(api, /process\.env\.EXPO_PUBLIC_API_URL/)
  assert.match(supabase, /process\.env\.EXPO_PUBLIC_SUPABASE_URL/)
  assert.match(supabase, /process\.env\.EXPO_PUBLIC_SUPABASE_ANON_KEY/)
  assert.doesNotMatch(api, /onrender\.com/)
  assert.doesNotMatch(supabase, /supabase\.co/)
  assert.doesNotMatch(supabase, /SUPABASE_SERVICE_KEY/)
})
