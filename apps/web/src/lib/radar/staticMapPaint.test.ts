import { describe, expect, it, vi } from "vitest";
import {
  paintDrawings,
  paintDrawing,
  paintMapImage,
  paintNote,
  paintStaticMap,
} from "./staticMapPaint";
import { emptyNote } from "@/lib/notes/note";
import type { Note } from "@/lib/notes/types";

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

describe("paintNote", () => {
  const toScreen = (x: number, y: number) => ({ x, y });

  it("skips the text drawing currently being edited", () => {
    const ctx = mockCtx();
    const note: Note = {
      ...emptyNote(),
      drawings: [
        { type: "text", color: "#fff", x: 0, y: 0, text: "edit me" },
        {
          type: "pen",
          color: "#fff",
          points: [
            { x: 0, y: 0 },
            { x: 5, y: 5 },
          ],
        },
      ],
    };
    paintNote(ctx, note, toScreen, { tick: 100, skipText: { kind: "loose", index: 0 } });
    expect(ctx.stroke).toHaveBeenCalled();
    expect(ctx.fillText).not.toHaveBeenCalled();
  });

  it("skips bookmarks and hidden drawings", () => {
    const ctx = mockCtx();
    const note: Note = {
      ...emptyNote(),
      bookmarks: [{ color: "#fff", text: "exec", tick: 100 }],
      drawings: [
        {
          type: "arrow",
          color: "#f00",
          from: { x: 0, y: 0 },
          to: { x: 10, y: 10 },
          hidden: true,
        },
        {
          type: "arrow",
          color: "#0f0",
          from: { x: 1, y: 1 },
          to: { x: 11, y: 11 },
        },
      ],
    };
    paintNote(ctx, note, toScreen, { tick: 100 });
    expect(ctx.stroke).toHaveBeenCalledTimes(1);
  });

  it("moves a text note while dragging and paints static maps", () => {
    const ctx = mockCtx();
    const note: Note = {
      ...emptyNote(),
      drawings: [
        {
          type: "text",
          color: "#fff",
          x: 10,
          y: 20,
          text: "note",
          box_w: 80,
          box_h: 40,
        },
      ],
    };
    paintNote(ctx, note, toScreen, {
      tick: 100,
      textMove: {
        ref: { kind: "loose", index: 0 },
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
      note,
      { tick: 100 },
      toScreen,
    );
    expect(ctx.drawImage).toHaveBeenCalled();
  });
});

describe("paintDrawing", () => {
  const toScreen = (x: number, y: number) => ({ x, y });

  it("paints pen, arrow, and text drawings", () => {
    const ctx = mockCtx();
    paintDrawing(
      ctx,
      {
        type: "pen",
        color: "#fff",
        points: [
          { x: 0, y: 0 },
          { x: 2, y: 2 },
        ],
      },
      toScreen,
      { live: true },
    );
    paintDrawing(
      ctx,
      { type: "arrow", color: "#f00", from: { x: 0, y: 0 }, to: { x: 4, y: 4 } },
      toScreen,
    );
    paintDrawing(ctx, { type: "text", color: "#0f0", x: 1, y: 2, text: "hold" }, toScreen);
    paintDrawing(ctx, { type: "text", color: "#0f0", x: 1, y: 2, text: "hold" }, toScreen, {
      alpha: 0.5,
    });
    paintDrawings(
      ctx,
      [{ type: "arrow", color: "#00f", from: { x: 1, y: 1 }, to: { x: 2, y: 2 } }],
      toScreen,
    );
    expect(ctx.stroke).toHaveBeenCalled();
    expect(ctx.fillText).toHaveBeenCalled();
  });
});
