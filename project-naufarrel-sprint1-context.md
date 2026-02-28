# Project Naufarrel — Sprint 1 Context

Add this to your existing Claude project. This defines the vision, architecture, and scope for Sprint 1 (MVP). Opus already has the codebase — this provides direction for the refactor.

---

## What Is Project Naufarrel

An open source AI knowledge retainer for KM ITB (Keluarga Mahasiswa Institut Teknologi Bandung).

It is NOT a simple Q&A bot. It is an all-knowing AI agent on KM ITB — an entity that deeply understands KM ITB's foundational documents, can discuss and reason about institutional topics, serve as a brainstorming partner, and retain knowledge across leadership transitions.

The bot should feel like talking to a knowledgeable senior who has read every important KM ITB document and can discuss them thoughtfully — not like searching a database.

---

## Sprint 1 Scope: MVP

### What we're building:
A working AI agent that deeply understands a curated set of KM ITB foundational documents. It can answer questions, discuss ideas, analyze content, compare with external institutions, and brainstorm — all grounded in real documents. Accessible via Line Bot and web chat.

### Knowledge scope for Sprint 1:
A small set of foundational documents manually loaded by the developer. These include documents like konsepsi KM ITB, arahan formatur, RUK KM ITB, and a few others. The exact documents will be provided. The bot should become an expert on whatever documents are loaded.

### What's NOT in Sprint 1:
- No admin portal or organization self-service uploads
- No organizational hierarchy data model
- No RAG / vector embeddings / pgvector
- No sub-agents or orchestrator pattern
- No Durable Objects, Queues, KV cache, or R2
- No document generation / draft creation features

These are planned for future sprints.

---

## Example Interactions (Target Capability)

The bot should handle all of these naturally in conversation:

Simple: "Apa itu konsepsi KM ITB?" → retrieves relevant sections, explains clearly

Analytical: "Jelaskan gameplay KM ITB saat ini, apa kelebihan dan kekurangannya?" → reasons about the content, provides structured analysis

Comparative: "Bandingkan pendekatan kaderisasi ITB dengan universitas lain" → uses loaded documents for ITB context, searches the web for external comparison

Discussion: "Menurutmu, apakah RUK KM ITB masih relevan untuk kondisi mahasiswa sekarang?" → engages in thoughtful discussion grounded in the actual document content

Brainstorming: "Bantu aku brainstorm ide untuk program kerja yang sejalan dengan konsepsi KM ITB" → acts as a thought partner, referencing real document content

Simple chat: "Halo!" → responds warmly without using any tools

---

## Architecture: Single LLM + Tools

One LLM call per user message. The LLM has tools available and decides on its own whether to use them. No pre-routing, no classification step, no linear chain.

```
User message → Single LLM call (system prompt + conversation history + tools)
                 → LLM decides: just respond? or use tools first?
                 → If tools needed: calls them, reads results, may call more
                 → Generates response
               → Response sent to user
               → Conversation saved to Supabase
```

"Halo!" → LLM responds directly, zero tool calls, fast.
"Apa isi RUK KM ITB?" → LLM calls searchDocuments, reads result, responds with context.
"Bandingkan kaderisasi ITB vs MIT" → LLM calls searchDocuments for ITB data, calls webSearch for MIT, synthesizes comparison.

---

## Tools (Sprint 1 — 3 tools only)

### searchDocuments(query)
Searches across all loaded documents and returns relevant sections. Uses PostgreSQL full-text search in Supabase. Returns document title, section, and matched content.

### getDocumentFull(doc_id)
Retrieves the complete content of a specific document. Used when the LLM needs the full context of a document, not just search snippets — for example when analyzing the entire konsepsi or comparing complete documents.

### webSearch(query)
Searches the web for external information. Used when the user asks about things outside the loaded documents — other universities, general knowledge, external benchmarks. Uses Kimi's built-in web search capability ($web_search tool in the API).

---

## Model

### Primary: Kimi K2
- Cost: $0.60 / $2.50 per 1M tokens (input/output), $0.15 for cached input
- OpenAI SDK compatible — works with AI SDK v6 via api.moonshot.ai/v1 endpoint
- Strong tool-use capabilities
- 131K context window
- Built-in web search via $web_search tool
- Needs testing with Bahasa Indonesia and KM ITB terminology

### Current state: migrating from Gemini to Kimi K2
The project currently uses Gemini. This refactor switches to Kimi K2 via AI SDK v6 provider configuration change. If Kimi K2 handles Bahasa Indonesia poorly, Claude Sonnet ($3/$15 per 1M) is the fallback.

### Model agnostic principle:
Always use AI SDK v6 abstraction. Switching models = config change, not code rewrite.

---

## Platforms

### Line Bot
- Primary platform for ITB students
- Receives messages via webhook
- Thin adapter that translates Line format to/from core AI interface

### Web Chat
- Browser-based chat interface
- Built with React (Vite) — plain React, no SSR framework
- Thin client that talks to the same backend API as Line Bot

### Platform-agnostic design:
The core AI does not know which platform the message came from. Platform adapters translate formats:
```
Line message → adapter → core AI → adapter → Line response
Web message  → adapter → core AI → adapter → Web response
```

---

## Tech Stack

| Layer | Choice |
|---|---|
| Runtime | Cloudflare Workers |
| Framework | Hono |
| AI | AI SDK v6 |
| LLM | Kimi K2 (primary), Claude Sonnet (fallback) |
| Web Search | Kimi built-in $web_search |
| Database | Supabase PostgreSQL |
| File Storage | Supabase Storage |
| Search | PostgreSQL full-text search |
| Frontend | React + Vite |
| Language | TypeScript |

---

## Knowledge Storage (Sprint 1)

Documents are stored as structured records in Supabase PostgreSQL. No vector embeddings.

Each document has: title, type, full content (or split into sections), and basic metadata.

The searchDocuments tool queries these records using PostgreSQL full-text search.

The developer manually loads documents into Supabase. There is no upload UI in Sprint 1.

---

## System Prompt Direction

The system prompt should establish the bot as:
- A knowledgeable, warm, and thoughtful entity that deeply understands KM ITB
- Capable of discussion and brainstorming, not just answering questions
- Grounded in real documents — when it references something, it's from the actual loaded content
- Honest when it doesn't know something or when the loaded documents don't cover a topic
- Conversational in Bahasa Indonesia (primary) and English
- Aware that it has tools available and uses them naturally when needed

The system prompt should NOT:
- Make the bot sound robotic or overly formal
- Pretend to know things not in the documents (except general knowledge)
- List its capabilities unprompted

---

## Design Principles

1. **Ship the MVP.** A working bot with 5 documents beats a perfect architecture with zero users.
2. **Model agnostic.** AI SDK v6, never hardcode a provider.
3. **Smart without waste.** The LLM decides what tools to use. No unnecessary processing steps.
4. **Platform agnostic.** Core AI doesn't know about Line or web.
5. **Contributor accessible.** Any ITB student should understand the codebase in 30 minutes.
6. **Designed for growth.** Tools are independent functions. Future sprints add more tools, then eventually migrate to sub-agents. Current code doesn't need rewriting for that.

---

## What This Refactor Should Accomplish

1. Migrate from Gemini to Kimi K2 via AI SDK v6 provider swap
2. Implement the 3 tools: searchDocuments, getDocumentFull, webSearch
3. Set up document storage schema in Supabase for manually loaded documents
4. Design the system prompt for the "all-knowing KM ITB agent" personality
5. Ensure Line Bot and web chat both work through the same core AI interface
6. Test with real KM ITB documents and validate response quality

---

## Future Sprints (for context only — do NOT build these now)

**Sprint 2:** Organization self-service uploads, admin portal, org hierarchy data, more tools (getOrgInfo, getOrgStructure, generateDraft), evaluate if semantic search is needed.

**Sprint 3:** Migrate to orchestrator + sub-agents, different models per task, parallel execution, potential new platform integrations.
