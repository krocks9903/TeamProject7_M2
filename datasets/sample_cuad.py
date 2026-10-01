"""Copy a size-balanced sample of CUAD contracts (with expert labels) into the corpus.

CUAD v1 (CC BY 4.0): https://zenodo.org/records/4595826  (~106 MB zip)
Usage:  python datasets/sample_cuad.py path/to/CUAD_v1.zip [--per-bucket 5]

Only service-style categories are sampled -- the ones closest to consumer
contracts (renewal, termination, fees, liability). CUAD contains no leases.
Writes datasets/documents/cuad-service-contracts/<size>/*.pdf plus
cuad-service-contracts/labels.csv (master_clauses.csv rows for sampled files).
"""
from __future__ import annotations

import argparse
import csv
import io
import json
import re
import zipfile
from pathlib import Path

from pypdf import PdfReader

from fetch_corpus import ROOT, describe, size_bucket, write_manifest

DOC_TYPE = "cuad-service-contracts"
CATEGORIES = {"Service", "Consulting Agreements", "Franchise", "Maintenance", "Hosting", "Outsourcing"}


def slug(stem: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", stem.lower()).strip("-")[:80]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("zip_path")
    ap.add_argument("--per-bucket", type=int, default=5)
    args = ap.parse_args()

    z = zipfile.ZipFile(args.zip_path)
    by_cat: dict[str, list[str]] = {}
    for n in sorted(z.namelist()):
        if n.lower().endswith(".pdf") and n.split("/")[-2] in CATEGORIES:
            by_cat.setdefault(n.split("/")[-2], []).append(n)
    # Round-robin across categories so no single contract type dominates a bucket
    candidates = []
    while any(by_cat.values()):
        for cat in sorted(by_cat):
            if by_cat[cat]:
                candidates.append(by_cat[cat].pop(0))

    picked: dict[str, list[tuple[str, int]]] = {"small": [], "medium": [], "large": []}
    companies: dict[str, set[str]] = {b: set() for b in picked}
    for name in candidates:
        company = name.split("/")[-1].split("_")[0]
        try:
            pages = len(PdfReader(io.BytesIO(z.read(name))).pages)
        except Exception:
            continue
        bucket = size_bucket(pages)
        # One contract per company per bucket (CUAD splits some filings into parts)
        if len(picked[bucket]) < args.per_bucket and company not in companies[bucket]:
            picked[bucket].append((name, pages))
            companies[bucket].add(company)
        if all(len(v) >= args.per_bucket for v in picked.values()):
            break

    out = ROOT / DOC_TYPE
    entries, filenames = [], set()
    for bucket, items in picked.items():
        for name, pages in items:
            src_file = name.split("/")[-1]
            dest = out / bucket / f"{slug(Path(src_file).stem)}.pdf"
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(z.read(name))
            filenames.add(src_file)
            entries.append({
                "type": DOC_TYPE, "size": bucket, "name": dest.stem, **describe(dest),
                "path": dest.relative_to(ROOT).as_posix(),
                "source_url": f"CUAD_v1.zip:{name}", "converted_from_html": False,
            })
            print(f"ok    {bucket:6} {pages:4}p  {src_file}")

    # Expert labels for the sampled contracts
    rows = list(csv.DictReader(io.TextIOWrapper(z.open("CUAD_v1/master_clauses.csv"), encoding="utf-8")))
    keep = [r for r in rows if r["Filename"] in filenames]
    with open(out / "labels.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(keep)
    (out / "CUAD_README.txt").write_bytes(z.read("CUAD_v1/CUAD_v1_README.txt"))

    mpath = ROOT / "manifest.json"
    existing = json.loads(mpath.read_text()) if mpath.exists() else []
    merged = [m for m in existing if m["type"] != DOC_TYPE] + entries
    merged.sort(key=lambda m: (m["type"], m["size"], m["name"]))
    write_manifest(merged)
    print(f"\n{len(entries)} contracts copied, {len(keep)} label rows")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
