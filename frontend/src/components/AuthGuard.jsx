import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
  isSessionIdle,
  LAST_ACTIVITY_STORAGE_KEY,
  remainingSessionTime,
} from '../lib/sessionTimeout'

export default function AuthGuard({ children }) {
  const [checking, setChecking] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    let timeoutId
    let signedOutForInactivity = false

    const clearIdleTimer = () => window.clearTimeout(timeoutId)

    const expireSession = async () => {
      if (signedOutForInactivity) return
      signedOutForInactivity = true
      clearIdleTimer()
      localStorage.removeItem(LAST_ACTIVITY_STORAGE_KEY)
      try {
        await supabase.auth.signOut({ scope: 'local' })
      } finally {
        navigate('/login?reason=timeout', { replace: true })
      }
    }

    const scheduleIdleTimer = () => {
      clearIdleTimer()
      const lastActivity = localStorage.getItem(LAST_ACTIVITY_STORAGE_KEY)
      if (isSessionIdle(lastActivity)) {
        void expireSession()
        return
      }
      timeoutId = window.setTimeout(expireSession, remainingSessionTime(lastActivity))
    }

    const recordActivity = () => {
      if (signedOutForInactivity) return
      localStorage.setItem(LAST_ACTIVITY_STORAGE_KEY, String(Date.now()))
      scheduleIdleTimer()
    }

    const handleStorage = (event) => {
      if (event.key === LAST_ACTIVITY_STORAGE_KEY) scheduleIdleTimer()
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate('/login', { replace: true })
        return
      }

      const lastActivity = localStorage.getItem(LAST_ACTIVITY_STORAGE_KEY)
      if (!lastActivity) localStorage.setItem(LAST_ACTIVITY_STORAGE_KEY, String(Date.now()))
      if (isSessionIdle(lastActivity)) {
        void expireSession()
        return
      }
      setChecking(false)
      scheduleIdleTimer()
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) navigate('/login', { replace: true })
    })

    const activityEvents = ['pointerdown', 'keydown', 'touchstart', 'scroll']
    activityEvents.forEach((event) => window.addEventListener(event, recordActivity, { passive: true }))
    window.addEventListener('storage', handleStorage)

    return () => {
      clearIdleTimer()
      subscription.unsubscribe()
      activityEvents.forEach((event) => window.removeEventListener(event, recordActivity))
      window.removeEventListener('storage', handleStorage)
    }
  }, [navigate])

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return children
}
