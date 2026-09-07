import { describe, expect, it } from "vitest";
import { emptyNote } from "@/lib/notes/note";
import { createMockCanvas } from "@/lib/testing/mockCanvas";
import { PEN_MIN_SAMPLE_DISTANCE } from "@/lib/shared/constants";
import { makePiece } from "./pieces";
import {
  addDrawing,
  beginArrow,
  beginPen,
  commitDraft,
  DEFAULT_TEXT_LABEL,
  drawingFromRef,
  eraseAt,
  extendDraft,
  hitDrawing,
  hitTestDrawingRef,
  moveDrawingAt,
  placeText,
  translateDrawing,
} from "./drawings";

const identity = (x: number, y: number) => ({ x, y });

describe("draft pen and arrow", () => {
  it("samples pen points and drops a tap", () => {
    const start = beginPen("#fff", { x: 0, y: 0 });
    const same = extendDraft(start, { x: 1, y: 0 });
    expect(same).toBe(start);
    const moved = extendDraft(start, { x: PEN_MIN_SAMPLE_DISTANCE, y: 0 });
    expect(moved).not.toBe(start);
    expect(commitDraft(start)).toBeNull();
    expect(commitDraft(moved)?.type).toBe("pen");
  });

  it("stretches an arrow and drops a zero-length one", () => {
    const start = beginArrow("#f00", { x: 0, y: 0 });
    expect(commitDraft(start)).toBeNull();
    const stretched = extendDraft(start, { x: 8, y: 4 });
    expect(stretched).toMatchObject({ type: "arrow", to: { x: 8, y: 4 } });
    expect(commitDraft(stretched)).toEqual(stretched);
    expect(extendDraft(placeText("#fff", { x: 0, y: 0 }), { x: 1, y: 1 }).type).toBe("text");
  });

  it("places text and rejects a blank label", () => {
    expect(placeText("#0f0", { x: 2, y: 3 })).toEqual({
      type: "text",
      color: "#0f0",
      x: 2,
      y: 3,
      text: DEFAULT_TEXT_LABEL,
    });
    expect(commitDraft(placeText("#0f0", { x: 0, y: 0 }, "  "))).toBeNull();
    expect(commitDraft(placeText("#0f0", { x: 0, y: 0 }, "hold"))).toMatchObject({ text: "hold" });
  });
});

describe("hit and erase", () => {
  it("hits a pen, an arrow, and skips text without a context", () => {
    const pen: ReturnType<typeof beginPen> = {
      type: "pen",
      color: "#fff",
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
      ],
    };
    const arrow = beginArrow("#fff", { x: 0, y: 0 });
    const stretched = extendDraft(arrow, { x: 20, y: 0 });
    expect(hitDrawing(pen, { x: 10, y: 0 })).toBe(true);
    expect(hitDrawing(pen, { x: 400, y: 400 })).toBe(false);
    expect(hitDrawing(stretched, { x: 10, y: 0 })).toBe(true);
    expect(hitDrawing(placeText("#fff", { x: 0, y: 0 }), { x: 0, y: 0 })).toBe(false);
  });

  it("erases the top piece, then a loose drawing, then a grouped drawing", () => {
    let note = emptyNote();
    note = addDrawing(note, {
      type: "pen",
      color: "#fff",
      points: [
        { x: 100, y: 0 },
        { x: 104, y: 0 },
      ],
    });
    note.groups.push({
      id: "g",
      name: "g",
      drawings: [
        { type: "arrow", color: "#f00", from: { x: 300, y: 0 }, to: { x: 320, y: 0 } },
        { type: "arrow", color: "#0f0", from: { x: 300, y: 20 }, to: { x: 320, y: 20 } },
      ],
    });
    note.pieces.push(makePiece("bomb", 0, 0, { id: "c4" }));
    const ctx = createMockCanvas();
    note = eraseAt(note, { x: 0, y: 0 }, { x: 0, y: 0 }, identity, ctx);
    expect(note.pieces).toHaveLength(0);
    expect(hitTestDrawingRef(note, { x: 100, y: 0 }, { x: 100, y: 0 }, identity, ctx)).toEqual({
      kind: "loose",
      index: 0,
    });
    note = eraseAt(note, { x: 100, y: 0 }, { x: 100, y: 0 }, identity, ctx);
    expect(note.drawings).toHaveLength(0);
    expect(note.groups).toHaveLength(1);
    note = eraseAt(note, { x: 310, y: 0 }, { x: 310, y: 0 }, identity, ctx);
    expect(note.groups).toHaveLength(0);
    expect(note.drawings).toHaveLength(1);
    note = eraseAt(note, { x: 310, y: 20 }, { x: 310, y: 20 }, identity, ctx);
    expect(note.drawings).toHaveLength(0);
    expect(eraseAt(note, { x: 999, y: 999 }, { x: 999, y: 999 }, identity, ctx)).toBe(note);
  });

  it("hits text with a canvas context and skips hidden items", () => {
    const ctx = createMockCanvas();
    const note = emptyNote();
    note.drawings.push(placeText("#fff", { x: 0, y: 0 }, "hold"));
    note.drawings.push({
      type: "pen",
      color: "#fff",
      points: [
        { x: 400, y: 400 },
        { x: 404, y: 400 },
      ],
      hidden: true,
    });
    note.groups.push({
      id: "h",
      name: "h",
      hidden: true,
      drawings: [{ type: "arrow", color: "#fff", from: { x: 500, y: 0 }, to: { x: 520, y: 0 } }],
    });
    expect(hitTestDrawingRef(note, { x: 0, y: 0 }, { x: 0, y: 0 }, identity, ctx)).toEqual({
      kind: "loose",
      index: 0,
    });
    expect(
      hitTestDrawingRef(note, { x: 400, y: 400 }, { x: 400, y: 400 }, identity, ctx),
    ).toBeNull();
    expect(hitTestDrawingRef(note, { x: 0, y: 0 }, { x: 0, y: 0 }, identity, null)).toBeNull();
  });
});

describe("translate / move drawings", () => {
  it("shifts pen points, arrow ends, and text", () => {
    const pen = translateDrawing(beginPen("#fff", { x: 0, y: 0 }), 4, -2);
    expect(pen).toMatchObject({ type: "pen", points: [{ x: 4, y: -2 }] });
    const arrow = translateDrawing(beginArrow("#f00", { x: 1, y: 1 }), 3, 5);
    expect(arrow).toMatchObject({
      type: "arrow",
      from: { x: 4, y: 6 },
      to: { x: 4, y: 6 },
    });
    expect(translateDrawing(placeText("#0f0", { x: 2, y: 3 }, "hold"), 1, 1)).toMatchObject({
      x: 3,
      y: 4,
    });
    const same = beginPen("#fff", { x: 0, y: 0 });
    expect(translateDrawing(same, 0, 0)).toBe(same);
  });

  it("moves a loose pen and a grouped arrow, and ignores a missing ref", () => {
    let note = addDrawing(emptyNote(), {
      type: "pen",
      color: "#fff",
      points: [
        { x: 0, y: 0 },
        { x: 2, y: 0 },
      ],
    });
    note.groups.push({
      id: "g",
      name: "g",
      drawings: [
        { type: "arrow", color: "#f00", from: { x: 10, y: 10 }, to: { x: 20, y: 10 } },
        { type: "arrow", color: "#0f0", from: { x: 10, y: 30 }, to: { x: 20, y: 30 } },
      ],
    });
    expect(drawingFromRef(note, { kind: "loose", index: 0 })?.type).toBe("pen");
    expect(drawingFromRef(note, { kind: "group", groupIndex: 0, drawingIndex: 0 })?.type).toBe(
      "arrow",
    );
    expect(drawingFromRef(note, { kind: "bookmark", index: 0 })).toBeNull();

    note = moveDrawingAt(note, { kind: "loose", index: 0 }, 5, 1);
    expect(note.drawings[0]).toMatchObject({
      points: [
        { x: 5, y: 1 },
        { x: 7, y: 1 },
      ],
    });
    note = moveDrawingAt(note, { kind: "group", groupIndex: 0, drawingIndex: 0 }, 0, 8);
    expect(note.groups[0]?.drawings[0]).toMatchObject({
      from: { x: 10, y: 18 },
      to: { x: 20, y: 18 },
    });
    expect(note.groups[0]?.drawings[1]).toMatchObject({ from: { x: 10, y: 30 } });
    expect(moveDrawingAt(note, { kind: "loose", index: 9 }, 1, 1)).toBe(note);
    expect(moveDrawingAt(note, { kind: "group", groupIndex: 3, drawingIndex: 0 }, 1, 1)).toBe(note);
    expect(moveDrawingAt(note, { kind: "bookmark", index: 0 }, 1, 1)).toBe(note);
    expect(moveDrawingAt(note, { kind: "loose", index: 0 }, 0, 0)).toBe(note);
  });
});
