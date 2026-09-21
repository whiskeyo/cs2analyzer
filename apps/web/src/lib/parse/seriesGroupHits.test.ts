import { describe, expect, it } from "vitest";
import { LAYOUT_SCHEMA } from "@/lib/radar/layouts";
import type { MapPlaces } from "@/lib/match/sites";
import { FULL_HEALTH } from "@/lib/shared/constants";
import {
  makeCallout,
  makePlayer,
  makeReplay,
  makeRound,
  makeTicks,
  UNIT_CALIBRATION,
} from "@/lib/testing/fixtures";
import type { LayoutCallout } from "@/lib/radar/layouts";
import type { TickBuffers } from "@/lib/replay/replayTypes";
import { FLAG_ALIVE, FLAG_CT, FLAG_PRESENT } from "@/lib/replay/replayTypes";
import { buildSeries, loadedDemo } from "./session";
import { aggregateSeriesGroupHits, formatGroupHitPercent } from "./seriesGroupHits";

const FOCAL = "Team A";

function worldCenter(x: number, y: number, w: number, h: number): { x: number; y: number } {
  return {
    x: x + w / 2,
    y: UNIT_CALIBRATION.pos_y - (y + h / 2),
  };
}

function grouped(
  id: string,
  name: string,
  x: number,
  y: number,
  w: number,
  h: number,
  group?: string,
): LayoutCallout {
  const callout = makeCallout(id, name, x, y, w, h);
  return group ? { ...callout, group } : callout;
}

const TOP_MID = grouped("top", "Top Mid", 0, 0, 80, 80, "Mid");
const WINDOW = grouped("win", "Window", 100, 0, 80, 80, "Mid");
const A_SITE = grouped("as", "A Site", 0, 200, 80, 80, "A");
const PALACE = grouped("pal", "Palace", 100, 200, 80, 80, "A");
const B_SITE = grouped("bs", "B Site", 0, 400, 80, 80, "B");
const B_APPS = grouped("apps", "B Apps", 100, 400, 80, 80, "B");
const T_SPAWN = grouped("tsp", "T Spawn", 300, 0, 80, 80, "Others");
const TV = grouped("tv", "TV", 400, 0, 80, 80, "Others");
const CT_SPAWN = grouped("ctsp", "CT Spawn", 500, 0, 80, 80, "Spawns");
const T_SPAWN_ONLY = grouped("tsp2", "T Spawn", 600, 0, 80, 80, "Spawns");
const CONNECTOR = grouped("con", "Connector", 700, 0, 40, 40);

function nukeLikePlaces(): MapPlaces {
  return {
    layout: {
      schema: LAYOUT_SCHEMA,
      map: "de_mirage",
      groups: ["B", "A", "Mid", "Others", "Spawns"],
      callouts: [
        TOP_MID,
        WINDOW,
        A_SITE,
        PALACE,
        B_SITE,
        B_APPS,
        T_SPAWN,
        TV,
        CT_SPAWN,
        T_SPAWN_ONLY,
        CONNECTOR,
      ],
    },
    cal: UNIT_CALIBRATION,
  };
}

interface Slot {
  x: number;
  y: number;
  alive?: boolean;
  ct?: boolean;
}

function ticksFromFrames(
  playerCount: number,
  frames: { tick: number; players: Slot[] }[],
): TickBuffers {
  const buf = makeTicks(playerCount, frames.length);
  frames.forEach((frame, frameIndex) => {
    buf.ticks[frameIndex] = frame.tick;
    frame.players.forEach((player, playerIndex) => {
      const slot = frameIndex * playerCount + playerIndex;
      let flags = FLAG_PRESENT;
      if (player.alive !== false) flags |= FLAG_ALIVE;
      if (player.ct !== false) flags |= FLAG_CT;
      buf.flags[slot] = flags;
      buf.x[slot] = player.x;
      buf.y[slot] = player.y;
      buf.health[slot] = player.alive === false ? 0 : FULL_HEALTH;
    });
  });
  return buf;
}

function ctAt(callout: LayoutCallout, alive = true): Slot {
  const region = callout.regions[0];
  if (!region || region.kind !== "polygon") throw new Error("expected a polygon callout");
  const xs = region.points.map((point) => point.x);
  const ys = region.points.map((point) => point.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const center = worldCenter(minX, minY, Math.max(...xs) - minX, Math.max(...ys) - minY);
  return { ...center, alive, ct: true };
}

function seriesFrom(
  frames: { tick: number; players: Slot[] }[],
  fileName: string,
  opts: { focalOnT?: boolean } = {},
) {
  const teamCt = opts.focalOnT ? "Enemy" : FOCAL;
  const teamT = opts.focalOnT ? FOCAL : "Enemy";
  const replay = makeReplay({
    header: { team_ct: teamCt, team_t: teamT, map_name: "de_mirage", tick_rate: 64 },
    players: [
      makePlayer(0, opts.focalOnT ? "T" : "CT", "Donk", 100),
      makePlayer(1, "T", "Enemy", 200),
    ],
    ticks: ticksFromFrames(2, frames),
    rounds: [
      makeRound({
        number: 1,
        start_tick: 0,
        freeze_end_tick: 64,
        end_tick: 400,
        team_ct: teamCt,
        team_t: teamT,
      }),
    ],
  });
  const demo = loadedDemo(replay, fileName, new File([], fileName));
  return buildSeries("de_mirage", [demo], FOCAL);
}

describe("aggregateSeriesGroupHits", () => {
  const places = nukeLikePlaces();

  it("rolls fine callouts into layout groups and skips spawn-only groups", () => {
    const top = ctAt(TOP_MID);
    const window = ctAt(WINDOW);
    const spawn = ctAt(T_SPAWN);
    const series = buildSeries(
      "de_mirage",
      [
        loadedDemo(
          makeReplay({
            header: { team_ct: FOCAL, team_t: "Enemy", map_name: "de_mirage" },
            players: [makePlayer(0, "CT", "Donk", 100)],
            ticks: ticksFromFrames(1, [{ tick: 64, players: [top] }]),
            rounds: [
              makeRound({
                number: 1,
                freeze_end_tick: 64,
                end_tick: 400,
                team_ct: FOCAL,
                team_t: "Enemy",
              }),
            ],
          }),
          "a.dem",
          new File([], "a.dem"),
        ),
        loadedDemo(
          makeReplay({
            header: { team_ct: FOCAL, team_t: "Enemy", map_name: "de_mirage" },
            players: [makePlayer(0, "CT", "Donk", 101)],
            ticks: ticksFromFrames(1, [{ tick: 64, players: [window] }]),
            rounds: [
              makeRound({
                number: 1,
                freeze_end_tick: 64,
                end_tick: 400,
                team_ct: FOCAL,
                team_t: "Enemy",
              }),
            ],
          }),
          "b.dem",
          new File([], "b.dem"),
        ),
        loadedDemo(
          makeReplay({
            header: { team_ct: FOCAL, team_t: "Enemy", map_name: "de_mirage" },
            players: [makePlayer(0, "CT", "Donk", 102)],
            ticks: ticksFromFrames(1, [{ tick: 64, players: [spawn] }]),
            rounds: [
              makeRound({
                number: 1,
                freeze_end_tick: 64,
                end_tick: 400,
                team_ct: FOCAL,
                team_t: "Enemy",
              }),
            ],
          }),
          "c.dem",
          new File([], "c.dem"),
        ),
      ],
      FOCAL,
    );

    const hits = aggregateSeriesGroupHits(series, { side: "CT", kind: "pistol" }, places);
    expect(hits.roundCount).toBe(3);
    expect(hits.sampleCount).toBe(2);
    expect(hits.entries.map((entry) => entry.id)).toEqual(["B", "A", "Mid", "Others"]);
    expect(hits.entries.map((entry) => entry.label)).not.toContain("Top Mid");
    expect(hits.entries.map((entry) => entry.label)).not.toContain("Window");
    expect(hits.entries.find((entry) => entry.id === "Mid")).toMatchObject({
      samples: 2,
      share: 1,
    });
    expect(hits.entries.find((entry) => entry.id === "Others")?.samples).toBe(0);
    expect(hits.entries.find((entry) => entry.id === "Spawns")).toBeUndefined();
    expect(formatGroupHitPercent(2, 3)).toBe("67%");
  });

  it("splits one round across groups by time, not by fine callouts", () => {
    const series = seriesFrom(
      [
        { tick: 64, players: [ctAt(A_SITE), { ...ctAt(B_SITE), ct: false }] },
        { tick: 128, players: [ctAt(PALACE), { ...ctAt(CONNECTOR), ct: false }] },
        { tick: 192, players: [ctAt(A_SITE), { ...ctAt(B_APPS), ct: false }] },
        { tick: 256, players: [ctAt(TOP_MID), { ...ctAt(CONNECTOR), ct: false }] },
      ],
      "both.dem",
    );
    const hits = aggregateSeriesGroupHits(series, { side: "CT", kind: "pistol" }, places);
    expect(hits.sampleCount).toBe(4);
    expect(hits.entries.find((entry) => entry.id === "A")).toMatchObject({
      samples: 3,
      share: 0.75,
    });
    expect(hits.entries.find((entry) => entry.id === "Mid")).toMatchObject({
      samples: 1,
      share: 0.25,
    });
    expect(hits.entries.find((entry) => entry.id === "B")?.samples).toBe(0);
    expect(hits.entries.map((entry) => entry.id)).not.toContain("Connector");
    expect(formatGroupHitPercent(3, 4)).toBe("75%");
  });

  it("ignores the other side and positions after death", () => {
    const series = seriesFrom(
      [
        {
          tick: 64,
          players: [{ ...ctAt(A_SITE), ct: false }, ctAt(B_SITE)],
        },
        {
          tick: 128,
          players: [{ ...ctAt(B_APPS), alive: false, ct: false }, ctAt(A_SITE)],
        },
      ],
      "t.dem",
      { focalOnT: true },
    );
    const hits = aggregateSeriesGroupHits(series, { side: "T", kind: "pistol" }, places);
    expect(hits.roundCount).toBe(1);
    expect(hits.entries.find((entry) => entry.id === "A")?.samples).toBe(1);
    expect(hits.entries.find((entry) => entry.id === "B")?.samples).toBe(0);
  });

  it("samples on the group-hit step and skips frames in between", () => {
    const series = seriesFrom(
      [
        { tick: 64, players: [ctAt(A_SITE)] },
        { tick: 80, players: [ctAt(B_SITE)] },
        { tick: 128, players: [ctAt(PALACE)] },
      ],
      "step.dem",
    );
    const hits = aggregateSeriesGroupHits(series, { side: "CT", kind: "pistol" }, places);
    expect(hits.entries.find((entry) => entry.id === "A")?.samples).toBe(2);
    expect(hits.entries.find((entry) => entry.id === "B")?.samples).toBe(0);
  });

  it("returns no groups when the map has no layout", () => {
    const series = seriesFrom([{ tick: 64, players: [ctAt(A_SITE)] }], "empty.dem");
    const hits = aggregateSeriesGroupHits(series, { side: "CT", kind: "pistol" }, null);
    expect(hits.entries).toEqual([]);
    expect(hits.roundCount).toBe(1);
    expect(hits.sampleCount).toBe(0);
  });
});
