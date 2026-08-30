import { describe, expect, it } from "vitest";
import {
  computeStats,
  currentSide,
  defuseClock,
  formatAdr,
  formatKast,
  formatScorecard,
  freezeRemaining,
  liveScore,
  liveTeams,
  matchScorecard,
  roundWinBanner,
  teamEntryShare,
  weaponBreakdown,
} from "./stats";
import { FULL_HEALTH } from "@/lib/shared/constants";
import { FLAG_CT, FLAG_PRESENT } from "@/lib/replay/replayTypes";
import {
  makeBombEvent,
  makeHurt,
  makeKill,
  makePlayer,
  makeReplay,
  makeRound,
  makeTicks,
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
});

describe("currentSide", () => {
  it("uses the last snapshot, not the previous frame", () => {
    const ticks = makeTicks(1, 2);
    ticks.ticks.set([100, 200]);
    ticks.flags.set([FLAG_PRESENT, FLAG_PRESENT | FLAG_CT]);
    ticks.health.fill(FULL_HEALTH);
    const m = makeReplay({
      players: [makePlayer(0, "T", "A")],
      rounds: [makeRound({ number: 1, winner: "T" })],
      ticks,
    });
    expect(currentSide(m, 0, 100)).toBe("T");
    expect(currentSide(m, 0, 200)).toBe("CT");
  });
});

describe("teamEntryShare", () => {
  it("is the player's share of opening duels on the starting side", () => {
    const players = [makePlayer(0, "CT", "A"), makePlayer(1, "T", "B"), makePlayer(2, "CT", "C")];
    const m = makeReplay({
      players,
      rounds: [
        makeRound({ number: 1, winner: "CT", start_tick: 0, freeze_end_tick: 64, end_tick: 640 }),
        makeRound({
          number: 2,
          winner: "T",
          start_tick: 641,
          freeze_end_tick: 705,
          end_tick: 1280,
        }),
      ],
      kills: [makeKill(100, 0, 1), makeKill(800, 1, 2)],
    });
    const stats = computeStats(m, 1280);
    expect(teamEntryShare(stats, players, 0)).toEqual({
      attempts: 1,
      teamAttempts: 2,
      pct: 50,
    });
    expect(teamEntryShare(stats, players, 2).pct).toBe(50);
    expect(teamEntryShare(stats, players, 1).pct).toBe(100);
  });
});

describe("liveScore", () => {
  it("attributes overtime side-swap wins to the starting teams", () => {
    const m = makeReplay({
      players: [makePlayer(0, "CT", "A"), makePlayer(1, "T", "B")],
      rounds: [
        makeRound({ number: 12, winner: "CT", start_tick: 0, freeze_end_tick: 64, end_tick: 200 }),
        makeRound({
          number: 13,
          winner: "CT",
          start_tick: 201,
          freeze_end_tick: 250,
          end_tick: 400,
        }),
      ],
    });
    expect(liveScore(m, 200)).toEqual({ ct: 1, t: 0 });
    // Round 13 is swapped (MR12 halftime); a CT-side win belongs to the team that started T.
    expect(liveScore(m, 400)).toEqual({ ct: 1, t: 1 });
  });
});

describe("matchScorecard", () => {
  it("splits starting-team wins by half and OT", () => {
    const m = makeReplay({
      header: { team_ct: "EYEBALLERS", team_t: "Phantom" },
      players: [makePlayer(0, "CT", "A"), makePlayer(1, "T", "B")],
      rounds: [
        makeRound({ number: 1, winner: "CT", start_tick: 0, freeze_end_tick: 10, end_tick: 100 }),
        makeRound({
          number: 12,
          winner: "T",
          start_tick: 101,
          freeze_end_tick: 110,
          end_tick: 200,
        }),
        makeRound({
          number: 13,
          winner: "CT",
          start_tick: 201,
          freeze_end_tick: 210,
          end_tick: 300,
        }),
        makeRound({
          number: 24,
          winner: "T",
          start_tick: 301,
          freeze_end_tick: 310,
          end_tick: 400,
        }),
        makeRound({
          number: 25,
          winner: "CT",
          start_tick: 401,
          freeze_end_tick: 410,
          end_tick: 500,
        }),
      ],
    });
    const card = matchScorecard(m, 500);
    expect(card).toMatchObject({
      teamA: "EYEBALLERS",
      teamB: "Phantom",
      scoreA: 3,
      scoreB: 2,
      firstHalf: { a: 1, b: 1, ct: 1, t: 1 },
      secondHalf: { a: 1, b: 1, ct: 1, t: 1 },
      overtime: { a: 1, b: 0, ct: 1, t: 0 },
    });
    expect(formatScorecard(card)).toBe("EYEBALLERS - Phantom, 3:2 (1:1, 1:1, OT 1:0)");
  });

  it("omits empty halves and knife rounds", () => {
    const m = makeReplay({
      header: { team_ct: "Astralis", team_t: "Vitality" },
      players: [makePlayer(0, "CT", "A"), makePlayer(1, "T", "B")],
      rounds: [
        makeRound({
          number: 0,
          is_knife: true,
          winner: "CT",
          start_tick: 0,
          freeze_end_tick: 10,
          end_tick: 50,
        }),
        makeRound({ number: 1, winner: "CT", start_tick: 51, freeze_end_tick: 60, end_tick: 200 }),
        makeRound({ number: 2, winner: "T", start_tick: 201, freeze_end_tick: 210, end_tick: 300 }),
      ],
    });
    const card = matchScorecard(m, 300);
    expect(card.scoreA).toBe(1);
    expect(card.scoreB).toBe(1);
    expect(card.firstHalf).toEqual({ a: 1, b: 1, ct: 1, t: 1 });
    expect(card.secondHalf).toBeNull();
    expect(card.overtime).toBeNull();
    expect(formatScorecard(card)).toBe("Astralis - Vitality, 1:1 (1:1)");
  });

  it("tracks CT/T side wins separately from starting-team slots", () => {
    const m = makeReplay({
      header: { team_ct: "Astralis", team_t: "Vitality" },
      players: [makePlayer(0, "CT", "A"), makePlayer(1, "T", "B")],
      rounds: [
        makeRound({
          number: 13,
          winner: "CT",
          start_tick: 201,
          freeze_end_tick: 210,
          end_tick: 300,
        }),
      ],
    });
    const card = matchScorecard(m, 300);
    expect(card.secondHalf).toEqual({ a: 0, b: 1, ct: 1, t: 0 });
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

describe("weaponBreakdown", () => {
  const m = makeReplay({
    players: [makePlayer(0, "CT", "A"), makePlayer(1, "T", "B")],
    rounds: [
      makeRound({ number: 1, winner: "CT", start_tick: 0, freeze_end_tick: 64, end_tick: 2000 }),
    ],
    kills: [
      makeKill(200, 0, 1, { weapon: "ak47", headshot: true }),
      makeKill(400, 1, 0, { weapon: "deagle" }),
    ],
    hurts: [makeHurt(200, 0, 1, 100, { weapon: "ak47" })],
  });

  it("tallies kills, headshots and damage per weapon, best first", () => {
    const rows = weaponBreakdown(m, 2000, null);
    expect(rows.map((r) => r.raw)).toEqual(["ak47", "deagle"]);
    expect(rows[0]).toMatchObject({ kills: 1, headshots: 1, damage: 100 });
  });

  it("narrows to one player when asked", () => {
    expect(weaponBreakdown(m, 2000, 0).map((r) => r.raw)).toEqual(["ak47"]);
  });

  it("caches per replay, whole tick and player", () => {
    const rows = weaponBreakdown(m, 2000, null);
    expect(weaponBreakdown(m, 2000.9, null)).toBe(rows);
    expect(weaponBreakdown(m, 2000, 0)).not.toBe(rows);
  });
});

describe("liveTeams", () => {
  const m = makeReplay({
    header: { team_ct: "Astralis", team_t: "Vitality" },
    rounds: [makeRound({ number: 1, winner: "CT", start_tick: 0, end_tick: 640 })],
  });

  it("names the sides currently playing CT and T", () => {
    expect(liveTeams(m, 640)).toMatchObject({ ctName: "Astralis", tName: "Vitality", ct: 1, t: 0 });
  });

  it("caches per replay and whole tick", () => {
    const teams = liveTeams(m, 640);
    expect(liveTeams(m, 640.5)).toBe(teams);
  });
});

describe("formatAdr / formatKast", () => {
  it("formats ADR with two decimals and KAST with one plus percent", () => {
    expect(formatAdr(77.123)).toBe("77.12");
    expect(formatKast(77.12)).toBe("77.1%");
  });
});
