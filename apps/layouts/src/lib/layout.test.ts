import { describe, expect, it } from "vitest";
import prettier from "prettier";
import { polygonCallout } from "@shared/layout/regions.ts";
import {
  appendCalloutRegion,
  calloutColor,
  calloutShapeSummary,
  emptyLayout,
  formatLayout,
  layoutWithCallouts,
  moveCallout,
  moveCalloutById,
  nextCalloutName,
  nudgeLayoutGroup,
  parseMapLayout,
  regionLabel,
  removeCalloutRegion,
  renameLayoutGroup,
  replaceCalloutRegion,
  slugId,
  uniqueId,
} from "./layout";
import { TRIANGLE, poly } from "@/lib/testing/callouts";

const valid = {
  schema: 1,
  map: "de_mirage",
  callouts: [
    {
      id: "palace",
      name: "Palace",
      floor: "default",
      polygon: TRIANGLE,
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
          polygon: TRIANGLE,
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
        { id: "palace", name: "Palace", floor: "default", group: "A side", polygon: TRIANGLE },
        { id: "tetris", name: "Tetris", floor: "default", group: "A side", polygon: TRIANGLE },
        { id: "apps", name: "Apps", floor: "default", group: "B side", polygon: TRIANGLE },
        { id: "b", name: "B Site", floor: "default", group: "B side", polygon: TRIANGLE },
      ],
    });
    expect(parsed?.groups).toEqual(["B side", "A side"]);
  });

  it("omits groups when the JSON has none", () => {
    const parsed = parseMapLayout({
      schema: 1,
      map: "de_mirage",
      callouts: [
        { id: "palace", name: "Palace", floor: "default", group: "A side", polygon: TRIANGLE },
        { id: "tetris", name: "Tetris", floor: "default", group: "A side", polygon: TRIANGLE },
      ],
    });
    expect(parsed?.groups).toBeUndefined();
  });

  it("reads a circle and a multi-region callout", () => {
    const parsed = parseMapLayout({
      schema: 1,
      map: "de_mirage",
      callouts: [
        {
          id: "pit",
          name: "Pit",
          floor: "default",
          regions: [{ kind: "circle", x: 10, y: 20, radius: 8 }],
        },
        {
          id: "apps",
          name: "Apps",
          floor: "default",
          regions: [
            { kind: "polygon", points: TRIANGLE },
            { kind: "circle", x: 80, y: 80, radius: 12 },
          ],
        },
      ],
    });
    expect(parsed?.callouts[0]?.regions).toEqual([{ kind: "circle", x: 10, y: 20, radius: 8 }]);
    expect(parsed?.callouts[1]?.regions).toHaveLength(2);
  });

  it("drops a circle with no radius and an empty regions list", () => {
    const parsed = parseMapLayout({
      schema: 1,
      map: "de_mirage",
      callouts: [
        {
          id: "tiny",
          name: "Tiny",
          floor: "default",
          regions: [{ kind: "circle", x: 0, y: 0, radius: 0 }],
        },
        { id: "empty", name: "Empty", floor: "default", regions: [] },
      ],
    });
    expect(parsed?.callouts).toEqual([]);
  });
});

describe("moveCallout", () => {
  const a = poly("a", "A");
  const b = poly("b", "B");
  const c = poly("c", "C");

  it("moves an item to a new index", () => {
    expect(moveCallout([a, b, c], 0, 2).map((row) => row.id)).toEqual(["b", "c", "a"]);
    expect(moveCallout([a, b, c], 2, 0).map((row) => row.id)).toEqual(["c", "a", "b"]);
    expect(moveCalloutById([a, b, c], "a", "c").map((row) => row.id)).toEqual(["b", "c", "a"]);
  });

  it("leaves the list unchanged for a no-op index", () => {
    const list = [a, b, c];
    expect(moveCallout(list, 1, 1)).toBe(list);
    expect(moveCallout(list, -1, 0)).toBe(list);
    expect(moveCalloutById(list, "missing", "a")).toBe(list);
  });
});

describe("uniqueId", () => {
  it("slugifies names and suffixes collisions", () => {
    expect(slugId("A Ramp")).toBe("a-ramp");
    expect(slugId("   ")).toBe("callout");
    expect(uniqueId("palace", ["palace", "palace-2"])).toBe("palace-3");
    expect(uniqueId("fresh", [])).toBe("fresh");
  });
});

describe("callout helpers", () => {
  it("names the next callout and hashes a stable color", () => {
    expect(nextCalloutName([])).toBe("Callout 1");
    expect(nextCalloutName([poly("a")])).toBe("Callout 2");
    expect(calloutColor("palace")).toMatch(/^#/);
    expect(calloutColor("palace")).toBe(calloutColor("palace"));
  });

  it("summarizes polygon, circle, and multi-region shapes", () => {
    expect(calloutShapeSummary(poly("a"))).toBe("3 vertices");
    expect(
      calloutShapeSummary({
        id: "c",
        name: "C",
        floor: "default",
        regions: [{ kind: "circle", x: 0, y: 0, radius: 12.4 }],
      }),
    ).toBe("Circle");
    expect(
      calloutShapeSummary({
        id: "m",
        name: "M",
        floor: "default",
        regions: [
          { kind: "polygon", points: TRIANGLE },
          { kind: "circle", x: 1, y: 1, radius: 4 },
        ],
      }),
    ).toBe("2 regions");
    expect(regionLabel({ kind: "circle", x: 0, y: 0, radius: 12.4 })).toBe("Circle r12");
    expect(regionLabel({ kind: "polygon", points: TRIANGLE })).toBe("Polygon (3)");
    expect(calloutShapeSummary({ id: "e", name: "E", floor: "default", regions: [] })).toBe(
      "0 regions",
    );
  });

  it("appends, replaces, and removes regions without dropping the last one", () => {
    const circle = { kind: "circle" as const, x: 8, y: 8, radius: 4 };
    const withTwo = appendCalloutRegion([poly("a")], "a", circle);
    expect(withTwo[0]?.regions).toHaveLength(2);
    const swapped = replaceCalloutRegion(withTwo, "a", 0, circle);
    expect(swapped[0]?.regions[0]).toEqual(circle);
    expect(removeCalloutRegion(withTwo, "a", 0)[0]?.regions).toHaveLength(1);
    expect(removeCalloutRegion(withTwo, "a", 9)).toEqual(withTwo);
    expect(removeCalloutRegion([poly("a")], "a", 0)[0]?.regions).toHaveLength(1);
    expect(appendCalloutRegion([poly("a")], "nope", circle)[0]?.regions).toHaveLength(1);
  });
});

describe("group order", () => {
  const layout = {
    schema: 1 as const,
    map: "de_mirage",
    callouts: [
      poly("palace", "Palace", { group: "A side" }),
      poly("tetris", "Tetris", { group: "A side" }),
      poly("apps", "Apps", { group: "B side" }),
      poly("b", "B Site", { group: "B side" }),
    ],
  };

  it("nudges writes groups even when the JSON omitted them", () => {
    const moved = nudgeLayoutGroup(layout, "A side", 1);
    expect(moved.groups).toEqual(["B side", "A side"]);
    expect(nudgeLayoutGroup(moved, "A side", 1)).toBe(moved);
    expect(nudgeLayoutGroup(emptyLayout("de_mirage"), "A", 1).groups).toBeUndefined();
  });

  it("renames a group without moving it", () => {
    const named = { ...layout, groups: ["B side", "A side"] };
    const next = renameLayoutGroup(named, "A side", "A");
    expect(next.groups).toEqual(["B side", "A"]);
    expect(next.callouts.map((c) => c.group)).toEqual(["A", "A", "B side", "B side"]);
    expect(renameLayoutGroup(named, "gone", "X")).toBe(named);
  });

  it("keeps groups in sync when callouts change", () => {
    const named = { ...layout, groups: ["B side", "A side"] };
    const next = layoutWithCallouts(
      named,
      named.callouts.filter((c) => c.group === "A side"),
    );
    expect(next.groups).toEqual(["A side"]);
    const plain = layoutWithCallouts(emptyLayout("de_mirage"), [poly("a")]);
    expect(plain.groups).toBeUndefined();
  });

  it("writes groups before callouts", () => {
    const text = formatLayout({ ...layout, groups: ["B side", "A side"] });
    expect(text.indexOf('"groups"')).toBeGreaterThan(-1);
    expect(text.indexOf('"groups"')).toBeLessThan(text.indexOf('"callouts"'));
  });

  it("prints a short groups array on one line, matching Prettier", async () => {
    const text = formatLayout({ ...layout, groups: ["B side", "A side"] });
    expect(text).toContain('"groups": ["B side", "A side"]');
    expect(text).toBe(await prettier.format(text, { parser: "json", printWidth: 100 }));
  });

  it("matches Prettier on a layout with polygons", async () => {
    const text = formatLayout({
      schema: 1,
      map: "de_mirage",
      groups: ["A", "Mid", "B", "Others"],
      callouts: [
        polygonCallout(
          "callout-1",
          "Ladder Room",
          [
            { x: 401.92455549722047, y: 349.00720813322124 },
            { x: 458.4906919589356, y: 348.14139992207254 },
            { x: 458.7792946959852, y: 368.92079698964136 },
          ],
          { group: "Mid" },
        ),
      ],
    });
    expect(text).toContain('"polygon"');
    expect(text).not.toContain('"regions"');
    expect(text).toBe(await prettier.format(text, { parser: "json", printWidth: 100 }));
  });

  it("serializes circles and extra regions as regions, not a fake polygon", async () => {
    const text = formatLayout({
      schema: 1,
      map: "de_mirage",
      callouts: [
        {
          id: "pit",
          name: "Pit",
          floor: "default",
          regions: [{ kind: "circle", x: 10, y: 20, radius: 8 }],
        },
      ],
    });
    expect(text).toContain('"kind": "circle"');
    expect(text).not.toContain('"polygon"');
    expect(text).toBe(await prettier.format(text, { parser: "json", printWidth: 100 }));
  });
});
