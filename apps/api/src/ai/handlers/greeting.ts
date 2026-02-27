import type { ChatResponse } from '@naufarrel/shared'

// Fast path — no LLM call for simple greetings.
// The orchestrator routes here for short salutation-pattern messages.
// Returns a random warm response in Bahasa Indonesia, < 10ms.
const GREETING_RESPONSES = [
  'Halo! 👋 Saya asisten pengetahuan KM ITB. Silakan tanyakan apa saja tentang organisasi, prosedur kegiatan, atau keanggotaan.',
  'Hai! Saya siap membantu menjawab pertanyaan seputar KM ITB. Ada yang ingin Anda tanyakan?',
  'Selamat datang di Naufarrel! 🎓 Saya asisten pengetahuan KM ITB. Apa yang bisa saya bantu hari ini?',
]

export async function handleGreeting(
  _userText: string,
  _apiKey: string
): Promise<ChatResponse> {
  const text = GREETING_RESPONSES[Math.floor(Math.random() * GREETING_RESPONSES.length)]
  return {
    answer: text,
    citations: [],
    sources: [],
    hasCitations: false
  }
}
