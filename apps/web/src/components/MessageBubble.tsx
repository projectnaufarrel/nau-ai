import type { ChatResponse, Source } from '@naufarrel/shared'
import { CitationMarker } from './CitationMarker'

interface MessageBubbleProps {
  role: 'user' | 'assistant'
  content: string
  chatResponse?: ChatResponse  // only for assistant messages
  activeCitation: number | null
  // Receives sources from this message + the citation index clicked.
  // This ensures sidebar always shows sources for the message the user clicked, not the latest.
  onCitationClick: (sources: Source[], index: number) => void
}

export function MessageBubble({ role, content, chatResponse, activeCitation, onCitationClick }: MessageBubbleProps) {
  if (role === 'user') {
    return (
      <div className="flex justify-end mb-3">
        <div className="bg-blue-600 text-white rounded-2xl rounded-br-sm px-4 py-2 max-w-xs lg:max-w-md">
          {content}
        </div>
      </div>
    )
  }

  // Render assistant message with inline citation chips
  const renderWithCitations = () => {
    if (!chatResponse?.hasCitations || !chatResponse.citations.length) {
      return <p className="whitespace-pre-wrap">{content}</p>
    }

    // Split answer text by citation markers [1], [2], etc.
    const parts: React.ReactNode[] = []
    let lastIndex = 0
    const markerRegex = /\[(\d+)\]/g
    let match: RegExpExecArray | null

    while ((match = markerRegex.exec(content)) !== null) {
      // Text before marker
      if (match.index > lastIndex) {
        parts.push(content.slice(lastIndex, match.index))
      }
      const num = parseInt(match[1], 10)
      parts.push(
        <CitationMarker
          key={match.index}
          number={num}
          onClick={(num) => onCitationClick(chatResponse?.sources ?? [], num)}
          active={activeCitation === num - 1}
        />
      )
      lastIndex = match.index + match[0].length
    }
    if (lastIndex < content.length) {
      parts.push(content.slice(lastIndex))
    }

    return <p className="whitespace-pre-wrap leading-relaxed">{parts}</p>
  }

  return (
    <div className="flex justify-start mb-3">
      <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-4 py-2 max-w-xs lg:max-w-md">
        {renderWithCitations()}
        {/* Fallback: show sources list below answer if hasCitations=false */}
        {chatResponse && !chatResponse.hasCitations && chatResponse.sources.length > 0 && (
          <div className="mt-2 pt-2 border-t border-gray-200 text-sm text-gray-600">
            <p className="font-semibold mb-1">Sumber:</p>
            {chatResponse.sources.map((src, i) => (
              <p key={src.sectionId} className="text-xs">
                [{i + 1}] {src.documentTitle} — {src.sectionTitle}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
