"use client";

import {
  ChangeEvent,
  DragEvent,
  useCallback,
  useRef,
  useState,
} from "react";

import type {
  FindingRecord,
  ScanDetail,
} from "@fineprint/shared";

import styles from "./prototype.module.css";

export default function PrototypePage() {
  const inputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [findings, setFindings] = useState<FindingRecord[]>([]);
  const [scanMeta, setScanMeta] = useState("");

  function chooseFile(selected?: File) {
    if (!selected) return;

    if (
      selected.type !== "application/pdf" &&
      !selected.name.toLowerCase().endsWith(".pdf")
    ) {
      setError("FinePrint currently accepts PDF documents.");
      return;
    }

    setError("");
    setFile(selected);
    setFindings([]);
    setStatus("");
    setScanMeta("");
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    chooseFile(event.target.files?.[0]);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);

    chooseFile(event.dataTransfer.files?.[0]);
  }

  const pollScan = useCallback(async (scanId: string) => {
    for (let i = 0; i < 60; i++) {
      const response = await fetch(`/api/scans/${scanId}`);

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));

        throw new Error(
          body.error ?? `Poll failed (${response.status})`,
        );
      }

      const detail = (await response.json()) as ScanDetail;

      setStatus(detail.scan.status);

      if (detail.scan.status === "done") {
        setFindings(detail.findings);

        setScanMeta(
          `${detail.document.original_filename} · model ${detail.scan.model} · ${detail.findings.length} grounded finding(s)`,
        );

        return;
      }

      if (detail.scan.status === "failed") {
        throw new Error(
          detail.scan.error ?? "Scan failed",
        );
      }

      await new Promise((resolve) =>
        setTimeout(resolve, 400),
      );
    }

    throw new Error("Timed out waiting for scan");
  }, []);

  async function analyzeDocument() {
    if (!file) return;

    setError("");
    setFindings([]);
    setScanMeta("");
    setAnalyzing(true);
    setStatus("uploading");

    try {
      const body = new FormData();
      body.append("file", file);

      const response = await fetch("/api/scans", {
        method: "POST",
        body,
      });

      const json = await response.json();

      if (!response.ok) {
        throw new Error(
          json.error ?? "Upload failed",
        );
      }

      setStatus(
        json.cache_hit
          ? "done (cache)"
          : json.status,
      );

      await pollScan(json.scan_id);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : String(err),
      );
    } finally {
      setAnalyzing(false);
    }
  }

  function reset() {
    setFile(null);
    setFindings([]);
    setStatus("");
    setError("");
    setScanMeta("");

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  const analysisComplete =
    status === "done" && !analyzing;

  return (
    <main className={styles.page}>
      <nav className={styles.nav}>
        <div className={styles.brand}>
          <div className={styles.logo}>F</div>

          <div>
            <span className={styles.brandName}>
              FinePrint
            </span>

            <span className={styles.brandSubtitle}>
              Document Risk Scanner
            </span>
          </div>
        </div>

        <span className={styles.prototypeBadge}>
          Prototype
        </span>
      </nav>

      <section className={styles.hero}>
        <div className={styles.heroBadge}>
          AI-powered document analysis
        </div>

        <h1>
          Know what could cost you
          <span> before you sign.</span>
        </h1>

        <p>
          Upload a lease, contract, or agreement.
          FinePrint finds the stipulations,
          deadlines, penalties, and fees that
          deserve your attention.
        </p>
      </section>

      <section className={styles.content}>
        {!analysisComplete ? (
          <div className={styles.uploadCard}>
            <div
              className={`${styles.dropZone} ${
                dragging ? styles.dragging : ""
              }`}
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() =>
                setDragging(false)
              }
              onDrop={handleDrop}
              onClick={() =>
                !analyzing &&
                inputRef.current?.click()
              }
            >
              <input
                ref={inputRef}
                type="file"
                accept="application/pdf,.pdf"
                onChange={handleFileChange}
                className={styles.hiddenInput}
                disabled={analyzing}
              />

              <div className={styles.uploadIcon}>
                ↑
              </div>

              {!file ? (
                <>
                  <h2>Upload your document</h2>

                  <p>
                    Drag and drop a PDF here, or
                    click to browse.
                  </p>

                  <span
                    className={styles.fileHint}
                  >
                    PDF documents
                  </span>
                </>
              ) : (
                <>
                  <h2>{file.name}</h2>

                  <p>
                    {(
                      file.size /
                      1024 /
                      1024
                    ).toFixed(2)}{" "}
                    MB · Ready to analyze
                  </p>

                  <span
                    className={styles.fileHint}
                  >
                    Click to choose another file
                  </span>
                </>
              )}
            </div>

            <button
              className={styles.analyzeButton}
              disabled={!file || analyzing}
              onClick={analyzeDocument}
            >
              {analyzing ? (
                <>
                  <span
                    className={styles.spinner}
                  />

                  {status === "uploading"
                    ? "Uploading document..."
                    : `Scanning document${
                        status
                          ? ` · ${status}`
                          : "..."
                      }`}
                </>
              ) : (
                "Analyze Fine Print"
              )}
            </button>

            {error ? (
              <div className={styles.errorBox}>
                <strong>
                  Something went wrong
                </strong>
                <p>{error}</p>
              </div>
            ) : null}

            <div className={styles.trustRow}>
              <span>
                ✓ Clause-level findings
              </span>

              <span>✓ Source citations</span>

              <span>✓ Ranked risks</span>
            </div>

            <p className={styles.disclaimer}>
              FinePrint highlights language in your
              document. It does not provide legal
              advice.
            </p>
          </div>
        ) : (
          <Results
            filename={file?.name ?? "Document.pdf"}
            findings={findings}
            scanMeta={scanMeta}
            onReset={reset}
          />
        )}
      </section>
    </main>
  );
}

function Results({
  filename,
  findings,
  scanMeta,
  onReset,
}: {
  filename: string;
  findings: FindingRecord[];
  scanMeta: string;
  onReset: () => void;
}) {
  const highPriority = findings.filter(
    (finding) =>
      finding.severity === "high" ||
      finding.severity === "critical",
  ).length;

  return (
    <div className={styles.results}>
      <div className={styles.resultsHeader}>
        <div>
          <span
            className={styles.completeBadge}
          >
            Analysis complete
          </span>

          <h2>Your FinePrint Report</h2>

          <p>{filename}</p>

          {scanMeta ? (
            <p className={styles.scanMeta}>
              {scanMeta}
            </p>
          ) : null}
        </div>

        <button
          className={styles.secondaryButton}
          onClick={onReset}
        >
          Scan another document
        </button>
      </div>

      <div className={styles.summary}>
        <div>
          <strong>{findings.length}</strong>
          <span>risks found</span>
        </div>

        <div>
          <strong>{highPriority}</strong>
          <span>high priority</span>
        </div>

        <div>
          <strong>{findings.length}</strong>
          <span>grounded citations</span>
        </div>
      </div>

      <div className={styles.sectionHeading}>
        <div>
          <span>Prioritized findings</span>

          <h3>
            What deserves your attention
          </h3>
        </div>

        <p>Highest financial risk first</p>
      </div>

      <div className={styles.riskList}>
  {findings.length === 0 ? (
    <div className={styles.reportNotice}>
      <strong>No grounded money-loss risks found</strong>
      <p>
        FinePrint completed the scan, but no findings passed
        citation validation. This does not guarantee that the
        document contains no financial risk.
      </p>
    </div>
  ) : (
    findings.map((finding, index) => (
      <article
        className={styles.riskCard}
        key={finding.id}
      >
        <div className={styles.rank}>
          {index + 1}
        </div>

        <div className={styles.riskBody}>
          <div className={styles.riskTop}>
            <h4>
              {finding.risk_type
                .replaceAll("_", " ")
                .replace(/\b\w/g, (char) =>
                  char.toUpperCase(),
                )}
            </h4>

            <span
              className={`${styles.severity} ${
                finding.severity === "high" ||
                finding.severity === "critical"
                  ? styles.high
                  : finding.severity === "medium"
                    ? styles.medium
                    : styles.low
              }`}
            >
              {finding.severity} risk
            </span>
          </div>

          <p className={styles.explanation}>
            {finding.plain_english}
          </p>

          <div className={styles.quote}>
            <span>Grounded source clause</span>

            <blockquote>
              “{finding.quote}”
            </blockquote>

            <strong>
              Page {finding.page}
            </strong>
          </div>
        </div>
      </article>
    ))
  )}
</div>

      <div className={styles.reportNotice}>
        <strong>
          Verify before acting
        </strong>

        <p>
          FinePrint surfaces potentially
          important clauses and validates each
          quote against the uploaded document.
          It does not replace professional legal
          review.
        </p>
      </div>
    </div>
  );
}
