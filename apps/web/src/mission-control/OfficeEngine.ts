/**
 * The office simulation + renderer. It knows nothing about React or fetching: it is fed real
 * ScanEvents via pushEvent() and turns each one into a queued action for the right character
 * (walk, speak, stamp). With no events, every character just sits in the lounge.
 */
import type { ScanEvent } from "@fineprint/shared";
import { AGENTS, type AgentDef } from "./agents";
import {
  BIN_TILE,
  CLOCK_TILE,
  COLS,
  FURNITURE,
  ROOMS,
  ROWS,
  TILE,
  WALK_GRID,
  isDoor,
} from "./officeMap";
import { findPath, type Point } from "./pathfinding";
import { getSprite, WALK_CYCLE, WORK_CYCLE, type Dir, type Frame } from "./sprites";

export const WORLD_W = COLS * TILE;
export const WORLD_H = ROWS * TILE;

const ACCENT = "#ffb454";
const ALERT = "#ff4d4d";
const SPEED = 64; // px per second
const STAMP_MS = 1500;

export type BubbleTone = "info" | "ok" | "err" | "stamp";

export interface BubbleView {
  id: string;
  text: string;
  tone: BubbleTone;
  /** Pixel position in world space: horizontal centre and the top of the character. */
  x: number;
  y: number;
}

type Action =
  | { k: "goto"; to: Point }
  | { k: "say"; text: string; ms: number; tone: BubbleTone; sticky?: boolean }
  | { k: "stamp"; quote: string }
  | { k: "working"; on: boolean };

interface Actor {
  def: AgentDef;
  x: number;
  y: number;
  tile: Point;
  path: Point[];
  dir: Dir;
  working: boolean;
  queue: Action[];
  current: Action | null;
  t: number;
  walkT: number;
  bubble: { text: string; tone: BubbleTone; sticky: boolean } | null;
  stampStart: number | null;
  stampText: string;
}

export interface EngineOptions {
  reducedMotion: boolean;
  fontFamily: string;
  onBubbles: (b: BubbleView[]) => void;
  now?: () => Date;
}

const truncate = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

export class OfficeEngine {
  private actors: Actor[];
  private time = 0;
  private lastBubbleKey = "";
  private paperInBin = 0;

  constructor(private opts: EngineOptions) {
    this.actors = AGENTS.map((def) => this.makeActor(def));
  }

  setReducedMotion(v: boolean) {
    this.opts.reducedMotion = v;
  }

  private makeActor(def: AgentDef): Actor {
    return {
      def,
      x: def.home.x * TILE,
      y: def.home.y * TILE,
      tile: { ...def.home },
      path: [],
      dir: "down",
      working: false,
      queue: [],
      current: null,
      t: 0,
      walkT: 0,
      bubble: null,
      stampStart: null,
      stampText: "",
    };
  }

  /** Everyone back to the lounge; used when a new scan starts. */
  reset() {
    this.actors = AGENTS.map((def) => this.makeActor(def));
    this.paperInBin = 0;
    this.lastBubbleKey = "";
    this.opts.onBubbles([]);
  }

  /** Translates one real scan event into character actions. */
  pushEvent(e: ScanEvent) {
    const a = this.actors.find((x) => x.def.id === e.agent);
    if (!a) return;
    const d = e.data ?? {};
    if (e.type === "start") {
      a.queue.push(
        { k: "goto", to: a.def.desk },
        { k: "working", on: true },
        { k: "say", text: e.message, ms: 1400, tone: "info" }
      );
    } else if (e.type === "progress") {
      if (d.droppedQuote) {
        a.queue.push({ k: "stamp", quote: d.droppedQuote.quote });
      } else {
        a.queue.push({ k: "say", text: e.message, ms: 1300, tone: "info" });
      }
    } else if (e.type === "finish") {
      a.queue.push(
        { k: "say", text: e.message, ms: 2400, tone: "ok" },
        { k: "working", on: false },
        { k: "goto", to: a.def.home }
      );
    } else {
      a.queue.push(
        { k: "working", on: false },
        { k: "say", text: e.message, ms: 0, tone: "err", sticky: true }
      );
    }
  }

  // ---------------------------------------------------------------- simulation

  update(dtMs: number) {
    this.time += Math.max(0, dtMs);
    for (const a of this.actors) this.step(a, dtMs);
    this.emitBubbles();
  }

  private step(a: Actor, dtMs: number) {
    if (!a.current) {
      // a sticky error bubble blocks nothing; it simply stays until reset
      a.current = a.queue.shift() ?? null;
      a.t = 0;
      if (a.current) this.begin(a, a.current);
    }
    const cur = a.current;
    if (!cur) return;
    a.t += dtMs;

    if (cur.k === "goto") {
      this.walk(a, dtMs);
      if (a.path.length === 0) {
        a.dir = a.tile.x === a.def.desk.x && a.tile.y === a.def.desk.y ? "up" : "down";
        a.current = null;
      }
    } else if (cur.k === "say") {
      if (!cur.sticky && a.t >= cur.ms) {
        a.bubble = null;
        a.current = null;
      } else if (cur.sticky) {
        a.current = null; // the bubble stays; later actions may continue
      }
    } else if (cur.k === "stamp") {
      if (a.t >= STAMP_MS) {
        a.stampStart = null;
        a.bubble = null;
        this.paperInBin += 1;
        a.current = null;
      }
    } else {
      a.current = null;
    }
  }

  private begin(a: Actor, act: Action) {
    if (act.k === "goto") {
      const p = findPath(WALK_GRID, a.tile, act.to);
      a.path = p ?? [];
      if (this.opts.reducedMotion || !p) {
        // reduced motion: teleport instead of walking
        a.tile = { ...act.to };
        a.x = act.to.x * TILE;
        a.y = act.to.y * TILE;
        a.path = [];
      }
    } else if (act.k === "say") {
      a.bubble = { text: act.text, tone: act.tone, sticky: Boolean(act.sticky) };
    } else if (act.k === "stamp") {
      a.stampStart = this.time;
      a.stampText = act.quote;
      a.bubble = { text: `"${truncate(act.quote, 70)}"`, tone: "stamp", sticky: false };
      a.dir = "up";
    } else if (act.k === "working") {
      a.working = act.on;
    }
  }

  private walk(a: Actor, dtMs: number) {
    let budget = (SPEED * dtMs) / 1000;
    a.walkT += dtMs;
    while (budget > 0 && a.path.length > 0) {
      const next = a.path[0];
      const tx = next.x * TILE;
      const ty = next.y * TILE;
      const dx = tx - a.x;
      const dy = ty - a.y;
      const dist = Math.abs(dx) + Math.abs(dy);
      a.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";
      if (dist <= budget) {
        a.x = tx;
        a.y = ty;
        a.tile = { ...next };
        a.path.shift();
        budget -= dist;
      } else {
        a.x += Math.sign(dx) * Math.min(Math.abs(dx), budget);
        a.y += Math.sign(dy) * Math.min(Math.abs(dy), budget);
        budget = 0;
      }
    }
  }

  private emitBubbles() {
    const list: BubbleView[] = [];
    for (const a of this.actors) {
      if (!a.bubble) continue;
      list.push({
        id: a.def.id,
        text: a.bubble.text,
        tone: a.bubble.tone,
        x: a.x + TILE / 2,
        y: a.y,
      });
    }
    // only notify React when something visible changed (walking bubbles move, so include position)
    const key = JSON.stringify(list);
    if (key !== this.lastBubbleKey) {
      this.lastBubbleKey = key;
      this.opts.onBubbles(list);
    }
  }

  // ------------------------------------------------------------------ drawing

  draw(ctx: CanvasRenderingContext2D) {
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#121218";
    ctx.fillRect(0, 0, WORLD_W, WORLD_H);
    this.drawWalls(ctx);
    this.drawFloors(ctx);
    this.drawLabels(ctx);
    this.drawDeskGlow(ctx);
    for (const f of FURNITURE) this.drawFurniture(ctx, f);
    this.drawClock(ctx);
    this.drawBinContents(ctx);
    const sorted = [...this.actors].sort((p, q) => p.y - q.y);
    for (const a of sorted) this.drawActor(ctx, a);
    for (const a of sorted) this.drawStamp(ctx, a);
    this.drawTint(ctx);
  }

  private drawWalls(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = "#262a3b";
    ctx.fillRect(0, 0, WORLD_W, WORLD_H);
    ctx.fillStyle = "#31364b";
    for (let x = 0; x < COLS; x++) {
      for (let y = 0; y < ROWS; y++) {
        if (!WALK_GRID[y][x] && !isFurnitureTile(x, y)) {
          ctx.fillRect(x * TILE, y * TILE, TILE, 2);
          if ((x + y) % 2 === 0) ctx.fillRect(x * TILE + 2, y * TILE + 8, TILE - 4, 1);
        }
      }
    }
  }

  private drawFloors(ctx: CanvasRenderingContext2D) {
    for (const r of ROOMS) {
      for (let y = r.y1; y <= r.y2; y++) {
        for (let x = r.x1; x <= r.x2; x++) {
          ctx.fillStyle = (x + y) % 2 === 0 ? r.floorA : r.floorB;
          ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
        }
      }
    }
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (isDoor(x, y)) {
          ctx.fillStyle = "#3b3f58";
          ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
          ctx.fillStyle = ACCENT;
          ctx.fillRect(x * TILE, y * TILE + 7, TILE, 2);
        }
      }
    }
  }

  private drawLabels(ctx: CanvasRenderingContext2D) {
    ctx.font = `8px ${this.opts.fontFamily}`;
    ctx.textBaseline = "top";
    ctx.fillStyle = "rgba(255,180,84,0.85)";
    for (const r of ROOMS) {
      if (r.name) ctx.fillText(r.name, r.x1 * TILE + 3, r.y1 * TILE + 4);
    }
  }

  private drawDeskGlow(ctx: CanvasRenderingContext2D) {
    for (const a of this.actors) {
      if (!a.working) continue;
      const pulse = 0.25 + 0.15 * Math.sin(this.time / 220);
      ctx.fillStyle = `rgba(255,180,84,${pulse})`;
      ctx.fillRect(a.def.desk.x * TILE - 2, a.def.desk.y * TILE - 2, TILE + 4, TILE + 4);
    }
  }

  private drawFurniture(ctx: CanvasRenderingContext2D, f: (typeof FURNITURE)[number]) {
    const x = f.x * TILE;
    const y = f.y * TILE;
    const w = f.w * TILE;
    const h = f.h * TILE;
    switch (f.kind) {
      case "counter":
      case "table": {
        ctx.fillStyle = "#7a5638";
        ctx.fillRect(x, y + 2, w, h - 2);
        ctx.fillStyle = "#a07650";
        ctx.fillRect(x, y + 2, w, 4);
        ctx.fillStyle = "#4a3322";
        ctx.fillRect(x, y + h - 2, w, 2);
        if (f.kind === "counter") {
          ctx.fillStyle = "#f4f1e6"; // letters on the mail counter
          ctx.fillRect(x + 4, y + 3, 6, 4);
          ctx.fillRect(x + 20, y + 3, 6, 4);
        } else {
          ctx.fillStyle = "#1a1d2b"; // monitor / open book
          ctx.fillRect(x + w / 2 - 6, y + 3, 12, 6);
        }
        break;
      }
      case "shelf": {
        ctx.fillStyle = "#4a3322";
        ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
        const cols = ["#d94f4f", "#3d7fd1", "#f2d14b", "#4fa66b", "#8b5fd0"];
        for (let yy = y + 3; yy < y + h - 3; yy += 7) {
          for (let xx = x + 3, i = 0; xx < x + w - 3; xx += 3, i++) {
            ctx.fillStyle = cols[(i + yy) % cols.length];
            ctx.fillRect(xx, yy, 2, 5);
          }
        }
        break;
      }
      case "board": {
        ctx.fillStyle = "#2a2f42";
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = "#e9e1c8";
        ctx.fillRect(x + 2, y + 2, w - 4, h - 6);
        const notes = ["#ffb454", "#9fe3ff", "#ff9fb2", "#b7f0a0"];
        for (let i = 0; i < 6; i++) {
          ctx.fillStyle = notes[i % notes.length];
          ctx.fillRect(x + 5 + i * 12, y + 4 + (i % 2) * 4, 8, 6);
        }
        break;
      }
      case "plant": {
        ctx.fillStyle = "#7a4a30";
        ctx.fillRect(x + 4, y + 10, 8, 6);
        ctx.fillStyle = "#3f9a58";
        ctx.fillRect(x + 3, y + 3, 10, 8);
        ctx.fillStyle = "#5fc47a";
        ctx.fillRect(x + 5, y + 1, 6, 5);
        break;
      }
      case "sofa": {
        ctx.fillStyle = "#6a3b57";
        ctx.fillRect(x, y + 2, w, h - 2);
        ctx.fillStyle = "#8a4f72";
        ctx.fillRect(x, y + 2, w, 5);
        ctx.fillStyle = "#4d2a40";
        for (let i = 1; i < f.w; i++) ctx.fillRect(x + i * TILE - 1, y + 5, 1, h - 5);
        break;
      }
      case "coffee": {
        ctx.fillStyle = "#3a3d52";
        ctx.fillRect(x + 2, y + 2, 12, h - 4);
        ctx.fillStyle = ACCENT;
        ctx.fillRect(x + 5, y + 6, 6, 3);
        ctx.fillStyle = "#f4f1e6";
        ctx.fillRect(x + 6, y + 16, 4, 5);
        break;
      }
      case "bin": {
        ctx.fillStyle = "#555a6e";
        ctx.fillRect(x + 3, y + 4, 10, 11);
        ctx.fillStyle = "#6b7088";
        ctx.fillRect(x + 2, y + 2, 12, 3);
        ctx.fillStyle = "#3b3f52";
        for (let i = 0; i < 3; i++) ctx.fillRect(x + 5 + i * 3, y + 7, 1, 6);
        break;
      }
      case "lamp": {
        ctx.fillStyle = "#555a6e";
        ctx.fillRect(x + 7, y + 6, 2, 9);
        ctx.fillStyle = ACCENT;
        ctx.fillRect(x + 3, y + 2, 10, 5);
        break;
      }
    }
  }

  private drawBinContents(ctx: CanvasRenderingContext2D) {
    // crumpled pages pile up in the bin, one per dropped quote the animation has finished
    const n = Math.min(this.paperInBin, 5);
    ctx.fillStyle = "#f4f1e6";
    for (let i = 0; i < n; i++) {
      ctx.fillRect(BIN_TILE.x * TILE + 4 + (i % 3) * 3, BIN_TILE.y * TILE + 2 - Math.floor(i / 3) * 2, 3, 3);
    }
  }

  private drawClock(ctx: CanvasRenderingContext2D) {
    const cx = CLOCK_TILE.x * TILE + TILE / 2;
    const cy = CLOCK_TILE.y * TILE + TILE / 2;
    ctx.fillStyle = "#14121c";
    ctx.fillRect(cx - 7, cy - 7, 14, 14);
    ctx.fillStyle = "#f4f1e6";
    ctx.fillRect(cx - 6, cy - 6, 12, 12);
    const now = (this.opts.now ?? (() => new Date()))();
    const min = now.getMinutes() + now.getSeconds() / 60;
    const hr = (now.getHours() % 12) + min / 60;
    const hand = (angle: number, len: number, color: string) => {
      ctx.fillStyle = color;
      for (let i = 0; i <= len; i++) {
        ctx.fillRect(Math.round(cx + Math.sin(angle) * i), Math.round(cy - Math.cos(angle) * i), 1, 1);
      }
    };
    hand((hr / 12) * Math.PI * 2, 3, "#14121c");
    hand((min / 60) * Math.PI * 2, 5, ALERT);
  }

  private drawActor(ctx: CanvasRenderingContext2D, a: Actor) {
    const moving = a.path.length > 0;
    let frame: Frame = 0;
    let dir = a.dir;
    let bob = 0;
    if (moving) {
      frame = WALK_CYCLE[Math.floor(a.walkT / 130) % WALK_CYCLE.length];
      bob = frame === 0 ? 0 : -1;
    } else if (a.working) {
      frame = WORK_CYCLE[Math.floor(this.time / 260) % WORK_CYCLE.length];
      dir = frame === 3 || frame === 4 ? "up" : dir;
      bob = frame === 4 ? -1 : 0;
    }
    const atHome = !moving && !a.working && a.tile.x === a.def.home.x && a.tile.y === a.def.home.y;
    let stretch = 0;
    if (atHome) {
      // purely cosmetic lounge idling: breathing, an occasional stretch, a coffee break
      const phase = (this.time / 1000 + AGENTS.indexOf(a.def) * 2.3) % 9;
      if (phase > 6 && phase < 7) stretch = 1;
      bob = Math.sin(this.time / 600 + a.x) > 0.6 ? -1 : 0;
    }
    const x = Math.round(a.x);
    const y = Math.round(a.y) + bob;
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.fillRect(x + 4, Math.round(a.y) + 14, 8, 2);
    const sprite = getSprite(a.def, dir, frame);
    ctx.drawImage(sprite, x, y - stretch, 16, 16 + stretch);

    if (atHome && ((this.time / 1000 + AGENTS.indexOf(a.def) * 2.3) % 9) > 2 && ((this.time / 1000 + AGENTS.indexOf(a.def) * 2.3) % 9) <= 5) {
      // coffee: a cup with rising steam
      ctx.fillStyle = "#f4f1e6";
      ctx.fillRect(x + 12, y + 10, 3, 3);
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      const s = Math.floor(this.time / 300) % 2;
      ctx.fillRect(x + 13 + s, y + 7, 1, 2);
    }
    if (a.working) {
      // working dots above the head
      const n = (Math.floor(this.time / 300) % 3) + 1;
      ctx.fillStyle = ACCENT;
      for (let i = 0; i < n; i++) ctx.fillRect(x + 4 + i * 3, y - 3, 2, 2);
    }
    if (a.bubble?.tone === "err") {
      ctx.fillStyle = ALERT;
      ctx.fillRect(x + 6, y - 9, 4, 6);
      ctx.fillRect(x + 6, y - 2, 4, 2);
    }
  }

  private drawStamp(ctx: CanvasRenderingContext2D, a: Actor) {
    if (a.stampStart === null) return;
    const t = (this.time - a.stampStart) / STAMP_MS;
    const deskX = a.def.desk.x * TILE;
    const deskY = a.def.desk.y * TILE;
    const bx = BIN_TILE.x * TILE + 4;
    const by = BIN_TILE.y * TILE + 2;
    const slideStart = 0.4;
    let px = deskX + 20;
    let py = deskY - 4;
    let scale = 1;
    if (t > slideStart) {
      const k = this.opts.reducedMotion ? 1 : Math.min(1, (t - slideStart) / (1 - slideStart));
      const ease = k * k;
      px = deskX + 20 + (bx - deskX - 20) * ease;
      py = deskY - 4 + (by - deskY + 4) * ease;
      scale = 1 - 0.6 * ease;
    }
    const pw = Math.max(3, 14 * scale);
    const ph = Math.max(4, 18 * scale);
    ctx.fillStyle = "#f4f1e6";
    ctx.fillRect(Math.round(px), Math.round(py), pw, ph);
    ctx.fillStyle = "#9a9aa8";
    for (let i = 0; i < 3 && scale > 0.7; i++) ctx.fillRect(Math.round(px) + 2, Math.round(py) + 3 + i * 4, pw - 4, 1);

    // the big red stamp, slammed on the page and held until the page slides away
    if (t < 0.9) {
      const slam = t < 0.12 ? 1.6 - (t / 0.12) * 0.6 : 1;
      ctx.save();
      ctx.translate(deskX + TILE / 2, deskY - 22);
      ctx.rotate(-0.2);
      ctx.scale(slam, slam);
      ctx.font = `8px ${this.opts.fontFamily}`;
      ctx.textBaseline = "middle";
      ctx.textAlign = "center";
      const label = "NOT IN DOCUMENT";
      const w = ctx.measureText(label).width + 10;
      ctx.fillStyle = "rgba(20,0,0,0.6)";
      ctx.fillRect(-w / 2 + 1, -8 + 1, w, 16);
      ctx.strokeStyle = ALERT;
      ctx.lineWidth = 2;
      ctx.strokeRect(-w / 2, -8, w, 16);
      ctx.fillStyle = ALERT;
      ctx.fillText(label, 0, 1);
      ctx.restore();
    }
  }

  private drawTint(ctx: CanvasRenderingContext2D) {
    const h = (this.opts.now ?? (() => new Date()))().getHours();
    let tint: string | null = null;
    if (h >= 21 || h < 6) tint = "rgba(10,18,70,0.38)";
    else if (h >= 18) tint = "rgba(255,110,50,0.12)";
    else if (h < 8) tint = "rgba(255,200,120,0.08)";
    if (tint) {
      ctx.fillStyle = tint;
      ctx.fillRect(0, 0, WORLD_W, WORLD_H);
    }
  }
}

function isFurnitureTile(x: number, y: number): boolean {
  return FURNITURE.some((f) => x >= f.x && x < f.x + f.w && y >= f.y && y < f.y + f.h);
}
