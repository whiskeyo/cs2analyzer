/**
 * Lazy entry points so tutorial fixtures stay off the Analyzer cold path.
 *
 * `single-demo/` is a two-round Replay, `multi-demo/` is the Aggregated series,
 * `playbook/` is a sample book for the later tour snapshot step.
 */

import type { DemoSeries } from "@/lib/parse/session";
import type { Playbook } from "@/lib/playbook/types";
import type { Replay } from "@/lib/replay/replayTypes";

export async function loadTutorialReplay(): Promise<Replay> {
  const { hydrateTutorialReplay } = await import("./single-demo/hydrate");
  return hydrateTutorialReplay();
}

export async function loadTutorialSeries(): Promise<DemoSeries | null> {
  const { hydrateTutorialSeries } = await import("./multi-demo/hydrate");
  return hydrateTutorialSeries();
}

export async function loadTutorialPlaybook(): Promise<Playbook> {
  const { tutorialPlaybook } = await import("./playbook/sample");
  return tutorialPlaybook;
}
