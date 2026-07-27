import { instructionsAllowed } from './eligibility.js'

export function resultCapabilities(result, acknowledged = false) {
  const allowed = instructionsAllowed(result?.diy_assessment, acknowledged) && result?.instructions_suppressed !== true
  return { showSteps: allowed, showMaterials: allowed, showPreview: allowed && Boolean(result?.inpaint_prompt) }
}

export function materialPrice(material) {
  return material?.estimated_cost_aud == null ? 'Price unavailable' : `$${Number(material.estimated_cost_aud).toFixed(2)} AUD`
}

export function historicalAssessmentState(result) {
  return result?.requires_reassessment || result?.diy_assessment?.assessment_status === 'assessment_pending' ? 'reassessment_required' : 'restored'
}
