import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, signOut } from '../lib/supabase'
import { useChat } from '../hooks/useChat'
import { useSpeech } from '../hooks/useSpeech'
import ChatMessage from '../components/ChatMessage'
import ChatInput from '../components/ChatInput'
import ChatSidebar from '../components/ChatSidebar'
import Settings from '../components/Settings'

const API = import.meta.env.VITE_API_URL

export default function ChatPage() {
  const navigate = useNavigate()
  const { messages, loading, sendMessage, loadJob, loadChat, clearMessages, activeChatId } = useChat()
  const { speak } = useSpeech()
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(null)
  const [jobs, setJobs] = useState([])
  const [activeJobId, setActiveJobId] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const messagesEndRef = useRef()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setUser(session.user)
        setToken(session.access_token)
        fetchJobs(session.user.id, session.access_token)
      }
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null)
      setToken(session?.access_token ?? null)
      if (session) fetchJobs(session.user.id, session.access_token)
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // Auto-read new text AI messages
  useEffect(() => {
    if (messages.length === 0) return
    const last = messages[messages.length - 1]
    if (
      last.role === 'assistant' &&
      last.content &&
      !last.result &&
      !last.error &&
      localStorage.getItem('taskai_autoread') === 'true'
    ) {
      speak(last.content, last.id)
    }
  }, [messages])

  async function fetchJobs(userId, tok) {
    const res = await fetch(`${API}/jobs/${userId}`, { headers: { Authorization: `Bearer ${tok}` } })
    if (res.ok) setJobs(await res.json())
  }

  function handleNewChat() {
    clearMessages()
    setActiveJobId(null)
    setSidebarOpen(false)
  }

  async function handleSelectChat(chat) {
    setActiveJobId(null)
    setSidebarOpen(false)
    await loadChat(chat.id, token)
  }

  function handleDeleteChat() {
    clearMessages()
    setActiveJobId(null)
  }

  function handleSelectJob(job) {
    loadJob(job)
    setActiveJobId(job.id)
    setSidebarOpen(false)
  }

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  async function handleSend(text, imageFile) {
    setSidebarOpen(false)
    await sendMessage(text, imageFile)
    if (imageFile) {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) setTimeout(() => fetchJobs(session.user.id, session.access_token), 1500)
    }
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-20 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ── SIDEBAR ── */}
      <aside className={`fixed md:relative z-30 md:z-auto w-64 h-full flex flex-col bg-gray-900 text-white transition-transform duration-200 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className="px-4 py-5 border-b border-gray-700">
          <span className="text-xl font-bold tracking-tight">task.ai</span>
        </div>

        <ChatSidebar
          activeChatId={activeChatId}
          onNewChat={handleNewChat}
          onSelectChat={handleSelectChat}
          onDeleteChat={handleDeleteChat}
          jobs={jobs}
          activeJobId={activeJobId}
          onSelectJob={handleSelectJob}
          user={user}
          token={token}
        />

        <div className="border-t border-gray-700 px-4 py-3">
          {user && (
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                {(user.email?.[0] ?? '?').toUpperCase()}
              </div>
              <span className="text-xs text-gray-400 truncate flex-1">{user.email}</span>
              <button
                onClick={() => setSettingsOpen(true)}
                className="text-gray-500 hover:text-gray-300 transition"
                title="Voice settings"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
              <button onClick={handleSignOut} className="text-gray-500 hover:text-gray-300 transition" title="Sign out">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </aside>

      <Settings open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      {/* ── MAIN ── */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200">
          <button onClick={() => setSidebarOpen(true)} className="p-1.5 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="font-bold text-blue-600">task.ai</span>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-gray-400 pb-16">
              <div className="text-6xl mb-4">🔧</div>
              <h2 className="text-xl font-semibold text-gray-600">Fix anything with AI</h2>
              <p className="text-sm mt-2 max-w-xs text-gray-400">
                Attach a photo of your repair issue and task.ai will diagnose it and walk you through the fix.
              </p>
            </div>
          ) : (
            messages.map((msg) => <ChatMessage key={msg.id} message={msg} />)
          )}

          {loading && (
            <div className="flex gap-3 items-center">
              <div className="w-8 h-8 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">t</div>
              <div className="flex gap-1 bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                {[0, 150, 300].map((d) => (
                  <span key={d} className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
                ))}
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <ChatInput onSend={handleSend} loading={loading} />
      </div>
    </div>
  )
}
