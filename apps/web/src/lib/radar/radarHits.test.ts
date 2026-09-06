import { describe, expect, it } from "vitest";
import { canvasLocalPoint, habitsJumpAtScreen, nearestPlayerIndexAtScreen } from "./radarHits";
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
    money: 0,
    equip: 0,
    gear: 0,
    primary: 0,
    secondary: 0,
    active: 0,
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
    heatDots: [],
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
