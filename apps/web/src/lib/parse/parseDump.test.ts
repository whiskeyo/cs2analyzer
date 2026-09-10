import { describe, expect, it } from "vitest";
import { FLAG_ALIVE, FLAG_CT, FLAG_PRESENT } from "@/lib/replay/replayTypes";
import { makeBlind, makePlayer, makeReplay, makeTicks } from "@/lib/testing/fixtures";
import { parseDump } from "./parseDump";

describe("parseDump", () => {
  it("counts overlay-band blinds and present steams at the last tick", () => {
    const ticks = makeTicks(2, 1);
    ticks.ticks[0] = 100;
    ticks.flags[0] = FLAG_PRESENT | FLAG_ALIVE | FLAG_CT;
    ticks.flags[1] = FLAG_PRESENT | FLAG_ALIVE;
    const m = makeReplay({
      players: [makePlayer(0, "CT", "Alice"), makePlayer(1, "T", "Bob")],
      ticks,
      blinds: [makeBlind(100, 0, 1, 5.0), makeBlind(100, 0, 0, 1.2)],
    });
    const dump = parseDump(m);
    expect(dump.blinds).toBe(2);
    expect(dump.overlayBlinds).toBe(1);
    expect(dump.overlayDurations).toEqual(["5.00"]);
    expect(dump.presentAtEnd.map((p) => p.name)).toEqual(["Alice", "Bob"]);
  });
});
