import test from 'node:test'
import assert from 'node:assert/strict'
import { isSessionIdle, remainingSessionTime, SESSION_IDLE_TIMEOUT_MS } from './sessionTimeout.js'

test('a session becomes idle after five minutes without activity', () => {
  const now = 1_000_000
  assert.equal(isSessionIdle(now - SESSION_IDLE_TIMEOUT_MS + 1, now), false)
  assert.equal(isSessionIdle(now - SESSION_IDLE_TIMEOUT_MS, now), true)
})

test('missing activity starts with a full timeout window', () => {
  assert.equal(isSessionIdle(null, 1_000_000), false)
  assert.equal(remainingSessionTime(null, 1_000_000), SESSION_IDLE_TIMEOUT_MS)
})

test('remaining time never drops below zero', () => {
  assert.equal(remainingSessionTime(1, SESSION_IDLE_TIMEOUT_MS + 10), 0)
})
