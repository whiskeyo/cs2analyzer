import { describe, expect, it } from "vitest";
import { MIN_REVIEW_FLASH_SECONDS } from "@/lib/shared/constants";
import { makeBlind, makeKill, makePlayer, makeReplay, makeRound } from "@/lib/testing/fixtures";
import { buildSeries, loadedDemo } from "./session";
import { seriesPlayerReview } from "./seriesPlayerReview";
import { playerIdentityKey } from "./seriesRoster";

function demoWith(fileName: string, replay: ReturnType<typeof makeReplay>) {
  return loadedDemo(replay, fileName, new File([], fileName));
}

describe("seriesPlayerReview", () => {
  it("merges headlines and groups notes by demo", () => {
    const focal = "Team A";
    const a = demoWith(
      "a.dem",
      makeReplay({
        header: { team_ct: focal, team_t: "B" },
        players: [makePlayer(0, "CT", "Donk", 100), makePlayer(1, "T", "B")],
        rounds: [makeRound({ number: 1, winner: "CT" })],
        kills: [makeKill(100, 0, 1)],
      }),
    );
    const b = demoWith(
      "b.dem",
      makeReplay({
        header: { team_ct: focal, team_t: "B" },
        players: [makePlayer(0, "CT", "Donk", 100), makePlayer(1, "T", "B")],
        rounds: [makeRound({ number: 1, winner: "CT" })],
        kills: [makeKill(100, 0, 1)],
      }),
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
    expect(review.headlines[0]?.byDemo[0]?.rounds).toEqual(["R1"]);
  });

  it("skips demos the player is absent from", () => {
    const a = demoWith(
      "a.dem",
      makeReplay({
        players: [makePlayer(0, "CT", "Donk", 100), makePlayer(1, "T", "B")],
        rounds: [makeRound({ number: 1, winner: "CT" })],
        kills: [makeKill(100, 0, 1)],
      }),
    );
    const other = demoWith(
      "other.dem",
      makeReplay({
        players: [makePlayer(0, "CT", "Someone", 999), makePlayer(1, "T", "B", 998)],
        rounds: [makeRound({ number: 1, winner: "CT" })],
        kills: [makeKill(100, 0, 1)],
      }),
    );
    const series = buildSeries("de_mirage", [a, other]);
    const review = seriesPlayerReview(series, playerIdentityKey(a.replay, 0), "Donk");
    expect(review.demoCount).toBe(1);
    expect(review.notesByDemo.map((g) => g.fileName)).toEqual(["a.dem"]);
  });

  it("returns an empty review when the player is in no demo", () => {
    const a = demoWith(
      "a.dem",
      makeReplay({
        players: [makePlayer(0, "CT", "A", 1), makePlayer(1, "T", "B", 2)],
        rounds: [makeRound({ number: 1, winner: "CT" })],
      }),
    );
    const review = seriesPlayerReview(buildSeries("de_mirage", [a]), "steam:999", "Ghost");
    expect(review).toEqual({
      playerName: "Ghost",
      demoCount: 0,
      headlines: [],
      notesByDemo: [],
    });
  });

  it("merges opening-loss team-lost subcounts across demos", () => {
    const loss = (fileName: string) =>
      demoWith(
        fileName,
        makeReplay({
          players: [makePlayer(0, "CT", "Donk", 100), makePlayer(1, "T", "B")],
          rounds: [makeRound({ number: 1, winner: "T" })],
          kills: [makeKill(100, 1, 0)],
        }),
      );
    const series = buildSeries("de_mirage", [loss("a.dem"), loss("b.dem")]);
    const key = playerIdentityKey(loss("x.dem").replay, 0);
    const review = seriesPlayerReview(series, key, "Donk");
    const opening = review.headlines.find((h) => h.kind === "opening" && h.text.includes("Lost"));
    expect(opening?.text).toContain("Lost 2 opening");
    expect(opening?.text).toContain("2 in rounds the team lost");
    expect(opening?.totalCount).toBe(2);
  });

  it("attaches matching notes to flashed, untraded, and clutch headlines", () => {
    const a = demoWith(
      "a.dem",
      makeReplay({
        players: [makePlayer(0, "CT", "Donk", 100), makePlayer(1, "T", "B")],
        rounds: [makeRound({ number: 2, winner: "T", freeze_end_tick: 64, end_tick: 700 })],
        kills: [makeKill(200, 1, 0)],
        blinds: [makeBlind(180, 1, 0, MIN_REVIEW_FLASH_SECONDS)],
      }),
    );
    const review = seriesPlayerReview(
      buildSeries("de_mirage", [a]),
      playerIdentityKey(a.replay, 0),
      "Donk",
    );
    const flashed = review.headlines.find((h) => h.text.includes("flashed"));
    const untraded = review.headlines.find((h) => h.text.includes("untraded"));
    expect(flashed?.byDemo[0]?.rounds).toEqual(["R2"]);
    expect(untraded?.byDemo[0]?.rounds).toEqual(["R2"]);
  });
});
