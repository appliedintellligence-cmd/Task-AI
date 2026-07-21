import test from 'node:test'
import assert from 'node:assert/strict'
import { isRecoverySession, validateRecoveryPassword } from './passwordRecovery.js'

test('password recovery validates required length and confirmation', () => {
  assert.equal(validateRecoveryPassword('', ''), 'Enter a new password.')
  assert.match(validateRecoveryPassword('short', 'short'), /at least 8/)
  assert.equal(validateRecoveryPassword('long-enough', 'different'), 'Passwords do not match.')
  assert.equal(validateRecoveryPassword('long-enough', 'long-enough'), null)
})

test('recovery accepts the explicit event or a recovered session after refresh', () => {
  assert.equal(isRecoverySession('PASSWORD_RECOVERY', null), true)
  assert.equal(isRecoverySession('INITIAL_SESSION', { access_token: 'token', user: { id: 'u' } }), true)
  assert.equal(isRecoverySession('INITIAL_SESSION', null), false)
})
