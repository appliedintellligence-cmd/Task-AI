import { useState, useCallback, useRef, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { apiFetch, ApiError } from '../lib/api'

const API = import.meta.env.VITE_API_URL

export function useChat() {
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(false)
  const [activeChatId, setActiveChatId] = useState(null)

  const sendingRef = useRef(false)      // guards against duplicate submissions
  const lastAttemptRef = useRef(null)   // { text, imageFile } for retry
  const objectUrlsRef = useRef([])      // blob: URLs to revoke on clear/unmount

  const addMsg = (msg) => setMessages((prev) => [...prev, msg])

  const revokeAllUrls = useCallback(() => {
    objectUrlsRef.current.forEach((u) => URL.revokeObjectURL(u))
    objectUrlsRef.current = []
  }, [])

  // Revoke any outstanding object URLs when the hook unmounts.
  useEffect(() => () => revokeAllUrls(), [revokeAllUrls])

  const performRequest = useCallback(async (text, imageFile) => {
    setLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token

    try {
      if (imageFile) {
        const form = new FormData()
        form.append('file', imageFile)
        const result = await apiFetch(`${API}/analyse`, { method: 'POST', body: form })

        // Save to DB non-blocking
        if (session) {
          apiFetch(`${API}/jobs`, {
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
        const data = await apiFetch(`${API}/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` }),
          },
          body: JSON.stringify({
            chat_id: activeChatId || undefined,
            message: text,
            user_id: session?.user?.id,
          }),
        })

        if (data.chat_id && data.chat_id !== activeChatId) {
          setActiveChatId(data.chat_id)
          window.dispatchEvent(new Event('chat-updated'))
        }

        addMsg({
          id: crypto.randomUUID(),
          role: 'assistant',
          content: data.reply,
          materials: data.materials || [],
          timestamp: new Date().toISOString(),
        })
      }
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Something went wrong. Please try again.'
      addMsg({
        id: crypto.randomUUID(),
        role: 'assistant',
        content: message,
        error: true,
        canRetry: true,
        timestamp: new Date().toISOString(),
      })
    } finally {
      setLoading(false)
    }
  }, [activeChatId])

  const sendMessage = useCallback(async (text, imageFile) => {
    if (sendingRef.current) return
    sendingRef.current = true

    const imageUrl = imageFile ? URL.createObjectURL(imageFile) : null
    if (imageUrl) objectUrlsRef.current.push(imageUrl)

    lastAttemptRef.current = { text, imageFile }

    addMsg({
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      image_url: imageUrl,
      timestamp: new Date().toISOString(),
    })

    try {
      await performRequest(text, imageFile)
    } finally {
      sendingRef.current = false
    }
  }, [performRequest])

  // Re-run the last request (drops the trailing error bubble first).
  const retryLast = useCallback(async () => {
    if (sendingRef.current) return
    const attempt = lastAttemptRef.current
    if (!attempt) return

    setMessages((prev) => {
      const copy = [...prev]
      if (copy.length && copy[copy.length - 1].error) copy.pop()
      return copy
    })

    sendingRef.current = true
    try {
      await performRequest(attempt.text, attempt.imageFile)
    } finally {
      sendingRef.current = false
    }
  }, [performRequest])

  const loadChat = useCallback(async (chatId, token) => {
    setActiveChatId(chatId)
    try {
      const msgs = await apiFetch(`${API}/chats/${chatId}/messages`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      revokeAllUrls()
      setMessages(msgs.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        image_url: m.image_url,
        result: m.result_json,
        timestamp: m.created_at,
      })))
    } catch {
      // leave current messages in place on failure
    }
  }, [revokeAllUrls])

  const loadJob = useCallback((job) => {
    revokeAllUrls()
    setActiveChatId(null)
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
  }, [revokeAllUrls])

  const clearMessages = useCallback(() => {
    revokeAllUrls()
    setMessages([])
    setActiveChatId(null)
  }, [revokeAllUrls])

  return { messages, loading, sendMessage, retryLast, loadJob, loadChat, clearMessages, activeChatId }
}
