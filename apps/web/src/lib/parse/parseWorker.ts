import init, { parseDemo } from "@/parser/cs2analyzer_wasm.js";
import { decodeList, decodeObject } from "./decode";
import type {
  Blind,
  BombEvent,
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
    wasmReady = loadWasm();
  }
  return wasmReady;
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
      ticks: {
        frameCount: parsed.frameCount(),
        playerCount: parsed.playerCount(),
        ticks: parsed.ticks(),
        x: parsed.x(),
        y: parsed.y(),
        z: parsed.z(),
        yaw: parsed.yaw(),
        health: parsed.health(),
        armor: parsed.armor(),
        flags: parsed.flags(),
        money: parsed.money(),
        equip: parsed.equip(),
        gear: parsed.gear(),
        primary: parsed.primary(),
        secondary: parsed.secondary(),
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
    ];
    const msg: WorkerOut = { type: "done", replay, timings };
    self.postMessage(msg, { transfer });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const msg: WorkerOut = { type: "error", message };
    self.postMessage(msg);
  }
};
