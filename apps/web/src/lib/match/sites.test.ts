import { describe, expect, it } from "vitest";
import type { LayoutCallout, MapLayout } from "@/lib/radar/layouts";
import type { MapCalibration } from "@/lib/replay/replayTypes";
import {
  layoutSiteFilters,
  nearerBombsite,
  placeAt,
  placeFromLandings,
  placeLabel,
  plantPlace,
  siteAt,
  siteFromName,
  calloutsInLocation,
  type MapPlaces,
} from "./sites";

function rect(id: string, name: string, x: number, y: number, w: number, h: number): LayoutCallout {
  return {
    id,
    name,
    floor: "default",
    polygon: [
      { x, y },
      { x: x + w, y },
      { x: x + w, y: y + h },
      { x, y: y + h },
    ],
  };
}

/** world (x, y) → radar (x, 1024 - y) */
const UNIT_CAL: MapCalibration = { pos_x: 0, pos_y: 1024, scale: 1, radar: "test.png" };

function placesWith(callouts: LayoutCallout[]): MapPlaces {
  const layout: MapLayout = { schema: 1, map: "de_test", callouts };
  return { layout, cal: UNIT_CAL };
}

const fixture = placesWith([
  rect("a", "A Site", 0, 0, 100, 100),
  rect("palace", "Palace", 120, 0, 60, 60),
  rect("b", "B Site", 800, 800, 100, 100),
  rect("mid", "Mid", 400, 400, 100, 100),
  rect("spawn", "T Spawn", 0, 900, 50, 50),
]);

/** Radar (50, 50) */
const A_WORLD = { x: 50, y: 974 };
/** Radar (150, 30) — Palace, closer to A Site */
const PALACE_WORLD = { x: 150, y: 994 };
/** Radar (850, 850) */
const B_WORLD = { x: 850, y: 174 };
/** Radar (450, 450) */
const MID_WORLD = { x: 450, y: 574 };
/** Outside every polygon, still nearer A */
const OUTSIDE_NEAR_A = { x: 50, y: 800 };

describe("siteFromName", () => {
  it("reads A/B/Mid from callout names and ignores rooms and spawns", () => {
    expect(siteFromName("A Site")).toBe("A");
    expect(siteFromName("B Site")).toBe("B");
    expect(siteFromName("B Apps")).toBe("B");
    expect(siteFromName("Mid")).toBe("Mid");
    expect(siteFromName("Top mid")).toBe("Mid");
    expect(siteFromName("Palace")).toBeNull();
    expect(siteFromName("Bench")).toBeNull();
    expect(siteFromName("Balcony")).toBeNull();
    expect(siteFromName("CT Spawn")).toBeNull();
    expect(siteFromName("T Spawn")).toBeNull();
  });
});

describe("siteAt", () => {
  it("returns null when the layout has no callouts", () => {
    expect(siteAt(placesWith([]), A_WORLD.x, A_WORLD.y)).toBeNull();
    expect(siteAt(null, A_WORLD.x, A_WORLD.y)).toBeNull();
  });

  it("uses the named region, then the nearer bombsite for rooms like Palace", () => {
    expect(siteAt(fixture, A_WORLD.x, A_WORLD.y)).toBe("A");
    expect(siteAt(fixture, B_WORLD.x, B_WORLD.y)).toBe("B");
    expect(siteAt(fixture, MID_WORLD.x, MID_WORLD.y)).toBe("Mid");
    expect(placeAt(fixture, PALACE_WORLD.x, PALACE_WORLD.y)).toEqual({
      site: "A",
      location: "Palace",
    });
    expect(siteAt(fixture, OUTSIDE_NEAR_A.x, OUTSIDE_NEAR_A.y)).toBeNull();
  });

  it("labels a gap as the closest callout, or between neighbors when they are equally near", () => {
    expect(placeAt(fixture, 102, 974)).toEqual({ site: "A", location: "A Site" });
    expect(placeAt(fixture, 110, 974)).toEqual({
      site: "A",
      location: "between A Site, Palace",
    });
  });

  it("does not treat spawn as a site", () => {
    expect(placeAt(fixture, 25, 99)).toEqual({ site: null, location: null });
  });
});

describe("nearerBombsite", () => {
  it("picks A vs B from site polygon centroids", () => {
    expect(nearerBombsite(fixture, PALACE_WORLD.x, PALACE_WORLD.y)).toBe("A");
    expect(nearerBombsite(fixture, B_WORLD.x, B_WORLD.y)).toBe("B");
  });
});

describe("plantPlace", () => {
  it("labels a plant just outside the site polygon from the nearer bombsite", () => {
    expect(plantPlace(fixture, OUTSIDE_NEAR_A.x, OUTSIDE_NEAR_A.y).site).toBe("A");
    expect(plantPlace(null, OUTSIDE_NEAR_A.x, OUTSIDE_NEAR_A.y).site).toBeNull();
  });
});

describe("placeFromLandings", () => {
  it("votes A from nades that land on Palace", () => {
    const hit = placeFromLandings(fixture, [PALACE_WORLD, { x: 140, y: 990 }]);
    expect(hit.site).toBe("A");
    expect(hit.location).toBe("Palace");
    expect(placeLabel(hit)).toBe("Palace");
  });
});

describe("calloutsInLocation", () => {
  it("splits a between-gap into the neighboring names", () => {
    expect(calloutsInLocation("Palace")).toEqual(["Palace"]);
    expect(calloutsInLocation("between A Site, Palace")).toEqual(["A Site", "Palace"]);
    expect(calloutsInLocation(null)).toEqual([]);
  });
});

describe("layoutSiteFilters", () => {
  it("hides A/B/Mid when the layout is empty", () => {
    expect(layoutSiteFilters({ schema: 1, map: "de_dust2", callouts: [] })).toEqual({
      a: false,
      b: false,
      mid: false,
    });
    expect(layoutSiteFilters(fixture.layout)).toEqual({ a: true, b: true, mid: true });
  });
});
