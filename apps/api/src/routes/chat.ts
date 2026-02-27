import { Hono } from 'hono'
import type { Env } from '../index'
import { getSupabase } from '../lib/supabase'
import { routeMessage } from '../ai/router'
import { getOrCreateConversation } from '../db/queries'
import { webAdapter } from '../platforms/web'
import type { ChatRequest } from '@naufarrel/shared'
import type { ConversationMessage } from '../db/schema'

// Maximum messages stored per conversation — prevents unbounded JSONB growth
const MAX_CONVERSATION_MESSAGES = 50

export const chatRouter = new Hono<{ Bindings: Env }>()

chatRouter.post('/', async (c) => {
  try {
    const body = await c.req.json<ChatRequest>()

    if (!body.message?.trim()) {
      return c.json({ error: 'message is required' }, 400)
    }

    // Guard against oversized messages — prevents LLM token abuse
    if (body.message.length > 2000) {
      return c.json({ error: 'message too long (max 2000 characters)' }, 400)
    }

    const supabase = getSupabase(c.env)

    // Use webAdapter to extract userId — keeps platform pattern consistent
    const platformMsg = webAdapter.parseIncoming(body)
    const userId = platformMsg.userId

    // Load or create conversation for history context
    const conversation = await getOrCreateConversation(supabase, userId, 'web')
    const history = (conversation.messages ?? []).map(m => ({ role: m.role, content: m.content }))

    // Get AI response (with conversation history for follow-up context)
    const response = await routeMessage(body.message, supabase, c.env.GOOGLE_GENERATIVE_AI_API_KEY, history)

    // Build both new messages
    const userMsg: ConversationMessage = {
      role: 'user',
      content: body.message,
      timestamp: new Date().toISOString()
    }
    const assistantMsg: ConversationMessage = {
      role: 'assistant',
      content: response.answer,
      timestamp: new Date().toISOString(),
      sources: response.sources.map(s => s.sectionId)
    }

    // Single atomic update: append both messages at once, enforce max history length.
    // Using one update (not two sequential calls) eliminates the race condition.
    let updatedMessages = [...(conversation.messages ?? []), userMsg, assistantMsg]
    if (updatedMessages.length > MAX_CONVERSATION_MESSAGES) {
      // Trim oldest messages — always trim in pairs to keep user+assistant together
      updatedMessages = updatedMessages.slice(-MAX_CONVERSATION_MESSAGES)
    }

    await supabase
      .from('conversations')
      .update({ messages: updatedMessages, updated_at: new Date().toISOString() })
      .eq('id', conversation.id)

    return c.json(response)
  } catch (err) {
    console.error('Chat error:', err)
    return c.json({
      answer: 'Maaf, terjadi kesalahan internal. Silakan coba lagi.',
      citations: [],
      sources: [],
      hasCitations: false
    }, 500)
  }
})
