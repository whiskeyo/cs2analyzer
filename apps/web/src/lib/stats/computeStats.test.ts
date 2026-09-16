import { describe, expect, it } from "vitest";
import { computeStats } from "./computeStats";
import { matchRating } from "./rating";
import {
  makeBlind,
  makeBombEvent,
  makeFreezeTicks,
  makeGrenade,
  makeHurt,
  makeKill,
  makePlayer,
  makeReplay,
  makeRound,
} from "@/lib/testing/fixtures";

describe("computeStats", () => {
  it("caps ADR at remaining HP and ignores overkill", () => {
    const m = makeReplay({
      players: [makePlayer(0, "CT", "A"), makePlayer(1, "T", "B")],
      rounds: [makeRound({ number: 1, winner: "CT" })],
      kills: [makeKill(100, 0, 1)],
      hurts: [makeHurt(90, 0, 1, 110)],
    });
    const stats = computeStats(m, 640);
    expect(stats[0].kills).toBe(1);
    expect(stats[1].deaths).toBe(1);
    expect(stats[0].adr).toBe(100);
  });

  it("does not treat the killer's next frag as a trade", () => {
    const m = makeReplay({
      players: [makePlayer(0, "CT", "A"), makePlayer(1, "T", "B"), makePlayer(2, "CT", "C")],
      rounds: [makeRound({ number: 1, winner: "CT" })],
      kills: [makeKill(100, 1, 0), makeKill(120, 1, 2)],
    });
    const stats = computeStats(m, 640);
    expect(stats[0].kast_rounds).toBe(0);
    expect(stats[1].trade_kills).toBe(0);
    expect(stats[2].trade_kills).toBe(0);
  });

  it("counts a teammate killing the attacker as a trade", () => {
    const m = makeReplay({
      players: [makePlayer(0, "CT", "A"), makePlayer(1, "T", "B"), makePlayer(2, "CT", "C")],
      rounds: [makeRound({ number: 1, winner: "CT" })],
      kills: [makeKill(100, 1, 0), makeKill(120, 2, 1)],
    });
    const stats = computeStats(m, 640);
    expect(stats[0].kast_rounds).toBe(1);
    expect(stats[2].trade_kills).toBe(1);
    expect(stats[0].trade_deaths).toBe(1);
  });

  it("omits suicides from kills and deaths", () => {
    const m = makeReplay({
      players: [makePlayer(0, "CT", "A"), makePlayer(1, "T", "B")],
      rounds: [makeRound({ number: 1, winner: "CT" })],
      kills: [makeKill(100, 0, 0), makeKill(200, 0, 1)],
    });
    const stats = computeStats(m, 640);
    expect(stats[0].kills).toBe(1);
    expect(stats[0].deaths).toBe(0);
    expect(stats[1].deaths).toBe(1);
  });

  it("omits world / trigger_hurt deaths from kills and deaths", () => {
    const m = makeReplay({
      players: [makePlayer(0, "CT", "A"), makePlayer(1, "T", "B")],
      rounds: [makeRound({ number: 1, winner: "CT" })],
      kills: [makeKill(100, -1, 0, { weapon: "world" }), makeKill(200, 0, 1)],
    });
    const stats = computeStats(m, 640);
    expect(stats[0].kills).toBe(1);
    expect(stats[0].deaths).toBe(0);
    expect(stats[1].deaths).toBe(1);
  });

  it("does not credit teamkills and skips them as the opening duel", () => {
    const m = makeReplay({
      players: [makePlayer(0, "CT", "A"), makePlayer(1, "T", "B"), makePlayer(2, "CT", "C")],
      rounds: [makeRound({ number: 1, winner: "CT" })],
      kills: [makeKill(100, 0, 2), makeKill(200, 0, 1)],
    });
    const stats = computeStats(m, 640);
    expect(stats[0].kills).toBe(1);
    expect(stats[2].deaths).toBe(1);
    expect(stats[0].first_kills).toBe(1);
    expect(stats[1].first_deaths).toBe(1);
    expect(stats[2].first_deaths).toBe(0);
  });

  it("reports entry success from the opening duel", () => {
    const m = makeReplay({
      players: [makePlayer(0, "CT", "A"), makePlayer(1, "T", "B")],
      rounds: [makeRound({ number: 1, winner: "CT" })],
      kills: [makeKill(100, 0, 1)],
    });
    const stats = computeStats(m, 640);
    expect(stats[0].entry_attempts).toBe(1);
    expect(stats[0].entry_success).toBe(100);
    expect(stats[1].entry_attempts).toBe(1);
    expect(stats[1].entry_success).toBe(0);
  });

  it("splits kills and ADR by the side the player was on", () => {
    const m = makeReplay({
      players: [makePlayer(0, "CT", "A"), makePlayer(1, "T", "B")],
      rounds: [makeRound({ number: 1, winner: "CT" })],
      kills: [makeKill(100, 0, 1)],
      hurts: [makeHurt(90, 0, 1, 40)],
    });
    const stats = computeStats(m, 640);
    expect(stats[0].kills_ct).toBe(1);
    expect(stats[0].kills_t).toBe(0);
    expect(stats[0].adr_ct).toBe(40);
    expect(stats[0].adr_t).toBe(0);
    expect(stats[1].deaths_t).toBe(1);
    expect(stats[1].deaths_ct).toBe(0);
  });

  it("ignores same-side assists", () => {
    const m = makeReplay({
      players: [makePlayer(0, "CT", "A"), makePlayer(1, "T", "B")],
      rounds: [makeRound({ number: 1, winner: "CT" })],
      kills: [makeKill(100, 0, 1, { assister: 1 })],
    });
    const stats = computeStats(m, 640);
    expect(stats[1].assists).toBe(0);
  });

  it("does not add friendly-fire to ADR", () => {
    const m = makeReplay({
      players: [makePlayer(0, "CT", "A"), makePlayer(1, "T", "B"), makePlayer(2, "CT", "C")],
      rounds: [makeRound({ number: 1, winner: "CT" })],
      hurts: [makeHurt(90, 0, 2, 50), makeHurt(95, 0, 1, 40)],
    });
    const stats = computeStats(m, 640);
    expect(stats[0].adr).toBe(40);
  });

  it("credits flash assists and enemy blinds", () => {
    const m = makeReplay({
      players: [makePlayer(0, "CT", "A"), makePlayer(1, "T", "B"), makePlayer(2, "CT", "C")],
      rounds: [makeRound({ number: 1, winner: "CT" })],
      kills: [makeKill(100, 0, 1, { assister: 2, assisted_flash: true })],
      blinds: [makeBlind(90, 0, 1, 2.5)],
    });
    const stats = computeStats(m, 640);
    expect(stats[2].flash_assists).toBe(1);
    expect(stats[0].enemies_flashed).toBe(1);
    expect(stats[0].flash_time).toBeCloseTo(2.5);
  });

  it("counts utility damage, grenades, and bomb plants", () => {
    const m = makeReplay({
      players: [makePlayer(0, "CT", "A"), makePlayer(1, "T", "B")],
      rounds: [makeRound({ number: 1, winner: "CT" })],
      hurts: [makeHurt(90, 0, 1, 30, { weapon: "hegrenade" })],
      grenades: [makeGrenade({ kind: "smoke", thrower: 0 })],
      bombEvents: [makeBombEvent({ tick: 200, kind: "planted", player: 1 })],
      kills: [makeKill(250, 0, 1, { weapon: "hegrenade" })],
    });
    const stats = computeStats(m, 640);
    expect(stats[0].utility_damage).toBe(30);
    expect(stats[0].nades).toBe(1);
    expect(stats[0].he_kills).toBe(1);
    expect(stats[1].plants).toBe(1);
  });

  it("records defuses and multi-kill rounds", () => {
    const m = makeReplay({
      players: [makePlayer(0, "CT", "A"), makePlayer(1, "T", "B"), makePlayer(2, "T", "C")],
      rounds: [makeRound({ number: 1, winner: "CT" })],
      kills: [makeKill(100, 0, 1), makeKill(110, 0, 2), makeKill(120, 2, 0)],
      bombEvents: [makeBombEvent({ tick: 300, kind: "defused", player: 0 })],
    });
    const stats = computeStats(m, 640);
    expect(stats[0].defuses).toBe(1);
    expect(stats[0].multi_kills_2).toBe(1);
  });

  it("tracks clutch wins and attempts for 1v1 and 1v3 situations", () => {
    const m1 = makeReplay({
      players: [makePlayer(0, "CT", "A"), makePlayer(1, "T", "B")],
      rounds: [makeRound({ number: 1, winner: "CT", start_tick: 0, freeze_end_tick: 64 })],
      ticks: makeFreezeTicks(2, 1, 64),
      kills: [],
    });
    const s1 = computeStats(m1, 640)[0];
    expect(s1.clutch_1v1).toBe(1);
    expect(s1.clutch_1v1_attempts).toBe(1);

    const m3 = makeReplay({
      players: [
        makePlayer(0, "CT", "A"),
        makePlayer(1, "T", "B"),
        makePlayer(2, "T", "C"),
        makePlayer(3, "T", "D"),
      ],
      rounds: [makeRound({ number: 1, winner: "CT", start_tick: 0, freeze_end_tick: 64 })],
      ticks: makeFreezeTicks(4, 1, 64),
      kills: [],
    });
    const s3 = computeStats(m3, 640)[0];
    expect(s3.clutch_1v3).toBe(1);
    expect(s3.clutch_1v3_attempts).toBe(1);
  });

  it("counts a lost 1v2 as an attempt without a win", () => {
    const m = makeReplay({
      players: [makePlayer(0, "CT", "A"), makePlayer(1, "T", "B"), makePlayer(2, "T", "C")],
      rounds: [makeRound({ number: 1, winner: "T", start_tick: 0, freeze_end_tick: 64 })],
      ticks: makeFreezeTicks(3, 1, 64),
      kills: [makeKill(200, 1, 0)],
    });
    const s = computeStats(m, 640)[0];
    expect(s.clutch_1v2).toBe(0);
    expect(s.clutch_1v2_attempts).toBe(1);
    expect(s.clutch_wins).toBe(0);
    expect(s.clutch_attempts).toBe(1);
  });

  it("assigns a 1.00-floor match rating from live board stats", () => {
    const m = makeReplay({
      players: [makePlayer(0, "CT", "A"), makePlayer(1, "T", "B")],
      rounds: [makeRound({ number: 1, winner: "CT" })],
      kills: [makeKill(100, 0, 1)],
    });
    const stats = computeStats(m, 640);
    expect(stats[0].rating).toBeGreaterThanOrEqual(1);
    expect(stats[0].rating).toBe(matchRating(stats[0]).rating);
    expect(stats[0].rating_firepower).not.toBe(0);
  });

  it("reuses cached stats for the same replay and tick", () => {
    const m = makeReplay({
      players: [makePlayer(0, "CT", "A"), makePlayer(1, "T", "B")],
      rounds: [makeRound({ number: 1, winner: "CT" })],
      kills: [makeKill(100, 0, 1)],
    });
    const first = computeStats(m, 640);
    first[0].kills = 999;
    const second = computeStats(m, 640);
    expect(second[0].kills).toBe(999);
  });

  it("counts triples, quads, and aces in one round", () => {
    const quad = makeReplay({
      players: [
        makePlayer(0, "CT", "A"),
        makePlayer(1, "T", "B"),
        makePlayer(2, "T", "C"),
        makePlayer(3, "T", "D"),
        makePlayer(4, "T", "E"),
      ],
      rounds: [makeRound({ number: 1, winner: "CT" })],
      kills: [makeKill(100, 0, 1), makeKill(110, 0, 2), makeKill(120, 0, 3), makeKill(130, 0, 4)],
    });
    expect(computeStats(quad, 640)[0].multi_kills_4).toBe(1);

    const ace = makeReplay({
      players: [
        makePlayer(0, "CT", "A"),
        makePlayer(1, "T", "B"),
        makePlayer(2, "T", "C"),
        makePlayer(3, "T", "D"),
        makePlayer(4, "T", "E"),
        makePlayer(5, "T", "F"),
      ],
      rounds: [makeRound({ number: 1, winner: "CT" })],
      kills: [
        makeKill(100, 0, 1),
        makeKill(110, 0, 2),
        makeKill(120, 0, 3),
        makeKill(130, 0, 4),
        makeKill(140, 0, 5),
      ],
    });
    expect(computeStats(ace, 640)[0].aces).toBe(1);
  });
});
