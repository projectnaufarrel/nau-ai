# Project Naufarrel

AI Knowledge Retainer untuk KM ITB (Keluarga Mahasiswa Institut Teknologi Bandung).

Chatbot yang menjawab pertanyaan tentang pengetahuan organisasi dengan dukungan kutipan sumber.

## Stack

- **API**: Cloudflare Workers + Hono
- **Frontend**: TanStack Start (React)
- **Database**: Supabase PostgreSQL
- **AI**: Vercel AI SDK + Gemini Flash

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Copy `.env.example` and fill in your values:

```bash
# apps/api — create .dev.vars for local dev
cp .env.example apps/api/.dev.vars
```

### 3. Set up Supabase

Run these SQL files in order in your Supabase SQL Editor:

1. `apps/api/src/db/migrations/001_initial.sql` — tables + indexes + triggers
2. `apps/api/src/db/migrations/002_seed.sql` — seed data (KM ITB org + 10 document sections)
3. `apps/api/src/db/migrations/003_search_function.sql` — search RPC function

### 4. Run locally

```bash
# API (Cloudflare Worker)
npm run dev:api

# Web frontend
npm run dev:web
```

Set `VITE_API_URL=http://localhost:8787` in `apps/web/.env` for local development.

## Deploy

```bash
# API
wrangler secret put LINE_CHANNEL_SECRET
wrangler secret put LINE_CHANNEL_ACCESS_TOKEN
wrangler secret put SUPABASE_URL
wrangler secret put SUPABASE_ANON_KEY
wrangler secret put GOOGLE_GENERATIVE_AI_API_KEY
npm run build:api  # or wrangler deploy from apps/api/

# Web — set VITE_API_URL to your deployed Worker URL, then deploy dist/
npm run build:web
```

## Architecture

```
User (Line / Web)
  → Cloudflare Worker (Hono)
  → Platform adapter normalizes message
  → Orchestrator: greeting → greeting handler | question → knowledge handler
  → Knowledge handler: search DB → prompt LLM → parse citations → ChatResponse
  → Platform adapter formats response
  → Reply to user
```

## Citation system

The `ChatResponse` type is the contract between API and frontend:

- `hasCitations: true` — answer has `[1]`, `[2]` markers, sidebar shows highlighted sources
- `hasCitations: false` — fallback mode, sources listed below answer as plain text
