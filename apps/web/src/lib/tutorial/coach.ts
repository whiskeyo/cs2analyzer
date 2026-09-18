import type { TutorialStep } from "./query";

export interface TutorialCoachStep {
  id: "welcome" | "radar" | "rounds" | "aggregated";
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
    body: "Try Aggregated on the banner to load a Dust II habits series — several demos, same map.",
  },
];

const AGGREGATED_STEPS: TutorialCoachStep[] = [
  {
    id: "welcome",
    title: "Habits series",
    body: "Four Dust II demos in the same session as a multi-demo drop. Only the habits-window rounds keep ticks.",
  },
  {
    id: "radar",
    title: "Radar",
    body: "Aggregated stacks paths and nades across those demos. Switch a file tab to watch one match.",
  },
  {
    id: "rounds",
    title: "Active rounds",
    body: "Grey chips are outside the habits window. Click a demo tab to see them disabled on the strip.",
  },
  {
    id: "aggregated",
    title: "Aggregated",
    body: "The Aggregated toggle is the habits view. Per-demo playback is one click on a file name.",
  },
];

export function tutorialCoachSteps(step: TutorialStep): TutorialCoachStep[] {
  return step === "aggregated" ? AGGREGATED_STEPS : REPLAY_STEPS;
}
