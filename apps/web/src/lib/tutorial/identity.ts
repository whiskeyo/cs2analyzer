import type { LoadedDemo } from "@/lib/parse/session";
import type { Replay } from "@/lib/replay/replayTypes";
import { TUTORIAL_FILENAME, TUTORIAL_ID } from "./single-demo/constants";

export const TUTORIAL_DEMO_PREFIX = "tutorial|";
export const TUTORIAL_SERIES_PREFIX = "tutorial-series|";

export { TUTORIAL_FILENAME, TUTORIAL_ID };

/** Name-only handle so `LoadedDemo.file` stays typed without a real `.dem`. */
export function tutorialFileStub(fileName = TUTORIAL_FILENAME): File {
  return new File([], fileName);
}

export function tutorialReplayDemo(replay: Replay): LoadedDemo {
  return {
    id: TUTORIAL_ID,
    replay,
    fileName: TUTORIAL_FILENAME,
    file: tutorialFileStub(),
  };
}

export function isTutorialDemoId(id: string | null | undefined): boolean {
  if (!id) return false;
  return id.startsWith(TUTORIAL_SERIES_PREFIX) || id.startsWith(TUTORIAL_DEMO_PREFIX);
}
