export const AUTH_CALLBACK_PATH = '/auth/callback'
export const MAIN_APP_PATH = '/app'

export function oauthRedirectUrl(origin = window.location.origin) {
  return `${origin}${AUTH_CALLBACK_PATH}`
}

export function callbackErrorFromUrl(url = window.location.href) {
  const parsed = new URL(url)
  const hash = new URLSearchParams(parsed.hash.replace(/^#/, ''))
  return (
    parsed.searchParams.get('error_description') ||
    hash.get('error_description') ||
    parsed.searchParams.get('error') ||
    hash.get('error') ||
    null
  )
}

export function loginErrorUrl(message) {
  return `/login?error=${encodeURIComponent(message)}`
}
