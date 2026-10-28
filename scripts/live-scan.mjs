// Runs real scans through the M3 pipeline and prints events, findings and drops.
// Usage (after npm run build): node scripts/live-scan.mjs <pdf> [<pdf> ...]
// Uses MODEL_PROVIDER etc. from .env and a throwaway data directory, so nothing is cached.
import { readFileSync, mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pdfs = process.argv.slice(2);
for (const line of readFileSync(path.join(repo, ".env"), "utf8").split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
}
const dataDir = mkdtempSync(path.join(os.tmpdir(), "fp-live-"));
process.env.FINEPRINT_DATA_DIR = dataDir;
process.env.FINEPRINT_KNOWLEDGE_DIR = path.join(dataDir, "knowledge");

const agent = await import(pathToFileURL(path.join(repo, "packages/agent/dist/index.js")).href);
const store = agent.resetStoreForTests(dataDir);
agent.resetKnowledgeStoreForTests(path.join(dataDir, "knowledge"));
const orch = new agent.Orchestrator(store);

for (const pdf of pdfs) {
  console.log(`\n================ ${path.basename(pdf)}`);
  const t0 = Date.now();
  let res;
  try {
    res = await orch.createAndProcess({
      ownerId: "live-eval",
      filename: path.basename(pdf),
      mime: "application/pdf",
      buffer: readFileSync(pdf),
    });
  } catch (err) {
    console.log("SCAN FAILED:", err instanceof Error ? err.message : err);
  }
  const wall = Date.now() - t0;
  if (!res) continue;
  const events = await orch.getEvents(res.scan_id);
  let tokens = 0;
  for (const e of events) {
    if (typeof e.data?.tokens === "number") tokens += e.data.tokens;
    console.log(`[${e.agent}/${e.type}] ${e.message}`);
  }
  const detail = await orch.getScanDetail(res.scan_id);
  console.log(`\nstatus=${res.status} wall=${(wall / 1000).toFixed(1)}s tokens=${tokens} findings=${detail?.findings.length}`);
  for (const f of detail?.findings ?? []) {
    console.log(`  - [${f.severity}] ${f.risk_type} p${f.page}: ${f.quote.slice(0, 140)}`);
  }
}
console.log(`\ndata dir: ${dataDir}`);
