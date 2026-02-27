// TypeScript types matching the database schema
// Used for query return type annotations

export interface Organization {
  id: string
  name: string
  description: string | null
  created_at: string
}

export interface Document {
  id: string
  org_id: string
  title: string
  doc_type: string
  source_url: string | null
  created_at: string
}

export interface DocumentSection {
  id: string
  document_id: string
  section_title: string | null
  content: string
  section_order: number
  created_at: string
}

export interface Conversation {
  id: string
  user_platform_id: string
  platform: 'line' | 'web'
  messages: ConversationMessage[]
  created_at: string
  updated_at: string
}

export interface ConversationMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  sources?: string[] // section IDs used
}
