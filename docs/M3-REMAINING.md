# Milestone 3 — what still needs to be finished

**Branch:** `main` (`m3-in-progress` merged with the live-events / Mission Control work) · **Due:** Oct 28, 2026  
**State:** core multi-agent pipeline works and `npm test` is green with `MODEL_PROVIDER=mock`. Everything unchecked below is open. Pick an item, put your name next to it in the PR, and branch off `main`.

## What already works (don't redo)

- Extractor → Ranker agents with a typed `HandoffPayload` (`packages/agent/src/extractor.ts`, `ranker.ts`)
- ReAct-style retrieval trace on the Extractor (`reasoning.ts`) — logged as `reasoning_steps` per scan
- Local keyword knowledge layer: chunk store + stipulation pattern library (`knowledge.ts`, `packages/mcp-document/src/retrieve.ts`)
- MCP tools `document_parse` and `document_search`; fixture mailbox MCP (`packages/mcp-mailbox`)
- Citation validator fails closed; Ranker cannot add findings, change quotes, or lower severity
- Extractor reasoning steps, citation drops and the Extractor → Ranker handoff stream as live events (scan screen + Mission Control)
- Supabase migration for `document_chunks` + pgvector (`supabase/migrations/20261026_m3_chunks.sql`) — written, **not applied or tested**

## Open work

### 1. Agent / knowledge layer

- [ ] **Retrieval does not narrow the model prompt yet.** `pagesForExtraction` returns every page; retrieval only drives the trace and `pattern_hits`. Decide: send retrieved chunks (+ neighbors) to the model for long PDFs, or keep full pages and say so in the write-up.
- [ ] **Embeddings.** Nothing generates or queries `document_chunks.embedding`. Needs: an embedding call (NRP or other), write on scan, cosine search behind the same `searchChunks` interface, and a fallback to keyword search.
- [ ] **Run once against NRP** (`MODEL_PROVIDER=nrp`) on the lease/gym/contractor PDFs and record finding counts + any dropped (ungrounded) quotes. All tests so far use the mock extractor.
- [ ] Knowledge store is a single JSON file (`data/knowledge/chunks.json`) with no locking — fine for demos, not for concurrent uploads.

### 2. Integrations

- [ ] **Gmail OAuth** — inbox/calendar APIs run on fixture data only (`packages/mcp-mailbox/src/fixtures.ts`). See `docs/email-filter-agent.md`.
- [ ] **Supabase path** — apply both migrations to a real project, wire `STORAGE_BACKEND=supabase`, verify RLS with two users.
- [ ] **Auth UI** — still using `DEMO_OWNER_ID`.

### 3. Evaluation (see `docs/m3-eval-plan.md`)

- [ ] Run the ablation table (mock single-pass vs. Extractor→Ranker vs. NRP) and fill in real numbers.
- [ ] Add a payment-only fixture and an empty/scanned-PDF fixture test (listed in the plan, not written).
- [ ] Measure latency per scan and paste into the eval doc.

### 4. Docs / submission

- [x] README reworded to match this list (CHANGES section, limitations). `docs/architecture.md` still needs the same pass.
- [ ] Fill real token counts into `docs/m3-cost-analysis.md` after the NRP run (currently estimates).
- [ ] Run at least a pilot of `docs/user-testing-script.md` with someone outside the team, or state the scheduled dates.
- [ ] 2-minute demo recording.
- [ ] M3 PDF write-up (diagram + CHANGES + cost + eval plan).

## Local setup reminders

- `npm install && npm test` — no keys needed with the mock provider.
- MCP for Claude Desktop / Cursor: copy `docs/claude-mcp.example.json`, replace the `/ABSOLUTE/PATH/TO/...` placeholders, then `npm run mcp:rebuild`.
- Known fixed bug: pdf.js misreads Node `Buffer`s, so `parsePdfBuffer` copies into a plain `Uint8Array`. Don't remove that copy.
