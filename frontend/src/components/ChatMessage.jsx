import { useState } from 'react'
import RetailerLinks from './RetailerLinks'

const SEVERITY_CLS = {
  low: 'bg-green-100 text-green-700',
  medium: 'bg-yellow-100 text-yellow-700',
  high: 'bg-red-100 text-red-700',
}
const DIFFICULTY_CLS = {
  beginner: 'bg-blue-100 text-blue-700',
  intermediate: 'bg-purple-100 text-purple-700',
  advanced: 'bg-orange-100 text-orange-700',
}

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })
}

function RepairResult({ result }) {
  const [stepsOpen, setStepsOpen] = useState(true)
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    const steps = result.steps
      ?.map((s, i) => `${i + 1}. ${s.title}: ${s.description}`)
      .join('\n') ?? ''
    navigator.clipboard.writeText(`${result.problem}\n\n${steps}`).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm shadow-sm overflow-hidden">
      {result.image_url && (
        <img src={result.image_url} alt="" className="w-full max-h-52 object-cover" />
      )}

      <div className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 leading-snug">{result.problem}</h3>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {result.severity && (
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${SEVERITY_CLS[result.severity] ?? 'bg-gray-100 text-gray-600'}`}>
                  {result.severity} severity
                </span>
              )}
              {result.difficulty && (
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${DIFFICULTY_CLS[result.difficulty] ?? 'bg-gray-100 text-gray-600'}`}>
                  {result.difficulty}
                </span>
              )}
              {result.surface_material && (
                <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600">
                  {result.surface_material}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={handleCopy}
            className="flex-shrink-0 p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition"
            title="Copy to clipboard"
          >
            {copied ? (
              <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
              </svg>
            )}
          </button>
        </div>

        {/* Safety notes */}
        {result.safety_notes?.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
            <p className="text-xs font-semibold text-amber-700 mb-1">⚠ Safety notes</p>
            <ul className="space-y-0.5">
              {result.safety_notes.map((note, i) => (
                <li key={i} className="text-xs text-amber-800">• {note}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Steps */}
        {result.steps?.length > 0 && (
          <div>
            <button
              onClick={() => setStepsOpen((o) => !o)}
              className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 mb-2 w-full text-left"
            >
              <svg
                className={`w-4 h-4 transition-transform flex-shrink-0 ${stepsOpen ? 'rotate-90' : ''}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              Steps ({result.steps.length})
            </button>
            {stepsOpen && (
              <ol className="space-y-3">
                {result.steps.map((step) => (
                  <li key={step.step_number} className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center mt-0.5">
                      {step.step_number}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-gray-800">{step.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{step.description}</p>
                      {step.duration_minutes && (
                        <p className="text-xs text-blue-500 mt-1">{step.duration_minutes} min</p>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}

        {/* Materials table */}
        {result.materials?.length > 0 && (
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-2">Materials</p>
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-3 py-2 text-gray-500 font-medium">Item</th>
                    <th className="text-right px-3 py-2 text-gray-500 font-medium">Qty</th>
                    <th className="text-right px-3 py-2 text-gray-500 font-medium">Est. cost</th>
                  </tr>
                </thead>
                <tbody>
                  {result.materials.map((m, i) => (
                    <tr key={i} className="border-t border-gray-100">
                      <td className="px-3 py-2 text-gray-800">{m.name}</td>
                      <td className="px-3 py-2 text-right text-gray-600">{m.quantity} {m.unit}</td>
                      <td className="px-3 py-2 text-right text-gray-600">
                        ${m.estimated_cost_aud?.toFixed(2) ?? '—'}
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t border-gray-200 bg-gray-50 font-semibold">
                    <td className="px-3 py-2 text-gray-700" colSpan={2}>Total</td>
                    <td className="px-3 py-2 text-right text-gray-800">
                      ${result.materials.reduce((s, m) => s + (m.estimated_cost_aud ?? 0), 0).toFixed(2)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Retailer links */}
        {result.materials?.length > 0 && (
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-2">Where to buy</p>
            <RetailerLinks materials={result.materials} />
          </div>
        )}
      </div>
    </div>
  )
}

export default function ChatMessage({ message }) {
  const { role, content, result, image_url, error, timestamp } = message

  if (role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-sm">
          {image_url && (
            <img src={image_url} alt="" className="w-full rounded-xl rounded-br-sm mb-1 object-cover max-h-48" />
          )}
          {content && (
            <div className="bg-blue-600 text-white px-4 py-2.5 rounded-2xl rounded-br-sm text-sm leading-relaxed">
              {content}
            </div>
          )}
          <p className="text-xs text-gray-400 text-right mt-1">{formatTime(timestamp)}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex gap-3 items-start">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">
        t
      </div>
      <div className="flex-1 min-w-0">
        {result ? (
          <RepairResult result={result} />
        ) : (
          <div className={`px-4 py-3 rounded-2xl rounded-tl-sm text-sm leading-relaxed ${
            error
              ? 'bg-red-50 border border-red-200 text-red-700'
              : 'bg-white border border-gray-200 text-gray-800 shadow-sm'
          }`}>
            {content}
          </div>
        )}
        <p className="text-xs text-gray-400 mt-1 pl-1">{formatTime(timestamp)}</p>
      </div>
    </div>
  )
}
