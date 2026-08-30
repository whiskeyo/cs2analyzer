import { describe, expect, it } from "vitest";
import { makeKill, makePlayer, makeReplay, makeRound } from "@/lib/testing/fixtures";
import { buildSeries, loadedDemo } from "./session";
import { seriesPlayerReview } from "./seriesPlayerReview";
import { playerIdentityKey } from "./seriesRoster";

describe("seriesPlayerReview", () => {
  it("merges headlines and groups notes by demo", () => {
    const focal = "Team A";
    const a = loadedDemo(
      makeReplay({
        header: { team_ct: focal, team_t: "B" },
        players: [makePlayer(0, "CT", "Donk", 100), makePlayer(1, "T", "B")],
        rounds: [makeRound({ number: 1, winner: "CT" })],
        kills: [makeKill(100, 0, 1)],
      }),
      "a.dem",
      new File([], "a.dem"),
    );
    const b = loadedDemo(
      makeReplay({
        header: { team_ct: focal, team_t: "B" },
        players: [makePlayer(0, "CT", "Donk", 100), makePlayer(1, "T", "B")],
        rounds: [makeRound({ number: 1, winner: "CT" })],
        kills: [makeKill(100, 0, 1)],
      }),
      "b.dem",
      new File([], "b.dem"),
    );
    const series = buildSeries("de_mirage", [a, b]);
    const key = playerIdentityKey(a.replay, 0);
    const review = seriesPlayerReview(series, key, "Donk");

    expect(review.demoCount).toBe(2);
    expect(review.headlines.some((h) => h.text.includes("Won 2 opening"))).toBe(true);
    expect(review.headlines.every((h) => !h.text.match(/\(\d+\)\s*\(\d+\)/))).toBe(true);
    expect(review.headlines[0]?.byDemo).toHaveLength(2);
    expect(review.notesByDemo.map((g) => g.fileName)).toEqual(["a.dem", "b.dem"]);
    expect(review.notesByDemo[0]?.notes.some((n) => n.title.startsWith("Won the opening"))).toBe(
      true,
    );
  });
});
