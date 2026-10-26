import { readFile } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

const SAMPLE = path.join(
  "datasets",
  "documents",
  "commercial-leases",
  "small",
  "sec-1692415-ex10-1-commercial-lease.pdf"
);

/** Streams the repo's sample commercial lease so Mission Control can scan it with one click. */
export async function GET() {
  // `next dev` runs from apps/web, the root scripts from the repo root; try both.
  for (const root of [process.cwd(), path.resolve(process.cwd(), "../..")]) {
    try {
      const buf = await readFile(path.join(root, SAMPLE));
      return new Response(new Uint8Array(buf), {
        headers: { "Content-Type": "application/pdf" },
      });
    } catch {
      /* try the next root */
    }
  }
  return Response.json({ error: "sample lease not found" }, { status: 404 });
}
