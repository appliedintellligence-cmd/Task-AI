import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import RepairSteps from '../components/RepairSteps'
import MaterialsList from '../components/MaterialsList'
import RetailerLinks from '../components/RetailerLinks'

const SEVERITY_COLOURS = {
  low: 'bg-green-100 text-green-800',
  medium: 'bg-yellow-100 text-yellow-800',
  high: 'bg-red-100 text-red-800',
}

const DIFFICULTY_COLOURS = {
  beginner: 'bg-blue-100 text-blue-800',
  intermediate: 'bg-purple-100 text-purple-800',
  advanced: 'bg-orange-100 text-orange-800',
}

export default function Results() {
  const { state } = useLocation()
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState(false)

  const result = state?.result

  useEffect(() => {
    if (!result) navigate('/')
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
    })
  }, [])

  if (!result) return null

  async function handleSave() {
    if (!user) {
      await supabase.auth.signInWithOAuth({ provider: 'google' })
      return
    }
    setSaving(true)
    const session = (await supabase.auth.getSession()).data.session
    const apiUrl = import.meta.env.VITE_API_URL
    await fetch(`${apiUrl}/jobs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        user_id: user.id,
        image_url: result.image_url,
        result,
      }),
    })
    setSaving(false)
    setSaved(true)
  }

  function handleShare() {
    navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <button onClick={() => navigate('/')} className="flex items-center gap-2 text-blue-600 font-bold text-xl">
          ← task.ai
        </button>
        <div className="flex gap-2">
          <button
            onClick={handleShare}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition"
          >
            {copied ? 'Copied!' : 'Share'}
          </button>
          <button
            onClick={handleSave}
            disabled={saving || saved}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60 transition"
          >
            {saved ? 'Saved ✓' : saving ? 'Saving…' : 'Save job'}
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10 space-y-8">
        {/* Problem summary */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          {result.image_url && (
            <img src={result.image_url} alt="Repair" className="w-full h-56 object-cover rounded-xl mb-6" />
          )}
          <h1 className="text-2xl font-bold text-gray-900 mb-3">{result.problem}</h1>
          <div className="flex flex-wrap gap-2 mb-4">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${SEVERITY_COLOURS[result.severity] || 'bg-gray-100 text-gray-700'}`}>
              {result.severity} severity
            </span>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${DIFFICULTY_COLOURS[result.difficulty] || 'bg-gray-100 text-gray-700'}`}>
              {result.difficulty}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
            <div><span className="font-medium text-gray-800">Surface:</span> {result.surface_material}</div>
            <div><span className="font-medium text-gray-800">Area:</span> {result.estimated_area}</div>
          </div>
          {result.safety_notes?.length > 0 && (
            <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
              <p className="text-sm font-semibold text-yellow-800 mb-1">Safety notes</p>
              <ul className="list-disc list-inside space-y-1">
                {result.safety_notes.map((note, i) => (
                  <li key={i} className="text-sm text-yellow-700">{note}</li>
                ))}
              </ul>
            </div>
          )}
          {result.tools_required?.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-semibold text-gray-700 mb-2">Tools required</p>
              <div className="flex flex-wrap gap-2">
                {result.tools_required.map((tool, i) => (
                  <span key={i} className="px-2 py-1 bg-gray-100 text-gray-700 rounded-md text-sm">{tool}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Repair steps */}
        <RepairSteps steps={result.steps} />

        {/* Materials */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Materials</h2>
          <MaterialsList materials={result.materials} />
        </div>

        {/* Retailer links */}
        {result.materials?.length > 0 && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Where to buy</h2>
            <RetailerLinks materials={result.materials} />
          </div>
        )}
      </main>
    </div>
  )
}
