/**
 * Triage an email: score body for money/renewal language, extract deadlines,
 * optionally scan PDF attachments through the document orchestrator.
 */

import { readFile } from "node:fs/promises";
import type { CalendarEvent, EmailMessage, RiskFinding } from "@fineprint/shared";
import { getMailboxStore } from "@fineprint/mcp-mailbox";
import { extractDeadlineEvents } from "./deadlines.js";
import { Orchestrator, type UploadInput } from "./orchestrator.js";
import { mockExtractRisks, extractRisksWithModel } from "./persona.js";
import { resolveProvider } from "./provider.js";
import { rankFindings, validateCitations } from "./validator.js";
import type { DocumentPage } from "@fineprint/shared";

export interface EmailTriageResult {
  email: EmailMessage;
  body_findings: RiskFinding[];
  attachment_scans: Array<{
    filename: string;
    scan_id?: string;
    status: string;
    findings: RiskFinding[];
    error?: string;
  }>;
  calendar_events: CalendarEvent[];
}

function bodyAsPages(email: EmailMessage): DocumentPage[] {
  return [{ page: 1, text: `${email.subject}\n\n${email.body_text}` }];
}

export async function triageEmail(
  emailId: string,
  opts: { scanAttachments?: boolean; ownerId?: string } = {}
): Promise<EmailTriageResult> {
  const mailbox = getMailboxStore();
  const email = await mailbox.getEmail(emailId);
  if (!email) throw new Error(`email not found: ${emailId}`);

  const pages = bodyAsPages(email);
  const provider = resolveProvider();
  const { output } = await extractRisksWithModel(provider, pages);
  const body_findings = rankFindings(validateCitations(output.findings, pages));

  const calendar_events: CalendarEvent[] = [];
  for (const draft of extractDeadlineEvents(email.body_text, {
    related_email_id: email.id,
    source: "email",
    titlePrefix: email.subject.slice(0, 40),
  })) {
    const saved = await mailbox.proposeCalendarEvent(draft);
    calendar_events.push(saved);
  }

  const attachment_scans: EmailTriageResult["attachment_scans"] = [];
  if (opts.scanAttachments !== false) {
    const orch = new Orchestrator();
    for (const att of email.attachments) {
      if (att.mime !== "application/pdf" || !att.path) {
        attachment_scans.push({
          filename: att.filename,
          status: "skipped",
          findings: [],
          error: "not a PDF path",
        });
        continue;
      }
      try {
        const buffer = await readFile(att.path);
        const input: UploadInput = {
          ownerId: opts.ownerId ?? "email-triage",
          filename: att.filename,
          mime: "application/pdf",
          buffer,
        };
        const res = await orch.createAndProcess(input);
        const detail = await orch.getScanDetail(res.scan_id);
        attachment_scans.push({
          filename: att.filename,
          scan_id: res.scan_id,
          status: res.status,
          findings: detail?.findings ?? [],
        });
      } catch (err) {
        attachment_scans.push({
          filename: att.filename,
          status: "failed",
          findings: [],
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  return { email, body_findings, attachment_scans, calendar_events };
}

/** Offline helper for tests — body-only mock extraction */
export function triageEmailBodyMock(email: EmailMessage): RiskFinding[] {
  const pages = bodyAsPages(email);
  return rankFindings(
    validateCitations(mockExtractRisks(pages).findings, pages)
  );
}
