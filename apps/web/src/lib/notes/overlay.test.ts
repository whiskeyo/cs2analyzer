import { describe, expect, it } from "vitest";
import { NOTE_BOOKMARK_TITLE } from "@/lib/shared/constants";
import {
  addBookmark,
  bookmarkTitle,
  clusterNote,
  earliestTimedTick,
  itemTitle,
  makeBookmark,
  notesByRound,
  overlayJumpTick,
  removeItems,
  renameItemText,
  roundBookmarkMarks,
  windowKind,
} from "@/lib/notes";
import { emptyNote } from "./note";
import type { Round } from "@/lib/replay/replayTypes";
import { makeRound } from "@/lib/testing/fixtures";
import type { Note } from "./types";

const pen = {
  type: "pen" as const,
  color: "#fff",
  points: [
    { x: 0, y: 0 },
    { x: 1, y: 1 },
  ],
};

function round(number: number): Round {
  return makeRound({ number });
}

describe("notesByRound / clusterNote", () => {
  it("sorts rounds and clusters groups ahead of loose items", () => {
    const rows = notesByRound([
      { round: 2, note: { ...emptyNote(), drawings: [pen] } },
      {
        round: 1,
        note: {
          ...emptyNote(),
          groups: [{ id: "A execute", name: "A execute", drawings: [pen, pen] }],
          drawings: [pen],
        },
      },
    ]);
    expect(rows.map((r) => r.round)).toEqual([1, 2]);
    const clusters = clusterNote(rows[0].note);
    expect(clusters).toHaveLength(2);
    expect(clusters[0]).toMatchObject({ groupId: "A execute" });
    expect(clusters[0].items).toHaveLength(2);
    expect(clusters[1].groupId).toBeNull();
  });
});

describe("overlayJumpTick", () => {
  it("jumps to the earliest timed note, else freeze end", () => {
    const r = round(1);
    expect(overlayJumpTick(emptyNote(), r)).toBe(64);
    expect(
      overlayJumpTick(
        { ...emptyNote(), drawings: [{ ...pen, start_tick: 200, end_tick: 300 }] },
        r,
      ),
    ).toBe(200);
    expect(earliestTimedTick(emptyNote())).toBeUndefined();
  });
});

describe("bookmarks", () => {
  function markNote(partial: Partial<Note["bookmarks"][number]> = {}): Note {
    return {
      ...emptyNote(),
      bookmarks: [{ color: "#f44", text: NOTE_BOOKMARK_TITLE, tick: 100, ...partial }],
    };
  }

  it("pins to the playhead when Moment is off", () => {
    const mark = makeBookmark("#fff", 200, false, 2000, 64);
    expect(mark).toMatchObject({
      text: NOTE_BOOKMARK_TITLE,
      start_tick: 200,
      end_tick: 200,
    });
  });

  it("uses the named Moment span when Moment is on", () => {
    const mark = makeBookmark("#fff", 200, true, 2000, 64);
    expect(mark.start_tick).toBe(200);
    expect(mark.end_tick).toBe(200 + 64 * 5);
  });

  it("places pin, span, and whole-round marks on the scrubber", () => {
    const r = round(1);
    const note: Note = {
      ...emptyNote(),
      bookmarks: [
        { color: "#f44", text: NOTE_BOOKMARK_TITLE, tick: 64, start_tick: 64, end_tick: 64 },
        { color: "#f44", text: "execute", tick: 64, start_tick: 64, end_tick: 64 + 64 * 5 },
        { color: "#0f0", text: "all", tick: 0 },
        { color: "#f44", text: NOTE_BOOKMARK_TITLE, tick: 100, hidden: true },
      ],
    };
    const marks = roundBookmarkMarks(note, r, { min: 0, max: 640 });
    expect(marks.map((m) => m.kind)).toEqual(["pin", "span", "round"]);
    expect(marks[1]?.title).toBe("execute");
    expect(marks[2]?.tick).toBe(64);
    expect(marks[0]?.startAt).toBeCloseTo(64 / 640, 5);
  });

  it("titles a bookmark and labels pin vs moment vs round", () => {
    expect(bookmarkTitle({ color: "#fff", text: "A split", tick: 1 })).toBe("A split");
    expect(itemTitle(markNote({ text: "A split" }), { kind: "bookmark", index: 0 })).toBe(
      "A split",
    );
    expect(windowKind({ start: 10, end: 10 })).toBe("Pin");
    expect(windowKind({ start: 10, end: 40 })).toBe("Moment");
    expect(windowKind(null)).toBe("Whole round");
  });

  it("renames and removes a bookmark", () => {
    const next = renameItemText(markNote(), { kind: "bookmark", index: 0 }, "B execute");
    expect(next.bookmarks[0]).toMatchObject({ text: "B execute" });
    expect(removeItems(next, [{ kind: "bookmark", index: 0 }]).bookmarks).toEqual([]);
    expect(
      addBookmark(emptyNote(), makeBookmark("#fff", 10, false, 20, 64)).bookmarks,
    ).toHaveLength(1);
  });
});
