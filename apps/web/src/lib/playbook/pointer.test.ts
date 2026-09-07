import { describe, expect, it } from "vitest";
import { emptyNote } from "@/lib/notes/note";
import {
  applyPlaybookWheel,
  applyPieceDrag,
  beginPlaybookPan,
  createPlaybookView,
  endPlaybookPan,
  movePlaybookPan,
  pieceDragAt,
} from "./pointer";
import { makePiece } from "./pieces";

describe("playbook pan and zoom", () => {
  it("starts at identity and pans while dragging", () => {
    const view = createPlaybookView();
    expect(view).toMatchObject({ scale: 1, ox: 0, oy: 0, dragging: false });
    movePlaybookPan(view, 20, 10);
    expect(view.ox).toBe(0);
    beginPlaybookPan(view, 10, 10);
    expect(view.dragging).toBe(true);
    movePlaybookPan(view, 25, 18);
    expect(view.ox).toBe(15);
    expect(view.oy).toBe(8);
    endPlaybookPan(view);
    expect(view.dragging).toBe(false);
    movePlaybookPan(view, 40, 40);
    expect(view.ox).toBe(15);
  });

  it("zooms toward the cursor", () => {
    const view = createPlaybookView();
    const before = view.scale;
    applyPlaybookWheel(view, 400, 400, 200, 200, -100);
    expect(view.scale).toBeGreaterThan(before);
    const zoomed = view.scale;
    applyPlaybookWheel(view, 400, 400, 200, 200, 100);
    expect(view.scale).toBeLessThan(zoomed);
  });
});

describe("piece drag", () => {
  it("moves a token by the grab offset and rotates a pawn", () => {
    const pawn = makePiece("pawn", 10, 20, { id: "p", side: "CT", yaw: 0 });
    const note = emptyNote();
    note.pieces.push(pawn);
    const drag = pieceDragAt(pawn, { x: 8, y: 18 }, false);
    expect(drag).toMatchObject({ id: "p", rotate: false, grabDx: 2, grabDy: 2 });
    const moved = applyPieceDrag(note, drag, { x: 30, y: 40 }, { x: 0, y: 0 }, { x: 0, y: 0 });
    expect(moved.pieces[0]).toMatchObject({ x: 32, y: 42 });

    const rotate = pieceDragAt(pawn, { x: 10, y: 20 }, true);
    const aimed = applyPieceDrag(note, rotate, { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 0 });
    expect(aimed.pieces[0]?.yaw).not.toBe(0);
    expect(
      applyPieceDrag(
        note,
        { ...drag, id: "missing" },
        { x: 1, y: 1 },
        { x: 0, y: 0 },
        { x: 0, y: 0 },
      ),
    ).toBe(note);
  });
});
