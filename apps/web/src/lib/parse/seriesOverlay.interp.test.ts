import { describe, expect, it } from "vitest";
import { DEFAULT_PATH_BRANCH_OPTIONS } from "./pathBranches";
import {
  clipHabitsTrailPoints,
  habitsPlayheadTick,
  overlayAtPlaySec,
  type HabitsTrail,
  type HabitsTrailPoint,
  type SeriesOverlay,
} from "./seriesOverlay";

const FREEZE = 64;
const TPS = 64;
const STRIDE = 6;

function point(
  partial: Partial<HabitsTrailPoint> & Pick<HabitsTrailPoint, "tick">,
): HabitsTrailPoint {
  return {
    x: 0,
    y: 0,
    z: 0,
    yaw: 0,
    ...partial,
  };
}

function trail(points: HabitsTrailPoint[], extras: Partial<HabitsTrail> = {}): HabitsTrail {
  return {
    demoId: "a",
    roundNumber: 1,
    jumpTick: FREEZE,
    tps: TPS,
    steamId: 1,
    playerName: "donk",
    color: "#fff",
    points,
    deathAt: null,
    deathTick: null,
    survivedAt: null,
    survivedTick: null,
    ...extras,
  };
}

function overlayOf(trails: HabitsTrail[]): SeriesOverlay {
  return {
    trails,
    branches: [],
    branchOptions: DEFAULT_PATH_BRANCH_OPTIONS,
    nades: [],
    roundCount: trails.length,
    windowSec: 20,
  };
}

describe("clipHabitsTrailPoints", () => {
  const start = point({ x: 0, y: 0, z: 0, tick: FREEZE, yaw: 0 });
  const next = point({
    x: 100,
    y: 50,
    z: 10,
    tick: FREEZE + STRIDE,
    yaw: 90,
  });

  it("returns the sample at an exact snapshot tick", () => {
    expect(clipHabitsTrailPoints([start, next], FREEZE)).toEqual([start]);
    expect(clipHabitsTrailPoints([start, next], FREEZE + STRIDE)).toEqual([start, next]);
  });

  it("lerps x, y, z and unwraps yaw at mid-segment", () => {
    const midTick = FREEZE + STRIDE / 2;
    const clipped = clipHabitsTrailPoints([start, next], midTick);
    expect(clipped).toHaveLength(2);
    expect(clipped[0]).toEqual(start);
    const head = clipped[1]!;
    expect(head.tick).toBe(midTick);
    expect(head.x).toBeCloseTo(50);
    expect(head.y).toBeCloseTo(25);
    expect(head.z).toBeCloseTo(5);
    expect(head.yaw).toBeCloseTo(45);
  });

  it("takes the shortest yaw path across the ±180 seam", () => {
    const from = point({ tick: FREEZE, yaw: 170 });
    const to = point({ tick: FREEZE + STRIDE, yaw: -170 });
    const head = clipHabitsTrailPoints([from, to], FREEZE + STRIDE / 2)[1];
    expect(head?.yaw).toBeCloseTo(180);
  });

  it("keeps a one-point freeze head before, on, and after the only sample", () => {
    expect(clipHabitsTrailPoints([start], FREEZE - 1)).toEqual([start]);
    expect(clipHabitsTrailPoints([start], FREEZE)).toEqual([start]);
    expect(clipHabitsTrailPoints([start], FREEZE + STRIDE)).toEqual([start]);
  });

  it("does not invent motion past the last sample (death / trail end)", () => {
    const clipped = clipHabitsTrailPoints([start, next], FREEZE + STRIDE + 4);
    expect(clipped.at(-1)).toEqual(next);
  });

  it("returns empty for an empty path", () => {
    expect(clipHabitsTrailPoints([], FREEZE)).toEqual([]);
  });
});

describe("overlayAtPlaySec interpolation", () => {
  const start = point({ x: 0, y: 10, z: 0, tick: FREEZE, yaw: -90 });
  const next = point({ x: 60, y: 10, z: 6, tick: FREEZE + STRIDE, yaw: 90 });

  it("moves the pawn head between stride samples from a fractional playhead", () => {
    const midSec = STRIDE / 2 / TPS;
    expect(habitsPlayheadTick(FREEZE, TPS, midSec)).toBe(FREEZE + STRIDE / 2);
    const visible = overlayAtPlaySec(overlayOf([trail([start, next])]), midSec);
    const head = visible.trails[0]?.points.at(-1);
    expect(visible.trails[0]?.points).toHaveLength(2);
    expect(head?.x).toBeCloseTo(30);
    expect(head?.z).toBeCloseTo(3);
    expect(head?.yaw).toBeCloseTo(0);
  });

  it("snaps to the sampled head at an exact snapshot second", () => {
    const exactSec = STRIDE / TPS;
    const visible = overlayAtPlaySec(overlayOf([trail([start, next])]), exactSec);
    expect(visible.trails[0]?.points.at(-1)).toEqual(next);
  });

  it("keeps a freeze-only arrow at playSec 0", () => {
    const visible = overlayAtPlaySec(overlayOf([trail([start])]), 0);
    expect(visible.trails).toHaveLength(1);
    expect(visible.trails[0]?.points).toEqual([start]);
  });

  it("shows death at the end tick without sliding past the last sample", () => {
    const deathTick = FREEZE + STRIDE + 2;
    const source = trail([start, next], {
      deathAt: { x: 80, y: 12 },
      deathTick,
    });
    const before = overlayAtPlaySec(overlayOf([source]), STRIDE / TPS);
    expect(before.trails[0]?.deathAt).toBeNull();
    expect(before.trails[0]?.points.at(-1)).toEqual(next);

    const after = overlayAtPlaySec(overlayOf([source]), (deathTick - FREEZE) / TPS);
    expect(after.trails[0]?.deathAt).toEqual({ x: 80, y: 12 });
    expect(after.trails[0]?.points.at(-1)).toEqual(next);
  });
});
