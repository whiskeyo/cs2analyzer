import type { DemoSeries } from "@/lib/parse/session";
import type { RoundKind, RoundTag } from "@/lib/parse/roundTags";
import { tutorialSeriesManifest } from "./multi-demo/manifest";
import { isTutorialSeriesActiveRound, tutorialSeriesDemoId } from "./multi-demo/types";
import { TUTORIAL_SERIES_PREFIX } from "./identity";

type SeriesDemoIds = { demos: readonly { id: string }[] };

export { isTutorialSeriesActiveRound };

/** Shown when a round jump / non-full bucket is blocked on the Aggregated tour. */
export const TUTORIAL_AGGREGATED_LOCK_NOTICE = "Tutorial stays on Aggregated full.";

export function tutorialSeriesMetaForDemoId(demoId: string | null | undefined) {
  if (!demoId?.startsWith(TUTORIAL_SERIES_PREFIX)) return undefined;
  return tutorialSeriesManifest.matches.find((meta) => tutorialSeriesDemoId(meta) === demoId);
}

export function isTutorialSeriesSession(demoId: string | null | undefined): boolean {
  return tutorialSeriesMetaForDemoId(demoId) != null;
}

/**
 * Tutorial Aggregated step: stay on Aggregated + full. Blocks live-round jumps,
 * file-tab GOTV, pistol/eco/force buckets, and overlay off.
 */
export function tutorialLocksSeriesToAggregatedFull(
  series: SeriesDemoIds | null | undefined,
): boolean {
  return Boolean(series?.demos.some((demo) => isTutorialSeriesSession(demo.id)));
}

/**
 * Per-demo strip: ordinary demos stay clickable. Tutorial series never jumps a
 * live round — Aggregated full is the only playable overlay.
 */
export function isTutorialSeriesRoundEnabled(demoId: string | null | undefined): boolean {
  if (!tutorialSeriesMetaForDemoId(demoId)) return true;
  return false;
}

/** Aggregated "A" chips: tutorial series only the full-buy bucket. */
export function isTutorialSeriesBucketEnabled(
  demoId: string | null | undefined,
  kind: RoundKind,
): boolean {
  if (!isTutorialSeriesSession(demoId)) return true;
  return kind === "full";
}

/** Numbered Aggregated chips: tutorial series lists them but does not jump. */
export function isTutorialSeriesChipEnabled(demoId: string | null | undefined): boolean {
  return !isTutorialSeriesSession(demoId);
}

/**
 * Overlay / util for the habits-window set (`activeRounds`).
 *
 * CLI windows keep both teams’ ticks. Tagging by focal-team buy would leave
 * CT full empty when those rounds were T-side full buys (or the reverse).
 * Duplicate each active round as `full` for CT and T so both filters bind.
 */
export function tutorialSeriesHabitsTags(series: DemoSeries): Map<string, RoundTag[]> {
  if (!series.demos.some((demo) => isTutorialSeriesSession(demo.id))) {
    return series.tagsByDemo;
  }
  const byId = new Map(
    tutorialSeriesManifest.matches.map((meta) => [tutorialSeriesDemoId(meta), meta]),
  );
  const tagsByDemo = new Map(series.tagsByDemo);
  for (const demo of series.demos) {
    const active = new Set<number>(byId.get(demo.id)?.activeRounds ?? []);
    const existing = tagsByDemo.get(demo.id) ?? [];
    const byRound = new Map(existing.map((tag) => [tag.roundNumber, tag]));
    const tags: RoundTag[] = [];
    for (const roundNumber of active) {
      const round = demo.replay.rounds.find((row) => row.number === roundNumber);
      const base = byRound.get(roundNumber);
      if (!round && !base) continue;
      const startTick = base?.startTick ?? round?.start_tick ?? 0;
      const freezeEndTick = base?.freezeEndTick ?? round?.freeze_end_tick ?? startTick;
      const isOt = base?.isOt ?? false;
      for (const side of ["CT", "T"] as const) {
        tags.push({
          demoId: demo.id,
          roundNumber,
          startTick,
          freezeEndTick,
          sideForFocal: side,
          kind: "full",
          isOt,
        });
      }
    }
    tagsByDemo.set(demo.id, tags);
  }
  return tagsByDemo;
}
