"use client";

import type { MissionState } from "./scanState";

interface Props {
  state: MissionState;
  now: number;
}

const dash = (v: unknown) => (v === null || v === undefined ? "—" : String(v));

export function ScanCard({ state, now }: Props) {
  const s = state.scan;
  const end = s.endedAt ?? now;
  const elapsed = s.startedAt === null ? null : Math.max(0, end - s.startedAt);
  const status = s.failed ? "failed" : s.done ? "done" : s.startedAt ? "running" : "no scan";

  return (
    <section className="mc-panel" aria-label="Current scan">
      <h2 className="mc-panel__title">Current scan</h2>
      <dl className="mc-scan">
        <div><dt>Status</dt><dd>{status}</dd></div>
        <div><dt>File</dt><dd title={s.filename ?? ""}>{dash(s.filename)}</dd></div>
        <div><dt>Pages</dt><dd>{dash(s.pages)}</dd></div>
        <div><dt>Model</dt><dd>{s.model ? `${s.provider ?? ""} ${s.model}`.trim() : "—"}</dd></div>
        <div><dt>Elapsed</dt><dd>{elapsed === null ? "—" : `${(elapsed / 1000).toFixed(1)} s`}</dd></div>
        <div>
          <dt>Findings</dt>
          <dd>
            {s.kept === null ? (
              s.done && s.cacheHit ? "reused from cache" : "—"
            ) : (
              <>
                <span className="mc-kept">{s.kept} kept</span>
                {" / "}
                <span className="mc-dropped">{s.dropped ?? 0} dropped</span>
              </>
            )}
          </dd>
        </div>
      </dl>
    </section>
  );
}
