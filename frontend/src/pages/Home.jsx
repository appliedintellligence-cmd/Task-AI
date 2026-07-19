import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getProfileJurisdiction, supabase } from '../lib/supabase'
import { apiFetch } from '../lib/api'
import PhotoUpload from '../components/PhotoUpload'

export default function Home() {
  const [user, setUser] = useState(null)
  const [recentJobs, setRecentJobs] = useState([])
  const [jurisdiction, setJurisdiction] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) { fetchRecentJobs(session.user.id, session.access_token); getProfileJurisdiction(session.user.id).then(setJurisdiction) }
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) { fetchRecentJobs(session.user.id, session.access_token); getProfileJurisdiction(session.user.id).then(setJurisdiction) }
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  async function fetchRecentJobs(userId, token) {
    const apiUrl = import.meta.env.VITE_API_URL
    try {
      const data = await apiFetch(`${apiUrl}/jobs`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      setRecentJobs(data.slice(0, 5))
    } catch {
      // non-fatal on the landing page
    }
  }

  async function handleLogin() {
    await supabase.auth.signInWithOAuth({ provider: 'google' })
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    setRecentJobs([])
  }

  function handleAnalysisComplete(result) {
    navigate('/results', { state: { result } })
  }

  return (
    <div className="min-h-full bg-[#f7f3e9]">
      {/* Header */}
      <header className="border-b border-[#ddd5c3] px-4 py-4 sm:px-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-[#0d3339]">Good to see you</h1>
          <p className="text-xs text-[#607176]">Jurisdiction: {jurisdiction || 'Not selected'}</p>
        </div>
        <div className="flex items-center gap-3">
          {user ? (
            <>
              <span className="text-sm text-gray-600">{user.email}</span>
              <button
                onClick={() => navigate('/history')}
                className="text-sm text-blue-600 hover:underline"
              >
                History
              </button>
              <button
                onClick={handleLogout}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Sign out
              </button>
            </>
          ) : (
            <button
              onClick={handleLogin}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Sign in with Google
            </button>
          )}
        </div>
      </header>

      {/* Hero */}
      <main className="max-w-4xl mx-auto px-4 py-8 sm:px-8 sm:py-12">
        <div className="mb-8">
          <p className="text-sm font-extrabold uppercase tracking-[0.2em] text-[#b95320]">New diagnosis</p>
          <h2 className="mt-2 text-4xl font-black text-[#102f36] sm:text-5xl">Not sure how to fix it? Take a photo.</h2>
          <p className="mt-4 max-w-2xl text-lg text-[#52676a]">
            We’ll inspect the visible damage, check hazards and apply the policy verified for your jurisdiction before showing repair guidance.
          </p>
          {!jurisdiction && <button onClick={() => navigate('/settings')} className="mt-4 min-h-11 rounded-xl bg-[#fff0df] px-4 font-bold text-[#9b431c]">Choose your state or territory</button>}
        </div>

        <PhotoUpload onComplete={handleAnalysisComplete} jurisdiction={jurisdiction} onMissingJurisdiction={() => navigate('/settings')} />
        <div className="mt-5 flex flex-wrap gap-3 text-sm"><button onClick={() => navigate('/diagnose')} className="min-h-11 rounded-xl border border-[#bcb39f] px-4 font-bold text-[#0d3339]">Describe it in text</button><button onClick={() => navigate('/diagnose')} className="min-h-11 rounded-xl border border-[#bcb39f] px-4 font-bold text-[#0d3339]">Use voice</button></div>

        {/* Recent jobs */}
        {user && recentJobs.length > 0 && (
          <div className="mt-12">
            <div className="flex items-center justify-between"><h3 className="text-sm font-semibold text-[#52676a] uppercase tracking-wide mb-4">Recent repairs</h3><button onClick={() => navigate('/repairs')} className="text-sm font-bold text-[#b95320]">View all</button></div>
            <div className="space-y-3">
              {recentJobs.map((job) => (
                <button
                  key={job.id}
                  onClick={() => navigate('/results', { state: { result: { ...job.result_json, image_url: job.image_url } } })}
                  className="w-full flex items-center gap-4 p-4 border border-gray-200 rounded-xl hover:border-blue-300 hover:bg-blue-50 transition text-left"
                >
                  {job.image_url && (
                    <img src={job.image_url} alt="" className="w-14 h-14 rounded-lg object-cover flex-shrink-0" />
                  )}
                  <div>
                    <p className="font-medium text-gray-900">{job.problem}</p>
                    <p className="text-sm text-gray-500">{new Date(job.created_at).toLocaleDateString('en-AU')}</p>
                  </div>
                </button>
              ))}
            </div>
            <button
              onClick={() => navigate('/repairs')}
              className="mt-4 text-sm text-blue-600 hover:underline"
            >
              View all history →
            </button>
          </div>
        )}
      </main>
    </div>
  )
}
