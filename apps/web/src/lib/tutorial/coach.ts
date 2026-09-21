import type { TutorialStep } from "./query";
import type { TutorialCoachAction } from "./coachAction";

/** `data-tutorial` id on the control the ring should follow. */
export type TutorialCoachTarget =
  | "play"
  | "draw"
  | "notes"
  | "review"
  | "hud"
  | "util"
  | "util-throw"
  | "snapshot"
  | "bookmark"
  | "pdf"
  | "next-aggregated"
  | "side"
  | "rounds"
  | "player-filter"
  | "trails"
  | "next-playbook"
  | "strat"
  | "playbook-tools"
  | "strat-notes"
  | "playbook-pdf"
  | "finish";

export interface TutorialCoachStep {
  id: string;
  route: TutorialStep;
  /** Primary ring + callout anchor. */
  target: TutorialCoachTarget;
  /** Extra rings (same step). Callout still follows `target`. */
  extraTargets?: TutorialCoachTarget[];
  doneWhen?: TutorialCoachAction;
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
    id: "review",
    route: "replay",
    target: "review",
    extraTargets: ["hud"],
    body: "Open the Review tab. Selecting a player in the HUD filters the right-side tabs, and Review summarizes that player's performance in the match.",
  },
  {
    id: "util",
    route: "replay",
    target: "util",
    doneWhen: "open-util",
    body: "Switch to the Utility tab to see every grenade thrown in these two rounds.",
  },
  {
    id: "util-throw",
    route: "replay",
    target: "util-throw",
    doneWhen: "jump-grenade",
    body: "Click a grenade in the list to jump playback to when it was thrown.",
  },
  {
    id: "snapshot",
    route: "replay",
    target: "snapshot",
    body: "Take a snapshot of this analyzer view. It appears as a new strat in the Playbook — an important place to keep executes next to your demos.",
  },
  {
    id: "pdf",
    route: "replay",
    target: "pdf",
    extraTargets: ["bookmark"],
    body: "Notes can be exported to PDF from a single demo and from the Playbook. On a single demo the round must have a bookmark or the graphic will not appear in the saved PDF. Each textbox is saved under Notes for the selected round.",
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
    extraTargets: ["rounds"],
    doneWhen: "switch-side",
    body: "Switch CT and T to analyze the same habits from the other side. The round bar at the bottom follows that side. Outside the tutorial, in normal Aggregated mode, all rounds can be viewed — this sample only unlocks a subset.",
  },
  {
    id: "player-filter",
    route: "aggregated",
    target: "player-filter",
    body: "Filter players from the selected team to study one player's movement in this multi-demo Aggregated analyzer.",
  },
  {
    id: "trails",
    route: "aggregated",
    target: "trails",
    body: "Turn Trails on and set Paths to Overall for a summary of how often the player chooses locations during the game.",
  },
  {
    id: "snapshot-agg",
    route: "aggregated",
    target: "snapshot",
    body: "Snapshot this Aggregated overlay into the Playbook the same way as on a single demo. Only the tutorial Playbook is selectable in the destination list.",
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
    body: "Open the sample strats in the tree. One is an Aggregated habits snapshot; the other is fully drawn by hand. Try both styles.",
  },
  {
    id: "playbook-tools",
    route: "playbook",
    target: "playbook-tools",
    body: "Add CT/T pawns and grenades — including nade trails — from the toolbar. You can also upload images and pin YouTube videos on the radar.",
  },
  {
    id: "strat-notes",
    route: "playbook",
    target: "strat-notes",
    body: "Fill Strat notes with callouts, timings, or utility. Type freely, then click Next.",
  },
  {
    id: "playbook-pdf",
    route: "playbook",
    target: "playbook-pdf",
    body: "Playbook notes export to PDF from the book menu (right-click the Playbook). Radar stills and strat notes go with the file.",
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

export function tutorialCoachStepTargets(step: TutorialCoachStep): TutorialCoachTarget[] {
  return [step.target, ...(step.extraTargets ?? [])];
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

export function sameBox(a: Box | null, b: Box | null): boolean {
  if (a == null || b == null) return a === b;
  return a.top === b.top && a.left === b.left && a.width === b.width && a.height === b.height;
}

export function sameBoxes(a: Box[], b: Box[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((box, i) => sameBox(box, b[i] ?? null));
}

/** Every visible element matching the step's `data-tutorial` ids. */
export function coachTargetBoxes(targets: readonly TutorialCoachTarget[]): Box[] {
  if (typeof document === "undefined") return [];
  const out: Box[] = [];
  for (const target of targets) {
    const nodes = document.querySelectorAll(tutorialTargetSelector(target));
    for (const node of nodes) {
      const box = coachTargetBox(node);
      if (box) out.push(box);
    }
  }
  return out;
}
