import { Hono } from 'hono'
import type { Env } from '../index'
import { getSupabase } from '../lib/supabase'
import { runAgent } from '../ai/agent'
import { getOrCreateConversation } from '../db/queries'
import type { ChatRequest } from '@naufarrel/shared'

// Maximum messages stored per conversation — prevents unbounded JSONB growth
const MAX_CONVERSATION_MESSAGES = 50

export const chatRouter = new Hono<{ Bindings: Env }>()

chatRouter.post('/', async (c) => {
  try {
    const body = await c.req.json<ChatRequest>()

    if (!body.message?.trim()) {
      return c.json({ error: 'message is required' }, 400)
    }

    if (body.message.length > 2000) {
      return c.json({ error: 'message too long (max 2000 characters)' }, 400)
    }

    const supabase = getSupabase(c.env)

    // Load or create conversation for history context
    const conversation = await getOrCreateConversation(supabase, body.userId || 'anon', 'web')
    const history = (conversation.messages ?? []).map((m: { role: 'user' | 'assistant'; content: string }) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content
    }))

    // Run the agent (LLM decides what tools to use)
    const response = await runAgent({
      userText: body.message,
      supabase,
      apiKey: c.env.MOONSHOT_API_KEY,
      history
    })

    // Save conversation history
    const userMsg = {
      role: 'user' as const,
      content: body.message,
      timestamp: new Date().toISOString()
    }
    const assistantMsg = {
      role: 'assistant' as const,
      content: response.answer,
      timestamp: new Date().toISOString()
    }

    let updatedMessages = [...(conversation.messages ?? []), userMsg, assistantMsg]
    if (updatedMessages.length > MAX_CONVERSATION_MESSAGES) {
      updatedMessages = updatedMessages.slice(-MAX_CONVERSATION_MESSAGES)
    }

    await supabase
      .from('conversations')
      .update({ messages: updatedMessages, updated_at: new Date().toISOString() })
      .eq('id', conversation.id)

    return c.json(response)
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    console.error('Chat error:', errorMessage)
    return c.json({
      answer: 'Maaf, terjadi kesalahan internal. Silakan coba lagi.',
      sources: []
    }, 500)
  }
})
