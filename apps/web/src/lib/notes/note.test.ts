import { describe, expect, it } from "vitest";
import {
  clearRoundDrawings,
  cloneNote,
  earliestTimedTick,
  emptyNote,
  noteDrawingCount,
  overlayWindowOf,
  visibleDrawings,
  windowVisible,
} from "./note";
import type { Drawing, Note } from "./types";

const pen: Drawing = {
  type: "pen",
  color: "#fff",
  points: [
    { x: 0, y: 0 },
    { x: 1, y: 1 },
  ],
};

function noteWith(partial: Partial<Note>): Note {
  return { ...emptyNote(), ...partial };
}

describe("emptyNote / cloneNote", () => {
  it("starts empty and clone is a deep copy", () => {
    const a = emptyNote();
    expect(a).toEqual({ groups: [], drawings: [], pieces: [], bookmarks: [] });
    const b = cloneNote(a);
    b.drawings.push(pen);
    expect(a.drawings).toHaveLength(0);
  });
});

describe("windowVisible", () => {
  it("shows the whole range when there is no window or tick", () => {
    expect(windowVisible({}, 100)).toBe(true);
    expect(windowVisible({ start_tick: 10, end_tick: 20 }, null)).toBe(true);
    expect(overlayWindowOf({})).toBeNull();
  });

  it("uses start as end when end is omitted", () => {
    expect(overlayWindowOf({ start_tick: 50 })).toEqual({ start: 50, end: 50 });
    expect(windowVisible({ start_tick: 50 }, 50)).toBe(true);
    expect(windowVisible({ start_tick: 50 }, 51)).toBe(false);
  });

  it("includes the window edges", () => {
    const win = { start_tick: 200, end_tick: 400 };
    expect(windowVisible(win, 199)).toBe(false);
    expect(windowVisible(win, 200)).toBe(true);
    expect(windowVisible(win, 400)).toBe(true);
    expect(windowVisible(win, 401)).toBe(false);
  });
});

describe("visibleDrawings", () => {
  it("skips hidden groups and loose items", () => {
    const note = noteWith({
      groups: [{ id: "A", name: "A", hidden: true, drawings: [pen] }],
      drawings: [
        { ...pen, hidden: true },
        { ...pen, color: "#0f0" },
      ],
    });
    expect(visibleDrawings(note, null)).toEqual([{ ...pen, color: "#0f0" }]);
  });

  it("filters by tick on groups and loose items", () => {
    const note = noteWith({
      groups: [
        {
          id: "A",
          name: "A",
          start_tick: 100,
          end_tick: 200,
          drawings: [pen],
        },
      ],
      drawings: [{ ...pen, color: "#0f0", start_tick: 150, end_tick: 250 }],
    });
    expect(visibleDrawings(note, 120)).toHaveLength(1);
    expect(visibleDrawings(note, 180)).toHaveLength(2);
    expect(visibleDrawings(note, 240)).toHaveLength(1);
    expect(visibleDrawings(note, 300)).toHaveLength(0);
    expect(visibleDrawings(note, null)).toHaveLength(2);
  });
});

describe("clearRoundDrawings", () => {
  it("drops drawings and groups and keeps bookmarks", () => {
    const note = noteWith({
      groups: [{ id: "A", name: "A", drawings: [pen] }],
      drawings: [pen],
      bookmarks: [{ color: "#f00", text: "x", tick: 10 }],
    });
    expect(clearRoundDrawings(note)).toEqual({
      ...emptyNote(),
      bookmarks: [{ color: "#f00", text: "x", tick: 10 }],
    });
  });
});

describe("noteDrawingCount", () => {
  it("counts loose drawings, grouped drawings, and bookmarks", () => {
    expect(noteDrawingCount([])).toBe(0);
    expect(
      noteDrawingCount([
        {
          round: 1,
          note: {
            groups: [{ id: "A", name: "A", drawings: [pen] }],
            drawings: [pen],
            pieces: [],
            bookmarks: [{ color: "#f00", text: "x", tick: 10 }],
          },
        },
      ]),
    ).toBe(3);
  });
});

describe("earliestTimedTick", () => {
  it("picks the soonest window among groups, loose, and bookmarks", () => {
    expect(earliestTimedTick(emptyNote())).toBeUndefined();
    const note = noteWith({
      groups: [
        { id: "A", name: "A", drawings: [pen] },
        { id: "B", name: "B", start_tick: 300, drawings: [pen] },
      ],
      drawings: [pen, { ...pen, start_tick: 200 }],
      bookmarks: [{ color: "#f00", text: "x", tick: 80 }],
    });
    expect(earliestTimedTick(note)).toBe(80);
  });
});
