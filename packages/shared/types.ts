// Contract between API and Web frontend — never break this shape

export interface Citation {
  sourceIndex: number;   // index into sources[]
  startOffset: number;   // char position in answer where citation marker starts
  endOffset: number;     // char position where citation marker ends
  marker: string;        // display text e.g. "[1]"
}

export interface Source {
  sectionId: string;
  documentTitle: string;
  sectionTitle: string;
  docType: string;
  content: string;
  relevanceScore?: number;
}

export interface ChatResponse {
  answer: string;
  citations: Citation[];
  sources: Source[];
  hasCitations: boolean; // false = fallback mode, show sources list below answer
}

export interface ChatRequest {
  message: string;
  conversationId?: string;
  userId?: string;
}
// PlatformMessage and PlatformAdapter are API-internal types.
// They live in apps/api/src/platforms/types.ts, not here.
// This file only exports the API<->Frontend contract types.
