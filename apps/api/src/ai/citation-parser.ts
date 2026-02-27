import type { Citation, Source } from '@naufarrel/shared'

interface ParseResult {
  answer: string        // cleaned text with [1], [2] markers
  citations: Citation[]
  hasCitations: boolean
}

// Convert [src:N] markers from LLM into [N] display markers + Citation objects.
// IMPORTANT: Offsets are computed against the FINAL cleanedAnswer string, not rawAnswer.
// [src:1] is 7 chars, [1] is 3 chars — every replacement shifts subsequent positions by -4.
// Strategy: build cleanedAnswer first, then scan it for correct offsets.
export function parseCitations(rawAnswer: string, sources: Source[]): ParseResult {
  const markerRegex = /\[src:(\d+)\]/g
  let match: RegExpExecArray | null

  // First pass: collect all matches and validate that all source refs are in range
  const matches: Array<{ sourceNum: number }> = []
  while ((match = markerRegex.exec(rawAnswer)) !== null) {
    matches.push({ sourceNum: parseInt(match[1], 10) })
  }

  // Fallback: no citations, or any ref is out of range
  const allValid = matches.every(m => m.sourceNum >= 1 && m.sourceNum <= sources.length)
  if (matches.length === 0 || !allValid) {
    return { answer: rawAnswer, citations: [], hasCitations: false }
  }

  // Build cleanedAnswer while recording the insertion order of citations
  const orderedCitations: Array<{ sourceNum: number; displayMarker: string }> = []
  const cleanedAnswer = rawAnswer.replace(/\[src:(\d+)\]/g, (_full, numStr) => {
    const sourceNum = parseInt(numStr, 10)
    const displayMarker = `[${sourceNum}]`
    orderedCitations.push({ sourceNum, displayMarker })
    return displayMarker
  })

  // Scan cleanedAnswer for each display marker in insertion order.
  // searchFrom advances past each found marker so duplicate numbers (two [1]s) resolve correctly.
  const citations: Citation[] = []
  let searchFrom = 0
  for (const { sourceNum, displayMarker } of orderedCitations) {
    const startOffset = cleanedAnswer.indexOf(displayMarker, searchFrom)
    if (startOffset === -1) continue // guard: shouldn't happen
    const endOffset = startOffset + displayMarker.length
    citations.push({
      sourceIndex: sourceNum - 1, // 0-based index into sources[]
      startOffset,
      endOffset,
      marker: displayMarker
    })
    searchFrom = endOffset
  }

  return { answer: cleanedAnswer, citations, hasCitations: true }
}
