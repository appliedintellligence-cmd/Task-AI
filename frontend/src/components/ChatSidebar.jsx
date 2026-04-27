import { useEffect, useState } from 'react'

const API = import.meta.env.VITE_API_URL

function relativeDate(iso) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
}

export default function ChatSidebar({
  activeChatId,
  onNewChat,
  onSelectChat,
  onDeleteChat,
  jobs,
  activeJobId,
  onSelectJob,
  user,
  token,
}) {
  const [chats, setChats] = useState([])
  const [hoveredId, setHoveredId] = useState(null)

  async function fetchChats() {
    if (!user || !token) return
    const res = await fetch(`${API}/chats/${user.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) setChats(await res.json())
  }

  useEffect(() => {
    fetchChats()
  }, [user, token])

  useEffect(() => {
    const handler = () => fetchChats()
    window.addEventListener('chat-updated', handler)
    return () => window.removeEventListener('chat-updated', handler)
  }, [user, token])

  async function handleDelete(e, chatId) {
    e.stopPropagation()
    await fetch(`${API}/chats/${chatId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    setChats((prev) => prev.filter((c) => c.id !== chatId))
    if (activeChatId === chatId) onDeleteChat()
  }

  return (
    <>
      <div className="px-3 py-3">
        <button
          onClick={onNewChat}
          className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border border-gray-600 hover:bg-gray-700 transition text-sm text-gray-200"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New chat
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-1 space-y-0.5">
        {chats.length > 0 && (
          <p className="text-xs text-gray-500 px-2 py-1 uppercase tracking-wide">Chats</p>
        )}
        {chats.map((chat) => (
          <button
            key={chat.id}
            onClick={() => onSelectChat(chat)}
            onMouseEnter={() => setHoveredId(chat.id)}
            onMouseLeave={() => setHoveredId(null)}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition flex items-start justify-between ${
              activeChatId === chat.id
                ? 'bg-gray-700 text-white'
                : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
            }`}
          >
            <div className="min-w-0 flex-1">
              <span className="truncate block">{chat.title || 'Untitled'}</span>
              <span className="text-xs text-gray-600 block mt-0.5">{relativeDate(chat.updated_at)}</span>
            </div>
            {hoveredId === chat.id && (
              <button
                onClick={(e) => handleDelete(e, chat.id)}
                className="ml-2 text-gray-500 hover:text-red-400 flex-shrink-0 mt-0.5"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </button>
        ))}

        {jobs.length > 0 && (
          <p className="text-xs text-gray-500 px-2 py-1 mt-3 uppercase tracking-wide">Past repairs</p>
        )}
        {jobs.map((job) => (
          <button
            key={job.id}
            onClick={() => onSelectJob(job)}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition ${
              activeJobId === job.id
                ? 'bg-gray-700 text-white'
                : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
            }`}
          >
            <span className="truncate block">{job.problem}</span>
            <span className="text-xs text-gray-600 block mt-0.5">
              {new Date(job.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
            </span>
          </button>
        ))}
      </div>
    </>
  )
}
