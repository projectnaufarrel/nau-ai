import type { ChatResponse } from '@naufarrel/shared'
import type { SupabaseClient } from '@supabase/supabase-js'
import { handleGreeting } from './handlers/greeting'
import { handleKnowledge } from './handlers/knowledge'

// Greeting patterns — deterministic TypeScript logic, NOT an LLM call
// Short messages matching common salutations → fast path, no DB or LLM retrieval
const GREETING_PATTERNS = [
  /^(halo|hai|hi|hello|hey|selamat\s+(pagi|siang|sore|malam))[!.,\s]*$/i,
  /^(apa kabar|gimana kabar|how are you)[?!.,\s]*$/i,
  /^(terima kasih|makasih|thanks|thank you)[!.,\s]*$/i,
  /^(ok|oke|okay|baik|siap)[!.,\s]*$/i
]

function isGreeting(text: string): boolean {
  const trimmed = text.trim()
  // Short messages under 20 chars that match greeting patterns
  return trimmed.length < 20 && GREETING_PATTERNS.some(p => p.test(trimmed))
}

export async function routeMessage(
  userText: string,
  supabase: SupabaseClient,
  googleApiKey: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }> = []
): Promise<ChatResponse> {
  if (isGreeting(userText)) {
    return handleGreeting(userText, googleApiKey)
  }
  return handleKnowledge(userText, supabase, googleApiKey, history)
}
