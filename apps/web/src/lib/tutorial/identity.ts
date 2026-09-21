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

/** Fixture filenames that must never appear in Saved Notes. */
export function isTutorialNotesFile(fileName: string | null | undefined): boolean {
  if (!fileName) return false;
  const name = fileName.trim();
  if (name === TUTORIAL_FILENAME) return true;
  return /^tutorial-series-.+\.dem$/i.test(name);
}

export function isTutorialProject(project: { fileName?: string; key?: string }): boolean {
  if (isTutorialNotesFile(project.fileName)) return true;
  if (!project.key) return false;
  const fileName = project.key.split("|").at(-1);
  return isTutorialNotesFile(fileName);
}

export function isTutorialLoadedDemo(
  demo: { id?: string; fileName?: string } | null | undefined,
): boolean {
  if (!demo) return false;
  return isTutorialDemoId(demo.id) || isTutorialNotesFile(demo.fileName);
}
