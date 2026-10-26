/**
 * Generates apps/web/public/sample-lease.pdf (a fictional lease for the
 * "Try a sample lease" button). Run: npx tsx apps/web/scripts/make-sample-lease.ts
 */
import { createWriteStream } from "node:fs";
import path from "node:path";
import PDFKit from "pdfkit";

const pages: string[][] = [
  [
    "SAMPLE RESIDENTIAL LEASE AGREEMENT (FICTIONAL)",
    "This sample lease is made up for demonstration. It is between Maple Court Apartments (Landlord) and the resident (Tenant) for Unit 4B.",
    "Monthly rent is $1,850 and is due on the first day of each month.",
    "A late fee of $75 plus interest at 18% per year applies if rent is more than five days past due.",
    "Tenant shall pay a returned-payment charge of $40 for every check that is not honored.",
  ],
  [
    "SECURITY DEPOSIT AND TERM",
    "Tenant will pay a security deposit of $2,500 before move-in.",
    "The security deposit may be forfeited if Tenant vacates without giving proper notice.",
    "This lease renews automatically for successive one-year terms unless Tenant gives 60 days written notice of non-renewal before the end of the term.",
    "Tenant may terminate early only by paying an early termination fee equal to two months rent.",
  ],
  [
    "RESPONSIBILITIES AND DISPUTES",
    "Tenant shall be responsible for all repairs to appliances and plumbing fixtures, at Tenant's sole expense.",
    "Any dispute under this lease will be resolved by binding arbitration, and Tenant waives the right to a jury trial.",
    "Move-out inspection must be requested at least 10 business days before the lease ends.",
  ],
];

const out = path.resolve(import.meta.dirname, "../public/sample-lease.pdf");
const doc = new PDFKit({ compress: false, margin: 56 });
doc.pipe(createWriteStream(out));
pages.forEach((lines, i) => {
  if (i > 0) doc.addPage();
  doc.font("Helvetica").fontSize(12);
  lines.forEach((l, j) => {
    doc.text(l, { paragraphGap: 12 });
    if (j === 0) doc.moveDown(0.5);
  });
});
doc.end();
console.log("wrote", out);
