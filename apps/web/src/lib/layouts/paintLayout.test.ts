import { describe, expect, it } from "vitest";
import { paintCalloutRegions, paintDraft, paintLayoutFrame } from "./paintLayout";
import { createMockCanvas } from "@/lib/layouts/testing/mockCanvas";
import { SQUARE, poly } from "@/lib/layouts/testing/callouts";
import type { RadarView } from "./maps";

const identity = (p: { x: number; y: number }) => p;
const view: RadarView = { scale: 1, ox: 0, oy: 0 };

describe("paintCalloutRegions", () => {
  it("fills a polygon and a selected circle with vertex handles", () => {
    const ctx = createMockCanvas();
    paintCalloutRegions(
      ctx,
      [
        poly("yard", "Yard"),
        {
          id: "pit",
          name: "Pit",
          floor: "default",
          regions: [{ kind: "circle", x: 20, y: 20, radius: 8 }],
        },
        { ...poly("secret", "Secret"), floor: "lower" },
      ],
      "default",
      ["pit"],
      identity,
    );
    expect(ctx.arc).toHaveBeenCalled();
    expect(ctx.fillText).toHaveBeenCalledWith("Pit", 20, 20);
    expect(ctx.fillText).toHaveBeenCalledWith("Yard", expect.any(Number), expect.any(Number));
  });

  it("draws vertex handles on a single selected polygon", () => {
    const ctx = createMockCanvas();
    paintCalloutRegions(ctx, [poly("yard", "Yard")], "default", ["yard"], identity);
    expect(ctx.arc).toHaveBeenCalled();
  });
});

describe("paintDraft", () => {
  it("strokes a polygon, a rect, and a circle preview", () => {
    const ctx = createMockCanvas();
    paintDraft(ctx, { kind: "polygon", points: SQUARE.slice(0, 2) }, { x: 4, y: 4 }, identity);
    paintDraft(ctx, { kind: "rect", start: { x: 0, y: 0 }, end: { x: 8, y: 8 } }, null, identity);
    paintDraft(ctx, { kind: "circle", start: { x: 0, y: 0 }, end: { x: 5, y: 0 } }, null, identity);
    paintDraft(ctx, { kind: "polygon", points: [] }, null, identity);
    expect(ctx.setLineDash).toHaveBeenCalled();
    expect(ctx.rect).toHaveBeenCalled();
    expect(ctx.arc).toHaveBeenCalled();
  });
});

describe("paintLayoutFrame", () => {
  it("draws the radar image when present and a fallback rect otherwise", () => {
    const ctx = createMockCanvas();
    const image = {} as CanvasImageSource;
    paintLayoutFrame(ctx, {
      w: 200,
      h: 200,
      view,
      floor: "default",
      callouts: [poly("a")],
      selectedIds: ["a"],
      draft: { kind: "polygon", points: [{ x: 1, y: 1 }] },
      cursor: { x: 2, y: 2 },
      image,
      toScreen: identity,
      fit: 100,
      baseX: 10,
      baseY: 10,
    });
    expect(ctx.drawImage).toHaveBeenCalled();
    paintLayoutFrame(ctx, {
      w: 200,
      h: 200,
      view,
      floor: "default",
      callouts: [],
      selectedIds: [],
      draft: null,
      cursor: null,
      image: null,
      toScreen: identity,
      fit: 100,
      baseX: 10,
      baseY: 10,
    });
    expect(ctx.fillRect).toHaveBeenCalled();
  });
});
