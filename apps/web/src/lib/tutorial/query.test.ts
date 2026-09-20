import { describe, expect, it } from "vitest";
import { TUTORIAL_ID } from "./identity";
import {
  isAnalyzerSessionVisible,
  isTutorialAnalyzerPath,
  isTutorialPath,
  isTutorialPlaybookPath,
  nextTutorialStep,
  parseTutorialPath,
  previousTutorialStep,
  tutorialHref,
} from "./query";

describe("tutorial path", () => {
  it("parses replay, aggregated, and playbook paths", () => {
    expect(parseTutorialPath("/")).toBeNull();
    expect(parseTutorialPath("/analyzer")).toBeNull();
    expect(parseTutorialPath("/playbook")).toBeNull();
    expect(parseTutorialPath("/tutorial")).toBe("replay");
    expect(parseTutorialPath("/tutorial/")).toBe("replay");
    expect(parseTutorialPath("/tutorial/aggregated")).toBe("aggregated");
    expect(parseTutorialPath("/tutorial/playbook")).toBe("playbook");
    expect(parseTutorialPath("/tutorial/other")).toBeNull();
  });

  it("builds path hrefs that survive a refresh", () => {
    expect(tutorialHref("replay")).toBe("/tutorial");
    expect(tutorialHref("aggregated")).toBe("/tutorial/aggregated");
    expect(tutorialHref()).toBe("/tutorial");
    expect(tutorialHref("playbook")).toBe("/tutorial/playbook");
    expect(parseTutorialPath(tutorialHref("replay"))).toBe("replay");
    expect(parseTutorialPath(tutorialHref("aggregated"))).toBe("aggregated");
    expect(parseTutorialPath(tutorialHref("playbook"))).toBe("playbook");
  });

  it("classifies tutorial analyzer vs playbook shells", () => {
    expect(isTutorialPath("/tutorial")).toBe(true);
    expect(isTutorialPath("/tutorial/aggregated")).toBe(true);
    expect(isTutorialPath("/tutorial/playbook")).toBe(true);
    expect(isTutorialPath("/analyzer")).toBe(false);
    expect(isTutorialAnalyzerPath("/tutorial")).toBe(true);
    expect(isTutorialAnalyzerPath("/tutorial/aggregated")).toBe(true);
    expect(isTutorialAnalyzerPath("/tutorial/playbook")).toBe(false);
    expect(isTutorialPlaybookPath("/tutorial/playbook")).toBe(true);
    expect(isTutorialPlaybookPath("/playbook")).toBe(false);
  });

  it("never treats a tutorial demo id as a live /analyzer session", () => {
    expect(isAnalyzerSessionVisible("/tutorial", TUTORIAL_ID)).toBe(true);
    expect(isAnalyzerSessionVisible("/tutorial/aggregated", TUTORIAL_ID)).toBe(true);
    expect(isAnalyzerSessionVisible("/tutorial/playbook", TUTORIAL_ID)).toBe(false);
    expect(isAnalyzerSessionVisible("/analyzer", TUTORIAL_ID)).toBe(false);
    expect(isAnalyzerSessionVisible("/analyzer", "de_mirage|match.dem")).toBe(true);
    expect(isAnalyzerSessionVisible("/analyzer", null)).toBe(true);
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
