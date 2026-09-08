import { describe, expect, it } from "vitest";
import { emptyNote } from "@/lib/notes/note";
import type { NoteRadarFx } from "@/lib/notes/types";
import { makePiece } from "./pieces";
import { overlayRowGroupId, overlayRows, removeOverlay } from "./overlay";

function emptyFx(patch: Partial<NoteRadarFx> = {}): NoteRadarFx {
  return {
    deaths: [],
    opening: null,
    tracers: [],
    trails: [],
    heatmap: [],
    summary: [],
    cone: null,
    hits: [],
    flashes: [],
    ...patch,
  };
}

describe("overlayRows", () => {
  it("lists tokens, drawings, and snapshot marks", () => {
    const note = emptyNote();
    note.pieces.push(makePiece("pawn", 0, 0, { id: "p1", side: "CT", label: "entry" }));
    note.groups.push({
      id: "g1",
      name: "A exec",
      drawings: [{ type: "pen", color: "#fff", points: [{ x: 0, y: 0 }] }],
    });
    note.drawings.push({
      type: "arrow",
      color: "#0f0",
      from: { x: 0, y: 0 },
      to: { x: 1, y: 1 },
    });
    note.drawings.push({ type: "text", color: "#fff", x: 0, y: 0, text: "hold" });
    note.bookmarks.push({ color: "#f00", text: "plant", tick: 0 });
    note.radarFx = emptyFx({
      deaths: [
        { x: 1, y: 1, line: null },
        {
          x: 2,
          y: 2,
          line: {
            from: { x: 0, y: 0 },
            to: { x: 2, y: 2 },
            color: "#f00",
            alpha: 1,
            lineWidth: 2,
          },
        },
      ],
      opening: { from: { x: 0, y: 0 }, to: { x: 1, y: 1 }, color: "#ff0" },
      tracers: [{ x: 0, y: 0, yaw: 0, fade: 1 }],
      trails: [{ points: [{ x: 0, y: 0 }], color: "#0f0" }],
      heatmap: [{ x: 0, y: 0, radius: 4, color: "#f00" }],
      summary: [{ x: 1, y: 1, radius: 4, color: "#00f" }],
      cone: { x: 0, y: 0, yaw: 0, radius: 8, color: "#fff" },
      hits: [{ x: 0, y: 0, innerRadius: 2, ringRadius: 4, innerAlpha: 1, ringAlpha: 1 }],
      flashes: [{ x: 3, y: 3, intensity: 1, pulseRadius: 6, left: 0.4 }],
    });
    expect(overlayRows(note).map((row) => row.label)).toEqual([
      "Pawn",
      "Pen",
      "Arrow",
      "Text “hold”",
      "plant",
      "Death",
      "Kill",
      "FK/FD",
      "Tracer",
      "Player trail",
      "Heatmap (1)",
      "Summary (1)",
      "View cone",
      "Hit",
      "Flash",
    ]);
  });

  it("attaches a player trail to the pawn group", () => {
    const note = emptyNote();
    note.groups.push({ id: "g1", name: "donk", drawings: [] });
    note.pieces.push(makePiece("pawn", 0, 0, { id: "p1", groupId: "g1", label: "donk" }));
    note.radarFx = emptyFx({
      trails: [{ points: [{ x: 0, y: 0 }], color: "#0f0", groupId: "g1", label: "donk" }],
    });
    const grouped = overlayRows(note).filter((row) => overlayRowGroupId(row) === "g1");
    expect(grouped.map((row) => row.label)).toEqual(["Pawn", "Trail"]);
  });
});

describe("removeOverlay", () => {
  it("drops a token, drawing, and snapshot mark", () => {
    const note = emptyNote();
    note.pieces.push(makePiece("smoke", 0, 0, { id: "s1" }));
    note.drawings.push({
      type: "arrow",
      color: "#0f0",
      from: { x: 0, y: 0 },
      to: { x: 1, y: 1 },
    });
    note.radarFx = emptyFx({
      opening: { from: { x: 0, y: 0 }, to: { x: 1, y: 1 }, color: "#ff0" },
      flashes: [{ x: 1, y: 1, intensity: 1, pulseRadius: 4, left: 1 }],
    });
    const noPawn = removeOverlay(note, "piece:s1");
    expect(noPawn.pieces).toEqual([]);
    const noArrow = removeOverlay(note, "drawing:0");
    expect(noArrow.drawings).toEqual([]);
    const noFlash = removeOverlay(note, "fx:flash:0");
    expect(noFlash.radarFx?.flashes).toEqual([]);
    expect(noFlash.radarFx?.opening).not.toBeNull();
    const noOpen = removeOverlay(noFlash, "fx:opening");
    expect(noOpen.radarFx).toBeUndefined();
  });

  it("removes a grouped drawing and drops an empty group", () => {
    const note = emptyNote();
    note.groups.push({
      id: "g1",
      name: "util",
      drawings: [
        { type: "pen", color: "#fff", points: [{ x: 0, y: 0 }] },
        { type: "pen", color: "#f00", points: [{ x: 1, y: 1 }] },
      ],
    });
    const one = removeOverlay(note, "group:g1:0");
    expect(one.groups[0]?.drawings).toHaveLength(1);
    const empty = removeOverlay(one, "group:g1:0");
    expect(empty.groups).toEqual([]);
  });

  it("keeps a group that still has tokens", () => {
    const note = emptyNote();
    note.groups.push({
      id: "g1",
      name: "util",
      drawings: [{ type: "pen", color: "#fff", points: [{ x: 0, y: 0 }] }],
    });
    note.pieces.push(makePiece("pawn", 0, 0, { id: "p1", groupId: "g1" }));
    const next = removeOverlay(note, "group:g1:0");
    expect(next.groups).toHaveLength(1);
    expect(next.groups[0]?.drawings).toEqual([]);
    expect(next.pieces[0]?.groupId).toBe("g1");
  });

  it("no-ops an unknown id", () => {
    const note = emptyNote();
    expect(removeOverlay(note, "fx:missing")).toBe(note);
  });
});
