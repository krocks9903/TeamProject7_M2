"use client";

import { motion } from "motion/react";
import type { RiskType } from "@fineprint/shared";
import { RISK_LABELS } from "@/lib/findings";

export type RiskFilter = RiskType | "all";

interface Props {
  counts: Map<RiskType, number>;
  total: number;
  value: RiskFilter;
  onChange: (value: RiskFilter) => void;
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button type="button" className="chip-btn" aria-pressed={active} onClick={onClick}>
      {active ? (
        <motion.span
          layoutId="chip-pill"
          className="chip-btn__pill"
          transition={{ type: "spring", stiffness: 520, damping: 40 }}
        />
      ) : null}
      <span className="chip-btn__label">{children}</span>
    </button>
  );
}

export function FilterChips({ counts, total, value, onChange }: Props) {
  const types = [...counts.keys()];
  if (types.length < 2) return null;
  return (
    <div className="chips" role="group" aria-label="Filter risks by type">
      <Chip active={value === "all"} onClick={() => onChange("all")}>
        All <span className="chip-btn__count">{total}</span>
      </Chip>
      {types.map((t) => (
        <Chip key={t} active={value === t} onClick={() => onChange(t)}>
          {RISK_LABELS[t]} <span className="chip-btn__count">{counts.get(t)}</span>
        </Chip>
      ))}
    </div>
  );
}
