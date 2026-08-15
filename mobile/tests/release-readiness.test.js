const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { pathToFileURL } = require('node:url')

const mobileRoot = path.join(__dirname, '..')
const read = (relative) => fs.readFileSync(path.join(mobileRoot, relative), 'utf8')

test('auth callback parser accepts confirmation, PKCE, and recovery links', async () => {
  const authLinks = await import(pathToFileURL(path.join(mobileRoot, 'services/authLinks.ts')).href)
  assert.deepEqual(
    authLinks.parseAuthCallback('taskai://auth/callback?code=pkce-code'),
    { code: 'pkce-code', accessToken: undefined, refreshToken: undefined, type: undefined, error: undefined },
  )
  assert.deepEqual(
    authLinks.parseAuthCallback('taskai://auth/callback?flow=recovery#access_token=access&refresh_token=refresh&type=recovery'),
    { code: undefined, accessToken: 'access', refreshToken: 'refresh', type: 'recovery', error: undefined },
  )
})

test('navigation guard protects product routes and prioritises recovery', async () => {
  const navigation = await import(pathToFileURL(path.join(mobileRoot, 'services/navigation.ts')).href)
  assert.equal(navigation.navigationTarget({ loading: true, hasSession: false, inAuthGroup: false, recoveryMode: false }), null)
  assert.equal(navigation.navigationTarget({ loading: false, hasSession: false, inAuthGroup: false, recoveryMode: false }), '/(auth)/login')
  assert.equal(navigation.navigationTarget({ loading: false, hasSession: true, inAuthGroup: true, recoveryMode: false }), '/(tabs)')
  assert.equal(navigation.navigationTarget({ loading: false, hasSession: true, inAuthGroup: false, recoveryMode: true }), '/(auth)/reset-password')
})

test('inpaint attaches the bearer token and clears an expired local session', () => {
  const api = read('services/api.ts')
  assert.match(api, /inpaintImage\([\s\S]*token: string/)
  assert.match(api, /request<\{ repaired_image_url: string \}>\('\/inpaint',[\s\S]*\}, token\)/)
  assert.match(api, /Authorization: `Bearer \$\{token\}`/)
  assert.match(api, /res\.status === 401 && token/)
  assert.match(api, /supabase\.auth\.signOut\(\{ scope: 'local' \}\)/)
})

test('login, logout, and password recovery are wired without guest diagnosis', () => {
  const login = read('app/(auth)/login.tsx')
  const auth = read('context/AuthContext.tsx')
  const forgot = read('app/(auth)/forgot-password.tsx')
  const reset = read('app/(auth)/reset-password.tsx')
  assert.doesNotMatch(login, /Continue without account/)
  assert.match(login, /\(auth\)\/forgot-password/)
  assert.match(auth, /signInWithPassword/)
  assert.match(auth, /auth\.signOut\(\)/)
  assert.match(auth, /resetPasswordForEmail/)
  assert.match(auth, /exchangeCodeForSession/)
  assert.match(auth, /auth\.setSession/)
  assert.match(forgot, /requestPasswordReset/)
  assert.match(reset, /updatePassword/)
})

test('Android uses Expo image picker without deprecated broad storage permission', () => {
  const config = read('app.json')
  const analyse = read('app/(tabs)/index.tsx')
  assert.doesNotMatch(config, /READ_EXTERNAL_STORAGE/)
  assert.match(config, /"microphonePermission": false/)
  assert.match(config, /expo-image-picker/)
  assert.match(analyse, /launchCameraAsync/)
  assert.match(analyse, /launchImageLibraryAsync/)
  assert.match(analyse, /requestCameraPermissionsAsync/)
  assert.match(analyse, /requestMediaLibraryPermissionsAsync/)
  assert.match(read('app/guided.tsx'), /requestCameraPermissionsAsync/)
})

test('App Store privacy, AI consent, and account deletion are accessible', () => {
  const settings = read('app/(tabs)/settings.tsx')
  const analyse = read('app/(tabs)/index.tsx')
  const api = read('services/api.ts')
  assert.match(settings, /Privacy Policy/)
  assert.match(settings, /Terms of Use/)
  assert.match(settings, /Delete account/)
  assert.match(analyse, /AI photo processing/)
  assert.match(analyse, /AI_CONSENT_STORAGE_KEY/)
  assert.match(api, /method: 'DELETE'/)
  assert.match(api, /'\/account'/)
})

test('production profile uses an iOS 26 capable SDK image', () => {
  const eas = JSON.parse(read('eas.json'))
  assert.equal(eas.build.production.ios.image, 'sdk-57')
  assert.equal(eas.build.production.autoIncrement, true)
  assert.equal(eas.cli.requireCommit, true)
})
