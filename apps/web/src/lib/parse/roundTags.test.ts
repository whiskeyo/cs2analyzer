import { describe, expect, it } from "vitest";
import { makePlayer, makeReplay, makeRound } from "@/lib/testing/fixtures";
import { tagRounds } from "./roundTags";

describe("tagRounds", () => {
  it("omits knife rounds and tags the first regulation round per focal side as pistol", () => {
    const replay = makeReplay({
      header: { team_ct: "Astralis", team_t: "Vitality" },
      players: [makePlayer(0, "CT", "A"), makePlayer(1, "T", "B")],
      rounds: [
        makeRound({ number: 0, is_knife: true }),
        makeRound({ number: 1, winner: "CT" }),
        makeRound({ number: 2, winner: "T" }),
      ],
    });
    const tags = tagRounds(replay, "demo-a", "Astralis");
    expect(tags.map((t) => [t.roundNumber, t.kind, t.sideForFocal])).toEqual([
      [1, "pistol", "CT"],
      [2, "eco", "CT"],
    ]);
  });

  it("returns nothing when the focal team is not in the match", () => {
    const replay = makeReplay({
      header: { team_ct: "A", team_t: "B" },
      rounds: [makeRound({ number: 1 })],
    });
    expect(tagRounds(replay, "demo-a", "Other")).toEqual([]);
  });
});
