# Project Naufarrel

AI Knowledge Retainer untuk KM ITB (Keluarga Mahasiswa Institut Teknologi Bandung).

Chatbot yang menjawab pertanyaan tentang pengetahuan organisasi dengan dukungan kutipan sumber — tersedia melalui Line Bot dan Web Chat.

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **API** | Cloudflare Workers + Hono | Serverless backend, zero cold starts |
| **Frontend** | Vite + React + TanStack Router | SPA chat interface with citation sidebar |
| **Database** | Supabase PostgreSQL | Document storage + full-text search |
| **AI** | Vercel AI SDK + Moonshot Kimi (k2.5) | Model-agnostic LLM integration |
| **Messaging** | Line Messaging API | Line Bot channel |
| **Shared** | `@naufarrel/shared` TypeScript package | API ↔ Frontend type contract |

## Architecture

### System Flow

```
┌──────────────┐     ┌──────────────┐
│   Line Bot   │     │   Web Chat   │
│  (webhook)   │     │  (REST API)  │
└──────┬───────┘     └──────┬───────┘
       │                    │
       ▼                    ▼
┌──────────────────────────────────────┐
│        Cloudflare Worker (Hono)      │
│  ┌─────────┐  ┌────────┐  ┌──────┐  │
│  │  CORS   │  │  Rate  │  │ Auth │  │
│  │ (api/*) │  │ Limiter│  │(Line)│  │
│  └─────────┘  └────────┘  └──────┘  │
├──────────────────────────────────────┤
│          Platform Adapters           │
│  lineAdapter.parseIncoming()         │
│  webAdapter.parseIncoming()          │
├──────────────────────────────────────┤
│      Deterministic Orchestrator      │
│  isGreeting(text) → regex patterns   │
│    ├── YES → Static greeting         │
│    └── NO  → Knowledge handler       │
├──────────────────────────────────────┤
│         Knowledge Handler            │
│  1. searchSections() → Supabase RPC  │
│  2. buildKnowledgePrompt() + history │
│  3. generateText() → Moonshot Kimi   │
│  4. parseCitations() → [src:N] → [N] │
│  5. Return ChatResponse              │
├──────────────────────────────────────┤
│          Platform Adapters           │
│  lineAdapter.formatResponse()        │
│  webAdapter.formatResponse()         │
└──────────────────────────────────────┘
```

### Orchestrator (Current: Deterministic)

The orchestrator (`ai/router.ts`) uses **regex-based pattern matching** — NOT an LLM router.

```
Input → Regex check:
  ├─ Matches GREETING_PATTERNS (halo, hai, hello, etc.) → static response (no LLM call)
  └─ Everything else → knowledge handler:
       ├─ DB search finds results → LLM generates answer with citations
       └─ DB search finds nothing → hardcoded fallback message (LLM NOT called)
```

**Trade-off**: Fast and cheap (no LLM call for greetings), but can't handle conversational messages, meta-questions, or queries that don't match database keywords.

### Knowledge Pipeline (RAG)

1. **Search** — PostgreSQL full-text search via Supabase RPC (`search_sections`)
2. **Prompt** — Build prompt with numbered sources + conversation history (last 6 messages)
3. **Generate** — Call Moonshot Kimi via Vercel AI SDK (`generateText`)
4. **Parse** — Extract `[src:N]` citation markers → compute offsets in cleaned text
5. **Respond** — Return structured `ChatResponse` with answer, citations, sources

### Citation System

The `ChatResponse` type is the API ↔ Frontend contract:

```typescript
interface ChatResponse {
  answer: string          // cleaned text with [1], [2] display markers
  citations: Citation[]   // character offsets for each marker
  sources: Source[]       // document sections that were cited
  hasCitations: boolean   // false = fallback mode
}
```

- `hasCitations: true` → Frontend renders inline citation chips `[1]` `[2]` + source sidebar
- `hasCitations: false` → Fallback: sources listed below the answer as plain text

### Security

- **CORS**: Scoped to `/api/*` only, configurable via `ALLOWED_ORIGIN` env var
- **Line Webhook**: HMAC-SHA256 signature verification with constant-time comparison (`crypto.subtle.verify`)
- **Rate Limiting**: 20 requests/minute per IP on `/api/*` (in-memory, per Worker isolate)
- **Input Validation**: 2000-character max on both chat and webhook endpoints

### Conversation History

- Stored in Supabase `conversations` table as a JSONB `messages` array
- Single atomic update per request (no race condition)
- Capped at 50 messages per conversation (oldest trimmed)
- Web sessions persisted via `localStorage` session ID
- Last 6 messages (3 exchanges) included in LLM prompt for context

## Project Structure

```
nau-ai/
├── package.json                        # workspace root
├── .env.example
├── apps/
│   ├── api/                            # Cloudflare Worker API
│   │   ├── wrangler.jsonc              # Worker config (dev port: 8787)
│   │   └── src/
│   │       ├── index.ts                # Hono app + CORS + rate limiter
│   │       ├── routes/
│   │       │   ├── chat.ts             # POST /api/chat (web)
│   │       │   └── webhook.ts          # POST /webhook/line
│   │       ├── ai/
│   │       │   ├── router.ts           # Deterministic orchestrator
│   │       │   ├── citation-parser.ts  # [src:N] → [N] with offset tracking
│   │       │   ├── handlers/
│   │       │   │   ├── greeting.ts     # Static responses (no LLM)
│   │       │   │   └── knowledge.ts    # RAG: search → prompt → LLM → citations
│   │       │   └── prompts/
│   │       │       ├── knowledge.ts    # Prompt builder with sources + history
│   │       │       └── greeting.ts     # (unused — greeting is now static)
│   │       ├── platforms/
│   │       │   ├── types.ts            # PlatformMessage, PlatformAdapter
│   │       │   ├── line.ts             # Line message parsing + formatting
│   │       │   └── web.ts              # Web request parsing
│   │       ├── db/
│   │       │   ├── schema.ts           # TypeScript types for DB tables
│   │       │   ├── queries.ts          # searchSections, getOrCreateConversation
│   │       │   └── migrations/         # SQL files for Supabase
│   │       └── lib/
│   │           ├── supabase.ts         # Supabase client factory
│   │           ├── line-verify.ts      # HMAC-SHA256 signature verification
│   │           └── rate-limiter.ts     # Per-IP rate limiting middleware
│   └── web/                            # Vite + React SPA
│       ├── vite.config.ts
│       ├── index.html
│       └── src/
│           ├── main.tsx                # Router setup + entry point
│           ├── pages/
│           │   └── ChatPage.tsx        # Main chat page + sidebar state
│           ├── components/
│           │   ├── ChatArea.tsx        # Message list + input + send logic
│           │   ├── MessageBubble.tsx   # User/assistant bubbles + citation chips
│           │   ├── CitationMarker.tsx  # Clickable [N] chip
│           │   ├── SourceSidebar.tsx   # Right panel with source cards
│           │   └── SourceCard.tsx      # Individual source document card
│           ├── lib/
│           │   └── api.ts             # sendMessage() fetch wrapper
│           └── styles.css             # Tailwind CSS entry
└── packages/
    └── shared/
        └── types.ts                   # ChatResponse, Citation, Source, ChatRequest
```

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
# API — create .dev.vars for local dev
cp .env.example apps/api/.dev.vars
# Fill in: MOONSHOT_API_KEY, SUPABASE_URL, SUPABASE_ANON_KEY, LINE_CHANNEL_SECRET, LINE_CHANNEL_ACCESS_TOKEN

# Web — create .env
echo "VITE_API_URL=http://localhost:8787" > apps/web/.env
```

### 3. Set up Supabase

Run in Supabase SQL Editor (in order):

1. `apps/api/src/db/migrations/001_initial.sql`
2. `apps/api/src/db/migrations/002_seed.sql`
3. `apps/api/src/db/migrations/003_search_function.sql`

### 4. Run locally

```bash
npm run dev:api   # API on http://localhost:8787
npm run dev:web   # Web on http://localhost:5173
```

## Deploy

### API (Cloudflare Workers)

```bash
cd apps/api
npx wrangler secret put MOONSHOT_API_KEY
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_ANON_KEY
npx wrangler secret put LINE_CHANNEL_SECRET
npx wrangler secret put LINE_CHANNEL_ACCESS_TOKEN
npx wrangler secret put ALLOWED_ORIGIN    # your frontend URL
npx wrangler deploy
```

### Web (Cloudflare Pages / Vercel)

```bash
cd apps/web
VITE_API_URL=https://your-worker.workers.dev npm run build
# Deploy dist/ folder
```

### Line Bot

Set webhook URL in Line Developer Console:
`https://your-worker.workers.dev/webhook/line`

## Known Limitations

- **Keyword search only** — PostgreSQL full-text search, not semantic/vector search. Queries must contain words that appear in documents.
- **Deterministic orchestrator** — regex-based routing, not LLM-powered intent detection. Can't handle conversational or meta-questions.
- **No tests** — zero automated test coverage.
- **Seed data is mock** — 10 fabricated KM ITB document sections, not real content.
- **No error monitoring** — console.error only, no Sentry/Logflare.
