import { describe, expect, it } from "vitest";
import { parseTutorialQuery, tutorialHref, tutorialSearch } from "./query";

describe("tutorial query", () => {
  it("parses replay and aggregated deep-links", () => {
    expect(parseTutorialQuery("")).toBeNull();
    expect(parseTutorialQuery("map=de_mirage")).toBeNull();
    expect(parseTutorialQuery("tutorial=playbook")).toBeNull();
    expect(parseTutorialQuery("?tutorial=1")).toBe("replay");
    expect(parseTutorialQuery("tutorial=true")).toBe("replay");
    expect(parseTutorialQuery("tutorial=replay")).toBe("replay");
    expect(parseTutorialQuery("tutorial=")).toBe("replay");
    expect(parseTutorialQuery("tutorial")).toBe("replay");
    expect(parseTutorialQuery("?tutorial=aggregated")).toBe("aggregated");
    expect(parseTutorialQuery("tutorial=series")).toBe("aggregated");
  });

  it("builds Analyzer hrefs that survive a refresh", () => {
    expect(tutorialSearch("replay")).toBe("?tutorial=1");
    expect(tutorialSearch("aggregated")).toBe("?tutorial=aggregated");
    expect(tutorialHref("replay")).toBe("/analyzer?tutorial=1");
    expect(tutorialHref("aggregated")).toBe("/analyzer?tutorial=aggregated");
    expect(parseTutorialQuery(tutorialSearch("replay"))).toBe("replay");
    expect(parseTutorialQuery(tutorialSearch("aggregated"))).toBe("aggregated");
  });
});
