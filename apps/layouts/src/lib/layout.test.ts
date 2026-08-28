import { describe, expect, it } from "vitest";
import {
  emptyLayout,
  formatLayout,
  moveCallout,
  nudgeLayoutGroup,
  parseMapLayout,
  renameLayoutGroup,
  slugId,
  uniqueId,
} from "./layout";

const triangle = [
  { x: 0, y: 0 },
  { x: 4, y: 0 },
  { x: 4, y: 4 },
];

const valid = {
  schema: 1,
  map: "de_mirage",
  callouts: [
    {
      id: "palace",
      name: "Palace",
      floor: "default",
      polygon: triangle,
    },
  ],
};

describe("parseMapLayout", () => {
  it("keeps valid callouts and drops broken rows", () => {
    const parsed = parseMapLayout({
      ...valid,
      callouts: [...valid.callouts, { id: "x" }, valid.callouts[0]],
    });
    expect(parsed?.callouts.map((c) => c.id)).toEqual(["palace"]);
  });

  it("rejects the wrong map when expectedMap is set", () => {
    expect(parseMapLayout(valid, "de_dust2")).toBeNull();
    expect(parseMapLayout(valid, "de_mirage")?.map).toBe("de_mirage");
  });

  it("rejects a missing schema", () => {
    expect(parseMapLayout({ ...valid, schema: 2 })).toBeNull();
    expect(parseMapLayout(emptyLayout("de_nuke"))?.callouts).toEqual([]);
  });

  it("keeps a trimmed group and dissolves a singleton", () => {
    const withGroup = parseMapLayout({
      ...valid,
      callouts: [
        { ...valid.callouts[0], id: "palace", group: "  A  " },
        {
          id: "tetris",
          name: "Tetris",
          floor: "default",
          group: "  A  ",
          polygon: triangle,
        },
      ],
    });
    expect(withGroup?.callouts.map((c) => c.group)).toEqual(["A", "A"]);
    const blank = parseMapLayout({
      ...valid,
      callouts: [{ ...valid.callouts[0], group: "  " }],
    });
    expect(blank?.callouts[0]?.group).toBeUndefined();
    const lone = parseMapLayout({
      ...valid,
      callouts: [{ ...valid.callouts[0], group: "A" }],
    });
    expect(lone?.callouts[0]?.group).toBeUndefined();
  });

  it("keeps an explicit groups order and appends missing live names", () => {
    const parsed = parseMapLayout({
      schema: 1,
      map: "de_mirage",
      groups: ["  B side  ", "gone", "A side", "A side"],
      callouts: [
        { id: "palace", name: "Palace", floor: "default", group: "A side", polygon: triangle },
        { id: "tetris", name: "Tetris", floor: "default", group: "A side", polygon: triangle },
        { id: "apps", name: "Apps", floor: "default", group: "B side", polygon: triangle },
        { id: "b", name: "B Site", floor: "default", group: "B side", polygon: triangle },
      ],
    });
    expect(parsed?.groups).toEqual(["B side", "A side"]);
  });

  it("omits groups when the JSON has none", () => {
    const parsed = parseMapLayout({
      schema: 1,
      map: "de_mirage",
      callouts: [
        { id: "palace", name: "Palace", floor: "default", group: "A side", polygon: triangle },
        { id: "tetris", name: "Tetris", floor: "default", group: "A side", polygon: triangle },
      ],
    });
    expect(parsed?.groups).toBeUndefined();
  });
});

describe("moveCallout", () => {
  const a = { id: "a", name: "A", floor: "default" as const, polygon: triangle };
  const b = { id: "b", name: "B", floor: "default" as const, polygon: triangle };
  const c = { id: "c", name: "C", floor: "default" as const, polygon: triangle };

  it("moves an item to a new index", () => {
    expect(moveCallout([a, b, c], 0, 2).map((row) => row.id)).toEqual(["b", "c", "a"]);
    expect(moveCallout([a, b, c], 2, 0).map((row) => row.id)).toEqual(["c", "a", "b"]);
  });

  it("leaves the list unchanged for a no-op index", () => {
    const list = [a, b, c];
    expect(moveCallout(list, 1, 1)).toBe(list);
    expect(moveCallout(list, -1, 0)).toBe(list);
  });
});

describe("uniqueId", () => {
  it("slugifies names and suffixes collisions", () => {
    expect(slugId("A Ramp")).toBe("a-ramp");
    expect(uniqueId("palace", ["palace", "palace-2"])).toBe("palace-3");
  });
});

describe("group order", () => {
  const layout = {
    schema: 1 as const,
    map: "de_mirage",
    callouts: [
      {
        id: "palace",
        name: "Palace",
        floor: "default" as const,
        group: "A side",
        polygon: triangle,
      },
      {
        id: "tetris",
        name: "Tetris",
        floor: "default" as const,
        group: "A side",
        polygon: triangle,
      },
      { id: "apps", name: "Apps", floor: "default" as const, group: "B side", polygon: triangle },
      { id: "b", name: "B Site", floor: "default" as const, group: "B side", polygon: triangle },
    ],
  };

  it("nudges writes groups even when the JSON omitted them", () => {
    const moved = nudgeLayoutGroup(layout, "A side", 1);
    expect(moved.groups).toEqual(["B side", "A side"]);
    expect(nudgeLayoutGroup(moved, "A side", 1)).toBe(moved);
  });

  it("renames a group without moving it", () => {
    const named = { ...layout, groups: ["B side", "A side"] };
    const next = renameLayoutGroup(named, "A side", "A");
    expect(next.groups).toEqual(["B side", "A"]);
    expect(next.callouts.map((c) => c.group)).toEqual(["A", "A", "B side", "B side"]);
  });

  it("writes groups before callouts", () => {
    const text = formatLayout({ ...layout, groups: ["B side", "A side"] });
    expect(text.indexOf('"groups"')).toBeGreaterThan(-1);
    expect(text.indexOf('"groups"')).toBeLessThan(text.indexOf('"callouts"'));
  });
});
