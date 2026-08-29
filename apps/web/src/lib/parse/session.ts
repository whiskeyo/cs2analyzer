import type { Replay } from "@/lib/replay/replayTypes";
import { tagSeries, type RoundTag } from "./roundTags";

/**
 * One parsed GOTV file. The viewer plays a single active demo today.
 * Multi-demo overlay (same map, freeze-relative trails/nades) stacks more of these
 * keyed by Steam ID + round index, not raw ticks.
 */
export interface LoadedDemo {
  id: string;
  replay: Replay;
  fileName: string;
  /** Browser `File` handle for reload / retry (bytes are not duplicated). */
  file: File;
}

/** Several same-map demos parsed for habits / series analysis. */
export interface DemoSeries {
  mapName: string;
  demos: LoadedDemo[];
  /** Team name shared across files (`header.team_ct` or `team_t`). */
  focalTeam: string;
  /** Built once at parse time; switching files does not re-tag. */
  tagsByDemo: Map<string, RoundTag[]>;
}

/** Stable per-file id within a series (filename alone collides for GOTV drops). */
export function demoId(fileName: string, mapName: string, file?: File): string {
  if (file) {
    return `${mapName}|${fileName}|${file.size}|${file.lastModified}`;
  }
  return `${mapName}|${fileName}`;
}

export function loadedDemo(replay: Replay, fileName: string, file: File): LoadedDemo {
  return { id: demoId(fileName, replay.header.map_name, file), replay, fileName, file };
}

/** Team name that appears in every demo (either side). Falls back to first demo CT. */
export function inferFocalTeam(demos: LoadedDemo[]): string {
  if (demos.length === 0) return "";
  const first = demos[0].replay.header;
  const candidates = new Set<string>([first.team_ct, first.team_t]);
  for (const name of candidates) {
    if (
      demos.every(
        (d) => d.replay.header.team_ct === name || d.replay.header.team_t === name,
      )
    ) {
      return name;
    }
  }
  return first.team_ct;
}

export function buildSeries(mapName: string, demos: LoadedDemo[]): DemoSeries {
  const focalTeam = inferFocalTeam(demos);
  return { mapName, demos, focalTeam, tagsByDemo: tagSeries(demos, focalTeam) };
}
