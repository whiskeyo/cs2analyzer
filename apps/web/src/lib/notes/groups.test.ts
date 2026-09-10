import { describe, expect, it } from "vitest";
import {
  canGroupIndexes,
  dropStrokesOn,
  groupLabel,
  groupStrokes,
  overlayVisible,
  renameGroup,
  setStrokesHidden,
  squashLooseDrawings,
  ungroupStrokes,
} from "@/lib/notes";
import { nextGroupId } from "./groups";
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

describe("nextGroupId", () => {
  it("increments from auto and named groups", () => {
    expect(nextGroupId([])).toBe("Group 1");
    expect(nextGroupId([{ ...pen(), group: "Group 1" }])).toBe("Group 2");
    expect(nextGroupId([{ ...pen(), group: "g3" }])).toBe("Group 4");
  });
});

describe("canGroupIndexes", () => {
  it("requires two strokes in the same round", () => {
    const strokes = [pen({ round: 1 }), pen({ round: 1 }), pen({ round: 2 })];
    expect(canGroupIndexes(strokes, [0])).toBe(false);
    expect(canGroupIndexes(strokes, [0, 1])).toBe(true);
    expect(canGroupIndexes(strokes, [0, 2])).toBe(false);
  });
});

describe("groupStrokes", () => {
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
  });
});

describe("ungroupStrokes", () => {
  it("removes the group from every member when any one is selected", () => {
    const grouped = groupStrokes([pen(), pen()], [0, 1]);
    const next = ungroupStrokes(grouped, [0]);
    expect(next[0].group).toBeUndefined();
    expect(next[1].group).toBeUndefined();
  });
});

describe("squashLooseDrawings", () => {
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
});

describe("dropStrokesOn", () => {
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
});

describe("setStrokesHidden", () => {
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
