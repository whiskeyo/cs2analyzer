/**
 * Lazy entry points so tutorial fixtures stay off the Analyzer cold path.
 * Playbook (`/playbook`) is a separate viewer and does not use these modules.
 */

import type { DemoSeries } from "@/lib/parse/session";
import type { Replay } from "@/lib/replay/replayTypes";

export async function loadTutorialReplay(): Promise<Replay> {
  const { hydrateTutorialReplay } = await import("./hydrate");
  return hydrateTutorialReplay();
}

export async function loadTutorialSeries(): Promise<DemoSeries | null> {
  const { hydrateTutorialSeries } = await import("./series/hydrate");
  return hydrateTutorialSeries();
}
