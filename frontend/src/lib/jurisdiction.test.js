import test from 'node:test'
import assert from 'node:assert/strict'
import {
  appendConfirmedJurisdiction,
  JURISDICTION_CODES,
  isJurisdiction,
  jurisdictionChangeRequiresReassessment,
  jurisdictionLabel,
} from './jurisdiction.js'

test('web supports the eight Australian jurisdictions', () => {
  assert.deepEqual(JURISDICTION_CODES, ['ACT', 'NSW', 'NT', 'QLD', 'SA', 'TAS', 'VIC', 'WA'])
})

test('invalid and unconfirmed values are rejected', () => {
  assert.equal(isJurisdiction('VIC'), true)
  assert.equal(isJurisdiction('vic'), false)
  assert.equal(isJurisdiction('NZ'), false)
  assert.equal(isJurisdiction(''), false)
})

test('saved code has the same display meaning', () => {
  assert.equal(jurisdictionLabel('VIC'), 'Victoria')
  assert.equal(jurisdictionLabel(null), 'Not selected')
})

test('diagnosis form includes only a confirmed jurisdiction', () => {
  const confirmed = appendConfirmedJurisdiction(new FormData(), 'VIC')
  const missing = appendConfirmedJurisdiction(new FormData(), null)
  assert.equal(confirmed.get('jurisdiction'), 'VIC')
  assert.equal(missing.get('jurisdiction'), null)
})

test('changing a confirmed jurisdiction requires reassessment', () => {
  assert.equal(jurisdictionChangeRequiresReassessment('VIC', 'NSW'), true)
  assert.equal(jurisdictionChangeRequiresReassessment('VIC', 'VIC'), false)
  assert.equal(jurisdictionChangeRequiresReassessment(null, 'VIC'), false)
})
