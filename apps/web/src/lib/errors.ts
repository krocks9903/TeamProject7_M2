import { MAX_UPLOAD_BYTES_DEFAULT } from "@fineprint/shared";

export type ScanErrorKind =
  | "wrong_type"
  | "too_large"
  | "empty"
  | "no_text"
  | "failed"
  | "timeout"
  | "network";

export interface ScanError {
  kind: ScanErrorKind;
  title: string;
  /** What happened. */
  message: string;
  /** What to do next. */
  next: string;
}

export const MAX_UPLOAD_MB = MAX_UPLOAD_BYTES_DEFAULT / (1024 * 1024);

export function makeError(kind: ScanErrorKind, detail?: string): ScanError {
  switch (kind) {
    case "wrong_type":
      return {
        kind,
        title: "That file isn't a PDF",
        message: "FinePrint reads PDF files only.",
        next: "Export or print your document as a PDF, then drop it here again.",
      };
    case "too_large":
      return {
        kind,
        title: "That file is too large",
        message: `PDFs must be ${MAX_UPLOAD_MB} MB or smaller.`,
        next: "Try a smaller export (for example “Reduce file size” in your PDF viewer) or scan just the pages with fees and termination terms.",
      };
    case "empty":
      return {
        kind,
        title: "That file is empty",
        message: "The PDF has no content.",
        next: "Re-download the document and try again.",
      };
    case "no_text":
      return {
        kind,
        title: "We couldn't read any text in that PDF",
        message:
          "It may be a photo or scan of paper, or it may be password-protected.",
        next: "Use a text-based PDF (one where you can select words), or remove the password and try again.",
      };
    case "timeout":
      return {
        kind,
        title: "This is taking longer than expected",
        message: "The scan didn't finish in time. Your document is still safe.",
        next: "Keep waiting, or try again in a minute. Very long documents can take longer.",
      };
    case "network":
      return {
        kind,
        title: "We couldn't reach FinePrint",
        message: detail || "The connection dropped.",
        next: "Check your internet connection and try again.",
      };
    default:
      return {
        kind: "failed",
        title: "The scan didn't complete",
        message: detail || "Something went wrong while scanning.",
        next: "Try again. If it keeps failing, try a different copy of the document.",
      };
  }
}

/** Client-side checks, mirroring the server so users get instant feedback. */
export function validateFile(file: File): ScanError | null {
  const isPdf =
    file.type === "application/pdf" || /\.pdf$/i.test(file.name);
  if (!isPdf) return makeError("wrong_type");
  if (file.size === 0) return makeError("empty");
  if (file.size > MAX_UPLOAD_BYTES_DEFAULT) return makeError("too_large");
  return null;
}

/** Map a server error string (from the API contract) to a friendly error. */
export function classifyServerError(message: string): ScanError {
  if (/only application\/pdf/i.test(message)) return makeError("wrong_type");
  if (/exceeds max size/i.test(message)) return makeError("too_large");
  if (/empty pdf/i.test(message)) return makeError("empty");
  if (/no extractable text/i.test(message)) return makeError("no_text");
  return makeError("failed", message);
}
