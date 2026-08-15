export const SESSION_IDLE_TIMEOUT_MS = 5 * 60 * 1000
export const LAST_ACTIVITY_STORAGE_KEY = 'task-ai:last-activity-at'

export function isSessionIdle(lastActivityAt, now = Date.now(), timeoutMs = SESSION_IDLE_TIMEOUT_MS) {
  const timestamp = Number(lastActivityAt)
  return Number.isFinite(timestamp) && timestamp > 0 && now - timestamp >= timeoutMs
}

export function remainingSessionTime(lastActivityAt, now = Date.now(), timeoutMs = SESSION_IDLE_TIMEOUT_MS) {
  const timestamp = Number(lastActivityAt)
  if (!Number.isFinite(timestamp) || timestamp <= 0) return timeoutMs
  return Math.max(0, timeoutMs - (now - timestamp))
}
