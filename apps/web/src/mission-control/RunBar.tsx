"use client";

interface Props {
  busy: boolean;
  error: string | null;
  onSample: () => void;
}

/** Testing aid only: scans normally come from the public site and show up here by themselves. */
export function RunBar({ busy, error, onSample }: Props) {
  return (
    <div className="mc-run">
      <button type="button" className="mc-btn" disabled={busy} onClick={onSample}>
        Run sample lease
      </button>
      <span className="mc-run__hint">For testing. Real scans from the main site appear here automatically.</span>
      {error ? (
        <p className="mc-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
