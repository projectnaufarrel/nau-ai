import { useState } from 'react'
import type { ChatResponse, Source } from '@naufarrel/shared'

interface MessageBubbleProps {
  role: 'user' | 'assistant'
  content: string
  chatResponse?: ChatResponse
}

export function MessageBubble({ role, content, chatResponse }: MessageBubbleProps) {
  const [sourcesExpanded, setSourcesExpanded] = useState(false)

  if (role === 'user') {
    return (
      <div className="flex justify-end mb-3">
        <div className="bg-blue-600 text-white rounded-2xl rounded-br-sm px-4 py-2 max-w-xs lg:max-w-md">
          {content}
        </div>
      </div>
    )
  }

  // Parse [N] markers in the answer text and render as styled chips
  const renderContent = () => {
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
        <button
          key={match.index}
          onClick={() => setSourcesExpanded(true)}
          className="inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-blue-700 bg-blue-100 rounded-full cursor-pointer hover:bg-blue-200 transition-colors mx-0.5 align-text-top"
          title={`Sumber ${num}`}
        >
          {num}
        </button>
      )
      lastIndex = match.index + match[0].length
    }
    if (lastIndex < content.length) {
      parts.push(content.slice(lastIndex))
    }

    return <p className="whitespace-pre-wrap leading-relaxed">{parts}</p>
  }

  const sources = chatResponse?.sources ?? []

  return (
    <div className="flex justify-start mb-3">
      <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-4 py-2 max-w-xs lg:max-w-md">
        {renderContent()}

        {/* Sources section */}
        {sources.length > 0 && (
          <div className="mt-2 pt-2 border-t border-gray-200">
            <button
              onClick={() => setSourcesExpanded(!sourcesExpanded)}
              className="text-xs text-blue-600 font-medium hover:text-blue-700 flex items-center gap-1"
            >
              📄 {sources.length} Sumber
              <span className="text-[10px]">{sourcesExpanded ? '▲' : '▼'}</span>
            </button>

            {sourcesExpanded && (
              <div className="mt-2 space-y-2">
                {sources.map((src) => (
                  <div
                    key={`${src.documentTitle}-${src.sectionTitle}`}
                    className="bg-white rounded-lg p-2 border border-gray-200"
                  >
                    <div className="flex items-start gap-1.5">
                      <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-blue-700 bg-blue-100 rounded-full flex-shrink-0 mt-0.5">
                        {src.index}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-gray-800 leading-tight">
                          {src.documentTitle}
                        </p>
                        <p className="text-[11px] text-gray-500">
                          {src.sectionTitle}
                        </p>
                        <p className="text-[11px] text-gray-600 mt-1 italic leading-snug line-clamp-3">
                          "{src.excerpt}"
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
