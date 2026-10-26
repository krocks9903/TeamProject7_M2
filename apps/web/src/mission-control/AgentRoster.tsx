"use client";

import { useEffect, useRef } from "react";
import { AGENTS, type AgentDef } from "./agents";
import type { MissionState } from "./scanState";
import { getSprite } from "./sprites";

function Portrait({ agent }: { agent: AgentDef }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current!.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, 16, 16);
    ctx.drawImage(getSprite(agent, "down", 0), 0, 0);
  }, [agent]);
  return <canvas ref={ref} className="mc-portrait" width={16} height={16} aria-hidden="true" />;
}

const fmtMs = (ms: number) => (ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`);

interface Props {
  state: MissionState;
  /** Current wall-clock time, ticking while a scan runs so working agents show live time. */
  now: number;
}

export function AgentRoster({ state, now }: Props) {
  return (
    <section className="mc-panel" aria-label="Agent roster">
      <h2 className="mc-panel__title">Agents</h2>
      <ul className="mc-roster">
        {AGENTS.map((def) => {
          const v = state.agents[def.id];
          const spent =
            v.status === "working" && v.startedAt !== null
              ? fmtMs(Math.max(0, now - v.startedAt))
              : v.workMs !== null
                ? fmtMs(v.workMs)
                : "—";
          return (
            <li key={def.id} className={`mc-card mc-card--${v.status}`}>
              <Portrait agent={def} />
              <div className="mc-card__body">
                <div className="mc-card__head">
                  <span className="mc-card__name">{def.name}</span>
                  <span className={`mc-pill mc-pill--${v.status}`}>{v.status}</span>
                </div>
                <div className="mc-card__role">{def.role}</div>
                <div className="mc-card__msg" title={v.lastMessage}>
                  {v.lastMessage || "Waiting in the lounge"}
                </div>
                <div className="mc-card__time">Time spent: {spent}</div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
