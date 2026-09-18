/**
 * Build a `DemoSeries` from the checked-in Aggregated tutorial modules.
 *
 * Match payloads are loaded through `seriesMatchLoaders` so Vite splits each
 * match into its own chunk. Tags keep every economy class so the strip can
 * print pistol / eco / force / full; habits overlay later filters to
 * `activeRounds`.
 */

import { buildSeries, type DemoSeries, type LoadedDemo } from "@/lib/parse/session";
import { hydrateReplayFromModules } from "../hydrateCore";
import { seriesMatchLoaders } from "./loaders";
import { tutorialSeriesManifest } from "./manifest";
import { tutorialSeriesDemoId } from "./types";

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

  return buildSeries(tutorialSeriesManifest.mapName, demos);
}
