/** Checked-in Aggregated tutorial identity (no `.dem` in git). */

import type { TutorialEventJson, TutorialTickArrays } from "../hydrateCore";

export interface TutorialSeriesMatchMeta {
  id: string;
  fileName: string;
  mapName: string;
  /** Round numbers that keep habits-window ticks / participate in Aggregated. */
  activeRounds: number[];
}

export interface TutorialSeriesManifest {
  mapName: string;
  habitsWindowSec: number;
  tickStride: number;
  matches: TutorialSeriesMatchMeta[];
}

/** Shared match payload so generated modules with different lengths still typecheck. */
export type SeriesMatchPayload = TutorialTickArrays &
  TutorialEventJson & {
    header: unknown;
    players: unknown;
    rounds: unknown;
  };

export function tutorialSeriesDemoId(
  meta: Pick<TutorialSeriesMatchMeta, "id" | "mapName">,
): string {
  return `tutorial-series|${meta.mapName}|${meta.id}`;
}

/** Follow-up tour hook: grey rounds that are not in `activeRounds`. */
export function isTutorialSeriesActiveRound(
  meta: TutorialSeriesMatchMeta | undefined,
  roundNumber: number,
): boolean {
  return Boolean(meta?.activeRounds.includes(roundNumber));
}
