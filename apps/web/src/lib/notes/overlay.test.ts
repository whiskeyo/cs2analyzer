import { describe, expect, it } from "vitest";
import { NOTE_BOOKMARK_TITLE } from "@/lib/shared/constants";
import {
  clusterNoteRound,
  earliestTimedTick,
  groupOverlays,
  makeBookmarkStroke,
  notesByRound,
  overlayJumpTick,
  removeStrokesAt,
  renameStrokeText,
  roundBookmarkMarks,
  strokeTitle,
  strokeWindowKind,
} from "@/lib/notes";
import type { Round } from "@/lib/replay/replayTypes";
import { makeRound } from "@/lib/testing/fixtures";
import type { Stroke } from "./types";

function pen(
  partial: Partial<Pick<Stroke, "round" | "start_tick" | "end_tick" | "group">> = {},
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

function round(number: number): Round {
  return makeRound({ number });
}

describe("groupOverlays", () => {
  it("keeps text rows and counts drawings per round", () => {
    const groups = groupOverlays([
      pen({ round: 2 }),
      {
        type: "text",
        round: 1,
        color: "#fff",
        x: 0,
        y: 0,
        text: "hold",
        start_tick: 80,
      },
      pen({ round: 1 }),
    ]);
    expect(groups).toHaveLength(2);
    expect(groups[0]).toMatchObject({ round: 1, drawings: 1 });
    expect(groups[0].texts).toHaveLength(1);
    expect(groups[1]).toMatchObject({ round: 2, drawings: 1, texts: [] });
  });

  it("does not count bookmarks as drawings", () => {
    const groups = groupOverlays([
      pen({ round: 1 }),
      {
        type: "bookmark",
        round: 1,
        color: "#fff",
        text: "A",
        start_tick: 80,
        end_tick: 80,
      },
    ]);
    expect(groups[0]).toMatchObject({ round: 1, drawings: 1, texts: [] });
  });
});

describe("notesByRound", () => {
  it("lists each stroke with its index", () => {
    const rows = notesByRound([pen({ round: 2 }), pen({ round: 1 })]);
    expect(rows.map((r) => r.round)).toEqual([1, 2]);
    expect(rows[0].items[0].index).toBe(1);
  });

  it("clusters grouped strokes under one header", () => {
    const rows = notesByRound([pen({ group: "A execute" }), pen(), pen({ group: "A execute" })]);
    const clusters = clusterNoteRound(rows[0].items);
    expect(clusters).toHaveLength(2);
    expect(clusters[0]).toMatchObject({ group: "A execute" });
    expect(clusters[0].items).toHaveLength(2);
    expect(clusters[1].group).toBeNull();
  });
});

describe("overlayJumpTick", () => {
  it("jumps to the earliest timed note, else freeze end", () => {
    const r = round(1);
    expect(overlayJumpTick([], r)).toBe(64);
    expect(overlayJumpTick([pen({ start_tick: 200, end_tick: 300 })], r)).toBe(200);
    expect(earliestTimedTick([pen()], 1)).toBeUndefined();
  });
});

describe("bookmarks", () => {
  function mark(
    partial: Partial<Extract<Stroke, { type: "bookmark" }>> = {},
  ): Extract<Stroke, { type: "bookmark" }> {
    return {
      type: "bookmark",
      round: 1,
      color: "#f44",
      text: NOTE_BOOKMARK_TITLE,
      start_tick: 100,
      end_tick: 100,
      ...partial,
    };
  }

  it("pins to the playhead when Moment is off", () => {
    const st = makeBookmarkStroke("#fff", 1, 200, false, 2000, 64);
    expect(st).toMatchObject({
      type: "bookmark",
      text: NOTE_BOOKMARK_TITLE,
      start_tick: 200,
      end_tick: 200,
    });
  });

  it("uses the named Moment span when Moment is on", () => {
    const st = makeBookmarkStroke("#fff", 1, 200, true, 2000, 64);
    expect(st.start_tick).toBe(200);
    expect(st.end_tick).toBe(200 + 64 * 5);
  });

  it("places pin, span, and whole-round marks on the scrubber", () => {
    const r = round(1);
    const marks = roundBookmarkMarks(
      [
        mark({ start_tick: 64, end_tick: 64 }),
        mark({ start_tick: 64, end_tick: 64 + 64 * 5, text: "execute" }),
        { type: "bookmark", round: 1, color: "#0f0", text: "all" },
        mark({ hidden: true }),
        mark({ round: 2 }),
      ],
      r,
      { min: 0, max: 640 },
    );
    expect(marks.map((m) => m.kind)).toEqual(["pin", "span", "round"]);
    expect(marks[1]?.title).toBe("execute");
    expect(marks[2]?.tick).toBe(64);
    expect(marks[0]?.startAt).toBeCloseTo(64 / 640, 5);
  });

  it("titles a bookmark and labels pin vs moment vs round", () => {
    expect(strokeTitle(mark({ text: "A split" }))).toBe("A split");
    expect(strokeWindowKind({ start: 10, end: 10 })).toBe("Pin");
    expect(strokeWindowKind({ start: 10, end: 40 })).toBe("Moment");
    expect(strokeWindowKind(null)).toBe("Whole round");
  });

  it("renames and removes a bookmark", () => {
    const next = renameStrokeText([mark()], 0, "B execute");
    expect(next[0]).toMatchObject({ text: "B execute" });
    expect(removeStrokesAt(next, [0])).toEqual([]);
  });
});
