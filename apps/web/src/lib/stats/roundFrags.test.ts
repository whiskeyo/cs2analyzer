import { describe, expect, it } from "vitest";
import { playerRoundFrags } from "./roundFrags";
import { makeKill, makePlayer, makeReplay, makeRound } from "@/lib/testing/fixtures";

describe("playerRoundFrags", () => {
  const replay = makeReplay({
    players: [makePlayer(0, "CT", "Alice"), makePlayer(1, "T", "Bob"), makePlayer(2, "T", "Carl")],
    rounds: [
      makeRound({
        number: 1,
        start_tick: 100,
        freeze_end_tick: 200,
        end_tick: 900,
      }),
    ],
    kills: [
      makeKill(150, 0, 1, { headshot: true }),
      makeKill(250, 0, 1, { headshot: false }),
      makeKill(300, 0, 2, { headshot: true }),
      makeKill(400, 1, 0, { headshot: false }),
    ],
  });

  it("ignores kills before freeze ends", () => {
    expect(playerRoundFrags(replay, 180, 0)).toBeNull();
  });

  it("counts enemy frags and uses the latest headshot flag for the icon", () => {
    expect(playerRoundFrags(replay, 250, 0)).toEqual({ count: 1, headshot: false });
    expect(playerRoundFrags(replay, 300, 0)).toEqual({ count: 2, headshot: true });
  });

  it("returns null with no frags or a bad player slot", () => {
    expect(playerRoundFrags(replay, 500, 2)).toBeNull();
    expect(playerRoundFrags(replay, 500, -1)).toBeNull();
  });
});
