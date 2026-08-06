import test from 'node:test'
import assert from 'node:assert/strict'
import { callbackErrorFromUrl, loginErrorUrl, oauthRedirectUrl } from './authFlow.js'

test('Google OAuth redirects through the dedicated production callback', () => {
  assert.equal(oauthRedirectUrl('https://task-ai.example'), 'https://task-ai.example/auth/callback')
})

test('OAuth callback errors are read from query or fragment safely', () => {
  assert.equal(callbackErrorFromUrl('https://task-ai.example/auth/callback?error_description=Access%20denied'), 'Access denied')
  assert.equal(callbackErrorFromUrl('https://task-ai.example/auth/callback#error=server_error'), 'server_error')
  assert.equal(callbackErrorFromUrl('https://task-ai.example/auth/callback#access_token=secret'), null)
})

test('callback failures return to login as an encoded visible error', () => {
  assert.equal(loginErrorUrl('Access denied'), '/login?error=Access%20denied')
})
