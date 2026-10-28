# FinePrint Agent

An AI agent that reads an important document and tells you the specific ways it can cost you money.

**Team DNK** — Krish Shah, Nolan Stillwell, Diego Guatarasma  
CEN 4930 AI Agent Studio · Florida Gulf Coast University · Fall 2026  
Instructor: Dr. Vinod Kumar Ahuja

**Status:** Milestone 3 — two-agent pipeline (Extractor → Ranker) running on `main`. Open items are listed in [docs/M3-REMAINING.md](docs/M3-REMAINING.md).

---

## The problem

People sign leases, service contracts, insurance and loan paperwork without reading past the first few pages. Clauses that cost money stay buried until the money is already gone.

Upload the PDF. Get a short ranked list of money-loss risks, each quoting the exact sentence and page. Not a summary — a grounded risk list.

## How a scan works

```
PDF upload ─► document_parse (MCP) ─► Extractor agent ─────────────────────────► Ranker agent ─► ranked findings
                                       1. chunk pages into the knowledge store       severity floors per risk type
                                       2. ReAct loop: document_search per query      plain-English rewrite
                                       3. model extracts findings with quotes        cannot add findings or edit quotes
                                       4. citation check drops unquoted findings
                                       └── HandoffPayload: findings + reasoning trace + dropped quotes
```

Every step emits a live event. The scan screen and **Mission Control** (`/mission-control`) show each agent working in real time.

## CHANGES (M2 → M3)

- **Multi-agent:** the single extraction pass is now an **Extractor** agent and a **Ranker** agent joined by a typed `HandoffPayload` (`packages/shared`). The handoff fires once the Extractor's findings pass the citation check; the payload carries grounded findings, the reasoning trace, the proposed count and every dropped quote.
- **Reasoning pattern:** ReAct-style retrieval trace on the Extractor (`packages/agent/src/reasoning.ts`). Each step records thought → `document_search` action → observation (pages and pattern hits). The search queries are a fixed list today; the model does not choose them yet.
- **Knowledge layer:** pages are chunked into a local chunk store with a stipulation pattern library (`packages/agent/src/knowledge.ts`, `packages/mcp-document/src/retrieve.ts`), searchable through the new MCP tool `document_search`. Retrieval tags findings with `pattern_hits`; the model still reads every page (retrieval does not narrow the prompt yet).
- **Guardrails:** citation validator fails closed and its drops are reported live; the Ranker can only raise severity, never lower it, and cannot add findings or change quotes; PDF-only upload with a size cap; the prompt treats document text as data.
- **New risk type:** `payment_obligation` for expected amounts (rent, retainers, hourly rates), separate from trap clauses.
- **Live events + Mission Control:** per-scan event stream (`/api/scans/:id/events`) and a sanitized global feed that never contains document text.
- **Parsing:** `pdfjs-dist` instead of `pdf-parse`; letter-spaced headings are collapsed; unreadable (symbol-font) pages are detected and skipped.
- **Long documents:** the model reads 12,000-character parts, up to 4 at once, with an 8,000-token output budget. A part the model cannot read is reported with its page numbers instead of the scan claiming to be complete. On the 15-page HUD lease this took a scan from 13 minutes (most pages skipped) to 77 seconds.
- **Live-run evaluation:** `scripts/live-scan.mjs` runs PDFs through the real model and prints events, findings, drops, tokens and time. Results and the bugs they found are in [docs/m3-live-run.md](docs/m3-live-run.md).
- **Fixture mailbox MCP** (`packages/mcp-mailbox`) and inbox/calendar API routes for deadline demos — fixture data only, no Gmail OAuth.
- **Planned, not live:** pgvector embeddings (`supabase/migrations/20261026_m3_chunks.sql` is written but not applied), Supabase storage path, auth UI.
- `PROMPT_VERSION` is `m3.v3`; cached scans from older prompts are not reused.

## What is intentionally not implemented yet

- Legal advice or enforceability opinions
- Negotiation / redlining
- Gmail OAuth (fixture mailbox only)
- Embedding search (keyword retrieval is live; pgvector migration is written but unused)
- Background worker fleet (scans run in the web process)

## Repository map

See **[docs/architecture.md](docs/architecture.md)**, **[docs/m3-live-run.md](docs/m3-live-run.md)**, **[docs/m3-eval-plan.md](docs/m3-eval-plan.md)**, **[docs/m3-cost-analysis.md](docs/m3-cost-analysis.md)**, **[docs/user-testing-script.md](docs/user-testing-script.md)**.

```
apps/web/                 Next.js UI + API, Mission Control (Diego lane)
packages/shared/          Shared types / contracts, HandoffPayload (Nolan lane)
packages/mcp-document/    document_parse + document_search MCP server (Nolan lane)
packages/mcp-mailbox/     Fixture inbox / calendar MCP
packages/agent/           Extractor, Ranker, knowledge, reasoning, orchestrator, events (Krish lane)
supabase/migrations/      RLS schema + M3 chunks table (Diego lane)
scripts/                  live-scan.mjs: real-model evaluation runs
tests/                    M2 + M3 cases (Nolan lane)
docs/                     Architecture, eval, cost, user testing
```

## Setup (no cloud required)

```bash
git clone https://github.com/krocks9903/TeamProject7_M3.git
cd TeamProject7_M3
cp .env.example .env
npm install
npm test
npm run dev
```

Open http://localhost:3000. Default `MODEL_PROVIDER=mock` needs no API keys.

### NRP / Anthropic (live model)

```
MODEL_PROVIDER=nrp
NRP_BASE_URL=...
NRP_API_KEY=...
# optional: low | medium | high. "low" ran ~2.5x faster but found fewer clauses.
NRP_REASONING_EFFORT=
```

Ask GroupMe for endpoint values. Never commit `.env`.

To run real-model scans from the command line (after `npm run build`):

```bash
node scripts/live-scan.mjs apps/web/public/sample-lease.pdf
```

Each run uses a throwaway data directory, so it never hits the scan cache.

### Supabase (optional)

Apply `supabase/migrations/20260921_m2_init.sql` then `20261026_m3_chunks.sql`. Set `STORAGE_BACKEND=supabase` and keys. Until then the orchestrator uses `./data` (gitignored); knowledge chunks live under `./data/knowledge`.

## Known limitations

1. **Mock provider is keyword matching.** It exists for CI and offline work; real results need `MODEL_PROVIDER=nrp`.
2. **ReAct loop is scripted.** Retrieval queries are a fixed list, and retrieval does not yet narrow what the model reads.
3. **Ranker is rule-based.** It applies severity floors and plain-English templates; it does not call a model.
4. **Keyword retrieval misses paraphrases.** Embeddings are planned for M4.
5. **Recall on long documents.** The citation check refuses quotes the model paraphrased, added "..." to, or joined from two sentences. That keeps every shown finding grounded, but real clauses get lost: on the HUD lease 12 of 20 proposed quotes were dropped.
6. **Speed depends on NRP.** Short documents took 30 seconds to 3 minutes in our runs and the 15-page HUD lease about 80 seconds, but the endpoint has been as slow as ~15 tokens a second and occasionally returns `503`.
7. **Knowledge store is one JSON file** with no locking — fine for demos, not for concurrent uploads.
8. **Scans run in the web process** — large PDFs can hit serverless timeouts on Vercel.
9. **Same file, cached result.** A re-uploaded file reuses its saved findings (keyed on file hash, model and prompt version), even if the extraction code changed since.
10. **No legal advice** — quotes only; citation validation fails closed on invented fees.
11. **Demo owner** — uses `DEMO_OWNER_ID` until the auth UI exists.

## Stack

| Layer | Choice |
|---|---|
| Model | NRP `gpt-oss` (OpenAI-compatible); Anthropic fallback; `mock` for tests |
| Agents | Extractor (ReAct retrieval + extract + citation check) → Ranker |
| MCP | `document_parse`, `document_search`; fixture mailbox server |
| Front end | Next.js App Router, live scan events, Mission Control |
| Data | Local store default / Supabase Postgres + Storage (migrations written) |

## Milestones

| | Deliverable | Due |
|---|---|---|
| M1 | Team charter + problem discovery | Sep 2026 |
| M2 | Agent prototype v1 + market research | Sep 23, 2026 |
| M3 | Multi-agent system + cost analysis | Oct 28, 2026 |
| M4 | Evaluated + user-tested agent | Nov 18, 2026 |
| FP | Final pitch + live demo | Nov 23, 2026 |

## Contributing

Branch per topic off `main`. One other member reviews before merge. Commit history is graded — see [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md).
