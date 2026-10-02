import { describe, expect, it } from "vitest";
import { DEFAULT_TICK_RATE, PAWN_INTERP_MAX_SPEED } from "@/lib/shared/constants";
import { FLAG_ALIVE, FLAG_PRESENT } from "@/lib/replay/replayTypes";
import { interpolatePawn, pawnInterpMaxDistance, type InterpPawn } from "./interpolate";

const RATE = DEFAULT_TICK_RATE;
const STRIDE = 4;
const ALIVE = FLAG_PRESENT | FLAG_ALIVE;

function pawn(partial: Partial<InterpPawn> & Pick<InterpPawn, "x" | "y">): InterpPawn {
  return {
    z: 0,
    yaw: 0,
    flags: ALIVE,
    ...partial,
  };
}

describe("interpolatePawn", () => {
  it("draws the later sample from the first in-between tick when alive becomes dead", () => {
    const earlier = pawn({ x: 0, y: 0, flags: ALIVE });
    const later = pawn({ x: 4, y: 0, flags: FLAG_PRESENT });
    expect(interpolatePawn(earlier, later, 0, STRIDE, RATE)).toMatchObject({
      x: 0,
      snapped: false,
    });
    expect(interpolatePawn(earlier, later, 0.5, STRIDE, RATE)).toEqual({
      x: 4,
      y: 0,
      z: 0,
      yaw: 0,
      snapped: true,
    });
  });

  it("draws the later sample when a pawn goes from not present to present", () => {
    const earlier = pawn({ x: 0, y: 0, flags: 0 });
    const later = pawn({ x: 8, y: 2, flags: ALIVE });
    expect(interpolatePawn(earlier, later, 0.25, STRIDE, RATE)).toMatchObject({
      x: 8,
      y: 2,
      snapped: true,
    });
  });

  it("snaps a horizontal jump faster than the speed limit", () => {
    const limit = pawnInterpMaxDistance(STRIDE, RATE);
    expect(limit).toBe((PAWN_INTERP_MAX_SPEED * STRIDE) / RATE);
    const earlier = pawn({ x: 0, y: 0 });
    const later = pawn({ x: limit + 1, y: 0 });
    expect(interpolatePawn(earlier, later, 0.5, STRIDE, RATE).snapped).toBe(true);
    expect(interpolatePawn(earlier, later, 0.5, STRIDE, RATE).x).toBe(limit + 1);
    expect(interpolatePawn(earlier, pawn({ x: limit, y: 0 }), 0.5, STRIDE, RATE)).toMatchObject({
      x: limit / 2,
      snapped: false,
    });
  });

  it("still blends a large vertical drop when the horizontal move is small", () => {
    const earlier = pawn({ x: 0, y: 0, z: 400 });
    const later = pawn({ x: 10, y: 0, z: -1600 });
    expect(interpolatePawn(earlier, later, 0.5, STRIDE, RATE)).toEqual({
      x: 5,
      y: 0,
      z: -600,
      yaw: 0,
      snapped: false,
    });
  });

  it("scales the teleport limit with the tick gap", () => {
    const jump = 200;
    const earlier = pawn({ x: 0, y: 0 });
    const later = pawn({ x: jump, y: 0 });
    expect(jump).toBeGreaterThan(pawnInterpMaxDistance(STRIDE, RATE));
    expect(jump).toBeLessThan(pawnInterpMaxDistance(STRIDE * 4, RATE));
    expect(interpolatePawn(earlier, later, 0.5, STRIDE, RATE).snapped).toBe(true);
    expect(interpolatePawn(earlier, later, 0.5, STRIDE * 4, RATE)).toMatchObject({
      x: jump / 2,
      snapped: false,
    });
  });

  it("blends yaw from 179 to -179 along the short arc", () => {
    const earlier = pawn({ x: 0, y: 0, yaw: 179 });
    const later = pawn({ x: 0, y: 0, yaw: -179 });
    expect(interpolatePawn(earlier, later, 0.5, STRIDE, RATE).yaw).toBe(180);
    expect(interpolatePawn(earlier, later, 0.5, STRIDE, RATE).snapped).toBe(false);
  });
});
