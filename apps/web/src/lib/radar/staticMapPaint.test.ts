import { describe, expect, it, vi } from "vitest";
import { paintMapImage, paintNoteStrokes, paintStaticMap, paintStroke } from "./staticMapPaint";
import type { Stroke } from "@/lib/notes/types";

function mockCtx() {
  return {
    drawImage: vi.fn(),
    fillRect: vi.fn(),
    fillText: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    closePath: vi.fn(),
    fill: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    clip: vi.fn(),
    roundRect: vi.fn(),
    measureText: vi.fn(() => ({ width: 40 })),
    globalAlpha: 1,
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    lineJoin: "round",
    lineCap: "round",
    font: "",
    textAlign: "left",
    textBaseline: "top",
  } as unknown as CanvasRenderingContext2D;
}

describe("paintMapImage", () => {
  it("draws the radar PNG at the layout rect", () => {
    const ctx = mockCtx();
    const img = { complete: true, naturalWidth: 1024 } as HTMLImageElement;
    paintMapImage(ctx, 400, 400, { scale: 1, ox: 0, oy: 0 }, img, undefined);
    expect(ctx.drawImage).toHaveBeenCalledWith(img, 16, 16, 368, 368);
  });

  it("shows a placeholder when calibration is missing", () => {
    const ctx = mockCtx();
    paintMapImage(ctx, 400, 400, { scale: 1, ox: 0, oy: 0 }, null, undefined);
    expect(ctx.fillRect).toHaveBeenCalledWith(16, 16, 368, 368);
    expect(ctx.fillText).toHaveBeenCalledWith("No radar for this map — showing world XY", 16, 24);
  });
});

describe("paintNoteStrokes", () => {
  const toScreen = (x: number, y: number) => ({ x, y });

  it("skips the text stroke currently being edited", () => {
    const ctx = mockCtx();
    const strokes: Stroke[] = [
      { type: "text", round: 1, color: "#fff", x: 0, y: 0, text: "edit me" },
      {
        type: "pen",
        round: 1,
        color: "#fff",
        points: [
          { x: 0, y: 0 },
          { x: 5, y: 5 },
        ],
      },
    ];
    paintNoteStrokes(ctx, strokes, toScreen, { tick: 100, round: 1, skipTextIndex: 0 });
    expect(ctx.stroke).toHaveBeenCalled();
    expect(ctx.fillText).not.toHaveBeenCalled();
  });

  it("skips bookmarks and hidden strokes", () => {
    const ctx = mockCtx();
    const strokes: Stroke[] = [
      {
        type: "bookmark",
        round: 1,
        color: "#fff",
        text: "exec",
      },
      {
        type: "arrow",
        round: 1,
        color: "#f00",
        from: { x: 0, y: 0 },
        to: { x: 10, y: 10 },
        hidden: true,
      },
      {
        type: "arrow",
        round: 1,
        color: "#0f0",
        from: { x: 1, y: 1 },
        to: { x: 11, y: 11 },
      },
    ];
    paintNoteStrokes(ctx, strokes, toScreen, { tick: 100, round: 1 });
    expect(ctx.stroke).toHaveBeenCalledTimes(1);
  });

  it("moves a text note while dragging and paints static maps", () => {
    const ctx = mockCtx();
    const strokes: Stroke[] = [
      {
        type: "text",
        round: 1,
        color: "#fff",
        x: 10,
        y: 20,
        text: "note",
        box_w: 80,
        box_h: 40,
      },
    ];
    paintNoteStrokes(ctx, strokes, toScreen, {
      tick: 100,
      round: 1,
      textMove: {
        index: 0,
        x: 30,
        y: 40,
        moved: true,
      },
    });
    expect(ctx.fillText).toHaveBeenCalled();

    const img = { complete: true, naturalWidth: 1024 } as HTMLImageElement;
    paintStaticMap(
      ctx,
      400,
      400,
      { scale: 1, ox: 0, oy: 0 },
      img,
      undefined,
      strokes,
      { tick: 100, round: 1 },
      toScreen,
    );
    expect(ctx.drawImage).toHaveBeenCalled();
  });
});

describe("paintStroke", () => {
  it("ignores bookmarks", () => {
    const ctx = mockCtx();
    paintStroke(ctx, { type: "bookmark", round: 1, color: "#fff", text: "mid" }, (x, y) => ({
      x,
      y,
    }));
    expect(ctx.beginPath).not.toHaveBeenCalled();
  });
});
