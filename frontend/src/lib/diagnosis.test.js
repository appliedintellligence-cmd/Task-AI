import test from 'node:test'
import assert from 'node:assert/strict'
import { ANALYSIS_STAGES, canSubmitDiagnosis, validateImageFile } from './diagnosis.js'

const image = (overrides = {}) => ({ type: 'image/jpeg', size: 1024, ...overrides })
test('camera upload validation rejects missing, non-image and oversized files', () => {
  assert.match(validateImageFile(null), /Choose/)
  assert.match(validateImageFile(image({ type: 'text/plain' })), /JPG/)
  assert.match(validateImageFile(image({ size: 13 * 1024 * 1024 })), /12 MB/)
  assert.equal(validateImageFile(image()), null)
})
test('diagnosis submission prevents duplicates and requires jurisdiction', () => {
  assert.equal(canSubmitDiagnosis({ file: image(), jurisdiction: 'VIC', loading: false }), true)
  assert.equal(canSubmitDiagnosis({ file: image(), jurisdiction: 'VIC', loading: true }), false)
  assert.equal(canSubmitDiagnosis({ file: image(), jurisdiction: null, loading: false }), false)
})
test('analysis progress uses the five safety-aware stages in order', () => {
  assert.deepEqual(ANALYSIS_STAGES, ['Checking image quality','Identifying the affected area','Assessing hazards','Checking DIY eligibility','Preparing the result'])
})
