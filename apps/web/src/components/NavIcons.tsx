import type { RiskType } from "@fineprint/shared";

function S({ size = 20, children }: { size?: number; children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export type ViewId = "results" | "summary" | "terms" | "costs" | "clauses" | "map" | "sources";

export function ViewIcon({ id, size }: { id: ViewId; size?: number }) {
  switch (id) {
    case "results":
      return (
        <S size={size}>
          <rect x="4" y="3" width="16" height="18" rx="2" />
          <path d="M8 8h8M8 12h8M8 16h5" />
        </S>
      );
    case "summary":
      return (
        <S size={size}>
          <path d="M5 4h14v16H5z" />
          <path d="M8 9h8M8 13h8M8 17h4" />
        </S>
      );
    case "terms":
      return (
        <S size={size}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </S>
      );
    case "costs":
      return (
        <S size={size}>
          <circle cx="12" cy="12" r="9" />
          <path d="M14.5 9.2c-.5-.8-1.4-1.2-2.5-1.2-1.4 0-2.5.7-2.5 1.8 0 2.4 5 1.2 5 3.6 0 1.1-1.1 1.8-2.5 1.8-1.1 0-2-.4-2.5-1.2M12 6.5V8m0 8v1.5" />
        </S>
      );
    case "clauses":
      return (
        <S size={size}>
          <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
          <path d="M14 3v5h5M9 13h6M9 17h6" />
        </S>
      );
    case "map":
      return (
        <S size={size}>
          <path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2z" />
          <path d="M9 4v14M15 6v14" />
        </S>
      );
    default:
      return (
        <S size={size}>
          <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
          <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
        </S>
      );
  }
}

export function RiskIcon({ type, size }: { type: RiskType; size?: number }) {
  switch (type) {
    case "deposit_forfeiture":
      return (
        <S size={size}>
          <ellipse cx="12" cy="6" rx="7" ry="3" />
          <path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" />
        </S>
      );
    case "late_fee":
      return (
        <S size={size}>
          <circle cx="12" cy="13" r="8" />
          <path d="M12 9v4l2.5 2M9 3h6" />
        </S>
      );
    case "auto_renewal":
      return (
        <S size={size}>
          <path d="M20 12a8 8 0 0 1-14 5.3M4 12a8 8 0 0 1 14-5.3" />
          <path d="M18 3v4h-4M6 21v-4h4" />
        </S>
      );
    case "early_termination":
      return (
        <S size={size}>
          <path d="M14 4h5v16h-5M10 8l-4 4 4 4M6 12h9" />
        </S>
      );
    case "notice_window":
      return (
        <S size={size}>
          <rect x="3" y="4" width="18" height="17" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </S>
      );
    case "liability_shift":
      return (
        <S size={size}>
          <path d="M14.7 6.3a4 4 0 0 0-5 5L3 18l3 3 6.7-6.7a4 4 0 0 0 5-5l-2.4 2.4-2.6-.6-.6-2.6z" />
        </S>
      );
    case "mandatory_arbitration":
      return (
        <S size={size}>
          <path d="M12 3v18M6 21h12M5 8h14M5 8l-2 6a3 3 0 0 0 4 0zM19 8l-2 6a3 3 0 0 0 4 0z" />
        </S>
      );
    case "fee_trap":
      return (
        <S size={size}>
          <path d="M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6" />
        </S>
      );
    default:
      return (
        <S size={size}>
          <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5M9 13h6" />
        </S>
      );
  }
}

export function QuoteIcon({ size }: { size?: number }) {
  return (
    <S size={size}>
      <path d="M9 7H6a2 2 0 0 0-2 2v4h5V9M9 13a4 4 0 0 1-3 4M19 7h-3a2 2 0 0 0-2 2v4h5V9M19 13a4 4 0 0 1-3 4" />
    </S>
  );
}

export function SearchIcon({ size }: { size?: number }) {
  return (
    <S size={size}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </S>
  );
}

export function ArrowIcon({ size }: { size?: number }) {
  return (
    <S size={size}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </S>
  );
}

export function ChevronIcon({ dir, size }: { dir: "left" | "right"; size?: number }) {
  return (
    <S size={size}>
      <path d={dir === "left" ? "m15 18-6-6 6-6" : "m9 18 6-6-6-6"} />
    </S>
  );
}

export function PrintIcon({ size }: { size?: number }) {
  return (
    <S size={size}>
      <path d="M7 9V3h10v6M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2M7 14h10v7H7z" />
    </S>
  );
}

export function CopyIcon({ size }: { size?: number }) {
  return (
    <S size={size}>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V6a2 2 0 0 1 2-2h9" />
    </S>
  );
}

export function RefreshIcon({ size }: { size?: number }) {
  return (
    <S size={size}>
      <path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5" />
    </S>
  );
}
