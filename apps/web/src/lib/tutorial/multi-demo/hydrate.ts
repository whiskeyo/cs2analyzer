/**
 * Build a `DemoSeries` from the checked-in Aggregated tutorial modules.
 *
 * Match payloads are loaded through `seriesMatchLoaders` so Vite splits each
 * match into its own chunk. Tags are restricted to `activeRounds` — other
 * round headers stay on the replay for a follow-up greyed-round tour.
 */

import { buildSeries, type DemoSeries, type LoadedDemo } from "@/lib/parse/session";
import { hydrateReplayFromModules } from "../hydrateCore";
import { seriesMatchLoaders } from "./loaders";
import { tutorialSeriesManifest } from "./manifest";
import { tutorialSeriesDemoId } from "./types";

function restrictTagsToActiveRounds(series: DemoSeries): DemoSeries {
  const byId = new Map(
    tutorialSeriesManifest.matches.map((meta) => [tutorialSeriesDemoId(meta), meta]),
  );
  const tagsByDemo = new Map(series.tagsByDemo);
  for (const demo of series.demos) {
    const active = new Set<number>(byId.get(demo.id)?.activeRounds ?? []);
    const tags = (tagsByDemo.get(demo.id) ?? []).filter((tag) => active.has(tag.roundNumber));
    tagsByDemo.set(demo.id, tags);
  }
  return { ...series, tagsByDemo };
}

export async function hydrateTutorialSeries(): Promise<DemoSeries | null> {
  if (tutorialSeriesManifest.matches.length === 0) return null;

  const demos: LoadedDemo[] = [];
  for (const meta of tutorialSeriesManifest.matches) {
    const loader = seriesMatchLoaders[meta.id];
    if (!loader) {
      throw new Error(`Tutorial series loader is missing for "${meta.id}".`);
    }
    const payload = await loader();
    const replay = hydrateReplayFromModules(
      payload.header,
      payload.players,
      payload.rounds,
      {
        grenades: payload.grenades,
        shots: payload.shots,
        kills: payload.kills,
        hurts: payload.hurts,
        blinds: payload.blinds,
        bombEvents: payload.bombEvents,
        buyEvents: payload.buyEvents,
        controllerDump: payload.controllerDump,
      },
      payload,
    );
    demos.push({
      id: tutorialSeriesDemoId(meta),
      replay,
      fileName: meta.fileName,
      file: new File([], meta.fileName),
    });
  }

  return restrictTagsToActiveRounds(buildSeries(tutorialSeriesManifest.mapName, demos));
}
