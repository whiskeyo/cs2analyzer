import { describe, expect, it } from "vitest";
import { bombView, freezeRemaining, plantClock, roundTimeRemaining, roundWinBanner } from "./hud";
import {
  makeBombEvent,
  makeFreezeTicks,
  makePlayer,
  makeReplay,
  makeRound,
  makeTicks,
} from "@/lib/testing/fixtures";
import { BOMB_SECONDS, PLANT_SECONDS, ROUND_TIME_DEFUSE_S } from "@/lib/shared/constants";
import { FLAG_ALIVE, FLAG_PLANTING, FLAG_PRESENT, GEAR_C4 } from "@/lib/replay/replayTypes";

describe("roundTimeRemaining", () => {
  it("counts down from the competitive defuse clock and stays at 0", () => {
    expect(roundTimeRemaining(0)).toBe(ROUND_TIME_DEFUSE_S);
    expect(roundTimeRemaining(10)).toBe(105);
    expect(roundTimeRemaining(ROUND_TIME_DEFUSE_S)).toBe(0);
    expect(roundTimeRemaining(ROUND_TIME_DEFUSE_S + 20)).toBe(0);
    expect(roundTimeRemaining(-5)).toBe(ROUND_TIME_DEFUSE_S);
  });

  it("uses a parsed round length and falls back when it is missing", () => {
    expect(roundTimeRemaining(0, 90)).toBe(90);
    expect(roundTimeRemaining(10, 90)).toBe(80);
    expect(roundTimeRemaining(90, 90)).toBe(0);
    expect(roundTimeRemaining(0, 0)).toBe(ROUND_TIME_DEFUSE_S);
  });
});

describe("freezeRemaining", () => {
  it("counts down until freeze_end_tick", () => {
    const m = makeReplay({
      players: [makePlayer(0, "CT", "A")],
      rounds: [
        makeRound({ number: 1, winner: "CT", start_tick: 0, freeze_end_tick: 64, end_tick: 640 }),
      ],
    });
    expect(freezeRemaining(m, 0)).toBe(1);
    expect(freezeRemaining(m, 32)).toBe(0.5);
    expect(freezeRemaining(m, 64)).toBeNull();
  });
});

describe("roundWinBanner", () => {
  it("shows the winner after end_tick", () => {
    const m = makeReplay({
      players: [makePlayer(0, "CT", "A")],
      rounds: [
        makeRound({
          number: 1,
          winner: "CT",
          start_tick: 0,
          freeze_end_tick: 64,
          end_tick: 640,
          win_reason: 8,
        }),
      ],
    });
    expect(roundWinBanner(m, 639)).toBeNull();
    expect(roundWinBanner(m, 640)).toEqual({ winner: "CT", reason: 8 });
  });

  it("keeps the previous winner on screen during the next freeze", () => {
    const m = makeReplay({
      players: [makePlayer(0, "CT", "A")],
      rounds: [
        makeRound({
          number: 1,
          winner: "T",
          start_tick: 0,
          freeze_end_tick: 64,
          end_tick: 200,
          win_reason: 1,
        }),
        makeRound({
          number: 2,
          winner: null,
          start_tick: 201,
          freeze_end_tick: 265,
          end_tick: 800,
          win_reason: 0,
        }),
      ],
    });
    expect(roundWinBanner(m, 210)).toEqual({ winner: "T", reason: 1 });
    expect(roundWinBanner(m, 265)).toBeNull();
  });
});

describe("plantClock", () => {
  it("counts a 3.2s plant after begin_plant", () => {
    const m = makeReplay({
      players: [makePlayer(0, "T", "A")],
      rounds: [
        makeRound({ number: 1, winner: "T", start_tick: 0, freeze_end_tick: 64, end_tick: 2000 }),
      ],
      bombEvents: [makeBombEvent({ tick: 200, kind: "begin_plant", player: 0 })],
    });
    expect(plantClock(m, 199)).toBeNull();
    expect(plantClock(m, 200)?.remaining).toBeCloseTo(PLANT_SECONDS, 5);
    expect(plantClock(m, 200 + 64)?.remaining).toBeCloseTo(PLANT_SECONDS - 1, 5);
  });

  it("clears when the bomb is planted or the clock expires", () => {
    const m = makeReplay({
      players: [makePlayer(0, "T", "A")],
      rounds: [
        makeRound({ number: 1, winner: "T", start_tick: 0, freeze_end_tick: 64, end_tick: 2000 }),
      ],
      bombEvents: [
        makeBombEvent({ tick: 200, kind: "begin_plant", player: 0 }),
        makeBombEvent({ tick: 200 + Math.round(PLANT_SECONDS * 64), kind: "planted", player: 0 }),
      ],
    });
    const plantTick = 200 + Math.round(PLANT_SECONDS * 64);
    expect(plantClock(m, plantTick - 1)?.remaining).toBeGreaterThan(0);
    expect(plantClock(m, plantTick)).toBeNull();
  });

  it("starts from FLAG_PLANTING when GOTV has no begin_plant", () => {
    const ticks = makeTicks(1, 2);
    ticks.ticks[0] = 64;
    ticks.ticks[1] = 200;
    ticks.flags[0] = FLAG_PRESENT | FLAG_ALIVE;
    ticks.flags[1] = FLAG_PRESENT | FLAG_ALIVE | FLAG_PLANTING;
    const m = makeReplay({
      players: [makePlayer(0, "T", "A")],
      rounds: [
        makeRound({ number: 1, winner: "T", start_tick: 0, freeze_end_tick: 64, end_tick: 2000 }),
      ],
      ticks,
    });
    expect(plantClock(m, 199)).toBeNull();
    expect(plantClock(m, 200)?.remaining).toBeCloseTo(PLANT_SECONDS, 5);
  });
});

describe("bombView", () => {
  it("is planted while the fuse is running", () => {
    const m = makeReplay({
      players: [makePlayer(0, "CT", "A"), makePlayer(1, "T", "B")],
      rounds: [
        makeRound({ number: 1, winner: "T", start_tick: 0, freeze_end_tick: 64, end_tick: 4000 }),
      ],
      ticks: makeFreezeTicks(2, 1),
      bombEvents: [makeBombEvent({ tick: 200, kind: "planted", x: 120, y: 220, player: 1 })],
    });
    expect(bombView(m, 199)).toEqual({ state: "none" });
    expect(bombView(m, 200)).toEqual({
      state: "planted",
      remaining: BOMB_SECONDS,
      x: 120,
      y: 220,
    });
    expect(bombView(m, 200 + 64)).toEqual({
      state: "planted",
      remaining: BOMB_SECONDS - 1,
      x: 120,
      y: 220,
    });
  });

  it("is carried when a present pawn has GEAR_C4", () => {
    const ticks = makeFreezeTicks(2, 1);
    ticks.gear[1] = GEAR_C4;
    const m = makeReplay({
      players: [makePlayer(0, "CT", "A"), makePlayer(1, "T", "B")],
      rounds: [
        makeRound({ number: 1, winner: "T", start_tick: 0, freeze_end_tick: 64, end_tick: 4000 }),
      ],
      ticks,
    });
    expect(bombView(m, 64)).toEqual({ state: "carried", player: 1 });
  });

  it("is loose at the last drop until pickup or plant", () => {
    const m = makeReplay({
      players: [makePlayer(0, "CT", "A"), makePlayer(1, "T", "B")],
      rounds: [
        makeRound({ number: 1, winner: "T", start_tick: 0, freeze_end_tick: 64, end_tick: 4000 }),
      ],
      ticks: makeFreezeTicks(2, 1),
      bombEvents: [
        makeBombEvent({ tick: 200, kind: "dropped", x: 50, y: 60, player: 1 }),
        makeBombEvent({ tick: 400, kind: "pickup", player: 1 }),
      ],
    });
    expect(bombView(m, 200)).toEqual({ state: "loose", x: 50, y: 60 });
    expect(bombView(m, 400)).toEqual({ state: "none" });
  });
});
