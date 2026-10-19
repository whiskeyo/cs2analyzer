import { describe, expect, it } from "vitest";
import { DEFAULT_LEAD_IN_SEC } from "@/lib/match/roundEvents";
import { DEFAULT_TICK_RATE } from "@/lib/shared/constants";
import {
  makeFreezeTicks,
  makeGrenade,
  makeKill,
  makePlayer,
  makeReplay,
  makeRound,
} from "@/lib/testing/fixtures";
import { playTeamReviewItem } from "@/lib/testing/teamReviewItem";
import { flashAssist } from "./flashAssist";

describe("flashAssist", () => {
  it("jumps with lead-in before the flash throw so the nade is visible", () => {
    const players = [
      makePlayer(0, "CT", "Alice"),
      makePlayer(1, "CT", "Support"),
      makePlayer(2, "T", "Bob"),
    ];
    const ticks = makeFreezeTicks(3, 2);
    const throwStart = 120;
    const m = makeReplay({
      players,
      rounds: [makeRound({ number: 2, winner: "CT", freeze_end_tick: 64, end_tick: 640 })],
      kills: [makeKill(200, 0, 2, { assister: 1, assisted_flash: true })],
      grenades: [
        makeGrenade({
          kind: "flash",
          thrower: 1,
          start_tick: throwStart,
          detonate_tick: 160,
          end_tick: 180,
        }),
      ],
      ticks,
    });
    const freeze = 64;
    const jump = Math.max(freeze, throwStart - Math.round(DEFAULT_LEAD_IN_SEC * DEFAULT_TICK_RATE));
    expect(jump).toBe(freeze);
    expect(jump).toBeLessThan(throwStart);
    const { headlines } = playTeamReviewItem(flashAssist, m);
    expect(headlines).toEqual([
      {
        count: 1,
        severity: "good",
        kind: "util",
        text: "1 flash assist",
        details: [
          {
            tick: jump,
            roundLabel: "R2",
            text: "Flash assist by Support, leading to Alice → Bob kill",
          },
        ],
      },
    ]);
  });

  it("falls back to lead-in before the kill when no flash projectile is stored", () => {
    const players = [
      makePlayer(0, "CT", "Alice"),
      makePlayer(1, "CT", "Support"),
      makePlayer(2, "T", "Bob"),
    ];
    const ticks = makeFreezeTicks(3, 2);
    const freeze = 64;
    const killTick = 400;
    const m = makeReplay({
      players,
      rounds: [makeRound({ number: 2, winner: "CT", freeze_end_tick: freeze, end_tick: 640 })],
      kills: [makeKill(killTick, 0, 2, { assister: 1, assisted_flash: true })],
      ticks,
    });
    const jump = Math.max(freeze, killTick - Math.round(DEFAULT_LEAD_IN_SEC * DEFAULT_TICK_RATE));
    expect(jump).toBeGreaterThan(freeze);
    expect(playTeamReviewItem(flashAssist, m).headlines[0]?.details?.[0]?.tick).toBe(jump);
  });

  it("skips non-flash assists and enemy flashes", () => {
    const players = [
      makePlayer(0, "CT", "Alice"),
      makePlayer(1, "CT", "Support"),
      makePlayer(2, "T", "Bob"),
    ];
    const ticks = makeFreezeTicks(3, 2);
    const plain = makeReplay({
      players,
      rounds: [makeRound({ number: 2, winner: "CT" })],
      kills: [makeKill(200, 0, 2, { assister: 1 })],
      ticks,
    });
    expect(playTeamReviewItem(flashAssist, plain).headlines).toEqual([]);

    const enemyFlash = makeReplay({
      players,
      rounds: [makeRound({ number: 2, winner: "CT" })],
      kills: [makeKill(200, 0, 2, { assister: 2, assisted_flash: true })],
      ticks,
    });
    expect(playTeamReviewItem(flashAssist, enemyFlash).headlines).toEqual([]);
  });
});
