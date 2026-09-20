import { normalizePath, ROUTES } from "@/lib/app/routes";

export const TUTORIAL_STEPS = ["replay", "aggregated", "playbook"] as const;
export type TutorialStep = (typeof TUTORIAL_STEPS)[number];

/** `/tutorial`, `/tutorial/aggregated`, `/tutorial/playbook`. */
export function parseTutorialPath(pathname: string): TutorialStep | null {
  const path = normalizePath(pathname);
  if (path === ROUTES.tutorial) return "replay";
  if (path === `${ROUTES.tutorial}/aggregated`) return "aggregated";
  if (path === `${ROUTES.tutorial}/playbook`) return "playbook";
  return null;
}

export function isTutorialPath(pathname: string): boolean {
  return parseTutorialPath(pathname) != null;
}

export function isTutorialAnalyzerPath(pathname: string): boolean {
  const step = parseTutorialPath(pathname);
  return step === "replay" || step === "aggregated";
}

export function isTutorialPlaybookPath(pathname: string): boolean {
  return parseTutorialPath(pathname) === "playbook";
}

export function tutorialHref(step: TutorialStep = "replay"): string {
  if (step === "aggregated") return `${ROUTES.tutorial}/aggregated`;
  if (step === "playbook") return `${ROUTES.tutorial}/playbook`;
  return ROUTES.tutorial;
}

export function nextTutorialStep(step: TutorialStep): TutorialStep | null {
  const index = TUTORIAL_STEPS.indexOf(step);
  if (index < 0 || index >= TUTORIAL_STEPS.length - 1) return null;
  return TUTORIAL_STEPS[index + 1];
}

export function previousTutorialStep(step: TutorialStep): TutorialStep | null {
  const index = TUTORIAL_STEPS.indexOf(step);
  if (index <= 0) return null;
  return TUTORIAL_STEPS[index - 1];
}
