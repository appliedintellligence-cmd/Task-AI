import { useState, useRef } from 'react'

export default function PhotoUpload({ onComplete }) {
  const [preview, setPreview] = useState(null)
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef()

  function handleFile(selected) {
    if (!selected) return
    setFile(selected)
    setError(null)
    setPreview(URL.createObjectURL(selected))
  }

  function handleDrop(e) {
    e.preventDefault()
    setDragging(false)
    const dropped = e.dataTransfer.files[0]
    if (dropped?.type.startsWith('image/')) handleFile(dropped)
  }

  async function handleAnalyse() {
    if (!file) return
    setLoading(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const apiUrl = import.meta.env.VITE_API_URL
      const res = await fetch(`${apiUrl}/analyse`, { method: 'POST', body: formData })
      if (!res.ok) throw new Error('Analysis failed. Please try again.')
      const data = await res.json()
      onComplete(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      {!preview ? (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current.click()}
          className={`border-2 border-dashed rounded-2xl p-12 flex flex-col items-center justify-center cursor-pointer transition
            ${dragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'}`}
        >
          <div className="text-5xl mb-4">📷</div>
          <p className="text-lg font-medium text-gray-700">Drop a photo here</p>
          <p className="text-sm text-gray-400 mt-1">or click to browse</p>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => handleFile(e.target.files[0])}
          />
        </div>
      ) : (
        <div className="relative rounded-2xl overflow-hidden border border-gray-200">
          <img src={preview} alt="Preview" className="w-full max-h-80 object-cover" />
          <button
            onClick={() => { setPreview(null); setFile(null) }}
            className="absolute top-3 right-3 bg-white rounded-full w-8 h-8 flex items-center justify-center shadow text-gray-600 hover:text-red-500 transition"
          >
            ✕
          </button>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          {error}
        </div>
      )}

      <button
        onClick={handleAnalyse}
        disabled={!file || loading}
        className="w-full py-3.5 bg-blue-600 text-white rounded-xl font-semibold text-base hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            Analysing…
          </>
        ) : (
          'Analyse repair'
        )}
      </button>
    </div>
  )
}
