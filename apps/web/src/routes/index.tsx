import { createFileRoute } from '@tanstack/react-router'
import { useState, useRef } from 'react'
import type { Source } from '@naufarrel/shared'
import { ChatArea } from '../components/ChatArea'
import { SourceSidebar } from '../components/SourceSidebar'

export const Route = createFileRoute('/')({
  component: ChatPage
})

// Persist session across page refreshes so conversation history is maintained.
// Falls back to a fresh UUID if localStorage is unavailable (SSR / private browsing).
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

function ChatPage() {
  // sidebarSources holds the sources for whichever message's citation was last clicked.
  // This means clicking an old message's citation shows THAT message's sources, not the latest.
  const [sidebarSources, setSidebarSources] = useState<Source[]>([])
  const [activeCitation, setActiveCitation] = useState<number | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const sessionId = useRef(getOrCreateSessionId())

  function handleCitationClick(sources: Source[], index: number) {
    setSidebarSources(sources)
    setActiveCitation(index)
    setSidebarOpen(true)
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Main chat column */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between flex-shrink-0">
          <div>
            <h1 className="font-bold text-gray-900 text-lg">Naufarrel</h1>
            <p className="text-xs text-gray-500">Asisten Pengetahuan KM ITB</p>
          </div>
          {sidebarSources.length > 0 && (
            <button
              onClick={() => setSidebarOpen(prev => !prev)}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              {sidebarOpen ? 'Tutup Sumber' : `Lihat Sumber (${sidebarSources.length})`}
            </button>
          )}
        </header>

        <ChatArea
          onCitationClick={handleCitationClick}
          activeCitation={activeCitation}
          conversationId={sessionId.current}
          userId={sessionId.current}
        />
      </div>

      {/* Source sidebar (right panel) */}
      {sidebarOpen && (
        <SourceSidebar
          sources={sidebarSources}
          activeCitation={activeCitation}
          onClose={() => setSidebarOpen(false)}
        />
      )}
    </div>
  )
}
