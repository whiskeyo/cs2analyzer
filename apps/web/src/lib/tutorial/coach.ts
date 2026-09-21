import type { TutorialStep } from "./query";
import type { TutorialCoachAction } from "./coachAction";

/** `data-tutorial` id on the control the ring / spotlight should follow. */
export type TutorialCoachTarget =
  | "play"
  | "draw"
  | "notes"
  | "next-aggregated"
  | "side"
  | "util"
  | "util-throw"
  | "buy"
  | "next-playbook"
  | "strat"
  | "finish";

export interface TutorialCoachStep {
  id: TutorialCoachTarget;
  route: TutorialStep;
  target: TutorialCoachTarget;
  doneWhen: TutorialCoachAction;
  body: string;
}

export const TUTORIAL_COACH_STEPS: TutorialCoachStep[] = [
  {
    id: "play",
    route: "replay",
    target: "play",
    doneWhen: "play-or-scrub",
    body: "Press Play or drag the round timeline to scrub this GOTV sample.",
  },
  {
    id: "draw",
    route: "replay",
    target: "draw",
    doneWhen: "draw",
    body: "Use the toolbar to select a tool and make notes on top of the GOTV radar. Try different tools to see what they do.",
  },
  {
    id: "notes",
    route: "replay",
    target: "notes",
    doneWhen: "open-notes",
    body: "Open Notes to review what you marked. Tutorial drawings stay ephemeral — they are not saved.",
  },
  {
    id: "next-aggregated",
    route: "replay",
    target: "next-aggregated",
    doneWhen: "next-aggregated",
    body: "Continue to Aggregated to analyze habits across several demos of the same map.",
  },
  {
    id: "side",
    route: "aggregated",
    target: "side",
    doneWhen: "switch-side",
    body: "Switch CT and T to analyze the same habits from the other side.",
  },
  {
    id: "util",
    route: "aggregated",
    target: "util",
    doneWhen: "open-util",
    body: "Switch to the Utility tab to see every grenade thrown in the match.",
  },
  {
    id: "util-throw",
    route: "aggregated",
    target: "util-throw",
    doneWhen: "jump-grenade",
    body: "Click a grenade in the list to jump the radar to that throw.",
  },
  {
    id: "buy",
    route: "aggregated",
    target: "buy",
    doneWhen: "toggle-buy",
    body: "Click Full — that chip is the playable Aggregated overlay. Pistol, eco, and force stay listed but grey.",
  },
  {
    id: "next-playbook",
    route: "aggregated",
    target: "next-playbook",
    doneWhen: "next-playbook",
    body: "Open the sample Playbook to see how strats sit next to the Analyzer.",
  },
  {
    id: "strat",
    route: "playbook",
    target: "strat",
    doneWhen: "open-strat",
    body: "Open the Tutorial strat in the tree to load that layer on the radar.",
  },
  {
    id: "finish",
    route: "playbook",
    target: "finish",
    doneWhen: "finish",
    body: "Finish the tutorial to open the Analyzer drop zone and parse your own GOTV demo.",
  },
];

export function tutorialCoachSteps(route: TutorialStep): TutorialCoachStep[] {
  return TUTORIAL_COACH_STEPS.filter((step) => step.route === route);
}

export function tutorialCoachStepNumber(step: TutorialCoachStep): number {
  return TUTORIAL_COACH_STEPS.findIndex((row) => row.id === step.id) + 1;
}

export function tutorialTargetSelector(target: TutorialCoachTarget): string {
  return `[data-tutorial="${target}"]`;
}

export type CoachPlacement = "below" | "above" | "right" | "left";

export interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface CoachCalloutLayout {
  top: number;
  left: number;
  placement: CoachPlacement;
}

const COACH_GAP = 12;
const COACH_PAD = 12;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function bottom(box: Box): number {
  return box.top + box.height;
}

function right(box: Box): number {
  return box.left + box.width;
}

/** Place a callout next to `target`, preferring below, then above, then right, then left. */
export function placeCoachCallout(
  target: Box,
  callout: { width: number; height: number },
  viewport: { width: number; height: number },
): CoachCalloutLayout {
  const maxLeft = Math.max(COACH_PAD, viewport.width - callout.width - COACH_PAD);
  const maxTop = Math.max(COACH_PAD, viewport.height - callout.height - COACH_PAD);
  const alignLeft = clamp(target.left, COACH_PAD, maxLeft);
  const alignTop = clamp(target.top, COACH_PAD, maxTop);

  if (bottom(target) + COACH_GAP + callout.height + COACH_PAD <= viewport.height) {
    return {
      top: bottom(target) + COACH_GAP,
      left: alignLeft,
      placement: "below",
    };
  }
  if (target.top - COACH_GAP - callout.height >= COACH_PAD) {
    return {
      top: target.top - COACH_GAP - callout.height,
      left: alignLeft,
      placement: "above",
    };
  }
  if (right(target) + COACH_GAP + callout.width + COACH_PAD <= viewport.width) {
    return {
      top: alignTop,
      left: right(target) + COACH_GAP,
      placement: "right",
    };
  }
  if (target.left - COACH_GAP - callout.width >= COACH_PAD) {
    return {
      top: alignTop,
      left: target.left - COACH_GAP - callout.width,
      placement: "left",
    };
  }
  return { top: alignTop, left: alignLeft, placement: "below" };
}

export function coachTargetBox(el: Element | null): Box | null {
  if (el == null) return null;
  if (typeof HTMLElement === "undefined" || !(el instanceof HTMLElement)) return null;
  const rect = el.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  return {
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
  };
}
