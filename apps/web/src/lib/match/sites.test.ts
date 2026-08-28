import { describe, expect, it } from "vitest";
import { makeCallout, makePlaces } from "@/lib/testing/fixtures";
import {
  nearerBombsite,
  placeAt,
  placeFromLandings,
  placeLabel,
  placeMatchesLayoutGroup,
  plantPlace,
  siteAt,
  siteFromName,
  calloutsInLocation,
} from "./sites";

const fixture = makePlaces([
  makeCallout("a", "A Site", 0, 0, 100, 100),
  makeCallout("palace", "Palace", 120, 0, 60, 60),
  makeCallout("b", "B Site", 800, 800, 100, 100),
  makeCallout("mid", "Mid", 400, 400, 100, 100),
  makeCallout("spawn", "T Spawn", 0, 900, 50, 50),
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
    expect(siteAt(makePlaces([]), A_WORLD.x, A_WORLD.y)).toBeNull();
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

describe("placeMatchesLayoutGroup", () => {
  const grouped = makePlaces([
    { ...makeCallout("a", "A Site", 0, 0, 100, 100), group: "A side" },
    { ...makeCallout("palace", "Palace", 120, 0, 60, 60), group: "A side" },
    { ...makeCallout("b", "B Site", 800, 800, 100, 100), group: "B side" },
    makeCallout("mid", "Mid", 400, 400, 100, 100),
  ]);

  it("matches a group by room name, including between-gaps", () => {
    expect(placeMatchesLayoutGroup("Palace", "A", "A side", grouped.layout)).toBe(true);
    expect(placeMatchesLayoutGroup("Palace", "A", "B side", grouped.layout)).toBe(false);
    expect(placeMatchesLayoutGroup("between A Site, Palace", null, "A side", grouped.layout)).toBe(
      true,
    );
    expect(placeMatchesLayoutGroup("Mid", "Mid", "A side", grouped.layout)).toBe(false);
  });

  it("falls back to A/B/Mid only when the beat has no room name", () => {
    expect(placeMatchesLayoutGroup(null, "A", "A side", grouped.layout)).toBe(true);
    expect(placeMatchesLayoutGroup(null, "B", "A side", grouped.layout)).toBe(false);
  });
});
