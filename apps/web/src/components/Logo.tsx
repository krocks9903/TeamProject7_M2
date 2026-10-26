/** Brand mark: a document with a magnifier lens. */
export function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="fp-logo-grad" x1="4" y1="2" x2="28" y2="30" gradientUnits="userSpaceOnUse">
          <stop stopColor="#9bbcff" />
          <stop offset="1" stopColor="#6f8cff" />
        </linearGradient>
      </defs>
      <path
        d="M8 3h9.5L24 9.5V15"
        stroke="url(#fp-logo-grad)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8 3a2 2 0 0 0-2 2v22a2 2 0 0 0 2 2h6"
        stroke="url(#fp-logo-grad)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M17.5 3v6.5H24" stroke="url(#fp-logo-grad)" strokeWidth="2" strokeLinejoin="round" />
      <path d="M10 13h6M10 17h4" stroke="url(#fp-logo-grad)" strokeWidth="2" strokeLinecap="round" />
      <circle cx="21" cy="22" r="5" stroke="#5eead4" strokeWidth="2" />
      <path d="m24.7 25.7 3.3 3.3" stroke="#5eead4" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}
