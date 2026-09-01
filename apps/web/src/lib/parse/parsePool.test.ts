import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
  mapNameFromReplay,
  parsePoolBar,
  parsePoolOverallPct,
  parsePoolSize,
  runParsePool,
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

describe("parsePoolOverallPct", () => {
  it("returns zero for an empty pool", () => {
    expect(parsePoolOverallPct({ completed: 0, total: 0, inFlightFraction: 0, files: [] })).toBe(0);
  });

  it("rounds blended progress to a percentage", () => {
    expect(parsePoolOverallPct({ completed: 1, total: 2, inFlightFraction: 0.5, files: [] })).toBe(
      75,
    );
  });
});

describe("mapNameFromReplay", () => {
  it("reads the header map name", () => {
    expect(mapNameFromReplay(makeReplay({ header: { map_name: "de_inferno" } }))).toBe(
      "de_inferno",
    );
  });
});

describe("groupParsedDemosByMap errors", () => {
  it("collects parse errors in skipped", () => {
    const { groups, skipped } = groupParsedDemosByMap([
      { file: new File([], "bad.dem"), error: "corrupt" },
    ]);
    expect(groups).toEqual([]);
    expect(skipped).toEqual(["bad.dem: corrupt"]);
  });
});

describe("runParsePool", () => {
  beforeEach(() => {
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function mockWorker(
    replay: Replay,
    outcome: "done" | "error" | "fail" | "unknown" = "done",
    message = "Parse failed",
  ) {
    let onmessage: ((ev: MessageEvent) => void) | null = null;
    let onerror: ((ev: ErrorEvent) => void) | null = null;
    return {
      set onmessage(fn: ((ev: MessageEvent) => void) | null) {
        onmessage = fn;
      },
      get onmessage() {
        return onmessage;
      },
      set onerror(fn: ((ev: ErrorEvent) => void) | null) {
        onerror = fn;
      },
      get onerror() {
        return onerror;
      },
      terminate: vi.fn(),
      postMessage: vi.fn(() => {
        if (outcome === "fail") {
          onerror?.({ message: "Worker failed" } as ErrorEvent);
          return;
        }
        onmessage?.({
          data: { type: "progress", current: 1, total: 2 },
        } as MessageEvent);
        if (outcome === "done") {
          onmessage?.({
            data: {
              type: "done",
              replay,
              timings: { initMs: 1, parseMs: 2, jsonMs: 3, buffersMs: 4, totalMs: 10 },
            },
          } as MessageEvent);
          return;
        }
        if (outcome === "error") {
          onmessage?.({ data: { type: "error", message } } as MessageEvent);
          return;
        }
        onmessage?.({ data: { type: "cancelled" } } as MessageEvent);
      }),
    } as unknown as Worker;
  }

  it("returns an empty array for no files", async () => {
    const onProgress = vi.fn();
    await expect(runParsePool(() => mockWorker(makeReplay()), [], onProgress)).resolves.toEqual([]);
    expect(onProgress).not.toHaveBeenCalled();
  });

  it("parses files in order and reports per-file progress", async () => {
    const replayA = makeReplay({ header: { map_name: "de_a" } });
    const replayB = makeReplay({ header: { map_name: "de_b" } });
    let n = 0;
    const createWorker = () => mockWorker(n++ === 0 ? replayA : replayB);
    const onProgress = vi.fn();
    const files = [new File([], "a.dem"), new File([], "b.dem")];
    const results = await runParsePool(createWorker, files, onProgress);
    expect(results).toHaveLength(2);
    expect(results[0].demo?.replay.header.map_name).toBe("de_a");
    expect(results[1].demo?.replay.header.map_name).toBe("de_b");
    const last = onProgress.mock.calls.at(-1)?.[0];
    expect(last?.completed).toBe(2);
    expect(last?.files.every((f: { state: string }) => f.state === "done")).toBe(true);
  });

  it("records worker errors on the matching file row", async () => {
    const onProgress = vi.fn();
    const results = await runParsePool(
      () => mockWorker(makeReplay(), "error", "bad header"),
      [new File([], "broken.dem")],
      onProgress,
    );
    expect(results[0].error).toBe("bad header");
    const last = onProgress.mock.calls.at(-1)?.[0];
    expect(last?.files[0]).toMatchObject({ name: "broken.dem", state: "error", pct: 100 });
  });

  it("handles worker onerror and unknown message types", async () => {
    const onProgress = vi.fn();
    const fail = await runParsePool(
      () => mockWorker(makeReplay(), "fail"),
      [new File([], "fail.dem")],
      onProgress,
    );
    expect(fail[0].error).toBe("Worker failed");
    const unknown = await runParsePool(
      () => mockWorker(makeReplay(), "unknown"),
      [new File([], "weird.dem")],
      onProgress,
    );
    expect(unknown[0].error).toBe("Parse failed");
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
