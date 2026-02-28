import type { SupabaseClient } from '@supabase/supabase-js'
import type { Conversation } from './schema'

// Search result shape returned by the RPC
export interface SearchResult {
  sectionId: string
  documentTitle: string
  sectionTitle: string
  docType: string
  content: string
  relevanceScore: number
}

// Search document sections via full-text search
// Returns sections with parent document metadata
export async function searchSections(
  supabase: SupabaseClient,
  query: string,
  limit = 5
): Promise<SearchResult[]> {
  const { data, error } = await supabase.rpc('search_sections', {
    query_text: query,
    result_limit: limit
  })

  if (error) throw new Error(`Search failed: ${error.message}`)

  return (data ?? []).map((row: {
    section_id: string
    document_title: string
    section_title: string
    doc_type: string
    content: string
    rank: number
  }) => ({
    sectionId: row.section_id,
    documentTitle: row.document_title,
    sectionTitle: row.section_title ?? '',
    docType: row.doc_type,
    content: row.content,
    relevanceScore: row.rank
  }))
}

// Load or create a conversation for a user+platform combination
export async function getOrCreateConversation(
  supabase: SupabaseClient,
  userId: string,
  platform: 'line' | 'web'
): Promise<Conversation> {
  // Try to find existing conversation
  const { data: existing } = await supabase
    .from('conversations')
    .select('*')
    .eq('user_platform_id', userId)
    .eq('platform', platform)
    .order('updated_at', { ascending: false })
    .limit(1)
    .single()

  if (existing) return existing as Conversation

  // Create new conversation
  const { data: created, error } = await supabase
    .from('conversations')
    .insert({ user_platform_id: userId, platform, messages: [] })
    .select()
    .single()

  if (error) throw new Error(`Failed to create conversation: ${error.message}`)
  return created as Conversation
}

// Fetch a full document with all its sections
export async function getDocumentById(
  supabase: SupabaseClient,
  documentId: string
): Promise<{
  title: string
  docType: string
  sections: Array<{ sectionTitle: string; content: string; sectionOrder: number }>
} | null> {
  // Fetch the document
  const { data: doc, error: docError } = await supabase
    .from('documents')
    .select('title, doc_type')
    .eq('id', documentId)
    .single()

  if (docError || !doc) return null

  // Fetch all sections
  const { data: sections, error: secError } = await supabase
    .from('document_sections')
    .select('section_title, content, section_order')
    .eq('document_id', documentId)
    .order('section_order', { ascending: true })

  if (secError) return null

  return {
    title: doc.title,
    docType: doc.doc_type,
    sections: (sections ?? []).map(s => ({
      sectionTitle: s.section_title ?? '',
      content: s.content,
      sectionOrder: s.section_order
    }))
  }
}
