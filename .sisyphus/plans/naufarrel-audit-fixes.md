# Project Naufarrel — Audit Fixes Plan

**Source**: Post-implementation audit of naufarrel-mvp.md
**Priority order**: 🔴 Critical → ⚠️ Important → 📋 Quality

---

## 🔴 CRITICAL FIX 1 — Citation Parser Offset Bug

**File**: `apps/api/src/ai/citation-parser.ts`

**Problem**: `startOffset` / `endOffset` are computed against `rawAnswer` but the returned `answer` is `cleanedAnswer` (with `[src:1]` → `[1]`). Since `[src:1]` is 7 chars and `[1]` is 3 chars, every citation after the first has offsets pointing to wrong character positions in the cleaned string.

**Fix**: Build `cleanedAnswer` first via `replace()`, then scan `cleanedAnswer` for each display marker in order to compute offsets against the final string.

**Replace entire file** `apps/api/src/ai/citation-parser.ts` with:

```typescript
import type { Citation, Source } from '@naufarrel/shared'

interface ParseResult {
  answer: string        // cleaned text with [1], [2] markers
  citations: Citation[]
  hasCitations: boolean
}

// Convert [src:N] markers from LLM into [N] display markers + Citation objects
// Offsets are calculated against the FINAL cleanedAnswer string (after replacement),
// not rawAnswer — because [src:1] (7 chars) → [1] (3 chars) shifts all subsequent positions.
export function parseCitations(rawAnswer: string, sources: Source[]): ParseResult {
  const markerRegex = /\[src:(\d+)\]/g
  let match: RegExpExecArray | null

  // First pass: collect all matches and validate source references
  const matches: Array<{ full: string; index: number; sourceNum: number }> = []
  while ((match = markerRegex.exec(rawAnswer)) !== null) {
    matches.push({ full: match[0], index: match.index, sourceNum: parseInt(match[1], 10) })
  }

  // Fallback: no citations found, or any source ref is out of range
  const allValid = matches.every(m => m.sourceNum >= 1 && m.sourceNum <= sources.length)
  if (matches.length === 0 || !allValid) {
    return { answer: rawAnswer, citations: [], hasCitations: false }
  }

  // Build cleanedAnswer first. Track insertion order of citations.
  const orderedCitations: Array<{ sourceNum: number; displayMarker: string }> = []
  const cleanedAnswer = rawAnswer.replace(/\[src:(\d+)\]/g, (_full, numStr) => {
    const sourceNum = parseInt(numStr, 10)
    const displayMarker = `[${sourceNum}]`
    orderedCitations.push({ sourceNum, displayMarker })
    return displayMarker
  })

  // Scan cleanedAnswer for each display marker in order — correct offsets into final string
  const citations: Citation[] = []
  let searchFrom = 0
  for (const { sourceNum, displayMarker } of orderedCitations) {
    const startOffset = cleanedAnswer.indexOf(displayMarker, searchFrom)
    if (startOffset === -1) continue
    const endOffset = startOffset + displayMarker.length
    citations.push({
      sourceIndex: sourceNum - 1, // 0-based index into sources[]
      startOffset,
      endOffset,
      marker: displayMarker
    })
    searchFrom = endOffset // advance past this marker for duplicate number safety
  }

  return { answer: cleanedAnswer, citations, hasCitations: true }
}
```

**QA**:
- `parseCitations("Text [src:1] more [src:2] end.", sources2)` → citations[0].startOffset=5, citations[1].startOffset=13 (positions in `"Text [1] more [2] end."`)
- `parseCitations("No markers", sources)` → `hasCitations: false`
- `parseCitations("Bad [src:99]", sources)` → `hasCitations: false`

---

## 🔴 CRITICAL FIX 2 — Conversation History Race Condition

**File**: `apps/api/src/routes/chat.ts`

**Problem**: Two sequential `appendMessage` calls with stale state. The first call appends `userMsg` to `conversation.messages` (old array). The second call manually builds `updatedMessages = [...conversation.messages, userMsg]` from the same stale array, then appends `assistantMsg` to it. This is correct for a single request, but `appendMessage` does a **full JSONB array replace** — if two concurrent requests arrive, the second request's write will overwrite the first.

**Fix**: Combine both messages into a single `update` call using an atomic append approach. Replace the two sequential `appendMessage` calls with one Supabase `.rpc()` call that appends both atomically, OR serialize via a single update with both messages at once.

**Replace entire file** `apps/api/src/routes/chat.ts` with:

```typescript
import { Hono } from 'hono'
import type { Env } from '../index'
import { getSupabase } from '../lib/supabase'
import { routeMessage } from '../ai/router'
import { getOrCreateConversation } from '../db/queries'
import type { ChatRequest } from '@naufarrel/shared'
import type { ConversationMessage } from '../db/schema'

// Maximum messages to keep in a conversation (prevents unbounded growth)
const MAX_CONVERSATION_MESSAGES = 50

export const chatRouter = new Hono<{ Bindings: Env }>()

chatRouter.post('/', async (c) => {
  try {
    const body = await c.req.json<ChatRequest>()

    if (!body.message?.trim()) {
      return c.json({ error: 'message is required' }, 400)
    }

    // Input length guard — prevent LLM prompt injection / runaway token costs
    if (body.message.length > 2000) {
      return c.json({ error: 'message too long (max 2000 characters)' }, 400)
    }

    const supabase = getSupabase(c.env)
    const userId = body.userId ?? 'anonymous'

    // Load or create conversation
    const conversation = await getOrCreateConversation(supabase, userId, 'web')
    const history = (conversation.messages ?? []).map(m => ({ role: m.role, content: m.content }))

    // Get AI response
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

    // Single atomic update: append both messages at once, enforce max length
    let updatedMessages = [...(conversation.messages ?? []), userMsg, assistantMsg]
    if (updatedMessages.length > MAX_CONVERSATION_MESSAGES) {
      // Keep the most recent messages, always preserve pairs (user+assistant)
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
```

**Also update** `apps/api/src/db/queries.ts`: remove the `appendMessage` export (no longer used) to avoid confusion. Keep `getOrCreateConversation` and `searchSections`.

**QA**:
- Single request → conversation row has exactly 2 messages (1 user + 1 assistant)
- After 26 exchanges (52 messages) → row has exactly 50 messages (oldest trimmed)
- Message > 2000 chars → 400 error

---

## 🔴 CRITICAL FIX 3 — CORS Too Open

**File**: `apps/api/src/index.ts`

**Problem**: `app.use('*', cors())` allows any origin. Webhook endpoint doesn't need CORS at all (it's server-to-server). API endpoint should only accept requests from the web frontend.

**Fix**: Add `ALLOWED_ORIGIN` env var. Apply CORS only to `/api/*` routes, not `/webhook/*`. Restrict to configured origin with localhost fallback for dev.

**Add to Env interface**:
```typescript
ALLOWED_ORIGIN?: string  // e.g. "https://naufarrel.pages.dev" — optional, defaults to localhost
```

**Replace entire file** `apps/api/src/index.ts` with:

```typescript
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { webhookRouter } from './routes/webhook'
import { chatRouter } from './routes/chat'

export interface Env {
  LINE_CHANNEL_SECRET: string
  LINE_CHANNEL_ACCESS_TOKEN: string
  SUPABASE_URL: string
  SUPAB
