# M3 evaluation plan — FinePrint Agent

**Team DNK · Due with M3 (~Oct 28, 2026)**  
Goal: prove multi-agent + retrieval improve **grounded** money-loss findings without inventing fees.

## Metrics

| Metric | Definition | Target (M3) |
|---|---|---|
| Grounding rate | Findings whose quote is a substring of page text / all shown findings | **100%** (validator fail-closed) |
| Hallucination traps caught | Synthetic quotes with invented $ amounts dropped | **100%** on fixture suite |
| Coverage | Distinct risk_types recovered on gold leases (early term, auto-renew, late fee, notice, payment) | ≥ 4 of 5 on mock; note NRP variance |
| Latency | `createAndProcess` wall time, mock provider, ≤5 page PDF | < 5 s local |
| Reasoning audit | `HandoffPayload.reasoning_trace` length ≥ 2 with `document_search` actions | Always on M3 path |

## Fixtures

1. **Happy lease** — explicit early termination + auto-renew + late fee (existing M2 PDF).
2. **Hallucination trap** — model tempted to invent `$99999`; must not appear in API output.
3. **Payment-only** — rent / retainer language → `payment_obligation` without false “trap” severity inflation by Ranker beyond planned boosts.
4. **Empty / scanned junk** — empty text → scan `failed`, no fabricated findings.

Automated: `npm test` (`tests/*.test.ts` including `m3-pipeline.test.ts`).

## Ablations (manual notebook, 30 min)

| Run | Config | What we record |
|---|---|---|
| A | Mock, M2-style single extract (disable Ranker rewrite mentally — compare quotes) | Quote set |
| B | Mock, full M3 Extractor→Ranker | Quote set + plain_english |
| C | NRP once on same PDF | Finding count, any ungrounded drops in logs |

Success: B quotes ⊆ page text; B plain_english clearer (“Trap:” / “You will owe”); C no worse grounding than B.

## User testing (feeds M4)

Follow [user-testing-script.md](./user-testing-script.md). M3 deliverable is the **plan + script**; sessions can start after M3 if schedule slips — note dates in the cost doc.

## Failure modes we accept for M3

- Keyword RAG misses paraphrased clauses (document for M4 embedding upgrade).
- Mock extractor keyword-bound; NRP demos may differ in wording but not in grounding rule.
