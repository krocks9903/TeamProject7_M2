import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { DocumentPage } from "@fineprint/shared";
import { chunkPagesForAgent, isUnreadablePage, unreadablePages } from "@fineprint/mcp-document";
import {
  dedupeFindings,
  extractRisksWithModel,
  mockExtractRisks,
  parseModelJson,
  validateCitations,
  type ProviderClient,
} from "@fineprint/agent";
import { formatPageRanges } from "../apps/web/src/lib/findings.ts";

const PROSE =
  "You must pay the rent on or before the first day of the month and you will be charged a late fee of $100 if it is not paid by the third. ";
const DINGBATS = "✁✂✄☎✆✝✞✟✠✡☛☞✌✍✎✏✑✒✓✔✕ ".repeat(12);
const SOUP = "!\"#$%&'()*+,-./0 !\"#$$%&'(\"')*+,-'./0\"1&\" ".repeat(12);
const SIGNATURES =
  "Signature Details Signer IP Address Date Signed 1 Krish S Shah Primary (15826804) 2605:ad80:10:1417:b0fd: 01/23/2025 03:56:38 PM 2 Tristin Albright Owner/Manager 2605:ad80:10:1403:cc94: 01/23/2025 04:38:21 PM";

const page = (n: number, text: string): DocumentPage => ({ page: n, text });

describe("unreadable page detection", () => {
  it("flags symbol-glyph and punctuation-soup pages, not prose or signature tables", () => {
    assert.equal(isUnreadablePage(PROSE.repeat(5)), false);
    assert.equal(isUnreadablePage(DINGBATS), true);
    assert.equal(isUnreadablePage(SOUP), true);
    assert.equal(isUnreadablePage(SIGNATURES), false);
  });

  it("keeps a mostly readable page that has a few garbled headings", () => {
    assert.equal(isUnreadablePage(`${DINGBATS.slice(0, 30)} ${PROSE.repeat(6)}`), false);
  });

  it("lists unreadable page numbers in order", () => {
    const pages = [page(1, PROSE.repeat(4)), page(2, DINGBATS), page(3, SOUP), page(4, SIGNATURES)];
    assert.deepEqual(unreadablePages(pages), [2, 3]);
  });
});

describe("chunking covers the whole document", () => {
  it("never drops readable pages and skips unreadable ones", () => {
    const pages = Array.from({ length: 30 }, (_, i) => page(i + 1, PROSE.repeat(30)));
    pages[9] = page(10, DINGBATS);
    const chunks = chunkPagesForAgent(pages, 10_000);
    assert.ok(chunks.length > 1);
    const seen = new Set([...chunks.join("\n").matchAll(/--- PAGE (\d+) ---/g)].map((m) => Number(m[1])));
    assert.equal(seen.has(10), false);
    for (let n = 1; n <= 30; n++) if (n !== 10) assert.ok(seen.has(n), `page ${n} missing`);
    for (const c of chunks) assert.ok(c.length <= 10_000 + 200);
  });
});

describe("mock extractor", () => {
  it("does not report a clause that says the opposite", () => {
    const pages = [page(1, "This Lease Contract DOES NOT automatically renew. There are no penalties for cancellation.")];
    assert.deepEqual(mockExtractRisks(pages).findings, []);
  });

  it("does not quote garbled text and does not repeat one sentence under two risk types", () => {
    const sentence = "A late fee of $50 applies if rent is more than five days past due.";
    const pages = [page(1, `${DINGBATS} ${sentence}`)];
    const f = mockExtractRisks(pages).findings;
    assert.equal(f.length, 1);
    assert.equal(f[0].quote, sentence);
  });
});

describe("citation validation with garbled pages", () => {
  it("rejects citations on unreadable pages and symbol-only quotes", () => {
    const pages = [page(1, PROSE.repeat(3)), page(2, DINGBATS)];
    const out = validateCitations(
      [
        { risk_type: "late_fee", severity: "medium", plain_english: "x", quote: DINGBATS.slice(0, 40), page: 2 },
        { risk_type: "late_fee", severity: "medium", plain_english: "x", quote: "you will be charged a late fee of $100", page: 1 },
      ],
      pages
    );
    assert.equal(out.length, 1);
    assert.equal(out[0].page, 1);
  });

  it("still grounds a quote that sits next to removed symbol runs", () => {
    const pages = [page(1, `✁✂✄ ${PROSE} ☎✆✝`)];
    const out = validateCitations(
      [{ risk_type: "late_fee", severity: "medium", plain_english: "x", quote: "you will be charged a late fee of $100", page: 1 }],
      pages
    );
    assert.equal(out.length, 1);
  });
});

describe("model output handling", () => {
  it("parses JSON wrapped in code fences or chatter", () => {
    assert.deepEqual(parseModelJson('```json\n{"findings":[]}\n```'), { findings: [] });
    assert.deepEqual(parseModelJson('Here you go: {"findings":[]} hope that helps'), { findings: [] });
    assert.equal(parseModelJson("not json"), null);
  });

  it("de-duplicates the same quote on the same page", () => {
    const f = { risk_type: "late_fee" as const, severity: "medium" as const, plain_english: "x", quote: "A late fee of $5 applies.", page: 2 };
    assert.equal(dedupeFindings([f, { ...f, risk_type: "fee_trap" }, { ...f, page: 3 }]).length, 2);
  });

  const stub = (reply: (userMsg: string) => string) => {
    const seenPages = new Set<number>();
    const provider = {
      name: "nrp",
      model: "stub",
      client: {
        chat: {
          completions: {
            create: async (args: { messages: Array<{ role: string; content: string }> }) => {
              const user = args.messages.find((m) => m.role === "user")!.content;
              for (const m of user.matchAll(/--- PAGE (\d+) ---/g)) seenPages.add(Number(m[1]));
              return { choices: [{ message: { content: reply(user) } }] };
            },
          },
        },
      },
    } as unknown as ProviderClient;
    return { provider, seenPages };
  };

  it("sends every readable page to the model across several calls and merges the results", async () => {
    const pages = Array.from({ length: 12 }, (_, i) => page(i + 1, PROSE.repeat(40)));
    const { provider, seenPages } = stub((user) => {
      const first = Number(/--- PAGE (\d+) ---/.exec(user)![1]);
      return (
        "```json\n" +
        JSON.stringify({
          findings: [{ risk_type: "late_fee", severity: "medium", plain_english: "Late fee.", quote: "you will be charged a late fee of $100", page: first }],
        }) +
        "\n```"
      );
    });
    const { output } = await extractRisksWithModel(provider, pages);
    assert.equal(seenPages.size, 12);
    assert.ok(output.findings.length > 1, "findings from several chunks are merged");
  });

  it("fails loudly (not silently empty) when the model never returns usable JSON", async () => {
    const pages = [page(1, PROSE.repeat(5))];
    const { provider } = stub(() => "sorry, I cannot do that");
    await assert.rejects(() => extractRisksWithModel(provider, pages), /unusable output/);
  });
});

describe("formatPageRanges", () => {
  it("collapses consecutive pages", () => {
    assert.equal(formatPageRanges([31, 32, 36, 37, 38, 40]), "31–32, 36–38, 40");
    assert.equal(formatPageRanges([5]), "5");
    assert.equal(formatPageRanges([]), "");
  });
});
