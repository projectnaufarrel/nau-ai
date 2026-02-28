import { useRef } from 'react'
import { ChatArea } from '../components/ChatArea'

// Persist session across page refreshes
function getOrCreateSessionId(): string {
    try {
        const existing = localStorage.getItem('naufarrel-session-id')
        if (existing) return existing
        const id = crypto.randomUUID()
        localStorage.setItem('naufarrel-session-id', id)
        return id
    } catch {
        return crypto.randomUUID()
    }
}

export function ChatPage() {
    const sessionId = useRef(getOrCreateSessionId())

    return (
        <div className="flex h-screen bg-gray-50">
            <div className="flex flex-col flex-1 min-w-0">
                {/* Header */}
                <header className="bg-white border-b border-gray-200 px-4 py-3 flex-shrink-0">
                    <h1 className="font-bold text-gray-900 text-lg">Naufarrel</h1>
                    <p className="text-xs text-gray-500">Asisten Pengetahuan KM ITB</p>
                </header>

                <ChatArea
                    conversationId={sessionId.current}
                    userId={sessionId.current}
                />
            </div>
        </div>
    )
}
