# Project Naufarrel — MVP Execution Plan

## Overview

**Project**: Project Naufarrel — AI Knowledge Retainer for KM ITB
**Goal**: Working Line Bot + Web Chat interface with citation support, deployed and usable
**Stack**: Cloudflare Workers + Hono (API) · TanStack Start (Web) · Supabase (DB) · AI SDK (Vercel) + Gemini Flash
**Structure**: Monorepo with npm/pnpm workspaces (NOT Turborepo)
**Language**: TypeScript end-to-end

### Key Decisions (locked)
- DB: Supabase client directly — NO Drizzle ORM
- AI: `ai` package (Vercel AI SDK) + `@ai-sdk/google` for Gemini Flash — package name is `ai`, not `ai-sdk-v6`
- Orchestrator: deterministic if/else TypeScript — NOT an LLM call
- All AI responses: Bahasa Indonesia (set in system prompt)
- Citation fallback: `hasCitations=false` → attach all retrieved sources as plain list
- Frontend API calls: plain `fetch()` with `import.meta.env.VITE_API_URL` — no createServerFn
- TanStack Start file structure: `src/routes/` (NOT `app/routes/`)
- Do NOT build: admin portal, multi-org auth, doc upload pipeline, vector embeddings, RAG

### Table of Contents
1. [Step 1 — Monorepo Scaffolding](#step-1--monorepo-scaffolding)
2. [Step 2 — Line Webhook](#step-2--line-webhook)
3. [Step 3 — Supabase + Database](#step-3--supabase--database)
4. [Step 4 — AI Integration + Citations](#step-4--ai-integration--citations)
5. [Step 5 — Web Chat Interface](#step-5--web-chat-interface)
6. [Step 6 — Conversation History + Polish](#step-6--conversation-history--polish)
7. [Final Verification](#final-verification)

---
## Step 1 — Monorepo Scaffolding

**Goal**: Runnable skeleton — `wrangler dev` serves hello world, `npm run dev` in web shows a page.

---

### TASK 1.1 — Create workspace root

**File**: `package.json` (workspace root)
```json
{
  "name": "project-naufarrel",
  "private": true,
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "dev:api": "npm run dev --workspace=apps/api",
    "dev:web": "npm run dev --workspace=apps/web",
    "build:api": "npm run build --workspace=apps/api",
    "build:web": "npm run build --workspace=apps/web"
  }
}
```

**File**: `.env.example`
```
# Line Bot
LINE_CHANNEL_SECRET=
LINE_CHANNEL_ACCESS_TOKEN=

# Supabase
SUPABASE_URL=
SUPABASE_ANON_KEY=

# AI
GOOGLE_GENERATIVE_AI_API_KEY=

# Frontend (Vite prefix required)
VITE_API_URL=
```

**File**: `.gitignore`
```
node_modules/
dist/
.wrangler/
.dev.vars
.env
*.env.local
```

**QA**: `ls` shows `apps/`, `packages/`, `package.json`, `.env.example`, `.gitignore`

---

### TASK 1.2 — Create `packages/shared`

**File**: `packages/shared/package.json`
```json
{
  "name": "@naufarrel/shared",
  "version": "0.0.1",
  "main": "./types.ts",
  "types": "./types.ts"
}
```

**File**: `packages/shared/types.ts`
```typescript
// Contract between API and Web frontend — never break this shape

export interface Citation {
  sourceIndex: number;   // index into sources[]
  startOffset: number;   // char position in answer where citation marker starts
  endOffset: number;     // char position where citation marker ends
  marker: string;        // display text e.g. "[1]"
}

export interface Source {
  sectionId: string;
  documentTitle: string;
  sectionTitle: string;
  docType: string;
  content: string;
  relevanceScore?: number;
}

export interface ChatResponse {
  answer: string;
  citations: Citation[];
  sources: Source[];
  hasCitations: boolean; // false = fallback mode, show sources list below answer
}

export interface ChatRequest {
  message: string;
  conversationId?: string;
  userId?: string;
}

export interface PlatformMessage {
  userId: string;
  text: string;
  platform: 'line' | 'web';
  replyToken?: string; // Line only
}

export interface PlatformAdapter {
  parseIncoming(raw: unknown): PlatformMessage;
  formatResponse(response: ChatResponse): unknown;
}
```

**QA**: `cat packages/shared/types.ts` — all 7 interfaces present. No compile errors when `tsc --noEmit` is run later.

---

### TASK 1.3 — Scaffold `apps/api` (Cloudflare Worker + Hono)

**Commands**:
```bash
mkdir -p apps/api/src/routes apps/api/src/ai/handlers apps/api/src/ai/prompts
mkdir -p apps/api/src/platforms apps/api/src/db apps/api/src/lib
```

**File**: `apps/api/package.json`
```json
{
  "name": "@naufarrel/api",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "build": "tsc"
  },
  "dependencies": {
    "hono": "^4.0.0",
    "@hono/zod-validator": "^0.2.0",
    "ai": "^4.0.0",
    "@ai-sdk/google": "^1.0.0",
    "@supabase/supabase-js": "^2.0.0"
  },
  "devDependencies": {
    "wrangler": "^3.0.0",
    "typescript": "^5.0.0",
    "@cloudflare/workers-types": "^4.0.0"
  }
}
```

**File**: `apps/api/wrangler.jsonc`
```jsonc
{
  "name": "naufarrel-api",
  "main": "src/index.ts",
  "compatibility_date": "2024-01-01",
  "compatibility_flags": ["nodejs_compat"],
  "vars": {}
  // Secrets set via: wrangler secret put SECRET_NAME
  // Local: use .dev.vars file
}
```

**File**: `apps/api/.dev.vars` (gitignored — developer creates this)
```
LINE_CHANNEL_SECRET=your_secret_here
LINE_CHANNEL_ACCESS_TOKEN=your_token_here
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=your_anon_key
GOOGLE_GENERATIVE_AI_API_KEY=your_key
```

**File**: `apps/api/tsconfig.json`
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "strict": true,
    "noEmit": true,
    "types": ["@cloudflare/workers-types"]
  },
  "include": ["src/**/*.ts"]
}
```

**File**: `apps/api/src/index.ts` (hello world skeleton)
```typescript
import { Hono } from 'hono'

export interface Env {
  LINE_CHANNEL_SECRET: string
  LINE_CHANNEL_ACCESS_TOKEN: string
  SUPABASE_URL: string
  SUPABASE_ANON_KEY: string
  GOOGLE_GENERATIVE_AI_API_KEY: string
}

const app = new Hono<{ Bindings: Env }>()

app.get('/', (c) => c.json({ status: 'ok', project: 'naufarrel' }))

export default app
```

**QA**: `wrangler dev` from `apps/api/` → `GET /` returns `{"status":"ok","project":"naufarrel"}`. No TypeScript errors.

---

### TASK 1.4 — Scaffold `apps/web` (TanStack Start)

**Commands**:
```bash
# From apps/web — use the TanStack Start Vite template
npm create tsrouter-app@latest . -- --template start-bare
# OR manually scaffold:
mkdir -p apps/web/src/routes apps/web/src/components apps/web/src/lib
```

**File**: `apps/web/package.json`
```json
{
  "name": "@naufarrel/web",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vinxi dev",
    "build": "vinxi build",
    "start": "vinxi start"
  },
  "dependencies": {
    "@tanstack/react-router": "^1.0.0",
    "@tanstack/start": "^1.0.0",
    "react": "^18.0.0",
    "react-dom": "^18.0.0",
    "@naufarrel/shared": "*"
  },
  "devDependencies": {
    "vite": "^5.0.0",
    "typescript": "^5.0.0",
    "@types/react": "^18.0.0",
    "@types/react-dom": "^18.0.0",
    "tailwindcss": "^3.0.0",
    "autoprefixer": "^10.0.0",
    "postcss": "^8.0.0"
  }
}
```

**File**: `apps/web/app.config.ts`
```typescript
import { defineConfig } from '@tanstack/start/config'

export default defineConfig({
  vite: {
    plugins: []
  }
})
```

**File**: `apps/web/tsconfig.json`
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "paths": {
      "@naufarrel/shared": ["../../packages/shared/types.ts"]
    }
  },
  "include": ["src/**/*.ts", "src/**/*.tsx", "app.config.ts"]
}
```

**File**: `apps/web/src/routes/__root.tsx`
```tsx
import { createRootRoute, Outlet } from '@tanstack/react-router'

export const Route = createRootRoute({
  component: () => (
    <html lang="id">
      <head>
        <meta charSet="utf-8" />
        <title>Naufarrel — KM ITB Knowledge Bot</title>
      </head>
      <body>
        <Outlet />
      </body>
    </html>
  )
})
```

**File**: `apps/web/src/routes/index.tsx` (placeholder for Step 5)
```tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: () => <div className="p-8 text-xl">Naufarrel — coming soon</div>
})
```

**File**: `apps/web/src/router.tsx`
```tsx
import { createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
```

**QA**: `npm run dev` from `apps/web/` → page loads in browser showing "Naufarrel — coming soon". No TypeScript errors.

---
## Step 2 — Line Webhook

**Goal**: Line Bot echoes user messages. Signature verification passes. Deployed and tested with real Line messages.

---

### TASK 2.1 — Platform types

**File**: `apps/api/src/platforms/types.ts`
```typescript
import type { ChatResponse } from '@naufarrel/shared'

export interface PlatformMessage {
  userId: string
  text: string
  platform: 'line' | 'web'
  replyToken?: string // Line only — expires in 30 seconds
}

export interface PlatformAdapter {
  parseIncoming(raw: unknown): PlatformMessage
  formatResponse(response: ChatResponse): unknown
}
```

**QA**: No TypeScript errors. Import from shared resolves correctly.

---

### TASK 2.2 — Line platform adapter

**File**: `apps/api/src/platforms/line.ts`
```typescript
import type { PlatformMessage, PlatformAdapter } from './types'
import type { ChatResponse } from '@naufarrel/shared'

// Line webhook event shape (simplified — only handling text messages)
interface LineTextEvent {
  type: 'message'
  message: { type: 'text'; text: string }
  source: { userId: string }
  replyToken: string
}

interface LineWebhookBody {
  events: LineTextEvent[]
}

export const lineAdapter: PlatformAdapter = {
  parseIncoming(raw: unknown): PlatformMessage {
    const body = raw as LineWebhookBody
    const event = body.events[0]
    if (!event || event.type !== 'message' || event.message.type !== 'text') {
      throw new Error('Unsupported Line event type')
    }
    return {
      userId: event.source.userId,
      text: event.message.text,
      platform: 'line',
      replyToken: event.replyToken
    }
  },

  formatResponse(response: ChatResponse): object {
    // Format citations as appended source list
    let text = response.answer

    if (response.sources.length > 0) {
      text += '\n\n📄 Sumber:'
      response.sources.forEach((src, i) => {
        text += `\n[${i + 1}] ${src.documentTitle} — ${src.sectionTitle}`
      })
    }

    return {
      type: 'text',
      text
    }
  }
}
```

**QA**: Handles text message events. Non-text events throw (caught at route level). Source list formatted correctly.

---

### TASK 2.3 — Webhook signature verification utility

**File**: `apps/api/src/lib/line-verify.ts`
```typescript
// Verify X-Line-Signature header using HMAC-SHA256
// Cloudflare Workers Web Crypto API — no Node.js crypto module needed

export async function verifyLineSignature(
  body: string,
  signature: string,
  channelSecret: string
): Promise<boolean> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(channelSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const mac = await crypto.subtle.sign('HMAC', key, encoder.encode(body))
  const digest = btoa(String.fromCharCode(...new Uint8Array(mac)))
  return digest === signature
}
```

**QA**: Pure Web Crypto — works in Cloudflare Workers. Returns `true` for correct signature, `false` otherwise.

---

### TASK 2.4 — Line webhook route

**File**: `apps/api/src/routes/webhook.ts`
```typescript
import { Hono } from 'hono'
import type { Env } from '../index'
import { lineAdapter } from '../platforms/line'
import { verifyLineSignature } from '../lib/line-verify'

export const webhookRouter = new Hono<{ Bindings: Env }>()

webhookRouter.post('/line', async (c) => {
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
    return c.json({ ok: true }) // silently ignore
  }

  // 3. Parse incoming message
  const message = lineAdapter.parseIncoming(body)

  // 4. Echo for now (Step 4 will replace with AI response)
  const echoResponse = {
    answer: `Echo: ${message.text}`,
    citations: [],
    sources: [],
    hasCitations: false
  }
  const formatted = lineAdapter.formatResponse(echoResponse) as { type: string; text: string }

  // 5. Reply via Line API
  await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${c.env.LINE_CHANNEL_ACCESS_TOKEN}`
    },
    body: JSON.stringify({
      replyToken: message.replyToken,
      messages: [formatted]
    })
  })

  return c.json({ ok: true })
})
```

**QA**:
- `POST /webhook/line` with wrong signature → 401
- `POST /webhook/line` with correct signature + text event → echoes message back in Line
- Non-message events (follow, postback) → 200 ok, no error

---

### TASK 2.5 — Wire webhook into main Hono app

**File**: `apps/api/src/index.ts` (update)
```typescript
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { webhookRouter } from './routes/webhook'

export interface Env {
  LINE_CHANNEL_SECRET: string
  LINE_CHANNEL_ACCESS_TOKEN: string
  SUPABASE_URL: string
  SUPABASE_ANON_KEY: string
  GOOGLE_GENERATIVE_AI_API_KEY: string
}

const app = new Hono<{ Bindings: Env }>()

app.use('*', cors())

app.get('/', (c) => c.json({ status: 'ok', project: 'naufarrel' }))
app.route('/webhook', webhookRouter)

export default app
```

**QA**: `wrangler dev` → `POST /webhook/line` works. CORS headers present on all responses.

---

### TASK 2.6 — Deploy and test with real Line

**Steps**:
1. Set Line secrets: `wrangler secret put LINE_CHANNEL_SECRET` and `wrangler secret put LINE_CHANNEL_ACCESS_TOKEN`
2. Deploy: `wrangler deploy` from `apps/api/`
3. In Line Developer Console → Messaging API → Webhook URL: `https://naufarrel-api.{account}.workers.dev/webhook/line`
4. Enable webhook, disable auto-reply
5. Send a text message to the bot → bot echoes it back

**QA**: Real Line message received, echoed back within 3 seconds.

---
## Step 3 — Supabase + Database

**Goal**: All tables created, GIN index + trigger set up, search function returns sections with full metadata, seed data works, search is queryable.

---

### TASK 3.1 — Supabase client

**File**: `apps/api/src/lib/supabase.ts`
```typescript
import { createClient } from '@supabase/supabase-js'

// Called once per Worker request — createClient is lightweight
export function getSupabase(env: { SUPABASE_URL: string; SUPABASE_ANON_KEY: string }) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY)
}
```

**QA**: Function exported correctly. No top-level singleton (Workers have no persistent state between requests).

---

### TASK 3.2 — Database migration SQL

**File**: `apps/api/src/db/migrations/001_initial.sql`

```sql
-- Organizations (single row for MVP: KM ITB)
CREATE TABLE IF NOT EXISTS organizations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Documents
CREATE TABLE IF NOT EXISTS documents (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     UUID NOT NULL REFERENCES organizations(id),
  title      TEXT NOT NULL,
  doc_type   TEXT NOT NULL, -- 'constitution', 'procedure', 'guide', 'faq'
  source_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Document sections (the searchable units)
CREATE TABLE IF NOT EXISTS document_sections (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id    UUID NOT NULL REFERENCES documents(id),
  section_title  TEXT,
  content        TEXT NOT NULL,
  section_order  INTEGER NOT NULL,
  search_vector  TSVECTOR,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- GIN index for fast full-text search
CREATE INDEX IF NOT EXISTS idx_document_sections_search
  ON document_sections USING GIN (search_vector);

-- Trigger: auto-update search_vector on insert/update
CREATE OR REPLACE FUNCTION update_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector('indonesian', COALESCE(NEW.content, '') || ' ' || COALESCE(NEW.section_title, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_search_vector ON document_sections;
CREATE TRIGGER trg_update_search_vector
  BEFORE INSERT OR UPDATE ON document_sections
  FOR EACH ROW EXECUTE FUNCTION update_search_vector();

-- Conversations
CREATE TABLE IF NOT EXISTS conversations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_platform_id TEXT NOT NULL,
  platform         TEXT NOT NULL, -- 'line' or 'web'
  messages         JSONB NOT NULL DEFAULT '[]',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Instructions**: Run this SQL in Supabase Dashboard → SQL Editor. Run once.

**QA**: All 4 tables exist. `\d document_sections` shows `search_vector` column and trigger. GIN index visible in `\di`.

---

### TASK 3.3 — Seed data SQL

**File**: `apps/api/src/db/migrations/002_seed.sql`

```sql
-- Insert KM ITB organization
INSERT INTO organizations (id, name, description)
VALUES ('00000000-0000-0000-0000-000000000001', 'KM ITB', 'Keluarga Mahasiswa Institut Teknologi Bandung')
ON CONFLICT DO NOTHING;

-- Insert sample documents
INSERT INTO documents (id, org_id, title, doc_type)
VALUES
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'AD/ART KM ITB 2024', 'constitution'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Panduan Kepanitiaan 2024', 'guide'),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'FAQ Kegiatan Kemahasiswaan', 'faq')
ON CONFLICT DO NOTHING;

-- Insert document sections (search_vector auto-populated by trigger)
INSERT INTO document_sections (document_id, section_title, content, section_order)
VALUES
  ('10000000-0000-0000-0000-000000000001', 'Pasal 1 — Nama dan Kedudukan',
   'KM ITB adalah organisasi kemahasiswaan yang berkedudukan di Institut Teknologi Bandung dan berfungsi sebagai wadah kegiatan mahasiswa.', 1),

  ('10000000-0000-0000-0000-000000000001', 'Pasal 5 — Keanggotaan',
   'Anggota KM ITB adalah seluruh mahasiswa aktif Institut Teknologi Bandung yang terdaftar pada semester berjalan.', 2),

  ('10000000-0000-0000-0000-000000000001', 'Pasal 12 — Prosedur Pengajuan Kegiatan',
   'Pengajuan kegiatan dilakukan minimal 14 hari sebelum pelaksanaan. Proposal harus mencantumkan tujuan, anggaran, dan penanggung jawab kegiatan.', 3),

  ('10000000-0000-0000-0000-000000000002', 'Bab 1 — Pendahuluan',
   'Panduan kepanitiaan ini bertujuan memberikan acuan bagi panitia penyelenggara kegiatan mahasiswa di lingkungan KM ITB.', 1),

  ('10000000-0000-0000-0000-000000000002', 'Bab 3 — Timeline Kegiatan',
   'Timeline kegiatan harus disusun H-30 sebelum acara. Rapat koordinasi wajib dilakukan minimal dua kali sebelum pelaksanaan.', 2),

  ('10000000-0000-0000-0000-000000000002', 'Bab 4 — Anggaran dan Sponsorship',
   'Anggaran kegiatan harus disetujui oleh Bendahara KM ITB. Sponsorship eksternal harus melewati seleksi dan persetujuan dari Presiden KM ITB.', 3),

  ('10000000-0000-0000-0000-000000000003', 'FAQ — Cara Mendaftar Kepanitiaan',
   'Untuk mendaftar kepanitiaan, mahasiswa dapat mengisi formulir open recruitment yang dibuka oleh masing-masing badan otonom atau unit kegiatan mahasiswa.', 1),

  ('10000000-0000-0000-0000-000000000003', 'FAQ — Apa itu Kabinet KM ITB',
   'Kabinet KM ITB adalah kelompok kerja yang dipimpin oleh Presiden KM ITB. Kabinet bertugas menjalankan program kerja sesuai visi-misi yang telah ditetapkan.', 2),

  ('10000000-0000-0000-0000-000000000003', 'FAQ — Prosedur Peminjaman Ruangan',
   'Peminjaman ruangan dilakukan melalui sistem online di portal akademik ITB. Permohonan harus diajukan minimal 3 hari kerja sebelum penggunaan.', 3),

  ('10000000-0000-0000-0000-000000000003', 'FAQ — Beasiswa dan Bantuan Dana',
   'KM ITB mengelola program beasiswa melalui Dana Kesejahteraan Mahasiswa. Pendaftaran dibuka setiap semester melalui website resmi KM ITB.', 4);
```

**Instructions**: Run this SQL in Supabase Dashboard → SQL Editor after running 001_initial.sql.

**QA**: `SELECT COUNT(*) FROM document_sections` → 10 rows. `SELECT search_vector IS NOT NULL FROM document_sections LIMIT 1` → true.

---

### TASK 3.4 — Database schema types

**File**: `apps/api/src/db/schema.ts`
```typescript
// TypeScript types matching the database schema
// Used for query return type annotations

export interface Organization {
  id: string
  name: string
  description: string | null
  created_at: string
}

export interface Document {
  id: string
  org_id: string
  title: string
  doc_type: string
  source_url: string | null
  created_at: string
}

export interface DocumentSection {
  id: string
  document_id: string
  section_title: string | null
  content: string
  section_order: number
  created_at: string
}

export interface Conversation {
  id: string
  user_platform_id: string
  platform: 'line' | 'web'
  messages: ConversationMessage[]
  created_at: string
  updated_at: string
}

export interface ConversationMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  sources?: string[] // section IDs used
}
```

**QA**: Interfaces match migration SQL column names exactly.

---

### TASK 3.5 — Database query functions

**File**: `apps/api/src/db/queries.ts`
```typescript
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Source } from '@naufarrel/shared'

// Search document sections via full-text search
// Returns sections with parent document metadata — feeds directly into citations
export async function searchSections(
  supabase: SupabaseClient,
  query: string,
  limit = 5
): Promise<Source[]> {
  const { data, error } = await supabase.rpc('search_sections', {
    query_text: query,
    result_limit: limit
  })

  if (error) throw new Error(`Search failed: ${error.message}`)

  return (data ?? []).map((row: {
    section_id: string
    document_title: string
    section_title: string
  
## Step 4 — AI Integration + Citations

**Goal**: Knowledge handler retrieves sections, prompts LLM, parses citations, returns structured ChatResponse. Greeting handler handles simple messages. Orchestrator routes correctly. Line bot gives real AI answers with source list.

---

### TASK 4.1 — System prompts

**File**: `apps/api/src/ai/prompts/knowledge.ts`
```typescript
export function buildKnowledgePrompt(sources: Array<{ sectionTitle: string; documentTitle: string; content: string }>, userQuestion: string): string {
  const sourcesBlock = sources
    .map((s, i) => `[${i + 1}] ${s.documentTitle} — ${s.sectionTitle}\n${s.content}`)
    .join('\n\n')

  return `Kamu adalah asisten pengetahuan untuk KM ITB (Keluarga Mahasiswa Institut Teknologi Bandung).
Jawab pertanyaan mahasiswa berdasarkan sumber-sumber berikut.
Gunakan bahasa Indonesia yang ramah dan jelas.

PENTING: Sertakan kutipan inline menggunakan format [src:N] di mana N adalah nomor sumber.
Contoh: "Pengajuan kegiatan harus dilakukan minimal 14 hari sebelumnya [src:1]."
Hanya kutip sumber yang benar-benar relevan dengan jawabanmu.

SUMBER-SUMBER:
${sourcesBlock}

PERTANYAAN PENGGUNA:
${userQuestion}

Jawab berdasarkan sumber di atas. Jika tidak ada informasi yang relevan, sampaikan dengan jujur.`
}
```

**File**: `apps/api/src/ai/prompts/greeting.ts`
```typescript
export const GREETING_SYSTEM_PROMPT = `Kamu adalah asisten ramah untuk KM ITB.
Balas sapaan dengan hangat dan singkat dalam bahasa Indonesia.
Perkenalkan dirimu sebagai asisten pengetahuan KM ITB yang siap membantu menjawab pertanyaan tentang organisasi.`
```

**QA**: Prompts contain citation instruction `[src:N]`. Language is Indonesian.

---

### TASK 4.2 — Citation parser

**File**: `apps/api/src/ai/citation-parser.ts`
```typescript
import type { Citation, Source } from '@naufarrel/shared'

interface ParseResult {
  answer: string           // cleaned text with [1], [2] markers
  citations: Citation[]
  hasCitations: boolean
}

// Convert [src:N] markers from LLM into [N] display markers + Citation objects
export function parseCitations(rawAnswer: string, sources: Source[]): ParseResult {
  const citations: Citation[] = []
  let cleanedAnswer = rawAnswer

  // Match all [src:N] markers
  const markerRegex = /\[src:(\d+)\]/g
  let match: RegExpExecArray | null

  // First pass: collect all matches
  const matches: Array<{ full: string; index: number; sourceNum: number }> = []
  while ((match = markerRegex.exec(rawAnswer)) !== null) {
    matches.push({ full: match[0], index: match.index, sourceNum: parseInt(match[1], 10) })
  }

  // Validate all source references are in range
  const allValid = matches.every(m => m.sourceNum >= 1 && m.sourceNum <= sources.length)
  if (matches.length === 0 || !allValid) {
    return { answer: rawAnswer, citations: [], hasCitations: false }
  }

  // Second pass: build citations and replace [src:N] with [N] display markers
  // Work backwards to preserve offsets
  let offset = 0
  cleanedAnswer = rawAnswer.replace(/\[src:(\d+)\]/g, (full, numStr) => {
    const sourceNum = parseInt(numStr, 10)
    const displayMarker = `[${sourceNum}]`
    const startOffset = rawAnswer.indexOf(full, offset)
    citations.push({
      sourceIndex: sourceNum - 1, // 0-based
      startOffset,
      endOffset: startOffset + displayMarker.length,
      marker: displayMarker
    })
    offset = startOffset + full.length
    return displayMarker
  })

  return { answer: cleanedAnswer, citations, hasCitations: true }
}
```

**QA**:
- `parseCitations("Prosedur [src:1] berlaku.", sources)` → `hasCitations: true`, citations has 1 entry, answer is `"Prosedur [1] berlaku."`
- `parseCitations("Tidak ada kutipan.", sources)` → `hasCitations: false`
- `parseCitations("Sumber [src:99] tidak valid.", sources)` → `hasCitations: false` (fallback)

---

### TASK 4.3 — Greeting handler

**File**: `apps/api/src/ai/handlers/greeting.ts`
```typescript
import { generateText } from 'ai'
import { google } from '@ai-sdk/google'
import type { ChatResponse } from '@naufarrel/shared'
import { GREETING_SYSTEM_PROMPT } from '../prompts/greeting'

export async function handleGreeting(
  userText: string,
  apiKey: string
): Promise<ChatResponse> {
  const { text } = await generateText({
    model: google('gemini-1.5-flash', { apiKey }),
    system: GREETING_SYSTEM_PROMPT,
    prompt: userText
  })

  return {
    answer: text,
    citations: [],
    sources: [],
    hasCitations: false
  }
}
```

**QA**: Returns ChatResponse with empty citations/sources. Uses Gemini Flash. No retrieval.

---

### TASK 4.4 — Knowledge handler

**File**: `apps/api/src/ai/handlers/knowledge.ts`
```typescript
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
  apiKey: string
): Promise<ChatResponse> {
  // 1. Retrieve relevant sections
  const sources: Source[] = await searchSections(supabase, userText, 5)

  if (sources.length === 0) {
    return {
      answer: 'Maaf, saya tidak menemukan informasi yang relevan dengan pertanyaan Anda di database KM ITB.',
      citations: [],
      sources: [],
      hasCitations: false
    }
  }

  // 2. Build prompt with numbered sources
  const prompt = buildKnowledgePrompt(sources, userText)

  // 3. Call LLM
  const { text: rawAnswer } = await generateText({
    model: google('gemini-1.5-flash', { apiKey }),
    prompt
  })

  // 4. Parse citation markers from LLM response
  const { answer, citations, hasCitations } = parseCitations(rawAnswer, sources)

  // 5. Return structured ChatResponse
  // If hasCitations=false (fallback): frontend/Line adapter shows sources as list
  return {
    answer,
    citations,
    sources,
    hasCitations
  }
}
```

**QA**:
- Happy path: returns answer with citations and sources
- No search results: returns polite "tidak ditemukan" message with `hasCitations: false`
- LLM doesn't cite: `hasCitations: false`, sources still included for fallback display

---

### TASK 4.5 — Orchestrator

**File**: `apps/api/src/ai/router.ts`
```typescript
import type { ChatResponse } from '@naufarrel/shared'
import type { SupabaseClient } from '@supabase/supabase-js'
import { handleGreeting } from './handlers/greeting'
import { handleKnowledge } from './handlers/knowledge'

// Greeting patterns — short messages, common salutations
// This is deterministic TypeScript logic — NOT an LLM call
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
  googleApiKey: string
): Promise<ChatResponse> {
  if (isGreeting(userText)) {
    return handleGreeting(userText, googleApiKey)
  }
  return handleKnowledge(userText, supabase, googleApiKey)
}
```

**QA**:
- "Halo!" → greeting handler (no DB query)
- "Bagaimana prosedur pengajuan kegiatan?" → knowledge handler
- "ok" → greeting handler
- "Apa itu KM ITB" → knowledge handler (question, not a short greeting)

---

### TASK 4.6 — Chat API endpoint

**File**: `apps/api/src/routes/chat.ts`
```typescript
import { Hono } from 'hono'
import type { Env } from '../index'
import { getSupabase } from '../lib/supabase'
import { routeMessage } from '../ai/router'
import type { ChatRequest } from '@naufarrel/shared'

export const chatRouter = new Hono<{ Bindings: Env }>()

chatRouter.post('/', async (c) => {
  const body = await
## Step 5 — Web Chat Interface

**Goal**: TanStack Start frontend with chat area, citation chips, source sidebar. Calls Worker /api/chat. Handles both citation modes.

---

### TASK 5.1 — API client

**File**: `apps/web/src/lib/api.ts`
```typescript
import type { ChatRequest, ChatResponse } from '@naufarrel/shared'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8787'

export async function sendMessage(request: ChatRequest): Promise<ChatResponse> {
  const res = await fetch(`${API_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request)
  })
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json()
}
```

**QA**: Uses `import.meta.env.VITE_API_URL`. Falls back to localhost:8787 for dev. No TanStack server functions needed.

---

### TASK 5.2 — CitationMarker component

**File**: `apps/web/src/components/CitationMarker.tsx`
```tsx
interface CitationMarkerProps {
  number: number
  onClick: (index: number) => void
  active: boolean
}

export function CitationMarker({ number, onClick, active }: CitationMarkerProps) {
  return (
    <button
      onClick={() => onClick(number - 1)}
      className={`inline-flex items-center justify-center w-5 h-5 text-xs rounded-full mx-0.5 font-semibold transition-colors ${
        active
          ? 'bg-blue-600 text-white'
          : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
      }`}
      aria-label={`Lihat sumber ${number}`}
    >
      {number}
    </button>
  )
}
```

**QA**: Renders as small round chip. Active state = blue filled. Calls onClick with 0-based index.

---

### TASK 5.3 — MessageBubble component

**File**: `apps/web/src/components/MessageBubble.tsx`
```tsx
import type { ChatResponse } from '@naufarrel/shared'
import { CitationMarker } from './CitationMarker'

interface MessageBubbleProps {
  role: 'user' | 'assistant'
  content: string
  chatResponse?: ChatResponse  // only for assistant messages
  activeCitation: number | null
  onCitationClick: (index: number) => void
}

export function MessageBubble({ role, content, chatResponse, activeCitation, onCitationClick }: MessageBubbleProps) {
  if (role === 'user') {
    return (
      <div className="flex justify-end mb-3">
        <div className="bg-blue-600 text-white rounded-2xl rounded-br-sm px-4 py-2 max-w-xs lg:max-w-md">
          {content}
        </div>
      </div>
    )
  }

  // Render assistant message with inline citation chips
  const renderWithCitations = () => {
    if (!chatResponse?.hasCitations || !chatResponse.citations.length) {
      return <p className="whitespace-pre-wrap">{content}</p>
    }

    // Split answer text by citation markers [1], [2], etc.
    const parts: React.ReactNode[] = []
    let lastIndex = 0
    const markerRegex = /\[(\d+)\]/g
    let match: RegExpExecArray | null

    while ((match = markerRegex.exec(content)) !== null) {
      // Text before marker
      if (match.index > lastIndex) {
        parts.push(content.slice(lastIndex, match.index))
      }
      const num = parseInt(match[1], 10)
      parts.push(
        <CitationMarker
          key={match.index}
          number={num}
          onClick={onCitationClick}
          active={activeCitation === num - 1}
        />
      )
      lastIndex = match.index + match[0].length
    }
    if (lastIndex < content.length) {
      parts.push(content.slice(lastIndex))
    }

    return <p className="whitespace-pre-wrap leading-relaxed">{parts}</p>
  }

  return (
    <div className="flex justify-start mb-3">
      <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-4 py-2 max-w-xs lg:max-w-md">
        {renderWithCitations()}
        {/* Fallback: show sources list below answer if hasCitations=false */}
        {chatResponse && !chatResponse.hasCitations && chatResponse.sources.length > 0 && (
          <div className="mt-2 pt-2 border-t border-gray-200 text-sm text-gray-600">
            <p className="font-semibold mb-1">Sumber:</p>
            {chatResponse.sources.map((src, i) => (
              <p key={src.sectionId} className="text-xs">
                [{i + 1}] {src.documentTitle} — {src.sectionTitle}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
```

**QA**: User bubble right-aligned blue. Assistant bubble left-aligned gray. Citation chips render inline. Fallback source list shows when `hasCitations=false`.

---

### TASK 5.4 — SourceCard component

**File**: `apps/web/src/components/SourceCard.tsx`
```tsx
import type { Source } from '@naufarrel/shared'

interface SourceCardProps {
  source: Source
  index: number
  isActive: boolean
}

export function SourceCard({ source, index, isActive }: SourceCardProps) {
  return (
    <div
      className={`p-3 rounded-lg border mb-2 transition-colors ${
        isActive ? 'border-blue-400 bg-blue-50' : 'border-gray-200 bg-white'
      }`}
    >
      <div className="flex items-start gap-2">
        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-semibold">
          {index + 1}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-blue-700 truncate">{source.documentTitle}</p>
          <p className="text-xs text-gray-500 mb-1">{source.sectionTitle}</p>
          <p className="text-xs text-gray-700 line-clamp-4">{source.content}</p>
        </div>
      </div>
    </div>
  )
}
```

**QA**: Active card has blue border. Index chip matches citation number. Content truncated to 4 lines.

---

### TASK 5.5 — SourceSidebar component

**File**: `apps/web/src/components/SourceSidebar.tsx`
```tsx
import type { Source } from '@naufarrel/shared'
import { SourceCard } from './SourceCard'
import { useEffect, useRef } from 'react'

interface SourceSidebarProps {
  sources: Source[]
  activeCitation: number | null
  onClose: () => void
}

export function SourceSidebar({ sources, activeCitation, onClose }: SourceSidebarProps) {
  const cardRefs = useRef<(HTMLDivElement | null)[]>([])

  // Auto-scroll to active citation
  useEffect(() => {
    if (activeCitation !== null && cardRefs.current[activeCitation]) {
      cardRefs.current[activeCitation]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [activeCitation])

  if (sources.length === 0) return null

  return (
    <div className="w-80 flex-shrink-0 bg-white border-l border-gray-200 flex flex-col h-full">
      <div className="flex items-center justify-between p-3 border-b border-gray-200">
        <h2 className="text-sm font-semibold text-gray-700">Sumber Dokumen</h2>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">
          ×
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        {sources.map((src, i) => (
          <div key={src.sectionId} ref={el => { cardRefs.current[i] = el }}>
            <SourceCard source={src} index={i} isActive={activeCitation === i} />
          </div>
        ))}
      </div>
    </div>
  )
}
```

**QA**: Sidebar scrolls to active citation card. Close button hides sidebar. Only renders when sources.length > 0.

---

### TASK 5.6 — ChatArea component

**File**: `apps/web/src/components/ChatArea.tsx`
```tsx
import { useState, useRef, useEffect } from 'react'
import type { ChatResponse } from '@naufarrel/shared'
import { sendMessage } from '../lib/api'
import { MessageBubble } from './MessageBubble'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  chatResponse?: ChatResponse
}

interface ChatAreaProps {
  onSourcesChange: (sources: ChatResponse['sources']) => void
  activeCitation: number | null
  onCitationClick: (index: number) => void
}

export function ChatArea({ onSourcesChange, activeCitation, onCitationClick }: ChatAreaProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => 
## Step 6 — Conversation History + Polish

**Goal**: Conversations saved to Supabase. Context passed to LLM for follow-ups. Error handling throughout. Loading states. Full end-to-end test on both Line and Web.

---

### TASK 6.1 — Conversation persistence queries

Add to `apps/api/src/db/queries.ts`:
```typescript
import type { Conversation, ConversationMessage } from './schema'

export async function getOrCreateConversation(
  supabase: SupabaseClient,
  userId: string,
  platform: 'line' | 'web'
): Promise<Conversation> {
  // Try to find existing conversation for this user+platform
  const { data: existing } = await supabase
    .from('conversations')
    .select('*')
    .eq('user_platform_id', userId)
    .eq('platform', platform)
    .order('updated_at', { ascending: false })
    .limit(1)
    .single()

  if (existing) return existing as Conversation

  // Create new conversation
  const { data: created, error } = await supabase
    .from('conversations')
    .insert({ user_platform_id: userId, platform, messages: [] })
    .select()
    .single()

  if (error) throw new Error(`Failed to create conversation: ${error.message}`)
  return created as Conversation
}

export async function appendMessage(
  supabase: SupabaseClient,
  conversationId: string,
  message: ConversationMessage,
  currentMessages: ConversationMessage[]
): Promise<void> {
  const updated = [...currentMessages, message]
  const { error } = await supabase
    .from('conversations')
    .update({ messages: updated, updated_at: new Date().toISOString() })
    .eq('id', conversationId)

  if (error) throw new Error(`Failed to append message: ${error.message}`)
}
```

**QA**: `getOrCreateConversation` returns existing or creates new. `appendMessage` appends to the JSONB array. No ORM — raw Supabase client calls.

---

### TASK 6.2 — Pass conversation history to knowledge handler

Update `apps/api/src/ai/prompts/knowledge.ts` — add history parameter:
```typescript
export function buildKnowledgePrompt(
  sources: Array<{ sectionTitle: string; documentTitle: string; content: string }>,
  userQuestion: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }> = []
): string {
  const sourcesBlock = sources
    .map((s, i) => `[${i + 1}] ${s.documentTitle} — ${s.sectionTitle}\n${s.content}`)
    .join('\n\n')

  const historyBlock = history.length > 0
    ? '\nRIWAYAT PERCAKAPAN:\n' + history
        .slice(-6) // last 3 exchanges to keep context manageable
        .map(h => `${h.role === 'user' ? 'Pengguna' : 'Asisten'}: ${h.content}`)
        .join('\n') + '\n'
    : ''

  return `Kamu adalah asisten pengetahuan untuk KM ITB (Keluarga Mahasiswa Institut Teknologi Bandung).
Jawab pertanyaan mahasiswa berdasarkan sumber-sumber berikut.
Gunakan bahasa Indonesia yang ramah dan jelas.

PENTING: Sertakan kutipan inline menggunakan format [src:N] di mana N adalah nomor sumber.
Contoh: "Pengajuan kegiatan harus dilakukan minimal 14 hari sebelumnya [src:1]."
Hanya kutip sumber yang benar-benar relevan dengan jawabanmu.

SUMBER-SUMBER:
${sourcesBlock}
${historyBlock}
PERTANYAAN PENGGUNA:
${userQuestion}

Jawab berdasarkan sumber di atas. Jika tidak ada informasi yang relevan, sampaikan dengan jujur.`
}
```

Update `handleKnowledge` signature to accept `history` param and pass it to `buildKnowledgePrompt`.

**QA**: History of last 6 messages (3 exchanges) included in prompt. Empty history → prompt unchanged.

---

### TASK 6.3 — Wire conversation persistence into chat route

Update `apps/api/src/routes/chat.ts`:
```typescript
import { Hono } from 'hono'
import type { Env } from '../index'
import { getSupabase } from '../lib/supabase'
import { routeMessage } from '../ai/router'
import { getOrCreateConversation, appendMessage } from '../db/queries'
import type { ChatRequest } from '@naufarrel/shared'

export const chatRouter = new Hono<{ Bindings: Env }>()

chatRouter.post('/', async (c) => {
  const body = await c.req.json<ChatRequest>()
  if (!body.message?.trim()) return c.json({ error: 'message is required' }, 400)

  const supabase = getSupabase(c.env)
  const userId = body.userId ?? 'anonymous'

  // Load or create conversation
  const conversation = await getOrCreateConversation(supabase, userId, 'web')
  const history = (conversation.messages ?? []).map(m => ({ role: m.role, content: m.content }))

  // Get AI response (pass history for context)
  const response = await routeMessage(body.message, supabase, c.env.GOOGLE_GENERATIVE_AI_API_KEY, history)

  // Save user message + assistant response
  await appendMessage(supabase, conversation.id, {
    role: 'user', content: body.message, timestamp: new Date().toISOString()
  }, conversation.messages)
  await appendMessage(supabase, conversation.id, {
    role: 'assistant',
    content: response.answer,
    timestamp: new Date().toISOString(),
    sources: response.sources.map(s => s.sectionId)
  }, [...conversation.messages, { role: 'user', content: body.message, timestamp: new Date().toISOString() }])

  return c.json(response)
})
```

Update `routeMessage` signature in `apps/api/src/ai/router.ts` to accept and pass `history` to `handleKnowledge`.

**QA**: After 2 exchanges, `conversations` table has row with `messages` array of 4 items (2 user, 2 assistant).

---

### TASK 6.4 — Error handling — API layer

Wrap the chat route handler in try/catch:
```typescript
chatRouter.post('/', async (c) => {
  try {
    // ... existing logic
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

Wrap the webhook handler similarly — Line requires a 200 response even on errors (otherwise Line retries):
```typescript
webhookRouter.post('/line', async (c) => {
  try {
    // ... existing logic
    return c.json({ ok: true })
  } catch (err) {
    console.error('Webhook error:', err)
    return c.json({ ok: true }) // Always 200 to Line
  }
})
```

**QA**: API returns 500 JSON (not HTML error). Webhook returns 200 even on internal error. LLM timeout → user sees Indonesian error message.

---

### TASK 6.5 — Loading states + UX polish (web)

These are already partially covered in `ChatArea.tsx` (Task 5.6). Verify and add:

1. **Input disabled while loading**: already in Task 5.6 (`disabled={loading}`)
2. **Typing indicator**: already in Task 5.6 (pulse animation "Sedang mencari...")
3. **Error state**: already in Task 5.6 (catch block shows Indonesian error)
4. **Add conversationId to API calls** — generate a random UUID on page load and pass with each message:

In `ChatArea.tsx`, add at component top:
```tsx
const conversationId = useRef(crypto.randomUUID())
```

Update `sendMessage` call:
```tsx
const response = await sendMessage({
  message: text,
  conversationId: conversationId.current,
  userId: conversationId.current // use same as anonymous userId for web
})
```

**QA**: Same browser session maintains conversation context. Follow-up questions reference previous answers.

---

### TASK 6.6 — End-to-end test checklist

Run through these scenarios manually:

**Line Bot**:
- [ ] Send "Halo" → warm greeting response in Indonesian
- [ ] Send "Apa itu KM ITB?" → answer with sources list appended ("📄 Sumber: ...")
- [ ] Send "Prosedur pengajuan kegiatan?" → answer cites sources
- [ ] Send "Lebih detail?" (follow-up) → answer uses conversation context
- [ ] Send a completely unknown topic → polite "tidak ditemukan" message

**Web Chat**:
- [ ] Page loads, empty state shown
- [ ] Send "Halo" → greeting, no sidebar
- [ ] Send "Bagaimana cara pinjam ruangan?" → answer with citation chips [1] [2]
- [ ] Click citation chip → sidebar opens, scrolls to card, card highlighted
- [ ] Close sidebar → reopens on next citation click
- [ ] Follow-up question references context from previous message
- [ ] Kill API server → chat shows "terjadi kesalahan" message

---
## Final Verification

### Full project file tree (expected after all steps complete)

```
project-naufarrel/
├── package.json                          # workspace root
├── .env.example
├── .gitignore
├── apps/
│   ├── api/
│   │   ├── package.json
│   │   ├── wrangler.jsonc
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts
│   │       ├── routes/
│   │       │   ├── webhook.ts
│   │       │   └── chat.ts
│   │       ├── ai/
│   │       │   ├── router.ts
│   │       │   ├── citation-parser.ts
│   │       │   ├── handlers/
│   │       │   │   ├── greeting.ts
│   │       │   │   └── knowledge.ts
│   │       │   └── prompts/
│   │       │       ├── knowledge.ts
│   │       │       └── greeting.ts
│   │       ├── platforms/
│   │       │   ├── types.ts
│   │       │   ├── line.ts
│   │       │   └── web.ts
│   │       ├── db/
│   │       │   ├── schema.ts
│   │       │   ├── queries.ts
│   │       │   └── migrations/
│   │       │       ├── 001_initial.sql
│   │       │       ├── 002_seed.sql
│   │       │       └── 003_search_function.sql
│   │       └── lib/
│   │           ├── supabase.ts
│   │           └── line-verify.ts
│   └── web/
│       ├── package.json
│       ├── app.config.ts
│       ├── tsconfig.json
│       ├── tailwind.config.js
│       ├── postcss.config.js
│       └── src/
│           ├── styles.css
│           ├── router.tsx
│           ├── routeTree.gen.ts   (auto-generated by TanStack)
│           ├── routes/
│           │   ├── __root.tsx
│           │   └── index.tsx
│           ├── components/
│           │   ├── ChatArea.tsx
│           │   ├── MessageBubble.tsx
│           │   ├── CitationMarker.tsx
│           │   ├── SourceSidebar.tsx
│           │   └── SourceCard.tsx
│           └── lib/
│               └── api.ts
└── packages/
    └── shared/
        ├── package.json
        └── types.ts
```

---

### Deployment checklist

**API (Cloudflare Worker)**:
```bash
# Set all secrets
wrangler secret put LINE_CHANNEL_SECRET
wrangler secret put LINE_CHANNEL_ACCESS_TOKEN
wrangler secret put SUPABASE_URL
wrangler secret put SUPABASE_ANON_KEY
wrangler secret put GOOGLE_GENERATIVE_AI_API_KEY

# Deploy
wrangler deploy
```

**Web (Cloudflare Pages or Vercel)**:
- Set `VITE_API_URL` to your deployed Worker URL
- `npm run build` → deploy `dist/` folder

**Supabase**:
- Run 001_initial.sql, 002_seed.sql, 003_search_function.sql in order via SQL Editor

---

### Definition of Done

- [ ] `wrangler dev` starts without errors
- [ ] `npm run dev` in apps/web starts without errors
- [ ] No TypeScript errors across all packages
- [ ] Line bot echoes → then gives AI answers → then gives citations
- [ ] Web chat shows citation chips that open sidebar
- [ ] Conversation history persists in Supabase `conversations` table
- [ ] Follow-up questions in both Line and Web use prior context
- [ ] All error states show user-friendly Indonesian messages
- [ ] Deployed Worker URL accessible publicly
- [ ] Line webhook verified and working with real messages
