import { describe, expect, it } from "vitest";
import { makeFreezeTicks, makePlayer, makeReplay } from "@/lib/testing/fixtures";
import { CT_COLOR, T_COLOR } from "./radarFrame";
import { livePawnLegend, uniquePawnLegend } from "./pawnLegend";

describe("uniquePawnLegend", () => {
  it("keeps the first colour for each non-blank label", () => {
    expect(
      uniquePawnLegend([
        { label: "donk", color: "#ff2d6a" },
        { label: " donk ", color: "#00f0ff" },
        { label: "m0NESY", color: "#00f0ff" },
        { label: "  ", color: "#fff" },
        { label: undefined, color: "#000" },
      ]),
    ).toEqual([
      { label: "donk", color: "#ff2d6a" },
      { label: "m0NESY", color: "#00f0ff" },
    ]);
  });
});

describe("livePawnLegend", () => {
  it("lists present pawns by side colour and skips blank names", () => {
    const ticks = makeFreezeTicks(3, 1, 64);
    const replay = makeReplay({
      players: [
        makePlayer(0, "CT", "Alice"),
        makePlayer(1, "T", "  "),
        makePlayer(2, "T", "Bob"),
      ],
      ticks,
    });
    expect(livePawnLegend(replay, 64)).toEqual([
      { label: "Alice", color: CT_COLOR },
      { label: "Bob", color: T_COLOR },
    ]);
  });

  it("returns an empty list when no one is present", () => {
    expect(livePawnLegend(makeReplay(), 100)).toEqual([]);
  });

  it("uses overlay trail tints when a habits overlay is active", () => {
    const overlay = {
      trails: [
        {
          demoId: "d1",
          roundNumber: 1,
          jumpTick: 64,
          tps: 64,
          steamId: 1,
          playerName: "donk",
          color: "#ff2d6a",
          points: [],
          deathAt: null,
          deathTick: null,
          survivedAt: null,
          survivedTick: null,
        },
        {
          demoId: "d2",
          roundNumber: 2,
          jumpTick: 64,
          tps: 64,
          steamId: 1,
          playerName: "donk",
          color: "#ffe600",
          points: [],
          deathAt: null,
          deathTick: null,
          survivedAt: null,
          survivedTick: null,
        },
        {
          demoId: "d1",
          roundNumber: 1,
          jumpTick: 64,
          tps: 64,
          steamId: 2,
          playerName: "m0NESY",
          color: "#00f0ff",
          points: [],
          deathAt: null,
          deathTick: null,
          survivedAt: null,
          survivedTick: null,
        },
      ],
      heatDots: [],
      nades: [],
      roundCount: 2,
      windowSec: 20,
    };
    expect(livePawnLegend(makeReplay(), 100, overlay)).toEqual([
      { label: "donk", color: "#ff2d6a" },
      { label: "m0NESY", color: "#00f0ff" },
    ]);
  });
});
