import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { callbackErrorFromUrl, loginErrorUrl } from '../lib/authFlow'

const FALLBACK_ERROR = 'Google sign-in could not be completed. Please try again.'

export default function AuthCallback() {
  const navigate = useNavigate()
  const [status, setStatus] = useState('Signing you in...')

  useEffect(() => {
    let active = true

    function fail(error) {
      const message = error?.message || error || FALLBACK_ERROR
      console.error('Task AI OAuth callback failed:', message)
      if (!active) return
      setStatus(message)
      navigate(loginErrorUrl(message), { replace: true })
    }

    async function complete() {
      const callbackError = callbackErrorFromUrl()
      if (callbackError) return fail(callbackError)

      let { data: { session }, error } = await supabase.auth.getSession()
      if (error) return fail(error)

      // Supabase normally consumes OAuth callback parameters while creating
      // the browser client. If PKCE auto-detection has not completed, exchange
      // the remaining code once and then use the returned session.
      const code = new URLSearchParams(window.location.search).get('code')
      if (!session && code) {
        const exchange = await supabase.auth.exchangeCodeForSession(code)
        if (exchange.error) return fail(exchange.error)
        session = exchange.data.session
      }
      if (!session) return fail(FALLBACK_ERROR)

      if (active) navigate('/', { replace: true })
    }

    complete().catch(fail)
    return () => { active = false }
  }, [navigate])

  return (
    <main className="min-h-screen bg-[#f7f3e9] flex items-center justify-center px-4" aria-live="polite">
      <div className="w-full max-w-md rounded-3xl border border-[#ddd5c3] bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-5 h-10 w-10 animate-spin rounded-full border-4 border-[#0d3339] border-t-transparent" />
        <h1 className="text-2xl font-black text-[#102f36]">Signing you in</h1>
        <p className="mt-3 text-sm text-[#607176]">{status}</p>
      </div>
    </main>
  )
}
