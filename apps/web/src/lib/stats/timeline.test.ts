import { describe, expect, it } from "vitest";
import { rounds as seriesRounds } from "@/lib/tutorial/multi-demo/matches/match-3/rounds";
import { hydrateTutorialReplay } from "@/lib/tutorial/single-demo/hydrate";
import { FLAG_ALIVE, FLAG_CT, FLAG_PRESENT, type Round } from "@/lib/replay/replayTypes";
import { WIN_REASON_DRAW } from "@/lib/shared/constants";
import {
  makeBlind,
  makeFreezeTicks,
  makeHurt,
  makeKill,
  makePlayer,
  makeReplay,
  makeRound,
} from "@/lib/testing/fixtures";
import { computeStats } from "./computeStats";
import { matchEndTick } from "./scorecard";
import {
  TIMELINE_GROUPS,
  formatTimelineValue,
  isRestartRound,
  plottedValue,
  statsTimeline,
  timelineRounds,
} from "./timeline";

describe("statsTimeline", () => {
  it("lists the requested chips that the parser can already support", () => {
    expect(TIMELINE_GROUPS.map((group) => group.label)).toEqual(["Frags", "Impact", "Utility"]);
    expect(TIMELINE_GROUPS.flatMap((group) => group.stats.map((stat) => stat.id))).toEqual([
      "kills",
      "hs",
      "adr",
      "opening",
      "kast",
      "util",
      "flashed",
    ]);
  });

  it("drops the knife round and ignores frags inside it", () => {
    const replay = makeReplay({
      players: [makePlayer(0, "CT", "A"), makePlayer(1, "T", "B")],
      rounds: [
        makeRound({
          number: 0,
          is_knife: true,
          start_tick: 0,
          freeze_end_tick: 10,
          end_tick: 100,
          winner: "T",
          score_ct: 0,
          score_t: 0,
        }),
        makeRound({
          number: 1,
          start_tick: 200,
          freeze_end_tick: 260,
          end_tick: 800,
          winner: "CT",
          score_ct: 0,
          score_t: 0,
        }),
      ],
      kills: [makeKill(50, 1, 0), makeKill(300, 0, 1, { headshot: true })],
    });
    const columns = statsTimeline(replay);
    expect(columns.map((column) => column.number)).toEqual([1]);
    expect(columns[0]?.rows[0]?.values.kills).toEqual({ round: 1, running: 1 });
    expect(columns[0]?.rows[1]?.values.kills.running).toBe(0);
    expect(columns[0]?.rows[0]?.values.hs).toEqual({ round: 100, running: 100 });
    expect(columns[0]?.rows[0]?.values.opening).toEqual({ round: 1, running: 1 });
  });

  it("drops a restarted round whose win did not change the next score", () => {
    const replay = makeReplay({
      players: [makePlayer(0, "CT", "A"), makePlayer(1, "T", "B")],
      rounds: [
        makeRound({
          number: 1,
          start_tick: 0,
          end_tick: 400,
          winner: "CT",
          score_ct: 0,
          score_t: 0,
        }),
        makeRound({
          number: 2,
          start_tick: 500,
          freeze_end_tick: 560,
          end_tick: 700,
          winner: "T",
          score_ct: 1,
          score_t: 0,
        }),
        makeRound({
          number: 3,
          start_tick: 800,
          freeze_end_tick: 860,
          end_tick: 1200,
          winner: "CT",
          score_ct: 1,
          score_t: 0,
        }),
      ],
      kills: [makeKill(200, 0, 1), makeKill(600, 1, 0), makeKill(900, 0, 1)],
      hurts: [makeHurt(580, 1, 0, 80, { weapon: "ak47" })],
      blinds: [makeBlind(590, 1, 0, 2)],
    });
    const columns = statsTimeline(replay);
    expect(columns.map((column) => column.number)).toEqual([1, 3]);
    const last = columns[1];
    const full = computeStats(replay, matchEndTick(replay));
    expect(last?.rows[0]?.values.kills.running).toBe(full[0]?.kills);
    expect(last?.rows[1]?.values.kills.running).toBe(full[1]?.kills);
    expect(last?.rows[1]?.values.adr.running).toBeCloseTo(full[1]?.adr ?? 0);
    expect(last?.rows[1]?.values.flashed.running).toBe(full[1]?.enemies_flashed);
  });

  it("drops an aborted round that never received a winner", () => {
    const replay = makeReplay({
      rounds: [
        makeRound({
          number: 4,
          start_tick: 0,
          end_tick: 300,
          winner: null,
          score_ct: 0,
          score_t: 0,
        }),
        makeRound({
          number: 4,
          start_tick: 400,
          end_tick: 900,
          winner: "CT",
          score_ct: 0,
          score_t: 0,
        }),
      ],
      kills: [makeKill(100, 0, 1), makeKill(500, 0, 1)],
    });
    expect(timelineRounds(replay).map((round) => round.start_tick)).toEqual([400]);
    const column = statsTimeline(replay)[0];
    const full = computeStats(replay, matchEndTick(replay));
    expect(column?.rows[0]?.values.kills.running).toBe(full[0]?.kills);
  });

  it("keeps a draw and the last unfinished round", () => {
    const replay = makeReplay({
      rounds: [
        makeRound({
          number: 1,
          start_tick: 0,
          end_tick: 400,
          winner: null,
          win_reason: WIN_REASON_DRAW,
          score_ct: 0,
          score_t: 0,
        }),
        makeRound({
          number: 2,
          start_tick: 500,
          end_tick: 900,
          winner: null,
          score_ct: 0,
          score_t: 0,
        }),
      ],
    });
    expect(isRestartRound(replay.rounds[0], replay.rounds[1], false)).toBe(false);
    expect(timelineRounds(replay).map((round) => round.number)).toEqual([1, 2]);
  });

  it("does not treat a halftime score swap as a restart", () => {
    const list = seriesRounds as Round[];
    const known = list.some((round) => round.score_ct !== 0 || round.score_t !== 0);
    const dropped = list.filter((round, index) => isRestartRound(round, list[index + 1], known));
    expect(dropped).toEqual([]);
    const half = list.find((round) => round.number === 12);
    const next = list.find((round) => round.number === 13);
    expect(half && next && isRestartRound(half, next, true)).toBe(false);
  });

  it("matches computeStats on a demo with no knife round and no restart", () => {
    const replay = makeReplay({
      players: [makePlayer(0, "CT", "A"), makePlayer(1, "T", "B"), makePlayer(2, "CT", "C")],
      rounds: [
        makeRound({
          number: 1,
          start_tick: 0,
          end_tick: 400,
          winner: "CT",
          score_ct: 0,
          score_t: 0,
        }),
        makeRound({
          number: 2,
          start_tick: 500,
          freeze_end_tick: 560,
          end_tick: 900,
          winner: "T",
          score_ct: 1,
          score_t: 0,
        }),
      ],
      kills: [makeKill(100, 1, 0), makeKill(140, 2, 1), makeKill(700, 1, 2, { headshot: true })],
      hurts: [
        makeHurt(90, 1, 0, 110),
        makeHurt(130, 2, 1, 40, { weapon: "hegrenade" }),
        makeHurt(680, 1, 2, 50),
      ],
      blinds: [makeBlind(120, 2, 1, 1.5), makeBlind(125, 0, 2, 1)],
    });
    const columns = statsTimeline(replay);
    const stats = computeStats(replay, matchEndTick(replay));
    const last = columns[1];
    expect(last).toBeTruthy();
    for (const row of last?.rows ?? []) {
      const full = stats[row.player];
      expect(row.values.kills.running).toBe(full?.kills);
      expect(row.values.hs.running).toBeCloseTo(full?.headshot_percent ?? 0);
      expect(row.values.adr.running).toBeCloseTo(full?.adr ?? 0);
      expect(row.values.opening.running).toBe(full?.first_kills);
      expect(row.values.kast.running).toBeCloseTo(full?.kast ?? 0);
      expect(row.values.util.running).toBe(full?.utility_damage);
      expect(row.values.flashed.running).toBe(full?.enemies_flashed);
    }
    expect(columns[0]?.rows[1]?.values.kills).toEqual({ round: 1, running: 1 });
    expect(columns[1]?.rows[1]?.values.kills).toEqual({ round: 1, running: 2 });
    expect(columns[0]?.rows[1]?.values.adr.round).toBe(100);
    expect(columns[0]?.rows[2]?.values.util.round).toBe(40);
    expect(columns[0]?.rows[2]?.values.flashed.round).toBe(1);
    expect(columns[0]?.rows[0]?.values.flashed.round).toBe(0);
    expect(plottedValue({ round: 1, running: 2 })).toBe(2);
  });

  it("records buy type and which side the player's team was on", () => {
    const ticks = makeFreezeTicks(2, 1, 64);
    ticks.equip[0] = 4500;
    ticks.equip[1] = 4500;
    const second = 800;
    const replay = makeReplay({
      players: [makePlayer(0, "CT", "A"), makePlayer(1, "T", "B")],
      ticks,
      rounds: [
        makeRound({
          number: 4,
          start_tick: 0,
          freeze_end_tick: 64,
          end_tick: 400,
          winner: "CT",
          score_ct: 2,
          score_t: 1,
        }),
      ],
    });
    const row = statsTimeline(replay)[0]?.rows[0];
    expect(row?.side).toBe("CT");
    expect(row?.buy).toBe("full");
    expect(row?.won).toBe(true);
    expect(statsTimeline(replay)[0]?.winRoster).toBe("CT");
    expect(statsTimeline(replay)[0]?.winReason).toBe(8);
    expect(statsTimeline(replay)[0]?.rows[1]?.won).toBe(false);

    const swapped = makeReplay({
      players: [makePlayer(0, "CT", "A"), makePlayer(1, "T", "B")],
      rounds: [
        makeRound({
          number: 1,
          start_tick: 0,
          end_tick: 400,
          winner: "CT",
          score_ct: 0,
          score_t: 0,
        }),
        makeRound({
          number: 13,
          start_tick: second,
          freeze_end_tick: second,
          end_tick: second + 400,
          winner: "T",
          score_ct: 1,
          score_t: 0,
        }),
      ],
    });
    const half = statsTimeline(swapped);
    expect(half[0]?.rows[0]?.side).toBe("CT");
    expect(half[1]?.rows[0]?.side).toBe("T");
    expect(half[1]?.rows[0]?.won).toBe(true);
    expect(half[1]?.winner).toBe("T");
    expect(half[1]?.winRoster).toBe("CT");
  });

  it("uses the freeze sample when the side has actually swapped", () => {
    const ticks = makeFreezeTicks(2, 1, 64);
    const present = FLAG_PRESENT | FLAG_ALIVE;
    ticks.ticks[0] = 64;
    const frame = new Uint8Array(2);
    frame[0] = present;
    frame[1] = present | FLAG_CT;
    const replay = makeReplay({
      players: [makePlayer(0, "CT", "A"), makePlayer(1, "T", "B")],
      ticks: {
        ...ticks,
        flags: frame,
      },
      rounds: [
        makeRound({
          number: 13,
          freeze_end_tick: 64,
          end_tick: 400,
          winner: "CT",
          score_ct: 6,
          score_t: 6,
        }),
      ],
    });
    expect(statsTimeline(replay)[0]?.rows[0]?.side).toBe("T");
    expect(statsTimeline(replay)[0]?.rows[1]?.side).toBe("CT");
  });

  it("leaves bots off the chart and keeps human totals on the Score tally", () => {
    const replay = makeReplay({
      players: [makePlayer(0, "CT", "A"), makePlayer(1, "T", "Rock", 2, true)],
      rounds: [
        makeRound({
          number: 1,
          start_tick: 0,
          freeze_end_tick: 64,
          end_tick: 400,
          winner: "CT",
        }),
      ],
      kills: [makeKill(200, 0, 1), makeKill(300, 1, 0)],
    });
    const rows = statsTimeline(replay)[0]?.rows ?? [];
    expect(rows.map((row) => row.name)).toEqual(["A"]);
    const full = computeStats(replay, matchEndTick(replay));
    expect(rows[0]?.values.kills.running).toBe(full[0]?.kills);
    expect(full[1]?.kills).toBe(1);
  });

  it("keeps the single-demo tutorial rounds and matches the scoreboard", () => {
    const replay = hydrateTutorialReplay();
    const columns = statsTimeline(replay);
    expect(columns.map((column) => column.number)).toEqual([1, 2]);
    const stats = computeStats(replay, matchEndTick(replay));
    const last = columns[1];
    for (const row of last?.rows ?? []) {
      expect(row.values.kills.running).toBe(stats[row.player]?.kills);
      expect(row.values.adr.running).toBeCloseTo(stats[row.player]?.adr ?? 0);
      expect(row.values.kast.running).toBeCloseTo(stats[row.player]?.kast ?? 0);
    }
  });

  it("formats chart values the way the hover card reads them", () => {
    expect(formatTimelineValue("kills", 3)).toBe("3");
    expect(formatTimelineValue("adr", 96)).toBe("96");
    expect(formatTimelineValue("adr", 96.25)).toBe("96.3");
    expect(formatTimelineValue("hs", 50)).toBe("50%");
    expect(formatTimelineValue("kast", 66.6)).toBe("67%");
  });
});
