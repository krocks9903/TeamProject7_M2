import { NextResponse } from "next/server";
import { getOrchestrator } from "@fineprint/agent";
import { unreadablePages } from "@fineprint/mcp-document";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const detail = await getOrchestrator().getScanDetail(id);
  if (!detail) {
    return NextResponse.json({ error: "scan not found" }, { status: 404 });
  }
  // Strip full page text from client response (PII minimization), but report which
  // pages could not be read so the UI can say what was not scanned.
  const { pages, ...rest } = detail;
  return NextResponse.json({
    ...rest,
    unreadable_pages: pages ? unreadablePages(pages) : [],
  });
}
