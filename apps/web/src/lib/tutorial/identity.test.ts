import { describe, expect, it } from "vitest";
import { makeReplay } from "@/lib/testing/fixtures";
import {
  isTutorialDemoId,
  isTutorialLoadedDemo,
  isTutorialNotesFile,
  isTutorialProject,
  TUTORIAL_DEMO_PREFIX,
  TUTORIAL_FILENAME,
  TUTORIAL_ID,
  TUTORIAL_SERIES_PREFIX,
  tutorialFileStub,
  tutorialReplayDemo,
} from "./identity";

describe("tutorial identity", () => {
  it("builds a LoadedDemo with the checked-in single-demo id", () => {
    const replay = makeReplay({ header: { map_name: "de_mirage" } });
    const demo = tutorialReplayDemo(replay);
    expect(demo.id).toBe(TUTORIAL_ID);
    expect(demo.id.startsWith(TUTORIAL_DEMO_PREFIX)).toBe(true);
    expect(demo.fileName).toBe(TUTORIAL_FILENAME);
    expect(demo.file.size).toBe(0);
    expect(tutorialFileStub().name).toBe(TUTORIAL_FILENAME);
  });

  it("detects tutorial demo and series ids without catching ordinary drops", () => {
    expect(isTutorialDemoId(TUTORIAL_ID)).toBe(true);
    expect(isTutorialDemoId(`${TUTORIAL_SERIES_PREFIX}de_dust2|match-0`)).toBe(true);
    expect(isTutorialDemoId("de_mirage|match.dem")).toBe(false);
    expect(isTutorialDemoId(null)).toBe(false);
  });

  it("detects tutorial Saved Notes filenames and project keys", () => {
    expect(isTutorialNotesFile(TUTORIAL_FILENAME)).toBe(true);
    expect(isTutorialNotesFile("tutorial-series-0.dem")).toBe(true);
    expect(isTutorialNotesFile("tutorial-series-3.dem")).toBe(true);
    expect(isTutorialNotesFile("b8-vs-spirit-m1-dust2.dem")).toBe(false);
    expect(isTutorialNotesFile("my-tutorial.dem")).toBe(false);
    expect(
      isTutorialProject({ fileName: TUTORIAL_FILENAME, key: "de_mirage|2|1|tutorial.dem" }),
    ).toBe(true);
    expect(
      isTutorialProject({
        fileName: "tutorial-series-0.dem",
        key: "de_dust2|24|1|tutorial-series-0.dem",
      }),
    ).toBe(true);
    expect(isTutorialProject({ fileName: "match.dem", key: "de_mirage|1|50,100|match.dem" })).toBe(
      false,
    );
    expect(isTutorialLoadedDemo({ id: TUTORIAL_ID, fileName: TUTORIAL_FILENAME })).toBe(true);
    expect(isTutorialLoadedDemo({ id: "de_mirage|match.dem", fileName: "match.dem" })).toBe(false);
  });
});
