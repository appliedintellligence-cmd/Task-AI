import { useRef, useState, useEffect } from 'react'
import { useVoice } from '../hooks/useVoice'

export default function ChatInput({ onSend, loading }) {
  const [text, setText] = useState('')
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const textareaRef = useRef()
  const fileRef = useRef()
  const handleSendRef = useRef()

  const { isListening, transcript, supported: voiceSupported, startListening, stopListening, registerSubmit } = useVoice()

  // Keep submit callback current so auto-submit closure isn't stale
  handleSendRef.current = () => {
    if (loading || (!text.trim() && !imageFile)) return
    onSend(text.trim(), imageFile)
    setText('')
    setImageFile(null)
    setImagePreview(null)
  }

  useEffect(() => {
    registerSubmit(() => handleSendRef.current?.())
  }, [registerSubmit])

  // Stream voice transcript into textarea
  useEffect(() => {
    if (transcript) setText(transcript)
  }, [transcript])

  // Auto-resize textarea up to 4 rows (~96px)
  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 96) + 'px'
  }, [text])

  function handleFile(e) {
    const file = e.target.files[0]
    if (!file?.type.startsWith('image/')) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
    e.target.value = ''
  }

  function removeImage() {
    setImageFile(null)
    setImagePreview(null)
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function handleSend() {
    handleSendRef.current?.()
  }

  function toggleMic() {
    if (!voiceSupported) return
    if (isListening) stopListening()
    else startListening()
  }

  const canSend = !loading && (text.trim().length > 0 || imageFile !== null)

  return (
    <div className="border-t border-gray-200 bg-white px-4 py-3">
      {/* Status bar */}
      {(loading || isListening) && (
        <div className="flex items-center gap-2 mb-2 px-1">
          {isListening ? (
            <>
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-xs text-red-500 font-medium">Listening…</span>
            </>
          ) : (
            <>
              <div className="flex gap-1">
                {[0, 150, 300].map((delay) => (
                  <span
                    key={delay}
                    className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce"
                    style={{ animationDelay: `${delay}ms` }}
                  />
                ))}
              </div>
              <span className="text-xs text-gray-500">task.ai is analysing…</span>
            </>
          )}
        </div>
      )}

      {/* Image preview chip */}
      {imagePreview && (
        <div className="mb-2">
          <div className="inline-flex items-center gap-2 bg-gray-100 rounded-lg px-2 py-1">
            <img src={imagePreview} alt="" className="w-8 h-8 rounded object-cover" />
            <span className="text-xs text-gray-600 max-w-[140px] truncate">{imageFile?.name}</span>
            <button
              onClick={removeImage}
              className="text-gray-400 hover:text-gray-600 text-xs ml-1"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Input row */}
      <div className="flex items-end gap-2">
        {/* Paperclip */}
        <button
          type="button"
          onClick={() => fileRef.current.click()}
          className="flex-shrink-0 p-2 text-gray-400 hover:text-blue-500 hover:bg-gray-100 rounded-lg transition"
          title="Attach image"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
          </svg>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFile}
        />

        {/* Mic */}
        <button
          type="button"
          onClick={toggleMic}
          disabled={!voiceSupported}
          className={`flex-shrink-0 p-2 rounded-lg transition ${
            isListening
              ? 'text-red-500 bg-red-50 animate-pulse'
              : voiceSupported
                ? 'text-gray-400 hover:text-blue-500 hover:bg-gray-100'
                : 'text-gray-300 cursor-not-allowed'
          }`}
          title={
            isListening
              ? 'Stop recording'
              : voiceSupported
                ? 'Voice input'
                : 'Voice not supported in this browser'
          }
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
        </button>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            isListening
              ? 'Listening…'
              : imageFile
                ? 'Add a message (optional)…'
                : 'Ask about a repair or attach a photo…'
          }
          rows={1}
          className="flex-1 resize-none rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition overflow-y-auto"
          style={{ lineHeight: '1.5', maxHeight: '96px' }}
        />

        {/* Send */}
        <button
          type="button"
          onClick={handleSend}
          disabled={!canSend}
          className="flex-shrink-0 p-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl transition"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      </div>
    </div>
  )
}
