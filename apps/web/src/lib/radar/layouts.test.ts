import { describe, expect, it } from "vitest";
import { polygonCallout } from "@/lib/layout/regions.ts";
import {
  calloutAtRadar,
  calloutAtWorld,
  distanceToPolygon,
  layoutGroupFilters,
  orderedLayoutCallouts,
  parseMapLayout,
  type MapLayout,
} from "./layouts";
import type { MapCalibration } from "@/lib/replay/replayTypes";

const box = [
  { x: 0, y: 0 },
  { x: 4, y: 0 },
  { x: 4, y: 4 },
];

const layout: MapLayout = {
  schema: 1,
  map: "de_dust2",
  callouts: [
    polygonCallout("yard", "Yard", [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ]),
    polygonCallout("car", "Car", [
      { x: 40, y: 40 },
      { x: 60, y: 40 },
      { x: 60, y: 60 },
      { x: 40, y: 60 },
    ]),
    polygonCallout(
      "secret",
      "Secret",
      [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
        { x: 0, y: 100 },
      ],
      { floor: "lower" },
    ),
  ],
};

const cal: MapCalibration = {
  pos_x: 0,
  pos_y: 1024,
  scale: 1,
  radar: "de_dust2.png",
  lower_radar: "de_dust2_lower.png",
  floors: [
    { name: "default", z_min: 0, z_max: 10000 },
    { name: "lower", z_min: -10000, z_max: 0 },
  ],
};

describe("calloutAtRadar", () => {
  it("returns the smallest overlapping region", () => {
    expect(calloutAtRadar(layout, 50, 50, "default")?.id).toBe("car");
    expect(calloutAtRadar(layout, 10, 10, "default")?.id).toBe("yard");
    expect(calloutAtRadar(layout, 50, 50, "lower")?.id).toBe("secret");
    expect(calloutAtRadar(layout, 200, 200, "default")).toBeNull();
  });

  it("hits a circle by center and radius", () => {
    const circled: MapLayout = {
      schema: 1,
      map: "de_dust2",
      callouts: [
        {
          id: "pit",
          name: "Pit",
          floor: "default",
          regions: [{ kind: "circle", x: 50, y: 50, radius: 10 }],
        },
      ],
    };
    expect(calloutAtRadar(circled, 50, 50)?.id).toBe("pit");
    expect(calloutAtRadar(circled, 80, 50)).toBeNull();
  });
});

describe("calloutAtWorld", () => {
  it("converts world XY with calibration and uses Z for floor", () => {
    expect(calloutAtWorld(layout, cal, 50, 974, 100)?.id).toBe("car");
    expect(calloutAtWorld(layout, cal, 50, 974, -20)?.id).toBe("secret");
  });
});

describe("distanceToPolygon", () => {
  it("is 0 inside and the edge distance outside", () => {
    const square = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ];
    expect(distanceToPolygon(50, 50, square)).toBe(0);
    expect(distanceToPolygon(150, 50, square)).toBe(50);
  });
});

describe("parseMapLayout", () => {
  it("drops callouts that are not a closed polygon", () => {
    const parsed = parseMapLayout({
      schema: 1,
      map: "de_dust2",
      callouts: [{ id: "x", name: "X", floor: "default", polygon: [{ x: 1, y: 1 }] }],
    });
    expect(parsed?.callouts).toEqual([]);
  });

  it("keeps a trimmed optional group when two members share it", () => {
    const parsed = parseMapLayout({
      schema: 1,
      map: "de_dust2",
      callouts: [
        {
          id: "yard",
          name: "Yard",
          floor: "default",
          group: "  A  ",
          polygon: [
            { x: 0, y: 0 },
            { x: 4, y: 0 },
            { x: 4, y: 4 },
          ],
        },
        {
          id: "car",
          name: "Car",
          floor: "default",
          group: "  A  ",
          polygon: [
            { x: 10, y: 10 },
            { x: 14, y: 10 },
            { x: 14, y: 14 },
          ],
        },
      ],
    });
    expect(parsed?.callouts.map((c) => c.group)).toEqual(["A", "A"]);
  });

  it("dissolves a singleton group", () => {
    const parsed = parseMapLayout({
      schema: 1,
      map: "de_dust2",
      callouts: [
        {
          id: "yard",
          name: "Yard",
          floor: "default",
          group: "A",
          polygon: [
            { x: 0, y: 0 },
            { x: 4, y: 0 },
            { x: 4, y: 4 },
          ],
        },
      ],
    });
    expect(parsed?.callouts[0]?.group).toBeUndefined();
  });
});

describe("orderedLayoutCallouts", () => {
  it("clusters groups by first appearance and leaves ungrouped last", () => {
    const grouped: MapLayout = {
      schema: 1,
      map: "de_mirage",
      callouts: [
        polygonCallout("mid", "Mid", box),
        polygonCallout("site", "A Site", box, { group: "A" }),
        polygonCallout("tetris", "Tetris", box, { group: "A" }),
      ],
    };
    expect(orderedLayoutCallouts(grouped).map((c) => c.name)).toEqual(["A Site", "Tetris", "Mid"]);
  });

  it("keeps array order when nothing is grouped", () => {
    expect(orderedLayoutCallouts(layout).map((c) => c.id)).toEqual(["yard", "car", "secret"]);
  });
});

describe("layoutGroupFilters", () => {
  it("lists named groups in first-appearance order", () => {
    const grouped: MapLayout = {
      schema: 1,
      map: "de_mirage",
      callouts: [
        polygonCallout("mid", "Mid", box),
        polygonCallout("site", "A Site", box, { group: "A side" }),
        polygonCallout("tetris", "Tetris", box, { group: "A side" }),
        polygonCallout("apps", "Apps", box, { group: "B side" }),
        polygonCallout("b", "B Site", box, { group: "B side" }),
      ],
    };
    expect(layoutGroupFilters(grouped)).toEqual([
      { id: "A side", label: "A side" },
      { id: "B side", label: "B side" },
    ]);
    expect(layoutGroupFilters({ ...grouped, groups: ["B side", "A side"] })).toEqual([
      { id: "B side", label: "B side" },
      { id: "A side", label: "A side" },
    ]);
    expect(layoutGroupFilters({ schema: 1, map: "de_dust2", callouts: [] })).toEqual([]);
  });

  it("parses an explicit groups array", () => {
    const parsed = parseMapLayout({
      schema: 1,
      map: "de_mirage",
      groups: ["B side", "A side"],
      callouts: [
        { id: "site", name: "A Site", floor: "default", group: "A side", polygon: box },
        { id: "tetris", name: "Tetris", floor: "default", group: "A side", polygon: box },
        { id: "apps", name: "Apps", floor: "default", group: "B side", polygon: box },
        { id: "b", name: "B Site", floor: "default", group: "B side", polygon: box },
      ],
    });
    expect(parsed?.groups).toEqual(["B side", "A side"]);
    expect(layoutGroupFilters(parsed)).toEqual([
      { id: "B side", label: "B side" },
      { id: "A side", label: "A side" },
    ]);
  });
});
