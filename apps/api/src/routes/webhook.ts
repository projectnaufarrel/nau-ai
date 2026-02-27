import { Hono } from 'hono'
import type { Env } from '../index'
import { lineAdapter } from '../platforms/line'
import { verifyLineSignature } from '../lib/line-verify'
import { getSupabase } from '../lib/supabase'
import { routeMessage } from '../ai/router'

export const webhookRouter = new Hono<{ Bindings: Env }>()

webhookRouter.post('/line', async (c) => {
  try {
    const rawBody = await c.req.text()
    const signature = c.req.header('x-line-signature') ?? ''

    // 1. Verify signature — reject if invalid
    const valid = await verifyLineSignature(rawBody, signature, c.env.LINE_CHANNEL_SECRET)
    if (!valid) {
      return c.json({ error: 'Invalid signature' }, 401)
    }

    const body = JSON.parse(rawBody)

    // 2. Skip non-message events (follow, unfollow, postback, etc.)
    if (!body.events || body.events.length === 0) {
      return c.json({ ok: true })
    }

    const event = body.events[0]
    if (event.type !== 'message' || event.message?.type !== 'text') {
      return c.json({ ok: true }) // silently ignore non-text events
    }

    // 3. Parse incoming message
    const message = lineAdapter.parseIncoming(body)

    // 4. Guard against oversized messages before paying LLM cost
    if (message.text.length > 2000) {
      await replyToLine(c.env.LINE_CHANNEL_ACCESS_TOKEN, message.replyToken!, [
        { type: 'text', text: 'Maaf, pesan terlalu panjang. Mohon kirim pesan yang lebih singkat (maks. 2000 karakter).' }
      ])
      return c.json({ ok: true })
    }

    // 5. Route through AI orchestrator
    const supabase = getSupabase(c.env)
    const response = await routeMessage(message.text, supabase, c.env.GOOGLE_GENERATIVE_AI_API_KEY)

    // 6. Format for Line (source list appended as text)
    const formatted = lineAdapter.formatResponse(response) as { type: string; text: string }

    // 7. Reply via Line Messaging API (reply token expires in ~30s)
    await replyToLine(c.env.LINE_CHANNEL_ACCESS_TOKEN, message.replyToken!, [formatted])

    return c.json({ ok: true })
  } catch (err) {
    console.error('Webhook error:', err)
    // Always return 200 to Line — otherwise Line retries indefinitely
    return c.json({ ok: true })
  }
})

// Helper: send reply to Line Messaging API and log failures.
// Reply tokens expire ~30s after the webhook event — don't await this if speed is critical.
async function replyToLine(
  accessToken: string,
  replyToken: string,
  messages: object[]
): Promise<void> {
  const res = await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    },
    body: JSON.stringify({ replyToken, messages })
  })
  if (!res.ok) {
    const errBody = await res.text()
    console.error(`Line reply failed: HTTP ${res.status} — ${errBody}`)
  }
}
