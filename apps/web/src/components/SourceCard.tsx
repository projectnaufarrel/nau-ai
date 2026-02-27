import type { Source } from '@naufarrel/shared'

interface SourceCardProps {
  source: Source
  index: number
  isActive: boolean
}

export function SourceCard({ source, index, isActive }: SourceCardProps) {
  return (
    <div
      className={`p-3 rounded-lg border mb-2 transition-colors ${
        isActive ? 'border-blue-400 bg-blue-50' : 'border-gray-200 bg-white'
      }`}
    >
      <div className="flex items-start gap-2">
        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-semibold">
          {index + 1}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-blue-700 truncate">{source.documentTitle}</p>
          <p className="text-xs text-gray-500 mb-1">{source.sectionTitle}</p>
          <p className="text-xs text-gray-700 line-clamp-4">{source.content}</p>
        </div>
      </div>
    </div>
  )
}
