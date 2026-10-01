# FinePrint test corpus

Real-world PDFs for exercising `document_parse`, the agent, and the citation validator
beyond the synthetic fixtures in `tests/fixtures/`.

```
datasets/documents/<type>/<small|medium|large>/<name>.pdf
```

| Size   | Pages |
|--------|-------|
| small  | 1–5   |
| medium | 6–20  |
| large  | 21+   |

`documents/manifest.json` / `manifest.csv` list every file with page count, bytes,
sha256, extracted-text length, `has_text_layer`, and the source URL.

## Contents (39 PDFs, ~22 MB)

| Type | small | medium | large | Source |
|---|---|---|---|---|
| `residential-leases` | – | 3 | – | HUD-90105a model lease and state housing agency copies |
| `student-housing-leases` | 1 | 1 | 1 | Univ. of Puget Sound, UC Berkeley, Ohio State renter's guide |
| `gym-fitness-contracts` | 3 | – | – | SC Dept. of Consumer Affairs, ProEd sample contract |
| `student-loans` | – | 4 | – | Federal Direct Loan Master Promissory Notes (studentaid.gov, fsapartners.ed.gov) |
| `wireless-telecom-agreements` | – | 5 | – | Verizon (2022, 2025), AT&T (2007), CREDO Mobile, Mercury Broadband |
| `commercial-leases` | 1 | 2 | 3 | SEC EDGAR Exhibit 10 leases (HTML printed to PDF) |
| `cuad-service-contracts` | 5 | 5 | 5 | CUAD v1 service/consulting/franchise/maintenance/hosting/outsourcing |

All 39 files have a text layer (none are image-only scans).

`cuad-service-contracts/labels.csv` contains CUAD's expert annotations for the
sampled contracts (`master_clauses.csv` rows) — use columns such as
*Renewal Term*, *Notice Period To Terminate Renewal*, *Termination For Convenience*,
*Liquidated Damages*, *Uncapped Liability* and *Cap On Liability* as ground truth
for precision/recall.

## Rebuilding

```bash
pip install pypdf
python datasets/fetch_corpus.py                        # public PDFs (skips files already present)
SEC_USER_AGENT="Your Name you@example.com" python datasets/fetch_corpus.py   # needed for SEC exhibits
curl -L -o CUAD_v1.zip https://zenodo.org/records/4595826/files/CUAD_v1.zip  # ~106 MB
python datasets/sample_cuad.py CUAD_v1.zip --per-bucket 5
```

SEC EDGAR requires a declared `Name email` user agent; HTML exhibits are printed to
PDF with headless Microsoft Edge.

## Licensing

- US federal/state government forms (HUD, studentaid.gov, SC Consumer Affairs) and
  SEC filings are public records.
- CUAD is CC BY 4.0 (The Atticus Project) — see `cuad-service-contracts/CUAD_README.txt`.
- University, carrier, and ProEd documents are the publishers' copyrighted material,
  included for non-commercial testing; check before redistributing.

## Known gaps

No large residential lease, no medium/large gym contract, and no small/large loan or
telecom document yet.
