import { describe, expect, it } from "vitest";
import { isTutorialCoachAction } from "./coachAction";

describe("tutorial coach actions", () => {
  it("guards known action names", () => {
    expect(isTutorialCoachAction("play-or-scrub")).toBe(true);
    expect(isTutorialCoachAction("draw")).toBe(true);
    expect(isTutorialCoachAction("next")).toBe(false);
    expect(isTutorialCoachAction(null)).toBe(false);
  });
});
