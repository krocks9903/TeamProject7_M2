"use client";

import { animate, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";

const NUM_RE = /^(\D*?)(\d[\d,]*(?:\.\d+)?)(.*)$/;

/**
 * Counts the first number in `text` up from 0 ("$2,500", "60 days", "18%/yr").
 * Text with no number renders as-is. Reduced motion jumps straight to the value.
 */
export function AnimatedNumber({ text, duration = 0.6 }: { text: string; duration?: number }) {
  const reduce = useReducedMotion();
  const m = NUM_RE.exec(text);
  const target = m ? Number(m[2].replace(/,/g, "")) : NaN;
  const decimals = m && m[2].includes(".") ? m[2].split(".")[1].length : 0;
  const hasCommas = !!m && m[2].includes(",");
  const [value, setValue] = useState(reduce ? target : 0);

  useEffect(() => {
    if (!Number.isFinite(target)) return;
    if (reduce) {
      setValue(target);
      return;
    }
    const controls = animate(0, target, {
      duration,
      ease: "easeOut",
      onUpdate: (v) => setValue(v),
    });
    return () => controls.stop();
  }, [target, duration, reduce]);

  if (!m || !Number.isFinite(target)) return <>{text}</>;
  const shown = value.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    useGrouping: hasCommas,
  });
  return (
    <span className="tabular">
      <span className="visually-hidden">{text}</span>
      <span aria-hidden="true">
        {m[1]}
        {shown}
        {m[3]}
      </span>
    </span>
  );
}
