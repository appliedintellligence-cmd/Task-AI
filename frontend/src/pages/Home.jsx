import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import PhotoUpload from '../components/PhotoUpload'

export default function Home() {
  const [user, setUser] = useState(null)
  const [recentJobs, setRecentJobs] = useState([])
  const navigate = useNavigate()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchRecentJobs(session.user.id, session.access_token)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchRecentJobs(session.user.id, session.access_token)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  async function fetchRecentJobs(userId, token) {
    const apiUrl = import.meta.env.VITE_API_URL
    const res = await fetch(`${apiUrl}/jobs/${userId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) {
      const data = await res.json()
      setRecentJobs(data.slice(0, 5))
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
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-blue-600">task.ai</h1>
          <p className="text-xs text-gray-500">Fix anything with AI</p>
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
      <main className="max-w-2xl mx-auto px-6 py-12">
        <div className="text-center mb-10">
          <h2 className="text-4xl font-bold text-gray-900 mb-3">Fix anything with AI</h2>
          <p className="text-lg text-gray-500">
            Take a photo of any home repair issue and get step-by-step instructions, materials list, and store links.
          </p>
        </div>

        <PhotoUpload onComplete={handleAnalysisComplete} />

        {/* Recent jobs */}
        {user && recentJobs.length > 0 && (
          <div className="mt-12">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Recent repairs</h3>
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
              onClick={() => navigate('/history')}
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
