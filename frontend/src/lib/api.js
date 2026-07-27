// Lightweight fetch wrapper used across the app.
// Turns network failures, non-JSON responses, and expired-auth (401/403)
// into typed ApiError instances so callers can show a visible message,
// offer a retry, or redirect to login.

export class ApiError extends Error {
  constructor(message, { status = 0, isAuth = false, isNetwork = false } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.isAuth = isAuth
    this.isNetwork = isNetwork
  }
}

export async function apiFetch(url, options = {}) {
  let res
  try {
    res = await fetch(url, options)
  } catch {
    throw new ApiError('Network error. Please check your connection and try again.', { isNetwork: true })
  }

  if (res.status === 401 || res.status === 403) {
    throw new ApiError('Your session has expired. Please sign in again.', {
      status: res.status,
      isAuth: true,
    })
  }

  const raw = await res.text()
  let data = null
  if (raw) {
    try {
      data = JSON.parse(raw)
    } catch {
      throw new ApiError(
        res.ok
          ? 'Received an invalid response from the server.'
          : 'Something went wrong. Please try again.',
        { status: res.status },
      )
    }
  }

  if (!res.ok) {
    const detail = data && (data.detail || data.error || data.message)
    throw new ApiError(
      typeof detail === 'string' && detail ? detail : 'Request failed. Please try again.',
      { status: res.status },
    )
  }

  return data
}
