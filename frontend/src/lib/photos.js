import { apiFetch } from './api.js'

export async function refreshRepairPhoto({ apiUrl, jobId, token, fetcher = apiFetch }) {
  if (!apiUrl || !jobId || !token) throw new Error('Photo refresh requires an authenticated saved job')
  return fetcher(`${apiUrl}/jobs/${encodeURIComponent(jobId)}/photo-url`, {
    headers: { Authorization: `Bearer ${token}` },
  })
}
