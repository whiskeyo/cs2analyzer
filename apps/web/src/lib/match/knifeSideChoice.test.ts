import { describe, expect, it } from "vitest";
import { FLAG_ALIVE, FLAG_CT, FLAG_PRESENT, type Side } from "@/lib/replay/replayTypes";
import { makePlayer, makeReplay, makeRound, makeTicks } from "@/lib/testing/fixtures";
import { knifeChipTitle, knifeSideChoice } from "./knifeSideChoice";

function namedReplay(partial: {
  knifeWinner: Side | null;
  knifeCt?: string;
  knifeT?: string;
  r1?: { number?: number; ct?: string; t?: string } | null;
}) {
  const knife = makeRound({
    number: 0,
    is_knife: true,
    winner: partial.knifeWinner,
    start_tick: 0,
    freeze_end_tick: 64,
    end_tick: 200,
    team_ct: partial.knifeCt,
    team_t: partial.knifeT,
  });
  const rounds = [knife];
  if (partial.r1 !== null) {
    rounds.push(
      makeRound({
        number: partial.r1?.number ?? 1,
        start_tick: 300,
        freeze_end_tick: 364,
        end_tick: 900,
        team_ct: partial.r1?.ct,
        team_t: partial.r1?.t,
      }),
    );
  }
  return makeReplay({ rounds });
}

describe("knifeSideChoice", () => {
  it("stays when the knife winner keeps the same side in round 1", () => {
    const replay = namedReplay({
      knifeWinner: "CT",
      knifeCt: "Astralis",
      knifeT: "Vitality",
      r1: { ct: "Astralis", t: "Vitality" },
    });
    expect(knifeSideChoice(replay)).toEqual({
      winnerTeam: "Astralis",
      winnerSideInK: "CT",
      sideInR1: "CT",
      choice: "stay",
    });
    expect(knifeChipTitle(replay, replay.rounds[0]!)).toBe(
      "Knife · won by Astralis (CT) · picked CT (stay)",
    );
  });

  it("switches when the knife winner takes the other side in round 1", () => {
    const replay = namedReplay({
      knifeWinner: "T",
      knifeCt: "Astralis",
      knifeT: "Vitality",
      r1: { ct: "Vitality", t: "Astralis" },
    });
    expect(knifeSideChoice(replay)).toEqual({
      winnerTeam: "Vitality",
      winnerSideInK: "T",
      sideInR1: "CT",
      choice: "switch",
    });
    expect(knifeChipTitle(replay, replay.rounds[0]!)).toBe(
      "Knife · won by Vitality (T) · picked CT (switch)",
    );
  });

  it("returns null when the demo has no knife round", () => {
    const replay = makeReplay({ rounds: [makeRound({ number: 1 })] });
    expect(knifeSideChoice(replay)).toBeNull();
  });

  it("names the winner without a side choice when round 1 is missing", () => {
    const replay = namedReplay({
      knifeWinner: "CT",
      knifeCt: "Astralis",
      knifeT: "Vitality",
      r1: null,
    });
    expect(knifeSideChoice(replay)).toBeNull();
    const title = knifeChipTitle(replay, replay.rounds[0]!);
    expect(title).toBe("Knife · won by Astralis (CT)");
    expect(title).not.toMatch(/stay|switch|undefined|null/);
  });

  it("stays on Knife when the knife round has no winner", () => {
    const replay = namedReplay({
      knifeWinner: null,
      knifeCt: "Astralis",
      knifeT: "Vitality",
    });
    expect(knifeSideChoice(replay)).toBeNull();
    expect(knifeChipTitle(replay, replay.rounds[0]!)).toBe("Knife");
  });

  it("uses the first competitive round when it is not numbered 1", () => {
    const replay = namedReplay({
      knifeWinner: "T",
      knifeCt: "Astralis",
      knifeT: "Vitality",
      r1: { number: 2, ct: "Vitality", t: "Astralis" },
    });
    expect(knifeSideChoice(replay)?.choice).toBe("switch");
  });

  it("falls back to player sides when team names are missing or the same", () => {
    const ticks = makeTicks(2, 2);
    ticks.ticks[0] = 64;
    ticks.ticks[1] = 364;
    const alive = FLAG_PRESENT | FLAG_ALIVE;
    ticks.flags[0] = alive | FLAG_CT;
    ticks.flags[1] = alive;
    ticks.flags[2] = alive;
    ticks.flags[3] = alive | FLAG_CT;
    const players = [makePlayer(0, "CT", "Alice"), makePlayer(1, "T", "Cara")];
    const missing = makeReplay({
      players,
      ticks,
      rounds: [
        makeRound({
          number: 0,
          is_knife: true,
          winner: "T",
          start_tick: 0,
          freeze_end_tick: 64,
          end_tick: 200,
        }),
        makeRound({ number: 1, start_tick: 300, freeze_end_tick: 364, end_tick: 900 }),
      ],
    });
    expect(knifeSideChoice(missing)).toEqual({
      winnerTeam: "",
      winnerSideInK: "T",
      sideInR1: "CT",
      choice: "switch",
    });
    expect(knifeChipTitle(missing, missing.rounds[0]!)).toBe(
      "Knife · won by T · picked CT (switch)",
    );

    const ambiguous = makeReplay({
      players,
      ticks,
      rounds: [
        makeRound({
          number: 0,
          is_knife: true,
          winner: "T",
          start_tick: 0,
          freeze_end_tick: 64,
          end_tick: 200,
          team_ct: "Mixed",
          team_t: "Mixed",
        }),
        makeRound({
          number: 1,
          start_tick: 300,
          freeze_end_tick: 364,
          end_tick: 900,
          team_ct: "Mixed",
          team_t: "Mixed",
        }),
      ],
    });
    expect(knifeSideChoice(ambiguous)?.choice).toBe("switch");
  });
});
