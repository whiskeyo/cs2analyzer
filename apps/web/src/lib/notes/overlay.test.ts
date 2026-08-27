import { describe, expect, it } from "vitest";
import { NOTE_BOOKMARK_TITLE, NOTE_MOMENT_SECONDS } from "@/lib/shared/constants";
import {
  clusterNoteRound,
  earliestTimedTick,
  groupLabel,
  groupOverlays,
  groupStrokes,
  makeBookmarkStroke,
  momentBounds,
  notesByRound,
  overlayJumpTick,
  overlayVisible,
  removeStrokesAt,
  renameGroup,
  renameStrokeText,
  roundBookmarkMarks,
  setMomentClockEdge,
  setMomentEdge,
  setMomentSeconds,
  setStrokesHidden,
  squashLooseDrawings,
  dropStrokesOn,
  strokeTitle,
  strokeWindowKind,
  withMoment,
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

describe("overlayVisible", () => {
  it("shows a whole-round overlay on that round only", () => {
    const st = pen();
    expect(overlayVisible(st, 100, 1)).toBe(true);
    expect(overlayVisible(st, 100, 2)).toBe(false);
  });

  it("hides a moment overlay outside its window", () => {
    const st = pen({ start_tick: 200, end_tick: 400 });
    expect(overlayVisible(st, 199, 1)).toBe(false);
    expect(overlayVisible(st, 200, 1)).toBe(true);
    expect(overlayVisible(st, 400, 1)).toBe(true);
    expect(overlayVisible(st, 401, 1)).toBe(false);
  });

  it("hides a note when hidden is set", () => {
    const st = pen({ start_tick: 100, end_tick: 400 });
    expect(overlayVisible({ ...st, hidden: true }, 200, 1)).toBe(false);
  });
});

describe("momentBounds", () => {
  it("spans the named duration at 64 Hz", () => {
    expect(momentBounds(100, 50_000, 64)).toEqual({
      start_tick: 100,
      end_tick: 100 + 64 * NOTE_MOMENT_SECONDS,
    });
  });

  it("clamps to round end", () => {
    expect(momentBounds(600, 640, 64)).toEqual({ start_tick: 600, end_tick: 640 });
  });
});

describe("withMoment", () => {
  it("leaves a round overlay untouched", () => {
    const st = pen();
    expect(withMoment(st, false, 100, 640, 64)).toEqual(st);
  });

  it("stamps a window when Moment is on", () => {
    const st = withMoment(pen(), true, 100, 640, 64);
    expect(st.start_tick).toBe(100);
    expect(st.end_tick).toBe(100 + 64 * NOTE_MOMENT_SECONDS);
  });
});

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

describe("overlay groups", () => {
  it("shows grouped shapes for the union of their windows", () => {
    const a = pen({ start_tick: 100, end_tick: 200, group: "g1" });
    const b = pen({ start_tick: 180, end_tick: 300, group: "g1" });
    const all = [a, b];
    expect(overlayVisible(a, 250, 1, all)).toBe(true);
    expect(overlayVisible(b, 120, 1, all)).toBe(true);
    expect(overlayVisible(a, 301, 1, all)).toBe(false);
  });

  it("renames every member and keeps a custom label", () => {
    const grouped = groupStrokes(
      [pen({ start_tick: 100, end_tick: 200 }), pen({ start_tick: 100, end_tick: 200 })],
      [0, 1],
    );
    const next = renameGroup(grouped, grouped[0].group ?? "", "A execute");
    expect(next[0].group).toBe("A execute");
    expect(next[1].group).toBe("A execute");
    expect(groupLabel("g1")).toBe("Group 1");
    expect(groupLabel("A execute")).toBe("A execute");
  });

  it("ignores a blank rename", () => {
    const grouped = groupStrokes([pen(), pen()], [0, 1]);
    expect(renameGroup(grouped, grouped[0].group ?? "", "   ")).toEqual(grouped);
  });

  it("copies a shared window onto grouped strokes", () => {
    const next = groupStrokes(
      [pen({ start_tick: 100, end_tick: 200 }), pen({ start_tick: 180, end_tick: 220 })],
      [0, 1],
    );
    expect(next[0].group).toBe("Group 1");
    expect(next[1].group).toBe("Group 1");
    expect(next[0].start_tick).toBe(100);
    expect(next[0].end_tick).toBe(220);
    expect(next[1].start_tick).toBe(100);
    expect(next[1].end_tick).toBe(220);
  });

  it("changes duration for every member of a group", () => {
    const grouped = groupStrokes(
      [pen({ start_tick: 100, end_tick: 200 }), pen({ start_tick: 100, end_tick: 200 })],
      [0, 1],
    );
    const next = setMomentSeconds(grouped, 1, 10, 64, 50_000, 100);
    expect(next[0].end_tick).toBe(100 + 64 * 10);
    expect(next[1].end_tick).toBe(100 + 64 * 10);
  });

  it("squashes loose pens into one Drawings layer and leaves text", () => {
    const next = squashLooseDrawings(
      [
        pen({ round: 1 }),
        pen({ round: 1 }),
        {
          type: "text",
          round: 1,
          color: "#fff",
          x: 0,
          y: 0,
          text: "hold",
        },
      ],
      1,
    );
    expect(next[0].group).toBe("Drawings");
    expect(next[1].group).toBe("Drawings");
    expect(next[2].group).toBeUndefined();
  });

  it("drops a loose stroke onto a layer", () => {
    const grouped = groupStrokes([pen(), pen(), pen()], [0, 1]);
    const next = dropStrokesOn(grouped, [2], {
      round: 1,
      kind: "into",
      group: grouped[0].group ?? "",
    });
    expect(next[2].group).toBe(grouped[0].group);
  });

  it("drops a member out of a layer and dissolves a singleton", () => {
    const grouped = groupStrokes([pen(), pen()], [0, 1]);
    const next = dropStrokesOn(grouped, [0], { round: 1, kind: "ungroup" });
    expect(next[0].group).toBeUndefined();
    expect(next[1].group).toBeUndefined();
  });

  it("drops two loose strokes on the new-group slot", () => {
    const next = dropStrokesOn([pen(), pen(), pen()], [0, 1], { round: 1, kind: "new-group" });
    expect(next[0].group).toBe("Group 1");
    expect(next[1].group).toBe("Group 1");
    expect(next[2].group).toBeUndefined();
  });

  it("does not make a new group from a single stroke", () => {
    const next = dropStrokesOn([pen(), pen()], [0], { round: 1, kind: "new-group" });
    expect(next[0].group).toBeUndefined();
    expect(next[1].group).toBeUndefined();
  });

  it("extracts two members into a new group and dissolves a leftover singleton", () => {
    const grouped = groupStrokes([pen(), pen(), pen()], [0, 1, 2]);
    const next = dropStrokesOn(grouped, [0, 1], { round: 1, kind: "new-group" });
    expect(next[0].group).toBe("Group 2");
    expect(next[1].group).toBe("Group 2");
    expect(next[2].group).toBeUndefined();
  });

  it("sets in and out from the playhead", () => {
    const next = setMomentEdge([pen()], 0, "start", 200, 0, 2000, 64);
    expect(next[0].start_tick).toBe(200);
    expect(next[0].end_tick).toBe(200 + 64 * NOTE_MOMENT_SECONDS);
    const both = setMomentEdge(next, 0, "end", 500, 0, 2000, 64);
    expect(both[0].start_tick).toBe(200);
    expect(both[0].end_tick).toBe(500);
  });

  it("keeps the window when out is set at the in tick", () => {
    const next = setMomentEdge([pen()], 0, "start", 200, 0, 2000, 64);
    const both = setMomentEdge(next, 0, "end", 200, 0, 2000, 64);
    expect(both[0].start_tick).toBe(200);
    expect(both[0].end_tick).toBe(next[0].end_tick);
  });

  it("sets end past one minute on the round clock", () => {
    const origin = 64;
    const next = setMomentClockEdge([pen()], 0, "end", 70, origin, 0, 50_000, 64);
    expect(next[0].start_tick).toBe(origin);
    expect(next[0].end_tick).toBe(origin + 70 * 64);
  });

  it("hides grouped members from the radar", () => {
    const grouped = groupStrokes([pen(), pen()], [0, 1]);
    const next = setStrokesHidden(grouped, [0, 1], true);
    expect(overlayVisible(next[0], 100, 1, next)).toBe(false);
    expect(overlayVisible(next[1], 100, 1, next)).toBe(false);
  });

  it("toggles hidden on selected strokes", () => {
    const next = setStrokesHidden([pen(), pen()], [1], true);
    expect(next[0].hidden).toBeUndefined();
    expect(next[1].hidden).toBe(true);
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
    expect(st.end_tick).toBe(200 + 64 * NOTE_MOMENT_SECONDS);
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
