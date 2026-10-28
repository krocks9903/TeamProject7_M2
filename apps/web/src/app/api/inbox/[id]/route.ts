import { NextResponse } from "next/server";
import { getMailboxStore } from "@fineprint/mcp-mailbox";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const message = await getMailboxStore().getEmail(id);
  if (!message) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json(message);
}
