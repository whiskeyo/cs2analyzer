import type { TutorialStep } from "./query";

export interface TutorialCoachStep {
  id: "welcome" | "radar" | "rounds" | "aggregated" | "tree" | "board";
  title: string;
  body: string;
}

const REPLAY_STEPS: TutorialCoachStep[] = [
  {
    id: "welcome",
    title: "No demo required",
    body: "This two-round Mirage sample loads instead of a .dem drop. Exit any time and drop your own file.",
  },
  {
    id: "radar",
    title: "Radar",
    body: "Players, nades, and shots on a 2D map. Playback and drawing sit with the radar.",
  },
  {
    id: "rounds",
    title: "Round strip",
    body: "Jump either sample round from the strip under the radar.",
  },
  {
    id: "aggregated",
    title: "Aggregated next",
    body: "Next on the banner loads a Dust II habits series — several demos, same map.",
  },
];

const AGGREGATED_STEPS: TutorialCoachStep[] = [
  {
    id: "welcome",
    title: "Habits series",
    body: "Four Dust II demos in the same session as a multi-demo drop. The strip lists every round; Aggregated full is the playable overlay.",
  },
  {
    id: "radar",
    title: "Radar",
    body: "Aggregated stacks paths and nades across those demos. Switch a file tab to watch one match.",
  },
  {
    id: "rounds",
    title: "Round strip",
    body: "Pistol, eco, and force stay visible but grey. Only the Full Aggregated chip is live.",
  },
  {
    id: "aggregated",
    title: "Playbook next",
    body: "Next on the banner opens a sample playbook. Grey rounds stay listed on this series.",
  },
];

const PLAYBOOK_STEPS: TutorialCoachStep[] = [
  {
    id: "welcome",
    title: "Sample playbook",
    body: "A Mirage book with empty notes — no invented coordinates. Drawings stay on this machine.",
  },
  {
    id: "tree",
    title: "Playbook tree",
    body: "Maps, then named books. This sample is titled Tutorial in the tree.",
  },
  {
    id: "board",
    title: "Board",
    body: "Draw nades and tokens on the radar. Finish on the banner when you are done.",
  },
];

export function tutorialCoachSteps(step: TutorialStep): TutorialCoachStep[] {
  if (step === "aggregated") return AGGREGATED_STEPS;
  if (step === "playbook") return PLAYBOOK_STEPS;
  return REPLAY_STEPS;
}
