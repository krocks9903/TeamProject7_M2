import type { Point, WalkGrid } from "./pathfinding";

export const TILE = 16;
export const COLS = 32;
export const ROWS = 20;

export interface Room {
  name: string;
  /** Interior rectangle in tiles (inclusive). */
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  floorA: string;
  floorB: string;
}

export const ROOMS: Room[] = [
  { name: "MAILROOM", x1: 1, y1: 1, x2: 9, y2: 5, floorA: "#3a4156", floorB: "#353c50" },
  { name: "READING ROOM", x1: 11, y1: 1, x2: 20, y2: 5, floorA: "#3d4a47", floorB: "#38443f" },
  { name: "ANALYST DESK", x1: 22, y1: 1, x2: 30, y2: 5, floorA: "#42395a", floorB: "#3d3553" },
  { name: "RANKING BOARD", x1: 1, y1: 11, x2: 12, y2: 14, floorA: "#4a4136", floorB: "#453c32" },
  { name: "FACT-CHECK DESK", x1: 14, y1: 11, x2: 30, y2: 14, floorA: "#4d3a3d", floorB: "#473437" },
  { name: "LOUNGE", x1: 1, y1: 16, x2: 30, y2: 18, floorA: "#33405a", floorB: "#2f3b54" },
  { name: "", x1: 1, y1: 7, x2: 30, y2: 9, floorA: "#2b2d3b", floorB: "#282a37" },
];

export type FurnitureKind =
  | "counter"
  | "shelf"
  | "table"
  | "board"
  | "plant"
  | "sofa"
  | "coffee"
  | "bin"
  | "lamp";

export interface Furniture {
  kind: FurnitureKind;
  x: number;
  y: number;
  w: number;
  h: number;
}

export const FURNITURE: Furniture[] = [
  // Mailroom
  { kind: "counter", x: 4, y: 2, w: 3, h: 1 },
  { kind: "shelf", x: 1, y: 3, w: 1, h: 2 },
  { kind: "shelf", x: 9, y: 3, w: 1, h: 2 },
  { kind: "plant", x: 8, y: 5, w: 1, h: 1 },
  // Reading room
  { kind: "table", x: 14, y: 2, w: 3, h: 1 },
  { kind: "shelf", x: 11, y: 3, w: 1, h: 2 },
  { kind: "shelf", x: 20, y: 3, w: 1, h: 2 },
  // Analyst
  { kind: "table", x: 25, y: 2, w: 3, h: 1 },
  { kind: "plant", x: 22, y: 5, w: 1, h: 1 },
  { kind: "shelf", x: 30, y: 3, w: 1, h: 2 },
  // Ranking
  { kind: "board", x: 4, y: 12, w: 5, h: 1 },
  { kind: "plant", x: 12, y: 14, w: 1, h: 1 },
  // Fact-check
  { kind: "table", x: 19, y: 12, w: 3, h: 1 },
  { kind: "lamp", x: 23, y: 12, w: 1, h: 1 },
  { kind: "bin", x: 28, y: 13, w: 1, h: 1 },
  { kind: "shelf", x: 14, y: 12, w: 1, h: 2 },
  // Lounge
  { kind: "sofa", x: 24, y: 17, w: 4, h: 1 },
  { kind: "coffee", x: 30, y: 17, w: 1, h: 2 },
  { kind: "plant", x: 1, y: 18, w: 1, h: 1 },
];

/** Doorways cut through the horizontal walls (tile x on that wall row). */
const DOORS: Point[] = [
  { x: 5, y: 6 },
  { x: 15, y: 6 },
  { x: 26, y: 6 },
  { x: 6, y: 10 },
  { x: 22, y: 10 },
  { x: 7, y: 15 },
  { x: 22, y: 15 },
];

export const BIN_TILE: Point = { x: 28, y: 13 };
export const CLOCK_TILE: Point = { x: 15, y: 15 };

/** Builds the walkable mask: floors of every room, doorways, minus furniture. */
export function buildWalkGrid(): WalkGrid {
  const grid: WalkGrid = Array.from({ length: ROWS }, () => Array<boolean>(COLS).fill(false));
  for (const r of ROOMS) {
    for (let y = r.y1; y <= r.y2; y++) for (let x = r.x1; x <= r.x2; x++) grid[y][x] = true;
  }
  for (const d of DOORS) grid[d.y][d.x] = true;
  for (const f of FURNITURE) {
    for (let y = f.y; y < f.y + f.h; y++) for (let x = f.x; x < f.x + f.w; x++) grid[y][x] = false;
  }
  return grid;
}

export const WALK_GRID: WalkGrid = buildWalkGrid();
export const isDoor = (x: number, y: number) => DOORS.some((d) => d.x === x && d.y === y);
