/**
 * Original 16x16 pixel-art characters, composed in code from small string templates.
 * Palette keys: o outline, h hair, s skin, e eye, b shirt, a accent, p pants, f shoes,
 * w paper white, c lens, r red, . transparent.
 */
import type { Accessory, AgentDef, Palette } from "./agents";

export type Dir = "down" | "up" | "left" | "right";
/** 0..2 are walk frames (stand, step A, step B); 3..4 are the two working poses. */
export type Frame = 0 | 1 | 2 | 3 | 4;

export const WALK_CYCLE: Frame[] = [0, 1, 0, 2];
export const WORK_CYCLE: Frame[] = [3, 4];

const HEAD_DOWN = [
  "................",
  "....oooooooo....",
  "...ohhhhhhhho...",
  "...ohhhhhhhho...",
  "...ohssssssho...",
  "...osesssseso...",
  "...osssssssso...",
  "....oooooooo....",
];
const HEAD_UP = [
  "................",
  "....oooooooo....",
  "...ohhhhhhhho...",
  "...ohhhhhhhho...",
  "...ohhhhhhhho...",
  "...ohhhhhhhho...",
  "...ohhhhhhhho...",
  "....oooooooo....",
];
const HEAD_RIGHT = [
  "................",
  "....oooooooo....",
  "...ohhhhhhhho...",
  "...ohhhhhhhho...",
  "...ohhhhhsssso..",
  "...ohhhhsesssso.",
  "...ohhhhssssso..",
  "....oooooooo....",
];

const BODY_FRONT = [
  "...obbbbbbbbo...",
  "..obbbbbbbbbbo..",
  "..osbbbbbbbbso..",
  "...obbbbbbbbo...",
  "....oppppppo....",
];
const BODY_FRONT_A = [
  "...obbbbbbbbo...",
  "..obbbbbbbbbbo..",
  "...osbbbbbbso...",
  "...obbbbbbbbo...",
  "....oppppppo....",
];
const BODY_FRONT_B = [
  "...obbbbbbbbo...",
  ".sobbbbbbbbbbos.",
  "..obbbbbbbbbbo..",
  "...obbbbbbbbo...",
  "....oppppppo....",
];
const BODY_SIDE = [
  "....obbbbbbo....",
  "....obbbbbbo....",
  "....obbssbbo....",
  "....obbbbbbo....",
  "....oppppppo....",
];

const LEGS_FRONT: string[][] = [
  [".....pp...pp....", ".....pp...pp....", ".....ff...ff...."],
  [".....pp...pp....", ".....pp....pp...", ".....ff....ff..."],
  [".....pp...pp....", "....pp....pp....", "....ff....ff...."],
];
const LEGS_SIDE: string[][] = [
  [".....pppp.......", ".....pppp.......", ".....fffff......"],
  [".....pp.pp......", "....pp...pp.....", "....ff...ff....."],
  [".....pp.pp......", "......ppp.......", "......fff......."],
];

type Px = { x: number; y: number; c: string };
const px = (c: string, ...pts: Array<[number, number]>): Px[] => pts.map(([x, y]) => ({ x, y, c }));
const row = (c: string, y: number, x1: number, x2: number): Px[] => {
  const out: Px[] = [];
  for (let x = x1; x <= x2; x++) out.push({ x, y, c });
  return out;
};

/** Accessory overlays per facing direction. */
const ACCESSORIES: Record<Accessory, (dir: Dir) => Px[]> = {
  // cap with a brim, and a letter held in front
  cap: (dir) => [
    ...row("a", 1, 4, 11),
    ...row("a", 2, 3, 12),
    ...(dir === "down" ? [...row("a", 3, 4, 11), ...row("w", 11, 6, 9), ...px("o", [7, 11], [8, 11])] : []),
    ...(dir === "right" ? [...row("a", 3, 10, 13), ...row("w", 11, 8, 11)] : []),
    ...(dir === "left" ? [...row("a", 3, 2, 5), ...row("w", 11, 4, 7)] : []),
  ],
  // reading glasses and a book
  glasses: (dir) => {
    if (dir === "up") return row("a", 11, 5, 10);
    if (dir === "down") {
      return [
        ...px("o", [4, 5], [6, 5], [9, 5], [11, 5], [7, 5], [8, 5]),
        ...px("w", [5, 5], [10, 5]),
        ...row("a", 11, 5, 10),
      ];
    }
    const x = dir === "right" ? 11 : 4;
    return [...px("o", [x, 5], [dir === "right" ? 9 : 6, 5]), ...px("w", [dir === "right" ? 10 : 5, 5]), ...row("a", 11, 5, 10)];
  },
  // tall pointed hat and a feather quill
  hat: (dir) => [
    ...row("a", 0, 6, 9),
    ...row("a", 1, 4, 11),
    ...row("a", 2, 3, 12),
    ...px("b", [7, 0], [8, 0]),
    ...(dir === "left" ? [] : px("w", [13, 9], [13, 8], [14, 7])),
    ...(dir === "left" ? px("w", [2, 9], [2, 8], [1, 7]) : []),
  ],
  // a paper stack held at the chest
  stack: () => [
    ...row("w", 9, 4, 11),
    ...row("a", 10, 4, 11),
    ...row("w", 11, 4, 11),
    ...px("o", [6, 10], [9, 10]),
  ],
  // magnifying glass, held out to the side
  magnifier: (dir) => {
    const flip = dir === "left";
    const mx = (x: number) => (flip ? 15 - x : x);
    return [
      ...px("o", [mx(11), 7], [mx(12), 7], [mx(13), 7], [mx(10), 8], [mx(14), 8], [mx(10), 9], [mx(14), 9], [mx(11), 10], [mx(12), 10], [mx(13), 10]),
      ...px("c", [mx(11), 8], [mx(12), 8], [mx(13), 8], [mx(11), 9], [mx(12), 9], [mx(13), 9]),
      ...px("w", [mx(11), 8]),
      ...px("o", [mx(10), 11], [mx(9), 12]),
      ...row("r", 4, 4, 11),
    ];
  },
};

const mirror = (rows: string[]) => rows.map((r) => [...r].reverse().join(""));

/** Builds the 16 string rows for one pose. */
export function spriteRows(agent: Pick<AgentDef, "accessory">, dir: Dir, frame: Frame): string[] {
  let head: string[];
  let body: string[];
  let legs: string[][];
  if (dir === "down") {
    head = HEAD_DOWN;
    body = frame === 3 ? BODY_FRONT_A : frame === 4 ? BODY_FRONT_B : BODY_FRONT;
    legs = LEGS_FRONT;
  } else if (dir === "up") {
    head = HEAD_UP;
    body = BODY_FRONT;
    legs = LEGS_FRONT;
  } else {
    head = HEAD_RIGHT;
    body = BODY_SIDE;
    legs = LEGS_SIDE;
  }
  const legFrame = legs[frame >= 3 ? 0 : frame];
  let rows = [...head, ...body, ...legFrame];
  if (dir === "left") rows = mirror(rows);

  const grid = rows.map((r) => [...r]);
  for (const p of ACCESSORIES[agent.accessory](dir)) {
    if (p.y >= 0 && p.y < 16 && p.x >= 0 && p.x < 16) grid[p.y][p.x] = p.c;
  }
  return grid.map((r) => r.join(""));
}

function colorFor(ch: string, pal: Palette): string | null {
  switch (ch) {
    case "o": return "#14121c";
    case "h": return pal.hair;
    case "s": return pal.skin;
    case "e": return "#14121c";
    case "b": return pal.shirt;
    case "a": return pal.accent;
    case "p": return pal.pants;
    case "f": return pal.shoes;
    case "w": return "#f4f1e6";
    case "c": return "#bfeaff";
    case "r": return "#ff4d4d";
    default: return null;
  }
}

/** Rasterises a pose to an offscreen canvas (browser only). */
export function renderSprite(agent: AgentDef, dir: Dir, frame: Frame): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = 16;
  c.height = 16;
  const ctx = c.getContext("2d")!;
  spriteRows(agent, dir, frame).forEach((line, y) => {
    [...line].forEach((ch, x) => {
      const col = colorFor(ch, agent.palette);
      if (col) {
        ctx.fillStyle = col;
        ctx.fillRect(x, y, 1, 1);
      }
    });
  });
  return c;
}

const cache = new Map<string, HTMLCanvasElement>();
export function getSprite(agent: AgentDef, dir: Dir, frame: Frame): HTMLCanvasElement {
  const k = `${agent.id}|${dir}|${frame}`;
  let s = cache.get(k);
  if (!s) {
    s = renderSprite(agent, dir, frame);
    cache.set(k, s);
  }
  return s;
}
