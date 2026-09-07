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
  eraseAt,
  extendDraft,
  hitDrawing,
  hitTestDrawingRef,
  placeText,
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
