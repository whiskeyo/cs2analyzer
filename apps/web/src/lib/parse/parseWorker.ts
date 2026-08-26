import init, { parseDemo } from "@/parser/cs2analyzer_wasm.js";
import type { Replay, WorkerOut } from "@/lib/replay/replayTypes";

let wasmReady: Promise<void> | null = null;

function ensureWasm(): Promise<void> {
  if (!wasmReady) {
    wasmReady = init().then(() => undefined);
  }
  return wasmReady;
}

self.onmessage = async (ev: MessageEvent<{ bytes: ArrayBuffer }>) => {
  try {
    await ensureWasm();
    const data = new Uint8Array(ev.data.bytes);
    const parsed = parseDemo(data, 4, true, (current: number, total: number) => {
      const msg: WorkerOut = { type: "progress", current, total };
      self.postMessage(msg);
    });

    const replay: Replay = {
      header: JSON.parse(parsed.headerJson()),
      players: JSON.parse(parsed.playersJson()),
      rounds: JSON.parse(parsed.roundsJson()),
      grenades: JSON.parse(parsed.grenadesJson()),
      shots: JSON.parse(parsed.shotsJson()),
      kills: JSON.parse(parsed.killsJson()),
      hurts: JSON.parse(parsed.hurtsJson()),
      blinds: JSON.parse(parsed.blindsJson()),
      bombEvents: JSON.parse(parsed.bombEventsJson()),
      stats: JSON.parse(parsed.statsJson()),
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
    const msg: WorkerOut = { type: "done", replay };
    self.postMessage(msg, { transfer });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const msg: WorkerOut = { type: "error", message };
    self.postMessage(msg);
  }
};
