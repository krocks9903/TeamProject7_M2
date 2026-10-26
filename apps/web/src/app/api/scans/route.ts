import { NextResponse } from "next/server";
import { getOrchestrator } from "@fineprint/agent";

export const runtime = "nodejs";

const DEMO_OWNER =
  process.env.DEMO_OWNER_ID ?? "00000000-0000-4000-8000-000000000001";

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file field required" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const mime = file.type || "application/pdf";
    const orchestrator = getOrchestrator();
    // ?async=1 returns the scan id immediately so clients can follow /events live.
    const isAsync = new URL(req.url).searchParams.get("async") === "1";
    const run = isAsync ? orchestrator.startScan : orchestrator.createAndProcess;
    const result = await run.call(orchestrator, {
      ownerId: DEMO_OWNER,
      filename: file.name || "document.pdf",
      mime,
      buffer,
    });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
