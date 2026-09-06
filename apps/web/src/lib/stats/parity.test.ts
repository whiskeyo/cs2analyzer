/**
 * Checks the browser scoreboard against the Rust one on a real demo.
 *
 * `analysis.rs` and `stats.ts` implement the same formulas twice, and nothing
 * used to compare them — the shared subset was in sync by inspection only. This
 * drives the `cs2analyzer` CLI over a GOTV file, rebuilds the `Replay` the
 * worker would have produced, and asserts the TS tally matches field by field.
 *
 * Opt-in, because no demo is committable (`.demos/` is gitignored and the files
 * are hundreds of megabytes):
 *
 *     cargo build --release -p cs2analyzer-cli
 *     CS2_DEMO=.demos/your.dem npx vitest run src/lib/stats/parity.test.ts
 */

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { decodeList, decodeObject } from "@/lib/parse/decode";
import { computeStats } from "./stats";
import type {
  Blind,
  BombEvent,
  GrenadeThrow,
  Hurt,
  Kill,
  MatchHeader,
  Player,
  PlayerStats,
  Replay,
  Round,
  Shot,
  TickBuffers,
} from "@/lib/replay/replayTypes";

const REPO = resolve(__dirname, "../../../../..");
const demo = process.env.CS2_DEMO ? resolve(REPO, process.env.CS2_DEMO) : null;

function cliPath(): string | null {
  const dirs = [process.env.CARGO_TARGET_DIR, join(REPO, "target")].filter(
    (dir): dir is string => !!dir,
  );
  for (const dir of dirs) {
    const bin = join(dir, "release", "cs2analyzer");
    if (existsSync(bin)) return bin;
  }
  return null;
}

const cli = cliPath();
const ready = !!demo && existsSync(demo) && !!cli;

/** Rust-side tick buffer, before it becomes typed arrays. */
interface RawTicks {
  frame_count: number;
  player_count: number;
  ticks: number[];
  x: number[];
  y: number[];
  z: number[];
  yaw: number[];
  health: number[];
  armor: number[];
  flags: number[];
  money: number[];
  equip: number[];
  gear: number[];
  primary: number[];
  secondary: number[];
  active: number[];
}

interface RawReplay {
  header: MatchHeader;
  players: Player[];
  rounds: Round[];
  grenades: GrenadeThrow[];
  shots: Shot[];
  kills: Kill[];
  hurts: Hurt[];
  blinds: Blind[];
  bomb_events: BombEvent[];
  ticks: RawTicks;
  stats: PlayerStats[];
}

/** One CLI run: parsing a GOTV file takes about 20 seconds. */
function dumpReplay(untilTick?: number): RawReplay {
  if (!cli || !demo) throw new Error("no CLI or demo");
  const args = [demo, "--section", "replay", "--quiet"];
  if (untilTick != null) args.push("--tick", String(untilTick));
  const out = execFileSync(cli, args, { maxBuffer: 1 << 30, encoding: "utf8" });
  return JSON.parse(out) as RawReplay;
}

let wholeMatch: RawReplay | null = null;

/** Shared by the tests that do not need a tick cut-off, so we parse once. */
function fullDump(): RawReplay {
  wholeMatch ??= dumpReplay();
  return wholeMatch;
}

function toReplay(raw: RawReplay): Replay {
  const t = raw.ticks;
  const ticks: TickBuffers = {
    frameCount: t.frame_count,
    playerCount: t.player_count,
    ticks: new Uint32Array(t.ticks),
    x: new Float32Array(t.x),
    y: new Float32Array(t.y),
    z: new Float32Array(t.z),
    yaw: new Float32Array(t.yaw),
    health: new Uint8Array(t.health),
    armor: new Uint8Array(t.armor),
    flags: new Uint8Array(t.flags),
    money: new Uint16Array(t.money),
    equip: new Uint16Array(t.equip),
    gear: new Uint16Array(t.gear),
    primary: new Uint8Array(t.primary),
    secondary: new Uint8Array(t.secondary),
    active: new Uint8Array(t.active),
  };
  return {
    header: raw.header,
    players: raw.players,
    rounds: raw.rounds,
    grenades: [],
    shots: [],
    kills: raw.kills,
    hurts: raw.hurts,
    blinds: raw.blinds,
    bombEvents: raw.bomb_events,
    ticks,
  };
}

/** Metrics both sides compute. TS-only ones (rating, clutches) are not here. */
const SHARED_COUNTS = [
  "kills",
  "deaths",
  "assists",
  "headshots",
  "damage",
  "utility_damage",
  "enemies_flashed",
  "first_kills",
  "first_deaths",
  "kast_rounds",
  "rounds",
  "multi_kills_2",
  "multi_kills_3",
  "multi_kills_4",
  "aces",
  "flash_assists",
  "plants",
  "defuses",
  "trade_kills",
  "entry_attempts",
  "rounds_ct",
  "rounds_t",
  "kills_ct",
  "kills_t",
  "deaths_ct",
  "deaths_t",
  "damage_ct",
  "damage_t",
] as const satisfies readonly (keyof PlayerStats)[];

const SHARED_RATES = [
  "adr",
  "headshot_percent",
  "kast",
  "kd",
  "entry_success",
  "adr_ct",
  "adr_t",
] as const satisfies readonly (keyof PlayerStats)[];

function expectAgrees(replay: Replay, rust: PlayerStats[], tick: number) {
  const ts = computeStats(replay, tick);
  expect(ts).toHaveLength(rust.length);
  for (const expected of rust) {
    const actual = ts[expected.player];
    const who = replay.players[expected.player]?.name ?? `#${expected.player}`;
    for (const field of SHARED_COUNTS) {
      expect(actual[field], `${who} ${field}`).toBe(expected[field]);
    }
    for (const field of SHARED_RATES) {
      expect(actual[field], `${who} ${field}`).toBeCloseTo(expected[field], 2);
    }
  }
}

describe.skipIf(!ready)("Rust and TS scoreboards agree", () => {
  it("matches every shared metric at the end of the match", () => {
    const raw = fullDump();
    expectAgrees(toReplay(raw), raw.stats, raw.header.playback_ticks);
  }, 300_000);

  it("matches part way through, where the tick cut-offs live", () => {
    // Half time: side-dependent tallies have swapped by here.
    const rounds = fullDump().rounds;
    const mid = rounds[Math.floor(rounds.length / 2)]?.end_tick ?? 0;
    const raw = dumpReplay(mid);
    expectAgrees(toReplay(raw), raw.stats, mid);
  }, 300_000);
});

describe.skipIf(!ready)("the worker boundary shapes match real parser output", () => {
  it("accepts every payload a real demo produces", () => {
    const raw = fullDump();
    expect(decodeObject("header", JSON.stringify(raw.header))).toBeTruthy();
    expect(decodeList("players", JSON.stringify(raw.players))).toHaveLength(raw.players.length);
    expect(decodeList("rounds", JSON.stringify(raw.rounds))).toHaveLength(raw.rounds.length);
    expect(decodeList("kills", JSON.stringify(raw.kills))).toHaveLength(raw.kills.length);
    expect(decodeList("hurts", JSON.stringify(raw.hurts))).toHaveLength(raw.hurts.length);
    expect(decodeList("blinds", JSON.stringify(raw.blinds))).toHaveLength(raw.blinds.length);
    expect(decodeList("bombEvents", JSON.stringify(raw.bomb_events))).toHaveLength(
      raw.bomb_events.length,
    );
    expect(decodeList("grenades", JSON.stringify(raw.grenades))).toHaveLength(raw.grenades.length);
    expect(decodeList("shots", JSON.stringify(raw.shots))).toHaveLength(raw.shots.length);
  }, 300_000);
});
