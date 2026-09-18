import { describe, expect, it } from "vitest";
import { makeReplay } from "@/lib/testing/fixtures";
import {
  isTutorialDemoId,
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
});
