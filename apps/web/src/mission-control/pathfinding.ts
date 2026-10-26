/** Grid pathfinding for the office. Pure, no DOM, so it can be unit-tested in node. */

export interface Point {
  x: number;
  y: number;
}

/** `walkable[y][x]` is true when a character may stand on that tile. */
export type WalkGrid = boolean[][];

const STEPS: Point[] = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
];

const key = (p: Point) => `${p.x},${p.y}`;
const manhattan = (a: Point, b: Point) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

export function isWalkable(grid: WalkGrid, p: Point): boolean {
  return grid[p.y]?.[p.x] === true;
}

/**
 * A* over a 4-connected grid. Returns the tiles to walk through, excluding `from` and
 * including `to`; `[]` when already there; `null` when `to` cannot be reached.
 */
export function findPath(grid: WalkGrid, from: Point, to: Point): Point[] | null {
  if (!isWalkable(grid, from) || !isWalkable(grid, to)) return null;
  if (from.x === to.x && from.y === to.y) return [];

  interface Node {
    p: Point;
    g: number;
    f: number;
    parent: Node | null;
  }
  const open: Node[] = [{ p: from, g: 0, f: manhattan(from, to), parent: null }];
  const best = new Map<string, number>([[key(from), 0]]);
  const closed = new Set<string>();

  while (open.length > 0) {
    // the grid is tiny (32x20), so a linear scan for the lowest f is plenty
    let bi = 0;
    for (let i = 1; i < open.length; i++) {
      if (open[i].f < open[bi].f || (open[i].f === open[bi].f && open[i].g > open[bi].g)) bi = i;
    }
    const cur = open.splice(bi, 1)[0];
    const ck = key(cur.p);
    if (closed.has(ck)) continue;
    closed.add(ck);

    if (cur.p.x === to.x && cur.p.y === to.y) {
      const path: Point[] = [];
      for (let n: Node | null = cur; n && n.parent; n = n.parent) path.push(n.p);
      return path.reverse();
    }

    for (const s of STEPS) {
      const np = { x: cur.p.x + s.x, y: cur.p.y + s.y };
      const nk = key(np);
      if (!isWalkable(grid, np) || closed.has(nk)) continue;
      const g = cur.g + 1;
      if (g >= (best.get(nk) ?? Infinity)) continue;
      best.set(nk, g);
      open.push({ p: np, g, f: g + manhattan(np, to), parent: cur });
    }
  }
  return null;
}
