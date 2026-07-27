export const ANALYSIS_STAGES = Object.freeze([
  'Checking image quality',
  'Identifying the affected area',
  'Assessing hazards',
  'Checking DIY eligibility',
  'Preparing the result',
])

export function validateImageFile(file, maxBytes = 12 * 1024 * 1024) {
  if (!file) return 'Choose a photo to continue.'
  if (!file.type?.startsWith('image/')) return 'Choose a JPG, PNG, HEIC or WebP image.'
  if (file.size > maxBytes) return 'Photo must be smaller than 12 MB.'
  return null
}

export function canSubmitDiagnosis({ file, jurisdiction, loading }) {
  return Boolean(file && jurisdiction && !loading && !validateImageFile(file))
}
