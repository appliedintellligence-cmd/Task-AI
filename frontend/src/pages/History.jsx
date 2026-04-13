import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function History() {
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate('/')
        return
      }
      setUser(session.user)
      fetchJobs(session.user.id, session.access_token)
    })
  }, [])

  async function fetchJobs(userId, token) {
    const apiUrl = import.meta.env.VITE_API_URL
    const res = await fetch(`${apiUrl}/jobs/${userId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) {
      const data = await res.json()
      setJobs(data)
    }
    setLoading(false)
  }

  const SEVERITY_COLOURS = {
    low: 'bg-green-100 text-green-700',
    medium: 'bg-yellow-100 text-yellow-700',
    high: 'bg-red-100 text-red-700',
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <button onClick={() => navigate('/')} className="text-blue-600 font-bold text-xl">
          ← task.ai
        </button>
        <h1 className="text-lg font-semibold text-gray-900">Repair history</h1>
        <div className="w-16" />
      </header>

      <main className="max-w-2xl mx-auto px-6 py-10">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : jobs.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <p className="text-5xl mb-4">🔧</p>
            <p className="text-lg font-medium">No repairs yet</p>
            <p className="text-sm mt-1">Upload a photo to get started</p>
            <button
              onClick={() => navigate('/')}
              className="mt-6 px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition"
            >
              Start a repair
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {jobs.map((job) => (
              <button
                key={job.id}
                onClick={() => navigate('/results', { state: { result: { ...job.result_json, image_url: job.image_url } } })}
                className="w-full flex items-center gap-4 p-4 bg-white border border-gray-200 rounded-2xl hover:border-blue-300 hover:shadow-md transition text-left"
              >
                {job.image_url ? (
                  <img src={job.image_url} alt="" className="w-16 h-16 rounded-xl object-cover flex-shrink-0" />
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-2xl">🔧</span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{job.problem}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${SEVERITY_COLOURS[job.severity] || 'bg-gray-100 text-gray-600'}`}>
                      {job.severity}
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(job.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                </div>
                <span className="text-gray-400 flex-shrink-0">→</span>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
