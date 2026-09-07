import type { MapCalibration } from "@/lib/replay/replayTypes";
import { PLAYBOOK_PREFERRED_MAP } from "./types";

export function sortedMapNames(cals: Record<string, MapCalibration>): string[] {
  return Object.keys(cals).sort((a, b) => a.localeCompare(b));
}

export function pickInitialMap(names: string[]): string | null {
  if (names.includes(PLAYBOOK_PREFERRED_MAP)) return PLAYBOOK_PREFERRED_MAP;
  return names[0] ?? null;
}
