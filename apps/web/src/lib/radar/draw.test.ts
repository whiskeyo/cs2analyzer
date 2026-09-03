import { describe, expect, it } from "vitest";
import { NOTE_TEXT_MAX_WIDTH } from "@/lib/shared/constants";
import { UNIT_CALIBRATION } from "@/lib/testing/fixtures";
import { createMockCanvas, identityToScreen } from "@/lib/testing/mockCanvas";
import { worldToScreen } from "./maps";
import type { Stroke } from "@/lib/notes/types";
import {
  drawArrow,
  drawC4,
  drawHeBurst,
  drawNadeFlightHead,
  drawTextLabel,
  findTextIndex,
  grenadePosAt,
  hitStroke,
  hitTextLabel,
  NADE_FLIGHT_ICON_SIZE,
  yawToCanvas,
} from "./draw";

describe("yawToCanvas", () => {
  it("maps CS2 eye yaw to canvas radians", () => {
    expect(yawToCanvas(0)).toBeCloseTo(Math.PI);
    expect(yawToCanvas(90)).toBeCloseTo(Math.PI / 2);
    expect(yawToCanvas(180)).toBeCloseTo(0);
    expect(yawToCanvas(-90)).toBeCloseTo((3 * Math.PI) / 2);
  });
});

describe("grenadePosAt", () => {
  const points = [
    { tick: 100, x: 0, y: 0, z: 0 },
    { tick: 200, x: 100, y: 0, z: 0 },
    { tick: 300, x: 100, y: 100, z: 0 },
  ];

  it("returns null for an empty path", () => {
    expect(grenadePosAt([], 150)).toBeNull();
  });

  it("returns the first point before the path starts", () => {
    expect(grenadePosAt(points, 50)).toEqual(points[0]);
  });

  it("interpolates between two samples", () => {
    expect(grenadePosAt(points, 150)).toEqual({ x: 50, y: 0 });
  });

  it("returns the last point after the path ends", () => {
    expect(grenadePosAt(points, 400)).toEqual(points[2]);
  });

  it("handles zero-length segments", () => {
    const dup = [
      { tick: 99, x: 10, y: 20, z: 0 },
      { tick: 100, x: 30, y: 40, z: 0 },
    ];
    expect(grenadePosAt(dup, 100)).toEqual({ x: 30, y: 40 });
  });

  it("snaps to the first sample at or before the first tick", () => {
    const dup = [
      { tick: 100, x: 10, y: 20, z: 0 },
      { tick: 100, x: 30, y: 40, z: 0 },
    ];
    expect(grenadePosAt(dup, 50)).toEqual(dup[0]);
  });
});

describe("drawArrow", () => {
  it("strokes the shaft and fills the arrow head", () => {
    const ctx = createMockCanvas();
    drawArrow(ctx, { x: 0, y: 0 }, { x: 100, y: 0 }, "#f00", 2);
    expect(ctx.stroke).toHaveBeenCalledTimes(1);
    expect(ctx.fill).toHaveBeenCalledTimes(1);
    expect(ctx.closePath).toHaveBeenCalledTimes(1);
    expect(ctx.strokeStyle).toBe("#f00");
    expect(ctx.lineWidth).toBe(2);
  });
});

describe("drawC4", () => {
  it("draws the fallback label when no icon is loaded", () => {
    const ctx = createMockCanvas();
    drawC4(ctx, { x: 50, y: 60 }, null);
    expect(ctx.arc).toHaveBeenCalled();
    expect(ctx.fill).toHaveBeenCalled();
    expect(ctx.stroke).toHaveBeenCalled();
    expect(ctx.fillText).toHaveBeenCalledWith("C4", 50, 60);
    expect(ctx.drawImage).not.toHaveBeenCalled();
  });

  it("draws the icon when it is complete", () => {
    const ctx = createMockCanvas();
    const icon = { complete: true, naturalWidth: 32 } as HTMLImageElement;
    drawC4(ctx, { x: 10, y: 20 }, icon);
    expect(ctx.drawImage).toHaveBeenCalledWith(icon, 1, 11, 18, 18);
    expect(ctx.fillText).not.toHaveBeenCalled();
  });

  it("falls back to text when the icon is incomplete", () => {
    const ctx = createMockCanvas();
    const icon = { complete: false, naturalWidth: 32 } as HTMLImageElement;
    drawC4(ctx, { x: 0, y: 0 }, icon);
    expect(ctx.fillText).toHaveBeenCalledWith("C4", 0, 0);
    expect(ctx.drawImage).not.toHaveBeenCalled();
  });
});

describe("drawNadeFlightHead", () => {
  it("draws the weapon SVG when the icon is complete", () => {
    const ctx = createMockCanvas();
    const icon = {
      complete: true,
      naturalWidth: 15,
      naturalHeight: 32,
    } as HTMLImageElement;
    drawNadeFlightHead(ctx, { x: 40, y: 50 }, "smoke", "#aaa", icon);
    const scale = NADE_FLIGHT_ICON_SIZE / 32;
    // Backdrop circle is drawn first, then the icon on top.
    expect(ctx.arc).toHaveBeenCalled();
    expect(ctx.fill).toHaveBeenCalled();
    expect(ctx.drawImage).toHaveBeenCalledWith(
      icon,
      40 - (15 * scale) / 2,
      50 - NADE_FLIGHT_ICON_SIZE / 2,
      15 * scale,
      NADE_FLIGHT_ICON_SIZE,
    );
    expect(ctx.fillRect).not.toHaveBeenCalled();
  });

  it("falls back to a colored circle when the icon is missing", () => {
    const ctx = createMockCanvas();
    drawNadeFlightHead(ctx, { x: 10, y: 20 }, "smoke", "#8ec8e8", null);
    expect(ctx.fillStyle).toBe("#8ec8e8");
    expect(ctx.arc).toHaveBeenCalledWith(10, 20, 4, 0, Math.PI * 2);
    expect(ctx.fill).toHaveBeenCalled();
    expect(ctx.drawImage).not.toHaveBeenCalled();
  });

  it("falls back to a rotated square for HE when the icon is missing", () => {
    const ctx = createMockCanvas();
    drawNadeFlightHead(ctx, { x: 5, y: 6 }, "he", "#9ecb3c", null);
    expect(ctx.save).toHaveBeenCalled();
    expect(ctx.rotate).toHaveBeenCalledWith(Math.PI / 4);
    expect(ctx.fillRect).toHaveBeenCalledWith(-3.4, -3.4, 6.8, 6.8);
    expect(ctx.drawImage).not.toHaveBeenCalled();
  });
});

describe("drawHeBurst", () => {
  it("draws expanding rings and spikes", () => {
    const ctx = createMockCanvas();
    drawHeBurst(ctx, { x: 100, y: 100 }, "#9ecb3c", 0.5, 1);
    expect(ctx.save).toHaveBeenCalledTimes(1);
    expect(ctx.restore).toHaveBeenCalledTimes(1);
    expect(ctx.arc).toHaveBeenCalled();
    expect(ctx.stroke.mock.calls.length).toBeGreaterThanOrEqual(8);
  });

  it("clamps progress and scales with zoom", () => {
    const ctx = createMockCanvas();
    drawHeBurst(ctx, { x: 0, y: 0 }, "#fff", 2, 2);
    expect(ctx.restore).toHaveBeenCalled();
  });

  it("respects opacity", () => {
    const ctx = createMockCanvas();
    drawHeBurst(ctx, { x: 0, y: 0 }, "#fff", 0, 1, 0.5);
    expect(ctx.arc).toHaveBeenCalled();
    expect(ctx.globalAlpha).toBeLessThanOrEqual(1);
  });
});

describe("drawTextLabel", () => {
  const stroke: Extract<Stroke, { type: "text" }> = {
    type: "text",
    round: 1,
    color: "#5b9fd6",
    x: 0,
    y: 0,
    text: "Mid push",
  };

  it("draws a rounded box and wrapped text", () => {
    const ctx = createMockCanvas();
    drawTextLabel(ctx, stroke, { x: 200, y: 300 });
    expect(ctx.roundRect).toHaveBeenCalled();
    expect(ctx.fill).toHaveBeenCalled();
    expect(ctx.stroke).toHaveBeenCalled();
    expect(ctx.clip).toHaveBeenCalled();
    expect(ctx.fillText).toHaveBeenCalled();
    expect(ctx.restore).toHaveBeenCalled();
  });

  it("honours a custom box size", () => {
    const ctx = createMockCanvas();
    const wide: typeof stroke = { ...stroke, box_w: 200, box_h: 80 };
    drawTextLabel(ctx, wide, { x: 0, y: 0 });
    const [, , w, h] = ctx.roundRect.mock.calls[0] ?? [];
    expect(w).toBe(200);
    expect(h).toBe(80);
  });

  it("wraps long lines using measureText", () => {
    const ctx = createMockCanvas();
    ctx.measureText.mockImplementation((text: string) => ({
      width: text.length * 4,
    }));
    const long: typeof stroke = {
      ...stroke,
      text: "one two three four five six seven eight nine ten",
      box_w: 40,
    };
    drawTextLabel(ctx, long, { x: 0, y: 0 });
    expect(ctx.fillText.mock.calls.length).toBeGreaterThan(1);
    expect(ctx.measureText).toHaveBeenCalled();
  });
});

describe("hitTextLabel", () => {
  const stroke: Extract<Stroke, { type: "text" }> = {
    type: "text",
    round: 1,
    color: "#fff",
    x: 0,
    y: 0,
    text: "A",
    box_w: 80,
    box_h: 40,
  };

  it("returns true inside the label box", () => {
    const ctx = createMockCanvas();
    expect(hitTextLabel(ctx, stroke, { x: 100, y: 100 }, 100, 100)).toBe(true);
  });

  it("returns false outside the label box", () => {
    const ctx = createMockCanvas();
    expect(hitTextLabel(ctx, stroke, { x: 100, y: 100 }, 0, 0)).toBe(false);
  });
});

describe("findTextIndex", () => {
  const strokes: Stroke[] = [
    {
      type: "text",
      round: 1,
      color: "#fff",
      x: 10,
      y: 20,
      text: "Top",
      box_w: 60,
      box_h: 30,
    },
    {
      type: "arrow",
      round: 1,
      color: "#f00",
      from: { x: 0, y: 0 },
      to: { x: 50, y: 50 },
    },
  ];

  it("returns the topmost visible text stroke under the cursor", () => {
    const ctx = createMockCanvas();
    const view = { scale: 1, ox: 0, oy: 0 };
    const screen = worldToScreen(UNIT_CALIBRATION, 400, 400, view, 10, 20);
    const idx = findTextIndex(
      ctx,
      UNIT_CALIBRATION,
      400,
      400,
      view,
      strokes,
      100,
      1,
      screen.x,
      screen.y,
    );
    expect(idx).toBe(0);
  });

  it("returns -1 when nothing is hit", () => {
    const ctx = createMockCanvas();
    const view = { scale: 1, ox: 0, oy: 0 };
    expect(findTextIndex(ctx, UNIT_CALIBRATION, 400, 400, view, strokes, 100, 1, 0, 0)).toBe(-1);
  });

  it("skips hidden text strokes", () => {
    const ctx = createMockCanvas();
    const hidden: Stroke[] = [{ ...strokes[0], hidden: true } as Stroke];
    const view = { scale: 1, ox: 0, oy: 0 };
    expect(findTextIndex(ctx, UNIT_CALIBRATION, 400, 400, view, hidden, 100, 1, 10, 1004)).toBe(-1);
  });
});

describe("hitStroke", () => {
  it("hits pen points within maxDist", () => {
    const pen: Stroke = {
      type: "pen",
      round: 1,
      color: "#fff",
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 100 },
      ],
    };
    expect(hitStroke(pen, 100, 100, 5)).toBe(true);
    expect(hitStroke(pen, 200, 200, 5)).toBe(false);
  });

  it("hits along an arrow segment", () => {
    const arrow: Stroke = {
      type: "arrow",
      round: 1,
      color: "#fff",
      from: { x: 0, y: 0 },
      to: { x: 100, y: 0 },
    };
    expect(hitStroke(arrow, 50, 0, 3)).toBe(true);
    expect(hitStroke(arrow, 50, 50, 3)).toBe(false);
  });

  it("ignores text and bookmarks", () => {
    expect(
      hitStroke({ type: "text", round: 1, color: "#fff", x: 0, y: 0, text: "x" }, 0, 0, 100),
    ).toBe(false);
    expect(hitStroke({ type: "bookmark", round: 1, color: "#fff", text: "exec" }, 0, 0, 100)).toBe(
      false,
    );
  });
});

describe("drawTextLabel width fallback", () => {
  it("uses NOTE_TEXT_MAX_WIDTH when box_w is omitted", () => {
    const ctx = createMockCanvas({ textWidth: NOTE_TEXT_MAX_WIDTH + 10 });
    const stroke: Extract<Stroke, { type: "text" }> = {
      type: "text",
      round: 1,
      color: "#fff",
      x: 0,
      y: 0,
      text: "word ".repeat(20),
    };
    drawTextLabel(ctx, stroke, identityToScreen(0, 0));
    expect(ctx.measureText).toHaveBeenCalled();
  });
});
