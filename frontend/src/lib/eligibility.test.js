import test from 'node:test'
import assert from 'node:assert/strict'
import { acknowledgementKey, eligibilityState, instructionsAllowed } from './eligibility.js'

for (const [level, canStart] of [[1,true],[2,true],[3,false],[4,false]]) test(`level ${level} has enforced entry behaviour`, () => {
  const assessment={assessment_status:'complete',safety_level:level}
  assert.equal(eligibilityState(assessment).canStart,canStart)
  assert.equal(instructionsAllowed(assessment, level === 2),canStart)
  if(level===2) assert.equal(instructionsAllowed(assessment,false),false)
})
for (const status of ['assessment_pending','more_information_required','jurisdiction_required','policy_unverified']) test(`${status} has no level and stays locked`,()=>{
  const state=eligibilityState({assessment_status:status,safety_level:null})
  assert.equal(state.level,null); assert.equal(state.canStart,false); assert.equal(state.unresolved,true)
})
test('precaution acknowledgement is assessment-version specific',()=>{
  const a={validation_version:'2.0',policy_source:{policy_version:'vic-1'},assessed_at:'now'}
  assert.notEqual(acknowledgementKey(a),acknowledgementKey({...a,validation_version:'2.1'}))
})
test('direct route state cannot unlock a backend-blocked assessment',()=>assert.equal(instructionsAllowed({assessment_status:'complete',safety_level:3},true),false))
