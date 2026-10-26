import { NextResponse } from "next/server";
import { triageEmail } from "@fineprint/agent";

export const runtime = "nodejs";

const DEMO_OWNER =
  process.env.DEMO_OWNER_ID ?? "00000000-0000-4000-8000-000000000001";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await ctx.params;
  try {
    const body = await req.json().catch(() => ({}));
    const scanAttachments = body.scanAttachments !== false;
    const result = await triageEmail(id, {
      scanAttachments,
      ownerId: DEMO_OWNER,
    });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
