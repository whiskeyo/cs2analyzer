import { describe, expect, it } from "vitest";
import {
  applyHandleDrag,
  hitCalloutAtRadar,
  hitHandle,
  hitPolygonEdge,
  screenToRadarIn,
  visibleCallouts,
} from "./layoutHit";
import { radarToScreen, type RadarView } from "./maps";
import { SQUARE, poly } from "@/lib/testing/callouts";
import type { LayoutCallout } from "./types";

const wrap = { clientWidth: 1056, clientHeight: 1056 };
const view: RadarView = { scale: 1, ox: 0, oy: 0 };

function screenOf(x: number, y: number) {
  return radarToScreen(wrap.clientWidth, wrap.clientHeight, view, x, y);
}

const square: LayoutCallout = {
  id: "yard",
  name: "Yard",
  floor: "default",
  regions: [{ kind: "polygon", points: SQUARE }],
};

const circle: LayoutCallout = {
  id: "pit",
  name: "Pit",
  floor: "default",
  regions: [{ kind: "circle", x: 50, y: 50, radius: 10 }],
};

const nested: LayoutCallout = {
  id: "car",
  name: "Car",
  floor: "default",
  regions: [
    {
      kind: "polygon",
      points: [
        { x: 2, y: 2 },
        { x: 4, y: 2 },
        { x: 4, y: 4 },
        { x: 2, y: 4 },
      ],
    },
  ],
};

describe("hitCalloutAtRadar", () => {
  it("picks the smallest covering callout on that floor", () => {
    expect(hitCalloutAtRadar([square, nested], "default", 3, 3)?.id).toBe("car");
    expect(hitCalloutAtRadar([square, nested], "default", 8, 8)?.id).toBe("yard");
    expect(hitCalloutAtRadar([square], "lower", 3, 3)).toBeNull();
    expect(
      visibleCallouts([square, { ...square, id: "low", floor: "lower" }], "lower"),
    ).toHaveLength(1);
  });

  it("hits a true circle by radius", () => {
    expect(hitCalloutAtRadar([circle], "default", 50, 50)?.id).toBe("pit");
    expect(hitCalloutAtRadar([circle], "default", 80, 80)).toBeNull();
  });
});

describe("hitHandle", () => {
  it("grabs polygon vertices and circle center/rim", () => {
    const vertex = screenOf(0, 0);
    expect(hitHandle(wrap, view, square, vertex.x, vertex.y)).toEqual({
      kind: "poly-vertex",
      region: 0,
      index: 0,
    });
    const center = screenOf(50, 50);
    expect(hitHandle(wrap, view, circle, center.x, center.y)).toEqual({
      kind: "circle-center",
      region: 0,
    });
    const rim = screenOf(60, 50);
    expect(hitHandle(wrap, view, circle, rim.x, rim.y)).toEqual({ kind: "circle-rim", region: 0 });
    expect(hitHandle(wrap, view, square, 0, 0)).toBeNull();
  });
});

describe("hitPolygonEdge", () => {
  it("prefers the selected callout's closest edge", () => {
    const mid = screenOf(5, 0);
    const hit = hitPolygonEdge(wrap, view, [square], "default", "yard", mid.x, mid.y);
    expect(hit).toMatchObject({ callout: { id: "yard" }, region: 0, index: 0 });
    expect(hitPolygonEdge(wrap, view, [circle], "default", null, mid.x, mid.y)).toBeNull();
  });
});

describe("applyHandleDrag", () => {
  it("moves a vertex, a circle center, and a rim radius", () => {
    const moved = applyHandleDrag(
      square,
      { kind: "poly-vertex", region: 0, index: 0 },
      {
        x: 1,
        y: 2,
      },
    );
    expect(moved.regions[0]?.kind === "polygon" && moved.regions[0].points[0]).toEqual({
      x: 1,
      y: 2,
    });
    const shifted = applyHandleDrag(circle, { kind: "circle-center", region: 0 }, { x: 8, y: 9 });
    expect(shifted.regions[0]).toMatchObject({ kind: "circle", x: 8, y: 9, radius: 10 });
    const rim = applyHandleDrag(circle, { kind: "circle-rim", region: 0 }, { x: 50, y: 70 });
    expect(rim.regions[0]).toMatchObject({ kind: "circle", x: 50, y: 50, radius: 20 });
    const mismatch = applyHandleDrag(square, { kind: "circle-center", region: 0 }, { x: 1, y: 1 });
    expect(mismatch.regions[0]).toEqual(square.regions[0]);
    const otherRegion = applyHandleDrag(
      {
        ...square,
        regions: [square.regions[0]!, { kind: "circle", x: 80, y: 80, radius: 4 }],
      },
      { kind: "circle-rim", region: 1 },
      { x: 80, y: 80 },
    );
    expect(otherRegion.regions[0]).toEqual(square.regions[0]);
    expect(otherRegion.regions[1]).toMatchObject({ kind: "circle", radius: 1 });
  });
});

describe("screenToRadarIn", () => {
  it("inverts radarToScreen at the origin", () => {
    const s = screenOf(10, 20);
    expect(screenToRadarIn(wrap, view, s.x, s.y).x).toBeCloseTo(10);
    expect(screenToRadarIn(wrap, view, s.x, s.y).y).toBeCloseTo(20);
    expect(poly("a").id).toBe("a");
  });
});
