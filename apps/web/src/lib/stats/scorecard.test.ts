import { describe, expect, it } from "vitest";
import { formatScorecard, matchScorecard } from "./scorecard";
import { makePlayer, makeReplay, makeRound } from "@/lib/testing/fixtures";

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
