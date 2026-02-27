interface CitationMarkerProps {
  number: number
  onClick: (index: number) => void
  active: boolean
}

export function CitationMarker({ number, onClick, active }: CitationMarkerProps) {
  return (
    <button
      onClick={() => onClick(number - 1)}
      className={`inline-flex items-center justify-center w-5 h-5 text-xs rounded-full mx-0.5 font-semibold transition-colors ${
        active
          ? 'bg-blue-600 text-white'
          : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
      }`}
      aria-label={`Lihat sumber ${number}`}
    >
      {number}
    </button>
  )
}
