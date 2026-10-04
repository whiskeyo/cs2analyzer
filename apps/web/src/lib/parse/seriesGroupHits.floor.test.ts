import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseMapLayout } from "@/lib/layout/schema";
import type { MapLayout } from "@/lib/layout/types";
import type { MapPlaces } from "@/lib/match/sites";
import { RADAR_OVERVIEW_SIZE } from "@/lib/radar/constants";
import { calloutAtWorld } from "@/lib/radar/layouts";
import { floorForZ, parseCalibrations } from "@/lib/radar/maps";
import { FLAG_ALIVE, FLAG_CT, FLAG_PRESENT, type MapCalibration } from "@/lib/replay/replayTypes";
import { FULL_HEALTH } from "@/lib/shared/constants";
import { makePlayer, makeReplay, makeRound, makeTicks } from "@/lib/testing/fixtures";
import { buildSeries, loadedDemo } from "./session";
import { aggregateSeriesGroupHits, type SeriesGroupHits } from "./seriesGroupHits";

/**
 * Feet on de_nuke where the lower B polygon "Secret (down)" covers the same
 * radar point as the default-floor Outside polygon "Garage". Radar px about
 * (709.79, 687.01); stored as float32 the way tick columns keep m_vecOrigin.
 */
const NUKE_OVERLAP_X = 1515.4951171875;
const NUKE_OVERLAP_Y = -1922.0596923828125;

const NUKE_FLOOR_SPLIT_Z = -495;
const NUKE_JUST_BELOW_SPLIT_Z = -495.01;
const VERTIGO_FLOOR_SPLIT_Z = 11700;
const VERTIGO_JUST_BELOW_SPLIT_Z = 11699.99;

function readPublicJson(relativePath: string): unknown {
  const path = fileURLToPath(new URL(`../../../public/${relativePath}`, import.meta.url));
  return JSON.parse(readFileSync(path, "utf8")) as unknown;
}

function layoutFor(map: string): MapLayout {
  const layout = parseMapLayout(readPublicJson(`layouts/${map}.json`), map);
  if (!layout) throw new Error(`could not parse layouts/${map}.json`);
  return layout;
}

function calibrationFor(map: string): MapCalibration {
  const cal = parseCalibrations(readPublicJson("maps/calibrations.json"))[map];
  if (!cal) throw new Error(`calibrations.json has no ${map}`);
  return cal;
}

function placesFor(map: string): MapPlaces {
  return { layout: layoutFor(map), cal: calibrationFor(map) };
}

/** One alive CT sample. `z` is feet (`m_vecOrigin`), with no view offset. */
function hitsAt(map: string, x: number, y: number, z: number): SeriesGroupHits {
  const places = placesFor(map);
  const ticks = makeTicks(1, 1);
  ticks.ticks[0] = 64;
  ticks.x[0] = x;
  ticks.y[0] = y;
  ticks.z[0] = z;
  ticks.flags[0] = FLAG_PRESENT | FLAG_ALIVE | FLAG_CT;
  ticks.health[0] = FULL_HEALTH;
  const replay = makeReplay({
    header: { team_ct: "Team A", team_t: "Enemy", map_name: map, tick_rate: 64 },
    players: [makePlayer(0, "CT", "Donk", 100)],
    ticks,
    rounds: [
      makeRound({
        number: 1,
        freeze_end_tick: 64,
        end_tick: 400,
        team_ct: "Team A",
        team_t: "Enemy",
      }),
    ],
  });
  const series = buildSeries(
    map,
    [loadedDemo(replay, `${map}.dem`, new File([], `${map}.dem`))],
    "Team A",
  );
  return aggregateSeriesGroupHits(series, { side: "CT", kind: "pistol" }, places);
}

function samplesIn(hits: SeriesGroupHits, group: string): number {
  return hits.entries.find((entry) => entry.id === group)?.samples ?? 0;
}

describe("series group hits by floor", () => {
  it("counts Nuke B below the floor split and Outside above it", () => {
    const places = placesFor("de_nuke");
    const below = calloutAtWorld(
      places.layout,
      places.cal,
      NUKE_OVERLAP_X,
      NUKE_OVERLAP_Y,
      NUKE_FLOOR_SPLIT_Z - 1,
    );
    const above = calloutAtWorld(
      places.layout,
      places.cal,
      NUKE_OVERLAP_X,
      NUKE_OVERLAP_Y,
      NUKE_FLOOR_SPLIT_Z + 1,
    );
    expect(below).toMatchObject({ name: "Secret (down)", group: "B", floor: "lower" });
    expect(above).toMatchObject({ name: "Garage", group: "Outside", floor: "default" });

    const lowerHits = hitsAt("de_nuke", NUKE_OVERLAP_X, NUKE_OVERLAP_Y, NUKE_FLOOR_SPLIT_Z - 1);
    expect(lowerHits.sampleCount).toBe(1);
    expect(samplesIn(lowerHits, "B")).toBe(1);
    expect(samplesIn(lowerHits, "Outside")).toBe(0);
    expect(samplesIn(lowerHits, "A")).toBe(0);

    const upperHits = hitsAt("de_nuke", NUKE_OVERLAP_X, NUKE_OVERLAP_Y, NUKE_FLOOR_SPLIT_Z + 1);
    expect(upperHits.sampleCount).toBe(1);
    expect(samplesIn(upperHits, "Outside")).toBe(1);
    expect(samplesIn(upperHits, "B")).toBe(0);
    expect(samplesIn(upperHits, "A")).toBe(0);
  });

  it("keeps Nuke z = -495 on the upper floor and z = -495.01 on lower", () => {
    const cal = calibrationFor("de_nuke");
    expect(cal.floors).toEqual([
      { name: "default", z_min: NUKE_FLOOR_SPLIT_Z, z_max: 10000 },
      { name: "lower", z_min: -10000, z_max: NUKE_FLOOR_SPLIT_Z },
    ]);
    expect(floorForZ(cal, NUKE_FLOOR_SPLIT_Z)).toBe("default");
    expect(floorForZ(cal, NUKE_JUST_BELOW_SPLIT_Z)).toBe("lower");

    const onSplit = hitsAt("de_nuke", NUKE_OVERLAP_X, NUKE_OVERLAP_Y, NUKE_FLOOR_SPLIT_Z);
    expect(samplesIn(onSplit, "Outside")).toBe(1);
    expect(samplesIn(onSplit, "B")).toBe(0);

    const justBelow = hitsAt("de_nuke", NUKE_OVERLAP_X, NUKE_OVERLAP_Y, NUKE_JUST_BELOW_SPLIT_Z);
    expect(samplesIn(justBelow, "B")).toBe(1);
    expect(samplesIn(justBelow, "Outside")).toBe(0);
  });

  it("splits Vertigo at z = 11700", () => {
    // layouts/de_vertigo.json has no callouts, so no X/Y sits in two groups.
    // Only the calibration floor changes across the boundary.
    const places = placesFor("de_vertigo");
    expect(places.layout.callouts).toEqual([]);
    expect(places.cal.floors).toEqual([
      { name: "default", z_min: VERTIGO_FLOOR_SPLIT_Z, z_max: 20000 },
      { name: "lower", z_min: -10000, z_max: VERTIGO_FLOOR_SPLIT_Z },
    ]);
    expect(floorForZ(places.cal, VERTIGO_FLOOR_SPLIT_Z)).toBe("default");
    expect(floorForZ(places.cal, VERTIGO_JUST_BELOW_SPLIT_Z)).toBe("lower");

    const mid = RADAR_OVERVIEW_SIZE / 2;
    const radarCenterX = Math.fround(mid * places.cal.scale + places.cal.pos_x);
    const radarCenterY = Math.fround(places.cal.pos_y - mid * places.cal.scale);
    expect(
      calloutAtWorld(places.layout, places.cal, radarCenterX, radarCenterY, VERTIGO_FLOOR_SPLIT_Z),
    ).toBeNull();
    expect(
      calloutAtWorld(
        places.layout,
        places.cal,
        radarCenterX,
        radarCenterY,
        VERTIGO_JUST_BELOW_SPLIT_Z,
      ),
    ).toBeNull();

    const upper = hitsAt("de_vertigo", radarCenterX, radarCenterY, VERTIGO_FLOOR_SPLIT_Z);
    const lower = hitsAt("de_vertigo", radarCenterX, radarCenterY, VERTIGO_JUST_BELOW_SPLIT_Z);
    expect(upper.entries).toEqual([]);
    expect(lower.entries).toEqual([]);
    expect(upper.sampleCount).toBe(0);
    expect(lower.sampleCount).toBe(0);
  });
});
