import { useState, useEffect, useRef, useCallback } from 'react'

const SR =
  typeof window !== 'undefined'
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : null

export function useVoice() {
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [supported] = useState(() => !!SR)
  const recognitionRef = useRef(null)
  const silenceTimerRef = useRef(null)
  const submitCallbackRef = useRef(null)

  useEffect(() => {
    if (!SR) return
    const rec = new SR()
    rec.continuous = true
    rec.interimResults = true

    rec.onresult = (e) => {
      let full = ''
      for (let i = 0; i < e.results.length; i++) {
        full += e.results[i][0].transcript
      }
      setTranscript(full)

      if (localStorage.getItem('taskai_autosubmit') === 'true') {
        clearTimeout(silenceTimerRef.current)
        silenceTimerRef.current = setTimeout(() => {
          rec.stop()
          submitCallbackRef.current?.()
        }, 2000)
      }
    }

    rec.onend = () => {
      setIsListening(false)
      clearTimeout(silenceTimerRef.current)
    }

    rec.onerror = (e) => {
      if (e.error !== 'aborted') setIsListening(false)
      clearTimeout(silenceTimerRef.current)
    }

    recognitionRef.current = rec
    return () => rec.abort()
  }, [])

  const startListening = useCallback(() => {
    const rec = recognitionRef.current
    if (!rec || isListening) return
    rec.lang = localStorage.getItem('taskai_voice_lang') || 'en-AU'
    setTranscript('')
    try {
      rec.start()
      setIsListening(true)
    } catch {
      // already started or not available
    }
  }, [isListening])

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop()
    clearTimeout(silenceTimerRef.current)
  }, [])

  // Register a callback to fire after 2s silence (auto-submit)
  const registerSubmit = useCallback((fn) => {
    submitCallbackRef.current = fn
  }, [])

  return { isListening, transcript, supported, startListening, stopListening, registerSubmit }
}
