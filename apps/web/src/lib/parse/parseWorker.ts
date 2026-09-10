import init, { parseDemo } from "@/parser/cs2analyzer_wasm.js";
import { errorMessage } from "@/lib/validate/json.ts";
import { decodeList, decodeObject } from "./decode";
import type {
  Blind,
  BombEvent,
  BuyEvent,
  GrenadeThrow,
  Hurt,
  Kill,
  MatchHeader,
  ParseTimings,
  Player,
  Replay,
  Round,
  Shot,
  WorkerOut,
} from "@/lib/replay/replayTypes";

let wasmReady: Promise<void> | null = null;

/** Bytes, not a Response — OVH/Cloudflare omit `application/wasm`, and wasm-bindgen would warn. */
async function loadWasm(): Promise<void> {
  const url = new URL("../../parser/cs2analyzer_wasm_bg.wasm", import.meta.url);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`failed to fetch Wasm: ${res.status} ${res.statusText}`);
  }
  await init({ module_or_path: await res.arrayBuffer() });
}

function ensureWasm(): Promise<void> {
  if (!wasmReady) {
    wasmReady = loadWasm().catch((err) => {
      wasmReady = null;
      throw err;
    });
  }
  return wasmReady;
}

/** Copy tick buffers out of Wasm linear memory before ParsedMatch is freed. */
function copyU32(view: Uint32Array): Uint32Array {
  return view.length === 0 ? new Uint32Array(0) : view.slice();
}

function copyF32(view: Float32Array): Float32Array {
  return view.length === 0 ? new Float32Array(0) : view.slice();
}

function copyU8(view: Uint8Array): Uint8Array {
  return view.length === 0 ? new Uint8Array(0) : view.slice();
}

function copyU16(view: Uint16Array): Uint16Array {
  return view.length === 0 ? new Uint16Array(0) : view.slice();
}

self.onmessage = async (ev: MessageEvent<{ bytes: ArrayBuffer }>) => {
  try {
    const t0 = performance.now();
    await ensureWasm();
    const initMs = performance.now() - t0;

    const data = new Uint8Array(ev.data.bytes);
    const tParse = performance.now();
    const parsed = parseDemo(data, 4, true, (current: number, total: number) => {
      const msg: WorkerOut = { type: "progress", current, total };
      self.postMessage(msg);
    });
    const parseMs = performance.now() - tParse;

    const tJson = performance.now();
    const header = decodeObject<MatchHeader>("header", parsed.headerJson());
    const players = decodeList<Player>("players", parsed.playersJson());
    const rounds = decodeList<Round>("rounds", parsed.roundsJson());
    const grenades = decodeList<GrenadeThrow>("grenades", parsed.grenadesJson());
    const shots = decodeList<Shot>("shots", parsed.shotsJson());
    const kills = decodeList<Kill>("kills", parsed.killsJson());
    const hurts = decodeList<Hurt>("hurts", parsed.hurtsJson());
    const blinds = decodeList<Blind>("blinds", parsed.blindsJson());
    const bombEvents = decodeList<BombEvent>("bombEvents", parsed.bombEventsJson());
    const buyEvents = decodeList<BuyEvent>("buyEvents", parsed.buyEventsJson());
    const jsonMs = performance.now() - tJson;

    const tBuffers = performance.now();
    const replay: Replay = {
      header,
      players,
      rounds,
      grenades,
      shots,
      kills,
      hurts,
      blinds,
      bombEvents,
      buyEvents,
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
    const buffersMs = performance.now() - tBuffers;

    const timings: ParseTimings = {
      initMs,
      parseMs,
      jsonMs,
      buffersMs,
      totalMs: performance.now() - t0,
    };

    const transfer = [
      replay.ticks.ticks.buffer,
      replay.ticks.x.buffer,
      replay.ticks.y.buffer,
      replay.ticks.z.buffer,
      replay.ticks.yaw.buffer,
      replay.ticks.health.buffer,
      replay.ticks.armor.buffer,
      replay.ticks.flags.buffer,
      replay.ticks.money.buffer,
      replay.ticks.equip.buffer,
      replay.ticks.gear.buffer,
      replay.ticks.primary.buffer,
      replay.ticks.secondary.buffer,
      replay.ticks.active.buffer,
      replay.ticks.clip.buffer,
      replay.ticks.reserve.buffer,
    ];
    const msg: WorkerOut = { type: "done", replay, timings };
    self.postMessage(msg, { transfer });
  } catch (err: unknown) {
    const message = errorMessage(err);
    const msg: WorkerOut = { type: "error", message };
    self.postMessage(msg);
  }
};
