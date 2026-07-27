export const MIN_PASSWORD_LENGTH = 8

export function validateRecoveryPassword(password, confirmation) {
  if (!password) return 'Enter a new password.'
  if (password.length < MIN_PASSWORD_LENGTH) return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`
  if (password !== confirmation) return 'Passwords do not match.'
  return null
}

export function isRecoverySession(event, session) {
  return event === 'PASSWORD_RECOVERY' || Boolean(session?.access_token && session?.user)
}
