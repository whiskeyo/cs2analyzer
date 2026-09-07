import { describe, expect, it } from "vitest";
import { NOTE_BOOKMARK_TITLE } from "@/lib/shared/constants";
import { flattenNote, flattenRoundNotes, strokesToNote, strokesToRoundNotes } from "./migrate";
import { visibleDrawings } from "./note";
import type { Stroke } from "./types";

function pen(
  partial: Partial<Pick<Stroke, "round" | "start_tick" | "end_tick" | "group" | "hidden">> = {},
): Stroke {
  return {
    type: "pen",
    round: 1,
    color: "#fff",
    points: [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
    ],
    ...partial,
  };
}

describe("strokesToNote", () => {
  it("splits groups, loose drawings, and bookmarks", () => {
    const note = strokesToNote([
      pen({ group: "A execute", start_tick: 100, end_tick: 180, hidden: true }),
      pen({ group: "A execute", start_tick: 160, end_tick: 220, hidden: true }),
      pen({ start_tick: 50, end_tick: 60 }),
      {
        type: "bookmark",
        round: 1,
        color: "#f44",
        text: "",
        start_tick: 80,
        end_tick: 80,
      },
      {
        type: "text",
        round: 1,
        color: "#fff",
        x: 1,
        y: 2,
        text: "hold",
        box_w: 80,
        box_h: 40,
      },
    ]);
    expect(note.groups).toHaveLength(1);
    expect(note.groups[0]).toMatchObject({
      id: "A execute",
      name: "A execute",
      hidden: true,
      start_tick: 100,
      end_tick: 220,
    });
    expect(note.groups[0]?.drawings).toHaveLength(2);
    expect(note.drawings).toHaveLength(2);
    expect(note.drawings[0]).toMatchObject({ start_tick: 50, end_tick: 60 });
    expect(note.drawings[1]).toMatchObject({ type: "text", box_w: 80 });
    expect(note.bookmarks[0]).toMatchObject({
      text: NOTE_BOOKMARK_TITLE,
      tick: 80,
      start_tick: 80,
      end_tick: 80,
    });
  });

  it("does not hide a mixed-visibility group", () => {
    const note = strokesToNote([pen({ group: "g1", hidden: true }), pen({ group: "g1" })]);
    expect(note.groups[0]?.hidden).toBeUndefined();
  });
});

describe("strokesToRoundNotes / flatten", () => {
  it("buckets by round and flattens drawings then bookmarks", () => {
    const rows = strokesToRoundNotes([
      pen({ round: 2 }),
      pen({ round: 1, group: "g1" }),
      pen({ round: 1, group: "g1" }),
    ]);
    expect(rows.map((r) => r.round)).toEqual([1, 2]);
    const flat = flattenRoundNotes(rows);
    expect(flat.map((s) => s.round)).toEqual([1, 1, 2]);
    expect(flat[0]?.group).toBe("g1");
    expect(flat[2]?.group).toBeUndefined();
  });

  it("round-trips a moment window onto every grouped member", () => {
    const note = strokesToNote([
      pen({ group: "g1", start_tick: 10, end_tick: 20 }),
      pen({ group: "g1", start_tick: 15, end_tick: 40 }),
    ]);
    const flat = flattenNote(note, 3);
    expect(flat.every((s) => s.start_tick === 10 && s.end_tick === 40 && s.group === "g1")).toBe(
      true,
    );
    expect(visibleDrawings(note, 40)).toHaveLength(2);
    expect(visibleDrawings(note, 41)).toHaveLength(0);
  });

  it("flattens arrows, hidden loose items, and bookmarks", () => {
    const note = strokesToNote([
      {
        type: "arrow",
        round: 1,
        color: "#0f0",
        from: { x: 0, y: 0 },
        to: { x: 2, y: 2 },
        hidden: true,
        start_tick: 1,
        end_tick: 2,
      },
      {
        type: "bookmark",
        round: 1,
        color: "#f44",
        text: "go",
        hidden: true,
        start_tick: 9,
        end_tick: 9,
      },
    ]);
    const flat = flattenNote(note, 1);
    expect(flat[0]).toMatchObject({ type: "arrow", hidden: true, start_tick: 1 });
    expect(flat[1]).toMatchObject({ type: "bookmark", text: "go", hidden: true, start_tick: 9 });
  });
});
