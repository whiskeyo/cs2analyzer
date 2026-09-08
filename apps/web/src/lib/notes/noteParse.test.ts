import { describe, expect, it } from "vitest";
import { NOTE_BOOKMARK_TITLE } from "@/lib/shared/constants";
import { parseDrawing, parseNote, parseRoundNote, parseRoundNotes } from "./noteParse";

describe("parseDrawing", () => {
  it("parses pen, arrow, and text and rejects junk", () => {
    expect(
      parseDrawing({
        type: "pen",
        color: "#fff",
        points: [
          { x: 0, y: 0 },
          { x: 1, y: 1 },
        ],
      }),
    ).toMatchObject({ type: "pen" });
    expect(
      parseDrawing({
        type: "arrow",
        color: "#fff",
        from: { x: 0, y: 0 },
        to: { x: 2, y: 2 },
      }),
    ).toMatchObject({ type: "arrow" });
    expect(
      parseDrawing({
        type: "text",
        color: "#fff",
        x: 1,
        y: 2,
        text: "hold",
        box_w: 80,
        box_h: 40,
      }),
    ).toMatchObject({ type: "text", box_w: 80, box_h: 40 });
    expect(parseDrawing({ type: "text", color: "#fff", x: 1, y: 2, text: "   " })).toBeNull();
    expect(parseDrawing({ type: "pen", color: "#fff", points: [{ x: 0 }] })).toBeNull();
    expect(parseDrawing(null)).toBeNull();
  });

  it("keeps ticks on the drawing and accepts a nested shape", () => {
    expect(
      parseDrawing({
        type: "pen",
        color: "#fff",
        points: [{ x: 0, y: 0 }],
        start_tick: 10,
        end_tick: 20,
        hidden: true,
      }),
    ).toMatchObject({
      type: "pen",
      start_tick: 10,
      end_tick: 20,
      hidden: true,
    });
    expect(
      parseDrawing({
        shape: {
          type: "arrow",
          color: "#0f0",
          from: { x: 0, y: 0 },
          to: { x: 2, y: 2 },
        },
        start_tick: 5,
      }),
    ).toMatchObject({ type: "arrow", start_tick: 5 });
  });
});

describe("parseNote", () => {
  it("drops malformed rows and keeps pieces and bookmarks", () => {
    const note = parseNote({
      groups: [
        {
          id: "A",
          name: "A",
          drawings: [
            {
              type: "arrow",
              color: "#f00",
              from: { x: 0, y: 0 },
              to: { x: 1, y: 1 },
            },
          ],
        },
        { name: "", drawings: [] },
        { drawings: [{ type: "pen", color: "#fff" }] },
      ],
      loose: [
        {
          drawing: { type: "pen", color: "#fff", points: [{ x: 0, y: 0 }] },
          hidden: true,
          start_tick: 10,
        },
        { type: "pen", color: "#0f0", points: [{ x: 3, y: 3 }] },
        { drawing: { type: "nope" } },
      ],
      pieces: [
        {
          id: "p1",
          kind: "pawn",
          x: 1,
          y: 2,
          z: 3,
          yaw: 90,
          side: "CT",
          label: "alice",
          alive: true,
          carriesC4: true,
        },
        { id: "p2", kind: "bomb", x: 4, y: 5, alive: false },
        {
          id: "p6",
          kind: "smoke",
          x: 8,
          y: 9,
          nadeStyle: "effect",
          trail: [{ x: 1, y: 1 }, { y: 2 }, { x: 3, y: 4 }],
        },
        { id: "", kind: "pawn", x: 0, y: 0 },
        { id: "p3", kind: "knife", x: 0, y: 0 },
      ],
      bookmarks: [
        { color: "#f44", text: "", start_tick: 80, end_tick: 80 },
        { color: "#0f0", text: "go", tick: 12, hidden: true },
        { color: "#fff" },
      ],
    });
    expect(note?.groups).toHaveLength(1);
    expect(note?.drawings).toHaveLength(2);
    expect(note?.drawings[0]?.hidden).toBe(true);
    expect(note?.pieces).toHaveLength(3);
    expect(note?.pieces[0]).toMatchObject({
      kind: "pawn",
      side: "CT",
      carriesC4: true,
    });
    expect(note?.pieces[1]?.alive).toBe(false);
    expect(note?.pieces[2]).toMatchObject({
      kind: "smoke",
      nadeStyle: "effect",
      trail: [
        { x: 1, y: 1 },
        { x: 3, y: 4 },
      ],
    });
    expect(note?.bookmarks[0]?.text).toBe(NOTE_BOOKMARK_TITLE);
    expect(note?.bookmarks[0]?.tick).toBe(80);
    expect(note?.bookmarks[1]?.hidden).toBe(true);
  });

  it("keeps snapshot radar marks", () => {
    const note = parseNote({
      radarFx: {
        deaths: [
          {
            x: 1,
            y: 2,
            line: {
              from: { x: 0, y: 0 },
              to: { x: 1, y: 2 },
              color: "#fff",
              alpha: 0.8,
              lineWidth: 2,
            },
          },
        ],
        opening: { from: { x: 0, y: 0 }, to: { x: 1, y: 2 }, color: "#ff0" },
        tracers: [{ x: 3, y: 4, yaw: 90, fade: 1 }],
      },
    });
    expect(note?.radarFx?.deaths).toHaveLength(1);
    expect(note?.radarFx?.opening?.color).toBe("#ff0");
    expect(note?.radarFx?.tracers).toHaveLength(1);
  });

  it("rejects a non-object", () => {
    expect(parseNote(null)).toBeNull();
    expect(parseRoundNote({ round: 1, note: null })).toBeNull();
    expect(parseRoundNote({ round: "1", note: {} })).toBeNull();
  });

  it("names a group from id and keeps a T pawn", () => {
    const note = parseNote({
      groups: [
        {
          id: "g1",
          hidden: true,
          start_tick: 4,
          drawings: [{ type: "pen", color: "#fff", points: [{ x: 0, y: 0 }] }],
        },
      ],
      pieces: [{ id: "t1", kind: "smoke", x: 1, y: 2, side: "T" }],
    });
    expect(note?.groups[0]).toMatchObject({
      id: "g1",
      name: "g1",
      hidden: true,
      start_tick: 4,
    });
    expect(note?.pieces[0]?.side).toBe("T");
    expect(note?.pieces[0]?.kind).toBe("smoke");
  });

  it("prefers drawings over the old loose key", () => {
    const note = parseNote({
      drawings: [{ type: "pen", color: "#fff", points: [{ x: 1, y: 1 }] }],
      loose: [
        {
          type: "arrow",
          color: "#f00",
          from: { x: 0, y: 0 },
          to: { x: 1, y: 1 },
        },
      ],
    });
    expect(note?.drawings).toHaveLength(1);
    expect(note?.drawings[0]?.type).toBe("pen");
  });
});

describe("parseRoundNotes", () => {
  it("keeps valid round rows", () => {
    expect(parseRoundNotes("nope")).toEqual([]);
    const rows = parseRoundNotes([
      {
        round: 2,
        note: {
          loose: [{ type: "pen", color: "#fff", points: [{ x: 1, y: 1 }] }],
        },
      },
      { round: 1, note: {} },
      { note: {} },
    ]);
    expect(rows.map((r) => r.round)).toEqual([2, 1]);
    expect(rows[0]?.note.drawings).toHaveLength(1);
    expect(rows[1]?.note.groups).toEqual([]);
  });
});
