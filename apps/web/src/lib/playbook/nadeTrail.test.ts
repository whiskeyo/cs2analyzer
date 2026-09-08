import { describe, expect, it } from "vitest";
import {
  bounceNadeTrail,
  finishNadeTrail,
  hoverNadeTrail,
  isNadeTrailTool,
  nadeTrailPreview,
  startNadeTrail,
} from "./nadeTrail";

describe("nade trail draft", () => {
  it("starts, bounces, hovers, and finishes with style", () => {
    const start = startNadeTrail("smoke", { x: 1, y: 2 });
    expect(start).toEqual({
      kind: "smoke",
      points: [{ x: 1, y: 2 }],
      hover: { x: 1, y: 2 },
    });
    const bounced = bounceNadeTrail(start, { x: 4, y: 6 });
    expect(bounced.points).toEqual([
      { x: 1, y: 2 },
      { x: 4, y: 6 },
    ]);
    const hovered = hoverNadeTrail(bounced, { x: 8, y: 9 });
    expect(nadeTrailPreview(hovered)).toEqual([
      { x: 1, y: 2 },
      { x: 4, y: 6 },
      { x: 8, y: 9 },
    ]);
    expect(nadeTrailPreview({ ...bounced, hover: null })).toEqual(bounced.points);
    const piece = finishNadeTrail(hovered, { x: 10, y: 11 }, "effect");
    expect(piece).toMatchObject({
      kind: "smoke",
      x: 10,
      y: 11,
      nadeStyle: "effect",
      trail: [
        { x: 1, y: 2 },
        { x: 4, y: 6 },
      ],
    });
    expect(finishNadeTrail(start, { x: 3, y: 3 }).nadeStyle).toBe("icon");
  });

  it("only treats grenade tools as trail tools", () => {
    expect(isNadeTrailTool("smoke")).toBe(true);
    expect(isNadeTrailTool("flash")).toBe(true);
    expect(isNadeTrailTool("pan")).toBe(false);
    expect(isNadeTrailTool("bomb")).toBe(false);
    expect(isNadeTrailTool("pawn-ct")).toBe(false);
  });
});
