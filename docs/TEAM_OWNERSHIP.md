# Team ownership & parallel work

FinePrint is a monorepo. **Own your package lane.** Cross-lane changes need a review from the lane owner.

## Who owns what (M2)

| Lane | Package / path | Primary owner | Backup |
|---|---|---|---|
| Contracts | `packages/shared` | Nolan | Krish |
| MCP / parse | `packages/mcp-document` | Nolan | Diego |
| Agent / orchestrator | `packages/agent` | Krish | Nolan |
| Web UI / API routes | `apps/web` | Diego | Krish |
| Supabase migrations | `supabase/` | Diego | Krish |
| Tests / fixtures | `tests/` | Nolan | Krish |
| Architecture docs | `docs/` | Nolan | Diego |
| Market research PDF (not code) | LMS report | Diego + Krish | — |

Suggested split for the next 48 hours:

1. **Krish** — wire `MODEL_PROVIDER=nrp`, tune `persona.ts` prompts, verify live NRP extraction on sample leases.
2. **Diego** — polish `apps/web` UX, add Vercel env vars, apply Supabase migration when ready, keep demo user path working.
3. **Nolan** — keep contracts stable, expand fixtures/tests, citation validator edge cases, architecture diagram for the report.

## Interface contracts (do not break without a team ping)

- `RiskFinding` and `ScanStatus` live only in `@fineprint/shared`.
- MCP tool name is `document_parse` (`MCP_TOOL_DOCUMENT_PARSE`).
- Every user-facing finding **must** pass `validateCitations` in `@fineprint/agent`.
- Browser never receives LLM keys or full page text (API strips `pages`).
- Storage: `STORAGE_BACKEND=local` by default (`./data`). Supabase is additive.

## Branch / PR rules (graded commit history)

1. Branch from `main`: `m2/<yourname>/<short-topic>`.
2. One concern per PR. Keep PRs reviewable in <15 minutes.
3. At least one other teammate reviews before merge.
4. Commit your own work — do not paste teammates' code under your name.
5. Never commit `.env`, `data/`, or API keys.

## How to run without cloud (teammate onboarding)

```bash
git clone https://github.com/krocks9903/TeamProject7_M2.git
cd TeamProject7_M2
cp .env.example .env
# MODEL_PROVIDER=mock is fine for UI + tests
npm install
npm test
npm run dev
```

Open http://localhost:3000 and upload a PDF.

## When you need NRP

Set in `.env`:

```
MODEL_PROVIDER=nrp
NRP_BASE_URL=...
NRP_API_KEY=...
```

Ask in GroupMe for values. Do not paste keys into GitHub issues/PRs.
