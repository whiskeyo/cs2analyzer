import { describe, expect, it } from "vitest";
import { BOT_STEAM_ID_BASE, BOT_STEAM_ID_SPAN, isBotSteamId } from "@/lib/shared/constants";
import { makePlayer, makeReplay } from "@/lib/testing/fixtures";
import { attackerLabel, playerLabel } from "./playerLabel";

describe("playerLabel", () => {
  it("tags a bot and leaves humans unchanged", () => {
    expect(playerLabel(makePlayer(0, "T", "Mike", BOT_STEAM_ID_BASE + 5, true))).toBe("Mike (BOT)");
    expect(playerLabel(makePlayer(0, "CT", "Alice"))).toBe("Alice");
    expect(playerLabel(undefined)).toBe("?");
    expect(playerLabel(makePlayer(0, "T", "  ", BOT_STEAM_ID_BASE, true))).toBe("BOT");
  });
});

describe("attackerLabel", () => {
  it("names a mapped bot instead of World", () => {
    const replay = makeReplay({
      players: [
        makePlayer(0, "CT", "Alice"),
        makePlayer(1, "T", "Mike", BOT_STEAM_ID_BASE + 5, true),
      ],
    });
    expect(attackerLabel(replay, 1)).toBe("Mike (BOT)");
    expect(attackerLabel(replay, -1)).toBe("World");
  });
});

describe("isBotSteamId", () => {
  it("accepts the synthetic range and rejects a human SteamID64", () => {
    expect(isBotSteamId(BOT_STEAM_ID_BASE)).toBe(true);
    expect(isBotSteamId(BOT_STEAM_ID_BASE + 5)).toBe(true);
    expect(isBotSteamId(0)).toBe(false);
    expect(isBotSteamId(1)).toBe(false);
    expect(isBotSteamId(BOT_STEAM_ID_BASE + BOT_STEAM_ID_SPAN)).toBe(false);
  });
});
