import type { Replay } from "@/lib/replay/replayTypes";

/**
 * One parsed GOTV file. The viewer plays a single active demo today.
 * Multi-demo overlay (same map, freeze-relative trails/nades) stacks more of these
 * keyed by Steam ID + round index, not raw ticks.
 */
export interface LoadedDemo {
  id: string;
  replay: Replay;
  fileName: string;
}

export function demoId(fileName: string, mapName: string): string {
  return `${mapName}|${fileName}`;
}

export function loadedDemo(replay: Replay, fileName: string): LoadedDemo {
  return { id: demoId(fileName, replay.header.map_name), replay, fileName };
}
