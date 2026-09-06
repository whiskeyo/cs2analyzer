import { describe, expect, it } from "vitest";
import { clampLeadInSec, eventsForRound, jumpBefore, roundClock } from "./roundEvents";
import type { BombEvent, GrenadeThrow, Round } from "@/lib/replay/replayTypes";
import {
  makeBombEvent,
  makeGrenade,
  makeKill,
  makePlayer,
  makeReplay,
  makeRound,
} from "@/lib/testing/fixtures";

/** Event lists need a long round: the fixtures run past the default 640. */
function round(partial: Partial<Round> & Pick<Round, "number" | "winner">): Round {
  return makeRound({ end_tick: 2000, win_reason: 9, ...partial });
}

function nade(start: number, thrower: number, kind: GrenadeThrow["kind"]): GrenadeThrow {
  return makeGrenade({
    thrower,
    kind,
    start_tick: start,
    detonate_tick: start + 40,
    end_tick: start + 80,
  });
}

const roster = [makePlayer(0, "T", "T1"), makePlayer(1, "CT", "CT1")];
const r1 = round({ number: 1, winner: "T", start_tick: 0, freeze_end_tick: 64, end_tick: 2000 });
const r2 = round({
  number: 2,
  winner: "CT",
  start_tick: 2001,
  freeze_end_tick: 2065,
  end_tick: 4000,
});

describe("eventsForRound", () => {
  it("lists kills and throws in this round, nades first when ticks tie", () => {
    const m = makeReplay({
      players: roster,
      rounds: [r1, r2],
      kills: [makeKill(500, 0, 1), makeKill(2500, 1, 0), makeKill(80, 1, 0)],
      grenades: [nade(500, 0, "smoke"), nade(2100, 1, "flash"), nade(120, 0, "he")],
    });
    const events = eventsForRound(m, r1);
    expect(events.map((e) => [e.kind, e.tick])).toEqual([
      ["kill", 80],
      ["nade", 120],
      ["nade", 500],
      ["kill", 500],
    ]);
  });

  it("lists begin-plant, plant and defuse, skipping pickup/drop/abort", () => {
    const bomb = (
      tick: number,
      kind: BombEvent["kind"],
      player: number,
      extra: Partial<BombEvent> = {},
    ): BombEvent => makeBombEvent({ tick, kind, player, ...extra });
    const m = makeReplay({
      players: roster,
      rounds: [r1, r2],
      kills: [makeKill(900, 0, 1)],
      grenades: [nade(900, 0, "smoke")],
      bombEvents: [
        bomb(700, "pickup", 0),
        bomb(750, "dropped", 0),
        bomb(780, "begin_plant", 0),
        bomb(800, "planted", 0),
        bomb(850, "begin_defuse", 1, { haskit: true }),
        bomb(860, "abort_defuse", 1),
        bomb(900, "defused", 1),
        bomb(2500, "planted", 0),
      ],
    });
    const events = eventsForRound(m, r1);
    expect(events.map((e) => [e.kind, e.tick, e.kind === "bomb" ? e.bomb : ""])).toEqual([
      ["bomb", 780, "begin_plant"],
      ["bomb", 800, "planted"],
      ["bomb", 850, "begin_defuse"],
      ["nade", 900, ""],
      ["bomb", 900, "defused"],
      ["kill", 900, ""],
    ]);
  });

  it("ignores events from other rounds", () => {
    const m = makeReplay({
      players: roster,
      rounds: [r1, r2],
      kills: [makeKill(2500, 1, 0)],
      grenades: [nade(2100, 1, "molotov")],
    });
    expect(eventsForRound(m, r1)).toEqual([]);
    expect(eventsForRound(m, r2).map((e) => e.kind)).toEqual(["nade", "kill"]);
  });
});

describe("jumpBefore", () => {
  const m = makeReplay({ players: roster, rounds: [r1] });

  it("rewinds 1.5s at 64 tick without leaving the round", () => {
    expect(jumpBefore(m, r1, 64 + 192, 1.5)).toBe(64 + 96);
    expect(jumpBefore(m, r1, 64 + 200, 1.5)).toBe(64 + 200 - 96);
  });

  it("does not rewind into freeze when the event is later", () => {
    expect(jumpBefore(m, r1, 80, 2)).toBe(64);
  });

  it("lands on the event when lead-in is zero", () => {
    expect(jumpBefore(m, r1, 500, 0)).toBe(500);
  });
});

describe("clampLeadInSec", () => {
  it("snaps to half seconds inside 0–5", () => {
    expect(clampLeadInSec(1.24)).toBe(1);
    expect(clampLeadInSec(1.26)).toBe(1.5);
    expect(clampLeadInSec(-3)).toBe(0);
    expect(clampLeadInSec(9)).toBe(5);
    expect(clampLeadInSec(Number.NaN)).toBe(1.5);
  });
});

describe("roundClock", () => {
  it("counts from freeze end", () => {
    expect(roundClock(r1, 64 + 128, 64)).toBe("0:02");
  });
});
