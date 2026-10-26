# FinePrint Agent

An AI agent that reads an important document and tells you the specific ways it can cost you money.

**Team DNK** — Krish Shah, Nolan Stillwell, Diego Guatarasma  
CEN 4930 AI Agent Studio · Florida Gulf Coast University · Fall 2026  
Instructor: Dr. Vinod Kumar Ahuja

**Status:** Milestone 3 **in progress** on branch `m3-in-progress` — see **[docs/M3-REMAINING.md](docs/M3-REMAINING.md)** for what still needs to be finished.

---

## The problem

People sign leases, service contracts, insurance and loan paperwork without reading past the first few pages. Clauses that cost money stay buried until the money is already gone.

Upload the PDF. Get a short ranked list of money-loss risks, each quoting the exact sentence and page. Not a summary — a grounded risk list.

## What the agent can do right now

- Accept a PDF upload in the Next.js UI (`apps/web`)
- Parse through MCP `document_parse` (page-mapped text)
- **Chunk + retrieve** via knowledge store / MCP `document_search`
- **Extractor** agent: ReAct retrieval → structured findings (NRP / Anthropic / `mock`)
- **Ranker** agent: severity + plain_english only; quotes frozen
- **Drop any finding whose quote is not in the source text** (citation validator)
- Optional fixture **inbox / calendar** APIs for email-deadline demos
- Automated tests including hallucination trap + M3 handoff/RAG cases

## CHANGES (M2 → M3)

- Split single extract into **Extractor → Ranker** with typed `HandoffPayload` (`PROMPT_VERSION=m3.v1`)
- Added ReAct reasoning trace (`document_search` thoughts/actions/observations)
- Local chunk store + stipulation pattern library; Supabase `document_chunks` + pgvector migration
- MCP tool `document_search` alongside `document_parse`
- Docs: eval plan, cost analysis, user-testing script; architecture diagram updated to Live M3

## What is intentionally not implemented yet

- Legal advice or enforceability opinions
- Negotiation / redlining
- Full Gmail OAuth (fixture mailbox for demos)
- Production embedding pipeline (keyword retrieval live; pgvector ready)
- Background worker fleet (sync path for demo-sized PDFs)

## Architecture (teammate map)

See **[docs/architecture.md](docs/architecture.md)**, **[docs/m3-eval-plan.md](docs/m3-eval-plan.md)**, **[docs/m3-cost-analysis.md](docs/m3-cost-analysis.md)**, **[docs/user-testing-script.md](docs/user-testing-script.md)**.

```
apps/web/                 Next.js UI + API (Diego lane)
packages/shared/          Shared types / contracts (Nolan lane)
packages/mcp-document/    document_parse + document_search (Nolan lane)
packages/mcp-mailbox/     Fixture inbox MCP
packages/agent/           Extractor, Ranker, knowledge, orchestrator (Krish lane)
supabase/migrations/      RLS + M3 chunks (Diego lane)
tests/                    M2 + M3 cases (Nolan lane)
docs/                     Architecture, eval, cost, user testing
```

## Setup (no cloud required)

```bash
git clone https://github.com/krocks9903/FInePrint-Agent.git
cd FInePrint-Agent
git checkout m3-in-progress
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

### Supabase (optional)

Apply `supabase/migrations/20260921_m2_init.sql` then `20261026_m3_chunks.sql`. Set `STORAGE_BACKEND=supabase` and keys. Until then the orchestrator uses `./data` (gitignored); knowledge chunks live under `./data/knowledge`.

## Known limitations

1. **Sync path on Vercel** — large PDFs can hit serverless timeouts; M4 may move processing to a worker.
2. **Mock provider** — keyword heuristics for offline/CI; switch to NRP for demos.
3. **No legal advice** — quotes only; citation validation fails closed on invented fees.
4. **Demo owner** — uses `DEMO_OWNER_ID` until full Auth UI.

## Stack

| Layer | Choice |
|---|---|
| Model | NRP `gpt-oss` (OpenAI-compatible); Anthropic fallback; `mock` for tests |
| Agents | Extractor (ReAct+RAG) → Ranker; citation validator |
| MCP | `document_parse`, `document_search` |
| Front end | Next.js App Router |
| Data | Local store default / Supabase Postgres + Storage + pgvector-ready chunks |

## Milestones

| | Deliverable | Due |
|---|---|---|
| M1 | Team charter + problem discovery | Sep 2026 |
| M2 | Agent prototype v1 + market research | Sep 23, 2026 |
| M3 | Multi-agent system + cost analysis | Oct 28, 2026 |
| M4 | Evaluated + user-tested agent | Nov 18, 2026 |
| FP | Final pitch + live demo | Nov 23, 2026 |

## Contributing

Branch per topic off `m3-in-progress` (current integration branch). One other member reviews before merge. Commit history is graded — see [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md).
