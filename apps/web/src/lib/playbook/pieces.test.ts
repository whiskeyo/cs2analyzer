import { describe, expect, it } from "vitest";
import { emptyNote } from "@/lib/notes/note";
import type { Piece, PieceKind } from "@/lib/notes/types";
import { canvasToYaw, yawToCanvas } from "@/lib/radar/draw";
import { CT_COLOR, T_COLOR } from "@/lib/radar/radarFrame";
import {
  addPiece,
  GRENADE_PIECE_KINDS,
  hitTestPiece,
  isGrenadePieceKind,
  makePiece,
  movePiece,
  PALETTE_TOKENS,
  paletteAriaLabel,
  pawnColor,
  PIECE_HIT_PX,
  pieceFromTool,
  pieceKindLabel,
  pieceLabel,
  playbookToolCursor,
  removePiece,
  resolvePlaybookDown,
  rotateGizmoHit,
  rotateHandleOffset,
  PLAYBOOK_ROTATE_RADIUS_PX,
  PLAYBOOK_ROTATE_HIT_PX,
  setPieceLabel,
  setPieceYaw,
  yawTowardScreen,
} from "./pieces";

const identity = (x: number, y: number) => ({ x, y });

function pawnAt(id: string, x: number, y: number): Piece {
  return makePiece("pawn", x, y, { id, side: "CT" });
}

describe("makePiece / pieceFromTool", () => {
  it("defaults a pawn to CT, yaw 0, alive", () => {
    const piece = makePiece("pawn", 1, 2, { id: "p1" });
    expect(piece).toMatchObject({
      id: "p1",
      kind: "pawn",
      x: 1,
      y: 2,
      side: "CT",
      yaw: 0,
      alive: true,
    });
  });

  it("keeps explicit pawn fields and extra metadata", () => {
    const piece = makePiece("pawn", 3, 4, {
      id: "p2",
      side: "T",
      yaw: 90,
      alive: false,
      label: "s1mple",
      z: 10,
      carriesC4: true,
    });
    expect(piece).toMatchObject({
      side: "T",
      yaw: 90,
      alive: false,
      label: "s1mple",
      z: 10,
      carriesC4: true,
    });
  });

  it("assigns an id when none is given", () => {
    expect(makePiece("bomb", 0, 0).id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it("builds a token from each palette tool and ignores pan", () => {
    expect(pieceFromTool("pan", 1, 1)).toBeNull();
    expect(pieceFromTool("pen", 1, 1)).toBeNull();
    expect(pieceFromTool("youtube", 1, 1)).toBeNull();
    expect(pieceFromTool("pawn-ct", 1, 2)).toMatchObject({
      kind: "pawn",
      side: "CT",
      x: 1,
      y: 2,
    });
    expect(pieceFromTool("pawn-t", 3, 4)).toMatchObject({
      kind: "pawn",
      side: "T",
    });
    expect(pieceFromTool("bomb", 5, 6)).toMatchObject({
      kind: "bomb",
      x: 5,
      y: 6,
    });
    for (const kind of GRENADE_PIECE_KINDS) {
      expect(pieceFromTool(kind, 0, 0)?.kind).toBe(kind);
    }
    expect(
      pieceFromTool("smoke", 0, 0, {
        nadeStyle: "effect",
        trail: [{ x: 1, y: 1 }],
      }),
    ).toMatchObject({
      kind: "smoke",
      nadeStyle: "effect",
      trail: [{ x: 1, y: 1 }],
    });
  });
});

describe("piece labels and colors", () => {
  it("labels every kind and prefers a custom name", () => {
    const kinds: PieceKind[] = [
      "pawn",
      "smoke",
      "flash",
      "he",
      "molotov",
      "incendiary",
      "decoy",
      "bomb",
    ];
    expect(kinds.map(pieceKindLabel)).toEqual([
      "Pawn",
      "Smoke",
      "Flash",
      "HE",
      "Molly",
      "Incendiary",
      "Decoy",
      "Bomb",
    ]);
    expect(pieceLabel(makePiece("pawn", 0, 0, { side: "T" }))).toBe("T");
    expect(pieceLabel(makePiece("pawn", 0, 0, { side: undefined }))).toBe("CT");
    expect(pieceLabel({ id: "x", kind: "pawn", x: 0, y: 0 })).toBe("Pawn");
    expect(pieceLabel(makePiece("smoke", 0, 0, { label: "  A smoke  " }))).toBe("A smoke");
    expect(pieceLabel(makePiece("he", 0, 0, { label: "   " }))).toBe("HE");
    expect(pawnColor("T")).toBe(T_COLOR);
    expect(pawnColor("CT")).toBe(CT_COLOR);
    expect(pawnColor(undefined)).toBe(CT_COLOR);
  });

  it("treats grenade kinds as grenades and lists the palette", () => {
    expect(isGrenadePieceKind("smoke")).toBe(true);
    expect(isGrenadePieceKind("pawn")).toBe(false);
    expect(isGrenadePieceKind("bomb")).toBe(false);
    expect(PALETTE_TOKENS.map((row) => row.tool)).toEqual([
      "pawn-ct",
      "pawn-t",
      "smoke",
      "flash",
      "he",
      "molotov",
      "incendiary",
      "decoy",
      "bomb",
      "youtube",
    ]);
    expect(playbookToolCursor("pan")).toBe("grab");
    expect(playbookToolCursor("smoke")).toBe("copy");
    expect(playbookToolCursor("smoke", true)).toBe("crosshair");
    expect(playbookToolCursor("pen")).toBe("crosshair");
    expect(playbookToolCursor("eraser")).toBe("cell");
    expect(PALETTE_TOKENS.map((row) => paletteAriaLabel(row))).toEqual([
      "CT pawn",
      "T pawn",
      "Smoke",
      "Flash",
      "HE",
      "Molly",
      "Incendiary",
      "Decoy",
      "Bomb",
      "YouTube",
    ]);
  });
});

describe("note piece ops", () => {
  it("adds, moves, labels, rotates, and removes", () => {
    let note = addPiece(emptyNote(), pawnAt("a", 0, 0));
    note = addPiece(note, makePiece("smoke", 8, 8, { id: "s" }));
    expect(note.pieces).toHaveLength(2);

    note = movePiece(note, "a", 10, 20);
    expect(note.pieces[0]).toMatchObject({ x: 10, y: 20 });
    expect(movePiece(note, "missing", 1, 1)).toBe(note);

    note = setPieceYaw(note, "a", 45);
    expect(note.pieces[0]?.yaw).toBe(45);
    expect(setPieceYaw(note, "s", 90)).toBe(note);
    expect(setPieceYaw(note, "missing", 1)).toBe(note);

    note = setPieceLabel(note, "a", "  entry  ");
    expect(note.pieces[0]?.label).toBe("entry");
    note = setPieceLabel(note, "a", "   ");
    expect(note.pieces[0]?.label).toBeUndefined();
    expect(setPieceLabel(note, "missing", "x")).toBe(note);

    note = removePiece(note, "s");
    expect(note.pieces.map((row) => row.id)).toEqual(["a"]);
    expect(removePiece(note, "missing")).toBe(note);
  });
});

describe("hitTestPiece", () => {
  it("picks the top overlapping token inside the hit radius", () => {
    const pieces = [pawnAt("bottom", 0, 0), pawnAt("top", 2, 0)];
    expect(hitTestPiece(pieces, { x: 2, y: 0 }, identity)?.id).toBe("top");
    expect(hitTestPiece(pieces, { x: 0, y: 0 }, identity, 1)?.id).toBe("bottom");
    expect(hitTestPiece(pieces, { x: 100, y: 100 }, identity)).toBeNull();
    expect(hitTestPiece([], { x: 0, y: 0 }, identity)).toBeNull();
    expect(hitTestPiece(pieces, { x: PIECE_HIT_PX, y: 0 }, identity, PIECE_HIT_PX)?.id).toBe("top");
  });
});

describe("yawTowardScreen / resolvePlaybookDown", () => {
  it("points a pawn along the screen delta", () => {
    expect(yawTowardScreen({ x: 0, y: 0 }, { x: 10, y: 0 })).toBeCloseTo(canvasToYaw(0));
    expect(yawTowardScreen({ x: 0, y: 0 }, { x: 0, y: 10 })).toBeCloseTo(canvasToYaw(Math.PI / 2));
    expect(yawToCanvas(yawTowardScreen({ x: 0, y: 0 }, { x: -4, y: 0 }))).toBeCloseTo(Math.PI);
  });

  it("places on a token tool, else moves or pans", () => {
    const pawn = pawnAt("p", 0, 0);
    const smoke = makePiece("smoke", 0, 0, { id: "s" });
    expect(resolvePlaybookDown("youtube", null, false)).toBe("place");
    expect(resolvePlaybookDown("smoke", null, false)).toBe("place");
    expect(resolvePlaybookDown("smoke", null, false, true)).toBe("nade-trail");
    expect(resolvePlaybookDown("pen", null, false)).toBe("draw");
    expect(resolvePlaybookDown("arrow", null, false)).toBe("draw");
    expect(resolvePlaybookDown("eraser", pawn, false)).toBe("erase");
    expect(resolvePlaybookDown("pan", pawn, true)).toBe("rotate");
    expect(resolvePlaybookDown("pan", pawn, false)).toBe("move");
    expect(resolvePlaybookDown("pan", smoke, true)).toBe("move");
    expect(resolvePlaybookDown("pan", null, true)).toBe("pan");
  });

  it("hits the aim ring around a pawn, not the centre or far away", () => {
    const at = { x: 0, y: 0 };
    const handle = rotateHandleOffset(0);
    expect(Math.hypot(handle.x, handle.y)).toBeCloseTo(PLAYBOOK_ROTATE_RADIUS_PX);
    expect(rotateGizmoHit(at, { x: at.x + handle.x, y: at.y + handle.y })).toBe(true);
    expect(rotateGizmoHit(at, at)).toBe(false);
    expect(
      rotateGizmoHit(at, {
        x: PLAYBOOK_ROTATE_RADIUS_PX + PLAYBOOK_ROTATE_HIT_PX + 1,
        y: 0,
      }),
    ).toBe(false);
  });
});
