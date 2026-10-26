import { ridgePath } from "@/lib/mountains";

export type BackdropVariant = "dusk" | "ice";

// Static, seeded silhouettes: far (hazy) to near (dark). Computed once.
const LAYERS = [
  { id: "far", d: ridgePath(11, { base: 0.5, amp: 0.34, scale: 520 }), blur: 3 },
  { id: "mid", d: ridgePath(27, { base: 0.62, amp: 0.36, scale: 400 }), blur: 1.5 },
  { id: "near", d: ridgePath(53, { base: 0.78, amp: 0.34, scale: 300 }), blur: 0 },
] as const;

const PALETTE: Record<BackdropVariant, Record<(typeof LAYERS)[number]["id"], [string, string]>> = {
  dusk: {
    far: ["#8d6a78", "#1b2750"],
    mid: ["#4a3f5f", "#121c3b"],
    near: ["#1d2442", "#0b1426"],
  },
  ice: {
    far: ["#dbe8f6", "#eef5fc"],
    mid: ["#bcd3ec", "#e1ecf8"],
    near: ["#a3c1e2", "#d3e2f3"],
  },
};

/**
 * Layered inline-SVG mountain art. Each layer drifts at its own slow speed
 * (CSS, GPU transforms) for a parallax feel. Decorative only.
 */
export function MountainBackdrop({ variant }: { variant: BackdropVariant }) {
  return (
    <div className={`mtn mtn--${variant}`} aria-hidden="true">
      <div className="mtn__glow" />
      {LAYERS.map((l) => {
        const [top, bottom] = PALETTE[variant][l.id];
        const gid = `mtn-${variant}-${l.id}`;
        return (
          <svg
            key={l.id}
            className={`mtn__layer mtn__layer--${l.id}`}
            viewBox="0 0 1600 500"
            preserveAspectRatio="xMidYMax slice"
            focusable="false"
            style={l.blur ? { filter: `blur(${l.blur}px)` } : undefined}
          >
            <defs>
              <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor={top} />
                <stop offset="1" stopColor={bottom} />
              </linearGradient>
            </defs>
            <path d={l.d} fill={`url(#${gid})`} />
          </svg>
        );
      })}
      <div className="mtn__mist" />
    </div>
  );
}
