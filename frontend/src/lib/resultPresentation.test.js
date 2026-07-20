import test from 'node:test'
import assert from 'node:assert/strict'
import { historicalAssessmentState, materialPrice, resultCapabilities } from './resultPresentation.js'

for(const level of [1,2,3,4]) test(`result capabilities respect level ${level}`,()=>{
  const caps=resultCapabilities({diy_assessment:{assessment_status:'complete',safety_level:level},inpaint_prompt:'x'},level===2)
  assert.equal(caps.showSteps,level<3);assert.equal(caps.showPreview,level<3)
})
for(const status of ['assessment_pending','more_information_required','jurisdiction_required','policy_unverified']) test(`result locks ${status}`,()=>assert.equal(resultCapabilities({diy_assessment:{assessment_status:status,safety_level:null},inpaint_prompt:'x'},true).showMaterials,false))
test('missing material prices render safely',()=>assert.equal(materialPrice({name:'Filler'}),'Price unavailable'))
test('old jobs require reassessment while versioned jobs restore',()=>{assert.equal(historicalAssessmentState({requires_reassessment:true}),'reassessment_required');assert.equal(historicalAssessmentState({diy_assessment:{assessment_status:'complete'}}),'restored')})
