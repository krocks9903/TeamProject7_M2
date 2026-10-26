import type { Severity } from "@fineprint/shared";

interface IconProps {
  size?: number;
}

function Svg({
  size = 16,
  children,
}: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

/** Each severity has a distinct shape so it never relies on color alone. */
export function SeverityIcon({ severity, size }: { severity: Severity } & IconProps) {
  switch (severity) {
    case "critical":
      return (
        <Svg size={size}>
          <path d="M8.5 2h7L22 8.5v7L15.5 22h-7L2 15.5v-7z" />
          <path d="M12 7v6M12 16.5v.01" />
        </Svg>
      );
    case "high":
      return (
        <Svg size={size}>
          <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
          <path d="M12 9v4M12 17v.01" />
        </Svg>
      );
    case "medium":
      return (
        <Svg size={size}>
          <circle cx="12" cy="12" r="10" />
          <path d="M12 8v4M12 16v.01" />
        </Svg>
      );
    default:
      return (
        <Svg size={size}>
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-5M12 8v.01" />
        </Svg>
      );
  }
}

export function CheckIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M20 6 9 17l-5-5" />
    </Svg>
  );
}

export function UploadIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 16V4M7 9l5-5 5 5M4 20h16" />
    </Svg>
  );
}

export function CalendarIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </Svg>
  );
}

export function CloseIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M18 6 6 18M6 6l12 12" />
    </Svg>
  );
}

export function DocIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6M8 13h8M8 17h8" />
    </Svg>
  );
}

export function InfoIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-5M12 8v.01" />
    </Svg>
  );
}

export function AlertIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 7v6M12 16.5v.01" />
    </Svg>
  );
}
