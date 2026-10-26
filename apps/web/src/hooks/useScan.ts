"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CreateScanResponse, ScanDetail } from "@fineprint/shared";
import {
  classifyServerError,
  makeError,
  validateFile,
  type ScanError,
} from "@/lib/errors";
import { stepForStatus } from "@/lib/findings";

export type ScanPhase = "idle" | "running" | "done" | "error";

export interface ScanState {
  phase: ScanPhase;
  /** Index into PROGRESS_STEPS. */
  step: number;
  detail: ScanDetail | null;
  cacheHit: boolean;
  error: ScanError | null;
  /** Object URL for the uploaded file, used to open the original PDF. */
  fileUrl: string | null;
  fileName: string | null;
}

const INITIAL: ScanState = {
  phase: "idle",
  step: 0,
  detail: null,
  cacheHit: false,
  error: null,
  fileUrl: null,
  fileName: null,
};

const POLL_DEADLINE_MS = 90_000;

function sleep(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) return reject(new DOMException("aborted", "AbortError"));
    const t = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(t);
        reject(new DOMException("aborted", "AbortError"));
      },
      { once: true }
    );
  });
}

/** POST /api/scans via XHR so we can tell when the bytes have finished uploading. */
function postScan(
  file: File,
  signal: AbortSignal,
  onUploaded: () => void
): Promise<CreateScanResponse> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const onAbort = () => xhr.abort();
    signal.addEventListener("abort", onAbort, { once: true });
    xhr.open("POST", "/api/scans");
    xhr.responseType = "json";
    xhr.upload.onload = onUploaded;
    xhr.onerror = () => reject(new Error("network"));
    xhr.onabort = () => reject(new DOMException("aborted", "AbortError"));
    xhr.onload = () => {
      signal.removeEventListener("abort", onAbort);
      const body = xhr.response as (CreateScanResponse & { error?: string }) | null;
      if (xhr.status >= 200 && xhr.status < 300 && body) resolve(body);
      else reject(new Error(body?.error ?? `Upload failed (${xhr.status})`));
    };
    const form = new FormData();
    form.append("file", file);
    xhr.send(form);
  });
}

export function useScan() {
  const [state, setState] = useState<ScanState>(INITIAL);
  const abortRef = useRef<AbortController | null>(null);
  const scanIdRef = useRef<string | null>(null);
  const urlRef = useRef<string | null>(null);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const revokeUrl = useCallback(() => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
  }, []);

  // Cleanup on unmount: stop polling/uploads and release the object URL.
  useEffect(
    () => () => {
      cancel();
      revokeUrl();
    },
    [cancel, revokeUrl]
  );

  const poll = useCallback(async (scanId: string, signal: AbortSignal) => {
    const startedAt = Date.now();
    let delay = 0;
    while (Date.now() - startedAt < POLL_DEADLINE_MS) {
      await sleep(delay, signal);
      delay = Math.min(delay === 0 ? 400 : delay * 1.4, 1500);
      const res = await fetch(`/api/scans/${scanId}`, { signal });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Poll failed (${res.status})`);
      }
      const detail = (await res.json()) as ScanDetail;
      const status = detail.scan.status;
      if (status === "done") {
        setState((s) => ({ ...s, phase: "done", step: stepForStatus("done"), detail }));
        return;
      }
      if (status === "failed") {
        throw new Error(detail.scan.error ?? "Scan failed");
      }
      setState((s) => ({ ...s, step: stepForStatus(status) }));
    }
    setState((s) => ({ ...s, phase: "error", error: makeError("timeout") }));
  }, []);

  const run = useCallback(
    async (work: (signal: AbortSignal) => Promise<void>) => {
      cancel();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        await work(ctrl.signal);
      } catch (err) {
        if (ctrl.signal.aborted) return;
        const message = err instanceof Error ? err.message : String(err);
        const error =
          message === "network" || err instanceof TypeError
            ? makeError("network")
            : classifyServerError(message);
        setState((s) => ({ ...s, phase: "error", error }));
      }
    },
    [cancel]
  );

  const start = useCallback(
    (file: File) => {
      const invalid = validateFile(file);
      if (invalid) {
        cancel();
        setState({ ...INITIAL, phase: "error", error: invalid });
        return;
      }
      revokeUrl();
      scanIdRef.current = null;
      const fileUrl = URL.createObjectURL(file);
      urlRef.current = fileUrl;
      setState({
        ...INITIAL,
        phase: "running",
        fileUrl,
        fileName: file.name,
      });
      void run(async (signal) => {
        // The server reports no status until it responds, so we stay on step 0 honestly.
        const created = await postScan(file, signal, () => {});
        scanIdRef.current = created.scan_id;
        setState((s) => ({
          ...s,
          cacheHit: created.cache_hit,
          step: Math.max(s.step, stepForStatus(created.status)),
        }));
        await poll(created.scan_id, signal);
      });
    },
    [cancel, poll, revokeUrl, run]
  );

  /** After a timeout, keep waiting on the same scan. */
  const resume = useCallback(() => {
    const id = scanIdRef.current;
    if (!id) return;
    setState((s) => ({ ...s, phase: "running", error: null }));
    void run((signal) => poll(id, signal));
  }, [poll, run]);

  const reset = useCallback(() => {
    cancel();
    revokeUrl();
    scanIdRef.current = null;
    setState(INITIAL);
  }, [cancel, revokeUrl]);

  return {
    ...state,
    canResume: state.error?.kind === "timeout" && scanIdRef.current !== null,
    start,
    resume,
    reset,
  };
}
