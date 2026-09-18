import { describe, expect, it } from "vitest";
import { PLAYBOOK_PREFERRED_MAP } from "@/lib/playbook/types";
import { TUTORIAL_PLAYBOOK_KEY, TUTORIAL_PLAYBOOK_PAGE_ID } from "./playbook/constants";
import {
  nextTutorialStep,
  parseTutorialQuery,
  previousTutorialStep,
  tutorialHref,
  tutorialSearch,
} from "./query";

describe("tutorial query", () => {
  it("parses replay, aggregated, and playbook deep-links", () => {
    expect(parseTutorialQuery("")).toBeNull();
    expect(parseTutorialQuery("map=de_mirage")).toBeNull();
    expect(parseTutorialQuery("?tutorial=1")).toBe("replay");
    expect(parseTutorialQuery("tutorial=true")).toBe("replay");
    expect(parseTutorialQuery("tutorial=replay")).toBe("replay");
    expect(parseTutorialQuery("tutorial=")).toBe("replay");
    expect(parseTutorialQuery("tutorial")).toBe("replay");
    expect(parseTutorialQuery("?tutorial=aggregated")).toBe("aggregated");
    expect(parseTutorialQuery("tutorial=series")).toBe("aggregated");
    expect(parseTutorialQuery("tutorial=2")).toBe("aggregated");
    expect(parseTutorialQuery("tutorial=playbook")).toBe("playbook");
    expect(parseTutorialQuery("tutorial=3")).toBe("playbook");
    expect(
      parseTutorialQuery(
        `?map=${PLAYBOOK_PREFERRED_MAP}&playbook=${TUTORIAL_PLAYBOOK_KEY}&tutorial=playbook`,
      ),
    ).toBe("playbook");
  });

  it("builds Analyzer and Playbook hrefs that survive a refresh", () => {
    expect(tutorialSearch("replay")).toBe("?tutorial=1");
    expect(tutorialSearch("aggregated")).toBe("?tutorial=aggregated");
    expect(tutorialSearch("playbook")).toBe("?tutorial=playbook");
    expect(tutorialHref("replay")).toBe("/analyzer?tutorial=1");
    expect(tutorialHref("aggregated")).toBe("/analyzer?tutorial=aggregated");
    expect(tutorialHref()).toBe("/analyzer?tutorial=1");
    expect(tutorialHref("playbook")).toBe(
      `/playbook?map=${PLAYBOOK_PREFERRED_MAP}&playbook=${TUTORIAL_PLAYBOOK_KEY}&strat=${TUTORIAL_PLAYBOOK_PAGE_ID}&tutorial=playbook`,
    );
    expect(parseTutorialQuery(tutorialSearch("replay"))).toBe("replay");
    expect(parseTutorialQuery(tutorialSearch("aggregated"))).toBe("aggregated");
    expect(parseTutorialQuery(tutorialHref("playbook").split("?")[1] ?? "")).toBe("playbook");
  });

  it("walks Replay → Aggregated → Playbook", () => {
    expect(nextTutorialStep("replay")).toBe("aggregated");
    expect(nextTutorialStep("aggregated")).toBe("playbook");
    expect(nextTutorialStep("playbook")).toBeNull();
    expect(previousTutorialStep("replay")).toBeNull();
    expect(previousTutorialStep("aggregated")).toBe("replay");
    expect(previousTutorialStep("playbook")).toBe("aggregated");
  });
});
