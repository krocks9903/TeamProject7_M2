# M3 cost analysis — FinePrint Agent

**Team DNK · CEN 4930**  
Rough unit economics for demos and a small pilot. Numbers are planning estimates, not quotes.

## Assumptions

- Demo PDFs: 2–8 pages, ~2–6k tokens of page text after parse.
- M3 path: 6 retrieval queries (local, **$0**), 1 Extractor LLM call, Ranker is **deterministic** (no second LLM).
- Providers: `mock` (CI / offline) · NRP class account · optional Anthropic.

## Per-scan cost (live model)

| Component | Estimate | Notes |
|---|---|---|
| PDF parse | $0 | Local `pdf-parse` |
| Chunk + `document_search` | $0 | Keyword over `./data/knowledge` |
| Extractor prompt + completion | ~3–8k tokens in / ~1–2k out | Dominates cost |
| Ranker | $0 | Rule-based severity + copy |
| Storage | Negligible locally | Supabase free tier for class |

**NRP (class):** treat as **$0 marginal** while on course quota; track token usage in scan logs for the write-up.

**Anthropic (if used):** ≈ $0.01–0.05 / scan at Haiku-class rates for demo sizes; flag if a teammate burns personal keys.

## Monthly scenarios

| Scenario | Scans / month | Model | Est. cash cost |
|---|---|---|---|
| Team demos + CI | 50 | mock | $0 |
| Class presentation week | 30 | NRP | $0 (quota) |
| Soft pilot (friends) | 200 | NRP or cheap API | $0–10 |
| Paid API fallback | 200 | Anthropic Haiku-class | ~$5–15 |

## Cost controls already in code

1. **Content-hash cache** — identical PDF + model skips re-extract.
2. **Fail-closed validator** — no retry loops inventing quotes.
3. **Single LLM hop** — Ranker does not call the model.
4. **Size cap** — `MAX_UPLOAD_BYTES` blocks huge uploads.

## What would raise cost later (M4+)

- Second LLM Ranker / explainer
- Embedding API for pgvector (`document_chunks.embedding`)
- Background workers always-on
- Gmail sync volume

## Decision for M3 submission

Ship **local keyword RAG + one Extractor call + free Ranker**. Revisit embeddings only if ablation shows keyword miss rate > ~30% on gold leases.
