import { useEffect, useState } from 'react'
import { JURISDICTIONS } from '../lib/jurisdiction'

const LANG_OPTIONS = [
  { value: 'en-AU', label: 'English (Australia)' },
  { value: 'en-US', label: 'English (US)' },
  { value: 'en-GB', label: 'English (UK)' },
  { value: 'en-NZ', label: 'English (New Zealand)' },
]

function Toggle({ label, description, value, onChange }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-gray-800">{label}</p>
        {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors ${value ? 'bg-blue-600' : 'bg-gray-200'}`}
        aria-checked={value}
        role="switch"
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${value ? 'translate-x-5' : 'translate-x-0'}`}
        />
      </button>
    </div>
  )
}

export default function Settings({ open, onClose, jurisdiction, onJurisdictionChange, embedded = false }) {
  const [autoRead, setAutoRead] = useState(() => localStorage.getItem('taskai_autoread') === 'true')
  const [autoSubmit, setAutoSubmit] = useState(() => localStorage.getItem('taskai_autosubmit') === 'true')
  const [lang, setLang] = useState(() => localStorage.getItem('taskai_voice_lang') || 'en-AU')
  const [selectedJurisdiction, setSelectedJurisdiction] = useState(jurisdiction || '')
  const [jurisdictionError, setJurisdictionError] = useState('')
  const [savingJurisdiction, setSavingJurisdiction] = useState(false)

  useEffect(() => setSelectedJurisdiction(jurisdiction || ''), [jurisdiction, open])

  function handleAutoRead(val) {
    setAutoRead(val)
    localStorage.setItem('taskai_autoread', val)
  }

  function handleAutoSubmit(val) {
    setAutoSubmit(val)
    localStorage.setItem('taskai_autosubmit', val)
  }

  function handleLang(val) {
    setLang(val)
    localStorage.setItem('taskai_voice_lang', val)
  }

  async function handleJurisdictionSave() {
    if (!selectedJurisdiction) {
      setJurisdictionError('Select your state or territory')
      return
    }
    setSavingJurisdiction(true)
    setJurisdictionError('')
    try {
      await onJurisdictionChange(selectedJurisdiction)
    } catch (error) {
      setJurisdictionError(error.message || 'Could not save your state or territory')
    } finally {
      setSavingJurisdiction(false)
    }
  }

  if (!open) return null

  const panel = (
    <div className={`bg-white rounded-2xl w-full max-w-sm p-6 ${embedded ? 'mt-8 border border-[#ddd5c3]' : 'shadow-xl'}`}>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-base font-semibold text-gray-900">Settings</h2>
        {!embedded && <button onClick={onClose} aria-label="Close settings" className="min-h-11 min-w-11 p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition"><span aria-hidden="true">×</span></button>}
      </div>
      <div className="space-y-5">
        <div className="pb-5 border-b border-gray-100">
          <label htmlFor="settings-jurisdiction" className="block text-sm font-medium text-gray-800 mb-1.5">State or territory</label>
          <p className="text-xs text-gray-500 mb-2">Used to apply the correct DIY licensing policy. We do not infer your location or collect a precise address.</p>
          <select id="settings-jurisdiction" aria-label="Australian state or territory" value={selectedJurisdiction} onChange={(event) => { setSelectedJurisdiction(event.target.value); setJurisdictionError('') }} className="min-h-11 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#f28b45]">
            <option value="">Select state or territory</option>
            {JURISDICTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
          {jurisdictionError && <p role="alert" className="text-xs text-red-600 mt-1">{jurisdictionError}</p>}
          <button type="button" onClick={handleJurisdictionSave} disabled={savingJurisdiction || selectedJurisdiction === jurisdiction} className="mt-2 min-h-11 w-full px-3 py-2 bg-[#0d3339] text-white rounded-lg text-sm disabled:opacity-50">{savingJurisdiction ? 'Saving…' : jurisdiction ? 'Change state or territory' : 'Save state or territory'}</button>
        </div>
        <Toggle label="Auto-read AI responses" description="Reads new assistant messages aloud" value={autoRead} onChange={handleAutoRead} />
        <Toggle label="Auto-submit after silence" description="Sends voice input 2 seconds after you stop speaking" value={autoSubmit} onChange={handleAutoSubmit} />
        <div><label className="block text-sm font-medium text-gray-800 mb-1.5">Voice language</label><select value={lang} onChange={(e) => handleLang(e.target.value)} className="min-h-11 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#f28b45] transition">{LANG_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
      </div>
    </div>
  )

  if (embedded) return panel
  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      {panel}
      {/* Legacy modal markup retained below is intentionally unreachable. */}
      <div className="hidden">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-gray-900">Settings</h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-5">
          <div className="pb-5 border-b border-gray-100">
            <label htmlFor="settings-jurisdiction" className="block text-sm font-medium text-gray-800 mb-1.5">
              State or territory
            </label>
            <p className="text-xs text-gray-500 mb-2">Used to apply the correct DIY licensing policy. We do not infer your location or collect a precise address.</p>
            <select
              id="settings-jurisdiction"
              aria-label="Australian state or territory"
              value={selectedJurisdiction}
              onChange={(event) => { setSelectedJurisdiction(event.target.value); setJurisdictionError('') }}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select state or territory</option>
              {JURISDICTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
            {jurisdictionError && <p role="alert" className="text-xs text-red-600 mt-1">{jurisdictionError}</p>}
            <button
              type="button"
              onClick={handleJurisdictionSave}
              disabled={savingJurisdiction || selectedJurisdiction === jurisdiction}
              className="mt-2 w-full px-3 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50"
            >
              {savingJurisdiction ? 'Saving…' : jurisdiction ? 'Change state or territory' : 'Save state or territory'}
            </button>
          </div>
          <Toggle
            label="Auto-read AI responses"
            description="Reads new assistant messages aloud"
            value={autoRead}
            onChange={handleAutoRead}
          />
          <Toggle
            label="Auto-submit after silence"
            description="Sends voice input 2 seconds after you stop speaking"
            value={autoSubmit}
            onChange={handleAutoSubmit}
          />

          <div>
            <label className="block text-sm font-medium text-gray-800 mb-1.5">
              Voice language
            </label>
            <select
              value={lang}
              onChange={(e) => handleLang(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
            >
              {LANG_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  )
}
