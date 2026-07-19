export const UNRESOLVED_ASSESSMENTS = new Set(['assessment_pending', 'more_information_required', 'jurisdiction_required', 'policy_unverified'])
export const LEVELS = Object.freeze({
  1: { title: 'Safe for DIY', tone: 'sage', canStart: true, acknowledgement: false },
  2: { title: 'DIY with caution', tone: 'orange', canStart: true, acknowledgement: true },
  3: { title: 'Professional required', tone: 'red', canStart: false, acknowledgement: false },
  4: { title: 'Emergency', tone: 'red', canStart: false, acknowledgement: false },
})

export function eligibilityState(assessment) {
  if (!assessment || UNRESOLVED_ASSESSMENTS.has(assessment.assessment_status) || assessment.safety_level == null) {
    return { title: (assessment?.assessment_status || 'assessment_pending').replaceAll('_', ' '), level: null, canStart: false, acknowledgement: false, unresolved: true }
  }
  const level = LEVELS[assessment.safety_level]
  return { ...level, level: assessment.safety_level, unresolved: false }
}

export function acknowledgementKey(assessment) {
  return `taskai:precaution:${assessment?.validation_version || 'unknown'}:${assessment?.policy_source?.policy_version || 'unknown'}:${assessment?.assessed_at || 'unknown'}`
}

export function instructionsAllowed(assessment, acknowledged = false) {
  const state = eligibilityState(assessment)
  return state.canStart && (!state.acknowledgement || acknowledged)
}
