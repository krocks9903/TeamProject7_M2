# FinePrint Agent

An AI agent that reads an important document and tells you the specific ways it can cost you money.

**Team DNK** — Krish Shah, Nolan Stillwell, Diego Guatarasma  
CEN 4930 AI Agent Studio · Florida Gulf Coast University · Fall 2026  
Instructor: Dr. Vinod Kumar Ahuja

**Status:** Milestone 2 architecture + vertical slice on branch `main`.

---

## The problem

People sign leases, service contracts, insurance and loan paperwork without reading past the first few pages. Clauses that cost money stay buried until the money is already gone.

Upload the PDF. Get a short ranked list of money-loss risks, each quoting the exact sentence and page. Not a summary — a grounded risk list.

## What the agent can do right now

- Accept a PDF upload in the Next.js UI (`apps/web`)
- Parse the file through MCP tool `document_parse` (page-mapped text)
- Extract candidate risks (NRP / Anthropic when configured; **mock extractor offline**)
- **Drop any finding whose quote is not in the source text** (citation validator)
- Return ranked grounded findings via `GET /api/scans/:id`
- Run three automated test cases including a hallucination trap

## What is intentionally not implemented yet

- Legal advice or enforceability opinions
- Negotiation / redlining
- Multi-agent extractor → ranker (M3)
- Supabase pgvector retrieval (M3); local `./data` store is the M2 default
- Background worker fleet (sync path for demo-sized PDFs)

## Architecture (teammate map)

See **[docs/architecture.md](docs/architecture.md)** and **[docs/TEAM_OWNERSHIP.md](docs/TEAM_OWNERSHIP.md)**.

```
apps/web/                 Next.js UI + API (Diego lane)
packages/shared/          Shared types / contracts (Nolan lane)
packages/mcp-document/    MCP document_parse (Nolan lane)
packages/agent/           Provider, persona, orchestrator, validator (Krish lane)
supabase/migrations/      RLS schema for cloud path (Diego lane)
tests/                    Graded M2 cases (Nolan lane)
docs/                     Architecture + contributing
```

## Setup (no cloud required)

```bash
git clone https://github.com/krocks9903/TeamProject7_M2.git
cd TeamProject7_M2
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
```

Ask GroupMe for endpoint values. Never commit `.env`.

### Supabase (optional for M2)

Apply `supabase/migrations/20260921_m2_init.sql`, set `STORAGE_BACKEND=supabase` and keys. Until then the orchestrator uses the local JSON store under `./data` (gitignored).

## Known limitations

1. **Sync path on Vercel** — large PDFs can hit serverless timeouts; M3 may move processing to a worker.
2. **Mock provider** — keyword heuristics for offline/CI; switch to NRP for demos.
3. **No legal advice** — quotes only; citation validation fails closed on invented fees.
4. **Demo owner** — M2 uses `DEMO_OWNER_ID` instead of full Auth UI (migrations already define RLS).

## Stack

| Layer | Choice |
|---|---|
| Model | NRP `gpt-oss` (OpenAI-compatible); Anthropic fallback; `mock` for tests |
| Agent | `@fineprint/agent` orchestrator + citation validator |
| MCP | `document_parse` in `@fineprint/mcp-document` |
| Front end | Next.js App Router |
| Data | Local store (M2 default) / Supabase Postgres + Storage |

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
