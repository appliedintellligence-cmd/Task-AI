import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { refreshRepairPhoto } from '../lib/photos'

export default function RepairPhoto({ jobId, src, alt = '', className = '' }) {
  const [url, setUrl] = useState(src)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => setUrl(src), [src])
  if (!url) return null

  async function handleError() {
    if (!jobId || refreshing) { setUrl(null); return }
    setRefreshing(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Authentication required')
      const fresh = await refreshRepairPhoto({
        apiUrl: import.meta.env.VITE_API_URL,
        jobId,
        token: session.access_token,
      })
      setUrl(fresh.image_url)
    } catch {
      setUrl(null)
    } finally {
      setRefreshing(false)
    }
  }

  return <img src={url} alt={alt} className={className} onError={handleError} />
}
