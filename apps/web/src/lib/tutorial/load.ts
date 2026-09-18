/**
 * Lazy entry points so tutorial fixtures stay off the Analyzer cold path.
 *
 * `single-demo/` is a two-round Replay, `multi-demo/` is the Aggregated series,
 * `playbook/` is a sample book for the later tour snapshot step.
 */

import type { DemoSeries } from "@/lib/parse/session";
import type { Playbook } from "@/lib/playbook/types";
import type { Replay } from "@/lib/replay/replayTypes";

let replayLoad: Promise<Replay> | null = null;
let seriesLoad: Promise<DemoSeries | null> | null = null;
let playbookLoad: Promise<Playbook> | null = null;

/** Test hook: drop in-flight fixture promises so cases stay isolated. */
export function resetTutorialLoadCache(): void {
  replayLoad = null;
  seriesLoad = null;
  playbookLoad = null;
}

export function loadTutorialReplay(): Promise<Replay> {
  replayLoad ??= import("./single-demo/hydrate")
    .then(({ hydrateTutorialReplay }) => hydrateTutorialReplay())
    .catch((err: unknown) => {
      replayLoad = null;
      throw err;
    });
  return replayLoad;
}

export function loadTutorialSeries(): Promise<DemoSeries | null> {
  seriesLoad ??= import("./multi-demo/hydrate")
    .then(({ hydrateTutorialSeries }) => hydrateTutorialSeries())
    .catch((err: unknown) => {
      seriesLoad = null;
      throw err;
    });
  return seriesLoad;
}

export function loadTutorialPlaybook(): Promise<Playbook> {
  playbookLoad ??= import("./playbook/sample")
    .then(({ tutorialPlaybook }) => tutorialPlaybook)
    .catch((err: unknown) => {
      playbookLoad = null;
      throw err;
    });
  return playbookLoad;
}
