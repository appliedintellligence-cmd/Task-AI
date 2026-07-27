import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { isRecoverySession, validateRecoveryPassword } from '../lib/passwordRecovery'

export default function ResetPassword() {
  const navigate = useNavigate()
  const [status, setStatus] = useState('checking')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (active && isRecoverySession(event, session)) setStatus('ready')
    })
    supabase.auth.getSession().then(({ data: { session }, error: sessionError }) => {
      if (!active) return
      if (sessionError || !isRecoverySession('INITIAL_SESSION', session)) {
        setStatus('invalid')
      } else {
        setStatus('ready')
      }
    })
    return () => { active = false; listener.subscription.unsubscribe() }
  }, [])

  async function submit(event) {
    event.preventDefault()
    const validation = validateRecoveryPassword(password, confirmation)
    if (validation) { setError(validation); return }
    setStatus('saving'); setError('')
    const { error: updateError } = await supabase.auth.updateUser({ password })
    if (updateError) {
      setError(updateError.message || 'This recovery link is invalid or has expired.')
      setStatus('ready')
      return
    }
    await supabase.auth.signOut()
    setStatus('success')
    window.setTimeout(() => navigate('/login', { replace: true }), 1200)
  }

  return <main className="min-h-screen bg-[#f7f3e9] px-4 py-16">
    <section aria-labelledby="reset-title" className="mx-auto max-w-md rounded-3xl border border-[#d9d2c2] bg-white p-7 shadow-sm">
      <p className="text-sm font-black uppercase tracking-[0.18em] text-[#b95320]">Account recovery</p>
      <h1 id="reset-title" className="mt-2 text-3xl font-black text-[#102f36]">Choose a new password</h1>

      {status === 'checking' && <p role="status" aria-live="polite" className="mt-6 text-[#52676a]">Verifying your recovery link…</p>}

      {status === 'invalid' && <div role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
        <p className="font-bold">This recovery link is missing, invalid or expired.</p>
        <p className="mt-1 text-sm">Request a new link from the sign-in page.</p>
        <Link to="/login" className="mt-4 inline-block font-bold underline">Return to sign in</Link>
      </div>}

      {(status === 'ready' || status === 'saving') && <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
        <div><label htmlFor="new-password" className="block text-sm font-bold text-[#102f36]">New password</label><input id="new-password" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} minLength="8" required className="mt-1 w-full rounded-xl border border-[#bcb39f] px-4 py-3" /></div>
        <div><label htmlFor="confirm-password" className="block text-sm font-bold text-[#102f36]">Confirm new password</label><input id="confirm-password" type="password" autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} minLength="8" required className="mt-1 w-full rounded-xl border border-[#bcb39f] px-4 py-3" /></div>
        {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        <button type="submit" disabled={status === 'saving'} className="min-h-12 w-full rounded-xl bg-[#0d3339] px-4 font-bold text-white disabled:opacity-50">{status === 'saving' ? 'Updating password…' : 'Update password'}</button>
      </form>}

      {status === 'success' && <div role="status" aria-live="polite" className="mt-6 rounded-xl border border-green-200 bg-green-50 p-4 text-green-900"><p className="font-bold">Password updated.</p><p className="mt-1 text-sm">Redirecting you to sign in…</p></div>}
    </section>
  </main>
}
