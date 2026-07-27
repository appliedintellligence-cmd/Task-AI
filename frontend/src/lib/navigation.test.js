import test from 'node:test'
import assert from 'node:assert/strict'
import { MOBILE_NAVIGATION, WEB_NAVIGATION } from './navigation.js'

test('web product navigation exposes every required destination', () => {
  assert.deepEqual(WEB_NAVIGATION.map(({ label }) => label), [
    'Home', 'New diagnosis', 'My repairs', 'Shopping lists', 'Settings',
  ])
  assert.equal(new Set(WEB_NAVIGATION.map(({ path }) => path)).size, WEB_NAVIGATION.length)
})

test('mobile navigation has one prominent central Scan action', () => {
  assert.deepEqual(MOBILE_NAVIGATION.map(({ label }) => label), ['Home', 'Repairs', 'Scan', 'Lists', 'Profile'])
  assert.equal(MOBILE_NAVIGATION[2].prominent, true)
  assert.equal(MOBILE_NAVIGATION.filter(({ prominent }) => prominent).length, 1)
})
