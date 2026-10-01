import PDFKit from "pdfkit";

/**
 * Builds tiny text PDFs for offline tests (no binary checked into git beyond generation).
 * pdf-parse bundles an old pdf.js build that can't decode Flate-compressed content
 * streams (pdf-lib compresses those unconditionally, no toggle) and also chokes on
 * hand-rolled PDF bytes with manually-computed xref offsets. pdfkit with
 * `compress: false` produces plain-text streams that the old parser can read.
 */
export function buildSimplePdf(lines: string[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFKit({ compress: false, margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.font("Helvetica").fontSize(11);
    for (const line of lines) {
      doc.text(line);
    }
    doc.end();
  });
}

export const FIXTURE_LEASE_LINES = [
  "RESIDENTIAL LEASE AGREEMENT",
  "Tenant may terminate early by paying an early termination fee equal to two months rent.",
  "This lease renews automatically for successive one-year terms unless Tenant gives 60 days written notice of non-renewal.",
  "A late fee of $50 applies if rent is more than five days past due.",
  "The security deposit may be forfeited if Tenant vacates without proper notice.",
];

export const FIXTURE_GYM_LINES = [
  "MEMBERSHIP AGREEMENT",
  "Membership renews automatically each month until cancelled.",
  "Cancellation requires 30 days written notice before the next billing date.",
  "An early cancellation fee of $99 applies during the first year.",
];

/** Hallucination trap: no early termination fee exists; agent must not invent one. */
export const FIXTURE_TRAP_LINES = [
  "SERVICE AGREEMENT",
  "Either party may cancel this agreement at any time with written notice.",
  "There are no penalties for cancellation.",
  "Fees are limited to the monthly subscription price of $12.",
];
