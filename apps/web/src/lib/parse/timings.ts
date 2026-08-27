import type { ParseTimings } from "@/lib/replay/replayTypes";

export function formatMs(ms: number): string {
  if (ms >= 1000) {
    return `${(ms / 1000).toFixed(2)}s`;
  }
  return `${Math.round(ms)}ms`;
}

export function formatParseTimings(t: ParseTimings): string {
  const total = formatMs(t.totalMs);
  const wasm = formatMs(t.parseMs);
  const json = formatMs(t.jsonMs);
  const buffers = formatMs(t.buffersMs);
  return `Parsed in ${total} (WASM ${wasm}, JSON ${json}, buffers ${buffers})`;
}
