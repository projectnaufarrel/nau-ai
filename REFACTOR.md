# Sprint 1 Refactor — Deterministic Router → LLM Agent

## What Changed

Replaced the deterministic regex router + RAG pipeline with a **single LLM agent with tool calling** — matching the spec in `project-naufarrel-sprint1-context.md`.

```
BEFORE                                    AFTER
─────                                     ─────
User → regex → greeting? → static        User → LLM (system prompt + tools)
             → else → search DB                  ├─ responds directly (casual)
               → 0 results → hardcoded           ├─ calls searchDocuments
               → N results → inject → LLM        └─ calls getDocumentFull
```

**Before**: TypeScript `if/else` decided everything. LLM only saw pre-fetched search results.  
**After**: LLM receives the message and decides whether to search, fetch a full doc, or just respond.

---

## Files Created

| File | Purpose |
|------|---------|
| `apps/api/src/ai/agent.ts` | Core agent — `generateText()` with 2 inline tools |
| `apps/api/src/ai/system-prompt.ts` | "Naufarrel" personality (warm, knowledgeable, conversational) |
| `apps/api/src/ai/tools/search-documents.ts` | *(unused — tools moved inline into agent.ts)* |
| `apps/api/src/ai/tools/get-document-full.ts` | *(unused — tools moved inline into agent.ts)* |

## Files Modified

| File | Change |
|------|--------|
| `apps/api/src/routes/chat.ts` | `routeMessage()` → `runAgent()` |
| `apps/api/src/routes/webhook.ts` | `routeMessage()` → `runAgent()` |
| `apps/api/src/db/queries.ts` | Added `getDocumentById()`, `SearchResult` type |
| `apps/api/src/platforms/line.ts` | Source numbering uses `src.index` |
| `packages/shared/types.ts` | Removed `Citation`, `hasCitations`. Source now has `index`, `excerpt` |
| `apps/web/src/components/MessageBubble.tsx` | Inline [N] chips + collapsible source excerpts |
| `apps/web/src/components/ChatArea.tsx` | Removed sidebar props and citation handlers |
| `apps/web/src/pages/ChatPage.tsx` | Removed sidebar state |

## Files to Delete (old architecture, no longer imported)

```
apps/api/src/ai/router.ts
apps/api/src/ai/citation-parser.ts
apps/api/src/ai/handlers/greeting.ts
apps/api/src/ai/handlers/knowledge.ts
apps/api/src/ai/prompts/knowledge.ts
apps/api/src/ai/prompts/greeting.ts
```

---

## Key Debugging Findings

### 1. AI SDK v6 API Changes
- `tool({ parameters: ... })` → must use `inputSchema` instead of `parameters`
- `maxSteps` option doesn't exist in v6 — multi-step tool calling handled differently
- Zod v4 is required (v3 won't work with v6 tool schemas)

### 2. Moonshot API Budget
The API key has **exceeded its consumption budget**. Error:
> "Your project org-2f7dec57... has exceeded the consumption budget"

**Fix**: Top up at console.moonshot.ai, or swap to a different provider (one-line change in `agent.ts` since we use AI SDK v6).

### 3. Inline vs Wrapper Tools
Initially created tools using the `tool()` wrapper in separate files. AI SDK v6's type system had issues with this approach. Moved tools inline into `agent.ts` using closures to collect sources — simpler and avoids type conflicts.

---

## How the New Agent Works

```typescript
// agent.ts — simplified
const result = await generateText({
  model: moonshot('kimi-k2.5'),
  system: SYSTEM_PROMPT,           // "Naufarrel" personality
  messages: [...history, userMsg],
  tools: {
    searchDocuments: { ... },      // Searches Supabase full-text
    getDocumentFull: { ... }       // Retrieves complete document
  }
})
```

The LLM sees the tools and decides:
- **"Halo!"** → responds directly, zero tool calls
- **"Apa itu KM ITB?"** → calls `searchDocuments`, cites results with [N]
- **"Jelaskan seluruh isi RUK"** → calls `searchDocuments`, then `getDocumentFull` for the full doc

Sources are collected via closure during tool execution and returned to the frontend.

---

## Citation System

**Before**: Complex `[src:N]` markers parsed with character offsets → mapped to sidebar.  
**After**: LLM naturally uses `[1]`, `[2]` markers. Frontend renders them as blue pill chips. Collapsible source section shows document title, section title, and excerpt.

```
┌─────────────────────────────────────────────┐
│ Pengajuan kegiatan harus dilakukan minimal  │
│ 14 hari sebelum pelaksanaan [1].            │
│                                             │
│ 📄 2 Sumber ▼                              │
│ ┌─────────────────────────────────────────┐ │
│ │ ① AD/ART KM ITB — Pasal 12             │ │
│ │   "Pengajuan kegiatan dilakukan         │ │
│ │    minimal 14 hari..."                  │ │
│ └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

---

## Status

- ✅ All code changes complete
- ✅ Both servers start without errors
- ✅ Agent module loads and wires correctly
- ❌ **Blocked**: Moonshot API budget exceeded — cannot test LLM responses
- ⬜ Old files not yet deleted (listed above)
