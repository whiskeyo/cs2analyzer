import { describe, expect, it } from "vitest";
import type { Hurt } from "@/lib/replay/replayTypes";
import { HITGROUP_CHEST, HITGROUP_HEAD, LAST_HIT_SECONDS } from "@/lib/shared/constants";
import {
  makeFreezeTicks,
  makeHurt,
  makePlayer,
  makeReplay,
  makeRound,
} from "@/lib/testing/fixtures";
import { formatLastHit, lastHitTaken } from "./lastHit";

const tps = 64;

function match(hurts: Hurt[] = []) {
  return makeReplay({
    players: [makePlayer(0, "CT", "Alice"), makePlayer(1, "CT", "Bob"), makePlayer(2, "T", "Cara")],
    rounds: [makeRound({ number: 1, start_tick: 0, freeze_end_tick: 64, end_tick: 640 })],
    ticks: makeFreezeTicks(3, 2, 64),
    hurts,
  });
}

describe("formatLastHit", () => {
  it("names the hitgroup and HP, and armor damage when present", () => {
    expect(formatLastHit(null)).toBeNull();
    expect(formatLastHit(makeHurt(64, 2, 0, 34, { hitgroup: HITGROUP_CHEST }))).toBe(
      "Last hit: chest \u221234",
    );
    expect(
      formatLastHit(makeHurt(64, 2, 0, 89, { hitgroup: HITGROUP_HEAD, damage_armor: 15 })),
    ).toBe("Last hit: head \u221289 (armor \u221215)");
  });
});

describe("lastHitTaken", () => {
  it("returns the latest enemy hurt on the victim inside the window", () => {
    const replay = match([
      makeHurt(80, 2, 0, 10, { hitgroup: HITGROUP_CHEST }),
      makeHurt(100, 2, 0, 89, { hitgroup: HITGROUP_HEAD, damage_armor: 15 }),
    ]);
    expect(lastHitTaken(replay, 100, 0)).toMatchObject({
      damage: 89,
      hitgroup: HITGROUP_HEAD,
      damage_armor: 15,
    });
  });

  it("ignores teammates, self, and hurts outside the window", () => {
    const replay = match([
      makeHurt(100, 1, 0, 40, { hitgroup: HITGROUP_CHEST }),
      makeHurt(100, 0, 0, 10),
      makeHurt(100 - LAST_HIT_SECONDS * tps - 1, 2, 0, 50, { hitgroup: HITGROUP_HEAD }),
    ]);
    expect(lastHitTaken(replay, 100, 0)).toBeNull();
  });
});
