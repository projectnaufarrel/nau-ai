import type { Source } from '@naufarrel/shared'
import { SourceCard } from './SourceCard'
import { useEffect, useRef } from 'react'

interface SourceSidebarProps {
  sources: Source[]
  activeCitation: number | null
  onClose: () => void
}

export function SourceSidebar({ sources, activeCitation, onClose }: SourceSidebarProps) {
  const cardRefs = useRef<(HTMLDivElement | null)[]>([])

  // Auto-scroll to active citation card
  useEffect(() => {
    if (activeCitation !== null && cardRefs.current[activeCitation]) {
      cardRefs.current[activeCitation]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [activeCitation])

  if (sources.length === 0) return null

  return (
    <div className="w-80 flex-shrink-0 bg-white border-l border-gray-200 flex flex-col h-full">
      <div className="flex items-center justify-between p-3 border-b border-gray-200">
        <h2 className="text-sm font-semibold text-gray-700">Sumber Dokumen</h2>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 text-xl leading-none"
          aria-label="Tutup sidebar"
        >
          ×
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        {sources.map((src, i) => (
          <div key={src.sectionId} ref={el => { cardRefs.current[i] = el }}>
            <SourceCard source={src} index={i} isActive={activeCitation === i} />
          </div>
        ))}
      </div>
    </div>
  )
}
