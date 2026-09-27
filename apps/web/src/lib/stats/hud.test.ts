/* eslint-disable max-lines -- defuse clock cases share one replay helper */
import { describe, expect, it } from "vitest";
import {
  bombView,
  defuseClock,
  freezeRemaining,
  liveSituation,
  plantClock,
  roundWinBanner,
} from "./hud";
import {
  makeBombEvent,
  makeFreezeTicks,
  makeKill,
  makePlayer,
  makeReplay,
  makeRound,
  makeTicks,
  type ReplayOverrides,
} from "@/lib/testing/fixtures";
import {
  BOMB_SECONDS,
  DEFUSE_WITHOUT_KIT_SECONDS,
  DEFUSE_WITH_KIT_SECONDS,
  PLANT_SECONDS,
} from "@/lib/shared/constants";
import {
  FLAG_ALIVE,
  FLAG_CT,
  FLAG_DEFUSING,
  FLAG_PLANTING,
  FLAG_PRESENT,
  GEAR_C4,
  GEAR_DEFUSER,
} from "@/lib/replay/replayTypes";

describe("freezeRemaining", () => {
  it("counts down until freeze_end_tick", () => {
    const m = makeReplay({
      players: [makePlayer(0, "CT", "A")],
      rounds: [
        makeRound({ number: 1, winner: "CT", start_tick: 0, freeze_end_tick: 64, end_tick: 640 }),
      ],
    });
    expect(freezeRemaining(m, 0)).toBe(1);
    expect(freezeRemaining(m, 32)).toBe(0.5);
    expect(freezeRemaining(m, 64)).toBeNull();
  });
});

describe("roundWinBanner", () => {
  it("shows the winner after end_tick", () => {
    const m = makeReplay({
      players: [makePlayer(0, "CT", "A")],
      rounds: [
        makeRound({
          number: 1,
          winner: "CT",
          start_tick: 0,
          freeze_end_tick: 64,
          end_tick: 640,
          win_reason: 8,
        }),
      ],
    });
    expect(roundWinBanner(m, 639)).toBeNull();
    expect(roundWinBanner(m, 640)).toEqual({ winner: "CT", reason: 8 });
  });

  it("keeps the previous winner on screen during the next freeze", () => {
    const m = makeReplay({
      players: [makePlayer(0, "CT", "A")],
      rounds: [
        makeRound({
          number: 1,
          winner: "T",
          start_tick: 0,
          freeze_end_tick: 64,
          end_tick: 200,
          win_reason: 1,
        }),
        makeRound({
          number: 2,
          winner: null,
          start_tick: 201,
          freeze_end_tick: 265,
          end_tick: 800,
          win_reason: 0,
        }),
      ],
    });
    expect(roundWinBanner(m, 210)).toEqual({ winner: "T", reason: 1 });
    expect(roundWinBanner(m, 265)).toBeNull();
  });
});

function clockReplay(overrides: ReplayOverrides = {}) {
  return makeReplay({
    players: [makePlayer(0, "CT", "A"), makePlayer(1, "CT", "B")],
    rounds: [
      makeRound({ number: 1, winner: "CT", start_tick: 0, freeze_end_tick: 64, end_tick: 4000 }),
    ],
    ...overrides,
  });
}

/** Sparse pawn samples. A slot listed in `defusing` stays on for that sample. */
function defusingSamples(
  playerCount: number,
  samples: {
    tick: number;
    defusing?: number[];
    dead?: number[];
    gone?: number[];
    kit?: number[];
  }[],
  side: "CT" | "T" = "CT",
) {
  const team = side === "CT" ? FLAG_CT : 0;
  const buf = makeTicks(playerCount, samples.length);
  samples.forEach((sample, frame) => {
    buf.ticks[frame] = sample.tick;
    for (let player = 0; player < playerCount; player++) {
      const slot = frame * playerCount + player;
      let flags = team;
      if (!sample.gone?.includes(player)) flags |= FLAG_PRESENT;
      if (!sample.dead?.includes(player) && !sample.gone?.includes(player)) flags |= FLAG_ALIVE;
      if (sample.defusing?.includes(player)) flags |= FLAG_DEFUSING;
      buf.flags[slot] = flags;
      if (sample.kit?.includes(player)) buf.gear[slot] = GEAR_DEFUSER;
    }
  });
  return buf;
}

describe("defuseClock", () => {
  it("counts a 5s kit defuse after plant", () => {
    const m = makeReplay({
      players: [makePlayer(0, "CT", "A")],
      rounds: [
        makeRound({ number: 1, winner: "CT", start_tick: 0, freeze_end_tick: 64, end_tick: 2000 }),
      ],
      ticks: defusingSamples(1, [
        { tick: 200, defusing: [0] },
        { tick: 200 + 64 * 2, defusing: [0] },
      ]),
      bombEvents: [
        makeBombEvent({ tick: 100, kind: "planted" }),
        makeBombEvent({ tick: 200, kind: "begin_defuse", haskit: true, player: 0 }),
      ],
    });
    expect(defuseClock(m, 199)).toBeNull();
    expect(defuseClock(m, 200)?.remaining).toBeCloseTo(5, 5);
    expect(defuseClock(m, 200 + 64 * 2)?.remaining).toBeCloseTo(3, 5);
    expect(defuseClock(m, 200 + 64 * 2)?.haskit).toBe(true);
  });

  it("uses 10s without a kit and cancels on abort", () => {
    const m = makeReplay({
      players: [makePlayer(0, "CT", "A")],
      rounds: [
        makeRound({ number: 1, winner: "CT", start_tick: 0, freeze_end_tick: 64, end_tick: 2000 }),
      ],
      ticks: defusingSamples(1, [
        { tick: 200, defusing: [0] },
        { tick: 264, defusing: [0] },
      ]),
      bombEvents: [
        makeBombEvent({ tick: 100, kind: "planted" }),
        makeBombEvent({ tick: 200, kind: "begin_defuse", haskit: false }),
        makeBombEvent({ tick: 300, kind: "abort_defuse" }),
      ],
    });
    expect(defuseClock(m, 264)?.remaining).toBeCloseTo(9, 5);
    expect(defuseClock(m, 300)).toBeNull();
  });

  it("starts from FLAG_DEFUSING when GOTV has no begin_defuse", () => {
    const ticks = makeTicks(1, 2);
    ticks.ticks[0] = 64;
    ticks.ticks[1] = 200;
    ticks.flags[0] = FLAG_PRESENT | FLAG_ALIVE | FLAG_CT;
    ticks.flags[1] = FLAG_PRESENT | FLAG_ALIVE | FLAG_CT | FLAG_DEFUSING;
    ticks.gear[1] = GEAR_DEFUSER;
    const m = makeReplay({
      players: [makePlayer(0, "CT", "A")],
      rounds: [
        makeRound({ number: 1, winner: "CT", start_tick: 0, freeze_end_tick: 64, end_tick: 2000 }),
      ],
      ticks,
      bombEvents: [makeBombEvent({ tick: 100, kind: "planted" })],
    });
    expect(defuseClock(m, 199)).toBeNull();
    expect(defuseClock(m, 200)?.remaining).toBeCloseTo(5, 5);
    expect(defuseClock(m, 200)?.haskit).toBe(true);
  });

  it("keeps counting from flags when the plant has no defuse event", () => {
    const start = 200;
    const m = clockReplay({
      ticks: defusingSamples(1, [
        { tick: 64 },
        { tick: start, defusing: [0], kit: [0] },
        { tick: start + 64 * 2, defusing: [0], kit: [0] },
        { tick: start + 64 * 4 },
      ]),
      bombEvents: [makeBombEvent({ tick: 100, kind: "planted" })],
    });
    expect(defuseClock(m, start)?.remaining).toBeCloseTo(DEFUSE_WITH_KIT_SECONDS, 5);
    expect(defuseClock(m, start + 64 * 2)?.remaining).toBeCloseTo(DEFUSE_WITH_KIT_SECONDS - 2, 5);
    expect(defuseClock(m, start + 64 * 4)).toBeNull();
  });

  it("hides the badge on a tap fake even while FLAG_DEFUSING is still set", () => {
    const m = clockReplay({
      ticks: defusingSamples(1, [
        { tick: 64 },
        { tick: 200, defusing: [0] },
        { tick: 800, defusing: [0] },
      ]),
      bombEvents: [
        makeBombEvent({ tick: 100, kind: "planted" }),
        makeBombEvent({ tick: 200, kind: "begin_defuse", haskit: false, player: 0 }),
        makeBombEvent({ tick: 201, kind: "abort_defuse", player: 0 }),
      ],
    });
    expect(defuseClock(m, 200)?.remaining).toBeCloseTo(DEFUSE_WITHOUT_KIT_SECONDS, 5);
    expect(defuseClock(m, 201)).toBeNull();
    expect(defuseClock(m, 250)).toBeNull();
    expect(defuseClock(m, 800)).toBeNull();
    expect(liveSituation(m, 250).bomb?.remaining).toBeGreaterThan(0);
  });

  it("hides the badge after a hold of a few seconds even while the flag is still set", () => {
    const start = 200;
    const release = start + 64 * 3;
    const m = clockReplay({
      ticks: defusingSamples(1, [
        { tick: 64 },
        { tick: start, defusing: [0] },
        { tick: release + 64, defusing: [0] },
      ]),
      bombEvents: [
        makeBombEvent({ tick: 100, kind: "planted" }),
        makeBombEvent({ tick: start, kind: "begin_defuse", haskit: false, player: 0 }),
        makeBombEvent({ tick: release, kind: "abort_defuse", player: 0 }),
      ],
    });
    expect(defuseClock(m, start + 64)?.remaining).toBeCloseTo(DEFUSE_WITHOUT_KIT_SECONDS - 1, 5);
    expect(defuseClock(m, release)).toBeNull();
    expect(defuseClock(m, release + 32)).toBeNull();
  });

  it("ends a tap fake when the defuse flag drops and abort_defuse never arrives", () => {
    const begin = 200;
    // Not the parser default of 4. One stride is still slack; two strides is the release.
    const stride = 8;
    const slack = stride * 2;
    const m = clockReplay({
      header: { tick_stride: stride },
      ticks: defusingSamples(1, [
        { tick: begin },
        { tick: begin + 4 },
        { tick: begin + stride },
        { tick: begin + slack },
        { tick: begin + 64 },
      ]),
      bombEvents: [
        makeBombEvent({ tick: 100, kind: "planted" }),
        makeBombEvent({ tick: begin, kind: "begin_defuse", haskit: false, player: 0 }),
      ],
    });
    expect(m.header.tick_stride).toBe(stride);
    expect(defuseClock(m, begin)?.remaining).toBeCloseTo(DEFUSE_WITHOUT_KIT_SECONDS, 5);
    expect(defuseClock(m, begin + 4)?.remaining).toBeCloseTo(
      DEFUSE_WITHOUT_KIT_SECONDS - 4 / 64,
      5,
    );
    expect(defuseClock(m, begin + stride)?.remaining).toBeCloseTo(
      DEFUSE_WITHOUT_KIT_SECONDS - stride / 64,
      5,
    );
    expect(defuseClock(m, begin + slack)).toBeNull();
    expect(defuseClock(m, begin + 64)).toBeNull();
  });

  it("ends a hold fake when the defuse flag drops and abort_defuse never arrives", () => {
    const begin = 200;
    const release = begin + 64 * 2;
    const m = clockReplay({
      ticks: defusingSamples(1, [
        { tick: begin, defusing: [0] },
        { tick: begin + 64, defusing: [0] },
        { tick: release },
        { tick: release + 64 },
      ]),
      bombEvents: [
        makeBombEvent({ tick: 100, kind: "planted" }),
        makeBombEvent({ tick: begin, kind: "begin_defuse", haskit: false, player: 0 }),
      ],
    });
    expect(defuseClock(m, begin + 64)?.remaining).toBeCloseTo(DEFUSE_WITHOUT_KIT_SECONDS - 1, 5);
    expect(defuseClock(m, release - 1)?.remaining).toBeCloseTo(
      DEFUSE_WITHOUT_KIT_SECONDS - (64 * 2 - 1) / 64,
      5,
    );
    expect(defuseClock(m, release)).toBeNull();
    expect(defuseClock(m, release + 32)).toBeNull();
  });

  it("starts a fresh clock on a new begin after the flag dropped", () => {
    const first = 200;
    const stride = 4;
    const second = 400;
    const m = clockReplay({
      header: { tick_stride: stride },
      ticks: defusingSamples(2, [
        { tick: first, defusing: [0] },
        { tick: first + stride },
        { tick: first + stride * 2 },
        { tick: second },
        { tick: second + stride * 2, defusing: [1] },
        { tick: second + 64, defusing: [1] },
      ]),
      bombEvents: [
        makeBombEvent({ tick: 100, kind: "planted" }),
        makeBombEvent({ tick: first, kind: "begin_defuse", haskit: false, player: 0 }),
        makeBombEvent({ tick: second, kind: "begin_defuse", haskit: true, player: 1 }),
      ],
    });
    expect(defuseClock(m, first + stride)?.remaining).toBeCloseTo(
      DEFUSE_WITHOUT_KIT_SECONDS - stride / 64,
      5,
    );
    expect(defuseClock(m, first + stride * 2)).toBeNull();
    expect(defuseClock(m, second)?.remaining).toBeCloseTo(DEFUSE_WITH_KIT_SECONDS, 5);
    expect(defuseClock(m, second)?.haskit).toBe(true);
    expect(defuseClock(m, second + 64)?.remaining).toBeCloseTo(DEFUSE_WITH_KIT_SECONDS - 1, 5);
  });

  it("does not start a flag clock before begin_defuse when the plant has defuse events", () => {
    const m = clockReplay({
      ticks: defusingSamples(1, [
        { tick: 64 },
        { tick: 160, defusing: [0] },
        { tick: 200, defusing: [0] },
      ]),
      bombEvents: [
        makeBombEvent({ tick: 100, kind: "planted" }),
        makeBombEvent({ tick: 200, kind: "begin_defuse", haskit: false, player: 0 }),
      ],
    });
    expect(defuseClock(m, 180)).toBeNull();
    expect(defuseClock(m, 200)?.remaining).toBeCloseTo(DEFUSE_WITHOUT_KIT_SECONDS, 5);
  });

  it("restarts from full time on begin, abort, begin, defused", () => {
    const first = 200;
    const abort = first + 64;
    const second = 400;
    const defused = second + 64 * 4;
    const m = clockReplay({
      ticks: defusingSamples(1, [
        { tick: 64 },
        { tick: first, defusing: [0] },
        { tick: defused, defusing: [0] },
      ]),
      bombEvents: [
        makeBombEvent({ tick: 100, kind: "planted" }),
        makeBombEvent({ tick: first, kind: "begin_defuse", haskit: false, player: 0 }),
        makeBombEvent({ tick: abort, kind: "abort_defuse", player: 0 }),
        makeBombEvent({ tick: second, kind: "begin_defuse", haskit: false, player: 0 }),
        makeBombEvent({ tick: defused, kind: "defused", player: 0 }),
      ],
    });
    expect(defuseClock(m, first + 32)?.remaining).toBeCloseTo(DEFUSE_WITHOUT_KIT_SECONDS - 0.5, 5);
    expect(defuseClock(m, abort)).toBeNull();
    expect(defuseClock(m, second - 1)).toBeNull();
    expect(defuseClock(m, second)?.remaining).toBeCloseTo(DEFUSE_WITHOUT_KIT_SECONDS, 5);
    expect(defuseClock(m, second + 64)?.remaining).toBeCloseTo(DEFUSE_WITHOUT_KIT_SECONDS - 1, 5);
    expect(defuseClock(m, defused)).toBeNull();
  });

  it("uses the new defuser's kit after an abort", () => {
    const stuck = defusingSamples(2, [
      { tick: 64 },
      { tick: 200, defusing: [0, 1], kit: [0] },
      { tick: 800, defusing: [0, 1], kit: [0] },
    ]);
    const toKit = clockReplay({
      ticks: stuck,
      bombEvents: [
        makeBombEvent({ tick: 100, kind: "planted" }),
        makeBombEvent({ tick: 200, kind: "begin_defuse", haskit: false, player: 0 }),
        makeBombEvent({ tick: 280, kind: "abort_defuse", player: 0 }),
        makeBombEvent({ tick: 360, kind: "begin_defuse", haskit: true, player: 1 }),
      ],
    });
    expect(defuseClock(toKit, 300)).toBeNull();
    expect(defuseClock(toKit, 360)).toEqual({
      remaining: DEFUSE_WITH_KIT_SECONDS,
      haskit: true,
    });

    const noKitBegin = makeBombEvent({
      tick: 360,
      kind: "begin_defuse",
      haskit: false,
      player: 1,
    });
    const toBare = clockReplay({
      ticks: stuck,
      bombEvents: [
        makeBombEvent({ tick: 100, kind: "planted" }),
        makeBombEvent({ tick: 200, kind: "begin_defuse", haskit: true, player: 0 }),
        makeBombEvent({ tick: 280, kind: "abort_defuse", player: 0 }),
        noKitBegin,
      ],
    });
    expect(defuseClock(toBare, 360)).toEqual({
      remaining: DEFUSE_WITHOUT_KIT_SECONDS,
      haskit: false,
    });
    expect(noKitBegin.haskit).toBe(false);
  });

  it("keeps the 10s clock when the event has no kit even if the column shows one", () => {
    const beginTick = 200;
    const stride = 4;
    const ready = beginTick + stride * 2;
    const begin = makeBombEvent({
      tick: beginTick,
      kind: "begin_defuse",
      haskit: false,
      player: 0,
    });
    const m = clockReplay({
      header: { tick_stride: stride },
      ticks: defusingSamples(1, [
        { tick: beginTick, defusing: [0], kit: [0] },
        { tick: ready, defusing: [0], kit: [0] },
      ]),
      bombEvents: [makeBombEvent({ tick: 100, kind: "planted" }), begin],
    });
    expect(defuseClock(m, beginTick)).toEqual({
      remaining: DEFUSE_WITHOUT_KIT_SECONDS,
      haskit: false,
    });
    expect(defuseClock(m, ready)).toEqual({
      remaining: DEFUSE_WITHOUT_KIT_SECONDS - (ready - beginTick) / 64,
      haskit: false,
    });
    expect(begin.haskit).toBe(false);
  });

  it("keeps the clock until defused when the flag is on a different slot than the event", () => {
    const begin = 200;
    const stride = 4;
    const ready = begin + stride * 2;
    const done = begin + 64 * 4;
    const event = makeBombEvent({
      tick: begin,
      kind: "begin_defuse",
      haskit: false,
      player: 0,
    });
    const m = clockReplay({
      header: { tick_stride: stride },
      ticks: defusingSamples(2, [
        { tick: begin, defusing: [1], kit: [1] },
        { tick: ready, defusing: [1], kit: [1] },
        { tick: done, defusing: [1], kit: [1] },
      ]),
      bombEvents: [
        makeBombEvent({ tick: 100, kind: "planted" }),
        event,
        makeBombEvent({ tick: done, kind: "defused", player: 1 }),
      ],
    });
    expect(defuseClock(m, begin)).toEqual({
      remaining: DEFUSE_WITHOUT_KIT_SECONDS,
      haskit: false,
    });
    expect(defuseClock(m, ready)?.haskit).toBe(false);
    expect(defuseClock(m, ready)?.remaining).toBeCloseTo(
      DEFUSE_WITHOUT_KIT_SECONDS - (ready - begin) / 64,
      5,
    );
    expect(defuseClock(m, done - 1)?.remaining).toBeCloseTo(
      DEFUSE_WITHOUT_KIT_SECONDS - (done - 1 - begin) / 64,
      5,
    );
    expect(defuseClock(m, done)).toBeNull();
    expect(event.haskit).toBe(false);
  });

  it("ends the clock when the defuser is killed, even if the sample is still defusing", () => {
    const m = clockReplay({
      ticks: defusingSamples(1, [
        { tick: 200, defusing: [0] },
        { tick: 500, defusing: [0] },
      ]),
      kills: [makeKill(250, 1, 1), makeKill(300, 1, 0)],
      bombEvents: [
        makeBombEvent({ tick: 100, kind: "planted" }),
        makeBombEvent({ tick: 200, kind: "begin_defuse", haskit: false, player: 0 }),
      ],
    });
    expect(defuseClock(m, 280)?.remaining).toBeCloseTo(DEFUSE_WITHOUT_KIT_SECONDS - 80 / 64, 5);
    expect(defuseClock(m, 300)).toBeNull();
    expect(defuseClock(m, 400)).toBeNull();
  });

  it("ends a flags-only defuse when the defuser is killed", () => {
    const m = clockReplay({
      ticks: defusingSamples(1, [
        { tick: 200, defusing: [0] },
        { tick: 500, defusing: [0] },
      ]),
      kills: [makeKill(300, 1, 0)],
      bombEvents: [makeBombEvent({ tick: 100, kind: "planted" })],
    });
    expect(defuseClock(m, 280)?.remaining).toBeCloseTo(DEFUSE_WITHOUT_KIT_SECONDS - 80 / 64, 5);
    expect(defuseClock(m, 300)).toBeNull();
  });

  it("ignores a kill from before this defuse attempt", () => {
    const m = clockReplay({
      ticks: defusingSamples(1, [
        { tick: 200, defusing: [0] },
        { tick: 250, defusing: [0] },
      ]),
      kills: [makeKill(80, 1, 0)],
      bombEvents: [
        makeBombEvent({ tick: 100, kind: "planted" }),
        makeBombEvent({ tick: 200, kind: "begin_defuse", haskit: false, player: 0 }),
      ],
    });
    expect(defuseClock(m, 250)?.remaining).toBeCloseTo(DEFUSE_WITHOUT_KIT_SECONDS - 50 / 64, 5);
  });

  it("ends on a kill of the begin player during slack, not on that slot's pawn", () => {
    const begin = 200;
    const stride = 8;
    const killed = clockReplay({
      header: { tick_stride: stride },
      ticks: defusingSamples(2, [
        { tick: begin, defusing: [1] },
        { tick: begin + stride * 2, defusing: [1] },
      ]),
      kills: [makeKill(begin + stride, 1, 0)],
      bombEvents: [
        makeBombEvent({ tick: 100, kind: "planted" }),
        makeBombEvent({ tick: begin, kind: "begin_defuse", haskit: false, player: 0 }),
      ],
    });
    expect(defuseClock(killed, begin + stride - 1)).not.toBeNull();
    expect(defuseClock(killed, begin + stride)).toBeNull();

    const pawn = clockReplay({
      ticks: defusingSamples(2, [
        { tick: begin, defusing: [1] },
        { tick: 300, defusing: [1], dead: [0], gone: [0] },
      ]),
      bombEvents: [
        makeBombEvent({ tick: 100, kind: "planted" }),
        makeBombEvent({ tick: begin, kind: "begin_defuse", haskit: false, player: 0 }),
      ],
    });
    expect(defuseClock(pawn, 300)?.remaining).toBeCloseTo(
      DEFUSE_WITHOUT_KIT_SECONDS - (300 - begin) / 64,
      5,
    );
  });

  it("does not start a flag clock for a T pawn", () => {
    const m = clockReplay({
      ticks: defusingSamples(1, [{ tick: 200, defusing: [0] }], "T"),
      bombEvents: [makeBombEvent({ tick: 100, kind: "planted" })],
    });
    expect(defuseClock(m, 200)).toBeNull();
  });

  it("ends the clock when the bomb explodes", () => {
    const withEvents = clockReplay({
      ticks: defusingSamples(1, [
        { tick: 200, defusing: [0] },
        { tick: 800, defusing: [0] },
      ]),
      bombEvents: [
        makeBombEvent({ tick: 100, kind: "planted" }),
        makeBombEvent({ tick: 200, kind: "begin_defuse", haskit: false, player: 0 }),
        makeBombEvent({ tick: 400, kind: "exploded" }),
      ],
    });
    expect(defuseClock(withEvents, 399)).not.toBeNull();
    expect(defuseClock(withEvents, 400)).toBeNull();
    expect(defuseClock(withEvents, 500)).toBeNull();

    const flagsOnly = clockReplay({
      ticks: defusingSamples(1, [
        { tick: 200, defusing: [0] },
        { tick: 800, defusing: [0] },
      ]),
      bombEvents: [
        makeBombEvent({ tick: 100, kind: "planted" }),
        makeBombEvent({ tick: 400, kind: "exploded" }),
      ],
    });
    expect(defuseClock(flagsOnly, 300)).not.toBeNull();
    expect(defuseClock(flagsOnly, 400)).toBeNull();
  });
});

describe("plantClock", () => {
  it("counts a 3.2s plant after begin_plant", () => {
    const m = makeReplay({
      players: [makePlayer(0, "T", "A")],
      rounds: [
        makeRound({ number: 1, winner: "T", start_tick: 0, freeze_end_tick: 64, end_tick: 2000 }),
      ],
      bombEvents: [makeBombEvent({ tick: 200, kind: "begin_plant", player: 0 })],
    });
    expect(plantClock(m, 199)).toBeNull();
    expect(plantClock(m, 200)?.remaining).toBeCloseTo(PLANT_SECONDS, 5);
    expect(plantClock(m, 200 + 64)?.remaining).toBeCloseTo(PLANT_SECONDS - 1, 5);
  });

  it("clears when the bomb is planted or the clock expires", () => {
    const m = makeReplay({
      players: [makePlayer(0, "T", "A")],
      rounds: [
        makeRound({ number: 1, winner: "T", start_tick: 0, freeze_end_tick: 64, end_tick: 2000 }),
      ],
      bombEvents: [
        makeBombEvent({ tick: 200, kind: "begin_plant", player: 0 }),
        makeBombEvent({ tick: 200 + Math.round(PLANT_SECONDS * 64), kind: "planted", player: 0 }),
      ],
    });
    const plantTick = 200 + Math.round(PLANT_SECONDS * 64);
    expect(plantClock(m, plantTick - 1)?.remaining).toBeGreaterThan(0);
    expect(plantClock(m, plantTick)).toBeNull();
  });

  it("starts from FLAG_PLANTING when GOTV has no begin_plant", () => {
    const ticks = makeTicks(1, 2);
    ticks.ticks[0] = 64;
    ticks.ticks[1] = 200;
    ticks.flags[0] = FLAG_PRESENT | FLAG_ALIVE;
    ticks.flags[1] = FLAG_PRESENT | FLAG_ALIVE | FLAG_PLANTING;
    const m = makeReplay({
      players: [makePlayer(0, "T", "A")],
      rounds: [
        makeRound({ number: 1, winner: "T", start_tick: 0, freeze_end_tick: 64, end_tick: 2000 }),
      ],
      ticks,
    });
    expect(plantClock(m, 199)).toBeNull();
    expect(plantClock(m, 200)?.remaining).toBeCloseTo(PLANT_SECONDS, 5);
  });
});

describe("bombView", () => {
  it("is planted while the fuse is running", () => {
    const m = makeReplay({
      players: [makePlayer(0, "CT", "A"), makePlayer(1, "T", "B")],
      rounds: [
        makeRound({ number: 1, winner: "T", start_tick: 0, freeze_end_tick: 64, end_tick: 4000 }),
      ],
      ticks: makeFreezeTicks(2, 1),
      bombEvents: [makeBombEvent({ tick: 200, kind: "planted", x: 120, y: 220, player: 1 })],
    });
    expect(bombView(m, 199)).toEqual({ state: "none" });
    expect(bombView(m, 200)).toEqual({
      state: "planted",
      remaining: BOMB_SECONDS,
      x: 120,
      y: 220,
    });
    expect(bombView(m, 200 + 64)).toEqual({
      state: "planted",
      remaining: BOMB_SECONDS - 1,
      x: 120,
      y: 220,
    });
  });

  it("is carried when a present pawn has GEAR_C4", () => {
    const ticks = makeFreezeTicks(2, 1);
    ticks.gear[1] = GEAR_C4;
    const m = makeReplay({
      players: [makePlayer(0, "CT", "A"), makePlayer(1, "T", "B")],
      rounds: [
        makeRound({ number: 1, winner: "T", start_tick: 0, freeze_end_tick: 64, end_tick: 4000 }),
      ],
      ticks,
    });
    expect(bombView(m, 64)).toEqual({ state: "carried", player: 1 });
  });

  it("is loose at the last drop until pickup or plant", () => {
    const m = makeReplay({
      players: [makePlayer(0, "CT", "A"), makePlayer(1, "T", "B")],
      rounds: [
        makeRound({ number: 1, winner: "T", start_tick: 0, freeze_end_tick: 64, end_tick: 4000 }),
      ],
      ticks: makeFreezeTicks(2, 1),
      bombEvents: [
        makeBombEvent({ tick: 200, kind: "dropped", x: 50, y: 60, player: 1 }),
        makeBombEvent({ tick: 400, kind: "pickup", player: 1 }),
      ],
    });
    expect(bombView(m, 200)).toEqual({ state: "loose", x: 50, y: 60 });
    expect(bombView(m, 400)).toEqual({ state: "none" });
  });
});
