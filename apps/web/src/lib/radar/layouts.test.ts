import { describe, expect, it } from "vitest";
import {
  calloutAtRadar,
  calloutAtWorld,
  distanceToPolygon,
  parseMapLayout,
  type MapLayout,
} from "./layouts";
import type { MapCalibration } from "@/lib/replay/replayTypes";

const layout: MapLayout = {
  schema: 1,
  map: "de_dust2",
  callouts: [
    {
      id: "yard",
      name: "Yard",
      floor: "default",
      polygon: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
        { x: 0, y: 100 },
      ],
    },
    {
      id: "car",
      name: "Car",
      floor: "default",
      polygon: [
        { x: 40, y: 40 },
        { x: 60, y: 40 },
        { x: 60, y: 60 },
        { x: 40, y: 60 },
      ],
    },
    {
      id: "secret",
      name: "Secret",
      floor: "lower",
      polygon: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
        { x: 0, y: 100 },
      ],
    },
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
});
