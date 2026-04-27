import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const API = import.meta.env.VITE_API_URL

export function useChat() {
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(false)
  const [activeChatId, setActiveChatId] = useState(null)

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
          body: JSON.stringify({
            chat_id: activeChatId || undefined,
            message: text,
            user_id: session?.user?.id,
          }),
        })
        if (!res.ok) throw new Error('Something went wrong. Please try again.')
        const data = await res.json()

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
  }, [activeChatId])

  const loadChat = useCallback(async (chatId, token) => {
    setActiveChatId(chatId)
    const res = await fetch(`${API}/chats/${chatId}/messages`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return
    const msgs = await res.json()
    setMessages(msgs.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      image_url: m.image_url,
      result: m.result_json,
      timestamp: m.created_at,
    })))
  }, [])

  const loadJob = useCallback((job) => {
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
  }, [])

  const clearMessages = useCallback(() => {
    setMessages([])
    setActiveChatId(null)
  }, [])

  return { messages, loading, sendMessage, loadJob, loadChat, clearMessages, activeChatId }
}
