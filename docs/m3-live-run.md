# M3 live run — NRP `gpt-oss`, Oct 28, 2026

First runs of the Extractor → Ranker pipeline against the real model (`MODEL_PROVIDER=nrp`) instead of the mock extractor. Each scan went through `Orchestrator.createAndProcess` with a fresh data directory, so no cache hits.

## Results

| Document | Pages | Proposed | Kept | Dropped | Tokens | Wall time |
|---|---|---|---|---|---|---|
| `apps/web/public/sample-lease.pdf` | 3 | 9 | 9 | 0 | 2,719 | 133 s |
| Gym membership contract (before fixes) | 3 | 8 | 5 | 3 | 4,292 | 155 s |
| Gym membership contract (after fixes) | 3 | 8 | 8 | 0 | 4,688 | 168 s |
| HUD model lease 90105a | 15 | 14 | 7 | 7 | 12,634 | 239 s |
| HUD model lease, in the app (28k-character parts) | 15 | 2 | 2 | 0 | — | 797 s |
| HUD model lease, after the long-document fix | 15 | 20 | 8 | 12 | 15,504 | 77 s |

Gym = `datasets/documents/gym-fitness-contracts/small/proed-gym-membership-contract-sample.pdf`. HUD = `datasets/documents/residential-leases/medium/hud-model-lease-90105a.pdf`.

The Ranker raised severity on 1–2 findings per document (severity floors for auto-renewal, notice windows, early termination).

## Bugs the live run found (fixed)

All three gym drops were **real clauses**, not hallucinations:

1. **Words glued together by the parser.** The letter-spacing cleanup had no word boundaries, so "end of a one-year" became "ofaone-year" and "pay a returned" became "payareturned". The model quoted the correct English, so the citation check could not match it. Fixed in `collapseSpacedLetters` (`packages/mcp-document/src/parse.ts`).
2. **Short fee lines read as "mostly symbols".** `CARD FEE: $10.00` is mostly digits, and the garbled-text check counted digits against it. The validator now ignores digits in that ratio.
3. **Trailing period.** The model wrote `ENROLLMENT FEE: $150.00.`; the PDF has no period there. The validator retries without trailing punctuation, which cannot add content.

Regression tests: `tests/m3-pipeline.test.ts` → "M3 live-run regressions". A fabricated `$250.00` fee is still dropped.

## Bug found running the app (fixed)

Scanning the HUD lease through the web app, part 1 of 2 (28,000 characters) ran for 335 s, then 462 s on retry, and both times returned no usable answer. `gpt-oss` counts reasoning against `max_tokens` (4,000), and it spent the whole budget reasoning. Part 2 alone produced 2 findings, and the scan still reported "complete", so most of the lease was silently unread.

A direct test on the same text in a 12,000-character part finished normally: 179 s at default reasoning effort (10 findings), 72 s with `reasoning_effort: low` (7 findings).

Fix (`packages/agent/src/persona.ts`): 12,000-character parts, 4 in flight, an 8,000-token output budget, optional `NRP_REASONING_EFFORT`, and a warning naming the pages of any part the model could not read. After the fix the HUD lease took 77 s, read all 3 parts, and found the $1/day late fee it had missed.

## Known limitation (not fixed)

On the 15-page HUD lease the validator dropped 7 of 14 findings. The drops are correct under the rules, but real clauses were lost:

- The model put `...` inside quotes or joined two sentences (the persona forbids both).
- The model wrote a non-breaking hyphen (`HUD‑approved`, U+2011) where the PDF has `-`.

Lost clauses include the $5 + $1/day late fee and the damage-repair charge. Recall drops on long documents even though precision stays at 100%. Candidate fixes for M4: normalize Unicode dashes before matching, and send dropped quotes back to the Extractor once to re-quote.

## Other observations

- **Latency:** 2–4 minutes per scan on NRP, dominated by the model call. The eval plan's < 5 s target applies only to the mock provider.
- **Retrieval is weak on short documents:** on the 3-page sample lease every query matched all 3 pages, so the trace adds little there. On the 15-page HUD lease queries narrowed to 2–4 pages each.
- **Blank form fields get flagged:** HUD findings like "a fee of $__ (N) ___" are grounded but carry no amount.
