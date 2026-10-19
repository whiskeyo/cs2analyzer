import { describe, expect, it } from "vitest";
import { ECO_MAX_EQUIPMENT, FORCE_BUY_MAX_EQUIPMENT } from "@/lib/shared/constants";
import { FLAG_ALIVE, FLAG_CT, FLAG_PRESENT } from "@/lib/replay/replayTypes";
import {
  makeFreezeTicks,
  makeKill,
  makePlayer,
  makeReplay,
  makeRound,
  makeTicks,
} from "@/lib/testing/fixtures";
import { teamReview } from "./teamReview";

describe("teamReview", () => {
  it("aggregates eco and flash notes for a starting side", () => {
    const players = [
      makePlayer(0, "CT", "Alice"),
      makePlayer(1, "CT", "Support"),
      makePlayer(2, "CT", "C"),
      makePlayer(3, "T", "Bob"),
      makePlayer(4, "T", "D"),
      makePlayer(5, "T", "E"),
    ];
    const ticks = makeFreezeTicks(6, 3, 128);
    for (let i = 0; i < 3; i++) ticks.equip[i] = ECO_MAX_EQUIPMENT - 500;
    for (let i = 3; i < 6; i++) ticks.equip[i] = FORCE_BUY_MAX_EQUIPMENT;

    const m = makeReplay({
      header: { team_ct: "Astralis", team_t: "Vitality" },
      players,
      rounds: [
        makeRound({ number: 2, winner: "CT", freeze_end_tick: 128, end_tick: 800, start_tick: 64 }),
      ],
      kills: [
        makeKill(200, 0, 3, { assister: 1, assisted_flash: true }),
        makeKill(300, 1, 4),
        makeKill(400, 2, 5),
      ],
      grenades: [
        {
          kind: "flash",
          thrower: 1,
          start_tick: 160,
          detonate_tick: 175,
          end_tick: 190,
          points: [],
        },
      ],
      ticks,
    });

    const review = teamReview(m, "CT", 800);
    const eco = review.headlines.find((h) => h.text.includes("eco/force"));
    const flash = review.headlines.find((h) => h.text.includes("flash"));
    expect(
      eco?.details?.some((d) => d.roundLabel === "R2" && d.text.includes("Won on an eco")),
    ).toBe(true);
    expect(
      flash?.details?.some(
        (d) =>
          d.roundLabel === "R2" &&
          d.text === "Flash assist by Support, leading to Alice → Bob kill" &&
          d.tick < 160,
      ),
    ).toBe(true);
  });

  it("follows start_side across a half swap for anti-eco losses", () => {
    const players = [makePlayer(0, "CT", "Alice"), makePlayer(1, "T", "Bob")];
    const ticks = makeTicks(2, 1);
    ticks.ticks[0] = 1064;
    // Swapped: Alice (start CT) now T; Bob (start T) now CT.
    ticks.flags[0] = FLAG_PRESENT | FLAG_ALIVE;
    ticks.flags[1] = FLAG_PRESENT | FLAG_ALIVE | FLAG_CT;
    ticks.equip[0] = FORCE_BUY_MAX_EQUIPMENT;
    ticks.equip[1] = ECO_MAX_EQUIPMENT - 1;

    const m = makeReplay({
      header: { team_ct: "Astralis", team_t: "Vitality" },
      players,
      rounds: [
        makeRound({
          // Not pistol (13); still second half so sides are swapped.
          number: 14,
          winner: "CT",
          start_tick: 1000,
          freeze_end_tick: 1064,
          end_tick: 1800,
          team_ct: "Vitality",
          team_t: "Astralis",
        }),
      ],
      kills: [makeKill(1200, 1, 0)],
      ticks,
    });

    const review = teamReview(m, "CT", 1800);
    const anti = review.headlines.find((h) => h.text.includes("anti-eco"));
    expect(anti?.details?.some((d) => d.roundLabel === "R14")).toBe(true);
  });
});
