"use client";

import { useEffect, useRef, useState } from "react";
import type { ScanEvent } from "@fineprint/shared";
import { OfficeEngine, WORLD_H, WORLD_W, type BubbleView } from "./OfficeEngine";

interface Props {
  events: ScanEvent[];
}

/** Hosts the canvas, runs the animation loop and overlays speech bubbles as crisp HTML. */
export function OfficeCanvas({ events }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<OfficeEngine | null>(null);
  const processed = useRef(0);
  const [bubbles, setBubbles] = useState<BubbleView[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const family =
      getComputedStyle(canvas).getPropertyValue("--mc-pixel-font").trim() ||
      '"Press Start 2P", monospace';
    const engine = new OfficeEngine({
      reducedMotion: motion.matches,
      fontFamily: family,
      onBubbles: setBubbles,
    });
    engineRef.current = engine;
    processed.current = 0;
    const onMotion = () => engine.setReducedMotion(motion.matches);
    motion.addEventListener("change", onMotion);

    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      engine.update(Math.max(0, Math.min(now - last, 100))); // rAF time can precede our start time
      last = now;
      engine.draw(ctx);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    // the pixel font loads asynchronously; the loop repaints every frame so it shows up when ready
    void document.fonts?.load(`8px ${family}`);

    return () => {
      cancelAnimationFrame(raf);
      motion.removeEventListener("change", onMotion);
      engineRef.current = null;
    };
  }, []);

  // Feed new real events to the engine; a shorter list means a new scan started.
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    if (events.length < processed.current) {
      engine.reset();
      processed.current = 0;
    }
    for (let i = processed.current; i < events.length; i++) engine.pushEvent(events[i]);
    processed.current = events.length;
  }, [events]);

  return (
    <div className="mc-office">
      <canvas
        ref={canvasRef}
        className="mc-canvas"
        width={WORLD_W}
        height={WORLD_H}
        role="img"
        aria-label="Pixel-art office. Each pipeline stage is a character that walks to its desk when its step runs."
      />
      {bubbles.map((b) => (
        <div
          key={b.id}
          className={`mc-bubble mc-bubble--${b.tone}`}
          style={{
            left: `${(b.x / WORLD_W) * 100}%`,
            top: `${(b.y / WORLD_H) * 100}%`,
          }}
        >
          {b.tone === "err" ? <strong>! </strong> : null}
          {b.text}
        </div>
      ))}
    </div>
  );
}
