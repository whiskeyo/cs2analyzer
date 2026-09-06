import { describe, expect, it } from "vitest";
import { COST_AK47 } from "@/lib/shared/constants";
import { freezeBuysForPlayer } from "./buys";
import { makePlayer, makeReplay, makeRound } from "@/lib/testing/fixtures";

describe("freezeBuysForPlayer", () => {
  it("lists this freeze's buys and hides them after freeze end", () => {
    const m = makeReplay({
      players: [makePlayer(0, "T", "A")],
      rounds: [
        makeRound({ number: 1, winner: "T", start_tick: 0, freeze_end_tick: 64, end_tick: 640 }),
      ],
      buyEvents: [{ tick: 32, player: 0, weapon: 23, cost: COST_AK47 }],
    });
    expect(freezeBuysForPlayer(m, 0, 32)).toEqual([
      { tick: 32, player: 0, weapon: 23, cost: COST_AK47 },
    ]);
    expect(freezeBuysForPlayer(m, 0, 64)).toEqual([]);
    expect(freezeBuysForPlayer(m, 1, 32)).toEqual([]);
  });
});
