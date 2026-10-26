interface Props {
  /** 0 to 100 */
  percent: number;
  size?: number;
  stroke?: number;
  /** Rotating outer arc, for "working" states. */
  spinning?: boolean;
  /** Replaces the default "NN%" in the middle. */
  children?: React.ReactNode;
  label?: string;
}

/** Circular progress. The fill animates with a CSS transition; the optional arc rotates. */
export function ProgressRing({ percent, size = 44, stroke = 4, spinning, children, label }: Props) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, percent));
  return (
    <div
      className={`ring${spinning ? " ring--spin" : ""}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label={label ?? `${Math.round(pct)} percent`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" focusable="false">
        <circle className="ring__track" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} fill="none" />
        <circle
          className="ring__fill"
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct / 100)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      {spinning ? <span className="ring__orbit" aria-hidden="true" /> : null}
      <span className="ring__center" aria-hidden="true">
        {children ?? `${Math.round(pct)}%`}
      </span>
    </div>
  );
}
