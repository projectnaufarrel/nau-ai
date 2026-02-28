// Shared types between API and frontend
// This is the contract — any change here affects both sides

export interface ChatRequest {
  message: string
  userId: string
  conversationId: string
}

export interface ChatResponse {
  answer: string
  sources: Source[]
}

export interface Source {
  index: number
  documentTitle: string
  sectionTitle: string
  excerpt: string
}

// Conversation message stored in Supabase JSONB
export interface ConversationMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  sources?: Source[]
}
