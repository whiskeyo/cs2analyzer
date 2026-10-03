import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  clipHudPanelsToRaster,
  clipPageHudKey,
  clipPageStage,
  clipRoundClockLabel,
} from "@/lib/export/clipPageHudKey";
import { FLAG_ALIVE, FLAG_CT, FLAG_PRESENT } from "@/lib/replay/replayTypes";
import { BOMB_SECONDS, KILL_FEED_SECONDS, ROUND_TIME_DEFUSE_S } from "@/lib/shared/constants";
import {
  makeBombEvent,
  makeKill,
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
    expect(clipHudPanelsToRaster(at110, hurt)).toEqual(["economy"]);
    expect(hurt.hud).toBe(at110.hud);
  });

  it("changes the HUD key when the burned-in clock or a kill changes", () => {
    const replay = playing({
      ticks: roster([
        { tick: 64, health: 100, x: 0 },
        { tick: 64 + RATE, health: 100, x: 5 },
        { tick: 200, health: 0, x: 5, alive: false },
      ]),
    });
    const freezeEnd = clipPageHudKey(replay, 64, null);
    const oneSecond = clipPageHudKey(replay, 64 + RATE, null);
    expect(clipRoundClockLabel(replay, 64)).toBe("1:55");
    expect(clipRoundClockLabel(replay, 64 + RATE)).toBe("1:54");
    expect(clipHudPanelsToRaster(freezeEnd, oneSecond)).toEqual(["hud"]);
    expect(oneSecond.economy).toBe(freezeEnd.economy);

    const dead = clipPageHudKey(replay, 200, null);
    expect(clipHudPanelsToRaster(oneSecond, dead)).toEqual(["hud", "economy"]);
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

  it("includes the selected player on the economy only", () => {
    const replay = playing();
    const none = clipPageHudKey(replay, 64, null);
    const picked = clipPageHudKey(replay, 64, 1);
    expect(clipHudPanelsToRaster(none, picked)).toEqual(["economy"]);
    expect(picked.hud).toBe(none.hud);
  });

  it("changes the HUD key when the round length changes the clock", () => {
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
    expect(clipRoundClockLabel(standard, 64)).toBe("1:55");
    expect(clipRoundClockLabel(wingman, 64)).toBe("1:30");
    expect(short.hud).not.toBe(full.hud);
    expect(short.economy).toBe(full.economy);
  });

  it("holds the C4 label on the page HUD key after defuse or explosion", () => {
    const plant = 200;
    const defusedAt = plant + 15 * RATE;
    const live = makeRound({ number: 5, start_tick: 0, freeze_end_tick: 64, end_tick: 20000 });
    const nextStart = 22000;
    const nextFreeze = nextStart + 2 * RATE;
    const nextRound = makeRound({
      number: 6,
      start_tick: nextStart,
      freeze_end_tick: nextFreeze,
      end_tick: 40000,
    });
    const defused = playing({
      rounds: [live, nextRound],
      bombEvents: [
        makeBombEvent({ tick: plant, kind: "planted" }),
        makeBombEvent({ tick: defusedAt, kind: "defused" }),
      ],
    });
    expect(clipRoundClockLabel(defused, defusedAt)).toBe("C4 25.0");
    expect(clipRoundClockLabel(defused, defusedAt + 20 * RATE)).toBe("C4 25.0");
    expect(clipPageHudKey(defused, defusedAt, null).hud).toBe(
      clipPageHudKey(defused, defusedAt + 20 * RATE, null).hud,
    );
    expect(clipRoundClockLabel(defused, nextFreeze)).toBe("1:55");

    const exploded = playing({
      rounds: [live, nextRound],
      bombEvents: [
        makeBombEvent({ tick: plant, kind: "planted" }),
        makeBombEvent({ tick: defusedAt, kind: "exploded" }),
      ],
    });
    expect(clipRoundClockLabel(exploded, defusedAt)).toBe("C4 0.0");
    expect(clipRoundClockLabel(exploded, defusedAt + 20 * RATE)).toBe("C4 0.0");
    expect(clipRoundClockLabel(exploded, nextFreeze)).toBe("1:55");

    const aborted = playing({
      rounds: [live],
      bombEvents: [
        makeBombEvent({ tick: plant, kind: "planted" }),
        makeBombEvent({ tick: plant + RATE, kind: "begin_defuse", haskit: false }),
        makeBombEvent({ tick: plant + RATE + 1, kind: "abort_defuse" }),
      ],
    });
    expect(clipRoundClockLabel(aborted, plant + 10 * RATE)).toBe("C4 30.0");
  });
});

describe("clip kill feed key", () => {
  it("rasters the feed when a visible row changes and not when the clock ticks", () => {
    const killAt = 200;
    const replay = playing({
      players: [makePlayer(0, "CT", "A"), makePlayer(1, "T", "B"), makePlayer(2, "T", "C")],
      kills: [makeKill(killAt, 0, 1, { assister: 2, assisted_flash: true })],
      ticks: roster([
        { tick: killAt - 1, health: 100, x: 0 },
        { tick: killAt, health: 100, x: 0 },
        { tick: killAt + RATE, health: 100, x: 1 },
        { tick: killAt + (KILL_FEED_SECONDS + 1) * RATE, health: 100, x: 2 },
      ]),
    });
    const before = clipPageHudKey(replay, killAt - 1, null);
    const atKill = clipPageHudKey(replay, killAt, null);
    expect(before.feed).toBe("");
    expect(atKill.feed).not.toBe("");
    expect(clipHudPanelsToRaster(before, atKill)).toEqual(["feed"]);

    const oneSecond = clipPageHudKey(replay, killAt + RATE, null);
    expect(oneSecond.feed).toBe(atKill.feed);
    expect(clipHudPanelsToRaster(atKill, oneSecond)).toEqual(["hud"]);

    const expired = clipPageHudKey(replay, killAt + (KILL_FEED_SECONDS + 1) * RATE, null);
    expect(expired.feed).toBe("");
    expect(clipHudPanelsToRaster(atKill, expired)).toContain("feed");

    const flashed = playing({
      kills: [makeKill(killAt, 0, 1, { assister: 2, assisted_flash: false })],
    });
    expect(clipPageHudKey(flashed, killAt, null).feed).not.toBe(atKill.feed);
  });
});

describe("clipPageStage", () => {
  it("gives the radar the full 16:9 frame", () => {
    expect(clipPageStage(1920, 1080)).toEqual({
      x: 0,
      y: 0,
      width: 1920,
      height: 1080,
    });
    expect(clipPageStage(2560, 1440)).toEqual({
      x: 0,
      y: 0,
      width: 2560,
      height: 1440,
    });
    expect(clipPageStage(0, 1080).width).toBe(0);
  });
});

/** `.spec-eco` width and inset. The score band has to stay out of that strip. */
const SPEC_COLUMN_WIDTH = 216;
const SPEC_COLUMN_INSET = 8;

function clipHudPanelClearsColumns(frameWidth: number, panelWidth: number): boolean {
  const gutter = SPEC_COLUMN_INSET + SPEC_COLUMN_WIDTH;
  const left = (frameWidth - panelWidth) / 2;
  return left >= gutter && left + panelWidth <= frameWidth - gutter;
}

describe("clip HUD panel", () => {
  it("stays between the team columns so the first player name stays visible", () => {
    const cssPath = resolve(dirname(fileURLToPath(import.meta.url)), "../../index.css");
    const css = readFileSync(cssPath, "utf8");
    const start = css.indexOf(".clip-page-hud-panel {");
    const end = css.indexOf(".clip-page-host .radar-hud");
    const block = css.slice(start, end);
    expect(block).toContain("left: 50%");
    expect(block).toContain("width: max-content");
    expect(block).toContain("translateX(-50%)");
    expect(block).toContain("max-width: calc(100% - 2 * (216px + 8px))");
    expect(block).not.toMatch(/right:\s*0/);
    expect(clipHudPanelClearsColumns(1920, 1920)).toBe(false);
    const maxPanel = 1920 - 2 * (SPEC_COLUMN_INSET + SPEC_COLUMN_WIDTH);
    expect(clipHudPanelClearsColumns(1920, maxPanel)).toBe(true);
    expect(clipHudPanelClearsColumns(1920, 480)).toBe(true);
  });
});

describe("clipHudPanelsToRaster", () => {
  it("rasters every panel when there is no previous key", () => {
    const key = clipPageHudKey(playing(), 64, null);
    expect(clipHudPanelsToRaster(null, key)).toEqual(["hud", "economy", "feed"]);
  });
});
