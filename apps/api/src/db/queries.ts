import type { SupabaseClient } from '@supabase/supabase-js'
import type { Source } from '@naufarrel/shared'
import type { Conversation } from './schema'

// Search document sections via full-text search
// Returns sections with parent document metadata — feeds directly into citations
export async function searchSections(
  supabase: SupabaseClient,
  query: string,
  limit = 5
): Promise<Source[]> {
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

