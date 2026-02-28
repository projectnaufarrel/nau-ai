# Project Naufarrel — Roadmap Overview

---

## Vision

An all-knowing AI agent for KM ITB that retains institutional knowledge, discusses and analyzes organizational topics, and serves as a brainstorming partner for student leaders — accessible via Line Bot and web chat.

---

## Sprint 1: MVP — "The Agent That Knows the Core Documents"

**Goal:** A working AI agent that deeply understands a curated set of KM ITB foundational documents and can discuss, analyze, and brainstorm based on them. Deployed and usable via Line Bot and web chat.

**Knowledge scope:** A handful of documents manually loaded by you — konsepsi KM ITB, arahan formatur, RUK KM ITB, and a few other key documents.

**AI approach:** Single LLM call (Kimi K2) with 3 tools — searchDocuments, getDocumentFull, webSearch. Documents stored as structured records in Supabase. No RAG, no vector embeddings.

**Platforms:** Line Bot + web chat, both working through the same core AI.

**What success looks like:** Someone can message the bot and have a meaningful conversation about KM ITB — ask about the konsepsi, discuss kaderisasi philosophy, compare ITB's approach with other universities, brainstorm ideas grounded in the foundational documents.

**What's NOT in this sprint:** Organization self-service, admin portal, organizational hierarchy data, document upload workflows, sub-agents, RAG/vector search.

---

## Sprint 2: Scale Knowledge — "Every Organization Contributes"

**Goal:** Expand from a curated set of documents to a growing knowledge base where each organization within KM ITB can contribute their own documents and data. Sources become viewable — like NotebookLM, clicking a citation opens the actual document and highlights the relevant part.

**What gets added:**

**Document Upload & Storage**
- Admin portal for organizations to upload documents (AD/ART, RUK, proker, LPJ, sejarah, kajian, etc.)
- Original files (PDF, Word, etc.) stored in Supabase Storage for viewing/download
- Automatic text extraction — uploaded documents are processed into searchable text sections
- Each section is linked back to its position in the original document

**Source Viewer (NotebookLM-style)**
- Clicking a source citation opens the original document in the browser
- The viewer highlights and scrolls to the exact passage the AI referenced
- Users can read the full document context around the cited section

**Organization Data**
- Organizational hierarchy — how himpunan, lembaga, UKM, and other bodies relate within KM ITB
- Org-related tools for the AI: getOrgInfo, getOrgStructure

**Document Generation**
- generateDraft tool for creating derivative documents (profil peserta, proker drafts, etc.)

**Search Upgrade**
- Evaluate whether full-text search is still sufficient or if semantic search (pgvector) is needed as document volume grows

**What success looks like:** Multiple organizations have uploaded their documents. Clicking a source opens the actual document with the passage highlighted. The bot can answer about specific organizations, compare across organizations, and help draft documents.

**What's NOT in this sprint:** Sub-agents, orchestrator pattern, parallel processing.

---

## Sprint 3: Intelligent Architecture — "The Orchestrator"

**Goal:** Migrate from single LLM + tools (Option A) to orchestrator + sub-agents (Option C) to handle growing complexity, optimize costs, and improve response quality for complex multi-document tasks.

**What gets added:**
- Orchestrator layer that delegates to specialized sub-agents
- Specialized sub-agents: Document Researcher (cheap fast model for retrieval), Analyst (capable model for reasoning and comparison), Draft Generator (capable model for document creation)
- Different models per role — cheap models for retrieval tasks, capable models for synthesis and analysis
- Parallel execution for complex queries that need multiple documents from multiple organizations simultaneously
- Potentially: Durable Objects for session state if Supabase becomes a bottleneck at scale, additional platform integrations (WhatsApp, Discord)

**Migration trigger:** Sprint 3 starts when Sprint 2 reveals concrete pain points — tool count growing beyond what one LLM handles well, response quality dropping on complex multi-org queries, or cost optimization needed from routing simple vs complex tasks to different models.

**What success looks like:** Complex queries like "buatkan profil peserta turunan dari RUK, arahan formatur, dan kajian materi" are handled faster and more accurately through parallel specialized agents. Simple questions remain fast and cheap. The architecture can scale to the full KM ITB ecosystem.

---

## Sprint Summary

| Sprint | Focus | AI Approach | Knowledge Source | Platforms |
|---|---|---|---|---|
| 1 | MVP | Single LLM + 3 tools | Curated documents (manual) | Line Bot + Web |
| 2 | Scale knowledge | Single LLM + 6 tools | Org self-service uploads | Line Bot + Web + Admin |
| 3 | Intelligent architecture | Orchestrator + sub-agents | Full KM ITB ecosystem | All + potential new platforms |

---

## Principles That Apply Across All Sprints

- **Model agnostic** — AI SDK v6, never hardcode a provider
- **Open source friendly** — any ITB student can understand and contribute
- **Ship then improve** — a working bot with 5 documents beats a perfect architecture with zero users
- **Add complexity only when earned** — RAG when search fails, sub-agents when tools overflow, Durable Objects when Supabase bottlenecks
