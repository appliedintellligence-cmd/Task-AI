import { useState, useEffect, useCallback } from 'react'

// Module-level emitter so speakingId is shared across all hook instances
const emitter = typeof window !== 'undefined' ? new EventTarget() : null

function emit(id) {
  emitter?.dispatchEvent(new CustomEvent('speaking', { detail: id }))
}

function stripMarkdown(text) {
  return text
    .replace(/#{1,6}\s/g, '')
    .replace(/\*\*(.*?)\*\*/gs, '$1')
    .replace(/\*(.*?)\*/gs, '$1')
    .replace(/`{1,3}(.*?)`{1,3}/gs, '$1')
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    .replace(/[*_~`>#]/g, '')
    .replace(/\n+/g, '. ')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

export function useSpeech() {
  const [speakingId, setSpeakingId] = useState(null)
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window

  useEffect(() => {
    if (!emitter) return
    const handler = (e) => setSpeakingId(e.detail)
    emitter.addEventListener('speaking', handler)
    // Preload voices (async in some browsers)
    if (supported) window.speechSynthesis.getVoices()
    return () => emitter.removeEventListener('speaking', handler)
  }, [supported])

  const speak = useCallback((text, id = null) => {
    if (!supported) return
    window.speechSynthesis.cancel()
    emit(null) // clear immediately before starting

    const utterance = new SpeechSynthesisUtterance(stripMarkdown(text))
    const lang = localStorage.getItem('taskai_voice_lang') || 'en-AU'
    utterance.lang = lang

    const voices = window.speechSynthesis.getVoices()
    const preferred =
      voices.find((v) => v.lang === lang) ||
      voices.find((v) => v.lang.startsWith(lang.split('-')[0]))
    if (preferred) utterance.voice = preferred

    utterance.onstart = () => emit(id)
    utterance.onend = () => emit(null)
    utterance.onerror = () => emit(null)

    window.speechSynthesis.speak(utterance)
  }, [supported])

  const stop = useCallback(() => {
    window.speechSynthesis?.cancel()
    emit(null)
  }, [])

  return { speak, stop, speakingId, supported }
}
