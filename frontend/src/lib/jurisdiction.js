export const JURISDICTIONS = Object.freeze([
  { value: 'ACT', label: 'Australian Capital Territory' },
  { value: 'NSW', label: 'New South Wales' },
  { value: 'NT', label: 'Northern Territory' },
  { value: 'QLD', label: 'Queensland' },
  { value: 'SA', label: 'South Australia' },
  { value: 'TAS', label: 'Tasmania' },
  { value: 'VIC', label: 'Victoria' },
  { value: 'WA', label: 'Western Australia' },
])

export const JURISDICTION_CODES = JURISDICTIONS.map(({ value }) => value)

export function isJurisdiction(value) {
  return JURISDICTION_CODES.includes(value)
}

export function jurisdictionLabel(value) {
  return JURISDICTIONS.find((item) => item.value === value)?.label || value || 'Not selected'
}

export function appendConfirmedJurisdiction(formData, value) {
  if (isJurisdiction(value)) formData.append('jurisdiction', value)
  return formData
}

export function jurisdictionChangeRequiresReassessment(previous, next) {
  return isJurisdiction(previous) && isJurisdiction(next) && previous !== next
}
