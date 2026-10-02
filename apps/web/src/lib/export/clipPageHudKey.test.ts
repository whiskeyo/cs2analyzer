import { describe, expect, it } from "vitest";
import {
  clipHudPanelsToRaster,
  clipPageHudKey,
  clipPageStage,
  clipRoundClockLabel,
} from "@/lib/export/clipPageHudKey";
import { FLAG_ALIVE, FLAG_CT, FLAG_PRESENT } from "@/lib/replay/replayTypes";
import { BOMB_SECONDS, ROUND_TIME_DEFUSE_S, SIDEBAR_DEFAULT_WIDTH } from "@/lib/shared/constants";
import {
  makeBombEvent,
  makePlayer,
  makeReplay,
  makeRound,
  makeTicks,
} from "@/lib/testing/fixtures";

const RATE = 64;

function roster(frames: Array<{ tick: number; health: number; x: number; alive?: boolean }>) {
  const players = 2;
  const buf = makeTicks(players, frames.length);
  frames.forEach((frame, index) => {
    buf.ticks[index] = frame.tick;
    for (let player = 0; player < players; player++) {
      const slot = index * players + player;
      const alive = frame.alive !== false;
      buf.flags[slot] = FLAG_PRESENT | (alive ? FLAG_ALIVE : 0) | (player === 0 ? FLAG_CT : 0);
      buf.health[slot] = frame.health;
      buf.money[slot] = 800;
      buf.x[slot] = player === 0 ? frame.x : 10;
    }
  });
  return buf;
}

function playing(partial: Parameters<typeof makeReplay>[0] = {}) {
  return makeReplay({
    players: [makePlayer(0, "CT", "A"), makePlayer(1, "T", "B")],
    rounds: [makeRound({ number: 3, start_tick: 0, freeze_end_tick: 64, end_tick: 20000 })],
    ticks: roster([{ tick: 64, health: 100, x: 1 }]),
    ...partial,
  });
}

describe("clipRoundClockLabel", () => {
  it("uses round_time_s and falls back when it is 0", () => {
    const full = playing();
    expect(clipRoundClockLabel(full, 64)).toBe("1:55");
    expect(clipRoundClockLabel(full, 64 + 10 * RATE)).toBe("1:45");
    expect(clipRoundClockLabel(full, 64 + ROUND_TIME_DEFUSE_S * RATE)).toBe("0:00");

    const short = playing({
      rounds: [
        makeRound({
          number: 3,
          start_tick: 0,
          freeze_end_tick: 64,
          end_tick: 20000,
          round_time_s: 90,
        }),
      ],
    });
    expect(clipRoundClockLabel(short, 64)).toBe("1:30");
    expect(short.rounds[0]?.round_time_s ?? 0).toBe(90);
  });
});

describe("clipPageHudKey", () => {
  it("ignores pawn position and rasters only the panels that changed", () => {
    const replay = playing({
      ticks: roster([
        { tick: 100, health: 100, x: 1 },
        { tick: 110, health: 100, x: 80 },
        { tick: 120, health: 40, x: 80 },
      ]),
    });
    const at100 = clipPageHudKey(replay, 100, null);
    const at110 = clipPageHudKey(replay, 110, null);
    expect(at110).toEqual(at100);
    expect(clipHudPanelsToRaster(at100, at110)).toEqual([]);

    const hurt = clipPageHudKey(replay, 120, null);
    expect(clipHudPanelsToRaster(at110, hurt)).toEqual(["economy", "scoreboard"]);
    expect(hurt.hud).toBe(at110.hud);
  });

  it("changes the HUD key on a kill tick, not when only the round clock would move", () => {
    const replay = playing({
      ticks: roster([
        { tick: 64, health: 100, x: 0 },
        { tick: 64 + RATE, health: 100, x: 5 },
        { tick: 200, health: 0, x: 5, alive: false },
      ]),
    });
    const freezeEnd = clipPageHudKey(replay, 64, null);
    const oneSecond = clipPageHudKey(replay, 64 + RATE, null);
    expect(clipHudPanelsToRaster(freezeEnd, oneSecond)).toEqual([]);
    expect(oneSecond.hud).toBe(freezeEnd.hud);

    const dead = clipPageHudKey(replay, 200, null);
    expect(clipHudPanelsToRaster(oneSecond, dead)).toEqual(["hud", "economy", "scoreboard"]);
    expect(dead.hud).not.toBe(oneSecond.hud);
  });

  it("keeps the bomb tenth on the HUD key until the label changes", () => {
    const plant = 200;
    const replay = playing({
      bombEvents: [makeBombEvent({ tick: plant, kind: "planted" })],
      ticks: roster([{ tick: plant, health: 100, x: 0 }]),
    });
    const planted = clipPageHudKey(replay, plant, null);
    const sameTenth = clipPageHudKey(replay, plant + 3, null);
    const nextTenth = clipPageHudKey(replay, plant + Math.ceil(0.1 * RATE), null);
    expect(clipHudPanelsToRaster(planted, sameTenth)).toEqual([]);
    expect(clipHudPanelsToRaster(planted, nextTenth)).toEqual(["hud"]);
    expect(nextTenth.economy).toBe(planted.economy);
    expect(BOMB_SECONDS).toBeGreaterThan(0);
  });

  it("includes the selected player on the economy and scoreboard only", () => {
    const replay = playing();
    const none = clipPageHudKey(replay, 64, null);
    const picked = clipPageHudKey(replay, 64, 1);
    expect(clipHudPanelsToRaster(none, picked)).toEqual(["economy", "scoreboard"]);
    expect(picked.hud).toBe(none.hud);
  });

  it("leaves the page HUD key alone when only the round length changes", () => {
    const standard = playing();
    const wingman = playing({
      rounds: [
        makeRound({
          number: 3,
          start_tick: 0,
          freeze_end_tick: 64,
          end_tick: 20000,
          round_time_s: 90,
        }),
      ],
    });
    const full = clipPageHudKey(standard, 64, null);
    const short = clipPageHudKey(wingman, 64, null);
    expect(short.hud).toBe(full.hud);
    expect(short.economy).toBe(full.economy);
    expect(short.scoreboard).toBe(full.scoreboard);
  });
});

describe("clipPageStage", () => {
  it("keeps the analyzer sidebar and gives the radar the rest of the frame", () => {
    expect(clipPageStage(1920, 1080)).toEqual({
      x: 0,
      y: 0,
      width: 1920 - SIDEBAR_DEFAULT_WIDTH,
      height: 1080,
      sidebar: SIDEBAR_DEFAULT_WIDTH,
    });
    expect(clipPageStage(2560, 1440).sidebar).toBe(SIDEBAR_DEFAULT_WIDTH);
    expect(clipPageStage(2560, 1440).width).toBe(2560 - SIDEBAR_DEFAULT_WIDTH);
  });
});

describe("clipHudPanelsToRaster", () => {
  it("rasters every panel when there is no previous key", () => {
    const key = clipPageHudKey(playing(), 64, null);
    expect(clipHudPanelsToRaster(null, key)).toEqual(["hud", "economy", "scoreboard"]);
  });
});
