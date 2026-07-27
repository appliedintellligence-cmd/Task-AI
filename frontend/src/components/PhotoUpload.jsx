import { useEffect, useRef, useState } from 'react'
import { apiFetch } from '../lib/api'
import { ANALYSIS_STAGES, canSubmitDiagnosis, validateImageFile } from '../lib/diagnosis'
import { appendConfirmedJurisdiction } from '../lib/jurisdiction'
import { supabase } from '../lib/supabase'

export default function PhotoUpload({ onComplete, jurisdiction, onMissingJurisdiction }) {
  const [preview, setPreview] = useState(null)
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [dragging, setDragging] = useState(false)
  const [stage, setStage] = useState(0)
  const galleryRef = useRef()
  const cameraRef = useRef()

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])
  useEffect(() => {
    if (!loading) return undefined
    const timer = window.setInterval(() => setStage((current) => Math.min(current + 1, ANALYSIS_STAGES.length - 1)), 1100)
    return () => window.clearInterval(timer)
  }, [loading])

  function handleFile(selected) {
    const validation = validateImageFile(selected)
    if (validation) { setError(validation); return }
    setFile(selected); setError(null); setPreview(URL.createObjectURL(selected))
  }
  function remove() { setFile(null); setPreview(null); setError(null) }
  function handleDrop(event) { event.preventDefault(); setDragging(false); handleFile(event.dataTransfer.files[0]) }

  async function handleAnalyse() {
    if (!jurisdiction) { onMissingJurisdiction?.(); setError('Choose your state or territory before diagnosis.'); return }
    if (!canSubmitDiagnosis({ file, jurisdiction, loading })) return
    setLoading(true); setStage(0); setError(null)
    try {
      const body = appendConfirmedJurisdiction(new FormData(), jurisdiction)
      body.append('file', file)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Sign in before uploading a repair photo.')
      const data = await apiFetch(`${import.meta.env.VITE_API_URL}/analyse`, {
        method: 'POST', body,
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      onComplete(data)
    } catch (err) { setError(err.message || 'Analysis failed. Check your connection and try again.') }
    finally { setLoading(false) }
  }

  return <div className="space-y-4">
    <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleFile(e.target.files[0])} />
    <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFile(e.target.files[0])} />
    {!preview ? <div onDragOver={(e) => { e.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={handleDrop} className={`rounded-3xl border-2 border-dashed p-7 text-center sm:p-10 ${dragging ? 'border-[#f28b45] bg-[#fff4e8]' : 'border-[#c9c1ae] bg-[#fffdf7]'}`}>
      <div aria-hidden="true" className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[#eaf0df] text-3xl">⌁</div>
      <p className="mt-4 text-lg font-extrabold text-[#102f36]">Take a clear photo of the affected area</p>
      <p className="mt-1 text-sm text-[#607176]">On desktop, drag and drop here. A wide shot and close-up can help—but never approach an immediate hazard.</p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2"><button onClick={() => cameraRef.current.click()} className="min-h-12 rounded-xl bg-[#f28b45] px-4 font-bold text-[#102f36]">Take photo</button><button onClick={() => galleryRef.current.click()} className="min-h-12 rounded-xl border border-[#0d3339] px-4 font-bold text-[#0d3339]">Upload from gallery</button></div>
    </div> : <div className="rounded-3xl border border-[#d9d2c2] bg-white p-3"><img src={preview} alt="Selected repair" className="max-h-80 w-full rounded-2xl object-cover" /><div className="mt-3 flex gap-3"><button onClick={() => galleryRef.current.click()} className="min-h-11 flex-1 rounded-xl border border-[#0d3339] font-bold">Replace</button><button onClick={remove} className="min-h-11 flex-1 rounded-xl border border-[#9d2f22] font-bold text-[#9d2f22]">Remove</button></div></div>}
    {loading && <div role="status" aria-live="polite" className="rounded-2xl bg-[#0d3339] p-5 text-white"><p className="font-bold">{ANALYSIS_STAGES[stage]}…</p><div className="mt-3 h-2 overflow-hidden rounded-full bg-white/20"><div className="h-full bg-[#f28b45] transition-all" style={{ width: `${((stage + 1) / ANALYSIS_STAGES.length) * 100}%` }} /></div><ol className="mt-3 space-y-1 text-xs text-[#c8d8d3]">{ANALYSIS_STAGES.map((item, index) => <li key={item}>{index < stage ? '✓' : index === stage ? '●' : '○'} {item}</li>)}</ol></div>}
    {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}<button onClick={handleAnalyse} disabled={!file || loading} className="ml-2 underline">Retry</button></div>}
    <button onClick={handleAnalyse} disabled={!file || loading} className="min-h-13 w-full rounded-xl bg-[#0d3339] px-4 font-bold text-white disabled:opacity-40">{loading ? 'Analysing safely…' : 'Check this repair'}</button>
  </div>
}
