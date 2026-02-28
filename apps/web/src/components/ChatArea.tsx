import { useState, useRef, useEffect } from 'react'
import type { ChatResponse } from '@naufarrel/shared'
import { sendMessage } from '../lib/api'
import { MessageBubble } from './MessageBubble'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  chatResponse?: ChatResponse
}

interface ChatAreaProps {
  conversationId: string
  userId: string
}

export function ChatArea({ conversationId, userId }: ChatAreaProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend() {
    const text = input.trim()
    if (!text || loading) return

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: text }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const response = await sendMessage({ message: text, conversationId, userId })
      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.answer,
        chatResponse: response
      }
      setMessages(prev => [...prev, assistantMsg])
    } catch {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Maaf, terjadi kesalahan. Silakan coba lagi.'
      }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Message list */}
      <div className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 mt-16">
            <p className="text-4xl mb-3">💬</p>
            <p className="text-base font-medium text-gray-500">Tanyakan sesuatu tentang KM ITB</p>
            <p className="text-sm mt-1">Prosedur kegiatan, keanggotaan, dan informasi organisasi</p>
          </div>
        )}
        {messages.map(msg => (
          <MessageBubble
            key={msg.id}
            role={msg.role}
            content={msg.content}
            chatResponse={msg.chatResponse}
          />
        ))}
        {loading && (
          <div className="flex justify-start mb-3">
            <div className="bg-gray-100 rounded-2xl px-4 py-2 text-gray-500 text-sm animate-pulse">
              Sedang berpikir...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-gray-200 p-3 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
          placeholder="Tanya tentang KM ITB..."
          className="flex-1 rounded-full border border-gray-300 px-4 py-2 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
          disabled={loading}
        />
        <button
          onClick={handleSend}
          disabled={loading || !input.trim()}
          className="bg-blue-600 text-white rounded-full px-5 py-2 text-sm font-medium disabled:opacity-50 hover:bg-blue-700 transition-colors"
        >
          Kirim
        </button>
      </div>
    </div>
  )
}
