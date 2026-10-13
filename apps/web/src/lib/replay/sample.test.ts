import { describe, expect, it } from "vitest";
import { DEFAULT_TICK_RATE } from "@/lib/shared/constants";
import {
  currentRound,
  grenadeRoundLastTick,
  samplePlayer,
  samplePlayers,
  trailingFlagStart,
} from "./sample";
import { pawnInterpMaxDistance } from "./interpolate";
import {
  FLAG_ALIVE,
  FLAG_CT,
  FLAG_DEFUSING,
  FLAG_PLANTING,
  FLAG_PRESENT,
  type Replay,
  type TickBuffers,
} from "@/lib/replay/replayTypes";
import { makePlayer, makeReplay, makeRound, makeTicks } from "@/lib/testing/fixtures";

describe("samplePlayer", () => {
  it("returns one pawn and null for a missing slot", () => {
    const ticks = makeTicks(2, 1);
    ticks.ticks[0] = 80;
    ticks.x[0] = 10;
    ticks.y[0] = 20;
    ticks.flags[0] = FLAG_PRESENT | FLAG_ALIVE | FLAG_CT | FLAG_DEFUSING;
    ticks.flags[1] = FLAG_PRESENT | FLAG_ALIVE | FLAG_PLANTING;
    ticks.active[0] = 23;
    const m = makeReplay({ ticks });
    const a = samplePlayer(m, 0, 80);
    expect(a?.x).toBe(10);
    expect(a?.ct).toBe(true);
    expect(a?.defusing).toBe(true);
    expect(a?.planting).toBe(false);
    expect(samplePlayer(m, 1, 80)?.planting).toBe(true);
    expect(a?.active).toBe(23);
    expect(a?.clip).toBe(0);
    expect(samplePlayer(m, 2, 80)).toBeNull();
    expect(samplePlayers(m, 80)).toHaveLength(2);
  });

  it("draws the later sample between a death instead of sliding", () => {
    const ticks = makeTicks(1, 2);
    ticks.ticks[0] = 0;
    ticks.ticks[1] = 4;
    ticks.x[0] = 0;
    ticks.x[1] = 10;
    ticks.flags[0] = FLAG_PRESENT | FLAG_ALIVE;
    ticks.flags[1] = FLAG_PRESENT;
    const replay = makeReplay({ ticks, players: [makePlayer(0, "CT", "A")] });
    expect(samplePlayer(replay, 0, 0)).toMatchObject({ x: 0, alive: true });
    expect(samplePlayer(replay, 0, 2)).toMatchObject({
      x: 10,
      alive: false,
      present: true,
    });
  });

  it("reuses the snapshot for a tick it already sampled", () => {
    const ticks = makeTicks(2, 1);
    ticks.ticks[0] = 80;
    ticks.flags[0] = FLAG_PRESENT | FLAG_ALIVE;
    const m = makeReplay({ ticks });
    expect(samplePlayers(m, 80)).toBe(samplePlayers(m, 80));
    expect(samplePlayers(m, 90)).not.toBe(samplePlayers(m, 80));
  });
});

describe("currentRound", () => {
  const rounds = [
    makeRound({ number: 0, is_knife: true, start_tick: 0, end_tick: 100 }),
    makeRound({ number: 1, start_tick: 200, end_tick: 900 }),
    makeRound({ number: 2, start_tick: 1000, end_tick: 1800 }),
    makeRound({ number: 3, start_tick: 2000, end_tick: 2800 }),
  ];
  const replay = makeReplay({ rounds });

  it("takes the last round that has started", () => {
    expect(currentRound(replay, 0)?.number).toBe(0);
    expect(currentRound(replay, 200)?.number).toBe(1);
    expect(currentRound(replay, 500)?.number).toBe(1);
    expect(currentRound(replay, 2500)?.number).toBe(3);
    expect(currentRound(replay, 99999)?.number).toBe(3);
  });

  it("keeps the gap after a competitive round inside that round", () => {
    // Round 1 ended at 900 but round 2 has not started, so 950 is still R1.
    expect(currentRound(replay, 950)?.number).toBe(1);
  });

  it("leaves the knife round at end_tick so the post-knife restart is already R1", () => {
    expect(currentRound(replay, 100)?.number).toBe(0);
    expect(currentRound(replay, 101)?.number).toBe(1);
    expect(currentRound(replay, 150)?.number).toBe(1);
  });

  it("closes the grenade window on the tick before the next freeze", () => {
    expect(grenadeRoundLastTick(rounds, rounds[1])).toBe(999);
    expect(grenadeRoundLastTick(rounds, rounds[3])).toBe(Number.MAX_SAFE_INTEGER);
  });

  it("falls back to the first round before the demo starts, and null with no rounds", () => {
    expect(currentRound(replay, -50)?.number).toBe(0);
    expect(currentRound(makeReplay({ rounds: [] }), 100)).toBeNull();
  });
});

/** Old linear scan — F4 must match this, including fromTick clamp and sparse frames. */
function naiveTrailingFlagStart(
  replay: Replay,
  player: number,
  flag: number,
  fromTick: number,
  toTick: number,
): number | null {
  const buf = replay.ticks;
  const pc = buf.playerCount;
  if (pc === 0 || player < 0 || player >= pc || buf.frameCount === 0) return null;
  let start: number | null = null;
  let on = false;
  for (let f = 0; f < buf.frameCount; f++) {
    const t = buf.ticks[f];
    if (t > toTick) break;
    const flags = buf.flags[f * pc + player];
    if ((flags & flag) !== 0) {
      if (!on) start = Math.max(t, fromTick);
      on = true;
    } else {
      start = null;
      on = false;
    }
  }
  return on ? start : null;
}

function flagReplay(frameTicks: number[], onAtFrame: boolean[], flag = FLAG_DEFUSING): Replay {
  const ticks = makeTicks(1, frameTicks.length);
  for (let f = 0; f < frameTicks.length; f++) {
    ticks.ticks[f] = frameTicks[f];
    ticks.flags[f] = FLAG_PRESENT | FLAG_ALIVE | (onAtFrame[f] ? flag : 0);
  }
  return makeReplay({ ticks });
}

describe("trailingFlagStart", () => {
  it("returns null when the flag is off at toTick, before the first frame, or for a bad slot", () => {
    const replay = flagReplay([64, 200], [false, true]);
    expect(trailingFlagStart(replay, 0, FLAG_DEFUSING, 0, 63)).toBeNull();
    expect(trailingFlagStart(replay, 0, FLAG_DEFUSING, 0, 199)).toBeNull();
    expect(trailingFlagStart(replay, 1, FLAG_DEFUSING, 0, 200)).toBeNull();
    expect(
      trailingFlagStart(makeReplay({ ticks: makeTicks() }), 0, FLAG_DEFUSING, 0, 200),
    ).toBeNull();
  });

  it("returns the first tick of the run that still covers toTick", () => {
    const replay = flagReplay([64, 128, 192, 256], [false, true, true, false]);
    expect(trailingFlagStart(replay, 0, FLAG_DEFUSING, 0, 128)).toBe(128);
    expect(trailingFlagStart(replay, 0, FLAG_DEFUSING, 0, 192)).toBe(128);
    expect(trailingFlagStart(replay, 0, FLAG_DEFUSING, 0, 200)).toBe(128);
    expect(trailingFlagStart(replay, 0, FLAG_DEFUSING, 0, 256)).toBeNull();
  });

  it("clamps the start to fromTick when the run was already on", () => {
    const replay = flagReplay([64, 200], [true, true]);
    expect(trailingFlagStart(replay, 0, FLAG_DEFUSING, 100, 200)).toBe(100);
  });

  it("uses the latest run after a gap, not an earlier plant/defuse attempt", () => {
    const replay = flagReplay([100, 200, 300, 400], [true, false, true, true], FLAG_PLANTING);
    expect(trailingFlagStart(replay, 0, FLAG_PLANTING, 0, 200)).toBeNull();
    expect(trailingFlagStart(replay, 0, FLAG_PLANTING, 0, 400)).toBe(300);
  });

  it("skips a long off prefix (binary search) and keeps the same start while the run lasts", () => {
    const n = 512;
    const frameTicks = Array.from({ length: n }, (_, f) => f * 4);
    const onAtFrame = frameTicks.map((t) => t >= 1800 && t <= 2000);
    const replay = flagReplay(frameTicks, onAtFrame, FLAG_PLANTING);
    expect(trailingFlagStart(replay, 0, FLAG_PLANTING, 0, 1796)).toBeNull();
    expect(trailingFlagStart(replay, 0, FLAG_PLANTING, 0, 1800)).toBe(1800);
    expect(trailingFlagStart(replay, 0, FLAG_PLANTING, 0, 1900)).toBe(1800);
    expect(trailingFlagStart(replay, 0, FLAG_PLANTING, 0, 2000)).toBe(1800);
    expect(trailingFlagStart(replay, 0, FLAG_PLANTING, 0, 2004)).toBeNull();
  });

  it("does not reuse a cached start across a gap into a later run", () => {
    const replay = flagReplay(
      [100, 200, 300, 400, 500, 600],
      [true, true, false, false, true, true],
      FLAG_PLANTING,
    );
    expect(trailingFlagStart(replay, 0, FLAG_PLANTING, 0, 200)).toBe(100);
    expect(trailingFlagStart(replay, 0, FLAG_PLANTING, 0, 600)).toBe(500);
    expect(trailingFlagStart(replay, 0, FLAG_PLANTING, 0, 200)).toBe(100);
  });

  it("matches the linear scan on sparse frames and mixed runs", () => {
    const frameTicks = Array.from({ length: 80 }, (_, f) => 40 + f * 8);
    const onAtFrame = frameTicks.map((t) => (t >= 120 && t < 200) || (t >= 400 && t <= 480));
    const replay = flagReplay(frameTicks, onAtFrame);
    for (const fromTick of [0, 100, 150, 400]) {
      for (let toTick = 20; toTick <= 520; toTick += 7) {
        expect(trailingFlagStart(replay, 0, FLAG_DEFUSING, fromTick, toTick)).toBe(
          naiveTrailingFlagStart(replay, 0, FLAG_DEFUSING, fromTick, toTick),
        );
      }
    }
  });
});

/**
 * Inferno assets-v2 knife window: knife ends at 2695, `skip_warmup` drops
 * ticks 2842–3986 after the spawn teleport at 2841. Four alive pawns sit up
 * to 3664 units apart across that 1146-tick hole (~205 u/s), under the speed snap.
 */
const WARMUP_STRIDE = 4;
const KNIFE_END = 2695;
const LAST_BEFORE_HOLE = 2841;
const HOLE_TICKS = 1146;
const FIRST_AFTER_HOLE = LAST_BEFORE_HOLE + HOLE_TICKS;
const GLIDE_X = 3664;
const HOLE_PLAYERS = 4;

const HOLE_SHIFTS = [
  { dx: GLIDE_X, dy: 0 },
  { dx: 0, dy: 2800 },
  { dx: 2000, dy: 1500 },
  { dx: 640, dy: -480 },
];

function warmupHoleReplay(): { replay: Replay; ticks: TickBuffers; before: number; after: number } {
  const frameTicks: number[] = [];
  for (let step = 4; step >= 0; step--) frameTicks.push(LAST_BEFORE_HOLE - step * WARMUP_STRIDE);
  const before = frameTicks.length - 1;
  frameTicks.push(FIRST_AFTER_HOLE);
  const after = frameTicks.length - 1;
  frameTicks.push(FIRST_AFTER_HOLE + WARMUP_STRIDE, FIRST_AFTER_HOLE + WARMUP_STRIDE * 2);

  const ticks = makeTicks(HOLE_PLAYERS, frameTicks.length);
  for (let frame = 0; frame < frameTicks.length; frame++) {
    ticks.ticks[frame] = frameTicks[frame];
    const past = frame >= after;
    for (let player = 0; player < HOLE_PLAYERS; player++) {
      const slot = frame * HOLE_PLAYERS + player;
      const shift = HOLE_SHIFTS[player];
      const preX = player * 100 + before * 8;
      ticks.x[slot] = past ? preX + shift.dx + (frame - after) * 8 : player * 100 + frame * 8;
      ticks.y[slot] = player * 40 + (past ? shift.dy : 0);
      ticks.yaw[slot] = past ? 90 : 10;
      ticks.flags[slot] = FLAG_PRESENT | FLAG_ALIVE;
    }
  }

  const replay = makeReplay({
    header: { map_name: "de_inferno", tick_stride: WARMUP_STRIDE },
    players: [0, 1, 2, 3].map((index) => makePlayer(index, index < 2 ? "CT" : "T", `P${index}`)),
    rounds: [
      makeRound({
        number: 0,
        is_knife: true,
        start_tick: 2000,
        freeze_end_tick: 2064,
        end_tick: KNIFE_END,
      }),
    ],
    ticks,
  });
  return { replay, ticks, before, after };
}

function aliveStrideReplay(headerStride: number, frameTicks: number[], xs: number[]): Replay {
  const ticks = makeTicks(1, frameTicks.length);
  for (let frame = 0; frame < frameTicks.length; frame++) {
    ticks.ticks[frame] = frameTicks[frame];
    ticks.x[frame] = xs[frame];
    ticks.flags[frame] = FLAG_PRESENT | FLAG_ALIVE;
  }
  return makeReplay({
    header: { tick_stride: headerStride },
    players: [makePlayer(0, "CT", "A")],
    ticks,
  });
}

describe("frame holes", () => {
  it("holds the last frame across a warmup hole, then snaps, and still blends a normal stride", () => {
    const { replay, ticks, before, after } = warmupHoleReplay();
    const holeMid = LAST_BEFORE_HOLE + HOLE_TICKS / 2;
    const inside = [LAST_BEFORE_HOLE + 1, holeMid, FIRST_AFTER_HOLE - 1];
    const limit = pawnInterpMaxDistance(HOLE_TICKS, DEFAULT_TICK_RATE);
    expect(KNIFE_END).toBeLessThan(LAST_BEFORE_HOLE);
    expect(samplePlayers(replay, holeMid)).toHaveLength(HOLE_PLAYERS);

    for (let player = 0; player < HOLE_PLAYERS; player++) {
      const held = before * HOLE_PLAYERS + player;
      const snapped = after * HOLE_PLAYERS + player;
      const distance = Math.hypot(
        ticks.x[snapped] - ticks.x[held],
        ticks.y[snapped] - ticks.y[held],
      );
      expect(distance).toBeGreaterThan(400);
      expect(distance).toBeLessThan(limit);
      for (const tick of inside) {
        expect(samplePlayer(replay, player, tick)).toMatchObject({
          x: ticks.x[held],
          y: ticks.y[held],
          yaw: ticks.yaw[held],
          alive: true,
          present: true,
        });
      }
      expect(samplePlayer(replay, player, FIRST_AFTER_HOLE)).toMatchObject({
        x: ticks.x[snapped],
        y: ticks.y[snapped],
        yaw: ticks.yaw[snapped],
        alive: true,
      });

      const prev = before - 1;
      const midBefore = (ticks.ticks[prev] + ticks.ticks[before]) / 2;
      expect(samplePlayer(replay, player, midBefore)?.x).toBe(
        (ticks.x[prev * HOLE_PLAYERS + player] + ticks.x[held]) / 2,
      );
      const next = after + 1;
      const midAfter = (ticks.ticks[after] + ticks.ticks[next]) / 2;
      expect(samplePlayer(replay, player, midAfter)?.x).toBe(
        (ticks.x[snapped] + ticks.x[next * HOLE_PLAYERS + player]) / 2,
      );
    }
    expect(Math.hypot(HOLE_SHIFTS[0].dx, HOLE_SHIFTS[0].dy)).toBe(GLIDE_X);
  });

  it("uses twice the measured stride, not the header, as the hole threshold", () => {
    const stride = 6;
    const blend = aliveStrideReplay(
      1,
      [0, stride, stride * 2, stride * 3, stride * 5],
      [0, 10, 20, 30, 40],
    );
    expect(samplePlayer(blend, 0, stride * 4)?.x).toBe(35);

    const hold = aliveStrideReplay(
      1,
      [0, stride, stride * 2, stride * 3, stride * 5 + 1],
      [0, 10, 20, 30, 80],
    );
    expect(samplePlayer(hold, 0, stride * 4)?.x).toBe(30);
    expect(samplePlayer(hold, 0, stride * 5 + 1)?.x).toBe(80);
  });
});
