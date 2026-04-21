import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const API = import.meta.env.VITE_API_URL

export function useChat() {
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(false)

  const addMsg = (msg) => setMessages((prev) => [...prev, msg])

  const sendMessage = useCallback(async (text, imageFile) => {
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token

    addMsg({
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      image_url: imageFile ? URL.createObjectURL(imageFile) : null,
      timestamp: new Date().toISOString(),
    })
    setLoading(true)

    try {
      if (imageFile) {
        const form = new FormData()
        form.append('file', imageFile)
        const res = await fetch(`${API}/analyse`, { method: 'POST', body: form })
        if (!res.ok) throw new Error('Analysis failed. Please try again.')
        const result = await res.json()

        // Save to DB non-blocking
        if (session) {
          fetch(`${API}/jobs`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ user_id: session.user.id, image_url: result.image_url, result }),
          }).catch(() => {})
        }

        addMsg({
          id: crypto.randomUUID(),
          role: 'assistant',
          result,
          timestamp: new Date().toISOString(),
        })
      } else {
        const res = await fetch(`${API}/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` }),
          },
          body: JSON.stringify({ message: text }),
        })
        if (!res.ok) throw new Error('Attach a photo to analyse a repair.')
        const data = await res.json()
        addMsg({
          id: crypto.randomUUID(),
          role: 'assistant',
          content: data.reply || data.message,
          timestamp: new Date().toISOString(),
        })
      }
    } catch (err) {
      addMsg({
        id: crypto.randomUUID(),
        role: 'assistant',
        content: err.message,
        error: true,
        timestamp: new Date().toISOString(),
      })
    } finally {
      setLoading(false)
    }
  }, [])

  // Load a past job as a 2-message conversation
  const loadJob = useCallback((job) => {
    setMessages([
      {
        id: `${job.id}-user`,
        role: 'user',
        content: '',
        image_url: job.image_url,
        timestamp: job.created_at,
      },
      {
        id: `${job.id}-ai`,
        role: 'assistant',
        result: { ...job.result_json, image_url: job.image_url },
        timestamp: job.created_at,
      },
    ])
  }, [])

  const clearMessages = useCallback(() => setMessages([]), [])

  return { messages, loading, sendMessage, loadJob, clearMessages }
}
