"""Download the FinePrint test corpus and sort it by document type and size.

Usage:  python datasets/fetch_corpus.py

Layout: datasets/documents/<type>/<small|medium|large>/<name>.pdf
  small  = 1-5 pages, medium = 6-20 pages, large = 21+ pages
Writes datasets/documents/manifest.json and manifest.csv.
"""
from __future__ import annotations

import csv
import hashlib
import json
import shutil
import subprocess
import sys
import os
import tempfile
from pathlib import Path

from pypdf import PdfReader

ROOT = Path(__file__).resolve().parent / "documents"
# Some government hosts (studentaid.gov) stall on non-browser user agents
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36"

# (type, name, url, kind) -- kind "pdf" or "html" (html is printed to PDF with headless Edge)
SOURCES = [
    # Residential leases
    ("residential-leases", "hud-model-lease-90105a", "https://www.hud.gov/sites/dfiles/OCHCO/documents/90105a.pdf", "pdf"),
    ("residential-leases", "nj-hmfa-model-lease-subsidized", "https://www.nj.gov/dca/hmfa/assetmgt/propertymgrs/docs/forms_manuals/propmgr_model_lease_sub_progs.pdf", "pdf"),
    ("residential-leases", "watervliet-rad-pbra-model-lease", "https://watervliethousing.org/wha/files/RAD%20PBRA%20Model%20Lease%2090105A.pdf", "pdf"),
    # Student housing leases
    ("student-housing-leases", "puget-sound-sample-offcampus-lease", "https://www.pugetsound.edu/sites/default/files/file/1873_OCSSsamplelease_0.pdf", "pdf"),
    ("student-housing-leases", "uc-berkeley-family-housing-rental-agreement", "https://housing.berkeley.edu/wp-content/uploads/Sample_Rental-Agreement.pdf", "pdf"),
    ("student-housing-leases", "osu-usg-renters-guide-2019", "https://offcampus.osu.edu/posts/documents/2019-usg-renting-guide.pdf", "pdf"),
    # Gym / fitness / service contracts
    ("gym-fitness-contracts", "sc-consumer-affairs-gym-memberships", "https://www.consumer.sc.gov/sites/consumer/files/Documents/Gym_Memberships.pdf", "pdf"),
    ("gym-fitness-contracts", "sc-personal-training-agreement", "https://www.consumer.sc.gov/sites/default/files/Documents/Business%20Resources%20Laws/Regulatory/Gyms/agreement_personal_training.pdf", "pdf"),
    ("gym-fitness-contracts", "proed-gym-membership-contract-sample", "https://www.proedinc.com/Downloads/20836SamplePgs.pdf", "pdf"),
    # Student loans
    ("student-loans", "direct-loan-sub-unsub-mpn", "https://studentaid.gov/sites/default/files/Sub_Unsub_MPN_508-en-us.pdf", "pdf"),
    ("student-loans", "direct-plus-loan-mpn", "https://studentaid.gov/sites/default/files/PLUS_MPN_508-en-us.pdf", "pdf"),
    ("student-loans", "fsa-direct-loan-sub-unsub-mpn-2020", "https://fsapartners.ed.gov/sites/default/files/attachments/2020-04/SubUnsubMPN.pdf", "pdf"),
    ("student-loans", "fsa-direct-loan-101-mpn-basics", "https://fsapartners.ed.gov/sites/default/files/attachments/2019-07/DLMPNBasics.pdf", "pdf"),
    # Wireless / telecom service agreements
    ("wireless-telecom-agreements", "verizon-customer-agreement-2025", "https://www.verizon.com/support/pdf/collateral/2025/NRBROCH0925ENCAII_National%20brochure%20accessible10-1.pdf", "pdf"),
    ("wireless-telecom-agreements", "verizon-customer-agreement-2022", "https://ss7.vzw.com/is/content/VerizonWireless/customer-agreement-policy-english-pdf-2022pdf", "pdf"),
    ("wireless-telecom-agreements", "att-wireless-terms-of-service-2007", "https://www.att.com/support_static_files/KB/PATTLNK_8282007_152-FMSTCT06070104E.PDF", "pdf"),
    ("wireless-telecom-agreements", "credo-mobile-customer-agreement", "https://assets.credomobile.com/_files/CREDO-MOBILE_customer_agreement.pdf", "pdf"),
    ("wireless-telecom-agreements", "mercury-broadband-customer-service-agreement", "https://mercurybroadband.com/wp-content/uploads/2023/03/Customer-Service-Agreement.pdf", "pdf"),
    # Commercial leases (SEC EDGAR exhibits, HTML -> PDF)
    ("commercial-leases", "sec-1541884-ex10-1-lease", "https://www.sec.gov/Archives/edgar/data/1541884/000107878214000848/f10q033114_ex10z1.htm", "html"),
    ("commercial-leases", "sec-854398-ex10-1-lease", "https://www.sec.gov/Archives/edgar/data/854398/000085439814000028/exhibit101leaseagreementfy.htm", "html"),
    ("commercial-leases", "sec-25354-ex10-2-lease", "https://www.sec.gov/Archives/edgar/data/25354/000002535412000054/exhibit102leaseagreement.htm", "html"),
    ("commercial-leases", "sec-1692415-ex10-1-commercial-lease", "https://www.sec.gov/Archives/edgar/data/1692415/000149315223040050/ex10-1.htm", "html"),
    ("commercial-leases", "sec-1494722-ex10-1-lease-purchase", "https://www.sec.gov/Archives/edgar/data/1494722/000146970913000459/ex10_1leasepurchaseagreement.htm", "html"),
    ("commercial-leases", "sec-1423542-ex10-7-lease-addendum", "https://www.sec.gov/Archives/edgar/data/1423542/000142354214000037/exhibit-107x2014630xleasea.htm", "html"),
]

EDGE_CANDIDATES = [
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
]


def size_bucket(pages: int) -> str:
    if pages <= 5:
        return "small"
    if pages <= 20:
        return "medium"
    return "large"


def describe(pdf: Path) -> dict:
    """Page count, bytes, sha256 and whether the PDF has an extractable text layer."""
    reader = PdfReader(str(pdf))
    pages = len(reader.pages)
    chars = sum(len((p.extract_text() or "").strip()) for p in reader.pages)
    return {
        "pages": pages, "bytes": pdf.stat().st_size,
        "sha256": hashlib.sha256(pdf.read_bytes()).hexdigest(),
        "text_chars": chars, "has_text_layer": chars > 50 * pages,
    }


def download(url: str, dest: Path) -> None:
    # SEC EDGAR rejects browser-like agents; its fair-access policy wants "Name email".
    ua = UA
    if "sec.gov" in url:
        ua = os.environ.get("SEC_USER_AGENT", "")
        if not ua:
            raise RuntimeError('set SEC_USER_AGENT="Your Name you@example.com" to fetch SEC exhibits')
    # curl uses the OS certificate store, which avoids Python SSL issues on Windows
    subprocess.run(
        ["curl", "-sSfL", "--max-time", "120", "-A", ua, "-o", str(dest), url],
        check=True, capture_output=True,
    )


def html_to_pdf(html_path: Path, pdf_path: Path) -> None:
    edge = next((p for p in EDGE_CANDIDATES if Path(p).exists()), None)
    if not edge:
        raise RuntimeError("Microsoft Edge not found; cannot print HTML to PDF")
    subprocess.run(
        [edge, "--headless", "--disable-gpu", "--no-pdf-header-footer",
         f"--print-to-pdf={pdf_path}", html_path.as_uri()],
        check=True, capture_output=True, timeout=120,
    )


def main() -> int:
    ROOT.mkdir(parents=True, exist_ok=True)
    manifest, failures = [], []
    with tempfile.TemporaryDirectory() as tmp:
        tmpdir = Path(tmp)
        for doc_type, name, url, kind in SOURCES:
            existing_file = next(ROOT.glob(f"{doc_type}/*/{name}.pdf"), None)
            if existing_file:
                print(f"have  {doc_type:24} {existing_file.parent.name:6}       {name}")
                continue
            try:
                raw = tmpdir / f"{name}.{'html' if kind == 'html' else 'pdf'}"
                download(url, raw)
                pdf = raw
                if kind == "html":
                    pdf = tmpdir / f"{name}.pdf"
                    html_to_pdf(raw, pdf)
                if pdf.read_bytes()[:5] != b"%PDF-":
                    raise RuntimeError("response is not a PDF")
                pages = len(PdfReader(str(pdf)).pages)
                bucket = size_bucket(pages)
                dest = ROOT / doc_type / bucket / f"{name}.pdf"
                dest.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(pdf, dest)
                entry = {
                    "type": doc_type, "size": bucket, "name": name, **describe(dest),
                    "path": dest.relative_to(ROOT).as_posix(),
                    "source_url": url, "converted_from_html": kind == "html",
                }
                manifest.append(entry)
                print(f"ok    {doc_type:24} {bucket:6} {pages:4}p  {name}")
            except Exception as e:  # keep going; report at the end
                failures.append({"name": name, "url": url, "error": str(e)})
                print(f"FAIL  {doc_type:24} {name}: {e}", file=sys.stderr)

    # Merge with entries added by other scripts (e.g. CUAD sampler)
    mpath = ROOT / "manifest.json"
    existing = json.loads(mpath.read_text()) if mpath.exists() else []
    names = {m["name"] for m in manifest}
    known = {name for _, name, _, _ in SOURCES}
    merged = [
        m for m in existing
        if m["name"] not in names and (m["name"] in known or not m["source_url"].startswith("http"))
    ] + manifest
    merged.sort(key=lambda m: (m["type"], m["size"], m["name"]))
    write_manifest(merged)
    print(f"\n{len(manifest)} downloaded, {len(failures)} failed")
    for f in failures:
        print(f"  - {f['name']}: {f['error']}")
    return 0


MANIFEST_FIELDS = [
    "type", "size", "name", "pages", "bytes", "text_chars", "has_text_layer",
    "sha256", "path", "source_url", "converted_from_html",
]


def write_manifest(entries: list[dict]) -> None:
    (ROOT / "manifest.json").write_text(json.dumps(entries, indent=2))
    with open(ROOT / "manifest.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=MANIFEST_FIELDS)
        w.writeheader()
        w.writerows(entries)


if __name__ == "__main__":
    raise SystemExit(main())
