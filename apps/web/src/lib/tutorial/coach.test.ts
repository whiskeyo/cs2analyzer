import { describe, expect, it } from "vitest";
import {
  coachTargetBox,
  placeCoachCallout,
  TUTORIAL_COACH_STEPS,
  tutorialCoachStepNumber,
  tutorialCoachStepTargets,
  tutorialCoachSteps,
  tutorialTargetSelector,
} from "./coach";

describe("tutorial coach steps", () => {
  it("covers Single, Aggregated, and Playbook in tour order", () => {
    expect(tutorialCoachSteps("replay").map((s) => s.id)).toEqual([
      "play",
      "draw",
      "notes",
      "review",
      "util",
      "util-throw",
      "snapshot",
      "pdf",
      "next-aggregated",
    ]);
    expect(tutorialCoachSteps("aggregated").map((s) => s.id)).toEqual([
      "side",
      "player-filter",
      "trails",
      "snapshot-agg",
      "next-playbook",
    ]);
    expect(tutorialCoachSteps("playbook").map((s) => s.id)).toEqual([
      "strat",
      "playbook-tools",
      "strat-notes",
      "playbook-pdf",
      "finish",
    ]);
    expect(new Set(TUTORIAL_COACH_STEPS.map((step) => step.id)).size).toBe(
      TUTORIAL_COACH_STEPS.length,
    );
  });

  it("rings CT/T with the round bar and Review with the HUD", () => {
    const side = tutorialCoachSteps("aggregated")[0]!;
    expect(tutorialCoachStepTargets(side)).toEqual(["side", "rounds"]);
    const review = tutorialCoachSteps("replay").find((step) => step.id === "review");
    expect(tutorialCoachStepTargets(review!)).toEqual(["review", "hud"]);
  });

  it("numbers steps across the whole tour", () => {
    const notes = tutorialCoachSteps("replay")[2]!;
    const finish = tutorialCoachSteps("playbook").at(-1)!;
    expect(tutorialCoachStepNumber(notes)).toBe(3);
    expect(tutorialCoachStepNumber(finish)).toBe(TUTORIAL_COACH_STEPS.length);
  });

  it("builds a data-tutorial selector", () => {
    expect(tutorialTargetSelector("play")).toBe('[data-tutorial="play"]');
  });
});

describe("placeCoachCallout", () => {
  const callout = { width: 240, height: 100 };
  const viewport = { width: 800, height: 600 };

  it("prefers below the target when there is room", () => {
    const layout = placeCoachCallout(
      { top: 40, left: 80, width: 120, height: 32 },
      callout,
      viewport,
    );
    expect(layout.placement).toBe("below");
    expect(layout.top).toBe(40 + 32 + 12);
    expect(layout.left).toBe(80);
  });

  it("flips above when the target sits on the bottom edge", () => {
    const layout = placeCoachCallout(
      { top: 540, left: 80, width: 120, height: 40 },
      callout,
      viewport,
    );
    expect(layout.placement).toBe("above");
    expect(layout.top).toBe(540 - 12 - 100);
  });

  it("uses the right side when vertical space is gone", () => {
    const layout = placeCoachCallout(
      { top: 80, left: 20, width: 80, height: 420 },
      callout,
      viewport,
    );
    expect(layout.placement).toBe("right");
    expect(layout.left).toBe(20 + 80 + 12);
  });

  it("clamps into the viewport", () => {
    const layout = placeCoachCallout(
      { top: 10, left: 700, width: 90, height: 24 },
      callout,
      viewport,
    );
    expect(layout.left).toBe(800 - 240 - 12);
  });
});

describe("coachTargetBox", () => {
  it("returns null without a target", () => {
    expect(coachTargetBox(null)).toBeNull();
  });
});
