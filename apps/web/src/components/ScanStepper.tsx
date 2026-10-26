"use client";

import { PROGRESS_STEPS } from "@/lib/findings";
import { AnimatedCheck } from "./AnimatedCheck";

interface Props {
  step: number;
  cacheHit: boolean;
}

const STATE_LABEL = { done: "Completed", active: "In progress", todo: "Pending" } as const;

/** Reading document > Finding risks > Checking quotes > Done, mapped from ScanStatus. */
export function ScanStepper({ step, cacheHit }: Props) {
  const last = PROGRESS_STEPS.length - 1;
  const clamped = Math.min(step, last);
  return (
    <div className="stepper">
      {/* Polite live region: announces step changes, not the decorative list below. */}
      <p className="visually-hidden" role="status" aria-live="polite">
        Step {clamped + 1} of {PROGRESS_STEPS.length}: {PROGRESS_STEPS[clamped]}
        {cacheHit ? ". We’ve seen this exact document before, so this is quick." : ""}
      </p>
      <ol className="stepper__list">
        {PROGRESS_STEPS.map((label, i) => {
          // The last step ("Done") counts as complete once reached.
          const state = i < step || (i === last && step >= last) ? "done" : i === step ? "active" : "todo";
          return (
            <li
              key={label}
              className={`stepper__item stepper__item--${state}`}
              aria-current={state === "active" ? "step" : undefined}
            >
              <span className="stepper__dot" aria-hidden="true">
                {state === "done" ? <AnimatedCheck size={12} /> : state === "active" ? <span className="stepper__pulse" /> : null}
              </span>
              <span className="stepper__label">{label}</span>
              <span className="stepper__state">{STATE_LABEL[state]}</span>
            </li>
          );
        })}
      </ol>
      {cacheHit ? (
        <p className="stepper__cache">
          Cached result: we&rsquo;ve scanned this exact file before, so we&rsquo;re reusing the earlier analysis.
        </p>
      ) : null}
    </div>
  );
}
