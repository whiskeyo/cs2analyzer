import { describe, expect, it } from "vitest";
import { defuseClock, freezeRemaining, plantClock, roundWinBanner } from "./hud";
import { makeBombEvent, makePlayer, makeReplay, makeRound } from "@/lib/testing/fixtures";
import { PLANT_SECONDS } from "@/lib/shared/constants";

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

describe("defuseClock", () => {
  it("counts a 5s kit defuse after plant", () => {
    const m = makeReplay({
      players: [makePlayer(0, "CT", "A")],
      rounds: [
        makeRound({ number: 1, winner: "CT", start_tick: 0, freeze_end_tick: 64, end_tick: 2000 }),
      ],
      bombEvents: [
        makeBombEvent({ tick: 100, kind: "planted" }),
        makeBombEvent({ tick: 200, kind: "begin_defuse", haskit: true, player: 0 }),
      ],
    });
    expect(defuseClock(m, 199)).toBeNull();
    expect(defuseClock(m, 200)?.remaining).toBeCloseTo(5, 5);
    expect(defuseClock(m, 200 + 64 * 2)?.remaining).toBeCloseTo(3, 5);
    expect(defuseClock(m, 200 + 64 * 2)?.haskit).toBe(true);
  });

  it("uses 10s without a kit and cancels on abort", () => {
    const m = makeReplay({
      players: [makePlayer(0, "CT", "A")],
      rounds: [
        makeRound({ number: 1, winner: "CT", start_tick: 0, freeze_end_tick: 64, end_tick: 2000 }),
      ],
      bombEvents: [
        makeBombEvent({ tick: 100, kind: "planted" }),
        makeBombEvent({ tick: 200, kind: "begin_defuse", haskit: false }),
        makeBombEvent({ tick: 300, kind: "abort_defuse" }),
      ],
    });
    expect(defuseClock(m, 264)?.remaining).toBeCloseTo(9, 5);
    expect(defuseClock(m, 300)).toBeNull();
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
});
