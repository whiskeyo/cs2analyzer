import { describe, expect, it } from "vitest";
import type { Replay } from "@/lib/replay/replayTypes";
import {
  FIRST_OVERTIME_ROUND,
  FORCE_BUY_MAX_EQUIPMENT,
  OVERTIME_START_MONEY,
  REGULATION_ROUNDS_PER_HALF,
} from "@/lib/shared/constants";
import { makeFreezeTicks, makeReplay, makeRound } from "@/lib/testing/fixtures";
import {
  groupParsedDemosByMap,
  parsePoolBar,
  parsePoolSize,
  type ParseFileResult,
} from "./parsePool";
import { loadedDemo } from "./session";
import { tagRounds } from "./roundTags";

describe("parsePoolSize", () => {
  it("caps at three workers in practice", () => {
    expect(parsePoolSize(10)).toBeLessThanOrEqual(3);
    expect(parsePoolSize(1)).toBe(1);
  });
});

describe("groupParsedDemosByMap", () => {
  it("groups files by map and prefers the largest bucket first", () => {
    const mirage = makeReplay({ header: { map_name: "de_mirage" } });
    const ancient = makeReplay({ header: { map_name: "de_ancient" } });
    const results: ParseFileResult[] = [
      { file: new File([], "a.dem"), demo: loadedDemo(mirage, "a.dem", new File([], "a.dem")) },
      { file: new File([], "b.dem"), demo: loadedDemo(ancient, "b.dem", new File([], "b.dem")) },
      { file: new File([], "c.dem"), demo: loadedDemo(ancient, "c.dem", new File([], "c.dem")) },
    ];
    const { groups, skipped } = groupParsedDemosByMap(results);
    expect(skipped).toEqual([]);
    expect(groups).toHaveLength(2);
    expect(groups[0].mapName).toBe("de_ancient");
    expect(groups[0].demos).toHaveLength(2);
    expect(groups[1].mapName).toBe("de_mirage");
    expect(groups[1].demos).toHaveLength(1);
  });
});

describe("parsePoolBar", () => {
  it("blends completed files with in-flight progress", () => {
    expect(parsePoolBar({ completed: 1, total: 3, inFlightFraction: 0.5, files: [] })).toEqual({
      current: 150,
      total: 300,
    });
  });
});

function roundWithEquip(
  replay: Replay,
  roundNumber: number,
  ctCount: number,
  avgEquip: number,
  tick = 64,
): Replay {
  const ticks = makeFreezeTicks(10, ctCount, tick);
  for (let i = 0; i < 10; i++) {
    ticks.equip[i] = avgEquip;
    if (roundNumber >= FIRST_OVERTIME_ROUND) ticks.money[i] = OVERTIME_START_MONEY;
  }
  const rounds =
    replay.rounds.length > 0
      ? replay.rounds.map((r) =>
          r.number === roundNumber
            ? {
                ...r,
                start_tick: tick - 64,
                freeze_end_tick: tick,
                end_tick: tick + 640,
              }
            : r,
        )
      : [
          makeRound({
            number: roundNumber,
            start_tick: tick - 64,
            freeze_end_tick: tick,
            end_tick: tick + 640,
            team_ct: replay.header.team_ct,
            team_t: replay.header.team_t,
          }),
        ];
  return { ...replay, ticks, rounds };
}

describe("tagRounds", () => {
  const focal = "Team Alpha";
  const demoId = "de_mirage|match.dem";

  it("skips knife rounds", () => {
    const replay = makeReplay({
      header: { team_ct: focal, team_t: "Other" },
      rounds: [
        makeRound({ number: 0, is_knife: true }),
        makeRound({ number: 1, team_ct: focal, team_t: "Other" }),
      ],
    });
    const tags = tagRounds(replay, demoId, focal);
    expect(tags).toHaveLength(1);
    expect(tags[0].roundNumber).toBe(1);
  });

  it("tags CT pistol at R1 when focal starts CT", () => {
    const replay = roundWithEquip(
      makeReplay({ header: { team_ct: focal, team_t: "Other" } }),
      1,
      5,
      800,
    );
    const tags = tagRounds(replay, demoId, focal);
    expect(tags[0]).toMatchObject({ roundNumber: 1, sideForFocal: "CT", kind: "pistol" });
  });

  it("tags T pistol at R13 after side swap, not by round label", () => {
    const rounds = [];
    for (let n = 1; n <= REGULATION_ROUNDS_PER_HALF; n++) {
      rounds.push(
        makeRound({
          number: n,
          team_ct: focal,
          team_t: "Other",
          start_tick: n * 1000,
          freeze_end_tick: n * 1000 + 64,
          end_tick: n * 1000 + 700,
        }),
      );
    }
    const r13Tick = 13 * 1000 + 64;
    rounds.push(
      makeRound({
        number: 13,
        team_ct: "Other",
        team_t: focal,
        start_tick: 13 * 1000,
        freeze_end_tick: r13Tick,
        end_tick: 13 * 1000 + 700,
      }),
    );
    const replay = roundWithEquip(
      makeReplay({
        header: { team_ct: focal, team_t: "Other" },
        rounds,
      }),
      13,
      5,
      800,
      r13Tick,
    );
    const tags = tagRounds(replay, demoId, focal);
    const tPistol = tags.find((t) => t.roundNumber === 13);
    expect(tPistol).toMatchObject({ sideForFocal: "T", kind: "pistol" });
  });

  it("classifies OT as full buy, never pistol", () => {
    const tick = 25000;
    const replay = roundWithEquip(
      makeReplay({
        header: { team_ct: focal, team_t: "Other" },
        rounds: [
          makeRound({
            number: FIRST_OVERTIME_ROUND,
            team_ct: focal,
            team_t: "Other",
          }),
        ],
      }),
      FIRST_OVERTIME_ROUND,
      5,
      FORCE_BUY_MAX_EQUIPMENT + 500,
      tick,
    );
    const tags = tagRounds(replay, demoId, focal);
    expect(tags[0]).toMatchObject({
      roundNumber: FIRST_OVERTIME_ROUND,
      kind: "full",
      isOt: true,
    });
  });

  it("returns no tags when focal team is absent", () => {
    const replay = makeReplay({ header: { team_ct: "A", team_t: "B" } });
    expect(tagRounds(replay, demoId, focal)).toEqual([]);
  });

  it("keys side from round team names after MR12 swap", () => {
    const replay = roundWithEquip(
      makeReplay({
        header: { team_ct: "Other", team_t: focal },
        rounds: [
          makeRound({
            number: 13,
            team_ct: focal,
            team_t: "Other",
            start_tick: 1000,
            freeze_end_tick: 1064,
            end_tick: 1700,
          }),
        ],
      }),
      13,
      5,
      800,
      1064,
    );
    const tags = tagRounds(replay, demoId, focal);
    expect(tags[0]).toMatchObject({ sideForFocal: "CT", kind: "pistol" });
  });
});

describe("inferFocalTeam", () => {
  it("picks a name shared by every demo", async () => {
    const { inferFocalTeam } = await import("./session");
    const a = loadedDemo(
      makeReplay({ header: { team_ct: "Alpha", team_t: "Bravo" } }),
      "a.dem",
      new File([], "a.dem"),
    );
    const b = loadedDemo(
      makeReplay({ header: { team_ct: "Alpha", team_t: "Charlie" } }),
      "b.dem",
      new File([], "b.dem"),
    );
    expect(inferFocalTeam([a, b])).toBe("Alpha");
  });
});
