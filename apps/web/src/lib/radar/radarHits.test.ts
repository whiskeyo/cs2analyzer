import { describe, expect, it } from "vitest";
import type { ClutchBoardRow } from "@/lib/match/clutches";
import {
  canvasLocalPoint,
  clutchMarkAtScreen,
  habitsJumpAtScreen,
  nearestPlayerIndexAtScreen,
} from "./radarHits";
import { DEFAULT_PATH_BRANCH_OPTIONS } from "@/lib/parse/pathBranches";
import type { SampledPlayer } from "@/lib/replay/sample";

function player(index: number, x: number, y: number, present = true): SampledPlayer {
  return {
    index,
    x,
    y,
    z: 0,
    yaw: 0,
    health: 100,
    armor: 0,
    present,
    alive: true,
    ducked: false,
    scoped: false,
    ct: true,
    planting: false,
    defusing: false,
    money: 0,
    equip: 0,
    gear: 0,
    primary: 0,
    secondary: 0,
    active: 0,
    clip: 0,
    reserve: 0,
  };
}

describe("nearestPlayerIndexAtScreen", () => {
  it("picks a nearby present pawn and ignores far or missing ones", () => {
    const toScreen = (wx: number, wy: number) => ({ x: wx, y: wy });
    expect(
      nearestPlayerIndexAtScreen([player(0, 0, 0, false), player(1, 10, 10)], 12, 12, toScreen),
    ).toBe(1);
    expect(nearestPlayerIndexAtScreen([player(0, 0, 0)], 200, 200, toScreen)).toBeNull();
  });
});

describe("canvasLocalPoint", () => {
  it("subtracts the canvas origin", () => {
    const canvas = {
      getBoundingClientRect: () => ({ left: 10, top: 20 }),
    } as HTMLCanvasElement;
    expect(canvasLocalPoint(canvas, 15, 30)).toEqual({ x: 5, y: 10 });
  });
});

describe("habitsJumpAtScreen", () => {
  const overlay = {
    trails: [],
    branches: [],
    branchOptions: DEFAULT_PATH_BRANCH_OPTIONS,
    nades: [],
    roundCount: 0,
    windowSec: 0,
  };

  it("returns null when no arrow is under the cursor", () => {
    expect(habitsJumpAtScreen(overlay, true, 0, 0, (x, y) => ({ x, y }), undefined)).toBeNull();
    expect(habitsJumpAtScreen(overlay, false, 0, 0, (x, y) => ({ x, y }), undefined)).toBeNull();
  });

  it("returns a jump when an arrow head is nearby", () => {
    const hit = habitsJumpAtScreen(
      {
        ...overlay,
        trails: [
          {
            demoId: "d1",
            roundNumber: 1,
            jumpTick: 64,
            tps: 64,
            steamId: 1,
            playerName: "A",
            color: "#fff",
            points: [{ x: 10, y: 10, z: 0, tick: 100, yaw: 0 }],
            deathAt: null,
            deathTick: null,
            survivedAt: null,
            survivedTick: null,
          },
        ],
      },
      true,
      10,
      10,
      (x, y) => ({ x, y }),
      undefined,
    );
    expect(hit).toEqual({ demoId: "d1", jumpTick: 100 });
  });
});

function clutchMark(
  partial: Partial<ClutchBoardRow> & Pick<ClutchBoardRow, "x" | "y">,
): ClutchBoardRow {
  return {
    tick: 200,
    round: 1,
    roundLabel: "R1",
    player: 1,
    name: "Bob",
    vs: 2,
    side: "CT",
    won: true,
    weapon: "ak47",
    placed: true,
    ...partial,
  };
}

describe("clutchMarkAtScreen", () => {
  const toScreen = (x: number, y: number) => ({ x, y });

  it("returns the nearest placed marker and skips ones with no position", () => {
    const near = clutchMark({ x: 10, y: 10, tick: 200 });
    const far = clutchMark({ x: 80, y: 80, tick: 400, player: 2 });
    const missing = clutchMark({ x: 11, y: 11, placed: false, tick: 300, player: 3 });
    expect(clutchMarkAtScreen([missing, far, near], 12, 11, toScreen)?.tick).toBe(200);
    expect(clutchMarkAtScreen([far], 12, 11, toScreen)).toBeNull();
  });
});
