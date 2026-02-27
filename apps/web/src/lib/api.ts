import type { ChatRequest, ChatResponse } from '@naufarrel/shared'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8787'

export async function sendMessage(request: ChatRequest): Promise<ChatResponse> {
  const res = await fetch(`${API_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request)
  })
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json() as Promise<ChatResponse>
}
