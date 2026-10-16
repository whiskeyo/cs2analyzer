/**
 * Timeline totals against Score and the HUD at the max seekable tick.
 * Opt-in: the files are hundreds of megabytes and are not in git.
 *
 *     CS2_MIRAGE_DEMO=/path/mirage.dem CS2_INFERNO_DEMO=/path/inferno.dem \
 *       npx vitest run src/lib/stats/timelineScore.fixture.test.ts
 *
 * Also picks the files up from test-demos/files or .demos when those names exist.
 */

import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { initSync, parseDemo } from "@/parser/cs2analyzer_wasm.js";
import { decodeList, decodeObject } from "@/lib/parse/decode";
import { playerLabel } from "@/lib/replay/playerLabel";
import type {
  Blind,
  BombEvent,
  BuyEvent,
  GrenadeThrow,
  Hurt,
  Kill,
  MatchHeader,
  Player,
  Replay,
  Round,
  Shot,
} from "@/lib/replay/replayTypes";
import { roundPlaybackFallback } from "@/lib/playback/roundAutoplay";
import { roundScrubRange } from "@/lib/playback/roundTimeline";
import { computeStats } from "./computeStats";
import { liveScore } from "./liveScore";
import { scoreRoster } from "./scoreRoster";
import { statsTimeline, timelineRounds } from "./timeline";

const REPO = resolve(__dirname, "../../../../..");
const MIRAGE = "1-b5045d4d-daaf-4ab6-82de-3c345a0e6930-1-1.dem";
const INFERNO = "fruju-vs-rooster-m1-inferno.dem";

function locate(env: string | undefined, name: string): string | null {
  const candidates = [env, join(REPO, "test-demos/files", name), join(REPO, ".demos", name)].filter(
    (path): path is string => !!path,
  );
  return candidates.find((path) => existsSync(path)) ?? null;
}

const mirage = locate(process.env.CS2_MIRAGE_DEMO, MIRAGE);
const inferno = locate(process.env.CS2_INFERNO_DEMO, INFERNO);

function copyU32(view: Uint32Array): Uint32Array {
  return view.slice();
}
function copyF32(view: Float32Array): Float32Array {
  return view.slice();
}
function copyU8(view: Uint8Array): Uint8Array {
  return view.slice();
}
function copyU16(view: Uint16Array): Uint16Array {
  return view.slice();
}

function loadReplay(path: string): Replay {
  const wasm = readFileSync(new URL("../../parser/cs2analyzer_wasm_bg.wasm", import.meta.url));
  initSync({ module: wasm });
  const parsed = parseDemo(new Uint8Array(readFileSync(path)), 4, true);
  const replay: Replay = {
    header: decodeObject<MatchHeader>("header", parsed.headerJson()),
    players: decodeList<Player>("players", parsed.playersJson()),
    rounds: decodeList<Round>("rounds", parsed.roundsJson()),
    grenades: decodeList<GrenadeThrow>("grenades", parsed.grenadesJson()),
    shots: decodeList<Shot>("shots", parsed.shotsJson()),
    kills: decodeList<Kill>("kills", parsed.killsJson()),
    hurts: decodeList<Hurt>("hurts", parsed.hurtsJson()),
    blinds: decodeList<Blind>("blinds", parsed.blindsJson()),
    bombEvents: decodeList<BombEvent>("bombEvents", parsed.bombEventsJson()),
    buyEvents: decodeList<BuyEvent>("buyEvents", parsed.buyEventsJson()),
    ticks: {
      frameCount: parsed.frameCount(),
      playerCount: parsed.playerCount(),
      ticks: copyU32(parsed.ticks()),
      x: copyF32(parsed.x()),
      y: copyF32(parsed.y()),
      z: copyF32(parsed.z()),
      yaw: copyF32(parsed.yaw()),
      health: copyU8(parsed.health()),
      armor: copyU8(parsed.armor()),
      flags: copyU8(parsed.flags()),
      money: copyU16(parsed.money()),
      equip: copyU16(parsed.equip()),
      gear: copyU16(parsed.gear()),
      primary: copyU8(parsed.primary()),
      secondary: copyU8(parsed.secondary()),
      active: copyU8(parsed.active()),
      clip: copyU8(parsed.clip()),
      reserve: copyU16(parsed.reserve()),
    },
  };
  parsed.free();
  return replay;
}

/** Furthest tick the round slider can seek to on the last round. */
function maxSeekTick(replay: Replay): number {
  const last = replay.rounds.reduce((best, round) =>
    round.start_tick >= best.start_tick ? round : best,
  );
  return roundScrubRange(last, replay.rounds, roundPlaybackFallback(replay)).max;
}

function expectScoreMatch(path: string, hud: { t: number; ct: number }): void {
  const replay = loadReplay(path);
  const columns = statsTimeline(replay);
  const last = columns[columns.length - 1];
  const lastRound = replay.rounds.reduce((best, round) =>
    round.start_tick >= best.start_tick ? round : best,
  );
  const seek = maxSeekTick(replay);
  expect(seek).toBeGreaterThan(lastRound.start_tick);
  expect(seek).toBeGreaterThanOrEqual(lastRound.end_tick);
  const atStart = liveScore(replay, lastRound.start_tick);
  const atSeek = liveScore(replay, seek);
  expect(atStart).not.toEqual(atSeek);
  expect(atSeek).toEqual({ ct: hud.ct, t: hud.t });
  expect(`${atSeek.t}-${atSeek.ct}`).toBe(`${hud.t}-${hud.ct}`);
  const score = computeStats(replay, seek);
  expect(last).toBeDefined();
  const names = last?.rows.map((row) => row.name) ?? [];
  expect(names.some((name) => name.includes("(BOT)"))).toBe(false);
  const roster = scoreRoster(replay, seek);
  expect(roster, "score roster at the max seek tick").toHaveLength(10);
  expect(last?.rows, "timeline last column").toHaveLength(10);
  expect(roster.map((slot) => slot.player).sort((a, b) => a - b)).toEqual(
    (last?.rows ?? []).map((row) => row.player).sort((a, b) => a - b),
  );
  for (const player of replay.players) {
    if (player.is_bot) continue;
    const row = last?.rows.find((candidate) => candidate.player === player.index);
    const stats = score[player.index];
    expect(row, playerLabel(player)).toBeDefined();
    expect(row?.values.kills.running, `${player.name} kills`).toBe(stats?.kills);
    expect(row?.values.adr.running, `${player.name} adr`).toBeCloseTo(stats?.adr ?? 0);
    expect(row?.values.kast.running, `${player.name} kast`).toBeCloseTo(stats?.kast ?? 0);
    expect(row?.values.hs.running, `${player.name} hs`).toBeCloseTo(stats?.headshot_percent ?? 0);
    expect(row?.values.opening.running, `${player.name} opening`).toBe(stats?.first_kills);
    expect(row?.values.util.running, `${player.name} util`).toBe(stats?.utility_damage);
    expect(row?.values.flashed.running, `${player.name} flashed`).toBe(stats?.enemies_flashed);
  }
  expectMidMatchRates(replay, columns);
}

/** Round starts where the in-progress round must not move ADR or KAST. */
function midMatchTicks(replay: Replay): { tick: number; label: string }[] {
  const counted = timelineRounds(replay);
  const wanted = new Set([8, 13, 16, 24, 31, 36]);
  const out: { tick: number; label: string }[] = [];
  for (const round of counted) {
    if (!wanted.has(round.number)) continue;
    const earlierEnded = counted.some(
      (other) => other !== round && other.end_tick <= round.start_tick,
    );
    if (!earlierEnded) continue;
    out.push({ tick: round.start_tick, label: `R${round.number} start` });
    const landed = Math.max(round.freeze_end_tick, round.start_tick);
    if (landed > round.start_tick && landed < round.end_tick) {
      out.push({ tick: landed, label: `R${round.number} freeze end` });
    }
  }
  return out;
}

function expectMidMatchRates(replay: Replay, columns: ReturnType<typeof statsTimeline>): void {
  const counted = timelineRounds(replay);
  const samples = midMatchTicks(replay);
  const anchor = counted.some((round) => round.number === 31) ? "R31 start" : "R13 start";
  expect(samples.length).toBeGreaterThanOrEqual(2);
  expect(samples.some((sample) => sample.label === anchor)).toBe(true);
  for (const sample of samples) {
    let done = -1;
    for (let i = 0; i < counted.length; i++) {
      if (counted[i].end_tick <= sample.tick) done = i;
    }
    expect(done, sample.label).toBeGreaterThanOrEqual(0);
    const column = columns[done];
    const score = computeStats(replay, sample.tick);
    for (const player of replay.players) {
      if (player.is_bot) continue;
      const row = column?.rows.find((candidate) => candidate.player === player.index);
      const stats = score[player.index];
      expect(row?.values.adr.running, `${player.name} adr at ${sample.label}`).toBeCloseTo(
        stats?.adr ?? 0,
      );
      expect(row?.values.kast.running, `${player.name} kast at ${sample.label}`).toBeCloseTo(
        stats?.kast ?? 0,
      );
    }
  }
}

describe.skipIf(!mirage || !inferno)("timeline matches Score on the QA demos", () => {
  it("matches every Mirage player at the max seek tick", () => {
    expectScoreMatch(mirage!, { t: 22, ct: 20 });
  }, 180000);

  it("matches every Inferno player at the max seek tick", () => {
    expectScoreMatch(inferno!, { t: 13, ct: 3 });
  }, 180000);
});
