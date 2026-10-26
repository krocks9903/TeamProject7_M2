import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { findPath, isWalkable, type WalkGrid } from "../apps/web/src/mission-control/pathfinding.ts";
import { AGENTS } from "../apps/web/src/mission-control/agents.ts";
import { WALK_GRID } from "../apps/web/src/mission-control/officeMap.ts";
import { spriteRows } from "../apps/web/src/mission-control/sprites.ts";
import { initialState, reduceEvents } from "../apps/web/src/mission-control/scanState.ts";

const parse = (rows: string[]): WalkGrid => rows.map((r) => [...r].map((c) => c === "."));

describe("findPath", () => {
  it("returns [] when already at the goal", () => {
    assert.deepEqual(findPath(parse(["..."]), { x: 1, y: 0 }, { x: 1, y: 0 }), []);
  });

  it("finds a shortest straight path, excluding the start", () => {
    const p = findPath(parse(["....."]), { x: 0, y: 0 }, { x: 4, y: 0 });
    assert.equal(p?.length, 4);
    assert.deepEqual(p?.at(-1), { x: 4, y: 0 });
  });

  it("walks around obstacles", () => {
    const grid = parse(["...", ".#.", "..."]);
    const p = findPath(grid, { x: 0, y: 1 }, { x: 2, y: 1 });
    assert.equal(p?.length, 4);
    assert.ok(p?.every((t) => isWalkable(grid, t)));
  });

  it("only moves one tile at a time, 4-connected", () => {
    const grid = parse(["....", "..#.", "...."]);
    const p = findPath(grid, { x: 0, y: 0 }, { x: 3, y: 2 })!;
    let prev = { x: 0, y: 0 };
    for (const t of p) {
      assert.equal(Math.abs(t.x - prev.x) + Math.abs(t.y - prev.y), 1);
      prev = t;
    }
  });

  it("returns null when the goal is walled off or not walkable", () => {
    assert.equal(findPath(parse([".#."]), { x: 0, y: 0 }, { x: 2, y: 0 }), null);
    assert.equal(findPath(parse([".#."]), { x: 0, y: 0 }, { x: 1, y: 0 }), null);
  });
});

describe("office layout", () => {
  it("every agent can walk between its home and its desk", () => {
    for (const a of AGENTS) {
      assert.ok(isWalkable(WALK_GRID, a.desk), `${a.id} desk blocked`);
      assert.ok(isWalkable(WALK_GRID, a.home), `${a.id} home blocked`);
      assert.ok(findPath(WALK_GRID, a.home, a.desk), `${a.id} cannot reach desk`);
      assert.ok(findPath(WALK_GRID, a.desk, a.home), `${a.id} cannot return home`);
    }
  });

  it("is 32x20 tiles", () => {
    assert.equal(WALK_GRID.length, 20);
    assert.ok(WALK_GRID.every((r) => r.length === 32));
  });
});

describe("sprites", () => {
  it("every pose of every agent is a 16x16 grid", () => {
    for (const a of AGENTS) {
      for (const dir of ["down", "up", "left", "right"] as const) {
        for (const f of [0, 1, 2, 3, 4] as const) {
          const rows = spriteRows(a, dir, f);
          assert.equal(rows.length, 16, `${a.id} ${dir} ${f} rows`);
          rows.forEach((r, i) => assert.equal(r.length, 16, `${a.id} ${dir} ${f} row ${i}`));
        }
      }
    }
  });
});

describe("reduceEvents", () => {
  it("with no events everyone is idle and nothing is invented", () => {
    const s = reduceEvents([]);
    assert.deepEqual(s, initialState());
    assert.ok(Object.values(s.agents).every((a) => a.status === "idle"));
    assert.equal(s.scan.kept, null);
  });

  it("derives status, timing and counts only from events", () => {
    const base = { scanId: "s" };
    const s = reduceEvents([
      { ...base, ts: 100, seq: 1, agent: "parser", type: "start", message: "go" },
      { ...base, ts: 400, seq: 2, agent: "parser", type: "finish", message: "Read 5 pages", data: { pageCount: 5 } },
      { ...base, ts: 500, seq: 3, agent: "validator", type: "finish", message: "k", data: { kept: 5, dropped: 2 } },
      { ...base, ts: 600, seq: 4, agent: "ranker", type: "finish", message: "d", data: { scanDone: true } },
    ]);
    assert.equal(s.agents.parser.status, "done");
    assert.equal(s.agents.parser.workMs, 300);
    assert.equal(s.scan.pages, 5);
    assert.equal(s.scan.kept, 5);
    assert.equal(s.scan.dropped, 2);
    assert.equal(s.scan.done, true);
  });
});
