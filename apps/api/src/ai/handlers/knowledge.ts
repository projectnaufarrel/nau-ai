import { generateText } from 'ai'
import { google } from '@ai-sdk/google'
import type { ChatResponse, Source } from '@naufarrel/shared'
import type { SupabaseClient } from '@supabase/supabase-js'
import { searchSections } from '../../db/queries'
import { buildKnowledgePrompt } from '../prompts/knowledge'
import { parseCitations } from '../citation-parser'

export async function handleKnowledge(
  userText: string,
  supabase: SupabaseClient,
  apiKey: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }> = []
): Promise<ChatResponse> {
  // 1. Retrieve relevant sections via full-text search
  const sources: Source[] = await searchSections(supabase, userText, 5)

  if (sources.length === 0) {
    return {
      answer: 'Maaf, saya tidak menemukan informasi yang relevan dengan pertanyaan Anda di database KM ITB. Silakan coba pertanyaan lain atau hubungi pengurus KM ITB secara langsung.',
      citations: [],
      sources: [],
      hasCitations: false
    }
  }

  // 2. Build prompt with numbered sources + conversation history
  const prompt = buildKnowledgePrompt(sources, userText, history)

  // 3. Call LLM via AI SDK (model agnostic — swap provider by changing this line)
  const { text: rawAnswer } = await generateText({
    model: google('gemini-1.5-flash', { apiKey }),
    prompt
  })

  // 4. Parse [src:N] citation markers from LLM response
  const { answer, citations, hasCitations } = parseCitations(rawAnswer, sources)

  // 5. Return structured ChatResponse
  // hasCitations=false means fallback: frontend/Line shows sources as plain list
  return {
    answer,
    citations,
    sources,
    hasCitations
  }
}
