import { describe, expect, it } from "vitest";
import { clipClockLabel } from "@/lib/export/clipHud";
import { clipRoundClockLabel } from "@/lib/export/clipPageHudKey";
import { roundJumpTick } from "@/lib/playback/roundAutoplay";
import { pageClockLabel, plantedClock } from "@/lib/replay/plantedClock";
import { makeBombEvent, makeReplay, makeRound } from "@/lib/testing/fixtures";
import { BOMB_SECONDS, DEFAULT_TICK_RATE } from "@/lib/shared/constants";

const RATE = DEFAULT_TICK_RATE;

function liveRound(partial: Partial<Omit<ReturnType<typeof makeRound>, "number">> = {}) {
  return makeRound({
    number: 1,
    start_tick: 0,
    freeze_end_tick: 2 * RATE,
    end_tick: 200 * RATE,
    ...partial,
  });
}

describe("pageClockLabel", () => {
  it("keeps the master freeze and round clock before a plant", () => {
    const replay = makeReplay({ rounds: [liveRound()] });
    expect(pageClockLabel(replay, 0)).toBe("Freeze 2.0s");
    expect(pageClockLabel(replay, RATE)).toBe("Freeze 1.0s");
    expect(pageClockLabel(replay, 2 * RATE)).toBe("1:55");
    expect(pageClockLabel(replay, 2 * RATE + 10 * RATE)).toBe("1:45");

    const wingman = makeReplay({
      rounds: [liveRound({ round_time_s: 90 })],
    });
    expect(pageClockLabel(wingman, 2 * RATE)).toBe("1:30");
    expect(pageClockLabel(wingman, 2 * RATE + 10 * RATE)).toBe("1:20");
  });

  it("counts C4 down from the fuse after bomb_planted", () => {
    const plant = 2 * RATE + 20 * RATE;
    const replay = makeReplay({
      rounds: [liveRound()],
      bombEvents: [makeBombEvent({ tick: plant, kind: "planted" })],
    });
    expect(pageClockLabel(replay, plant - 1)).toMatch(/^\d+:\d{2}$/);
    expect(pageClockLabel(replay, plant)).toBe(`C4 ${BOMB_SECONDS.toFixed(1)}`);
    expect(pageClockLabel(replay, plant + 10 * RATE)).toBe("C4 30.0");
    const clock = plantedClock(replay, liveRound(), plant + 10 * RATE, RATE);
    expect(clock?.stopped).toBeNull();
    expect(clock?.clockLabel).toBe("C4 30.0");
  });

  it("keeps counting through a fake defuse", () => {
    const plant = 2 * RATE + 20 * RATE;
    const begin = plant + RATE;
    const planted = makeBombEvent({ tick: plant, kind: "planted" });
    const clean = makeReplay({
      rounds: [liveRound()],
      bombEvents: [planted],
    });
    const fake = makeReplay({
      rounds: [liveRound()],
      bombEvents: [
        planted,
        makeBombEvent({ tick: begin, kind: "begin_defuse", haskit: false, player: 0 }),
        makeBombEvent({ tick: begin + 1, kind: "abort_defuse", player: 0 }),
      ],
    });
    const seen = plant + 10 * RATE;
    expect(pageClockLabel(fake, begin)).toBe("C4 39.0");
    expect(pageClockLabel(fake, seen)).toBe("C4 30.0");
    expect(pageClockLabel(fake, seen)).toBe(pageClockLabel(clean, seen));
    expect(pageClockLabel(fake, seen + 5 * RATE)).toBe("C4 25.0");
    expect(plantedClock(fake, liveRound(), seen, RATE)?.stopped).toBeNull();
  });

  it("freezes at the defuse tick until the next round", () => {
    const plant = 2 * RATE + 20 * RATE;
    const defusedAt = plant + 15 * RATE;
    const nextStart = 220 * RATE;
    const nextFreeze = nextStart + 2 * RATE;
    const replay = makeReplay({
      rounds: [
        liveRound(),
        makeRound({
          number: 2,
          start_tick: nextStart,
          freeze_end_tick: nextFreeze,
          end_tick: 400 * RATE,
        }),
      ],
      bombEvents: [
        makeBombEvent({ tick: plant, kind: "planted" }),
        makeBombEvent({ tick: defusedAt, kind: "defused", player: 0 }),
      ],
    });
    expect(pageClockLabel(replay, defusedAt)).toBe("C4 25.0");
    expect(pageClockLabel(replay, defusedAt + 20 * RATE)).toBe("C4 25.0");
    expect(pageClockLabel(replay, nextStart)).toMatch(/^Freeze /);
    expect(pageClockLabel(replay, nextFreeze)).toBe("1:55");
  });

  it("holds C4 0.0 after bomb_exploded until the next freeze", () => {
    const plant = 2 * RATE + 20 * RATE;
    const explodedAt = plant + 15 * RATE;
    const nextStart = 220 * RATE;
    const nextFreeze = nextStart + 2 * RATE;
    const replay = makeReplay({
      rounds: [
        liveRound(),
        makeRound({
          number: 2,
          start_tick: nextStart,
          freeze_end_tick: nextFreeze,
          end_tick: 400 * RATE,
        }),
      ],
      bombEvents: [
        makeBombEvent({ tick: plant, kind: "planted" }),
        makeBombEvent({ tick: explodedAt, kind: "exploded" }),
      ],
    });
    expect(pageClockLabel(replay, explodedAt)).toBe("C4 0.0");
    expect(pageClockLabel(replay, explodedAt + 20 * RATE)).toBe("C4 0.0");
    expect(pageClockLabel(replay, nextFreeze)).toBe("1:55");
    expect(plantedClock(replay, liveRound(), explodedAt + 20 * RATE, RATE)?.stopped).toBe(
      "exploded",
    );
  });

  it("freezes when bomb_defused arrives at or after round_end and does not throw", () => {
    const plant = 20 * RATE;
    const end = plant + 14 * RATE;
    const defusedAt = end + RATE;
    const nextStart = defusedAt + 30 * RATE;
    const replay = makeReplay({
      rounds: [
        makeRound({ number: 1, start_tick: 0, freeze_end_tick: 2 * RATE, end_tick: end }),
        makeRound({
          number: 2,
          start_tick: nextStart,
          freeze_end_tick: nextStart + 2 * RATE,
          end_tick: nextStart + 100 * RATE,
        }),
      ],
      bombEvents: [
        makeBombEvent({ tick: plant, kind: "planted" }),
        makeBombEvent({ tick: defusedAt, kind: "defused", player: 0 }),
      ],
    });
    expect(defusedAt).toBeGreaterThan(end);
    const round = replay.rounds[0];
    expect(round).toBeDefined();
    expect(() => pageClockLabel(replay, defusedAt)).not.toThrow();
    expect(() => plantedClock(replay, round ?? liveRound(), defusedAt, RATE)).not.toThrow();
    expect(pageClockLabel(replay, end)).toBe("C4 26.0");
    expect(pageClockLabel(replay, defusedAt)).toBe("C4 25.0");
    expect(pageClockLabel(replay, defusedAt + 10 * RATE)).toBe("C4 25.0");
    expect(pageClockLabel(replay, nextStart)).toMatch(/^Freeze /);

    const atEnd = makeReplay({
      rounds: [makeRound({ number: 1, start_tick: 0, freeze_end_tick: 2 * RATE, end_tick: end })],
      bombEvents: [
        makeBombEvent({ tick: plant, kind: "planted" }),
        makeBombEvent({ tick: end, kind: "defused", player: 0 }),
      ],
    });
    expect(() => pageClockLabel(atEnd, end)).not.toThrow();
    expect(pageClockLabel(atEnd, end)).toBe("C4 26.0");
    expect(pageClockLabel(atEnd, end + 5 * RATE)).toBe("C4 26.0");
  });

  it("drops back to round time when seeking across the plant, with no stale fuse", () => {
    const plant = 2 * RATE + 20 * RATE;
    const replay = makeReplay({
      rounds: [liveRound()],
      bombEvents: [makeBombEvent({ tick: plant, kind: "planted" })],
    });
    const before = plant - 1;
    const after = plant + 10 * RATE;
    expect(pageClockLabel(replay, after)).toBe("C4 30.0");
    const bare = pageClockLabel(makeReplay({ rounds: [liveRound()] }), before);
    expect(pageClockLabel(replay, before)).toBe(bare);
    expect(pageClockLabel(replay, before)).not.toMatch(/^C4 /);
    expect(pageClockLabel(replay, after)).toBe("C4 30.0");
    expect(pageClockLabel(replay, before)).not.toMatch(/^C4 /);
  });

  it("is correct immediately at each round-bar landing tick", () => {
    const plant = 2 * RATE + 20 * RATE;
    const second = makeRound({
      number: 2,
      start_tick: 220 * RATE,
      freeze_end_tick: 222 * RATE,
      end_tick: 400 * RATE,
    });
    const first = liveRound();
    const replay = makeReplay({
      rounds: [first, second],
      bombEvents: [makeBombEvent({ tick: plant, kind: "planted" })],
    });
    expect(pageClockLabel(replay, plant + 10 * RATE)).toBe("C4 30.0");
    expect(pageClockLabel(replay, roundJumpTick(second))).toBe("1:55");
    expect(pageClockLabel(replay, roundJumpTick(first))).toBe("1:55");
    expect(pageClockLabel(replay, roundJumpTick(second))).not.toMatch(/^C4 /);
  });

  it("does not flicker: the label is only the tick, at 0.5x, 2x, 4x, and paused", () => {
    const plant = 2 * RATE + 20 * RATE;
    const replay = makeReplay({
      rounds: [liveRound()],
      bombEvents: [makeBombEvent({ tick: plant, kind: "planted" })],
    });
    const speeds = [0.5, 2, 4];
    const held = plant + 8 * RATE;
    const label = pageClockLabel(replay, held);
    for (const speed of speeds) {
      const stepped = held + speed * RATE;
      const forward = pageClockLabel(replay, stepped);
      expect(pageClockLabel(replay, held)).toBe(label);
      expect(forward).toBe(pageClockLabel(replay, stepped));
      expect(forward.startsWith("C4 ") || forward.includes(":")).toBe(true);
    }
    expect(pageClockLabel(replay, held)).toBe(label);
    expect(pageClockLabel(replay, plant - 0.4)).not.toMatch(/^C4 /);
    expect(pageClockLabel(replay, plant)).toMatch(/^C4 /);
    expect(pageClockLabel(replay, plant)).toBe(pageClockLabel(replay, plant));
  });

  it("matches the clip label at the same ticks", () => {
    const plant = 2 * RATE + 20 * RATE;
    const begin = plant + RATE;
    const defusedAt = plant + 15 * RATE;
    const explodedAt = plant + 12 * RATE;
    const nextStart = 220 * RATE;
    const nextFreeze = nextStart + 2 * RATE;
    const first = liveRound();
    const second = makeRound({
      number: 2,
      start_tick: nextStart,
      freeze_end_tick: nextFreeze,
      end_tick: 400 * RATE,
    });
    const shared = [
      makeBombEvent({ tick: plant, kind: "planted" }),
      makeBombEvent({ tick: begin, kind: "begin_defuse", haskit: false, player: 0 }),
    ];
    const cases = [
      makeReplay({ rounds: [first, second], bombEvents: shared }),
      makeReplay({
        rounds: [first, second],
        bombEvents: [...shared, makeBombEvent({ tick: defusedAt, kind: "defused", player: 0 })],
      }),
      makeReplay({
        rounds: [first, second],
        bombEvents: [...shared, makeBombEvent({ tick: explodedAt, kind: "exploded" })],
      }),
    ];
    const ticks = [
      0,
      RATE,
      2 * RATE,
      plant - 1,
      plant,
      begin,
      plant + 10 * RATE,
      defusedAt,
      defusedAt + 20 * RATE,
      explodedAt,
      explodedAt + 20 * RATE,
      nextStart,
      nextFreeze,
      nextFreeze + 10 * RATE,
      roundJumpTick(first),
      roundJumpTick(second),
    ];
    for (const replay of cases) {
      for (const tick of ticks) {
        const clip = clipClockLabel(replay, tick);
        const page = pageClockLabel(replay, tick);
        expect(clipRoundClockLabel(replay, tick)).toBe(clip);
        if (clip.startsWith("Freeze ")) {
          expect(page).toBe(`${clip}s`);
        } else {
          expect(page).toBe(clip);
        }
      }
    }
  });
});
